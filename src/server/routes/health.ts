import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Get some stats
    const [chunkCount, lessonCount, moduleCount] = await Promise.all([
      prisma.chunk.count(),
      prisma.lesson.count(),
      prisma.module.count(),
    ]);

    return res.json({
      status: 'healthy',
      database: 'connected',
      stats: {
        modules: moduleCount,
        lessons: lessonCount,
        chunks: chunkCount,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
