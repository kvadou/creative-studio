import { anthropic } from '../../lib/anthropic.js';
import type {
  ScriptPersona,
  ScriptFormat,
  MarketingInsight,
} from '@prisma/client';

const PERSONA_CONFIGS: Record<ScriptPersona, { name: string; situation: string; emotion: string }> = {
  CONVERTED_PARENT: {
    name: 'The Converted Parent',
    situation: 'My child was struggling with focus/school and I tried chess tutoring almost as a last resort',
    emotion: 'Quiet pride, slight disbelief at how well it worked, wants other parents to know',
  },
  SKEPTICAL_PARENT: {
    name: 'The Skeptical Parent',
    situation: 'I thought chess was just a board game, not something that would help with real life',
    emotion: 'Self-deprecating humor about being wrong, genuine surprise at results',
  },
  COMPARISON_PARENT: {
    name: 'The Comparison Parent',
    situation: 'We tried other tutoring, apps, programs — chess tutoring was what finally clicked',
    emotion: 'Relief that the search is over, understated confidence in the recommendation',
  },
};

const FORMAT_CONFIGS: Record<ScriptFormat, { name: string; structure: string; durationTarget: number }> = {
  HOOK_PROBLEM_PROOF_CTA: {
    name: 'Hook / Problem / Proof / CTA',
    structure: 'HOOK (3s) → problem your child had → specific proof/result → what you did → CTA',
    durationTarget: 65,
  },
  BEFORE_AFTER: {
    name: 'Before / After',
    structure: 'HOOK (3s) → "before chess tutoring: [behavior]" → "after chess tutoring: [behavior]" → CTA',
    durationTarget: 50,
  },
  STORY_ARC: {
    name: 'Story Arc',
    structure: 'HOOK (3s) → set the scene → turning point (first chess lesson) → outcome → CTA',
    durationTarget: 75,
  },
};

const SCRIPT_SYSTEM_PROMPT = `You are a TikTok UGC script writer for Acme Creative, a chess tutoring company for kids ages 5-14.

You write scripts that will be filmed by real TikTok moms — NOT professional actors. The voice must be 100% authentic, unpolished, real.
No marketing speak. No corporate jargon. Write like a real person texting.

Acme Creative key facts:
- One-on-one chess tutoring for kids 5-14
- Certified tutors, structured curriculum
- Research-backed: chess proven to improve focus, math, critical thinking, executive function
- Sessions are online (Zoom), 30-45 minutes
- Pricing: ~$35-50/session (varies by market)
- Book a free intro session at acmecreative.com
- Available across US (multiple cities) + Singapore/Hong Kong

Writing rules:
1. Hook must be the FIRST thing out of their mouth. No intro. No "Hey guys." Start mid-thought.
2. Hook must stop the scroll. It should make a parent think "wait, that's my kid."
3. Speak in the voice of a real mom texting her friend. Not a testimonial.
4. Specific > generic. "He started asking to do homework" beats "his grades improved."
5. CTA is always soft: "We started with a free intro session at acmecreative.com" or similar. Never pushy.
6. Filming direction: brief, specific. What setting, what vibe, what to show.
7. Total spoken word count must match the duration target (approximately 2.5 words/second).
8. HOOK FRAMING: Use "you/your" framing, NOT "I/my." Instead of "My kid hated homework" write "If your kid hates homework, you need to hear this." Exception: Story Arc format can use first-person since it's a narrative.
9. VALUE WITHOUT CTA: The video must provide genuine value even if the CTA was removed entirely. The product mention should feel like an afterthought, not the point.
10. SAVES OPTIMIZATION: Structure content so viewers want to SAVE it for later — include a specific actionable tip, framework, or 'aha moment' they'll want to reference again.
11. TEXT OVERLAY: Include a bold text overlay suggestion for the first 3 seconds that reinforces the verbal hook visually. Place keywords in the text overlay for TikTok SEO.
12. NEVER: Open with the product name. Use urgency language ('limited time', 'don't miss out'). Address children directly — always speak parent-to-parent.
13. ANTI-AI VOICE: Never use m-dashes, corporate jargon, "game-changing", "life-changing", or exclamation point clusters. Write like a real person texting.`;

export async function generateScript(
  persona: ScriptPersona,
  format: ScriptFormat,
  insights: Pick<MarketingInsight, 'hookTheme' | 'audienceSignal' | 'messagingAngle' | 'proofPoints' | 'avoidPatterns'>[]
): Promise<{
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  textOverlaySuggestion: string;
  settingSuggestion: string;
  propsSuggestion: string;
  toneSuggestion: string;
  durationTarget: number;
}> {
  const personaConfig = PERSONA_CONFIGS[persona];
  const formatConfig = FORMAT_CONFIGS[format];

  const topInsights = insights.slice(0, 3);
  const avoidPatterns = insights.flatMap(i => i.avoidPatterns).slice(0, 5);

  const prompt = `Generate a TikTok UGC script for the following:

**Persona:** ${personaConfig.name}
Parent situation: ${personaConfig.situation}
Emotional register: ${personaConfig.emotion}

**Format:** ${formatConfig.name}
Structure: ${formatConfig.structure}
Duration target: ${formatConfig.durationTarget} seconds (~${Math.round(formatConfig.durationTarget * 2.5)} words spoken)

**Intelligence from our top-converting paid ads (use these angles — they drove real clients):**
${topInsights.map((ins, i) => `
${i + 1}. Hook theme: ${ins.hookTheme}
   Audience: ${ins.audienceSignal}
   Angle: ${ins.messagingAngle}
   Proof points: ${ins.proofPoints.join(', ')}
`).join('')}

${avoidPatterns.length > 0 ? `**Do NOT use these angles (from low-performing campaigns):**
${avoidPatterns.map(p => `- ${p}`).join('\n')}` : ''}

Return ONLY valid JSON with this structure:
{
  "hook": "First 3 seconds of the script — spoken words only",
  "body": "Rest of the script — spoken words only, no stage directions",
  "cta": "Closing call to action line",
  "hashtags": ["exactly 4 hashtags: 1 broad parenting tag, 2 niche tags for this specific angle, 1 content-format tag. Never use #fyp or #viral."],
  "textOverlaySuggestion": "Bold text for first 3 seconds that reinforces the hook visually — include keywords for TikTok SEO",
  "settingSuggestion": "One sentence on ideal filming location/setup",
  "propsSuggestion": "One sentence on any props or visual elements",
  "toneSuggestion": "One sentence on delivery style/energy",
  "durationTarget": ${formatConfig.durationTarget}
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SCRIPT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  let rawContent = response.content[0].type === 'text' ? response.content[0].text : '{}';
  // Strip markdown code fences if Claude wraps the JSON
  rawContent = rawContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return JSON.parse(rawContent);
}

export { PERSONA_CONFIGS, FORMAT_CONFIGS };
