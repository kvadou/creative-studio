import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma.js';
import { deleteFromS3 } from '../../generation/illustrations/upload.js';
import { processVideoGenerationFromUrl } from '../../generation/video/veo-generate.js';

const router = Router();

const generateRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as any).user?.email || 'anonymous',
  message: { error: 'Too many video generation requests. Please try again in a minute.' },
  validate: false,
});

// POST /api/video/generate — Start video generation
router.post('/generate', generateRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, sourceIllustrationId, sourceReferenceId, prompt, duration, aspectRatio, resolution } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Video name is required' });
    }
    if (!sourceIllustrationId) {
      return res.status(400).json({ error: 'Source illustration is required' });
    }
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Motion prompt is required' });
    }

    // Resolve source image URL from Illustration
    let sourceImageUrl: string | null = null;
    let resolvedSourceIllustrationId: string | undefined;

    const sourceIllustration = await prisma.illustration.findUnique({
      where: { id: sourceIllustrationId },
    });
    if (!sourceIllustration) {
      return res.status(404).json({ error: 'Source illustration not found' });
    }
    sourceImageUrl = sourceIllustration.illustrationUrl || sourceIllustration.sourcePhotoUrl;
    resolvedSourceIllustrationId = sourceIllustrationId;

    if (!sourceImageUrl) {
      return res.status(400).json({ error: 'Source has no image URL' });
    }

    const dur = [4, 6, 8].includes(duration) ? duration : 4;
    const ar = aspectRatio === '9:16' ? '9:16' : '16:9';
    const res_val = resolution === '1080p' ? '1080p' : '720p';

    // Create illustration record with VIDEO artType
    const illustration = await prisma.illustration.create({
      data: {
        name: name.trim(),
        artType: 'VIDEO',
        ...(resolvedSourceIllustrationId ? { sourceIllustrationId: resolvedSourceIllustrationId } : {}),
        duration: dur,
        aspectRatio: ar,
        status: 'GENERATING',
        createdByEmail: req.user!.email,
      },
    });

    // Fire-and-forget background job — pass resolved image URL directly
    processVideoGenerationFromUrl(
      illustration.id,
      sourceImageUrl,
      prompt.trim(),
      { duration: dur, aspectRatio: ar, resolution: res_val }
    ).catch((err) => {
      console.error('[Video] Generation background error:', err);
    });

    res.status(202).json({
      id: illustration.id,
      status: 'GENERATING',
    });
  } catch (error) {
    console.error('[Video] Generate error:', error);
    res.status(500).json({ error: 'Failed to start video generation' });
  }
});

// GET /api/video — List videos (gallery)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50', characterId, lessonId } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const take = parseInt(limit as string) || 50;
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = {
      artType: 'VIDEO',
      OR: [{ status: 'COMPLETED' }, { status: 'GENERATING' }],
    };
    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }
    if (characterId) {
      where.characterId = characterId as string;
    }
    if (lessonId) {
      where.lessonId = lessonId as string;
    }

    const [videos, total] = await Promise.all([
      prisma.illustration.findMany({
        where,
        include: { sourceIllustration: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.illustration.count({ where }),
    ]);

    res.json({ videos, total, page: pageNum, limit: take });
  } catch (error) {
    console.error('[Video] List error:', error);
    res.status(500).json({ error: 'Failed to load videos' });
  }
});

// GET /api/video/:id — Single video with generations
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const video = await prisma.illustration.findUnique({
      where: { id: req.params.id },
      include: {
        generations: { orderBy: { createdAt: 'desc' } },
        sourceIllustration: true,
      },
    });

    if (!video || video.artType !== 'VIDEO') {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    console.error('[Video] Get error:', error);
    res.status(500).json({ error: 'Failed to load video' });
  }
});

// GET /api/video/:id/status — Poll generation status
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const video = await prisma.illustration.findUnique({
      where: { id: req.params.id },
      include: { generations: true },
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      status: video.status,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      generations: video.generations,
      errorMessage: video.errorMessage,
    });
  } catch (error) {
    console.error('[Video] Status error:', error);
    res.status(500).json({ error: 'Failed to check video status' });
  }
});

// PATCH /api/video/:id - Update video metadata
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const video = await prisma.illustration.findUnique({
      where: { id: req.params.id },
    });

    if (!video || video.artType !== 'VIDEO') {
      return res.status(404).json({ error: 'Video not found' });
    }

    const data: Record<string, unknown> = {};
    if (req.body.name !== undefined) data.name = req.body.name.trim();
    if (req.body.description !== undefined) data.description = req.body.description;
    if ('lessonId' in req.body) data.lessonId = req.body.lessonId || null;

    const updated = await prisma.illustration.update({
      where: { id: req.params.id },
      data,
      include: {
        lesson: {
          select: { id: true, lessonNumber: true, title: true, module: { select: { code: true, title: true } } },
        },
        sourceIllustration: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Video] Update error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// DELETE /api/video/:id — Delete video + S3 cleanup
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const video = await prisma.illustration.findUnique({
      where: { id: req.params.id },
      include: { generations: true },
    });

    if (!video || video.artType !== 'VIDEO') {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Clean up S3 files
    const keysToDelete = [
      video.videoKey,
      video.thumbnailKey,
      video.illustrationKey,
      ...video.generations.map((g) => g.savedImageKey),
    ].filter(Boolean) as string[];

    await Promise.all(keysToDelete.map((key) => deleteFromS3(key)));

    await prisma.illustration.delete({ where: { id: req.params.id } });

    res.json({ success: true });
  } catch (error) {
    console.error('[Video] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

export default router;
