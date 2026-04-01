import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, PhotoIcon, ChevronDownIcon, UserIcon } from '@heroicons/react/24/outline';
import type { Illustration } from '../../lib/types';
import { getIllustrations, deleteIllustration } from '../../lib/api';
import IllustrationCard from './IllustrationCard';
import CharacterArtWorkspace from './CharacterArtWorkspace';
import SceneGeneratorWorkspace from './SceneGeneratorWorkspace';
import DeleteConfirmModal from './DeleteConfirmModal';
import type { SidebarFilter } from './IllustrationsSidebar';

interface IllustrationsModuleProps {
  sidebarFilter?: SidebarFilter;
  onClearSidebarFilter?: () => void;
}

type SourceFilter = 'all' | 'originals' | 'generated';

export default function IllustrationsModule({ sidebarFilter, onClearSidebarFilter }: IllustrationsModuleProps) {
  const navigate = useNavigate();

  const [illustrations, setIllustrations] = useState<Illustration[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Illustration | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [sceneWorkspaceOpen, setSceneWorkspaceOpen] = useState(false);
  const [generateMenuOpen, setGenerateMenuOpen] = useState(false);
  const generateMenuRef = useRef<HTMLDivElement>(null);

  const isMountedRef = useRef(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Fetch illustrations
  const fetchIllustrations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 1000, excludeArtType: 'CARTOON' };

      if (search) params.search = search;

      // Source filter
      if (sourceFilter === 'originals') params.filter = 'original';
      else if (sourceFilter === 'generated') params.filter = 'generated';

      // Sidebar filter
      if (sidebarFilter?.type === 'character') {
        params.characterId = sidebarFilter.id;
      } else if (sidebarFilter?.type === 'module') {
        params.moduleCode = sidebarFilter.code;
      } else if (sidebarFilter?.type === 'lesson') {
        params.lessonId = sidebarFilter.id;
      } else if (sidebarFilter?.type === 'untagged') {
        params.untagged = true;
      } else if (sidebarFilter?.type === 'background') {
        params.artType = 'BACKGROUND';
        delete params.excludeArtType;
      }

      const data = await getIllustrations(params);

      if (isMountedRef.current) {
        setIllustrations(data.illustrations);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to load illustrations:', error);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [search, sourceFilter, sidebarFilter]);

  useEffect(() => {
    fetchIllustrations();
  }, [fetchIllustrations]);

  const handleSearchInput = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value), 300);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleSelect = useCallback((illustration: Illustration) => {
    navigate(`/images/${illustration.id}`);
  }, [navigate]);

  const handleDeleteRequest = useCallback((illustration: Illustration) => {
    setDeleteTarget(illustration);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteIllustration(deleteTarget.id);
    setDeleteTarget(null);
    setIllustrations(prev => prev.filter(i => i.id !== deleteTarget.id));
    setTotal(prev => prev - 1);
  }, [deleteTarget]);

  const handleWorkspaceComplete = useCallback(() => {
    fetchIllustrations();
    setWorkspaceOpen(false);
  }, [fetchIllustrations]);

  const handleSceneWorkspaceComplete = useCallback(() => {
    fetchIllustrations();
    setSceneWorkspaceOpen(false);
  }, [fetchIllustrations]);

  // Close generate dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (generateMenuRef.current && !generateMenuRef.current.contains(e.target as Node)) {
        setGenerateMenuOpen(false);
      }
    };
    if (generateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [generateMenuOpen]);



  // Build active filter label
  const getFilterLabel = () => {
    if (sidebarFilter?.type === 'character') return `Character: ${sidebarFilter.name}`;
    if (sidebarFilter?.type === 'lesson') return `Lesson: ${sidebarFilter.label}`;
    if (sidebarFilter?.type === 'untagged') return 'Untagged Illustrations';
    if (sidebarFilter?.type === 'background') return 'Backgrounds';
    if (sidebarFilter?.type === 'recent') return 'Recently Added';
    return null;
  };

  const filterLabel = getFilterLabel();

  // Skeleton cards
  const skeletonCards = Array.from({ length: 12 }, (_, i) => (
    <div key={`skeleton-${i}`} className="rounded-xl overflow-hidden bg-white shadow-sm animate-pulse">
      <div className="aspect-[3/4] bg-neutral-200" />
      <div className="p-2.5 space-y-2">
        <div className="h-4 bg-neutral-200 rounded-lg w-3/4" />
        <div className="h-3 bg-neutral-200 rounded-full w-1/3" />
      </div>
    </div>
  ));

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 lg:px-8 py-6 space-y-5">
        {/* Search bar + Generate button */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              defaultValue={search}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search illustrations..."
              className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-neutral-200 text-sm bg-white shadow-sm
                focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                placeholder:text-neutral-400 transition-all min-h-[48px]"
            />
          </div>
          <div ref={generateMenuRef} className="relative flex-shrink-0">
            <button
              onClick={() => setGenerateMenuOpen((prev) => !prev)}
              className="px-5 py-3.5 rounded-2xl bg-stc-purple-500 text-white text-sm font-semibold
                hover:bg-stc-purple-600 shadow-sm transition-colors min-h-[48px] flex items-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Generate</span>
              <ChevronDownIcon className="w-3.5 h-3.5 ml-0.5 opacity-70" />
            </button>
            {generateMenuOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-neutral-200 overflow-hidden z-20">
                <button
                  onClick={() => {
                    setGenerateMenuOpen(false);
                    setWorkspaceOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:bg-stc-purple-50 transition-colors min-h-[44px]"
                >
                  <UserIcon className="w-4 h-4 text-stc-purple-500" />
                  Character Art
                </button>
                <button
                  onClick={() => {
                    setGenerateMenuOpen(false);
                    setSceneWorkspaceOpen(true);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-neutral-700 hover:bg-stc-purple-50 transition-colors min-h-[44px] border-t border-neutral-100"
                >
                  <PhotoIcon className="w-4 h-4 text-stc-purple-500" />
                  Scene
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Source filter pills */}
        <div className="flex items-center gap-3 overflow-x-auto -mx-1 px-1">
          <div className="flex gap-1.5 p-1 bg-neutral-100 rounded-xl flex-shrink-0">
            {([
              { value: 'all', label: 'All' },
              { value: 'originals', label: 'Originals' },
              { value: 'generated', label: 'AI Generated' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setSourceFilter(opt.value)}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap min-h-[44px] ${
                  sourceFilter === opt.value
                    ? 'bg-white text-stc-purple-600 shadow-sm ring-1 ring-neutral-200/50'
                    : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {filterLabel && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-stc-purple-50 text-stc-purple-700 rounded-lg text-xs font-medium">
              {filterLabel}
              <button
                onClick={() => {
                  onClearSidebarFilter?.();
                }}
                className="hover:text-stc-purple-900 p-1 -m-1"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <span className="text-xs text-neutral-400 ml-auto flex-shrink-0">{total} illustrations</span>
        </div>

        {/* Gallery grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {skeletonCards}
          </div>
        ) : illustrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
              <PhotoIcon className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-1">No illustrations found</h3>
            <p className="text-xs text-neutral-400 max-w-xs">
              {search
                ? `No results for "${search}". Try a different search term.`
                : 'Click Generate to create your first illustration.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
            {illustrations.map(illustration => (
              <IllustrationCard
                key={illustration.id}
                illustration={illustration}
                onSelect={handleSelect}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          illustration={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Character art workspace */}
      {workspaceOpen && (
        <CharacterArtWorkspace
          illustration={null}
          onComplete={handleWorkspaceComplete}
          onClose={() => {
            setWorkspaceOpen(false);
            fetchIllustrations();
          }}
        />
      )}

      {/* Scene generator workspace */}
      {sceneWorkspaceOpen && (
        <SceneGeneratorWorkspace
          onComplete={handleSceneWorkspaceComplete}
          onClose={() => {
            setSceneWorkspaceOpen(false);
            fetchIllustrations();
          }}
        />
      )}
    </div>
  );
}
