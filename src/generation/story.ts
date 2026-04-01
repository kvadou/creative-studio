import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { config } from '../lib/config.js';
import { prisma } from '../lib/prisma.js';
import { anthropicMockGuard } from '../lib/anthropic.js';

const hasKey = !!process.env.ANTHROPIC_API_KEY;
const anthropic = hasKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : (null as unknown as Anthropic);

export interface StoryGenerationParams {
  subject: string;           // What the story is about (from user query)
  ageGroup?: '3-7' | '8-12'; // Target age group
  context?: string;          // Additional context from RAG retrieval
}

export interface GeneratedStory {
  story: string;
  title: string;
  charactersUsed: string[];
  conceptsTaught: string[];
  ageGroup: string;
}

/**
 * Get the system prompt for story generation
 */
function getStorySystemPrompt(ageGroup: '3-7' | '8-12' = '3-7'): string {
  const toneGuidance = ageGroup === '3-7'
    ? `
TONE & STYLE (for ages 3-7):
- Use simple, playful language with short sentences
- Include lots of action and sound effects (whoosh!, click-clack!)
- Make characters very expressive and animated
- Keep paragraphs short (2-3 sentences max)
- Include opportunities for interaction ("Can you help King Chomper count?")
- Use repetition for key concepts
- Keep the story under 500 words`
    : `
TONE & STYLE (for ages 8-12):
- Use more sophisticated vocabulary and longer sentences
- Include adventure elements and mild tension
- Characters can face and overcome challenges
- Include strategic thinking and problem-solving moments
- Can reference real chess concepts with proper names
- Keep the story under 800 words`;

  return `You are a Acme Creative story writer, creating engaging narratives that teach chess concepts to children.

${toneGuidance}

CANONICAL CHARACTERS (use these when appropriate):
- King Chomper: The White King, brave and kind, loves to eat (captures by "chomping")
- King Shaky: The Black King, nervous but learns courage
- Queen Bella: The White Queen, powerful and graceful, moves in all directions
- Clip & Clop: The White Knights, twin horses who "gallop-gallop, 1-2-3 turn!"
- Bea & Bop: The White Bishops, move diagonally like the letter X
- Percy, Petra, Paul, Patty, Penny, Pete, Portia, Pip: The White Pawns
- Ricky & Rocky: The White Rooks, strong towers that guard the castle

MNEMONICS (incorporate when teaching concepts):
- Knight movement: "Gallop-gallop, 1-2-3 turn!"
- Bishop movement: "X marks the spot!"
- Check: "CPR - Capture, Protect, Run!"
- Castling: "1-2-3 LOCKED!"
- Pawn capture: "Pawn capture with a claw" (diagonal capture)

STORY REQUIREMENTS:
1. Create an original story that incorporates the requested topic
2. Characters should stay true to their canonical personalities
3. Chess concepts should be woven naturally into the narrative
4. Include at least one moment where a concept is demonstrated through action
5. End with a positive resolution and a subtle lesson recap
6. Do NOT include puzzles or exercises - this is pure storytelling

OUTPUT FORMAT:
Start with a title on its own line prefixed with "# "
Then write the story in paragraphs.
At the end, include a brief "---" separator followed by:
- Characters: (list characters used)
- Concepts: (list chess concepts taught)`;
}

/**
 * Generate a story based on the user's request
 */
