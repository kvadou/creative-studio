import { useEffect, useCallback, useState } from 'react';
import { TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Illustration } from '../../lib/types';

interface DeleteConfirmModalProps {
  illustration: Illustration;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function DeleteConfirmModal({
  illustration,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up">
        <div className="p-6 text-center">
          {/* Warning icon */}
          <div className="w-12 h-12 rounded-full bg-stc-pink/10 flex items-center justify-center mx-auto mb-4">
            <TrashIcon className="w-6 h-6 text-stc-pink" />
          </div>

          <h3 className="text-base font-semibold text-neutral-800 mb-1">Delete illustration?</h3>
          <p className="text-sm text-neutral-500">
            &ldquo;{illustration.name}&rdquo; will be permanently deleted. This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
              hover:bg-neutral-50 transition-colors duration-200 min-h-[44px] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-pink
              hover:bg-stc-pink active:bg-stc-pink transition-colors duration-200 shadow-sm min-h-[44px]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <span className="flex items-center justify-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Deleting...
              </span>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}