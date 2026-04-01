import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MicrophoneIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  DocumentTextIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid, PauseIcon as PauseIconSolid } from '@heroicons/react/20/solid';
import type { CharacterVoice, AudioScriptSummary, ModuleWithLessons } from '../../lib/types';
import { getCharacterVoices, deleteCharacterVoice, getAudioScripts, generateAllLines, getModulesWithLessons } from '../../lib/api';
import type { SidebarFilter } from '../illustrations/IllustrationsSidebar';

type Tab = 'voices' | 'scripts';

interface AudioModuleProps {
  sidebarFilter?: SidebarFilter;
}

export default function AudioModule({ sidebarFilter }: AudioModuleProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('voices');

  // ─── Voices state ───
  const [voices, setVoices] = useState<CharacterVoice[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CharacterVoice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ─── Scripts state ───
  const [scripts, setScripts] = useState<AudioScriptSummary[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(true);
  const [scriptSearch, setScriptSearch] = useState('');
  const [lessonFilter, setLessonFilter] = useState('');
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [selectedScripts, setSelectedScripts] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ─── Voices fetching ───
  const fetchVoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { search?: string; limit?: number; character?: string } = { limit: 50 };
      if (search) params.search = search;
      // When a character sidebar filter is active, filter voices by character name
      if (sidebarFilter?.type === 'character') params.character = sidebarFilter.name;
      const data = await getCharacterVoices(params);
      if (isMountedRef.current) {
        setVoices(data.voices);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [search, sidebarFilter]);

  useEffect(() => { fetchVoices(); }, [fetchVoices]);

  // ─── Scripts fetching ───
  const fetchScripts = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const params: { search?: string; lessonId?: string; limit?: number } = { limit: 100 };
      if (scriptSearch) params.search = scriptSearch;
      // Sidebar lesson filter takes precedence over the inline dropdown
      if (sidebarFilter?.type === 'lesson') {
        params.lessonId = sidebarFilter.id;
      } else if (lessonFilter) {
        params.lessonId = lessonFilter;
      }
      const data = await getAudioScripts(params);
      if (isMountedRef.current) {
        setScripts(data);
      }
    } catch (error) {
      console.error('Failed to load scripts:', error);
    } finally {
      if (isMountedRef.current) setScriptsLoading(false);
    }
  }, [scriptSearch, lessonFilter, sidebarFilter]);

  // Fetch scripts when Scripts tab is active
  useEffect(() => {
    if (activeTab === 'scripts') fetchScripts();
  }, [activeTab, fetchScripts]);

  // Fetch modules for lesson filter dropdown
  useEffect(() => {
    if (activeTab === 'scripts' && modules.length === 0) {
      getModulesWithLessons().then(data => {
        if (isMountedRef.current) setModules(data);
      }).catch(err => console.error('Failed to load modules:', err));
    }
  }, [activeTab, modules.length]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlay = useCallback((voice: CharacterVoice) => {
    if (!voice.sampleUrl) return;
    if (playingId === voice.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(voice.sampleUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(voice.id);
  }, [playingId]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCharacterVoice(deleteTarget.id);
      setVoices(prev => prev.filter(v => v.id !== deleteTarget.id));
      setTotal(prev => prev - 1);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget]);

  // Escape key to dismiss delete modal
  useEffect(() => {
    if (!deleteTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteTarget(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget]);

  // ─── Batch generate ───
  const toggleScriptSelection = (scriptId: string) => {
    setSelectedScripts(prev => {
      const next = new Set(prev);
      if (next.has(scriptId)) next.delete(scriptId);
      else next.add(scriptId);
      return next;
    });
  };

  const handleBatchGenerate = async () => {
    const ids = Array.from(selectedScripts);
    if (ids.length === 0) return;
    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        if (!isMountedRef.current) break;
        setBatchProgress({ current: i + 1, total: ids.length });
        await generateAllLines(ids[i]);
      }
      setSelectedScripts(new Set());
      fetchScripts();
    } catch (error) {
      console.error('Batch generate failed:', error);
    } finally {
      if (isMountedRef.current) setBatchGenerating(false);
    }
  };

  // Color palette for voice cards
  const colors = ['bg-stc-purple-100', 'bg-stc-blue/15', 'bg-stc-green/15', 'bg-stc-orange/15', 'bg-stc-pink/15', 'bg-stc-blue/15'];

  // Helper: line progress color
  const lineProgressColor = (completed: number, total: number) => {
    if (total === 0) return 'bg-neutral-300';
    if (completed === total) return 'bg-stc-green';
    if (completed > 0) return 'bg-stc-orange';
    return 'bg-neutral-300';
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Audio</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Design character voices and generate dialogue
            </p>
          </div>
          {activeTab === 'voices' && total > 0 && (
            <span className="text-xs text-neutral-400">
              {total} voice{total !== 1 ? 's' : ''}
            </span>
          )}
          {activeTab === 'scripts' && scripts.length > 0 && (
            <span className="text-xs text-neutral-400">
              {scripts.length} script{scripts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 p-1.5 bg-neutral-100 rounded-xl self-start w-fit">
          <button
            onClick={() => setActiveTab('voices')}
            className={`
              px-5 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200 min-h-[40px]
              ${activeTab === 'voices'
                ? 'bg-white text-stc-purple-600 shadow-sm ring-1 ring-neutral-200/50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }
            `}
          >
            Voices
          </button>
          <button
            onClick={() => setActiveTab('scripts')}
            className={`
              px-5 py-2.5 rounded-lg text-sm font-medium
              transition-all duration-200 min-h-[40px]
              ${activeTab === 'scripts'
                ? 'bg-white text-stc-purple-600 shadow-sm ring-1 ring-neutral-200/50'
                : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
              }
            `}
          >
            Scripts
          </button>
        </div>

        {/* ═══════════════════════ VOICES TAB ═══════════════════════ */}
        {activeTab === 'voices' && (
          <>
            {/* Create Voice button */}
            <button
              onClick={() => navigate('/audio/create')}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-neutral-300
                hover:border-stc-purple-300 hover:bg-stc-purple-50/50 transition-all duration-200
                flex items-center justify-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-stc-purple-100 flex items-center justify-center transition-colors">
                <MicrophoneIcon className="w-5 h-5 text-neutral-400 group-hover:text-stc-purple-500 transition-colors" />
              </div>
              <span className="text-sm font-medium text-neutral-500 group-hover:text-stc-purple-600 transition-colors">
                Design New Voice
              </span>
            </button>

            {/* Search */}
            {total > 0 && (
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search voices..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-neutral-50 shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 focus:bg-white
                    placeholder:text-neutral-400 transition-all min-h-[44px]"
                />
              </div>
            )}

            {/* Voice Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-neutral-200 rounded-2xl h-40" />
                ))}
              </div>
            ) : voices.length === 0 ? (
              <div className="text-center py-16">
                <MicrophoneIcon className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-500 text-sm">No character voices yet</p>
                <p className="text-neutral-400 text-xs mt-1">Design your first voice to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {voices.map((voice, idx) => (
                  <div
                    key={voice.id}
                    className="bg-white rounded-2xl shadow-card p-5 hover:shadow-card-hover hover:scale-[1.02]
                      transition-all duration-200 cursor-pointer group relative"
                    onClick={() => navigate(`/audio/${voice.id}`)}
                  >
                    {/* Color accent + Play */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`w-12 h-12 rounded-xl ${colors[idx % colors.length]} flex items-center justify-center flex-shrink-0`}>
                        <MicrophoneIcon className="w-6 h-6 text-neutral-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-900 truncate">{voice.name}</h3>
                        {voice.character && (
                          <span className="text-xs text-stc-purple-600 font-medium">{voice.character}</span>
                        )}
                      </div>
                      {voice.sampleUrl && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePlay(voice); }}
                          className="w-9 h-9 rounded-full bg-stc-purple-500 hover:bg-stc-purple-600 flex items-center
                            justify-center transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
                          aria-label={playingId === voice.id ? 'Pause' : 'Play sample'}
                        >
                          {playingId === voice.id ? (
                            <PauseIconSolid className="w-4 h-4 text-white" />
                          ) : (
                            <PlayIconSolid className="w-4 h-4 text-white ml-0.5" />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 line-clamp-2">{voice.description}</p>

                    {/* Delete button (top-right on hover) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(voice); }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm
                        flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200
                        hover:bg-stc-pink/10 text-neutral-500 hover:text-stc-pink min-h-[44px] min-w-[44px]"
                      aria-label={`Delete ${voice.name}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════ SCRIPTS TAB ═══════════════════════ */}
        {activeTab === 'scripts' && (
          <>
            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search scripts..."
                  value={scriptSearch}
                  onChange={(e) => setScriptSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-neutral-50 shadow-sm
                    focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 focus:bg-white
                    placeholder:text-neutral-400 transition-all min-h-[44px]"
                />
              </div>
              <select
                value={lessonFilter}
                onChange={(e) => setLessonFilter(e.target.value)}
                className="px-4 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                  focus:outline-none focus:ring-2 focus:ring-stc-purple-100 shadow-sm
                  bg-white sm:w-64"
              >
                <option value="">All Lessons</option>
                {modules.map(mod => (
                  <optgroup key={mod.id} label={`${mod.code} — ${mod.title}`}>
                    {mod.lessons.map(lesson => (
                      <option key={lesson.id} value={lesson.id}>
                        L{lesson.lessonNumber}: {lesson.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Script Cards */}
            {scriptsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-neutral-200 rounded-2xl h-40" />
                ))}
              </div>
            ) : scripts.length === 0 ? (
              <div className="text-center py-16">
                <DocumentTextIcon className="w-16 h-16 mx-auto mb-4 text-neutral-300" />
                <p className="text-neutral-500 text-sm">No scripts yet.</p>
                <p className="text-neutral-400 text-xs mt-1">Create scripts from a voice&apos;s detail page.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {scripts.map(script => {
                  const { total: lineTotal, completed } = script.lineStats;
                  const pct = lineTotal > 0 ? (completed / lineTotal) * 100 : 0;
                  const hasIncomplete = lineTotal > 0 && completed < lineTotal;

                  return (
                    <div
                      key={script.id}
                      className="bg-white rounded-2xl border border-neutral-200 p-5 hover:shadow-md
                        transition-all duration-200 cursor-pointer group relative"
                      onClick={() => navigate(`/audio/${script.characterVoice.id}?script=${script.id}`)}
                    >
                      {/* Checkbox (top-right, on hover, only for incomplete scripts) */}
                      {hasIncomplete && (
                        <div
                          className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="flex items-center justify-center w-8 h-8 min-h-[44px] min-w-[44px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedScripts.has(script.id)}
                              onChange={() => toggleScriptSelection(script.id)}
                              className="w-4 h-4 rounded border-neutral-300 text-stc-purple-500
                                focus:ring-stc-purple-300 cursor-pointer"
                            />
                          </label>
                        </div>
                      )}
                      {/* Always-visible checkbox when selected */}
                      {selectedScripts.has(script.id) && (
                        <div
                          className="absolute top-3 right-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="flex items-center justify-center w-8 h-8 min-h-[44px] min-w-[44px] cursor-pointer">
                            <input
                              type="checkbox"
                              checked
                              onChange={() => toggleScriptSelection(script.id)}
                              className="w-4 h-4 rounded border-neutral-300 text-stc-purple-500
                                focus:ring-stc-purple-300 cursor-pointer"
                            />
                          </label>
                        </div>
                      )}

                      {/* Script name */}
                      <h3 className="font-semibold text-neutral-900 truncate pr-10 mb-2">{script.name}</h3>

                      {/* Voice name + character badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-neutral-600">{script.characterVoice.name}</span>
                        {script.characterVoice.character && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-stc-orange/15 text-stc-orange">
                            {script.characterVoice.character}
                          </span>
                        )}
                      </div>

                      {/* Lesson tag */}
                      {script.lesson && (
                        <div className="mb-3">
                          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-stc-purple-50 text-stc-purple-600">
                            {script.lesson.module.code} &middot; L{script.lesson.lessonNumber}: {script.lesson.title}
                          </span>
                        </div>
                      )}

                      {/* Line progress */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-neutral-500">
                            {completed}/{lineTotal} lines
                          </span>
                          {script.stitchedUrl && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-stc-green/15 text-stc-green">
                              Ready
                            </span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${lineProgressColor(completed, lineTotal)}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Floating batch action bar */}
            {selectedScripts.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] sm:w-auto max-w-lg">
                <div className="bg-neutral-900 text-white rounded-2xl shadow-xl px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
                  <span className="text-sm">
                    {selectedScripts.size} selected
                  </span>
                  <button
                    onClick={handleBatchGenerate}
                    disabled={batchGenerating}
                    className="px-5 py-2.5 rounded-xl bg-stc-purple-500 hover:bg-stc-purple-600
                      text-sm font-medium transition-colors min-h-[44px]
                      disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {batchGenerating ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Generating {batchProgress.current}/{batchProgress.total}...
                      </>
                    ) : (
                      `Generate ${selectedScripts.size} selected`
                    )}
                  </button>
                  {!batchGenerating && (
                    <button
                      onClick={() => setSelectedScripts(new Set())}
                      className="text-neutral-400 hover:text-white transition-colors text-sm min-h-[44px] px-2"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 text-center">
              {/* Warning icon */}
              <div className="w-12 h-12 rounded-full bg-stc-pink/10 flex items-center justify-center mx-auto mb-4">
                <TrashIcon className="w-6 h-6 text-stc-pink" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800 mb-1">Delete voice?</h3>
              <p className="text-sm text-neutral-500">
                &ldquo;{deleteTarget.name}&rdquo; and all its scripts and audio lines will be permanently deleted. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                  hover:bg-neutral-50 transition-colors min-h-[44px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-pink
                  hover:bg-stc-pink active:bg-stc-pink transition-colors shadow-sm min-h-[44px]
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
