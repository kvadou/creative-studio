import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../../lib/prisma.js';
import { getElevenLabsClient } from '../../lib/elevenlabs.js';
import { config } from '../../lib/config.js';
import { deleteFromS3 } from '../../lib/s3.js';
import {
  uploadAudioPreview,
  uploadVoiceSample,
  uploadTtsAudio,
  uploadLineAudio,
  uploadStitchedAudio,
} from '../../generation/audio/upload.js';

const router = Router();

// ── Rate limiters ────────────────────────────────────────────────────

const designRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as any).user?.email || 'anonymous',
  message: { error: 'Too many voice design requests. Please try again in a minute.' },
  validate: false,
});

const ttsRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as any).user?.email || 'anonymous',
  message: { error: 'Too many TTS requests. Please try again in a minute.' },
  validate: false,
});

// ── Helper: collect ReadableStream<Uint8Array> into Buffer ───────────

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// ── Emotion-aware voice settings ─────────────────────────────────────

const emotionVoiceSettings: Record<string, { stability: number; similarityBoost: number; style: number }> = {
  neutral:  { stability: 0.5, similarityBoost: 0.75, style: 0.0 },
  excited:  { stability: 0.3, similarityBoost: 0.75, style: 0.7 },
  dramatic: { stability: 0.4, similarityBoost: 0.8,  style: 0.8 },
  gentle:   { stability: 0.7, similarityBoost: 0.8,  style: 0.3 },
  teaching: { stability: 0.6, similarityBoost: 0.75, style: 0.4 },
};

// ── Helper: generate audio for a single line ────────────────────────

async function generateLineAudio(lineId: string) {
  const line = await prisma.audioLine.findUnique({
    where: { id: lineId },
    include: {
      characterVoice: true,
      script: true,
    },
  });
  if (!line) throw new Error('Line not found');
  if (!line.characterVoice.voiceId) throw new Error('Voice has no ElevenLabs ID');

  // Mark as generating
  await prisma.audioLine.update({
    where: { id: line.id },
    data: { status: 'GENERATING', errorMessage: null },
  });

  try {
    const client = getElevenLabsClient();
    const voiceSettings = emotionVoiceSettings[line.emotion] || emotionVoiceSettings.neutral;

    // Generate TTS with emotion-aware settings
    const audioStream = await client.textToSpeech.convert(line.characterVoice.voiceId, {
      text: line.text,
      modelId: config.elevenLabsModel,
      outputFormat: 'mp3_44100_128',
      voiceSettings,
    });

    const audioBuffer = await streamToBuffer(audioStream);

    // Upload to S3
    const { url, key } = await uploadLineAudio(audioBuffer, line.scriptId, line.sequence);

    // Estimate duration (rough: mp3 at 128kbps)
    const durationSecs = (audioBuffer.length * 8) / (128 * 1000);

    // Update line with result
    const updated = await prisma.audioLine.update({
      where: { id: line.id },
      data: {
        status: 'COMPLETED',
        audioUrl: url,
        audioKey: key,
        durationSecs: Math.round(durationSecs * 10) / 10,
      },
    });

    return updated;
  } catch (genError) {
    // Mark as failed
    const errorMsg = genError instanceof Error ? genError.message : 'Unknown generation error';
    await prisma.audioLine.update({
      where: { id: line.id },
      data: { status: 'FAILED', errorMessage: errorMsg },
    });
    throw genError;
  }
}

// =====================================================================
// VOICES — CRUD + Design
// =====================================================================

// GET /api/audio/voices — List character voices
router.get('/voices', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const character = req.query.character as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const conditions: Record<string, unknown>[] = [];
    if (search) {
      conditions.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { character: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      });
    }
    if (character) {
      conditions.push({ character: { equals: character, mode: 'insensitive' as const } });
    }
    const where = conditions.length > 0
      ? conditions.length === 1 ? conditions[0] : { AND: conditions }
      : undefined;

    const [voices, total] = await Promise.all([
      prisma.characterVoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          _count: { select: { scripts: true, lines: true } },
        },
      }),
      prisma.characterVoice.count({ where }),
    ]);

    res.json({ voices, total });
  } catch (error) {
    console.error('[Audio] List voices error:', error);
    res.status(500).json({ error: 'Failed to load voices' });
  }
});

