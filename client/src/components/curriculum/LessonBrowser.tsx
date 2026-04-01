import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, XMarkIcon, ExclamationCircleIcon, ChevronRightIcon, PhotoIcon, PlayIcon as PlayIconOutline, BookOpenIcon } from '@heroicons/react/24/outline';
import type { ModuleWithLessonCounts, LessonCharacterRef } from '../../lib/types';
import { getLessonsWithCounts } from '../../lib/api';

function ageLabel(ageGroup: string | null): string {
  if (!ageGroup) return '';
  const match = ageGroup.match(/(\d+)-(\d+)/);
  if (match) return `Ages ${match[1]}-${match[2]}`;
  return ageGroup;
}

function termLabel(term: string | null): string {
  if (!term) return '';
  return `Term ${term}`;
}

function conceptLabel(key: string): string {
  return key
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden animate-pulse">
      <div className="px-5 py-4 border-b border-neutral-200">
        <div className="h-5 bg-neutral-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-neutral-200 rounded w-1/3" />
      </div>
      <div className="px-5 py-3 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="h-4 bg-neutral-200 rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-neutral-200 rounded-full" />
              <div className="h-5 w-16 bg-neutral-200 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LessonBrowser() {
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleWithLessonCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [selectedConcept, setSelectedConcept] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const data = await getLessonsWithCounts();
        if (cancelled) return;
        setModules(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lessons');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Derive unique characters and chess concepts from all lessons
  const { allCharacters, allConcepts } = useMemo(() => {
    const charMap = new Map<string, LessonCharacterRef>();
    const conceptSet = new Set<string>();

    for (const mod of modules) {
      for (const lesson of mod.lessons) {
        if (lesson.chessConceptKey) conceptSet.add(lesson.chessConceptKey);
        for (const ch of lesson.characters) {
          if (!charMap.has(ch.id)) charMap.set(ch.id, ch);
        }
      }
    }

    return {
      allCharacters: Array.from(charMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      allConcepts: Array.from(conceptSet).sort(),
    };
  }, [modules]);

  // Filter modules and lessons
  const filteredModules = useMemo(() => {
    const q = search.toLowerCase().trim();

    return modules
      .map((mod) => {
        const filteredLessons = mod.lessons.filter((lesson) => {
          // Text search
          if (q) {
            const matchesLesson = lesson.title.toLowerCase().includes(q);
            const matchesModule =
              mod.title.toLowerCase().includes(q) || mod.code.toLowerCase().includes(q);
            const matchesConcept = lesson.chessConceptKey?.toLowerCase().includes(q);
            if (!matchesLesson && !matchesModule && !matchesConcept) return false;
          }

          // Character filter
          if (selectedCharacter) {
            const hasChar = lesson.characters.some((c) => c.id === selectedCharacter);
            if (!hasChar) return false;
          }

          // Chess concept filter
          if (selectedConcept) {
            if (lesson.chessConceptKey !== selectedConcept) return false;
          }

          return true;
        });

        return { ...mod, lessons: filteredLessons };
      })
      .filter((mod) => mod.lessons.length > 0);
  }, [modules, search, selectedCharacter, selectedConcept]);

  // Total lesson count
  const totalLessons = useMemo(
    () => modules.reduce((sum, m) => sum + m.lessons.length, 0),
    [modules]
  );
  const filteredLessonCount = useMemo(
    () => filteredModules.reduce((sum, m) => sum + m.lessons.length, 0),
    [filteredModules]
  );

  const hasActiveFilters = search || selectedCharacter || selectedConcept;

  // Auto-expand all modules when filtering
  useEffect(() => {
    if (hasActiveFilters) {
      setExpandedModules(new Set(filteredModules.map((m) => m.id)));
    }
  }, [hasActiveFilters, filteredModules]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCharacter('');
    setSelectedConcept('');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Browse Lessons</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Explore curriculum modules, characters, and chess concepts
            </p>
          </div>
          {!loading && !error && (
            <span className="text-xs text-neutral-400">
              {hasActiveFilters
                ? `${filteredLessonCount} of ${totalLessons} lessons`
                : `${totalLessons} lessons`}
            </span>
          )}
        </div>

        {/* Search + Filters */}
        {!loading && !error && modules.length > 0 && (
          <div className="space-y-3">
            {/* Search bar */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lessons, modules, or concepts..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-neutral-200 text-sm bg-neutral-50 shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 focus:bg-white
                  placeholder:text-neutral-400 transition-all min-h-[44px]"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  aria-label="Clear search"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Character filter */}
              {allCharacters.length > 0 && (
                <select
                  value={selectedCharacter}
                  onChange={(e) => setSelectedCharacter(e.target.value)}
                  className="bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-stc-purple-100 shadow-sm min-w-[160px] min-h-[44px]"
                >
                  <option value="">All Characters</option>
                  {allCharacters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.name}
                      {ch.piece ? ` (${ch.piece})` : ''}
                    </option>
                  ))}
                </select>
              )}

              {/* Chess concept filter */}
              {allConcepts.length > 0 && (
                <select
                  value={selectedConcept}
                  onChange={(e) => setSelectedConcept(e.target.value)}
                  className="bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-stc-purple-100 shadow-sm min-w-[160px] min-h-[44px]"
                >
                  <option value="">All Chess Concepts</option>
                  {allConcepts.map((c) => (
                    <option key={c} value={c}>
                      {conceptLabel(c)}
                    </option>
                  ))}
                </select>
              )}

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-stc-purple-500 hover:text-stc-purple-700 font-medium flex items-center gap-1"
                >
                  <XMarkIcon className="w-4 h-4" />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-white rounded-2xl shadow-card p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-stc-pink/15 flex items-center justify-center mx-auto mb-4">
              <ExclamationCircleIcon className="w-7 h-7 text-stc-pink" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">Something went wrong</h2>
            <p className="text-neutral-500 text-sm">{error}</p>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Module Accordion Cards */}
        {!loading && !error && (
          <div className="space-y-4">
            {filteredModules.map((mod) => {
              const isExpanded = expandedModules.has(mod.id);
              const totalImages = mod.lessons.reduce((sum, l) => sum + l._count.illustrations, 0);
              const totalVideos = mod.lessons.reduce((sum, l) => sum + l._count.videos, 0);

              return (
                <div
                  key={mod.id}
                  className="bg-white rounded-2xl shadow-card overflow-hidden transition-shadow hover:shadow-card-hover"
                >
                  {/* Module Header */}
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="w-full text-left px-5 py-4 flex items-start gap-3 min-h-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-stc-purple-400 focus-visible:ring-offset-2 rounded-t-2xl"
                    aria-expanded={isExpanded}
                  >
                    {/* Chevron */}
                    <ChevronRightIcon
                      className={`w-5 h-5 text-stc-purple-400 mt-0.5 shrink-0 transition-transform duration-200 ${
                        isExpanded ? 'rotate-90' : ''
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-semibold text-neutral-900 truncate">
                          {mod.code}
                        </h2>
                        <span className="text-neutral-500 text-sm font-normal">
                          {mod.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-400">
                        {mod.ageGroup && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-stc-orange/10 text-stc-orange font-medium text-[11px]">
                            {ageLabel(mod.ageGroup)}
                          </span>
                        )}
                        {mod.term && <span>{termLabel(mod.term)}</span>}
                        <span aria-hidden="true">&bull;</span>
                        <span>{mod.lessons.length} lesson{mod.lessons.length !== 1 ? 's' : ''}</span>
                        {totalImages > 0 && (
                          <>
                            <span aria-hidden="true">&bull;</span>
                            <span>{totalImages} image{totalImages !== 1 ? 's' : ''}</span>
                          </>
                        )}
                        {totalVideos > 0 && (
                          <>
                            <span aria-hidden="true">&bull;</span>
                            <span>{totalVideos} video{totalVideos !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Lesson List */}
                  {isExpanded && (
                    <div className="border-t border-neutral-200">
                      {mod.lessons.length === 0 ? (
                        <div className="px-5 py-6 text-center text-neutral-400 text-sm">
                          No lessons in this module
                        </div>
                      ) : (
                        <ul>
                          {mod.lessons.map((lesson, idx) => (
                            <li key={lesson.id}>
                              <button
                                onClick={() => navigate(`/lesson/${mod.code}/${lesson.lessonNumber}`)}
                                className={`w-full text-left px-5 py-3 flex items-start justify-between gap-3 min-h-[48px] hover:bg-stc-purple-50 active:bg-stc-purple-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stc-purple-400 ${
                                  idx < mod.lessons.length - 1 ? 'border-b border-neutral-50' : ''
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-stc-purple-500 font-semibold text-sm tabular-nums shrink-0">
                                      {lesson.lessonNumber}.
                                    </span>
                                    <span className="text-neutral-800 text-sm font-medium">
                                      {lesson.title}
                                    </span>
                                  </div>

                                  {/* Character pills + concept badge */}
                                  {(lesson.characters.length > 0 || lesson.chessConceptKey) && (
                                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5 ml-6">
                                      {lesson.chessConceptKey && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-stc-green/10 text-stc-green text-[11px] font-medium">
                                          {conceptLabel(lesson.chessConceptKey)}
                                        </span>
                                      )}
                                      {lesson.characters.map((ch) => (
                                        <span
                                          key={ch.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/characters/${ch.id}`);
                                          }}
                                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-stc-purple-50 text-stc-purple-600 text-[11px] font-medium hover:bg-stc-purple-100 cursor-pointer transition-colors"
                                          role="link"
                                          tabIndex={0}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              navigate(`/characters/${ch.id}`);
                                            }
                                          }}
                                        >
                                          {ch.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                  {lesson._count.illustrations > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stc-purple-50 text-stc-purple-600 text-xs font-medium">
                                      <PhotoIcon className="w-3.5 h-3.5" />
                                      {lesson._count.illustrations}
                                    </span>
                                  )}
                                  {lesson._count.videos > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stc-blue/10 text-stc-blue text-xs font-medium">
                                      <PlayIconOutline className="w-3.5 h-3.5" />
                                      {lesson._count.videos}
                                    </span>
                                  )}
                                  {/* Right arrow */}
                                  <ChevronRightIcon className="w-4 h-4 text-neutral-300" />
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No results after filtering */}
            {filteredModules.length === 0 && hasActiveFilters && (
              <div className="bg-white rounded-2xl shadow-card p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <MagnifyingGlassIcon className="w-7 h-7 text-neutral-400" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-900 mb-1">No matching lessons</h2>
                <p className="text-neutral-500 text-sm mb-4">Try adjusting your search or filters.</p>
                <button
                  onClick={clearFilters}
                  className="text-sm text-stc-purple-500 hover:text-stc-purple-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Empty state — no data at all */}
            {modules.length === 0 && !hasActiveFilters && (
              <div className="bg-white rounded-2xl shadow-card p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <BookOpenIcon className="w-7 h-7 text-neutral-400" />
                </div>
                <h2 className="text-lg font-semibold text-neutral-900 mb-1">No modules found</h2>
                <p className="text-neutral-500 text-sm">Curriculum data hasn't been ingested yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
