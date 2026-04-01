import { Router } from 'express';
import { UMAP } from 'umap-js';
import { prisma } from '../../lib/prisma.js';
import { createGeminiEmbedding } from '../../lib/gemini-embeddings.js';

const router = Router();

// In-memory cache for UMAP projection (expensive to compute)
let umapCache: {
  points: Array<{
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
  }>;
  computedAt: string;
  count: number;
} | null = null;

// GET /api/chunks/stats — Aggregate stats for the dashboard banner
router.get('/stats', async (_req, res) => {
  try {
    const [total, byType, avgResult, embeddedResult] = await Promise.all([
      prisma.chunk.count(),
      prisma.chunk.groupBy({
        by: ['chunkType'],
        _count: true,
        orderBy: { _count: { chunkType: 'desc' } },
      }),
      prisma.chunk.aggregate({ _avg: { tokenCount: true } }),
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM "Chunk" WHERE embedding IS NOT NULL
      `,
    ]);

    res.json({
      total,
      withEmbeddings: Number(embeddedResult[0].count),
      byType: byType.map(g => ({ type: g.chunkType, count: g._count })),
      avgTokenCount: Math.round(avgResult._avg.tokenCount ?? 0),
    });
  } catch (error) {
    console.error('[chunks/stats]', error);
    res.status(500).json({ error: 'Failed to load chunk stats' });
  }
});

// GET /api/chunks/embeddings-3d — UMAP-projected 3D coordinates for all embedded chunks
// NOTE: Must be defined before /:id to avoid param matching
router.get('/embeddings-3d', async (req, res) => {
  try {
    const forceRecompute = req.query.refresh === 'true';

    if (umapCache && !forceRecompute) {
      return res.json(umapCache);
    }

    console.log('[chunks/embeddings-3d] Computing UMAP projection...');
    const startTime = Date.now();

    // Fetch all embedded chunks with metadata
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        chunkType: string;
        sectionTitle: string | null;
        contentPreview: string;
        tokenCount: number;
        lessonNumber: number;
        lessonTitle: string;
        moduleCode: string;
        embedding: string; // pgvector returns as string like "[0.1,0.2,...]"
      }>
    >`
      SELECT
        c.id,
        c."chunkType",
        c."sectionTitle",
        LEFT(c.content, 150) as "contentPreview",
        c."tokenCount",
        l."lessonNumber",
        l.title as "lessonTitle",
        m.code as "moduleCode",
        c.embedding::text as embedding
      FROM "Chunk" c
      JOIN "Lesson" l ON c."lessonId" = l.id
      JOIN "Module" m ON l."moduleId" = m.id
      WHERE c.embedding IS NOT NULL
      ORDER BY m.sequence, l."lessonNumber", c.sequence
    `;

    if (rows.length === 0) {
      return res.json({ points: [], computedAt: new Date().toISOString(), count: 0 });
    }

    // Parse embedding strings into float arrays
    const embeddings = rows.map(r => {
      const cleaned = r.embedding.replace(/[\[\]]/g, '');
      return cleaned.split(',').map(Number);
    });

    // Run UMAP: 768 dims → 3 dims
    const umap = new UMAP({
      nComponents: 3,
      nNeighbors: Math.min(15, Math.floor(rows.length / 2)),
      minDist: 0.1,
      spread: 1.0,
    });

    const projection = umap.fit(embeddings);

    // Build response with 3D coordinates
    const points = rows.map((row, i) => ({
      id: row.id,
      x: projection[i][0],
      y: projection[i][1],
      z: projection[i][2],
      chunkType: row.chunkType,
      moduleCode: row.moduleCode,
      lessonNumber: row.lessonNumber,
      lessonTitle: row.lessonTitle,
      sectionTitle: row.sectionTitle,
      contentPreview: row.contentPreview,
      tokenCount: row.tokenCount,
    }));

    umapCache = {
      points,
      computedAt: new Date().toISOString(),
      count: points.length,
    };

    const elapsed = Date.now() - startTime;
    console.log(`[chunks/embeddings-3d] UMAP computed for ${points.length} points in ${elapsed}ms`);

    res.json(umapCache);
  } catch (error) {
    console.error('[chunks/embeddings-3d]', error);
    res.status(500).json({ error: 'Failed to compute 3D projection' });
  }
});

// POST /api/chunks/embeddings-3d/query — Embed a query and find its position + neighbors in the 3D space
router.post('/embeddings-3d/query', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query string required' });
    }

    // Embed the query
    const queryEmbedding = await createGeminiEmbedding(query.trim(), 'RETRIEVAL_QUERY');
    const vectorLiteral = `[${queryEmbedding.join(',')}]`;

    // Find top-K nearest neighbors with their IDs
    const neighbors = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        similarity: number;
        chunkType: string;
        contentPreview: string;
        moduleCode: string;
        lessonNumber: number;
      }>
    >(
      `
      SELECT
        c.id,
        1 - (c.embedding <=> $1::vector) as similarity,
        c."chunkType",
        LEFT(c.content, 150) as "contentPreview",
        m.code as "moduleCode",
        l."lessonNumber"
      FROM "Chunk" c
      JOIN "Lesson" l ON c."lessonId" = l.id
      JOIN "Module" m ON l."moduleId" = m.id
      WHERE c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT 10
      `,
      vectorLiteral
    );

    // Approximate query position as weighted centroid of its nearest neighbors in 3D space
    let queryX = 0, queryY = 0, queryZ = 0;
    let totalWeight = 0;

    if (umapCache) {
      const pointMap = new Map(umapCache.points.map(p => [p.id, p]));
      for (const n of neighbors) {
        const point = pointMap.get(n.id);
        if (point) {
          const weight = n.similarity;
          queryX += point.x * weight;
          queryY += point.y * weight;
          queryZ += point.z * weight;
          totalWeight += weight;
        }
      }
      if (totalWeight > 0) {
        queryX /= totalWeight;
        queryY /= totalWeight;
        queryZ /= totalWeight;
      }
    }

    res.json({
      query: query.trim(),
      position: { x: queryX, y: queryY, z: queryZ },
      neighbors: neighbors.map(n => ({
        id: n.id,
        similarity: n.similarity,
        chunkType: n.chunkType,
        contentPreview: n.contentPreview,
        moduleCode: n.moduleCode,
        lessonNumber: n.lessonNumber,
      })),
    });
  } catch (error) {
    console.error('[chunks/embeddings-3d/query]', error);
    res.status(500).json({ error: 'Failed to process query' });
  }
});

// GET /api/chunks — Paginated list of chunks
router.get('/', async (req, res) => {
  try {
    const chunkType = req.query.chunkType as string | undefined;
    const lessonId = req.query.lessonId as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (chunkType) where.chunkType = chunkType;
    if (lessonId) where.lessonId = lessonId;
    if (search) where.content = { contains: search, mode: 'insensitive' };

    const [chunks, total] = await Promise.all([
      prisma.chunk.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ lesson: { module: { sequence: 'asc' } } }, { lesson: { lessonNumber: 'asc' } }, { sequence: 'asc' }],
        select: {
          id: true,
          chunkType: true,
          sectionTitle: true,
          content: true,
          tokenCount: true,
          sequence: true,
          lesson: {
            select: {
              id: true,
              title: true,
              lessonNumber: true,
              module: { select: { code: true, title: true } },
            },
          },
        },
      }),
      prisma.chunk.count({ where }),
    ]);

    // Check embedding existence for returned chunk IDs
    const chunkIds = chunks.map(c => c.id);
    let embeddingMap = new Map<string, boolean>();

    if (chunkIds.length > 0) {
      const embeddedRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Chunk" WHERE id = ANY(${chunkIds}::text[]) AND embedding IS NOT NULL
      `;
      embeddingMap = new Map(embeddedRows.map(r => [r.id, true]));
    }

    const result = chunks.map(c => ({
      id: c.id,
      chunkType: c.chunkType,
      sectionTitle: c.sectionTitle,
      contentPreview: c.content.slice(0, 200),
      tokenCount: c.tokenCount,
      hasEmbedding: embeddingMap.has(c.id),
      sequence: c.sequence,
      lesson: c.lesson,
    }));

    res.json({
      chunks: result,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('[chunks/list]', error);
    res.status(500).json({ error: 'Failed to load chunks' });
  }
});

// GET /api/chunks/:id — Single chunk with full content
router.get('/:id', async (req, res) => {
  try {
    const chunk = await prisma.chunk.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        chunkType: true,
        sectionTitle: true,
        content: true,
        contentHash: true,
        tokenCount: true,
        sequence: true,
        createdAt: true,
        lesson: {
          select: {
            id: true,
            title: true,
            lessonNumber: true,
            module: { select: { code: true, title: true } },
          },
        },
      },
    });

    if (!chunk) {
      return res.status(404).json({ error: 'Chunk not found' });
    }

    // Check embedding existence
    const embeddedResult = await prisma.$queryRaw<[{ has: boolean }]>`
      SELECT (embedding IS NOT NULL) as has FROM "Chunk" WHERE id = ${chunk.id}
    `;

    res.json({
      ...chunk,
      contentPreview: chunk.content.slice(0, 200),
      hasEmbedding: embeddedResult[0]?.has ?? false,
    });
  } catch (error) {
    console.error('[chunks/detail]', error);
    res.status(500).json({ error: 'Failed to load chunk' });
  }
});