// GET /api/audio/voices/:id — Get single voice with scripts and lines
router.get('/voices/:id', async (req: Request, res: Response) => {
  try {
    const voice = await prisma.characterVoice.findUnique({
      where: { id: req.params.id },
      include: {
        scripts: {
          orderBy: { createdAt: 'desc' },
          include: {
            lines: {
              orderBy: { sequence: 'asc' },
            },
          },
        },
      },
    });

    if (!voice) {
      return res.status(404).json({ error: 'Voice not found' });
    }

    res.json(voice);
  } catch (error) {
    console.error('[Audio] Get voice error:', error);
    res.status(500).json({ error: 'Failed to load voice' });
  }
});

// POST /api/audio/voices/design — Design voice previews via ElevenLabs
router.post('/voices/design', designRateLimit, async (req: Request, res: Response) => {
  try {
    const { voiceDescription, text } = req.body;

    if (!voiceDescription || !voiceDescription.trim()) {
      return res.status(400).json({ error: 'Voice description is required' });
    }

    const client = getElevenLabsClient();
    const userEmail = (req as any).user?.email;

    // Call ElevenLabs voice design API
    const result = await client.textToVoice.createPreviews({
      voiceDescription: voiceDescription.trim(),
      text: text?.trim() || undefined,
      outputFormat: 'mp3_44100_128',
    });

    // Upload each preview to S3 and save to DB
    const savedPreviews = await Promise.all(
      result.previews.map(async (preview) => {
        // Decode base64 audio to buffer
        const audioBuffer = Buffer.from(preview.audioBase64, 'base64');

        // Upload to S3
        const { url, key } = await uploadAudioPreview(audioBuffer, voiceDescription);

        // Save VoicePreview record
        const saved = await prisma.voicePreview.create({
          data: {
            voiceDescription: voiceDescription.trim(),
            generatedVoiceId: preview.generatedVoiceId,
            audioUrl: url,
            audioKey: key,
            durationSecs: preview.durationSecs,
            createdByEmail: userEmail,
          },
        });

        return saved;
      })
    );

    res.json({
      previews: savedPreviews,
      text: result.text,
    });
  } catch (error) {
    console.error('[Audio] Design voice error:', error);
    res.status(500).json({ error: 'Failed to design voice. Please try again.' });
  }
});

// POST /api/audio/voices — Save a designed voice as CharacterVoice
router.post('/voices', async (req: Request, res: Response) => {
  try {
    const { name, voiceDescription, generatedVoiceId, character, previewId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Voice name is required' });
    }
    if (!voiceDescription?.trim()) {
      return res.status(400).json({ error: 'Voice description is required' });
    }
    if (!generatedVoiceId) {
      return res.status(400).json({ error: 'Generated voice ID is required (select a preview first)' });
    }

    const client = getElevenLabsClient();
    const userEmail = (req as any).user?.email;

    // Create permanent voice on ElevenLabs
    const voice = await client.textToVoice.create({
      voiceName: name.trim(),
      voiceDescription: voiceDescription.trim(),
      generatedVoiceId,
    });

    // Upload sample audio to S3 if preview exists
    let sampleUrl: string | null = null;
    let sampleKey: string | null = null;

    if (previewId) {
      const preview = await prisma.voicePreview.findUnique({
        where: { id: previewId },
      });
      if (preview?.audioUrl) {
        // Fetch the preview audio from S3 and re-upload as sample
        // (The preview audio is already in S3, so just reuse the URL)
        sampleUrl = preview.audioUrl;
        sampleKey = preview.audioKey;
      }
    }

    // If no preview audio available, try to get sample from ElevenLabs
    if (!sampleUrl && voice.previewUrl) {
      try {
        const response = await fetch(voice.previewUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const uploaded = await uploadVoiceSample(buffer, name.trim());
          sampleUrl = uploaded.url;
          sampleKey = uploaded.key;
        }
      } catch {
        // Non-critical — voice still works without sample
        console.warn('[Audio] Could not fetch ElevenLabs preview URL for sample');
      }
    }

    // Create CharacterVoice record
    const characterVoice = await prisma.characterVoice.create({
      data: {
        name: name.trim(),
        description: voiceDescription.trim(),
        voiceId: voice.voiceId,
        sampleUrl,
        sampleKey,
        character: character?.trim() || null,
        createdByEmail: userEmail,
      },
    });

    res.status(201).json(characterVoice);
  } catch (error) {
    console.error('[Audio] Save voice error:', error);
    res.status(500).json({ error: 'Failed to save voice. Please try again.' });
  }
});

