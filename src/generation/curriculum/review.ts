import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../lib/config.js';
import { anthropicMockGuard } from '../../lib/anthropic.js';
import { getAIReviewSystemPrompt } from './prompts.js';
import { extractFormatTemplate } from './template.js';
import type { AgeBand, AIReview, GeneratedContent } from '../../types/index.js';
import type { Lesson, Module } from '@prisma/client';

type LessonWithModule = Lesson & { module: Module };

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const anthropic = hasKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : (null as unknown as Anthropic);

export async function aiReviewLesson(
  generated: GeneratedContent,
  ageBand: AgeBand,
  similarLessons: LessonWithModule[]
): Promise<AIReview> {
  const template = await extractFormatTemplate(similarLessons, ageBand);
  const systemPrompt = getAIReviewSystemPrompt(ageBand, template);

  const comparisonLesson = similarLessons[0];
  const comparisonText = comparisonLesson
    ? `\n\nCOMPARISON LESSON (${comparisonLesson.module.code} - Lesson ${comparisonLesson.lessonNumber}):\n${comparisonLesson.rawContent.slice(0, 2000)}`
    : '';

  const userPrompt = `Review this generated lesson:

GENERATED LESSON:
${generated.rawContent}
${comparisonText}

Provide your review as a JSON object with scores and feedback.`;

  // Stub guard: return mock review when no API key
  const mock = anthropicMockGuard();
  if (mock) {
    return {
      score: 75,
      formatCompliance: 80,
      ageAppropriateness: 80,
      chessAccuracy: 70,
      toneConsistency: 70,
      notes: 'AI review requires an Anthropic API key. This is a placeholder score.',
      issues: [],
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: config.generationModel,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const review = JSON.parse(jsonMatch[0]) as AIReview;

      // Ensure all fields are present
      return {
        score: review.score ?? 0,
        formatCompliance: review.formatCompliance ?? 0,
        ageAppropriateness: review.ageAppropriateness ?? 0,
        chessAccuracy: review.chessAccuracy ?? 0,
        toneConsistency: review.toneConsistency ?? 0,
        notes: review.notes ?? '',
        issues: review.issues ?? [],
      };
    }

    // Fallback if JSON parsing fails
    return {
      score: 50,
      formatCompliance: 50,
      ageAppropriateness: 50,
      chessAccuracy: 50,
      toneConsistency: 50,
      notes: 'Unable to parse AI review. Manual review recommended.',
      issues: ['AI review parsing failed - please review manually'],
    };
  } catch (error) {
    console.error('AI review failed:', error);
    return {
      score: 0,
      formatCompliance: 0,
      ageAppropriateness: 0,
      chessAccuracy: 0,
      toneConsistency: 0,
      notes: 'AI review failed. Manual review required.',
      issues: [`Review error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

export async function findComparisonLesson(
  chessConceptKey: string,
  ageBand: AgeBand
): Promise<LessonWithModule | null> {
  // Map age bands to module patterns
  const modulePatterns =
    ageBand === 'THREE_TO_SEVEN'
      ? ['1A-3-4yo', '1A-4-6yo', '1', '2']
      : ['3', '4', '5', '6', '3A', '3B', '4A', '4B'];

  // First try exact concept match
  const exactMatch = await prisma.lesson.findFirst({
    where: {
      chessConceptKey: {
        contains: chessConceptKey,
        mode: 'insensitive',
      },
      module: {
        code: { in: modulePatterns },
      },
    },
    include: { module: true },
    orderBy: { module: { sequence: 'asc' } },
  });

  if (exactMatch) return exactMatch;

  // Fallback to any lesson in the age band
  const fallback = await prisma.lesson.findFirst({
    where: {
      module: {
        code: { in: modulePatterns },
      },
    },
    include: { module: true },
    orderBy: { module: { sequence: 'asc' } },
  });

  return fallback;
}
