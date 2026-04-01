import type { Project, ProjectMember, ProjectRole, ConversationSummary, Conversation, SearchResult, Illustration, IllustrationGeneration, IllustrationsResponse, IllustrationMessage, IllustrationChatResponse, ArtType, VideosResponse, ModuleWithLessons, ModuleWithLessonCounts, StudioUser, UserRole, CharacterVoice, VoicePreview, AudioScript, AudioLine, VoiceDesignResponse, CharacterVoicesResponse, AudioLineStatus, AudioScriptSummary, StudioStats, CharacterSummary, CharacterDetail, ChunkSummary, ChunkDetail, ChunkStats, SimilarChunk, ActivityEvent, DailySuggestion, GenerateArtRequest, GenerateArtResponse, ChessNewsItem, PromptAnalysis } from './types';

const API_BASE = '/api';

export interface ChatResponse {
  answer: string;
  citations: Array<{
    text: string;
    moduleCode: string;
    lessonNumber: number;
    section: string;
  }>;
  confidence: string;
  queryId: string;
  conversationId?: string;
  agenticMode?: boolean;
  region?: string;
  culturalSources?: string[];
  storyMode?: boolean;
  storyMetadata?: {
    charactersUsed: string[];
    conceptsTaught: string[];
  };
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  database: string;
  stats: {
    modules: number;
    lessons: number;
    chunks: number;
  };
}

// Chat API
export async function chatApi(
  query: string,
  conversationId?: string,
  projectId?: string,
  storyMode?: boolean
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, conversationId, projectId, storyMode }),
  });

  if (!response.ok) {
    throw new Error('Failed to get response');
  }

  return response.json();
}

export async function feedbackApi(queryId: string, score: number): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/${queryId}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ score }),
  });

  if (!response.ok) {
    throw new Error('Failed to submit feedback');
  }
}

export async function healthApi(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE}/health`);

  if (!response.ok) {
    throw new Error('Health check failed');
  }

  return response.json();
}

// ============================================
// Conversations API
// ============================================

export async function getConversations(params?: {
  limit?: number;
  cursor?: string;
  projectId?: string | null;
}): Promise<{ conversations: ConversationSummary[]; nextCursor: string | null }> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.cursor) searchParams.set('cursor', params.cursor);
  if (params?.projectId !== undefined) {
    searchParams.set('projectId', params.projectId === null ? 'null' : params.projectId);
  }

  const url = `${API_BASE}/conversations${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch conversations');
  }

  return response.json();
}

export async function getConversation(id: string): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch conversation');
  }

  return response.json();
}

export async function createConversation(data: {
  title?: string;
  projectId?: string;
}): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to create conversation');
  }

  return response.json();
}

export async function updateConversation(
  id: string,
  data: { title?: string; projectId?: string | null }
): Promise<Conversation> {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update conversation');
  }

  return response.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete conversation');
  }
}

export async function searchConversations(q: string): Promise<SearchResult[]> {
  const response = await fetch(`${API_BASE}/conversations/search?q=${encodeURIComponent(q)}`);

  if (!response.ok) {
    throw new Error('Failed to search conversations');
  }

  const data = await response.json();
  return data.results;
}

// ============================================
// Projects API
// ============================================

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/projects`);

  if (!response.ok) {
    throw new Error('Failed to fetch projects');
  }

  const data = await response.json();
  return data.projects;
}

export async function createProject(name: string, color?: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create project');
  }

  return response.json();
}

export async function updateProject(
  id: string,
  data: { name?: string; color?: string | null; instructions?: string | null }
): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update project');
  }

  return response.json();
}

export async function deleteProject(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete project');
  }
}

export async function getProject(id: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/projects/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch project');
  }

  return response.json();
}

// ============================================
// Project Members API
// ============================================

export async function getProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/members`);

  if (!response.ok) {
    throw new Error('Failed to fetch project members');
  }

  const data = await response.json();
  return data.members;
}

export async function inviteToProject(
  projectId: string,
  email: string,
  role: ProjectRole = 'EDITOR'
): Promise<ProjectMember> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to invite member');
  }

  return response.json();
}

export async function removeFromProject(projectId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/projects/${projectId}/members/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to remove member');
  }
}

// ============================================
// Curriculum Generation API
// ============================================

export type AgeBand = 'THREE_TO_SEVEN' | 'EIGHT_TO_NINE' | 'TEN_TO_TWELVE';
export type StoryDensity = 'HIGH' | 'MEDIUM' | 'LOW';

// Structured input types (Phase 2)
export type StorySubject = 'FICTIONAL_CHARACTERS' | 'REAL_CHESS_FIGURES' | 'MIXED';
export type ChessBasis = 'PLAYER_TEACHINGS' | 'BOOK_REFERENCE' | 'OPENING_SYSTEM' | 'TACTICAL_THEME';
export type PuzzleDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';

// Job processing states + workflow states
export type GenerationStatus =
  | 'QUEUED'     // Job created, waiting to process
  | 'GENERATING' // AI is generating the lesson
  | 'REVIEWING'  // AI review in progress
  | 'FAILED'     // Generation failed
  | 'DRAFT'      // Ready for human review
  | 'REVIEWED'
  | 'APPROVED'
  | 'REJECTED';

// Response from POST /generate/lesson (202 Accepted)
export interface GenerationJobResponse {
  id: string;
  status: 'QUEUED';
  message: string;
}

