import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MagnifyingGlassIcon, ArrowPathIcon, XMarkIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';
import createPlotlyComponent from 'react-plotly.js/factory';
// Use minimal GL3D bundle instead of full plotly.js (~5MB → ~1.5MB)
// @ts-ignore no types for partial bundle
import Plotly from 'plotly.js-gl3d-dist-min';

const Plot = createPlotlyComponent(Plotly);
import { getChunkStats, getChunk, getSimilarChunks } from '../../lib/api';
import type { ChunkStats, ChunkDetail, SimilarChunk } from '../../lib/types';

const API_BASE = '/api';

// --- Types for 3D endpoint ---

interface EmbeddingPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  chunkType: string;
  moduleCode: string;
  lessonNumber: number;
  lessonTitle: string;
  sectionTitle: string | null;
  contentPreview: string;
  tokenCount: number;
}

interface Embeddings3DResponse {
  points: EmbeddingPoint[];
  computedAt: string;
  count: number;
}

interface QueryNeighbor {
  id: string;
  similarity: number;
  chunkType: string;
  contentPreview: string;
  moduleCode: string;
  lessonNumber: number;
}

interface QueryResult {
  query: string;
  position: { x: number; y: number; z: number };
  neighbors: QueryNeighbor[];
}

// --- Color palette for chunk types ---

const CHUNK_TYPE_COLORS: Record<string, string> = {
  LESSON_OVERVIEW: '#6A469D',    // stc-purple
  STORY: '#3B82F6',              // blue
  CHESS_LESSON: '#10B981',       // green
  TEACHER_TIPS: '#F59E0B',       // amber
  MNEMONIC: '#EF4444',           // red
  CHESSERCISE: '#8B5CF6',        // violet
  DEVELOPMENTAL: '#EC4899',      // pink
  INTERACTIVE_MOMENT: '#14B8A6', // teal
};

const DEFAULT_COLOR = '#94A3B8'; // gray

function getTypeColor(chunkType: string): string {
  return CHUNK_TYPE_COLORS[chunkType] || DEFAULT_COLOR;
}

// --- API functions ---

async function getEmbeddings3D(refresh = false): Promise<Embeddings3DResponse> {
  const params = refresh ? '?refresh=true' : '';
  const res = await fetch(`${API_BASE}/chunks/embeddings-3d${params}`);
  if (!res.ok) throw new Error('Failed to load 3D embeddings');
  return res.json();
}

async function queryEmbeddings3D(query: string): Promise<QueryResult> {
  const res = await fetch(`${API_BASE}/chunks/embeddings-3d/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error('Failed to query embeddings');
  return res.json();
}

// --- Main Component ---

// --- Space Background Component ---

function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let stars: { x: number; y: number; r: number; alpha: number; speed: number; twinkleSpeed: number; phase: number }[] = [];
    let nebulae: { x: number; y: number; radius: number; color: string; alpha: number }[] = [];

    function resize() {
      canvas!.width = canvas!.offsetWidth * window.devicePixelRatio;
      canvas!.height = canvas!.offsetHeight * window.devicePixelRatio;
      ctx!.scale(window.devicePixelRatio, window.devicePixelRatio);
      initStars();
    }

    function initStars() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      const count = Math.floor((w * h) / 1600); // subtle density

      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.4 + 0.1,
        speed: Math.random() * 0.02 + 0.005,
        twinkleSpeed: Math.random() * 0.008 + 0.003,
        phase: Math.random() * Math.PI * 2,
      }));

      // Nebulae / galaxies
      nebulae = Array.from({ length: 5 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: Math.random() * 200 + 80,
        color: ['#6A469D', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'][Math.floor(Math.random() * 5)],
        alpha: Math.random() * 0.06 + 0.02,
      }));
    }

    function draw(time: number) {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      ctx!.clearRect(0, 0, w, h);

      // Draw nebulae
      for (const neb of nebulae) {
        const gradient = ctx!.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.radius);
        gradient.addColorStop(0, neb.color + Math.round(neb.alpha * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(0.5, neb.color + Math.round(neb.alpha * 0.5 * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, 'transparent');
        ctx!.fillStyle = gradient;
        ctx!.fillRect(neb.x - neb.radius, neb.y - neb.radius, neb.radius * 2, neb.radius * 2);
      }

      // Draw stars with gentle twinkling
      for (const star of stars) {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.phase) * 0.15 + 0.85;
        const alpha = star.alpha * twinkle;

        // Star core
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(200, 210, 230, ${alpha})`;
        ctx!.fill();
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    animationId = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  );
}

