import { Router, Request, Response } from 'express';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  retrieveSimilarLessons,
  getConceptsList,
  getLessonById,
  iterateLesson,
  aiReviewLesson,
  startLessonGeneration,
} from '../../generation/curriculum/index.js';
import type {
  AgeBand,
  StoryDensity,
  StorySubject,
  ChessBasis,
  PuzzleDifficulty,
  GenerationParams,
  ValidationChecklist,
  GenerationResponse,
} from '../../types/index.js';

const router = Router();

// All routes require admin access
router.use(requireAdmin);

// GET /api/generate/concepts - List available chess concepts
router.get('/concepts', async (_req: Request, res: Response) => {
  try {
    const concepts = await getConceptsList();
    res.json({ concepts });
  } catch (error) {
    console.error('Failed to get concepts:', error);
    res.status(500).json({ error: 'Failed to load concepts' });
  }
});

// POST /api/generate/lesson - Queue a new lesson for generation
// Returns immediately with job ID; client polls for completion
router.post('/lesson', async (req: Request, res: Response) => {
  try {
    const {
      ageBand,
      chessConceptKey,
      storyDensity,
      // Structured inputs (Phase 2)
      storySubject,
      chessBasis,
      puzzleCount,
      puzzleDifficulty,
      additionalNotes,
      // Reference data
      playerName,
      playerProfile,
      bookId,
      bookTitle,
      openingEco,
      openingName,
      tacticalThemeId,
      tacticalThemeName,
      // Legacy
      customInstructions,
    } = req.body as {
      ageBand: AgeBand;
      chessConceptKey: string;
      storyDensity: StoryDensity;
      storySubject?: StorySubject;
      chessBasis?: ChessBasis;
      puzzleCount?: number;
      puzzleDifficulty?: PuzzleDifficulty;
      additionalNotes?: string;
      // Reference data
      playerName?: string;
      playerProfile?: {
        id: string;
        username: string;
        title: string | null;
        name: string;
        country: string | null;
        bio: string | null;
        fideRating: number | null;
        ratings: { blitz: number | null; rapid: number | null; classical: number | null };
      };
      bookId?: string;
      bookTitle?: string;
      openingEco?: string;
      openingName?: string;
      tacticalThemeId?: string;
      tacticalThemeName?: string;
      customInstructions?: string;
    };

    if (!ageBand || !chessConceptKey || !storyDensity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate puzzleCount if provided
    if (puzzleCount !== undefined && (puzzleCount < 1 || puzzleCount > 10)) {
      return res.status(400).json({ error: 'Puzzle count must be between 1 and 10' });
    }

    // Create lesson record with QUEUED status
    const { prisma } = await import('../../lib/prisma.js');

    const lesson = await prisma.generatedLesson.create({
      data: {
        ageBand,
        chessConceptKey,
        storyDensity,
        // Structured inputs (Phase 2)
        storySubject: storySubject || null,
        chessBasis: chessBasis || null,
        puzzleCount: puzzleCount ?? null,
        puzzleDifficulty: puzzleDifficulty || null,
        additionalNotes: additionalNotes?.trim() || null,
        // Reference data
        playerName: playerName?.trim() || null,
        playerProfile: playerProfile || undefined,
        bookId: bookId || null,
        bookTitle: bookTitle || null,
        openingEco: openingEco || null,
        openingName: openingName || null,
        tacticalThemeId: tacticalThemeId || null,
        tacticalThemeName: tacticalThemeName || null,
        // Legacy
        customInstructions: customInstructions || null,
        createdByEmail: req.user!.email,
        // status defaults to QUEUED
        // title and rawContent are null until generation completes
      },
    });

    // Start background generation (fire and forget)
    startLessonGeneration(lesson.id);

    // Return immediately with job info
    res.status(202).json({
      id: lesson.id,
      status: 'QUEUED',
      message: 'Generation started. Poll GET /api/generate/lesson/:id/status for progress.',
    });
  } catch (error) {
    console.error('Failed to queue lesson generation:', error);
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

// GET /api/generate/lesson/:id/status - Lightweight polling endpoint
router.get('/lesson/:id/status', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('../../lib/prisma.js');

    const lesson = await prisma.generatedLesson.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        title: true,
        aiReviewScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({
      id: lesson.id,
      status: lesson.status,
      errorMessage: lesson.errorMessage,
      title: lesson.title,
      aiReviewScore: lesson.aiReviewScore,
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    });
  } catch (error) {
    console.error('Failed to get lesson status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/generate/lesson/:id - Get a generated lesson
router.get('/lesson/:id', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('../../lib/prisma.js');

    const lesson = await prisma.generatedLesson.findUnique({
      where: { id: req.params.id },
      include: { iterations: { orderBy: { createdAt: 'desc' } } },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Check if lesson is still being processed
    if (['QUEUED', 'GENERATING', 'REVIEWING'].includes(lesson.status)) {
      return res.status(202).json({
        id: lesson.id,
        status: lesson.status,
        message: 'Lesson is still being generated. Poll /status for updates.',
      });
    }

    // Check if generation failed
    if (lesson.status === 'FAILED') {
      return res.status(422).json({
        id: lesson.id,
        status: 'FAILED',
        error: lesson.errorMessage || 'Generation failed',
      });
    }

    // At this point, lesson should have content
    if (!lesson.title || !lesson.rawContent) {
      return res.status(500).json({ error: 'Lesson data is incomplete' });
    }

    // Get comparison lesson if set
    let comparisonLesson = null;
    if (lesson.comparisonLessonId) {
      comparisonLesson = await getLessonById(lesson.comparisonLessonId);
    }

    const response: GenerationResponse = {
      id: lesson.id,
      lesson: {
        title: lesson.title,
        rawContent: lesson.rawContent,
        sections: {
          story: lesson.storyContent || undefined,
          chessLesson: lesson.chessLesson || undefined,
          teacherTips: lesson.teacherTips || undefined,
          chessercises: lesson.chessercises || undefined,
          puzzles: (lesson.puzzles as unknown as GenerationResponse['lesson']['sections']['puzzles']) || undefined,
        },
      },
      validation: {
        aiReview: lesson.aiReviewScore !== null
          ? {
              score: lesson.aiReviewScore,
              formatCompliance: 0,
              ageAppropriateness: 0,
              chessAccuracy: 0,
              toneConsistency: 0,
              notes: lesson.aiReviewNotes || '',
              issues: [],
            }
          : null,
        comparison: comparisonLesson
          ? {
              lessonId: comparisonLesson.id,
              moduleCode: comparisonLesson.module.code,
              lessonNumber: comparisonLesson.lessonNumber,
              title: comparisonLesson.title,
              rawContent: comparisonLesson.rawContent,
            }
          : null,
        checklist: (lesson.checklistItems as unknown as ValidationChecklist) || {
          storyPresent: null,
          teacherTipsPresent: null,
          chessercisesPresent: null,
          ageAppropriate: null,
          chessAccurate: null,
          mnemonicsCorrect: null,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to get lesson:', error);
    res.status(500).json({ error: 'Failed to load lesson' });
  }
});

// POST /api/generate/lesson/:id/iterate - Refine a lesson
router.post('/lesson/:id/iterate', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body as { prompt: string };

    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const { prisma } = await import('../../lib/prisma.js');

    const lesson = await prisma.generatedLesson.findUnique({
      where: { id: req.params.id },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Check if lesson has completed generation
    if (!lesson.rawContent) {
      return res.status(400).json({ error: 'Lesson has not been generated yet' });
    }

    const params: GenerationParams = {
      ageBand: lesson.ageBand as AgeBand,
      chessConceptKey: lesson.chessConceptKey,
      storyDensity: lesson.storyDensity as StoryDensity,
    };

    // Generate iteration
    const updated = await iterateLesson(lesson.rawContent, prompt, params);

    // Save iteration
    await prisma.generationIteration.create({
      data: {
        lessonId: lesson.id,
        prompt,
        previousContent: lesson.rawContent,
        newContent: updated.rawContent,
      },
    });

    // Update lesson
    await prisma.generatedLesson.update({
      where: { id: lesson.id },
      data: {
        title: updated.title,
        rawContent: updated.rawContent,
        storyContent: updated.sections.story,
        chessLesson: updated.sections.chessLesson,
        teacherTips: updated.sections.teacherTips,
        chessercises: updated.sections.chessercises,
        puzzles: updated.sections.puzzles as unknown as object,
        status: 'DRAFT',
      },
    });

    res.json({ success: true, lesson: updated });
  } catch (error) {
    console.error('Failed to iterate lesson:', error);
    res.status(500).json({ error: 'Failed to refine lesson' });
  }
});

// POST /api/generate/lesson/:id/review - Re-run AI review
router.post('/lesson/:id/review', async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('../../lib/prisma.js');

    const lesson = await prisma.generatedLesson.findUnique({
      where: { id: req.params.id },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    // Check if lesson has completed generation
    if (!lesson.title || !lesson.rawContent) {
      return res.status(400).json({ error: 'Lesson has not been generated yet' });
    }

    const similarLessons = await retrieveSimilarLessons(
      lesson.chessConceptKey,
      lesson.ageBand as AgeBand,
      3
    );

    const generated = {
      title: lesson.title,
      rawContent: lesson.rawContent,
      sections: {
        story: lesson.storyContent || undefined,
        chessLesson: lesson.chessLesson || undefined,
        teacherTips: lesson.teacherTips || undefined,
        chessercises: lesson.chessercises || undefined,
      },
    };

    const aiReview = await aiReviewLesson(generated, lesson.ageBand as AgeBand, similarLessons);

    await prisma.generatedLesson.update({
      where: { id: lesson.id },
      data: {
        aiReviewScore: aiReview.score,
        aiReviewNotes: aiReview.notes,
        status: 'REVIEWED',
      },
    });

    res.json({ success: true, aiReview });
  } catch (error) {
    console.error('Failed to review lesson:', error);
    res.status(500).json({ error: 'Failed to run review' });
  }
});

// POST /api/generate/lesson/:id/checklist - Update validation checklist
router.post('/lesson/:id/checklist', async (req: Request, res: Response) => {
  try {
    const checklist = req.body as ValidationChecklist;

    const { prisma } = await import('../../lib/prisma.js');

    const allChecked = Object.values(checklist).every((v) => v !== null);

    await prisma.generatedLesson.update({
      where: { id: req.params.id },
      data: {
        checklistItems: checklist as unknown as object,
        checklistCompleted: allChecked,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update checklist:', error);
    res.status(500).json({ error: 'Failed to save checklist' });
  }
});

// POST /api/generate/lesson/:id/approve - Approve or reject lesson
router.post('/lesson/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approved } = req.body as { approved: boolean };

    const { prisma } = await import('../../lib/prisma.js');

    await prisma.generatedLesson.update({
      where: { id: req.params.id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to approve/reject lesson:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /api/generate/lessons - List generated lessons
router.get('/lessons', async (req: Request, res: Response) => {
  try {
    const { status, concept, limit = '20', offset = '0' } = req.query;

    const { prisma } = await import('../../lib/prisma.js');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (concept) where.chessConceptKey = { contains: concept as string, mode: 'insensitive' };

    const lessons = await prisma.generatedLesson.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      select: {
        id: true,
        title: true,
        ageBand: true,
        chessConceptKey: true,
        storyDensity: true,
        status: true,
        aiReviewScore: true,
        createdByEmail: true,
        createdAt: true,
      },
    });

    const total = await prisma.generatedLesson.count({ where });

    res.json({ lessons, total });
  } catch (error) {
    console.error('Failed to list lessons:', error);
    res.status(500).json({ error: 'Failed to load lessons' });
  }
});

// ============================================
// A/B Generation Endpoints
// ============================================

// POST /api/generate/ab - Queue 3 versions for A/B comparison
router.post('/ab', async (req: Request, res: Response) => {
  try {
    const {
      ageBand,
      chessConceptKey,
      storyDensity,
      storySubject,
      chessBasis,
      puzzleCount,
      puzzleDifficulty,
      additionalNotes,
      playerName,
      playerProfile,
      bookId,
      bookTitle,
      openingEco,
      openingName,
      tacticalThemeId,
      tacticalThemeName,
      customInstructions,
    } = req.body as {
      ageBand: AgeBand;
      chessConceptKey: string;
      storyDensity: StoryDensity;
      storySubject?: StorySubject;
      chessBasis?: ChessBasis;
      puzzleCount?: number;
      puzzleDifficulty?: PuzzleDifficulty;
      additionalNotes?: string;
      playerName?: string;
      playerProfile?: object;
      bookId?: string;
      bookTitle?: string;
      openingEco?: string;
      openingName?: string;
      tacticalThemeId?: string;
      tacticalThemeName?: string;
      customInstructions?: string;
    };

    if (!ageBand || !chessConceptKey || !storyDensity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userEmail = req.user!.email;
    const { prisma } = await import('../../lib/prisma.js');
    const { randomUUID } = await import('crypto');

    // Generate a group ID for this A/B test
    const abGroupId = randomUUID();

    // Create 3 lessons with different variants
    const variants = ['A', 'B', 'C'] as const;
    const jobs: Array<{ id: string; variant: string }> = [];

    for (const variant of variants) {
      const lesson = await prisma.generatedLesson.create({
        data: {
          ageBand,
          chessConceptKey,
          storyDensity,
          storySubject: storySubject || null,
          chessBasis: chessBasis || null,
          puzzleCount: puzzleCount ?? null,
          puzzleDifficulty: puzzleDifficulty || null,
          additionalNotes: additionalNotes?.trim() || null,
          playerName: playerName?.trim() || null,
          playerProfile: playerProfile || undefined,
          bookId: bookId || null,
          bookTitle: bookTitle || null,
          openingEco: openingEco || null,
          openingName: openingName || null,
          tacticalThemeId: tacticalThemeId || null,
          tacticalThemeName: tacticalThemeName || null,
          customInstructions: customInstructions || null,
          createdByEmail: userEmail,
          // A/B specific
          abGroupId,
          abVariant: variant,
        },
      });

      jobs.push({ id: lesson.id, variant });

      // Start background generation for each variant
      startLessonGeneration(lesson.id);
    }

    res.status(202).json({
      abGroupId,
      jobs,
      message: 'A/B generation started. Poll GET /api/generate/ab/:groupId/status for progress.',
    });
  } catch (error) {
    console.error('Failed to start A/B generation:', error);
    res.status(500).json({ error: 'Failed to start A/B generation' });
  }
});

// GET /api/generate/ab/:groupId/status - Poll A/B group status
router.get('/ab/:groupId/status', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    const { prisma } = await import('../../lib/prisma.js');

    const lessons = await prisma.generatedLesson.findMany({
      where: { abGroupId: groupId },
      orderBy: { abVariant: 'asc' },
      select: {
        id: true,
        abVariant: true,
        status: true,
        title: true,
        aiReviewScore: true,
        wasSelected: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (lessons.length === 0) {
      return res.status(404).json({ error: 'A/B group not found' });
    }

    // Determine overall status
    const statuses = lessons.map((l) => l.status);
    let groupStatus: 'PROCESSING' | 'COMPLETE' | 'PARTIALLY_COMPLETE' | 'FAILED' = 'PROCESSING';

    if (statuses.every((s) => s === 'DRAFT' || s === 'REVIEWED')) {
      groupStatus = 'COMPLETE';
    } else if (statuses.every((s) => s === 'FAILED')) {
      groupStatus = 'FAILED';
    } else if (statuses.some((s) => s === 'DRAFT' || s === 'REVIEWED') && statuses.some((s) => s === 'FAILED')) {
      groupStatus = 'PARTIALLY_COMPLETE';
    }

    res.json({
      abGroupId: groupId,
      status: groupStatus,
      versions: lessons.map((l) => ({
        id: l.id,
        variant: l.abVariant,
        status: l.status,
        title: l.title,
        aiReviewScore: l.aiReviewScore,
        wasSelected: l.wasSelected,
        errorMessage: l.errorMessage,
        updatedAt: l.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Failed to get A/B status:', error);
    res.status(500).json({ error: 'Failed to get A/B status' });
  }
});

// GET /api/generate/ab/:groupId - Get full A/B group with lesson content
router.get('/ab/:groupId', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;

    const { prisma } = await import('../../lib/prisma.js');

    const lessons = await prisma.generatedLesson.findMany({
      where: { abGroupId: groupId },
      orderBy: { abVariant: 'asc' },
    });

    if (lessons.length === 0) {
      return res.status(404).json({ error: 'A/B group not found' });
    }

    res.json({
      abGroupId: groupId,
      versions: lessons.map((lesson) => ({
        id: lesson.id,
        variant: lesson.abVariant,
        status: lesson.status,
        wasSelected: lesson.wasSelected,
        title: lesson.title,
        rawContent: lesson.rawContent,
        sections: {
          story: lesson.storyContent || undefined,
          chessLesson: lesson.chessLesson || undefined,
          teacherTips: lesson.teacherTips || undefined,
          chessercises: lesson.chessercises || undefined,
          puzzles: lesson.puzzles || undefined,
        },
        aiReviewScore: lesson.aiReviewScore,
        aiReviewNotes: lesson.aiReviewNotes,
        errorMessage: lesson.errorMessage,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Failed to get A/B group:', error);
    res.status(500).json({ error: 'Failed to get A/B group' });
  }
});

// POST /api/generate/ab/:groupId/select/:lessonId - Select a version as the winner
router.post('/ab/:groupId/select/:lessonId', async (req: Request, res: Response) => {
  try {
    const { groupId, lessonId } = req.params;

    const { prisma } = await import('../../lib/prisma.js');

    // Verify the lesson belongs to this group
    const lesson = await prisma.generatedLesson.findFirst({
      where: { id: lessonId, abGroupId: groupId },
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found in this A/B group' });
    }

    // Mark selected lesson
    await prisma.generatedLesson.update({
      where: { id: lessonId },
      data: { wasSelected: true },
    });

    // Mark other lessons as not selected (in case of re-selection)
    await prisma.generatedLesson.updateMany({
      where: { abGroupId: groupId, id: { not: lessonId } },
      data: { wasSelected: false },
    });

    res.json({
      success: true,
      selectedLessonId: lessonId,
      variant: lesson.abVariant,
    });
  } catch (error) {
    console.error('Failed to select A/B version:', error);
    res.status(500).json({ error: 'Failed to select version' });
  }
});

export default router;