// Response from GET /generate/lesson/:id/status
export interface LessonStatusResponse {
  id: string;
  status: GenerationStatus;
  errorMessage: string | null;
  title: string | null;
  aiReviewScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedPuzzle {
  fen: string;
  narrative: string;
  answer: string;
  hint?: string;
}

export interface GeneratedSections {
  story?: string;
  chessLesson?: string;
  teacherTips?: string;
  chessercises?: string;
  puzzles?: GeneratedPuzzle[];
}

// Source attribution types (Phase 4)
export type AttributionType = 'FACT' | 'INSPIRED_BY' | 'INVENTED';

export interface SourceAttribution {
  content: string;
  type: AttributionType;
  source: string | null;
  confidence: 'high' | 'medium' | 'low';
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

export interface GeneratedLessonSummary {
  id: string;
  title: string;
  ageBand: AgeBand;
  chessConceptKey: string;
  storyDensity: StoryDensity;
  status: GenerationStatus;
  aiReviewScore: number | null;
  createdByEmail: string;
  createdAt: string;
}

export async function getChessConcepts(): Promise<string[]> {
  const response = await fetch(`${API_BASE}/generate/concepts`);
  if (!response.ok) {
    throw new Error('Failed to fetch concepts');
  }
  const data = await response.json();
  return data.concepts;
}

// Queues a lesson for generation (returns immediately with job ID)
export async function queueLessonGeneration(params: {
  ageBand: AgeBand;
  chessConceptKey: string;
  storyDensity: StoryDensity;
  // Structured inputs (Phase 2)
  storySubject?: StorySubject;
  chessBasis?: ChessBasis;
  puzzleCount?: number;
  puzzleDifficulty?: PuzzleDifficulty;
  additionalNotes?: string;
  // Reference data based on chessBasis
  playerName?: string;
  playerProfile?: PlayerProfile;
  bookId?: string;
  bookTitle?: string;
  openingEco?: string;
  openingName?: string;
  tacticalThemeId?: string;
  tacticalThemeName?: string;
  // Legacy
  customInstructions?: string;
}): Promise<GenerationJobResponse> {
  const response = await fetch(`${API_BASE}/generate/lesson`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to queue lesson generation');
  }

  return response.json();
}

// Poll for lesson generation status
export async function getLessonStatus(id: string): Promise<LessonStatusResponse> {
  const response = await fetch(`${API_BASE}/generate/lesson/${id}/status`);
  if (!response.ok) {
    throw new Error('Failed to get lesson status');
  }
  return response.json();
}

export async function getGeneratedLesson(id: string): Promise<GenerationResponse> {
  const response = await fetch(`${API_BASE}/generate/lesson/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch lesson');
  }
  return response.json();
}

export async function iterateLesson(id: string, prompt: string): Promise<{ success: boolean; lesson: GeneratedContent }> {
  const response = await fetch(`${API_BASE}/generate/lesson/${id}/iterate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error('Failed to iterate lesson');
  }

  return response.json();
}

export async function rerunAIReview(id: string): Promise<{ success: boolean; aiReview: AIReview }> {
  const response = await fetch(`${API_BASE}/generate/lesson/${id}/review`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Failed to run review');
  }

  return response.json();
}

export async function updateChecklist(id: string, checklist: ValidationChecklist): Promise<void> {
  const response = await fetch(`${API_BASE}/generate/lesson/${id}/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(checklist),
  });

  if (!response.ok) {
    throw new Error('Failed to update checklist');
  }
}

export async function approveLesson(id: string, approved: boolean): Promise<void> {
  const response = await fetch(`${API_BASE}/generate/lesson/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved }),
  });

  if (!response.ok) {
    throw new Error('Failed to approve/reject lesson');
  }
}

export async function getGeneratedLessons(params?: {
  status?: GenerationStatus;
  concept?: string;
  limit?: number;
  offset?: number;
}): Promise<{ lessons: GeneratedLessonSummary[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.concept) searchParams.set('concept', params.concept);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const url = `${API_BASE}/generate/lessons${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch lessons');
  }

  return response.json();
}

// ============================================
// Batch Generation API
// ============================================

export type BatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PARTIALLY_COMPLETED';

export interface ProgressionItem {
  lessonNum: number;
  concept: string;
  description?: string;
}

export interface BatchJobResponse {
  id: string;
  status: 'PENDING';
  message: string;
  lessonCount: number;
}

export interface BatchStatusResponse {
  id: string;
  name: string;
  status: BatchStatus;
  lessonCount: number;
  currentLesson: number;
  completedLessons: number;
  failedLessons: number;
  errorMessage: string | null;
  updatedAt: string;
}

export interface BatchLessonSummary {
  id: string;
  title: string | null;
  chessConceptKey: string;
  status: GenerationStatus;
  aiReviewScore: number | null;
  batchSequence: number;
  createdAt: string;
  updatedAt: string;
}

export interface BatchResponse {
  id: string;
  name: string;
  ageBand: AgeBand;
  storyDensity: StoryDensity;
  lessonCount: number;
  progression: ProgressionItem[];
  status: BatchStatus;
  currentLesson: number;
  completedLessons: number;
  failedLessons: number;
  errorMessage: string | null;
  lessons: BatchLessonSummary[];
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface BatchSummary {
  id: string;
  name: string;
  ageBand: AgeBand;
  storyDensity: StoryDensity;
  lessonCount: number;
  status: BatchStatus;
  completedLessons: number;
  failedLessons: number;
  createdByEmail: string;
  createdAt: string;
  updatedAt: string;
}

// Queue a batch for generation (returns immediately with batch ID)
export async function queueBatchGeneration(params: {
  name: string;
  ageBand: AgeBand;
  storyDensity: StoryDensity;
  progression: ProgressionItem[];
}): Promise<BatchJobResponse> {
  const response = await fetch(`${API_BASE}/generate/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to queue batch generation');
  }

  return response.json();
}

