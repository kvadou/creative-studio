import type { ChunkType } from '@prisma/client';

export interface ParsedLesson {
  moduleCode: string;
  lessonNumber: number;
  title: string;
  chessConceptKey?: string;
  sections: ParsedSection[];
  rawContent: string;
  filePath: string;
}

export interface ParsedSection {
  type: ChunkType;
  title?: string;
  content: string;
  sequence: number;
}

export interface ChunkWithScore {
  id: string;
  lessonId: string;
  chunkType: ChunkType;
  sectionTitle: string | null;
  content: string;
  tokenCount: number;
  sequence: number;
  similarity?: number;
  keywordScore?: number;
  fusionScore?: number;
  // Joined data
  moduleCode?: string;
  lessonNumber?: number;
  lessonTitle?: string;
}

export interface Citation {
  text: string;
  moduleCode: string;
  lessonNumber: number;
  section: string;
}

export interface GroundedResponse {
  answer: string;
  citations: Citation[];
  confidence: 'high' | 'medium' | 'low' | 'no_answer';
  rawChunks: ChunkWithScore[];
}

export interface ChatRequest {
  query: string;
  conversationId?: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
  confidence: string;
  queryId: string;
}

export interface IngestionResult {
  filesProcessed: number;
  chunksCreated: number;
  embeddingsCreated: number;
  errors: Array<{ file: string; error: string }>;
  duration: number;
}

// Canonical data
export const CANONICAL_CHARACTERS = [
  { name: 'King Chomper', piece: 'White King', trait: 'Loves food', movementNote: 'One slow step any direction' },
  { name: 'King Shaky', piece: 'Black King', trait: 'Scared of everything', movementNote: 'One scared step any direction' },
  { name: 'Queen Bella', piece: 'White Queen', trait: 'Chief Friendship Officer', movementNote: 'Moves like rook + bishop' },
  { name: 'Queen Allegra', piece: 'Black Queen', trait: 'Chief Friendship Officer', movementNote: 'Moves like rook + bishop' },
  { name: 'Bea', piece: 'White Bishop', trait: 'Diagonal dancer', movementNote: 'Stays on favorite color diagonally' },
  { name: 'Bop', piece: 'White Bishop', trait: 'Diagonal dancer', movementNote: 'Stays on favorite color diagonally' },
  { name: 'Clip', piece: 'White Knight', trait: 'Dancing horse', movementNote: 'Gallop-gallop-step to the side' },
  { name: 'Clop', piece: 'White Knight', trait: 'Dancing horse', movementNote: 'Gallop-gallop-step to the side' },
  { name: 'Chef Squishyfeet', piece: null, trait: 'King Chomper trusted chef', movementNote: null },
  { name: 'Earl the Squirrel', piece: null, trait: 'Wise forest friend', movementNote: null },
  { name: 'Casanova', piece: null, trait: 'Mystery character', movementNote: null },
  { name: 'Paulie Pickle', piece: null, trait: 'Has a pudding blaster', movementNote: null },
] as const;

export const CANONICAL_MNEMONICS = [
  { phrase: 'gallop-gallop-step to the side', concept: 'knight movement' },
  { phrase: 'tap your nose, 1-2-3, then shake hands diagonally', concept: 'pawn capture' },
  { phrase: 'CPR - Capture, Protect, Run', concept: 'getting out of check' },
  { phrase: 'Look, Think, Move!', concept: 'decision making' },
  { phrase: 'Thinking Cup', concept: 'focus technique' },
  { phrase: '1-2-3 LOCKED!', concept: 'pawn lock (opposing pawns face-to-face)' },
  { phrase: 'Good game!', concept: 'sportsmanship handshake' },
] as const;

// Cultural adaptation types
export interface CulturalGuideline {
  category: string;
  guidance: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
}

export interface CulturalRestriction {
  type: string;
  description: string;
  severity: 'strict' | 'moderate' | 'advisory';
}

export interface CulturalAdaptation {
  original: string;
  adapted: string;
  reason: string;
}

export interface CulturalProfileData {
  region: string;
  displayName: string;
  guidelines: CulturalGuideline[];
  restrictions: CulturalRestriction[];
  adaptations: CulturalAdaptation[];
  sources: string[];
  notes?: string;
}

// Curriculum generation types
export type AgeBand = 'THREE_TO_SEVEN' | 'EIGHT_TO_NINE' | 'TEN_TO_TWELVE';
export type StoryDensity = 'HIGH' | 'MEDIUM' | 'LOW';
export type GenerationStatus = 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'REJECTED';

// Structured input types (Phase 2)
export type StorySubject = 'FICTIONAL_CHARACTERS' | 'REAL_CHESS_FIGURES' | 'MIXED';
export type ChessBasis = 'PLAYER_TEACHINGS' | 'BOOK_REFERENCE' | 'OPENING_SYSTEM' | 'TACTICAL_THEME';
export type PuzzleDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';

export interface GenerationParams {
  ageBand: AgeBand;
  chessConceptKey: string;
  storyDensity: StoryDensity;
  // Structured inputs (Phase 2)
  storySubject?: StorySubject;
  chessBasis?: ChessBasis;
  playerName?: string; // For PLAYER_TEACHINGS basis - specific player to feature
  puzzleCount?: number;
  puzzleDifficulty?: PuzzleDifficulty;
  additionalNotes?: string;
  // Legacy
  customInstructions?: string;
}

export interface GeneratedPuzzle {
  fen: string;
  narrative: string;
  answer: string;
  hint?: string;
}

// Source attribution types (Phase 4)
export type AttributionType = 'FACT' | 'INSPIRED_BY' | 'INVENTED';

export interface SourceAttribution {
  content: string;       // The attributed content/quote
  type: AttributionType; // FACT, INSPIRED_BY, or INVENTED
  source: string | null; // The source reference (null for INVENTED)
  confidence: 'high' | 'medium' | 'low'; // How confident the AI is about accuracy
}

export interface GeneratedSections {
  story?: string;
  chessLesson?: string;
  teacherTips?: string;
  chessercises?: string;
  puzzles?: GeneratedPuzzle[];
}

export interface GeneratedContent {
  title: string;
  rawContent: string;
  sections: GeneratedSections;
  sourceAttributions?: SourceAttribution[];
}

export interface AIReview {
  score: number;
  formatCompliance: number;
  ageAppropriateness: number;
  chessAccuracy: number;
  toneConsistency: number;
  notes: string;
  issues: string[];
}

export interface ValidationChecklist {
  storyPresent: boolean | null;
  teacherTipsPresent: boolean | null;
  chessercisesPresent: boolean | null;
  ageAppropriate: boolean | null;
  chessAccurate: boolean | null;
  mnemonicsCorrect: boolean | null;
}

export interface GenerationResponse {
  id: string;
  lesson: GeneratedContent;
  validation: {
    aiReview: AIReview | null;
    comparison: {
      lessonId: string;
      moduleCode: string;
      lessonNumber: number;
      title: string;
      rawContent: string;
    } | null;
    checklist: ValidationChecklist;
  };
}

export interface FormatTemplate {
  sectionOrder: string[];
  sectionMarkers: Record<string, string>;
  typicalLengths: Record<string, { min: number; max: number }>;
  characterPatterns: string[];
  mnemonicPatterns: string[];
  puzzleFormat: string;
}
