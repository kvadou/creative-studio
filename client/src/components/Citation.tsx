import { Link } from 'react-router-dom';
import { BookOpenIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface CitationProps {
  citation: {
    text: string;
    moduleCode: string;
    lessonNumber: number;
    section: string;
  };
}

export default function Citation({ citation }: CitationProps) {
  return (
    <Link
      to={`/lesson/${citation.moduleCode}/${citation.lessonNumber}`}
      className="block touch-target"
      aria-label={`View Module ${citation.moduleCode}, Lesson ${citation.lessonNumber}${citation.section ? `: ${citation.section}` : ''}`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-stc-purple-50 rounded-xl border border-stc-purple-100 hover:bg-stc-purple-100 active:bg-stc-purple-100 hover:border-stc-purple-200 transition-all cursor-pointer group min-h-[44px]">
        {/* Book Icon - smaller on mobile */}
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm group-hover:shadow transition-shadow">
          <BookOpenIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stc-purple-500" />
        </div>

        {/* Citation Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="pill pill-purple text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
              <span className="hidden xs:inline">Module </span>{citation.moduleCode}
            </span>
            <span className="pill pill-blue text-[10px] sm:text-xs px-2 sm:px-3 py-0.5 sm:py-1">
              <span className="hidden xs:inline">Lesson </span>{citation.lessonNumber}
            </span>
            {citation.section && (
              <span className="text-[10px] sm:text-xs text-stc-purple-500 font-medium truncate max-w-[100px] sm:max-w-none">
                {citation.section}
              </span>
            )}
            {/* Arrow indicator - always visible on touch devices */}
            <ArrowRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stc-purple-400 ml-auto opacity-50 sm:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          {citation.text && (
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed line-clamp-2 sm:line-clamp-none">
              {citation.text}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
