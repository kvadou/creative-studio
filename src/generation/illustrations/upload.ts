import { uploadToS3, deleteFromS3, getS3SignedUrl } from '../../lib/s3.js';
import crypto from 'crypto';

export async function uploadSourcePhoto(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const ext = originalName.split('.').pop() || 'jpg';
  const key = `illustrations/photos/${crypto.randomUUID()}.${ext}`;
  const url = await uploadToS3(buffer, key, contentType);
  return { url, key };
}

export async function uploadIllustration(
  buffer: Buffer,
  name: string
): Promise<{ url: string; key: string }> {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `illustrations/generated/${safeName}-${crypto.randomUUID()}.png`;
  const url = await uploadToS3(buffer, key, 'image/png');
  return { url, key };
}

export async function uploadLibraryIllustration(
  buffer: Buffer,
  name: string
): Promise<{ url: string; key: string }> {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `illustrations/library/${safeName}.png`;
  const url = await uploadToS3(buffer, key, 'image/png');
  return { url, key };
}

export { deleteFromS3, getS3SignedUrl };
