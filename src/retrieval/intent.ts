/**
 * Intent detection for agentic retrieval
 * Determines if a query needs web search augmentation or story generation
 */

export interface QueryIntent {
  needsWebSearch: boolean;
  searchQueries: string[];
  intentType: 'curriculum' | 'cultural_adaptation' | 'international' | 'policy' | 'general' | 'story_writing';
  detectedRegions: string[];
  detectedTopics: string[];
  storyWritingDetected: boolean;
  storySubject?: string; // Extracted subject from story request (e.g., "King Chomper learning to castle")
}

// Countries/regions that might need cultural adaptation
const INTERNATIONAL_MARKERS = [
  { pattern: /\b(dubai|uae|emirates|abu dhabi)\b/i, region: 'UAE', searchTerms: ['UAE Dubai cultural guidelines education'] },
  { pattern: /\b(singapore|sg)\b/i, region: 'Singapore', searchTerms: ['Singapore education content guidelines MOE'] },
  { pattern: /\b(hong kong|hk)\b/i, region: 'Hong Kong', searchTerms: ['Hong Kong education guidelines curriculum'] },
  { pattern: /\b(china|chinese|mainland)\b/i, region: 'China', searchTerms: ['China education content restrictions foreign'] },
  { pattern: /\b(saudi|ksa|riyadh|jeddah)\b/i, region: 'Saudi Arabia', searchTerms: ['Saudi Arabia education content restrictions'] },
  { pattern: /\b(qatar|doha)\b/i, region: 'Qatar', searchTerms: ['Qatar education cultural guidelines'] },
  { pattern: /\b(india|indian)\b/i, region: 'India', searchTerms: ['India education content guidelines CBSE'] },
  { pattern: /\b(japan|japanese)\b/i, region: 'Japan', searchTerms: ['Japan education cultural considerations'] },
  { pattern: /\b(korea|korean|seoul)\b/i, region: 'South Korea', searchTerms: ['South Korea education guidelines'] },
  { pattern: /\b(uk|britain|british|england)\b/i, region: 'UK', searchTerms: ['UK education Ofsted guidelines'] },
  { pattern: /\b(australia|australian)\b/i, region: 'Australia', searchTerms: ['Australia education curriculum guidelines'] },
];

// Topics that indicate need for cultural/policy research
const CULTURAL_TOPICS = [
  { pattern: /\b(cultur(e|al|ally)|adapt(ation)?|localiz(e|ation)|customiz(e|ation))\b/i, topic: 'cultural_adaptation' },
  { pattern: /\b(religio(n|us)|islam(ic)?|christian|hindu|buddhist|jewish)\b/i, topic: 'religious_sensitivity' },
  { pattern: /\b(rainbow|lgbtq?|pride|gender|transgender)\b/i, topic: 'lgbtq_content' },
  { pattern: /\b(censor(ship)?|restrict(ion|ed)?|ban(ned)?|prohibit(ed)?)\b/i, topic: 'content_restrictions' },
  { pattern: /\b(appropriat(e|eness)|sensitiv(e|ity)|offens(e|ive))\b/i, topic: 'sensitivity' },
  { pattern: /\b(international|global|foreign|overseas|abroad)\b/i, topic: 'international' },
  { pattern: /\b(franchise|licens(e|ing)|partner)\b/i, topic: 'franchise' },
  { pattern: /\b(regulat(ion|ory)|compliance|legal|law)\b/i, topic: 'regulatory' },
  { pattern: /\b(food|diet(ary)?|halal|kosher|vegetarian|pork|alcohol)\b/i, topic: 'dietary_restrictions' },
  { pattern: /\b(holiday|festival|celebration|christmas|eid|diwali)\b/i, topic: 'holidays' },
];

