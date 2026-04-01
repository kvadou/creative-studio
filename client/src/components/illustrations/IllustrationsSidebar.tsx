import { useState, useEffect } from 'react';
import { Squares2X2Icon, ChevronRightIcon, TagIcon, ClockIcon, PhotoIcon } from '@heroicons/react/24/outline';
import type { CharacterSummary, ModuleWithLessonCounts } from '../../lib/types';
import { getCharacters, getLessonsWithCounts } from '../../lib/api';

export type SidebarFilter =
  | { type: 'all' }
  | { type: 'character'; id: string; name: string }
  | { type: 'module'; code: string }
  | { type: 'lesson'; id: string; label: string }
  | { type: 'untagged' }
  | { type: 'recent' }
  | { type: 'background' };

interface IllustrationsSidebarProps {
  activeFilter: SidebarFilter;
  onFilterChange: (filter: SidebarFilter) => void;
}

export default function IllustrationsSidebar({ activeFilter, onFilterChange }: IllustrationsSidebarProps) {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [modules, setModules] = useState<ModuleWithLessonCounts[]>([]);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [lessonsOpen, setLessonsOpen] = useState(false);

  useEffect(() => {
    getCharacters().then(setCharacters).catch(console.error);
    getLessonsWithCounts().then(setModules).catch(console.error);
  }, []);

  const isActive = (filter: SidebarFilter) => {
    if (filter.type !== activeFilter.type) return false;
    if (filter.type === 'character' && activeFilter.type === 'character') return filter.id === activeFilter.id;
    if (filter.type === 'module' && activeFilter.type === 'module') return filter.code === activeFilter.code;
    if (filter.type === 'lesson' && activeFilter.type === 'lesson') return filter.id === activeFilter.id;
    return true;
  };

  const itemClass = (filter: SidebarFilter) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors min-h-[44px] ${
      isActive(filter)
        ? 'bg-stc-purple-100 text-stc-purple-700 font-medium'
        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Filter items */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-1">
        {/* All */}
        <div
          className={itemClass({ type: 'all' })}
          onClick={() => onFilterChange({ type: 'all' })}
        >
          <Squares2X2Icon className="w-4 h-4 flex-shrink-0" />
          All Illustrations
        </div>

        {/* Characters section */}
        <div className="pt-2">
          <button
            onClick={() => setCharactersOpen(!charactersOpen)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-neutral-600 transition-colors"
          >
            Characters
            <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform ${charactersOpen ? 'rotate-90' : ''}`} />
          </button>
          {charactersOpen && (
            <div className="space-y-0.5 mt-1">
              {characters.map(c => (
                <div
                  key={c.id}
                  className={itemClass({ type: 'character', id: c.id, name: c.name })}
                  onClick={() => onFilterChange({ type: 'character', id: c.id, name: c.name })}
                >
                  {c.thumbnailUrl ? (
                    <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                      <img src={c.thumbnailUrl} alt={c.name} className="w-full h-full"
                        style={(() => {
                          const parts = (c.avatarPosition || '50% 50% 1').split(' ');
                          const x = parts[0] || '50%'; const y = parts[1] || '50%'; const s = parseFloat(parts[2]) || 1;
                          return { objectFit: 'contain' as const, objectPosition: `${x} ${y}`, transform: s !== 1 ? `scale(${s})` : undefined, transformOrigin: s !== 1 ? `${x} ${y}` : undefined };
                        })()}
                      />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-stc-purple-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-stc-purple-500">{c.name.charAt(0)}</span>
                    </div>
                  )}
                  <span className="truncate">{c.name}</span>
                  {c.illustrationCount > 0 && (
                    <span className="ml-auto text-xs text-neutral-400 flex-shrink-0">{c.illustrationCount}</span>
                  )}
                </div>
              ))}
              {characters.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-400">Loading...</p>
              )}
            </div>
          )}
        </div>

        {/* Lessons section */}
        <div className="pt-2">
          <button
            onClick={() => setLessonsOpen(!lessonsOpen)}
            className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wider hover:text-neutral-600 transition-colors"
          >
            Lessons
            <ChevronRightIcon className={`w-3.5 h-3.5 transition-transform ${lessonsOpen ? 'rotate-90' : ''}`} />
          </button>
          {lessonsOpen && (
            <div className="space-y-0.5 mt-1">
              {modules.map(mod => {
                const totalIllustrations = mod.lessons.reduce((sum, l) => sum + l._count.illustrations, 0);
                if (totalIllustrations === 0) return null;
                return (
                  <div key={mod.id} className="space-y-0.5">
                    <div
                      className={itemClass({ type: 'module', code: mod.code })}
                      onClick={() => onFilterChange({ type: 'module', code: mod.code })}
                    >
                      <span className="truncate font-medium">Module {mod.code}</span>
                      <span className="ml-auto text-xs text-neutral-400 flex-shrink-0">{totalIllustrations}</span>
                    </div>
                    {((activeFilter.type === 'module' && activeFilter.code === mod.code) ||
                      (activeFilter.type === 'lesson' && mod.lessons.some(l => l.id === activeFilter.id))
                    ) && mod.lessons.filter(l => l._count.illustrations > 0).map(lesson => (
                      <div
                        key={lesson.id}
                        className={itemClass({ type: 'lesson', id: lesson.id, label: `${mod.code} L${lesson.lessonNumber}` })}
                        onClick={() => onFilterChange({ type: 'lesson', id: lesson.id, label: `${mod.code} L${lesson.lessonNumber}` })}
                      >
                        <span className="truncate pl-4">L{lesson.lessonNumber}: {lesson.title}</span>
                        <span className="ml-auto text-xs text-neutral-400 flex-shrink-0">{lesson._count.illustrations}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {modules.length === 0 && (
                <p className="px-3 py-2 text-xs text-neutral-400">Loading...</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 my-2" />

        {/* Untagged */}
        <div
          className={itemClass({ type: 'untagged' })}
          onClick={() => onFilterChange({ type: 'untagged' })}
        >
          <TagIcon className="w-4 h-4 flex-shrink-0" />
          Untagged
        </div>

        {/* Backgrounds */}
        <div
          className={itemClass({ type: 'background' })}
          onClick={() => onFilterChange({ type: 'background' })}
        >
          <PhotoIcon className="w-4 h-4 flex-shrink-0" />
          Backgrounds
        </div>

        {/* Recently Added */}
        <div
          className={itemClass({ type: 'recent' })}
          onClick={() => onFilterChange({ type: 'recent' })}
        >
          <ClockIcon className="w-4 h-4 flex-shrink-0" />
          Recently Added
        </div>
      </div>
    </div>
  );
}