// POST /api/audio/voices/clone — Clone a voice from uploaded audio
router.post('/voices/clone', designRateLimit, async (req: Request, res: Response) => {
  try {
    const { name, description, audioBase64, audioFilename, character } = req.body;

    // Validate required fields
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Voice name is required' });
    }
    if (!description?.trim()) {
      return res.status(400).json({ error: 'Voice description is required' });
    }
    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio file (base64) is required' });
    }
    if (!audioFilename) {
      return res.status(400).json({ error: 'Audio filename is required' });
    }

    // Decode base64 to Buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Determine mime type from filename extension
    const ext = audioFilename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
    };
    const contentType = mimeMap[ext || ''] || 'audio/mpeg';

    // Upload sample to S3
    const { url: sampleUrl, key: sampleKey } = await uploadVoiceSample(audioBuffer, name.trim());

    // Clone voice via ElevenLabs IVC
    const client = getElevenLabsClient();
    const ivcResult = await client.voices.ivc.create({
      name: name.trim(),
      description: description.trim(),
      files: [
        {
          data: audioBuffer,
          filename: audioFilename,
          contentType,
        },
      ],
    });

    const userEmail = (req as any).user?.email;

    // Create CharacterVoice record
    const characterVoice = await prisma.characterVoice.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        voiceId: ivcResult.voiceId,
        sampleUrl,
        sampleKey,
        character: character?.trim() || null,
        createdByEmail: userEmail,
      },
    });

    res.status(201).json(characterVoice);
  } catch (error) {
    console.error('[Audio] Clone voice error:', error);
    res.status(500).json({ error: 'Failed to clone voice. Please try again.' });
  }
});

// PATCH /api/audio/voices/:id — Update voice name/character
router.patch('/voices/:id', async (req: Request, res: Response) => {
  try {
    const { name, character } = req.body;

    const existing = await prisma.characterVoice.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Voice not found' });
    }

    const updated = await prisma.characterVoice.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(character !== undefined && { character: character?.trim() || null }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Audio] Update voice error:', error);
    res.status(500).json({ error: 'Failed to update voice' });
  }
});

// DELETE /api/audio/voices/:id — Delete voice (also deletes from ElevenLabs)
router.delete('/voices/:id', async (req: Request, res: Response) => {
  try {
    const voice = await prisma.characterVoice.findUnique({
      where: { id: req.params.id },
    });
    if (!voice) {
      return res.status(404).json({ error: 'Voice not found' });
    }

    // Delete from ElevenLabs if we have an external voice ID
    if (voice.voiceId) {
      try {
        const client = getElevenLabsClient();
        await client.voices.delete(voice.voiceId);
      } catch (err) {
        // Non-critical — continue with local deletion even if ElevenLabs fails
        console.warn('[Audio] Could not delete voice from ElevenLabs:', err);
      }
    }

    // Delete sample from S3 if exists
    if (voice.sampleKey) {
      try {
        await deleteFromS3(voice.sampleKey);
      } catch {
        console.warn('[Audio] Could not delete sample from S3');
      }
    }

    // Delete DB record (cascades to scripts and lines)
    await prisma.characterVoice.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Audio] Delete voice error:', error);
    res.status(500).json({ error: 'Failed to delete voice' });
  }
});

