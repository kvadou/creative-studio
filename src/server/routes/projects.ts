import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/passport.js';
import {
  hasProjectAccess,
  isProjectOwner,
  getProjectWithAccess,
} from '../middleware/projectAccess.js';

const router = Router();

type ProjectWithMembers = Prisma.ProjectGetPayload<{
  include: { members: { select: { userId: true; role: true } }; _count: { select: { conversations: true } } };
}>;

// Helper to format project response
function formatProjectResponse(
  project: ProjectWithMembers,
  userId: string
) {
  const role = project.userId === userId
    ? 'OWNER'
    : project.members?.find((m) => m.userId === userId)?.role || null;

  return {
    id: project.id,
    name: project.name,
    color: project.color,
    instructions: project.instructions,
    conversationCount: project._count?.conversations ?? 0,
    role,
    isOwner: role === 'OWNER',
    memberCount: (project.members?.length ?? 0) + 1, // +1 for original owner
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

// GET /api/projects - List projects user owns OR is a member of
router.get('/', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId: user.id }, // Projects user owns
          { members: { some: { userId: user.id } } }, // Projects user is member of
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        members: {
          select: { userId: true, role: true },
        },
        _count: {
          select: { conversations: true },
        },
      },
    });

    return res.json({
      projects: projects.map((p) => formatProjectResponse(p, user.id)),
    });
  } catch (error) {
    console.error('Error listing projects:', error);
    return res.status(500).json({ error: 'Failed to list projects' });
  }
});

// GET /api/projects/:id - Get single project with members
router.get('/:id', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const project = await getProjectWithAccess(user.id, req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    return res.json(project);
  } catch (error) {
    console.error('Error getting project:', error);
    return res.status(500).json({ error: 'Failed to get project' });
  }
});

// POST /api/projects - Create new project
router.post('/', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, color, instructions } = req.body as {
      name: string;
      color?: string;
      instructions?: string;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Check for duplicate name
    const existing = await prisma.project.findFirst({
      where: { userId: user.id, name: name.trim() },
    });
    if (existing) {
      return res.status(409).json({ error: 'A project with this name already exists' });
    }

    const project = await prisma.project.create({
      data: {
        userId: user.id,
        name: name.trim(),
        color: color || null,
        instructions: instructions?.trim() || null,
      },
      include: {
        members: true,
        _count: { select: { conversations: true } },
      },
    });

    return res.status(201).json(formatProjectResponse(project, user.id));
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// PATCH /api/projects/:id - Update project (owner only)
router.patch('/:id', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { name, color, instructions } = req.body as {
      name?: string;
      color?: string | null;
      instructions?: string | null;
    };

    // Verify ownership
    const isOwner = await isProjectOwner(user.id, req.params.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owners can update project settings' });
    }

    const existing = await prisma.project.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check for duplicate name if renaming
    if (name && name.trim() !== existing.name) {
      const duplicate = await prisma.project.findFirst({
        where: { userId: existing.userId, name: name.trim(), id: { not: req.params.id } },
      });
      if (duplicate) {
        return res.status(409).json({ error: 'A project with this name already exists' });
      }
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(instructions !== undefined && { instructions: instructions?.trim() || null }),
      },
      include: {
        members: {
          select: { userId: true, role: true },
        },
        _count: {
          select: { conversations: true },
        },
      },
    });

    return res.json(formatProjectResponse(project, user.id));
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project (owner only)
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify ownership
    const isOwner = await isProjectOwner(user.id, req.params.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owners can delete projects' });
    }

    // Delete project (conversations will have projectId set to null via onDelete: SetNull)
    await prisma.project.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============================================
// Member Management Endpoints
// ============================================

// GET /api/projects/:id/members - List project members
router.get('/:id/members', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify access
    const hasAccess = await hasProjectAccess(user.id, req.params.id);
    if (!hasAccess) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: {
        userId: true,
        members: {
          select: {
            userId: true,
            email: true,
            role: true,
            invitedAt: true,
          },
          orderBy: { invitedAt: 'asc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Include original owner as first member
    const members = [
      {
        userId: project.userId,
        email: '', // We don't have the owner's email stored, frontend will need to handle
        role: 'OWNER' as const,
        invitedAt: null,
        isOriginalOwner: true,
      },
      ...project.members.map((m) => ({
        ...m,
        invitedAt: m.invitedAt.toISOString(),
        isOriginalOwner: false,
      })),
    ];

    return res.json({ members });
  } catch (error) {
    console.error('Error listing project members:', error);
    return res.status(500).json({ error: 'Failed to list members' });
  }
});

// POST /api/projects/:id/members - Invite user to project (owner only)
router.post('/:id/members', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { email, role } = req.body as {
      email: string;
      role?: 'OWNER' | 'EDITOR';
    };

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email domain
    const emailLower = email.toLowerCase().trim();
    if (!emailLower.endsWith('@acmecreative.com')) {
      return res.status(400).json({ error: 'Only @acmecreative.com users can be invited' });
    }

    // Verify ownership
    const isOwner = await isProjectOwner(user.id, req.params.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owners can invite members' });
    }

    // Look up user by email (they must have logged in at least once)
    // We need to find users who have this email - checking conversations/projects for email
    // Since we store Google OAuth ID, we need to match email from stored user records
    // For now, we'll store the email and userId will be looked up when they access

    // Check if already a member
    const existingMember = await prisma.projectMember.findFirst({
      where: { projectId: req.params.id, email: emailLower },
    });
    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    // Check if trying to invite the owner
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });

    // We can't easily check if email matches owner without a User table
    // For now, create the membership - the owner accessing would see duplicate in UI

    // Create pending membership with email
    // When the user logs in with this email, they'll see the project
    const member = await prisma.projectMember.create({
      data: {
        projectId: req.params.id,
        userId: emailLower, // Use email as temp userId until we have User table
        email: emailLower,
        role: role === 'OWNER' ? 'OWNER' : 'EDITOR',
        invitedBy: user.id,
      },
    });

    return res.status(201).json({
      userId: member.userId,
      email: member.email,
      role: member.role,
      invitedAt: member.invitedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error inviting member:', error);
    return res.status(500).json({ error: 'Failed to invite member' });
  }
});

// DELETE /api/projects/:id/members/:userId - Remove member (owner only)
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify ownership
    const isOwner = await isProjectOwner(user.id, req.params.id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owners can remove members' });
    }

    // Can't remove the original owner
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { userId: true },
    });
    if (project?.userId === req.params.userId) {
      return res.status(400).json({ error: 'Cannot remove the project owner' });
    }

    // Remove member
    await prisma.projectMember.deleteMany({
      where: {
        projectId: req.params.id,
        userId: req.params.userId,
      },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
