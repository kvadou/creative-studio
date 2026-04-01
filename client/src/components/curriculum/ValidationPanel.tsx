import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { AIReview, ValidationChecklist, GeneratedContent } from '../../lib/api';
import { rerunAIReview, updateChecklist, approveLesson } from '../../lib/api';

interface ValidationPanelProps {
  lessonId: string;
  aiReview: AIReview | null;
  comparison: {
    lessonId: string;
    moduleCode: string;
    lessonNumber: number;
    title: string;
    rawContent: string;
  } | null;
  checklist: ValidationChecklist;
  generatedContent: GeneratedContent;
  onReviewUpdate: (review: AIReview) => void;
  onChecklistUpdate: (checklist: ValidationChecklist) => void;
  onStatusChange: (approved: boolean) => void;
}

type PanelTab = 'review' | 'compare' | 'checklist';

export function ValidationPanel({
  lessonId,
  aiReview,
  comparison,
  checklist,
  generatedContent,
  onReviewUpdate,
  onChecklistUpdate,
  onStatusChange,
}: ValidationPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('review');
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localChecklist, setLocalChecklist] = useState(checklist);

  async function handleRerunReview() {
    setIsReviewing(true);
    try {
      const result = await rerunAIReview(lessonId);
      onReviewUpdate(result.aiReview);
    } catch (err) {
      console.error('Failed to rerun review:', err);
    } finally {
      setIsReviewing(false);
    }
  }

  async function handleChecklistChange(key: keyof ValidationChecklist, value: boolean | null) {
    const updated = { ...localChecklist, [key]: value };
    setLocalChecklist(updated);

    setIsSaving(true);
    try {
      await updateChecklist(lessonId, updated);
      onChecklistUpdate(updated);
    } catch (err) {
      console.error('Failed to save checklist:', err);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApprove(approved: boolean) {
    try {
      await approveLesson(lessonId, approved);
      onStatusChange(approved);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 80) return 'text-stc-green bg-stc-green/15';
    if (score >= 60) return 'text-stc-yellow bg-stc-yellow/15';
    return 'text-stc-pink bg-stc-pink/15';
  }

  return (
    <div className="flex flex-col h-full border-l border-neutral-200">
      {/* Tabs */}
      <div className="flex border-b border-neutral-200 bg-neutral-50">
        {[
          { key: 'review', label: 'AI Review' },
          { key: 'compare', label: 'Side-by-Side' },
          { key: 'checklist', label: 'Checklist' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as PanelTab)}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-stc-purple-600 border-b-2 border-stc-purple-600 bg-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'review' && (
          <div className="space-y-4">
            {aiReview ? (
              <>
                {/* Overall Score */}
                <div className="text-center">
                  <div
                    className={`inline-block px-4 py-2 rounded-full text-2xl font-bold ${getScoreColor(
                      aiReview.score
                    )}`}
                  >
                    {Math.round(aiReview.score)}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1">Overall Score</p>
                </div>

                {/* Category Scores */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'formatCompliance', label: 'Format' },
                    { key: 'ageAppropriateness', label: 'Age-Appropriate' },
                    { key: 'chessAccuracy', label: 'Chess Accuracy' },
                    { key: 'toneConsistency', label: 'Tone' },
                  ].map((cat) => (
                    <div key={cat.key} className="bg-neutral-50 rounded-lg p-3">
                      <div className="text-xs text-neutral-500">{cat.label}</div>
                      <div className="text-lg font-medium">
                        {aiReview[cat.key as keyof AIReview] || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {aiReview.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-1">Notes</h4>
                    <p className="text-sm text-neutral-600">{aiReview.notes}</p>
                  </div>
                )}

                {/* Issues */}
                {aiReview.issues && aiReview.issues.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-neutral-700 mb-1">Issues</h4>
                    <ul className="list-disc list-inside text-sm text-stc-pink space-y-1">
                      {aiReview.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-neutral-500 py-8">
                No AI review yet.
              </div>
            )}

            {/* Rerun Review Button */}
            <button
              onClick={handleRerunReview}
              disabled={isReviewing}
              className="w-full py-2 px-4 border border-stc-purple-600 text-stc-purple-600 rounded-lg text-sm font-medium hover:bg-stc-purple-50 disabled:opacity-50 transition-colors"
            >
              {isReviewing ? 'Reviewing...' : 'Re-run AI Review'}
            </button>
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-4">
            {comparison ? (
              <>
                <div className="text-sm text-neutral-600 mb-2">
                  Comparing with: <span className="font-medium">{comparison.moduleCode} - Lesson {comparison.lessonNumber}</span>
                  <br />
                  <span className="text-neutral-500">{comparison.title}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-medium text-neutral-500 mb-2 uppercase">Generated</h4>
                    <div className="prose prose-xs max-w-none text-sm border border-neutral-200 rounded-lg p-3 bg-white max-h-96 overflow-y-auto">
                      <ReactMarkdown>{generatedContent.rawContent}</ReactMarkdown>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-medium text-neutral-500 mb-2 uppercase">Existing</h4>
                    <div className="prose prose-xs max-w-none text-sm border border-neutral-200 rounded-lg p-3 bg-white max-h-96 overflow-y-auto">
                      <ReactMarkdown>{comparison.rawContent}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-neutral-500 py-8">
                No comparison lesson found.
              </div>
            )}
          </div>
        )}

        {activeTab === 'checklist' && (
          <div className="space-y-4">
            <div className="space-y-3">
              {[
                { key: 'storyPresent', label: 'Story section present' },
                { key: 'teacherTipsPresent', label: 'Teacher tips included' },
                { key: 'chessercisesPresent', label: 'Chessercises included' },
                { key: 'ageAppropriate', label: 'Age-appropriate language' },
                { key: 'chessAccurate', label: 'Chess concepts accurate' },
                { key: 'mnemonicsCorrect', label: 'Mnemonics used correctly' },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm">{item.label}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleChecklistChange(
                          item.key as keyof ValidationChecklist,
                          true
                        )
                      }
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        localChecklist[item.key as keyof ValidationChecklist] === true
                          ? 'bg-stc-green text-white'
                          : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                      }`}
                    >
                      ✓
                    </button>
                    <button
                      onClick={() =>
                        handleChecklistChange(
                          item.key as keyof ValidationChecklist,
                          false
                        )
                      }
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        localChecklist[item.key as keyof ValidationChecklist] === false
                          ? 'bg-stc-pink text-white'
                          : 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300'
                      }`}
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {isSaving && (
              <p className="text-xs text-neutral-500 text-center">Saving...</p>
            )}

            {/* Approve/Reject Buttons */}
            <div className="pt-4 border-t border-neutral-200 space-y-2">
              <button
                onClick={() => handleApprove(true)}
                className="w-full py-2 px-4 bg-stc-green text-white rounded-lg text-sm font-medium hover:bg-stc-green transition-colors"
              >
                Approve Lesson
              </button>
              <button
                onClick={() => handleApprove(false)}
                className="w-full py-2 px-4 bg-stc-pink text-white rounded-lg text-sm font-medium hover:bg-stc-pink transition-colors"
              >
                Reject Lesson
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
