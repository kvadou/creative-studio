import { prisma } from '../../lib/prisma.js';
import type { AgeBand } from '../../types/index.js';
import type { Lesson, Module } from '@prisma/client';

type LessonWithModule = Lesson & { module: Module };

// Map age bands to module codes/patterns
const AGE_BAND_MODULES: Record<AgeBand, RegExp[]> = {
  THREE_TO_SEVEN: [/^1A-3-4yo$/, /^1A-4-6yo$/, /^[12]$/],
  EIGHT_TO_NINE: [/^[23]$/, /^[23][AB]$/], // Intermediate modules bridging young and advanced
  TEN_TO_TWELVE: [/^[3456]$/, /^[34][AB]$/],
};

export async function retrieveSimilarLessons(
  chessConceptKey: string,
  ageBand: AgeBand,
  limit: number = 3
): Promise<LessonWithModule[]> {


  // First, try exact match on chess concept
  let lessons = await prisma.lesson.findMany({
    where: {
      chessConceptKey: {
        contains: chessConceptKey.toLowerCase(),
        mode: 'insensitive',
      },
    },
    include: { module: true },
    orderBy: { module: { sequence: 'asc' } },
  });

  // Filter by age band
  const patterns = AGE_BAND_MODULES[ageBand];
  lessons = lessons.filter((l) => patterns.some((p) => p.test(l.module.code)));

  // If we have enough, return
  if (lessons.length >= limit) {
    return lessons.slice(0, limit);
  }

  // Otherwise, do a broader search
  const allLessons = await prisma.lesson.findMany({
    include: { module: true },
    orderBy: { module: { sequence: 'asc' } },
  });

  // Filter by age band and pick representative lessons
  const ageBandLessons = allLessons.filter((l) => patterns.some((p) => p.test(l.module.code)));

  // Dedupe by adding lessons not already in results
  const existingIds = new Set(lessons.map((l) => l.id));
  for (const lesson of ageBandLessons) {
    if (!existingIds.has(lesson.id)) {
      lessons.push(lesson);
      if (lessons.length >= limit) break;
    }
  }

  return lessons.slice(0, limit);
}

export async function getConceptsList(): Promise<string[]> {


  const concepts = await prisma.lesson.findMany({
    where: {
      chessConceptKey: { not: null },
    },
    select: { chessConceptKey: true },
    distinct: ['chessConceptKey'],
  });

  return concepts.map((c) => c.chessConceptKey!).filter(Boolean).sort();
}

export async function getLessonById(id: string): Promise<LessonWithModule | null> {


  return prisma.lesson.findUnique({
    where: { id },
    include: { module: true },
  });
}
