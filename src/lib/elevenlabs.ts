import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from './config.js';

let client: ElevenLabsClient | null = null;

export function getElevenLabsClient(): ElevenLabsClient {
  if (!client) {
    if (!config.elevenLabsApiKey) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
    client = new ElevenLabsClient({ apiKey: config.elevenLabsApiKey });
  }
  return client;
}
