import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { XMarkIcon, ChevronDownIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  getABStatus,
  getABGroup,
  selectABVersion,
  type ABStatusResponse,
  type ABVersionFull,
  type ABGroupStatus,
  type GenerationStatus,
} from '../../lib/api';

interface ABComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  abGroupId: string;
  onVersionSelected?: (lessonId: string, variant: string) => void;
}

// Status display config
const STATUS_CONFIG: Record<GenerationStatus, { label: string; color: string; bg: string }> = {
  QUEUED: { label: 'Queued', color: 'text-neutral-600', bg: 'bg-neutral-100' },
  GENERATING: { label: 'Generating...', color: 'text-stc-blue', bg: 'bg-stc-blue/15' },
  REVIEWING: { label: 'Reviewing...', color: 'text-stc-purple-600', bg: 'bg-stc-purple-100' },
  DRAFT: { label: 'Ready', color: 'text-stc-green', bg: 'bg-stc-green/15' },
  REVIEWED: { label: 'Reviewed', color: 'text-stc-green', bg: 'bg-stc-green/15' },
  APPROVED: { label: 'Approved', color: 'text-stc-green', bg: 'bg-stc-green/20' },
  REJECTED: { label: 'Rejected', color: 'text-stc-pink', bg: 'bg-stc-pink/15' },
  FAILED: { label: 'Failed', color: 'text-stc-pink', bg: 'bg-stc-pink/15' },
};

