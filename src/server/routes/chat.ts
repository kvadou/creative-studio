import { Router } from 'express';
import { retrieve } from '../../retrieval/index.js';
import { detectIntent } from '../../retrieval/intent.js';
import { generateGroundedResponse, generateCulturalAdaptation, type CulturalAdaptationResponse, type GenerationOptions } from '../../generation/index.js';
import { generateStory, getStoryContext } from '../../generation/story.js';
import { prisma } from '../../lib/prisma.js';
import type { ChatRequest, ChatResponse, CulturalGuideline, CulturalRestriction, CulturalAdaptation as CulturalAdaptationType } from '../../types/index.js';
import type { AuthUser } from '../auth/passport.js';
import { generateTitle } from './conversations.js';
import { hasProjectAccess } from '../middleware/projectAccess.js';

const router = Router();

// Timeout wrapper for async operations
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Normalize region string to database format
function normalizeRegion(region: string): string {
  const normalized = region.toLowerCase().trim();
  // Map common variations to database keys (25 international markets)
  const regionMap: Record<string, string> = {
    // Original 3
    'singapore': 'singapore',
    'sg': 'singapore',
    'hong kong': 'hong_kong',
    'hongkong': 'hong_kong',
    'hk': 'hong_kong',
    'uae': 'uae',
    'united arab emirates': 'uae',
    'dubai': 'uae',
    'abu dhabi': 'uae',
    // Phase 1 - High Impact
    'japan': 'japan',
    'jp': 'japan',
    'south korea': 'south_korea',
    'korea': 'south_korea',
    'kr': 'south_korea',
    'india': 'india',
    'in': 'india',
    'china': 'china',
    'cn': 'china',
    'prc': 'china',
    'saudi arabia': 'saudi_arabia',
    'saudi': 'saudi_arabia',
    'ksa': 'saudi_arabia',
    'malaysia': 'malaysia',
    'my': 'malaysia',
    // Phase 2 - Regional Expansion
    'taiwan': 'taiwan',
    'tw': 'taiwan',
    'qatar': 'qatar',
    'qa': 'qatar',
    'indonesia': 'indonesia',
    'id': 'indonesia',
    'thailand': 'thailand',
    'th': 'thailand',
    'united kingdom': 'united_kingdom',
    'uk': 'united_kingdom',
    'gb': 'united_kingdom',
    'britain': 'united_kingdom',
    'australia': 'australia',
    'au': 'australia',
    // Phase 3 - Broader Reach
    'kuwait': 'kuwait',
    'kw': 'kuwait',
    'bahrain': 'bahrain',
    'bh': 'bahrain',
    'oman': 'oman',
    'om': 'oman',
    'vietnam': 'vietnam',
    'vn': 'vietnam',
    'philippines': 'philippines',
    'ph': 'philippines',
    'new zealand': 'new_zealand',
    'nz': 'new_zealand',
    'germany': 'germany',
    'de': 'germany',
    'france': 'france',
    'fr': 'france',
    'spain': 'spain',
    'es': 'spain',
    'netherlands': 'netherlands',
    'nl': 'netherlands',
    'holland': 'netherlands',
    'mexico': 'mexico',
    'mx': 'mexico',
    'brazil': 'brazil',
    'br': 'brazil',
    'brasil': 'brazil',
    'canada': 'canada',
    'ca': 'canada',
  };
  return regionMap[normalized] || normalized.replace(/\s+/g, '_');
}

// Fetch cached cultural profile from database
async function getCachedCulturalProfile(region: string) {
  const normalizedRegion = normalizeRegion(region);

  const profile = await prisma.culturalProfile.findFirst({
    where: {
      region: normalizedRegion,
      isActive: true,
    },
  });

  if (!profile) {
    console.log(`No cached cultural profile found for: ${normalizedRegion}`);
    return null;
  }

  console.log(`Using cached cultural profile for ${profile.displayName} (v${profile.version})`);

  const guidelines = profile.guidelines as unknown as CulturalGuideline[];
  const restrictions = profile.restrictions as unknown as CulturalRestriction[];
  const adaptations = profile.adaptations as unknown as CulturalAdaptationType[];

  return {
    region: profile.displayName,
    guidelines: guidelines.map((g) => g.guidance),
    restrictions: restrictions.map((r) => r.description),
    sources: profile.sources,
    rawResponse: profile.notes || `Cultural profile for ${profile.displayName}`,
    // Include structured data for richer responses
    structuredGuidelines: guidelines,
    structuredRestrictions: restrictions,
    adaptations,
  };
}

