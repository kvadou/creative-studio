import { Router, Request, Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma.js';
import {
  uploadSourcePhoto,
  uploadIllustration,
  deleteFromS3,
} from '../../generation/illustrations/upload.js';
import {
  startGeneration,
  checkGeneration,
} from '../../generation/illustrations/generate.js';
import { processCharacterGeneration } from '../../generation/illustrations/gemini-generate.js';
import { illustrationChat } from '../../generation/illustrations/chat.js';
import { analyzeArtPrompt } from '../../generation/illustrations/analyze.js';

const router = Router();

// Rate limit only AI generation, not status polling or CRUD
const generateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as any).user?.email || 'anonymous',
  message: { error: 'Too many generation requests. Please try again in a minute.' },
  validate: false,
});

// Multer config: memory storage, 10MB limit, images only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// ── Static routes MUST come before /:id ─────────────────────────────

// GET /api/illustrations/style-models - List available style models
router.get('/style-models', async (_req: Request, res: Response) => {
  try {
    const models = await prisma.styleModel.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(models);
  } catch (error) {
    console.error('[Illustrations] Models error:', error);
    res.status(500).json({ error: 'Failed to load style models' });
  }
});

// POST /api/illustrations/analyze-prompt - Pre-generation prompt analysis
router.post('/analyze-prompt', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const analysis = await analyzeArtPrompt(prompt.trim());
    res.json(analysis);
  } catch (error) {
    console.error('[Illustrations] Analyze prompt error:', error);
    res.status(500).json({ error: 'Failed to analyze prompt' });
  }
});

// POST /api/illustrations/generate-character - Start character art generation (Gemini)
router.post('/generate-character', generateRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, prompt, referenceIds, resolution } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Character name is required' });
    }
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const refs = Array.isArray(referenceIds) ? referenceIds : [];

    const res_val = resolution === 4096 ? 4096 : 2048;

    // Create illustration record with CHARACTER artType
    const illustration = await prisma.illustration.create({
      data: {
        name: name.trim(),
        artType: 'CHARACTER',
        status: 'GENERATING',
        createdByEmail: req.user!.email,
      },
    });

    // Fire-and-forget background job
    processCharacterGeneration(illustration.id, refs, prompt.trim(), res_val).catch((err) => {
      console.error('[Illustrations] Character generation background error:', err);
    });

    res.status(202).json({
      id: illustration.id,
      status: 'GENERATING',
    });
  } catch (error) {
    console.error('[Illustrations] Generate character error:', error);
    res.status(500).json({ error: 'Failed to start character art generation' });
  }
});

// ── Parameterized routes ─────────────────────────────────────────────

// GET /api/illustrations - List all illustrations (gallery)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, filter, artType, excludeArtType, lessonId, moduleCode, characterId, untagged, goldStandard, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const take = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }
    if (artType === 'CARTOON' || artType === 'CHARACTER' || artType === 'ORIGINAL' || artType === 'BACKGROUND') {
      where.artType = artType;
    }
    if (excludeArtType) {
      where.artType = { not: excludeArtType as string };
    }
    if (lessonId) {
      where.lessonId = lessonId as string;
    }
    if (moduleCode) {
      where.lesson = { module: { code: moduleCode as string } };
    }
    if (characterId) {
      // Match both direct FK and many-to-many join table tags
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { characterId: characterId as string },
            { characterTags: { some: { characterId: characterId as string } } },
          ],
        },
      ];
    }
    if (untagged === 'true') {
      where.characterId = null;
      where.lessonId = null;
    }
    if (goldStandard === 'true') {
      where.isGoldStandard = true;
    }
    if (filter === 'original') {
      where.isOriginal = true;
    } else if (filter === 'generated') {
      where.isOriginal = false;
    }

    // Review status filter (for originals pipeline tracking)
    const reviewStatus = req.query.reviewStatus as string | undefined;
    if (reviewStatus === 'new') {
      where.reviewStatus = null;
    } else if (reviewStatus === 'described' || reviewStatus === 'reviewed' || reviewStatus === 'trained') {
      where.reviewStatus = reviewStatus;
    }
    // Only show completed or original illustrations in gallery
    where.OR = [{ status: 'COMPLETED' }, { isOriginal: true }];

    const [illustrations, total] = await Promise.all([
      prisma.illustration.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        include: {
          lesson: {
            select: { id: true, lessonNumber: true, title: true, module: { select: { code: true, title: true } } },
          },
        },
      }),
      prisma.illustration.count({ where }),
    ]);

    res.json({ illustrations, total, page: pageNum, limit: take });
  } catch (error) {
    console.error('[Illustrations] List error:', error);
    res.status(500).json({ error: 'Failed to load illustrations' });
  }
});

