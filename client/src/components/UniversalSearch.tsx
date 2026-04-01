import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon, BookOpenIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { searchUniversal, type UniversalSearchResponse } from '../lib/api';

interface UniversalSearchProps {
  onTopicSelect: (question: string) => void;
}

// Similarity score to color/label
function similarityBadge(score: number) {
  if (score >= 0.7) return { label: 'High', bg: 'bg-stc-green/10', text: 'text-stc-green' };
  if (score >= 0.5) return { label: 'Medium', bg: 'bg-stc-yellow/10', text: 'text-stc-orange' };
  return { label: 'Low', bg: 'bg-neutral-100', text: 'text-neutral-500' };
}

// Truncate content to ~120 chars for snippet display
function snippet(content: string, maxLen = 120): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

export default function UniversalSearch({ onTopicSelect }: UniversalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const executeSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const data = await searchUniversal(q.trim(), 10);
      setResults(data);
      setHasSearched(true);
    } catch {
      setError('Search is temporarily unavailable. Please try again.');
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search on input change
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      executeSearch(query);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, executeSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      executeSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults(null);
    setHasSearched(false);
    setError(null);
    inputRef.current?.focus();
  };

  const hasChunks = results && results.chunks.length > 0;
  const hasIllustrations = results && results.illustrations.length > 0;
  const hasResults = hasChunks || hasIllustrations;

  return (
    <div className="w-full max-w-3xl mx-auto mt-6 sm:mt-10 px-3 sm:px-4">
      {/* Section Header */}
      <p className="text-xs font-semibold text-stc-purple-400 uppercase tracking-widest mb-3 sm:mb-4 text-center">
        Search Curriculum & Media
      </p>

      {/* Search Input */}
      <div className="relative">
        {/* Search icon */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <MagnifyingGlassIcon className="w-5 h-5 text-stc-purple-300" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search lessons, characters, illustrations..."
          className="w-full pl-12 pr-12 py-3.5 bg-white rounded-xl shadow-card border-2 border-transparent
                     focus:border-stc-purple-200 focus:outline-none focus:shadow-card-hover
                     text-sm sm:text-base text-neutral-700 placeholder-neutral-400
                     transition-all duration-200 font-sans"
          aria-label="Search curriculum and media"
        />

        {/* Loading spinner or clear button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <ArrowPathIcon className="animate-spin w-5 h-5 text-stc-purple-400" />
          ) : query ? (
            <button
              onClick={handleClear}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Clear search"
            >
              <XMarkIcon className="w-4 h-4 text-neutral-400" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mt-4 p-3 bg-stc-pink/10 text-stc-pink rounded-xl text-sm text-center">
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !error && (
        <div className="mt-4 animate-fade-in">
          {!hasResults ? (
            <div className="text-center py-6 text-neutral-500 text-sm">
              No results found for "<span className="font-medium text-neutral-700">{results?.query}</span>"
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Curriculum Matches */}
              {hasChunks && (
                <div>
                  <h3 className="text-xs font-semibold text-stc-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpenIcon className="w-4 h-4" />
                    Curriculum
                  </h3>
                  <div className="space-y-2">
                    {results!.chunks.map((chunk) => {
                      const badge = similarityBadge(chunk.similarity);
                      return (
                        <button
                          key={chunk.id}
                          onClick={() => onTopicSelect(`Tell me about ${chunk.title} - ${chunk.section}`)}
                          className="w-full text-left p-3 bg-white rounded-xl shadow-card hover:shadow-card-hover
                                     border-2 border-transparent hover:border-stc-purple-200
                                     transition-all duration-200 group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-neutral-800 group-hover:text-stc-purple-600 transition-colors line-clamp-1">
                              {chunk.title}
                            </h4>
                            <span className={`flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                              {Math.round(chunk.similarity * 100)}%
                            </span>
                          </div>
                          <p className="text-xs text-stc-purple-400 font-medium mb-1">{chunk.section}</p>
                          <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">{snippet(chunk.content)}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Right Column: Illustration Matches */}
              {hasIllustrations && (
                <div>
                  <h3 className="text-xs font-semibold text-stc-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <PhotoIcon className="w-4 h-4" />
                    Illustrations
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {results!.illustrations.map((ill) => {
                      const badge = similarityBadge(ill.similarity);
                      return (
                        <button
                          key={ill.id}
                          onClick={() => navigate(`/images/${ill.id}`)}
                          className="text-left bg-white rounded-xl shadow-card hover:shadow-card-hover
                                     border-2 border-transparent hover:border-stc-purple-200
                                     transition-all duration-200 group overflow-hidden"
                        >
                          <div className="aspect-square w-full bg-neutral-100 relative overflow-hidden">
                            <img
                              src={ill.illustrationUrl}
                              alt={ill.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                            <span className={`absolute top-1.5 right-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} backdrop-blur-sm`}>
                              {Math.round(ill.similarity * 100)}%
                            </span>
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-semibold text-neutral-800 group-hover:text-stc-purple-600 transition-colors line-clamp-1">
                              {ill.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
