import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, BookOpenIcon, PhotoIcon, MicrophoneIcon, StarIcon } from '@heroicons/react/24/outline';
import { getCharacters } from '../../lib/api';
import type { CharacterSummary } from '../../lib/types';

export default function CharactersPage() {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getCharacters()
      .then(setCharacters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? characters.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : characters;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Characters</h1>
          <p className="text-neutral-500 mt-1">The cast of Acme Creative</p>
        </div>
        <button
          onClick={() => navigate('/characters/new')}
          className="px-4 py-2 rounded-xl bg-stc-purple-500 text-white text-sm font-medium hover:bg-stc-purple-600 transition-colors min-h-[44px] shrink-0"
        >
          + Add Character
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search characters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 transition"
          />
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-neutral-400">
          {search ? 'No characters match your search' : 'No characters found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-neutral-200 border border-neutral-200 rounded-2xl overflow-hidden">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/characters/${c.id}`)}
              className="flex items-center gap-4 p-4 bg-white text-left hover:bg-stc-purple-50/40 transition-colors group"
            >
              {/* Thumbnail */}
              {c.thumbnailUrl ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  <img
                    src={c.thumbnailUrl}
                    alt={c.name}
                    className="w-full h-full"
                    style={(() => {
                      const parts = (c.avatarPosition || '50% 50% 1').split(' ');
                      const x = parts[0] || '50%';
                      const y = parts[1] || '50%';
                      const s = parseFloat(parts[2]) || 1;
                      return {
                        objectFit: 'contain' as const,
                        objectPosition: `${x} ${y}`,
                        transform: s !== 1 ? `scale(${s})` : undefined,
                        transformOrigin: s !== 1 ? `${x} ${y}` : undefined,
                      };
                    })()}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-stc-purple-50 flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-stc-purple-300">
                    {c.name.charAt(0)}
                  </span>
                </div>
              )}

              <div className="min-w-0 flex-1">
                {/* Name + piece */}
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900 group-hover:text-stc-purple-600 transition-colors truncate">
                    {c.name}
                  </h3>
                  {c.piece && (
                    <span className="px-1.5 py-0.5 rounded-full bg-stc-purple-100 text-stc-purple-700 text-[10px] font-medium shrink-0">
                      {c.piece}
                    </span>
                  )}
                </div>

                {/* Trait */}
                {c.trait && (
                  <p className="mt-0.5 text-xs text-neutral-500 truncate">
                    {c.trait}
                  </p>
                )}

                {/* Count badges */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {c.lessonCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-stc-blue font-medium">
                      <BookOpenIcon className="w-3 h-3" />
                      {c.lessonCount}
                    </span>
                  )}
                  {c.illustrationCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-stc-orange font-medium">
                      <PhotoIcon className="w-3 h-3" />
                      {c.illustrationCount}
                    </span>
                  )}
                  {c.voiceCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-stc-green font-medium">
                      <MicrophoneIcon className="w-3 h-3" />
                      {c.voiceCount}
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                    (c.goldStandardCount || 0) > 0 ? 'text-amber-600' : 'text-neutral-400'
                  }`}>
                    <StarIcon className="w-3 h-3" />
                    {c.goldStandardCount || 0}/5
                  </span>
                  {c.hasTpose && (
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold">
                      T
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
