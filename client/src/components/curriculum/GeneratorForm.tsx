import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getChessConcepts,
  queueLessonGeneration,
  getLessonStatus,
  getGeneratedLesson,
  queueABGeneration,
  type AgeBand,
  type StoryDensity,
  type StorySubject,
  type ChessBasis,
  type PuzzleDifficulty,
  type GenerationResponse,
  type GenerationStatus,
  type PlayerProfile,
  type ChessBook,
  type ChessOpening,
  type TacticalTheme,
  type TemplateConfig,
} from '../../lib/api';
import { ArrowPathIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { PlayerSearch } from './PlayerSearch';
import { BookSearch } from './BookSearch';
import { OpeningSearch } from './OpeningSearch';
import { TacticalThemeSelect } from './TacticalThemeSelect';
import { TemplatePanel } from './TemplatePanel';
import { ABComparisonModal } from './ABComparisonModal';

interface GeneratorFormProps {
  onGenerated: (response: GenerationResponse) => void;
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  onStatusChange?: (status: GenerationStatus | null) => void;
}

// Status messages for the loading overlay
const STATUS_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  QUEUED: { title: 'Queued', subtitle: 'Waiting to start...' },
  GENERATING: { title: 'Generating lesson...', subtitle: 'Creating content with AI' },
  REVIEWING: { title: 'Running AI review...', subtitle: 'Almost done' },
};

