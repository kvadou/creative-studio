import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon, ArrowTopRightOnSquareIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { getChunks, getChunk, getChunkStats, getSimilarChunks } from '../../lib/api';
import type { ChunkSummary, ChunkDetail, ChunkStats, SimilarChunk } from '../../lib/types';

const CHUNK_TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  LESSON_OVERVIEW: { bg: 'bg-stc-purple-100', text: 'text-stc-purple-700', dot: 'bg-stc-purple-500' },
  STORY: { bg: 'bg-stc-blue/15', text: 'text-stc-navy', dot: 'bg-stc-blue' },
  CHESS_LESSON: { bg: 'bg-stc-green/15', text: 'text-stc-green', dot: 'bg-stc-green' },
  TEACHER_TIPS: { bg: 'bg-stc-orange/15', text: 'text-stc-orange', dot: 'bg-stc-orange' },
  MNEMONIC: { bg: 'bg-stc-pink/15', text: 'text-stc-pink', dot: 'bg-stc-pink' },
  CHESSERCISE: { bg: 'bg-stc-blue/15', text: 'text-stc-blue', dot: 'bg-stc-blue' },
  DEVELOPMENTAL: { bg: 'bg-stc-orange/15', text: 'text-stc-orange', dot: 'bg-stc-orange' },
  INTERACTIVE_MOMENT: { bg: 'bg-stc-pink/15', text: 'text-stc-pink', dot: 'bg-stc-pink' },
};

function formatChunkType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function ChunkTypeBadge({ type, size = 'sm' }: { type: string; size?: 'sm' | 'xs' }) {
  const colors = CHUNK_TYPE_COLORS[type] ?? { bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-500' };
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${colors.bg} ${colors.text} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {formatChunkType(type)}
    </span>
  );
}

