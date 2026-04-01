import anthropic, { anthropicMockGuard } from '../../lib/anthropic.js';
import { prisma } from '../../lib/prisma.js';

const CARTOON_SYSTEM_PROMPT = `You are the Acme Creative illustration assistant. You help refine AI-generated character illustrations to match the Acme Creative house style.

THE Acme Creative STYLE:
- Simple cartoon characters with bold black outlines
- Flat colors (no shading, no gradients, no realistic lighting)
- Full body standing poses on transparent/white background
- Simplified proportions: slightly large heads, simple hands
- Clean vector-style lines, like a children's book or Bitmoji
- Friendly, approachable expressions
- Clothing is simple with flat colors and minimal detail

YOUR ROLE:
When the user describes changes they want, respond conversationally (1-3 sentences) and include a GENERATION block with the refined Flux prompt and parameters.

ALWAYS include this block at the end of your response:

<generation>
{
  "prompt": "Acme CreativeSTYLE [your refined prompt here]",
  "loraScale": [0.6-1.2],
  "guidanceScale": [2.0-8.0]
}
</generation>

PARAMETER GUIDE:
- loraScale: Higher (1.0-1.2) = more cartoony/stylized. Lower (0.6-0.8) = more realistic detail.
- guidanceScale: Lower (2-4) = more creative/loose. Higher (5-8) = more prompt-adherent.
- Always start prompts with "Acme CreativeSTYLE" trigger word.

For MORE cartoony: high loraScale (1.0-1.2), lower guidance (2-4), emphasize "simple", "flat colors", "bold outlines", "no shading"
For MORE realistic: lower loraScale (0.6-0.8), higher guidance (5-7), can mention some detail
For BALANCED: loraScale 0.85-0.95, guidance 3.5-5

Keep responses brief and focused. You're a collaborative creative partner, not a lecturer.`;

const CHARACTER_SYSTEM_PROMPT = `You are the Acme Creative character art director. You help refine AI-generated character art using the Gemini image generation model.

CREATIVE WORLD:
- Chesslandia is the magical kingdom where chess pieces live
- The landscape features checkered grass lawns, castle towers, and whimsical chess-themed architecture
- Characters are the chess pieces personified: Kings, Queens, Bishops, Knights, Rooks, and Pawns
- Each piece has a distinct personality (e.g., Pawns are kids, Knights are adventurous, Bishops are wise)
- The art style should match children's book illustration quality — vibrant, colorful, detailed but approachable

YOUR ROLE:
When the user describes changes they want, respond conversationally (1-3 sentences) and include a GENERATION block with the refined prompt for Gemini.

ALWAYS include this block at the end of your response:

<generation>
{
  "prompt": "[your refined prompt here — be detailed and descriptive]"
}
</generation>

PROMPT TIPS FOR GEMINI:
- Be very descriptive about the scene, characters, poses, expressions, lighting, and background
- Mention art style explicitly (e.g., "children's book illustration", "colorful cartoon", "watercolor style")
- Include details about the Chesslandia setting if the user mentions it
- Reference specific chess piece characters by name when relevant
- Describe colors, mood, and composition clearly
- If reference images were provided, mention "matching the style of the reference images"

Keep responses brief and focused. You're a collaborative creative partner, not a lecturer.`;

interface ChatResult {
  response: string;
  generation?: {
    prompt: string;
    loraScale?: number;
    guidanceScale?: number;
  };
}

export async function illustrationChat(
  illustrationId: string,
  userMessage: string
): Promise<ChatResult> {
  // Get illustration context
  const illustration = await prisma.illustration.findUnique({
    where: { id: illustrationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, take: 20 },
      generations: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!illustration) {
    throw new Error('Illustration not found');
  }

  // Save user message
  await prisma.illustrationMessage.create({
    data: {
      illustrationId,
      role: 'user',
      content: userMessage,
    },
  });

  // Build conversation history for Claude
  const messages = illustration.messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // Add current message
  messages.push({ role: 'user', content: userMessage });

  // Add context about the character
  const contextNote = `[Context: Character name is "${illustration.name}". ${
    illustration.generations.length > 0
      ? `Last generation used prompt: "${illustration.generations[0].prompt || 'default'}"`
      : 'No generations yet.'
  }]`;

  // Prepend context to first user message
  if (messages.length === 1) {
    messages[0].content = `${contextNote}\n\n${messages[0].content}`;
  }

  const systemPrompt = illustration.artType === 'CHARACTER'
    ? CHARACTER_SYSTEM_PROMPT
    : CARTOON_SYSTEM_PROMPT;

  // Stub guard: return mock when no API key
  const mock = anthropicMockGuard();
  if (mock) {
    const mockText = 'Illustration chat requires an Anthropic API key. Set ANTHROPIC_API_KEY in your .env.';
    await prisma.illustrationMessage.create({
      data: { illustrationId, role: 'assistant', content: mockText },
    });
    return { response: mockText };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages,
  });

  const assistantText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { type: 'text'; text: string }).text)
    .join('');

  // Parse generation block
  let generation: ChatResult['generation'] | undefined;
  const genMatch = assistantText.match(/<generation>\s*([\s\S]*?)\s*<\/generation>/);
  if (genMatch) {
    try {
      generation = JSON.parse(genMatch[1]);
    } catch {
      // If parsing fails, skip generation params
    }
  }

  // Clean response text (remove the generation block)
  const cleanResponse = assistantText.replace(/<generation>[\s\S]*?<\/generation>/, '').trim();

  // Save assistant message
  await prisma.illustrationMessage.create({
    data: {
      illustrationId,
      role: 'assistant',
      content: cleanResponse,
      metadata: generation ? generation : undefined,
    },
  });

  return {
    response: cleanResponse,
    generation,
  };
}
