import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const [lessons, chunks, modules, illustrations, characters, videos, voices, scripts] = await Promise.all([
      prisma.lesson.count(),
      prisma.chunk.count(),
      prisma.module.count(),
      prisma.illustration.count(),
      prisma.character.count(),
      prisma.illustration.count({ where: { artType: 'VIDEO' } }),
      prisma.characterVoice.count(),
      prisma.audioScript.count(),
    ]);

    res.json({
      lessons,
      chunks,
      characters,
      illustrations,
      modules,
      videos,
      voices,
      scripts,
    });
  } catch (error) {
    console.error('[Stats] Error:', error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

export default router;
