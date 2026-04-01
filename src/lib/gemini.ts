import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    if (!config.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured. Set GEMINI_API_KEY env var.');
    }
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}
