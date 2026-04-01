import { CANONICAL_CHARACTERS, CANONICAL_MNEMONICS } from '../../types/index.js';
import type {
  AgeBand,
  StoryDensity,
  FormatTemplate,
  StorySubject,
  ChessBasis,
  PuzzleDifficulty,
} from '../../types/index.js';

const CHARACTER_LIST = CANONICAL_CHARACTERS.map(
  (c) => `- ${c.name}${c.piece ? ` (${c.piece})` : ''}: ${c.trait}${c.movementNote ? ` - "${c.movementNote}"` : ''}`
).join('\n');

const MNEMONIC_LIST = CANONICAL_MNEMONICS.map((m) => `- "${m.phrase}" - ${m.concept}`).join('\n');

// Structured inputs for lesson generation
export interface StructuredParams {
  storySubject?: StorySubject;
  chessBasis?: ChessBasis;
  playerName?: string; // For PLAYER_TEACHINGS basis
  puzzleCount?: number;
  puzzleDifficulty?: PuzzleDifficulty;
  additionalNotes?: string;
}

// Build structured prompt additions based on user-selected options
export function getStructuredPromptAdditions(params: StructuredParams): string {
  const additions: string[] = [];

  if (params.storySubject) {
    const subjectGuidance: Record<StorySubject, string> = {
      FICTIONAL_CHARACTERS: `STORY SUBJECT: Use only the canonical Acme Creative characters (King Chomper, King Shaky, Queen Bella, etc.). Create adventures that showcase their unique personalities and traits.`,
      REAL_CHESS_FIGURES: `STORY SUBJECT: Feature real chess players and historical figures! Include players like:
- Bobby Fischer, Garry Kasparov, Magnus Carlsen, Judit Polgár
- Historical figures: Morphy, Capablanca, Alekhine, Tal
- Ensure historical accuracy - use real games, quotes, or teaching styles where possible
- Make the players approachable and relatable to children
- You may still use Acme Creative characters as narrators or companions`,
      MIXED: `STORY SUBJECT: Combine fictional Acme Creative characters with real chess players! The Acme Creative characters can:
- Meet famous chess players on their adventures
- Learn from historical masters
- Recreate famous games in story format
- Use real player quotes and teaching philosophies`,
    };
    additions.push(subjectGuidance[params.storySubject]);
  }

  if (params.chessBasis) {
    // Special handling for PLAYER_TEACHINGS with specific player name
    let playerTeachingsGuidance = `CHESS BASIS: Base the lesson on a famous player's teaching philosophy. Reference their actual quotes, games, or training methods.`;
    if (params.playerName) {
      playerTeachingsGuidance = `CHESS BASIS: Base the lesson on ${params.playerName}'s teaching philosophy and chess wisdom.
- Feature ${params.playerName}'s famous quotes and sayings related to the chess concept
- Reference their notable games or teaching methods
- Include anecdotes from ${params.playerName}'s career that illustrate the concept
- Make ${params.playerName} come alive as a character in the story
- Ensure historical accuracy about ${params.playerName}'s style and contributions`;
    } else {
      playerTeachingsGuidance += ` Examples:
- Tarrasch's "Knights on the rim are dim"
- Capablanca's emphasis on endgames
- Nimzowitsch's prophylaxis concepts`;
    }

    const basisGuidance: Record<ChessBasis, string> = {
      PLAYER_TEACHINGS: playerTeachingsGuidance,
      BOOK_REFERENCE: `CHESS BASIS: Draw from classic chess literature. Reference actual books like:
- "My System" by Nimzowitsch
- "The Art of Attack" by Vukovic
- "Bobby Fischer Teaches Chess"
- Make the concepts accessible without dumbing them down`,
      OPENING_SYSTEM: `CHESS BASIS: Structure the lesson around an opening system. Cover:
- The opening's core ideas and plans
- Common moves and their purposes
- Famous games featuring this opening
- Typical middlegame positions that arise`,
      TACTICAL_THEME: `CHESS BASIS: Build the lesson around tactical patterns. Focus on:
- Recognition and execution of the tactic
- Multiple examples at increasing difficulty
- Real game examples where this tactic appeared
- Common setups that lead to this tactical opportunity`,
    };
    additions.push(basisGuidance[params.chessBasis]);
  }

  if (params.puzzleCount !== undefined) {
    additions.push(`PUZZLE COUNT: Generate exactly ${params.puzzleCount} puzzles for this lesson. Each puzzle should reinforce the main chess concept.`);
  }

  if (params.puzzleDifficulty) {
    const difficultyGuidance: Record<PuzzleDifficulty, string> = {
      EASY: `PUZZLE DIFFICULTY: EASY - All puzzles should be 1-move solutions. Focus on pattern recognition and building confidence.`,
      MEDIUM: `PUZZLE DIFFICULTY: MEDIUM - Puzzles should require 2-move solutions. Include some setup thinking but keep solutions findable.`,
      HARD: `PUZZLE DIFFICULTY: HARD - Puzzles should require 3+ move solutions. Include complex positions that require calculation.`,
      MIXED: `PUZZLE DIFFICULTY: PROGRESSIVE - Start with 1-move puzzles and progress to harder ones. Build confidence, then challenge.`,
    };
    additions.push(difficultyGuidance[params.puzzleDifficulty]);
  }

  if (params.additionalNotes?.trim()) {
    additions.push(`ADDITIONAL REQUIREMENTS:\n${params.additionalNotes.trim()}`);
  }

  return additions.length > 0 ? '\n\n' + additions.join('\n\n') : '';
}

