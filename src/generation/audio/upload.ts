import { uploadToS3 } from '../../lib/s3.js';
import crypto from 'crypto';

export async function uploadAudioPreview(
  buffer: Buffer,
  voiceDescription: string
): Promise<{ url: string; key: string }> {
  const safeName = voiceDescription.slice(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `audio/previews/${safeName}-${crypto.randomUUID()}.mp3`;
  const url = await uploadToS3(buffer, key, 'audio/mpeg');
  return { url, key };
}

export async function uploadVoiceSample(
  buffer: Buffer,
  voiceName: string
): Promise<{ url: string; key: string }> {
  const safeName = voiceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `audio/samples/${safeName}-${crypto.randomUUID()}.mp3`;
  const url = await uploadToS3(buffer, key, 'audio/mpeg');
  return { url, key };
}

export async function uploadTtsAudio(
  buffer: Buffer,
  voiceName: string
): Promise<{ url: string; key: string }> {
  const safeName = voiceName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `audio/tts/${safeName}-${crypto.randomUUID()}.mp3`;
  const url = await uploadToS3(buffer, key, 'audio/mpeg');
  return { url, key };
}

export async function uploadLineAudio(
  buffer: Buffer,
  scriptId: string,
  sequence: number
): Promise<{ url: string; key: string }> {
  const key = `audio/lines/${scriptId}-${sequence}-${crypto.randomUUID()}.mp3`;
  const url = await uploadToS3(buffer, key, 'audio/mpeg');
  return { url, key };
}

export async function uploadStitchedAudio(
  buffer: Buffer,
  scriptId: string
): Promise<{ url: string; key: string }> {
  const timestamp = Date.now();
  const key = `audio/scripts/${scriptId}-stitched-${timestamp}.mp3`;
  const url = await uploadToS3(buffer, key, 'audio/mpeg');
  return { url, key };
}
