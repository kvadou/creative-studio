import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PlayIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  ClockIcon,
  ArrowsPointingOutIcon,
} from '@heroicons/react/24/outline';
import { generateVideo, pollVideoStatus, getIllustrations } from '../../lib/api';

interface SourceImage {
  id: string;
  name: string;
  imageUrl: string;
  category?: string | null;
}

interface VideoWorkspaceProps {
  sourceIllustration?: SourceImage | null;
  onComplete: () => void;
  onClose: () => void;
}

type Phase = 'setup' | 'generating' | 'review';
type Duration = 4 | 6 | 8;
type AspectRatio = '16:9' | '9:16';

export default function VideoWorkspace({
  sourceIllustration,
  onComplete,
  onClose,
}: VideoWorkspaceProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  // Setup state — up to 12 source references
  const [selectedRefs, setSelectedRefs] = useState<SourceImage[]>(
    sourceIllustration ? [sourceIllustration] : []
  );
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState<Duration>(4);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reference picker state
  const [refSearch, setRefSearch] = useState('');
  const [allIllustrations, setAllIllustrations] = useState<SourceImage[]>([]);

  // Error
  const [error, setError] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Fetch illustrations on mount (exclude employee cartoons)
  useEffect(() => {
    getIllustrations({ excludeArtType: 'CARTOON', limit: 1000 })
      .then((data) => {
        setAllIllustrations(
          data.illustrations.map((ill: { id: string; name: string; illustrationUrl: string | null; sourcePhotoUrl: string | null; artType: string | null }) => ({
            id: ill.id,
            name: ill.name,
            imageUrl: ill.illustrationUrl || ill.sourcePhotoUrl || '',
            category: ill.artType,
          }))
        );
      })
      .catch(console.error);
  }, []);

  // Filtered references for search
  const filteredRefs = refSearch
    ? allIllustrations.filter((ill) =>
        ill.name.toLowerCase().includes(refSearch.toLowerCase())
      )
    : allIllustrations;

  // ── Polling ──
  const startPolling = useCallback((id: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const result = await pollVideoStatus(id);

        if (result.status === 'COMPLETED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setVideoUrl(result.videoUrl || null);
          setThumbnailUrl(result.thumbnailUrl || null);
          setPhase('review');
        } else if (result.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError(result.errorMessage || 'Video generation failed');
          setPhase('setup');
        }
      } catch {
        // Transient error, keep polling
      }
    }, 10000);
  }, []);

  // Toggle reference selection (up to 12)
  const toggleRef = useCallback((ref: SourceImage) => {
    setSelectedRefs((prev) => {
      const exists = prev.find((s) => s.id === ref.id);
      if (exists) return prev.filter((s) => s.id !== ref.id);
      if (prev.length >= 12) return prev;
      return [...prev, ref];
    });
  }, []);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (selectedRefs.length === 0 || !prompt.trim()) return;

    try {
      setIsSubmitting(true);
      setError(null);

      // Use first selected reference as the primary source
      const primary = selectedRefs[0];
      const result = await generateVideo({
        name: `${primary.name} — Video`,
        sourceIllustrationId: primary.id,
        prompt: prompt.trim(),
        duration,
        aspectRatio,
      });

      setVideoId(result.id);
      setPhase('generating');
      setIsSubmitting(false);

      startPolling(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSubmitting(false);
    }
  }, [selectedRefs, prompt, duration, aspectRatio, startPolling]);

  // ── Regenerate ──
  const handleRegenerate = useCallback(() => {
    setPhase('setup');
    setVideoUrl(null);
    setThumbnailUrl(null);
    setVideoId(null);
    setError(null);
  }, []);

  // ── Save ──
  const handleSave = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const canGenerate =
    selectedRefs.length > 0 && prompt.trim().length > 0 && !isSubmitting;

  // Resolution label from aspect ratio
  const resolutionLabel = aspectRatio === '16:9' ? '1280x720' : '720x1280';

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stc-purple-100 flex items-center justify-center">
            <PlayIcon className="w-4 h-4 text-stc-purple-600" />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">
            {phase === 'review' && selectedRefs.length > 0
              ? `Video: ${selectedRefs[0].name}`
              : 'Generate Video'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Close workspace"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* ── Setup Phase ── */}
        {phase === 'setup' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Error banner */}
              {error && (
                <div className="rounded-xl bg-stc-pink/10 border border-red-100 px-4 py-3 flex items-start gap-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-stc-pink mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-stc-pink">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-xs text-stc-pink hover:text-stc-pink mt-1 font-medium"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Source Illustrations (up to 4) */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Source Illustrations
                  <span className="ml-2 text-xs font-normal text-neutral-400">
                    {selectedRefs.length}/12 selected
                  </span>
                </label>

                {/* Selected illustrations strip */}
                {selectedRefs.length > 0 && (
                  <div className="flex gap-3 mb-3 flex-wrap">
                    {selectedRefs.map((ill, idx) => (
                      <div
                        key={ill.id}
                        className="relative flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg border border-stc-purple-200 bg-stc-purple-50/30"
                      >
                        <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-neutral-100">
                          <img
                            src={ill.imageUrl}
                            alt={ill.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-xs font-medium text-neutral-700 max-w-[80px] truncate">
                          {ill.name}
                        </span>
                        {idx === 0 && selectedRefs.length > 1 && (
                          <span className="text-[9px] font-semibold text-stc-purple-500 uppercase">Primary</span>
                        )}
                        {!sourceIllustration && (
                          <button
                            onClick={() => setSelectedRefs((prev) => prev.filter((s) => s.id !== ill.id))}
                            className="p-1 rounded text-neutral-400 hover:text-neutral-600 hover:bg-white/50 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                          >
                            <XMarkIcon className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Illustration picker — always visible unless source was pre-set */}
                {!sourceIllustration && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={refSearch}
                      onChange={(e) => setRefSearch(e.target.value)}
                      placeholder="Search character illustrations..."
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm
                        focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                        placeholder:text-neutral-400 transition-shadow"
                    />

                    {filteredRefs.length === 0 ? (
                      <p className="text-sm text-neutral-400 py-6 text-center">
                        {refSearch
                          ? 'No character illustrations match your search'
                          : 'No character illustrations available'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[280px] overflow-y-auto p-1">
                        {filteredRefs.map((ill) => {
                          const thumbUrl = ill.imageUrl;
                          const isSelected = selectedRefs.some((s) => s.id === ill.id);
                          const selIndex = selectedRefs.findIndex((s) => s.id === ill.id);
                          const atMax = selectedRefs.length >= 12 && !isSelected;
                          return (
                            <button
                              key={ill.id}
                              onClick={() => toggleRef(ill)}
                              title={atMax ? 'Maximum 12 illustrations selected' : ill.name}
                              disabled={atMax}
                              className={`
                                relative rounded-xl overflow-hidden border-2 transition-all duration-200
                                aspect-square cursor-pointer group
                                ${isSelected
                                  ? 'border-stc-purple-500 ring-2 ring-stc-purple-300'
                                  : atMax
                                    ? 'border-neutral-200 opacity-40 cursor-not-allowed'
                                    : 'border-neutral-200 hover:border-stc-purple-300'
                                }
                              `}
                            >
                              {thumbUrl ? (
                                <img
                                  src={thumbUrl}
                                  alt={ill.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                  <PhotoIcon className="w-6 h-6 text-neutral-300" />
                                </div>
                              )}
                              {/* Selection badge */}
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-stc-purple-500 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                                  {selIndex + 1}
                                </div>
                              )}
                              {/* Name overlay */}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5">
                                <p className="text-[10px] text-white font-medium truncate leading-tight">
                                  {ill.name}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Motion Prompt */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Motion Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe how the character should move and what happens in the scene..."
                  className="w-full min-h-[120px] p-4 rounded-xl border border-neutral-200 text-sm resize-y
                    focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                    placeholder:text-neutral-400 transition-shadow"
                />
              </div>

              {/* Duration Toggle */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Duration
                </label>
                <div className="inline-flex p-1.5 bg-neutral-100 rounded-xl">
                  {([4, 6, 8] as Duration[]).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                        ${duration === d
                          ? 'bg-white text-neutral-900 shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-700'
                        }
                      `}
                    >
                      {d}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio Toggle */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Aspect Ratio
                </label>
                <div className="inline-flex p-1.5 bg-neutral-100 rounded-xl">
                  <button
                    onClick={() => setAspectRatio('16:9')}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                      flex items-center gap-2
                      ${aspectRatio === '16:9'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                      }
                    `}
                  >
                    <svg className="w-4 h-3" viewBox="0 0 16 9" fill="currentColor">
                      <rect width="16" height="9" rx="1" opacity={0.3} />
                    </svg>
                    16:9 Landscape
                  </button>
                  <button
                    onClick={() => setAspectRatio('9:16')}
                    className={`
                      px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 min-h-[36px]
                      flex items-center gap-2
                      ${aspectRatio === '9:16'
                        ? 'bg-white text-neutral-900 shadow-sm'
                        : 'text-neutral-500 hover:text-neutral-700'
                      }
                    `}
                  >
                    <svg className="w-3 h-4" viewBox="0 0 9 16" fill="currentColor">
                      <rect width="9" height="16" rx="1" opacity={0.3} />
                    </svg>
                    9:16 Vertical
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
                {isSubmitting ? 'Starting generation...' : 'Generate Video'}
              </button>
            </div>
          </div>
        )}

        {/* ── Generating Phase ── */}
        {phase === 'generating' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5">
            {/* Spinner */}
            <div className="relative w-24 h-24">
              <div className="absolute inset-0 rounded-full border-2 border-stc-purple-200 animate-ping opacity-20" />
              <svg
                className="w-24 h-24 animate-spin"
                viewBox="0 0 96 96"
                fill="none"
                style={{ animationDuration: '2s' }}
              >
                <circle cx="48" cy="48" r="42" stroke="#E8E3F0" strokeWidth="3" />
                <path
                  d="M48 6a42 42 0 0 1 42 42"
                  stroke="url(#vid-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient
                    id="vid-grad"
                    x1="48"
                    y1="6"
                    x2="90"
                    y2="48"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#6A469D" />
                    <stop offset="1" stopColor="#50C8DF" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <PlayIcon className="w-10 h-10 text-stc-purple-500" />
              </div>
            </div>

            <div className="text-center space-y-2">
              <p className="text-base font-semibold text-neutral-800 animate-pulse">
                Generating your video...
              </p>
              <p className="text-sm text-neutral-500">
                This can take up to 6 minutes. Don't close this window.
              </p>
            </div>

            {/* Show selected sources as context */}
            {selectedRefs.length > 0 && (
              <div className="flex items-center gap-3 mt-4 px-4 py-3 rounded-xl bg-neutral-50 border border-neutral-200">
                <div className="flex -space-x-2">
                  {selectedRefs.map((ill) => (
                    <div key={ill.id} className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border-2 border-white">
                      <img
                        src={ill.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-700">
                    {selectedRefs.map((i) => i.name).join(', ')}
                  </p>
                  <p className="text-xs text-neutral-400">{duration}s / {aspectRatio}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Review Phase ── */}
        {phase === 'review' && (
          <div className="flex-1 flex flex-col p-4 sm:p-6 min-h-0">
            <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col min-h-0">
              {/* Video player */}
              <div
                className={`
                  flex-1 min-h-0 rounded-2xl overflow-hidden bg-black flex items-center justify-center
                  ${aspectRatio === '9:16' ? 'max-w-sm mx-auto' : ''}
                `}
              >
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    poster={thumbnailUrl || undefined}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    <ExclamationTriangleIcon className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
                    <p className="text-sm text-neutral-400">Video not available</p>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100">
                  <ClockIcon className="w-3.5 h-3.5" />
                  {duration}s
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100">
                  <ArrowsPointingOutIcon className="w-3.5 h-3.5" />
                  {resolutionLabel}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100">
                  {aspectRatio === '16:9' ? 'Landscape' : 'Vertical'} ({aspectRatio})
                </span>
                {selectedRefs.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100">
                    <PhotoIcon className="w-3.5 h-3.5" />
                    {selectedRefs.map((i) => i.name).join(', ')}
                  </span>
                )}
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
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white min-h-[44px]
                    bg-stc-purple-500 hover:bg-stc-purple-600 shadow-sm transition-all duration-200"
                >
                  Save to Library
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
