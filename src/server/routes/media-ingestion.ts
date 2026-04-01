import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { GoogleGenAI } from '@google/genai';
import { config } from '../../lib/config.js';
import { createGeminiEmbedding } from '../../lib/gemini-embeddings.js';

const router = Router();
const genai = new GoogleGenAI({ apiKey: config.geminiApiKey });

const BASE_DESCRIBE_PROMPT = `Describe this Acme Creative illustration for a curriculum database.
Include: what's happening in the scene, character expressions and poses, the setting/background, any chess-related elements (pieces, board, moves), and the art style.
Identify all Acme Creative characters by their exact name from the roster below. Do not use generic descriptions like 'a red-bearded king' — use the character's name.
Be specific and detailed in 2-3 sentences. Do not start with "This illustration shows" — just describe what you see.

After your description, add a line starting with "CHARACTERS:" followed by a comma-separated list of ONLY the exact character names from the roster that you can visually identify in this image. Only include characters you are confident appear in the image. If no characters from the roster are visible, write "CHARACTERS: none".
Example: CHARACTERS: King Chomper, Queen Bella, Earl the Squirrel`;

interface CharacterInfo {
  id: string;
  name: string;
  piece: string | null;
  trait: string | null;
}

let cachedCharacters: CharacterInfo[] | null = null;

async function loadCharacters(): Promise<CharacterInfo[]> {
  if (cachedCharacters) return cachedCharacters;
  cachedCharacters = await prisma.character.findMany({
    select: { id: true, name: true, piece: true, trait: true },
    orderBy: { name: 'asc' },
  });
  return cachedCharacters;
}

async function loadCharacterRoster(): Promise<string> {
  const characters = await loadCharacters();
  if (characters.length === 0) return '';
  const lines = characters.map(c => {
    const parts = [c.name];
    if (c.piece) parts.push(`(${c.piece})`);
    if (c.trait) parts.push(`— ${c.trait}`);
    return `- ${parts.join(' ')}`;
  });
  return `\n\nCHARACTER ROSTER:\n${lines.join('\n')}`;
}

/**
 * Parse the structured CHARACTERS: line from AI description.
 * Falls back to naive text matching if no structured line is found.
 */
function parseCharacterLine(text: string): string[] | null {
  const match = text.match(/CHARACTERS:\s*(.+)/i);
  if (!match) return null;
  const line = match[1].trim();
  if (line.toLowerCase() === 'none') return [];
  return line.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Auto-tag characters identified in the AI description.
 * Uses structured CHARACTERS: line from the AI output when available,
 * falls back to naive text matching otherwise.
 * Creates IllustrationCharacter records for matched characters.
 */
async function autoTagCharacters(illustrationId: string, text: string): Promise<string[]> {
  const characters = await loadCharacters();
  const tagged: string[] = [];

  // Try structured parsing first
  const parsedNames = parseCharacterLine(text);

  if (parsedNames && parsedNames.length > 0) {
    // Match parsed names against the character roster
    for (const parsedName of parsedNames) {
      const lowerParsed = parsedName.toLowerCase();
      const match = characters.find(c => c.name.toLowerCase() === lowerParsed);
      if (match) {
        await prisma.illustrationCharacter.upsert({
          where: {
            illustrationId_characterId: {
              illustrationId,
              characterId: match.id,
            },
          },
          create: { illustrationId, characterId: match.id },
          update: {},
        });
        tagged.push(match.name);
      }
    }
  } else if (parsedNames === null) {
    // No CHARACTERS: line found — fall back to text matching
    const lowerText = text.toLowerCase();
    for (const char of characters) {
      if (lowerText.includes(char.name.toLowerCase())) {
        await prisma.illustrationCharacter.upsert({
          where: {
            illustrationId_characterId: {
              illustrationId,
              characterId: char.id,
            },
          },
          create: { illustrationId, characterId: char.id },
          update: {},
        });
        tagged.push(char.name);
      }
    }
  }
  // If parsedNames is empty array (CHARACTERS: none), tag nothing

  return tagged;
}

function buildDescribePrompt(roster: string, illustrationName: string, storyTitle?: string | null): string {
  let text = `Character/Scene: ${illustrationName}`;
  if (storyTitle) text += `\nStory: ${storyTitle}`;
  text += `\n\n${BASE_DESCRIBE_PROMPT}${roster}`;
  return text;
}

// POST /api/media/describe/:id — Generate AI description for one illustration
router.post('/describe/:id', async (req, res) => {
  try {
    const illustration = await prisma.illustration.findUnique({ where: { id: req.params.id } });
    if (!illustration) return res.status(404).json({ error: 'Illustration not found' });
    if (!illustration.illustrationUrl) return res.status(400).json({ error: 'No image URL — upload first' });

    const roster = await loadCharacterRoster();
    const promptText = buildDescribePrompt(roster, illustration.name, (illustration as any).storyTitle);

    const response = await genai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { text: promptText },
          { fileData: { fileUri: illustration.illustrationUrl, mimeType: 'image/jpeg' } },
        ],
      }],
    });

    const rawText = response.text?.trim() || '';

    // Auto-tag characters from structured CHARACTERS: line (before stripping it)
    const tagged = await autoTagCharacters(illustration.id, `${illustration.name} ${rawText}`);

    // Strip the CHARACTERS: line from the saved description
    const aiDescription = rawText.replace(/\n?CHARACTERS:\s*.+/i, '').trim();

    const updated = await prisma.illustration.update({
      where: { id: illustration.id },
      data: { aiDescription, reviewStatus: 'described' },
    });

    res.json({ id: updated.id, aiDescription: updated.aiDescription, reviewStatus: updated.reviewStatus, autoTagged: tagged });
  } catch (error) {
    console.error('[MediaIngestion] Describe error:', error);
    res.status(500).json({ error: 'LaGroovey got confused by this image — try again?' });
  }
});

