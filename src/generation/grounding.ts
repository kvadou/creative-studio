import { anthropic, anthropicMockGuard } from '../lib/anthropic.js';
import { config } from '../lib/config.js';
import {
  GROUNDING_SYSTEM_PROMPT,
  CULTURAL_ADAPTATION_PROMPT,
  NO_ANSWER_RESPONSE,
  formatChunksForPrompt,
  formatCulturalContext,
} from './prompts.js';
import type { ChunkWithScore, Citation, GroundedResponse } from '../types/index.js';

/**
 * Determine confidence level based on retrieval scores
 *
 * Similarity scores (from pgvector) are 0-1 scale
 * Fusion scores (from RRF) are much smaller (~0.01-0.05)
 * Keyword scores indicate exact matches
 */
function assessConfidence(chunks: ChunkWithScore[]): 'high' | 'medium' | 'low' | 'no_answer' {
  if (chunks.length === 0) return 'no_answer';

  const top = chunks[0];

  // If we have an exact keyword match, that's high confidence
  if (top.keywordScore && top.keywordScore >= 0.9) return 'high';

  // Use similarity score if available (semantic search)
  if (top.similarity !== undefined) {
    if (top.similarity >= 0.7) return 'high';
    if (top.similarity >= 0.55) return 'medium';
    if (top.similarity >= config.similarityThreshold) return 'low';
  }

  // For fusion-only results, use different thresholds
  // RRF scores are typically 0.01-0.05 range
  if (top.fusionScore !== undefined) {
    if (top.fusionScore >= 0.03) return 'high';
    if (top.fusionScore >= 0.02) return 'medium';
    if (top.fusionScore >= 0.01) return 'low';
  }

  // If we have chunks but no scores met thresholds, still try to answer with low confidence
  // This handles edge cases where retrieval found relevant content
  return chunks.length > 0 ? 'low' : 'no_answer';
}

/**
 * Extract citations from chunks
 */
function extractCitations(chunks: ChunkWithScore[]): Citation[] {
  const seen = new Set<string>();
  const citations: Citation[] = [];

  for (const chunk of chunks) {
    if (!chunk.moduleCode || !chunk.lessonNumber) continue;

    const key = `${chunk.moduleCode}-${chunk.lessonNumber}`;
    if (seen.has(key)) continue;
    seen.add(key);

    citations.push({
      text: chunk.lessonTitle || 'Unknown Lesson',
      moduleCode: chunk.moduleCode,
      lessonNumber: chunk.lessonNumber,
      section: chunk.sectionTitle || chunk.chunkType,
    });
  }

  return citations;
}

/**
 * Options for response generation
 */
export interface GenerationOptions {
  projectInstructions?: string; // Custom instructions from shared project
}

/**
 * Generate a grounded response using Claude
 */
export async function generateGroundedResponse(
  query: string,
  chunks: ChunkWithScore[],
  options?: GenerationOptions
): Promise<GroundedResponse> {
  const confidence = assessConfidence(chunks);

  // If no relevant chunks, return no-answer response
  if (confidence === 'no_answer') {
    return {
      answer: NO_ANSWER_RESPONSE,
      citations: [],
      confidence: 'no_answer',
      rawChunks: [],
    };
  }

  // Format chunks for the prompt
  const context = formatChunksForPrompt(chunks);

  // Build system prompt with optional project instructions
  let systemPrompt = GROUNDING_SYSTEM_PROMPT;
  if (options?.projectInstructions) {
    systemPrompt = `PROJECT CONTEXT:\n${options.projectInstructions}\n\n---\n\n${systemPrompt}`;
  }

  // Stub guard: return mock response when no API key
  const mock = anthropicMockGuard();
  if (mock) {
    const mockText = mock.content[0].type === 'text' ? (mock.content[0] as { type: 'text'; text: string }).text : '';
    return {
      answer: mockText,
      citations: extractCitations(chunks),
      confidence,
      rawChunks: chunks,
    };
  }

  // Call Claude
  const response = await anthropic.messages.create({
    model: config.generationModel,
    max_tokens: config.maxGenerationTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `CONTEXT:\n${context}\n\n---\n\nQUESTION: ${query}`,
      },
    ],
  });

  // Extract text from response
  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  // Extract citations from the chunks that were used
  const citations = extractCitations(chunks);

  return {
    answer,
    citations,
    confidence,
    rawChunks: chunks,
  };
}

/**
 * Cultural adaptation response type
 */
export interface CulturalAdaptationResponse extends GroundedResponse {
  region: string;
  culturalSources: string[];
}

/**
 * Generate a cultural adaptation response
 * Combines curriculum content with web-sourced cultural guidelines
 */
export async function generateCulturalAdaptation(
  query: string,
  chunks: ChunkWithScore[],
  culturalInfo: {
    region: string;
    guidelines: string[];
    restrictions: string[];
    sources: string[];
    rawResponse: string;
  },
  options?: GenerationOptions
): Promise<CulturalAdaptationResponse> {
  // Format curriculum content
  const curriculumContext = formatChunksForPrompt(chunks);

  // Format cultural guidelines
  const culturalContext = formatCulturalContext(
    culturalInfo.region,
    culturalInfo.guidelines,
    culturalInfo.restrictions,
    culturalInfo.sources
  );

  // Build the full context
  const fullContext = `=== CURRICULUM CONTENT ===\n${curriculumContext}\n\n${culturalContext}\n\n=== RAW CULTURAL RESEARCH ===\n${culturalInfo.rawResponse}`;

  // Build system prompt with optional project instructions
  let systemPrompt = CULTURAL_ADAPTATION_PROMPT;
  if (options?.projectInstructions) {
    systemPrompt = `PROJECT CONTEXT:\n${options.projectInstructions}\n\n---\n\n${systemPrompt}`;
  }

  // Stub guard: return mock response when no API key
  const mock = anthropicMockGuard();
  if (mock) {
    const mockText = mock.content[0].type === 'text' ? (mock.content[0] as { type: 'text'; text: string }).text : '';
    return {
      answer: mockText,
      citations: extractCitations(chunks),
      confidence: 'low' as const,
      rawChunks: chunks,
      region: culturalInfo.region,
      culturalSources: culturalInfo.sources,
    };
  }

  // Call Claude with cultural adaptation prompt
  const response = await anthropic.messages.create({
    model: config.generationModel,
    max_tokens: 2500, // Longer for detailed adaptation guidance
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${fullContext}\n\n---\n\nADAPTATION REQUEST: ${query}\n\nRegion: ${culturalInfo.region}`,
      },
    ],
  });

  // Extract text from response
  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('\n');

  // Extract citations from curriculum chunks
  const citations = extractCitations(chunks);

  // Determine confidence - cultural adaptations are always "medium" unless we have strong sources
  const confidence = culturalInfo.sources.length >= 2 ? 'high' : 'medium';

  return {
    answer,
    citations,
    confidence,
    rawChunks: chunks,
    region: culturalInfo.region,
    culturalSources: culturalInfo.sources,
  };
}
