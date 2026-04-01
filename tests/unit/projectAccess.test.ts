import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Prisma
const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    project: {
      findFirst: (...args: any[]) => mockFindFirst(...args),
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
  },
}));

import { hasProjectAccess, isProjectOwner, getProjectRole } from '../../src/server/middleware/projectAccess.js';

beforeEach(() => {
  mockFindFirst.mockReset();
  mockFindUnique.mockReset();
});

describe('hasProjectAccess', () => {
  it('returns true when user is project owner', async () => {
    mockFindFirst.mockResolvedValue({ id: 'proj-1' });

    const result = await hasProjectAccess('user@test.com', 'proj-1');
    expect(result).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'proj-1',
        }),
      })
    );
  });

  it('returns false when project not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await hasProjectAccess('nobody@test.com', 'proj-1');
    expect(result).toBe(false);
  });
});

describe('isProjectOwner', () => {
  it('returns true when user is owner', async () => {
    mockFindFirst.mockResolvedValue({ id: 'proj-1' });

    const result = await isProjectOwner('owner@test.com', 'proj-1');
    expect(result).toBe(true);
  });

  it('returns false when user is not owner', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await isProjectOwner('editor@test.com', 'proj-1');
    expect(result).toBe(false);
  });
});

describe('getProjectRole', () => {
  it('returns OWNER for original project owner', async () => {
    mockFindUnique.mockResolvedValue({
      userId: 'owner@test.com',
      members: [],
    });

    const result = await getProjectRole('owner@test.com', 'proj-1');
    expect(result).toBe('OWNER');
  });

  it('returns member role for project members', async () => {
    mockFindUnique.mockResolvedValue({
      userId: 'other@test.com',
      members: [{ role: 'EDITOR' }],
    });

    const result = await getProjectRole('editor@test.com', 'proj-1');
    expect(result).toBe('EDITOR');
  });

  it('returns null when project not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getProjectRole('nobody@test.com', 'proj-999');
    expect(result).toBeNull();
  });

  it('returns null when user has no role', async () => {
    mockFindUnique.mockResolvedValue({
      userId: 'other@test.com',
      members: [],
    });

    const result = await getProjectRole('stranger@test.com', 'proj-1');
    expect(result).toBeNull();
  });
});
