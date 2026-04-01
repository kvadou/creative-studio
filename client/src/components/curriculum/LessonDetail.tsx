import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeftIcon, ExclamationCircleIcon, StarIcon, PhotoIcon, PlayIcon as PlayIconOutline } from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid } from '@heroicons/react/24/solid';
import type { Illustration } from '../../lib/types';
import { getIllustrations, getVideos } from '../../lib/api';

interface LessonCharacterRef {
  id: string;
  name: string;
  piece: string | null;
}

interface LessonContent {
  id: string;
  moduleCode: string;
  moduleTitle: string;
  lessonNumber: number;
  title: string;
  content: string;
  characters?: LessonCharacterRef[];
}

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-neutral-200 rounded" style={{ width: `${80 - i * 15}%` }} />
      ))}
    </div>
  );
}

function ImageGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl bg-neutral-200 animate-pulse" />
      ))}
    </div>
  );
}

function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md">
        <PlayIconSolid className="w-5 h-5 text-stc-purple-500 ml-0.5" />
      </div>
    </div>
  );
}

export default function LessonDetail() {
  const { moduleCode, lessonNumber } = useParams<{ moduleCode: string; lessonNumber: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const [lesson, setLesson] = useState<LessonContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [images, setImages] = useState<Illustration[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const [videos, setVideos] = useState<Illustration[]>([]);
  const [videosLoading, setVideosLoading] = useState(false);

  // Scroll to top when lesson changes
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [moduleCode, lessonNumber]);

  // Fetch lesson content
  useEffect(() => {
    if (!moduleCode || !lessonNumber) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/lessons/${moduleCode}/${lessonNumber}`);
        if (!response.ok) {
          throw new Error('Lesson not found');
        }
        const data: LessonContent = await response.json();
        if (cancelled) return;

        setLesson(data);

        // Fetch images and videos in parallel once we have the lesson ID
        setImagesLoading(true);
        setVideosLoading(true);

        const [imgData, vidData] = await Promise.all([
          getIllustrations({ lessonId: data.id, limit: 100 }).catch(() => ({ illustrations: [], total: 0, page: 1, limit: 100 })),
          getVideos({ limit: 200 }).catch(() => ({ videos: [], total: 0, page: 1, limit: 200 })),
        ]);

        if (cancelled) return;

        setImages(imgData.illustrations);
        setImagesLoading(false);

        // Filter videos to only those linked to this lesson
        const lessonVideos = vidData.videos.filter((v) => v.lessonId === data.id);
        setVideos(lessonVideos);
        setVideosLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lesson');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [moduleCode, lessonNumber]);

  return (
    <div ref={containerRef} className="min-h-full bg-stc-bg overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8 md:py-12">
        {/* Back link */}
        <button
          onClick={() => navigate('/curriculum')}
          className="inline-flex items-center gap-1.5 text-stc-purple-500 hover:text-stc-purple-700 font-medium text-sm transition-colors duration-200 mb-6 min-h-[44px]"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Curriculum
        </button>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl shadow-card p-6 sm:p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-3 bg-neutral-200 rounded w-1/4" />
              <div className="h-7 bg-neutral-200 rounded w-3/4" />
              <div className="mt-6 space-y-3">
                <div className="h-4 bg-neutral-200 rounded w-full" />
                <div className="h-4 bg-neutral-200 rounded w-5/6" />
                <div className="h-4 bg-neutral-200 rounded w-4/6" />
                <div className="h-4 bg-neutral-200 rounded w-full" />
                <div className="h-4 bg-neutral-200 rounded w-3/4" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-white rounded-2xl shadow-card p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-stc-pink/15 flex items-center justify-center mx-auto mb-4">
              <ExclamationCircleIcon className="w-7 h-7 text-stc-pink" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900 mb-1">No content available</h2>
            <p className="text-neutral-500 text-sm mb-6">
              Could not find the requested lesson.
            </p>
            <button
              onClick={() => navigate('/curriculum')}
              className="px-5 py-2.5 bg-stc-purple-500 hover:bg-stc-purple-600 text-white font-semibold rounded-xl transition-colors duration-200 min-h-[44px]"
            >
              Back to Curriculum
            </button>
          </div>
        )}

        {/* Lesson Content */}
        {lesson && !loading && (
          <div className="space-y-6">
            {/* Story / Content Card */}
            <section className="bg-white rounded-2xl shadow-card overflow-hidden">
              {/* Header */}
              <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-neutral-200">
                <p className="text-stc-purple-500 text-xs font-semibold tracking-wide uppercase mb-1">
                  Module {lesson.moduleCode}
                </p>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-neutral-900 leading-tight">
                  Lesson {lesson.lessonNumber}: {lesson.title}
                </h1>
                {lesson.moduleTitle && (
                  <p className="text-neutral-400 text-sm mt-1">{lesson.moduleTitle}</p>
                )}

                {/* Characters in this lesson */}
                {lesson.characters && lesson.characters.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {lesson.characters.map((char) => (
                      <Link
                        key={char.id}
                        to={`/characters/${char.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stc-purple-50 text-stc-purple-600
                          hover:bg-stc-purple-100 text-xs font-semibold transition-colors min-h-[32px]"
                      >
                        <StarIcon className="w-3.5 h-3.5" />
                        {char.name}
                        {char.piece && (
                          <span className="text-stc-purple-400 font-normal">({char.piece})</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-6 sm:px-8 py-6 sm:py-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-stc-purple-500 rounded-full" />
                  <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Story</h2>
                </div>

                <div className="prose prose-sm sm:prose-base max-w-none
                  prose-headings:font-semibold prose-headings:text-neutral-900
                  prose-h2:text-lg prose-h2:text-stc-purple-700
                  prose-h3:text-base
                  prose-p:text-neutral-700 prose-p:leading-relaxed
                  prose-ul:list-disc prose-ol:list-decimal
                  prose-li:text-neutral-700
                  prose-strong:text-neutral-900
                  prose-blockquote:border-l-4 prose-blockquote:border-stc-purple-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-600
                  prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                  prose-a:text-stc-purple-600
                ">
                  <ReactMarkdown>{lesson.content}</ReactMarkdown>
                </div>
              </div>
            </section>

            {/* Images Section */}
            <section className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <PhotoIcon className="w-5 h-5 text-stc-purple-400" />
                  <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                    Images{!imagesLoading && ` (${images.length})`}
                  </h2>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-5">
                {imagesLoading && <ImageGridSkeleton />}

                {!imagesLoading && images.length === 0 && (
                  <p className="text-neutral-400 text-sm text-center py-4">
                    No images linked to this lesson yet.
                  </p>
                )}

                {!imagesLoading && images.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {images.map((img) => {
                      const thumbUrl = img.illustrationUrl || img.sourcePhotoUrl;

                      return (
                        <Link
                          key={img.id}
                          to={`/images/${img.id}`}
                          className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 cursor-pointer ring-2 ring-transparent hover:ring-stc-purple-300 focus-visible:ring-stc-purple-400 transition-all"
                        >
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={img.name}
                              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <PhotoIcon className="w-8 h-8 text-neutral-300" />
                            </div>
                          )}
                          {/* Name tooltip on hover */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-medium truncate">{img.name}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Videos Section */}
            <section className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="px-6 sm:px-8 py-5 border-b border-neutral-200">
                <div className="flex items-center gap-2">
                  <PlayIconOutline className="w-5 h-5 text-stc-blue" />
                  <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide">
                    Videos{!videosLoading && ` (${videos.length})`}
                  </h2>
                </div>
              </div>

              <div className="px-6 sm:px-8 py-5">
                {videosLoading && <ImageGridSkeleton />}

                {!videosLoading && videos.length === 0 && (
                  <p className="text-neutral-400 text-sm text-center py-4">
                    No videos linked to this lesson yet.
                  </p>
                )}

                {!videosLoading && videos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {videos.map((vid) => {
                      const thumbUrl = vid.thumbnailUrl || vid.sourcePhotoUrl;

                      return (
                        <Link
                          key={vid.id}
                          to={`/video/${vid.id}`}
                          className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 cursor-pointer ring-2 ring-transparent hover:ring-blue-300 focus-visible:ring-blue-400 transition-all"
                        >
                          {thumbUrl ? (
                            <>
                              <img
                                src={thumbUrl}
                                alt={vid.name}
                                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-200"
                                loading="lazy"
                              />
                              <PlayOverlay />
                            </>
                          ) : (
                            <div className="flex items-center justify-center w-full h-full">
                              <PlayOverlay />
                            </div>
                          )}
                          {/* Name tooltip on hover */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-medium truncate">{vid.name}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
