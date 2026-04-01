import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock JWT module
const mockVerifyToken = vi.fn();
vi.mock('../../src/server/auth/jwt.js', () => ({
  verifyToken: (...args: any[]) => mockVerifyToken(...args),
  COOKIE_NAME: 'cs_auth',
}));

import { authMiddleware } from '../../src/server/middleware/auth.js';

function mockReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    path: '/api/test',
    cookies: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {
    statusCode: 200,
    body: null,
    redirectUrl: null,
    clearedCookies: [] as string[],
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
    redirect(url: string) { res.redirectUrl = url; return res; },
    clearCookie(name: string, _opts: any) { res.clearedCookies.push(name); return res; },
  };
  return res;
}

beforeEach(() => {
  mockVerifyToken.mockReset();
});

describe('authMiddleware', () => {
  it('allows public routes without auth', () => {
    const req = mockReq({ path: '/api/health' });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('allows auth callback route', () => {
    const req = mockReq({ path: '/api/auth/callback' });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('allows static assets', () => {
    const req = mockReq({ path: '/assets/logo.png' });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 401 for API requests with no token', () => {
    const req = mockReq({ path: '/api/chat', cookies: {} });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects page requests with no token to signin', () => {
    const req = mockReq({ path: '/dashboard', cookies: {} });
    const res = mockRes();
    const next = vi.fn();

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(res.redirectUrl).toBe('/auth/signin');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for API requests with invalid token', () => {
    const req = mockReq({
      path: '/api/chat',
      cookies: { cs_auth: 'invalid-token' },
    });
    const res = mockRes();
    const next = vi.fn();
    mockVerifyToken.mockReturnValue(null);

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
    expect(res.clearedCookies).toContain('cs_auth');
  });

  it('attaches user and calls next for valid token', () => {
    const user = { id: '1', email: 'user@acmecreative.com', name: 'User' };
    const req = mockReq({
      path: '/api/chat',
      cookies: { cs_auth: 'valid-token' },
    });
    const res = mockRes();
    const next = vi.fn();
    mockVerifyToken.mockReturnValue(user);

    authMiddleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toEqual(user);
  });
});