// GET /api/illustrations/:id/siblings - Get prev/next illustration IDs for navigation
router.get('/:id/siblings', async (req: Request, res: Response) => {
  try {
    const { moduleCode, lessonId } = req.query;

    // Build where clause matching the current filter context
    const where: Record<string, unknown> = { artType: { not: 'CARTOON' } };
    if (lessonId) {
      where.lessonId = lessonId as string;
    } else if (moduleCode) {
      where.lesson = { module: { code: moduleCode as string } };
    }

    // Get all illustration IDs in sorted order
    const all = await prisma.illustration.findMany({
      where,
      orderBy: { name: 'asc' },
      select: { id: true },
    });

    const ids = all.map(i => i.id);
    const idx = ids.indexOf(req.params.id);

    if (idx === -1) {
      return res.json({ prevId: null, nextId: null, position: 0, total: ids.length });
    }

    res.json({
      prevId: idx > 0 ? ids[idx - 1] : null,
      nextId: idx < ids.length - 1 ? ids[idx + 1] : null,
      position: idx + 1,
      total: ids.length,
    });
  } catch (error) {
    console.error('[Illustrations] Siblings error:', error);
    res.status(500).json({ error: 'Failed to get siblings' });
  }
});

// GET /api/illustrations/:id - Get single illustration with generations
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const illustration = await prisma.illustration.findUnique({
      where: { id: req.params.id },
      include: {
        generations: { orderBy: { createdAt: 'desc' } },
        lesson: {
          select: { id: true, lessonNumber: true, title: true, module: { select: { code: true, title: true } } },
        },
      },
    });

    if (!illustration) {
      return res.status(404).json({ error: 'Illustration not found' });
    }

    res.json(illustration);
  } catch (error) {
    console.error('[Illustrations] Get error:', error);
    res.status(500).json({ error: 'Failed to load illustration' });
  }
});

