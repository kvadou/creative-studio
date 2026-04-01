import anthropic from '../../lib/anthropic.js';
import { prisma } from '../../lib/prisma.js';

interface ScriptScene {
  narration: string;
  dialogue: Array<{ character: string; line: string; emotion: string }>;
  visualDescription: string;
  characters: string[];
  durationHint: number;
}

interface GeneratedScript {
  title: string;
  hook: string;
  teachingPoint: string;
  estimatedDuration: number;
  scenes: ScriptScene[];
}

/**
 * Generate a video script from curriculum chunks + character data.
 * Returns structured JSON script stored in Episode.script.
 */
export async function generateScript(episodeId: string): Promise<GeneratedScript> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
  });

  // Update status
  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: 'SCRIPTING' },
  });

  try {
    // 1. Pull curriculum chunks for this lesson
    const lesson = await prisma.lesson.findFirst({
      where: {
        module: { code: episode.moduleCode },
        lessonNumber: episode.lessonNumber,
      },
      include: {
        module: true,
        chunks: { orderBy: { sequence: 'asc' } },
        characters: { include: { character: true } },
      },
    });

    if (!lesson) {
      throw new Error(`Lesson not found: ${episode.moduleCode} L${episode.lessonNumber}`);
    }

    // 2. Build curriculum context from chunks
    const chunkTexts = lesson.chunks.map(c =>
      `[${c.chunkType}] ${c.sectionTitle || ''}\n${c.content}`
    ).join('\n\n---\n\n');

    // Store chunk IDs on the episode
    const chunkIds = lesson.chunks.map(c => c.id);

    // 3. Build character context
    const characterContext = lesson.characters.map(lc => {
      const c = lc.character;
      const parts = [c.name];
      if (c.piece) parts.push(`(${c.piece})`);
      if (c.trait) parts.push(`— ${c.trait}`);
      if (c.movementNote) parts.push(`Movement: ${c.movementNote}`);
      return `  - ${parts.join(' ')}`;
    }).join('\n');

    // 4. Determine age band from module code
    const ageBand = lesson.module.ageGroup || 'general';

    // 5. Format-specific prompt
    const isShort = episode.format === 'SHORT';
    const formatGuidance = isShort
      ? `FORMAT: YouTube Short (45-60 seconds, 5-8 scenes max)
RULES:
- Open with a hook in the first 3 seconds (question or dramatic moment)
- One clear teaching point per Short
- End with a call-to-action ("Can YOU find where the King should move?")
- Keep each scene 5-10 seconds
- Maximum 8 scenes total`
      : `FORMAT: YouTube Episode (3-5 minutes, 15-25 scenes)
RULES:
- Full story arc: setup → conflict → teaching moment → resolution
- Multiple teaching points woven into the narrative
- Include at least one moment where the viewer is asked a question
- End with a preview tease for the next episode
- Keep each scene 8-15 seconds`;

    const systemPrompt = `You are a children's video scriptwriter for Acme Creative — a chess education brand for young children.

${formatGuidance}

TARGET AGE: ${ageBand}

WRITING STYLE:
- Warm, playful, age-appropriate language
- Use character dialogue to make lessons memorable
- Use simple vocabulary for young children
- Include stage directions for visual scenes
- Characters should have distinct personalities matching their traits

You must respond with ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "title": "string — episode title",
  "hook": "string — the opening hook line",
  "teachingPoint": "string — the main chess concept taught",
  "estimatedDuration": number (seconds),
  "scenes": [
    {
      "narration": "string — narrator's lines for this scene",
      "dialogue": [{ "character": "string", "line": "string", "emotion": "string" }],
      "visualDescription": "string — what should be shown visually",
      "characters": ["string — character names in this scene"],
      "durationHint": number (seconds)
    }
  ]
}`;

    const userPrompt = `Generate a ${isShort ? 'YouTube Short' : 'YouTube Episode'} script for this lesson:

MODULE: ${lesson.module.code} — ${lesson.module.title}
LESSON ${lesson.lessonNumber}: ${lesson.title}

CURRICULUM CONTENT:
${chunkTexts}

AVAILABLE CHARACTERS:
${characterContext || '(No specific characters for this lesson — use King Shaky as default protagonist)'}

Generate a compelling script that teaches the chess concept through a fun Chesslandia story.`;

    // 6. Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content
    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON — strip markdown fences if present
    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const script: GeneratedScript = JSON.parse(jsonText);

    // 7. Validate basic structure
    if (!script.title || !script.scenes || script.scenes.length === 0) {
      throw new Error('Invalid script structure: missing title or scenes');
    }

    // 8. Save to episode
    await prisma.episode.update({
      where: { id: episodeId },
      data: {
        title: script.title,
        script: JSON.parse(JSON.stringify(script)),
        chunkIds,
        status: 'STORYBOARDING', // Ready for next stage
      },
    });

    return script;
  } catch (error) {
    // Mark as failed, revert to DRAFT
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'DRAFT' },
    });
    throw error;
  }
}
