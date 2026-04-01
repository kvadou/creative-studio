import { generateVideo } from '../video/veo-generate.js';
import { prisma } from '../../lib/prisma.js';
import { uploadToS3 } from '../../lib/s3.js';
import crypto from 'crypto';

/**
 * Build a short video prompt from a shot's scene description and camera angle.
 * Adds subtle animation cues for Veo — character gestures, camera motion, environmental detail.
 */
function buildVideoPrompt(sceneDescription: string, cameraAngle?: string | null): string {
  const cameraMotion: Record<string, string> = {
    'wide': 'slow dolly forward',
    'medium': 'gentle pan left to right',
    'close-up': 'slow zoom in with shallow depth of field',
    'over-shoulder': 'slight push-in over shoulder',
    'bird-eye': 'slow overhead rotation',
    'low-angle': 'slow tilt upward',
  };

  const motion = cameraAngle ? cameraMotion[cameraAngle] || 'subtle camera movement' : 'subtle camera movement';

  return `${sceneDescription}. ${motion}. Subtle character gestures and gentle environmental motion. Children's animation style.`;
}

/**
 * Process video generation for all ready shots in an episode.
 * Runs sequentially — Veo is slow (11s to 6min per video) and rate-limited.
 */
export async function processShotVideo(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
    include: {
      shots: { orderBy: { orderIndex: 'asc' } },
    },
  });

  // Update episode status to VIDEO
  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: 'VIDEO' },
  });

  const aspectRatio = episode.format === 'SHORT' ? '9:16' as const : '16:9' as const;

  for (const shot of episode.shots) {
    // Skip shots without completed art
    if (shot.imageStatus !== 'COMPLETE' || !shot.imageUrl) {
      console.warn(`[shot-video] Skipping shot ${shot.orderIndex} (${shot.id}) — art not ready (imageStatus: ${shot.imageStatus})`);
      continue;
    }

    // Skip shots that already have video or are not pending
    if (shot.videoStatus !== 'PENDING') {
      continue;
    }

    try {
      // Mark as generating
      await prisma.shot.update({
        where: { id: shot.id },
        data: { videoStatus: 'ASSET_GENERATING' },
      });

      // Download the shot's art image
      const imageResponse = await fetch(shot.imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download shot image: ${imageResponse.status}`);
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Build video prompt with animation cues
      const prompt = buildVideoPrompt(shot.sceneDescription, shot.cameraAngle);

      // Generate video via Veo
      const videoBuffer = await generateVideo(prompt, imageBuffer, {
        duration: 6,
        aspectRatio,
        resolution: '720p',
      });

      // Upload to S3
      const videoKey = `episodes/${episodeId}/shots/shot-${shot.orderIndex}-video-${crypto.randomUUID()}.mp4`;
      const videoUrl = await uploadToS3(videoBuffer, videoKey, 'video/mp4');

      // Update shot record
      await prisma.shot.update({
        where: { id: shot.id },
        data: {
          videoUrl,
          videoKey,
          videoStatus: 'COMPLETE',
          videoDuration: 6,
        },
      });

      console.log(`[shot-video] Shot ${shot.orderIndex} video complete — ${videoKey}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during video generation';
      console.error(`[shot-video] Shot ${shot.orderIndex} (${shot.id}) failed:`, errorMessage);

      await prisma.shot.update({
        where: { id: shot.id },
        data: { videoStatus: 'ASSET_FAILED' },
      });
    }
  }

  // Check if all shots have completed video — if so, advance to ASSEMBLING
  const updatedShots = await prisma.shot.findMany({
    where: { episodeId },
    select: { videoStatus: true },
  });

  const allComplete = updatedShots.length > 0 && updatedShots.every(s => s.videoStatus === 'COMPLETE');

  if (allComplete) {
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'ASSEMBLING' },
    });
    console.log(`[shot-video] All shots complete — episode ${episodeId} advanced to ASSEMBLING`);
  }
}