// POST /api/illustrations/upload - Upload source photo and create illustration record
router.post('/upload', upload.single('photo'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Character name is required' });
    }

    // Upload photo to S3
    const { url, key } = await uploadSourcePhoto(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // Create illustration record
    const illustration = await prisma.illustration.create({
      data: {
        name: name.trim(),
        sourcePhotoUrl: url,
        sourcePhotoKey: key,
        status: 'UPLOADING',
        createdByEmail: req.user!.email,
      },
    });

    res.status(201).json(illustration);
  } catch (error) {
    console.error('[Illustrations] Upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

// POST /api/illustrations/:id/generate - Trigger Flux generation
router.post('/:id/generate', generateRateLimit, async (req: Request, res: Response) => {
  try {
    const illustration = await prisma.illustration.findUnique({
      where: { id: req.params.id },
    });

    if (!illustration) {
      return res.status(404).json({ error: 'Illustration not found' });
    }

    if (!illustration.sourcePhotoUrl) {
      return res.status(400).json({ error: 'No source photo uploaded' });
    }

    const { prompt, loraScale, guidanceScale } = req.body;

    const predictionId = await startGeneration(
      illustration.id,
      illustration.sourcePhotoUrl,
      { prompt, loraScale, guidanceScale }
    );

    res.status(202).json({
      illustrationId: illustration.id,
      predictionId,
      status: 'GENERATING',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start generation';
    console.error('[Illustrations] Generate error:', error);
    res.status(500).json({ error: message });
  }
});

// GET /api/illustrations/:id/status - Check generation status
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const illustration = await prisma.illustration.findUnique({
      where: { id: req.params.id },
      include: { generations: true },
    });

    if (!illustration) {
      return res.status(404).json({ error: 'Illustration not found' });
    }

    // CHARACTER art uses synchronous background job — just return current status
    if (illustration.artType === 'CHARACTER') {
      // Collect referenceIds from generations (auto-selected or manual)
      const generationReferenceIds = illustration.generations
        .flatMap((g: any) => (Array.isArray(g.referenceIds) ? g.referenceIds : []))
        .filter((id: string, i: number, arr: string[]) => arr.indexOf(id) === i);

      return res.json({
        status: illustration.status,
        generations: illustration.generations,
        errorMessage: illustration.errorMessage,
        referenceIds: generationReferenceIds.length > 0 ? generationReferenceIds : undefined,
      });
    }

    // CARTOON art: if currently generating, check Replicate status
    if (illustration.status === 'GENERATING' && illustration.replicateId) {
      const result = await checkGeneration(illustration.replicateId);

      if (result.status === 'succeeded' && result.outputUrls) {
        // Save output URLs to generation records
        const generations = [];
        for (const outputUrl of result.outputUrls) {
          const gen = await prisma.illustrationGeneration.create({
            data: {
              illustrationId: illustration.id,
              replicateId: illustration.replicateId,
              inputPhotoUrl: illustration.sourcePhotoUrl!,
              outputImageUrl: outputUrl,
              modelVersion: illustration.generations[0]?.modelVersion || 'unknown',
            },
          });
          generations.push(gen);
        }

        await prisma.illustration.update({
          where: { id: illustration.id },
          data: { status: 'COMPLETED' },
        });

        return res.json({
          status: 'COMPLETED',
          generations,
        });
      }

      if (result.status === 'failed') {
        await prisma.illustration.update({
          where: { id: illustration.id },
          data: { status: 'FAILED', errorMessage: result.error },
        });

        return res.json({
          status: 'FAILED',
          error: result.error,
        });
      }

      return res.json({ status: 'GENERATING' });
    }

    res.json({
      status: illustration.status,
      generations: illustration.generations,
    });
  } catch (error) {
    console.error('[Illustrations] Status error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// POST /api/illustrations/:id/select/:genId - Select a generation variant
router.post('/:id/select/:genId', async (req: Request, res: Response) => {
  try {
    const { id, genId } = req.params;

    // Deselect all other generations for this illustration
    await prisma.illustrationGeneration.updateMany({
      where: { illustrationId: id },
      data: { selected: false },
    });

    // Select this one
    const generation = await prisma.illustrationGeneration.update({
      where: { id: genId },
      data: { selected: true },
    });

    // Update illustration with the selected image
    if (generation.savedImageUrl) {
      await prisma.illustration.update({
        where: { id },
        data: {
          illustrationUrl: generation.savedImageUrl,
          illustrationKey: generation.savedImageKey,
        },
      });
    } else if (generation.outputImageUrl) {
      // Download from Replicate temp URL and save to S3
      const response = await fetch(generation.outputImageUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      const illustration = await prisma.illustration.findUnique({ where: { id } });
      const { url, key } = await uploadIllustration(buffer, illustration!.name);

      await prisma.illustrationGeneration.update({
        where: { id: genId },
        data: { savedImageUrl: url, savedImageKey: key },
      });

      await prisma.illustration.update({
        where: { id },
        data: { illustrationUrl: url, illustrationKey: key },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Illustrations] Select error:', error);
    res.status(500).json({ error: 'Failed to select variant' });
  }
});

// GET /api/illustrations/:id/messages - Get chat history
router.get('/:id/messages', async (req: Request, res: Response) => {
  try {
    const messages = await prisma.illustrationMessage.findMany({
      where: { illustrationId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(messages);
  } catch (error) {
    console.error('[Illustrations] Messages error:', error);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// POST /api/illustrations/:id/chat - Send a message to the AI illustrator
router.post('/:id/chat', generateRateLimit, async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const illustration = await prisma.illustration.findUnique({
      where: { id: req.params.id },
    });

    if (!illustration) {
      return res.status(404).json({ error: 'Illustration not found' });
    }

    const result = await illustrationChat(req.params.id, message.trim());
    res.json(result);
  } catch (error) {
    console.error('[Illustrations] Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// PATCH /api/illustrations/:id - Update illustration metadata (lessonId, name)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const illustration = await prisma.illustration.findUnique({
      where: { id: req.params.id },
    });

    if (!illustration) {
      return res.status(404).json({ error: 'Illustration not found' });
    }

    const data: Record<string, unknown> = {};
    if ('lessonId' in req.body) {
      data.lessonId = req.body.lessonId || null; // null to unset
    }
    if ('characterId' in req.body) {
      data.characterId = req.body.characterId || null; // null to unset
    }
    if (req.body.name !== undefined) {
      data.name = req.body.name.trim();
    }
    if (req.body.description !== undefined) {
      data.description = req.body.description;
    }
    if ('isGoldStandard' in req.body) {
      data.isGoldStandard = Boolean(req.body.isGoldStandard);
    }
    if ('goldStandardType' in req.body) {
      data.goldStandardType = req.body.goldStandardType || null;
    }
    if ('isReferenceEnabled' in req.body) {
      data.isReferenceEnabled = Boolean(req.body.isReferenceEnabled);
    }
    if ('reviewStatus' in req.body) {
      data.reviewStatus = req.body.reviewStatus || null;
    }

    const updated = await prisma.illustration.update({
      where: { id: req.params.id },
      data,
      include: {
        lesson: {
          select: { id: true, lessonNumber: true, title: true, module: { select: { code: true, title: true } } },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Illustrations] Update error:', error);
    res.status(500).json({ error: 'Failed to update illustration' });
  }
});

// GET /api/illustrations/:id/characters - Get character tags for an illustration
router.get('/:id/characters', async (req: Request, res: Response) => {
  try {
    const tags = await prisma.illustrationCharacter.findMany({
      where: { illustrationId: req.params.id },
      include: { character: { select: { id: true, name: true } } },
    });
    res.json(tags.map(t => t.character));
  } catch (error) {
    console.error('[Illustrations] Characters error:', error);
    res.status(500).json({ error: 'Failed to load character tags' });
  }
});

// POST /api/illustrations/:id/characters/:characterId - Add a character tag
router.post('/:id/characters/:characterId', async (req: Request, res: Response) => {
  try {
    await prisma.illustrationCharacter.upsert({
      where: {
        illustrationId_characterId: {
          illustrationId: req.params.id,
          characterId: req.params.characterId,
        },
      },
      create: {
        illustrationId: req.params.id,
        characterId: req.params.characterId,
      },
      update: {},
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[Illustrations] Add character error:', error);
    res.status(500).json({ error: 'Failed to add character tag' });
  }
});

// DELETE /api/illustrations/:id/characters/:characterId - Remove a character tag (join table or FK)
router.delete('/:id/characters/:characterId', async (req: Request, res: Response) => {
  try {
    const { id, characterId } = req.params;

    // Try removing from many-to-many join table (deleteMany won't throw if not found)
    const deleted = await prisma.illustrationCharacter.deleteMany({
      where: { illustrationId: id, characterId },
    });

    // Also clear the FK if it matches
    if (deleted.count === 0) {
      await prisma.illustration.updateMany({
        where: { id, characterId },
        data: { characterId: null },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Illustrations] Remove character error:', error);
    res.status(500).json({ error: 'Failed to remove character tag' });
  }
});

// DELETE /api/illustrations/:id - Delete illustration + S3 cleanup
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const illustration = await prisma.illustration.findUnique({
      where: { id: req.params.id },
      include: { generations: true },
    });

    if (!illustration) {
      return res.status(404).json({ error: 'Illustration not found' });
    }

    // Clean up S3 files
    const keysToDelete = [
      illustration.sourcePhotoKey,
      illustration.illustrationKey,
      ...illustration.generations.map((g) => g.savedImageKey),
    ].filter(Boolean) as string[];

    await Promise.all(keysToDelete.map((key) => deleteFromS3(key)));

    // Delete from DB (cascades to generations)
    await prisma.illustration.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('[Illustrations] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete illustration' });
  }
});

export default router;