// =====================================================================
// TTS — Text-to-Speech
// =====================================================================

// POST /api/audio/tts — Generate speech from text using a saved voice
router.post('/tts', ttsRateLimit, async (req: Request, res: Response) => {
  try {
    const { voiceId, text } = req.body;

    if (!voiceId) {
      return res.status(400).json({ error: 'Voice ID is required' });
    }
    if (!text?.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (text.trim().length > 5000) {
      return res.status(400).json({ error: 'Text must be under 5000 characters' });
    }

    // Look up CharacterVoice by our DB id
    const voice = await prisma.characterVoice.findUnique({
      where: { id: voiceId },
    });
    if (!voice) {
      return res.status(404).json({ error: 'Voice not found' });
    }
    if (!voice.voiceId) {
      return res.status(400).json({ error: 'Voice has no ElevenLabs ID — it may not have been saved properly' });
    }

    const client = getElevenLabsClient();

    // Generate TTS via ElevenLabs
    const audioStream = await client.textToSpeech.convert(voice.voiceId, {
      text: text.trim(),
      modelId: config.elevenLabsModel,
      outputFormat: 'mp3_44100_128',
    });

    // Collect stream into buffer
    const audioBuffer = await streamToBuffer(audioStream);

    // Upload to S3
    const { url } = await uploadTtsAudio(audioBuffer, voice.name);

    res.json({ audioUrl: url, voiceName: voice.name });
  } catch (error) {
    console.error('[Audio] TTS error:', error);
    res.status(500).json({ error: 'Failed to generate speech. Please try again.' });
  }
});

// =====================================================================
// SCRIPTS — Script Management
// =====================================================================

// GET /api/audio/scripts — List all scripts with voice, lesson, and line stats
router.get('/scripts', async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const lessonId = req.query.lessonId as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { characterVoice: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (lessonId) {
      where.lessonId = lessonId;
    }

    const scripts = await prisma.audioScript.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        characterVoice: { select: { id: true, name: true, character: true } },
        lesson: {
          select: {
            id: true,
            lessonNumber: true,
            title: true,
            module: { select: { code: true, title: true } },
          },
        },
        _count: { select: { lines: true } },
        lines: { select: { status: true } },
      },
    });

    // Transform to include completion stats
    const result = scripts.map((s) => {
      const totalLines = s.lines.length;
      const completedLines = s.lines.filter((l) => l.status === 'COMPLETED').length;
      const { lines: _lines, ...rest } = s;
      return { ...rest, lineStats: { total: totalLines, completed: completedLines } };
    });

    res.json(result);
  } catch (error) {
    console.error('[Audio] List scripts error:', error);
    res.status(500).json({ error: 'Failed to load scripts' });
  }
});

// POST /api/audio/scripts — Create a script
router.post('/scripts', async (req: Request, res: Response) => {
  try {
    const { name, characterVoiceId, lessonId } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Script name is required' });
    }
    if (!characterVoiceId) {
      return res.status(400).json({ error: 'Character voice ID is required' });
    }

    // Verify voice exists
    const voice = await prisma.characterVoice.findUnique({
      where: { id: characterVoiceId },
    });
    if (!voice) {
      return res.status(404).json({ error: 'Character voice not found' });
    }

    const userEmail = (req as any).user?.email;

    const script = await prisma.audioScript.create({
      data: {
        name: name.trim(),
        characterVoiceId,
        lessonId: lessonId || null,
        createdByEmail: userEmail,
      },
      include: {
        lines: { orderBy: { sequence: 'asc' } },
        lesson: {
          select: {
            id: true,
            lessonNumber: true,
            title: true,
            module: { select: { code: true, title: true } },
          },
        },
      },
    });

    res.status(201).json(script);
  } catch (error) {
    console.error('[Audio] Create script error:', error);
    res.status(500).json({ error: 'Failed to create script' });
  }
});

