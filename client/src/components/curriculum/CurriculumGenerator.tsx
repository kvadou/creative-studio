import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GeneratorForm } from './GeneratorForm';
import { LessonPreview } from './LessonPreview';
import { ValidationPanel } from './ValidationPanel';
import { iterateLesson } from '../../lib/api';
import type { GenerationResponse, AIReview, ValidationChecklist, GenerationStatus } from '../../lib/api';

// Status messages for the loading overlay
const STATUS_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  QUEUED: { title: 'Queued', subtitle: 'Waiting to start...' },
  GENERATING: { title: 'Generating lesson...', subtitle: 'Creating content with AI' },
  REVIEWING: { title: 'Running AI review...', subtitle: 'Almost done' },
};

export function CurriculumGenerator() {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [iterationPrompt, setIterationPrompt] = useState('');
  const [isIterating, setIsIterating] = useState(false);
  const [status, setStatus] = useState<'generating' | 'approved' | 'rejected' | null>(null);

  const handleGenerationStatusChange = useCallback((newStatus: GenerationStatus | null) => {
    setGenerationStatus(newStatus);
  }, []);

  function handleGenerated(response: GenerationResponse) {
    setResult(response);
    setStatus('generating');
  }

  function handleReviewUpdate(review: AIReview) {
    if (result) {
      setResult({
        ...result,
        validation: { ...result.validation, aiReview: review },
      });
    }
  }

  function handleChecklistUpdate(checklist: ValidationChecklist) {
    if (result) {
      setResult({
        ...result,
        validation: { ...result.validation, checklist },
      });
    }
  }

  function handleStatusChange(approved: boolean) {
    setStatus(approved ? 'approved' : 'rejected');
  }

  async function handleIterate() {
    if (!result || !iterationPrompt.trim()) return;

    setIsIterating(true);
    try {
      const response = await iterateLesson(result.id, iterationPrompt);
      setResult({
        ...result,
        lesson: response.lesson,
      });
      setIterationPrompt('');
    } catch (err) {
      console.error('Failed to iterate:', err);
    } finally {
      setIsIterating(false);
    }
  }

  function handleNewLesson() {
    setResult(null);
    setStatus(null);
    setIterationPrompt('');
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">Curriculum Generator</h1>
            <p className="text-sm text-neutral-500">Create new Acme Creative lessons</p>
          </div>
          {result && (
            <button
              onClick={handleNewLesson}
              className="px-4 py-2 text-sm font-medium text-stc-purple-600 hover:bg-stc-purple-50 rounded-lg transition-colors duration-200 min-h-[44px]"
            >
              ← New Lesson
            </button>
          )}
        </div>
        {/* Mode Tabs */}
        <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg w-fit">
          <button
            className="px-4 py-1.5 text-sm font-medium rounded-md bg-white text-neutral-900 shadow-sm"
          >
            Single Lesson
          </button>
          <button
            onClick={() => navigate('/generator/batch')}
            className="px-4 py-1.5 text-sm font-medium rounded-md text-neutral-600 hover:text-neutral-900 hover:bg-white/50 transition-colors duration-200"
          >
            Batch (Multi-Lesson)
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {status === 'approved' && (
        <div className="px-6 py-3 bg-stc-green/10 border-b border-stc-green/20 text-stc-green text-sm">
          ✓ Lesson approved! It can now be exported for production use.
        </div>
      )}
      {status === 'rejected' && (
        <div className="px-6 py-3 bg-stc-pink/10 border-b border-stc-pink/20 text-stc-pink text-sm">
          ✗ Lesson rejected. Continue iterating or generate a new one.
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {!result ? (
          /* Generation Form */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
                <GeneratorForm
                  onGenerated={handleGenerated}
                  isGenerating={isGenerating}
                  setIsGenerating={setIsGenerating}
                  onStatusChange={handleGenerationStatusChange}
                />
              </div>

              {/* Help text */}
              <div className="mt-6 text-sm text-neutral-500 space-y-2">
                <p>
                  <strong>How it works:</strong> The generator uses your existing curriculum
                  as a reference to create new lessons that match Acme Creative style and format.
                </p>
                <p>
                  After generation, you'll see an AI quality review, side-by-side comparison
                  with similar existing lessons, and a validation checklist before approving.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Generated Lesson View */
          <>
            {/* Preview Section */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 overflow-hidden">
                <LessonPreview lesson={result.lesson} />
              </div>

              {/* Iteration Input */}
              <div className="p-3 sm:p-4 border-t border-neutral-200 bg-neutral-50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={iterationPrompt}
                    onChange={(e) => setIterationPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleIterate();
                      }
                    }}
                    placeholder="Refine the lesson... (e.g., 'Make the story shorter', 'Add a mnemonic for checkmate')"
                    className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 min-h-[44px]"
                    disabled={isIterating}
                  />
                  <button
                    onClick={handleIterate}
                    disabled={isIterating || !iterationPrompt.trim()}
                    className="px-4 py-2 bg-stc-purple-500 text-white rounded-lg font-medium hover:bg-stc-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 min-h-[44px]"
                  >
                    {isIterating ? 'Refining...' : 'Refine'}
                  </button>
                </div>
              </div>
            </div>

            {/* Validation Panel */}
            <div className="w-full md:w-96 md:flex-shrink-0 border-t md:border-t-0 md:border-l border-neutral-200">
              <ValidationPanel
                lessonId={result.id}
                aiReview={result.validation.aiReview}
                comparison={result.validation.comparison}
                checklist={result.validation.checklist}
                generatedContent={result.lesson}
                onReviewUpdate={handleReviewUpdate}
                onChecklistUpdate={handleChecklistUpdate}
                onStatusChange={handleStatusChange}
              />
            </div>
          </>
        )}
      </div>

      {/* Loading Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-stc-purple-600 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-neutral-600 font-medium">
              {generationStatus && STATUS_MESSAGES[generationStatus]
                ? STATUS_MESSAGES[generationStatus].title
                : 'Starting...'}
            </p>
            <p className="text-sm text-neutral-500 mt-1">
              {generationStatus && STATUS_MESSAGES[generationStatus]
                ? STATUS_MESSAGES[generationStatus].subtitle
                : 'Please wait'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
