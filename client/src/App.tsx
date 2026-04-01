import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Bars3Icon, XMarkIcon, ArrowRightStartOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Chat from './components/Chat';
import Sidebar from './components/Sidebar';
import HeaderTabs, { getActiveTab } from './components/HeaderTabs';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SignIn } from './components/SignIn';
import { Unauthorized } from './components/Unauthorized';
import { logout } from './lib/auth';
import type { ConversationSummary, Project, SearchResult } from './lib/types';
import {
  getConversations,
  getProjects,
  createProject,
  deleteProject,
  updateConversation,
  deleteConversation,
  searchConversations,
  chatApi,
} from './lib/api';
import type { SidebarFilter } from './components/illustrations/IllustrationsSidebar';

// Lazy-loaded pages
const ProjectSettingsPanel = lazy(() => import('./components/ProjectSettingsPanel'));
const ProjectView = lazy(() => import('./components/ProjectView'));
const CurriculumGenerator = lazy(() => import('./components/curriculum').then(m => ({ default: m.CurriculumGenerator })));
const BatchGenerator = lazy(() => import('./components/curriculum').then(m => ({ default: m.BatchGenerator })));
const LessonBrowser = lazy(() => import('./components/curriculum/LessonBrowser'));
const LessonDetail = lazy(() => import('./components/curriculum/LessonDetail'));
const ImageDetail = lazy(() => import('./components/images/ImageDetail'));
const VideoDetail = lazy(() => import('./components/video/VideoDetail'));
const AdminPage = lazy(() => import('./components/admin/AdminPage'));
const CharacterArtWorkspace = lazy(() => import('./components/illustrations/CharacterArtWorkspace'));
const VideoWorkspace = lazy(() => import('./components/video/VideoWorkspace'));
const IllustrationsModule = lazy(() => import('./components/illustrations/IllustrationsModule'));
const VideoModule = lazy(() => import('./components/video/VideoModule'));
const AudioModule = lazy(() => import('./components/audio/AudioModule'));
const VoiceCreator = lazy(() => import('./components/audio/VoiceCreator'));
const AudioDetail = lazy(() => import('./components/audio/AudioDetail'));
const HomePage = lazy(() => import('./components/HomePage'));
const ChunksPage = lazy(() => import('./components/chunks/ChunksPage'));
const CharactersPage = lazy(() => import('./components/characters/CharactersPage'));
const NewCharacterPage = lazy(() => import('./components/characters/NewCharacterPage'));
const CharacterProfile = lazy(() => import('./components/characters/CharacterProfile'));
const EpisodesModule = lazy(() => import('./components/episodes/EpisodesModule'));
const NewEpisode = lazy(() => import('./components/episodes/NewEpisode'));
const EpisodeWorkspace = lazy(() => import('./components/episodes/EpisodeWorkspace'));

