import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { generateScript } from '../../generation/episode/script.js';
import { generateStoryboard } from '../../generation/episode/storyboard.js';
import { processShotArt } from '../../generation/episode/shot-art.js';
import { processShotVoice } from '../../generation/episode/shot-voice.js';
import { processShotVideo } from '../../generation/episode/shot-video.js';
import { assembleEpisode } from '../../generation/episode/assemble.js';
import { runFullPipeline, batchCreateEpisodes } from '../../generation/episode/pipeline.js';

const router = Router();

// Helper: generate slug from module/lesson
function makeSlug(moduleCode: string, lessonNumber: number, title: string): string {
  const base = `${moduleCode}-lesson-${lessonNumber}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return base;
}

// GET /api/episodes — List episodes with optional filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { series, status, page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const take = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * take;

    const where: Record<string, unknown> = {};
    if (series) where.series = series as string;
    if (status) where.status = status as string;

    const [episodes, total] = await Promise.all([
      prisma.episode.findMany({
        where,
        include: {
          shots: {
            select: {
              id: true,
              orderIndex: true,
              imageStatus: true,
              audioStatus: true,
              videoStatus: true,
            },
            orderBy: { orderIndex: 'asc' },
          },
        },
        orderBy: [{ series: 'asc' }, { seriesOrder: 'asc' }],
        skip,
        take,
      }),
      prisma.episode.count({ where }),
    ]);

    res.json({ episodes, total, page: pageNum, limit: take });
  } catch (error) {
    console.error('[Episodes] List error:', error);
    res.status(500).json({ error: 'Failed to load episodes' });
  }
});

// POST /api/episodes/batch — Batch create episodes for all lessons in a module
// NOTE: Must be before /:id routes to avoid "batch" being treated as an ID
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { moduleCode, format, series } = req.body;
    const userEmail = (req as any).user?.email || 'unknown';

    if (!moduleCode || !format) {
      return res.status(400).json({ error: 'moduleCode and format are required' });
    }

    const ids = await batchCreateEpisodes(moduleCode, format, series || 'how-pieces-move', userEmail);
    res.json({ created: ids.length, episodeIds: ids });
  } catch (error) {
    console.error('[Episodes] Batch create error:', error);
    res.status(500).json({ error: 'Failed to batch create episodes' });
  }
});

// GET /api/episodes/:id — Single episode with all shots
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: {
        shots: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    res.json(episode);
  } catch (error) {
    console.error('[Episodes] Get error:', error);
    res.status(500).json({ error: 'Failed to load episode' });
  }
});

// POST /api/episodes — Create a new episode
router.post('/', async (req: Request, res: Response) => {
  try {
    const { format, series, moduleCode, lessonNumber } = req.body;
    const userEmail = (req as any).user?.email;

    if (!format || !moduleCode || lessonNumber === undefined) {
      return res.status(400).json({ error: 'format, moduleCode, and lessonNumber are required' });
    }

    if (!['SHORT', 'EPISODE'].includes(format)) {
      return res.status(400).json({ error: 'format must be SHORT or EPISODE' });
    }

    // Verify the lesson exists
    const lesson = await prisma.lesson.findFirst({
      where: {
        module: { code: moduleCode },
        lessonNumber: parseInt(lessonNumber),
      },
      include: { module: true },
    });

    if (!lesson) {
      return res.status(404).json({ error: `Lesson not found: ${moduleCode} L${lessonNumber}` });
    }

    const title = `${lesson.title}`;
    const slug = makeSlug(moduleCode, lesson.lessonNumber, lesson.title);

    // Check for duplicate slug
    const existing = await prisma.episode.findUnique({ where: { slug } });
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

    const episode = await prisma.episode.create({
      data: {
        title,
        slug: finalSlug,
        format,
        series: series || 'how-pieces-move',
        moduleCode,
        lessonNumber: lesson.lessonNumber,
        chunkIds: [],
        createdBy: userEmail || 'unknown',
      },
    });

    res.status(201).json(episode);
  } catch (error) {
    console.error('[Episodes] Create error:', error);
    res.status(500).json({ error: 'Failed to create episode' });
  }
});

// PATCH /api/episodes/:id — Update episode fields
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const data: Record<string, unknown> = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.series !== undefined) data.series = req.body.series;
    if (req.body.seriesOrder !== undefined) data.seriesOrder = req.body.seriesOrder;
    if (req.body.script !== undefined) data.script = req.body.script;
    if (req.body.status !== undefined) data.status = req.body.status;

    const updated = await prisma.episode.update({
      where: { id: req.params.id },
      data,
      include: { shots: { orderBy: { orderIndex: 'asc' } } },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Episodes] Update error:', error);
    res.status(500).json({ error: 'Failed to update episode' });
  }
});

// DELETE /api/episodes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    await prisma.episode.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[Episodes] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete episode' });
  }
});

// POST /api/episodes/:id/generate-script — Generate script from curriculum
router.post('/:id/generate-script', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    // Fire and forget — script generation can take 10-20s
    // Return 202 immediately, client polls episode status
    res.status(202).json({ id: episode.id, status: 'SCRIPTING' });

    // Run in background
    generateScript(episode.id).catch(err => {
      console.error(`[Episodes] Script generation failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Generate script error:', error);
    res.status(500).json({ error: 'Failed to start script generation' });
  }
});

