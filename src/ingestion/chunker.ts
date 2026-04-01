import crypto from 'crypto';
import type { ChunkType } from '@prisma/client';
import type { ParsedSection } from '../types/index.js';
function estimateTokens(text: string): number { return Math.ceil(text.length / 4); }

export interface ChunkData {
  chunkType: ChunkType;
  sectionTitle: string | null;
  content: string;
  contentHash: string;
  tokenCount: number;
  sequence: number;
}

interface ChunkConfig {
  maxTokens: number;
  overlapSentences: number;
}

const CHUNK_CONFIGS: Record<ChunkType, ChunkConfig> = {
  LESSON_OVERVIEW: { maxTokens: 600, overlapSentences: 1 },
  STORY: { maxTokens: 1000, overlapSentences: 2 },
  CHESS_LESSON: { maxTokens: 800, overlapSentences: 1 },
  TEACHER_TIPS: { maxTokens: 400, overlapSentences: 0 },
  MNEMONIC: { maxTokens: 200, overlapSentences: 0 },
  CHESSERCISE: { maxTokens: 500, overlapSentences: 1 },
  DEVELOPMENTAL: { maxTokens: 400, overlapSentences: 0 },
  INTERACTIVE_MOMENT: { maxTokens: 300, overlapSentences: 0 },
};

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while preserving them
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitWithOverlap(
  sentences: string[],
  maxTokens: number,
  overlapSentences: number
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = estimateTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      // Save current chunk
      chunks.push(currentChunk.join(' '));

      // Start new chunk with overlap
      const overlapStart = Math.max(0, currentChunk.length - overlapSentences);
      currentChunk = currentChunk.slice(overlapStart);
      currentTokens = estimateTokens(currentChunk.join(' '));
    }

    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }

  // Add remaining content
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks;
}

export function chunkSection(section: ParsedSection, baseSequence: number): ChunkData[] {
  const config = CHUNK_CONFIGS[section.type];
  const content = section.content.trim();

  // Skip empty or very short content
  if (content.length < 50) {
    return [];
  }

  const estimatedTokens = estimateTokens(content);

  // If content fits in one chunk, return as-is
  if (estimatedTokens <= config.maxTokens) {
    return [
      {
        chunkType: section.type,
        sectionTitle: section.title || null,
        content,
        contentHash: hashContent(content),
        tokenCount: estimatedTokens,
        sequence: baseSequence,
      },
    ];
  }

  // Split content into multiple chunks with overlap
  const sentences = splitIntoSentences(content);
  const textChunks = splitWithOverlap(sentences, config.maxTokens, config.overlapSentences);

  return textChunks.map((text, index) => ({
    chunkType: section.type,
    sectionTitle: section.title ? `${section.title} (Part ${index + 1})` : null,
    content: text,
    contentHash: hashContent(text),
    tokenCount: estimateTokens(text),
    sequence: baseSequence + index,
  }));
}

export function chunkLesson(sections: ParsedSection[]): ChunkData[] {
  const allChunks: ChunkData[] = [];
  let sequence = 0;

  // Group consecutive sections of the same type for better context
  // But still chunk them individually to maintain granularity
  for (const section of sections) {
    const sectionChunks = chunkSection(section, sequence);
    allChunks.push(...sectionChunks);
    sequence += sectionChunks.length || 1;
  }

  return allChunks;
}

// Create a mnemonic-specific chunk from detected mnemonic with surrounding context
export function createMnemonicChunk(
  content: string,
  mnemonic: string,
  sequence: number
): ChunkData | null {
  // Find the mnemonic in content and extract surrounding context
  const mnemonicIndex = content.toLowerCase().indexOf(mnemonic.toLowerCase());
  if (mnemonicIndex === -1) return null;

  // Get ~500 chars of context around the mnemonic
  const contextStart = Math.max(0, mnemonicIndex - 250);
  const contextEnd = Math.min(content.length, mnemonicIndex + mnemonic.length + 250);

  // Expand to sentence boundaries
  let start = contextStart;
  let end = contextEnd;

  // Find previous sentence start
  for (let i = contextStart; i > 0; i--) {
    if (['.', '!', '?', '\n'].includes(content[i])) {
      start = i + 1;
      break;
    }
  }

  // Find next sentence end
  for (let i = contextEnd; i < content.length; i++) {
    if (['.', '!', '?', '\n'].includes(content[i])) {
      end = i + 1;
      break;
    }
  }

  const contextContent = content.slice(start, end).trim();

  return {
    chunkType: 'MNEMONIC',
    sectionTitle: `Mnemonic: ${mnemonic}`,
    content: contextContent,
    contentHash: hashContent(contextContent),
    tokenCount: estimateTokens(contextContent),
    sequence,
  };
}
