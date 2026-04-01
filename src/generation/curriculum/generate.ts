import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../lib/config.js';
import { getGenerationSystemPrompt, getIterationPrompt, type StructuredParams } from './prompts.js';
import { extractFormatTemplate } from './template.js';
import type {
  GenerationParams,
  GeneratedContent,
  GeneratedSections,
  GeneratedPuzzle,
  FormatTemplate,
  SourceAttribution,
  AttributionType,
} from '../../types/index.js';
import type { Lesson, Module } from '@prisma/client';

type LessonWithModule = Lesson & { module: Module };

import { anthropicMockGuard } from '../../lib/anthropic.js';

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const anthropic = hasKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : (null as unknown as Anthropic);

export async function generateLesson(
  params: GenerationParams,
  similarLessons: LessonWithModule[]
): Promise<GeneratedContent> {
  const template = await extractFormatTemplate(similarLessons, params.ageBand);

  // Build structured params for the prompt
  const structuredParams: StructuredParams | undefined = (params.storySubject || params.chessBasis || params.puzzleCount !== undefined || params.puzzleDifficulty || params.additionalNotes)
    ? {
        storySubject: params.storySubject,
        chessBasis: params.chessBasis,
        puzzleCount: params.puzzleCount,
        puzzleDifficulty: params.puzzleDifficulty,
        additionalNotes: params.additionalNotes,
      }
    : undefined;

  const systemPrompt = getGenerationSystemPrompt(params.ageBand, params.storyDensity, template, structuredParams);

  const exampleLessons = similarLessons
    .map(
      (l, i) => `
=== EXAMPLE LESSON ${i + 1}: ${l.module.code} - Lesson ${l.lessonNumber} ===
Title: ${l.title}
${l.rawContent.slice(0, 3000)}${l.rawContent.length > 3000 ? '\n... [truncated]' : ''}
`
    )
    .join('\n');

  const userPrompt = `Generate a complete lesson for the following:

CHESS CONCEPT: ${params.chessConceptKey}
AGE BAND: ${params.ageBand === 'THREE_TO_SEVEN' ? '3-7 years old (Acme Creative)' : '8-12 years old (Epic Chess)'}
STORY DENSITY: ${params.storyDensity}
${params.customInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${params.customInstructions}` : ''}

REFERENCE LESSONS (for format and style):
${exampleLessons}

Generate a complete new lesson with:
1. A creative, engaging title
2. All required sections in order
3. At least 2 puzzles with FEN positions
4. Clear teacher tips
5. Practice chessercises

