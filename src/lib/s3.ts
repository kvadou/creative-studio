import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from './config.js';

export const s3Client = new S3Client({
  region: config.s3Region,
  credentials: {
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await s3Client.send(new PutObjectCommand({
    Bucket: config.s3BucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `https://${config.s3BucketName}.s3.${config.s3Region}.amazonaws.com/${key}`;
}

export async function getS3SignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.s3BucketName,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: config.s3BucketName,
    Key: key,
  }));
  const stream = response.Body;
  if (!stream) throw new Error(`No body returned for S3 key: ${key}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: config.s3BucketName,
    Key: key,
  }));
}
