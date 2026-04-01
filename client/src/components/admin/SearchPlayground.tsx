import { useState, useRef, useCallback, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  PhotoIcon,
  ChevronDownIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { searchUniversal, type UniversalSearchResponse, type UniversalSearchChunk, type UniversalSearchIllustration } from '../../lib/api';

function similarityBadge(score: number) {
  if (score >= 0.7) return { label: 'High', bg: 'bg-stc-green/15', text: 'text-stc-green' };
  if (score >= 0.5) return { label: 'Medium', bg: 'bg-stc-orange/15', text: 'text-stc-orange' };
  return { label: 'Low', bg: 'bg-neutral-100', text: 'text-neutral-500' };
}

function snippet(content: string, maxLen = 150): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

function DetailRow({ label, value }: { label: string; value: string | number | boolean | null | undefined }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-neutral-100 last:border-0">
      <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-neutral-700 font-mono break-all">{String(value)}</span>
    </div>
  );
}

function ChunkDetail({ chunk }: { chunk: UniversalSearchChunk }) {
  return (
    <div className="mt-3 pt-3 border-t border-neutral-200">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Raw Payload</p>
      <div className="bg-neutral-50 rounded-lg p-3 space-y-0">
        <DetailRow label="Chunk ID" value={chunk.id} />
        <DetailRow label="Lesson ID" value={chunk.lessonId} />
        <DetailRow label="Module Code" value={chunk.moduleCode} />
        <DetailRow label="Lesson #" value={chunk.lessonNumber} />
        <DetailRow label="Lesson Title" value={chunk.lessonTitle} />
        <DetailRow label="Chunk Type" value={chunk.chunkType} />
        <DetailRow label="Section" value={chunk.sectionTitle} />
        <DetailRow label="Sequence" value={chunk.sequence} />
        <DetailRow label="Token Count" value={chunk.tokenCount} />
        <DetailRow label="Similarity" value={chunk.similarity.toFixed(6)} />
      </div>
      {chunk.contentFull && (
        <div className="mt-2">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Full Content</p>
          <div className="bg-neutral-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-neutral-600 font-mono whitespace-pre-wrap leading-relaxed">{chunk.contentFull}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function IllustrationDetail({ ill }: { ill: UniversalSearchIllustration }) {
  return (
    <div className="mt-3 pt-3 border-t border-neutral-200">
      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Raw Payload</p>
      <div className="bg-neutral-50 rounded-lg p-3 space-y-0">
        <DetailRow label="ID" value={ill.id} />
        <DetailRow label="Character ID" value={ill.characterId} />
        <DetailRow label="Art Type" value={ill.artType} />
        <DetailRow label="Is Original" value={ill.isOriginal} />
        <DetailRow label="Source Path" value={ill.sourceFilePath} />
        <DetailRow label="Source Photo" value={ill.sourcePhotoUrl} />
        <DetailRow label="Created By" value={ill.createdByEmail} />
        <DetailRow label="Similarity" value={ill.similarity.toFixed(6)} />
      </div>
      {ill.aiDescriptionFull && (
        <div className="mt-2">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">Full AI Description</p>
          <div className="bg-neutral-50 rounded-lg p-3 max-h-48 overflow-y-auto">
            <p className="text-xs text-neutral-600 font-mono whitespace-pre-wrap leading-relaxed">{ill.aiDescriptionFull}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPlayground() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UniversalSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const executeSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setExpandedId(null);
    try {
      const data = await searchUniversal(q.trim(), 10, true);
      setResults(data);
      setHasSearched(true);
    } catch {
      setResults(null);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults(null);
      setHasSearched(false);
      return;
    }
    debounceRef.current = setTimeout(() => executeSearch(query), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, executeSearch]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const hasChunks = results && results.chunks.length > 0;
  const hasIllustrations = results && results.illustrations.length > 0;
  const hasResults = hasChunks || hasIllustrations;

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        <MagnifyingGlassIcon className="h-5 w-5 text-stc-purple-500" />
        Search Playground
      </h2>

      {/* Search Input */}
      <div className="relative mb-4">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <MagnifyingGlassIcon className="h-5 w-5 text-stc-purple-300" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              executeSearch(query);
            }
          }}
          placeholder="Test semantic search — try characters, lessons, concepts..."
          className="w-full pl-12 pr-12 py-3.5 bg-white rounded-xl border border-neutral-200
                     focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 focus:outline-none
                     text-sm text-neutral-700 placeholder-neutral-400 transition-all duration-200"
          aria-label="Search playground"
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <ArrowPathIcon className="animate-spin w-5 h-5 text-stc-purple-400" />
          </div>
        )}
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="animate-fade-in">
          {!hasResults ? (
            <div className="text-center py-8 text-neutral-400 text-sm bg-white rounded-xl border border-neutral-200">
              No results found for "{results?.query}"
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Curriculum */}
              {hasChunks && (
                <div>
                  <h3 className="text-xs font-bold text-stc-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BookOpenIcon className="h-4 w-4" />
                    Curriculum ({results!.chunks.length})
                  </h3>
                  <div className="space-y-2">
                    {results!.chunks.map((chunk) => {
                      const badge = similarityBadge(chunk.similarity);
                      const isExpanded = expandedId === chunk.id;
                      return (
                        <div
                          key={chunk.id}
                          className={`bg-white rounded-xl border transition-all duration-200 cursor-pointer ${
                            isExpanded ? 'border-stc-purple-300 ring-1 ring-stc-purple-100' : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div
                            className="p-3.5"
                            onClick={() => toggleExpand(chunk.id)}
                          >
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <ChevronDownIcon className={`h-3.5 w-3.5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                                <h4 className="text-sm font-semibold text-neutral-800 line-clamp-1">{chunk.title}</h4>
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[10px] font-bold text-stc-purple-400 bg-stc-purple-50 px-1.5 py-0.5 rounded">
                                  Semantic
                                </span>
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {chunk.similarity.toFixed(4)}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                  {Math.round(chunk.similarity * 100)}%
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-stc-purple-400 font-medium mb-1 ml-5">{chunk.section}</p>
                            <p className="text-xs text-neutral-500 leading-relaxed ml-5">{snippet(chunk.content)}</p>
                          </div>
                          {isExpanded && (
                            <div className="px-3.5 pb-3.5">
                              <ChunkDetail chunk={chunk} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Illustrations */}
              {hasIllustrations && (
                <div>
                  <h3 className="text-xs font-bold text-stc-purple-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <PhotoIcon className="h-4 w-4" />
                    Illustrations ({results!.illustrations.length})
                  </h3>
                  <div className="space-y-2">
                    {results!.illustrations.map((ill) => {
                      const badge = similarityBadge(ill.similarity);
                      const isExpanded = expandedId === ill.id;
                      return (
                        <div
                          key={ill.id}
                          className={`bg-white rounded-xl border transition-all duration-200 cursor-pointer ${
                            isExpanded ? 'border-stc-purple-300 ring-1 ring-stc-purple-100' : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div
                            className="p-3 flex gap-3"
                            onClick={() => toggleExpand(ill.id)}
                          >
                            {ill.illustrationUrl && (
                              <img
                                src={ill.illustrationUrl}
                                alt={ill.name}
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                                loading="lazy"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-0.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <ChevronDownIcon className={`h-3.5 w-3.5 text-neutral-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`} />
                                  <h4 className="text-sm font-semibold text-neutral-800 line-clamp-1">{ill.name}</h4>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-[10px] font-bold text-stc-purple-400 bg-stc-purple-50 px-1.5 py-0.5 rounded">
                                    Semantic
                                  </span>
                                  <span className="text-[10px] font-mono text-neutral-500">
                                    {ill.similarity.toFixed(4)}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                    {Math.round(ill.similarity * 100)}%
                                  </span>
                                </div>
                              </div>
                              {ill.description && (
                                <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2 ml-5">{ill.description}</p>
                              )}
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-3 pb-3">
                              <IllustrationDetail ill={ill} />
                            </div>
                          )}
                        </div>
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
