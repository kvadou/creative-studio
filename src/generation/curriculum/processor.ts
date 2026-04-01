import { prisma } from '../../lib/prisma.js';
import { retrieveSimilarLessons, generateLesson, aiReviewLesson, findComparisonLesson } from './index.js';
import type {
  AgeBand,
  StoryDensity,
  StorySubject,
  ChessBasis,
  PuzzleDifficulty,
  GenerationParams,
} from '../../types/index.js';

const MAX_RETRIES = 2;
const RETRY_DELAYS = [5000, 15000]; // 5s, 15s

export function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('overloaded') || msg.includes('rate limit') ||
           msg.includes('timeout') || msg.includes('econnreset') ||
           msg.includes('529') || msg.includes('503');
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Background job processor for lesson generation.
 * Called asynchronously - does not block the HTTP response.
 * Updates lesson record status as it progresses through stages.
 * Retries up to 2 times on transient API failures.
 */
export async function processLessonGeneration(lessonId: string, attempt = 0): Promise<void> {
  try {
    // Load the queued lesson
    const lesson = await prisma.generatedLesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      console.error(`[Generator] Lesson ${lessonId} not found`);
      return;
    }

    if (lesson.status !== 'QUEUED' && lesson.status !== 'GENERATING') {
      console.log(`[Generator] Lesson ${lessonId} is not QUEUED/GENERATING (status: ${lesson.status}), skipping`);
      return;
    }

    console.log(`[Generator] Starting generation for lesson ${lessonId}${attempt > 0 ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}`);

    // Stage 1: GENERATING - fetch similar lessons and generate
    await prisma.generatedLesson.update({
      where: { id: lessonId },
      data: { status: 'GENERATING' },
    });

    const params: GenerationParams = {
      ageBand: lesson.ageBand as AgeBand,
      chessConceptKey: lesson.chessConceptKey,
      storyDensity: lesson.storyDensity as StoryDensity,
      // Structured inputs (Phase 2)
      storySubject: lesson.storySubject as StorySubject | undefined,
      chessBasis: lesson.chessBasis as ChessBasis | undefined,
      playerName: lesson.playerName || undefined,
      puzzleCount: lesson.puzzleCount ?? undefined,
      puzzleDifficulty: lesson.puzzleDifficulty as PuzzleDifficulty | undefined,
      additionalNotes: lesson.additionalNotes || undefined,
      // Legacy
      customInstructions: lesson.customInstructions || undefined,
    };

    // Retrieve similar lessons for context
    const similarLessons = await retrieveSimilarLessons(
      lesson.chessConceptKey,
      lesson.ageBand as AgeBand,
      3
    );

    // Generate the lesson content
    const generated = await generateLesson(params, similarLessons);

    // Save generated content immediately
    await prisma.generatedLesson.update({
      where: { id: lessonId },
      data: {
        title: generated.title,
        rawContent: generated.rawContent,
        storyContent: generated.sections.story,
        chessLesson: generated.sections.chessLesson,
        teacherTips: generated.sections.teacherTips,
        chessercises: generated.sections.chessercises,
        puzzles: generated.sections.puzzles as unknown as object,
        sourceAttributions: generated.sourceAttributions as unknown as object,
        status: 'REVIEWING',
      },
    });

    console.log(`[Generator] Lesson ${lessonId} generated, starting review`);

    // Stage 2: REVIEWING - run AI review and find comparison
    const [aiReview, comparisonLesson] = await Promise.all([
      aiReviewLesson(generated, lesson.ageBand as AgeBand, similarLessons),
      findComparisonLesson(lesson.chessConceptKey, lesson.ageBand as AgeBand),
    ]);

    // Final update - mark as DRAFT (ready for human review)
    await prisma.generatedLesson.update({
      where: { id: lessonId },
      data: {
        aiReviewScore: aiReview.score,
        aiReviewNotes: aiReview.notes,
        comparisonLessonId: comparisonLesson?.id,
        status: 'DRAFT',
      },
    });

    console.log(`[Generator] Lesson ${lessonId} completed with score ${aiReview.score}`);
  } catch (error) {
    console.error(`[Generator] Failed to generate lesson ${lessonId}:`, error);

    // Retry on transient errors (API overloaded, rate limit, timeout)
    if (attempt < MAX_RETRIES && isTransientError(error)) {
      const delay = RETRY_DELAYS[attempt];
      console.log(`[Generator] Retrying lesson ${lessonId} in ${delay / 1000}s (transient error)`);
      await sleep(delay);
      return processLessonGeneration(lessonId, attempt + 1);
    }

    // Mark as failed with error message
    try {
      await prisma.generatedLesson.update({
        where: { id: lessonId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error during generation',
        },
      });
    } catch (updateError) {
      console.error(`[Generator] Failed to update lesson ${lessonId} status:`, updateError);
    }
  }
}

/**
 * Starts lesson generation in the background.
 * Returns immediately - does not await completion.
 */
export function startLessonGeneration(lessonId: string): void {
  // Fire and forget - don't await
  processLessonGeneration(lessonId).catch((error) => {
    console.error(`[Generator] Unhandled error for lesson ${lessonId}:`, error);
  });
}
