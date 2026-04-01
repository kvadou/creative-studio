import { getGeminiClient } from '../../lib/gemini.js';

export interface GenerationReview {
  description: string;
  characters: Array<{ name: string; isChesslandia: boolean; notes: string }>;
  styleCompliance: { score: number; notes: string };
  promptAlignment: { matched: string[]; missed: string[]; unexpected: string[] };
}

const REVIEW_PROMPT = `You are reviewing an AI-generated illustration for Acme Creative, a children's chess education brand.

Analyze this image and return a JSON object with exactly this structure:
{
  "description": "2-3 sentence description of what you see in the image",
  "characters": [
    { "name": "Character Name", "isChesslandia": true/false, "notes": "Brief note about depiction" }
  ],
  "styleCompliance": {
    "score": 1-10,
    "notes": "Brief assessment of art style compliance"
  },
  "promptAlignment": {
    "matched": ["elements from the prompt that appear in the image"],
    "missed": ["elements from the prompt missing from the image"],
    "unexpected": ["elements in the image not mentioned in the prompt"]
  }
}

IMPORTANT CONTEXT:
- Chesslandia characters are cartoon animals or anthropomorphized chess pieces (NOT realistic humans)
- The art style should have bold outlines, flat vibrant colors, cartoon proportions, storybook feel
- Compare the image against the prompt and character roster below

PROMPT USED:
{PROMPT}

CHARACTER ROSTER:
{ROSTER}

Return ONLY the JSON object, no markdown fences or extra text.`;

/**
 * Sends the generated image to Gemini Flash for structured review.
 * Analyzes character accuracy, style compliance, and prompt alignment.
 * Cost: ~$0.001 per call.
 */
export async function reviewGeneratedImage(
  imageBuffer: Buffer,
  prompt: string,
  characterRoster: string
): Promise<GenerationReview> {
  const ai = getGeminiClient();

  const reviewPrompt = REVIEW_PROMPT
    .replace('{PROMPT}', prompt)
    .replace('{ROSTER}', characterRoster);

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: reviewPrompt },
          {
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: 'image/png',
            },
          },
        ],
      },
    ],
  });

  const text = response.text?.trim() || '';

  try {
    // Strip markdown fences if Gemini wraps the JSON
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned) as GenerationReview;

    // Validate required fields with defaults
    return {
      description: parsed.description || '',
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      styleCompliance: {
        score: parsed.styleCompliance?.score ?? 0,
        notes: parsed.styleCompliance?.notes || '',
      },
      promptAlignment: {
        matched: Array.isArray(parsed.promptAlignment?.matched) ? parsed.promptAlignment.matched : [],
        missed: Array.isArray(parsed.promptAlignment?.missed) ? parsed.promptAlignment.missed : [],
        unexpected: Array.isArray(parsed.promptAlignment?.unexpected) ? parsed.promptAlignment.unexpected : [],
      },
    };
  } catch {
    console.warn('[ReviewImage] Failed to parse Gemini response as JSON, returning raw text as description');
    return {
      description: text.slice(0, 500),
      characters: [],
      styleCompliance: { score: 0, notes: 'Review parse failed' },
      promptAlignment: { matched: [], missed: [], unexpected: [] },
    };
  }
}
