import { describe, it, expect } from 'vitest';
import { isTransientError } from '../../src/generation/curriculum/processor.js';

describe('isTransientError', () => {
  it('returns true for overloaded API errors', () => {
    expect(isTransientError(new Error('API is overloaded'))).toBe(true);
  });

  it('returns true for rate limit errors', () => {
    expect(isTransientError(new Error('Rate limit exceeded'))).toBe(true);
  });

  it('returns true for timeout errors', () => {
    expect(isTransientError(new Error('Request timeout after 30s'))).toBe(true);
  });

  it('returns true for connection reset errors', () => {
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
  });

  it('returns true for 529 status errors', () => {
    expect(isTransientError(new Error('HTTP 529: Service Unavailable'))).toBe(true);
  });

  it('returns true for 503 status errors', () => {
    expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('returns false for permanent errors', () => {
    expect(isTransientError(new Error('Invalid API key'))).toBe(false);
  });

  it('returns false for validation errors', () => {
    expect(isTransientError(new Error('Missing required field: ageBand'))).toBe(false);
  });

  it('returns false for non-Error objects', () => {
    expect(isTransientError('some string')).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(42)).toBe(false);
  });
});
