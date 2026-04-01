import { prisma } from '../lib/prisma.js';
import { createGeminiEmbeddings } from '../lib/gemini-embeddings.js';

const BATCH_SIZE = 20; // Smaller batches to avoid API token limits
const MAX_TOKENS_PER_CHUNK = 8000; // Embedding token limit

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface EmbeddingJob {
  chunkId: string;
  content: string;
}

export async function embedChunks(jobs: EmbeddingJob[]): Promise<number> {
  if (jobs.length === 0) return 0;

  // Filter out oversized chunks
  const validJobs = jobs.filter((job) => {
    const tokens = estimateTokens(job.content);
    if (tokens > MAX_TOKENS_PER_CHUNK) {
      console.warn(`Skipping oversized chunk ${job.chunkId} (${tokens} tokens)`);
      return false;
    }
    return true;
  });

  console.log(`Embedding ${validJobs.length} chunks (skipped ${jobs.length - validJobs.length} oversized)`);

  let embedded = 0;

  // Process in batches
  for (let i = 0; i < validJobs.length; i += BATCH_SIZE) {
    const batch = validJobs.slice(i, i + BATCH_SIZE);
    const texts = batch.map((j) => j.content);

    try {
      const embeddings = await createGeminiEmbeddings(texts, 'RETRIEVAL_DOCUMENT');

      // Update each chunk with its embedding using raw SQL for pgvector
      for (let j = 0; j < batch.length; j++) {
        const { chunkId } = batch[j];
        const embedding = embeddings[j];

        // Format embedding as PostgreSQL vector literal
        const vectorLiteral = `[${embedding.join(',')}]`;

        await prisma.$executeRawUnsafe(
          `UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`,
          vectorLiteral,
          chunkId
        );

        embedded++;
      }

      console.log(`Embedded batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(jobs.length / BATCH_SIZE)}`);
    } catch (error) {
      console.error(`Error embedding batch starting at ${i}:`, error);
      throw error;
    }
  }

  return embedded;
}

export async function embedSingleChunk(chunkId: string, content: string): Promise<void> {
  const embeddings = await createGeminiEmbeddings([content], 'RETRIEVAL_DOCUMENT');
  const embedding = embeddings[0];
  const vectorLiteral = `[${embedding.join(',')}]`;

  await prisma.$executeRawUnsafe(
    `UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`,
    vectorLiteral,
    chunkId
  );
}
