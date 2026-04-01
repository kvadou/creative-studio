import { useRef, useEffect } from 'react';
import { MagnifyingGlassIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { Illustration } from '../../lib/types';
import IllustrationCard from './IllustrationCard';

interface IllustrationGalleryProps {
  illustrations: Illustration[];
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filter: 'all' | 'original' | 'generated';
  onFilterChange: (value: 'all' | 'original' | 'generated') => void;
  onSelect: (illustration: Illustration) => void;
  onDelete?: (illustration: Illustration) => void;
}

const FILTER_OPTIONS: { value: 'all' | 'original' | 'generated'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'original', label: 'Originals' },
  { value: 'generated', label: 'AI Generated' },
];

export default function IllustrationGallery({
  illustrations,
  isLoading,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onSelect,
  onDelete,
}: IllustrationGalleryProps) {
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
  const skeletonCards = Array.from({ length: 10 }, (_, i) => (
    <div key={`skeleton-${i}`} className="rounded-xl overflow-hidden bg-white shadow-sm animate-pulse">
      <div className="aspect-[3/4] bg-neutral-200" />
      <div className="p-2.5 space-y-2">
        <div className="h-4 bg-neutral-200 rounded-lg w-3/4" />
        <div className="h-3 bg-neutral-200 rounded-full w-1/3" />
      </div>
    </div>
  ));

  return (
    <div className="space-y-4">
      {/* Search + filter row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            defaultValue={search}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search illustrations..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-neutral-50 shadow-sm
              focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 focus:bg-white
              placeholder:text-neutral-400 transition-all min-h-[44px]"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 p-1.5 bg-neutral-100 rounded-xl self-start">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onFilterChange(opt.value)}
              className={`
                px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap
                transition-all duration-200 min-h-[44px]
                ${filter === opt.value
                  ? 'bg-white text-stc-purple-600 shadow-sm ring-1 ring-neutral-200/50'
                  : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {skeletonCards}
        </div>
      ) : illustrations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
            <PhotoIcon className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-700 mb-1">No illustrations yet</h3>
          <p className="text-xs text-neutral-400 max-w-xs">
            {search
              ? `No results for "${search}". Try a different search term.`
              : 'Upload a photo above to generate your first illustration.'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
          {illustrations.map((illustration) => (
            <IllustrationCard
              key={illustration.id}
              illustration={illustration}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}