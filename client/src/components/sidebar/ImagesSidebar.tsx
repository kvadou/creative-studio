import { useState, useEffect } from 'react';
import { SparklesIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { ModuleWithLessons } from '../../lib/types';
import { getAllLessons } from '../../lib/api';

interface ImagesSidebarProps {
  search: string;
  onSearchChange: (value: string) => void;
  lessonFilter: string | null;
  onLessonFilterChange: (lessonId: string | null) => void;
  typeFilter: 'all' | 'CARTOON' | 'CHARACTER';
  onTypeFilterChange: (type: 'all' | 'CARTOON' | 'CHARACTER') => void;
  totalCount: number;
  onGenerate: () => void;
}

export default function ImagesSidebar({
  search, onSearchChange,
  lessonFilter, onLessonFilterChange,
  typeFilter, onTypeFilterChange,
  totalCount, onGenerate,
}: ImagesSidebarProps) {
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);

  useEffect(() => {
    getAllLessons().then(setModules).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-4 p-3">
      {/* Generate button */}
      <button
        onClick={onGenerate}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-stc-purple-500 hover:bg-stc-purple-600 text-white font-medium rounded-lg transition-colors"
      >
        <SparklesIcon className="w-4 h-4" />
        Generate Art
      </button>

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search images..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 min-h-[40px] bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
        />
      </div>

      {/* Lesson Filter */}
      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5 block">Lesson</label>
        <select
          value={lessonFilter || ''}
          onChange={(e) => onLessonFilterChange(e.target.value || null)}
          className="w-full px-3 py-2 min-h-[40px] bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
        >
          <option value="">All Lessons</option>
          {modules.map(mod => (
            <optgroup key={mod.id} label={`${mod.code} — ${mod.title}`}>
              {mod.lessons.map(lesson => (
                <option key={lesson.id} value={lesson.id}>
                  Lesson {lesson.lessonNumber}: {lesson.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Type Filter */}
      <div>
        <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1.5 block">Type</label>
        <div className="flex gap-1">
          {[
            { value: 'all' as const, label: 'All' },
            { value: 'CARTOON' as const, label: 'Cartoon' },
            { value: 'CHARACTER' as const, label: 'Character' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => onTypeFilterChange(opt.value)}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${
                typeFilter === opt.value
                  ? 'bg-stc-purple-100 text-stc-purple-700'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div className="text-sm text-neutral-500 px-1">
        {totalCount} image{totalCount !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
