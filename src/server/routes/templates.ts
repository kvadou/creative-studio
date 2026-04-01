import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { hasProjectAccess, isProjectOwner } from '../middleware/projectAccess.js';

const router = Router();

// All routes require admin access
router.use(requireAdmin);

// Template configuration type (matches GeneratorForm fields)
interface TemplateConfig {
  ageBand?: string;
  storyDensity?: string;
  storySubject?: string;
  chessBasis?: string;
  puzzleCount?: number;
  puzzleDifficulty?: string;
  additionalNotes?: string;
  // Reference data
  playerName?: string;
  playerProfile?: object;
  bookId?: string;
  bookTitle?: string;
  openingEco?: string;
  openingName?: string;
  tacticalThemeId?: string;
  tacticalThemeName?: string;
}

// GET /api/templates - List templates accessible to the user
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    const userEmail = req.user!.email;


    // Build where clause: user's personal templates + team templates + builtin
    const whereClause = {
      OR: [
        { type: 'PERSONAL' as const, createdByEmail: userEmail },
        { type: 'BUILTIN' as const },
      ] as Array<{ type: 'PERSONAL' | 'TEAM' | 'BUILTIN'; createdByEmail?: string; projectId?: string }>,
    };

    // If projectId is provided, include team templates for that project
    if (projectId && typeof projectId === 'string') {
      whereClause.OR.push({ type: 'TEAM' as const, projectId });
    }

    const templates = await prisma.lessonTemplate.findMany({
      where: whereClause,
      orderBy: [
        { type: 'asc' }, // BUILTIN first, then PERSONAL, then TEAM
        { usageCount: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        config: true,
        usageCount: true,
        createdByEmail: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ templates });
  } catch (error) {
    console.error('Failed to list templates:', error);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// POST /api/templates - Create a new template
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, type, projectId, config } = req.body as {
      name: string;
      description?: string;
      type: 'PERSONAL' | 'TEAM';
      projectId?: string;
      config: TemplateConfig;
    };

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    if (!type || !['PERSONAL', 'TEAM'].includes(type)) {
      return res.status(400).json({ error: 'Type must be PERSONAL or TEAM' });
    }

    if (type === 'TEAM' && !projectId) {
      return res.status(400).json({ error: 'projectId is required for TEAM templates' });
    }

    const userEmail = req.user!.email;

    // For TEAM templates, verify user has access to the project
    if (type === 'TEAM' && projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: userEmail },
            { members: { some: { userId: userEmail } } },
          ],
        },
      });

      if (!project) {
        return res.status(403).json({ error: 'No access to this project' });
      }
    }

    const template = await prisma.lessonTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type,
        createdByEmail: type === 'PERSONAL' ? userEmail : null,
        projectId: type === 'TEAM' ? projectId : null,
        config: (config || {}) as object,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Failed to create template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// GET /api/templates/:id - Get a single template
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userEmail = req.user!.email;


    const template = await prisma.lessonTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Check access
    let accessGranted = false;
    if (template.type === 'BUILTIN') {
      accessGranted = true;
    } else if (template.type === 'PERSONAL') {
      accessGranted = template.createdByEmail === userEmail;
    } else if (template.type === 'TEAM' && template.projectId) {
      accessGranted = await hasProjectAccess(userEmail, template.projectId);
    }

    if (!accessGranted) {
      return res.status(403).json({ error: 'No access to this template' });
    }

    res.json(template);
  } catch (error) {
    console.error('Failed to get template:', error);
    res.status(500).json({ error: 'Failed to load template' });
  }
});

// PATCH /api/templates/:id - Update a template
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, config } = req.body as {
      name?: string;
      description?: string;
      config?: TemplateConfig;
    };

    const userEmail = req.user!.email;

    const template = await prisma.lessonTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Only allow editing PERSONAL templates owned by user, or TEAM templates user has access to
    if (template.type === 'BUILTIN') {
      return res.status(403).json({ error: 'Cannot edit built-in templates' });
    }

    if (template.type === 'PERSONAL' && template.createdByEmail !== userEmail) {
      return res.status(403).json({ error: 'Not authorized to edit this template' });
    }

    if (template.type === 'TEAM' && template.projectId) {
      const canEdit = await hasProjectAccess(userEmail, template.projectId);
      if (!canEdit) {
        return res.status(403).json({ error: 'No access to this project' });
      }
    }

    const updated = await prisma.lessonTemplate.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(config && { config: config as object }),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Failed to update template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// DELETE /api/templates/:id - Delete a template
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userEmail = req.user!.email;


    const template = await prisma.lessonTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Only allow deleting PERSONAL templates owned by user
    if (template.type === 'BUILTIN') {
      return res.status(403).json({ error: 'Cannot delete built-in templates' });
    }

    if (template.type === 'PERSONAL' && template.createdByEmail !== userEmail) {
      return res.status(403).json({ error: 'Not authorized to delete this template' });
    }

    if (template.type === 'TEAM' && template.projectId) {
      const ownerCheck = await isProjectOwner(userEmail, template.projectId);
      if (!ownerCheck) {
        return res.status(403).json({ error: 'Only project owners can delete team templates' });
      }
    }

    await prisma.lessonTemplate.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// POST /api/templates/:id/use - Increment usage count
router.post('/:id/use', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;


    await prisma.lessonTemplate.update({
      where: { id },
      data: { usageCount: { increment: 1 } },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to increment usage:', error);
    res.status(500).json({ error: 'Failed to update usage count' });
  }
});

export default router;
