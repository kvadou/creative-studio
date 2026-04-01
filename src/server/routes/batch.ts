import { Router } from 'express';
import type { Prisma, BatchStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { startBatchGeneration } from '../../generation/curriculum/index.js';
import type { AgeBand, StoryDensity } from '../../types/index.js';

const router = Router();

// All batch routes require admin access
router.use(requireAdmin);

// Valid enum values for validation
const VALID_AGE_BANDS: AgeBand[] = ['THREE_TO_SEVEN', 'EIGHT_TO_NINE', 'TEN_TO_TWELVE'];
const VALID_STORY_DENSITIES: StoryDensity[] = ['HIGH', 'MEDIUM', 'LOW'];

interface ProgressionItem {
  lessonNum: number;
  concept: string;
  description?: string;
}

/**
 * POST /api/generate/batch
 * Create a new batch and queue for generation.
 * Returns 202 Accepted with batch ID immediately.
 */
router.post('/', async (req, res) => {
  try {
    const { name, ageBand, storyDensity, progression } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Batch name is required' });
    }

    if (!ageBand || !VALID_AGE_BANDS.includes(ageBand)) {
      return res.status(400).json({ error: `Invalid ageBand. Must be one of: ${VALID_AGE_BANDS.join(', ')}` });
    }

    if (!storyDensity || !VALID_STORY_DENSITIES.includes(storyDensity)) {
      return res.status(400).json({ error: `Invalid storyDensity. Must be one of: ${VALID_STORY_DENSITIES.join(', ')}` });
    }

    // Validate progression array
    if (!Array.isArray(progression) || progression.length === 0) {
      return res.status(400).json({ error: 'Progression must be a non-empty array' });
    }

    if (progression.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 lessons per batch allowed' });
    }

    // Validate each progression item
    for (let i = 0; i < progression.length; i++) {
      const item = progression[i] as ProgressionItem;
      if (!item.concept || typeof item.concept !== 'string') {
        return res.status(400).json({ error: `Progression item ${i + 1} must have a concept` });
      }
    }

    const userEmail = req.user!.email;

    // Create the batch record
    const batch = await prisma.curriculumBatch.create({
      data: {
        name: name.trim(),
        ageBand,
        storyDensity,
        lessonCount: progression.length,
        progression,
        status: 'PENDING',
        createdByEmail: userEmail,
      },
    });

    console.log(`[BatchRoutes] Created batch ${batch.id}: ${batch.name} (${batch.lessonCount} lessons)`);

    // Start background generation (fire and forget)
    startBatchGeneration(batch.id);

    // Return 202 Accepted with batch ID
    res.status(202).json({
      id: batch.id,
      status: 'PENDING',
      message: `Batch "${batch.name}" queued for generation`,
      lessonCount: batch.lessonCount,
    });
  } catch (error) {
    console.error('[BatchRoutes] Error creating batch:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

/**
 * GET /api/generate/batch/:id/status
 * Lightweight polling endpoint for batch status.
 */
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await prisma.curriculumBatch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        status: true,
        lessonCount: true,
        currentLesson: true,
        completedLessons: true,
        failedLessons: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json(batch);
  } catch (error) {
    console.error('[BatchRoutes] Error fetching batch status:', error);
    res.status(500).json({ error: 'Failed to fetch batch status' });
  }
});

/**
 * GET /api/generate/batch/:id
 * Get full batch details including all lessons.
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await prisma.curriculumBatch.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { batchSequence: 'asc' },
          select: {
            id: true,
            title: true,
            chessConceptKey: true,
            status: true,
            aiReviewScore: true,
            batchSequence: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json({
      id: batch.id,
      name: batch.name,
      ageBand: batch.ageBand,
      storyDensity: batch.storyDensity,
      lessonCount: batch.lessonCount,
      progression: batch.progression,
      status: batch.status,
      currentLesson: batch.currentLesson,
      completedLessons: batch.completedLessons,
      failedLessons: batch.failedLessons,
      errorMessage: batch.errorMessage,
      lessons: batch.lessons,
      createdByEmail: batch.createdByEmail,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    });
  } catch (error) {
    console.error('[BatchRoutes] Error fetching batch:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

/**
 * GET /api/generate/batches
 * List all batches with pagination.
 */
router.get('/', async (req, res) => {
  try {
    const { status, limit = '20', offset = '0' } = req.query;

    const where: Prisma.CurriculumBatchWhereInput = {};
    if (status && typeof status === 'string') {
      where.status = status as BatchStatus;
    }

    const [batches, total] = await Promise.all([
      prisma.curriculumBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string, 10),
        skip: parseInt(offset as string, 10),
        select: {
          id: true,
          name: true,
          ageBand: true,
          storyDensity: true,
          lessonCount: true,
          status: true,
          completedLessons: true,
          failedLessons: true,
          createdByEmail: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.curriculumBatch.count({ where }),
    ]);

    res.json({ batches, total });
  } catch (error) {
    console.error('[BatchRoutes] Error listing batches:', error);
    res.status(500).json({ error: 'Failed to list batches' });
  }
});

export default router;
