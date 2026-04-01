import {
  DocumentTextIcon,
  BookOpenIcon,
  ScissorsIcon,
  CpuChipIcon,
  PhotoIcon,
  CloudArrowUpIcon,
  ChatBubbleBottomCenterTextIcon,
  ChatBubbleLeftRightIcon,
  PaintBrushIcon,
  FilmIcon,
  AcademicCapIcon,
  MagnifyingGlassIcon,
  Bars3BottomLeftIcon,
  CheckCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import type { PipelineStats } from '../../lib/api';

interface PipelineFlowProps {
  stats: PipelineStats;
}

interface FlowNodeProps {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  count?: number;
  total?: number;
  details?: Array<{ label: string; value: number | string }>;
  isLast?: boolean;
  highlight?: boolean;
}

function NodeCard({ label, icon: Icon, count, total, details, isLast, highlight }: FlowNodeProps) {
  const pct = total && count !== undefined ? Math.round((count / total) * 100) : null;

  return (
    <div className="flex flex-col items-center">
      <div className={`rounded-xl border px-4 py-3 text-center shadow-sm min-w-[160px] ${
        highlight ? 'bg-stc-purple-50 border-stc-purple-200' : 'bg-white border-neutral-200'
      }`}>
        <Icon className="h-5 w-5 text-stc-purple-400 mx-auto mb-1" />
        <div className="text-sm font-semibold text-neutral-800">{label}</div>

        {count !== undefined && (
          <div className="text-lg font-bold text-stc-purple-600 mt-0.5 tabular-nums leading-tight">
            {count.toLocaleString()}
            {total !== undefined && total !== count && (
              <span className="text-xs font-medium text-neutral-400 ml-1">/ {total.toLocaleString()}</span>
            )}
          </div>
        )}

        {pct !== null && pct < 100 && (
          <div className="mt-1.5 mx-auto w-full max-w-[120px]">
            <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-stc-green' : pct > 50 ? 'bg-stc-purple-400' : 'bg-stc-orange'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-neutral-400 mt-0.5">{pct}%</div>
          </div>
        )}

        {details && details.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {details.map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-neutral-400">{d.label}</span>
                <span className="font-semibold text-neutral-600 tabular-nums">{typeof d.value === 'number' ? d.value.toLocaleString() : d.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {!isLast && (
        <div className="w-0.5 h-5 bg-neutral-300 my-0.5" />
      )}
    </div>
  );
}

export default function PipelineFlow({ stats }: PipelineFlowProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        <Bars3BottomLeftIcon className="h-5 w-5 text-stc-purple-500" />
        Content Flow
      </h2>

      <div className="bg-white rounded-xl border border-neutral-200 p-6 overflow-x-auto">
        <div className="flex gap-10 justify-center min-w-[700px]">
          {/* Left Track: Curriculum */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-stc-purple-500 uppercase tracking-wider mb-3">
              Curriculum
            </div>
            <NodeCard
              icon={DocumentTextIcon}
              label="Markdown Files"
              details={[
                { label: 'Modules', value: stats.totalModules },
                { label: 'Lessons', value: stats.totalLessons },
              ]}
            />
            <NodeCard
              icon={BookOpenIcon}
              label="Parser"
              count={stats.totalLessons}
              details={[
                { label: 'Parsed → Chunks', value: `${stats.totalLessons} → ${stats.totalChunks}` },
              ]}
            />
            <NodeCard
              icon={ScissorsIcon}
              label="Chunker"
              count={stats.totalChunks}
              details={[
                { label: 'Avg per lesson', value: stats.totalLessons > 0 ? Math.round(stats.totalChunks / stats.totalLessons) : 0 },
              ]}
            />
            <NodeCard
              icon={CpuChipIcon}
              label="Embedder"
              count={stats.embeddedChunks}
              total={stats.totalChunks}
              isLast
            />
          </div>

          {/* Right Track: Illustrations */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-stc-purple-500 uppercase tracking-wider mb-3">
              Illustrations
            </div>
            <NodeCard
              icon={PhotoIcon}
              label="Source Images"
              count={stats.totalIllustrations}
              details={[
                { label: 'Originals', value: stats.originalIllustrations },
                { label: 'AI Generated', value: stats.generatedArt },
              ]}
            />
            <NodeCard
              icon={CloudArrowUpIcon}
              label="Upload to S3"
              count={stats.illustrationsWithUrl}
              total={stats.totalIllustrations}
            />
            <NodeCard
              icon={ChatBubbleBottomCenterTextIcon}
              label="AI Describe"
              count={stats.describedIllustrations}
              total={stats.totalIllustrations}
              details={[
                { label: 'Reviewed', value: stats.reviewedIllustrations },
              ]}
            />
            <NodeCard
              icon={CpuChipIcon}
              label="Embedder"
              count={stats.embeddedIllustrations}
              total={stats.totalIllustrations}
              isLast
            />
          </div>

          {/* Third Track: Characters */}
          <div className="flex flex-col items-center">
            <div className="text-xs font-bold text-stc-purple-500 uppercase tracking-wider mb-3">
              Characters
            </div>
            <NodeCard
              icon={StarIcon}
              label="Characters"
              count={stats.totalCharacters}
              details={[
                { label: 'Gold Standards', value: stats.goldStandardCount },
              ]}
            />
            <NodeCard
              icon={PaintBrushIcon}
              label="Generated Art"
              count={stats.generatedArt}
            />
            <NodeCard
              icon={FilmIcon}
              label="Videos"
              count={stats.generatedVideos}
            />
            <NodeCard
              icon={CheckCircleIcon}
              label="Reviewed"
              count={stats.reviewedIllustrations}
              total={stats.totalIllustrations}
              isLast
            />
          </div>
        </div>

        {/* Convergence */}
        <div className="flex justify-center mt-3">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <div className="w-28 h-0.5 bg-neutral-300" />
              <div className="w-0.5 h-5 bg-neutral-300" />
              <div className="w-28 h-0.5 bg-neutral-300" />
            </div>
            <div className="bg-stc-purple-50 rounded-xl border-2 border-stc-purple-200 px-6 py-3 text-center mt-1">
              <MagnifyingGlassIcon className="h-5 w-5 text-stc-purple-500 mx-auto mb-1" />
              <div className="text-sm font-bold text-stc-purple-700">Semantic Search</div>
              <div className="text-[10px] text-stc-purple-400 mt-0.5">pgvector</div>
              <div className="text-lg font-bold text-stc-purple-600 mt-1 tabular-nums">
                {(stats.embeddedChunks + stats.embeddedIllustrations).toLocaleString()}
              </div>
              <div className="text-[10px] text-stc-purple-400">total vectors</div>
            </div>
            <div className="w-0.5 h-4 bg-stc-purple-300 my-1" />

            {/* Output endpoints */}
            <div className="flex gap-3 mt-1">
              {([
                { icon: ChatBubbleLeftRightIcon, label: 'Chat' },
                { icon: PaintBrushIcon, label: 'Art' },
                { icon: FilmIcon, label: 'Video' },
                { icon: AcademicCapIcon, label: 'Lessons' },
              ] as const).map((item) => (
                <div
                  key={item.label}
                  className="bg-white rounded-xl border border-neutral-200 px-3 py-2 text-center shadow-sm"
                >
                  <item.icon className="h-5 w-5 text-stc-purple-400 mx-auto mb-0.5" />
                  <div className="text-[10px] font-semibold text-neutral-600">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
