import { useState, useEffect, useCallback } from 'react';
import { getPipelineData, type PipelineData, type StyleBible } from '../../lib/api';
import PipelineHealth from './PipelineHealth';
import PipelineFlow from './PipelineFlow';
import StyleBibleEditor from './StyleBibleEditor';
import SearchPlayground from './SearchPlayground';

export default function PipelineDashboard() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPipelineData()
      .then(setData)
      .catch(() => setError('Failed to load pipeline data'))
      .finally(() => setLoading(false));
  }, []);

  const handleStyleBibleSaved = useCallback((updated: StyleBible) => {
    setData(prev => prev ? { ...prev, styleBible: updated } : prev);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-neutral-200 p-4 animate-pulse">
              <div className="h-5 w-5 bg-neutral-200 rounded mb-3" />
              <div className="h-7 bg-neutral-200 rounded w-16 mb-1" />
              <div className="h-3 bg-neutral-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 animate-pulse h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-neutral-500">
        <p className="text-sm">{error || 'Something went wrong'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-3 text-sm text-stc-purple-600 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PipelineHealth stats={data.stats} />
      <PipelineFlow stats={data.stats} />
      <StyleBibleEditor
        styleBible={data.styleBible}
        characters={data.characters}
        onSaved={handleStyleBibleSaved}
      />
      <SearchPlayground />
    </div>
  );
}
