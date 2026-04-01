import { useRef, useEffect, useState } from 'react';
import {
  MagnifyingGlassIcon,
  VideoCameraIcon,
  TrashIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid } from '@heroicons/react/20/solid';
import type { Illustration } from '../../lib/types';

interface VideoGalleryProps {
  videos: Illustration[];
  isLoading: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  onSelect: (video: Illustration) => void;
  onDelete: (video: Illustration) => void;
}

function VideoCard({
  video,
  onSelect,
  onDelete,
}: {
  video: Illustration;
  onSelect: (v: Illustration) => void;
  onDelete: (v: Illustration) => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const thumbnailUrl =
    video.thumbnailUrl ||
    video.sourceIllustration?.illustrationUrl ||
    null;

  const isGenerating = video.status === 'GENERATING';
  const isFailed = video.status === 'FAILED';

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(video);
  };

  return (
    <button
      onClick={() => onSelect(video)}
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
      {/* Thumbnail container - 16:9 aspect ratio for video */}
      <div className="relative aspect-video overflow-hidden bg-neutral-900">
        {/* Generating state */}
        {isGenerating && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-neutral-900/80 backdrop-blur-sm">
            <div className="relative w-10 h-10 mb-3">
              <div className="absolute inset-0 rounded-full border-2 border-stc-purple-200/30" />
              <div className="absolute inset-0 rounded-full border-2 border-stc-purple-400 border-t-transparent animate-spin" />
            </div>
            <span className="text-xs font-medium text-stc-purple-300 animate-pulse-soft">Generating...</span>
          </div>
        )}

        {/* Failed state */}
        {isFailed && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stc-pink/80 backdrop-blur-sm">
            <ExclamationCircleIcon className="w-8 h-8 text-stc-pink mb-2" />
            <span className="text-xs font-medium text-stc-pink">Generation failed</span>
          </div>
        )}

        {/* Thumbnail image or video first-frame fallback */}
        {thumbnailUrl && !imageError ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 bg-neutral-800 animate-pulse" />
            )}
            <img
              src={thumbnailUrl}
              alt={video.name}
              className={`
                relative z-10 w-full h-full object-cover
                transition-opacity duration-300
                ${imageLoaded ? 'opacity-100' : 'opacity-0'}
              `}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </>
        ) : video.videoUrl ? (
          <video
            src={video.videoUrl}
            preload="metadata"
            muted
            playsInline
            className="relative z-10 w-full h-full object-cover"
            onLoadedData={() => setImageLoaded(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
            <VideoCameraIcon className="w-10 h-10 text-neutral-600" />
          </div>
        )}

        {/* Play icon overlay (only when not generating/failed) */}
        {!isGenerating && !isFailed && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <div
              className={`
                w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center
                transition-all duration-200
                ${isHovered ? 'scale-110 bg-stc-purple-500/80' : ''}
              `}
            >
              <PlayIconSolid className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Duration badge */}
        {video.duration && !isGenerating && !isFailed && (
          <div className="absolute bottom-2 right-2 z-30 px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-medium text-white tabular-nums">
            {video.duration}s
          </div>
        )}

        {/* Hover overlay with delete action */}
        <div
          className={`
            absolute inset-0 z-20 transition-all duration-200
            ${isHovered ? 'bg-black/10' : ''}
          `}
        >
          <div
            className={`
              absolute top-2 right-2 flex gap-1.5
              transition-all duration-200
              ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}
            `}
          >
            <span
              role="button"
              tabIndex={0}
              onClick={handleDelete}
              onKeyDown={(e) => e.key === 'Enter' && handleDelete(e as unknown as React.MouseEvent)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur-sm text-neutral-700 hover:bg-stc-pink/10 hover:text-stc-pink transition-colors shadow-sm cursor-pointer"
              title="Delete"
            >
              <TrashIcon className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Info bar */}
      <div className="p-2.5">
        <p className="text-xs font-medium text-neutral-800 truncate" title={video.name}>
          {video.name}
        </p>
        <div className="mt-1 flex items-center gap-2">
          {isGenerating ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-purple-100 text-stc-purple-700">
              <span className="w-1.5 h-1.5 rounded-full bg-stc-purple-500 animate-pulse" />
              Generating
            </span>
          ) : isFailed ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-pink/15 text-stc-pink">
              Failed
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-blue/15 text-stc-navy">
              Video
            </span>
          )}
          {video.duration && (
            <span className="text-[10px] text-neutral-400">
              {video.duration}s
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function VideoGallery({
  videos,
  isLoading,
  search,
  onSearchChange,
  onSelect,
  onDelete,
}: VideoGalleryProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  // Skeleton cards for loading state
  const skeletonCards = Array.from({ length: 8 }, (_, i) => (
    <div key={`skeleton-${i}`} className="rounded-xl overflow-hidden bg-white shadow-sm animate-pulse">
      <div className="aspect-video bg-neutral-100" />
      <div className="p-2.5 space-y-2">
        <div className="h-4 bg-neutral-100 rounded-lg w-3/4" />
        <div className="h-3 bg-neutral-100 rounded-full w-1/3" />
      </div>
    </div>
  ));

  return (
    <div className="space-y-4">
      {/* Search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            defaultValue={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search videos..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-neutral-50 shadow-sm
              focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 focus:bg-white
              placeholder:text-neutral-400 transition-all min-h-[44px]"
          />
        </div>
      </div>

      {/* Gallery grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {skeletonCards}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <VideoCameraIcon className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-1">No videos yet</h3>
          <p className="text-xs text-neutral-400 max-w-xs">
            {search
              ? `No results for "${search}". Try a different search term.`
              : 'Generate your first animation!'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
