import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  FilmIcon,
  PhotoIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  PuzzlePieceIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  PlayIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  PlusIcon,
  PencilIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  getEpisode,
  generateEpisodeScript,
  generateStoryboard,
  generateEpisodeArt,
  generateEpisodeVoice,
  generateEpisodeVideo,
  assembleEpisode,
  generateAll,
  duplicateEpisode,
  updateShot,
  deleteShot,
  createShot,
  reorderShots,
  deleteEpisode,
  type Episode,
  type EpisodeShot,
} from '../../lib/api';

interface ScriptScene {
  narration: string;
  dialogue: Array<{ character: string; line: string; emotion: string }>;
  visualDescription: string;
  characters: string[];
  durationHint: number;
}

interface Script {
  title: string;
  hook: string;
  teachingPoint: string;
  estimatedDuration: number;
  scenes: ScriptScene[];
}

const STAGE_CONFIG = [
  { key: 'script', label: 'Script', icon: DocumentTextIcon, statuses: ['SCRIPTING', 'STORYBOARDING', 'ART', 'VOICE', 'VIDEO', 'ASSEMBLING', 'REVIEW', 'PUBLISHED'] },
  { key: 'storyboard', label: 'Storyboard', icon: PuzzlePieceIcon, statuses: ['STORYBOARDING', 'ART', 'VOICE', 'VIDEO', 'ASSEMBLING', 'REVIEW', 'PUBLISHED'] },
  { key: 'art', label: 'Art', icon: PhotoIcon, statuses: ['ART', 'VOICE', 'VIDEO', 'ASSEMBLING', 'REVIEW', 'PUBLISHED'] },
  { key: 'voice', label: 'Voice', icon: MicrophoneIcon, statuses: ['VOICE', 'VIDEO', 'ASSEMBLING', 'REVIEW', 'PUBLISHED'] },
  { key: 'video', label: 'Video', icon: VideoCameraIcon, statuses: ['VIDEO', 'ASSEMBLING', 'REVIEW', 'PUBLISHED'] },
  { key: 'assembly', label: 'Assembly', icon: FilmIcon, statuses: ['ASSEMBLING', 'REVIEW', 'PUBLISHED'] },
] as const;

const STATUS_TO_STAGE: Record<string, number> = {
  SCRIPTING: 0,
  STORYBOARDING: 1,
  ART: 2,
  VOICE: 3,
  VIDEO: 4,
  ASSEMBLING: 5,
  REVIEW: 6,
  PUBLISHED: 6,
};

function getStageStatus(stageKey: string, episodeStatus: string): 'complete' | 'active' | 'pending' {
  const stageIndex = STAGE_CONFIG.findIndex(s => s.key === stageKey);
  const currentIndex = STATUS_TO_STAGE[episodeStatus] ?? -1;
  if (currentIndex < 0) return 'pending'; // DRAFT
  if (currentIndex > stageIndex) return 'complete';
  if (currentIndex === stageIndex) return 'active';
  return 'pending';
}

