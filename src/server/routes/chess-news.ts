import { Router, Request, Response } from 'express';
import { getRecentChessNews, fetchAllChessNews } from '../services/chess-news.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

// GET / — Recent chess news
router.get('/', async (_req: Request, res: Response) => {
  try {
    const limit = parseInt(_req.query.limit as string) || 10;
    const news = await getRecentChessNews(Math.min(limit, 50));
    res.json(news);
  } catch (error) {
    console.error('[ChessNews] List error:', error);
    res.status(500).json({ error: 'Failed to load chess news' });
  }
});

// POST /fetch — Trigger manual fetch (admin only)
router.post('/fetch', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await fetchAllChessNews();
    res.json({ message: 'Chess news fetched', count: result });
  } catch (error) {
    console.error('[ChessNews] Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch chess news' });
  }
});

export default router;
