import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@heroicons/react/24/outline';
import type { Illustration } from '../../lib/types';
import { getVideos, deleteVideo } from '../../lib/api';
import type { SidebarFilter } from '../illustrations/IllustrationsSidebar';
import VideoGallery from './VideoGallery';
import VideoWorkspace from './VideoWorkspace';
import DeleteConfirmModal from '../illustrations/DeleteConfirmModal';

interface VideoModuleProps {
  sidebarFilter?: SidebarFilter;
}

export default function VideoModule({ sidebarFilter }: VideoModuleProps) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Illustration[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Illustration | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceSourceIllustration, setWorkspaceSourceIllustration] = useState<Illustration | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: { search?: string; limit?: number; characterId?: string; lessonId?: string } = { limit: 50 };
      if (search) params.search = search;
      if (sidebarFilter?.type === 'character') params.characterId = sidebarFilter.id;
      if (sidebarFilter?.type === 'lesson') params.lessonId = sidebarFilter.id;

      const data = await getVideos(params);
      if (isMountedRef.current) {
        setVideos(data.videos);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [search, sidebarFilter]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Navigate to full-page detail view
  const handleSelect = useCallback((video: Illustration) => {
    navigate(`/video/${video.id}`);
  }, [navigate]);

  // Request delete (shows confirm modal)
  const handleDeleteRequest = useCallback((video: Illustration) => {
    setDeleteTarget(video);
  }, []);

  // Confirm delete
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    await deleteVideo(deleteTarget.id);
    setDeleteTarget(null);
    setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
    setTotal((prev) => prev - 1);
  }, [deleteTarget]);

  // Open workspace fresh (no source illustration)
  const handleOpenWorkspace = useCallback(() => {
    setWorkspaceSourceIllustration(null);
    setWorkspaceOpen(true);
  }, []);

  // Workspace complete
  const handleWorkspaceComplete = useCallback(() => {
    fetchVideos();
    setWorkspaceOpen(false);
    setWorkspaceSourceIllustration(null);
  }, [fetchVideos]);

  const handleCloseWorkspace = useCallback(() => {
    setWorkspaceOpen(false);
    setWorkspaceSourceIllustration(null);
    fetchVideos();
  }, [fetchVideos]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Video</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Generate and manage animated videos
            </p>
          </div>
          {total > 0 && (
            <span className="text-xs text-neutral-400">
              {total} video{total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Create new video button */}
        <button
          onClick={handleOpenWorkspace}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-neutral-300
            hover:border-stc-purple-300 hover:bg-stc-purple-50/50 transition-all duration-200
            flex items-center justify-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-stc-purple-100 flex items-center justify-center transition-colors">
            <PlusIcon className="w-5 h-5 text-neutral-400 group-hover:text-stc-purple-500 transition-colors" />
          </div>
          <span className="text-sm font-medium text-neutral-500 group-hover:text-stc-purple-600 transition-colors">
            Create New Video
          </span>
        </button>

        {/* Gallery */}
        <VideoGallery
          videos={videos}
          isLoading={isLoading}
          search={search}
          onSearchChange={setSearch}
          onSelect={handleSelect}
          onDelete={handleDeleteRequest}
        />
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          illustration={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Video workspace */}
      {workspaceOpen && (
        <VideoWorkspace
          onComplete={handleWorkspaceComplete}
          onClose={handleCloseWorkspace}
        />
      )}
    </div>
  );
}
