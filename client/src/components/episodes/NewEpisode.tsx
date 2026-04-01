import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FilmIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import { getAllLessons, createEpisode } from '../../lib/api';
import type { ModuleWithLessons } from '../../lib/types';

export default function NewEpisode() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [format, setFormat] = useState<'SHORT' | 'EPISODE'>('SHORT');
  const [series, setSeries] = useState('how-pieces-move');
  const [selectedModuleCode, setSelectedModuleCode] = useState('');
  const [selectedLessonNumber, setSelectedLessonNumber] = useState<number | null>(null);

  useEffect(() => {
    getAllLessons()
      .then(data => {
        setModules(data);
        if (data.length > 0) {
          setSelectedModuleCode(data[0].code);
          if (data[0].lessons.length > 0) {
            setSelectedLessonNumber(data[0].lessons[0].lessonNumber);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const selectedModule = modules.find(m => m.code === selectedModuleCode);
  const lessons = selectedModule?.lessons || [];

  const handleModuleChange = (code: string) => {
    setSelectedModuleCode(code);
    const mod = modules.find(m => m.code === code);
    if (mod && mod.lessons.length > 0) {
      setSelectedLessonNumber(mod.lessons[0].lessonNumber);
    } else {
      setSelectedLessonNumber(null);
    }
  };

  const handleCreate = async () => {
    if (!selectedModuleCode || selectedLessonNumber === null) return;
    setCreating(true);
    setError(null);
    try {
      const episode = await createEpisode({
        format,
        series,
        moduleCode: selectedModuleCode,
        lessonNumber: selectedLessonNumber,
      });
      navigate(`/episodes/${episode.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create episode');
      setCreating(false);
    }
  };

  const canCreate = selectedModuleCode && selectedLessonNumber !== null && !creating;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Back button */}
        <button
          onClick={() => navigate('/episodes')}
          className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 transition-colors min-h-[44px]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Episodes
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stc-purple-100 flex items-center justify-center">
            <FilmIcon className="h-5 w-5 text-stc-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">New Episode</h1>
            <p className="text-sm text-neutral-500">Create a YouTube video from a curriculum lesson</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-neutral-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Format */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">Format</label>
              <div className="flex gap-3">
                {(['SHORT', 'EPISODE'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all duration-200 min-h-[44px] ${
                      format === f
                        ? 'border-stc-purple-500 bg-stc-purple-50 text-stc-purple-700'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                    }`}
                  >
                    <div className="font-semibold">{f === 'SHORT' ? 'Short' : 'Episode'}</div>
                    <div className="text-xs mt-0.5 font-normal text-neutral-500">
                      {f === 'SHORT' ? '45-60 seconds, 5-8 shots' : '3-5 minutes, 15-25 shots'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Series */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Series</label>
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                  focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white"
              >
                <option value="how-pieces-move">How Pieces Move</option>
                <option value="chesslandia-stories">Chesslandia Stories</option>
                <option value="puzzle-of-the-day">Puzzle of the Day</option>
              </select>
            </div>

            {/* Module */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Module</label>
              <select
                value={selectedModuleCode}
                onChange={(e) => handleModuleChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                  focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white"
              >
                {modules.map(mod => (
                  <option key={mod.id} value={mod.code}>
                    {mod.code} — {mod.title} {mod.ageGroup ? `(${mod.ageGroup})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Lesson */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Lesson</label>
              <select
                value={selectedLessonNumber ?? ''}
                onChange={(e) => setSelectedLessonNumber(parseInt(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-xl min-h-[44px]
                  focus:outline-none focus:ring-2 focus:ring-stc-purple-100 bg-white"
              >
                {lessons.map(l => (
                  <option key={l.id} value={l.lessonNumber}>
                    Lesson {l.lessonNumber}: {l.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-stc-pink/10 border border-red-100 px-4 py-3 text-sm text-stc-pink">
                {error}
              </div>
            )}

            {/* Create button */}
            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className={`w-full py-3 rounded-xl text-sm font-semibold text-white min-h-[44px]
                transition-all duration-200 ${
                canCreate
                  ? 'bg-stc-purple-500 hover:bg-stc-purple-600 shadow-sm'
                  : 'bg-neutral-300 cursor-not-allowed'
              }`}
            >
              {creating ? 'Creating...' : 'Create Episode'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
