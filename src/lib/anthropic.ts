import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

// Stub: when no API key is configured, provide a mock client
// that returns canned responses so the app remains runnable.
const hasKey = !!process.env.ANTHROPIC_API_KEY;

export const anthropic = hasKey
  ? new Anthropic({ apiKey: config.anthropicApiKey })
  : (null as unknown as Anthropic);

/**
 * Guard helper -- call before any real Anthropic usage.
 * Returns a mock Anthropic Messages response when no key is set.
 */
export function anthropicMockGuard(): Anthropic.Messages.Message | null {
  if (hasKey) return null; // key present, use real API
  return {
    id: 'mock',
    type: 'message',
    role: 'assistant',
    model: 'mock',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
    content: [
      {
        type: 'text',
        text: 'This feature requires an Anthropic API key. Set ANTHROPIC_API_KEY in your .env to enable AI generation.',
      },
    ],
  } as Anthropic.Messages.Message;
}

export default anthropic;
