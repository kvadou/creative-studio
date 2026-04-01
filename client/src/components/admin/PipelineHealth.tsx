import { useState } from 'react';
import {
  BookOpenIcon,
  Squares2X2Icon,
  PhotoIcon,
  ChatBubbleLeftIcon,
  SparklesIcon,
  UserGroupIcon,
  PaintBrushIcon,
  VideoCameraIcon,
  ChartBarIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import type { PipelineStats } from '../../lib/api';

interface PipelineHealthProps {
  stats: PipelineStats;
}

interface MetricCard {
  label: string;
  value: number;
  total?: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

type HealthStatus = 'complete' | 'warning' | 'critical' | 'info';

function getStatus(value: number, total?: number): HealthStatus {
  if (!total) return 'info';
  const pct = value / total;
  if (pct >= 0.95) return 'complete';
  if (pct >= 0.8) return 'warning';
  return 'critical';
}

function statusDotClass(status: HealthStatus): string {
  switch (status) {
    case 'complete': return 'bg-stc-green';
    case 'warning': return 'bg-stc-yellow';
    case 'critical': return 'bg-stc-pink';
    case 'info': return 'bg-stc-purple-400';
  }
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case 'complete': return 'Healthy (95%+ complete)';
    case 'warning': return 'Attention (80-95% complete)';
    case 'critical': return 'Critical (below 80%)';
    case 'info': return 'Total count (no pipeline ratio)';
  }
}

export default function PipelineHealth({ stats }: PipelineHealthProps) {
  const [showLegend, setShowLegend] = useState(false);

  const cards: MetricCard[] = [
    { label: 'Curriculum Chunks', value: stats.totalChunks, icon: BookOpenIcon },
    { label: 'Chunks Embedded', value: stats.embeddedChunks, total: stats.totalChunks, icon: Squares2X2Icon },
    { label: 'Illustrations', value: stats.totalIllustrations, icon: PhotoIcon },
    { label: 'Described', value: stats.describedIllustrations, total: stats.totalIllustrations, icon: ChatBubbleLeftIcon },
    { label: 'Illustrations Embedded', value: stats.embeddedIllustrations, total: stats.totalIllustrations, icon: SparklesIcon },
    { label: 'Characters', value: stats.totalCharacters, icon: UserGroupIcon },
    { label: 'Generated Art', value: stats.generatedArt, icon: PaintBrushIcon },
    { label: 'Videos', value: stats.generatedVideos, icon: VideoCameraIcon },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5 text-stc-purple-500" />
          Pipeline Health
        </h2>
        <div className="relative">
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors duration-200 min-h-[44px] px-2"
            aria-label="Show status legend"
          >
            <InformationCircleIcon className="h-4 w-4" />
            <span>Status legend</span>
          </button>
          {showLegend && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowLegend(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-neutral-200 shadow-lg p-4 w-64 animate-fade-in">
                <p className="text-xs font-semibold text-neutral-700 mb-3">Status Indicators</p>
                <div className="space-y-2.5">
                  {([
                    { status: 'complete' as HealthStatus, desc: 'Pipeline step is 95%+ complete' },
                    { status: 'warning' as HealthStatus, desc: 'Pipeline step is 80-95% complete' },
                    { status: 'critical' as HealthStatus, desc: 'Pipeline step is below 80%' },
                    { status: 'info' as HealthStatus, desc: 'Total count — no pipeline ratio' },
                  ]).map(({ status, desc }) => (
                    <div key={status} className="flex items-start gap-2.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${statusDotClass(status)} mt-0.5 flex-shrink-0`} />
                      <span className="text-xs text-neutral-600 leading-snug">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((card) => {
          const status = getStatus(card.value, card.total);
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-neutral-200 p-4 hover:shadow-card hover:border-stc-purple-200/50 transition-all duration-200"
              title={statusLabel(status)}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-5 w-5 text-stc-purple-400" />
                <div className={`w-2.5 h-2.5 rounded-full ${statusDotClass(status)}`} />
              </div>
              <div className="text-2xl font-bold text-neutral-900 tabular-nums">
                {card.value.toLocaleString()}
              </div>
              <div className="text-xs text-neutral-500 mt-0.5">
                {card.label}
                {card.total && (
                  <span className="text-neutral-400"> / {card.total.toLocaleString()}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
