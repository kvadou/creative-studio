import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import {
  queueBatchGeneration,
  getBatchStatus,
  getBatch,
  getChessConcepts,
} from '../../lib/api';
import type {
  AgeBand,
  StoryDensity,
  ProgressionItem,
  BatchStatus,
  BatchResponse,
  BatchStatusResponse,
} from '../../lib/api';

// Status messages for progress display
const STATUS_MESSAGES: Record<BatchStatus, { title: string; color: string }> = {
  PENDING: { title: 'Queued', color: 'text-neutral-600' },
  PROCESSING: { title: 'Generating...', color: 'text-stc-purple-600' },
  COMPLETED: { title: 'Completed', color: 'text-stc-green' },
  FAILED: { title: 'Failed', color: 'text-stc-pink' },
  PARTIALLY_COMPLETED: { title: 'Partially Completed', color: 'text-stc-yellow' },
};

const AGE_BANDS: { value: AgeBand; label: string; description: string }[] = [
  { value: 'THREE_TO_SEVEN', label: '3-7 years', description: 'Acme Creative - Playful, whimsical' },
  { value: 'EIGHT_TO_NINE', label: '8-9 years', description: 'Epic Chess - Balanced adventure' },
  { value: 'TEN_TO_TWELVE', label: '10-12 years', description: 'Strategic - Anecdotal' },
];

const STORY_DENSITIES: { value: StoryDensity; label: string; description: string }[] = [
  { value: 'HIGH', label: 'High', description: 'Story-first, longer narratives' },
  { value: 'MEDIUM', label: 'Medium', description: 'Balanced story and chess' },
  { value: 'LOW', label: 'Low', description: 'Chess-first, anecdotal stories' },
];

interface ProgressionFormItem {
  id: string;
  concept: string;
  description: string;
}