export default function ChunksPage() {
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [chunks, setChunks] = useState<ChunkSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Filters
  const [chunkTypeFilter, setChunkTypeFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Expanded chunk detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<ChunkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Similar chunks
  const [similarChunks, setSimilarChunks] = useState<SimilarChunk[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false);

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    getChunkStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  // Load chunks
  const loadChunks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChunks({
        chunkType: chunkTypeFilter ?? undefined,
        search: searchQuery || undefined,
        page,
        limit: 25,
      });
      setChunks(data.chunks);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Failed to load chunks:', error);
    } finally {
      setLoading(false);
    }
  }, [chunkTypeFilter, searchQuery, page]);

  useEffect(() => { loadChunks(); }, [loadChunks]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [chunkTypeFilter, searchQuery]);

  // Handle expand/collapse
  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      setSimilarChunks([]);
      setShowSimilar(false);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setSimilarChunks([]);
    setShowSimilar(false);
    try {
      const detail = await getChunk(id);
      setExpandedDetail(detail);
    } catch (error) {
      console.error('Failed to load chunk detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle search on Enter
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setSearchQuery(searchInput);
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  const handleFindSimilar = async (id: string) => {
    if (showSimilar) {
      setShowSimilar(false);
      setSimilarChunks([]);
      return;
    }
    setSimilarLoading(true);
    setShowSimilar(true);
    try {
      const data = await getSimilarChunks(id);
      setSimilarChunks(data.chunks);
    } catch (error) {
      console.error('Failed to find similar chunks:', error);
    } finally {
      setSimilarLoading(false);
    }
  };

  // Pagination range
  const getPageRange = () => {
    const range: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Chunks & Embeddings</h1>
        <p className="text-sm text-neutral-500 leading-relaxed max-w-3xl">
          Chunks are the building blocks of Studio's knowledge. Each lesson is split into chunks by section,
          embedded as vectors, and used to find relevant context when you ask questions. This page lets you
          explore what the RAG pipeline sees.
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm shadow-purple-100/50 animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-20 mb-2" />
              <div className="h-7 bg-neutral-200 rounded w-16" />
            </div>
          ))
        ) : stats ? (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm shadow-purple-100/50">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Total Chunks</div>
              <div className="text-2xl font-bold text-neutral-900">{stats.total.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm shadow-purple-100/50">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Embedded</div>
              <div className="text-2xl font-bold text-neutral-900">
                {stats.withEmbeddings.toLocaleString()}
                <span className="text-sm font-normal text-neutral-400 ml-1.5">
                  {stats.total > 0 ? `${Math.round((stats.withEmbeddings / stats.total) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm shadow-purple-100/50">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Chunk Types</div>
              <div className="text-2xl font-bold text-neutral-900">{stats.byType.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm shadow-purple-100/50">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Avg Tokens</div>
              <div className="text-2xl font-bold text-neutral-900">{stats.avgTokenCount.toLocaleString()}</div>
            </div>
          </>
        ) : null}
      </div>

      {/* Chunk Type Breakdown Pills */}
      {stats && stats.byType.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setChunkTypeFilter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              chunkTypeFilter === null
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            All ({stats.total.toLocaleString()})
          </button>
          {stats.byType.map(({ type, count }) => {
            const colors = CHUNK_TYPE_COLORS[type] ?? { bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-500' };
            const isActive = chunkTypeFilter === type;
            return (
              <button
                key={type}
                onClick={() => setChunkTypeFilter(isActive ? null : type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 inline-flex items-center gap-1.5 ${
                  isActive
                    ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-current`
                    : `${colors.bg} ${colors.text} hover:ring-1 hover:ring-current`
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                {formatChunkType(type)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search chunk content... (press Enter)"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 bg-white min-h-[44px]"
          />
          {searchInput && (
            <button onClick={handleSearchClear} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-neutral-500">
          {loading ? 'Loading...' : `${total.toLocaleString()} chunk${total !== 1 ? 's' : ''}`}
          {chunkTypeFilter && ` of type ${formatChunkType(chunkTypeFilter)}`}
          {searchQuery && ` matching "${searchQuery}"`}
        </span>
      </div>

      {/* Chunk List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm shadow-purple-100/50 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-5 bg-neutral-200 rounded-full w-28" />
                <div className="h-4 bg-neutral-200 rounded w-40" />
              </div>
              <div className="h-4 bg-neutral-200 rounded w-full mb-2" />
              <div className="h-4 bg-neutral-200 rounded w-3/4" />
            </div>
          ))
        ) : chunks.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm shadow-purple-100/50 text-center">
            <p className="text-neutral-500">No chunks found matching your filters.</p>
          </div>
        ) : (
          chunks.map(chunk => {
            const isExpanded = expandedId === chunk.id;
            return (
              <div
                key={chunk.id}
                className={`bg-white rounded-2xl shadow-sm shadow-purple-100/50 transition-all duration-200 cursor-pointer hover:shadow-md hover:shadow-purple-100/50 ${
                  isExpanded ? 'ring-2 ring-stc-purple-200' : ''
                }`}
                onClick={() => handleToggleExpand(chunk.id)}
              >
                <div className="p-5">
                  {/* Top row: badge + section title + meta */}
                  <div className="flex flex-wrap items-center gap-2 mb-2.5">
                    <ChunkTypeBadge type={chunk.chunkType} />
                    {chunk.sectionTitle && (
                      <span className="text-sm font-medium text-neutral-700">{chunk.sectionTitle}</span>
                    )}
                    <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-3 mt-1 sm:mt-0">
                      <span className="text-xs text-neutral-400">#{chunk.sequence}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-xs text-neutral-600">
                        {chunk.tokenCount} tokens
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-xs ${chunk.hasEmbedding ? 'text-stc-green' : 'text-neutral-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${chunk.hasEmbedding ? 'bg-stc-green' : 'bg-neutral-300'}`} />
                        <span className="hidden sm:inline">{chunk.hasEmbedding ? 'Embedded' : 'Not embedded'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Content preview */}
                  <p className="text-sm text-neutral-600 font-mono leading-relaxed mb-2.5 whitespace-pre-wrap">
                    {chunk.contentPreview}{chunk.contentPreview.length >= 200 ? '...' : ''}
                  </p>

                  {/* Lesson link */}
                  <Link
                    to={`/lesson/${chunk.lesson.module.code}/${chunk.lesson.lessonNumber}`}
                    className="inline-flex items-center gap-1.5 text-xs text-stc-purple-600 hover:text-stc-purple-700 font-medium"
                    onClick={e => e.stopPropagation()}
                  >
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                    Module {chunk.lesson.module.code}, Lesson {chunk.lesson.lessonNumber}
                  </Link>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-neutral-100 px-5 py-4 bg-neutral-50/50 rounded-b-2xl">
                    {detailLoading ? (
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <div className="animate-spin h-4 w-4 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
                        Loading full content...
                      </div>
                    ) : expandedDetail ? (
                      <div className="space-y-4">
                        {/* Full content */}
                        <div>
                          <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Full Content</div>
                          <pre className="text-sm text-neutral-700 font-mono whitespace-pre-wrap bg-white rounded-xl p-4 border border-neutral-200 max-h-96 overflow-y-auto leading-relaxed">
                            {expandedDetail.content}
                          </pre>
                        </div>

                        {/* Metadata grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <div className="text-xs text-neutral-400 mb-0.5">Content Hash</div>
                            <div className="text-xs font-mono text-neutral-600 truncate" title={expandedDetail.contentHash}>
                              {expandedDetail.contentHash}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-400 mb-0.5">Token Count</div>
                            <div className="text-sm font-medium text-neutral-700">{expandedDetail.tokenCount}</div>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-400 mb-0.5">Sequence</div>
                            <div className="text-sm font-medium text-neutral-700">{expandedDetail.sequence}</div>
                          </div>
                          <div>
                            <div className="text-xs text-neutral-400 mb-0.5">Created</div>
                            <div className="text-sm text-neutral-700">
                              {new Date(expandedDetail.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Find Similar Button */}
                        {expandedDetail.hasEmbedding && (
                          <div>
                            <button
                              onClick={e => { e.stopPropagation(); handleFindSimilar(expandedDetail.id); }}
                              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                showSimilar
                                  ? 'bg-stc-purple-100 text-stc-purple-700 ring-2 ring-stc-purple-200'
                                  : 'bg-stc-purple-500 text-white hover:bg-stc-purple-600'
                              }`}
                            >
                              <ArrowsRightLeftIcon className="w-4 h-4" />
                              {showSimilar ? 'Hide Similar Chunks' : 'Find Similar Chunks'}
                            </button>
                          </div>
                        )}

                        {/* Similar Chunks Results */}
                        {showSimilar && (
                          <div className="space-y-3">
                            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                              Similarity to Selected Chunk
                            </div>

                            {similarLoading ? (
                              <div className="flex items-center gap-2 text-sm text-neutral-500 py-4">
                                <div className="animate-spin h-4 w-4 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
                                Searching vector space for nearest neighbors...
                              </div>
                            ) : similarChunks.length === 0 ? (
                              <p className="text-sm text-neutral-500 py-2">No similar chunks found.</p>
                            ) : (
                              <>
                                {/* Bar chart visualization */}
                                <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-2">
                                  {similarChunks.map((sc, i) => {
                                    const pct = Math.round(sc.similarity * 100);
                                    const barColor = pct >= 80 ? 'bg-stc-green' : pct >= 60 ? 'bg-stc-yellow' : 'bg-stc-orange';
                                    const textColor = pct >= 80 ? 'text-stc-green' : pct >= 60 ? 'text-stc-yellow' : 'text-stc-orange';
                                    return (
                                      <div key={sc.id} className="flex items-center gap-3 text-xs">
                                        <span className="w-5 text-neutral-400 text-right flex-shrink-0">{i + 1}</span>
                                        <div className="flex-1 bg-neutral-100 rounded-full h-5 overflow-hidden">
                                          <div
                                            className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out flex items-center justify-end pr-2`}
                                            style={{ width: `${Math.max(pct, 8)}%` }}
                                          >
                                            {pct >= 25 && (
                                              <span className="text-white font-bold text-[10px]">{pct}%</span>
                                            )}
                                          </div>
                                        </div>
                                        {pct < 25 && (
                                          <span className={`font-bold ${textColor} flex-shrink-0`}>{pct}%</span>
                                        )}
                                        <ChunkTypeBadge type={sc.chunkType} size="xs" />
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Detailed results list */}
                                <div className="space-y-2">
                                  {similarChunks.map((sc, i) => {
                                    const pct = Math.round(sc.similarity * 100);
                                    const badgeColor = pct >= 80 ? 'bg-stc-green/15 text-stc-green' : pct >= 60 ? 'bg-stc-yellow/15 text-stc-yellow' : 'bg-stc-orange/15 text-stc-orange';
                                    return (
                                      <div key={sc.id} className="bg-white rounded-xl border border-neutral-200 p-3 hover:border-stc-purple-200 transition-colors duration-200">
                                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}>
                                            #{i + 1} — {pct}%
                                          </span>
                                          <ChunkTypeBadge type={sc.chunkType} size="xs" />
                                          {sc.sectionTitle && (
                                            <span className="text-xs text-neutral-600 font-medium">{sc.sectionTitle}</span>
                                          )}
                                          <span className="ml-auto text-xs text-neutral-400">{sc.tokenCount} tokens</span>
                                        </div>
                                        <p className="text-xs text-neutral-600 font-mono leading-relaxed mb-1.5 line-clamp-2">
                                          {sc.contentPreview}
                                        </p>
                                        <Link
                                          to={`/lesson/${sc.lesson.module.code}/${sc.lesson.lessonNumber}`}
                                          className="inline-flex items-center gap-1 text-xs text-stc-purple-600 hover:text-stc-purple-700 font-medium"
                                          onClick={e => e.stopPropagation()}
                                        >
                                          <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                                          Module {sc.lesson.module.code}, Lesson {sc.lesson.lessonNumber}
                                        </Link>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-neutral-500">Failed to load chunk details.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 min-h-[44px]"
          >
            Prev
          </button>
          {/* Page numbers - hidden on mobile, shown on sm+ */}
          <div className="hidden sm:flex items-center gap-1">
            {getPageRange()[0] > 1 && (
              <>
                <button onClick={() => setPage(1)} className="w-9 h-9 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 min-h-[44px]">1</button>
                {getPageRange()[0] > 2 && <span className="text-neutral-400 px-1">...</span>}
              </>
            )}
            {getPageRange().map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors duration-200 min-h-[44px] ${
                  p === page
                    ? 'bg-stc-purple-500 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {p}
              </button>
            ))}
            {getPageRange()[getPageRange().length - 1] < totalPages && (
              <>
                {getPageRange()[getPageRange().length - 1] < totalPages - 1 && <span className="text-neutral-400 px-1">...</span>}
                <button onClick={() => setPage(totalPages)} className="w-9 h-9 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 min-h-[44px]">{totalPages}</button>
              </>
            )}
          </div>
          {/* Mobile page indicator */}
          <span className="sm:hidden text-sm text-neutral-500 px-3 min-h-[44px] flex items-center">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 min-h-[44px]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
