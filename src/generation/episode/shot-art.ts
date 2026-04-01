import { generateCharacterArt } from '../illustrations/gemini-generate.js';
import { semanticSearchIllustrations } from '../../retrieval/semantic.js';
import { uploadToS3, downloadFromS3 } from '../../lib/s3.js';
import { prisma } from '../../lib/prisma.js';
import crypto from 'crypto';

const DEFAULT_STYLE_BIBLE = `You are generating illustrations for Acme Creative, a children's chess education brand.

WORLD: All scenes take place in CHESSLANDIA — a whimsical fantasy kingdom on a giant chess board.
The landscape features chess-themed architecture, checkered patterns, chess piece-shaped buildings,
and a colorful storybook atmosphere. Think medieval fairy tale meets chess board.

ART STYLE — You MUST match this exactly:
- Bold black outlines around all characters and objects
- Flat, vibrant colors with minimal shading or gradients
- Cartoon proportions — large heads, expressive eyes
- Storybook illustration feel, like a children's picture book
- Clean, vector-style lines
- Warm, inviting color palette

CHARACTERS — These are the ONLY characters that exist in Chesslandia.
Do NOT invent new characters. Do NOT draw realistic humans.
Every character is either a cartoon animal or an anthropomorphized chess piece:

CRITICAL RULES:
1. ONLY draw characters from the list above — never invent new ones
2. Characters are cartoon animals or chess pieces, NOT realistic humans
3. If reference images are provided, match those character designs EXACTLY
4. The setting must feel like Chesslandia — chess-themed fantasy world
5. Match the art style of the reference images precisely`;

/**
 * Build the style bible from database — reads editable instructions
 * from SystemConfig, falls back to hardcoded default, and appends character list.
 * Exported so other modules (shot art, thumbnails) can reuse it.
 */
export async function buildStyleBible(): Promise<string> {
  const [configRow, characters] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: 'style_bible_instructions' } }),
    prisma.character.findMany({
      select: { name: true, piece: true, trait: true, bio: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const instructions = configRow?.value || DEFAULT_STYLE_BIBLE;

  const characterList = characters
    .map(c => {
      const parts = [c.name];
      if (c.piece) parts.push(`(${c.piece})`);
      if (c.trait) parts.push(`— ${c.trait}`);
      return `  - ${parts.join(' ')}`;
    })
    .join('\n');

  return `${instructions}\n\nCHARACTER ROSTER:\n${characterList}`;
}

/**
 * Build an art prompt from shot metadata.
 */
function buildShotPrompt(
  sceneDescription: string,
  characters: string[],
  cameraAngle: string | null,
  aspectRatio: string
): string {
  const lines: string[] = [];

  lines.push(`Generate a single illustration for a Acme Creative video shot.`);
  lines.push(`\nSCENE: ${sceneDescription}`);

  if (characters.length > 0) {
    lines.push(`\nCHARACTERS IN SCENE: ${characters.join(', ')}`);
  }

  if (cameraAngle) {
    lines.push(`\nCAMERA ANGLE: ${cameraAngle}`);
  }

  lines.push(`\nASPECT RATIO: ${aspectRatio} — compose the scene to fill this frame.`);
  lines.push(`\nMake the illustration vibrant, clear, and suitable for a children's YouTube video.`);

  return lines.join('\n');
}

/**
 * Process art generation for all pending shots in an episode.
 * Runs sequentially to avoid Gemini API rate limits.
 * Designed to be called fire-and-forget from a route handler.
 */
export async function processShotArt(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      shots: { orderBy: { orderIndex: 'asc' } },
    },
  });

  if (!episode) {
    console.error(`[ShotArt] Episode ${episodeId} not found`);
    return;
  }

  console.log(`[ShotArt] Starting art generation for episode "${episode.title}" (${episode.shots.length} shots)`);

  // Build style bible once for the whole episode
  const styleBible = await buildStyleBible();

  // Determine aspect ratio from format
  const aspectRatio = episode.format === 'SHORT' ? '9:16' : '16:9';

  // Process each pending shot sequentially
  for (const shot of episode.shots) {
    if (shot.imageStatus !== 'PENDING') {
      console.log(`[ShotArt] Skipping shot ${shot.orderIndex} (status: ${shot.imageStatus})`);
      continue;
    }

    try {
      // Mark as generating
      await prisma.shot.update({
        where: { id: shot.id },
        data: { imageStatus: 'ASSET_GENERATING' },
      });

      // Find reference images via semantic search
      const refs = await semanticSearchIllustrations(shot.sceneDescription, 6, 0.25);
      console.log(`[ShotArt] Shot ${shot.orderIndex}: found ${refs.length} reference images`);

      // Download reference buffers from S3
      const referenceBuffers: Buffer[] = [];
      for (const ref of refs) {
        const key = ref.illustrationKey || ref.sourcePhotoKey;
        if (key) {
          try {
            const buf = await downloadFromS3(key);
            referenceBuffers.push(buf);
          } catch (err) {
            console.warn(`[ShotArt] Failed to download reference ${key}:`, err);
          }
        }
      }

      // Build prompt
      const prompt = buildShotPrompt(
        shot.sceneDescription,
        shot.characters,
        shot.cameraAngle,
        aspectRatio
      );

      // Generate art
      const result = await generateCharacterArt(prompt, referenceBuffers, styleBible, { size: '2K' });

      // Upload to S3
      const imageKey = `episodes/${episodeId}/shots/shot-${shot.orderIndex}-${crypto.randomUUID()}.png`;
      const imageUrl = await uploadToS3(result.imageBuffer, imageKey, 'image/png');

      // Update shot record
      await prisma.shot.update({
        where: { id: shot.id },
        data: {
          imageUrl,
          imageKey,
          imageStatus: 'COMPLETE',
        },
      });

      console.log(`[ShotArt] Shot ${shot.orderIndex} complete → ${imageKey}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[ShotArt] Shot ${shot.orderIndex} failed:`, msg);

      await prisma.shot.update({
        where: { id: shot.id },
        data: { imageStatus: 'ASSET_FAILED' },
      });

      // Continue to next shot — don't abort the batch
    }
  }

  // Check if all shots are complete → advance episode to VOICE
  const updatedShots = await prisma.shot.findMany({
    where: { episodeId },
    select: { imageStatus: true },
  });

  const allComplete = updatedShots.every(s => s.imageStatus === 'COMPLETE');

  if (allComplete) {
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'VOICE' },
    });
    console.log(`[ShotArt] All shots complete — episode "${episode.title}" advanced to VOICE`);
  } else {
    const failed = updatedShots.filter(s => s.imageStatus === 'ASSET_FAILED').length;
    console.log(`[ShotArt] ${failed}/${updatedShots.length} shots failed — episode stays in ART`);
  }
}
