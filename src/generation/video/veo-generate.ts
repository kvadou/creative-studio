import { getGeminiClient } from '../../lib/gemini.js';
import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';
import { uploadToS3 } from '../../lib/s3.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

export interface VideoGenerationOptions {
  duration?: 4 | 6 | 8;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
}

/**
 * Core: calls Veo API to generate video from a source image + prompt.
 * Returns the raw video buffer.
 */
export async function generateVideo(
  prompt: string,
  sourceImageBuffer: Buffer,
  options: VideoGenerationOptions = {}
): Promise<Buffer> {
  const ai = getGeminiClient();
  const { duration = 4, aspectRatio = '16:9', resolution = '720p' } = options;

  // Start the video generation operation
  let operation = await ai.models.generateVideos({
    model: config.veoModel,
    prompt,
    image: {
      imageBytes: sourceImageBuffer.toString('base64'),
      mimeType: 'image/png',
    },
    config: {
      aspectRatio,
      durationSeconds: duration,
      // Note: resolution only supports 720p for image-to-video in preview
    },
  });

  // Poll until complete (Veo latency: 11s to 6 min)
  while (!operation.done) {
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 10s intervals
    operation = await ai.operations.get({ operation: operation });
  }

  // Extract generated video
  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo) {
    throw new Error('Veo did not return a video in the response');
  }

  // Download video to a temp file (SDK writes to disk)
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'veo-'));
  const tmpPath = path.join(tmpDir, 'output.mp4');
  try {
    await ai.files.download({ file: generatedVideo, downloadPath: tmpPath });
    return await fs.readFile(tmpPath);
  } finally {
    // Clean up temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Orchestrator: runs as a background job.
 * Downloads source image from URL, generates video, uploads to S3, updates DB.
 */
export async function processVideoGenerationFromUrl(
  illustrationId: string,
  sourceImageUrl: string,
  prompt: string,
  options: VideoGenerationOptions = {}
): Promise<void> {
  try {
    // Update status to GENERATING
    await prisma.illustration.update({
      where: { id: illustrationId },
      data: { status: 'GENERATING' },
    });

    // Download the source image
    const response = await fetch(sourceImageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download source image: ${response.status}`);
    }
    const sourceImageBuffer = Buffer.from(await response.arrayBuffer());

    // Generate the video
    const videoBuffer = await generateVideo(prompt, sourceImageBuffer, options);

    // Upload video to S3
    const illustration = await prisma.illustration.findUnique({
      where: { id: illustrationId },
    });
    const safeName = (illustration?.name || 'video').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const videoKey = `videos/${safeName}-${crypto.randomUUID()}.mp4`;
    const videoUrl = await uploadToS3(videoBuffer, videoKey, 'video/mp4');

    // Create IllustrationGeneration record
    await prisma.illustrationGeneration.create({
      data: {
        illustrationId,
        provider: 'VEO',
        prompt,
        modelVersion: config.veoModel,
        savedImageUrl: videoUrl,
        savedImageKey: videoKey,
        selected: true,
      },
    });

    // Update Illustration to COMPLETED
    await prisma.illustration.update({
      where: { id: illustrationId },
      data: {
        status: 'COMPLETED',
        videoUrl,
        videoKey,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during video generation';
    console.error(`Video generation failed for ${illustrationId}:`, errorMessage);

    await prisma.illustration.update({
      where: { id: illustrationId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  }
}
