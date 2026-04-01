import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilmIcon,
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { getEpisodes, batchCreateEpisodes, getAllLessons, type Episode } from '../../lib/api';
import type { ModuleWithLessons } from '../../lib/types';
import { SparklesIcon } from '@heroicons/react/24/outline';

const SERIES_OPTIONS = [
  { value: '', label: 'All Series' },
  { value: 'how-pieces-move', label: 'How Pieces Move' },
  { value: 'chesslandia-stories', label: 'Chesslandia Stories' },
  { value: 'puzzle-of-the-day', label: 'Puzzle of the Day' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCRIPTING', label: 'Scripting' },
  { value: 'STORYBOARDING', label: 'Storyboarding' },
  { value: 'ART', label: 'Art' },
  { value: 'VOICE', label: 'Voice' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'ASSEMBLING', label: 'Assembling' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'PUBLISHED', label: 'Published' },
];

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: 'bg-neutral-100', text: 'text-neutral-600' },
    SCRIPTING: { bg: 'bg-stc-orange/15', text: 'text-stc-orange' },
    STORYBOARDING: { bg: 'bg-stc-orange/15', text: 'text-stc-orange' },
    ART: { bg: 'bg-stc-blue/15', text: 'text-stc-navy' },
    VOICE: { bg: 'bg-stc-blue/15', text: 'text-stc-navy' },
    VIDEO: { bg: 'bg-stc-blue/15', text: 'text-stc-navy' },
    ASSEMBLING: { bg: 'bg-stc-purple-100', text: 'text-stc-purple-700' },
    REVIEW: { bg: 'bg-stc-green/15', text: 'text-stc-green' },
    PUBLISHED: { bg: 'bg-stc-green/20', text: 'text-stc-green' },
  };
  return map[status] || { bg: 'bg-neutral-100', text: 'text-neutral-600' };
}

function formatBadge(format: string) {
  return format === 'SHORT'
    ? { label: 'Short', bg: 'bg-stc-purple-50', text: 'text-stc-purple-600' }
    : { label: 'Episode', bg: 'bg-stc-blue/10', text: 'text-stc-blue' };
}

