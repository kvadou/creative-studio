import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type { AuthUser } from '../auth/passport.js';
import { hasProjectAccess } from '../middleware/projectAccess.js';

const router = Router();

// Helper to generate title from first message
function generateTitle(content: string): string {
  // Take first 50 chars, truncate at word boundary
  if (content.length <= 50) return content;
  const truncated = content.slice(0, 50);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 20 ? truncated.slice(0, lastSpace) + '...' : truncated + '...';
}

// GET /api/conversations - List user's conversations (paginated)
// Includes: own conversations + conversations in shared projects
router.get('/', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const cursor = req.query.cursor as string | undefined;
    const projectId = req.query.projectId as string | undefined;

    // Build where clause for shared access
    let where: Prisma.ConversationWhereInput;

    if (projectId === 'null') {
      // Unassigned conversations - only own
      where = { userId: user.id, projectId: null };
    } else if (projectId) {
      // Specific project - check membership first
      const canAccess = await hasProjectAccess(user.id, projectId);
      if (!canAccess) {
        return res.status(404).json({ error: 'Project not found' });
      }
      where = { projectId };
    } else {
      // All conversations: own + shared projects
      where = {
        OR: [
          { userId: user.id }, // Own conversations
          {
            project: {
              OR: [
                { userId: user.id }, // Projects user owns
                { members: { some: { userId: user.id } } }, // Projects user is member of
              ],
            },
          },
        ],
      };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit + 1, // Fetch one extra to check if there's more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
      include: {
        messages: {
          orderBy: { sequence: 'desc' },
          take: 1,
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    const hasMore = conversations.length > limit;
    const results = hasMore ? conversations.slice(0, -1) : conversations;

    return res.json({
      conversations: results.map((c) => ({
        id: c.id,
        title: c.title,
        projectId: c.projectId,
        updatedAt: c.updatedAt.toISOString(),
        messageCount: c._count.messages,
        lastMessage: c.messages[0]
          ? {
              role: c.messages[0].role,
              content: c.messages[0].content.slice(0, 100),
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : undefined,
      })),
      nextCursor: hasMore ? results[results.length - 1]?.id : null,
    });
  } catch (error) {
    console.error('Error listing conversations:', error);
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /api/conversations/search - Search across messages
// Includes: own conversations + conversations in shared projects
router.get('/search', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const q = req.query.q as string;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

    const messages = await prisma.conversationMessage.findMany({
      where: {
        conversation: {
          OR: [
            { userId: user.id }, // Own conversations
            {
              project: {
                OR: [
                  { userId: user.id }, // Projects user owns
                  { members: { some: { userId: user.id } } }, // Projects user is member of
                ],
              },
            },
          ],
        },
        content: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        conversation: {
          select: { id: true, title: true },
        },
      },
    });

    return res.json({
      results: messages.map((m) => ({
        conversationId: m.conversation.id,
        conversationTitle: m.conversation.title,
        messageId: m.id,
        content: m.content.slice(0, 200),
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error searching conversations:', error);
    return res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// GET /api/conversations/:id - Get single conversation with messages
// Access: own conversation OR member of its project
router.get('/:id', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: user.id }, // Own conversation
          {
            project: {
              OR: [
                { userId: user.id }, // Projects user owns
                { members: { some: { userId: user.id } } }, // Projects user is member of
              ],
            },
          },
        ],
      },
      include: {
        messages: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            instructions: true,
          },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      project: conversation.project,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// POST /api/conversations - Create new conversation
// Anyone with project access can create conversations in that project
router.post('/', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { title, projectId, initialMessage } = req.body as {
      title?: string;
      projectId?: string;
      initialMessage?: { role: 'user'; content: string };
    };

    // If projectId provided, verify membership (not just ownership)
    if (projectId) {
      const canAccess = await hasProjectAccess(user.id, projectId);
      if (!canAccess) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || (initialMessage ? generateTitle(initialMessage.content) : 'New conversation'),
        projectId: projectId || null,
        messages: initialMessage
          ? {
              create: {
                role: initialMessage.role,
                content: initialMessage.content,
                sequence: 0,
              },
            }
          : undefined,
      },
      include: {
        messages: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            metadata: true,
            createdAt: true,
          },
        },
      },
    });

    return res.status(201).json({
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        metadata: m.metadata,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// PATCH /api/conversations/:id - Update conversation (title, project)
// Only conversation owner can update, but they need project membership to move to a project
router.patch('/:id', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { title, projectId } = req.body as {
      title?: string;
      projectId?: string | null;
    };

    // Only conversation owner can update
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // If moving to a project, verify project membership
    if (projectId) {
      const canAccess = await hasProjectAccess(user.id, projectId);
      if (!canAccess) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }

    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(projectId !== undefined && { projectId }),
      },
    });

    return res.json({
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      updatedAt: conversation.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    return res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /api/conversations/:id - Delete conversation
router.delete('/:id', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Verify ownership
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await prisma.conversation.delete({
      where: { id: req.params.id },
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// POST /api/conversations/:id/messages - Add message to conversation
// Access: own conversation OR member of its project
router.post('/:id/messages', async (req, res) => {
  try {
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { role, content, metadata } = req.body as {
      role: 'user' | 'assistant';
      content: string;
      metadata?: Record<string, unknown>;
    };

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    // Verify access (own conversation OR member of its project)
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { userId: user.id }, // Own conversation
          {
            project: {
              OR: [
                { userId: user.id }, // Projects user owns
                { members: { some: { userId: user.id } } }, // Projects user is member of
              ],
            },
          },
        ],
      },
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get next sequence number
    const lastMessage = await prisma.conversationMessage.findFirst({
      where: { conversationId: req.params.id },
      orderBy: { sequence: 'desc' },
    });

    const message = await prisma.conversationMessage.create({
      data: {
        conversationId: req.params.id,
        role,
        content,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        sequence: (lastMessage?.sequence ?? -1) + 1,
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });

    return res.status(201).json({
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return res.status(500).json({ error: 'Failed to add message' });
  }
});

export default router;
export { generateTitle };