// Poll for batch generation status
export async function getBatchStatus(id: string): Promise<BatchStatusResponse> {
  const response = await fetch(`${API_BASE}/generate/batch/${id}/status`);
  if (!response.ok) {
    throw new Error('Failed to get batch status');
  }
  return response.json();
}

// Get full batch details including lessons
export async function getBatch(id: string): Promise<BatchResponse> {
  const response = await fetch(`${API_BASE}/generate/batch/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch batch');
  }
  return response.json();
}

// List all batches
export async function getBatches(params?: {
  status?: BatchStatus;
  limit?: number;
  offset?: number;
}): Promise<{ batches: BatchSummary[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.offset) searchParams.set('offset', params.offset.toString());

  const url = `${API_BASE}/generate/batch${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch batches');
  }

  return response.json();
}

// ============================================
// Reference Data API (Players, Books, Openings, Tactics)
// ============================================

export interface FamousPlayer {
  id: string;
  name: string;
  title: string | null;
  country: string;
  worldChampion: boolean;
}

// Legacy alias for compatibility
export type LichessPlayer = FamousPlayer;

export interface PlayerProfile {
  id: string;
  username: string;
  title: string | null;
  name: string;
  fullName?: string;
  country: string | null;
  bio: string | null;
  fideRating: number | null;
  worldChampion?: boolean;
  years?: string;
  style?: string;
  teachingFocus?: string[];
  ratings: {
    blitz: number | null;
    rapid: number | null;
    classical: number | null;
  };
}

export interface ChessBook {
  id: string;
  title: string;
  author: string;
  year: number;
  concepts: string[];
  description: string;
}

export interface TacticalTheme {
  id: string;
  name: string;
  description: string;
  examples: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface ChessOpening {
  eco: string;
  name: string;
  moves: string;
  description: string;
}

// Search Lichess players
export async function searchPlayers(term: string): Promise<LichessPlayer[]> {
  if (term.length < 2) return [];

  const response = await fetch(`${API_BASE}/reference/players?term=${encodeURIComponent(term)}`);
  if (!response.ok) return [];
  return response.json();
}

// Get full player profile
export async function getPlayerProfile(username: string): Promise<PlayerProfile | null> {
  const response = await fetch(`${API_BASE}/reference/players/${encodeURIComponent(username)}`);
  if (!response.ok) return null;
  return response.json();
}

// Get chess books
export async function getChessBooks(search?: string): Promise<ChessBook[]> {
  const url = search
    ? `${API_BASE}/reference/books?search=${encodeURIComponent(search)}`
    : `${API_BASE}/reference/books`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

// Get tactical themes
export async function getTacticalThemes(): Promise<TacticalTheme[]> {
  const response = await fetch(`${API_BASE}/reference/tactics`);
  if (!response.ok) return [];
  return response.json();
}

// Get chess openings
export async function getOpenings(search?: string, eco?: string): Promise<ChessOpening[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (eco) params.set('eco', eco);

  const url = `${API_BASE}/reference/openings${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  return response.json();
}

// ============================================
// Templates API
// ============================================

export type TemplateType = 'PERSONAL' | 'TEAM' | 'BUILTIN';

export interface TemplateConfig {
  ageBand?: AgeBand;
  storyDensity?: StoryDensity;
  storySubject?: StorySubject;
  chessBasis?: ChessBasis;
  puzzleCount?: number;
  puzzleDifficulty?: PuzzleDifficulty;
  additionalNotes?: string;
  // Reference data
  playerName?: string;
  playerProfile?: PlayerProfile;
  bookId?: string;
  bookTitle?: string;
  openingEco?: string;
  openingName?: string;
  tacticalThemeId?: string;
  tacticalThemeName?: string;
}

export interface LessonTemplate {
  id: string;
  name: string;
  description: string | null;
  type: TemplateType;
  config: TemplateConfig;
  usageCount: number;
  createdByEmail: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Get templates accessible to the current user
export async function getTemplates(projectId?: string): Promise<LessonTemplate[]> {
  const params = new URLSearchParams();
  if (projectId) params.set('projectId', projectId);

  const url = `${API_BASE}/templates${params.toString() ? '?' + params.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch templates');
  }

  const data = await response.json();
  return data.templates;
}

// Create a new template
export async function createTemplate(params: {
  name: string;
  description?: string;
  type: 'PERSONAL' | 'TEAM';
  projectId?: string;
  config: TemplateConfig;
}): Promise<LessonTemplate> {
  const response = await fetch(`${API_BASE}/templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create template');
  }

  return response.json();
}

// Update a template
export async function updateTemplate(
  id: string,
  params: {
    name?: string;
    description?: string;
    config?: TemplateConfig;
  }
): Promise<LessonTemplate> {
  const response = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update template');
  }

  return response.json();
}

// Delete a template
export async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to delete template');
  }
}

// Increment template usage count
export async function useTemplate(id: string): Promise<void> {
  await fetch(`${API_BASE}/templates/${id}/use`, {
    method: 'POST',
  });
}

// ============================================
// A/B Generation API
// ============================================

export type ABGroupStatus = 'PROCESSING' | 'COMPLETE' | 'PARTIALLY_COMPLETE' | 'FAILED';

export interface ABVersion {
  id: string;
  variant: string;
  status: GenerationStatus;
  title: string | null;
  aiReviewScore: number | null;
  wasSelected: boolean;
  errorMessage: string | null;
  updatedAt: string;
}

export interface ABVersionFull extends ABVersion {
  rawContent: string | null;
  sections: {
    story?: string;
    chessLesson?: string;
    teacherTips?: string;
    chessercises?: string;
    puzzles?: Array<{ fen: string; narrative: string; answer: string }>;
  };
  aiReviewNotes: string | null;
  createdAt: string;
}

export interface ABJobResponse {
  abGroupId: string;
  jobs: Array<{ id: string; variant: string }>;
  message: string;
}

export interface ABStatusResponse {
  abGroupId: string;
  status: ABGroupStatus;
  versions: ABVersion[];
}

export interface ABGroupResponse {
  abGroupId: string;
  versions: ABVersionFull[];
}

// Queue 3 versions for A/B comparison
export async function queueABGeneration(params: {
  ageBand: AgeBand;
  chessConceptKey: string;
  storyDensity: StoryDensity;
  storySubject?: StorySubject;
  chessBasis?: ChessBasis;
  puzzleCount?: number;
  puzzleDifficulty?: PuzzleDifficulty;
  additionalNotes?: string;
  playerName?: string;
  playerProfile?: PlayerProfile;
  bookId?: string;
  bookTitle?: string;
  openingEco?: string;
  openingName?: string;
  tacticalThemeId?: string;
  tacticalThemeName?: string;
}): Promise<ABJobResponse> {
  const response = await fetch(`${API_BASE}/generate/ab`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start A/B generation');
  }

  return response.json();
}

// Poll A/B group status
export async function getABStatus(groupId: string): Promise<ABStatusResponse> {
  const response = await fetch(`${API_BASE}/generate/ab/${groupId}/status`);

  if (!response.ok) {
    throw new Error('Failed to get A/B status');
  }

  return response.json();
}

// Get full A/B group with lesson content
export async function getABGroup(groupId: string): Promise<ABGroupResponse> {
  const response = await fetch(`${API_BASE}/generate/ab/${groupId}`);

  if (!response.ok) {
    throw new Error('Failed to get A/B group');
  }

  return response.json();
}

// Select a version as the winner
export async function selectABVersion(groupId: string, lessonId: string): Promise<{ success: boolean; selectedLessonId: string; variant: string }> {
  const response = await fetch(`${API_BASE}/generate/ab/${groupId}/select/${lessonId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to select version');
  }

  return response.json();
}

// ============================================
// Illustrations API
// ============================================

export async function getIllustrations(params?: {
  search?: string;
  filter?: string;
  artType?: ArtType;
  excludeArtType?: string;
  lessonId?: string;
  moduleCode?: string;
  characterId?: string;
  goldStandard?: string;
  untagged?: boolean;
  reviewStatus?: string;
  page?: number;
  limit?: number;
}): Promise<IllustrationsResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.filter) query.set('filter', params.filter);
  if (params?.reviewStatus) query.set('reviewStatus', params.reviewStatus);
  if (params?.artType) query.set('artType', params.artType);
  if (params?.excludeArtType) query.set('excludeArtType', params.excludeArtType);
  if (params?.lessonId) query.set('lessonId', params.lessonId);
  if (params?.moduleCode) query.set('moduleCode', params.moduleCode);
  if (params?.characterId) query.set('characterId', params.characterId);
  if (params?.goldStandard) query.set('goldStandard', params.goldStandard);
  if (params?.untagged) query.set('untagged', 'true');
  if (params?.page) query.set('page', params.page.toString());
  if (params?.limit) query.set('limit', params.limit.toString());

  const url = `${API_BASE}/illustrations${query.toString() ? '?' + query.toString() : ''}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to load illustrations');
  }

  return response.json();
}

export async function getIllustration(id: string): Promise<Illustration> {
  const response = await fetch(`${API_BASE}/illustrations/${id}`);

  if (!response.ok) {
    throw new Error('Failed to load illustration');
  }

  return response.json();
}

export async function uploadIllustrationPhoto(
  name: string,
  photo: File
): Promise<Illustration> {
  const formData = new FormData();
  formData.append('photo', photo);
  formData.append('name', name);

  const response = await fetch(`${API_BASE}/illustrations/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Failed to upload photo');
  }

  return response.json();
}

export async function generateIllustration(
  id: string,
  options?: { prompt?: string; loraScale?: number; guidanceScale?: number }
): Promise<{ illustrationId: string; predictionId: string; status: string }> {
  const response = await fetch(`${API_BASE}/illustrations/${id}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    throw new Error('Failed to start generation');
  }

  return response.json();
}

export async function pollIllustrationStatus(
  id: string
): Promise<{ status: string; generations?: IllustrationGeneration[]; error?: string; referenceIds?: string[] }> {
  const response = await fetch(`${API_BASE}/illustrations/${id}/status`);

  if (!response.ok) {
    throw new Error('Failed to check status');
  }

  return response.json();
}

export async function selectIllustrationVariant(
  illustrationId: string,
  generationId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/illustrations/${illustrationId}/select/${generationId}`,
    { method: 'POST' }
  );

  if (!response.ok) {
    throw new Error('Failed to select variant');
  }
}

// Illustration Chat API
export async function getIllustrationMessages(
  illustrationId: string
): Promise<IllustrationMessage[]> {
  const response = await fetch(`${API_BASE}/illustrations/${illustrationId}/messages`);

  if (!response.ok) {
    throw new Error('Failed to load messages');
  }

  return response.json();
}

export async function sendIllustrationChat(
  illustrationId: string,
  message: string
): Promise<IllustrationChatResponse> {
  const response = await fetch(`${API_BASE}/illustrations/${illustrationId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function deleteIllustration(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/illustrations/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete illustration');
  }
}

// ============================================
// Illustration — Update (lesson tag, name)
// ============================================

export async function updateIllustration(
  id: string,
  data: { lessonId?: string | null; characterId?: string | null; name?: string; description?: string | null; isGoldStandard?: boolean; goldStandardType?: string | null; isReferenceEnabled?: boolean }
): Promise<Illustration> {
  const response = await fetch(`${API_BASE}/illustrations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to update illustration');
  }

  return response.json();
}

// ============================================
// Illustration — Update AI Description
// ============================================

export async function updateIllustrationDescription(
  id: string,
  aiDescription: string
): Promise<{ id: string; aiDescription: string; reviewStatus: string }> {
  const response = await fetch(`${API_BASE}/media/description/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiDescription }),
  });

  if (!response.ok) {
    throw new Error('Failed to update AI description');
  }

  return response.json();
}

export async function redescribeIllustration(
  id: string
): Promise<{ id: string; aiDescription: string; reviewStatus: string; autoTagged: string[] }> {
  const response = await fetch(`${API_BASE}/media/describe/${id}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to re-describe illustration');
  }

  return response.json();
}

// ============================================
// Curriculum — Lessons (for tagging dropdowns)
// ============================================

export async function getAllLessons(): Promise<ModuleWithLessons[]> {
  const response = await fetch(`${API_BASE}/lessons/all`);
  if (!response.ok) {
    throw new Error('Failed to fetch lessons');
  }
  return response.json();
}

// Alias for getAllLessons — used by detail pages
export const getModulesWithLessons = getAllLessons;

export async function getLessonsWithCounts(): Promise<ModuleWithLessonCounts[]> {
  const response = await fetch(`${API_BASE}/lessons/with-counts`);
  if (!response.ok) {
    throw new Error('Failed to fetch lessons with counts');
  }
  return response.json();
}

// ============================================
// Character Art — Generate via Gemini
// ============================================

export async function generateCharacterArt(params: {
  name: string;
  prompt: string;
  referenceIds?: string[];
  resolution: 2048 | 4096;
}): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/illustrations/generate-character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start character art generation');
  }

  return response.json();
}

