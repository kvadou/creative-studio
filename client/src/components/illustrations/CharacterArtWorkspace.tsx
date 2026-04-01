import { useState, useRef, useCallback, useEffect } from 'react';
import {
  UserIcon,
  XMarkIcon,
  SparklesIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import type {
  Illustration,
  IllustrationGeneration,
  IllustrationMessage,
  IllustrationChatResponse,
  CharacterSummary,
} from '../../lib/types';
import {
  generateCharacterArt,
  pollIllustrationStatus,
  selectIllustrationVariant,
  getIllustrationMessages,
  sendIllustrationChat,
  getIllustrations,
  getCharacters,
  createCharacter,
  updateIllustration,
} from '../../lib/api';

interface CharacterArtWorkspaceProps {
  /** If provided, we're viewing an existing character illustration */
  illustration?: Illustration | null;
  onComplete: () => void;
  onClose: () => void;
}

type Phase = 'setup' | 'generating' | 'review' | 'chat-generating';
type GenerationMode = 'existing' | 'new';

export default function CharacterArtWorkspace({
  illustration: initialIllustration,
  onComplete,
  onClose,
}: CharacterArtWorkspaceProps) {
  const [phase, setPhase] = useState<Phase>(initialIllustration ? 'review' : 'setup');
  const [illustration, setIllustration] = useState<Illustration | null>(
    initialIllustration || null
  );
  const [illustrationId, setIllustrationId] = useState<string | null>(
    initialIllustration?.id || null
  );
  const [generations, setGenerations] = useState<IllustrationGeneration[]>(
    initialIllustration?.generations || []
  );
  const [selectedGenId, setSelectedGenId] = useState<string | null>(null);

  // Setup state
  const [mode, setMode] = useState<GenerationMode>('existing');
  const [characterName, setCharacterName] = useState(initialIllustration?.name || '');
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<2048 | 4096>(2048);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Character picker state (existing mode)
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterSearch, setCharacterSearch] = useState('');
  const [goldStandardRefs, setGoldStandardRefs] = useState<Illustration[]>([]);
  const [goldStandardLoading, setGoldStandardLoading] = useState(false);

  // New character post-generation state
  const [showSaveAsCharacter, setShowSaveAsCharacter] = useState(false);
  const [savingCharacter, setSavingCharacter] = useState(false);
  const [savedCharacterId, setSavedCharacterId] = useState<string | null>(null);

  // Source reference state
  const [selectedSources, setSelectedSources] = useState<Illustration[]>([]);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceResults, setSourceResults] = useState<Illustration[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const sourceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chat state
  const [messages, setMessages] = useState<IllustrationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<
    IllustrationChatResponse['generation'] | null
  >(null);

  // Auto-selected references (shown after generation when user didn't pick any)
  const [autoRefIds, setAutoRefIds] = useState<string[]>([]);
  const [autoRefIllustrations, setAutoRefIllustrations] = useState<Illustration[]>([]);

  // Error
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat messages if viewing existing
  useEffect(() => {
    if (initialIllustration) {
      getIllustrationMessages(initialIllustration.id)
        .then(setMessages)
        .catch(() => {});
    }
  }, [initialIllustration]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current);
    };
  }, []);

  // Load characters when in existing mode
  useEffect(() => {
    if (mode === 'existing' && characters.length === 0 && !charactersLoading) {
      setCharactersLoading(true);
      getCharacters()
        .then(setCharacters)
        .catch(() => {})
        .finally(() => setCharactersLoading(false));
    }
  }, [mode]);

  // Load gold standard refs when character is selected
  useEffect(() => {
    if (!selectedCharacterId) {
      setGoldStandardRefs([]);
      return;
    }
    setGoldStandardLoading(true);
    getIllustrations({ characterId: selectedCharacterId, goldStandard: 'true', limit: 50 })
      .then((data) => {
        setGoldStandardRefs(data.illustrations);
        // Auto-add gold standards as selected source references
        setSelectedSources(data.illustrations);
      })
      .catch(() => setGoldStandardRefs([]))
      .finally(() => setGoldStandardLoading(false));
  }, [selectedCharacterId]);

  // Handle character selection
  const handleSelectCharacter = useCallback((char: CharacterSummary) => {
    setSelectedCharacterId(char.id);
    setCharacterName(char.name);
  }, []);

  // Save as new character (new mode, post-generation)
  const handleSaveAsCharacter = useCallback(async () => {
    if (!characterName.trim() || !illustrationId) return;
    setSavingCharacter(true);
    try {
      const newChar = await createCharacter({ name: characterName.trim() });
      // Tag the generated illustration to this character
      await updateIllustration(illustrationId, { characterId: newChar.id });
      setSavedCharacterId(newChar.id);
      setShowSaveAsCharacter(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save character');
    } finally {
      setSavingCharacter(false);
    }
  }, [characterName, illustrationId]);

  // Filtered characters for search
  const filteredCharacters = characterSearch
    ? characters.filter(c => c.name.toLowerCase().includes(characterSearch.toLowerCase()))
    : characters;

  // Source search
  const searchSources = useCallback(async (query: string) => {
    setSourceLoading(true);
    try {
      const data = await getIllustrations({
        search: query || undefined,
        excludeArtType: 'CARTOON',
        limit: 20,
      });
      const sorted = data.illustrations.sort((a, b) => {
        const aGold = a.isGoldStandard ? (a.goldStandardType === 'TPOSE' ? 0 : 1) : 2;
        const bGold = b.isGoldStandard ? (b.goldStandardType === 'TPOSE' ? 0 : 1) : 2;
        return aGold - bGold;
      });
      setSourceResults(sorted);
    } catch {
      setSourceResults([]);
    } finally {
      setSourceLoading(false);
    }
  }, []);

  // Load initial source results when picker opens
  useEffect(() => {
    if (showSourcePicker) {
      searchSources('');
    }
  }, [showSourcePicker, searchSources]);

  const handleSourceSearchInput = useCallback((value: string) => {
    setSourceSearch(value);
    if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current);
    sourceDebounceRef.current = setTimeout(() => searchSources(value), 300);
  }, [searchSources]);

  const toggleSourceSelection = useCallback((ill: Illustration) => {
    setSelectedSources(prev => {
      const exists = prev.find(s => s.id === ill.id);
      if (exists) return prev.filter(s => s.id !== ill.id);
      return [...prev, ill];
    });
  }, []);

  // ── Polling ──
  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const result = await pollIllustrationStatus(id);

        if (result.status === 'COMPLETED' && result.generations) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setGenerations(result.generations);

          // If user didn't manually select references, show auto-selected ones
          if (selectedSources.length === 0 && result.referenceIds && result.referenceIds.length > 0) {
            setAutoRefIds(result.referenceIds);
            Promise.all(
              result.referenceIds.map(async (refId) => {
                try {
                  const resp = await fetch(`/api/illustrations/${refId}`);
                  if (resp.ok) return resp.json() as Promise<Illustration>;
                } catch { /* ignore */ }
                return null;
              })
            )
              .then((results) => {
                setAutoRefIllustrations(results.filter(Boolean) as Illustration[]);
              })
              .catch(() => {});
          }

          setPhase('review');
        } else if (result.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError(result.error || 'Generation failed');
          setPhase('review');
        }
      } catch {
        // Transient error, keep polling
      }
    }, 2000);
  }, []);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!characterName.trim() || !prompt.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await generateCharacterArt({
        name: characterName.trim(),
        prompt: prompt.trim(),
        resolution,
        referenceIds: selectedSources.map(s => s.id),
      });

      setIllustrationId(result.id);
      setIllustration({ id: result.id } as Illustration);
      setPhase('generating');
      setIsSubmitting(false);

      startPolling(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }, [characterName, prompt, resolution, selectedSources, startPolling]);

  // ── Regenerate ──
  const handleRegenerate = useCallback(() => {
    setPhase('setup');
    setGenerations([]);
    setSelectedGenId(null);
    setAutoRefIds([]);
    setAutoRefIllustrations([]);
    setShowSaveAsCharacter(false);
    setSavedCharacterId(null);
    setError(null);
  }, []);

  // ── Chat ──
  const handleSendMessage = useCallback(async () => {
    if (!illustrationId || !chatInput.trim() || isSending) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setIsSending(true);
    setError(null);

    // Optimistic user message
    const tempUserMsg: IllustrationMessage = {
      id: `temp-${Date.now()}`,
      illustrationId,
      role: 'user',
      content: userMsg,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await sendIllustrationChat(illustrationId, userMsg);

      // Add assistant response
      const assistantMsg: IllustrationMessage = {
        id: `temp-${Date.now()}-assistant`,
        illustrationId,
        role: 'assistant',
        content: result.response,
        metadata: result.generation || null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (result.generation) {
        setPendingGeneration(result.generation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [illustrationId, chatInput, isSending]);

  // ── Apply generation from chat ──
  const handleApplyGeneration = useCallback(async () => {
    if (!pendingGeneration || !illustrationId) return;

    try {
      setPhase('chat-generating');
      setError(null);
      setSelectedGenId(null);
      setPendingGeneration(null);

      // Re-generate with the AI-suggested params via the character art endpoint
      const result = await generateCharacterArt({
        name: characterName.trim(),
        prompt: pendingGeneration.prompt,
        resolution,
      });

      setIllustrationId(result.id);
      setIllustration({ id: result.id } as Illustration);
      startPolling(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('review');
    }
  }, [pendingGeneration, illustrationId, characterName, resolution, startPolling]);

  // ── Save to library ──
  const handleSave = useCallback(async () => {
    if (!illustrationId || !selectedGenId) return;

    try {
      await selectIllustrationVariant(illustrationId, selectedGenId);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, [illustrationId, selectedGenId, onComplete]);

  const isGenerating = phase === 'generating' || phase === 'chat-generating';
  const canGenerate = characterName.trim().length > 0 && prompt.trim().length > 0 && !isSubmitting;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center sm:p-4">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stc-purple-100 flex items-center justify-center">
              <UserIcon className="w-4 h-4 text-stc-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {illustration && characterName
                ? `Character Art: ${characterName}`
                : 'New Character Art'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Left panel */}
          <div className="flex-1 flex flex-col md:border-r border-neutral-100 min-w-0">
            {/* Setup phase */}
            {phase === 'setup' && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-lg mx-auto space-y-6">
                  {/* Mode Toggle */}
                  <div className="inline-flex p-1.5 bg-neutral-100 rounded-xl w-full">
                    <button
                      onClick={() => {
                        setMode('existing');
                        setCharacterName('');
                        setSelectedCharacterId(null);
                        setSelectedSources([]);
                        setGoldStandardRefs([]);
                      }}
                      className={`
                        flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                        ${mode === 'existing'
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700'
                        }
                      `}
                    >
                      Existing Character
                    </button>
                    <button
                      onClick={() => {
                        setMode('new');
                        setCharacterName('');
                        setSelectedCharacterId(null);
                        setSelectedSources([]);
                        setGoldStandardRefs([]);
                      }}
                      className={`
                        flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                        ${mode === 'new'
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700'
                        }
                      `}
                    >
                      New Character
                    </button>
                  </div>

                  {/* Character Name — Existing mode: picker */}
                  {mode === 'existing' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Select Character
                      </label>
                      <input
                        type="text"
                        value={selectedCharacterId ? characterName : characterSearch}
                        onChange={(e) => {
                          if (selectedCharacterId) {
                            // Clear selection when user types
                            setSelectedCharacterId(null);
                            setCharacterName('');
                            setGoldStandardRefs([]);
                            setSelectedSources([]);
                          }
                          setCharacterSearch(e.target.value);
                        }}
                        placeholder="Search characters..."
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm
                          focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                          placeholder:text-neutral-400 transition-shadow"
                        autoFocus
                      />
                      {/* Character grid */}
                      {!selectedCharacterId && (
                        <div className="mt-2 border border-neutral-200 rounded-xl overflow-hidden">
                          <div className="max-h-56 overflow-y-auto p-2">
                            {charactersLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <div className="animate-spin h-4 w-4 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
                              </div>
                            ) : filteredCharacters.length === 0 ? (
                              <p className="text-xs text-neutral-400 text-center py-4">No characters found</p>
                            ) : (
                              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                {filteredCharacters.map(char => (
                                  <button
                                    key={char.id}
                                    onClick={() => handleSelectCharacter(char)}
                                    className="flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent
                                      hover:border-stc-purple-300 hover:bg-stc-purple-50/50 transition-all"
                                  >
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                                      {char.thumbnailUrl ? (
                                        <img
                                          src={char.thumbnailUrl}
                                          alt={char.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <span className="text-sm text-neutral-400">{char.name.charAt(0)}</span>
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-neutral-700 font-medium text-center leading-tight line-clamp-2">
                                      {char.name}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Gold standard references */}
                      {selectedCharacterId && (
                        <div className="mt-3">
                          {goldStandardLoading ? (
                            <div className="flex items-center gap-2 py-2">
                              <div className="animate-spin h-3.5 w-3.5 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
                              <span className="text-xs text-neutral-400">Loading gold standard references...</span>
                            </div>
                          ) : goldStandardRefs.length > 0 ? (
                            <div>
                              <p className="text-xs font-medium text-neutral-500 mb-1.5 flex items-center gap-1">
                                <StarIconSolid className="w-3.5 h-3.5 text-amber-400" />
                                Gold Standard References ({goldStandardRefs.length})
                              </p>
                              <div className="flex gap-2 overflow-x-auto pb-1">
                                {goldStandardRefs.map((ref) => {
                                  const imgUrl = ref.illustrationUrl || ref.sourcePhotoUrl;
                                  const isTPose = ref.goldStandardType === 'T_POSE';
                                  return (
                                    <div key={ref.id} className="relative flex-shrink-0">
                                      <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                                        isTPose ? 'border-amber-400 ring-1 ring-amber-200' : 'border-stc-purple-200'
                                      }`}>
                                        {imgUrl ? (
                                          <img src={imgUrl} alt={ref.name} className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                            <span className="text-[10px] text-neutral-400">{ref.name.charAt(0)}</span>
                                          </div>
                                        )}
                                      </div>
                                      {isTPose && (
                                        <span className="absolute -top-1 -left-1 px-1 py-0.5 bg-amber-400 text-white text-[8px] font-bold rounded">
                                          T-Pose
                                        </span>
                                      )}
                                      <div className="absolute -top-1 -right-1">
                                        <StarIconSolid className="w-3.5 h-3.5 text-amber-400 drop-shadow-sm" />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-neutral-400 italic">No gold standard references for this character</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Character Name — New mode: free text */}
                  {mode === 'new' && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Character Name
                      </label>
                      <input
                        type="text"
                        value={characterName}
                        onChange={(e) => setCharacterName(e.target.value)}
                        placeholder="e.g. King Shaky, Queen Allegra..."
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm
                          focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                          placeholder:text-neutral-400 transition-shadow"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                      Prompt
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Describe the character art you want to generate..."
                      className="w-full min-h-[120px] p-4 rounded-xl border border-neutral-200 text-sm resize-y
                        focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                        placeholder:text-neutral-400 transition-shadow"
                    />
                  </div>

                  {/* Source References */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-neutral-700">
                        Reference Illustrations
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSourcePicker(prev => !prev)}
                        className="px-3 py-1.5 text-xs text-stc-purple-600 hover:text-stc-purple-700 hover:bg-stc-purple-50 font-medium rounded-lg transition-colors min-h-[36px]"
                      >
                        {showSourcePicker ? 'Hide picker' : '+ Add references'}
                      </button>
                    </div>

                    {/* Selected sources strip */}
                    {selectedSources.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                        {selectedSources.map((src, idx) => (
                          <div key={src.id} className="relative flex-shrink-0 group">
                            <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                              idx === 0 ? 'border-stc-purple-400' : 'border-neutral-200'
                            }`}>
                              {src.illustrationUrl || src.sourcePhotoUrl ? (
                                <img
                                  src={src.illustrationUrl || src.sourcePhotoUrl || ''}
                                  alt={src.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                  <span className="text-[10px] text-neutral-400">{src.name.charAt(0)}</span>
                                </div>
                              )}
                            </div>
                            {idx === 0 && (
                              <span className="absolute -top-1 -left-1 px-1 py-0.5 bg-stc-purple-500 text-white text-[8px] font-bold rounded">
                                Primary
                              </span>
                            )}
                            <button
                              onClick={() => setSelectedSources(prev => prev.filter(s => s.id !== src.id))}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-stc-pink text-white
                                flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Source picker */}
                    {showSourcePicker && (
                      <div className="border border-neutral-200 rounded-xl overflow-hidden">
                        <div className="p-2 border-b border-neutral-100">
                          <input
                            type="text"
                            value={sourceSearch}
                            onChange={(e) => handleSourceSearchInput(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-xs
                              focus:outline-none focus:ring-2 focus:ring-stc-purple-100 placeholder:text-neutral-400"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2">
                          {sourceLoading ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin h-4 w-4 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
                            </div>
                          ) : sourceResults.length === 0 ? (
                            <p className="text-xs text-neutral-400 text-center py-4">No illustrations found</p>
                          ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                              {sourceResults.map(ill => {
                                const isSelected = selectedSources.some(s => s.id === ill.id);
                                const imgUrl = ill.illustrationUrl || ill.sourcePhotoUrl;
                                return (
                                  <button
                                    key={ill.id}
                                    onClick={() => toggleSourceSelection(ill)}
                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                                      isSelected
                                        ? 'border-stc-purple-500 ring-1 ring-stc-purple-200'
                                        : 'border-transparent hover:border-neutral-300'
                                    }`}
                                  >
                                    {imgUrl ? (
                                      <img src={imgUrl} alt={ill.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                        <span className="text-[10px] text-neutral-400">{ill.name.charAt(0)}</span>
                                      </div>
                                    )}
                                    {ill.isGoldStandard && !isSelected && (
                                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                                        <StarIcon className="w-2.5 h-2.5 text-white fill-white" />
                                      </div>
                                    )}
                                    {isSelected && (
                                      <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-stc-purple-500 flex items-center justify-center">
                                        <CheckIcon className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="px-2 py-1.5 border-t border-neutral-100 bg-neutral-50">
                          <p className="text-[10px] text-neutral-400">
                            {selectedSources.length} selected — first = primary reference
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Resolution Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                      Resolution
                    </label>
                    <div className="inline-flex p-1.5 bg-neutral-100 rounded-xl">
                      <button
                        onClick={() => setResolution(2048)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                          ${resolution === 2048
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                          }
                        `}
                      >
                        2K (2048px)
                      </button>
                      <button
                        onClick={() => setResolution(4096)}
                        className={`
                          px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                          ${resolution === 4096
                            ? 'bg-white text-neutral-900 shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700'
                          }
                        `}
                      >
                        4K (4096px)
                      </button>
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={`
                      w-full py-3 rounded-xl text-sm font-semibold text-white min-h-[44px]
                      transition-all duration-200
                      ${canGenerate
                        ? 'bg-stc-purple-500 hover:bg-stc-purple-600 shadow-sm'
                        : 'bg-neutral-300 cursor-not-allowed'
                      }
                    `}
                  >
                    {isSubmitting ? 'Starting generation...' : 'Generate Character Art'}
                  </button>
                </div>
              </div>
            )}

            {/* Generating spinner */}
            {isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-stc-purple-200 animate-ping opacity-20" />
                  <svg
                    className="w-20 h-20 animate-spin"
                    viewBox="0 0 80 80"
                    fill="none"
                    style={{ animationDuration: '1.5s' }}
                  >
                    <circle cx="40" cy="40" r="35" stroke="#E8E3F0" strokeWidth="3" />
                    <path
                      d="M40 5a35 35 0 0 1 35 35"
                      stroke="url(#ca-grad)"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient
                        id="ca-grad"
                        x1="40"
                        y1="5"
                        x2="75"
                        y2="40"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#6A469D" />
                        <stop offset="1" stopColor="#50C8DF" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SparklesIcon className="w-8 h-8 text-stc-purple-500" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-neutral-800 animate-pulse">
                  Generating character art...
                </p>
                <p className="text-xs text-neutral-400">This may take 30-60 seconds</p>
              </div>
            )}

            {/* Review: show generated variants */}
            {phase === 'review' && generations.length > 0 && (
              <div className="flex-1 flex flex-col p-6 min-h-0">
                {/* Variants grid */}
                <p className="text-xs font-medium text-neutral-500 mb-2">
                  Generated Variants — Click to select
                </p>
                <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
                  {generations.map((gen) => {
                    const imgUrl = gen.savedImageUrl || gen.outputImageUrl;
                    const isSelected = selectedGenId === gen.id;

                    return (
                      <button
                        key={gen.id}
                        onClick={() => setSelectedGenId(gen.id)}
                        className={`
                          relative rounded-xl overflow-hidden border-2 transition-all duration-200
                          ${isSelected
                            ? 'border-stc-purple-500 ring-2 ring-stc-purple-200 scale-[1.01]'
                            : 'border-neutral-200 hover:border-stc-purple-300'
                          }
                        `}
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt="Variant"
                            className="w-full h-full object-contain bg-neutral-50"
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                            <span className="text-xs text-neutral-400">No image</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-stc-purple-500 flex items-center justify-center shadow-sm">
                            <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Auto-selected references */}
                {autoRefIllustrations.length > 0 && selectedSources.length === 0 && (
                  <div className="mt-3 px-3 py-2.5 bg-stc-purple-50/50 rounded-xl border border-stc-purple-100">
                    <p className="text-[11px] font-medium text-stc-purple-600 mb-1.5">
                      Auto-selected references ({autoRefIllustrations.length})
                    </p>
                    <div className="flex gap-1.5 overflow-x-auto">
                      {autoRefIllustrations.map((ref) => {
                        const imgUrl = ref.illustrationUrl || ref.sourcePhotoUrl;
                        return (
                          <div
                            key={ref.id}
                            className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-stc-purple-200 bg-white"
                            title={ref.name}
                          >
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={ref.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-stc-purple-400">
                                {ref.name.charAt(0)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action bar */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleRegenerate}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                      hover:bg-neutral-50 transition-colors min-h-[44px]"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!selectedGenId}
                    className={`
                      flex-1 py-2.5 rounded-xl text-sm font-semibold text-white min-h-[44px]
                      transition-all duration-200
                      ${selectedGenId
                        ? 'bg-stc-purple-500 hover:bg-stc-purple-600 shadow-sm'
                        : 'bg-neutral-300 cursor-not-allowed'
                      }
                    `}
                  >
                    Save to Library
                  </button>
                </div>

                {/* Save as New Character (new mode only) */}
                {mode === 'new' && !savedCharacterId && (
                  <button
                    onClick={handleSaveAsCharacter}
                    disabled={savingCharacter || !characterName.trim()}
                    className="w-full mt-2 py-2.5 rounded-xl text-sm font-medium border border-amber-300 text-amber-700
                      bg-amber-50 hover:bg-amber-100 transition-colors min-h-[44px] flex items-center justify-center gap-2
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <StarIcon className="w-4 h-4" />
                    {savingCharacter ? 'Saving...' : 'Save as New Character'}
                  </button>
                )}
                {mode === 'new' && savedCharacterId && (
                  <div className="mt-2 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 flex-shrink-0" />
                    Character saved and illustration tagged
                  </div>
                )}
              </div>
            )}

            {/* Review with no generations (error state) */}
            {phase === 'review' && generations.length === 0 && error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-stc-pink/10 flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-6 h-6 text-stc-pink" />
                </div>
                <p className="text-sm text-neutral-600">{error}</p>
                <button
                  onClick={handleRegenerate}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500 hover:bg-stc-purple-600 min-h-[44px]"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Right: Chat panel */}
          {illustration && (
            <div className="w-full md:w-[380px] flex flex-col bg-neutral-50 border-t md:border-t-0 border-neutral-100 max-h-[50vh] md:max-h-none">
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-neutral-200 bg-white">
                <h3 className="text-sm font-semibold text-neutral-800">AI Illustrator</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Describe changes and I'll refine the character art
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.length === 0 && !isSending && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto rounded-full bg-stc-purple-100 flex items-center justify-center mb-3">
                      <ChatBubbleLeftRightIcon className="w-6 h-6 text-stc-purple-500" />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Tell me how you'd like the character art refined
                    </p>
                    <div className="mt-4 space-y-2">
                      {[
                        'Make the character more expressive with bigger eyes',
                        'Match the existing Acme Creative illustration style',
                        'Simplify the design for younger audiences',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setChatInput(suggestion)}
                          className="block w-full text-left px-3 py-2 rounded-lg text-xs text-neutral-600
                            bg-white border border-neutral-200 hover:border-stc-purple-300 hover:bg-stc-purple-50/50
                            transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-stc-purple-500 text-white rounded-br-md'
                          : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md'
                        }
                      `}
                    >
                      <p>{msg.content}</p>
                      {msg.role === 'assistant' && msg.metadata?.prompt && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <p className="text-xs text-neutral-400 mb-1">Suggested generation:</p>
                          <p className="text-xs text-neutral-500 font-mono truncate">
                            {msg.metadata.prompt.substring(0, 60)}...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-white text-neutral-400 border border-neutral-200 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                          style={{ animationDelay: '0ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Generate button (if AI suggested params) */}
              {pendingGeneration && !isGenerating && (
                <div className="px-4 py-2 border-t border-neutral-200 bg-stc-purple-50">
                  <button
                    onClick={handleApplyGeneration}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                      bg-stc-purple-500 hover:bg-stc-purple-600 transition-colors min-h-[44px]
                      flex items-center justify-center gap-2"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Generate with AI suggestion
                  </button>
                </div>
              )}

              {/* Chat input */}
              <div className="p-3 border-t border-neutral-200 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Describe changes..."
                    disabled={isSending || isGenerating}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                      placeholder:text-neutral-400 disabled:opacity-50 transition-shadow"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isSending || isGenerating}
                    className={`
                      p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center
                      transition-colors
                      ${chatInput.trim() && !isSending && !isGenerating
                        ? 'bg-stc-purple-500 text-white hover:bg-stc-purple-600'
                        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && phase !== 'review' && (
          <div className="px-6 py-3 bg-stc-pink/10 border-t border-red-100">
            <p className="text-sm text-stc-pink">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