// GET /api/audio/scripts/:id — Get script with lines
router.get('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const script = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
      include: {
        characterVoice: true,
        lines: { orderBy: { sequence: 'asc' } },
        lesson: {
          select: {
            id: true,
            lessonNumber: true,
            title: true,
            module: { select: { code: true, title: true } },
          },
        },
      },
    });

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    res.json(script);
  } catch (error) {
    console.error('[Audio] Get script error:', error);
    res.status(500).json({ error: 'Failed to load script' });
  }
});

// PATCH /api/audio/scripts/:id — Update script name
router.patch('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Script name is required' });
    }

    const existing = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const updated = await prisma.audioScript.update({
      where: { id: req.params.id },
      data: { name: name.trim() },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Audio] Update script error:', error);
    res.status(500).json({ error: 'Failed to update script' });
  }
});

// DELETE /api/audio/scripts/:id — Delete script and all associated audio
router.delete('/scripts/:id', async (req: Request, res: Response) => {
  try {
    const script = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
      include: { lines: true },
    });
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Delete all line audio from S3
    for (const line of script.lines) {
      if (line.audioKey) {
        try {
          await deleteFromS3(line.audioKey);
        } catch {
          console.warn(`[Audio] Could not delete line audio from S3: ${line.audioKey}`);
        }
      }
    }

    // Delete stitched audio from S3 if exists
    if (script.stitchedKey) {
      try {
        await deleteFromS3(script.stitchedKey);
      } catch {
        console.warn(`[Audio] Could not delete stitched audio from S3: ${script.stitchedKey}`);
      }
    }

    // Delete the script record (cascade deletes lines)
    await prisma.audioScript.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Audio] Delete script error:', error);
    res.status(500).json({ error: 'Failed to delete script' });
  }
});