// ============================================
// Video API
// ============================================

export async function generateVideo(params: {
  name: string;
  sourceIllustrationId?: string;
  sourceReferenceId?: string;
  prompt: string;
  duration?: number;
  aspectRatio?: string;
  resolution?: string;
}): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start video generation');
  }

  return response.json();
}

export async function getVideos(params?: {
  search?: string;
  page?: number;
  limit?: number;
  characterId?: string;
  lessonId?: string;
}): Promise<VideosResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.characterId) query.set('characterId', params.characterId);
  if (params?.lessonId) query.set('lessonId', params.lessonId);
  const qs = query.toString();

  const response = await fetch(`${API_BASE}/video${qs ? `?${qs}` : ''}`);

  if (!response.ok) {
    throw new Error('Failed to load videos');
  }

  return response.json();
}

export async function getVideoDetail(id: string): Promise<Illustration> {
  const response = await fetch(`${API_BASE}/video/${id}`);

  if (!response.ok) {
    throw new Error('Failed to load video');
  }

  return response.json();
}

export async function pollVideoStatus(id: string): Promise<{
  status: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  generations?: IllustrationGeneration[];
  errorMessage?: string;
}> {
  const response = await fetch(`${API_BASE}/video/${id}/status`);

  if (!response.ok) {
    throw new Error('Failed to check video status');
  }

  return response.json();
}

