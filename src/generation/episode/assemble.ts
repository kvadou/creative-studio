import ffmpeg from 'fluent-ffmpeg';
import { prisma } from '../../lib/prisma.js';
import { uploadToS3 } from '../../lib/s3.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

/**
 * Assemble all shot videos + audio into a single final video.
 *
 * Pipeline:
 * 1. Download shot videos and audio to temp dir
 * 2. For each shot: merge video + audio into a clip (or use video as-is if no audio)
 * 3. Concatenate all clips in order via FFmpeg concat demuxer
 * 4. Upload final video to S3
 * 5. Update episode with finalVideoUrl
 */
export async function assembleEpisode(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
    include: {
      shots: { orderBy: { orderIndex: 'asc' } },
    },
  });

  // Update status
  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: 'ASSEMBLING' },
  });

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'episode-assemble-'));

  try {
    const readyShots = episode.shots.filter(s => s.videoUrl && s.videoStatus === 'COMPLETE');
    if (readyShots.length === 0) {
      throw new Error('No completed shot videos to assemble');
    }

    console.log(`[Assemble] Starting assembly for "${episode.title}" — ${readyShots.length} shots`);

    // Step 1: Download all shot assets to temp dir
    const clipPaths: string[] = [];

    for (const shot of readyShots) {
      const videoPath = path.join(tmpDir, `shot-${shot.orderIndex}-video.mp4`);
      const audioPath = path.join(tmpDir, `shot-${shot.orderIndex}-audio.mp3`);
      const clipPath = path.join(tmpDir, `shot-${shot.orderIndex}-clip.mp4`);

      // Download video
      const videoResp = await fetch(shot.videoUrl!);
      if (!videoResp.ok) throw new Error(`Failed to download video for shot ${shot.orderIndex}`);
      await fs.writeFile(videoPath, Buffer.from(await videoResp.arrayBuffer()));

      // Download audio if available
      let hasAudio = false;
      if (shot.audioUrl && shot.audioStatus === 'COMPLETE') {
        const audioResp = await fetch(shot.audioUrl);
        if (audioResp.ok) {
          await fs.writeFile(audioPath, Buffer.from(await audioResp.arrayBuffer()));
          hasAudio = true;
        }
      }

      // Step 2: Merge video + audio (or just re-encode video for consistent format)
      if (hasAudio) {
        await mergeVideoAudio(videoPath, audioPath, clipPath);
      } else {
        // Re-encode for consistent codec/framerate across all clips
        await normalizeVideo(videoPath, clipPath);
      }

      clipPaths.push(clipPath);
      console.log(`[Assemble] Shot ${shot.orderIndex} prepared (audio: ${hasAudio})`);
    }

    // Step 3: Concatenate all clips
    const concatListPath = path.join(tmpDir, 'concat.txt');
    const concatList = clipPaths.map(p => `file '${p}'`).join('\n');
    await fs.writeFile(concatListPath, concatList);

    const outputPath = path.join(tmpDir, 'final.mp4');
    await concatenateClips(concatListPath, outputPath);

    // Get duration
    const duration = await getVideoDuration(outputPath);

    // Step 4: Upload to S3
    const finalBuffer = await fs.readFile(outputPath);
    const videoKey = `episodes/${episodeId}/final-${crypto.randomUUID()}.mp4`;
    const videoUrl = await uploadToS3(finalBuffer, videoKey, 'video/mp4');

    // Step 5: Update episode
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        finalVideoUrl: videoUrl,
        finalVideoKey: videoKey,
        finalDuration: Math.round(duration),
        status: 'REVIEW',
      },
    });

    console.log(`[Assemble] Episode "${episode.title}" assembled — ${Math.round(duration)}s → ${videoKey}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown assembly error';
    console.error(`[Assemble] Failed for episode ${episodeId}:`, msg);

    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'ASSEMBLING' }, // Stay in ASSEMBLING so user can retry
    });

    throw error;
  } finally {
    // Clean up temp dir
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── FFmpeg helpers ──────────────────────────────────────────────────

function mergeVideoAudio(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-r', '30',
        '-pix_fmt', 'yuv420p',
        '-shortest',       // End when shortest input ends
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('error', (err: Error) => reject(new Error(`Merge failed: ${err.message}`)))
      .on('end', () => resolve())
      .run();
  });
}

function normalizeVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-an',              // No audio
        '-r', '30',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('error', (err: Error) => reject(new Error(`Normalize failed: ${err.message}`)))
      .on('end', () => resolve())
      .run();
  });
}

function concatenateClips(concatListPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c', 'copy',       // Stream copy (already normalized)
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('error', (err: Error) => reject(new Error(`Concat failed: ${err.message}`)))
      .on('end', () => resolve())
      .run();
  });
}

function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}