// POST /api/episodes/:id/generate-storyboard — Generate storyboard shots from script
router.post('/:id/generate-storyboard', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    if (!episode.script) {
      return res.status(400).json({ error: 'Episode has no script — generate a script first' });
    }

    res.status(202).json({ id: episode.id, status: 'STORYBOARDING' });

    generateStoryboard(episode.id).catch(err => {
      console.error(`[Episodes] Storyboard generation failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Generate storyboard error:', error);
    res.status(500).json({ error: 'Failed to start storyboard generation' });
  }
});

// POST /api/episodes/:id/generate-art — Generate art for all shots via Gemini
router.post('/:id/generate-art', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { shots: { select: { id: true } } },
    });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (episode.shots.length === 0) return res.status(400).json({ error: 'No shots — generate storyboard first' });

    await prisma.episode.update({ where: { id: episode.id }, data: { status: 'ART' } });
    res.status(202).json({ id: episode.id, status: 'ART' });

    processShotArt(episode.id).catch(err => {
      console.error(`[Episodes] Art generation failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Generate art error:', error);
    res.status(500).json({ error: 'Failed to start art generation' });
  }
});

// POST /api/episodes/:id/generate-voice — Generate voice audio for all shots via ElevenLabs
router.post('/:id/generate-voice', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { shots: { select: { id: true } } },
    });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (episode.shots.length === 0) return res.status(400).json({ error: 'No shots — generate storyboard first' });

    await prisma.episode.update({ where: { id: episode.id }, data: { status: 'VOICE' } });
    res.status(202).json({ id: episode.id, status: 'VOICE' });

    processShotVoice(episode.id).catch(err => {
      console.error(`[Episodes] Voice generation failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Generate voice error:', error);
    res.status(500).json({ error: 'Failed to start voice generation' });
  }
});

// POST /api/episodes/:id/generate-video — Generate video clips for all shots via Veo
router.post('/:id/generate-video', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { shots: { select: { id: true } } },
    });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    if (episode.shots.length === 0) return res.status(400).json({ error: 'No shots — generate storyboard first' });

    res.status(202).json({ id: episode.id, status: 'VIDEO' });

    processShotVideo(episode.id).catch(err => {
      console.error(`[Episodes] Video generation failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Generate video error:', error);
    res.status(500).json({ error: 'Failed to start video generation' });
  }
});

// POST /api/episodes/:id/assemble — Assemble all shot clips into final video
router.post('/:id/assemble', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { shots: { select: { id: true, videoStatus: true } } },
    });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    const readyShots = episode.shots.filter(s => s.videoStatus === 'COMPLETE');
    if (readyShots.length === 0) {
      return res.status(400).json({ error: 'No completed shot videos to assemble' });
    }

    res.status(202).json({ id: episode.id, status: 'ASSEMBLING' });

    assembleEpisode(episode.id).catch(err => {
      console.error(`[Episodes] Assembly failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Assemble error:', error);
    res.status(500).json({ error: 'Failed to start assembly' });
  }
});

// POST /api/episodes/:id/generate-all — Run full pipeline (script → storyboard → art → voice → video → assemble)
router.post('/:id/generate-all', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!episode) return res.status(404).json({ error: 'Episode not found' });

    res.status(202).json({ id: episode.id, status: 'SCRIPTING' });

    runFullPipeline(episode.id).catch(err => {
      console.error(`[Episodes] Full pipeline failed for ${episode.id}:`, err);
    });
  } catch (error) {
    console.error('[Episodes] Generate all error:', error);
    res.status(500).json({ error: 'Failed to start full pipeline' });
  }
});

// POST /api/episodes/:id/duplicate — Duplicate an episode (copies format, series, module/lesson, NOT generated content)
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    const source = await prisma.episode.findUnique({ where: { id: req.params.id } });
    if (!source) return res.status(404).json({ error: 'Episode not found' });

    const userEmail = (req as any).user?.email || 'unknown';
    let slug = `${source.slug}-copy`;
    const slugExists = await prisma.episode.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now()}`;

    const duplicate = await prisma.episode.create({
      data: {
        title: `${source.title} (copy)`,
        slug,
        format: source.format,
        series: source.series,
        moduleCode: source.moduleCode,
        lessonNumber: source.lessonNumber,
        chunkIds: [],
        createdBy: userEmail,
      },
    });

    res.status(201).json(duplicate);
  } catch (error) {
    console.error('[Episodes] Duplicate error:', error);
    res.status(500).json({ error: 'Failed to duplicate episode' });
  }
});

