import 'dotenv/config';

export const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // API Keys
  openaiApiKey: process.env.OPENAI_API_KEY!,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,

  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Auth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/callback',
  jwtSecret: process.env.JWT_SECRET!,
  allowedEmailDomains: process.env.ALLOWED_EMAIL_DOMAINS
    ? process.env.ALLOWED_EMAIL_DOMAINS.split(',').map((d) => d.trim()).filter(Boolean)
    : [], // Empty = allow any domain (portfolio demo mode)
  adminEmails: (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean),

  // Retrieval settings
  similarityThreshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.4'),
  maxChunksPerQuery: parseInt(process.env.MAX_CHUNKS_PER_QUERY || '8', 10),

  // Embedding settings
  embeddingModel: 'gemini-embedding-2-preview',
  embeddingDimensions: 768,

  // Generation settings
  generationModel: 'claude-sonnet-4-20250514',
  maxGenerationTokens: 1024,

  // External APIs
  lichessApiToken: process.env.LICHESS_API_TOKEN || '',

  // S3 (Studio Assets)
  s3BucketName: process.env.S3_BUCKET_NAME || 'creative-studio-assets',
  s3Region: process.env.S3_REGION || 'us-east-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',

  // Replicate (Flux LoRA)
  replicateApiToken: process.env.REPLICATE_API_TOKEN || '',
  fluxModelVersion: process.env.FLUX_MODEL_VERSION || '',

  // Gemini (Character Art)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-image-preview',
  veoModel: process.env.VEO_MODEL || 'veo-3.1-generate-preview',

  // ElevenLabs (Character Voices)
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenLabsModel: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_ttv_v2',
} as const;

// Validate required config
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  // GOOGLE_CLIENT_ID/SECRET optional — auth features degrade gracefully
  // OPENAI_API_KEY and ANTHROPIC_API_KEY optional — AI features gracefully degrade
];

export function validateConfig(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function validateIllustrationsConfig(): void {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'REPLICATE_API_TOKEN'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Illustrations module requires: ${missing.join(', ')}`);
  }
}

export function validateCharacterArtConfig(): void {
  const required = ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'GEMINI_API_KEY'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Character art module requires: ${missing.join(', ')}`);
  }
}

export function validateAudioConfig(): void {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('Audio module requires: ELEVENLABS_API_KEY');
  }
}
