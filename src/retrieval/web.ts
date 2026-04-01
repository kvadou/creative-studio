/**
 * Web search module for agentic RAG
 * Fetches cultural guidelines and external information
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../lib/config.js';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResult[];
  summary: string;
}

/**
 * Perform web search using Claude's built-in capabilities
 * Uses Claude to search and synthesize results
 */
export async function searchWeb(queries: string[]): Promise<WebSearchResponse[]> {
  // Stub: return empty results when no API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return queries.map((query) => ({
      query,
      results: [],
      summary: `Web search requires an Anthropic API key. Set ANTHROPIC_API_KEY in your .env to enable this feature.`,
    }));
  }

  const anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });

  const responses: WebSearchResponse[] = [];

  for (const query of queries) {
    try {
      // Use Claude with web search to find and summarize information
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `Search the web and provide factual information about: "${query}"

Focus on:
- Official government guidelines and regulations
- Educational content restrictions
- Cultural sensitivities for children's educational materials
- Recent policy changes (2023-2024)

Return your findings in this exact format:

SUMMARY:
[2-3 sentence summary of key findings]

KEY POINTS:
- [Point 1 with source]
- [Point 2 with source]
- [Point 3 with source]

RESTRICTIONS TO AVOID:
- [Specific content/imagery to avoid]

SOURCES:
- [Source 1 URL or name]
- [Source 2 URL or name]`,
          },
        ],
      });

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as { type: 'text'; text: string }).text)
        .join('\n');

      // Parse the response into structured format
      const summary = extractSection(content, 'SUMMARY:') || content.slice(0, 300);
      const keyPoints = extractBulletPoints(content, 'KEY POINTS:');
      const restrictions = extractBulletPoints(content, 'RESTRICTIONS TO AVOID:');
      const sources = extractBulletPoints(content, 'SOURCES:');

      responses.push({
        query,
        results: [
          ...keyPoints.map((point, i) => ({
            title: `Key Point ${i + 1}`,
            url: sources[i] || '',
            snippet: point,
            source: 'web_search',
          })),
          ...restrictions.map((r, i) => ({
            title: `Restriction ${i + 1}`,
            url: '',
            snippet: r,
            source: 'web_search',
          })),
        ],
        summary,
      });
    } catch (error) {
      console.error(`Web search failed for "${query}":`, error);
      responses.push({
        query,
        results: [],
        summary: `Unable to search for: ${query}`,
      });
    }
  }

  return responses;
}

/**
 * Search for cultural guidelines specific to a region
 */
export async function searchCulturalGuidelines(
  region: string,
  topics: string[]
): Promise<{
  region: string;
  guidelines: string[];
  restrictions: string[];
  sources: string[];
  rawResponse: string;
}> {
  // Stub: return empty results when no API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      region,
      guidelines: [],
      restrictions: [],
      sources: [],
      rawResponse: `Cultural guidelines search requires an Anthropic API key.`,
    };
  }

  const searchQuery = `${region} children education content guidelines restrictions ${topics.join(' ')} 2024`;

  const anthropic = new Anthropic({
    apiKey: config.anthropicApiKey,
  });

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `I need to adapt children's chess educational content for ${region}. Search for and provide:

1. CULTURAL GUIDELINES: What cultural considerations should we keep in mind?
2. CONTENT RESTRICTIONS: What content, imagery, or themes should we AVOID?
3. REGULATORY REQUIREMENTS: What educational content regulations exist?
4. SPECIFIC EXAMPLES: Any examples of content that was banned or restricted?

Topics of concern: ${topics.join(', ')}

Be specific and cite sources where possible. Focus on official guidelines and recent (2023-2024) policies.`,
        },
      ],
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    // Extract structured information
    const guidelines = extractBulletPoints(content, 'CULTURAL GUIDELINES:') ||
      extractBulletPoints(content, '1.');
    const restrictions = extractBulletPoints(content, 'CONTENT RESTRICTIONS:') ||
      extractBulletPoints(content, '2.');
    const sources = extractSources(content);

    return {
      region,
      guidelines,
      restrictions,
      sources,
      rawResponse: content,
    };
  } catch (error) {
    console.error(`Cultural guidelines search failed for ${region}:`, error);
    return {
      region,
      guidelines: [],
      restrictions: [],
      sources: [],
      rawResponse: `Unable to fetch guidelines for ${region}`,
    };
  }
}

// Helper functions
function extractSection(text: string, header: string): string {
  const headerIndex = text.indexOf(header);
  if (headerIndex === -1) return '';

  const startIndex = headerIndex + header.length;
  const nextHeaderMatch = text.slice(startIndex).match(/\n[A-Z][A-Z\s]+:/);
  const endIndex = nextHeaderMatch
    ? startIndex + (nextHeaderMatch.index || text.length)
    : text.length;

  return text.slice(startIndex, endIndex).trim();
}

function extractBulletPoints(text: string, header: string): string[] {
  const section = extractSection(text, header);
  if (!section) {
    // Try to find bullet points anywhere after a numbered section
    const lines = text.split('\n');
    const points: string[] = [];
    let inSection = false;

    for (const line of lines) {
      if (line.includes(header) || line.match(/^\d+\./)) {
        inSection = true;
        continue;
      }
      if (inSection && line.trim().startsWith('-')) {
        points.push(line.trim().replace(/^-\s*/, ''));
      }
      if (inSection && line.match(/^\d+\./) && points.length > 0) {
        break;
      }
    }
    return points;
  }

  return section
    .split('\n')
    .filter((line) => line.trim().startsWith('-') || line.trim().startsWith('•'))
    .map((line) => line.trim().replace(/^[-•]\s*/, ''));
}

function extractSources(text: string): string[] {
  const sources: string[] = [];

  // Look for URLs
  const urlPattern = /https?:\/\/[^\s)]+/g;
  const urls = text.match(urlPattern) || [];
  sources.push(...urls);

  // Look for source citations
  const sourceSection = extractSection(text, 'SOURCES:');
  if (sourceSection) {
    const bulletSources = sourceSection
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.trim().replace(/^[-•]\s*/, ''));
    sources.push(...bulletSources);
  }

  return [...new Set(sources)];
}