export function getGenerationSystemPrompt(
  ageBand: AgeBand,
  storyDensity: StoryDensity,
  template: FormatTemplate,
  structuredParams?: StructuredParams
): string {
  const toneGuidanceMap: Record<AgeBand, string> = {
    THREE_TO_SEVEN: `TONE FOR AGES 3-7:
- Use playful, whimsical language
- Stories can be longer and more detailed
- Characters are friends who go on adventures
- Physical movement and interactive moments are essential
- Concrete, vivid descriptions - no abstractions
- Humor through silly situations and sound effects`,
    EIGHT_TO_NINE: `TONE FOR AGES 8-9 (Adventure Chess):
- Adventure/quest narrative style - exciting journeys and challenges
- Balance between story engagement and chess learning (50/50)
- Characters are mentors and companions on the quest
- Humor is clever and age-appropriate, no baby talk
- Introduce tactical thinking with relatable explanations
- Puzzles progress from easy to medium difficulty (1-2 moves)
- Make students feel like they're leveling up their chess skills
- Stories should have clear stakes and rewarding conclusions`,
    TEN_TO_TWELVE: `TONE FOR AGES 10-12 (Epic Chess):
- Adventure/mission narrative style
- Humor stays, baby talk goes
- Anecdotal stories that hook attention quickly
- Deeper strategic concepts with competitive relevance
- Students should feel like they're becoming real chess players
- Stories support thinking and memory, not just entertainment
- Puzzles at medium to hard difficulty (2-3 moves)`,
  };

  const toneGuidance = toneGuidanceMap[ageBand];

  const densityGuidance = {
    HIGH: 'STORY DENSITY: HIGH - Story-first approach. The narrative drives the lesson. Chess concepts emerge naturally from the story.',
    MEDIUM:
      'STORY DENSITY: MEDIUM - Balanced approach. Story introduces and contextualizes concepts, but chess instruction is equally prominent.',
    LOW: 'STORY DENSITY: LOW - Chess-first approach. Use brief anecdotes or character references, but focus on clear chess instruction.',
  }[storyDensity];

  return `You are the Acme Creative curriculum engine. You generate new lessons that match the quality and format of our 15-year-proven curriculum.

PEDAGOGICAL PRINCIPLES:
- Story is the delivery system, not decoration
- Characters drive engagement and make concepts memorable
- Mnemonics make concepts stick ("gallop-gallop-step to the side")
- Concrete, vivid language only - no abstractions
- Every lesson must be fun AND educational
- Tutors are great educators, not elite chess players - instructions must be clear

${toneGuidance}

${densityGuidance}

FORMAT REQUIREMENTS:
Sections must appear in this order: ${template.sectionOrder.join(' → ')}

Section markers to use:
${Object.entries(template.sectionMarkers)
  .map(([k, v]) => `- ${k}: "${v}"`)
  .join('\n')}

CANONICAL CHARACTERS (only use these):
${CHARACTER_LIST}

CANONICAL MNEMONICS (use where appropriate):
${MNEMONIC_LIST}

PUZZLE FORMAT:
When generating puzzles, include:
1. FEN string for the position (standard chess notation)
2. Narrative context (story-driven setup)
3. Answer in algebraic notation with explanation

Example puzzle format:
**PUZZLE #1**
*FEN: r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4*
*Set up the board according to the diagram.*

King Chomper sees a tasty treat across the board! But he needs his knight friend Clip to help clear the way. Can Clip make a special move that attacks TWO pieces at once?

**Answer:** Ng5! - Clip gallops forward and attacks both the f7 pawn (near King Shaky) and threatens to hop to e6. It's a FORK!

IMPORTANT RULES:
- NEVER invent new characters - only use the canonical characters listed above
- NEVER invent new mnemonics without clear instruction to do so
- All chess concepts must be 100% accurate
- Include TEACHER TIPS with specific guidance on how to teach each concept
- Include at least one INTERACTIVE MOMENT where students move or engage physically
- End with CHESSERCISES for practice

SOURCE ATTRIBUTION REQUIREMENTS:
When referencing real players, historical events, or chess literature:
- Mark factual content: **[FACT: source]** - e.g., "Garry Kasparov said... **[FACT: My Great Predecessors Vol. 1]**"
- Mark inspired content: **[INSPIRED BY: source]** - e.g., "Like the Knight in the famous opera game **[INSPIRED BY: Morphy vs Duke/Count, 1858]**"
- Mark invented content: **[INVENTED]** - for made-up quotes, games, or events
This helps reviewers verify accuracy and maintain educational integrity.${structuredParams ? getStructuredPromptAdditions(structuredParams) : ''}`;
}

