import { getGeminiClient } from '../../lib/gemini.js';
import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { uploadToS3, downloadFromS3 } from '../../lib/s3.js';
import { semanticSearchIllustrations } from '../../retrieval/semantic.js';
import { reviewGeneratedImage } from './review.js';
import { Part } from '@google/genai';
import sharp from 'sharp';
import crypto from 'crypto';

export interface CharacterArtOptions {
  size?: '2K' | '4K';
  aspectRatio?: string;
}

export interface CharacterArtResult {
  imageBuffer: Buffer;
  mimeType: string;
  text?: string;
}

function sizeToResolution(size: '2K' | '4K'): number {
  return size === '4K' ? 4096 : 2048;
}

/**
 * Core generation: calls Gemini API with reference images + prompt.
 * Returns the raw image buffer (PNG) and any text response.
 */
export async function generateCharacterArt(
  prompt: string,
  referenceBuffers: Buffer[],
  styleBible: string | null,
  options: CharacterArtOptions = {}
): Promise<CharacterArtResult> {
  const ai = getGeminiClient();

  // Build content parts: style bible instruction + reference images + user prompt
  const parts: Part[] = [];

  if (styleBible) {
    parts.push({ text: styleBible });
  }

  // Add reference images as inline base64 data
  for (const buf of referenceBuffers) {
    parts.push({
      inlineData: {
        data: buf.toString('base64'),
        mimeType: 'image/png',
      },
    });
  }

  // Add the user prompt
  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: config.geminiModel,
    contents: [{ role: 'user', parts }],
    config: {
      responseModalities: ['Text', 'Image'],
    },
  });

  // Parse response — extract image and text parts
  let imageBuffer: Buffer | null = null;
  let text: string | undefined;

  const candidate = response.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error('Gemini returned no content parts');
  }

  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) {
      // Decode base64 image data
      const rawBuffer = Buffer.from(part.inlineData.data, 'base64');

      // Convert to PNG via sharp (Gemini may return JPEG)
      imageBuffer = await sharp(rawBuffer).png().toBuffer();
    } else if (part.text) {
      text = part.text;
    }
  }

  if (!imageBuffer) {
    throw new Error('Gemini did not return an image in the response');
  }

  return { imageBuffer, mimeType: 'image/png', text };
}

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
 */
async function buildStyleBible(): Promise<string> {
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

  // Append character list to the instructions
  return `${instructions}\n\nCHARACTER ROSTER:\n${characterList}`;
}

/**
 * Orchestrator: fetches references from S3, calls generateCharacterArt,
 * uploads result to S3, updates database records.
 * Runs as a background job (fire-and-forget from the route).
 */