export default function EmbeddingsExplorer() {
  // Stats
  const [stats, setStats] = useState<ChunkStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // 3D data
  const [data3D, setData3D] = useState<Embeddings3DResponse | null>(null);
  const [loading3D, setLoading3D] = useState(true);

  // Search + query visualization
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  // Chunk detail
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [selectedChunk, setSelectedChunk] = useState<ChunkDetail | null>(null);
  const [neighbors, setNeighbors] = useState<SimilarChunk[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false);
  const explorerRef = useRef<HTMLDivElement>(null);

  // Load stats + 3D data on mount
  useEffect(() => {
    getChunkStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));

    getEmbeddings3D()
      .then(setData3D)
      .catch(console.error)
      .finally(() => setLoading3D(false));
  }, []);

  // Load chunk detail when selected
  useEffect(() => {
    if (!selectedChunkId) {
      setSelectedChunk(null);
      setNeighbors([]);
      return;
    }
    setLoadingDetail(true);
    Promise.all([
      getChunk(selectedChunkId),
      getSimilarChunks(selectedChunkId),
    ])
      .then(([detail, { chunks }]) => {
        setSelectedChunk(detail);
        setNeighbors(chunks);
      })
      .catch(console.error)
      .finally(() => setLoadingDetail(false));
  }, [selectedChunkId]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const result = await queryEmbeddings3D(query.trim());
      setQueryResult(result);
    } catch (err) {
      console.error('Query failed:', err);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleRefresh = useCallback(async () => {
    setLoading3D(true);
    try {
      const data = await getEmbeddings3D(true);
      setData3D(data);
      setQueryResult(null);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setLoading3D(false);
    }
  }, []);

  const handleClearQuery = useCallback(() => {
    setQueryResult(null);
    setQuery('');
    setSelectedChunkId(null);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Escape key exits fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isFullscreen]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  // Build Plotly traces from 3D data
  const plotData = useMemo(() => {
    if (!data3D) return [];

    const neighborIds = new Set(queryResult?.neighbors.map(n => n.id) || []);

    // Group points by chunkType for color coding
    const groups = new Map<string, EmbeddingPoint[]>();
    for (const point of data3D.points) {
      const type = point.chunkType;
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type)!.push(point);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const traces: any[] = [];

    // One trace per chunk type
    for (const [type, points] of groups) {
      traces.push({
        type: 'scatter3d' as const,
        mode: 'markers' as const,
        name: type.replace(/_/g, ' '),
        x: points.map(p => p.x),
        y: points.map(p => p.y),
        z: points.map(p => p.z),
        text: points.map(p =>
          `<b>${p.moduleCode} L${p.lessonNumber}</b><br>` +
          `${type.replace(/_/g, ' ')}<br>` +
          `${p.contentPreview.slice(0, 80)}...`
        ),
        customdata: points.map(p => p.id),
        hoverinfo: 'text',
        marker: {
          size: neighborIds.size > 0
            ? points.map(p => neighborIds.has(p.id) ? 10 : 3)
            : isFullscreen ? 5 : 4,
          color: getTypeColor(type),
          opacity: neighborIds.size > 0
            ? points.map(p => neighborIds.has(p.id) ? 1.0 : 0.4)
            : 0.85,
          line: {
            width: neighborIds.size > 0
              ? points.map(p => neighborIds.has(p.id) ? 2 : 0)
              : isFullscreen ? 1 : 0,
            color: neighborIds.size > 0
              ? points.map(p => neighborIds.has(p.id) ? '#fff' : 'transparent')
              : isFullscreen ? getTypeColor(type) + '40' : 'transparent',
          },
          sizemode: 'diameter' as const,
        },
      });
    }

    // Query point
    if (queryResult) {
      const qp = queryResult.position;
      traces.push({
        type: 'scatter3d' as const,
        mode: 'markers+text' as const,
        name: 'Query',
        x: [qp.x],
        y: [qp.y],
        z: [qp.z],
        text: [queryResult.query],
        textposition: 'top center',
        textfont: { size: 11, color: '#fff', family: 'Poppins' },
        hoverinfo: 'text',
        marker: {
          size: 12,
          color: '#EF4444',
          symbol: 'diamond',
          opacity: 1,
          line: { width: 2, color: '#fff' },
        },
      });

      // Lines from query to neighbors
      if (data3D) {
        const pointMap = new Map(data3D.points.map(p => [p.id, p]));
        const lineX: (number | null)[] = [];
        const lineY: (number | null)[] = [];
        const lineZ: (number | null)[] = [];

        for (const n of queryResult.neighbors) {
          const target = pointMap.get(n.id);
          if (target) {
            lineX.push(qp.x, target.x, null);
            lineY.push(qp.y, target.y, null);
            lineZ.push(qp.z, target.z, null);
          }
        }

        traces.push({
          type: 'scatter3d' as const,
          mode: 'lines' as const,
          name: 'Search Radius',
          x: lineX,
          y: lineY,
          z: lineZ,
          hoverinfo: 'skip',
          line: {
            color: 'rgba(239, 68, 68, 0.4)',
            width: 2,
            dash: 'dash',
          },
          showlegend: false,
        });
      }
    }

    // Selected chunk highlight
    if (selectedChunkId && !queryResult) {
      const point = data3D.points.find(p => p.id === selectedChunkId);
      if (point) {
        traces.push({
          type: 'scatter3d' as const,
          mode: 'markers' as const,
          name: 'Selected',
          x: [point.x],
          y: [point.y],
          z: [point.z],
          hoverinfo: 'skip',
          marker: {
            size: 14,
            color: 'rgba(239, 68, 68, 0.3)',
            line: { width: 2, color: '#EF4444' },
          },
          showlegend: false,
        });
      }
    }

    return traces;
  }, [data3D, queryResult, selectedChunkId]);

  const plotLayout = useMemo(() => ({
    autosize: true,
    height: isFullscreen ? undefined : 600,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    scene: {
      bgcolor: isFullscreen ? 'rgba(0,0,0,0)' : '#1a1a2e',
      xaxis: {
        showgrid: true,
        gridcolor: isFullscreen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        showticklabels: false,
        title: { text: '' },
        zeroline: false,
        showspikes: false,
      },
      yaxis: {
        showgrid: true,
        gridcolor: isFullscreen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        showticklabels: false,
        title: { text: '' },
        zeroline: false,
        showspikes: false,
      },
      zaxis: {
        showgrid: true,
        gridcolor: isFullscreen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        showticklabels: false,
        title: { text: '' },
        zeroline: false,
        showspikes: false,
      },
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.2 },
      },
    },
    legend: {
      x: 0.02,
      y: 0.98,
      bgcolor: 'rgba(0,0,0,0.6)',
      bordercolor: 'rgba(255,255,255,0.1)',
      borderwidth: 1,
      font: { color: '#fff', size: isFullscreen ? 13 : 11, family: 'Poppins' },
    },
    hoverlabel: {
      bgcolor: '#1e1e3a',
      bordercolor: 'rgba(106,70,157,0.4)',
      font: { color: '#fff', size: 12, family: 'Poppins' },
    },
  }), [isFullscreen]);

  // Handle click on a point in the 3D plot
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePlotClick = useCallback((event: any) => {
    const point = event.points?.[0];
    if (point?.customdata) {
      setSelectedChunkId(point.customdata as string);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div>
        <p className="text-sm text-neutral-500 mb-4">
          3D visualization of the vector embedding space — each point is a curriculum chunk, clustered by semantic similarity
        </p>

        {loadingStats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-neutral-200 p-4 animate-pulse">
                <div className="h-4 bg-neutral-200 rounded w-1/2 mb-2" />
                <div className="h-8 bg-neutral-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Chunks" value={stats.total.toLocaleString()} />
            <StatCard
              label="With Embeddings"
              value={stats.withEmbeddings.toLocaleString()}
              sub={`${Math.round((stats.withEmbeddings / stats.total) * 100)}%`}
            />
            <StatCard label="Chunk Types" value={stats.byType.length.toString()} />
            <StatCard label="Avg Tokens" value={stats.avgTokenCount.toLocaleString()} />
          </div>
        ) : null}
      </div>

      {/* 3D Visualization */}
      <div
        ref={explorerRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 flex flex-col'
            : 'bg-neutral-900 rounded-2xl border border-neutral-700 overflow-hidden'
        }
        style={isFullscreen ? { background: '#050510' } : undefined}
      >
        {/* Space background (fullscreen only) */}
        {isFullscreen && <SpaceBackground />}

        {/* Search bar overlaid on top of the 3D view */}
        <div className={`relative z-10 px-4 pt-4 pb-2 flex items-center gap-2 ${isFullscreen ? 'bg-black/30 backdrop-blur-sm' : ''}`}>
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search embedding space — e.g. 'How does the knight move?'"
              className={`w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-stc-purple/50 focus:border-stc-purple min-h-[44px] ${
                isFullscreen
                  ? 'bg-black/40 border-white/10 backdrop-blur-md'
                  : 'bg-neutral-800 border-neutral-600'
              }`}
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className={`px-4 py-2.5 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px] ${
              isFullscreen
                ? 'bg-stc-purple/80 hover:bg-stc-purple backdrop-blur-sm'
                : 'bg-stc-purple hover:bg-stc-purple-600'
            }`}
          >
            {searching ? 'Embedding...' : 'Search'}
          </button>
          {queryResult && (
            <button
              onClick={handleClearQuery}
              className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Clear search"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading3D}
            className="p-2.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Recompute UMAP projection"
          >
            <ArrowPathIcon className={`h-5 w-5 ${loading3D ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={toggleFullscreen}
            className={`p-2.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isFullscreen
                ? 'text-white bg-white/10 hover:bg-white/20'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-5 w-5" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Query result info bar */}
        {queryResult && (
          <div className={`relative z-10 px-4 pb-2 ${isFullscreen ? '' : ''}`}>
            <div className="flex items-center gap-3 text-xs text-neutral-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-stc-pink inline-block" />
                Query: "{queryResult.query}"
              </span>
              <span className="text-neutral-500">|</span>
              <span>
                Top {queryResult.neighbors.length} neighbors (
                {queryResult.neighbors.length > 0
                  ? `${Math.round(queryResult.neighbors[0].similarity * 100)}% – ${Math.round(queryResult.neighbors[queryResult.neighbors.length - 1].similarity * 100)}%`
                  : 'none'}
                )
              </span>
            </div>
          </div>
        )}

        {/* 3D Plot */}
        <div className={`relative z-10 ${isFullscreen ? 'flex-1' : ''}`}>
          {loading3D ? (
            <div className={`flex items-center justify-center ${isFullscreen ? 'h-full' : 'h-[600px]'}`}>
              <div className="text-center">
                <ArrowPathIcon className="h-8 w-8 text-stc-purple animate-spin mx-auto mb-3" />
                <p className="text-sm text-neutral-400">Computing UMAP projection...</p>
                <p className="text-xs text-neutral-500 mt-1">This takes a few seconds on first load</p>
              </div>
            </div>
          ) : data3D && data3D.points.length > 0 ? (
            <Plot
              data={plotData}
              layout={plotLayout}
              config={{
                displayModeBar: true,
                modeBarButtonsToRemove: ['toImage', 'sendDataToCloud'],
                displaylogo: false,
                responsive: true,
              }}
              onClick={handlePlotClick}
              style={{
                width: '100%',
                height: isFullscreen ? '100%' : '600px',
              }}
              useResizeHandler
            />
          ) : (
            <div className={`flex items-center justify-center ${isFullscreen ? 'h-full' : 'h-[600px]'}`}>
              <p className="text-sm text-neutral-400">No embedded chunks found</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        {data3D && (
          <div className={`relative z-10 px-4 py-2 flex items-center justify-between text-xs border-t ${
            isFullscreen
              ? 'text-neutral-400 border-white/10 bg-black/30 backdrop-blur-sm'
              : 'text-neutral-500 border-neutral-800'
          }`}>
            <span>{data3D.count.toLocaleString()} vectors · UMAP 3D projection · Cosine distance</span>
            <div className="flex items-center gap-3">
              <span>Computed {new Date(data3D.computedAt).toLocaleTimeString()}</span>
              {isFullscreen && (
                <span className="text-neutral-500">Press Esc to exit</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chunk Detail + Neighbors (shown when a point is clicked) */}
      {selectedChunkId && (
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-neutral-700">Chunk Detail</h3>
            <button
              onClick={() => setSelectedChunkId(null)}
              className="text-neutral-400 hover:text-neutral-600 p-2 rounded-lg hover:bg-neutral-50 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {loadingDetail ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-neutral-200 rounded w-1/3" />
              <div className="h-20 bg-neutral-200 rounded" />
            </div>
          ) : selectedChunk ? (
            <div className="space-y-4">
              {/* Chunk metadata */}
              <div className="flex flex-wrap gap-2">
                <span
                  className="text-xs font-mono px-2 py-1 rounded text-white"
                  style={{ backgroundColor: getTypeColor(selectedChunk.chunkType) }}
                >
                  {selectedChunk.chunkType}
                </span>
                <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-600 rounded">
                  {selectedChunk.lesson.module.code} L{selectedChunk.lesson.lessonNumber}
                </span>
                <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-600 rounded">
                  {selectedChunk.lesson.title}
                </span>
                <span className="text-xs px-2 py-1 bg-neutral-50 text-neutral-600 rounded">
                  {selectedChunk.tokenCount} tokens
                </span>
                <span className={`text-xs px-2 py-1 rounded ${selectedChunk.hasEmbedding ? 'bg-stc-green/10 text-stc-green' : 'bg-stc-pink/10 text-stc-pink'}`}>
                  {selectedChunk.hasEmbedding ? 'Embedded' : 'No embedding'}
                </span>
              </div>

              {selectedChunk.sectionTitle && (
                <p className="text-sm font-medium text-neutral-700">{selectedChunk.sectionTitle}</p>
              )}

              <div className="bg-neutral-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <p className="text-sm text-neutral-700 whitespace-pre-wrap">{selectedChunk.content}</p>
              </div>

              {/* Nearest Neighbors */}
              {neighbors.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">
                    Nearest Neighbors ({neighbors.length})
                  </h4>
                  <div className="space-y-2">
                    {neighbors.map((n) => (
                      <div
                        key={n.id}
                        className="border border-neutral-100 rounded-lg p-3 hover:border-stc-purple-200 transition-colors cursor-pointer"
                        onClick={() => setSelectedChunkId(n.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-xs font-mono px-1.5 py-0.5 rounded text-white"
                                style={{ backgroundColor: getTypeColor(n.chunkType) }}
                              >
                                {n.chunkType}
                              </span>
                              <span className="text-xs text-neutral-400">
                                {n.lesson.module.code} L{n.lesson.lessonNumber}
                              </span>
                            </div>
                            <p className="text-sm text-neutral-600 line-clamp-2">{n.contentPreview}</p>
                          </div>
                          <SimilarityBadge score={n.similarity} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// --- Sub-components ---

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4">
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-neutral-900">{value}</p>
      {sub && <p className="text-xs text-stc-purple-600 font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

function SimilarityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = pct >= 70 ? 'text-stc-green bg-stc-green/10' :
                pct >= 55 ? 'text-stc-yellow bg-stc-yellow/10' :
                'text-neutral-500 bg-neutral-50';
  return (
    <span className={`text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${color}`}>
      {pct}%
    </span>
  );
}
