import { prisma } from '../../lib/prisma.js';
import type { ProjectRole } from '@prisma/client';

/**
 * Check if user has any access to a project (owner or member)
 */
export async function hasProjectAccess(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId }, // Original owner
        { members: { some: { userId } } }, // Member
      ],
    },
    select: { id: true },
  });
  return !!project;
}

/**
 * Check if user is the owner of a project
 */
export async function isProjectOwner(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is the original owner OR has OWNER role as member
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId }, // Original owner
        { members: { some: { userId, role: 'OWNER' } } }, // Member with OWNER role
      ],
    },
    select: { id: true },
  });
  return !!project;
}

/**
 * Check if user can edit a project (owner or editor)
 */
export async function canEditProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Any member can edit (OWNER or EDITOR)
  return hasProjectAccess(userId, projectId);
}

/**
 * Get user's role in a project
 * Returns 'OWNER' if original owner, otherwise checks ProjectMember
 */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!project) return null;

  // Original owner is always OWNER
  if (project.userId === userId) {
    return 'OWNER';
  }

  // Check membership
  if (project.members.length > 0) {
    return project.members[0].role;
  }

  return null;
}

/**
 * Get project with access check - returns null if user doesn't have access
 */
export async function getProjectWithAccess(
  userId: string,
  projectId: string
) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: {
        select: {
          userId: true,
          email: true,
          role: true,
          invitedAt: true,
        },
      },
      _count: {
        select: { conversations: true },
      },
    },
  });

  if (!project) return null;

  // Determine current user's role
  const role = project.userId === userId
    ? 'OWNER' as const
    : project.members.find(m => m.userId === userId)?.role || null;

  return {
    ...project,
    role,
    isOwner: role === 'OWNER',
    conversationCount: project._count.conversations,
    memberCount: project.members.length + 1, // +1 for original owner
  };
}
