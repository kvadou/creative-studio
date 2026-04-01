import { readFileSync } from 'fs';
import path from 'path';
import type { ChunkType } from '@prisma/client';
import type { ParsedLesson, ParsedSection } from '../types/index.js';

// Module code extraction: module-1 -> 1, module-1b -> 1B, module-2b -> 2B, etc.
const MODULE_PATTERN = /module-(\d+)(b)?/i;

// Lesson number extraction from filename
const LESSON_NUMBER_PATTERNS = [
  /lesson-(\d+)/i,                    // lesson-01-kings.md
  /^(\d+)\s*[\.\(]/,                  // 1. Title.md or 1 (M1B...
  /L(\d+)\)/,                         // (M1B T1&3 L1)
];

// Section detection patterns
const SECTION_MARKERS: Array<{ pattern: RegExp; type: ChunkType }> = [
  { pattern: /\|\s*KEY CHESS LEARNING OUTCOMES:/i, type: 'LESSON_OVERVIEW' },
  { pattern: /\|\s*STORY BIG IDEAS:/i, type: 'LESSON_OVERVIEW' },
  { pattern: /\|\s*TEACHER TIPS?:/i, type: 'TEACHER_TIPS' },
  { pattern: /\|\s*INTRODUCTION:/i, type: 'LESSON_OVERVIEW' },
  { pattern: /\*\*STORY[:\s–-]/i, type: 'STORY' },
  { pattern: /\*\*CHESS LESSON/i, type: 'CHESS_LESSON' },
  { pattern: /\*\*EXERCISE\s*#?\d+/i, type: 'CHESS_LESSON' },
  { pattern: /\*\*PUZZLE\s*#?\d+/i, type: 'CHESS_LESSON' },
  { pattern: /\*\*INTERACTIVE MOMENT\*\*/i, type: 'INTERACTIVE_MOMENT' },
  { pattern: /CHESSERCISES?/i, type: 'CHESSERCISE' },
  { pattern: /DEVELOPMENTAL SKILLS/i, type: 'DEVELOPMENTAL' },
  { pattern: /SUPPLEMENTARY MATERIAL/i, type: 'CHESS_LESSON' },
  { pattern: /END OF LESSON TAKEAWAYS/i, type: 'LESSON_OVERVIEW' },
];

// Mnemonic detection patterns
const MNEMONIC_PATTERNS = [
  /gallop[,\s-]+gallop[,\s-]+step to the side/i,
  /tap your nose[,\s]+1-2-3[,\s]+then shake hands diagonally/i,
  /CPR\s*[-–]\s*Capture[,\s]+Protect[,\s]+Run/i,
  /Look[,\s]+Think[,\s]+Move/i,
  /Thinking Cup/i,
  /1-2-3 LOCKED/i,
  /Good game!/i,
];

export function parseModuleCode(dirPath: string): string {
  const dirName = path.basename(dirPath).toLowerCase();
  const match = dirName.match(MODULE_PATTERN);
  if (match) {
    const num = match[1];
    const suffix = match[2] ? 'B' : '';
    return `${num}${suffix}`;
  }
  return 'UNKNOWN';
}

// Strip YAML frontmatter from markdown content, return { content, frontmatter }
export function stripFrontmatter(raw: string): { content: string; frontmatter: Record<string, string> } {
  const fm: Record<string, string> = {};
  if (!raw.startsWith('---')) return { content: raw, frontmatter: fm };

  const endIdx = raw.indexOf('---', 3);
  if (endIdx === -1) return { content: raw, frontmatter: fm };

  const fmBlock = raw.slice(3, endIdx).trim();
  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      fm[key] = val;
    }
  }

  return { content: raw.slice(endIdx + 3).trim(), frontmatter: fm };
}

