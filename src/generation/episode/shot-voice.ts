import { getElevenLabsClient } from '../../lib/elevenlabs.js';
import { config } from '../../lib/config.js';
import { prisma } from '../../lib/prisma.js';
import { uploadToS3 } from '../../lib/s3.js';
import crypto from 'crypto';

// ── Emotion-aware voice settings ─────────────────────────────────────

const emotionVoiceSettings: Record<string, { stability: number; similarityBoost: number; style: number }> = {
  neutral:  { stability: 0.5, similarityBoost: 0.75, style: 0.0 },
  excited:  { stability: 0.3, similarityBoost: 0.75, style: 0.7 },
  dramatic: { stability: 0.4, similarityBoost: 0.8,  style: 0.8 },
  gentle:   { stability: 0.7, similarityBoost: 0.8,  style: 0.3 },
  teaching: { stability: 0.6, similarityBoost: 0.75, style: 0.4 },
};

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

// ── Types ────────────────────────────────────────────────────────────

interface DialogueLine {
  character: string;
  line: string;
  emotion: string;
}

interface CharacterVoiceRecord {
  id: string;
  name: string;
  voiceId: string | null;
  character: string | null;
}

// ── Main: generate voice audio for all shots in an episode ───────────

export async function processShotVoice(episodeId: string): Promise<void> {
  // 1. Fetch episode with all shots
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: {
      shots: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!episode) throw new Error(`Episode not found: ${episodeId}`);

  // 2. Load all character voices
  const allVoices = await prisma.characterVoice.findMany({
    select: { id: true, name: true, voiceId: true, character: true },
  });

  // Filter to voices that have an ElevenLabs voiceId
  const usableVoices = allVoices.filter((v): v is CharacterVoiceRecord & { voiceId: string } => !!v.voiceId);

  if (usableVoices.length === 0) {
    throw new Error('No character voices with ElevenLabs IDs — create and save at least one voice before generating audio');
  }

  // 3. Find narrator voice
  const narratorVoice = findNarratorVoice(usableVoices);

  const client = getElevenLabsClient();

  // 4. Process each pending shot sequentially
  for (const shot of episode.shots) {
    if (shot.audioStatus !== 'PENDING') continue;

    // 4a. Mark as generating
    await prisma.shot.update({
      where: { id: shot.id },
      data: { audioStatus: 'ASSET_GENERATING' },
    });

    try {
      const audioSegments: Buffer[] = [];

      // 4b. Collect audio segments
      // Narration first
      if (shot.narration) {
        const voiceSettings = emotionVoiceSettings.teaching;
        const audioStream = await client.textToSpeech.convert(narratorVoice.voiceId!, {
          text: shot.narration,
          modelId: config.elevenLabsModel,
          outputFormat: 'mp3_44100_128',
          voiceSettings,
        });
        audioSegments.push(await streamToBuffer(audioStream));
      }

      // Dialogue lines
      if (shot.dialogueLines) {
        const lines = shot.dialogueLines as unknown as DialogueLine[];
        for (const dl of lines) {
          const voice = findCharacterVoice(usableVoices, dl.character) ?? narratorVoice;
          const voiceSettings = emotionVoiceSettings[dl.emotion] ?? emotionVoiceSettings.neutral;

          const audioStream = await client.textToSpeech.convert(voice.voiceId!, {
            text: dl.line,
            modelId: config.elevenLabsModel,
            outputFormat: 'mp3_44100_128',
            voiceSettings,
          });
          audioSegments.push(await streamToBuffer(audioStream));
        }
      }

      if (audioSegments.length === 0) {
        // No narration or dialogue — mark complete with no audio
        await prisma.shot.update({
          where: { id: shot.id },
          data: { audioStatus: 'COMPLETE' },
        });
        continue;
      }

      // 4c. Concatenate raw mp3 buffers
      const combinedBuffer = Buffer.concat(audioSegments);

      // 4d. Upload to S3
      const uid = crypto.randomUUID();
      const s3Key = `episodes/${episodeId}/shots/shot-${shot.orderIndex}-audio-${uid}.mp3`;
      const audioUrl = await uploadToS3(combinedBuffer, s3Key, 'audio/mpeg');

      // 4e. Estimate duration (mp3 at 128kbps)
      const audioDuration = Math.round(((combinedBuffer.length * 8) / (128 * 1000)) * 10) / 10;

      // 4f. Update shot
      await prisma.shot.update({
        where: { id: shot.id },
        data: {
          audioUrl,
          audioKey: s3Key,
          audioStatus: 'COMPLETE',
          audioDuration,
        },
      });

      console.log(`[ShotVoice] Shot ${shot.orderIndex} complete — ${audioDuration}s`);
    } catch (err) {
      // 4g. On error: mark failed, log, continue
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[ShotVoice] Shot ${shot.orderIndex} failed:`, errorMsg);

      await prisma.shot.update({
        where: { id: shot.id },
        data: { audioStatus: 'ASSET_FAILED' },
      });
    }
  }

  // 5. If all shots complete, advance episode to VIDEO
  const updatedShots = await prisma.shot.findMany({
    where: { episodeId },
    select: { audioStatus: true },
  });

  const allComplete = updatedShots.every((s) => s.audioStatus === 'COMPLETE');
  if (allComplete) {
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'VIDEO' },
    });
    console.log(`[ShotVoice] All shots complete — episode ${episodeId} advanced to VIDEO`);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function findNarratorVoice(voices: CharacterVoiceRecord[]): CharacterVoiceRecord {
  // Match by character field first (case-insensitive)
  const byCharacter = voices.find(
    (v) => v.character && v.character.toLowerCase() === 'narrator'
  );
  if (byCharacter) return byCharacter;

  // Match by name containing "narrator"
  const byName = voices.find(
    (v) => v.name.toLowerCase().includes('narrator')
  );
  if (byName) return byName;

  // Fallback to first available voice
  return voices[0];
}

function findCharacterVoice(
  voices: CharacterVoiceRecord[],
  characterName: string
): CharacterVoiceRecord | undefined {
  const lower = characterName.toLowerCase();

  // Exact match on character field
  const byCharacter = voices.find(
    (v) => v.character && v.character.toLowerCase() === lower
  );
  if (byCharacter) return byCharacter;

  // Exact match on name field
  const byName = voices.find(
    (v) => v.name.toLowerCase() === lower
  );
  if (byName) return byName;

  // Partial match on either field
  return voices.find(
    (v) =>
      (v.character && v.character.toLowerCase().includes(lower)) ||
      v.name.toLowerCase().includes(lower)
  );
}
