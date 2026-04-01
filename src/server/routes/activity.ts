import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';

const router = Router();

interface ActivityEvent {
  id: string;
  type: 'illustration' | 'video' | 'audio' | 'lesson';
  action: string;
  title: string;
  characterName: string | null;
  thumbnailUrl: string | null;
  timestamp: string;
}

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const [recentIllustrations, recentVideos, recentAudio] = await Promise.all([
      prisma.illustration.findMany({
        where: { artType: { not: 'VIDEO' } },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: { character: { select: { name: true } } },
      }),
      prisma.illustration.findMany({
        where: { artType: 'VIDEO' },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: { character: { select: { name: true } } },
      }),
      prisma.audioScript.findMany({
        orderBy: { updatedAt: 'desc' },
        take: limit,
        include: { characterVoice: { select: { name: true, character: true } } },
      }),
    ]);

    const events: ActivityEvent[] = [];

    for (const ill of recentIllustrations) {
      events.push({
        id: `ill-${ill.id}`,
        type: 'illustration',
        action: ill.aiDescription ? 'described' : 'added',
        title: ill.name,
        characterName: ill.character?.name || null,
        thumbnailUrl: ill.illustrationUrl,
        timestamp: ill.updatedAt.toISOString(),
      });
    }

    for (const vid of recentVideos) {
      events.push({
        id: `vid-${vid.id}`,
        type: 'video',
        action: 'created',
        title: vid.name,
        characterName: vid.character?.name || null,
        thumbnailUrl: vid.illustrationUrl,
        timestamp: vid.updatedAt.toISOString(),
      });
    }

    for (const audio of recentAudio) {
      events.push({
        id: `aud-${audio.id}`,
        type: 'audio',
        action: 'created',
        title: audio.name,
        characterName: audio.characterVoice?.character || null,
        thumbnailUrl: null,
        timestamp: audio.updatedAt.toISOString(),
      });
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(events.slice(0, limit));
  } catch (error) {
    console.error('[Activity] Error:', error);
    res.status(500).json({ error: 'Failed to load activity feed' });
  }
});

export default router;
