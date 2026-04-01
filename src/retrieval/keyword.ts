import { prisma } from '../lib/prisma.js';
import type { ChunkWithScore } from '../types/index.js';

// Build a tsquery from natural language
function buildTsQuery(query: string): string {
  // Split into words, filter short ones, join with AND
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return '';

  // Use OR for flexibility, with phrase matching for adjacent words
  return words.map((w) => `${w}:*`).join(' | ');
}

export async function keywordSearch(
  query: string,
  limit: number = 10
): Promise<ChunkWithScore[]> {
  const tsquery = buildTsQuery(query);

  if (!tsquery) {
    return [];
  }

  // Use full-text search on content column
  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      lessonId: string;
      chunkType: string;
      sectionTitle: string | null;
      content: string;
      tokenCount: number;
      sequence: number;
      keywordScore: number;
      moduleCode: string;
      lessonNumber: number;
      lessonTitle: string;
    }>
  >(
    `
    SELECT
      c.id,
      c."lessonId",
      c."chunkType",
      c."sectionTitle",
      c.content,
      c."tokenCount",
      c.sequence,
      ts_rank(to_tsvector('english', c.content), to_tsquery('english', $1)) as "keywordScore",
      m.code as "moduleCode",
      l."lessonNumber",
      l.title as "lessonTitle"
    FROM "Chunk" c
    JOIN "Lesson" l ON c."lessonId" = l.id
    JOIN "Module" m ON l."moduleId" = m.id
    WHERE to_tsvector('english', c.content) @@ to_tsquery('english', $1)
    ORDER BY ts_rank(to_tsvector('english', c.content), to_tsquery('english', $1)) DESC
    LIMIT $2
    `,
    tsquery,
    limit
  );

  return results.map((r) => ({
    ...r,
    chunkType: r.chunkType as ChunkWithScore['chunkType'],
  }));
}

// Exact phrase search for mnemonics and character names
export async function exactPhraseSearch(
  phrase: string,
  limit: number = 5
): Promise<ChunkWithScore[]> {
  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      lessonId: string;
      chunkType: string;
      sectionTitle: string | null;
      content: string;
      tokenCount: number;
      sequence: number;
      moduleCode: string;
      lessonNumber: number;
      lessonTitle: string;
    }>
  >(
    `
    SELECT
      c.id,
      c."lessonId",
      c."chunkType",
      c."sectionTitle",
      c.content,
      c."tokenCount",
      c.sequence,
      m.code as "moduleCode",
      l."lessonNumber",
      l.title as "lessonTitle"
    FROM "Chunk" c
    JOIN "Lesson" l ON c."lessonId" = l.id
    JOIN "Module" m ON l."moduleId" = m.id
    WHERE LOWER(c.content) LIKE $1
    LIMIT $2
    `,
    `%${phrase.toLowerCase()}%`,
    limit
  );

  return results.map((r) => ({
    ...r,
    chunkType: r.chunkType as ChunkWithScore['chunkType'],
    keywordScore: 1.0, // Exact match gets high score
  }));
}
