import anthropic from '../../lib/anthropic.js';
import { prisma } from '../../lib/prisma.js';

export interface PromptAnalysisResult {
  characters: Array<{ name: string; isChesslandia: boolean }>;
  warnings: string[];
  questions: string[];
  suggestedPrompt?: string;
}

/**
 * Analyze an art prompt before generation — identify characters,
 * flag non-Chesslandia entities, and generate clarifying questions.
 */
export async function analyzeArtPrompt(prompt: string): Promise<PromptAnalysisResult> {
  // Load character roster from DB
  const characters = await prisma.character.findMany({
    select: { name: true, piece: true, trait: true },
    orderBy: { name: 'asc' },
  });

  const characterList = characters
    .map(c => {
      const parts = [c.name];
      if (c.piece) parts.push(`(${c.piece})`);
      if (c.trait) parts.push(`— ${c.trait}`);
      return parts.join(' ');
    })
    .join('\n');

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are analyzing an art prompt for Acme Creative — a children's chess education brand set in CHESSLANDIA, a whimsical fantasy chess kingdom.

CHESSLANDIA CHARACTER ROSTER (these are the ONLY characters that exist):
${characterList}

RULES:
- Every character in Chesslandia is a cartoon animal or anthropomorphized chess piece — NEVER realistic humans
- If the prompt mentions or implies people/children/students/audience/crowd/friends, those are NOT Chesslandia characters
- Characters should be referred to by their proper Chesslandia name

PROMPT TO ANALYZE:
"${prompt}"

Analyze this prompt and return ONLY valid JSON (no markdown, no backticks):
{
  "characters": [{"name": "character name", "isChesslandia": true/false}],
  "warnings": ["warning strings about non-Chesslandia characters or issues"],
  "questions": ["clarifying question strings"],
  "suggestedPrompt": "optional improved prompt if changes needed, or null"
}

Rules for your analysis:
- List ALL characters mentioned or implied in the prompt
- Mark isChesslandia=true only for exact matches from the roster above
- If the prompt implies unnamed characters (e.g. "children watching", "a group", "students"), add them with isChesslandia=false and add a warning
- Only add questions if there are actual issues (non-Chesslandia characters, ambiguous scene, etc.)
- If no issues found, return empty warnings and questions arrays
- suggestedPrompt should replace non-Chesslandia characters with specific named characters from the roster, or null if no changes needed`,
      },
    ],
  });

  // Parse the response
  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const parsed = JSON.parse(text.trim());
    return {
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      suggestedPrompt: parsed.suggestedPrompt || undefined,
    };
  } catch {
    console.error('[AnalyzePrompt] Failed to parse Claude response:', text);
    // Return empty result on parse failure — don't block generation
    return { characters: [], warnings: [], questions: [] };
  }
}