export function GeneratorForm({ onGenerated, isGenerating, setIsGenerating, onStatusChange }: GeneratorFormProps) {
  const [concepts, setConcepts] = useState<string[]>([]);
  const [loadingConcepts, setLoadingConcepts] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);

  // A/B Generation state
  const [abGroupId, setAbGroupId] = useState<string | null>(null);
  const [showABModal, setShowABModal] = useState(false);
  const [isABGenerating, setIsABGenerating] = useState(false);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(generationStatus);
  }, [generationStatus, onStatusChange]);

  // Form state
  const [ageBand, setAgeBand] = useState<AgeBand>('THREE_TO_SEVEN');
  const [chessConceptKey, setChessConceptKey] = useState('');
  const [conceptSearch, setConceptSearch] = useState('');
  const [storyDensity, setStoryDensity] = useState<StoryDensity>('MEDIUM');
  // Structured inputs (Phase 2)
  const [storySubject, setStorySubject] = useState<StorySubject | undefined>(undefined);
  const [chessBasis, setChessBasis] = useState<ChessBasis | undefined>(undefined);
  const [puzzleCount, setPuzzleCount] = useState<number | undefined>(undefined);
  const [puzzleDifficulty, setPuzzleDifficulty] = useState<PuzzleDifficulty | undefined>(undefined);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Reference data selections
  const [playerName, setPlayerName] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [bookId, setBookId] = useState('');
  const [selectedBook, setSelectedBook] = useState<ChessBook | null>(null);
  const [openingEco, setOpeningEco] = useState('');
  const [selectedOpening, setSelectedOpening] = useState<ChessOpening | null>(null);
  const [tacticalThemeId, setTacticalThemeId] = useState('');
  const [selectedTacticalTheme, setSelectedTacticalTheme] = useState<TacticalTheme | null>(null);

  // Polling ref to allow cleanup
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lessonIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadConcepts() {
      try {
        const conceptList = await getChessConcepts();
        setConcepts(conceptList);
      } catch (err) {
        console.error('Failed to load concepts:', err);
      } finally {
        setLoadingConcepts(false);
      }
    }
    loadConcepts();
  }, []);

  const filteredConcepts = concepts.filter((c) =>
    c.toLowerCase().includes(conceptSearch.toLowerCase())
  );

  // Current form config for template saving
  const currentConfig = useMemo<TemplateConfig>(() => ({
    ageBand,
    storyDensity,
    storySubject,
    chessBasis,
    puzzleCount,
    puzzleDifficulty,
    additionalNotes: additionalNotes || undefined,
    playerName: playerName || undefined,
    playerProfile: selectedPlayer || undefined,
    bookId: bookId || undefined,
    bookTitle: selectedBook?.title,
    openingEco: openingEco || undefined,
    openingName: selectedOpening?.name,
    tacticalThemeId: tacticalThemeId || undefined,
    tacticalThemeName: selectedTacticalTheme?.name,
  }), [
    ageBand, storyDensity, storySubject, chessBasis, puzzleCount, puzzleDifficulty,
    additionalNotes, playerName, selectedPlayer, bookId, selectedBook,
    openingEco, selectedOpening, tacticalThemeId, selectedTacticalTheme,
  ]);

  // Apply template config to form
  const applyTemplate = useCallback((config: TemplateConfig) => {
    if (config.ageBand) setAgeBand(config.ageBand);
    if (config.storyDensity) setStoryDensity(config.storyDensity);
    setStorySubject(config.storySubject);
    setChessBasis(config.chessBasis);
    setPuzzleCount(config.puzzleCount);
    setPuzzleDifficulty(config.puzzleDifficulty);
    setAdditionalNotes(config.additionalNotes || '');

    // Apply reference data
    setPlayerName(config.playerName || '');
    setSelectedPlayer(config.playerProfile || null);
    setBookId(config.bookId || '');
    setSelectedBook(config.bookTitle ? { id: config.bookId!, title: config.bookTitle, author: '', year: 0, concepts: [], description: '' } : null);
    setOpeningEco(config.openingEco || '');
    setSelectedOpening(config.openingName ? { eco: config.openingEco!, name: config.openingName, moves: '', description: '' } : null);
    setTacticalThemeId(config.tacticalThemeId || '');
    setSelectedTacticalTheme(config.tacticalThemeName ? { id: config.tacticalThemeId!, name: config.tacticalThemeName, description: '', examples: [], difficulty: 'beginner' } : null);
  }, []);

  // Poll for lesson status
  const pollStatus = useCallback(async () => {
    if (!lessonIdRef.current) return;

    try {
      const status = await getLessonStatus(lessonIdRef.current);
      setGenerationStatus(status.status);

      // Check if generation is complete
      if (status.status === 'DRAFT') {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        // Fetch full lesson data
        const fullLesson = await getGeneratedLesson(lessonIdRef.current);
        setIsGenerating(false);
        setGenerationStatus(null);
        onGenerated(fullLesson);
      } else if (status.status === 'FAILED') {
        // Stop polling and show error
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setIsGenerating(false);
        setGenerationStatus(null);
        setError(status.errorMessage || 'Generation failed. Please try again.');
      }
    } catch (err) {
      console.error('Polling error:', err);
      // Don't stop polling on transient errors, but log them
    }
  }, [onGenerated, setIsGenerating]);

  // Build reference data based on chess basis
  const buildReferenceData = useCallback(() => {
    const referenceData: {
      playerName?: string;
      playerProfile?: PlayerProfile;
      bookId?: string;
      bookTitle?: string;
      openingEco?: string;
      openingName?: string;
      tacticalThemeId?: string;
      tacticalThemeName?: string;
    } = {};

    if (chessBasis === 'PLAYER_TEACHINGS' && playerName.trim()) {
      referenceData.playerName = playerName.trim();
      if (selectedPlayer) {
        referenceData.playerProfile = selectedPlayer;
      }
    } else if (chessBasis === 'BOOK_REFERENCE' && selectedBook) {
      referenceData.bookId = selectedBook.id;
      referenceData.bookTitle = selectedBook.title;
    } else if (chessBasis === 'OPENING_SYSTEM' && selectedOpening) {
      referenceData.openingEco = selectedOpening.eco;
      referenceData.openingName = selectedOpening.name;
    } else if (chessBasis === 'TACTICAL_THEME' && selectedTacticalTheme) {
      referenceData.tacticalThemeId = selectedTacticalTheme.id;
      referenceData.tacticalThemeName = selectedTacticalTheme.name;
    }

    return referenceData;
  }, [chessBasis, playerName, selectedPlayer, selectedBook, selectedOpening, selectedTacticalTheme]);

  // Handle A/B Generation (Generate 3 Versions)
  async function handleABGenerate() {
    setError(null);

    if (!chessConceptKey.trim()) {
      setError('Please enter a chess concept');
      return;
    }

    setIsABGenerating(true);

    try {
      const referenceData = buildReferenceData();

      const job = await queueABGeneration({
        ageBand,
        chessConceptKey: chessConceptKey.trim(),
        storyDensity,
        storySubject,
        chessBasis,
        puzzleCount,
        puzzleDifficulty,
        additionalNotes: additionalNotes.trim() || undefined,
        ...referenceData,
      });

      // Store the group ID and show the modal
      setAbGroupId(job.abGroupId);
      setShowABModal(true);
      setIsABGenerating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start A/B generation');
      setIsABGenerating(false);
    }
  }

  // Handle A/B version selection
  const handleABVersionSelected = useCallback(async (lessonId: string, variant: string) => {
    // Fetch the selected lesson and pass it to the parent
    try {
      const fullLesson = await getGeneratedLesson(lessonId);
      onGenerated(fullLesson);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load selected lesson');
    }
  }, [onGenerated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!chessConceptKey.trim()) {
      setError('Please enter a chess concept');
      return;
    }

    setIsGenerating(true);
    setGenerationStatus('QUEUED');

    try {
      const referenceData = buildReferenceData();

      // Queue the generation job
      const job = await queueLessonGeneration({
        ageBand,
        chessConceptKey: chessConceptKey.trim(),
        storyDensity,
        // Structured inputs
        storySubject,
        chessBasis,
        puzzleCount,
        puzzleDifficulty,
        additionalNotes: additionalNotes.trim() || undefined,
        // Reference data
        ...referenceData,
      });

      lessonIdRef.current = job.id;

      // Start polling for status (every 2 seconds)
      pollingRef.current = setInterval(pollStatus, 2000);

      // Also poll immediately
      pollStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setIsGenerating(false);
      setGenerationStatus(null);
    }
  }

  // Get current status message
  const statusMessage = generationStatus ? STATUS_MESSAGES[generationStatus] : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Templates */}
      <TemplatePanel
        onApplyTemplate={applyTemplate}
        currentConfig={currentConfig}
        disabled={isGenerating}
      />

      {/* Age Band */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Age Band <span className="text-stc-pink">*</span></label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'THREE_TO_SEVEN', label: '3-7 years', desc: 'Acme Creative' },
            { value: 'EIGHT_TO_NINE', label: '8-9 years', desc: 'Adventure Chess' },
            { value: 'TEN_TO_TWELVE', label: '10-12 years', desc: 'Epic Chess' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                ageBand === opt.value
                  ? 'border-stc-purple-500 bg-stc-purple-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="ageBand"
                value={opt.value}
                checked={ageBand === opt.value}
                onChange={(e) => setAgeBand(e.target.value as AgeBand)}
                className="sr-only"
              />
              <span className="font-medium text-sm">{opt.label}</span>
              <span className="text-xs text-neutral-500">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Chess Concept */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Chess Concept <span className="text-stc-pink">*</span></label>
        <input
          type="text"
          value={chessConceptKey}
          onChange={(e) => {
            setChessConceptKey(e.target.value);
            setConceptSearch(e.target.value);
          }}
          placeholder="e.g., forks, pins, knight-movement, castling"
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
        />
        {!loadingConcepts && conceptSearch && filteredConcepts.length > 0 && (
          <div className="mt-1 border border-neutral-200 rounded-lg max-h-32 overflow-y-auto bg-white shadow-sm">
            {filteredConcepts.slice(0, 5).map((concept) => (
              <button
                key={concept}
                type="button"
                onClick={() => {
                  setChessConceptKey(concept);
                  setConceptSearch('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-stc-purple-50 text-sm"
              >
                {concept}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Story Density */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">Story Density</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'HIGH', label: 'High', desc: 'Story-first approach' },
            { value: 'MEDIUM', label: 'Medium', desc: 'Balanced' },
            { value: 'LOW', label: 'Low', desc: 'Chess-first, anecdotal' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                storyDensity === opt.value
                  ? 'border-stc-purple-500 bg-stc-purple-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="storyDensity"
                value={opt.value}
                checked={storyDensity === opt.value}
                onChange={(e) => setStoryDensity(e.target.value as StoryDensity)}
                className="sr-only"
              />
              <span className="font-medium text-sm">{opt.label}</span>
              <span className="text-xs text-neutral-500">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Story Subject */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Story Subject <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: undefined, label: 'Default', desc: 'AI decides' },
            { value: 'FICTIONAL_CHARACTERS', label: 'Fictional', desc: 'Acme Creative characters' },
            { value: 'REAL_CHESS_FIGURES', label: 'Real Figures', desc: 'Chess history' },
          ].map((opt) => (
            <label
              key={opt.value ?? 'default'}
              className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                storySubject === opt.value
                  ? 'border-stc-purple-500 bg-stc-purple-50'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <input
                type="radio"
                name="storySubject"
                value={opt.value ?? ''}
                checked={storySubject === opt.value}
                onChange={() => setStorySubject(opt.value as StorySubject | undefined)}
                className="sr-only"
              />
              <span className="font-medium text-sm">{opt.label}</span>
              <span className="text-xs text-neutral-500">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Chess Basis */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Chess Basis <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <select
          value={chessBasis ?? ''}
          onChange={(e) => {
            const value = e.target.value ? e.target.value as ChessBasis : undefined;
            setChessBasis(value);
            // Clear all reference selections when changing basis
            setPlayerName('');
            setSelectedPlayer(null);
            setBookId('');
            setSelectedBook(null);
            setOpeningEco('');
            setSelectedOpening(null);
            setTacticalThemeId('');
            setSelectedTacticalTheme(null);
          }}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
        >
          <option value="">AI decides (default)</option>
          <option value="PLAYER_TEACHINGS">Player Teachings - Famous player philosophies</option>
          <option value="BOOK_REFERENCE">Book Reference - Classic chess literature</option>
          <option value="OPENING_SYSTEM">Opening System - Based on opening systems</option>
          <option value="TACTICAL_THEME">Tactical Theme - Built around tactics</option>
        </select>

        {/* Player Search - shown when Player Teachings is selected */}
        {chessBasis === 'PLAYER_TEACHINGS' && (
          <div className="mt-3">
            <label className="block text-xs text-neutral-500 mb-1">Search for a Chess Player</label>
            <PlayerSearch
              value={playerName}
              onChange={(name) => setPlayerName(name)}
              onPlayerSelect={(profile) => setSelectedPlayer(profile)}
              placeholder="Search by name (e.g., Magnus Carlsen)..."
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-neutral-400">
              The lesson will feature this player's philosophy and teaching style
            </p>
          </div>
        )}

        {/* Book Search - shown when Book Reference is selected */}
        {chessBasis === 'BOOK_REFERENCE' && (
          <div className="mt-3">
            <label className="block text-xs text-neutral-500 mb-1">Select a Chess Book</label>
            <BookSearch
              value={bookId}
              onChange={(id, book) => {
                setBookId(id);
                setSelectedBook(book);
              }}
              placeholder="Search by title, author, or concept..."
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-neutral-400">
              The lesson will draw concepts and examples from this book
            </p>
          </div>
        )}

        {/* Opening Search - shown when Opening System is selected */}
        {chessBasis === 'OPENING_SYSTEM' && (
          <div className="mt-3">
            <label className="block text-xs text-neutral-500 mb-1">Select a Chess Opening</label>
            <OpeningSearch
              value={openingEco}
              onChange={(eco, opening) => {
                setOpeningEco(eco);
                setSelectedOpening(opening);
              }}
              placeholder="Search by name, ECO code, or moves..."
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-neutral-400">
              The lesson will teach concepts through this opening system
            </p>
          </div>
        )}

        {/* Tactical Theme Select - shown when Tactical Theme is selected */}
        {chessBasis === 'TACTICAL_THEME' && (
          <div className="mt-3">
            <label className="block text-xs text-neutral-500 mb-1">Select a Tactical Theme</label>
            <TacticalThemeSelect
              value={tacticalThemeId}
              onChange={(id, theme) => {
                setTacticalThemeId(id);
                setSelectedTacticalTheme(theme);
              }}
              placeholder="Select a tactical pattern..."
              disabled={isGenerating}
            />
            <p className="mt-1 text-xs text-neutral-400">
              The lesson will focus on this tactical pattern with examples and puzzles
            </p>
          </div>
        )}
      </div>

      {/* Puzzle Configuration */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Puzzle Configuration <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          {/* Puzzle Count */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Number of Puzzles</label>
            <input
              type="number"
              min="1"
              max="10"
              value={puzzleCount ?? ''}
              onChange={(e) => setPuzzleCount(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="2-5 typical"
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
            />
          </div>
          {/* Puzzle Difficulty */}
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Difficulty</label>
            <select
              value={puzzleDifficulty ?? ''}
              onChange={(e) => setPuzzleDifficulty(e.target.value ? e.target.value as PuzzleDifficulty : undefined)}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
            >
              <option value="">AI decides</option>
              <option value="EASY">Easy (1-move)</option>
              <option value="MEDIUM">Medium (2-move)</option>
              <option value="HARD">Hard (3+ move)</option>
              <option value="MIXED">Mixed (progressive)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Additional Notes */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Additional Notes{' '}
          <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <textarea
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Any specific requirements, themes, or characters to emphasize..."
          rows={2}
          className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 resize-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-stc-pink/10 border border-stc-pink/20 rounded-lg text-stc-pink text-sm">
          {error}
        </div>
      )}

      {/* Submit Buttons */}
      <div className="flex gap-3">
        {/* Single Lesson Button */}
        <button
          type="submit"
          disabled={isGenerating || isABGenerating}
          className="flex-1 py-3 px-4 bg-stc-purple-500 text-white rounded-lg font-medium hover:bg-stc-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <ArrowPathIcon className="animate-spin h-5 w-5" />
              Generating...
            </span>
          ) : (
            'Generate Lesson'
          )}
        </button>

        {/* A/B Generation Button */}
        <button
          type="button"
          onClick={handleABGenerate}
          disabled={isGenerating || isABGenerating}
          className="py-3 px-4 border-2 border-stc-purple-500 text-stc-purple-600 rounded-lg font-medium hover:bg-stc-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Generate 3 different versions and compare them"
        >
          {isABGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <ArrowPathIcon className="animate-spin h-5 w-5" />
              Starting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-5 h-5" />
              Generate 3 Versions
            </span>
          )}
        </button>
      </div>

      {/* A/B Comparison Modal */}
      {abGroupId && (
        <ABComparisonModal
          isOpen={showABModal}
          onClose={() => {
            setShowABModal(false);
            setAbGroupId(null);
          }}
          abGroupId={abGroupId}
          onVersionSelected={handleABVersionSelected}
        />
      )}
    </form>
  );
}
