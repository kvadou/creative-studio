import type { ChunkWithScore } from '../types/index.js';

interface RankedResults {
  chunks: ChunkWithScore[];
  weight: number;
}

/**
 * Reciprocal Rank Fusion (RRF) combines multiple ranked lists
 * Formula: score = sum(weight / (k + rank)) for each list
 */
export function reciprocalRankFusion(
  resultSets: RankedResults[],
  k: number = 60
): ChunkWithScore[] {
  const scores = new Map<string, { chunk: ChunkWithScore; score: number }>();

  for (const { chunks, weight } of resultSets) {
    chunks.forEach((chunk, rank) => {
      const rrfScore = weight / (k + rank + 1);
      const existing = scores.get(chunk.id);

      if (existing) {
        existing.score += rrfScore;
        // Merge scores from different sources
        if (chunk.similarity !== undefined) {
          existing.chunk.similarity = chunk.similarity;
        }
        if (chunk.keywordScore !== undefined) {
          existing.chunk.keywordScore = chunk.keywordScore;
        }
      } else {
        scores.set(chunk.id, {
          chunk: { ...chunk },
          score: rrfScore,
        });
      }
    });
  }

  // Sort by fusion score and add it to chunks
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ chunk, score }) => ({
      ...chunk,
      fusionScore: score,
    }));
}

/**
 * Deduplicate chunks that have very similar content
 * (e.g., overlapping chunks from the same section)
 */
export function deduplicateChunks(
  chunks: ChunkWithScore[],
  similarityThreshold: number = 0.8
): ChunkWithScore[] {
  const seen = new Set<string>();
  const result: ChunkWithScore[] = [];

  for (const chunk of chunks) {
    // Simple dedup by content hash prefix (first 100 chars)
    const contentKey = chunk.content.slice(0, 100).toLowerCase().replace(/\s+/g, ' ');

    // Check if we've seen very similar content
    let isDupe = false;
    for (const seenContent of seen) {
      if (jaccardSimilarity(contentKey, seenContent) > similarityThreshold) {
        isDupe = true;
        break;
      }
    }

    if (!isDupe) {
      seen.add(contentKey);
      result.push(chunk);
    }
  }

  return result;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(' '));
  const setB = new Set(b.split(' '));

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}
