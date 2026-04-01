import { prisma } from '../lib/prisma.js';
import { createGeminiEmbedding } from '../lib/gemini-embeddings.js';
import { config } from '../lib/config.js';
import type { ChunkWithScore } from '../types/index.js';

export async function semanticSearch(
  query: string,
  limit: number = 10,
  threshold: number = config.similarityThreshold
): Promise<ChunkWithScore[]> {
  // Generate query embedding
  const queryEmbedding = await createGeminiEmbedding(query, 'RETRIEVAL_QUERY');
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  // Perform similarity search with pgvector
  const results = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      lessonId: string;
      chunkType: string;
      sectionTitle: string | null;
      content: string;
      tokenCount: number;
      sequence: number;
      similarity: number;
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
      1 - (c.embedding <=> $1::vector) as similarity,
      m.code as "moduleCode",
      l."lessonNumber",
      l.title as "lessonTitle"
    FROM "Chunk" c
    JOIN "Lesson" l ON c."lessonId" = l.id
    JOIN "Module" m ON l."moduleId" = m.id
    WHERE c.embedding IS NOT NULL
      AND 1 - (c.embedding <=> $1::vector) > $2
    ORDER BY c.embedding <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    threshold,
    limit
  );

  return results.map((r) => ({
    ...r,
    chunkType: r.chunkType as ChunkWithScore['chunkType'],
  }));
}

export interface IllustrationSearchResult {
  id: string;
  name: string;
  aiDescription: string | null;
  illustrationUrl: string | null;
  illustrationKey: string | null;
  sourcePhotoUrl: string | null;
  sourcePhotoKey: string | null;
  characterId: string | null;
  similarity: number;
}

/**
 * Semantic search over illustration embeddings.
 * Used to auto-find reference images for character art generation.
 */
export async function semanticSearchIllustrations(
  query: string,
  limit: number = 10,
  threshold: number = 0.3
): Promise<IllustrationSearchResult[]> {
  const queryEmbedding = await createGeminiEmbedding(query, 'RETRIEVAL_QUERY');
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  return prisma.$queryRawUnsafe<IllustrationSearchResult[]>(
    `
    SELECT
      id, name, "aiDescription",
      "illustrationUrl", "illustrationKey",
      "sourcePhotoUrl", "sourcePhotoKey",
      "characterId",
      1 - (embedding <=> $1::vector) as similarity
    FROM "Illustration"
    WHERE embedding IS NOT NULL
      AND "isReferenceEnabled" = true
      AND 1 - (embedding <=> $1::vector) > $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3
    `,
    vectorLiteral,
    threshold,
    limit
  );
}
