import { prisma } from '../../lib/prisma.js';
import { generateScript } from '../episode/script.js';
import { generateStoryboard } from '../episode/storyboard.js';
import { processShotArt } from '../episode/shot-art.js';
import { processShotVoice } from '../episode/shot-voice.js';
import { processShotVideo } from '../episode/shot-video.js';
import { assembleEpisode } from '../episode/assemble.js';

// ── Helpers ──────────────────────────────────────────────────────────

function log(episodeId: string, msg: string) {
  console.log(`[Pipeline] Episode ${episodeId}: ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchEpisode(episodeId: string) {
  return prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
    include: { shots: true },
  });
}

// ── Full Pipeline ────────────────────────────────────────────────────

/**
 * Chains all generation stages sequentially for an episode.
 * Each stage checks if it needs to run (skips if already complete).
 */
export async function runFullPipeline(episodeId: string): Promise<void> {
  try {
    // 1. Load episode
    let episode = await fetchEpisode(episodeId);
    log(episodeId, 'pipeline started');

    // 2. Script
    if (!episode.script) {
      log(episodeId, 'starting script generation...');
      await generateScript(episodeId);
      await sleep(1000);
      episode = await fetchEpisode(episodeId);
      if (!episode.script) {
        log(episodeId, 'WARNING: script generation did not produce a script — stopping');
        return;
      }
    } else {
      log(episodeId, 'script already exists — skipping');
    }

    // 3. Storyboard
    if (episode.shots.length === 0) {
      log(episodeId, 'starting storyboard generation...');
      await generateStoryboard(episodeId);
      await sleep(1000);
      episode = await fetchEpisode(episodeId);
      if (episode.shots.length === 0) {
        log(episodeId, 'WARNING: storyboard generation produced no shots — stopping');
        return;
      }
    } else {
      log(episodeId, 'shots already exist — skipping storyboard');
    }

    // 4. Shot art
    const pendingArt = episode.shots.some((s) => s.imageStatus === 'PENDING');
    if (pendingArt) {
      log(episodeId, 'starting shot art generation...');
      await processShotArt(episodeId);
      episode = await fetchEpisode(episodeId);
      const stillPendingArt = episode.shots.some((s) => s.imageStatus === 'PENDING');
      if (stillPendingArt) {
        log(episodeId, 'WARNING: some shots still have pending art — stopping');
        return;
      }
    } else {
      log(episodeId, 'all shot art complete — skipping');
    }

    // 5. Shot voice
    const pendingVoice = episode.shots.some((s) => s.audioStatus === 'PENDING');
    if (pendingVoice) {
      log(episodeId, 'starting shot voice generation...');
      await processShotVoice(episodeId);
      episode = await fetchEpisode(episodeId);
      const stillPendingVoice = episode.shots.some((s) => s.audioStatus === 'PENDING');
      if (stillPendingVoice) {
        log(episodeId, 'WARNING: some shots still have pending voice — stopping');
        return;
      }
    } else {
      log(episodeId, 'all shot voice complete — skipping');
    }

    // 6. Shot video
    const pendingVideo = episode.shots.some((s) => s.videoStatus === 'PENDING');
    if (pendingVideo) {
      log(episodeId, 'starting shot video generation...');
      await processShotVideo(episodeId);
      episode = await fetchEpisode(episodeId);
      const stillPendingVideo = episode.shots.some((s) => s.videoStatus === 'PENDING');
      if (stillPendingVideo) {
        log(episodeId, 'WARNING: some shots still have pending video — stopping');
        return;
      }
    } else {
      log(episodeId, 'all shot video complete — skipping');
    }

    // 7. Assemble
    const allVideosComplete = episode.shots.length > 0 &&
      episode.shots.every((s) => s.videoStatus === 'COMPLETE');
    if (allVideosComplete && !episode.finalVideoUrl) {
      log(episodeId, 'starting episode assembly...');
      await assembleEpisode(episodeId);
      episode = await fetchEpisode(episodeId);
      if (!episode.finalVideoUrl) {
        log(episodeId, 'WARNING: assembly did not produce a final video — stopping');
        return;
      }
    } else if (episode.finalVideoUrl) {
      log(episodeId, 'final video already exists — skipping assembly');
    } else {
      log(episodeId, 'WARNING: not all shot videos are complete — cannot assemble');
      return;
    }

    log(episodeId, 'pipeline complete');
  } catch (err) {
    log(episodeId, `ERROR: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
}

// ── Batch Create ─────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Creates one episode per lesson in the given module.
 * Returns array of created episode IDs.
 */
export async function batchCreateEpisodes(
  moduleCode: string,
  format: 'SHORT' | 'EPISODE',
  series: string,
  createdBy: string,
): Promise<string[]> {
  const mod = await prisma.module.findUniqueOrThrow({
    where: { code: moduleCode },
    include: {
      lessons: { orderBy: { lessonNumber: 'asc' } },
    },
  });

  const createdIds: string[] = [];

  for (const lesson of mod.lessons) {
    // Check for existing episode with same moduleCode + lessonNumber + format
    const existing = await prisma.episode.findFirst({
      where: { moduleCode, lessonNumber: lesson.lessonNumber, format },
    });
    if (existing) {
      console.log(`[Pipeline] Skipping ${moduleCode} lesson ${lesson.lessonNumber} — episode already exists`);
      continue;
    }

    let slug = slugify(`${moduleCode}-lesson-${lesson.lessonNumber}-${lesson.title}`);

    // Handle duplicate slug
    const slugExists = await prisma.episode.findUnique({ where: { slug } });
    if (slugExists) {
      slug = `${slug}-${Date.now()}`;
    }

    const episode = await prisma.episode.create({
      data: {
        title: lesson.title,
        slug,
        format,
        series,
        moduleCode,
        lessonNumber: lesson.lessonNumber,
        chunkIds: [],
        createdBy,
      },
    });

    createdIds.push(episode.id);
    console.log(`[Pipeline] Created episode "${episode.title}" (${episode.id})`);
  }

  return createdIds;
}
