import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { anthropic } from '../../lib/anthropic.js';

const router = Router();

// GET / — List all characters with content counts
router.get('/', async (_req, res) => {
  try {
    // Get all characters with lesson counts via FK
    const characters = await prisma.character.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { lessons: true, illustrations: true, illustrationTags: true },
        },
      },
    });

    // Get voice counts grouped by character field (still name-based, no FK yet)
    const voiceCounts = await prisma.characterVoice.groupBy({
      by: ['character'],
      _count: { id: true },
    });

    const voiceMap = new Map<string, number>();
    for (const row of voiceCounts) {
      if (row.character) {
        const key = row.character.toLowerCase();
        voiceMap.set(key, (voiceMap.get(key) || 0) + row._count.id);
      }
    }

    // Fetch avatar/profile illustrations for characters that have one set
    const avatarIds = [
      ...characters.map(c => c.avatarIllustrationId),
      ...characters.map(c => c.profileIllustrationId),
    ].filter(Boolean) as string[];
    const avatarIlls = avatarIds.length > 0
      ? await prisma.illustration.findMany({
          where: { id: { in: avatarIds } },
          select: { id: true, illustrationUrl: true, sourcePhotoUrl: true },
        })
      : [];
    const avatarMap = new Map(avatarIlls.map(a => [a.id, a.illustrationUrl || a.sourcePhotoUrl]));

    // Fallback: fetch one representative illustration per character for thumbnails (using FK)
    const charsWithoutAvatar = characters.filter(c => !c.avatarIllustrationId && !c.profileIllustrationId);
    const charIdsWithoutAvatar = charsWithoutAvatar.map(c => c.id);

    // Find thumbnails via FK or many-to-many tags
    const [fkThumbs, tagThumbs] = charIdsWithoutAvatar.length > 0
      ? await Promise.all([
          prisma.illustration.findMany({
            where: {
              characterId: { in: charIdsWithoutAvatar },
              OR: [{ illustrationUrl: { not: null } }, { sourcePhotoUrl: { not: null } }],
            },
            select: { characterId: true, illustrationUrl: true, sourcePhotoUrl: true },
            distinct: ['characterId'],
            orderBy: { createdAt: 'desc' },
          }),
          prisma.illustration.findMany({
            where: {
              characterTags: { some: { characterId: { in: charIdsWithoutAvatar } } },
              OR: [{ illustrationUrl: { not: null } }, { sourcePhotoUrl: { not: null } }],
            },
            select: { illustrationUrl: true, sourcePhotoUrl: true, characterTags: { select: { characterId: true }, take: 1 } },
            orderBy: { createdAt: 'desc' },
          }),
        ])
      : [[], []];

    const thumbMap = new Map<string, string>();
    for (const t of fkThumbs) {
      const url = t.illustrationUrl || t.sourcePhotoUrl;
      if (t.characterId && url && !thumbMap.has(t.characterId)) {
        thumbMap.set(t.characterId, url);
      }
    }
    for (const t of tagThumbs) {
      const charId = t.characterTags[0]?.characterId;
      const url = t.illustrationUrl || t.sourcePhotoUrl;
      if (charId && url && !thumbMap.has(charId)) {
        thumbMap.set(charId, url);
      }
    }

    // Count gold standards per character (FK-linked)
    const goldStandardCounts = await prisma.illustration.groupBy({
      by: ['characterId'],
      where: { isGoldStandard: true, characterId: { not: null } },
      _count: { id: true },
    });
    const goldMap = new Map<string, number>();
    for (const row of goldStandardCounts) {
      if (row.characterId) goldMap.set(row.characterId, row._count.id);
    }

    const tposeCounts = await prisma.illustration.groupBy({
      by: ['characterId'],
      where: { isGoldStandard: true, goldStandardType: 'TPOSE', characterId: { not: null } },
      _count: { id: true },
    });
    const tposeSet = new Set<string>();
    for (const row of tposeCounts) {
      if (row.characterId && row._count.id > 0) tposeSet.add(row.characterId);
    }

    // Count lessons that mention each character by name (for characters without FK links)
    const mentionCounts = new Map<string, number>();
    for (const c of characters) {
      const mentionCount = await prisma.lesson.count({
        where: {
          rawContent: { contains: c.name, mode: 'insensitive' },
          characters: { none: { characterId: c.id } },
        },
      });
      mentionCounts.set(c.id, mentionCount);
    }

    const result = characters.map((c) => {
      const charLower = c.name.toLowerCase();

      // Sum voices whose character field matches this character's name
      let voiceCount = 0;
      for (const [voiceChar, count] of voiceMap) {
        if (voiceChar.includes(charLower) || charLower.includes(voiceChar)) {
          voiceCount += count;
        }
      }

      return {
        id: c.id,
        name: c.name,
        piece: c.piece,
        trait: c.trait,
        movementNote: c.movementNote,
        firstAppearance: c.firstAppearance,
        lessonCount: c._count.lessons + (mentionCounts.get(c.id) || 0),
        illustrationCount: c._count.illustrations + c._count.illustrationTags,
        voiceCount,
        thumbnailUrl: (
          c.avatarIllustrationId ? avatarMap.get(c.avatarIllustrationId)
          : c.profileIllustrationId ? avatarMap.get(c.profileIllustrationId)
          : thumbMap.get(c.id)
        ) || null,
        avatarPosition: c.avatarPosition || c.profilePosition || null,
        goldStandardCount: goldMap.get(c.id) || 0,
        hasTpose: tposeSet.has(c.id),
      };
    });

    res.json(result);
  } catch (error) {
    console.error('[Characters] List error:', error);
    res.status(500).json({ error: 'Failed to load characters' });
  }
});

