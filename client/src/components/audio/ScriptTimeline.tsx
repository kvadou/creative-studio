import { ArrowPathIcon, ArrowDownTrayIcon, LinkIcon } from '@heroicons/react/24/outline';
import type { AudioScript, AudioLine } from '../../lib/types';

interface ScriptTimelineProps {
  script: AudioScript;
  playingUrl: string | null;
  onPlay: (url: string) => void;
  onStitch: () => void;
  onGenerateAll: () => void;
  isStitching: boolean;
  isGeneratingAll: boolean;
}

const EMOTION_COLORS: Record<string, { bg: string; border: string }> = {
  neutral: { bg: 'bg-neutral-100', border: 'border-neutral-300' },
  excited: { bg: 'bg-stc-orange/10', border: 'border-amber-300' },
  dramatic: { bg: 'bg-stc-pink/10', border: 'border-stc-pink/30' },
  gentle: { bg: 'bg-stc-blue/10', border: 'border-stc-blue/30' },
  teaching: { bg: 'bg-stc-green/10', border: 'border-stc-green/30' },
};

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return <ArrowPathIcon className={`${className} animate-spin`} />;
}

export default function ScriptTimeline({
  script,
  playingUrl,
  onPlay,
  onStitch,
  onGenerateAll,
  isStitching,
  isGeneratingAll,
}: ScriptTimelineProps) {
  const lines = script.lines || [];
  if (lines.length === 0) return null;

  const hasPendingOrFailed = lines.some(l => l.status === 'PENDING' || l.status === 'FAILED');
  const hasCompleted = lines.some(l => l.status === 'COMPLETED' && l.audioUrl);

  // Total duration from all lines that have duration
  const totalDurationSecs = lines.reduce((sum, l) => sum + (l.durationSecs ?? 0), 0);

  // Calculate block width proportional to duration (min 80, max 200)
  const getBlockWidth = (line: AudioLine): number => {
    if (!line.durationSecs) return 80;
    // Scale: 1 second = ~40px, clamped
    const width = Math.max(80, Math.min(200, line.durationSecs * 40));
    return width;
  };

  return (
    <div className="space-y-3">
      {/* Timeline strip */}
      <div
        className="overflow-x-auto pb-2"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <style>{`.timeline-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="timeline-scroll flex gap-2 min-w-min px-0.5 py-0.5">
          {lines.map((line, idx) => {
            const colors = EMOTION_COLORS[line.emotion] || EMOTION_COLORS.neutral;
            const isPlaying = line.audioUrl != null && playingUrl === line.audioUrl;
            const isPending = line.status === 'PENDING';
            const isGenerating = line.status === 'GENERATING';
            const isFailed = line.status === 'FAILED';
            const isCompleted = line.status === 'COMPLETED' && line.audioUrl;
            const width = getBlockWidth(line);

            return (
              <button
                key={line.id}
                type="button"
                onClick={() => {
                  if (isCompleted && line.audioUrl) onPlay(line.audioUrl);
                }}
                disabled={!isCompleted}
                className={`
                  relative flex flex-col justify-between p-2 rounded-xl h-16 flex-shrink-0 transition-all
                  ${colors.bg}
                  ${isPending ? `border-2 border-dashed ${colors.border} text-neutral-400` : ''}
                  ${isGenerating ? `border-2 border-dotted ${colors.border}` : ''}
                  ${isCompleted ? `border-2 ${colors.border} cursor-pointer hover:shadow-md` : ''}
                  ${isFailed ? 'border-2 border-red-400 text-stc-pink' : ''}
                  ${isPlaying ? 'ring-2 ring-stc-purple-500 animate-pulse' : ''}
                  ${!isCompleted ? 'cursor-default' : ''}
                `}
                style={{ width: `${width}px`, minWidth: `${width}px` }}
                title={line.text}
              >
                {/* Line number */}
                <span className="text-[10px] font-mono leading-none text-left">
                  {idx + 1}
                </span>

                {/* Truncated text */}
                <span className="text-xs leading-tight text-left line-clamp-2 flex-1 mt-0.5">
                  {line.text}
                </span>

                {/* Duration (bottom-right) */}
                {line.durationSecs != null && (
                  <span className="text-[10px] font-mono leading-none text-right self-end">
                    {formatDuration(line.durationSecs)}
                  </span>
                )}

                {/* Generating spinner overlay */}
                {isGenerating && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-xl">
                    <Spinner className="w-5 h-5 text-neutral-500" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Total duration */}
        <span className="text-xs text-neutral-500 font-medium">
          Total: {formatDuration(totalDurationSecs)}
        </span>

        <div className="flex-1" />

        {/* Generate All */}
        {hasPendingOrFailed && (
          <button
            onClick={onGenerateAll}
            disabled={isGeneratingAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white
              bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {isGeneratingAll ? (
              <>
                <Spinner className="w-3.5 h-3.5" />
                Generating...
              </>
            ) : (
              'Generate All'
            )}
          </button>
        )}

        {/* Stitch / Download */}
        {hasCompleted && (
          script.stitchedUrl ? (
            <a
              href={script.stitchedUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                text-stc-purple-600 border border-stc-purple-200 hover:bg-stc-purple-50 transition-colors min-h-[44px]"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download{script.stitchedDurationSecs != null ? ` (${formatDuration(script.stitchedDurationSecs)})` : ''}
            </a>
          ) : (
            <button
              onClick={onStitch}
              disabled={isStitching}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white
                bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[44px]"
            >
              {isStitching ? (
                <>
                  <Spinner className="w-3.5 h-3.5" />
                  Stitching...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4" />
                  Stitch Audio
                </>
              )}
            </button>
          )
        )}
      </div>
    </div>
  );
}
