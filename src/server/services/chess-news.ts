import { prisma } from '../../lib/prisma.js';
import { config } from '../../lib/config.js';
import { ChessNewsSource } from '@prisma/client';

// ============================================
// Character tie-in mapping
// ============================================

const CHARACTER_KEYWORDS: Record<string, string[]> = {
  'King Chomper': ['king', 'castling', 'check', 'checkmate', 'world champion', 'championship'],
  'Queen Bella': ['queen', 'women', 'powerful', 'attack', 'wgm', 'wim'],
  'Rocky Rook': ['rook', 'castle', 'endgame', 'tower'],
  'Bishop Boing Boing': ['bishop', 'diagonal', 'fianchetto'],
  'Horsey': ['knight', 'fork', 'horse', 'jump'],
  'Paulie Pickle': ['pawn', 'promotion', 'en passant', 'opening'],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  puzzle: ['puzzle', 'tactic', 'tactics', 'problem', 'solve'],
  tournament: ['tournament', 'championship', 'candidates', 'olympiad', 'grand prix', 'match', 'round'],
  education: ['learn', 'lesson', 'beginner', 'tutorial', 'study', 'course', 'training'],
  player: ['grandmaster', 'gm', 'im', 'carlsen', 'nakamura', 'firouzja', 'ding', 'gukesh', 'rating'],
};

function matchCharacter(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [character, keywords] of Object.entries(CHARACTER_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return character;
    }
  }
  return null;
}

function matchCategory(title: string): string | null {
  const lower = title.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }
  return null;
}

// ============================================
// Lichess API
// ============================================

interface LichessBroadcast {
  tour: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    url?: string;
    image?: string;
    createdAt: number;
  };
}

interface LichessPuzzle {
  puzzle: {
    id: string;
    themes: string[];
  };
  game: {
    id: string;
    pgn: string;
    players: Array<{ name?: string; title?: string }>;
  };
}

export async function fetchLichessNews(): Promise<number> {
  let upserted = 0;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (config.lichessApiToken) {
    headers['Authorization'] = `Bearer ${config.lichessApiToken}`;
  }

  // Fetch broadcasts (tournaments)
  try {
    const res = await fetch('https://lichess.org/api/broadcast?nb=5', { headers });
    if (!res.ok) {
      console.error(`[ChessNews] Lichess broadcasts HTTP ${res.status}`);
    } else {
      const broadcasts: LichessBroadcast[] = await res.json();
      for (const b of broadcasts) {
        const title = b.tour.name;
        await prisma.chessNewsItem.upsert({
          where: {
            source_externalId: {
              source: ChessNewsSource.LICHESS,
              externalId: `broadcast-${b.tour.id}`,
            },
          },
          update: { title },
          create: {
            source: ChessNewsSource.LICHESS,
            externalId: `broadcast-${b.tour.id}`,
            title,
            summary: b.tour.description || null,
            url: `https://lichess.org/broadcast/${b.tour.slug}/${b.tour.id}`,
            imageUrl: b.tour.image || null,
            category: 'tournament',
            playerNames: [],
            characterTieIn: matchCharacter(title),
            publishedAt: new Date(b.tour.createdAt),
          },
        });
        upserted++;
      }
    }
  } catch (err) {
    console.error('[ChessNews] Lichess broadcasts fetch failed:', err);
  }

  // Fetch daily puzzle
  try {
    const res = await fetch('https://lichess.org/api/puzzle/daily', { headers });
    if (!res.ok) {
      console.error(`[ChessNews] Lichess daily puzzle HTTP ${res.status}`);
    } else {
      const puzzle: LichessPuzzle = await res.json();
      const themes = puzzle.puzzle.themes.join(', ');
      const title = `Daily Puzzle — ${themes}`;
      const players = puzzle.game.players
        .map((p) => [p.title, p.name].filter(Boolean).join(' '))
        .filter(Boolean);

      await prisma.chessNewsItem.upsert({
        where: {
          source_externalId: {
            source: ChessNewsSource.LICHESS,
            externalId: `puzzle-${puzzle.puzzle.id}`,
          },
        },
        update: { title },
        create: {
          source: ChessNewsSource.LICHESS,
          externalId: `puzzle-${puzzle.puzzle.id}`,
          title,
          summary: `Themes: ${themes}`,
          url: `https://lichess.org/training/${puzzle.puzzle.id}`,
          imageUrl: null,
          category: 'puzzle',
          playerNames: players,
          characterTieIn: matchCharacter(title) || matchCharacter(themes),
          publishedAt: new Date(),
        },
      });
      upserted++;
    }
  } catch (err) {
    console.error('[ChessNews] Lichess daily puzzle fetch failed:', err);
  }

  console.log(`[ChessNews] Lichess: upserted ${upserted} items`);
  return upserted;
}

// ============================================
// Chess.com API
// ============================================

interface ChessComNewsItem {
  id: number;
  title: string;
  url: string;
  published_date: string;
  category?: string;
  short_description?: string;
  thumbnail?: string;
}

export async function fetchChessComNews(): Promise<number> {
  let upserted = 0;

  try {
    const res = await fetch('https://api.chess.com/pub/news', {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      console.error(`[ChessNews] Chess.com news HTTP ${res.status}`);
      return 0;
    }

    const data: { news: ChessComNewsItem[] } = await res.json();
    const items = data.news.slice(0, 10); // Latest 10

    for (const item of items) {
      const title = item.title;
      await prisma.chessNewsItem.upsert({
        where: {
          source_externalId: {
            source: ChessNewsSource.CHESSCOM,
            externalId: String(item.id),
          },
        },
        update: { title },
        create: {
          source: ChessNewsSource.CHESSCOM,
          externalId: String(item.id),
          title,
          summary: item.short_description || null,
          url: item.url,
          imageUrl: item.thumbnail || null,
          category: matchCategory(title) || item.category || null,
          playerNames: [],
          characterTieIn: matchCharacter(title),
          publishedAt: new Date(item.published_date),
        },
      });
      upserted++;
    }
  } catch (err) {
    console.error('[ChessNews] Chess.com news fetch failed:', err);
  }

  console.log(`[ChessNews] Chess.com: upserted ${upserted} items`);
  return upserted;
}

// ============================================
// Combined fetcher + query
// ============================================

export async function fetchAllChessNews(): Promise<number> {
  const [lichess, chesscom] = await Promise.allSettled([
    fetchLichessNews(),
    fetchChessComNews(),
  ]);

  const lichessCount = lichess.status === 'fulfilled' ? lichess.value : 0;
  const chesscomCount = chesscom.status === 'fulfilled' ? chesscom.value : 0;

  if (lichess.status === 'rejected') {
    console.error('[ChessNews] Lichess fetch rejected:', lichess.reason);
  }
  if (chesscom.status === 'rejected') {
    console.error('[ChessNews] Chess.com fetch rejected:', chesscom.reason);
  }

  const total = lichessCount + chesscomCount;
  console.log(`[ChessNews] Total upserted: ${total}`);
  return total;
}

export async function getRecentChessNews(limit = 10) {
  return prisma.chessNewsItem.findMany({
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
}
