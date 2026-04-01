import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

const hasKey = !!process.env.GEMINI_API_KEY;
const genai = hasKey ? new GoogleGenAI({ apiKey: config.geminiApiKey }) : null;

/** Returns a zero vector when no API key is configured. */
function zeroVector(): number[] {
  return new Array(config.embeddingDimensions).fill(0);
}

export async function createGeminiEmbedding(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY'
): Promise<number[]> {
  if (!genai) return zeroVector();
  const result = await genai.models.embedContent({
    model: config.embeddingModel,
    contents: [{ text }],
    config: {
      outputDimensionality: config.embeddingDimensions,
      taskType,
    },
  });
  return result.embeddings![0].values!;
}

export async function createGeminiEmbeddings(
  texts: string[],
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!genai) return texts.map(() => zeroVector());

  const BATCH_LIMIT = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const contents = batch.map((text) => ({ text }));

    const result = await genai.models.embedContent({
      model: config.embeddingModel,
      contents,
      config: {
        outputDimensionality: config.embeddingDimensions,
        taskType,
      },
    });

    const embeddings = result.embeddings!.map((e) => e.values!);
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}