export function ABComparisonModal({
  isOpen,
  onClose,
  abGroupId,
  onVersionSelected,
}: ABComparisonModalProps) {
  const [status, setStatus] = useState<ABStatusResponse | null>(null);
  const [fullGroup, setFullGroup] = useState<{ abGroupId: string; versions: ABVersionFull[] } | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Scroll modal to top when opened
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.scrollTop = 0;
      window.scrollTo(0, 0);
    }
  }, [isOpen]);

  // Poll for status
  const pollStatus = useCallback(async () => {
    try {
      const statusData = await getABStatus(abGroupId);
      setStatus(statusData);

      // If all versions are ready or failed, load full content
      if (statusData.status === 'COMPLETE' || statusData.status === 'PARTIALLY_COMPLETE') {
        const groupData = await getABGroup(abGroupId);
        setFullGroup(groupData);
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (statusData.status === 'FAILED') {
        setError('All versions failed to generate');
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    }
  }, [abGroupId]);

  // Start polling when modal opens
  useEffect(() => {
    if (!isOpen) return;

    // Initial fetch
    pollStatus();

    // Poll every 2 seconds
    pollingRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [isOpen, pollStatus]);

  // Handle version selection
  const handleSelect = async (lessonId: string, variant: string) => {
    setSelecting(lessonId);
    setError(null);

    try {
      await selectABVersion(abGroupId, lessonId);
      onVersionSelected?.(lessonId, variant);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select version');
    } finally {
      setSelecting(null);
    }
  };

  if (!isOpen) return null;

  // Determine overall group status message
  const getGroupStatusMessage = (groupStatus: ABGroupStatus | undefined): string => {
    switch (groupStatus) {
      case 'PROCESSING':
        return 'Generating 3 versions...';
      case 'COMPLETE':
        return 'All versions ready for comparison';
      case 'PARTIALLY_COMPLETE':
        return 'Some versions ready';
      case 'FAILED':
        return 'Generation failed';
      default:
        return 'Loading...';
    }
  };

  // Get versions to display
  const versions = fullGroup?.versions || (status?.versions?.map(v => ({
    ...v,
    rawContent: null,
    sections: {},
    aiReviewNotes: null,
    createdAt: v.updatedAt,
  } as ABVersionFull)) || []);

  // Sort by variant letter
  const sortedVersions = [...versions].sort((a, b) => a.variant.localeCompare(b.variant));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-gradient-to-r from-stc-purple-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">Compare Versions</h2>
            <p className="text-sm text-neutral-600 mt-1">
              {getGroupStatusMessage(status?.status)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-stc-pink/10 border border-stc-pink/20 rounded-lg text-stc-pink text-sm">
            {error}
          </div>
        )}

        {/* Loading state */}
        {!status && !error && (
          <div className="p-12 text-center text-neutral-500">
            <div className="animate-spin w-8 h-8 border-2 border-stc-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
            Loading versions...
          </div>
        )}

        {/* Version columns */}
        {sortedVersions.length > 0 && (
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {sortedVersions.map((version) => (
                <VersionCard
                  key={version.id}
                  version={version}
                  isSelected={selectedPreview === version.id}
                  onTogglePreview={() => setSelectedPreview(
                    selectedPreview === version.id ? null : version.id
                  )}
                  onSelect={() => handleSelect(version.id, version.variant)}
                  selecting={selecting === version.id}
                  disabled={selecting !== null}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <p className="text-xs text-neutral-500">
            Click "Select" on your preferred version to use it
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-neutral-700 hover:bg-neutral-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Individual version card component
interface VersionCardProps {
  version: ABVersionFull;
  isSelected: boolean;
  onTogglePreview: () => void;
  onSelect: () => void;
  selecting: boolean;
  disabled: boolean;
}

function VersionCard({
  version,
  isSelected,
  onTogglePreview,
  onSelect,
  selecting,
  disabled,
}: VersionCardProps) {
  const statusConfig = STATUS_CONFIG[version.status] || STATUS_CONFIG.QUEUED;
  const isReady = ['DRAFT', 'REVIEWED', 'APPROVED'].includes(version.status);
  const isFailed = version.status === 'FAILED';

  // Get variant color
  const variantColors: Record<string, { border: string; bg: string; text: string }> = {
    A: { border: 'border-stc-blue/30', bg: 'bg-stc-blue', text: 'text-stc-navy' },
    B: { border: 'border-stc-green/30', bg: 'bg-stc-green', text: 'text-stc-green' },
    C: { border: 'border-purple-300', bg: 'bg-stc-purple-500', text: 'text-stc-purple-700' },
  };
  const colors = variantColors[version.variant] || variantColors.A;

  return (
    <div
      className={`border-2 rounded-xl overflow-hidden transition-all ${
        version.wasSelected
          ? 'border-stc-purple-500 ring-2 ring-stc-purple-200'
          : colors.border
      }`}
    >
      {/* Card header */}
      <div className={`px-4 py-3 ${colors.bg} text-white flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">Version {version.variant}</span>
          {version.wasSelected && (
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
              Selected
            </span>
          )}
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Loading state */}
        {!isReady && !isFailed && (
          <div className="py-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-neutral-300 border-t-stc-purple-500 rounded-full mx-auto mb-3" />
            <p className="text-sm text-neutral-500">
              {version.status === 'GENERATING' ? 'Creating lesson content...' : 'Starting generation...'}
            </p>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="py-8 text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-stc-pink mx-auto mb-3" />
            <p className="text-sm text-stc-pink font-medium">Generation failed</p>
            {version.errorMessage && (
              <p className="text-xs text-neutral-500 mt-1">{version.errorMessage}</p>
            )}
          </div>
        )}

        {/* Ready state */}
        {isReady && (
          <>
            {/* Title */}
            <h3 className="font-semibold text-neutral-900 mb-2 line-clamp-2">
              {version.title || 'Untitled Lesson'}
            </h3>

            {/* AI Review Score */}
            {version.aiReviewScore !== null && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-neutral-500">AI Score:</span>
                <div className="flex items-center gap-1">
                  <div className="w-24 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        version.aiReviewScore >= 80
                          ? 'bg-stc-green'
                          : version.aiReviewScore >= 60
                          ? 'bg-stc-yellow'
                          : 'bg-stc-pink'
                      }`}
                      style={{ width: `${version.aiReviewScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">{version.aiReviewScore}</span>
                </div>
              </div>
            )}

            {/* Preview toggle */}
            <button
              type="button"
              onClick={onTogglePreview}
              className="w-full mb-3 px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-600 hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              <ChevronDownIcon
                className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-180' : ''}`}
              />
              {isSelected ? 'Hide Preview' : 'Show Preview'}
            </button>

            {/* Expanded preview */}
            {isSelected && version.rawContent && (
              <div className="mb-4 border border-neutral-200 rounded-lg overflow-hidden">
                <div className="max-h-80 overflow-y-auto p-3 bg-neutral-50">
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown>{version.rawContent}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Section summary */}
            <div className="flex flex-wrap gap-2 mb-4">
              {version.sections?.story && (
                <span className="px-2 py-1 bg-stc-blue/10 text-stc-navy text-xs rounded">Story ✓</span>
              )}
              {version.sections?.chessLesson && (
                <span className="px-2 py-1 bg-stc-green/10 text-stc-green text-xs rounded">Chess ✓</span>
              )}
              {version.sections?.teacherTips && (
                <span className="px-2 py-1 bg-stc-orange/10 text-stc-orange text-xs rounded">Tips ✓</span>
              )}
              {version.sections?.chessercises && (
                <span className="px-2 py-1 bg-stc-purple-50 text-stc-purple-700 text-xs rounded">Exercises ✓</span>
              )}
              {version.sections?.puzzles && version.sections.puzzles.length > 0 && (
                <span className="px-2 py-1 bg-pink-50 text-stc-pink text-xs rounded">
                  {version.sections.puzzles.length} Puzzle{version.sections.puzzles.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Select button */}
            <button
              type="button"
              onClick={onSelect}
              disabled={disabled || version.wasSelected}
              className={`w-full py-2.5 rounded-lg font-medium transition-colors ${
                version.wasSelected
                  ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed'
                  : 'bg-stc-purple-500 text-white hover:bg-stc-purple-600 disabled:opacity-50'
              }`}
            >
              {selecting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Selecting...
                </span>
              ) : version.wasSelected ? (
                '✓ Selected'
              ) : (
                'Select This Version'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ABComparisonModal;
