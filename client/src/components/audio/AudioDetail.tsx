import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  PlayIcon,
  StopIcon,
  PlayCircleIcon,
  LinkIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid, PauseIcon as PauseIconSolid } from '@heroicons/react/20/solid';
import type { CharacterVoice, AudioScript, AudioLine, ModuleWithLessons } from '../../lib/types';
import ScriptTimeline from './ScriptTimeline';
import {
  getCharacterVoice,
  updateCharacterVoice,
  deleteCharacterVoice,
  generateSpeech,
  createAudioScript,
  addAudioLine,
  generateAudioLine,
  deleteAudioLine,
  stitchScript,
  generateAllLines,
  deleteAudioScript,
  updateAudioScript,
  reorderAudioLine,
  getAudioScript,
  getModulesWithLessons,
} from '../../lib/api';

/** Backend nests scripts (with lines) into the voice GET response */
type CharacterVoiceWithScripts = CharacterVoice & { scripts?: AudioScript[] };

/** Spinner reused everywhere */
function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <ArrowPathIcon className={`${className} animate-spin`} />;
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [voice, setVoice] = useState<CharacterVoiceWithScripts | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [character, setCharacter] = useState('');
  const [saving, setSaving] = useState(false);

  // Lesson picker for new scripts
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [newScriptLessonId, setNewScriptLessonId] = useState('');

  // Test TTS
  const [testText, setTestText] = useState('');
  const [testGenerating, setTestGenerating] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  // Script editor
  const [activeScript, setActiveScript] = useState<AudioScript | null>(null);
  const [newScriptName, setNewScriptName] = useState('');
  const [showNewScriptInput, setShowNewScriptInput] = useState(false);
  const [newLineText, setNewLineText] = useState('');
  const [newLineEmotion, setNewLineEmotion] = useState('neutral');
  const [generatingLineId, setGeneratingLineId] = useState<string | null>(null);

  // Script name editing
  const [editingScriptName, setEditingScriptName] = useState(false);
  const [editScriptNameValue, setEditScriptNameValue] = useState('');

  // Generate all
  const [generatingAll, setGeneratingAll] = useState(false);

  // Stitch
  const [stitching, setStitching] = useState(false);

  // Play All (sequential playback)
  const [playAllActive, setPlayAllActive] = useState(false);
  const [playingLineIndex, setPlayingLineIndex] = useState<number | null>(null);

  // Playback
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Delete voice
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete script
  const [showDeleteScript, setShowDeleteScript] = useState(false);
  const [deletingScript, setDeletingScript] = useState(false);

  // Reordering
  const [reorderingLineId, setReorderingLineId] = useState<string | null>(null);

  // Fetch modules for lesson picker
  useEffect(() => {
    getModulesWithLessons().then(setModules).catch(console.error);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCharacterVoice(id)
      .then((v) => {
        const vWithScripts = v as CharacterVoiceWithScripts;
        setVoice(vWithScripts);
        setName(vWithScripts.name);
        setCharacter(vWithScripts.character || '');
        // Auto-select script from query param, or fall back to first
        const scriptParam = searchParams.get('script');
        const matchedScript = scriptParam && vWithScripts.scripts?.find(s => s.id === scriptParam);
        if (matchedScript) {
          setActiveScript(matchedScript);
        } else if (vWithScripts.scripts && vWithScripts.scripts.length > 0) {
          setActiveScript(vWithScripts.scripts[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, searchParams]);

  /** Refresh active script data from server */
  const refreshActiveScript = useCallback(async (scriptId: string) => {
    try {
      const fresh = await getAudioScript(scriptId);
      setActiveScript(fresh);
      // Also update voice.scripts
      setVoice(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scripts: prev.scripts?.map(s => s.id === scriptId ? fresh : s),
        };
      });
    } catch (err) {
      console.error('Failed to refresh script:', err);
    }
  }, []);

  const play = useCallback((url: string) => {
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audio.onended = () => setPlayingUrl(null);
    audio.play();
    audioRef.current = audio;
    setPlayingUrl(url);
  }, [playingUrl]);

  // Sequential playback logic
  const stopPlayAll = useCallback(() => {
    setPlayAllActive(false);
    setPlayingLineIndex(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
    }
    setPlayingUrl(null);
  }, []);

  const playAll = useCallback(() => {
    if (!activeScript?.lines) return;
    const completedLines = activeScript.lines.filter(l => l.status === 'COMPLETED' && l.audioUrl);
    if (completedLines.length === 0) return;

    setPlayAllActive(true);

    const playAtIndex = (idx: number) => {
      if (idx >= completedLines.length) {
        setPlayAllActive(false);
        setPlayingLineIndex(null);
        setPlayingUrl(null);
        return;
      }

      const line = completedLines[idx];
      // Find the real index in the full lines array for highlighting
      const realIndex = activeScript.lines!.findIndex(l => l.id === line.id);
      setPlayingLineIndex(realIndex);
      setPlayingUrl(line.audioUrl);

      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(line.audioUrl!);
      audio.onended = () => playAtIndex(idx + 1);
      audio.play();
      audioRef.current = audio;
    };

    playAtIndex(0);
  }, [activeScript]);

  const handleSaveName = useCallback(async () => {
    if (!voice || name === voice.name) return;
    setSaving(true);
    try {
      const updated = await updateCharacterVoice(voice.id, { name });
      setVoice(prev => prev ? { ...prev, ...updated } : prev);
    } finally { setSaving(false); }
  }, [voice, name]);

  const handleSaveCharacter = useCallback(async () => {
    if (!voice || character === (voice.character || '')) return;
    setSaving(true);
    try {
      const updated = await updateCharacterVoice(voice.id, { character: character || null });
      setVoice(prev => prev ? { ...prev, ...updated } : prev);
    } finally { setSaving(false); }
  }, [voice, character]);

  const handleTestTTS = useCallback(async () => {
    if (!voice?.id || !testText.trim()) return;
    setTestGenerating(true);
    setTestAudioUrl(null);
    try {
      const result = await generateSpeech({ voiceId: voice.id, text: testText.trim() });
      setTestAudioUrl(result.audioUrl);
    } catch (err) {
      console.error('Test TTS failed:', err);
    } finally {
      setTestGenerating(false);
    }
  }, [voice, testText]);

  const handleCreateScript = useCallback(async () => {
    if (!voice || !newScriptName.trim()) return;
    try {
      const script = await createAudioScript({
        name: newScriptName.trim(),
        characterVoiceId: voice.id,
        ...(newScriptLessonId ? { lessonId: newScriptLessonId } : {}),
      });
      setVoice(prev => prev ? {
        ...prev,
        scripts: [...(prev.scripts || []), script],
      } : prev);
      setActiveScript(script);
      setNewScriptName('');
      setNewScriptLessonId('');
      setShowNewScriptInput(false);
    } catch (err) {
      console.error('Failed to create script:', err);
    }
  }, [voice, newScriptName, newScriptLessonId]);

  const handleAddLine = useCallback(async () => {
    if (!activeScript || !newLineText.trim()) return;
    try {
      const line = await addAudioLine(activeScript.id, {
        text: newLineText.trim(),
        emotion: newLineEmotion,
      });
      setActiveScript(prev => prev ? {
        ...prev,
        lines: [...(prev.lines || []), line],
      } : prev);
      setNewLineText('');
    } catch (err) {
      console.error('Failed to add line:', err);
    }
  }, [activeScript, newLineText, newLineEmotion]);

  const handleGenerateLine = useCallback(async (lineId: string) => {
    setGeneratingLineId(lineId);
    try {
      const updated = await generateAudioLine(lineId);
      setActiveScript(prev => prev ? {
        ...prev,
        lines: prev.lines?.map(l => l.id === lineId ? updated : l),
      } : prev);
    } catch (err) {
      console.error('Line generation failed:', err);
    } finally {
      setGeneratingLineId(null);
    }
  }, []);

  const handleDeleteLine = useCallback(async (lineId: string) => {
    try {
      await deleteAudioLine(lineId);
      setActiveScript(prev => prev ? {
        ...prev,
        lines: prev.lines?.filter(l => l.id !== lineId),
      } : prev);
    } catch (err) {
      console.error('Failed to delete line:', err);
    }
  }, []);

  const handleGenerateAll = useCallback(async () => {
    if (!activeScript) return;
    setGeneratingAll(true);
    try {
      const updated = await generateAllLines(activeScript.id);
      setActiveScript(updated);
      // Also update voice.scripts
      setVoice(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scripts: prev.scripts?.map(s => s.id === updated.id ? updated : s),
        };
      });
    } catch (err) {
      console.error('Generate all failed:', err);
    } finally {
      setGeneratingAll(false);
    }
  }, [activeScript]);

  const handleStitch = useCallback(async () => {
    if (!activeScript) return;
    setStitching(true);
    try {
      const updated = await stitchScript(activeScript.id);
      setActiveScript(updated);
      setVoice(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scripts: prev.scripts?.map(s => s.id === updated.id ? updated : s),
        };
      });
    } catch (err) {
      console.error('Stitch failed:', err);
    } finally {
      setStitching(false);
    }
  }, [activeScript]);

  const handleDeleteScript = useCallback(async () => {
    if (!activeScript || !voice) return;
    setDeletingScript(true);
    try {
      await deleteAudioScript(activeScript.id);
      const remaining = (voice.scripts || []).filter(s => s.id !== activeScript.id);
      setVoice(prev => prev ? { ...prev, scripts: remaining } : prev);
      setActiveScript(remaining.length > 0 ? remaining[0] : null);
      setShowDeleteScript(false);
    } catch (err) {
      console.error('Failed to delete script:', err);
    } finally {
      setDeletingScript(false);
    }
  }, [activeScript, voice]);

  const handleSaveScriptName = useCallback(async () => {
    if (!activeScript || editScriptNameValue.trim() === activeScript.name) {
      setEditingScriptName(false);
      return;
    }
    try {
      const updated = await updateAudioScript(activeScript.id, { name: editScriptNameValue.trim() });
      setActiveScript(updated);
      setVoice(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          scripts: prev.scripts?.map(s => s.id === updated.id ? updated : s),
        };
      });
    } catch (err) {
      console.error('Failed to update script name:', err);
    } finally {
      setEditingScriptName(false);
    }
  }, [activeScript, editScriptNameValue]);

  const handleReorderLine = useCallback(async (lineId: string, newSequence: number) => {
    setReorderingLineId(lineId);
    try {
      await reorderAudioLine(lineId, newSequence);
      // Refresh from server to get correct sequence numbers
      if (activeScript) {
        await refreshActiveScript(activeScript.id);
      }
    } catch (err) {
      console.error('Failed to reorder line:', err);
    } finally {
      setReorderingLineId(null);
    }
  }, [activeScript, refreshActiveScript]);

  const handleDelete = useCallback(async () => {
    if (!voice) return;
    setDeleting(true);
    try {
      await deleteCharacterVoice(voice.id);
      navigate('/audio');
    } catch (err) {
      console.error('Delete failed:', err);
      setDeleting(false);
    }
  }, [voice, navigate]);

  const emotions = ['neutral', 'excited', 'dramatic', 'gentle', 'teaching'];

  const scripts = voice?.scripts || [];
  const lines = activeScript?.lines || [];
  const hasPendingOrFailed = lines.some(l => l.status === 'PENDING' || l.status === 'FAILED');
  const completedLines = lines.filter(l => l.status === 'COMPLETED' && l.audioUrl);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-stc-bg">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-5 w-32 bg-neutral-200 rounded" />
            <div className="h-40 bg-neutral-200 rounded-2xl" />
            <div className="h-64 bg-neutral-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!voice) {
    return (
      <div className="h-full overflow-y-auto bg-stc-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">Voice not found</p>
          <Link to="/audio" className="text-stc-purple-500 hover:text-stc-purple-700 text-sm font-medium">
            Back to Audio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-stc-bg">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Back link */}
        <Link
          to="/audio"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-stc-purple-600 transition-colors mb-6 min-h-[44px]"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Audio
        </Link>

        {/* Voice Profile Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
          {saving && <p className="text-xs text-stc-purple-500 font-medium">Saving...</p>}

          {/* Sample playback */}
          {voice.sampleUrl && (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
              <button
                onClick={() => play(voice.sampleUrl!)}
                className="w-10 h-10 rounded-full bg-stc-purple-500 hover:bg-stc-purple-600 flex items-center justify-center transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
                aria-label={playingUrl === voice.sampleUrl ? 'Pause sample' : 'Play sample'}
              >
                {playingUrl === voice.sampleUrl ? (
                  <PauseIconSolid className="w-4 h-4 text-white" />
                ) : (
                  <PlayIconSolid className="w-4 h-4 text-white ml-0.5" />
                )}
              </button>
              <div>
                <p className="text-sm font-medium text-neutral-700">Voice Sample</p>
                <p className="text-xs text-neutral-400">Click to play</p>
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label htmlFor="voice-name" className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
            <input
              id="voice-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              className="w-full px-3 py-2.5 text-lg font-semibold text-neutral-800 border border-neutral-200 rounded-xl
                focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
            />
          </div>

          {/* Character */}
          <div>
            <label htmlFor="voice-char" className="block text-xs font-medium text-neutral-500 mb-1">Character</label>
            <input
              id="voice-char"
              type="text"
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
              onBlur={handleSaveCharacter}
              placeholder="e.g. King, Queen, Knight..."
              className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl
                focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
            />
          </div>

          {/* Description (read-only) */}
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Voice Description</label>
            <p className="text-sm text-neutral-600 px-3 py-2.5 bg-neutral-50 rounded-xl">{voice.description}</p>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 flex-wrap pt-2 text-xs text-neutral-400">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-purple-50 text-stc-purple-600">
              Voice
            </span>
            {voice.character && (
              <>
                <span className="text-neutral-300">|</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-orange/15 text-stc-orange">
                  {voice.character}
                </span>
              </>
            )}
            <span className="text-neutral-300">|</span>
            <span>{voice.createdByEmail.split('@')[0]}</span>
            <span className="text-neutral-300">|</span>
            <span>{new Date(voice.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Test TTS Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-neutral-900">Test Voice</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              placeholder="Type something to hear this voice say it..."
              onKeyDown={(e) => e.key === 'Enter' && handleTestTTS()}
              className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl
                focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
            />
            <button
              onClick={handleTestTTS}
              disabled={!testText.trim() || testGenerating}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500 hover:bg-stc-purple-600
                disabled:opacity-50 transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              {testGenerating ? <Spinner /> : 'Speak'}
            </button>
          </div>
          {testAudioUrl && (
            <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl">
              <button
                onClick={() => play(testAudioUrl)}
                className="w-9 h-9 rounded-full bg-stc-purple-500 hover:bg-stc-purple-600 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
                aria-label={playingUrl === testAudioUrl ? 'Pause' : 'Play generated audio'}
              >
                {playingUrl === testAudioUrl ? (
                  <PauseIconSolid className="w-4 h-4 text-white" />
                ) : (
                  <PlayIconSolid className="w-4 h-4 text-white ml-0.5" />
                )}
              </button>
              <p className="text-xs text-neutral-500">Generated audio</p>
            </div>
          )}
        </div>

        {/* Script Editor Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
          <h2 className="text-sm font-semibold text-neutral-900">Script Editor</h2>

          {/* Script Tabs */}
          {scripts.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {scripts.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveScript(s);
                    stopPlayAll();
                  }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors min-h-[44px] ${
                    activeScript?.id === s.id
                      ? 'bg-stc-purple-500 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {s.name}
                </button>
              ))}
              {/* + New Script button */}
              <button
                onClick={() => setShowNewScriptInput(true)}
                className="px-3 py-1.5 rounded-xl text-sm font-medium text-stc-purple-500 border border-dashed border-stc-purple-300
                  hover:bg-stc-purple-50 transition-colors min-h-[44px] flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                New Script
              </button>
            </div>
          )}

          {/* New Script Input (shown when no scripts exist, or when + clicked) */}
          {(scripts.length === 0 || showNewScriptInput) && !activeScript ? (
            <div className="space-y-3">
              <p className="text-xs text-neutral-500">Create a script to start writing dialogue lines.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newScriptName}
                  onChange={(e) => setNewScriptName(e.target.value)}
                  placeholder="Script name, e.g. 'Lesson 1 Opening'"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateScript()}
                  className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                />
                <select
                  value={newScriptLessonId}
                  onChange={(e) => setNewScriptLessonId(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl bg-white
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors min-h-[44px]"
                >
                  <option value="">No lesson</option>
                  {modules.map((mod) => (
                    <optgroup key={mod.id} label={`${mod.code} — ${mod.title}`}>
                      {mod.lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          L{lesson.lessonNumber}: {lesson.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={handleCreateScript}
                  disabled={!newScriptName.trim()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500 hover:bg-stc-purple-600
                    disabled:opacity-50 transition-colors min-h-[44px]"
                >
                  Create
                </button>
              </div>
            </div>
          ) : showNewScriptInput && activeScript ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="New script name..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateScript();
                  if (e.key === 'Escape') { setShowNewScriptInput(false); setNewScriptName(''); setNewScriptLessonId(''); }
                }}
                autoFocus
                className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl
                  focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
              />
              <select
                value={newScriptLessonId}
                onChange={(e) => setNewScriptLessonId(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl bg-white
                  focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors min-h-[44px]"
              >
                <option value="">No lesson</option>
                {modules.map((mod) => (
                  <optgroup key={mod.id} label={`${mod.code} — ${mod.title}`}>
                    {mod.lessons.map((lesson) => (
                      <option key={lesson.id} value={lesson.id}>
                        L{lesson.lessonNumber}: {lesson.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                onClick={handleCreateScript}
                disabled={!newScriptName.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500 hover:bg-stc-purple-600
                  disabled:opacity-50 transition-colors min-h-[44px]"
              >
                Create
              </button>
              <button
                onClick={() => { setShowNewScriptInput(false); setNewScriptName(''); setNewScriptLessonId(''); }}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-500 hover:bg-neutral-100 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          ) : null}

          {/* Active Script Content */}
          {activeScript && (
            <>
              {/* Script header: editable name + delete */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {editingScriptName ? (
                    <input
                      type="text"
                      value={editScriptNameValue}
                      onChange={(e) => setEditScriptNameValue(e.target.value)}
                      onBlur={handleSaveScriptName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveScriptName();
                        if (e.key === 'Escape') setEditingScriptName(false);
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 text-xs font-medium text-neutral-700 border border-stc-purple-300 rounded-lg
                        focus:ring-2 focus:ring-stc-purple-100 outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditScriptNameValue(activeScript.name);
                        setEditingScriptName(true);
                      }}
                      className="text-xs text-neutral-500 font-medium hover:text-stc-purple-600 transition-colors cursor-pointer truncate"
                      title="Click to edit script name"
                    >
                      {activeScript.name}
                    </button>
                  )}
                  <span className="text-xs text-neutral-400 flex-shrink-0">{lines.length} lines</span>
                  {activeScript.lesson && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-purple-50 text-stc-purple-600 flex-shrink-0">
                      M{activeScript.lesson.module.code} &middot; L{activeScript.lesson.lessonNumber}
                    </span>
                  )}
                </div>
                {/* Delete script button */}
                <button
                  onClick={() => setShowDeleteScript(true)}
                  className="w-8 h-8 rounded-lg hover:bg-stc-pink/10 flex items-center justify-center transition-colors min-h-[44px] flex-shrink-0"
                  title="Delete script"
                >
                  <TrashIcon className="w-4 h-4 text-neutral-400 hover:text-stc-pink" />
                </button>
              </div>

              {/* Action row: Generate All + Play All */}
              {lines.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {hasPendingOrFailed && (
                    <button
                      onClick={handleGenerateAll}
                      disabled={generatingAll}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                        bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[44px]"
                    >
                      {generatingAll ? (
                        <>
                          <Spinner />
                          Generating...
                        </>
                      ) : (
                        <>
                          <PlayIcon className="w-4 h-4" />
                          Generate All
                        </>
                      )}
                    </button>
                  )}
                  {completedLines.length > 0 && (
                    playAllActive ? (
                      <button
                        onClick={stopPlayAll}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                          bg-stc-pink hover:bg-stc-pink transition-colors min-h-[44px]"
                      >
                        <StopIcon className="w-4 h-4" />
                        Stop
                      </button>
                    ) : (
                      <button
                        onClick={playAll}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-stc-purple-600
                          border border-stc-purple-200 hover:bg-stc-purple-50 transition-colors min-h-[44px]"
                      >
                        <PlayCircleIcon className="w-4 h-4" />
                        Play All
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Script Timeline (mini-map) */}
              {lines.length > 0 && (
                <ScriptTimeline
                  script={activeScript}
                  playingUrl={playingUrl}
                  onPlay={play}
                  onStitch={handleStitch}
                  onGenerateAll={handleGenerateAll}
                  isStitching={stitching}
                  isGeneratingAll={generatingAll}
                />
              )}

              {/* Lines list */}
              <div className="space-y-2">
                {lines.map((line: AudioLine, idx: number) => (
                  <div
                    key={line.id}
                    className={`flex items-start gap-2 p-3 rounded-xl transition-colors ${
                      playAllActive && playingLineIndex === idx
                        ? 'bg-stc-blue/10 ring-1 ring-blue-200'
                        : 'bg-neutral-50'
                    }`}
                  >
                    {/* Reorder arrows */}
                    {lines.length >= 2 && (
                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                        <button
                          onClick={() => handleReorderLine(line.id, line.sequence - 1)}
                          disabled={idx === 0 || reorderingLineId === line.id}
                          className="w-6 h-6 rounded hover:bg-neutral-200 flex items-center justify-center transition-colors
                            disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ChevronUpIcon className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                        <button
                          onClick={() => handleReorderLine(line.id, line.sequence + 1)}
                          disabled={idx === lines.length - 1 || reorderingLineId === line.id}
                          className="w-6 h-6 rounded hover:bg-neutral-200 flex items-center justify-center transition-colors
                            disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ChevronDownIcon className="w-3.5 h-3.5 text-neutral-400" />
                        </button>
                      </div>
                    )}
                    <span className="text-xs text-neutral-400 font-mono mt-1 w-6 flex-shrink-0">{line.sequence}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-800">{line.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 text-neutral-600">{line.emotion}</span>
                        {line.status === 'COMPLETED' && line.audioUrl && (
                          <>
                            <button
                              onClick={() => play(line.audioUrl!)}
                              className="text-[10px] text-stc-purple-500 hover:text-stc-purple-700 font-medium min-h-[44px] inline-flex items-center"
                            >
                              {playingUrl === line.audioUrl ? 'Pause' : 'Play'}
                            </button>
                            {line.durationSecs != null && (
                              <span className="text-[10px] text-neutral-400">{formatDuration(line.durationSecs)}</span>
                            )}
                          </>
                        )}
                        {line.status === 'GENERATING' && (
                          <span className="text-[10px] text-stc-orange inline-flex items-center gap-1">
                            <Spinner className="w-3 h-3" />
                            Generating...
                          </span>
                        )}
                        {line.status === 'FAILED' && (
                          <span className="text-[10px] text-stc-pink">Failed</span>
                        )}
                        {line.status === 'PENDING' && (
                          <span className="text-[10px] text-neutral-400">Pending</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {line.status !== 'GENERATING' && (
                        <button
                          onClick={() => handleGenerateLine(line.id)}
                          disabled={generatingLineId === line.id}
                          className="w-8 h-8 rounded-lg hover:bg-neutral-200 flex items-center justify-center transition-colors min-h-[44px]"
                          title="Generate audio"
                        >
                          {generatingLineId === line.id ? (
                            <Spinner className="w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <PlayIcon className="w-3.5 h-3.5 text-neutral-400" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteLine(line.id)}
                        className="w-8 h-8 rounded-lg hover:bg-stc-pink/10 flex items-center justify-center transition-colors min-h-[44px]"
                        title="Delete line"
                      >
                        <XMarkIcon className="w-3.5 h-3.5 text-neutral-400 hover:text-stc-pink" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add line form */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newLineText}
                    onChange={(e) => setNewLineText(e.target.value)}
                    placeholder="Type a dialogue line..."
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLine()}
                    className="flex-1 px-3 py-2.5 text-sm border border-neutral-200 rounded-xl
                      focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newLineEmotion}
                      onChange={(e) => setNewLineEmotion(e.target.value)}
                      className="flex-1 sm:flex-none px-3 py-2.5 text-sm border border-neutral-200 rounded-xl bg-white
                        focus:border-stc-purple-500 outline-none min-h-[44px]"
                    >
                      {emotions.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                    <button
                      onClick={handleAddLine}
                      disabled={!newLineText.trim()}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500 hover:bg-stc-purple-600
                        disabled:opacity-50 transition-colors min-h-[44px]"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Stitch & Download section */}
              {completedLines.length > 0 && (
                <div className="pt-3 border-t border-neutral-100 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleStitch}
                      disabled={stitching}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white
                        bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[44px]"
                    >
                      {stitching ? (
                        <>
                          <Spinner />
                          Stitching...
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          Stitch Audio
                        </>
                      )}
                    </button>

                    {activeScript.stitchedUrl && (
                      <>
                        <a
                          href={activeScript.stitchedUrl}
                          download
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                            text-stc-purple-600 border border-stc-purple-200 hover:bg-stc-purple-50 transition-colors min-h-[44px]"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          Download Full Audio
                        </a>
                        {activeScript.stitchedDurationSecs != null && (
                          <span className="text-xs text-neutral-400">
                            Total: {formatDuration(activeScript.stitchedDurationSecs)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Delete Voice Button */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              text-stc-pink border border-stc-pink/20 hover:bg-stc-pink/10 transition-colors min-h-[44px]"
          >
            <TrashIcon className="w-4 h-4" />
            Delete Voice
          </button>
        </div>
      </div>

      {/* Delete Voice Confirmation Modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Delete Voice</h3>
            <p className="text-sm text-neutral-600">
              Are you sure you want to delete <strong>{voice.name}</strong>? All scripts and audio will be permanently removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-stc-pink hover:bg-stc-pink rounded-xl transition-colors min-h-[44px] disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Spinner />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Script Confirmation Modal */}
      {showDeleteScript && activeScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteScript(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Delete Script</h3>
            <p className="text-sm text-neutral-600">
              Are you sure you want to delete <strong>{activeScript.name}</strong>? All lines and generated audio in this script will be permanently removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteScript(false)}
                disabled={deletingScript}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteScript}
                disabled={deletingScript}
                className="px-4 py-2 text-sm font-medium text-white bg-stc-pink hover:bg-stc-pink rounded-xl transition-colors min-h-[44px] disabled:opacity-50 flex items-center gap-2"
              >
                {deletingScript && <Spinner />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
