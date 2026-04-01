import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  VideoCameraIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import type { Illustration, ModuleWithLessons } from '../../lib/types';
import { getVideoDetail, updateVideo, deleteVideo, getModulesWithLessons } from '../../lib/api';
import VideoWorkspace from './VideoWorkspace';
import DeleteConfirmModal from '../illustrations/DeleteConfirmModal';

export default function VideoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [video, setVideo] = useState<Illustration | null>(null);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Workspace overlay
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);

  // Selected generation for preview
  const [previewGenId, setPreviewGenId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      getVideoDetail(id),
      getModulesWithLessons(),
    ]).then(([vid, mods]) => {
      setVideo(vid);
      setName(vid.name);
      setDescription(vid.description || '');
      setSelectedLessonId(vid.lessonId ?? null);
      setModules(mods);
    }).catch(console.error)
    .finally(() => setLoading(false));
  }, [id]);

  // Auto-save name on blur
  const handleSaveName = useCallback(async () => {
    if (!video || name === video.name) return;
    setSaving(true);
    try {
      const updated = await updateVideo(video.id, { name });
      setVideo(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [video, name]);

  // Auto-save description on blur
  const handleSaveDescription = useCallback(async () => {
    if (!video || description === (video.description || '')) return;
    setSaving(true);
    try {
      const updated = await updateVideo(video.id, { description: description || null });
      setVideo(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [video, description]);

  // Save lesson change immediately
  const handleLessonChange = useCallback(async (lessonId: string | null) => {
    if (!video) return;
    setSelectedLessonId(lessonId);
    setSaving(true);
    try {
      const updated = await updateVideo(video.id, { lessonId });
      setVideo(prev => prev ? { ...prev, ...updated } : prev);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [video]);

  const handleDelete = useCallback(async () => {
    if (!video) return;
    await deleteVideo(video.id);
    navigate('/video');
  }, [video, navigate]);

  const handleDownload = useCallback(() => {
    if (!video?.videoUrl) return;
    const a = document.createElement('a');
    a.href = video.videoUrl;
    a.download = `${video.name || 'video'}.mp4`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [video]);

  // Loading state
  if (loading) {
    return (
      <div className="h-full overflow-y-auto bg-stc-bg">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-5 w-32 bg-neutral-200 rounded" />
            <div className="h-[400px] bg-neutral-200 rounded-2xl" />
            <div className="h-32 bg-neutral-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!video) {
    return (
      <div className="h-full overflow-y-auto bg-stc-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-500 mb-4">Video not found</p>
          <Link to="/video" className="text-stc-purple-500 hover:text-stc-purple-700 text-sm font-medium">
            Back to Videos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-stc-bg">
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Back link */}
        <Link
          to="/video"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-stc-purple-600 transition-colors mb-6 min-h-[44px]"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Videos
        </Link>

        {/* Video Player */}
        <div className="bg-black rounded-2xl overflow-hidden mb-6">
          {video.videoUrl ? (
            <video
              controls
              autoPlay
              loop
              className="max-h-[60vh] w-full rounded-2xl"
            >
              <source src={video.videoUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <VideoCameraIcon className="w-12 h-12 text-neutral-600 mx-auto mb-2" />
                <span className="text-neutral-500 text-sm">Video not available</span>
              </div>
            </div>
          )}
        </div>

        {/* Editable Fields Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
          {/* Saving indicator */}
          {saving && (
            <p className="text-xs text-stc-purple-500 font-medium">Saving...</p>
          )}

          {/* Name */}
          <div>
            <label htmlFor="vid-name" className="block text-xs font-medium text-neutral-500 mb-1">Name</label>
            <input
              id="vid-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              className="w-full px-3 py-2.5 text-lg font-semibold text-neutral-800 border border-neutral-200 rounded-xl
                focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="vid-desc" className="block text-xs font-medium text-neutral-500 mb-1">Description</label>
            <textarea
              id="vid-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              placeholder="Add a description..."
              className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl resize-none
                focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
            />
          </div>

          {/* Lesson Dropdown */}
          <div>
            <label htmlFor="vid-lesson" className="block text-xs font-medium text-neutral-500 mb-1">Lesson</label>
            <select
              id="vid-lesson"
              value={selectedLessonId || ''}
              onChange={(e) => handleLessonChange(e.target.value || null)}
              className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl
                focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors
                bg-white min-h-[44px]"
            >
              <option value="">No lesson assigned</option>
              {modules.map((mod) => (
                <optgroup key={mod.id} label={`${mod.code} — ${mod.title}`}>
                  {mod.lessons.map((lesson) => (
                    <option key={lesson.id} value={lesson.id}>
                      L{lesson.lessonNumber}: {lesson.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Metadata Row */}
          <div className="flex items-center gap-3 flex-wrap pt-2 text-xs text-neutral-400">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stc-blue/15 text-stc-navy">
              Video
            </span>
            {video.duration && (
              <>
                <span className="text-neutral-300">|</span>
                <span>{video.duration}s</span>
              </>
            )}
            {video.aspectRatio && (
              <>
                <span className="text-neutral-300">|</span>
                <span>{video.aspectRatio}</span>
              </>
            )}
            <span className="text-neutral-300">|</span>
            <span>{video.createdByEmail.split('@')[0]}</span>
            <span className="text-neutral-300">|</span>
            <span>{new Date(video.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          {/* Source Illustration Link */}
          {video.sourceIllustration && (
            <div className="pt-2">
              <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Source Illustration</p>
              <Link
                to={`/images/${video.sourceIllustrationId}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-200 hover:border-stc-purple-200 hover:bg-stc-purple-50/30 transition-colors"
              >
                {video.sourceIllustration.illustrationUrl && (
                  <img
                    src={video.sourceIllustration.illustrationUrl}
                    alt="Source"
                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-neutral-700 truncate">{video.sourceIllustration.name}</p>
                  <p className="text-[10px] text-stc-purple-500">View source image</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              </Link>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap mb-8">
          <button
            onClick={() => setWorkspaceOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              text-stc-purple-600 border border-stc-purple-300 hover:bg-stc-purple-50
              transition-colors min-h-[44px]"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Re-animate
          </button>
          {video.videoUrl && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                text-neutral-600 border border-neutral-300 hover:bg-neutral-50
                transition-colors min-h-[44px]"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Download
            </button>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
              text-stc-pink border border-stc-pink/20 hover:bg-stc-pink/10
              transition-colors min-h-[44px]"
          >
            <TrashIcon className="w-4 h-4" />
            Delete
          </button>
        </div>

        {/* Generation History */}
        {video.generations && video.generations.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-neutral-700 mb-3">Generation History</h3>
            <div className="flex gap-3 overflow-x-auto pb-3">
              {[...video.generations].reverse().map((gen, idx) => {
                const genUrl = gen.savedImageUrl || gen.outputImageUrl;
                const isActive = previewGenId
                  ? gen.id === previewGenId
                  : gen.selected;
                const versionNum = video.generations!.length - idx;
                return (
                  <button
                    key={gen.id}
                    onClick={() => setPreviewGenId(isActive && previewGenId ? null : gen.id)}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200
                      ${isActive ? 'border-stc-purple-500 ring-2 ring-stc-purple-200' : 'border-neutral-200 hover:border-neutral-300'}
                    `}
                    title={`Version ${versionNum}${gen.selected ? ' (selected)' : ''}`}
                  >
                    {genUrl ? (
                      <img src={genUrl} alt={`v${versionNum}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                        <span className="text-[10px] text-neutral-400">v{versionNum}</span>
                      </div>
                    )}
                    {gen.selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-stc-purple-500 flex items-center justify-center">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-center">
                      <span className="text-[10px] font-medium text-white">v{versionNum}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* VideoWorkspace Overlay */}
      {workspaceOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <VideoWorkspace
            onComplete={() => {
              setWorkspaceOpen(false);
              // Reload the video to pick up new generations
              if (id) {
                getVideoDetail(id).then((updated) => {
                  setVideo(updated);
                  setName(updated.name);
                  setDescription(updated.description || '');
                }).catch(console.error);
              }
            }}
            onClose={() => setWorkspaceOpen(false)}
          />
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDelete && (
        <DeleteConfirmModal
          illustration={video}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  );
}
