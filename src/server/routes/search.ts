import { Router, Request, Response } from 'express';
import { semanticSearch, semanticSearchIllustrations } from '../../retrieval/semantic.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

/**
 * GET /api/search/universal?q=query&limit=10&debug=true
 * Cross-collection semantic search: finds matching curriculum chunks AND illustrations.
 * When debug=true, returns full payloads for deep inspection (used by Search Playground).
 */
router.get('/universal', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const debug = req.query.debug === 'true';

    // Search both collections in parallel
    const [chunks, illustrations] = await Promise.all([
      semanticSearch(query, limit, 0.3),
      semanticSearchIllustrations(query, limit, 0.25),
    ]);

    // If debug, fetch full illustration records for extra fields
    let illustrationDetails: Map<string, { artType: string; sourceFilePath: string | null; isOriginal: boolean; createdByEmail: string; aiDescription: string | null }> | null = null;
    if (debug && illustrations.length > 0) {
      const ids = illustrations.map(ill => ill.id);
      const fullRecords = await prisma.illustration.findMany({
        where: { id: { in: ids } },
        select: { id: true, artType: true, sourceFilePath: true, isOriginal: true, createdByEmail: true, aiDescription: true },
      });
      illustrationDetails = new Map(fullRecords.map(r => [r.id, r]));
    }

    res.json({
      query,
      chunks: chunks.map(c => ({
        id: c.id,
        type: 'curriculum' as const,
        title: `${c.moduleCode} Lesson ${c.lessonNumber}: ${c.lessonTitle}`,
        section: c.sectionTitle,
        content: c.content.substring(0, 300),
        similarity: c.similarity,
        // Debug fields — full payload for deep inspection
        ...(debug && {
          moduleCode: c.moduleCode,
          lessonNumber: c.lessonNumber,
          lessonTitle: c.lessonTitle,
          chunkType: c.chunkType,
          sectionTitle: c.sectionTitle,
          tokenCount: c.tokenCount,
          sequence: c.sequence,
          contentFull: c.content,
          lessonId: c.lessonId,
        }),
      })),
      illustrations: illustrations.map(ill => {
        const detail = illustrationDetails?.get(ill.id);
        return {
          id: ill.id,
          type: 'illustration' as const,
          name: ill.name,
          description: ill.aiDescription?.substring(0, 200) || null,
          illustrationUrl: ill.illustrationUrl,
          characterId: ill.characterId,
          similarity: ill.similarity,
          // Debug fields — full payload for deep inspection
          ...(debug && detail && {
            artType: detail.artType,
            sourcePhotoUrl: ill.sourcePhotoUrl,
            sourceFilePath: detail.sourceFilePath,
            isOriginal: detail.isOriginal,
            createdByEmail: detail.createdByEmail,
            aiDescriptionFull: detail.aiDescription,
          }),
        };
      }),
    });
  } catch (error) {
    console.error('[Search] Universal search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/search/illustrations?q=query&limit=6
 * Search illustrations only — used by character art auto-reference.
 */
router.get('/illustrations', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
    const results = await semanticSearchIllustrations(query, limit, 0.25);

    res.json({
      query,
      results: results.map(ill => ({
        id: ill.id,
        name: ill.name,
        description: ill.aiDescription,
        illustrationUrl: ill.illustrationUrl,
        sourcePhotoUrl: ill.sourcePhotoUrl,
        characterId: ill.characterId,
        similarity: ill.similarity,
      })),
    });
  } catch (error) {
    console.error('[Search] Illustration search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
