import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ModuleWithLessons, LessonTag } from '../../lib/types';
import { getAllLessons } from '../../lib/api';

interface LessonTagPickerProps {
  value: LessonTag | null | undefined;
  onChange: (lessonId: string | null) => void;
  compact?: boolean; // Smaller variant for gallery cards
}

export default function LessonTagPicker({ value, onChange, compact }: LessonTagPickerProps) {
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch modules+lessons on first open
  const fetchLessons = useCallback(async () => {
    if (modules.length > 0) return;
    setIsLoading(true);
    try {
      const data = await getAllLessons();
      setModules(data);
    } catch (err) {
      console.error('Failed to fetch lessons:', err);
    } finally {
      setIsLoading(false);
    }
  }, [modules.length]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    fetchLessons();
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSelect = (lessonId: string) => {
    onChange(lessonId);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Filter modules/lessons by search
  const searchLower = search.toLowerCase();
  const filtered = modules
    .map((mod) => ({
      ...mod,
      lessons: mod.lessons.filter((l) => {
        if (!search) return true;
        return (
          l.title.toLowerCase().includes(searchLower) ||
          `lesson ${l.lessonNumber}`.includes(searchLower) ||
          `l${l.lessonNumber}`.includes(searchLower) ||
          mod.code.toLowerCase().includes(searchLower) ||
          mod.title.toLowerCase().includes(searchLower)
        );
      }),
    }))
    .filter((mod) => mod.lessons.length > 0);

  // Format display label
  const formatLabel = (tag: LessonTag) => {
    return `M${tag.module.code} L${tag.lessonNumber}`;
  };

  // Current tag pill (when a lesson is assigned)
  if (value && !isOpen) {
    return (
      <div className="relative inline-flex" ref={dropdownRef}>
        <button
          onClick={handleOpen}
          className={`
            inline-flex items-center gap-1 rounded-full font-medium transition-colors
            bg-stc-purple-100 text-stc-purple-700 hover:bg-stc-purple-200
            ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
          `}
          title={`${value.module.code} — Lesson ${value.lessonNumber}: ${value.title}`}
        >
          <BookOpenIcon className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          {formatLabel(value)}
          <button
            onClick={handleClear}
            className="ml-0.5 hover:text-stc-purple-900 transition-colors"
            title="Remove lesson tag"
          >
            <XMarkIcon className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          </button>
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      {/* Trigger button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={`
            inline-flex items-center gap-1 rounded-full font-medium transition-colors
            text-neutral-400 hover:text-stc-purple-500 hover:bg-stc-purple-50 border border-dashed border-neutral-300 hover:border-stc-purple-300
            ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
          `}
          title="Tag to a lesson"
        >
          <BookOpenIcon className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          Tag lesson
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-0 left-0 w-72 bg-white rounded-xl shadow-lg border border-neutral-200 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-neutral-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules & lessons..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none"
            />
          </div>

          {/* Lesson list */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-400">Loading lessons...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-neutral-400">No matching lessons</div>
            ) : (
              filtered.map((mod) => (
                <div key={mod.id}>
                  {/* Module header */}
                  <div className="px-3 py-1.5 bg-neutral-50 text-[10px] font-semibold text-neutral-500 uppercase tracking-wide sticky top-0">
                    {mod.code} — {mod.title}
                  </div>
                  {/* Lessons */}
                  {mod.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      onClick={() => handleSelect(lesson.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-stc-purple-50 transition-colors flex items-center gap-2"
                    >
                      <span className="text-xs font-medium text-stc-purple-500 min-w-[28px]">
                        L{lesson.lessonNumber}
                      </span>
                      <span className="text-neutral-700 truncate">{lesson.title}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Close */}
          <div className="p-1.5 border-t border-neutral-100">
            <button
              onClick={() => { setIsOpen(false); setSearch(''); }}
              className="w-full px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-600 text-center rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
