import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  StarIcon,
  XMarkIcon,
  PlusIcon,
  SparklesIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import type { Illustration, ModuleWithLessons, CharacterSummary } from '../../lib/types';
import { getIllustration, updateIllustration, updateIllustrationDescription, redescribeIllustration, deleteIllustration, getModulesWithLessons, getCharacters, getIllustrationCharacters, addIllustrationCharacter, removeIllustrationCharacter } from '../../lib/api';
import CharacterArtWorkspace from '../illustrations/CharacterArtWorkspace';
import DeleteConfirmModal from '../illustrations/DeleteConfirmModal';

export default function ImageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Navigation state
  const [prevId, setPrevId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(0);

  const [illustration, setIllustration] = useState<Illustration | null>(null);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [matchedCharacter, setMatchedCharacter] = useState<CharacterSummary | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterSummary[]>([]);
  const [taggedCharacters, setTaggedCharacters] = useState<{ id: string; name: string }[]>([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isGoldStandard, setIsGoldStandard] = useState(false);
  const [goldStandardType, setGoldStandardType] = useState<string | null>(null);
  const [isReferenceEnabled, setIsReferenceEnabled] = useState(true);

  // AI Description editing
  const [editingDescription, setEditingDescription] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');

  // Workspace overlay
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);

  // Selected generation for preview
  const [previewGenId, setPreviewGenId] = useState<string | null>(null);

  // Pipeline archive
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineRefs, setPipelineRefs] = useState<Map<string, { name: string; url: string | null }>>(new Map());
  const [pipelineRefsLoading, setPipelineRefsLoading] = useState(false);

  // Fetch reference image thumbnails when pipeline opens
  useEffect(() => {
    if (!pipelineOpen || !illustration?.generations?.length) return;
    const gen = previewGenId
      ? illustration.generations.find(g => g.id === previewGenId)
      : illustration.generations[0];
    if (!gen) return;

    const refIds = gen.referenceIds || [];
    if (refIds.length === 0 || pipelineRefs.size > 0) return;

    setPipelineRefsLoading(true);
    Promise.all(
      refIds.map(rid =>
        getIllustration(rid)
          .then(ill => [rid, { name: ill.name, url: ill.illustrationUrl || ill.sourcePhotoUrl }] as const)
          .catch(() => [rid, { name: rid.slice(0, 8), url: null }] as const)
      )
    ).then(entries => {
      setPipelineRefs(new Map(entries));
      setPipelineRefsLoading(false);
    });
  }, [pipelineOpen, illustration?.generations, previewGenId]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getIllustration(id),
      getModulesWithLessons(),
      getCharacters(),
    ]).then(([illust, mods, chars]) => {
      setIllustration(illust);
      setName(illust.name);
      setDescription(illust.description || '');
      setSelectedLessonId(illust.lessonId ?? null);
      setIsGoldStandard(illust.isGoldStandard || false);
      setGoldStandardType(illust.goldStandardType || null);
      setIsReferenceEnabled(illust.isReferenceEnabled !== false);
      setModules(mods);
      setAllCharacters(chars);
      // Find matching character by name (case-insensitive)
      const match = chars.find(
        (c) => c.name.toLowerCase() === illust.name.toLowerCase()
      );
      setMatchedCharacter(match ?? null);
      // Load character tags
      getIllustrationCharacters(id).then(setTaggedCharacters).catch(console.error);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [id]);

  // Fetch siblings for prev/next navigation
  useEffect(() => {
    if (!id) return;
    const moduleCode = searchParams.get('module') || '';
    const lessonId = searchParams.get('lesson') || '';
    const query = new URLSearchParams();
    if (moduleCode) query.set('moduleCode', moduleCode);
    if (lessonId) query.set('lessonId', lessonId);
    fetch(`/api/illustrations/${id}/siblings?${query}`)
      .then(r => r.json())
      .then(data => {
        setPrevId(data.prevId);
        setNextId(data.nextId);
        setPosition(data.position);
        setTotal(data.total);
      })
      .catch(console.error);
  }, [id, searchParams]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const params = searchParams.toString();
      const suffix = params ? `?${params}` : '';
      if (e.key === 'ArrowLeft' && prevId) navigate(`/images/${prevId}${suffix}`);
      if (e.key === 'ArrowRight' && nextId) navigate(`/images/${nextId}${suffix}`);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prevId, nextId, navigate, searchParams]);

  // Toggle review status
  const handleToggleReview = useCallback(async () => {
    if (!illustration) return;
    const newStatus = illustration.reviewStatus === 'reviewed' ? null : 'reviewed';
    try {
      const updated = await updateIllustration(illustration.id, { reviewStatus: newStatus } as Record<string, unknown>);
      setIllustration(prev => prev ? { ...prev, ...updated, reviewStatus: newStatus } : prev);
    } catch (err) {
      console.error('Toggle review failed:', err);
    }
  }, [illustration]);

  // Track unsaved changes
  const hasUnsavedChanges = illustration && (
    name !== illustration.name ||
    description !== (illustration.description || '')
  );

  // Save all pending changes
  const handleSaveAll = useCallback(async () => {
    if (!illustration) return;
    setSaving(true);
    try {
      const updates: Record<string, string | null> = {};
      if (name !== illustration.name) updates.name = name;
      if (description !== (illustration.description || '')) updates.description = description || null;
      if (Object.keys(updates).length > 0) {
        const updated = await updateIllustration(illustration.id, updates);
        setIllustration(prev => prev ? { ...prev, ...updated } : prev);
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [illustration, name, description]);

  // Auto-save name on blur
  const handleSaveName = useCallback(async () => {
    if (!illustration || name === illustration.name) return;
    setSaving(true);
    try {
      const updated = await updateIllustration(illustration.id, { name });
      setIllustration(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [illustration, name]);

  // Auto-save description on blur
  const handleSaveDescription = useCallback(async () => {
    if (!illustration || description === (illustration.description || '')) return;
    setSaving(true);
    try {
      const updated = await updateIllustration(illustration.id, { description: description || null });
      setIllustration(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [illustration, description]);

  // Re-describe with AI (regenerate description + auto-tag characters)
  const [redescribing, setRedescribing] = useState(false);
  const handleRedescribe = useCallback(async () => {
    if (!illustration) return;
    setRedescribing(true);
    try {
      const data = await redescribeIllustration(illustration.id);
      setIllustration(prev => prev ? { ...prev, aiDescription: data.aiDescription, reviewStatus: data.reviewStatus } : prev);
      // Refresh character tags
      const tags = await getIllustrationCharacters(illustration.id);
      setTaggedCharacters(tags);
    } catch (err) {
      console.error('Re-describe failed:', err);
    } finally {
      setRedescribing(false);
    }
  }, [illustration]);

  // Save AI description edit
  const handleSaveAiDescription = useCallback(async () => {
    if (!illustration) return;
    setSaving(true);
    try {
      const data = await updateIllustrationDescription(illustration.id, editedDescription);
      setIllustration(prev => prev ? { ...prev, aiDescription: data.aiDescription, reviewStatus: data.reviewStatus } : prev);
      setEditingDescription(false);
    } catch (err) {
      console.error('Save AI description failed:', err);
    } finally {
      setSaving(false);
    }
  }, [illustration, editedDescription]);

  // Save lesson change immediately
  const handleLessonChange = useCallback(async (lessonId: string | null) => {
    if (!illustration) return;
    setSelectedLessonId(lessonId);
    setSaving(true);
    try {
      const updated = await updateIllustration(illustration.id, { lessonId });
      setIllustration(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [illustration]);

  const handleDelete = useCallback(async () => {
    if (!illustration) return;
    await deleteIllustration(illustration.id);
    navigate('/images');
  }, [illustration, navigate]);

  const handleDownload = useCallback(() => {
    if (!illustration?.illustrationUrl) return;
    const a = document.createElement('a');
    a.href = illustration.illustrationUrl;
    a.download = illustration.name || 'image';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [illustration]);

  const handleGoldStandardToggle = useCallback(async () => {
    if (!illustration) return;
    // If toggling ON and no characters tagged, don't allow
    if (!isGoldStandard && taggedCharacters.length === 0) {
      return; // Can't be gold standard without a character
    }
    const newValue = !isGoldStandard;
    const newType = newValue ? (goldStandardType || 'REFERENCE') : null;
    setIsGoldStandard(newValue);
    setGoldStandardType(newType);
    setSaving(true);
    try {
      await updateIllustration(illustration.id, {
        isGoldStandard: newValue,
        goldStandardType: newType,
      });
    } catch (err) {
      console.error('Save failed:', err);
      setIsGoldStandard(!newValue); // revert
    } finally {
      setSaving(false);
    }
  }, [illustration, isGoldStandard, goldStandardType, taggedCharacters]);

  const handleGoldStandardTypeChange = useCallback(async (type: string) => {
    if (!illustration) return;
    setGoldStandardType(type);
    setSaving(true);
    try {
      await updateIllustration(illustration.id, { goldStandardType: type });
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [illustration]);

  const handleReferenceToggle = useCallback(async () => {
    if (!illustration) return;
    const newValue = !isReferenceEnabled;
    setIsReferenceEnabled(newValue);
    setSaving(true);
    try {
      await updateIllustration(illustration.id, { isReferenceEnabled: newValue });
    } catch (err) {
      console.error('Save failed:', err);
      setIsReferenceEnabled(!newValue); // revert
    } finally {
      setSaving(false);
    }
  }, [illustration, isReferenceEnabled]);

  // Get the display URL (either the selected generation or the main illustration)
  const getDisplayUrl = () => {
    if (previewGenId && illustration?.generations) {
      const gen = illustration.generations.find(g => g.id === previewGenId);
      if (gen) return gen.savedImageUrl || gen.outputImageUrl;
    }
    return illustration?.illustrationUrl || illustration?.sourcePhotoUrl;
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-stc-bg">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-5 w-32 bg-neutral-200 rounded" />
            <div className="h-[400px] bg-neutral-200 rounded-2xl" />
            <div className="h-32 bg-neutral-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!illustration) {
    return (
      <div className="h-full overflow-y-auto bg-stc-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">Image not found</p>
          <Link to="/images" className="text-stc-purple-500 hover:text-stc-purple-700 text-sm font-medium">
            Back to Images
          </Link>
        </div>
      </div>
    );
  }

  const displayUrl = getDisplayUrl();
  const artTypeBadge = illustration.artType === 'ORIGINAL'
    ? { label: 'Original', bg: 'bg-stc-orange/15', text: 'text-stc-orange' }
    : illustration.artType === 'CHARACTER'
    ? { label: 'Character', bg: 'bg-stc-purple-100', text: 'text-stc-purple-700' }
    : illustration.artType === 'VIDEO'
    ? { label: 'Video', bg: 'bg-stc-blue/15', text: 'text-stc-navy' }
    : { label: 'Cartoon', bg: 'bg-stc-blue/15', text: 'text-stc-navy' };

  return (
    <div className="h-full overflow-y-auto bg-stc-bg">
      {/* Top bar: back + name + nav + review */}
      <div className="sticky top-0 z-10 bg-stc-bg/95 backdrop-blur-sm border-b border-neutral-200/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/images"
              className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-stc-purple-600 transition-colors min-h-[44px] flex-shrink-0"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Images</span>
            </Link>
            <span className="text-neutral-300 hidden sm:inline">/</span>
            <h1 className="text-sm font-semibold text-neutral-800 truncate">{illustration.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ${artTypeBadge.bg} ${artTypeBadge.text}`}>
              {artTypeBadge.label}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {total > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    if (prevId) {
                      const params = searchParams.toString();
                      navigate(`/images/${prevId}${params ? `?${params}` : ''}`);
                    }
                  }}
                  disabled={!prevId}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronLeftIcon className="w-4 h-4 text-neutral-600" />
                </button>
                <span className="text-xs text-neutral-400 tabular-nums min-w-[50px] text-center">
                  {position}/{total}
                </span>
                <button
                  onClick={() => {
                    if (nextId) {
                      const params = searchParams.toString();
                      navigate(`/images/${nextId}${params ? `?${params}` : ''}`);
                    }
                  }}
                  disabled={!nextId}
                  className="p-2 rounded-lg hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <ChevronRightIcon className="w-4 h-4 text-neutral-600" />
                </button>
              </div>
            )}

            <button
              onClick={handleToggleReview}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                illustration.reviewStatus === 'reviewed'
                  ? 'bg-stc-green/15 text-stc-green hover:bg-stc-green/25'
                  : 'bg-stc-orange/15 text-stc-orange hover:bg-stc-orange/25'
              }`}
            >
              {illustration.reviewStatus === 'reviewed' ? (
                <><CheckCircleSolid className="w-3.5 h-3.5" /> Reviewed</>
              ) : (
                <><CheckCircleIcon className="w-3.5 h-3.5" /> Needs Review</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main content: Image + Inspector */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

          {/* LEFT: Image + Generation History + Pipeline */}
          <div className="space-y-4">
            {/* Image */}
            <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
              <div className="bg-neutral-50 flex items-center justify-center min-h-[300px]">
                {displayUrl ? (
                  <img
                    src={displayUrl}
                    alt={illustration.name}
                    className="max-h-[72vh] w-full object-contain"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <span className="text-neutral-400 text-sm">No image available</span>
                  </div>
                )}
              </div>

              {/* Generation History — inline filmstrip below image */}
              {illustration.generations && illustration.generations.length > 0 && (
                <div className="border-t border-neutral-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide flex-shrink-0">Versions</span>
                    <div className="flex gap-2 overflow-x-auto">
                      {[...illustration.generations].reverse().map((gen, idx) => {
                        const genUrl = gen.savedImageUrl || gen.outputImageUrl;
                        const isActive = previewGenId
                          ? gen.id === previewGenId
                          : gen.selected;
                        const versionNum = illustration.generations!.length - idx;
                        return (
                          <button
                            key={gen.id}
                            onClick={() => setPreviewGenId(isActive && previewGenId ? null : gen.id)}
                            className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200
                              ${isActive ? 'border-stc-purple-500 ring-2 ring-stc-purple-200' : 'border-neutral-200 hover:border-neutral-300'}
                            `}
                            title={`Version ${versionNum}${gen.selected ? ' (selected)' : ''}`}
                          >
                            {genUrl ? (
                              <img src={genUrl} alt={`v${versionNum}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                <span className="text-[9px] text-neutral-400">v{versionNum}</span>
                              </div>
                            )}
                            {gen.selected && (
                              <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-stc-purple-500 flex items-center justify-center">
                                <CheckIcon className="w-2.5 h-2.5 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* AI Description — below image, full width for readability */}
            {illustration.aiDescription && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SparklesIcon className="w-3.5 h-3.5 text-stc-purple-400" />
                  <span className="text-xs font-semibold text-neutral-600">AI Description</span>
                  {illustration.reviewStatus && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      illustration.reviewStatus === 'trained'
                        ? 'bg-stc-green/15 text-stc-green'
                        : illustration.reviewStatus === 'reviewed'
                        ? 'bg-stc-blue/15 text-stc-navy'
                        : illustration.reviewStatus === 'described'
                        ? 'bg-stc-yellow/15 text-stc-yellow'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {illustration.reviewStatus.charAt(0).toUpperCase() + illustration.reviewStatus.slice(1)}
                    </span>
                  )}
                  {!editingDescription && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={handleRedescribe}
                        disabled={redescribing}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-neutral-400 hover:text-stc-purple-600 hover:bg-stc-purple-50 transition-colors disabled:opacity-50 min-h-[36px]"
                        title="Re-describe with AI and auto-tag characters"
                      >
                        <ArrowPathIcon className={`w-3.5 h-3.5 ${redescribing ? 'animate-spin' : ''}`} />
                        {redescribing ? 'Describing...' : 'Re-describe'}
                      </button>
                      <button
                        onClick={() => {
                          setEditedDescription(illustration.aiDescription || '');
                          setEditingDescription(true);
                        }}
                        className="p-1 rounded-lg text-neutral-400 hover:text-stc-purple-600 hover:bg-stc-purple-50 transition-colors"
                        aria-label="Edit AI description"
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {editingDescription ? (
                  <div className="space-y-2">
                    <textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      autoFocus
                      rows={4}
                      className="w-full text-sm text-neutral-700 leading-relaxed bg-white rounded-xl px-3 py-2.5
                        border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-stc-purple/30 focus:border-stc-purple
                        resize-y transition-all"
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setEditingDescription(false)}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200
                          rounded-lg transition-colors min-h-[36px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveAiDescription}
                        disabled={saving}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-stc-purple hover:bg-stc-purple-600
                          rounded-lg transition-colors min-h-[36px] disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-600 leading-relaxed">
                    {illustration.aiDescription}
                  </p>
                )}
              </div>
            )}

            {/* AI Describe button — shown when no description exists */}
            {!illustration.aiDescription && illustration.illustrationUrl && (
              <button
                onClick={handleRedescribe}
                disabled={redescribing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stc-purple-50 hover:bg-stc-purple-100 text-stc-purple-700 rounded-2xl border border-stc-purple-200 text-sm font-medium transition-colors min-h-[44px] disabled:opacity-50"
              >
                <SparklesIcon className={`w-4 h-4 ${redescribing ? 'animate-pulse' : ''}`} />
                {redescribing ? 'Describing & tagging...' : 'AI Describe & Auto-Tag'}
              </button>
            )}

            {/* Pipeline Archive */}
            {illustration.generations && illustration.generations.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                <button
                  onClick={() => setPipelineOpen(!pipelineOpen)}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 transition-colors min-h-[44px]"
                >
                  <ChevronRightIcon className={`w-4 h-4 transition-transform duration-200 ${pipelineOpen ? 'rotate-90' : ''}`} />
                  AI Pipeline
                </button>

                {pipelineOpen && (() => {
                  const gen = previewGenId
                    ? illustration.generations!.find(g => g.id === previewGenId)
                    : illustration.generations![0];
                  if (!gen) return null;
                  const log = gen.pipelineLog;
                  const refCount = log?.refsLoaded ?? (gen.referenceIds?.length || 0);
                  const geminiCost = 0.04 + (refCount * 0.003);
                  const haikuCost = 0.001;
                  const reviewCost = log?.review ? 0.001 : 0;
                  const totalCost = geminiCost + haikuCost + reviewCost;
                  const similarityMap = new Map<string, number>();
                  if (log?.autoSearchResults) {
                    for (const r of log.autoSearchResults) {
                      similarityMap.set(r.id, r.similarity);
                    }
                  }

                  return (
                    <div className="border-t border-neutral-200 px-4 py-4 space-y-4">
                      <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                        {gen.modelVersion && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 font-medium">
                            <SparklesIcon className="w-3 h-3" />
                            {gen.modelVersion}
                          </span>
                        )}
                        {gen.resolution && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 font-medium">
                            {gen.resolution >= 4096 ? '4K' : '2K'} ({gen.resolution}px)
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 font-medium">
                          {new Date(gen.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </span>
                        {(log || gen.referenceIds) && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-neutral-100 font-medium">
                            {log ? `${log.refsLoaded}/${log.refsAttempted}` : gen.referenceIds?.length || 0} refs loaded
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stc-green/10 text-stc-green font-medium" title={`Gemini: ~$${geminiCost.toFixed(3)} + Haiku: ~$${haikuCost.toFixed(3)}`}>
                          ~${totalCost.toFixed(2)}
                        </span>
                      </div>

                      {log?.review && (
                        <div className="bg-white border border-stc-purple-200 rounded-xl overflow-hidden">
                          <div className="px-4 py-3 bg-stc-purple-50 border-b border-stc-purple-100">
                            <div className="flex items-center gap-2">
                              <EyeIcon className="w-4 h-4 text-stc-purple-500" />
                              <label className="text-xs font-semibold text-stc-purple-700 uppercase">AI Self-Review</label>
                              {log.review.styleCompliance.score > 0 && (
                                <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  log.review.styleCompliance.score >= 8
                                    ? 'bg-stc-green/15 text-stc-green'
                                    : log.review.styleCompliance.score >= 5
                                    ? 'bg-stc-yellow/15 text-stc-yellow'
                                    : 'bg-stc-pink/15 text-stc-pink'
                                }`}>
                                  Style: {log.review.styleCompliance.score}/10
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="px-4 py-3 space-y-3">
                            {log.review.description && (
                              <div>
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1">What the AI sees</p>
                                <p className="text-xs text-neutral-700 leading-relaxed">{log.review.description}</p>
                              </div>
                            )}
                            {log.review.characters.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1.5">Characters Found</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {log.review.characters.map((char, i) => (
                                    <span
                                      key={i}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${
                                        char.isChesslandia
                                          ? 'bg-stc-green/10 text-stc-green border border-stc-green/20'
                                          : 'bg-stc-pink/10 text-stc-pink border border-stc-pink/20'
                                      }`}
                                      title={char.notes}
                                    >
                                      <span className={`w-1.5 h-1.5 rounded-full ${char.isChesslandia ? 'bg-stc-green' : 'bg-stc-pink'}`} />
                                      {char.name}
                                    </span>
                                  ))}
                                </div>
                                {log.review.characters.filter(c => !c.isChesslandia).map((char, i) => (
                                  <p key={i} className="text-[11px] text-stc-pink mt-1 ml-1">
                                    {char.name}: {char.notes}
                                  </p>
                                ))}
                              </div>
                            )}
                            {log.review.styleCompliance.notes && (
                              <div>
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1">Style Notes</p>
                                <p className="text-xs text-neutral-600">{log.review.styleCompliance.notes}</p>
                              </div>
                            )}
                            {(log.review.promptAlignment.matched.length > 0 ||
                              log.review.promptAlignment.missed.length > 0 ||
                              log.review.promptAlignment.unexpected.length > 0) && (
                              <div>
                                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1.5">Prompt Alignment</p>
                                <div className="space-y-1.5">
                                  {log.review.promptAlignment.matched.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {log.review.promptAlignment.matched.map((item, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stc-green/10 text-stc-green border border-stc-green/20">
                                          <CheckIcon className="w-2.5 h-2.5" />
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {log.review.promptAlignment.missed.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {log.review.promptAlignment.missed.map((item, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stc-orange/10 text-stc-orange border border-stc-orange/20">
                                          <ExclamationCircleIcon className="w-2.5 h-2.5" />
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {log.review.promptAlignment.unexpected.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {log.review.promptAlignment.unexpected.map((item, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-stc-pink/10 text-stc-pink border border-stc-pink/20">
                                          <XMarkIcon className="w-2.5 h-2.5" />
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {log?.generationResponse && (
                        <div>
                          <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Gemini Commentary</label>
                          <p className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 leading-relaxed">
                            {log.generationResponse}
                          </p>
                        </div>
                      )}

                      <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
                        <label className="block text-[10px] font-semibold text-neutral-400 uppercase mb-2">Estimated Cost Breakdown</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-neutral-500 font-medium">Gemini Flash</p>
                            <p className="text-neutral-400">Image generation</p>
                            <p className="text-neutral-700 font-semibold mt-0.5">~${geminiCost.toFixed(3)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500 font-medium">Claude Haiku</p>
                            <p className="text-neutral-400">Prompt analysis</p>
                            <p className="text-neutral-700 font-semibold mt-0.5">~${haikuCost.toFixed(3)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500 font-medium">Gemini Flash</p>
                            <p className="text-neutral-400">Self-review</p>
                            <p className="text-neutral-700 font-semibold mt-0.5">~${reviewCost.toFixed(3)}</p>
                          </div>
                          <div>
                            <p className="text-neutral-500 font-medium">Total</p>
                            <p className="text-neutral-400">{refCount} ref image{refCount !== 1 ? 's' : ''}</p>
                            <p className="text-stc-green font-bold mt-0.5">~${totalCost.toFixed(3)}</p>
                          </div>
                        </div>
                      </div>

                      {gen.prompt && (
                        <div>
                          <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Prompt</label>
                          <pre className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                            {gen.prompt}
                          </pre>
                        </div>
                      )}

                      {log?.styleBible && (
                        <div>
                          <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Style Bible</label>
                          <pre className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                            {log.styleBible}
                          </pre>
                        </div>
                      )}

                      {gen.referenceIds && gen.referenceIds.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">
                            Reference Images ({gen.referenceIds.length})
                            {log?.autoSearchQuery && (
                              <span className="text-neutral-400 font-normal ml-1 normal-case">
                                auto-selected via semantic search
                              </span>
                            )}
                            {log?.manualReferenceIds && (
                              <span className="text-neutral-400 font-normal ml-1 normal-case">
                                manually selected
                              </span>
                            )}
                          </label>
                          {pipelineRefsLoading ? (
                            <div className="flex items-center gap-2 text-xs text-neutral-400 py-2">
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                              Loading reference images...
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {gen.referenceIds.map((refId) => {
                                const ref = pipelineRefs.get(refId);
                                const similarity = similarityMap.get(refId);
                                return (
                                  <Link
                                    key={refId}
                                    to={`/images/${refId}`}
                                    className="group text-center"
                                  >
                                    <div className="aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 mb-1 group-hover:border-stc-purple-300 transition-colors">
                                      {ref?.url ? (
                                        <img src={ref.url} alt={ref.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center p-1">
                                          <span className="text-[9px] text-neutral-400 leading-tight text-center">{ref?.name || refId.slice(0, 8)}</span>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[9px] text-neutral-500 truncate group-hover:text-stc-purple-600 transition-colors">{ref?.name || 'Unknown'}</p>
                                    {similarity !== undefined && (
                                      <span className="text-[10px] text-neutral-400 font-mono">{similarity.toFixed(3)}</span>
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!log && (
                        <p className="text-xs text-neutral-400 italic">
                          Pipeline logging was added after this generation. Only prompt, model, and resolution data are available.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* RIGHT: Inspector Panel */}
          <div className="space-y-3">
            {/* Name + Identity */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div>
                <label htmlFor="img-name" className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Name</label>
                <input
                  id="img-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleSaveName}
                  className="w-full px-3 py-2 text-sm font-semibold text-neutral-800 border border-neutral-200 rounded-xl
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors duration-200"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                {matchedCharacter && (
                  <Link
                    to={`/characters/${matchedCharacter.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stc-purple-50 text-stc-purple-600
                      hover:bg-stc-purple-100 text-[11px] font-semibold transition-colors"
                  >
                    <StarIcon className="w-3 h-3" />
                    View Profile
                  </Link>
                )}
                <span>{illustration.createdByEmail.split('@')[0]}</span>
                <span className="text-neutral-300">·</span>
                <span>{new Date(illustration.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>

              {illustration.description && (
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Notes</label>
                  <p className="text-xs text-neutral-600 leading-relaxed bg-neutral-50 rounded-lg px-3 py-2">
                    {illustration.description}
                  </p>
                </div>
              )}

              {saving && (
                <p className="text-[11px] text-stc-purple-500 font-medium">Saving...</p>
              )}
            </div>

            {/* Classification: Lesson + Characters */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div>
                <label htmlFor="img-lesson" className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Curriculum</label>
                <select
                  id="img-lesson"
                  value={selectedLessonId || ''}
                  onChange={(e) => handleLessonChange(e.target.value || null)}
                  className="w-full px-3 py-2 text-xs text-neutral-700 border border-neutral-200 rounded-xl
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors duration-200
                    bg-white min-h-[40px]"
                >
                  <option value="">No lesson assigned</option>
                  {modules.map((mod) => (
                    <optgroup key={mod.id} label={`M${mod.code} — ${mod.title}`}>
                      {mod.lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          M{mod.code} L{lesson.lessonNumber}: {lesson.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">Characters</label>
                <div className="flex flex-wrap gap-1.5">
                  {taggedCharacters.map(char => {
                    const charInfo = allCharacters.find(ac => ac.id === char.id);
                    return (
                      <span
                        key={char.id}
                        className="inline-flex items-center rounded-full bg-white border border-neutral-200 text-[11px] font-medium text-neutral-700 overflow-hidden"
                      >
                        <Link
                          to={`/characters/${char.id}`}
                          className="inline-flex items-center gap-1 pl-2 pr-1 py-1 hover:bg-stc-purple-50 transition-colors"
                        >
                          {charInfo?.thumbnailUrl ? (
                            <div className="w-4 h-4 rounded-full overflow-hidden">
                              <img src={charInfo.thumbnailUrl} alt="" className="w-full h-full"
                                style={(() => {
                                  const parts = (charInfo.avatarPosition || '50% 50% 1').split(' ');
                                  const x = parts[0]; const y = parts[1]; const s = parseFloat(parts[2]) || 1;
                                  return { objectFit: 'contain' as const, objectPosition: `${x} ${y}`, transform: s !== 1 ? `scale(${s})` : undefined, transformOrigin: s !== 1 ? `${x} ${y}` : undefined };
                                })()}
                              />
                            </div>
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-stc-purple-100 flex items-center justify-center">
                              <span className="text-[8px] font-bold text-stc-purple-500">{char.name.charAt(0)}</span>
                            </div>
                          )}
                          <span className="hover:text-stc-purple-600">{char.name}</span>
                        </Link>
                        <button
                          onClick={async () => {
                            await removeIllustrationCharacter(illustration.id, char.id);
                            setTaggedCharacters(prev => prev.filter(c => c.id !== char.id));
                          }}
                          className="px-1.5 py-1 text-neutral-400 hover:text-stc-pink hover:bg-stc-pink/10 transition-colors border-l border-neutral-200"
                          aria-label={`Remove ${char.name}`}
                        >
                          <XMarkIcon className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}
                  {taggedCharacters.length === 0 && !showCharacterPicker && (
                    <span className="text-[11px] text-neutral-400 italic">No characters tagged</span>
                  )}
                  <button
                    onClick={() => setShowCharacterPicker(!showCharacterPicker)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-neutral-300 text-[11px] font-medium text-neutral-500
                      hover:border-stc-purple-300 hover:text-stc-purple-600 hover:bg-stc-purple-50/50 transition-all duration-200"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add
                  </button>
                </div>
                {showCharacterPicker && (
                  <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50 space-y-2 mt-2">
                    <p className="text-[11px] text-neutral-500">Click to tag:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {allCharacters
                        .filter(c => !taggedCharacters.some(t => t.id === c.id))
                        .map(char => (
                          <button
                            key={char.id}
                            onClick={async () => {
                              await addIllustrationCharacter(illustration.id, char.id);
                              setTaggedCharacters(prev => [...prev, { id: char.id, name: char.name }]);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-neutral-200 text-[11px] font-medium text-neutral-600
                              hover:border-stc-purple-300 hover:bg-stc-purple-50 hover:text-stc-purple-600 transition-all duration-200 min-h-[28px]"
                          >
                            {char.thumbnailUrl ? (
                              <div className="w-3.5 h-3.5 rounded-full overflow-hidden">
                                <img src={char.thumbnailUrl} alt="" className="w-full h-full"
                                  style={(() => {
                                    const parts = (char.avatarPosition || '50% 50% 1').split(' ');
                                    const x = parts[0]; const y = parts[1]; const s = parseFloat(parts[2]) || 1;
                                    return { objectFit: 'contain' as const, objectPosition: `${x} ${y}`, transform: s !== 1 ? `scale(${s})` : undefined, transformOrigin: s !== 1 ? `${x} ${y}` : undefined };
                                  })()}
                                />
                              </div>
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full bg-stc-purple-100 flex items-center justify-center">
                                <span className="text-[7px] font-bold text-stc-purple-500">{char.name.charAt(0)}</span>
                              </div>
                            )}
                            {char.name}
                          </button>
                        ))}
                    </div>
                    {allCharacters.filter(c => !taggedCharacters.some(t => t.id === c.id)).length === 0 && (
                      <p className="text-[11px] text-neutral-400 italic">All characters tagged</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quality & AI Reference */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">Gold Standard</label>
                <button
                  onClick={handleGoldStandardToggle}
                  disabled={!isGoldStandard && taggedCharacters.length === 0}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 min-h-[40px] w-full justify-center ${
                    isGoldStandard
                      ? 'bg-amber-50 text-amber-700 border-2 border-amber-400 shadow-sm'
                      : taggedCharacters.length === 0
                      ? 'bg-neutral-50 text-neutral-300 border border-neutral-200 cursor-not-allowed'
                      : 'bg-white text-neutral-500 border border-neutral-200 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/50'
                  }`}
                  title={taggedCharacters.length === 0 ? 'Tag a character first' : ''}
                >
                  <StarIcon className={`w-4 h-4 ${isGoldStandard ? 'fill-amber-400 text-amber-400' : ''}`} />
                  {isGoldStandard ? 'Gold Standard' : 'Mark as Gold Standard'}
                </button>
                {isGoldStandard && (
                  <div className="flex gap-1.5 p-1 bg-neutral-100 rounded-xl mt-2">
                    <button
                      onClick={() => handleGoldStandardTypeChange('REFERENCE')}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 min-h-[32px] ${
                        goldStandardType === 'REFERENCE'
                          ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      Reference
                    </button>
                    <button
                      onClick={() => handleGoldStandardTypeChange('TPOSE')}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 min-h-[32px] ${
                        goldStandardType === 'TPOSE'
                          ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-200'
                          : 'text-neutral-500 hover:text-neutral-700'
                      }`}
                    >
                      T-Pose
                    </button>
                  </div>
                )}
                {!isGoldStandard && taggedCharacters.length === 0 && (
                  <p className="text-[11px] text-neutral-400 mt-1">Tag a character first</p>
                )}
                {isGoldStandard && (
                  <p className="text-[11px] text-amber-600/70 mt-1">
                    {goldStandardType === 'TPOSE'
                      ? 'Always used when generating this character'
                      : 'Prioritized during AI generation'}
                  </p>
                )}
              </div>

              <div className="border-t border-neutral-100 pt-3">
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-1.5">AI Reference</label>
                <button
                  onClick={handleReferenceToggle}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 min-h-[40px] w-full justify-center ${
                    isReferenceEnabled
                      ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-400 shadow-sm'
                      : 'bg-neutral-50 text-neutral-500 border border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <EyeIcon className={`w-4 h-4 ${isReferenceEnabled ? 'text-emerald-500' : ''}`} />
                  {isReferenceEnabled ? 'Referenced' : 'Not Referenced'}
                </button>
                <p className="text-[11px] text-neutral-400 mt-1">
                  {isReferenceEnabled
                    ? 'Available as AI reference'
                    : "Won't be used as AI reference"}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2">
              {hasUnsavedChanges && (
                <button
                  onClick={handleSaveAll}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                    text-white bg-stc-purple-500 hover:bg-stc-purple-600 transition-colors duration-200 min-h-[40px] disabled:opacity-50"
                >
                  <CheckIcon className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              {!illustration.isOriginal && (
                <button
                  onClick={() => setWorkspaceOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                    text-stc-purple-600 border border-stc-purple-300 hover:bg-stc-purple-50 transition-colors min-h-[40px]"
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Refine in Workspace
                </button>
              )}

              <div className="flex gap-2">
                {displayUrl && (
                  <button
                    onClick={handleDownload}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                      text-neutral-600 border border-neutral-200 hover:bg-neutral-50 transition-colors min-h-[40px]"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Download
                  </button>
                )}
                <button
                  onClick={() => setShowDelete(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                    text-neutral-400 border border-neutral-200 hover:text-stc-pink hover:border-stc-pink/30 hover:bg-stc-pink/5 transition-colors min-h-[40px]"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CharacterArtWorkspace Overlay */}
      {workspaceOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <CharacterArtWorkspace
            illustration={illustration}
            onComplete={() => {
              setWorkspaceOpen(false);
              // Reload the illustration to pick up new generations
              if (id) {
                getIllustration(id).then((updated) => {
                  setIllustration(updated);
                  setName(updated.name);
                  setDescription(updated.description || '');
                }).catch(console.error);
              }
            }}
            onClose={() => setWorkspaceOpen(false)}
          />
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && (
        <DeleteConfirmModal
          illustration={illustration}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