export default function EpisodeWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>('script');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingShot, setEditingShot] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<EpisodeShot>>({});
  const [editCharactersRaw, setEditCharactersRaw] = useState('');
  const [savingShot, setSavingShot] = useState(false);

  const fetchEpisode = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getEpisode(id);
      setEpisode(data);
      setLoading(false);
    } catch {
      setError('Failed to load episode');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchEpisode(); }, [fetchEpisode]);

  // Auto-expand the active stage + clear generating flags when work completes
  useEffect(() => {
    if (!episode) return;
    if (episode.shots.length > 0 && generatingStoryboard) {
      setGeneratingStoryboard(false);
    }
    if (['STORYBOARDING', 'ART'].includes(episode.status) && episode.shots.length > 0) {
      setExpandedStage('storyboard');
    }
  }, [episode?.status, episode?.shots.length]);

  // Poll while generating
  useEffect(() => {
    if (!episode || !['SCRIPTING', 'STORYBOARDING', 'ART', 'VOICE', 'VIDEO', 'ASSEMBLING'].includes(episode.status)) return;
    const interval = setInterval(fetchEpisode, 3000);
    return () => clearInterval(interval);
  }, [episode?.status, fetchEpisode]);

  const handleGenerateScript = async () => {
    if (!episode) return;
    setGenerating(true);
    setError(null);
    try {
      await generateEpisodeScript(episode.id);
      // Start polling
      setTimeout(fetchEpisode, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!episode) return;
    try {
      await deleteEpisode(episode.id);
      navigate('/episodes');
    } catch {
      setError('Failed to delete episode');
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!episode) return;
    setGeneratingStoryboard(true);
    setError(null);
    try {
      await generateStoryboard(episode.id);
      setTimeout(fetchEpisode, 2000);
      // generatingStoryboard stays true — cleared when shots arrive (see useEffect below)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate storyboard');
      setGeneratingStoryboard(false);
    }
  };

  const handleEditShot = (shot: EpisodeShot) => {
    setEditingShot(shot.id);
    setEditForm({
      sceneDescription: shot.sceneDescription,
      characters: shot.characters,
      cameraAngle: shot.cameraAngle,
      narration: shot.narration,
      dialogueLines: shot.dialogueLines,
    });
    setEditCharactersRaw(shot.characters.join(', '));
  };

  const handleSaveShot = async () => {
    if (!episode || !editingShot) return;
    setSavingShot(true);
    const saveData = {
      ...editForm,
      characters: editCharactersRaw.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      await updateShot(episode.id, editingShot, saveData);
      setEditingShot(null);
      setEditForm({});
      fetchEpisode();
    } catch {
      setError('Failed to save shot');
    } finally {
      setSavingShot(false);
    }
  };

  const handleDeleteShot = async (shotId: string) => {
    if (!episode) return;
    try {
      await deleteShot(episode.id, shotId);
      fetchEpisode();
    } catch {
      setError('Failed to delete shot');
    }
  };

  const handleAddShot = async () => {
    if (!episode) return;
    try {
      await createShot(episode.id, { sceneDescription: 'New shot' });
      fetchEpisode();
    } catch {
      setError('Failed to add shot');
    }
  };

  const handleMoveShot = async (shotId: string, direction: 'up' | 'down') => {
    if (!episode) return;
    const shots = [...episode.shots].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = shots.findIndex(s => s.id === shotId);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === shots.length - 1)) return;

    const newOrder = shots.map(s => s.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    try {
      await reorderShots(episode.id, newOrder);
      fetchEpisode();
    } catch {
      setError('Failed to reorder shots');
    }
  };

  const handleGenerateArt = async () => {
    if (!episode) return;
    setError(null);
    try {
      await generateEpisodeArt(episode.id);
      setTimeout(fetchEpisode, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate art');
    }
  };

  const handleGenerateVoice = async () => {
    if (!episode) return;
    setError(null);
    try {
      await generateEpisodeVoice(episode.id);
      setTimeout(fetchEpisode, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate voice');
    }
  };

  const handleGenerateVideo = async () => {
    if (!episode) return;
    setError(null);
    try {
      await generateEpisodeVideo(episode.id);
      setTimeout(fetchEpisode, 10000); // Veo is slow
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
    }
  };

  const handleGenerateAll = async () => {
    if (!episode) return;
    setError(null);
    try {
      await generateAll(episode.id);
      setTimeout(fetchEpisode, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start pipeline');
    }
  };

  const handleDuplicate = async () => {
    if (!episode) return;
    try {
      const dup = await duplicateEpisode(episode.id);
      navigate(`/episodes/${dup.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate');
    }
  };

  const handleAssemble = async () => {
    if (!episode) return;
    setError(null);
    try {
      await assembleEpisode(episode.id);
      setTimeout(fetchEpisode, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assemble');
    }
  };

  const script = episode?.script as Script | null;

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="h-8 bg-neutral-200 rounded w-1/3 animate-pulse" />
          <div className="h-40 bg-neutral-200 rounded-xl animate-pulse" />
          <div className="h-40 bg-neutral-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !episode) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-neutral-500">{error}</p>
          <button onClick={() => navigate('/episodes')} className="mt-3 text-sm text-stc-purple-600 hover:underline">
            Back to Episodes
          </button>
        </div>
      </div>
    );
  }

  if (!episode) return null;

  const formatLabel = episode.format === 'SHORT' ? 'Short' : 'Episode';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate('/episodes')}
            className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors min-h-[44px] mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Episodes
          </button>

          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-neutral-900">{episode.title}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stc-purple-50 text-stc-purple-600">
                  {formatLabel}
                </span>
              </div>
              <p className="text-sm text-neutral-500">
                {episode.moduleCode}, Lesson {episode.lessonNumber} · {episode.series}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Generate All — only show on DRAFT or early stages */}
              {['DRAFT', 'SCRIPTING', 'STORYBOARDING'].includes(episode.status) && (
                <button
                  onClick={handleGenerateAll}
                  disabled={['SCRIPTING', 'STORYBOARDING'].includes(episode.status)}
                  className="px-3 py-2 text-sm font-semibold bg-stc-purple-500 text-white rounded-[10px]
                    hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[44px]
                    inline-flex items-center gap-1.5"
                >
                  <SparklesIcon className="h-4 w-4" />
                  Generate All
                </button>
              )}
              {/* Duplicate */}
              <button
                onClick={handleDuplicate}
                className="p-2 text-neutral-400 hover:text-stc-purple-500 hover:bg-stc-purple-50 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Duplicate episode"
                title="Duplicate"
              >
                <DocumentTextIcon className="h-5 w-5" />
              </button>
              {/* Delete */}
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-neutral-400 hover:text-stc-pink hover:bg-stc-pink/10 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Delete episode"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-stc-pink/10 border border-red-100 px-4 py-3 flex items-center gap-3">
            <ExclamationCircleIcon className="h-5 w-5 text-stc-pink flex-shrink-0" />
            <p className="text-sm text-stc-pink flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-stc-pink hover:text-stc-pink font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* Pipeline Stages */}
        <div className="space-y-3">
          {STAGE_CONFIG.map((stage) => {
            const status = getStageStatus(stage.key, episode.status);
            const Icon = stage.icon;
            const isExpanded = expandedStage === stage.key;

            return (
              <div key={stage.key} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                {/* Stage header */}
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : stage.key)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-neutral-50 transition-colors min-h-[44px]"
                >
                  {/* Status indicator */}
                  {status === 'complete' ? (
                    <CheckCircleIcon className="h-5 w-5 text-stc-green flex-shrink-0" />
                  ) : status === 'active' ? (
                    <div className="h-5 w-5 rounded-full border-2 border-stc-purple-500 flex items-center justify-center flex-shrink-0">
                      <div className="h-2 w-2 rounded-full bg-stc-purple-500 animate-pulse" />
                    </div>
                  ) : (
                    <ClockIcon className="h-5 w-5 text-neutral-300 flex-shrink-0" />
                  )}

                  <Icon className={`h-5 w-5 flex-shrink-0 ${
                    status === 'complete' ? 'text-stc-green' :
                    status === 'active' ? 'text-stc-purple-500' :
                    'text-neutral-300'
                  }`} />

                  <span className={`text-sm font-medium flex-1 ${
                    status === 'pending' ? 'text-neutral-400' : 'text-neutral-900'
                  }`}>
                    {stage.label}
                  </span>

                  {status === 'complete' && (
                    <span className="text-xs text-stc-green font-medium">Complete</span>
                  )}
                  {status === 'active' && episode.status === 'SCRIPTING' && stage.key === 'script' && (
                    <span className="text-xs text-stc-purple-500 font-medium animate-pulse">Generating...</span>
                  )}
                  {status === 'active' && stage.key === 'storyboard' && generatingStoryboard && (
                    <span className="text-xs text-stc-purple-500 font-medium animate-pulse">Generating...</span>
                  )}
                  {status === 'active' && episode.status === 'ART' && stage.key === 'art' && (
                    <span className="text-xs text-stc-purple-500 font-medium animate-pulse">Generating art...</span>
                  )}
                  {status === 'active' && episode.status === 'VOICE' && stage.key === 'voice' && (
                    <span className="text-xs text-stc-purple-500 font-medium animate-pulse">Generating voice...</span>
                  )}
                  {status === 'active' && episode.status === 'VIDEO' && stage.key === 'video' && (
                    <span className="text-xs text-stc-purple-500 font-medium animate-pulse">Generating video...</span>
                  )}
                  {status === 'active' && episode.status === 'ASSEMBLING' && stage.key === 'assembly' && (
                    <span className="text-xs text-stc-purple-500 font-medium animate-pulse">Assembling...</span>
                  )}

                  <ChevronDownIcon className={`h-4 w-4 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Stage content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-neutral-100">
                    {/* Script stage */}
                    {stage.key === 'script' && (
                      <div className="pt-4">
                        {!script ? (
                          <div className="text-center py-6">
                            {episode.status === 'SCRIPTING' ? (
                              <div className="flex flex-col items-center gap-3">
                                <ArrowPathIcon className="animate-spin h-8 w-8 text-stc-purple-500" />
                                <p className="text-sm text-neutral-500">Generating script from curriculum...</p>
                              </div>
                            ) : (
                              <>
                                <SparklesIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                                <p className="text-sm text-neutral-500 mb-4">
                                  Generate a script from {episode.moduleCode} Lesson {episode.lessonNumber}
                                </p>
                                <button
                                  onClick={handleGenerateScript}
                                  disabled={generating}
                                  className="px-5 py-2.5 bg-stc-purple-500 text-white text-sm font-semibold rounded-[10px]
                                    hover:bg-stc-purple-600 disabled:opacity-50 transition-colors duration-200
                                    min-h-[44px] inline-flex items-center gap-2"
                                >
                                  <SparklesIcon className="h-4 w-4" />
                                  {generating ? 'Starting...' : 'Generate Script'}
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Script header */}
                            <div className="bg-stc-purple-50 rounded-lg px-4 py-3">
                              <p className="text-xs font-semibold text-stc-purple-600 uppercase tracking-wider mb-1">Hook</p>
                              <p className="text-sm text-stc-purple-800 font-medium">{script.hook}</p>
                            </div>
                            <div className="flex gap-4 text-xs text-neutral-500">
                              <span>Teaching point: <strong className="text-neutral-700">{script.teachingPoint}</strong></span>
                              <span>Est. {script.estimatedDuration}s</span>
                              <span>{script.scenes?.length || 0} scenes</span>
                            </div>

                            {/* Scenes */}
                            <div className="space-y-3">
                              {script.scenes?.map((scene, idx) => (
                                <div key={idx} className="border border-neutral-200 rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-neutral-400">Scene {idx + 1}</span>
                                    <span className="text-xs text-neutral-400">~{scene.durationHint}s</span>
                                  </div>

                                  {scene.narration && (
                                    <div className="mb-2">
                                      <p className="text-xs font-medium text-neutral-500 mb-0.5">Narration</p>
                                      <p className="text-sm text-neutral-700">{scene.narration}</p>
                                    </div>
                                  )}

                                  {scene.dialogue && scene.dialogue.length > 0 && (
                                    <div className="mb-2">
                                      <p className="text-xs font-medium text-neutral-500 mb-1">Dialogue</p>
                                      {scene.dialogue.map((d, di) => (
                                        <p key={di} className="text-sm text-neutral-700 pl-3 border-l-2 border-stc-purple-200 mb-1">
                                          <span className="font-medium text-stc-purple-600">{d.character}</span>
                                          <span className="text-neutral-400 text-xs ml-1">({d.emotion})</span>
                                          : "{d.line}"
                                        </p>
                                      ))}
                                    </div>
                                  )}

                                  <div>
                                    <p className="text-xs font-medium text-neutral-500 mb-0.5">Visual</p>
                                    <p className="text-xs text-neutral-500 italic">{scene.visualDescription}</p>
                                  </div>

                                  {scene.characters && scene.characters.length > 0 && (
                                    <div className="flex gap-1.5 mt-2">
                                      {scene.characters.map(c => (
                                        <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                                          {c}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Regenerate button */}
                            <div className="flex gap-3">
                              <button
                                onClick={handleGenerateScript}
                                disabled={generating || episode.status === 'SCRIPTING'}
                                className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-[10px]
                                  text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px]
                                  disabled:opacity-50"
                              >
                                Regenerate Script
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Storyboard stage */}
                    {stage.key === 'storyboard' && (
                      <div className="pt-4">
                        {status === 'pending' ? (
                          <div className="text-center py-8">
                            <PuzzlePieceIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-400">Generate a script first to unlock storyboarding</p>
                          </div>
                        ) : episode.shots.length === 0 && episode.status !== 'STORYBOARDING' ? (
                          <div className="text-center py-6">
                            <SparklesIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-500 mb-4">
                              Break the script into individual shots for art generation
                            </p>
                            <button
                              onClick={handleGenerateStoryboard}
                              disabled={generatingStoryboard}
                              className="px-5 py-2.5 bg-stc-purple-500 text-white text-sm font-semibold rounded-[10px]
                                hover:bg-stc-purple-600 disabled:opacity-50 transition-colors duration-200
                                min-h-[44px] inline-flex items-center gap-2"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              {generatingStoryboard ? 'Starting...' : 'Generate Storyboard'}
                            </button>
                          </div>
                        ) : generatingStoryboard ? (
                          <div className="flex flex-col items-center gap-3 py-6">
                            <ArrowPathIcon className="animate-spin h-8 w-8 text-stc-purple-500" />
                            <p className="text-sm text-neutral-500">Generating storyboard shots...</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Shot count summary */}
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-neutral-500">
                                {episode.shots.length} shot{episode.shots.length !== 1 ? 's' : ''}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleAddShot}
                                  className="px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg
                                    text-neutral-600 hover:bg-neutral-50 transition-colors min-h-[36px]
                                    inline-flex items-center gap-1.5"
                                >
                                  <PlusIcon className="h-3.5 w-3.5" />
                                  Add Shot
                                </button>
                                <button
                                  onClick={handleGenerateStoryboard}
                                  disabled={generatingStoryboard || episode.status === 'STORYBOARDING'}
                                  className="px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg
                                    text-neutral-600 hover:bg-neutral-50 transition-colors min-h-[36px]
                                    disabled:opacity-50"
                                >
                                  Regenerate
                                </button>
                              </div>
                            </div>

                            {/* Shot cards */}
                            <div className="space-y-3">
                              {[...episode.shots]
                                .sort((a, b) => a.orderIndex - b.orderIndex)
                                .map((shot, idx) => (
                                  <div key={shot.id} className="border border-neutral-200 rounded-lg overflow-hidden">
                                    {editingShot === shot.id ? (
                                      /* Editing mode */
                                      <div className="p-4 space-y-3 bg-stc-purple-50/30">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-stc-purple-600">Editing Shot {idx + 1}</span>
                                          <div className="flex gap-2">
                                            <button
                                              onClick={() => { setEditingShot(null); setEditForm({}); }}
                                              className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded"
                                              aria-label="Cancel"
                                            >
                                              <XMarkIcon className="h-4 w-4" />
                                            </button>
                                          </div>
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium text-neutral-600 mb-1 block">Scene Description</label>
                                          <textarea
                                            value={editForm.sceneDescription || ''}
                                            onChange={e => setEditForm(f => ({ ...f, sceneDescription: e.target.value }))}
                                            rows={3}
                                            className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stc-purple-100 resize-none"
                                          />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                          <div>
                                            <label className="text-xs font-medium text-neutral-600 mb-1 block">Camera Angle</label>
                                            <select
                                              value={editForm.cameraAngle || 'medium'}
                                              onChange={e => setEditForm(f => ({ ...f, cameraAngle: e.target.value }))}
                                              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stc-purple-100"
                                            >
                                              {['wide', 'medium', 'close-up', 'over-shoulder', 'bird-eye', 'low-angle'].map(a => (
                                                <option key={a} value={a}>{a}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-xs font-medium text-neutral-600 mb-1 block">Characters</label>
                                            <input
                                              type="text"
                                              value={editCharactersRaw}
                                              onChange={e => setEditCharactersRaw(e.target.value)}
                                              placeholder="King Shaky, Queen"
                                              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stc-purple-100"
                                            />
                                          </div>
                                        </div>

                                        <div>
                                          <label className="text-xs font-medium text-neutral-600 mb-1 block">Narration</label>
                                          <textarea
                                            value={editForm.narration || ''}
                                            onChange={e => setEditForm(f => ({ ...f, narration: e.target.value }))}
                                            rows={2}
                                            className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-stc-purple-100 resize-none"
                                          />
                                        </div>

                                        <div className="flex justify-end gap-2 pt-1">
                                          <button
                                            onClick={() => { setEditingShot(null); setEditForm({}); }}
                                            className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-[10px]
                                              text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[40px]"
                                          >
                                            Cancel
                                          </button>
                                          <button
                                            onClick={handleSaveShot}
                                            disabled={savingShot}
                                            className="px-4 py-2 text-sm font-semibold bg-stc-purple-500 text-white rounded-[10px]
                                              hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[40px]"
                                          >
                                            {savingShot ? 'Saving...' : 'Save'}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      /* Display mode */
                                      <div className="p-4">
                                        <div className="flex items-start gap-3">
                                          {/* Reorder buttons */}
                                          <div className="flex flex-col gap-0.5 pt-0.5">
                                            <button
                                              onClick={() => handleMoveShot(shot.id, 'up')}
                                              disabled={idx === 0}
                                              className="p-1 text-neutral-300 hover:text-neutral-500 disabled:opacity-30 rounded"
                                              aria-label="Move up"
                                            >
                                              <ChevronUpIcon className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              onClick={() => handleMoveShot(shot.id, 'down')}
                                              disabled={idx === episode.shots.length - 1}
                                              className="p-1 text-neutral-300 hover:text-neutral-500 disabled:opacity-30 rounded"
                                              aria-label="Move down"
                                            >
                                              <ChevronDownIcon className="h-3.5 w-3.5" />
                                            </button>
                                          </div>

                                          {/* Shot content */}
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-neutral-400">Shot {idx + 1}</span>
                                                {shot.cameraAngle && (
                                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stc-blue/10 text-stc-blue">
                                                    {shot.cameraAngle}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <button
                                                  onClick={() => handleEditShot(shot)}
                                                  className="p-1.5 text-neutral-300 hover:text-stc-purple-500 rounded transition-colors"
                                                  aria-label="Edit shot"
                                                >
                                                  <PencilIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                  onClick={() => handleDeleteShot(shot.id)}
                                                  className="p-1.5 text-neutral-300 hover:text-stc-pink rounded transition-colors"
                                                  aria-label="Delete shot"
                                                >
                                                  <TrashIcon className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            </div>

                                            {/* Scene description */}
                                            <p className="text-sm text-neutral-700 mb-2">{shot.sceneDescription}</p>

                                            {/* Narration */}
                                            {shot.narration && (
                                              <div className="mb-2">
                                                <p className="text-xs font-medium text-neutral-500 mb-0.5">Narration</p>
                                                <p className="text-sm text-neutral-600 italic">{shot.narration}</p>
                                              </div>
                                            )}

                                            {/* Dialogue */}
                                            {shot.dialogueLines && shot.dialogueLines.length > 0 && (
                                              <div className="mb-2">
                                                <p className="text-xs font-medium text-neutral-500 mb-1">Dialogue</p>
                                                {shot.dialogueLines.map((d, di) => (
                                                  <p key={di} className="text-sm text-neutral-700 pl-3 border-l-2 border-stc-purple-200 mb-1">
                                                    <span className="font-medium text-stc-purple-600">{d.character}</span>
                                                    <span className="text-neutral-400 text-xs ml-1">({d.emotion})</span>
                                                    : &ldquo;{d.line}&rdquo;
                                                  </p>
                                                ))}
                                              </div>
                                            )}

                                            {/* Characters + status badges */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                              {shot.characters.map(c => (
                                                <span key={c} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                                                  {c}
                                                </span>
                                              ))}
                                              {shot.imageStatus !== 'PENDING' && (
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                  shot.imageStatus === 'COMPLETE' ? 'bg-stc-green/10 text-stc-green' : 'bg-stc-yellow/10 text-stc-yellow'
                                                }`}>
                                                  Art: {shot.imageStatus.toLowerCase()}
                                                </span>
                                              )}
                                              {shot.audioStatus !== 'PENDING' && (
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                  shot.audioStatus === 'COMPLETE' ? 'bg-stc-green/10 text-stc-green' : 'bg-stc-yellow/10 text-stc-yellow'
                                                }`}>
                                                  Audio: {shot.audioStatus.toLowerCase()}
                                                </span>
                                              )}
                                              {shot.videoStatus !== 'PENDING' && (
                                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                  shot.videoStatus === 'COMPLETE' ? 'bg-stc-green/10 text-stc-green' : 'bg-stc-yellow/10 text-stc-yellow'
                                                }`}>
                                                  Video: {shot.videoStatus.toLowerCase()}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Art stage */}
                    {stage.key === 'art' && (
                      <div className="pt-4">
                        {status === 'pending' ? (
                          <div className="text-center py-8">
                            <PhotoIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-400">Complete storyboard first</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {/* Shot art progress */}
                            {episode.shots.length > 0 && (
                              <div className="space-y-2">
                                {(() => {
                                  const complete = episode.shots.filter(s => s.imageStatus === 'COMPLETE').length;
                                  const generating = episode.shots.filter(s => s.imageStatus === 'ASSET_GENERATING').length;
                                  const failed = episode.shots.filter(s => s.imageStatus === 'ASSET_FAILED').length;
                                  return (
                                    <>
                                      <div className="flex items-center justify-between text-xs text-neutral-500">
                                        <span>{complete}/{episode.shots.length} shots</span>
                                        {generating > 0 && <span className="text-stc-purple-500 animate-pulse">{generating} generating...</span>}
                                        {failed > 0 && <span className="text-stc-pink">{failed} failed</span>}
                                      </div>
                                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-stc-purple-500 rounded-full transition-all duration-500"
                                          style={{ width: `${(complete / episode.shots.length) * 100}%` }}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            {/* Shot art thumbnails */}
                            <div className="grid grid-cols-4 gap-2">
                              {[...episode.shots].sort((a, b) => a.orderIndex - b.orderIndex).map((shot) => (
                                <div key={shot.id} className="aspect-video bg-neutral-100 rounded-lg overflow-hidden relative">
                                  {shot.imageUrl ? (
                                    <img src={shot.imageUrl} alt={`Shot ${shot.orderIndex + 1}`} className="w-full h-full object-cover" />
                                  ) : shot.imageStatus === 'ASSET_GENERATING' ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ArrowPathIcon className="animate-spin h-5 w-5 text-stc-purple-400" />
                                    </div>
                                  ) : shot.imageStatus === 'ASSET_FAILED' ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ExclamationCircleIcon className="h-5 w-5 text-stc-pink" />
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <PhotoIcon className="h-5 w-5 text-neutral-300" />
                                    </div>
                                  )}
                                  <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-white drop-shadow-md">
                                    {shot.orderIndex + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {/* Generate button */}
                            <button
                              onClick={handleGenerateArt}
                              disabled={episode.status === 'ART' && episode.shots.some(s => s.imageStatus === 'ASSET_GENERATING')}
                              className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-[10px]
                                text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px] disabled:opacity-50
                                inline-flex items-center gap-2"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              {episode.shots.some(s => s.imageStatus === 'COMPLETE') ? 'Regenerate Art' : 'Generate Art'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Voice stage */}
                    {stage.key === 'voice' && (
                      <div className="pt-4">
                        {status === 'pending' ? (
                          <div className="text-center py-8">
                            <MicrophoneIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-400">Complete art generation first</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {episode.shots.length > 0 && (
                              <div className="space-y-2">
                                {(() => {
                                  const complete = episode.shots.filter(s => s.audioStatus === 'COMPLETE').length;
                                  const generating = episode.shots.filter(s => s.audioStatus === 'ASSET_GENERATING').length;
                                  const failed = episode.shots.filter(s => s.audioStatus === 'ASSET_FAILED').length;
                                  return (
                                    <>
                                      <div className="flex items-center justify-between text-xs text-neutral-500">
                                        <span>{complete}/{episode.shots.length} shots</span>
                                        {generating > 0 && <span className="text-stc-purple-500 animate-pulse">{generating} generating...</span>}
                                        {failed > 0 && <span className="text-stc-pink">{failed} failed</span>}
                                      </div>
                                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-stc-purple-500 rounded-full transition-all duration-500"
                                          style={{ width: `${(complete / episode.shots.length) * 100}%` }}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            {/* Audio previews */}
                            <div className="space-y-1.5">
                              {[...episode.shots].sort((a, b) => a.orderIndex - b.orderIndex).map((shot) => (
                                <div key={shot.id} className="flex items-center gap-3 px-3 py-2 bg-neutral-50 rounded-lg">
                                  <span className="text-xs font-bold text-neutral-400 w-6">{shot.orderIndex + 1}</span>
                                  {shot.audioUrl ? (
                                    <audio src={shot.audioUrl} controls className="h-8 flex-1" preload="none" />
                                  ) : shot.audioStatus === 'ASSET_GENERATING' ? (
                                    <span className="text-xs text-stc-purple-500 animate-pulse flex-1">Generating...</span>
                                  ) : shot.audioStatus === 'ASSET_FAILED' ? (
                                    <span className="text-xs text-stc-pink flex-1">Failed</span>
                                  ) : (
                                    <span className="text-xs text-neutral-400 flex-1">Pending</span>
                                  )}
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={handleGenerateVoice}
                              disabled={episode.status === 'VOICE' && episode.shots.some(s => s.audioStatus === 'ASSET_GENERATING')}
                              className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-[10px]
                                text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px] disabled:opacity-50
                                inline-flex items-center gap-2"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              {episode.shots.some(s => s.audioStatus === 'COMPLETE') ? 'Regenerate Voice' : 'Generate Voice'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Video stage */}
                    {stage.key === 'video' && (
                      <div className="pt-4">
                        {status === 'pending' ? (
                          <div className="text-center py-8">
                            <VideoCameraIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-400">Complete voice generation first</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {episode.shots.length > 0 && (
                              <div className="space-y-2">
                                {(() => {
                                  const complete = episode.shots.filter(s => s.videoStatus === 'COMPLETE').length;
                                  const generating = episode.shots.filter(s => s.videoStatus === 'ASSET_GENERATING').length;
                                  const failed = episode.shots.filter(s => s.videoStatus === 'ASSET_FAILED').length;
                                  return (
                                    <>
                                      <div className="flex items-center justify-between text-xs text-neutral-500">
                                        <span>{complete}/{episode.shots.length} shots</span>
                                        {generating > 0 && <span className="text-stc-purple-500 animate-pulse">{generating} generating...</span>}
                                        {failed > 0 && <span className="text-stc-pink">{failed} failed</span>}
                                      </div>
                                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-stc-purple-500 rounded-full transition-all duration-500"
                                          style={{ width: `${(complete / episode.shots.length) * 100}%` }}
                                        />
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            {/* Video previews */}
                            <div className="grid grid-cols-2 gap-2">
                              {[...episode.shots].sort((a, b) => a.orderIndex - b.orderIndex).map((shot) => (
                                <div key={shot.id} className="aspect-video bg-neutral-100 rounded-lg overflow-hidden relative">
                                  {shot.videoUrl ? (
                                    <video src={shot.videoUrl} controls className="w-full h-full object-cover" preload="none" />
                                  ) : shot.videoStatus === 'ASSET_GENERATING' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                                      <ArrowPathIcon className="animate-spin h-5 w-5 text-stc-purple-400" />
                                      <span className="text-[9px] text-neutral-400">Veo generating...</span>
                                    </div>
                                  ) : shot.videoStatus === 'ASSET_FAILED' ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ExclamationCircleIcon className="h-5 w-5 text-stc-pink" />
                                    </div>
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <VideoCameraIcon className="h-5 w-5 text-neutral-300" />
                                    </div>
                                  )}
                                  <span className="absolute bottom-0.5 left-1 text-[9px] font-bold text-white drop-shadow-md">
                                    {shot.orderIndex + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={handleGenerateVideo}
                              disabled={episode.status === 'VIDEO' && episode.shots.some(s => s.videoStatus === 'ASSET_GENERATING')}
                              className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-[10px]
                                text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px] disabled:opacity-50
                                inline-flex items-center gap-2"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              {episode.shots.some(s => s.videoStatus === 'COMPLETE') ? 'Regenerate Video' : 'Generate Video'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Assembly stage */}
                    {stage.key === 'assembly' && (
                      <div className="pt-4">
                        {status === 'pending' ? (
                          <div className="text-center py-8">
                            <FilmIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-400">Complete video generation first</p>
                          </div>
                        ) : episode.status === 'ASSEMBLING' && !episode.finalVideoUrl ? (
                          <div className="flex flex-col items-center gap-3 py-6">
                            <ArrowPathIcon className="animate-spin h-8 w-8 text-stc-purple-500" />
                            <p className="text-sm text-neutral-500">Assembling final video from {episode.shots.length} shots...</p>
                          </div>
                        ) : episode.finalVideoUrl ? (
                          <div className="space-y-3">
                            <video
                              src={episode.finalVideoUrl}
                              controls
                              className="w-full rounded-lg"
                              poster={episode.thumbnailUrl || undefined}
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-500">
                                {episode.finalDuration ? `${episode.finalDuration}s` : ''} · {episode.shots.length} shots
                              </span>
                              <div className="flex gap-2">
                                <a
                                  href={episode.finalVideoUrl}
                                  download
                                  className="px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg
                                    text-neutral-600 hover:bg-neutral-50 transition-colors min-h-[36px]
                                    inline-flex items-center gap-1.5"
                                >
                                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                  Download
                                </a>
                                <button
                                  onClick={handleAssemble}
                                  className="px-3 py-1.5 text-xs font-medium border border-neutral-200 rounded-lg
                                    text-neutral-600 hover:bg-neutral-50 transition-colors min-h-[36px]"
                                >
                                  Re-assemble
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <FilmIcon className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
                            <p className="text-sm text-neutral-500 mb-4">
                              Combine all shot videos into the final {episode.format === 'SHORT' ? 'Short' : 'Episode'}
                            </p>
                            <button
                              onClick={handleAssemble}
                              className="px-5 py-2.5 bg-stc-purple-500 text-white text-sm font-semibold rounded-[10px]
                                hover:bg-stc-purple-600 transition-colors duration-200
                                min-h-[44px] inline-flex items-center gap-2"
                            >
                              <SparklesIcon className="h-4 w-4" />
                              Assemble Video
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Final output section */}
        {episode.finalVideoUrl && (
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <PlayIcon className="h-5 w-5 text-stc-purple-500" />
              Final Video
            </h3>
            <video
              src={episode.finalVideoUrl}
              controls
              className="w-full rounded-lg"
              poster={episode.thumbnailUrl || undefined}
            />
            <div className="flex gap-3 mt-3">
              <a
                href={episode.finalVideoUrl}
                download
                className="px-4 py-2 text-sm font-medium border border-neutral-200 rounded-[10px]
                  text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px]
                  inline-flex items-center gap-2"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-stc-pink/10 flex items-center justify-center mx-auto mb-4">
                <TrashIcon className="h-6 w-6 text-stc-pink" />
              </div>
              <h3 className="text-base font-semibold text-neutral-800 mb-1">Delete episode?</h3>
              <p className="text-sm text-neutral-500">
                "{episode.title}" and all its shots will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                  hover:bg-neutral-50 transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-pink
                  hover:bg-stc-pink transition-colors shadow-sm min-h-[44px]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