export function parseLessonNumber(filename: string): number {
  for (const pattern of LESSON_NUMBER_PATTERNS) {
    const match = filename.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  return 0;
}

export function parseLessonTitle(content: string, filename: string): string {
  // Try to extract from markdown headers
  // # **The Kings** or # Module 1A: Lesson 1 \n # **Title**
  const titleMatch = content.match(/^#\s*\*\*(.+?)\*\*/m);
  if (titleMatch) {
    return titleMatch[1].trim();
  }

  // Extract from filename
  // lesson-01-kings.md -> Kings
  // 1. The Great Chess Train Adventure _ Piece Mechanics Review.md -> The Great Chess Train Adventure
  const fnMatch = filename.match(/lesson-\d+-(.+)\.md/i);
  if (fnMatch) {
    return fnMatch[1]
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const numTitleMatch = filename.match(/^\d+\.\s*(.+?)(?:\s*_|\.md)/);
  if (numTitleMatch) {
    return numTitleMatch[1].trim();
  }

  return 'Unknown Lesson';
}

export function parseChessConcept(content: string, filename: string): string | undefined {
  // Extract from filename if present after underscore
  // 4. Chesslandia Beach Day (Part 1) _ Check + CPR.md -> check-cpr
  const fnMatch = filename.match(/_\s*(.+?)\.md$/i);
  if (fnMatch) {
    return fnMatch[1]
      .toLowerCase()
      .replace(/[+&]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  // Try to extract from KEY CHESS LEARNING OUTCOMES
  const outcomeMatch = content.match(/KEY CHESS LEARNING OUTCOMES:([^|]+)/i);
  if (outcomeMatch) {
    // Extract first concept mentioned
    const text = outcomeMatch[1].toLowerCase();
    if (text.includes('king')) return 'king-movement';
    if (text.includes('rook')) return 'rook-movement';
    if (text.includes('bishop')) return 'bishop-movement';
    if (text.includes('queen')) return 'queen-movement';
    if (text.includes('knight')) return 'knight-movement';
    if (text.includes('pawn')) return 'pawn-movement';
    if (text.includes('check')) return 'check';
    if (text.includes('checkmate')) return 'checkmate';
    if (text.includes('castle') || text.includes('castling')) return 'castling';
  }

  return undefined;
}

export function parseSections(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const lines = content.split('\n');

  let currentSection: ParsedSection | null = null;
  let currentContent: string[] = [];
  let sequence = 0;

  function finalizeSection() {
    if (currentSection && currentContent.length > 0) {
      currentSection.content = currentContent.join('\n').trim();
      if (currentSection.content.length > 50) {
        // Only keep substantial sections
        sections.push(currentSection);
      }
    }
    currentContent = [];
  }

  for (const line of lines) {
    // Check if this line starts a new section
    let newSectionType: ChunkType | null = null;
    let sectionTitle: string | undefined;

    for (const marker of SECTION_MARKERS) {
      if (marker.pattern.test(line)) {
        newSectionType = marker.type;
        // Extract title from the line
        const titleMatch = line.match(/\*\*(.+?)\*\*/);
        sectionTitle = titleMatch ? titleMatch[1] : undefined;
        break;
      }
    }

    if (newSectionType) {
      finalizeSection();
      currentSection = {
        type: newSectionType,
        title: sectionTitle,
        content: '',
        sequence: sequence++,
      };
      currentContent.push(line);
    } else if (currentSection) {
      currentContent.push(line);
    } else {
      // Content before first section marker - treat as overview
      if (line.trim()) {
        if (!currentSection) {
          currentSection = {
            type: 'LESSON_OVERVIEW',
            title: 'Header',
            content: '',
            sequence: sequence++,
          };
        }
        currentContent.push(line);
      }
    }
  }

  // Finalize last section
  finalizeSection();

  // If no sections found, create a single STORY section with all content
  if (sections.length === 0) {
    sections.push({
      type: 'STORY',
      title: 'Full Lesson',
      content: content.trim(),
      sequence: 0,
    });
  }

  return sections;
}

export function detectMnemonics(content: string): string[] {
  const found: string[] = [];
  for (const pattern of MNEMONIC_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      found.push(match[0]);
    }
  }
  return found;
}

export function parseLesson(filePath: string): ParsedLesson {
  const raw = readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);
  const dirPath = path.dirname(filePath);

  // Strip YAML frontmatter if present
  const { content, frontmatter } = stripFrontmatter(raw);

  const moduleCode = parseModuleCode(dirPath);
  // Prefer frontmatter values, fall back to filename parsing
  const lessonNumber = frontmatter.lesson_number
    ? parseInt(frontmatter.lesson_number, 10)
    : parseLessonNumber(filename);
  const title = frontmatter.title || parseLessonTitle(content, filename);
  const chessConceptKey = parseChessConcept(content, filename);
  const sections = parseSections(content);

  return {
    moduleCode,
    lessonNumber,
    title,
    chessConceptKey,
    sections,
    rawContent: content,
    filePath,
  };
}

export function isLessonFile(filename: string): boolean {
  // Skip _module.md and other non-lesson files
  if (filename.startsWith('_')) return false;
  if (!filename.endsWith('.md')) return false;
  return true;
}
