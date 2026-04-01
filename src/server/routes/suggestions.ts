import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma.js';
import { processCharacterGeneration } from '../../generation/illustrations/gemini-generate.js';

const generateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as any).user?.email || 'anonymous',
  message: { error: 'Too many generation requests. Please try again in a minute.' },
  validate: false,
});

const router = Router();

// GET / — Get suggestions for a date (defaults to today)
router.get('/', async (req: Request, res: Response) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const date = dateParam ? new Date(dateParam) : new Date();
    // Normalize to date only (strip time)
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const suggestions = await prisma.dailySuggestion.findMany({
      where: { date: dateOnly },
      orderBy: { sequence: 'asc' },
    });

    res.json(suggestions);
  } catch (error) {
    console.error('[Suggestions] List error:', error);
    res.status(500).json({ error: 'Failed to load suggestions' });
  }
});

// GET /recent — Get recent suggestions (last 7 days)
router.get('/recent', async (_req: Request, res: Response) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const suggestions = await prisma.dailySuggestion.findMany({
      where: { date: { gte: sevenDaysAgo } },
      orderBy: [{ date: 'desc' }, { sequence: 'asc' }],
      take: 20,
    });

    res.json(suggestions);
  } catch (error) {
    console.error('[Suggestions] Recent error:', error);
    res.status(500).json({ error: 'Failed to load recent suggestions' });
  }
});

// PATCH /:id — Update suggestion status (mark as used/skipped)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { status, skipReason } = req.body;

    if (!status || !['USED', 'SKIPPED', 'SUGGESTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be USED, SKIPPED, or SUGGESTED' });
    }

    const data: Record<string, unknown> = { status };
    if (status === 'USED') {
      data.usedAt = new Date();
      data.usedByEmail = (req as any).user?.email || null;
    }
    if (status === 'SKIPPED') {
      data.skipReason = skipReason || null;
    }
    if (status === 'SUGGESTED') {
      data.usedAt = null;
      data.usedByEmail = null;
      data.skipReason = null;
    }

    // Remove a specific asset thumbnail
    if (req.body.removeAssetId) {
      const suggestion = await prisma.dailySuggestion.findUnique({ where: { id: req.params.id } });
      if (suggestion) {
        data.matchedAssetIds = (suggestion.matchedAssetIds || []).filter(
          (id: string) => id !== req.body.removeAssetId
        );
      }
    }

    const updated = await prisma.dailySuggestion.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error('[Suggestions] Update error:', error);
    res.status(500).json({ error: 'Failed to update suggestion' });
  }
});

// POST /:id/generate — Generate art for a suggestion
router.post('/:id/generate', generateRateLimit, async (req: Request, res: Response) => {
  try {
    const { prompt, referenceImageIds } = req.body as {
      prompt: string;
      referenceImageIds?: string[];
    };

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // Load suggestion
    const suggestion = await prisma.dailySuggestion.findUnique({
      where: { id: req.params.id },
    });
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // Client-provided refs take priority; otherwise processCharacterGeneration
    // handles auto-reference via semantic search on the prompt
    const refIds = referenceImageIds || [];
    const characterName = suggestion.characterNames?.[0];
    console.log(`[SuggestionGen] Starting generation for "${suggestion.title}", character: ${characterName || 'none'}, client refIds: ${refIds.length}`);

    // Create Illustration record
    const characterRecord = characterName
      ? await prisma.character.findUnique({ where: { name: characterName } })
      : null;

    const illustration = await prisma.illustration.create({
      data: {
        name: `${suggestion.title} — ${characterName || 'Social'}`,
        description: `Generated for daily suggestion: ${suggestion.title}`,
        artType: 'CHARACTER',
        status: 'UPLOADING',
        createdByEmail: (req as any).user?.email || 'system',
        characterId: characterRecord?.id || null,
      },
    });

    // Update suggestion matchedAssetIds
    await prisma.dailySuggestion.update({
      where: { id: suggestion.id },
      data: {
        matchedAssetIds: [...(suggestion.matchedAssetIds || []), illustration.id],
      },
    });

    // Augment prompt with Acme Creative style context
    const styledPrompt = 'Create an illustration in the Acme Creative cartoon style: simple cartoon characters with bold black outlines, flat bright colors, friendly expressions, cartoon proportions, clean vector-style lines, no shading, no gradients. ' + prompt;
    console.log(`[SuggestionGen] Styled prompt: ${styledPrompt.substring(0, 120)}...`);

    // Fire-and-forget Gemini generation (uses semantic search for auto-refs when refIds is empty)
    processCharacterGeneration(illustration.id, refIds, styledPrompt, 2048);

    return res.status(202).json({
      illustrationId: illustration.id,
      status: 'GENERATING',
    });
  } catch (error) {
    console.error('[Suggestions] Generate error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate art';
    res.status(500).json({ error: message });
  }
});

// POST /quick-caption — Generate a quick social media caption for an activity
router.post('/quick-caption', async (req: Request, res: Response) => {
  try {
    const { title, characterName, type } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.json({ caption: `Check out this creative content: ${title}` });
    }
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();

    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Write a single engaging social media caption (1-2 sentences max, include 1-2 emojis) for sharing this Acme Creative content:
Title: ${title}
Type: ${type}
${characterName ? `Character: ${characterName}` : ''}
Just the caption, nothing else.`,
      }],
    });

    const caption = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    res.json({ caption });
  } catch (error) {
    console.error('[QuickCaption] Error:', error);
    res.status(500).json({ error: 'Failed to generate caption' });
  }
});

export default router;
