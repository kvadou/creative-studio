import { semanticSearch } from './semantic.js';
import { keywordSearch, exactPhraseSearch } from './keyword.js';
import { reciprocalRankFusion, deduplicateChunks } from './fusion.js';
import { config } from '../lib/config.js';
import type { ChunkWithScore } from '../types/index.js';
import { CANONICAL_MNEMONICS, CANONICAL_CHARACTERS } from '../types/index.js';

interface RetrievalOptions {
  limit?: number;
  threshold?: number;
  includeKeyword?: boolean;
}

/**
 * Main retrieval function - combines semantic and keyword search
 */
export async function retrieve(
  query: string,
  options: RetrievalOptions = {}
): Promise<ChunkWithScore[]> {
  const {
    limit = config.maxChunksPerQuery,
    threshold = config.similarityThreshold,
    includeKeyword = true,
  } = options;

  // Check for exact matches first (mnemonics, character names)
  const exactMatches = await checkExactMatches(query);

  // Run semantic and keyword search in parallel
  const [semanticResults, keywordResults] = await Promise.all([
    semanticSearch(query, limit * 2, threshold),
    includeKeyword ? keywordSearch(query, limit * 2) : Promise.resolve([]),
  ]);

  // Combine results using RRF
  const resultSets = [
    { chunks: semanticResults, weight: 1.0 },
    { chunks: keywordResults, weight: 0.7 },
  ];

  // Add exact matches with high weight
  if (exactMatches.length > 0) {
    resultSets.push({ chunks: exactMatches, weight: 1.5 });
  }

  const fused = reciprocalRankFusion(resultSets);
  const deduped = deduplicateChunks(fused);

  return deduped.slice(0, limit);
}

/**
 * Check if query matches any canonical mnemonics or characters
 */
async function checkExactMatches(query: string): Promise<ChunkWithScore[]> {
  const queryLower = query.toLowerCase();
  const results: ChunkWithScore[] = [];

  // Check for mnemonic references
  for (const mnem of CANONICAL_MNEMONICS) {
    const phraseLower = mnem.phrase.toLowerCase();
    const conceptLower = mnem.concept.toLowerCase();

    if (
      queryLower.includes(phraseLower) ||
      queryLower.includes(conceptLower) ||
      queryLower.includes('mnemonic') ||
      queryLower.includes('phrase')
    ) {
      const matches = await exactPhraseSearch(mnem.phrase, 3);
      results.push(...matches);
    }
  }

  // Check for character name references
  for (const char of CANONICAL_CHARACTERS) {
    const nameLower = char.name.toLowerCase();
    if (queryLower.includes(nameLower)) {
      const matches = await exactPhraseSearch(char.name, 3);
      results.push(...matches);
    }
  }

  return results;
}

/**
 * Get chunks by lesson (for context)
 */
export async function getChunksByLesson(
  moduleCode: string,
  lessonNumber: number
): Promise<ChunkWithScore[]> {
  const { prisma } = await import('../lib/prisma.js');

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
    WHERE m.code = $1 AND l."lessonNumber" = $2
    ORDER BY c.sequence
    `,
    moduleCode,
    lessonNumber
  );

  return results.map((r) => ({
    ...r,
    chunkType: r.chunkType as ChunkWithScore['chunkType'],
  }));
}
