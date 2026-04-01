import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when required env vars are missing', async () => {
    // Clear all required vars
    delete process.env.DATABASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.JWT_SECRET;

    const { validateConfig } = await import('../../src/lib/config.js');
    expect(() => validateConfig()).toThrow('Missing required environment variables');
  });

  it('does not throw when all required env vars are present', async () => {
    process.env.DATABASE_URL = 'postgresql://test';
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.JWT_SECRET = 'test-jwt-secret';

    const { validateConfig } = await import('../../src/lib/config.js');
    expect(() => validateConfig()).not.toThrow();
  });
});

describe('config defaults', () => {
  it('defaults port to 3001', async () => {
    delete process.env.PORT;
    vi.resetModules();
    const { config } = await import('../../src/lib/config.js');
    expect(config.port).toBe(3001);
  });

  it('defaults nodeEnv to development', async () => {
    delete process.env.NODE_ENV;
    vi.resetModules();
    const { config } = await import('../../src/lib/config.js');
    expect(config.nodeEnv).toBe('development');
  });

  it('defaults allowed email domains to acmecreative.com', async () => {
    delete process.env.ALLOWED_EMAIL_DOMAINS;
    vi.resetModules();
    const { config } = await import('../../src/lib/config.js');
    expect(config.allowedEmailDomains).toEqual(['acmecreative.com']);
  });
});