// PUT /api/media/description/:id — Save human-edited description
router.put('/description/:id', async (req, res) => {
  try {
    const { aiDescription } = req.body;
    if (!aiDescription || typeof aiDescription !== 'string') {
      return res.status(400).json({ error: 'Description text required' });
    }

    const updated = await prisma.illustration.update({
      where: { id: req.params.id },
      data: { aiDescription, reviewStatus: 'reviewed' },
    });

    res.json({ id: updated.id, aiDescription: updated.aiDescription, reviewStatus: updated.reviewStatus });
  } catch (error) {
    console.error('[MediaIngestion] Edit description error:', error);
    res.status(500).json({ error: 'Failed to save description' });
  }
});

// POST /api/media/embed/:id — Embed one illustration
router.post('/embed/:id', async (req, res) => {
  try {
    const illustration = await prisma.illustration.findUnique({ where: { id: req.params.id } });
    if (!illustration) return res.status(404).json({ error: 'Illustration not found' });
    if (!illustration.aiDescription) return res.status(400).json({ error: 'Describe this image first' });

    const text = `${illustration.name}. ${illustration.aiDescription}`;
    const embedding = await createGeminiEmbedding(text, 'RETRIEVAL_DOCUMENT');
    const vectorLiteral = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
      `UPDATE "Illustration" SET embedding = $1::vector, "embeddedAt" = NOW(), "reviewStatus" = 'trained' WHERE id = $2`,
      vectorLiteral,
      illustration.id
    );

    res.json({ id: illustration.id, reviewStatus: 'trained' });
  } catch (error) {
    console.error('[MediaIngestion] Embed error:', error);
    res.status(500).json({ error: "Lagroovy couldn't learn this one — try again?" });
  }
});

// POST /api/media/bulk-describe — Describe all undescribed illustrations (SSE)
router.post('/bulk-describe', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const illustrations = await prisma.illustration.findMany({
      where: { aiDescription: null, illustrationUrl: { not: null }, artType: 'ORIGINAL' },
      orderBy: { createdAt: 'asc' },
    });

    const roster = await loadCharacterRoster();

    const total = illustrations.length;
    res.write(`data: ${JSON.stringify({ total, current: 0, status: 'starting' })}\n\n`);

    let processed = 0;
    for (const ill of illustrations) {
      try {
        const promptText = buildDescribePrompt(roster, ill.name, (ill as any).storyTitle);
        const response = await genai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [
              { text: promptText },
              { fileData: { fileUri: ill.illustrationUrl!, mimeType: 'image/jpeg' } },
            ],
          }],
        });

        const rawText = response.text?.trim() || '';

        // Auto-tag from structured CHARACTERS: line before stripping
        const tagged = await autoTagCharacters(ill.id, `${ill.name} ${rawText}`);

        // Strip CHARACTERS: line from saved description
        const aiDescription = rawText.replace(/\n?CHARACTERS:\s*.+/i, '').trim();
        await prisma.illustration.update({
          where: { id: ill.id },
          data: { aiDescription, reviewStatus: 'described' },
        });

        processed++;
        res.write(`data: ${JSON.stringify({ total, current: processed, name: ill.name, status: 'described', tagged })}\n\n`);
        await new Promise(r => setTimeout(r, 200));
      } catch (error) {
        processed++;
        res.write(`data: ${JSON.stringify({ total, current: processed, name: ill.name, status: 'failed', error: (error as Error).message })}\n\n`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, processed })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: 'Bulk describe failed' })}\n\n`);
    res.end();
  }
});

// POST /api/media/bulk-embed — Embed all reviewed illustrations (SSE)
router.post('/bulk-embed', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const illustrations = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      aiDescription: string;
    }>>`
      SELECT id, name, "aiDescription"
      FROM "Illustration"
      WHERE "aiDescription" IS NOT NULL
        AND "reviewStatus" = 'reviewed'
        AND (embedding IS NULL OR "embeddedAt" < "updatedAt")
      ORDER BY "createdAt" ASC
    `;

    const total = illustrations.length;
    res.write(`data: ${JSON.stringify({ total, current: 0, status: 'starting' })}\n\n`);

    let processed = 0;
    for (const ill of illustrations) {
      try {
        const text = `${ill.name}. ${ill.aiDescription}`;
        const embedding = await createGeminiEmbedding(text, 'RETRIEVAL_DOCUMENT');
        const vectorLiteral = `[${embedding.join(',')}]`;

        await prisma.$executeRawUnsafe(
          `UPDATE "Illustration" SET embedding = $1::vector, "embeddedAt" = NOW(), "reviewStatus" = 'trained' WHERE id = $2`,
          vectorLiteral,
          ill.id
        );

        processed++;
        res.write(`data: ${JSON.stringify({ total, current: processed, name: ill.name, status: 'trained' })}\n\n`);
        await new Promise(r => setTimeout(r, 100));
      } catch (error) {
        processed++;
        res.write(`data: ${JSON.stringify({ total, current: processed, name: ill.name, status: 'failed', error: (error as Error).message })}\n\n`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, processed })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: 'Bulk embed failed' })}\n\n`);
    res.end();
  }
});

export default router;