// GET /api/chunks/:id/similar — Find N most similar chunks by embedding cosine similarity
router.get('/:id/similar', async (req, res) => {
  try {
    // First get the target chunk's embedding as a vector literal
    const targetRows = await prisma.$queryRaw<{ embedding: string | null }[]>`
      SELECT embedding::text FROM "Chunk" WHERE id = ${req.params.id} AND embedding IS NOT NULL
    `;

    if (targetRows.length === 0) {
      return res.status(404).json({ error: 'Chunk not found or has no embedding' });
    }

    const vectorLiteral = targetRows[0].embedding;

    // Find nearest neighbors using cosine distance
    const similar = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        chunkType: string;
        sectionTitle: string | null;
        contentPreview: string;
        tokenCount: number;
        sequence: number;
        similarity: number;
        lessonId: string;
        lessonTitle: string;
        lessonNumber: number;
        moduleCode: string;
        moduleTitle: string;
      }>
    >(
      `
      SELECT
        c.id,
        c."chunkType",
        c."sectionTitle",
        LEFT(c.content, 200) as "contentPreview",
        c."tokenCount",
        c.sequence,
        1 - (c.embedding <=> $1::vector) as similarity,
        l.id as "lessonId",
        l.title as "lessonTitle",
        l."lessonNumber",
        m.code as "moduleCode",
        m.title as "moduleTitle"
      FROM "Chunk" c
      JOIN "Lesson" l ON c."lessonId" = l.id
      JOIN "Module" m ON l."moduleId" = m.id
      WHERE c.id != $2 AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> $1::vector
      LIMIT 10
      `,
      vectorLiteral,
      req.params.id
    );

    const chunks = similar.map(r => ({
      id: r.id,
      chunkType: r.chunkType,
      sectionTitle: r.sectionTitle,
      contentPreview: r.contentPreview,
      tokenCount: r.tokenCount,
      sequence: r.sequence,
      similarity: r.similarity,
      lesson: {
        id: r.lessonId,
        title: r.lessonTitle,
        lessonNumber: r.lessonNumber,
        module: { code: r.moduleCode, title: r.moduleTitle },
      },
    }));

    res.json({ chunks });
  } catch (error) {
    console.error('[chunks/similar]', error);
    res.status(500).json({ error: 'Failed to find similar chunks' });
  }
});

export default router;
