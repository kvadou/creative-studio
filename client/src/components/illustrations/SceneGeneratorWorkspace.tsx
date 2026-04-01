import { useState, useRef, useCallback, useEffect } from 'react';
import {
  XMarkIcon,
  SparklesIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import type {
  Illustration,
  IllustrationGeneration,
  CharacterSummary,
  ModuleWithLessons,
} from '../../lib/types';
import {
  generateCharacterArt,
  pollIllustrationStatus,
  selectIllustrationVariant,
  getIllustrations,
  getCharacters,
  getModulesWithLessons,
} from '../../lib/api';

interface SceneGeneratorWorkspaceProps {
  onComplete: () => void;
  onClose: () => void;
}

type Phase = 'setup' | 'generating' | 'review';

export default function SceneGeneratorWorkspace({
  onComplete,
  onClose,
}: SceneGeneratorWorkspaceProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [illustrationId, setIllustrationId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<IllustrationGeneration[]>([]);
  const [selectedGenId, setSelectedGenId] = useState<string | null>(null);

  // Setup state
  const [sceneName, setSceneName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Story reference
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [selectedLessonLabel, setSelectedLessonLabel] = useState('');

  // Characters
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(new Set());
  const [characterGoldStandards, setCharacterGoldStandards] = useState<Map<string, Illustration[]>>(new Map());

  // Background reference
  const [backgrounds, setBackgrounds] = useState<Illustration[]>([]);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(null);

  // Manual reference illustrations
  const [selectedSources, setSelectedSources] = useState<Illustration[]>([]);
  const [sourceSearch, setSourceSearch] = useState('');
  const [sourceResults, setSourceResults] = useState<Illustration[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const sourceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load characters + modules + backgrounds on mount
  useEffect(() => {
    getCharacters().then(setCharacters).catch(() => {});
    getModulesWithLessons().then(setModules).catch(() => {});
    getIllustrations({ artType: 'BACKGROUND', limit: 100 })
      .then((data) => setBackgrounds(data.illustrations))
      .catch(() => {});
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current);
    };
  }, []);

  // Load gold standard images when characters are selected
  const loadGoldStandards = useCallback(async (charId: string) => {
    if (characterGoldStandards.has(charId)) return;
    try {
      const data = await getIllustrations({ characterId: charId, limit: 50 });
      const goldOnes = data.illustrations.filter(
        (ill) => ill.isGoldStandard || ill.isReferenceEnabled
      );
      setCharacterGoldStandards((prev) => new Map(prev).set(charId, goldOnes));
    } catch {
      // ignore
    }
  }, [characterGoldStandards]);

  const toggleCharacter = useCallback((charId: string) => {
    setSelectedCharacterIds((prev) => {
      const next = new Set(prev);
      if (next.has(charId)) {
        next.delete(charId);
      } else {
        next.add(charId);
        loadGoldStandards(charId);
      }
      return next;
    });
  }, [loadGoldStandards]);

  // Source search for manual references
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

  useEffect(() => {
    if (showSourcePicker) searchSources('');
  }, [showSourcePicker, searchSources]);

  const handleSourceSearchInput = useCallback((value: string) => {
    setSourceSearch(value);
    if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current);
    sourceDebounceRef.current = setTimeout(() => searchSources(value), 300);
  }, [searchSources]);

  const toggleSourceSelection = useCallback((ill: Illustration) => {
    setSelectedSources((prev) => {
      const exists = prev.find((s) => s.id === ill.id);
      if (exists) return prev.filter((s) => s.id !== ill.id);
      return [...prev, ill];
    });
  }, []);

  // Build the full prompt
  const buildFullPrompt = useCallback(() => {
    const parts: string[] = [];

    parts.push(`Scene: ${sceneName.trim()}`);

    // Story context
    if (selectedLessonId) {
      parts.push(`Story Context: ${selectedLessonLabel}`);
    }

    // Characters
    const selectedChars = characters.filter((c) => selectedCharacterIds.has(c.id));
    if (selectedChars.length > 0) {
      const charList = selectedChars.map((c) => {
        const details = [c.name];
        if (c.piece) details.push(`(${c.piece})`);
        if (c.trait) details.push(`- ${c.trait}`);
        return details.join(' ');
      }).join(', ');
      parts.push(`Characters in this scene: ${charList}`);
    }

    // Background
    const selectedBg = backgrounds.find((b) => b.id === selectedBackgroundId);
    if (selectedBg) {
      parts.push(`Background: ${selectedBg.name}${selectedBg.description ? ` — ${selectedBg.description}` : ''}`);
    }

    parts.push('');
    parts.push(`User description: ${prompt.trim()}`);
    parts.push('');
    parts.push('IMPORTANT: Draw ONLY the characters listed above. Use their exact designs from the reference images. The setting should match the Chesslandia world.');

    return parts.join('\n');
  }, [sceneName, selectedLessonId, selectedLessonLabel, characters, selectedCharacterIds, backgrounds, selectedBackgroundId, prompt]);

  // Collect all reference IDs
  const collectReferenceIds = useCallback((): string[] => {
    const ids = new Set<string>();

    // Gold standards from selected characters
    for (const charId of selectedCharacterIds) {
      const golds = characterGoldStandards.get(charId) || [];
      golds.forEach((g) => ids.add(g.id));
    }

    // Background reference
    if (selectedBackgroundId) ids.add(selectedBackgroundId);

    // Manual picks
    selectedSources.forEach((s) => ids.add(s.id));

    return Array.from(ids);
  }, [selectedCharacterIds, characterGoldStandards, selectedBackgroundId, selectedSources]);

  // Polling
  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const result = await pollIllustrationStatus(id);

        if (result.status === 'COMPLETED' && result.generations) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setGenerations(result.generations);
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

  // Generate
  const handleGenerate = useCallback(async () => {
    if (!sceneName.trim() || !prompt.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const fullPrompt = buildFullPrompt();
      const referenceIds = collectReferenceIds();

      const result = await generateCharacterArt({
        name: sceneName.trim(),
        prompt: fullPrompt,
        resolution: 2048,
        referenceIds,
      });

      setIllustrationId(result.id);
      setPhase('generating');
      setIsSubmitting(false);

      startPolling(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }, [sceneName, prompt, buildFullPrompt, collectReferenceIds, startPolling]);

  // Regenerate
  const handleRegenerate = useCallback(() => {
    setPhase('setup');
    setGenerations([]);
    setSelectedGenId(null);
    setError(null);
  }, []);

  // Save
  const handleSave = useCallback(async () => {
    if (!illustrationId || !selectedGenId) return;

    try {
      await selectIllustrationVariant(illustrationId, selectedGenId);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, [illustrationId, selectedGenId, onComplete]);

  const canGenerate = sceneName.trim().length > 0 && prompt.trim().length > 0 && !isSubmitting;

  // Total auto-loaded references count
  const autoRefCount = collectReferenceIds().length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center sm:p-4">
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-6xl h-full sm:h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stc-purple-100 flex items-center justify-center">
              <PhotoIcon className="w-4 h-4 text-stc-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {sceneName ? `Scene: ${sceneName}` : 'New Scene'}
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
        <div className="flex-1 flex flex-col min-h-0">
          {/* Setup phase */}
          {phase === 'setup' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Scene Name */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Scene Name <span className="text-stc-pink">*</span>
                  </label>
                  <input
                    type="text"
                    value={sceneName}
                    onChange={(e) => setSceneName(e.target.value)}
                    placeholder="e.g. King Shaky's Grand Entrance, Castle Siege..."
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                      placeholder:text-neutral-400 transition-shadow"
                    autoFocus
                  />
                </div>

                {/* Story Reference */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Story Reference
                    <span className="ml-1.5 text-xs text-neutral-400 font-normal">optional — provides story context to the AI</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedLessonId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedLessonId(val || null);
                        if (val) {
                          // Find the label
                          for (const mod of modules) {
                            const lesson = mod.lessons.find((l) => l.id === val);
                            if (lesson) {
                              setSelectedLessonLabel(`${mod.code} — Lesson ${lesson.lessonNumber}: ${lesson.title}`);
                              break;
                            }
                          }
                        } else {
                          setSelectedLessonLabel('');
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm bg-white appearance-none
                        focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                        transition-shadow min-h-[44px]"
                    >
                      <option value="">No story reference</option>
                      {modules.map((mod) => (
                        <optgroup key={mod.id} label={`${mod.code} — ${mod.title}`}>
                          {mod.lessons.map((lesson) => (
                            <option key={lesson.id} value={lesson.id}>
                              Lesson {lesson.lessonNumber}: {lesson.title}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                  </div>
                </div>

                {/* Characters to Include */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Characters to Include
                    <span className="ml-1.5 text-xs text-neutral-400 font-normal">gold standard images auto-loaded as references</span>
                  </label>
                  {characters.length === 0 ? (
                    <p className="text-xs text-neutral-400">Loading characters...</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                      {characters.map((char) => {
                        const isSelected = selectedCharacterIds.has(char.id);
                        const goldCount = characterGoldStandards.get(char.id)?.length || 0;
                        return (
                          <button
                            key={char.id}
                            onClick={() => toggleCharacter(char.id)}
                            className={`
                              flex items-center gap-2 p-2 rounded-xl border-2 text-left transition-all min-h-[44px]
                              ${isSelected
                                ? 'border-stc-purple-500 bg-stc-purple-50 ring-1 ring-stc-purple-200'
                                : 'border-neutral-200 hover:border-neutral-300 bg-white'
                              }
                            `}
                          >
                            <div className="w-8 h-8 rounded-lg overflow-hidden bg-neutral-100 flex-shrink-0">
                              {char.thumbnailUrl ? (
                                <img src={char.thumbnailUrl} alt={char.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
                                  {char.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-neutral-800 truncate">{char.name}</p>
                              {char.piece && (
                                <p className="text-[10px] text-neutral-400 truncate">{char.piece}</p>
                              )}
                            </div>
                            {isSelected && (
                              <div className="flex-shrink-0">
                                <CheckIcon className="w-4 h-4 text-stc-purple-500" strokeWidth={3} />
                              </div>
                            )}
                            {isSelected && goldCount > 0 && (
                              <span className="absolute -top-1 -right-1 text-[9px] bg-stc-purple-500 text-white px-1 rounded-full">
                                {goldCount} ref
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedCharacterIds.size > 0 && (
                    <p className="mt-1.5 text-[11px] text-stc-purple-500">
                      {selectedCharacterIds.size} character{selectedCharacterIds.size > 1 ? 's' : ''} selected
                      {autoRefCount > 0 && ` — ${autoRefCount} reference image${autoRefCount > 1 ? 's' : ''} auto-loaded`}
                    </p>
                  )}
                </div>

                {/* Background Reference */}
                {backgrounds.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                      Background Reference
                      <span className="ml-1.5 text-xs text-neutral-400 font-normal">optional</span>
                    </label>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {backgrounds.map((bg) => {
                        const isSelected = selectedBackgroundId === bg.id;
                        const imgUrl = bg.illustrationUrl || bg.sourcePhotoUrl;
                        return (
                          <button
                            key={bg.id}
                            onClick={() => setSelectedBackgroundId(isSelected ? null : bg.id)}
                            className={`
                              relative flex-shrink-0 w-24 rounded-xl overflow-hidden border-2 transition-all
                              ${isSelected
                                ? 'border-stc-purple-500 ring-1 ring-stc-purple-200'
                                : 'border-neutral-200 hover:border-neutral-300'
                              }
                            `}
                          >
                            <div className="aspect-[4/3]">
                              {imgUrl ? (
                                <img src={imgUrl} alt={bg.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                  <PhotoIcon className="w-5 h-5 text-neutral-300" />
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-neutral-600 p-1 truncate text-center">{bg.name}</p>
                            {isSelected && (
                              <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-stc-purple-500 flex items-center justify-center">
                                <CheckIcon className="w-3 h-3 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                    Scene Description <span className="text-stc-pink">*</span>
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what's happening in the scene — character actions, mood, composition..."
                    className="w-full min-h-[120px] p-4 rounded-xl border border-neutral-200 text-sm resize-y
                      focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                      placeholder:text-neutral-400 transition-shadow"
                  />
                </div>

                {/* Reference Illustrations (manual) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-neutral-700">
                      Additional References
                      <span className="ml-1.5 text-xs text-neutral-400 font-normal">optional — pick extra style references</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowSourcePicker((prev) => !prev)}
                      className="px-3 py-1.5 text-xs text-stc-purple-600 hover:text-stc-purple-700 hover:bg-stc-purple-50 font-medium rounded-lg transition-colors min-h-[36px]"
                    >
                      {showSourcePicker ? 'Hide picker' : '+ Add references'}
                    </button>
                  </div>

                  {/* Selected sources strip */}
                  {selectedSources.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2">
                      {selectedSources.map((src) => (
                        <div key={src.id} className="relative flex-shrink-0 group">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-neutral-200">
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
                          <button
                            onClick={() => setSelectedSources((prev) => prev.filter((s) => s.id !== src.id))}
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
                        <div className="relative">
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                          <input
                            type="text"
                            value={sourceSearch}
                            onChange={(e) => handleSourceSearchInput(e.target.value)}
                            placeholder="Search by name..."
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-neutral-200 text-xs
                              focus:outline-none focus:ring-2 focus:ring-stc-purple-100 placeholder:text-neutral-400"
                          />
                        </div>
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
                            {sourceResults.map((ill) => {
                              const isSelected = selectedSources.some((s) => s.id === ill.id);
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
                          {selectedSources.length} selected
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className={`
                    w-full py-3.5 rounded-xl text-sm font-semibold text-white min-h-[48px]
                    transition-all duration-200 flex items-center justify-center gap-2
                    ${canGenerate
                      ? 'bg-gradient-to-r from-stc-purple-500 to-stc-purple-600 hover:from-stc-purple-600 hover:to-stc-purple-700 shadow-sm'
                      : 'bg-neutral-300 cursor-not-allowed'
                    }
                  `}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Starting generation...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4" />
                      Generate Scene
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Generating spinner */}
          {phase === 'generating' && (
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
                    stroke="url(#scene-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient
                      id="scene-grad"
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
                Generating scene...
              </p>
              <p className="text-xs text-neutral-400">This may take 30-60 seconds</p>
            </div>
          )}

          {/* Review: show generated variants */}
          {phase === 'review' && generations.length > 0 && (
            <div className="flex-1 flex flex-col p-6 min-h-0">
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
