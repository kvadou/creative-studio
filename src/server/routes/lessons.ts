import { Router } from 'express';
import prisma from '../../lib/prisma.js';

const router = Router();

// GET /api/lessons/with-counts - Modules + lessons with illustration/video counts, characters, chess concepts
router.get('/with-counts', async (_req, res) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { sequence: 'asc' },
      include: {
        lessons: {
          orderBy: { lessonNumber: 'asc' },
          select: {
            id: true,
            lessonNumber: true,
            title: true,
            chessConceptKey: true,
            characters: {
              select: {
                character: {
                  select: { id: true, name: true, piece: true },
                },
              },
            },
            _count: {
              select: {
                illustrations: {
                  where: { artType: { in: ['CARTOON', 'CHARACTER', 'ORIGINAL', 'BACKGROUND'] } },
                },
              },
            },
          },
        },
      },
    });

    // Also count videos (artType: VIDEO) per lesson
    const videoCounts = await prisma.illustration.groupBy({
      by: ['lessonId'],
      where: { artType: 'VIDEO', lessonId: { not: null } },
      _count: { id: true },
    });
    const videoMap = new Map(videoCounts.map(v => [v.lessonId, v._count.id]));

    const result = modules.map(m => ({
      ...m,
      lessons: m.lessons.map(l => ({
        id: l.id,
        lessonNumber: l.lessonNumber,
        title: l.title,
        chessConceptKey: l.chessConceptKey,
        characters: l.characters.map(lc => ({
          id: lc.character.id,
          name: lc.character.name,
          piece: lc.character.piece,
        })),
        _count: {
          illustrations: l._count.illustrations,
          videos: videoMap.get(l.id) || 0,
        },
      })),
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching lessons with counts:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// GET /api/lessons/all - List all modules with lessons (for dropdowns/tagging)
router.get('/all', async (_req, res) => {
  try {
    const modules = await prisma.module.findMany({
      orderBy: { sequence: 'asc' },
      include: {
        lessons: {
          orderBy: { lessonNumber: 'asc' },
          select: {
            id: true,
            lessonNumber: true,
            title: true,
          },
        },
      },
    });
    res.json(modules);
  } catch (error) {
    console.error('Error fetching all lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// GET /api/lessons/:moduleCode/:lessonNumber
router.get('/:moduleCode/:lessonNumber', async (req, res) => {
  try {
    const { moduleCode, lessonNumber } = req.params;
    const lessonNum = parseInt(lessonNumber, 10);

    if (isNaN(lessonNum)) {
      return res.status(400).json({ error: 'Invalid lesson number' });
    }

    // Find the module first
    const module = await prisma.module.findUnique({
      where: { code: moduleCode },
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Find the lesson with characters
    const lesson = await prisma.lesson.findFirst({
      where: {
        moduleId: module.id,
        lessonNumber: lessonNum,
      },
      include: {
        characters: {
          include: {
            character: true,
          },
        },
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({
      id: lesson.id,
      moduleCode,
      moduleTitle: module.title,
      lessonNumber: lessonNum,
      title: lesson.title,
      content: lesson.rawContent,
      characters: lesson.characters.map((lc) => ({
        id: lc.character.id,
        name: lc.character.name,
        piece: lc.character.piece,
      })),
    });
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

export default router;