// POST /api/audio/scripts/:id/stitch — Concatenate all completed line audio
router.post('/scripts/:id/stitch', ttsRateLimit, async (req: Request, res: Response) => {
  try {
    const script = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
      include: {
        lines: {
          where: { status: 'COMPLETED' },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const completedLines = script.lines.filter((l) => l.audioUrl);
    if (completedLines.length === 0) {
      return res.status(400).json({ error: 'No completed lines with audio to stitch' });
    }

    // Fetch all audio buffers from S3 URLs
    const audioBuffers: Buffer[] = [];
    for (const line of completedLines) {
      const response = await fetch(line.audioUrl!);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio for line ${line.sequence}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      audioBuffers.push(Buffer.from(arrayBuffer));
    }

    // Concatenate all audio buffers
    const stitchedBuffer = Buffer.concat(audioBuffers);

    // Delete old stitched audio from S3 if exists
    if (script.stitchedKey) {
      try {
        await deleteFromS3(script.stitchedKey);
      } catch {
        console.warn('[Audio] Could not delete old stitched audio from S3');
      }
    }

    // Upload stitched audio to S3
    const { url, key } = await uploadStitchedAudio(stitchedBuffer, script.id);

    // Sum up all line durations
    const totalDuration = completedLines.reduce((sum, l) => sum + (l.durationSecs || 0), 0);

    // Update script with stitched audio info
    const updated = await prisma.audioScript.update({
      where: { id: script.id },
      data: {
        stitchedUrl: url,
        stitchedKey: key,
        stitchedDurationSecs: Math.round(totalDuration * 10) / 10,
      },
      include: {
        characterVoice: true,
        lines: { orderBy: { sequence: 'asc' } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Audio] Stitch script error:', error);
    res.status(500).json({ error: 'Failed to stitch audio' });
  }
});

// POST /api/audio/scripts/:id/generate-all — Generate audio for all pending/failed lines
router.post('/scripts/:id/generate-all', ttsRateLimit, async (req: Request, res: Response) => {
  try {
    const script = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
      include: {
        lines: {
          where: { status: { in: ['PENDING', 'FAILED'] } },
          orderBy: { sequence: 'asc' },
        },
      },
    });
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    if (script.lines.length === 0) {
      return res.status(400).json({ error: 'No pending or failed lines to generate' });
    }

    // Generate sequentially to respect rate limits
    for (const line of script.lines) {
      try {
        await generateLineAudio(line.id);
      } catch (err) {
        // Log but continue with remaining lines
        console.error(`[Audio] generate-all: failed line ${line.id}:`, err);
      }
    }

    // Re-fetch the full script with all lines
    const updated = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
      include: {
        characterVoice: true,
        lines: { orderBy: { sequence: 'asc' } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Audio] Generate all error:', error);
    res.status(500).json({ error: 'Failed to generate audio for all lines' });
  }
});

// =====================================================================
// LINES — Script Line Management + Audio Generation
// =====================================================================

// POST /api/audio/scripts/:id/lines — Add a line to a script
router.post('/scripts/:id/lines', async (req: Request, res: Response) => {
  try {
    const { text, emotion } = req.body;

    if (!text?.trim()) {
      return res.status(400).json({ error: 'Line text is required' });
    }

    // Load script to get characterVoiceId and determine sequence
    const script = await prisma.audioScript.findUnique({
      where: { id: req.params.id },
      include: {
        lines: { orderBy: { sequence: 'desc' }, take: 1 },
      },
    });
    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    const nextSequence = (script.lines[0]?.sequence ?? -1) + 1;

    const line = await prisma.audioLine.create({
      data: {
        scriptId: req.params.id,
        characterVoiceId: script.characterVoiceId,
        text: text.trim(),
        emotion: emotion?.trim() || 'neutral',
        sequence: nextSequence,
        status: 'PENDING',
      },
    });

    res.status(201).json(line);
  } catch (error) {
    console.error('[Audio] Add line error:', error);
    res.status(500).json({ error: 'Failed to add line' });
  }
});

// POST /api/audio/lines/:id/generate — Generate audio for a single line
router.post('/lines/:id/generate', ttsRateLimit, async (req: Request, res: Response) => {
  try {
    const line = await prisma.audioLine.findUnique({
      where: { id: req.params.id },
    });
    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }

    const updated = await generateLineAudio(line.id);
    res.json(updated);
  } catch (error) {
    console.error('[Audio] Generate line error:', error);
    res.status(500).json({ error: 'Failed to generate audio for line' });
  }
});

// PATCH /api/audio/lines/:id/reorder — Reorder a line
router.patch('/lines/:id/reorder', async (req: Request, res: Response) => {
  try {
    const { sequence } = req.body;

    if (typeof sequence !== 'number') {
      return res.status(400).json({ error: 'Sequence number is required' });
    }

    const line = await prisma.audioLine.findUnique({
      where: { id: req.params.id },
    });
    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }

    const updated = await prisma.audioLine.update({
      where: { id: req.params.id },
      data: { sequence },
    });

    res.json(updated);
  } catch (error) {
    console.error('[Audio] Reorder line error:', error);
    res.status(500).json({ error: 'Failed to reorder line' });
  }
});

// DELETE /api/audio/lines/:id — Delete a line
router.delete('/lines/:id', async (req: Request, res: Response) => {
  try {
    const line = await prisma.audioLine.findUnique({
      where: { id: req.params.id },
    });
    if (!line) {
      return res.status(404).json({ error: 'Line not found' });
    }

    // Clean up S3 audio if exists
    if (line.audioKey) {
      try {
        await deleteFromS3(line.audioKey);
      } catch {
        console.warn('[Audio] Could not delete line audio from S3');
      }
    }

    await prisma.audioLine.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Audio] Delete line error:', error);
    res.status(500).json({ error: 'Failed to delete line' });
  }
});

export default router;