// Patterns that indicate story writing intent
// These patterns extract the subject of the story from the query
const STORY_WRITING_PATTERNS = [
  // "Write a story about X"
  /\b(write|create|draft|make|compose|generate)\s+(me\s+)?a?\s*(short\s+)?(story|narrative|tale|adventure)\s+(about|featuring|with|for)\s+(.+)/i,
  // "Story about X"
  /\b(story|narrative|tale|adventure)\s+(about|featuring|with|for)\s+(.+)/i,
  // "Can you write a story..."
  /\b(can you|could you|please|would you)\s+(write|create|draft|make)\s+(me\s+)?a?\s*(story|narrative|tale)\s+/i,
  // "I need a story about..."
  /\b(i need|i want|i'd like|give me)\s+a?\s*(story|narrative|tale)\s+(about|featuring|with|for)\s+(.+)/i,
];

/**
 * Check if query is requesting story writing and extract the subject
 */
function detectStoryWriting(query: string): { detected: boolean; subject?: string } {
  for (const pattern of STORY_WRITING_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      // Try to extract the subject from the last capture group
      const lastGroup = match[match.length - 1];
      if (lastGroup && lastGroup.trim().length > 0) {
        return {
          detected: true,
          subject: lastGroup.trim(),
        };
      }
      return { detected: true };
    }
  }
  return { detected: false };
}

/**
 * Analyze query to determine if web search is needed or story writing is requested
 */
export function detectIntent(query: string): QueryIntent {
  const detectedRegions: string[] = [];
  const detectedTopics: string[] = [];
  const searchQueries: string[] = [];

  // Check for story writing intent first (takes priority)
  const storyWriting = detectStoryWriting(query);
  if (storyWriting.detected) {
    return {
      needsWebSearch: false,
      searchQueries: [],
      intentType: 'story_writing',
      detectedRegions: [],
      detectedTopics: [],
      storyWritingDetected: true,
      storySubject: storyWriting.subject,
    };
  }

  // Check for international/regional markers
  for (const marker of INTERNATIONAL_MARKERS) {
    if (marker.pattern.test(query)) {
      detectedRegions.push(marker.region);
      searchQueries.push(...marker.searchTerms);
    }
  }

  // Check for cultural/sensitive topics
  for (const topic of CULTURAL_TOPICS) {
    if (topic.pattern.test(query)) {
      detectedTopics.push(topic.topic);
    }
  }

  // Determine intent type and if web search is needed
  const needsWebSearch = detectedRegions.length > 0 ||
    detectedTopics.some(t => ['cultural_adaptation', 'content_restrictions', 'religious_sensitivity', 'lgbtq_content', 'regulatory'].includes(t));

  let intentType: QueryIntent['intentType'] = 'curriculum';

  if (detectedRegions.length > 0 && detectedTopics.length > 0) {
    intentType = 'cultural_adaptation';
  } else if (detectedRegions.length > 0) {
    intentType = 'international';
  } else if (detectedTopics.includes('regulatory') || detectedTopics.includes('content_restrictions')) {
    intentType = 'policy';
  } else if (detectedTopics.length > 0) {
    intentType = 'general';
  }

  // Build more specific search queries based on detected intent
  if (needsWebSearch && detectedTopics.length > 0) {
    for (const region of detectedRegions) {
      for (const topic of detectedTopics) {
        const topicTerms: Record<string, string> = {
          'cultural_adaptation': 'cultural adaptation education children',
          'religious_sensitivity': 'religious content education guidelines',
          'lgbtq_content': 'LGBTQ content restrictions children education',
          'content_restrictions': 'content censorship education materials',
          'sensitivity': 'cultural sensitivity education',
          'dietary_restrictions': 'dietary restrictions schools halal',
          'holidays': 'holiday celebrations schools cultural',
        };

        if (topicTerms[topic]) {
          searchQueries.push(`${region} ${topicTerms[topic]}`);
        }
      }
    }
  }

  // Deduplicate search queries
  const uniqueQueries = [...new Set(searchQueries)].slice(0, 3);

  return {
    needsWebSearch,
    searchQueries: uniqueQueries,
    intentType,
    detectedRegions,
    detectedTopics,
    storyWritingDetected: false,
  };
}
