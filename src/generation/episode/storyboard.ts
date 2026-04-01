import anthropic from '../../lib/anthropic.js';
import { prisma } from '../../lib/prisma.js';

interface StoryboardShot {
  sceneDescription: string;
  characters: string[];
  cameraAngle: string;
  narration: string;
  dialogueLines: Array<{ character: string; line: string; emotion: string }>;
  durationHint: number;
}

interface GeneratedStoryboard {
  shots: StoryboardShot[];
}

/**
 * Generate a storyboard from an episode's script.
 * Breaks script scenes into individual Shot rows in the database.
 */
export async function generateStoryboard(episodeId: string): Promise<void> {
  const episode = await prisma.episode.findUniqueOrThrow({
    where: { id: episodeId },
  });

  if (!episode.script) {
    throw new Error('Episode has no script — generate a script first');
  }

  // Update status
  await prisma.episode.update({
    where: { id: episodeId },
    data: { status: 'STORYBOARDING' },
  });

  try {
    const script = episode.script as Record<string, unknown>;
    const scenes = script.scenes as Array<Record<string, unknown>>;
    const isShort = episode.format === 'SHORT';

    const systemPrompt = `You are a storyboard artist for Acme Creative — a chess education brand for young children.

You will receive a video script with scenes and must break it into individual shots suitable for AI image + video generation.

FORMAT: ${isShort ? 'YouTube Short (vertical 9:16)' : 'YouTube Episode (horizontal 16:9)'}

RULES:
- Each shot should be a single visual moment (one camera setup, one action)
- ${isShort ? '5-8 shots total, each 4-10 seconds' : '15-25 shots total, each 4-12 seconds'}
- Camera angles: "wide", "medium", "close-up", "over-shoulder", "bird-eye", "low-angle"
- Scene descriptions must be detailed enough for AI image generation (describe exact visual elements, colors, lighting, character positions)
- Characters should be listed by their Acme Creative names
- Split long scenes into multiple shots with different camera angles for visual variety
- Include narration and dialogue per shot (a shot may have narration only, dialogue only, or both)

You must respond with ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "shots": [
    {
      "sceneDescription": "string — detailed visual description for AI image generation",
      "characters": ["string — character names visible in this shot"],
      "cameraAngle": "string — wide|medium|close-up|over-shoulder|bird-eye|low-angle",
      "narration": "string — narrator text for this shot (empty string if none)",
      "dialogueLines": [{ "character": "string", "line": "string", "emotion": "string" }],
      "durationHint": number (seconds)
    }
  ]
}`;

    const userPrompt = `Break this script into individual storyboard shots:

TITLE: ${script.title}
HOOK: ${script.hook}
TEACHING POINT: ${script.teachingPoint}

SCENES:
${scenes.map((scene, i) => {
  const dialogue = (scene.dialogue as Array<Record<string, string>>) || [];
  return `--- Scene ${i + 1} ---
Visual: ${scene.visualDescription}
Characters: ${(scene.characters as string[])?.join(', ') || 'none'}
Narration: ${scene.narration || '(none)'}
Dialogue:
${dialogue.map(d => `  ${d.character} (${d.emotion}): "${d.line}"`).join('\n') || '  (none)'}
Duration hint: ~${scene.durationHint}s`;
}).join('\n\n')}

Break these scenes into ${isShort ? '5-8' : '15-25'} individual shots with detailed visual descriptions.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const storyboard: GeneratedStoryboard = JSON.parse(jsonText);

    if (!storyboard.shots || storyboard.shots.length === 0) {
      throw new Error('Invalid storyboard: no shots generated');
    }

    // Delete existing shots (in case of regeneration)
    await prisma.shot.deleteMany({ where: { episodeId } });

    // Create Shot rows
    await prisma.shot.createMany({
      data: storyboard.shots.map((shot, index) => ({
        episodeId,
        orderIndex: index,
        sceneDescription: shot.sceneDescription,
        characters: shot.characters,
        cameraAngle: shot.cameraAngle,
        narration: shot.narration || null,
        dialogueLines: shot.dialogueLines.length > 0 ? shot.dialogueLines : undefined,
      })),
    });

    // Advance episode status to ART
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'ART' },
    });
  } catch (error) {
    // Revert to STORYBOARDING so user can retry (script is still intact)
    await prisma.episode.update({
      where: { id: episodeId },
      data: { status: 'STORYBOARDING' },
    });
    throw error;
  }
}