export default function EpisodesModule() {
  const navigate = useNavigate();
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seriesFilter, setSeriesFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [batchModule, setBatchModule] = useState('');
  const [batchFormat, setBatchFormat] = useState<'SHORT' | 'EPISODE'>('SHORT');
  const [batchSeries, setBatchSeries] = useState('how-pieces-move');
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchEpisodes = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (seriesFilter) params.series = seriesFilter;
      if (statusFilter) params.status = statusFilter;
      const data = await getEpisodes(params);
      setEpisodes(data.episodes);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load episodes:', err);
    } finally {
      setLoading(false);
    }
  }, [seriesFilter, statusFilter]);

  useEffect(() => { fetchEpisodes(); }, [fetchEpisodes]);

  const openBatchModal = async () => {
    setShowBatchModal(true);
    setBatchResult(null);
    if (modules.length === 0) {
      const data = await getAllLessons();
      setModules(data);
      if (data.length > 0) setBatchModule(data[0].code);
    }
  };

  const handleBatchCreate = async () => {
    if (!batchModule) return;
    setBatchCreating(true);
    setBatchResult(null);
    try {
      const result = await batchCreateEpisodes({
        moduleCode: batchModule,
        format: batchFormat,
        series: batchSeries,
      });
      setBatchResult(`Created ${result.created} episode${result.created !== 1 ? 's' : ''}`);
      fetchEpisodes();
    } catch (err) {
      setBatchResult(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBatchCreating(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Episodes</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Create YouTube content from curriculum lessons
            </p>
          </div>
          {total > 0 && (
            <span className="text-xs text-neutral-400 tabular-nums">
              {total} episode{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Create buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/episodes/new')}
            className="flex-1 py-4 rounded-xl border-2 border-dashed border-neutral-300
              hover:border-stc-purple-300 hover:bg-stc-purple-50/50 transition-all duration-200
              flex items-center justify-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-stc-purple-100 flex items-center justify-center transition-colors">
              <PlusIcon className="h-5 w-5 text-neutral-400 group-hover:text-stc-purple-500 transition-colors" />
            </div>
            <span className="text-sm font-medium text-neutral-500 group-hover:text-stc-purple-600 transition-colors">
              Create Episode
            </span>
          </button>
          <button
            onClick={openBatchModal}
            className="py-4 px-6 rounded-xl border-2 border-dashed border-neutral-300
              hover:border-stc-purple-300 hover:bg-stc-purple-50/50 transition-all duration-200
              flex items-center justify-center gap-3 group"
          >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-stc-purple-100 flex items-center justify-center transition-colors">
              <SparklesIcon className="h-5 w-5 text-neutral-400 group-hover:text-stc-purple-500 transition-colors" />
            </div>
            <span className="text-sm font-medium text-neutral-500 group-hover:text-stc-purple-600 transition-colors">
              Batch Create
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <FunnelIcon className="h-4 w-4 text-neutral-400 flex-shrink-0" />
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              className="px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white flex-1"
            >
              {SERIES_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white flex-1"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Episode Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-neutral-200 p-5 animate-pulse">
                <div className="h-5 bg-neutral-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-neutral-200 rounded w-1/4 mb-2" />
                <div className="h-2 bg-neutral-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : episodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FilmIcon className="h-12 w-12 text-neutral-300 mb-4" />
            <h3 className="text-lg font-semibold text-neutral-600 mb-2">No episodes yet</h3>
            <p className="text-sm text-neutral-400 mb-6 max-w-sm">
              Create your first episode to start generating YouTube content from your curriculum.
            </p>
            <button
              onClick={() => navigate('/episodes/new')}
              className="px-5 py-2.5 bg-stc-purple-500 text-white text-sm font-semibold rounded-[10px]
                hover:bg-stc-purple-600 transition-colors duration-200 min-h-[44px]
                flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Create Episode
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {episodes.map(ep => {
              const sBadge = statusBadge(ep.status);
              const fBadge = formatBadge(ep.format);
              const totalShots = ep.shots?.length || 0;
              const completedShots = ep.shots?.filter(s =>
                s.imageStatus === 'COMPLETE' && s.audioStatus === 'COMPLETE' && s.videoStatus === 'COMPLETE'
              ).length || 0;
              const shotProgress = totalShots > 0 ? (completedShots / totalShots) * 100 : 0;

              return (
                <div
                  key={ep.id}
                  onClick={() => navigate(`/episodes/${ep.id}`)}
                  className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-card
                    hover:border-stc-purple-200/50 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-neutral-900 truncate">{ep.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fBadge.bg} ${fBadge.text}`}>
                          {fBadge.label}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {ep.moduleCode}, Lesson {ep.lessonNumber}
                        {ep.series !== 'how-pieces-move' && ` · ${ep.series}`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${sBadge.bg} ${sBadge.text} flex-shrink-0`}>
                      {ep.status}
                    </span>
                  </div>

                  {/* Shot progress bar */}
                  {totalShots > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-neutral-500">
                          {completedShots}/{totalShots} shots complete
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-stc-purple-500 transition-all"
                          style={{ width: `${shotProgress}%` }}
                        />
                      </div>
                      {/* Shot filmstrip */}
                      <div className="flex gap-1 mt-2">
                        {ep.shots.map(shot => {
                          const allComplete = shot.imageStatus === 'COMPLETE' && shot.audioStatus === 'COMPLETE' && shot.videoStatus === 'COMPLETE';
                          const anyGenerating = [shot.imageStatus, shot.audioStatus, shot.videoStatus].includes('ASSET_GENERATING');
                          return (
                            <div
                              key={shot.id}
                              className={`h-1.5 flex-1 rounded-full ${
                                allComplete ? 'bg-stc-green' :
                                anyGenerating ? 'bg-stc-orange animate-pulse' :
                                'bg-neutral-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Batch Create Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowBatchModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-neutral-800">Batch Create Episodes</h3>
                <p className="text-sm text-neutral-500 mt-1">Create one episode per lesson in a module</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Module</label>
                <select
                  value={batchModule}
                  onChange={(e) => setBatchModule(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                    focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white"
                >
                  {modules.map(mod => (
                    <option key={mod.id} value={mod.code}>
                      {mod.code} — {mod.title} ({mod.lessons.length} lessons)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Format</label>
                <div className="flex gap-2">
                  {(['SHORT', 'EPISODE'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setBatchFormat(f)}
                      className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all min-h-[44px] ${
                        batchFormat === f
                          ? 'border-stc-purple-500 bg-stc-purple-50 text-stc-purple-700'
                          : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                      }`}
                    >
                      {f === 'SHORT' ? 'Shorts' : 'Episodes'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Series</label>
                <select
                  value={batchSeries}
                  onChange={(e) => setBatchSeries(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                    focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white"
                >
                  <option value="how-pieces-move">How Pieces Move</option>
                  <option value="chesslandia-stories">Chesslandia Stories</option>
                  <option value="puzzle-of-the-day">Puzzle of the Day</option>
                </select>
              </div>

              {batchResult && (
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  batchResult.startsWith('Created') ? 'bg-stc-green/10 text-stc-green' : 'bg-stc-pink/10 text-stc-pink'
                }`}>
                  {batchResult}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                    hover:bg-neutral-50 transition-colors min-h-[44px]"
                >
                  Close
                </button>
                <button
                  onClick={handleBatchCreate}
                  disabled={batchCreating || !batchModule}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500
                    hover:bg-stc-purple-600 disabled:opacity-50 transition-colors shadow-sm min-h-[44px]
                    inline-flex items-center justify-center gap-2"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {batchCreating ? 'Creating...' : 'Create All'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