export async function generateStory(params: StoryGenerationParams): Promise<GeneratedStory> {
  const ageGroup = params.ageGroup || '3-7';
  const systemPrompt = getStorySystemPrompt(ageGroup);

  // Build the user prompt
  let userPrompt = `Write a Acme Creative story about: ${params.subject}`;

  if (params.context) {
    userPrompt += `\n\nRELEVANT CURRICULUM CONTEXT (use for accuracy):\n${params.context}`;
  }

  userPrompt += `\n\nCreate an engaging, original story that teaches the relevant chess concepts while entertaining ${ageGroup === '3-7' ? 'young children (ages 3-7)' : 'older children (ages 8-12)'}.`;

  // Stub guard: return mock story when no API key
  const mock = anthropicMockGuard();
  if (mock) {
    return {
      story: 'Once upon a time in the creative studio, a team of characters set out on an adventure to learn something new. This story requires an Anthropic API key to generate. Set ANTHROPIC_API_KEY in your .env.',
      title: `A Story About ${params.subject}`,
      charactersUsed: ['Demo Character'],
      conceptsTaught: [params.subject],
      ageGroup,
    };
  }

  const response = await anthropic.messages.create({
    model: config.generationModel,
    max_tokens: 2500, // Longer for narrative content
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const rawContent = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract title
  const titleMatch = rawContent.match(/^#\s*(.+?)(?:\n|$)/m);
  const title = titleMatch ? titleMatch[1].trim() : `A Story About ${params.subject}`;

  // Extract story (everything before the metadata separator)
  const storyMatch = rawContent.match(/^([\s\S]*?)(?:---|\n\nCharacters:)/m);
  const story = storyMatch
    ? storyMatch[1].replace(/^#\s*.+?\n/, '').trim()
    : rawContent.replace(/^#\s*.+?\n/, '').trim();

  // Extract characters used
  const charactersMatch = rawContent.match(/Characters:\s*(.+?)(?:\n|$)/i);
  const charactersUsed = charactersMatch
    ? charactersMatch[1].split(/[,;]/).map(c => c.trim()).filter(Boolean)
    : extractCharactersFromStory(story);

  // Extract concepts taught
  const conceptsMatch = rawContent.match(/Concepts:\s*(.+?)(?:\n|$)/i);
  const conceptsTaught = conceptsMatch
    ? conceptsMatch[1].split(/[,;]/).map(c => c.trim()).filter(Boolean)
    : extractConceptsFromStory(story);

  return {
    story,
    title,
    charactersUsed,
    conceptsTaught,
    ageGroup: ageGroup === '3-7' ? '3-7 years' : '8-12 years',
  };
}

/**
 * Fallback: Extract character names from story content
 */
function extractCharactersFromStory(story: string): string[] {
  const characterPatterns = [
    /King Chomper/gi,
    /King Shaky/gi,
    /Queen Bella/gi,
    /Clip/gi,
    /Clop/gi,
    /Bea/gi,
    /Bop/gi,
    /Ricky/gi,
    /Rocky/gi,
    /Percy|Petra|Paul|Patty|Penny|Pete|Portia|Pip/gi,
  ];

  const found = new Set<string>();
  for (const pattern of characterPatterns) {
    const matches = story.match(pattern);
    if (matches) {
      for (const match of matches) {
        found.add(match);
      }
    }
  }

  return Array.from(found);
}

/**
 * Fallback: Extract chess concepts from story content
 */
function extractConceptsFromStory(story: string): string[] {
  const conceptPatterns: { pattern: RegExp; concept: string }[] = [
    { pattern: /gallop.*gallop|1-2-3 turn/gi, concept: 'knight movement' },
    { pattern: /X marks the spot|diagonal/gi, concept: 'bishop movement' },
    { pattern: /CPR|capture.*protect.*run/gi, concept: 'responding to check' },
    { pattern: /1-2-3 LOCKED|castl(e|ing)/gi, concept: 'castling' },
    { pattern: /pawn capture|claw/gi, concept: 'pawn capture' },
    { pattern: /check/gi, concept: 'check' },
    { pattern: /checkmate/gi, concept: 'checkmate' },
    { pattern: /fork/gi, concept: 'fork' },
    { pattern: /pin/gi, concept: 'pin' },
    { pattern: /skewer/gi, concept: 'skewer' },
  ];

  const found = new Set<string>();
  for (const { pattern, concept } of conceptPatterns) {
    if (pattern.test(story)) {
      found.add(concept);
    }
  }

  return Array.from(found);
}

/**
 * Get relevant context from the curriculum for story generation
 */
export async function getStoryContext(subject: string): Promise<string | null> {
  // Search for relevant chunks in the curriculum
  // This is a simplified version - uses keyword matching
  // A more sophisticated version would use embeddings

  const keywords = subject.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (keywords.length === 0) {
    return null;
  }

  // Search for lessons that mention the subject
  const queryMode: Prisma.QueryMode = 'insensitive';
  const lessons = await prisma.lesson.findMany({
    where: {
      OR: [
        { title: { contains: keywords[0], mode: queryMode } },
        { rawContent: { contains: keywords[0], mode: queryMode } },
        ...(keywords[1] ? [{ rawContent: { contains: keywords[1], mode: queryMode } }] : []),
      ],
    },
    take: 2,
    include: {
      module: {
        select: { code: true },
      },
    },
  });

  if (lessons.length === 0) {
    return null;
  }

  // Extract relevant snippets
  const context = lessons
    .map(lesson => {
      const snippet = lesson.rawContent.slice(0, 1500);
      return `From ${lesson.module.code} - "${lesson.title}":\n${snippet}`;
    })
    .join('\n\n---\n\n');

  return context;
}
