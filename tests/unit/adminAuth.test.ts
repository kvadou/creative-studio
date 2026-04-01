import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock config before importing the module
vi.mock('../../src/lib/config.js', () => ({
  config: {
    adminEmails: ['admin@acmecreative.com', 'doug@acmecreative.com'],
  },
}));

import { requireAdmin, isAdmin } from '../../src/server/middleware/adminAuth.js';

function mockReq(user?: { email: string; id: string; name: string }): Partial<Request> {
  return { user: user as any };
}

function mockRes(): Partial<Response> & { statusCode: number; body: any } {
  const res = {
    statusCode: 200,
    body: null as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res as any;
}

describe('requireAdmin', () => {
  it('returns 401 when no user is present', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user is not an admin', () => {
    const req = mockReq({ id: '1', email: 'user@acmecreative.com', name: 'User' });
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Admin access required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user is an admin', () => {
    const req = mockReq({ id: '1', email: 'admin@acmecreative.com', name: 'Admin' });
    const res = mockRes();
    const next = vi.fn();

    requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200); // unchanged
  });
});

describe('isAdmin', () => {
  it('returns true for admin emails', () => {
    expect(isAdmin('admin@acmecreative.com')).toBe(true);
    expect(isAdmin('doug@acmecreative.com')).toBe(true);
  });

  it('returns false for non-admin emails', () => {
    expect(isAdmin('user@acmecreative.com')).toBe(false);
    expect(isAdmin('random@gmail.com')).toBe(false);
  });
});