export async function deleteVideo(id: string): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/video/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete video');
  }

  return response.json();
}

export async function updateVideo(
  id: string,
  data: { name?: string; description?: string | null; lessonId?: string | null }
): Promise<Illustration> {
  const response = await fetch(`${API_BASE}/video/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update video');
  return response.json();
}

// ============================================
// Admin API
// ============================================

export async function getUsers(): Promise<StudioUser[]> {
  const response = await fetch(`${API_BASE}/admin/users`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to load users');
  return response.json();
}

export async function updateUserRole(id: string, role: UserRole): Promise<StudioUser> {
  const response = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ role }),
  });
  if (!response.ok) throw new Error('Failed to update user role');
  return response.json();
}

// ============================================
// Pipeline Dashboard API
// ============================================

export interface PipelineStats {
  totalModules: number;
  totalLessons: number;
  totalChunks: number;
  embeddedChunks: number;
  totalIllustrations: number;
  originalIllustrations: number;
  illustrationsWithUrl: number;
  describedIllustrations: number;
  reviewedIllustrations: number;
  embeddedIllustrations: number;
  goldStandardCount: number;
  totalCharacters: number;
  generatedArt: number;
  generatedVideos: number;
}

export interface PipelineCharacter {
  id: string;
  name: string;
  piece: string | null;
  trait: string | null;
  bio: string | null;
}

export interface StyleBible {
  instructions: string;
  updatedAt: string;
  updatedBy: string | null;
}

export interface PipelineData {
  stats: PipelineStats;
  styleBible: StyleBible | null;
  characters: PipelineCharacter[];
}

export async function getPipelineData(): Promise<PipelineData> {
  const response = await fetch(`${API_BASE}/admin/pipeline`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to load pipeline data');
  return response.json();
}

export async function updateStyleBible(instructions: string): Promise<StyleBible> {
  const response = await fetch(`${API_BASE}/admin/pipeline/style-bible`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ instructions }),
  });
  if (!response.ok) throw new Error('Failed to update style bible');
  return response.json();
}

// ============================================
// Audio API — Character Voices
// ============================================

export async function getCharacterVoices(params?: {
  search?: string;
  limit?: number;
  character?: string;
}): Promise<CharacterVoicesResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.character) query.set('character', params.character);
  const qs = query.toString();

  const response = await fetch(`${API_BASE}/audio/voices${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to load voices');
  return response.json();
}

export async function getCharacterVoice(id: string): Promise<CharacterVoice> {
  const response = await fetch(`${API_BASE}/audio/voices/${id}`);
  if (!response.ok) throw new Error('Failed to load voice');
  return response.json();
}

export async function designVoice(params: {
  description: string;
  text?: string;
}): Promise<VoiceDesignResponse> {
  const response = await fetch(`${API_BASE}/audio/voices/design`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voiceDescription: params.description, text: params.text }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to design voice');
  }
  return response.json();
}

export async function saveVoice(params: {
  name: string;
  description: string;
  generatedVoiceId: string;
  previewAudioBase64?: string;
  character?: string;
  previewId?: string;
}): Promise<CharacterVoice> {
  const response = await fetch(`${API_BASE}/audio/voices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name,
      voiceDescription: params.description,
      generatedVoiceId: params.generatedVoiceId,
      character: params.character,
      previewId: params.previewId,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to save voice');
  }
  return response.json();
}

export async function updateCharacterVoice(
  id: string,
  data: { name?: string; character?: string | null }
): Promise<CharacterVoice> {
  const response = await fetch(`${API_BASE}/audio/voices/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update voice');
  return response.json();
}

export async function deleteCharacterVoice(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/audio/voices/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete voice');
}

export async function generateSpeech(params: {
  voiceId: string;
  text: string;
  emotion?: string;
}): Promise<{ audioUrl: string; durationSecs: number }> {
  const response = await fetch(`${API_BASE}/audio/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to generate speech');
  }
  return response.json();
}

// Script + Lines API
export async function createAudioScript(params: {
  name: string;
  characterVoiceId: string;
  lessonId?: string;
}): Promise<AudioScript> {
  const response = await fetch(`${API_BASE}/audio/scripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to create script');
  return response.json();
}

export async function getAudioScript(id: string): Promise<AudioScript> {
  const response = await fetch(`${API_BASE}/audio/scripts/${id}`);
  if (!response.ok) throw new Error('Failed to load script');
  return response.json();
}

export async function addAudioLine(scriptId: string, params: {
  text: string;
  emotion?: string;
}): Promise<AudioLine> {
  const response = await fetch(`${API_BASE}/audio/scripts/${scriptId}/lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to add line');
  return response.json();
}

export async function generateAudioLine(lineId: string): Promise<AudioLine> {
  const response = await fetch(`${API_BASE}/audio/lines/${lineId}/generate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate audio');
  return response.json();
}

export async function deleteAudioLine(lineId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/audio/lines/${lineId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete line');
}

// Phase 3 — Scripts list
export async function getAudioScripts(params?: {
  search?: string;
  lessonId?: string;
  limit?: number;
}): Promise<AudioScriptSummary[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.lessonId) qs.set('lessonId', params.lessonId);
  if (params?.limit) qs.set('limit', String(params.limit));
  const response = await fetch(`${API_BASE}/audio/scripts${qs.toString() ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to load scripts');
  return response.json();
}

// Phase 2 — Stitch, Generate-all, Clone, Delete Script, Reorder

export async function stitchScript(scriptId: string): Promise<AudioScript> {
  const response = await fetch(`${API_BASE}/audio/scripts/${scriptId}/stitch`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to stitch script audio');
  return response.json();
}

export async function generateAllLines(scriptId: string): Promise<AudioScript> {
  const response = await fetch(`${API_BASE}/audio/scripts/${scriptId}/generate-all`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate all lines');
  return response.json();
}

export async function deleteAudioScript(scriptId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/audio/scripts/${scriptId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete script');
}

export async function updateAudioScript(scriptId: string, data: { name: string }): Promise<AudioScript> {
  const response = await fetch(`${API_BASE}/audio/scripts/${scriptId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update script');
  return response.json();
}

export async function reorderAudioLine(lineId: string, sequence: number): Promise<AudioLine> {
  const response = await fetch(`${API_BASE}/audio/lines/${lineId}/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sequence }),
  });
  if (!response.ok) throw new Error('Failed to reorder line');
  return response.json();
}

export async function cloneVoice(params: {
  name: string;
  description: string;
  audioBase64: string;
  audioFilename: string;
  character?: string;
}): Promise<CharacterVoice> {
  const response = await fetch(`${API_BASE}/audio/voices/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to clone voice');
  return response.json();
}

// ============================================
// Stats API
// ============================================

export async function getStats(): Promise<StudioStats> {
  const response = await fetch(`${API_BASE}/stats`);
  if (!response.ok) throw new Error('Failed to load stats');
  return response.json();
}

// ============================================
// Characters
// ============================================

// Character tags on illustrations (many-to-many)
export async function getIllustrationCharacters(illustrationId: string): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`${API_BASE}/illustrations/${illustrationId}/characters`);
  if (!response.ok) throw new Error('Failed to load character tags');
  return response.json();
}

export async function addIllustrationCharacter(illustrationId: string, characterId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/illustrations/${illustrationId}/characters/${characterId}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to add character tag');
}

export async function removeIllustrationCharacter(illustrationId: string, characterId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/illustrations/${illustrationId}/characters/${characterId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to remove character tag');
}

export async function getCharacters(): Promise<CharacterSummary[]> {
  const response = await fetch(`${API_BASE}/characters`);
  if (!response.ok) throw new Error('Failed to load characters');
  return response.json();
}

export async function createCharacter(data: { name: string; piece?: string; trait?: string }): Promise<{ id: string; name: string }> {
  const response = await fetch(`${API_BASE}/characters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create character');
  }
  return response.json();
}

export async function getCharacter(id: string): Promise<CharacterDetail> {
  const response = await fetch(`${API_BASE}/characters/${id}`);
  if (!response.ok) throw new Error('Failed to load character');
  return response.json();
}

export async function updateCharacter(id: string, data: {
  avatarIllustrationId?: string | null;
  avatarPosition?: string | null;
  coverIllustrationId?: string | null;
  coverPosition?: string | null;
  profileIllustrationId?: string | null;
  profilePosition?: string | null;
  bio?: string | null;
  piece?: string | null;
  trait?: string | null;
  movementNote?: string | null;
  firstAppearance?: string | null;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/characters/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update character');
}

export async function generateCharacterBio(id: string): Promise<{ bio: string }> {
  const response = await fetch(`${API_BASE}/characters/${id}/generate-bio`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate bio');
  }
  return response.json();
}

// ============================================
// Chunks & Embeddings
// ============================================

export async function getChunks(params?: {
  chunkType?: string;
  lessonId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ chunks: ChunkSummary[]; total: number; page: number; totalPages: number }> {
  const query = new URLSearchParams();
  if (params?.chunkType) query.set('chunkType', params.chunkType);
  if (params?.lessonId) query.set('lessonId', params.lessonId);
  if (params?.search) query.set('search', params.search);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const res = await fetch(`${API_BASE}/chunks?${query}`);
  if (!res.ok) throw new Error('Failed to load chunks');
  return res.json();
}

export async function getChunk(id: string): Promise<ChunkDetail> {
  const res = await fetch(`${API_BASE}/chunks/${id}`);
  if (!res.ok) throw new Error('Failed to load chunk');
  return res.json();
}

export async function getChunkStats(): Promise<ChunkStats> {
  const res = await fetch(`${API_BASE}/chunks/stats`);
  if (!res.ok) throw new Error('Failed to load chunk stats');
  return res.json();
}

export async function getSimilarChunks(id: string): Promise<{ chunks: SimilarChunk[] }> {
  const res = await fetch(`${API_BASE}/chunks/${id}/similar`);
  if (!res.ok) throw new Error('Failed to find similar chunks');
  return res.json();
}

// ============================================
// Activity Feed
// ============================================

export async function getActivityFeed(limit = 20): Promise<ActivityEvent[]> {
  const response = await fetch(`${API_BASE}/activity?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to load activity feed');
  return response.json();
}

// ============================================
// Daily Content Suggestions
// ============================================

export async function getSuggestions(date?: string): Promise<DailySuggestion[]> {
  const params = date ? `?date=${date}` : '';
  const response = await fetch(`${API_BASE}/suggestions${params}`);
  if (!response.ok) throw new Error('Failed to load suggestions');
  return response.json();
}

export async function getRecentSuggestions(): Promise<DailySuggestion[]> {
  const response = await fetch(`${API_BASE}/suggestions/recent`);
  if (!response.ok) throw new Error('Failed to load recent suggestions');
  return response.json();
}

export async function updateSuggestionStatus(id: string, status: 'USED' | 'SKIPPED' | 'SUGGESTED', skipReason?: string): Promise<DailySuggestion> {
  const response = await fetch(`${API_BASE}/suggestions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, skipReason }),
  });
  if (!response.ok) throw new Error('Failed to update suggestion');
  return response.json();
}

// ============================================
// Universal Search API
// ============================================

export interface UniversalSearchChunk {
  id: string;
  type: 'curriculum';
  title: string;
  section: string;
  content: string;
  similarity: number;
  // Debug fields (only present when debug=true)
  moduleCode?: string;
  lessonNumber?: number;
  lessonTitle?: string;
  chunkType?: string;
  sectionTitle?: string | null;
  tokenCount?: number;
  sequence?: number;
  contentFull?: string;
  lessonId?: string;
}

export interface UniversalSearchIllustration {
  id: string;
  type: 'illustration';
  name: string;
  description: string;
  illustrationUrl: string;
  characterId: string | null;
  similarity: number;
  // Debug fields (only present when debug=true)
  artType?: string;
  sourcePhotoUrl?: string | null;
  sourceFilePath?: string | null;
  isOriginal?: boolean;
  createdByEmail?: string;
  aiDescriptionFull?: string | null;
}

export interface UniversalSearchResponse {
  query: string;
  chunks: UniversalSearchChunk[];
  illustrations: UniversalSearchIllustration[];
}

export interface IllustrationSearchResult {
  id: string;
  name: string;
  description: string;
  illustrationUrl: string;
  sourcePhotoUrl: string;
  characterId: string | null;
  similarity: number;
}

export interface IllustrationSearchResponse {
  query: string;
  results: IllustrationSearchResult[];
}

export async function searchUniversal(query: string, limit?: number, debug?: boolean): Promise<UniversalSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (limit) params.set('limit', String(limit));
  if (debug) params.set('debug', 'true');
  const response = await fetch(`${API_BASE}/search/universal?${params}`);
  if (!response.ok) throw new Error('Search failed');
  return response.json();
}

export async function searchIllustrations(query: string, limit?: number): Promise<IllustrationSearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (limit) params.set('limit', String(limit));
  const response = await fetch(`${API_BASE}/search/illustrations?${params}`);
  if (!response.ok) throw new Error('Illustration search failed');
  return response.json();
}

// Chess News
export async function getChessNews(limit = 8): Promise<ChessNewsItem[]> {
  const response = await fetch(`${API_BASE}/chess-news?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to load chess news');
  return response.json();
}

export async function generateSuggestionArt(
  suggestionId: string,
  request: GenerateArtRequest
): Promise<GenerateArtResponse> {
  const response = await fetch(`${API_BASE}/suggestions/${suggestionId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate art' }));
    throw new Error(err.error || 'Failed to generate art');
  }
  return response.json();
}

// Prompt Analysis (pre-generation check)
export async function analyzeArtPrompt(prompt: string): Promise<PromptAnalysis> {
  const response = await fetch(`${API_BASE}/illustrations/analyze-prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to analyze prompt' }));
    throw new Error(err.error || 'Failed to analyze prompt');
  }
  return response.json();
}

// ============================================
// Episodes (YouTube Content Pipeline)
// ============================================

export interface EpisodeShot {
  id: string;
  orderIndex: number;
  sceneDescription: string;
  characters: string[];
  cameraAngle: string | null;
  narration: string | null;
  dialogueLines: Array<{ character: string; line: string; emotion: string }> | null;
  imageUrl: string | null;
  imageStatus: string;
  audioUrl: string | null;
  audioStatus: string;
  audioDuration: number | null;
  videoUrl: string | null;
  videoStatus: string;
  videoDuration: number | null;
}

export interface Episode {
  id: string;
  title: string;
  slug: string;
  format: 'SHORT' | 'EPISODE';
  status: string;
  moduleCode: string;
  lessonNumber: number;
  chunkIds: string[];
  series: string;
  seriesOrder: number;
  script: Record<string, unknown> | null;
  shots: EpisodeShot[];
  finalVideoUrl: string | null;
  finalDuration: number | null;
  thumbnailUrl: string | null;
  youtubeId: string | null;
  publishedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EpisodesResponse {
  episodes: Episode[];
  total: number;
  page: number;
  limit: number;
}

export async function getEpisodes(params?: {
  series?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<EpisodesResponse> {
  const query = new URLSearchParams();
  if (params?.series) query.set('series', params.series);
  if (params?.status) query.set('status', params.status);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();

  const response = await fetch(`${API_BASE}/episodes${qs ? `?${qs}` : ''}`);
  if (!response.ok) throw new Error('Failed to load episodes');
  return response.json();
}

export async function getEpisode(id: string): Promise<Episode> {
  const response = await fetch(`${API_BASE}/episodes/${id}`);
  if (!response.ok) throw new Error('Failed to load episode');
  return response.json();
}

export async function createEpisode(data: {
  format: 'SHORT' | 'EPISODE';
  series?: string;
  moduleCode: string;
  lessonNumber: number;
}): Promise<Episode> {
  const response = await fetch(`${API_BASE}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to create episode' }));
    throw new Error(err.error || 'Failed to create episode');
  }
  return response.json();
}

export async function updateEpisode(id: string, data: Record<string, unknown>): Promise<Episode> {
  const response = await fetch(`${API_BASE}/episodes/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update episode');
  return response.json();
}

export async function deleteEpisode(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/episodes/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete episode');
}

export async function generateEpisodeScript(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/generate-script`, {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate script' }));
    throw new Error(err.error || 'Failed to generate script');
  }
  return response.json();
}

export async function generateEpisodeArt(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/generate-art`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate art' }));
    throw new Error(err.error || 'Failed to generate art');
  }
  return response.json();
}

export async function generateEpisodeVoice(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/generate-voice`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate voice' }));
    throw new Error(err.error || 'Failed to generate voice');
  }
  return response.json();
}

export async function generateEpisodeVideo(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/generate-video`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate video' }));
    throw new Error(err.error || 'Failed to generate video');
  }
  return response.json();
}

export async function generateAll(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/generate-all`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to start pipeline' }));
    throw new Error(err.error || 'Failed to start pipeline');
  }
  return response.json();
}

export async function duplicateEpisode(id: string): Promise<Episode> {
  const response = await fetch(`${API_BASE}/episodes/${id}/duplicate`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to duplicate' }));
    throw new Error(err.error || 'Failed to duplicate');
  }
  return response.json();
}

export async function batchCreateEpisodes(data: {
  moduleCode: string;
  format: 'SHORT' | 'EPISODE';
  series?: string;
}): Promise<{ created: number; episodeIds: string[] }> {
  const response = await fetch(`${API_BASE}/episodes/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to batch create' }));
    throw new Error(err.error || 'Failed to batch create');
  }
  return response.json();
}

export async function assembleEpisode(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/assemble`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to assemble' }));
    throw new Error(err.error || 'Failed to assemble');
  }
  return response.json();
}

export async function generateStoryboard(id: string): Promise<{ id: string; status: string }> {
  const response = await fetch(`${API_BASE}/episodes/${id}/generate-storyboard`, {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to generate storyboard' }));
    throw new Error(err.error || 'Failed to generate storyboard');
  }
  return response.json();
}

export async function createShot(episodeId: string, data: Partial<EpisodeShot>): Promise<EpisodeShot> {
  const response = await fetch(`${API_BASE}/episodes/${episodeId}/shots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create shot');
  return response.json();
}

export async function updateShot(episodeId: string, shotId: string, data: Partial<EpisodeShot>): Promise<EpisodeShot> {
  const response = await fetch(`${API_BASE}/episodes/${episodeId}/shots/${shotId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update shot');
  return response.json();
}

export async function deleteShot(episodeId: string, shotId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/episodes/${episodeId}/shots/${shotId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete shot');
}

export async function reorderShots(episodeId: string, shotIds: string[]): Promise<EpisodeShot[]> {
  const response = await fetch(`${API_BASE}/episodes/${episodeId}/shots/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shotIds }),
  });
  if (!response.ok) throw new Error('Failed to reorder shots');
  return response.json();
}
