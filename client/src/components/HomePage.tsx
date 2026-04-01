import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SparklesIcon, PlayIcon, BookOpenIcon, PhotoIcon, VideoCameraIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { getCharacters, getActivityFeed, getRecentSuggestions, updateSuggestionStatus, getChessNews } from '../lib/api';
import type { CharacterSummary, ActivityEvent, DailySuggestion, ChessNewsItem } from '../lib/types';

const GenerateArtModal = lazy(() => import('./GenerateArtModal'));

function timeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

type FeedFilter = 'all' | 'photos' | 'videos' | 'audio';

function avatarStyle(pos: string | null): React.CSSProperties {
  const parts = (pos || '50% 50% 1').split(' ');
  const x = parts[0] || '50%';
  const y = parts[1] || '50%';
  const s = parseFloat(parts[2]) || 1;
  return {
    objectFit: 'contain',
    objectPosition: `${x} ${y}`,
    transform: s !== 1 ? `scale(${s})` : undefined,
    transformOrigin: s !== 1 ? `${x} ${y}` : undefined,
  };
}

export default function HomePage() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [suggestions, setSuggestions] = useState<DailySuggestion[]>([]);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');
  const [matchedIllustrations, setMatchedIllustrations] = useState<Record<string, Array<{ id: string; illustrationUrl: string | null; name: string }>>>({});
  const [chessNews, setChessNews] = useState<ChessNewsItem[]>([]);

  useEffect(() => {
    getCharacters().then(setCharacters).catch(console.error);
    getActivityFeed(50).then(setActivity).catch(console.error);
    getRecentSuggestions().then(setSuggestions).catch(console.error);
    getChessNews(6).then(setChessNews).catch(console.error);
  }, []);

  useEffect(() => {
    const allIds = suggestions.flatMap(s => s.matchedAssetIds || []).filter(Boolean);
    if (allIds.length === 0) return;
    const unique = [...new Set(allIds)];
    Promise.all(
      unique.map(id =>
        fetch(`/api/illustrations/${id}`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    ).then(results => {
      const byId: Record<string, { id: string; illustrationUrl: string | null; name: string }> = {};
      for (const r of results) {
        if (r) byId[r.id] = { id: r.id, illustrationUrl: r.illustrationUrl, name: r.name };
      }
      const grouped: Record<string, Array<{ id: string; illustrationUrl: string | null; name: string }>> = {};
      for (const s of suggestions) {
        grouped[s.id] = (s.matchedAssetIds || []).map(id => byId[id]).filter(Boolean);
      }
      setMatchedIllustrations(grouped);
    });
  }, [suggestions]);

  const handleArtGenerated = async () => {
    const fresh = await getRecentSuggestions();
    setSuggestions(fresh);
  };

  const filteredActivity = activity.filter((e) => {
    if (feedFilter === 'all') return true;
    if (feedFilter === 'photos') return e.type === 'illustration';
    if (feedFilter === 'videos') return e.type === 'video';
    if (feedFilter === 'audio') return e.type === 'audio';
    return true;
  });

  // Daily progress
  const todaySuggestions = suggestions.filter(s => {
    const sDate = new Date(s.date).toDateString();
    return sDate === new Date().toDateString();
  });
  const postedCount = todaySuggestions.filter(s => s.status === 'USED').length;
  const totalCount = todaySuggestions.length;

  const filters: { key: FeedFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'photos', label: 'Photos' },
    { key: 'videos', label: 'Videos' },
    { key: 'audio', label: 'Audio' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      {/* Header with background image */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/header_bg.png"
            alt=""
            className="w-full h-full object-cover object-center"
            style={{ opacity: 1, filter: 'saturate(1.3) contrast(1.05)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white" />
        </div>
        <div className="relative flex items-center justify-center py-8">
          <img src="/logo.png" alt="Acme Creative" className="h-14 object-contain drop-shadow-lg" />
        </div>
      </div>

      {/* Social media links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-0">
        <div className="flex items-center justify-center gap-3">
          <a href="https://www.instagram.com/acmecreativeofficial/?hl=en" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:border-stc-purple-300 hover:shadow-sm transition-all group" title="Instagram">
            <svg className="w-4.5 h-4.5 text-neutral-500 group-hover:text-[#E4405F] transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
            </svg>
          </a>
          <a href="https://www.facebook.com/AcmeCreativeOfficial/" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:border-stc-purple-300 hover:shadow-sm transition-all group" title="Facebook">
            <svg className="w-4.5 h-4.5 text-neutral-500 group-hover:text-[#1877F2] transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          <a href="https://www.linkedin.com/company/acme-creative-official/?viewAsMember=true" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:border-stc-purple-300 hover:shadow-sm transition-all group" title="LinkedIn">
            <svg className="w-4.5 h-4.5 text-neutral-500 group-hover:text-[#0A66C2] transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
          <a href="https://www.tiktok.com/@acmecreative" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:border-stc-purple-300 hover:shadow-sm transition-all group" title="TikTok">
            <svg className="w-4.5 h-4.5 text-neutral-500 group-hover:text-neutral-900 transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
            </svg>
          </a>
          <a href="https://x.com/acmecreative" target="_blank" rel="noopener noreferrer"
            className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:border-stc-purple-300 hover:shadow-sm transition-all group" title="X (Twitter)">
            <svg className="w-4 h-4 text-neutral-500 group-hover:text-neutral-900 transition-colors" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Main content: Sidebar + Feed */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Mobile: horizontal character strip */}
        <div className="lg:hidden mb-4">
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            {characters.map((char) => (
              <button
                key={char.id}
                onClick={() => navigate(`/characters/${char.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-neutral-200
                  hover:border-stc-purple-300 hover:bg-stc-purple-50/50 transition-all whitespace-nowrap min-h-[36px] shrink-0"
              >
                {char.thumbnailUrl ? (
                  <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                    <img src={char.thumbnailUrl} alt="" className="w-full h-full" style={avatarStyle(char.avatarPosition)} />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-stc-purple-100 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-stc-purple-500">{char.name.charAt(0)}</span>
                  </div>
                )}
                <span className="text-xs font-medium text-neutral-700">{char.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-6">
          {/* Left Sidebar — desktop only */}
          <aside className="hidden lg:block w-60 shrink-0">
            <div className="space-y-0">
              {/* Characters */}
              <div className="bg-white rounded-xl border border-neutral-100 p-4">
                <div className="mb-3">
                  <Link to="/characters" className="text-xs font-semibold text-neutral-500 uppercase tracking-wider hover:text-stc-purple-600 transition-colors">Characters</Link>
                </div>

                <div className="space-y-0.5">
                  {characters.map((char) => (
                    <button
                      key={char.id}
                      onClick={() => navigate(`/characters/${char.id}`)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-stc-purple-50/50 transition-colors text-left group"
                    >
                      {char.thumbnailUrl ? (
                        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                          <img src={char.thumbnailUrl} alt="" className="w-full h-full" style={avatarStyle(char.avatarPosition)} />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-stc-purple-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-stc-purple-500">{char.name.charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-sm font-medium text-neutral-700 group-hover:text-stc-purple-600 transition-colors truncate">{char.name}</span>
                      {(char.illustrationCount > 0) && (
                        <span className="ml-auto text-xs text-neutral-400 shrink-0">{char.illustrationCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Center Feed */}
          <main className="flex-1 min-w-0">
            {/* Filter tabs */}
            <div className="flex gap-1 mb-4">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFeedFilter(f.key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[36px] ${
                    feedFilter === f.key
                      ? 'bg-stc-purple-500 text-white'
                      : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Feed cards */}
            <div className="space-y-3">
              {/* Daily progress indicator */}
              {feedFilter === 'all' && totalCount > 0 && (
                <div className="flex items-center gap-3 bg-white rounded-xl border border-neutral-100 px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-neutral-700">Today's Posts</span>
                      <span className="text-xs font-bold text-stc-purple-600">{postedCount} of {totalCount}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${totalCount > 0 ? (postedCount / totalCount) * 100 : 0}%`,
                          background: postedCount === totalCount
                            ? 'linear-gradient(90deg, #34B256, #2a9248)'
                            : 'linear-gradient(90deg, #6A469D, #5A3B85)',
                        }}
                      />
                    </div>
                  </div>
                  {postedCount === totalCount && totalCount > 0 && (
                    <span className="text-stc-green text-sm font-medium">All done!</span>
                  )}
                </div>
              )}

              {/* AI Suggestion cards (pinned to top) */}
              {feedFilter === 'all' && suggestions.map((s) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  onStatusChange={async (id, status) => {
                    const updated = await updateSuggestionStatus(id, status);
                    setSuggestions(prev => prev.map(p => p.id === id ? updated : p));
                  }}
                  onArtGenerated={handleArtGenerated}
                  matchedIllustrations={matchedIllustrations[s.id]}
                />
              ))}

              {/* Activity cards */}
              {filteredActivity.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-xl border border-neutral-100">
                  <p className="text-sm text-neutral-400">No activity yet</p>
                </div>
              ) : (
                filteredActivity.map((event) => (
                  <ActivityCard key={event.id} event={event} />
                ))
              )}
            </div>
          </main>

          {/* Chess News — right sidebar, desktop only */}
          {chessNews.length > 0 && (
            <aside className="hidden xl:block w-72 shrink-0">
              <div className="bg-white rounded-xl border border-neutral-100 p-4 sticky top-4">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="text-base">&#9823;</span> Chess News
                </h3>
                <div className="space-y-3">
                  {chessNews.map(item => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <p className="text-sm font-medium text-neutral-800 group-hover:text-stc-purple-600 transition-colors leading-snug">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-medium text-neutral-400 uppercase">
                          {item.source === 'LICHESS' ? 'Lichess' : item.source === 'CHESSCOM' ? 'Chess.com' : 'FIDE'}
                        </span>
                        {item.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
                            {item.category}
                          </span>
                        )}
                        {item.characterTieIn && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stc-purple-50 text-stc-purple-600 font-medium">
                            {item.characterTieIn}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---- Suggestion Card ---- */

const PERSONA_LABELS: Record<string, { emoji: string; label: string }> = {
  PARENT: { emoji: '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67', label: 'Parents' },
  SCHOOL: { emoji: '\uD83C\uDFEB', label: 'Schools' },
  FRANCHISE: { emoji: '\uD83D\uDE80', label: 'Franchisees' },
  TUTOR: { emoji: '\uD83C\uDFD3', label: 'Tutors' },
  EDUCATOR: { emoji: '\uD83D\uDCDA', label: 'Educators' },
  HOMESCHOOL: { emoji: '\uD83C\uDFE0', label: 'Homeschool' },
  GRANDPARENT: { emoji: '\uD83D\uDC74', label: 'Grandparents' },
  AFTERSCHOOL: { emoji: '\u2B50', label: 'After-School' },
  CHESS: { emoji: '\u265F\uFE0F', label: 'Chess Fans' },
  MIXED: { emoji: '\uD83C\uDF1F', label: 'Everyone' },
};

const PLATFORM_LINKS: Record<string, { url: string; color: string; icon: React.ReactNode }> = {
  instagram: {
    url: 'https://www.instagram.com/acmecreativeofficial/',
    color: '#E4405F',
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>,
  },
  facebook: {
    url: 'https://www.facebook.com/AcmeCreativeOfficial/',
    color: '#1877F2',
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  },
  tiktok: {
    url: 'https://www.tiktok.com/@acmecreative',
    color: '#000000',
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  },
  linkedin: {
    url: 'https://www.linkedin.com/company/acme-creative-official/',
    color: '#0A66C2',
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
  },
  twitter: {
    url: 'https://x.com/acmecreative',
    color: '#000000',
    icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>,
  },
};

function SuggestionCard({ suggestion: s, onStatusChange, onArtGenerated, matchedIllustrations }: {
  suggestion: DailySuggestion;
  onStatusChange: (id: string, status: 'USED' | 'SKIPPED' | 'SUGGESTED') => void;
  onArtGenerated?: () => void;
  matchedIllustrations?: Array<{ id: string; illustrationUrl: string | null; name: string }>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAlt, setShowAlt] = useState(false);
  const persona = PERSONA_LABELS[s.persona] || PERSONA_LABELS.MIXED;
  const altPersona = s.altPersona ? PERSONA_LABELS[s.altPersona] : null;

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  if (s.status === 'SKIPPED') {
    return (
      <div className="bg-neutral-50 rounded-xl border border-neutral-100 p-4 opacity-60">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500 line-through">{s.title}</p>
          <button
            onClick={() => onStatusChange(s.id, 'SUGGESTED')}
            className="text-xs text-stc-purple-600 hover:text-stc-purple-700 font-medium"
          >
            Restore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${
      s.status === 'USED'
        ? 'bg-stc-green/10/50 border-stc-green/20'
        : 'bg-gradient-to-br from-stc-purple-50 to-indigo-50 border-stc-purple-100'
    }`}>
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-stc-purple-500 text-white flex items-center justify-center shrink-0">
            <SparklesIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900">{s.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-neutral-400">
                {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs text-neutral-300">·</span>
              <span className="text-xs text-neutral-500">
                {persona.emoji} {persona.label}
              </span>
              {altPersona && (
                <span className="text-xs text-neutral-400">
                  {altPersona.emoji} Alt: {altPersona.label}
                </span>
              )}
            </div>
          </div>
        </div>
        {s.status === 'USED' && (
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-stc-green/15 text-stc-green text-[10px] font-semibold uppercase">Posted</span>
        )}
      </div>

      {/* Caption */}
      <div className="px-4 pb-3">
        <div className="bg-white/70 rounded-lg p-3 mb-2">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-[10px] font-semibold text-neutral-500 uppercase">Facebook / Instagram</p>
            <button
              onClick={() => copyText(s.caption, 'caption')}
              className="text-[10px] font-medium text-stc-purple-600 hover:text-stc-purple-700 shrink-0"
            >
              {copied === 'caption' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{s.caption}</p>
        </div>

        {s.captionTikTok && (
          <div className="bg-white/70 rounded-lg p-3 mb-2">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase">TikTok</p>
              <button
                onClick={() => copyText(s.captionTikTok!, 'tiktok')}
                className="text-[10px] font-medium text-stc-purple-600 hover:text-stc-purple-700 shrink-0"
              >
                {copied === 'tiktok' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{s.captionTikTok}</p>
          </div>
        )}

        {s.captionLinkedIn && (
          <div className="bg-white/70 rounded-lg p-3 mb-2">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase">LinkedIn</p>
              <button
                onClick={() => copyText(s.captionLinkedIn!, 'linkedin')}
                className="text-[10px] font-medium text-stc-purple-600 hover:text-stc-purple-700 shrink-0"
              >
                {copied === 'linkedin' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{s.captionLinkedIn}</p>
          </div>
        )}

        {/* Alt persona caption (expandable) */}
        {s.altCaption && altPersona && (
          <div className="mb-2">
            <button
              onClick={() => setShowAlt(!showAlt)}
              className="text-xs text-stc-purple-600 hover:text-stc-purple-700 font-medium"
            >
              {showAlt ? 'Hide' : 'Show'} {altPersona.emoji} {altPersona.label} version
            </button>
            {showAlt && (
              <div className="bg-white/70 rounded-lg p-3 mt-1.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[10px] font-semibold text-neutral-500 uppercase">{altPersona.label} Version</p>
                  <button
                    onClick={() => copyText(s.altCaption!, 'alt')}
                    className="text-[10px] font-medium text-stc-purple-600 hover:text-stc-purple-700 shrink-0"
                  >
                    {copied === 'alt' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed">{s.altCaption}</p>
              </div>
            )}
          </div>
        )}

        {/* Hashtags */}
        {s.hashtags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            {s.hashtags.map((tag, i) => (
              <span key={i} className="text-xs text-stc-purple-600 font-medium">#{tag.replace(/^#/, '')}</span>
            ))}
            <button
              onClick={() => copyText(s.hashtags.map(t => `#${t.replace(/^#/, '')}`).join(' '), 'hashtags')}
              className="text-[10px] text-neutral-400 hover:text-stc-purple-600 font-medium ml-1"
            >
              {copied === 'hashtags' ? 'Copied!' : 'Copy all'}
            </button>
          </div>
        )}

        {/* Brief */}
        <div className="bg-stc-orange/10/60 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] font-semibold text-stc-orange uppercase mb-0.5">Why this works</p>
          <p className="text-xs text-neutral-700 leading-relaxed">{s.brief}</p>
        </div>

        {/* Chess news tie-in */}
        {s.chessNewsHeadline && (
          <div className="bg-stc-blue/10/60 rounded-lg px-3 py-2 mb-3">
            <p className="text-[10px] font-semibold text-stc-navy uppercase mb-0.5 flex items-center gap-1">
              <span>&#9823;</span> Chess News Tie-In
            </p>
            <p className="text-xs text-stc-navy font-medium">{s.chessNewsHeadline}</p>
            {s.chessNewsTieIn && <p className="text-xs text-stc-navy mt-0.5">{s.chessNewsTieIn}</p>}
          </div>
        )}

        {/* Characters */}
        {s.characterNames.length > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] text-neutral-500 font-medium">Featuring:</span>
            {s.characterNames.map((name, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-white border border-neutral-200 text-neutral-700 font-medium">{name}</span>
            ))}
          </div>
        )}

        {/* Matched asset thumbnails */}
        {matchedIllustrations && matchedIllustrations.length > 0 && (
          <div className="flex gap-2 mb-3">
            {matchedIllustrations.map(ill => (
              ill.illustrationUrl && (
                <div key={ill.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-neutral-200 group">
                  <img src={ill.illustrationUrl} alt={ill.name} className="w-full h-full object-cover" />
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await fetch(`/api/suggestions/${s.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: s.status, removeAssetId: ill.id }),
                        });
                        onArtGenerated?.();
                      } catch (err) {
                        console.error('Remove thumbnail failed:', err);
                      }
                    }}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/50 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              )
            ))}
          </div>
        )}

        {/* Platform buttons + actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {s.generationPrompts && Array.isArray(s.generationPrompts) && (s.generationPrompts as unknown[]).length > 0 && (
              <button
                onClick={() => setShowGenerateModal(true)}
                className="px-3 py-1.5 rounded-lg bg-stc-purple-100 text-stc-purple-700 text-xs font-medium hover:bg-stc-purple-200 transition-colors min-h-[32px] flex items-center gap-1.5"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                Generate Art
              </button>
            )}
            {s.recommendedPlatforms.map((platform) => {
              const p = PLATFORM_LINKS[platform];
              return p ? (
                <a
                  key={platform}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center hover:border-neutral-300 hover:shadow-sm transition-all text-neutral-400 hover:text-neutral-600"
                  style={{ ['--hover-color' as string]: p.color }}
                  onMouseEnter={e => (e.currentTarget.querySelector('svg') as SVGElement)?.style.setProperty('color', p.color)}
                  onMouseLeave={e => (e.currentTarget.querySelector('svg') as SVGElement)?.style.removeProperty('color')}
                  title={platform}
                >
                  {p.icon}
                </a>
              ) : (
                <span key={platform} className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-600">
                  {platform}
                </span>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {s.status !== 'USED' && (
              <>
                <button
                  onClick={() => onStatusChange(s.id, 'USED')}
                  className="px-3 py-1.5 rounded-lg bg-stc-green text-white text-xs font-medium hover:bg-stc-green transition-colors min-h-[32px]"
                >
                  Mark Posted
                </button>
                <button
                  onClick={() => onStatusChange(s.id, 'SKIPPED')}
                  className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-500 text-xs font-medium hover:bg-neutral-50 transition-colors min-h-[32px]"
                >
                  Skip
                </button>
              </>
            )}
            {s.status === 'USED' && (
              <button
                onClick={() => onStatusChange(s.id, 'SUGGESTED')}
                className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 text-neutral-500 text-xs font-medium hover:bg-neutral-50 transition-colors min-h-[32px]"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      </div>

      {showGenerateModal && (
        <Suspense fallback={null}>
          <GenerateArtModal
            suggestion={s}
            onClose={() => setShowGenerateModal(false)}
            onGenerated={() => {
              onArtGenerated?.();
              setShowGenerateModal(false);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ---- Feed Card ---- */

function ActivityCard({ event }: { event: ActivityEvent }) {
  const [caption, setCaption] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateCaption = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/suggestions/quick-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: event.title, characterName: event.characterName, type: event.type }),
      });
      if (res.ok) {
        const data = await res.json();
        setCaption(data.caption);
      }
    } catch (err) {
      console.error('Caption generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const copyCaption = () => {
    if (caption) {
      navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const typeConfig: Record<string, { icon: React.ReactNode; bg: string; color: string; label: string }> = {
    illustration: { icon: <ImageIcon />, bg: 'bg-stc-orange/10', color: 'text-stc-orange', label: 'New illustration' },
    video: { icon: <VideoIcon />, bg: 'bg-stc-pink/10', color: 'text-stc-pink', label: 'New video' },
    audio: { icon: <MicIcon />, bg: 'bg-stc-green/10', color: 'text-stc-green', label: 'New audio' },
    lesson: { icon: <BookIcon />, bg: 'bg-stc-blue/10', color: 'text-stc-blue', label: 'Lesson update' },
  };

  const config = typeConfig[event.type] || typeConfig.lesson;
  const linkTo = event.type === 'video' ? `/video/${event.id.replace('vid-', '')}` :
                 event.type === 'audio' ? `/audio/${event.id.replace('aud-', '')}` :
                 event.type === 'illustration' ? `/images/${event.id.replace('ill-', '')}` :
                 undefined;

  return (
    <div className="bg-white rounded-xl border border-neutral-100 overflow-hidden hover:shadow-sm transition-shadow">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`w-8 h-8 rounded-lg ${config.bg} ${config.color} flex items-center justify-center`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900">
            {config.label}
            {event.characterName && (
              <span className="text-neutral-500 font-normal"> — {event.characterName}</span>
            )}
          </p>
          <p className="text-xs text-neutral-400">
            {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {' · '}
            {timeAgo(event.timestamp)}
          </p>
        </div>
      </div>

      {/* Thumbnail */}
      {event.thumbnailUrl && event.type !== 'audio' && (
        <div className="relative">
          {linkTo ? (
            <Link to={linkTo} className="block">
              <img
                src={event.thumbnailUrl}
                alt={event.title}
                className="w-full max-h-80 object-cover hover:opacity-95 transition-opacity"
              />
              {event.type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                    <PlayIcon className="w-6 h-6 text-white ml-0.5" />
                  </div>
                </div>
              )}
            </Link>
          ) : (
            <img
              src={event.thumbnailUrl}
              alt={event.title}
              className="w-full max-h-80 object-cover"
            />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-neutral-50">
        <p className="text-sm font-medium text-neutral-700">{event.title}</p>
      </div>

      {/* Quick caption */}
      <div className="px-4 pb-2.5 flex items-center gap-2">
        {!caption ? (
          <button
            onClick={generateCaption}
            disabled={generating}
            className="text-xs text-stc-purple-600 hover:text-stc-purple-700 font-medium disabled:opacity-50 min-h-[44px] flex items-center"
          >
            {generating ? 'Generating...' : 'Quick Caption'}
          </button>
        ) : (
          <div className="flex-1 flex items-start gap-2">
            <p className="flex-1 text-xs text-neutral-600 italic leading-relaxed">{caption}</p>
            <button
              onClick={copyCaption}
              className="text-[10px] font-medium text-stc-purple-600 hover:text-stc-purple-700 shrink-0 min-h-[44px] flex items-center"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Icons ---- */

function BookIcon() {
  return <BookOpenIcon className="w-3.5 h-3.5" />;
}

function ImageIcon() {
  return <PhotoIcon className="w-3.5 h-3.5" />;
}

function VideoIcon() {
  return <VideoCameraIcon className="w-3.5 h-3.5" />;
}

function MicIcon() {
  return <MicrophoneIcon className="w-3.5 h-3.5" />;
}
