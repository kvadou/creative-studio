import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { generateBriefHtml } from '../../generation/marketing/briefGenerator.js';

const router = Router();

// GET /api/marketing/scripts — list scripts (paginated, filterable by status/persona)
router.get('/scripts', async (req, res) => {
  try {
    const { status, persona, page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (persona) where.persona = persona;

    const [scripts, total] = await Promise.all([
      prisma.marketingScript.findMany({
        where,
        include: { insight: true, briefs: { include: { creator: true, videos: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.marketingScript.count({ where }),
    ]);

    res.json({ scripts, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch (err) {
    console.error('Error fetching scripts:', err);
    res.status(500).json({ error: 'Failed to fetch scripts' });
  }
});

// GET /api/marketing/scripts/:id — single script detail
router.get('/scripts/:id', async (req, res) => {
  try {
    const script = await prisma.marketingScript.findUnique({
      where: { id: req.params.id },
      include: { insight: true, briefs: { include: { creator: true, videos: true } } },
    });
    if (!script) return res.status(404).json({ error: 'Not found' });
    res.json(script);
  } catch (err) {
    console.error('Error fetching script:', err);
    res.status(500).json({ error: 'Failed to fetch script' });
  }
});

// PATCH /api/marketing/scripts/:id — approve or skip
router.patch('/scripts/:id', requireAdmin, async (req, res) => {
  try {
    const { status, skippedReason } = req.body;
    const validTransitions = ['APPROVED', 'SKIPPED'];

    if (!validTransitions.includes(status)) {
      return res.status(400).json({ error: 'Invalid status transition' });
    }

    const script = await prisma.marketingScript.update({
      where: { id: req.params.id },
      data: {
        status,
        approvedAt: status === 'APPROVED' ? new Date() : undefined,
        skippedAt: status === 'SKIPPED' ? new Date() : undefined,
        skippedReason: skippedReason || undefined,
      },
    });
    res.json(script);
  } catch (err) {
    console.error('Error updating script:', err);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// POST /api/marketing/scripts/:id/brief — generate and save brief
router.post('/scripts/:id/brief', requireAdmin, async (req, res) => {
  try {
    const { creatorId } = req.body;

    const script = await prisma.marketingScript.findUnique({
      where: { id: req.params.id },
    });
    if (!script) return res.status(404).json({ error: 'Script not found' });
    if (script.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Script must be APPROVED before generating a brief' });
    }

    const creator = creatorId
      ? await prisma.uGCCreator.findUnique({ where: { id: creatorId } })
      : null;

    const briefHtml = generateBriefHtml(script, creator);

    const brief = await prisma.contentBrief.create({
      data: {
        scriptId: script.id,
        creatorId: creatorId || null,
        briefHtml,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.marketingScript.update({
      where: { id: script.id },
      data: { status: 'BRIEFED' },
    });

    res.status(201).json({ brief, briefUrl: `/api/marketing/briefs/${brief.id}/html` });
  } catch (err) {
    console.error('Error generating brief:', err);
    res.status(500).json({ error: 'Failed to generate brief' });
  }
});

// GET /api/marketing/briefs/:id/html — render brief as HTML (for printing/sharing)
router.get('/briefs/:id/html', async (req, res) => {
  try {
    const brief = await prisma.contentBrief.findUnique({
      where: { id: req.params.id },
    });
    if (!brief) return res.status(404).json({ error: 'Not found' });

    res.setHeader('Content-Type', 'text/html');
    res.send(brief.briefHtml);
  } catch (err) {
    console.error('Error fetching brief:', err);
    res.status(500).json({ error: 'Failed to fetch brief' });
  }
});

// GET /api/marketing/creators — list creators
router.get('/creators', async (req, res) => {
  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const creators = await prisma.uGCCreator.findMany({
      where,
      include: {
        videos: { select: { performanceScore: true, viewCount: true, saveCount: true, leadsAttributed: true } },
        _count: { select: { briefs: true, videos: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(creators);
  } catch (err) {
    console.error('Error fetching creators:', err);
    res.status(500).json({ error: 'Failed to fetch creators' });
  }
});

// POST /api/marketing/creators — add creator to roster
router.post('/creators', requireAdmin, async (req, res) => {
  try {
    const { name, tiktokHandle, email, paymentEmail, ratePerVideo, promoCode, followerCount, avgViewCount, audienceType, hasKids, notes } = req.body;
    const creator = await prisma.uGCCreator.create({
      data: { name, tiktokHandle, email, paymentEmail, ratePerVideo, promoCode, followerCount, avgViewCount, audienceType, hasKids, notes },
    });
    res.status(201).json(creator);
  } catch (err) {
    console.error('Error creating creator:', err);
    res.status(500).json({ error: 'Failed to create creator' });
  }
});

// PATCH /api/marketing/creators/:id — update creator
router.patch('/creators/:id', requireAdmin, async (req, res) => {
  try {
    const creator = await prisma.uGCCreator.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(creator);
  } catch (err) {
    console.error('Error updating creator:', err);
    res.status(500).json({ error: 'Failed to update creator' });
  }
});

// GET /api/marketing/videos — list all videos with performance
router.get('/videos', async (_req, res) => {
  try {
    const videos = await prisma.uGCVideo.findMany({
      include: {
        creator: true,
        brief: { include: { script: true } },
      },
      orderBy: [{ performanceScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    res.json(videos);
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// POST /api/marketing/videos — log a received video
router.post('/videos', requireAdmin, async (req, res) => {
  try {
    const { briefId, creatorId, tiktokUrl, s3Url, notes } = req.body;
    const video = await prisma.uGCVideo.create({
      data: { briefId, creatorId, tiktokUrl, s3Url, notes },
    });
    res.status(201).json(video);
  } catch (err) {
    console.error('Error creating video:', err);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

// PATCH /api/marketing/videos/:id — update performance metrics
router.patch('/videos/:id', requireAdmin, async (req, res) => {
  try {
    const { viewCount, likeCount, shareCount, commentCount, saveCount, linkClicks, leadsAttributed, status, tiktokUrl, notes } = req.body;

    // Compute performance score with saves weighted heavily (2026 algorithm)
    let performanceScore: number | undefined;
    const views = viewCount ?? 0;
    const saves = saveCount ?? 0;
    const clicks = linkClicks ?? 0;
    const leads = leadsAttributed ?? 0;

    if (viewCount !== undefined || saveCount !== undefined || linkClicks !== undefined || leadsAttributed !== undefined) {
      performanceScore = (saves * 50) + (views * 0.2) + (clicks * 40) + (leads * 200);
      performanceScore = Math.min(100, performanceScore / 100);
    }

    const video = await prisma.uGCVideo.update({
      where: { id: req.params.id },
      data: {
        ...(viewCount !== undefined && { viewCount }),
        ...(likeCount !== undefined && { likeCount }),
        ...(shareCount !== undefined && { shareCount }),
        ...(commentCount !== undefined && { commentCount }),
        ...(saveCount !== undefined && { saveCount }),
        ...(linkClicks !== undefined && { linkClicks }),
        ...(leadsAttributed !== undefined && { leadsAttributed }),
        ...(status !== undefined && { status }),
        ...(tiktokUrl !== undefined && { tiktokUrl }),
        ...(notes !== undefined && { notes }),
        ...(performanceScore !== undefined && { performanceScore }),
      },
    });
    res.json(video);
  } catch (err) {
    console.error('Error updating video:', err);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// GET /api/marketing/insights — view extracted insights
router.get('/insights', async (_req, res) => {
  try {
    const insights = await prisma.marketingInsight.findMany({
      where: { isActive: true },
      orderBy: { insightScore: 'desc' },
    });
    res.json(insights);
  } catch (err) {
    console.error('Error fetching insights:', err);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// GET /api/marketing/stats — dashboard stats
router.get('/stats', async (_req, res) => {
  try {
    const [
      totalScripts,
      pendingReview,
      approved,
      briefed,
      totalVideos,
      totalCreators,
      activeCreators,
    ] = await Promise.all([
      prisma.marketingScript.count(),
      prisma.marketingScript.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.marketingScript.count({ where: { status: 'APPROVED' } }),
      prisma.marketingScript.count({ where: { status: 'BRIEFED' } }),
      prisma.uGCVideo.count(),
      prisma.uGCCreator.count(),
      prisma.uGCCreator.count({ where: { status: 'ACTIVE' } }),
    ]);

    res.json({
      scripts: { total: totalScripts, pendingReview, approved, briefed },
      videos: { total: totalVideos },
      creators: { total: totalCreators, active: activeCreators },
    });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
