import { useCallback, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { StudioTab, ConversationSummary, Project } from '../lib/types';
import CurriculumSidebar from './sidebar/CurriculumSidebar';
import IllustrationsSidebar from './illustrations/IllustrationsSidebar';
import MediaSidebar from './sidebar/MediaSidebar';
import type { SidebarFilter } from './illustrations/IllustrationsSidebar';

interface SidebarProps {
  activeTab: StudioTab;
  isOpen: boolean;
  onToggle: () => void;

  // Curriculum sidebar props
  conversations: ConversationSummary[];
  projects: Project[];
  activeConversationId: string | null;
  activeProjectId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onSelectProject: (id: string | null) => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
  onMoveToProject: (conversationId: string, projectId: string | null) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (id: string) => void;
  onOpenProjectSettings: (project: Project) => void;
  onSearch: (query: string) => void;
  searchResults?: Array<{ conversationId: string; conversationTitle: string; content: string }>;
  isLoading?: boolean;
  isAdmin?: boolean;

  // Illustrations sidebar props
  illustrationFilter: SidebarFilter;
  onIllustrationFilterChange: (filter: SidebarFilter) => void;

  // Video/Audio sidebar props
  videoFilter: SidebarFilter;
  onVideoFilterChange: (filter: SidebarFilter) => void;
  audioFilter: SidebarFilter;
  onAudioFilterChange: (filter: SidebarFilter) => void;
}

export default function Sidebar(props: SidebarProps) {
  const sidebarRef = useRef<HTMLElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const closeSidebarOnMobile = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768 && props.isOpen) {
      props.onToggle();
    }
  }, [props.isOpen, props.onToggle]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchStartX.current - touchEndX;
    const deltaY = Math.abs(touchStartY.current - touchEndY);
    if (deltaX > 50 && deltaY < 100 && props.isOpen) {
      props.onToggle();
    }
  }, [props.isOpen, props.onToggle]);

  // Don't show sidebar on admin tab
  if (props.activeTab === 'admin') {
    return null;
  }

  // Section-specific nav links for each workspace
  const sectionNavLinks: Record<string, Array<{ label: string; path: string; icon: string }>> = {
    curriculum: [
      { label: 'Curriculum', path: '/curriculum', icon: 'book' },
      { label: 'Generator', path: '/generator', icon: 'sparkles' },
    ],
    images: [
      { label: 'All Illustrations', path: '/images', icon: 'photo' },
    ],
    video: [
      { label: 'All Videos', path: '/video', icon: 'video' },
    ],
    audio: [
      { label: 'Voices', path: '/audio', icon: 'mic' },
      { label: 'Scripts', path: '/audio?tab=scripts', icon: 'document' },
    ],
  };

  const renderContent = () => {
    const navLinks = sectionNavLinks[props.activeTab] || [];

    switch (props.activeTab) {
      case 'images':
        return (
          <IllustrationsSidebar
            activeFilter={props.illustrationFilter}
            onFilterChange={(filter) => {
              props.onIllustrationFilterChange(filter);
              closeSidebarOnMobile();
            }}
          />
        );
      case 'video':
        return (
          <MediaSidebar
            mediaType="video"
            activeFilter={props.videoFilter}
            onFilterChange={(filter) => {
              props.onVideoFilterChange(filter);
              closeSidebarOnMobile();
            }}
          />
        );
      case 'audio':
        return (
          <MediaSidebar
            mediaType="audio"
            activeFilter={props.audioFilter}
            onFilterChange={(filter) => {
              props.onAudioFilterChange(filter);
              closeSidebarOnMobile();
            }}
          />
        );
      case 'curriculum':
        return (
          <CurriculumSidebar
            conversations={props.conversations}
            projects={props.projects}
            activeConversationId={props.activeConversationId}
            activeProjectId={props.activeProjectId}
            onSelectConversation={(id) => { props.onSelectConversation(id); closeSidebarOnMobile(); }}
            onNewConversation={() => { props.onNewConversation(); closeSidebarOnMobile(); }}
            onSelectProject={(id) => { props.onSelectProject(id); closeSidebarOnMobile(); }}
            onRenameConversation={props.onRenameConversation}
            onDeleteConversation={props.onDeleteConversation}
            onMoveToProject={props.onMoveToProject}
            onCreateProject={props.onCreateProject}
            onDeleteProject={props.onDeleteProject}
            onOpenProjectSettings={props.onOpenProjectSettings}
            onSearch={props.onSearch}
            searchResults={props.searchResults}
            isLoading={props.isLoading}
            isAdmin={props.isAdmin}
            onCloseMobile={closeSidebarOnMobile}
            sectionNavLinks={navLinks}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-all duration-200 ${
          props.isOpen
            ? 'bg-black/50 backdrop-blur-sm pointer-events-auto'
            : 'bg-transparent pointer-events-none'
        }`}
        onClick={props.onToggle}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed md:relative z-50 h-full bg-white border-r border-neutral-200 flex flex-col transition-all duration-200 ease-out ${
          props.isOpen
            ? 'w-[260px] translate-x-0 shadow-xl md:shadow-none'
            : 'w-0 -translate-x-full md:w-0'
        }`}
      >
        <div className={`flex flex-col h-full w-[260px] ${props.isOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
          {/* Collapse button (desktop) */}
          <div className="hidden md:flex items-center justify-end px-3 py-1.5 bg-white border-b border-neutral-200">
            <button
              onClick={props.onToggle}
              className="flex items-center justify-center w-10 h-10 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Close sidebar"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Tab-specific content */}
          <div className="flex-1 overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </aside>

      {/* Expand button (desktop, when collapsed) */}
      {!props.isOpen && (
        <button
          onClick={props.onToggle}
          className="hidden md:flex fixed z-50 left-0 top-20 bg-white border border-neutral-200 rounded-r-lg p-2 shadow-sm hover:bg-neutral-50 hover:shadow transition-all min-h-[44px] min-w-[44px] items-center justify-center"
          aria-label="Open sidebar"
        >
          <ChevronRightIcon className="w-5 h-5 text-neutral-500" />
        </button>
      )}
    </>
  );
}
