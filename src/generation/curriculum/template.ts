import type { AgeBand, FormatTemplate } from '../../types/index.js';
import type { Lesson, Module } from '@prisma/client';

type LessonWithModule = Lesson & { module: Module };

// Default templates by age band
const DEFAULT_TEMPLATES: Record<AgeBand, FormatTemplate> = {
  THREE_TO_SEVEN: {
    sectionOrder: [
      'KEY CHESS LEARNING OUTCOMES',
      'STORY BIG IDEAS',
      'TEACHER TIPS',
      'INTRODUCTION',
      'STORY',
      'CHESS LESSON',
      'CHESSERCISES',
    ],
    sectionMarkers: {
      'KEY CHESS LEARNING OUTCOMES': '| KEY CHESS LEARNING OUTCOMES:',
      'STORY BIG IDEAS': '| STORY BIG IDEAS:',
      'TEACHER TIPS': '| TEACHER TIPS:',
      INTRODUCTION: '| INTRODUCTION:',
      STORY: '**STORY:**',
      'CHESS LESSON': '**CHESS LESSON**',
      CHESSERCISES: '**CHESSERCISES**',
      'INTERACTIVE MOMENT': '**INTERACTIVE MOMENT**',
    },
    typicalLengths: {
      STORY: { min: 500, max: 2000 },
      'CHESS LESSON': { min: 200, max: 800 },
      'TEACHER TIPS': { min: 100, max: 400 },
      CHESSERCISES: { min: 200, max: 600 },
    },
    characterPatterns: [
      'King Chomper',
      'King Shaky',
      'Queen Bella',
      'Bea',
      'Bop',
      'Clip',
      'Clop',
      'Chef Squishyfeet',
    ],
    mnemonicPatterns: [
      'gallop-gallop-step to the side',
      'CPR - Capture, Protect, Run',
      '1-2-3 LOCKED',
      'Look, Think, Move',
    ],
    puzzleFormat: `**PUZZLE #N**
*FEN: [position]*
*Set up the board according to the diagram.*

[Narrative question in character voice]

**Answer:** [Move notation] - [Explanation using character names]`,
  },
  EIGHT_TO_NINE: {
    sectionOrder: [
      'LEARNING OBJECTIVES',
      'ADVENTURE HOOK',
      'TEACHER TIPS',
      'THE QUEST',
      'CHESS TACTICS',
      'CHALLENGE PUZZLES',
    ],
    sectionMarkers: {
      'LEARNING OBJECTIVES': '## Learning Objectives',
      'ADVENTURE HOOK': '## Adventure Hook',
      'TEACHER TIPS': '## Teacher Tips',
      'THE QUEST': '**THE QUEST:**',
      'CHESS TACTICS': '**CHESS TACTICS**',
      'CHALLENGE PUZZLES': '**CHALLENGE PUZZLES**',
    },
    typicalLengths: {
      'THE QUEST': { min: 300, max: 800 },
      'CHESS TACTICS': { min: 300, max: 900 },
      'TEACHER TIPS': { min: 100, max: 400 },
      'CHALLENGE PUZZLES': { min: 300, max: 700 },
    },
    characterPatterns: [
      'King Chomper',
      'King Shaky',
      'Queen Bella',
      'Clip',
      'Clop',
      'Bea',
      'Bop',
    ],
    mnemonicPatterns: [
      'CPR - Capture, Protect, Run',
      'Look, Think, Move',
      'gallop-gallop-step to the side',
    ],
    puzzleFormat: `**PUZZLE #N**
*FEN: [position]*
*Your turn to move.*

[Adventure-themed challenge description]

**Answer:** [Move notation]
**Explanation:** [Why this move works in story context]`,
  },
  TEN_TO_TWELVE: {
    sectionOrder: [
      'LEARNING OBJECTIVES',
      'STRATEGIC CONCEPTS',
      'TEACHER NOTES',
      'THE MISSION',
      'CHESS CONCEPTS',
      'PRACTICE PUZZLES',
    ],
    sectionMarkers: {
      'LEARNING OBJECTIVES': '## Learning Objectives',
      'STRATEGIC CONCEPTS': '## Strategic Concepts',
      'TEACHER NOTES': '## Teacher Notes',
      'THE MISSION': '**THE MISSION:**',
      'CHESS CONCEPTS': '**CHESS CONCEPTS**',
      'PRACTICE PUZZLES': '**PRACTICE PUZZLES**',
    },
    typicalLengths: {
      'THE MISSION': { min: 200, max: 600 },
      'CHESS CONCEPTS': { min: 400, max: 1200 },
      'TEACHER NOTES': { min: 150, max: 500 },
      'PRACTICE PUZZLES': { min: 300, max: 800 },
    },
    characterPatterns: ['King Chomper', 'King Shaky', 'Clip', 'Clop'],
    mnemonicPatterns: ['CPR - Capture, Protect, Run', 'Look, Think, Move'],
    puzzleFormat: `**PUZZLE #N**
*FEN: [position]*
*White to move.*

[Brief tactical setup]

**Answer:** [Move notation]
**Why it works:** [Strategic explanation]`,
  },
};

export async function extractFormatTemplate(
  lessons: LessonWithModule[],
  ageBand: AgeBand
): Promise<FormatTemplate> {
  // Start with default template
  const template = { ...DEFAULT_TEMPLATES[ageBand] };

  if (lessons.length === 0) {
    return template;
  }

  // Analyze actual lessons to refine template
  const sectionCounts: Record<string, number> = {};
  const sectionLengths: Record<string, number[]> = {};

  for (const lesson of lessons) {
    const content = lesson.rawContent;

    // Count section occurrences
    for (const [name, marker] of Object.entries(template.sectionMarkers)) {
      if (content.includes(marker) || content.toLowerCase().includes(name.toLowerCase())) {
        sectionCounts[name] = (sectionCounts[name] || 0) + 1;

        // Estimate section length
        const regex = new RegExp(
          `${escapeRegex(marker)}([\\s\\S]*?)(?=${Object.values(template.sectionMarkers)
            .map(escapeRegex)
            .join('|')}|$)`,
          'i'
        );
        const match = content.match(regex);
        if (match) {
          if (!sectionLengths[name]) sectionLengths[name] = [];
          sectionLengths[name].push(match[1].length);
        }
      }
    }
  }

  // Update typical lengths based on actual data
  for (const [name, lengths] of Object.entries(sectionLengths)) {
    if (lengths.length > 0) {
      const sorted = lengths.sort((a, b) => a - b);
      template.typicalLengths[name] = {
        min: Math.floor(sorted[0] * 0.8),
        max: Math.ceil(sorted[sorted.length - 1] * 1.2),
      };
    }
  }

  // Detect character usage in lessons
  const foundCharacters = new Set<string>();
  for (const lesson of lessons) {
    for (const char of template.characterPatterns) {
      if (lesson.rawContent.includes(char)) {
        foundCharacters.add(char);
      }
    }
  }
  if (foundCharacters.size > 0) {
    template.characterPatterns = Array.from(foundCharacters);
  }

  return template;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
