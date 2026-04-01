import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

// All admin routes require admin access
router.use(requireAdmin);

// ============================================
// Pipeline Dashboard
// ============================================

// GET /api/admin/pipeline — Pipeline health stats + style bible
router.get('/pipeline', async (_req: Request, res: Response) => {
  try {
    // Run all counts in parallel
    const [
      totalModules,
      totalLessons,
      totalChunks,
      embeddedChunks,
      totalIllustrations,
      originalIllustrations,
      illustrationsWithUrl,
      describedIllustrations,
      reviewedIllustrations,
      embeddedIllustrations,
      goldStandardCount,
      totalCharacters,
      generatedArt,
      generatedVideos,
      styleBibleConfig,
      characters,
    ] = await Promise.all([
      prisma.module.count(),
      prisma.lesson.count(),
      prisma.chunk.count(),
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "Chunk" WHERE embedding IS NOT NULL`,
      prisma.illustration.count(),
      prisma.illustration.count({ where: { isOriginal: true } }),
      prisma.illustration.count({ where: { illustrationUrl: { not: null } } }),
      prisma.illustration.count({ where: { aiDescription: { not: null } } }),
      prisma.illustration.count({ where: { reviewStatus: 'reviewed' } }),
      prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM "Illustration" WHERE embedding IS NOT NULL`,
      prisma.illustration.count({ where: { isGoldStandard: true } }),
      prisma.character.count(),
      prisma.illustration.count({ where: { artType: 'CHARACTER' } }),
      prisma.illustration.count({ where: { artType: 'VIDEO' } }),
      prisma.systemConfig.findUnique({ where: { key: 'style_bible_instructions' } }),
      prisma.character.findMany({
        select: { id: true, name: true, piece: true, trait: true, bio: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      stats: {
        totalModules,
        totalLessons,
        totalChunks,
        embeddedChunks: Number(embeddedChunks[0].count),
        totalIllustrations,
        originalIllustrations,
        illustrationsWithUrl,
        describedIllustrations,
        reviewedIllustrations,
        embeddedIllustrations: Number(embeddedIllustrations[0].count),
        goldStandardCount,
        totalCharacters,
        generatedArt,
        generatedVideos,
      },
      styleBible: styleBibleConfig ? {
        instructions: styleBibleConfig.value,
        updatedAt: styleBibleConfig.updatedAt,
        updatedBy: styleBibleConfig.updatedBy,
      } : null,
      characters,
    });
  } catch (error) {
    console.error('[Admin] Pipeline stats error:', error);
    res.status(500).json({ error: 'Failed to load pipeline stats' });
  }
});

// PUT /api/admin/pipeline/style-bible — Update style bible instructions
router.put('/pipeline/style-bible', async (req: Request, res: Response) => {
  try {
    const { instructions } = req.body;
    if (!instructions || typeof instructions !== 'string') {
      return res.status(400).json({ error: 'Instructions text is required' });
    }

    const config = await prisma.systemConfig.upsert({
      where: { key: 'style_bible_instructions' },
      update: {
        value: instructions,
        updatedBy: req.user!.email,
      },
      create: {
        key: 'style_bible_instructions',
        value: instructions,
        updatedBy: req.user!.email,
      },
    });

    res.json({
      instructions: config.value,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
    });
  } catch (error) {
    console.error('[Admin] Update style bible error:', error);
    res.status(500).json({ error: 'Failed to update style bible' });
  }
});

// GET /api/admin/users — List all users
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { lastLoginAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    console.error('[Admin] List users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// PATCH /api/admin/users/:id — Update user role
router.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;

    if (!role || !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be ADMIN, MEMBER, or VIEWER.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent self-demotion
    if (user.email === req.user!.email) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Admin] Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router;
