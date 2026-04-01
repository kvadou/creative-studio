import OpenAI from 'openai';
import { config } from './config.js';

const hasKey = !!process.env.OPENAI_API_KEY;

export const openai = hasKey
  ? new OpenAI({ apiKey: config.openaiApiKey })
  : (null as unknown as OpenAI);

/** Returns a zero vector when no API key is configured. */
function zeroVector(dims: number = config.embeddingDimensions): number[] {
  return new Array(dims).fill(0);
}

export async function createEmbedding(text: string): Promise<number[]> {
  if (!hasKey) return zeroVector();
  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: text,
  });
  return response.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!hasKey) return texts.map(() => zeroVector());

  const response = await openai.embeddings.create({
    model: config.embeddingModel,
    input: texts,
  });

  return response.data.map((d) => d.embedding);
}

// Simple token estimation (rough approximation)
export function estimateTokens(text: string): number {
  // GPT tokenizers average ~4 chars per token for English
  return Math.ceil(text.length / 4);
}