Output the complete lesson in markdown format.`;

  // Stub guard: return mock lesson when no API key
  const mock = anthropicMockGuard();
  if (mock) {
    const mockContent = `# Sample Lesson: ${params.chessConceptKey}\n\nThis is a demo lesson. Set ANTHROPIC_API_KEY in your .env to enable real AI generation.\n\n## Story\nOnce upon a time in the land of learning...\n\n## Lesson\nToday we learn about ${params.chessConceptKey}.\n\n## Teacher Tips\n- Encourage exploration\n- Be patient with learners`;
    return {
      title: `Sample Lesson: ${params.chessConceptKey}`,
      rawContent: mockContent,
      sections: {
        story: 'Once upon a time in the land of learning...',
        chessLesson: `Today we learn about ${params.chessConceptKey}.`,
        teacherTips: '- Encourage exploration\n- Be patient with learners',
      },
    };
  }

  const response = await anthropic.messages.create({
    model: config.generationModel,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawContent = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract title and sections
  const title = extractTitle(rawContent) || `${params.chessConceptKey} Lesson`;
  const sections = extractSections(rawContent, template);
  const sourceAttributions = extractAttributions(rawContent);

  return {
    title,
    rawContent,
    sections,
    sourceAttributions: sourceAttributions.length > 0 ? sourceAttributions : undefined,
  };
}

export async function iterateLesson(
  currentContent: string,
  userRequest: string,
  params: GenerationParams
): Promise<GeneratedContent> {
  const prompt = getIterationPrompt(currentContent, userRequest, params.ageBand);

  // Stub guard: return mock iteration when no API key
  const iterMock = anthropicMockGuard();
  if (iterMock) {
    return {
      title: extractTitle(currentContent) || 'Untitled Lesson',
      rawContent: currentContent + '\n\n<!-- Iteration requires ANTHROPIC_API_KEY -->',
      sections: {},
    };
  }

  const response = await anthropic.messages.create({
    model: config.generationModel,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawContent = response.content[0].type === 'text' ? response.content[0].text : '';

  // Get default template for this age band (extractFormatTemplate returns default when no lessons passed)
  const template = await extractFormatTemplate([], params.ageBand);

  const title = extractTitle(rawContent) || extractTitle(currentContent) || 'Untitled Lesson';
  const sections = extractSections(rawContent, template);
  const sourceAttributions = extractAttributions(rawContent);

  return {
    title,
    rawContent,
    sections,
    sourceAttributions: sourceAttributions.length > 0 ? sourceAttributions : undefined,
  };
}

function extractTitle(content: string): string | null {
  // Look for # Title or **Title** at the start
  const titleMatch = content.match(/^#\s*(.+?)(?:\n|$)/m);
  if (titleMatch) return titleMatch[1].replace(/\*\*/g, '').trim();

  const boldTitleMatch = content.match(/^\*\*(.+?)\*\*/m);
  if (boldTitleMatch) return boldTitleMatch[1].trim();

  return null;
}

// Maps template section names to GeneratedSections field names
const SECTION_FIELD_MAP: Record<string, keyof GeneratedSections> = {
  // 3-7 format
  'STORY': 'story',
  'CHESS LESSON': 'chessLesson',
  'TEACHER TIPS': 'teacherTips',
  'CHESSERCISES': 'chessercises',
  // 8-9 format
  'THE QUEST': 'story',
  'CHESS TACTICS': 'chessLesson',
  'CHALLENGE PUZZLES': 'chessercises',
  // 10-12 format
  'THE MISSION': 'story',
  'CHESS CONCEPTS': 'chessLesson',
  'TEACHER NOTES': 'teacherTips',
  'PRACTICE PUZZLES': 'chessercises',
};

function extractSections(content: string, template: FormatTemplate): GeneratedSections {
  const sections: GeneratedSections = {};

  // Build list of all markers for "next section" lookahead
  const allMarkers = Object.values(template.sectionMarkers)
    .map(m => escapeRegex(m))
    .join('|');

  // Extract each section using template markers
  for (const [sectionName, marker] of Object.entries(template.sectionMarkers)) {
    const fieldName = SECTION_FIELD_MAP[sectionName];
    if (!fieldName || fieldName === 'puzzles') continue;

    const escapedMarker = escapeRegex(marker);
    const regex = new RegExp(
      `${escapedMarker}([\\s\\S]*?)(?=${allMarkers}|\\*\\*PUZZLE|$)`,
      'i'
    );
    const match = content.match(regex);
    if (match && match[1].trim()) {
      sections[fieldName] = match[1].trim();
    }
  }

  // Extract puzzles separately
  sections.puzzles = extractPuzzles(content);

  return sections;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractPuzzles(content: string): GeneratedPuzzle[] {
  const puzzles: GeneratedPuzzle[] = [];

  // Match puzzle blocks
  const puzzleRegex = /\*\*PUZZLE\s*#?\d*\*\*([\s\S]*?)(?=\*\*PUZZLE\s*#?\d*\*\*|\*\*(?:EXERCISE|CHESSERCISE)|$)/gi;
  const matches = content.matchAll(puzzleRegex);

  for (const match of matches) {
    const puzzleContent = match[1];

    // Extract FEN
    const fenMatch = puzzleContent.match(/\*?FEN:\s*([^\s*]+)/i);
    const fen = fenMatch ? fenMatch[1].trim() : '';

    // Extract answer
    const answerMatch = puzzleContent.match(/\*\*Answer:\*\*\s*([\s\S]*?)(?=\n\n|\*\*|$)/i);
    const answer = answerMatch ? answerMatch[1].trim() : '';

    // Extract narrative (everything between FEN and Answer)
    let narrative = puzzleContent;
    if (fenMatch) {
      narrative = narrative.replace(fenMatch[0], '');
    }
    if (answerMatch) {
      narrative = narrative.replace(answerMatch[0], '');
    }
    narrative = narrative.replace(/\*Set up.*diagram.*\*/gi, '').trim();

    // Extract hint if present
    const hintMatch = puzzleContent.match(/\*?Hint:\s*([\s\S]*?)(?=\n\n|\*\*|$)/i);
    const hint = hintMatch ? hintMatch[1].trim() : undefined;

    if (fen || answer || narrative) {
      puzzles.push({ fen, narrative, answer, hint });
    }
  }

  return puzzles;
}

/**
 * Extract source attributions from generated content.
 * Looks for patterns like:
 * - **[FACT: source]**
 * - **[INSPIRED BY: source]**
 * - **[INVENTED]**
 */
function extractAttributions(content: string): SourceAttribution[] {
  const attributions: SourceAttribution[] = [];

  // Match attribution tags
  const attributionRegex = /([^*\n]{10,100}?)\s*\*\*\[(FACT|INSPIRED BY|INVENTED)(?::\s*([^\]]+))?\]\*\*/gi;
  const matches = content.matchAll(attributionRegex);

  for (const match of matches) {
    const contentText = match[1].trim();
    const typeRaw = match[2].toUpperCase();
    const source = match[3]?.trim() || null;

    // Map to our AttributionType
    let type: AttributionType;
    if (typeRaw === 'FACT') {
      type = 'FACT';
    } else if (typeRaw === 'INSPIRED BY') {
      type = 'INSPIRED_BY';
    } else {
      type = 'INVENTED';
    }

    // Determine confidence based on type and source presence
    let confidence: 'high' | 'medium' | 'low';
    if (type === 'INVENTED') {
      confidence = 'high'; // High confidence it's invented
    } else if (source && source.length > 5) {
      confidence = 'high'; // Has a specific source
    } else if (source) {
      confidence = 'medium'; // Has some source info
    } else {
      confidence = 'low'; // No source provided
    }

    attributions.push({
      content: contentText,
      type,
      source,
      confidence,
    });
  }

  return attributions;
}
