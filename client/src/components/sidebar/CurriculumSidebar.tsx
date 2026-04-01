import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpenIcon,
  SparklesIcon,
  PhotoIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  DocumentTextIcon,
  Bars3Icon,
  PlusIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  FolderIcon,
  TrashIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  UsersIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import type { ConversationSummary, Project } from '../../lib/types';

interface NavLink {
  label: string;
  path: string;
  icon: string;
}

interface CurriculumSidebarProps {
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
  onCloseMobile: () => void;
  sectionNavLinks?: NavLink[];
}

const NAV_ICONS: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  book: BookOpenIcon,
  sparkles: SparklesIcon,
  photo: PhotoIcon,
  video: VideoCameraIcon,
  mic: MicrophoneIcon,
  document: DocumentTextIcon,
};

function NavIcon({ name, active }: { name: string; active: boolean }) {
  const cls = `w-4 h-4 ${active ? 'text-stc-purple-500' : 'text-neutral-400'}`;
  const Icon = NAV_ICONS[name] || Bars3Icon;
  return <Icon className={cls} />;
}

export default function CurriculumSidebar({
  conversations,
  projects,
  activeConversationId,
  activeProjectId,
  onSelectConversation,
  onNewConversation,
  onSelectProject,
  onRenameConversation,
  onDeleteConversation,
  onMoveToProject,
  onCreateProject,
  onDeleteProject,
  onOpenProjectSettings,
  onSearch,
  searchResults,
  isLoading,
  isAdmin,
  onCloseMobile,
  sectionNavLinks,
}: CurriculumSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    type: 'conversation' | 'project';
    x: number;
    y: number;
  } | null>(null);

  // Close context menu on click away
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [contextMenu]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return 'Previous 7 days';
    if (diffDays < 30) return 'Previous 30 days';
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, []);

  // Group conversations by date
  const groupedConversations = conversations.reduce(
    (groups, conv) => {
      const date = formatDate(conv.updatedAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(conv);
      return groups;
    },
    {} as Record<string, ConversationSummary[]>
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.length >= 2) {
      onSearch(value);
    }
  };

  const handleRename = (id: string) => {
    if (editingTitle.trim() && editingTitle !== conversations.find((c) => c.id === id)?.title) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setShowNewProject(false);
    }
  };

  const handleContextMenu = (
    e: React.MouseEvent,
    id: string,
    type: 'conversation' | 'project'
  ) => {
    e.preventDefault();
    const menuWidth = 200;
    const menuHeight = 250;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight);
    setContextMenu({ id, type, x: Math.max(0, x), y: Math.max(0, y) });
  };

  const currentPath = location.pathname;

  return (
    <>
      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-white rounded-xl shadow-lg border border-neutral-200 py-1.5 min-w-[180px] overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={() => setContextMenu(null)}
          >
            {contextMenu.type === 'conversation' && (
              <>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2.5 transition-colors min-h-[44px]"
                  onClick={() => {
                    const conv = conversations.find((c) => c.id === contextMenu.id);
                    if (conv) {
                      setEditingId(contextMenu.id);
                      setEditingTitle(conv.title);
                    }
                  }}
                >
                  <PencilSquareIcon className="w-4 h-4 text-neutral-400" />
                  Rename
                </button>
                {projects.length > 0 && (
                  <div className="border-t border-neutral-100 my-1 pt-1">
                    <p className="px-3 py-1 text-xs text-neutral-400 font-medium">Move to</p>
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2.5 transition-colors min-h-[44px]"
                        onClick={() => onMoveToProject(contextMenu.id, p.id)}
                      >
                        <FolderIcon className="w-4 h-4 text-neutral-400" />
                        {p.name}
                      </button>
                    ))}
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-50 flex items-center gap-2.5 transition-colors min-h-[44px]"
                      onClick={() => onMoveToProject(contextMenu.id, null)}
                    >
                      <XMarkIcon className="w-4 h-4 text-neutral-400" />
                      Remove from project
                    </button>
                  </div>
                )}
                <div className="border-t border-neutral-100 mt-1 pt-1">
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-stc-pink hover:bg-stc-pink/10 flex items-center gap-2.5 transition-colors min-h-[44px]"
                    onClick={() => onDeleteConversation(contextMenu.id)}
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
            {contextMenu.type === 'project' && (
              <>
                <button
                  className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 flex items-center gap-2.5 transition-colors min-h-[44px]"
                  onClick={() => {
                    const proj = projects.find((p) => p.id === contextMenu.id);
                    if (proj) onOpenProjectSettings(proj);
                  }}
                >
                  <Cog6ToothIcon className="w-4 h-4 text-neutral-400" />
                  Project Settings
                </button>
                {projects.find((p) => p.id === contextMenu.id)?.isOwner && (
                  <div className="border-t border-neutral-100 mt-1 pt-1">
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-stc-pink hover:bg-stc-pink/10 flex items-center gap-2.5 transition-colors min-h-[44px]"
                      onClick={() => onDeleteProject(contextMenu.id)}
                    >
                      <TrashIcon className="w-4 h-4" />
                      Delete Project
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col h-full">
        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewConversation();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-white border border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 text-neutral-700 font-medium rounded-lg transition-all duration-200"
          >
            <PlusIcon className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Search (expandable inline) */}
        <div className="px-3 pb-2">
          {searchExpanded ? (
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onBlur={() => {
                  if (!searchQuery) setSearchExpanded(false);
                }}
                className="w-full pl-9 pr-8 py-2 min-h-[44px] bg-white border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                autoFocus
              />
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchExpanded(false);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchExpanded(true)}
              className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg text-sm transition-colors"
            >
              <MagnifyingGlassIcon className="w-4 h-4" />
              Search chats
            </button>
          )}
        </div>

        {/* Search Results */}
        {searchQuery.length >= 2 && searchResults && (
          <div className="px-3 pb-2 border-b border-neutral-200 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider px-2 mb-2">
              Search Results
            </p>
            {searchResults.length === 0 ? (
              <p className="text-sm text-neutral-500 px-2">No results found</p>
            ) : (
              searchResults.slice(0, 5).map((result, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelectConversation(result.conversationId);
                    setSearchQuery('');
                    setSearchExpanded(false);
                    onCloseMobile();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 text-sm transition-colors"
                >
                  <p className="font-medium text-neutral-700 truncate">{result.conversationTitle}</p>
                  <p className="text-xs text-neutral-500 truncate mt-0.5">{result.content}</p>
                </button>
              ))
            )}
          </div>
        )}

        {/* Nav Links */}
        <div className="px-3 pb-2 space-y-0.5">
          {(sectionNavLinks || [
            { label: 'Curriculum', path: '/curriculum', icon: 'book' },
            ...(isAdmin ? [{ label: 'Generator', path: '/generator', icon: 'sparkles' }] : []),
          ]).map((link) => {
            const isActive = currentPath === link.path || currentPath?.startsWith(link.path + '/');
            return (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-stc-purple-50 text-stc-purple-700'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                <NavIcon name={link.icon} active={isActive} />
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-200 mx-3" />

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Projects Section */}
          <div className="px-3 py-2">
            <button
              onClick={() => setProjectsExpanded(!projectsExpanded)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-neutral-500 uppercase tracking-wider hover:text-neutral-700 rounded-md hover:bg-white transition-colors"
            >
              <span>Projects</span>
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${projectsExpanded ? 'rotate-180' : ''}`} />
            </button>

            {projectsExpanded && (
              <div className="mt-1 space-y-0.5">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className={`w-full px-2.5 py-2 rounded-lg transition-colors flex items-center gap-2 group min-h-[44px] ${
                      activeProjectId === project.id
                        ? 'bg-white shadow-sm text-neutral-900'
                        : 'hover:bg-white/70 text-neutral-600'
                    }`}
                  >
                    <button
                      onClick={() => {
                        onSelectProject(project.id);
                        onCloseMobile();
                      }}
                      onContextMenu={(e) => handleContextMenu(e, project.id, 'project')}
                      className="flex items-center gap-2 flex-1 min-w-0 self-stretch"
                    >
                      <FolderIcon className={`w-4 h-4 flex-shrink-0 ${activeProjectId === project.id ? 'text-stc-purple-500' : 'text-neutral-400'}`} />
                      <span className="text-sm font-medium truncate flex-1">{project.name}</span>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Member count badge for shared projects */}
                      {project.memberCount > 1 && (
                        <span className="flex items-center gap-0.5 text-xs text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded-full" title={`${project.memberCount} members`}>
                          <UsersIcon className="w-3 h-3" />
                          {project.memberCount}
                        </span>
                      )}
                      {/* Role badge if not owner */}
                      {!project.isOwner && (
                        <span className="text-xs text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-full">
                          {project.role === 'EDITOR' ? 'Editor' : 'Owner'}
                        </span>
                      )}
                      {/* Settings gear */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenProjectSettings(project);
                        }}
                        className="p-1 opacity-0 group-hover:opacity-100 hover:bg-neutral-100 rounded transition-all duration-200"
                        aria-label="Project settings"
                      >
                        <Cog6ToothIcon className="w-3.5 h-3.5 text-neutral-400" />
                      </button>
                      <span className="text-xs text-neutral-400">{project.conversationCount}</span>
                    </div>
                  </div>
                ))}

                {/* New Project Button */}
                {showNewProject ? (
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreateProject();
                        if (e.key === 'Escape') setShowNewProject(false);
                      }}
                      placeholder="Project name..."
                      className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                      autoFocus
                    />
                    <button
                      onClick={handleCreateProject}
                      className="p-1.5 text-stc-purple-500 hover:bg-stc-purple-50 rounded-lg transition-colors"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewProject(true)}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-white/70 text-neutral-500 flex items-center gap-2 transition-colors min-h-[44px]"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span className="text-sm">New project</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Conversations List */}
          <div className="px-3 pb-3 border-t border-neutral-200 pt-3">
            <div className="flex items-center justify-between px-2 mb-2">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                {activeProjectId
                  ? projects.find(p => p.id === activeProjectId)?.name || 'Project'
                  : 'Your Chats'
                }
              </p>
              {activeProjectId && (
                <button
                  onClick={() => onSelectProject(null)}
                  className="text-xs text-stc-purple-500 hover:text-stc-purple-700 font-medium"
                >
                  Show all
                </button>
              )}
            </div>

            {isLoading ? (
              /* Loading skeleton */
              <div className="space-y-3 px-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 bg-neutral-200 rounded w-3/4 mb-1.5" />
                    <div className="h-2.5 bg-neutral-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-neutral-400">
                <ChatBubbleOvalLeftEllipsisIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium text-neutral-500">No conversations yet</p>
                <p className="text-xs text-neutral-400 mt-0.5">Start a new chat to begin</p>
              </div>
            ) : (
              Object.entries(groupedConversations).map(([date, convs]) => (
                <div key={date} className="mb-3">
                  <p className="text-xs text-neutral-400 px-2 mb-1.5 font-medium">{date}</p>
                  <div className="space-y-0.5">
                    {convs.map((conv) => (
                      <div key={conv.id}>
                        {editingId === conv.id ? (
                          <div className="px-2 py-1.5">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(conv.id);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onBlur={() => handleRename(conv.id)}
                              className="w-full px-2.5 py-1.5 text-sm bg-white border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              onSelectConversation(conv.id);
                              onCloseMobile();
                            }}
                            onContextMenu={(e) => handleContextMenu(e, conv.id, 'conversation')}
                            className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors group min-h-[44px] ${
                              activeConversationId === conv.id
                                ? 'bg-white shadow-sm text-neutral-900'
                                : 'hover:bg-white/70 text-neutral-600'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <ChatBubbleOvalLeftEllipsisIcon className={`w-4 h-4 flex-shrink-0 ${activeConversationId === conv.id ? 'text-stc-purple-500' : 'text-neutral-400'}`} />
                              <span className="truncate text-sm">{conv.title}</span>
                            </div>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