export function BatchGenerator() {
  const navigate = useNavigate();

  // Form state
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('THREE_TO_SEVEN');
  const [storyDensity, setStoryDensity] = useState<StoryDensity>('MEDIUM');
  const [progressionItems, setProgressionItems] = useState<ProgressionFormItem[]>([
    { id: '1', concept: '', description: '' },
  ]);
  const [concepts, setConcepts] = useState<string[]>([]);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Polling ref
  const pollingRef = useRef<number | null>(null);

  // Load concepts on mount
  useEffect(() => {
    getChessConcepts()
      .then(setConcepts)
      .catch((err) => console.error('Failed to load concepts:', err));
  }, []);

  // Polling callback
  const pollBatchStatus = useCallback(async () => {
    if (!batchId) return;

    try {
      const status = await getBatchStatus(batchId);
      setBatchStatus(status);

      // Check if batch is complete (success, failed, or partial)
      if (['COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED'].includes(status.status)) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }

        // Fetch full batch with lessons
        const fullBatch = await getBatch(batchId);
        setBatchResult(fullBatch);
        setIsGenerating(false);
      }
    } catch (err) {
      console.error('Polling failed:', err);
    }
  }, [batchId]);

  // Start polling when batch ID is set
  useEffect(() => {
    if (batchId && isGenerating) {
      // Initial poll
      pollBatchStatus();

      // Poll every 3 seconds
      pollingRef.current = window.setInterval(pollBatchStatus, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [batchId, isGenerating, pollBatchStatus]);

  function addProgressionItem() {
    if (progressionItems.length >= 5) return;
    setProgressionItems([
      ...progressionItems,
      { id: Date.now().toString(), concept: '', description: '' },
    ]);
  }

  function removeProgressionItem(id: string) {
    if (progressionItems.length <= 1) return;
    setProgressionItems(progressionItems.filter((item) => item.id !== id));
  }

  function updateProgressionItem(id: string, field: 'concept' | 'description', value: string) {
    setProgressionItems(
      progressionItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate
    if (!name.trim()) {
      setError('Batch name is required');
      return;
    }

    const filledItems = progressionItems.filter((item) => item.concept.trim());
    if (filledItems.length === 0) {
      setError('At least one lesson concept is required');
      return;
    }

    // Build progression array
    const progression: ProgressionItem[] = filledItems.map((item, index) => ({
      lessonNum: index + 1,
      concept: item.concept.trim(),
      description: item.description.trim() || undefined,
    }));

    try {
      setIsGenerating(true);
      const response = await queueBatchGeneration({
        name: name.trim(),
        ageBand,
        storyDensity,
        progression,
      });

      setBatchId(response.id);
    } catch (err) {
      console.error('Failed to queue batch:', err);
      setError(err instanceof Error ? err.message : 'Failed to start batch generation');
      setIsGenerating(false);
    }
  }

  function handleReset() {
    setName('');
    setAgeBand('THREE_TO_SEVEN');
    setStoryDensity('MEDIUM');
    setProgressionItems([{ id: '1', concept: '', description: '' }]);
    setBatchId(null);
    setBatchStatus(null);
    setBatchResult(null);
    setError(null);
    setIsGenerating(false);
  }

  // Reusable mode tabs component
  const ModeTabs = () => (
    <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg w-fit">
      <button
        onClick={() => navigate('/generator')}
        className="px-4 py-1.5 text-sm font-medium rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-white/50 transition-colors"
      >
        Single Lesson
      </button>
      <button
        className="px-4 py-1.5 text-sm font-medium rounded-md bg-white text-neutral-900 shadow-sm"
      >
        Batch (Multi-Lesson)
      </button>
    </div>
  );

  // Show results if batch is complete
  if (batchResult) {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">Batch Complete</h1>
              <p className="text-sm text-neutral-500">{batchResult.name}</p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-stc-purple-600 hover:bg-stc-purple-50 rounded-lg transition-colors"
            >
              ← New Batch
            </button>
          </div>
          <ModeTabs />
        </div>

        {/* Status Banner */}
        <div
          className={`px-6 py-3 border-b text-sm ${
            batchResult.status === 'COMPLETED'
              ? 'bg-stc-green/10 border-stc-green/20 text-stc-green'
              : batchResult.status === 'FAILED'
                ? 'bg-stc-pink/10 border-stc-pink/20 text-stc-pink'
                : 'bg-stc-yellow/10 border-stc-yellow/20 text-stc-yellow'
          }`}
        >
          {batchResult.status === 'COMPLETED'
            ? `All ${batchResult.completedLessons} lessons generated successfully!`
            : batchResult.status === 'FAILED'
              ? `Generation failed: ${batchResult.errorMessage || 'Unknown error'}`
              : `${batchResult.completedLessons} of ${batchResult.lessonCount} lessons completed. ${batchResult.failedLessons} failed.`}
        </div>

        {/* Lessons List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {batchResult.lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="border border-neutral-200 rounded-lg p-4 hover:border-stc-purple-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-500">
                        #{lesson.batchSequence}
                      </span>
                      <h3 className="font-medium text-neutral-900">
                        {lesson.title || lesson.chessConceptKey}
                      </h3>
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">
                      Concept: {lesson.chessConceptKey}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {lesson.aiReviewScore !== null && (
                      <span
                        className={`text-sm font-medium ${
                          lesson.aiReviewScore >= 80
                            ? 'text-stc-green'
                            : lesson.aiReviewScore >= 60
                              ? 'text-stc-yellow'
                              : 'text-stc-pink'
                        }`}
                      >
                        {lesson.aiReviewScore}%
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        lesson.status === 'DRAFT'
                          ? 'bg-stc-blue/15 text-stc-navy'
                          : lesson.status === 'APPROVED'
                            ? 'bg-stc-green/15 text-stc-green'
                            : lesson.status === 'FAILED'
                              ? 'bg-stc-pink/15 text-stc-pink'
                              : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {lesson.status}
                    </span>
                  </div>
                </div>
                {lesson.status === 'DRAFT' && (
                  <div className="mt-3">
                    <a
                      href={`/curriculum/lesson/${lesson.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-stc-purple-600 hover:underline"
                    >
                      Review & Edit →
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show progress if generating
  if (isGenerating && batchStatus) {
    const progressPercent =
      batchStatus.lessonCount > 0
        ? Math.round((batchStatus.completedLessons / batchStatus.lessonCount) * 100)
        : 0;

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200">
          <div className="mb-3">
            <h1 className="text-xl font-semibold text-neutral-900">Generating Batch</h1>
            <p className="text-sm text-neutral-500">{batchStatus.name}</p>
          </div>
          <ModeTabs />
        </div>

        {/* Progress */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            {/* Spinner */}
            <div className="animate-spin w-16 h-16 border-4 border-stc-purple-600 border-t-transparent rounded-full mx-auto mb-6" />

            {/* Status */}
            <p className={`text-lg font-medium ${STATUS_MESSAGES[batchStatus.status].color}`}>
              {STATUS_MESSAGES[batchStatus.status].title}
            </p>

            {/* Progress bar */}
            <div className="mt-4 bg-neutral-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-stc-purple-500 h-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Progress text */}
            <p className="mt-2 text-sm text-neutral-600">
              {batchStatus.currentLesson > 0
                ? `Generating lesson ${batchStatus.currentLesson} of ${batchStatus.lessonCount}`
                : 'Starting...'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {batchStatus.completedLessons} completed, {batchStatus.failedLessons} failed
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show form
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-neutral-200">
        <div className="mb-3">
          <h1 className="text-xl font-semibold text-neutral-900">Curriculum Generator</h1>
          <p className="text-sm text-neutral-500">
            Generate multiple lessons with coherent progression (max 5 per batch)
          </p>
        </div>
        <ModeTabs />
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-stc-pink/10 border border-stc-pink/20 text-stc-pink px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Batch Name */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Batch Name <span className="text-stc-pink">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Forks and Pins Progression"
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
              />
            </div>

            {/* Age Band */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Target Age Band *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {AGE_BANDS.map((band) => (
                  <button
                    key={band.value}
                    type="button"
                    onClick={() => setAgeBand(band.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      ageBand === band.value
                        ? 'border-stc-purple-500 bg-stc-purple-50 ring-2 ring-stc-purple-500'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <span className="block font-medium text-sm">{band.label}</span>
                    <span className="block text-xs text-neutral-500 mt-0.5">
                      {band.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Story Density */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Story Density *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {STORY_DENSITIES.map((density) => (
                  <button
                    key={density.value}
                    type="button"
                    onClick={() => setStoryDensity(density.value)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      storyDensity === density.value
                        ? 'border-stc-purple-500 bg-stc-purple-50 ring-2 ring-stc-purple-500'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <span className="block font-medium text-sm">{density.label}</span>
                    <span className="block text-xs text-neutral-500 mt-0.5">
                      {density.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Lesson Progression */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-neutral-700">
                  Lesson Progression * ({progressionItems.length}/5)
                </label>
                <button
                  type="button"
                  onClick={addProgressionItem}
                  disabled={progressionItems.length >= 5}
                  className="text-sm text-stc-purple-600 hover:text-stc-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Lesson
                </button>
              </div>

              <div className="space-y-3">
                {progressionItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex gap-3 items-start bg-neutral-50 p-3 rounded-lg"
                  >
                    <span className="text-sm font-medium text-neutral-500 mt-2 w-6">
                      {index + 1}.
                    </span>
                    <div className="flex-1 space-y-2">
                      <select
                        value={item.concept}
                        onChange={(e) => updateProgressionItem(item.id, 'concept', e.target.value)}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                      >
                        <option value="">Select concept...</option>
                        {concepts.map((concept) => (
                          <option key={concept} value={concept}>
                            {concept}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateProgressionItem(item.id, 'description', e.target.value)
                        }
                        placeholder="Optional: Focus or notes for this lesson"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                      />
                    </div>
                    {progressionItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProgressionItem(item.id)}
                        className="text-neutral-400 hover:text-stc-pink mt-2"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-neutral-200">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full px-6 py-3 bg-stc-purple-500 text-white rounded-lg font-medium hover:bg-stc-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Generate {progressionItems.filter((i) => i.concept.trim()).length} Lesson
                {progressionItems.filter((i) => i.concept.trim()).length !== 1 ? 's' : ''}
              </button>
            </div>
          </form>

          {/* Help text */}
          <div className="mt-6 text-sm text-neutral-500 space-y-2">
            <p>
              <strong>How batch generation works:</strong> Lessons are generated sequentially,
              with each lesson receiving context from previous ones for coherent progression.
            </p>
            <p>
              <strong>Tip:</strong> Start with foundational concepts and progress to more
              advanced topics. For example: "pawn-movement" → "pawn-capture" → "en-passant".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
