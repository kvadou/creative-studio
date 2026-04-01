import { useState, useRef, useCallback, useEffect } from 'react';
import { CameraIcon, PencilSquareIcon, SparklesIcon, CheckIcon, XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { Illustration, IllustrationGeneration } from '../../lib/types';
import {
  uploadIllustrationPhoto,
  generateIllustration,
  pollIllustrationStatus,
  selectIllustrationVariant,
} from '../../lib/api';

type UploadPhase = 'idle' | 'preview' | 'uploading' | 'generating' | 'complete' | 'error';

interface UploadPanelProps {
  onComplete: (illustration: Illustration) => void;
}

export default function UploadPanel({ onComplete }: UploadPanelProps) {
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState('');
  const [illustration, setIllustration] = useState<Illustration | null>(null);
  const [generations, setGenerations] = useState<IllustrationGeneration[]>([]);
  const [selectedGenId, setSelectedGenId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Cleanup preview URL on unmount or change
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) return;

    // Revoke previous preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setPhase('preview');
    setIsExpanded(true);
    setErrorMessage(null);
    setGenerations([]);
    setSelectedGenId(null);
    setIllustration(null);
  }, [previewUrl]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  }, [handleFileSelect]);

  const startPolling = useCallback((illustrationId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const result = await pollIllustrationStatus(illustrationId);

        if (result.status === 'COMPLETED' && result.generations) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setGenerations(result.generations);
          setPhase('complete');
        } else if (result.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setErrorMessage(result.error || 'Generation failed. Please try again.');
          setPhase('error');
        }
      } catch {
        // Don't stop polling on transient errors
      }
    }, 2000);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!file || !characterName.trim()) return;

    try {
      setPhase('uploading');
      setErrorMessage(null);

      const uploaded = await uploadIllustrationPhoto(characterName.trim(), file);
      setIllustration(uploaded);

      setPhase('generating');

      const genResult = await generateIllustration(uploaded.id);
      startPolling(genResult.illustrationId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('error');
    }
  }, [file, characterName, startPolling]);

  const handleRegenerate = useCallback(async () => {
    if (!illustration) return;

    try {
      setPhase('generating');
      setErrorMessage(null);
      setGenerations([]);
      setSelectedGenId(null);

      const genResult = await generateIllustration(illustration.id);
      startPolling(genResult.illustrationId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setPhase('error');
    }
  }, [illustration, startPolling]);

  const handleSelectVariant = useCallback((genId: string) => {
    setSelectedGenId(genId);
  }, []);

  const handleSaveToLibrary = useCallback(async () => {
    if (!illustration || !selectedGenId) return;

    try {
      await selectIllustrationVariant(illustration.id, selectedGenId);

      // Refresh illustration data
      onComplete(illustration);

      // Reset the panel
      reset();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save selection');
    }
  }, [illustration, selectedGenId, onComplete]);

  const reset = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPhase('idle');
    setFile(null);
    setPreviewUrl(null);
    setCharacterName('');
    setIllustration(null);
    setGenerations([]);
    setSelectedGenId(null);
    setErrorMessage(null);
    setIsExpanded(false);

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [previewUrl]);

  // Idle/collapsed state: just the drop zone
  if (!isExpanded && phase === 'idle') {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-2xl border-2 border-dashed
          transition-all duration-200 ease-out
          ${isDragOver
            ? 'border-stc-purple-400 bg-stc-purple-50 scale-[1.01]'
            : 'border-neutral-300 bg-white hover:border-stc-purple-300 hover:bg-stc-purple-50/50'
          }
        `}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-4 px-4">
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center
            transition-colors duration-200
            ${isDragOver ? 'bg-stc-purple-100' : 'bg-neutral-100'}
          `}>
            <CameraIcon className={`w-6 h-6 ${isDragOver ? 'text-stc-purple-500' : 'text-neutral-400'}`} />
          </div>
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-neutral-700">
              Drop a photo or <span className="text-stc-purple-500">click to browse</span>
            </p>
            <p className="text-xs text-neutral-400 mt-0.5">PNG, JPG, or WEBP up to 10MB</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
    );
  }

  // Expanded state
  return (
    <div className="rounded-2xl bg-white shadow-card overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-100">
        <h3 className="text-sm font-semibold text-neutral-800">
          {phase === 'complete' ? 'Select Illustration' : 'Generate Illustration'}
        </h3>
        <button
          onClick={reset}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          title="Cancel"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3">
        {/* Preview + form phase */}
        {phase === 'preview' && (
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Photo preview */}
            <div className="relative w-full sm:w-40 aspect-square rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group"
                title="Change photo"
              >
                <span className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <PencilSquareIcon className="w-4 h-4 text-neutral-700" />
                </span>
              </button>
            </div>

            {/* Name input + generate button */}
            <div className="flex-1 flex flex-col gap-3">
              <div>
                <label htmlFor="character-name" className="block text-xs font-medium text-neutral-600 mb-1.5">
                  Character Name
                </label>
                <input
                  id="character-name"
                  type="text"
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  placeholder="e.g. King Shaky"
                  className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm
                    focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                    placeholder:text-neutral-400 transition-shadow"
                  autoFocus
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={!characterName.trim()}
                className={`
                  w-full py-3 rounded-xl text-sm font-semibold text-white
                  transition-all duration-200
                  min-h-[44px]
                  ${characterName.trim()
                    ? 'bg-stc-purple-500 hover:bg-stc-purple-600 active:bg-stc-purple-700 shadow-sm hover:shadow-md'
                    : 'bg-neutral-300 cursor-not-allowed'
                  }
                `}
              >
                Generate Illustration
              </button>
            </div>
          </div>
        )}

        {/* Uploading phase */}
        {phase === 'uploading' && (
          <div className="flex flex-col items-center py-8">
            <div className="relative w-12 h-12 mb-4">
              <svg className="w-12 h-12 text-stc-purple-200" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" />
              </svg>
              <svg className="absolute inset-0 w-12 h-12 text-stc-purple-500 animate-spin" viewBox="0 0 48 48" fill="none">
                <path d="M24 4a20 20 0 0 1 20 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm font-medium text-neutral-700">Uploading photo...</p>
            <p className="text-xs text-neutral-400 mt-1">This will only take a moment</p>
          </div>
        )}

        {/* Generating phase */}
        {phase === 'generating' && (
          <div className="flex flex-col items-center py-8">
            <div className="relative w-16 h-16 mb-4">
              {/* Outer ring pulse */}
              <div className="absolute inset-0 rounded-full border-2 border-stc-purple-200 animate-ping opacity-20" />
              {/* Spinning gradient ring */}
              <svg className="w-16 h-16 animate-spin" viewBox="0 0 64 64" fill="none" style={{ animationDuration: '1.5s' }}>
                <circle cx="32" cy="32" r="28" stroke="#E8E3F0" strokeWidth="3" />
                <path d="M32 4a28 28 0 0 1 28 28" stroke="url(#gen-grad)" strokeWidth="3" strokeLinecap="round" />
                <defs>
                  <linearGradient id="gen-grad" x1="32" y1="4" x2="60" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6A469D" />
                    <stop offset="1" stopColor="#50C8DF" />
                  </linearGradient>
                </defs>
              </svg>
              {/* Center icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <SparklesIcon className="w-6 h-6 text-stc-purple-500" />
              </div>
            </div>
            <p className="text-sm font-semibold text-neutral-800 animate-pulse-soft">Generating illustration...</p>
            <p className="text-xs text-neutral-400 mt-1">AI is creating your character art</p>
            <div className="flex gap-1 mt-4">
              <span className="w-1.5 h-1.5 rounded-full bg-stc-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-stc-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-stc-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Complete phase — show generated variants */}
        {phase === 'complete' && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500">
              Select your preferred variant, then save to library.
            </p>

            {/* Variants grid / row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {generations.map((gen) => {
                const imgUrl = gen.savedImageUrl || gen.outputImageUrl;
                const isSelected = selectedGenId === gen.id;

                return (
                  <button
                    key={gen.id}
                    onClick={() => handleSelectVariant(gen.id)}
                    className={`
                      relative aspect-square rounded-xl overflow-hidden border-2
                      transition-all duration-200
                      ${isSelected
                        ? 'border-stc-purple-500 ring-2 ring-stc-purple-200 scale-[1.02]'
                        : 'border-neutral-200 hover:border-stc-purple-300'
                      }
                    `}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={`Variant`}
                        className="w-full h-full object-contain bg-neutral-50"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                        <span className="text-xs text-neutral-400">No image</span>
                      </div>
                    )}
                    {/* Selection check */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-stc-purple-500 flex items-center justify-center shadow-sm">
                        <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleRegenerate}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                  hover:bg-neutral-50 active:bg-neutral-100 transition-colors min-h-[44px]"
              >
                Regenerate
              </button>
              <button
                onClick={handleSaveToLibrary}
                disabled={!selectedGenId}
                className={`
                  flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                  transition-all duration-200 min-h-[44px]
                  ${selectedGenId
                    ? 'bg-stc-purple-500 hover:bg-stc-purple-600 active:bg-stc-purple-700 shadow-sm'
                    : 'bg-neutral-300 cursor-not-allowed'
                  }
                `}
              >
                Save to Library
              </button>
            </div>
          </div>
        )}

        {/* Error phase */}
        {phase === 'error' && (
          <div className="flex flex-col items-center py-6">
            <div className="w-12 h-12 rounded-full bg-stc-pink/10 flex items-center justify-center mb-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-stc-pink" />
            </div>
            <p className="text-sm font-medium text-neutral-800 mb-1">Something went wrong</p>
            <p className="text-xs text-neutral-500 text-center max-w-xs mb-4">
              {errorMessage || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={reset}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                  hover:bg-neutral-50 transition-colors min-h-[44px]"
              >
                Start Over
              </button>
              {illustration && (
                <button
                  onClick={handleRegenerate}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500
                    hover:bg-stc-purple-600 transition-colors shadow-sm min-h-[44px]"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input for re-selecting */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}