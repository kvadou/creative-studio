import { prisma } from '../../lib/prisma.js';
import { retrieveSimilarLessons, generateLesson, aiReviewLesson, findComparisonLesson } from './index.js';
import type {
  AgeBand,
  StoryDensity,
  StorySubject,
  ChessBasis,
  PuzzleDifficulty,
  GenerationParams,
  GeneratedContent,
} from '../../types/index.js';

interface ProgressionItem {
  lessonNum: number;
  concept: string;
  description?: string;
}

/**
 * Background job processor for batch lesson generation.
 * Processes lessons sequentially to:
 * 1. Avoid rate limits
 * 2. Provide progression context from previous lessons
 * 3. Support partial completion (some fail, others succeed)
 */
export async function processBatchGeneration(batchId: string): Promise<void> {
  try {
    const batch = await prisma.curriculumBatch.findUnique({
      where: { id: batchId },
      include: { lessons: true },
    });

    if (!batch) {
      console.error(`[BatchGenerator] Batch ${batchId} not found`);
      return;
    }

    if (batch.status !== 'PENDING') {
      console.log(`[BatchGenerator] Batch ${batchId} is not PENDING (status: ${batch.status}), skipping`);
      return;
    }

    console.log(`[BatchGenerator] Starting batch ${batchId}: ${batch.name} (${batch.lessonCount} lessons)`);

    // Mark batch as processing
    await prisma.curriculumBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING' },
    });

    const progression = batch.progression as unknown as ProgressionItem[];
    let completedCount = 0;
    let failedCount = 0;
    const previousLessons: GeneratedContent[] = [];

    // Process each lesson sequentially
    for (let i = 0; i < progression.length; i++) {
      const item = progression[i];
      const lessonNum = i + 1;

      console.log(`[BatchGenerator] Processing lesson ${lessonNum}/${progression.length}: ${item.concept}`);

      // Update current lesson progress
      await prisma.curriculumBatch.update({
        where: { id: batchId },
        data: { currentLesson: lessonNum },
      });

      try {
        // Create the lesson record
        const lesson = await prisma.generatedLesson.create({
          data: {
            ageBand: batch.ageBand,
            chessConceptKey: item.concept,
            storyDensity: batch.storyDensity,
            status: 'GENERATING',
            createdByEmail: batch.createdByEmail,
            batchId: batch.id,
            batchSequence: lessonNum,
            // Include progression context in additional notes
            additionalNotes: buildProgressionContext(item, previousLessons, lessonNum, progression.length),
          },
        });

        // Generate the lesson
        const generated = await generateLessonWithContext(
          lesson.id,
          batch.ageBand as AgeBand,
          batch.storyDensity as StoryDensity,
          item.concept,
          previousLessons
        );

        previousLessons.push(generated);
        completedCount++;

        // Update batch progress
        await prisma.curriculumBatch.update({
          where: { id: batchId },
          data: { completedLessons: completedCount },
        });

        console.log(`[BatchGenerator] Lesson ${lessonNum} completed: ${generated.title}`);
      } catch (error) {
        console.error(`[BatchGenerator] Failed to generate lesson ${lessonNum}:`, error);
        failedCount++;

        // Update failed count
        await prisma.curriculumBatch.update({
          where: { id: batchId },
          data: { failedLessons: failedCount },
        });
      }
    }

    // Determine final batch status
    let finalStatus: 'COMPLETED' | 'FAILED' | 'PARTIALLY_COMPLETED';
    if (failedCount === 0) {
      finalStatus = 'COMPLETED';
    } else if (completedCount === 0) {
      finalStatus = 'FAILED';
    } else {
      finalStatus = 'PARTIALLY_COMPLETED';
    }

    await prisma.curriculumBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        errorMessage: failedCount > 0 ? `${failedCount} lesson(s) failed to generate` : null,
      },
    });

    console.log(`[BatchGenerator] Batch ${batchId} finished: ${finalStatus} (${completedCount}/${progression.length} succeeded)`);
  } catch (error) {
    console.error(`[BatchGenerator] Fatal error processing batch ${batchId}:`, error);

    try {
      await prisma.curriculumBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error during batch processing',
        },
      });
    } catch (updateError) {
      console.error(`[BatchGenerator] Failed to update batch ${batchId} status:`, updateError);
    }
  }
}

/**
 * Build progression context string for AI to understand lesson sequence.
 */
function buildProgressionContext(
  item: ProgressionItem,
  previousLessons: GeneratedContent[],
  lessonNum: number,
  totalLessons: number
): string {
  const parts: string[] = [];

  parts.push(`This is lesson ${lessonNum} of ${totalLessons} in a progressive series.`);

  if (item.description) {
    parts.push(`Focus for this lesson: ${item.description}`);
  }

  if (previousLessons.length > 0) {
    parts.push('\nPrevious lessons in this series:');
    previousLessons.forEach((lesson, i) => {
      parts.push(`- Lesson ${i + 1}: "${lesson.title}"`);
    });
    parts.push('\nBuild on concepts from previous lessons. Reference characters or situations introduced earlier to create continuity.');
  }

  if (lessonNum < totalLessons) {
    parts.push('\nThis lesson should set up concepts that will be expanded in later lessons.');
  } else {
    parts.push('\nThis is the final lesson in the series. Bring together concepts from all previous lessons.');
  }

  return parts.join('\n');
}

/**
 * Generate a single lesson within batch context.
 */
async function generateLessonWithContext(
  lessonId: string,
  ageBand: AgeBand,
  storyDensity: StoryDensity,
  chessConceptKey: string,
  previousLessons: GeneratedContent[]
): Promise<GeneratedContent> {
  // Retrieve similar lessons for style reference
  const similarLessons = await retrieveSimilarLessons(chessConceptKey, ageBand, 3);

  const params: GenerationParams = {
    ageBand,
    chessConceptKey,
    storyDensity,
  };

  // Generate the lesson
  const generated = await generateLesson(params, similarLessons);

  // Save generated content
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

  // Run AI review
  const [aiReview, comparisonLesson] = await Promise.all([
    aiReviewLesson(generated, ageBand, similarLessons),
    findComparisonLesson(chessConceptKey, ageBand),
  ]);

  // Final update - mark as DRAFT
  await prisma.generatedLesson.update({
    where: { id: lessonId },
    data: {
      aiReviewScore: aiReview.score,
      aiReviewNotes: aiReview.notes,
      comparisonLessonId: comparisonLesson?.id,
      status: 'DRAFT',
    },
  });

  return generated;
}

/**
 * Starts batch generation in the background.
 * Returns immediately - does not await completion.
 */
export function startBatchGeneration(batchId: string): void {
  // Fire and forget - don't await
  processBatchGeneration(batchId).catch((error) => {
    console.error(`[BatchGenerator] Unhandled error for batch ${batchId}:`, error);
  });
}