// POST /api/episodes/batch — Batch create episodes for all lessons in a module
// POST /api/episodes/:id/shots — Create a manual shot
router.post('/:id/shots', async (req: Request, res: Response) => {
  try {
    const episode = await prisma.episode.findUnique({
      where: { id: req.params.id },
      include: { shots: { select: { orderIndex: true }, orderBy: { orderIndex: 'desc' }, take: 1 } },
    });
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }

    const nextIndex = episode.shots.length > 0 ? episode.shots[0].orderIndex + 1 : 0;
    const { sceneDescription, characters, cameraAngle, narration, dialogueLines } = req.body;

    const shot = await prisma.shot.create({
      data: {
        episodeId: episode.id,
        orderIndex: nextIndex,
        sceneDescription: sceneDescription || 'New shot',
        characters: characters || [],
        cameraAngle: cameraAngle || 'medium',
        narration: narration || null,
        dialogueLines: dialogueLines || undefined,
      },
    });

    res.status(201).json(shot);
  } catch (error) {
    console.error('[Episodes] Create shot error:', error);
    res.status(500).json({ error: 'Failed to create shot' });
  }
});

// PATCH /api/episodes/:id/shots/:shotId — Update a shot
router.patch('/:id/shots/:shotId', async (req: Request, res: Response) => {
  try {
    const shot = await prisma.shot.findFirst({
      where: { id: req.params.shotId, episodeId: req.params.id },
    });
    if (!shot) {
      return res.status(404).json({ error: 'Shot not found' });
    }

    const data: Record<string, unknown> = {};
    if (req.body.sceneDescription !== undefined) data.sceneDescription = req.body.sceneDescription;
    if (req.body.characters !== undefined) data.characters = req.body.characters;
    if (req.body.cameraAngle !== undefined) data.cameraAngle = req.body.cameraAngle;
    if (req.body.narration !== undefined) data.narration = req.body.narration;
    if (req.body.dialogueLines !== undefined) data.dialogueLines = req.body.dialogueLines;

    const updated = await prisma.shot.update({
      where: { id: shot.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error('[Episodes] Update shot error:', error);
    res.status(500).json({ error: 'Failed to update shot' });
  }
});

// DELETE /api/episodes/:id/shots/:shotId — Delete a shot
router.delete('/:id/shots/:shotId', async (req: Request, res: Response) => {
  try {
    const shot = await prisma.shot.findFirst({
      where: { id: req.params.shotId, episodeId: req.params.id },
    });
    if (!shot) {
      return res.status(404).json({ error: 'Shot not found' });
    }

    await prisma.shot.delete({ where: { id: shot.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[Episodes] Delete shot error:', error);
    res.status(500).json({ error: 'Failed to delete shot' });
  }
});

// PATCH /api/episodes/:id/shots/reorder — Reorder shots
router.patch('/:id/shots/reorder', async (req: Request, res: Response) => {
  try {
    const { shotIds } = req.body as { shotIds: string[] };
    if (!Array.isArray(shotIds)) {
      return res.status(400).json({ error: 'shotIds array is required' });
    }

    // Verify all shots belong to this episode
    const shots = await prisma.shot.findMany({
      where: { episodeId: req.params.id },
      select: { id: true },
    });
    const validIds = new Set(shots.map(s => s.id));
    const allValid = shotIds.every(id => validIds.has(id));
    if (!allValid) {
      return res.status(400).json({ error: 'Invalid shot IDs' });
    }

    // Update each shot's orderIndex in a transaction
    await prisma.$transaction(
      shotIds.map((shotId, index) =>
        prisma.shot.update({
          where: { id: shotId },
          data: { orderIndex: index },
        })
      )
    );

    // Return updated shots
    const updated = await prisma.shot.findMany({
      where: { episodeId: req.params.id },
      orderBy: { orderIndex: 'asc' },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Episodes] Reorder shots error:', error);
    res.status(500).json({ error: 'Failed to reorder shots' });
  }
});

export default router;