// POST / — Create a new character
router.post('/', async (req, res) => {
  try {
    const { name, piece, trait } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Character name is required' });
    }

    const existing = await prisma.character.findUnique({ where: { name: name.trim() } });
    if (existing) {
      return res.status(409).json({ error: 'A character with that name already exists' });
    }

    const character = await prisma.character.create({
      data: {
        name: name.trim(),
        piece: piece?.trim() || null,
        trait: trait?.trim() || null,
      },
    });

    res.status(201).json(character);
  } catch (error) {
    console.error('[Characters] Create error:', error);
    res.status(500).json({ error: 'Failed to create character' });
  }
});

// GET /:id — Single character profile with all associated content
router.get('/:id', async (req, res) => {
  try {
    const character = await prisma.character.findUnique({
      where: { id: req.params.id },
      include: {
        lessons: {
          include: {
            lesson: {
              select: {
                id: true,
                title: true,
                lessonNumber: true,
                chessConceptKey: true,
                rawContent: true,
                module: {
                  select: { code: true, title: true, sequence: true },
                },
              },
            },
          },
        },
      },
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Find illustrations linked to this character via FK OR many-to-many tags (excluding videos)
    const illustrationInclude = {
      lesson: {
        select: { id: true, lessonNumber: true, title: true, module: { select: { code: true, title: true } } },
      },
      character: {
        select: { id: true, name: true },
      },
      characterTags: {
        include: { character: { select: { id: true, name: true } } },
      },
    };

    const [fkIllustrations, taggedIllustrations] = await Promise.all([
      prisma.illustration.findMany({
        where: { characterId: character.id, artType: { not: 'VIDEO' } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: illustrationInclude,
      }),
      prisma.illustration.findMany({
        where: {
          characterTags: { some: { characterId: character.id } },
          artType: { not: 'VIDEO' },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: illustrationInclude,
      }),
    ]);

    // Merge and deduplicate
    const seenIds = new Set<string>();
    const illustrations = [...fkIllustrations, ...taggedIllustrations]
      .filter(ill => {
        if (seenIds.has(ill.id)) return false;
        seenIds.add(ill.id);
        return true;
      })
      .sort((a, b) => {
        // Gold standards first (t-poses, then references, then regular)
        const ai = a as unknown as { isGoldStandard?: boolean; goldStandardType?: string | null; createdAt: Date };
        const bi = b as unknown as { isGoldStandard?: boolean; goldStandardType?: string | null; createdAt: Date };
        const goldOrder = (ill: typeof ai) =>
          ill.isGoldStandard && ill.goldStandardType === 'TPOSE' ? 0
          : ill.isGoldStandard ? 1
          : 2;
        const orderDiff = goldOrder(ai) - goldOrder(bi);
        if (orderDiff !== 0) return orderDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 50);

    // Find videos linked to this character via FK or tags
    const [fkVideos, taggedVideos] = await Promise.all([
      prisma.illustration.findMany({
        where: { characterId: character.id, artType: 'VIDEO' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.illustration.findMany({
        where: {
          characterTags: { some: { characterId: character.id } },
          artType: 'VIDEO',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const videoSeenIds = new Set<string>();
    const videos = [...fkVideos, ...taggedVideos]
      .filter(v => {
        if (videoSeenIds.has(v.id)) return false;
        videoSeenIds.add(v.id);
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50);

    // Find character voices matching name
    const voices = await prisma.characterVoice.findMany({
      where: {
        character: { contains: character.name, mode: 'insensitive' },
      },
      select: {
        id: true,
        name: true,
        description: true,
        voiceId: true,
        sampleUrl: true,
        createdAt: true,
      },
    });

    // Gather lessons from FK join table
    const fkLessonIds = new Set(character.lessons.map(lc => lc.lesson.id));
    const fkLessons = character.lessons.map(lc => lc.lesson);

    // Also find lessons that mention this character by name in rawContent (but aren't already FK-linked)
    const mentionLessons = await prisma.lesson.findMany({
      where: {
        rawContent: { contains: character.name, mode: 'insensitive' },
        id: { notIn: Array.from(fkLessonIds) },
      },
      select: {
        id: true,
        title: true,
        lessonNumber: true,
        chessConceptKey: true,
        rawContent: true,
        module: {
          select: { code: true, title: true, sequence: true },
        },
      },
    });

    // Merge and deduplicate, sorted by module sequence then lesson number
    const allLessons = [...fkLessons, ...mentionLessons];
    const lessons = allLessons
      .sort((a, b) => {
        const seqDiff = a.module.sequence - b.module.sequence;
        if (seqDiff !== 0) return seqDiff;
        return a.lessonNumber - b.lessonNumber;
      })
      .map((lesson) => {
        // Extract a short story excerpt from rawContent (first 2 non-empty lines after "## Story" or first 200 chars)
        let storyExcerpt: string | null = null;
        if (lesson.rawContent) {
          const storyMatch = lesson.rawContent.match(/##\s*Story[^\n]*\n([\s\S]*?)(?=\n##|\n---|\z)/i);
          if (storyMatch) {
            const lines = storyMatch[1].trim().split('\n').filter((l: string) => l.trim());
            storyExcerpt = lines.slice(0, 3).join(' ').substring(0, 300);
            if (storyExcerpt.length === 300) storyExcerpt += '…';
          } else {
            // Fallback: first meaningful paragraph
            const lines = lesson.rawContent.split('\n').filter((l: string) => l.trim() && !l.startsWith('#'));
            storyExcerpt = lines.slice(0, 2).join(' ').substring(0, 200);
            if (storyExcerpt.length === 200) storyExcerpt += '…';
          }
        }
        return {
          id: lesson.id,
          title: lesson.title,
          lessonNumber: lesson.lessonNumber,
          chessConceptKey: lesson.chessConceptKey,
          module: { code: lesson.module.code, title: lesson.module.title, sequence: lesson.module.sequence },
          storyExcerpt,
        };
      });

    // Count totals for the summary fields
    const illustrationCount = illustrations.length;
    const voiceCount = voices.length;

    // Fetch avatar/cover/profile illustrations if set
    let avatarIllustration = null;
    let coverIllustration = null;
    let profileIllustration = null;
    if (character.avatarIllustrationId) {
      avatarIllustration = await prisma.illustration.findUnique({
        where: { id: character.avatarIllustrationId },
        select: { id: true, name: true, illustrationUrl: true, sourcePhotoUrl: true },
      });
    }
    if (character.coverIllustrationId) {
      coverIllustration = await prisma.illustration.findUnique({
        where: { id: character.coverIllustrationId },
        select: { id: true, name: true, illustrationUrl: true, sourcePhotoUrl: true },
      });
    }
    if (character.profileIllustrationId) {
      profileIllustration = await prisma.illustration.findUnique({
        where: { id: character.profileIllustrationId },
        select: { id: true, name: true, illustrationUrl: true, sourcePhotoUrl: true },
      });
    }

    res.json({
      id: character.id,
      name: character.name,
      piece: character.piece,
      trait: character.trait,
      movementNote: character.movementNote,
      firstAppearance: character.firstAppearance,
      bio: character.bio,
      lessonCount: lessons.length,
      illustrationCount,
      voiceCount,
      avatarIllustrationId: character.avatarIllustrationId,
      avatarIllustration,
      avatarPosition: character.avatarPosition,
      coverIllustrationId: character.coverIllustrationId,
      coverIllustration,
      coverPosition: character.coverPosition,
      profileIllustrationId: character.profileIllustrationId,
      profileIllustration,
      profilePosition: character.profilePosition,
      lessons,
      illustrations,
      voices,
      videos,
    });
  } catch (error) {
    console.error('[Characters] Detail error:', error);
    res.status(500).json({ error: 'Failed to load character' });
  }
});

// PATCH /:id — Update character cover/profile photos
router.patch('/:id', async (req, res) => {
  try {
    const character = await prisma.character.findUnique({
      where: { id: req.params.id },
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const data: Record<string, unknown> = {};

    if ('avatarIllustrationId' in req.body) {
      data.avatarIllustrationId = req.body.avatarIllustrationId || null;
    }
    if ('avatarPosition' in req.body) {
      data.avatarPosition = req.body.avatarPosition || null;
    }
    if ('coverIllustrationId' in req.body) {
      data.coverIllustrationId = req.body.coverIllustrationId || null;
    }
    if ('coverPosition' in req.body) {
      data.coverPosition = req.body.coverPosition || null;
    }
    if ('profileIllustrationId' in req.body) {
      data.profileIllustrationId = req.body.profileIllustrationId || null;
    }
    if ('profilePosition' in req.body) {
      data.profilePosition = req.body.profilePosition || null;
    }
    if ('bio' in req.body) {
      data.bio = req.body.bio || null;
    }
    if ('piece' in req.body) data.piece = req.body.piece;
    if ('trait' in req.body) data.trait = req.body.trait;
    if ('movementNote' in req.body) data.movementNote = req.body.movementNote;
    if ('firstAppearance' in req.body) data.firstAppearance = req.body.firstAppearance;

    const updated = await prisma.character.update({
      where: { id: req.params.id },
      data,
    });

    res.json(updated);
  } catch (error) {
    console.error('[Characters] Update error:', error);
    res.status(500).json({ error: 'Failed to update character' });
  }
});

// POST /:id/generate-bio — Generate character bio from lesson content via Claude
router.post('/:id/generate-bio', async (req, res) => {
  try {
    const character = await prisma.character.findUnique({
      where: { id: req.params.id },
      include: {
        lessons: {
          include: {
            lesson: {
              select: { title: true, lessonNumber: true, rawContent: true, module: { select: { code: true } } },
            },
          },
        },
      },
    });

    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Collect lesson content mentioning this character
    const lessonExcerpts = character.lessons.map(lc => {
      const l = lc.lesson;
      // Extract relevant sections (trim to avoid token waste)
      const content = l.rawContent.substring(0, 2000);
      return `Module ${l.module.code}, Lesson ${l.lessonNumber}: ${l.title}\n${content}`;
    });

    // Also search all lessons for character name mentions (for characters without lesson FK links)
    let extraExcerpts: string[] = [];
    if (lessonExcerpts.length === 0) {
      const mentioningLessons = await prisma.lesson.findMany({
        where: { rawContent: { contains: character.name, mode: 'insensitive' } },
        select: { title: true, lessonNumber: true, rawContent: true, module: { select: { code: true } } },
        take: 10,
      });
      extraExcerpts = mentioningLessons.map(l => {
        const content = l.rawContent.substring(0, 2000);
        return `Module ${l.module.code}, Lesson ${l.lessonNumber}: ${l.title}\n${content}`;
      });
    }

    const allExcerpts = [...lessonExcerpts, ...extraExcerpts];

    if (allExcerpts.length === 0) {
      return res.status(400).json({ error: `No lesson content found for ${character.name}` });
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are writing a character bio for a Acme Creative character profile page. Based on the lesson content below, write a fun, engaging 2-3 paragraph bio for "${character.name}".

Include:
- Their personality and role in the Acme Creative world
- What chess piece they represent (${character.piece || 'unknown'}) and how they move
- Their key traits: ${character.trait || 'unknown'}
- Any memorable story moments or relationships with other characters

Write in a warm, playful tone appropriate for a children's education platform. Keep it under 150 words.

Lesson content:
${allExcerpts.join('\n\n---\n\n')}`,
      }],
    });

    const bio = msg.content[0].type === 'text' ? msg.content[0].text : '';

    // Save the bio
    await prisma.character.update({
      where: { id: character.id },
      data: { bio },
    });

    res.json({ bio });
  } catch (error) {
    console.error('[Characters] Generate bio error:', error);
    res.status(500).json({ error: 'Failed to generate bio' });
  }
});

export default router;
