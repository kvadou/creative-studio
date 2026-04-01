import { Router, Request, Response } from 'express';

// Import static data
import chessBooks from '../../data/chess-books.json' assert { type: 'json' };
import tacticalThemes from '../../data/tactical-themes.json' assert { type: 'json' };
import openings from '../../data/openings.json' assert { type: 'json' };
import famousPlayers from '../../data/famous-players.json' assert { type: 'json' };

const router = Router();

// ============================================
// Famous Chess Players (Static)
// ============================================

interface FamousPlayer {
  id: string;
  name: string;
  fullName: string;
  country: string;
  title: string | null;
  years: string;
  peakRating: number;
  worldChampion: boolean;
  style: string;
  bio: string;
  teachingFocus: string[];
}

// Search famous players by name
router.get('/players', (req: Request, res: Response) => {
  const { term } = req.query;

  if (!term || typeof term !== 'string' || term.length < 2) {
    return res.json([]);
  }

  const searchLower = term.toLowerCase();
  const results = (famousPlayers as FamousPlayer[]).filter((p) =>
    p.name.toLowerCase().includes(searchLower) ||
    p.fullName.toLowerCase().includes(searchLower)
  );

  // Map to simpler format for dropdown
  const players = results.map((p) => ({
    id: p.id,
    name: p.name,
    title: p.title,
    country: p.country,
    worldChampion: p.worldChampion,
  }));

  return res.json(players);
});

// Get full player profile
router.get('/players/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const player = (famousPlayers as FamousPlayer[]).find((p) => p.id === id);

  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Format profile to match expected interface
  const profile = {
    id: player.id,
    username: player.id, // For compatibility
    title: player.title,
    name: player.name,
    fullName: player.fullName,
    country: player.country,
    bio: player.bio,
    fideRating: player.peakRating,
    worldChampion: player.worldChampion,
    years: player.years,
    style: player.style,
    teachingFocus: player.teachingFocus,
    ratings: {
      blitz: null,
      rapid: null,
      classical: null,
    },
  };

  return res.json(profile);
});

// ============================================
// Chess Books (Static)
// ============================================

router.get('/books', (req: Request, res: Response) => {
  const { search } = req.query;

  let results = chessBooks;

  if (search && typeof search === 'string') {
    const searchLower = search.toLowerCase();
    results = chessBooks.filter((book) =>
      book.title.toLowerCase().includes(searchLower) ||
      book.author.toLowerCase().includes(searchLower) ||
      book.concepts.some((c) => c.toLowerCase().includes(searchLower))
    );
  }

  return res.json(results);
});

router.get('/books/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const book = chessBooks.find((b) => b.id === id);

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  return res.json(book);
});

// ============================================
// Tactical Themes (Static)
// ============================================

router.get('/tactics', (_req: Request, res: Response) => {
  return res.json(tacticalThemes);
});

router.get('/tactics/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const theme = tacticalThemes.find((t) => t.id === id);

  if (!theme) {
    return res.status(404).json({ error: 'Tactical theme not found' });
  }

  return res.json(theme);
});

// ============================================
// Openings (Static + Lichess fallback)
// ============================================

router.get('/openings', (req: Request, res: Response) => {
  const { search, eco } = req.query;

  let results = openings;

  if (search && typeof search === 'string') {
    const searchLower = search.toLowerCase();
    results = openings.filter((op) =>
      op.name.toLowerCase().includes(searchLower) ||
      op.eco.toLowerCase().includes(searchLower) ||
      op.moves.toLowerCase().includes(searchLower)
    );
  }

  if (eco && typeof eco === 'string') {
    results = results.filter((op) => op.eco.startsWith(eco.toUpperCase()));
  }

  return res.json(results);
});

router.get('/openings/:eco', (req: Request, res: Response) => {
  const { eco } = req.params;
  const opening = openings.find((op) => op.eco === eco.toUpperCase());

  if (!opening) {
    return res.status(404).json({ error: 'Opening not found' });
  }

  return res.json(opening);
});

export default router;
