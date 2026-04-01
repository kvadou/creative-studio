export interface Citation {
  text: string;
  moduleCode: string;
  lessonNumber: number;
  section: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  confidence?: string;
  queryId?: string;
  agenticMode?: boolean;
  region?: string;
  culturalSources?: string[];
}

export type ProjectRole = 'OWNER' | 'EDITOR';

export interface ProjectMember {
  userId: string;
  email: string;
  role: ProjectRole;
  invitedAt: string | null;
  isOriginalOwner?: boolean;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  instructions?: string | null;
  conversationCount: number;
  role: ProjectRole;      // Current user's role in this project
  isOwner: boolean;       // Whether current user is owner
  memberCount: number;    // Total members including owner
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithMembers extends Project {
  members: ProjectMember[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
  messageCount: number;
  lastMessage?: {
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  projectId: string | null;
  project?: {
    id: string;
    name: string;
    instructions?: string | null;
  } | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  content: string;
  createdAt: string;
}

// Curriculum — Modules & Lessons (for tagging)
export interface LessonSummary {
  id: string;
  lessonNumber: number;
  title: string;
}

export interface ModuleWithLessons {
  id: string;
  code: string;
  title: string;
  ageGroup: string | null;
  term: string | null;
  sequence: number;
  lessons: LessonSummary[];
}

export interface StudioStats {
  lessons: number;
  chunks: number;
  characters: number;
  illustrations: number;
  modules: number;
  videos: number;
  voices: number;
  scripts: number;
}

export type StudioTab = 'home' | 'curriculum' | 'images' | 'video' | 'audio' | 'episodes' | 'admin';

export interface LessonCharacterRef {
  id: string;
  name: string;
  piece: string | null;
}

export interface LessonWithCounts extends LessonSummary {
  chessConceptKey: string | null;
  characters: LessonCharacterRef[];
  _count: {
    illustrations: number;
    videos: number;
  };
}

export interface ModuleWithLessonCounts {
  id: string;
  code: string;
  title: string;
  ageGroup: string | null;
  term: string | null;
  sequence: number;
  lessons: LessonWithCounts[];
}

export interface LessonTag {
  id: string;
  lessonNumber: number;
  title: string;
  module: {
    code: string;
    title: string;
  };
}

// Illustrations Module
export type IllustrationStatus = 'UPLOADING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
export type ArtType = 'CARTOON' | 'CHARACTER' | 'VIDEO' | 'ORIGINAL' | 'BACKGROUND';

export interface Illustration {
  id: string;
  name: string;
  description: string | null;
  artType: ArtType;
  sourcePhotoUrl: string | null;
  sourcePhotoKey: string | null;
  illustrationUrl: string | null;
  illustrationKey: string | null;
  status: IllustrationStatus;
  replicateId: string | null;
  geminiRequestId: string | null;
  errorMessage: string | null;
  createdByEmail: string;
  isOriginal: boolean;
  isGoldStandard?: boolean;
  goldStandardType?: string | null;
  isReferenceEnabled?: boolean;
  storyTitle?: string | null;
  pictureNumber?: number | null;
  // AI description & review
  aiDescription?: string | null;
  reviewStatus?: string | null;  // 'described' | 'reviewed' | 'trained'
  // Character link
  characterId?: string | null;
  character?: { id: string; name: string } | null;
  characterTags?: { character: { id: string; name: string } }[];
  // Curriculum link
  lessonId?: string | null;
  lesson?: LessonTag | null;
  // Video fields (artType: VIDEO)
  sourceIllustrationId?: string;
  sourceIllustration?: Illustration;
  duration?: number;
  aspectRatio?: string;
  videoUrl?: string;
  videoKey?: string;
  thumbnailUrl?: string;
  thumbnailKey?: string;
  generations?: IllustrationGeneration[];
  createdAt: string;
  updatedAt: string;
}

export interface GenerationReview {
  description: string;
  characters: Array<{ name: string; isChesslandia: boolean; notes: string }>;
  styleCompliance: { score: number; notes: string };
  promptAlignment: { matched: string[]; missed: string[]; unexpected: string[] };
}

export interface PipelineLog {
  styleBible: string;
  autoSearchQuery?: string;
  autoSearchResults?: Array<{ id: string; name: string; similarity: number; illustrationUrl?: string | null }>;
  manualReferenceIds?: string[];
  refsLoaded: number;
  refsAttempted: number;
  generationResponse?: string;
  review?: GenerationReview;
}

export interface IllustrationGeneration {
  id: string;
  illustrationId: string;
  provider: string;
  replicateId: string | null;
  inputPhotoUrl: string | null;
  outputImageUrl: string | null;
  savedImageUrl: string | null;
  savedImageKey: string | null;
  prompt: string | null;
  modelVersion: string | null;
  resolution: number | null;
  referenceIds: string[] | null;
  pipelineLog?: PipelineLog | null;
  selected: boolean;
  createdAt: string;
}

export interface PromptAnalysis {
  characters: Array<{ name: string; isChesslandia: boolean }>;
  warnings: string[];
  questions: string[];
  suggestedPrompt?: string;
}

// ============================================
// Audio Module — Character Voices
// ============================================

export type AudioLineStatus = 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';

export interface CharacterVoice {
  id: string;
  name: string;
  description: string;
  voiceId: string | null;
  sampleUrl: string | null;
  sampleKey: string | null;
  character: string | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  _count?: { scripts: number; lines: number };
}

export interface VoicePreview {
  id: string;
  voiceDescription: string;
  generatedVoiceId: string;
  audioUrl: string | null;
  audioKey: string | null;
  durationSecs: number | null;
  createdByEmail: string;
  createdAt: string;
}

export interface AudioScript {
  id: string;
  name: string;
  characterVoiceId: string;
  characterVoice?: CharacterVoice;
  lessonId: string | null;
  lesson?: LessonTag | null;
  stitchedUrl: string | null;
  stitchedKey: string | null;
  stitchedDurationSecs: number | null;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
  lines?: AudioLine[];
}

export interface AudioScriptSummary {
  id: string;
  name: string;
  characterVoiceId: string;
  characterVoice: { id: string; name: string; character: string | null };
  lessonId: string | null;
  lesson: LessonTag | null;
  stitchedUrl: string | null;
  stitchedDurationSecs: number | null;
  lineStats: { total: number; completed: number };
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface AudioLine {
  id: string;
  scriptId: string;
  characterVoiceId: string;
  text: string;
  emotion: string;
  sequence: number;
  status: AudioLineStatus;
  audioUrl: string | null;
  durationSecs: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceDesignResponse {
  previews: VoicePreview[];
  text: string;
}

export interface CharacterVoicesResponse {
  voices: CharacterVoice[];
  total: number;
}

export interface IllustrationMessage {
  id: string;
  illustrationId: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    prompt?: string;
    loraScale?: number;
    guidanceScale?: number;
  } | null;
  createdAt: string;
}

export interface IllustrationChatResponse {
  response: string;
  generation?: {
    prompt: string;
    loraScale: number;
    guidanceScale: number;
  };
}

export interface IllustrationsResponse {
  illustrations: Illustration[];
  total: number;
  page: number;
  limit: number;
}

// Video Module
export interface VideosResponse {
  videos: Illustration[];
  total: number;
  page: number;
  limit: number;
}

// Characters
export interface CharacterSummary {
  id: string;
  name: string;
  piece: string | null;
  trait: string | null;
  movementNote: string | null;
  firstAppearance: string | null;
  lessonCount: number;
  illustrationCount: number;
  voiceCount: number;
  thumbnailUrl: string | null;
  avatarPosition: string | null;
  goldStandardCount?: number;
  hasTpose?: boolean;
}

export interface CharacterLesson {
  id: string;
  title: string;
  lessonNumber: number;
  chessConceptKey: string | null;
  module: { code: string; title: string; sequence: number };
  storyExcerpt: string | null;
}

export interface CharacterVoiceRef {
  id: string;
  name: string;
  description: string;
  voiceId: string | null;
  sampleUrl: string | null;
  createdAt?: string;
}

export interface CharacterPhotoRef {
  id: string;
  name: string;
  illustrationUrl: string | null;
  sourcePhotoUrl: string | null;
}

export interface CharacterDetail extends CharacterSummary {
  bio: string | null;
  avatarIllustrationId: string | null;
  avatarIllustration: CharacterPhotoRef | null;
  avatarPosition: string | null;
  coverIllustrationId: string | null;
  coverIllustration: CharacterPhotoRef | null;
  coverPosition: string | null;
  profileIllustrationId: string | null;
  profileIllustration: CharacterPhotoRef | null;
  profilePosition: string | null;
  lessons: CharacterLesson[];
  illustrations: Illustration[];
  voices: CharacterVoiceRef[];
  videos: Illustration[];
}

// Chunks & Embeddings
export interface ChunkSummary {
  id: string;
  chunkType: string;
  sectionTitle: string | null;
  contentPreview: string;
  tokenCount: number;
  hasEmbedding: boolean;
  sequence: number;
  lesson: {
    id: string;
    title: string;
    lessonNumber: number;
    module: { code: string; title: string };
  };
}

export interface ChunkDetail extends ChunkSummary {
  content: string;
  contentHash: string;
  createdAt: string;
}

export interface SimilarChunk extends ChunkSummary {
  similarity: number;
}

export interface ChunkStats {
  total: number;
  withEmbeddings: number;
  byType: { type: string; count: number }[];
  avgTokenCount: number;
}

// Activity Feed
export interface ActivityEvent {
  id: string;
  type: 'illustration' | 'video' | 'audio' | 'lesson';
  action: string;
  title: string;
  characterName: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
}

// Daily Content Suggestions
export type SuggestionStatus = 'SUGGESTED' | 'USED' | 'SKIPPED';

export interface DailySuggestion {
  id: string;
  date: string;
  sequence: number;
  title: string;
  occasion: string | null;
  persona: string;
  caption: string;
  captionTikTok: string | null;
  captionLinkedIn: string | null;
  hashtags: string[];
  brief: string;
  targetAudience: string | null;
  altPersona: string | null;
  altCaption: string | null;
  recommendedPlatforms: string[];
  matchedAssetIds: string[];
  generationPrompts: { prompt: string; character: string; style: string }[] | null;
  chessNewsHeadline: string | null;
  chessNewsTieIn: string | null;
  characterNames: string[];
  status: SuggestionStatus;
  usedAt: string | null;
  usedByEmail: string | null;
  skipReason: string | null;
  createdAt: string;
}

export interface GenerateArtRequest {
  prompt: string;
  engine: 'gemini' | 'flux';
  referenceImageIds?: string[];
}

export interface GenerateArtResponse {
  illustrationId: string;
  predictionId?: string;
  engine: 'gemini' | 'flux';
  status: string;
}

// User Management
export type UserRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface StudioUser {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: UserRole;
  lastLoginAt: string | null;
  createdAt: string;
}

// Chess News
export interface ChessNewsItem {
  id: string;
  source: 'LICHESS' | 'CHESSCOM' | 'FIDE';
  title: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  category: string | null;
  characterTieIn: string | null;
  publishedAt: string;
}