function AppContent() {
  const [imageError, setImageError] = useState(false);
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getActiveTab(location.pathname);
  const mainRef = useRef<HTMLElement>(null);
  // Pages that are self-contained (no sidebar)
  const hideSidebar = activeTab === 'home' || activeTab === 'admin' || activeTab === 'episodes'
    || location.pathname.startsWith('/characters');

  // Reset scroll on route change
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Core state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 768;
  });
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);
  const [isSendingFromProject, setIsSendingFromProject] = useState(false);

  // Video & Audio sidebar filter state
  const [videoFilter, setVideoFilter] = useState<SidebarFilter>({ type: 'all' });
  const [audioFilter, setAudioFilter] = useState<SidebarFilter>({ type: 'all' });

  // Workspace overlays
  const [artWorkspaceOpen, setArtWorkspaceOpen] = useState(false);
  const [videoWorkspaceOpen, setVideoWorkspaceOpen] = useState(false);

  // Illustrations sidebar filter
  const [illustrationFilter, setIllustrationFilter] = useState<SidebarFilter>({ type: 'all' });

  // Load conversations and projects on mount
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const [convData, projData] = await Promise.all([
          getConversations({ projectId: activeProjectId }),
          getProjects(),
        ]);
        setConversations(convData.conversations);
        setProjects(projData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, [user, activeProjectId]);


  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    if (!user) return;
    try {
      const convData = await getConversations({ projectId: activeProjectId });
      setConversations(convData.conversations);
    } catch (error) {
      console.error('Failed to refresh conversations:', error);
    }
  }, [user, activeProjectId]);

  // Sidebar handlers
  const handleNewConversation = useCallback(() => {
    setActiveConversationId(null);
    navigate('/chat');
  }, [navigate]);

  const handleSelectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    navigate(`/chat/${id}`);
  }, [navigate]);

  const handleSelectProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
    setActiveConversationId(null);
    navigate('/chat');
  }, [navigate]);

  const handleRenameConversation = useCallback(async (id: string, title: string) => {
    try {
      await updateConversation(id, { title });
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  }, []);

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      await deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        navigate('/chat');
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  }, [activeConversationId, navigate]);

  const handleMoveToProject = useCallback(async (conversationId: string, projectId: string | null) => {
    try {
      await updateConversation(conversationId, { projectId });
      if (activeProjectId !== null && activeProjectId !== projectId) {
        setConversations(prev => prev.filter(c => c.id !== conversationId));
      } else {
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, projectId } : c));
      }
    } catch (error) {
      console.error('Failed to move conversation:', error);
    }
  }, [activeProjectId]);

  const handleCreateProject = useCallback(async (name: string) => {
    try {
      const newProject = await createProject(name);
      setProjects(prev => [...prev, newProject]);
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }, [activeProjectId]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      const results = await searchConversations(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Failed to search:', error);
      setSearchResults([]);
    }
  }, []);

  const handleOpenProjectSettings = useCallback((project: Project) => {
    setSettingsProject(project);
  }, []);

  const handleProjectUpdate = useCallback((updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    setSettingsProject(updatedProject);
  }, []);

  const handleProjectDeleteFromSettings = useCallback(() => {
    if (settingsProject) {
      setProjects(prev => prev.filter(p => p.id !== settingsProject.id));
      if (activeProjectId === settingsProject.id) setActiveProjectId(null);
      setSettingsProject(null);
    }
  }, [settingsProject, activeProjectId]);

  const handleConversationCreated = useCallback((id: string) => {
    setActiveConversationId(id);
    refreshConversations();
  }, [refreshConversations]);

  const handleStartChat = useCallback(async (message: string) => {
    if (!activeProjectId) return;
    setIsSendingFromProject(true);
    try {
      const response = await chatApi(message, undefined, activeProjectId);
      if (response.conversationId) {
        setActiveConversationId(response.conversationId);
        navigate(`/chat/${response.conversationId}`);
        refreshConversations();
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
    } finally {
      setIsSendingFromProject(false);
    }
  }, [activeProjectId, refreshConversations, navigate]);

  // Auth routes
  if (location.pathname === '/auth/signin') return <SignIn />;
  if (location.pathname === '/auth/unauthorized') return <Unauthorized />;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-stc-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-neutral-500">
          <ArrowPathIcon className="animate-spin h-5 w-5 text-stc-purple-500" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    window.location.href = '/auth/signin';
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-stc-bg pattern-bg overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 safe-top">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left: Hamburger (mobile) + Logo */}
            <div className="flex items-center gap-3 sm:gap-4">
              {!hideSidebar && (
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden p-2 -ml-2 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors touch-target"
                  aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                >
                  {sidebarOpen ? (
                      <XMarkIcon className="w-5 h-5" />
                    ) : (
                      <Bars3Icon className="w-5 h-5" />
                    )}
                </button>
              )}
              <button onClick={() => navigate('/')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <img src="/logo.png" alt="Acme Creative" className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain" />
                <span className="font-semibold text-sm sm:text-base text-neutral-900">
                  <span className="sm:hidden">Creative Studio</span>
                  <span className="hidden sm:inline">Creative Studio</span>
                </span>
              </button>
            </div>

            {/* Center: Header Tabs */}
            <div className="hidden md:flex">
              <HeaderTabs isAdmin={user.isAdmin} />
            </div>

            {/* Right: User menu */}
            <div className="flex items-center gap-1 sm:gap-2">
              {user.picture && !imageError ? (
                <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full ring-2 ring-neutral-100" onError={() => setImageError(true)} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-stc-purple-100 flex items-center justify-center ring-2 ring-neutral-100">
                  <span className="text-sm font-medium text-stc-purple-600">{user.name.charAt(0)}</span>
                </div>
              )}
              <span className="hidden md:block text-sm font-medium text-neutral-700 max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
              <button onClick={logout} className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors duration-200 touch-target" aria-label="Sign out">
                <ArrowRightStartOnRectangleIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mobile tab strip */}
          <div className="md:hidden pb-2 -mx-1 overflow-x-auto scrollbar-hide">
            <HeaderTabs isAdmin={user.isAdmin} />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — hidden on self-contained pages */}
        {!hideSidebar && <Sidebar
          activeTab={activeTab}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          // Curriculum props
          conversations={conversations}
          projects={projects}
          activeConversationId={activeConversationId}
          activeProjectId={activeProjectId}
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          onSelectProject={handleSelectProject}
          onRenameConversation={handleRenameConversation}
          onDeleteConversation={handleDeleteConversation}
          onMoveToProject={handleMoveToProject}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onOpenProjectSettings={handleOpenProjectSettings}
          onSearch={handleSearch}
          searchResults={searchResults}
          isLoading={isLoadingData}
          isAdmin={user.isAdmin}
          // Illustrations props
          illustrationFilter={illustrationFilter}
          onIllustrationFilterChange={setIllustrationFilter}
          // Video/Audio props
          videoFilter={videoFilter}
          onVideoFilterChange={setVideoFilter}
          audioFilter={audioFilter}
          onAudioFilterChange={setAudioFilter}
        />}

        {/* Main content -- React Router */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-6 w-6 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
            </div>
          }>
            <Routes>
              {/* Home */}
              <Route path="/home" element={<HomePage />} />
              <Route path="/" element={<Navigate to="/home" replace />} />

              {/* Curriculum */}
              <Route path="/curriculum" element={<LessonBrowser />} />
              <Route path="/lessons" element={<Navigate to="/curriculum" replace />} />
              <Route path="/chat" element={
                activeProjectId && !activeConversationId ? (
                  <ProjectView
                    project={projects.find(p => p.id === activeProjectId)!}
                    conversations={conversations}
                    onSelectConversation={handleSelectConversation}
                    onStartChat={handleStartChat}
                    onOpenSettings={() => {
                      const proj = projects.find(p => p.id === activeProjectId);
                      if (proj) setSettingsProject(proj);
                    }}
                    isLoading={isLoadingData}
                    isSending={isSendingFromProject}
                  />
                ) : (
                  <Chat
                    onHealthChange={() => {}}
                    conversationId={activeConversationId}
                    onConversationCreated={handleConversationCreated}
                    onMessageSent={refreshConversations}
                    projectId={activeProjectId}
                  />
                )
              } />
              <Route path="/chat/:conversationId" element={
                <Chat
                  onHealthChange={() => {}}
                  onConversationCreated={handleConversationCreated}
                  onMessageSent={refreshConversations}
                  projectId={activeProjectId}
                />
              } />
              <Route path="/generator" element={<CurriculumGenerator />} />
              <Route path="/generator/batch" element={<BatchGenerator />} />
              <Route path="/admin/chunks" element={<ChunksPage />} />
              <Route path="/chunks" element={<Navigate to="/admin/chunks" replace />} />
              <Route path="/lesson/:moduleCode/:lessonNumber" element={<LessonDetail />} />

              {/* Images */}
              <Route path="/images" element={
                <IllustrationsModule sidebarFilter={illustrationFilter} onClearSidebarFilter={() => setIllustrationFilter({ type: 'all' })} />
              } />
              <Route path="/images/:id" element={<ImageDetail />} />

              {/* Video */}
              <Route path="/video" element={
                <VideoModule sidebarFilter={videoFilter} />
              } />
              <Route path="/video/:id" element={<VideoDetail />} />

              {/* Audio */}
              <Route path="/audio" element={<AudioModule sidebarFilter={audioFilter} />} />
              <Route path="/audio/create" element={<VoiceCreator />} />
              <Route path="/audio/:id" element={<AudioDetail />} />

              {/* Episodes */}
              <Route path="/episodes" element={<EpisodesModule />} />
              <Route path="/episodes/new" element={<NewEpisode />} />
              <Route path="/episodes/:id" element={<EpisodeWorkspace />} />

              {/* Characters */}
              <Route path="/characters" element={<CharactersPage />} />
              <Route path="/characters/new" element={<NewCharacterPage />} />
              <Route path="/characters/:id" element={<CharacterProfile />} />

              {/* Admin */}
              <Route path="/admin" element={<AdminPage currentUserEmail={user.email} />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Project Settings Panel */}
      {settingsProject && (
        <Suspense fallback={null}>
          <ProjectSettingsPanel
            project={settingsProject}
            isOpen={!!settingsProject}
            onClose={() => setSettingsProject(null)}
            onProjectUpdate={handleProjectUpdate}
            onProjectDelete={handleProjectDeleteFromSettings}
          />
        </Suspense>
      )}

      {/* Workspace overlays */}
      {artWorkspaceOpen && (
        <Suspense fallback={null}>
          <CharacterArtWorkspace
            illustration={null}
            onComplete={() => { setArtWorkspaceOpen(false); }}
            onClose={() => setArtWorkspaceOpen(false)}
          />
        </Suspense>
      )}
      {videoWorkspaceOpen && (
        <Suspense fallback={null}>
          <VideoWorkspace
            onComplete={() => setVideoWorkspaceOpen(false)}
            onClose={() => setVideoWorkspaceOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
