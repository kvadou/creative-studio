import { useState } from 'react';
import { ExclamationCircleIcon, ArrowDownTrayIcon, TrashIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { Illustration } from '../../lib/types';

interface IllustrationCardProps {
  illustration: Illustration;
  onSelect: (illustration: Illustration) => void;
  onDelete?: (illustration: Illustration) => void;
}

export default function IllustrationCard({ illustration, onSelect, onDelete }: IllustrationCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const displayUrl = illustration.illustrationUrl || illustration.sourcePhotoUrl;
  const isGenerating = illustration.status === 'GENERATING';
  const isFailed = illustration.status === 'FAILED';

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayUrl) {
      const link = document.createElement('a');
      link.href = displayUrl;
      link.download = `${illustration.name}.png`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(illustration);
  };

  return (
    <button
      onClick={() => onSelect(illustration)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        group relative w-full text-left rounded-xl overflow-hidden
        bg-white shadow-sm
        transition-all duration-200 ease-out
        hover:shadow-md hover:scale-[1.02]
        focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:ring-offset-2
      `}
    >
      {/* Image container — 3:4 aspect ratio */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* Checkerboard background for transparency */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
          }}
        />

        {/* Generating state */}
        {isGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="relative w-10 h-10 mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-stc-purple-200" />
              <div className="absolute inset-0 rounded-full border-2 border-stc-purple-500 border-t-transparent animate-spin" />
            </div>
            <span className="text-xs font-medium text-stc-purple-600 animate-pulse-soft">Generating...</span>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stc-pink/10/90 backdrop-blur-sm">
            <ExclamationCircleIcon className="w-8 h-8 text-stc-pink mb-2" />
            <span className="text-xs font-medium text-stc-pink">Generation failed</span>
          </div>
        )}

        {/* Image */}
        {displayUrl && !imageError ? (
          <>
            {/* Skeleton loader */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-neutral-200 animate-pulse" />
            )}
            <img
              src={displayUrl}
              alt={illustration.name}
              className={`
                relative z-10 w-full h-full object-contain
                transition-opacity duration-300
                ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              `}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-50">
            <PhotoIcon className="w-10 h-10 text-neutral-300" />
          </div>
        )}

        {/* Hover overlay with actions */}
        <div
          className={`
            absolute inset-0 z-20 bg-black/0 transition-all duration-200
            ${isHovered ? 'bg-black/20' : ''}
          `}
        >
          <div
            className={`
              absolute top-2 right-2 flex gap-1.5
              transition-all duration-200
              ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
            `}
          >
            {displayUrl && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDownload}
                onKeyDown={(e) => e.key === 'Enter' && handleDownload(e as unknown as React.MouseEvent)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm text-neutral-700 hover:bg-white hover:text-stc-purple-600 transition-colors duration-200 shadow-sm cursor-pointer"
                aria-label="Download"
                title="Download"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
              </span>
            )}
            {onDelete && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDelete}
                onKeyDown={(e) => e.key === 'Enter' && handleDelete(e as unknown as React.MouseEvent)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm text-neutral-700 hover:bg-stc-pink/10 hover:text-stc-pink transition-colors duration-200 shadow-sm cursor-pointer"
                aria-label="Delete"
                title="Delete"
              >
                <TrashIcon className="w-4 h-4" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="p-2.5">
        <p className="text-xs font-medium text-neutral-800 truncate" title={illustration.name}>
          {illustration.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {illustration.isOriginal ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-purple-100 text-stc-purple-700">
              Original
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-blue/15 text-stc-navy">
              AI Generated
            </span>
          )}
          {illustration.lesson && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-orange/15 text-stc-orange">
              M{illustration.lesson.module.code} L{illustration.lesson.lessonNumber}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}