export async function processCharacterGeneration(
  illustrationId: string,
  referenceIds: string[],
  prompt: string,
  resolution: number
): Promise<void> {
  try {
    // Update status to GENERATING
    await prisma.illustration.update({
      where: { id: illustrationId },
      data: { status: 'GENERATING' },
    });

    // Build style bible from database
    const styleBible = await buildStyleBible();

    // Pipeline log — tracks everything for debugging
    const pipelineLog: Record<string, unknown> = {
      styleBible,
    };

    // Fetch reference images — gold standards first, then manual selection, then semantic search
    let effectiveRefIds = referenceIds;
    if (effectiveRefIds.length === 0) {
      // Step 1: Fetch gold standard references for this character (t-poses first, then references)
      const illustration = await prisma.illustration.findUnique({
        where: { id: illustrationId },
        select: { characterId: true, characterTags: { select: { characterId: true } } },
      });
      const characterIds = [
        ...(illustration?.characterId ? [illustration.characterId] : []),
        ...(illustration?.characterTags?.map(t => t.characterId) || []),
      ];

      if (characterIds.length > 0) {
        try {
          const goldRefs = await prisma.illustration.findMany({
            where: {
              isGoldStandard: true,
              OR: [
                { characterId: { in: characterIds } },
                { characterTags: { some: { characterId: { in: characterIds } } } },
              ],
              id: { not: illustrationId }, // Don't reference self
            },
            orderBy: { goldStandardType: 'asc' }, // TPOSE before REFERENCE alphabetically
            select: { id: true, name: true, goldStandardType: true, illustrationUrl: true, sourcePhotoUrl: true, isGoldStandard: true },
          });
          if (goldRefs.length > 0) {
            effectiveRefIds = goldRefs.map(r => r.id);
            pipelineLog.goldStandardRefs = goldRefs.map(r => ({
              id: r.id,
              name: r.name,
              type: r.goldStandardType,
              url: r.illustrationUrl || r.sourcePhotoUrl || null,
            }));
            console.log(`[CharacterArt] Found ${goldRefs.length} gold standard references (${goldRefs.filter(r => r.goldStandardType === 'TPOSE').length} t-poses)`);
          }
        } catch (err) {
          console.warn('[CharacterArt] Gold standard lookup failed:', err);
        }
      }

      // Step 2: Fill remaining slots with semantic search (up to 12 total)
      const remainingSlots = 12 - effectiveRefIds.length;
      if (remainingSlots > 0) {
        try {
          const autoRefs = await semanticSearchIllustrations(prompt, remainingSlots, 0.25);
          const newRefs = autoRefs.filter(r => !effectiveRefIds.includes(r.id));
          if (newRefs.length > 0) {
            effectiveRefIds = [...effectiveRefIds, ...newRefs.map(r => r.id)];
            pipelineLog.autoSearchQuery = prompt;
            pipelineLog.autoSearchResults = newRefs.map(r => ({
              id: r.id,
              name: r.name,
              similarity: parseFloat(r.similarity.toFixed(3)),
              illustrationUrl: r.illustrationUrl || r.sourcePhotoUrl || null,
            }));
            console.log(`[CharacterArt] Added ${newRefs.length} semantic search references (total: ${effectiveRefIds.length})`);
          }
        } catch (err) {
          console.warn('[CharacterArt] Semantic search for auto-references failed:', err);
        }
      }
    } else {
      pipelineLog.manualReferenceIds = referenceIds;
    }

    const referenceBuffers: Buffer[] = [];
    if (effectiveRefIds.length > 0) {
      const refIllustrations = await prisma.illustration.findMany({
        where: { id: { in: effectiveRefIds } },
        select: { sourcePhotoKey: true, illustrationKey: true, sourcePhotoUrl: true, illustrationUrl: true },
      });

      for (const ref of refIllustrations) {
        const key = ref.illustrationKey || ref.sourcePhotoKey;
        if (key) {
          try {
            const buf = await downloadFromS3(key);
            referenceBuffers.push(buf);
          } catch (err) {
            console.warn(`[CharacterArt] Failed to download S3 key ${key}:`, err);
          }
        } else {
          const url = ref.illustrationUrl || ref.sourcePhotoUrl;
          if (url) {
            try {
              const response = await fetch(url);
              if (response.ok) {
                const arrayBuf = await response.arrayBuffer();
                referenceBuffers.push(Buffer.from(arrayBuf));
              }
            } catch (err) {
              console.warn(`[CharacterArt] Failed to fetch URL ${url}:`, err);
            }
          }
        }
      }
      console.log(`[CharacterArt] Loaded ${referenceBuffers.length}/${effectiveRefIds.length} reference images`);
    }

    // Record ref loading stats
    pipelineLog.refsAttempted = effectiveRefIds.length;
    pipelineLog.refsLoaded = referenceBuffers.length;

    // Determine size option from resolution
    const size: '2K' | '4K' = resolution >= 4096 ? '4K' : '2K';

    // Generate the image
    const result = await generateCharacterArt(
      prompt,
      referenceBuffers,
      styleBible,
      { size }
    );

    // Capture Gemini's own commentary (free — already returned)
    if (result.text) {
      pipelineLog.generationResponse = result.text;
    }

    // Upload to S3
    const illustration = await prisma.illustration.findUnique({
      where: { id: illustrationId },
    });
    const safeName = (illustration?.name || 'character').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const key = `illustrations/characters/${safeName}-${crypto.randomUUID()}.png`;
    const url = await uploadToS3(result.imageBuffer, key, 'image/png');

    // Run AI self-review on the generated image (~$0.001)
    try {
      // Extract character roster from the style bible for review context
      const rosterMatch = styleBible.match(/CHARACTER ROSTER:\n([\s\S]*)/);
      const characterRoster = rosterMatch ? rosterMatch[1].trim() : '';

      const review = await reviewGeneratedImage(result.imageBuffer, prompt, characterRoster);
      pipelineLog.review = review;
      console.log(`[CharacterArt] Self-review complete — style score: ${review.styleCompliance.score}/10, characters found: ${review.characters.length}`);
    } catch (err) {
      console.warn('[CharacterArt] Post-generation review failed (non-blocking):', err);
    }

    // Create IllustrationGeneration record
    await prisma.illustrationGeneration.create({
      data: {
        illustrationId,
        provider: 'GEMINI',
        prompt,
        modelVersion: config.geminiModel,
        resolution,
        referenceIds: effectiveRefIds,
        pipelineLog: pipelineLog as Prisma.InputJsonValue,
        savedImageUrl: url,
        savedImageKey: key,
        selected: true,
      },
    });

    // Update Illustration to COMPLETED
    await prisma.illustration.update({
      where: { id: illustrationId },
      data: {
        status: 'COMPLETED',
        illustrationUrl: url,
        illustrationKey: key,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during character art generation';
    console.error(`Character art generation failed for ${illustrationId}:`, errorMessage);

    await prisma.illustration.update({
      where: { id: illustrationId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });
  }
}