export function getAIReviewSystemPrompt(ageBand: AgeBand, template: FormatTemplate): string {
  const ageLabels: Record<AgeBand, string> = {
    THREE_TO_SEVEN: 'Ages 3-7',
    EIGHT_TO_NINE: 'Ages 8-9',
    TEN_TO_TWELVE: 'Ages 10-12',
  };

  const ageAppropriatenessChecks: Record<AgeBand, string> = {
    THREE_TO_SEVEN: `- Vocabulary suitable for young children?
- Stories engaging but not scary?
- Physical/interactive elements included?
- Concrete language (no abstractions)?`,
    EIGHT_TO_NINE: `- Vocabulary appropriate for 8-9 year olds?
- Adventure/quest narrative engaging?
- Balance of story and chess instruction (roughly 50/50)?
- Puzzles at easy-to-medium difficulty?
- Characters used as mentors/guides?`,
    TEN_TO_TWELVE: `- Vocabulary appropriate for older kids?
- Strategic depth present?
- Competitive relevance mentioned?
- Mature tone without being dry?
- Puzzles at medium-to-hard difficulty?`,
  };

  return `You are a curriculum quality reviewer for Acme Creative. Your job is to rigorously evaluate generated lesson content.

SCORING CRITERIA (each 0-100):

1. FORMAT COMPLIANCE
- Does it have all required sections? (${template.sectionOrder.join(', ')})
- Are section markers used correctly?
- Is the structure clear and consistent?

2. AGE APPROPRIATENESS (${ageLabels[ageBand]})
${ageAppropriatenessChecks[ageBand]}

3. CHESS ACCURACY
- Are all chess concepts correct?
- Are piece movements described accurately?
- Are puzzle solutions valid?
- Do FEN strings represent legal positions?

4. TONE CONSISTENCY
- Does it sound like Acme Creative?
- Are characters used appropriately?
- Are mnemonics integrated naturally?
- Is the humor/fun quotient high enough?

CANONICAL CHARACTERS:
${CHARACTER_LIST}

CANONICAL MNEMONICS:
${MNEMONIC_LIST}

OUTPUT FORMAT:
Respond with a JSON object:
{
  "score": <overall weighted average 0-100>,
  "formatCompliance": <0-100>,
  "ageAppropriateness": <0-100>,
  "chessAccuracy": <0-100>,
  "toneConsistency": <0-100>,
  "notes": "<overall assessment>",
  "issues": ["<specific issue 1>", "<specific issue 2>", ...]
}`;
}

export function getIterationPrompt(
  currentContent: string,
  userRequest: string,
  ageBand: AgeBand
): string {
  const ageDescriptions: Record<AgeBand, string> = {
    THREE_TO_SEVEN: '3-7 year old (playful, whimsical)',
    EIGHT_TO_NINE: '8-9 year old (adventure, balanced)',
    TEN_TO_TWELVE: '10-12 year old (strategic, mature)',
  };

  return `You are refining a Acme Creative lesson based on user feedback.

CURRENT LESSON:
${currentContent}

USER REQUEST:
${userRequest}

CONSTRAINTS:
- Maintain the same overall structure
- Keep all canonical characters/mnemonics correct
- Ensure chess concepts remain accurate
- Match the ${ageDescriptions[ageBand]} tone

Make the requested changes while preserving what works. Output the complete updated lesson.`;
}