router.post('/', async (req, res) => {
  try {
    const user = req.user as AuthUser | undefined;
    const { query, conversationId, projectId, storyMode } = req.body as ChatRequest & {
      conversationId?: string;
      projectId?: string;
      storyMode?: boolean;
    };

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Fetch project instructions if available
    let projectInstructions: string | undefined;
    let resolvedProjectId = projectId;

    // If conversationId provided, get project from conversation
    if (conversationId && user) {
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          OR: [
            { userId: user.id },
            {
              project: {
                OR: [
                  { userId: user.id },
                  { members: { some: { userId: user.id } } },
                ],
              },
            },
          ],
        },
        select: {
          projectId: true,
          project: {
            select: { instructions: true },
          },
        },
      });

      if (conversation?.project?.instructions) {
        projectInstructions = conversation.project.instructions;
        resolvedProjectId = conversation.projectId || undefined;
      }
    }

    // If projectId provided directly, verify access and get instructions
    if (projectId && user && !projectInstructions) {
      const canAccess = await hasProjectAccess(user.id, projectId);
      if (canAccess) {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          select: { instructions: true },
        });
        if (project?.instructions) {
          projectInstructions = project.instructions;
        }
      }
    }

    // Build generation options
    const generationOptions: GenerationOptions | undefined = projectInstructions
      ? { projectInstructions }
      : undefined;

    // Step 1: Detect intent - does this need cultural adaptation or story writing?
    const intent = detectIntent(query);
    console.log('Intent detected:', intent);

    // Check for story mode (explicit toggle or detected intent)
    const isStoryMode = storyMode || intent.storyWritingDetected;

    let response;
    let isAgenticResponse = false;
    let isStoryResponse = false;
    let storyMetadata: { charactersUsed: string[]; conceptsTaught: string[] } | undefined;
    let chunks: Awaited<ReturnType<typeof retrieve>>;

    // Step 2: Handle story writing mode
    if (isStoryMode) {
      console.log('Story mode activated:', storyMode ? 'explicit toggle' : 'intent detected');
      isStoryResponse = true;

      // Get context for story writing
      const storySubject = intent.storySubject || query;
      const storyContext = await getStoryContext(storySubject);

      // Generate the story
      const generatedStory = await generateStory({
        subject: storySubject,
        ageGroup: '3-7', // Default to younger age group
        context: storyContext || undefined,
      });

      // Store metadata for response
      storyMetadata = {
        charactersUsed: generatedStory.charactersUsed,
        conceptsTaught: generatedStory.conceptsTaught,
      };

      // Format story response
      const storyAnswer = `# ${generatedStory.title}

${generatedStory.story}

---
*Characters featured: ${generatedStory.charactersUsed.join(', ') || 'Various characters'}*
*Chess concepts: ${generatedStory.conceptsTaught.join(', ') || 'Various concepts'}*
*Suitable for: ${generatedStory.ageGroup}*`;

      // Create a response object compatible with the rest of the flow
      response = {
        answer: storyAnswer,
        citations: [],
        confidence: 'high' as const,
      };

      // No chunks for story mode, but we still need the variable defined
      chunks = [];
    }
    // Step 3: Handle cultural adaptation mode
    else if (intent.needsWebSearch && intent.detectedRegions.length > 0) {
      const region = intent.detectedRegions[0];
      console.log(`Agentic mode: Fetching cultural profile for ${region}`);
      isAgenticResponse = true;

      // Run retrieval and cultural lookup in parallel with timeout
      const [retrievedChunks, culturalInfo] = await Promise.all([
        retrieve(query),
        withTimeout(
          getCachedCulturalProfile(region),
          5000, // 5s timeout for DB lookup
          null
        ),
      ]);
      chunks = retrievedChunks;

      if (culturalInfo) {
        console.log(`Found ${culturalInfo.guidelines.length} guidelines, ${culturalInfo.restrictions.length} restrictions`);
        response = await generateCulturalAdaptation(query, chunks, culturalInfo, generationOptions);
      } else {
        // Fallback: No cached profile, generate standard response with note
        console.log(`No cultural profile available for ${region}, using standard response`);
        response = await generateGroundedResponse(query, chunks, generationOptions);
        response.answer = `*Note: No specific cultural guidelines are cached for ${region}. Providing general curriculum guidance.*\n\n${response.answer}`;
      }
    } else {
      // Standard curriculum-only response
      chunks = await retrieve(query);
      response = await generateGroundedResponse(query, chunks, generationOptions);
    }

    // Log the query
    const queryLog = await prisma.queryLog.create({
      data: {
        query,
        retrievedChunks: chunks.map((c) => ({
          id: c.id,
          similarity: c.similarity,
          fusionScore: c.fusionScore,
        })),
        response: response.answer,
        confidenceScore: chunks[0]?.similarity || chunks[0]?.fusionScore || 0,
        answeredFromKB: response.confidence !== 'no_answer',
      },
    });

    const chatResponse: ChatResponse & {
      conversationId?: string;
      agenticMode?: boolean;
      region?: string;
      culturalSources?: string[];
      storyMode?: boolean;
      storyMetadata?: {
        charactersUsed: string[];
        conceptsTaught: string[];
      };
    } = {
      answer: response.answer,
      citations: response.citations,
      confidence: response.confidence,
      queryId: queryLog.id,
    };

    // Add story mode metadata if applicable
    if (isStoryResponse) {
      chatResponse.storyMode = true;
      chatResponse.storyMetadata = storyMetadata;
    }

    // Add agentic metadata if applicable
    if (isAgenticResponse && 'region' in response) {
      const culturalResponse = response as CulturalAdaptationResponse;
      chatResponse.agenticMode = true;
      chatResponse.region = culturalResponse.region;
      chatResponse.culturalSources = culturalResponse.culturalSources;
    }

    // Persist to conversation if user is authenticated
    if (user) {
      let activeConversationId = conversationId;

      // If conversationId provided, verify access (own OR shared project member)
      if (activeConversationId) {
        const existing = await prisma.conversation.findFirst({
          where: {
            id: activeConversationId,
            OR: [
              { userId: user.id },
              {
                project: {
                  OR: [
                    { userId: user.id },
                    { members: { some: { userId: user.id } } },
                  ],
                },
              },
            ],
          },
        });
        if (!existing) {
          // Conversation not found or no access, create new one
          activeConversationId = undefined;
        }
      }

      // Create new conversation if needed
      if (!activeConversationId) {
        const newConversation = await prisma.conversation.create({
          data: {
            userId: user.id,
            title: generateTitle(query),
            projectId: resolvedProjectId || null,
          },
        });
        activeConversationId = newConversation.id;
      }

      // Get next sequence number
      const lastMessage = await prisma.conversationMessage.findFirst({
        where: { conversationId: activeConversationId },
        orderBy: { sequence: 'desc' },
      });
      const nextSequence = (lastMessage?.sequence ?? -1) + 1;

      // Save user message
      await prisma.conversationMessage.create({
        data: {
          conversationId: activeConversationId,
          role: 'user',
          content: query,
          sequence: nextSequence,
        },
      });

      // Save assistant message with metadata
      await prisma.conversationMessage.create({
        data: {
          conversationId: activeConversationId,
          role: 'assistant',
          content: response.answer,
          sequence: nextSequence + 1,
          metadata: JSON.parse(JSON.stringify({
            citations: response.citations,
            confidence: response.confidence,
            queryId: queryLog.id,
            agenticMode: isAgenticResponse,
            region: chatResponse.region,
            culturalSources: chatResponse.culturalSources,
            storyMode: isStoryResponse,
            storyMetadata: storyMetadata,
          })),
        },
      });

      // Update conversation timestamp
      await prisma.conversation.update({
        where: { id: activeConversationId },
        data: { updatedAt: new Date() },
      });

      // Include conversationId in response
      chatResponse.conversationId = activeConversationId;
    }

    return res.json(chatResponse);
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your request',
    });
  }
});

// Feedback endpoint
router.post('/:queryId/feedback', async (req, res) => {
  try {
    const { queryId } = req.params;
    const { score } = req.body;

    if (typeof score !== 'number' || score < 1 || score > 5) {
      return res.status(400).json({ error: 'Score must be between 1 and 5' });
    }

    await prisma.queryLog.update({
      where: { id: queryId },
      data: { feedbackScore: score },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: 'Failed to record feedback' });
  }
});

export default router;
