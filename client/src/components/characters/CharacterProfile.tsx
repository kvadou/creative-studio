import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  BookOpenIcon,
  PhotoIcon,
  VideoCameraIcon,
  MicrophoneIcon,
  CameraIcon,
  XMarkIcon,
  PlusIcon,
  CheckIcon,
  ChevronRightIcon,
  UserIcon,
  InformationCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid, PauseIcon as PauseIconSolid } from '@heroicons/react/20/solid';
import { getCharacter, getCharacters, addIllustrationCharacter, removeIllustrationCharacter, updateCharacter, generateCharacterBio } from '../../lib/api';
import type { CharacterDetail, CharacterLesson, Illustration, CharacterVoiceRef, CharacterSummary } from '../../lib/types';

const CharacterPhotoModal = lazy(() => import('./CharacterPhotoModal'));

type ProfileTab = 'posts' | 'about' | 'photos' | 'videos' | 'audio';

export default function CharacterProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<'cover' | 'profile' | 'avatar' | null>(null);

  useEffect(() => {
    if (!id) return;
    window.scrollTo(0, 0);
    getCharacter(id)
      .then(setCharacter)
      .catch(() => setError('Could not load character'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin h-6 w-6 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/characters')} className="text-stc-purple-600 hover:text-stc-purple-700 text-sm font-medium mb-4 inline-flex items-center gap-1">
          <ChevronLeft />
          Home
        </button>
        <p className="text-neutral-500">{error || 'Character not found'}</p>
      </div>
    );
  }

  // Pick cover and profile photos — prefer stored selections, fall back to auto-pick
  const allPhotos = character.illustrations.filter((i) => i.illustrationUrl || i.sourcePhotoUrl);

  // Parse position string: "50% 30% 1.5" → CSS styles
  // Always uses contain + scale so editor and display match (WYSIWYG)
  const parsePhotoStyle = (pos: string): React.CSSProperties => {
    const parts = pos.split(' ');
    const x = parts[0] || '50%';
    const y = parts[1] || '50%';
    const s = parseFloat(parts[2]) || 1;
    return {
      objectFit: 'contain',
      objectPosition: `${x} ${y}`,
      transform: s !== 1 ? `scale(${s})` : undefined,
      transformOrigin: s !== 1 ? `${x} ${y}` : undefined,
    };
  };

  // Gold standard helpers for auto-pick
  const tposePhoto = allPhotos.find(i => i.isGoldStandard && i.goldStandardType === 'TPOSE');
  const referencePhoto = allPhotos.find(i => i.isGoldStandard && i.goldStandardType === 'REFERENCE');

  const coverUrl = character.coverIllustration
    ? (character.coverIllustration.illustrationUrl || character.coverIllustration.sourcePhotoUrl)
    : (tposePhoto?.illustrationUrl || tposePhoto?.sourcePhotoUrl || allPhotos[0]?.illustrationUrl || allPhotos[0]?.sourcePhotoUrl);
  const coverPosition = character.coverPosition || '50% 50%';

  const profileUrl = character.profileIllustration
    ? (character.profileIllustration.illustrationUrl || character.profileIllustration.sourcePhotoUrl)
    : (referencePhoto?.illustrationUrl || referencePhoto?.sourcePhotoUrl
      || (allPhotos.length > 1
        ? (allPhotos[1]?.illustrationUrl || allPhotos[1]?.sourcePhotoUrl)
        : (allPhotos[0]?.illustrationUrl || allPhotos[0]?.sourcePhotoUrl)));
  const profilePosition = character.profilePosition || '50% 50%';

  const avatarUrl = character.avatarIllustration
    ? (character.avatarIllustration.illustrationUrl || character.avatarIllustration.sourcePhotoUrl)
    : null;
  const avatarPosition = character.avatarPosition || '50% 50%';

  const reloadCharacter = () => {
    if (!id) return;
    getCharacter(id).then(setCharacter).catch(console.error);
  };

  const tabs: { key: ProfileTab; label: string; count?: number }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'about', label: 'About' },
    { key: 'photos', label: 'Photos', count: character.illustrations.length },
    { key: 'videos', label: 'Videos', count: character.videos.length },
    { key: 'audio', label: 'Audio', count: character.voices.length },
  ];

  const toggleVoice = (voiceId: string, sampleUrl: string) => {
    const current = audioRefs.current.get(voiceId);
    if (playingVoice === voiceId && current) {
      current.pause();
      current.currentTime = 0;
      setPlayingVoice(null);
      return;
    }
    // Stop any currently playing
    if (playingVoice) {
      const prev = audioRefs.current.get(playingVoice);
      if (prev) { prev.pause(); prev.currentTime = 0; }
    }
    let audio = current;
    if (!audio) {
      audio = new Audio(sampleUrl);
      audio.addEventListener('ended', () => setPlayingVoice(null));
      audioRefs.current.set(voiceId, audio);
    }
    audio.play();
    setPlayingVoice(voiceId);
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Breadcrumbs */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <nav className="flex items-center gap-1.5 text-sm">
          <Link to="/home" className="text-neutral-400 hover:text-stc-purple-600 transition-colors font-medium">Home</Link>
          <span className="text-neutral-300">/</span>
          <Link to="/characters" className="text-neutral-400 hover:text-stc-purple-600 transition-colors font-medium">Characters</Link>
          <span className="text-neutral-300">/</span>
          <span className="text-neutral-700 font-semibold">{character.name}</span>
        </nav>
      </div>

      {/* Cover photo + Profile photo */}
      <div className="relative mt-3 mx-4 sm:mx-6">
        {/* Cover */}
        <button
          onClick={() => setPhotoModal('cover')}
          className="relative w-full h-48 sm:h-64 rounded-2xl overflow-hidden bg-gradient-to-br from-stc-purple-200 to-stc-purple-400 group cursor-pointer"
        >
          {coverUrl && (
            <img
              src={coverUrl}
              alt={`${character.name} cover`}
              className="absolute inset-0 w-full h-full"
              style={parsePhotoStyle(coverPosition)}
            />
          )}
          {/* Edit overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 text-white text-sm font-medium">
              <CameraIcon className="w-4 h-4" />
              Edit Cover
            </div>
          </div>
        </button>

        {/* Profile photo */}
        <div className="absolute -bottom-16 left-4 sm:left-6">
          <button
            onClick={() => setPhotoModal('profile')}
            className="relative w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-stc-purple-100 group cursor-pointer"
          >
            {profileUrl ? (
              <img
                src={profileUrl}
                alt={character.name}
                className="absolute inset-0 w-full h-full"
                style={parsePhotoStyle(profilePosition)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-5xl font-bold text-stc-purple-400">
                  {character.name.charAt(0)}
                </span>
              </div>
            )}
            {/* Edit overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-full flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <CameraIcon className="w-6 h-6 text-white drop-shadow-lg" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Name + info (below profile photo) */}
      <div className="px-4 sm:px-6 pt-20 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Avatar thumbnail — used in sidebar */}
          <button
            onClick={() => setPhotoModal('avatar')}
            className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-neutral-200 hover:border-stc-purple-400 transition-colors group shrink-0 bg-stc-purple-50"
            title="Set sidebar thumbnail"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="w-full h-full"
                style={parsePhotoStyle(avatarPosition)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-sm font-bold text-stc-purple-300">{character.name.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-full flex items-center justify-center">
              <CameraIcon className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
            </div>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">{character.name}</h1>
          {character.piece && (
            <span className="px-3 py-1 rounded-full bg-stc-purple-100 text-stc-purple-700 text-sm font-medium">
              {character.piece}
            </span>
          )}
        </div>
        {character.trait && (
          <p className="mt-1.5 text-neutral-600 italic text-lg">{character.trait}</p>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 mt-3 text-sm text-neutral-500">
          {character.movementNote && (
            <div>
              <span className="font-medium text-neutral-700">Movement:</span> {character.movementNote}
            </div>
          )}
          {character.firstAppearance && (
            <div>
              <span className="font-medium text-neutral-700">First Appearance:</span> {character.firstAppearance}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-4 sm:gap-6 mt-4 text-sm">
          <StatBadge icon={<BookIcon />} count={character.lessonCount} label="Lessons" color="blue" onClick={() => setActiveTab('about')} />
          <StatBadge icon={<ImageIcon />} count={character.illustrationCount} label="Photos" color="amber" onClick={() => setActiveTab('photos')} />
          <StatBadge icon={<VideoIcon />} count={character.videos.length} label="Videos" color="rose" onClick={() => setActiveTab('videos')} />
          <StatBadge icon={<MicIcon />} count={character.voiceCount} label="Voices" color="green" onClick={() => setActiveTab('audio')} />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-neutral-200 px-4 sm:px-6">
        <div className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
                activeTab === tab.key
                  ? 'border-stc-purple-500 text-stc-purple-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 sm:px-6 pt-6">
        {activeTab === 'posts' && (
          <PostsTab
            illustrations={character.illustrations}
            videos={character.videos}
            voices={character.voices}
            characterName={character.name}
            onReload={reloadCharacter}
            playingVoice={playingVoice}
            onToggleVoice={toggleVoice}
          />
        )}
        {activeTab === 'about' && (
          <AboutTab
            character={character}
            onBioUpdate={(bio) => setCharacter({ ...character, bio })}
            onFieldUpdate={(field, value) => setCharacter({ ...character, [field]: value })}
          />
        )}
        {activeTab === 'photos' && (
          <PhotosTab
            illustrations={character.illustrations}
            onReload={reloadCharacter}
          />
        )}
        {activeTab === 'videos' && <VideosTab videos={character.videos} />}
        {activeTab === 'audio' && (
          <AudioTab
            voices={character.voices}
            playingVoice={playingVoice}
            onToggleVoice={toggleVoice}
          />
        )}
      </div>

      {/* Photo modal */}
      {photoModal && (
        <Suspense fallback={null}>
          <CharacterPhotoModal
            characterId={character.id}
            type={photoModal}
            currentUrl={
              photoModal === 'cover' ? coverUrl || null
              : photoModal === 'avatar' ? avatarUrl || null
              : profileUrl || null
            }
            currentPosition={
              photoModal === 'cover' ? coverPosition
              : photoModal === 'avatar' ? avatarPosition
              : profilePosition
            }
            currentIllustrationId={
              photoModal === 'cover' ? character.coverIllustrationId
              : photoModal === 'avatar' ? character.avatarIllustrationId
              : character.profileIllustrationId
            }
            illustrations={character.illustrations}
            onSave={() => {
              setPhotoModal(null);
              reloadCharacter();
            }}
            onClose={() => setPhotoModal(null)}
          />
        </Suspense>
      )}
    </div>
  );
}

/* ---- Bio Section ---- */

function BioSection({ characterId, bio, onUpdate }: {
  characterId: string;
  bio: string | null;
  onUpdate: (bio: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(bio || '');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editing]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateCharacterBio(characterId);
      onUpdate(result.bio);
      setEditText(result.bio);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateCharacter(characterId, { bio: editText || null });
      onUpdate(editText || null);
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!bio && !editing && !generating) {
    return (
      <div className="mt-5 py-6 px-4 bg-neutral-50 rounded-xl text-center">
        <p className="text-sm text-neutral-400 mb-3">No bio yet</p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 rounded-xl bg-stc-purple-500 text-white text-sm font-medium hover:bg-stc-purple-600 transition-colors min-h-[44px]"
        >
          Generate Bio from Lessons
        </button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="mt-5 py-8 px-4 bg-neutral-50 rounded-xl text-center">
        <div className="animate-spin h-5 w-5 border-2 border-stc-purple-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-neutral-500">Generating bio from curriculum...</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-neutral-500">About</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditing(false); setEditText(bio || ''); }}
              className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors min-h-[36px]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-stc-purple-500 text-white text-xs font-medium hover:bg-stc-purple-600 transition-colors disabled:opacity-50 min-h-[36px]"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm text-neutral-700 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
          rows={4}
        />
      </div>
    );
  }

  return (
    <div className="mt-5 group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-neutral-500">About</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => { setEditText(bio || ''); setEditing(true); }}
            className="px-2.5 py-1 text-xs font-medium text-neutral-400 hover:text-stc-purple-600 transition-colors rounded-lg hover:bg-stc-purple-50"
          >
            Edit
          </button>
          <button
            onClick={handleGenerate}
            className="px-2.5 py-1 text-xs font-medium text-neutral-400 hover:text-stc-purple-600 transition-colors rounded-lg hover:bg-stc-purple-50"
          >
            Regenerate
          </button>
        </div>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-line">{bio}</p>
    </div>
  );
}

/* ---- Tab Components ---- */

type FeedItem = {
  id: string;
  type: 'photo' | 'video' | 'audio';
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  raw: Illustration | CharacterVoiceRef;
};

function PostsTab({
  illustrations,
  videos,
  voices,
  characterName,
  onReload,
  playingVoice,
  onToggleVoice,
}: {
  illustrations: Illustration[];
  videos: Illustration[];
  voices: CharacterVoiceRef[];
  characterName: string;
  onReload: () => void;
  playingVoice: string | null;
  onToggleVoice: (id: string, url: string) => void;
}) {
  const [viewingIll, setViewingIll] = useState<Illustration | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterSummary[]>([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  useEffect(() => {
    getCharacters().then(setAllCharacters).catch(console.error);
  }, []);

  // Merge all content into a single feed sorted by createdAt desc
  const feedItems: FeedItem[] = [
    ...illustrations.map((ill): FeedItem => ({
      id: ill.id,
      type: 'photo',
      title: ill.name || 'Photo',
      description: ill.description,
      thumbnailUrl: ill.illustrationUrl || ill.sourcePhotoUrl,
      createdAt: ill.createdAt,
      raw: ill,
    })),
    ...videos.map((vid): FeedItem => ({
      id: vid.id,
      type: 'video',
      title: vid.name || 'Video',
      description: vid.description,
      thumbnailUrl: vid.thumbnailUrl || vid.illustrationUrl,
      createdAt: vid.createdAt,
      raw: vid,
    })),
    ...voices.map((v): FeedItem => ({
      id: v.id,
      type: 'audio',
      title: v.name || 'Voice',
      description: v.description,
      thumbnailUrl: null,
      createdAt: v.createdAt || '',
      raw: v,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (feedItems.length === 0) {
    return <EmptyState label={`No content for ${characterName} yet`} />;
  }

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'photo': return 'New photo added';
      case 'video': return 'New video created';
      case 'audio': return 'New voice added';
      default: return 'New content';
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'photo': return <ImageIcon />;
      case 'video': return <VideoIcon />;
      case 'audio': return <MicIcon />;
      default: return null;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'photo': return 'bg-stc-orange/10 text-stc-orange';
      case 'video': return 'bg-stc-pink/10 text-stc-pink';
      case 'audio': return 'bg-stc-green/10 text-stc-green';
      default: return 'bg-neutral-50 text-neutral-600';
    }
  };

  // Navigate lightbox
  const lightboxItems = feedItems.filter(f => f.type === 'photo');
  const currentLightboxIndex = viewingIll ? lightboxItems.findIndex(f => f.id === viewingIll.id) : -1;
  const goNext = () => {
    if (currentLightboxIndex < lightboxItems.length - 1) {
      setViewingIll(lightboxItems[currentLightboxIndex + 1].raw as Illustration);
      setShowCharacterPicker(false);
    }
  };
  const goPrev = () => {
    if (currentLightboxIndex > 0) {
      setViewingIll(lightboxItems[currentLightboxIndex - 1].raw as Illustration);
      setShowCharacterPicker(false);
    }
  };

  // Keyboard nav for lightbox
  useEffect(() => {
    if (!viewingIll) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') setViewingIll(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewingIll, currentLightboxIndex]);

  return (
    <div className="space-y-3">
      {feedItems.map((item) => (
        <div key={`${item.type}-${item.id}`} className="bg-white rounded-xl border border-neutral-100 overflow-hidden hover:shadow-sm transition-shadow">
          {/* Card header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className={`w-8 h-8 rounded-lg ${typeColor(item.type)} flex items-center justify-center`}>
              {typeIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{typeLabel(item.type)}</p>
              <p className="text-xs text-neutral-400">{formatRelativeTime(item.createdAt)}</p>
            </div>
          </div>

          {/* Content */}
          {item.type === 'photo' && item.thumbnailUrl && (
            <button
              onClick={() => setViewingIll(item.raw as Illustration)}
              className="w-full"
            >
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                className="w-full max-h-80 object-cover hover:opacity-95 transition-opacity"
              />
            </button>
          )}

          {item.type === 'video' && (
            <Link to={`/video/${item.id}`} className="block relative">
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.title} className="w-full max-h-80 object-cover" />
              ) : (
                <div className="w-full h-48 bg-neutral-100 flex items-center justify-center">
                  <VideoIcon />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                  <PlayIconSolid className="w-6 h-6 text-white ml-0.5" />
                </div>
              </div>
            </Link>
          )}

          {item.type === 'audio' && (() => {
            const voice = item.raw as CharacterVoiceRef;
            return (
              <div className="px-4 pb-3 flex items-center gap-3">
                {voice.sampleUrl ? (
                  <button
                    onClick={() => onToggleVoice(voice.id, voice.sampleUrl!)}
                    className="shrink-0 w-10 h-10 rounded-full bg-stc-green/10 text-stc-green hover:bg-stc-green/15 flex items-center justify-center transition-colors"
                  >
                    {playingVoice === voice.id ? (
                      <PauseIconSolid className="w-4 h-4" />
                    ) : (
                      <PlayIconSolid className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                ) : (
                  <div className="shrink-0 w-10 h-10 rounded-full bg-neutral-50 text-neutral-300 flex items-center justify-center">
                    <MicIcon />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <Link to={`/audio/${voice.id}`} className="text-sm font-medium text-neutral-900 hover:text-stc-purple-600 transition-colors">
                    {voice.name}
                  </Link>
                  {voice.description && (
                    <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{voice.description}</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Footer with title */}
          {item.type !== 'audio' && item.title && (
            <div className="px-4 py-2.5 border-t border-neutral-50">
              <p className="text-sm font-medium text-neutral-700">{item.title}</p>
              {item.description && (
                <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{item.description}</p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Lightbox for photos */}
      {viewingIll && (() => {
        const imgUrl = viewingIll.illustrationUrl || viewingIll.sourcePhotoUrl;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center sm:p-4" onClick={() => setViewingIll(null)}>
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 truncate">{viewingIll.name}</h3>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-medium uppercase flex-shrink-0">
                    {viewingIll.artType}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-neutral-400 mr-2">{currentLightboxIndex + 1} / {lightboxItems.length}</span>
                  <button onClick={() => setViewingIll(null)} aria-label="Close" className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="relative bg-neutral-50">
                  {imgUrl && <img src={imgUrl} alt={viewingIll.name} className="w-full max-h-[50vh] sm:max-h-[60vh] object-contain" />}
                  {currentLightboxIndex > 0 && (
                    <button onClick={goPrev} aria-label="Previous" className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center transition-colors">
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                  )}
                  {currentLightboxIndex < lightboxItems.length - 1 && (
                    <button onClick={goNext} aria-label="Next" className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center transition-colors">
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3">
                  {viewingIll.description && <p className="text-sm text-neutral-600">{viewingIll.description}</p>}
                  {viewingIll.lesson && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-500">Lesson:</span>
                      <span className="text-xs text-stc-purple-600 font-medium">
                        {viewingIll.lesson.module.code} — L{viewingIll.lesson.lessonNumber}: {viewingIll.lesson.title}
                      </span>
                    </div>
                  )}
                  {/* Character tags */}
                  <div>
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">Characters in this image</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const taggedChars = (viewingIll.characterTags || []).map(t => t.character);
                        if (viewingIll.character && !taggedChars.some(c => c.id === viewingIll.character!.id)) {
                          taggedChars.unshift(viewingIll.character);
                        }
                        return taggedChars.map(c => {
                          const charInfo = allCharacters.find(ac => ac.id === c.id);
                          return (
                            <span key={c.id} className="inline-flex items-center rounded-full bg-white border border-neutral-200 text-xs font-medium text-neutral-700 overflow-hidden">
                              <Link to={`/characters/${c.id}`} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 hover:bg-stc-purple-50 transition-colors" onClick={(e) => e.stopPropagation()}>
                                {charInfo?.thumbnailUrl ? (
                                  <img src={charInfo.thumbnailUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-stc-purple-100 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-stc-purple-500">{c.name.charAt(0)}</span>
                                  </div>
                                )}
                                <span className="hover:text-stc-purple-600">{c.name}</span>
                              </Link>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await removeIllustrationCharacter(viewingIll.id, c.id);
                                  const updated = { ...viewingIll, characterTags: (viewingIll.characterTags || []).filter(t => t.character.id !== c.id) };
                                  setViewingIll(updated);
                                  onReload();
                                }}
                                className="px-2 py-1.5 text-neutral-400 hover:text-stc-pink hover:bg-stc-pink/10 transition-colors border-l border-neutral-200"
                                title={`Remove ${c.name}`}
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        });
                      })()}
                      <button
                        onClick={() => setShowCharacterPicker(!showCharacterPicker)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-neutral-300 text-xs font-medium text-neutral-500 hover:border-stc-purple-300 hover:text-stc-purple-600 hover:bg-stc-purple-50/50 transition-all duration-200"
                      >
                        <PlusIcon className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                    {showCharacterPicker && (
                      <div className="mt-2 border border-neutral-200 rounded-xl p-3 bg-neutral-50 space-y-2">
                        <p className="text-xs text-neutral-500">Click a character to tag them:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allCharacters
                            .filter(c => {
                              const taggedIds = new Set((viewingIll.characterTags || []).map(t => t.character.id));
                              if (viewingIll.character) taggedIds.add(viewingIll.character.id);
                              return !taggedIds.has(c.id);
                            })
                            .map(char => (
                              <button
                                key={char.id}
                                onClick={async () => {
                                  await addIllustrationCharacter(viewingIll.id, char.id);
                                  const newTag = { character: { id: char.id, name: char.name } };
                                  const updated = { ...viewingIll, characterTags: [...(viewingIll.characterTags || []), newTag] };
                                  setViewingIll(updated);
                                  setShowCharacterPicker(false);
                                  onReload();
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-neutral-200 text-xs font-medium text-neutral-600 hover:border-stc-purple-300 hover:bg-stc-purple-50 hover:text-stc-purple-600 transition-all duration-200 min-h-[32px]"
                              >
                                {char.thumbnailUrl ? (
                                  <img src={char.thumbnailUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-stc-purple-100 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-stc-purple-500">{char.name.charAt(0)}</span>
                                  </div>
                                )}
                                {char.name}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AboutTab({ character, onBioUpdate, onFieldUpdate }: {
  character: CharacterDetail;
  onBioUpdate: (bio: string | null) => void;
  onFieldUpdate?: (field: string, value: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Intro / Bio card */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
          <UserIcon className="w-4 h-4 text-stc-purple-500" />
          Intro
        </h3>
        <BioSection
          characterId={character.id}
          bio={character.bio}
          onUpdate={onBioUpdate}
        />
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
          <InformationCircleIcon className="w-4 h-4 text-stc-purple-500" />
          Details
        </h3>
        <div className="space-y-3">
          <EditableDetailRow
            icon="♟"
            label="Chess Piece"
            value={character.piece}
            placeholder="e.g. White Queen"
            characterId={character.id}
            field="piece"
            onSave={(v) => onFieldUpdate?.('piece', v)}
          />
          <EditableDetailRow
            icon="✨"
            label="Personality"
            value={character.trait}
            placeholder="e.g. Chief Friendship Officer"
            characterId={character.id}
            field="trait"
            onSave={(v) => onFieldUpdate?.('trait', v)}
          />
          <EditableDetailRow
            icon="↗"
            label="Movement"
            value={character.movementNote}
            placeholder="e.g. Moves diagonally"
            characterId={character.id}
            field="movementNote"
            onSave={(v) => onFieldUpdate?.('movementNote', v)}
          />
          <EditableDetailRow
            icon="📖"
            label="First Appearance"
            value={character.firstAppearance}
            placeholder="e.g. Module 1A, Lesson 1"
            characterId={character.id}
            field="firstAppearance"
            onSave={(v) => onFieldUpdate?.('firstAppearance', v)}
          />
        </div>
      </div>

      {/* Lesson Appearances card */}
      <div className="bg-white rounded-xl border border-neutral-100 p-5">
        <h3 className="text-sm font-bold text-neutral-900 mb-3 flex items-center gap-2">
          <BookOpenIcon className="w-4 h-4 text-stc-purple-500" />
          Lesson Appearances ({character.lessons.length})
        </h3>
        <LessonAppearances lessons={character.lessons} characterName={character.name} />
      </div>
    </div>
  );
}



function EditableDetailRow({ icon, label, value, placeholder, characterId, field, onSave }: {
  icon: string;
  label: string;
  value: string | null;
  placeholder: string;
  characterId: string;
  field: 'piece' | 'trait' | 'movementNote' | 'firstAppearance';
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newValue = editValue.trim() || null;
      await updateCharacter(characterId, { [field]: newValue });
      onSave(newValue);
      setEditing(false);
    } catch {
      // Keep editing on error
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setEditValue(value || ''); setEditing(false); }
  };

  if (editing) {
    return (
      <div className="flex items-start gap-3">
        <span className="text-base leading-none mt-2">{icon}</span>
        <div className="flex-1">
          <p className="text-xs font-medium text-neutral-500 mb-1">{label}</p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-stc-purple-500 text-white rounded-lg hover:bg-stc-purple-600 disabled:opacity-50 min-h-[32px]"
            >
              {saving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditValue(value || ''); setEditing(false); }}
              className="px-3 py-1.5 text-xs font-medium text-neutral-500 bg-neutral-100 rounded-lg hover:bg-neutral-200 min-h-[32px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group">
      <span className="text-base leading-none mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-xs font-medium text-neutral-500">{label}</p>
        {value ? (
          <p className="text-sm text-neutral-900 inline">{value}</p>
        ) : (
          <p className="text-sm text-neutral-300 italic inline">{placeholder}</p>
        )}
        <button
          onClick={() => { setEditValue(value || ''); setEditing(true); }}
          className="ml-2 text-xs text-stc-purple-500 hover:text-stc-purple-700 opacity-0 group-hover:opacity-100 transition-opacity font-medium"
        >
          {value ? 'edit' : 'add'}
        </button>
      </div>
    </div>
  );
}

function LessonAppearances({ lessons, characterName }: { lessons: CharacterLesson[]; characterName: string }) {
  if (lessons.length === 0) {
    return <EmptyState label={`${characterName} hasn't appeared in any lessons yet`} />;
  }

  // Group lessons by module
  const moduleGroups: { code: string; title: string; sequence: number; lessons: CharacterLesson[] }[] = [];
  const moduleMap = new Map<string, typeof moduleGroups[0]>();

  for (const lesson of lessons) {
    let group = moduleMap.get(lesson.module.code);
    if (!group) {
      group = { code: lesson.module.code, title: lesson.module.title, sequence: lesson.module.sequence, lessons: [] };
      moduleMap.set(lesson.module.code, group);
      moduleGroups.push(group);
    }
    group.lessons.push(lesson);
  }
  moduleGroups.sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-stc-purple-300 via-stc-purple-200 to-transparent" />

      <div className="space-y-8">
        {moduleGroups.map((group) => (
          <div key={group.code}>
            {/* Module header */}
            <div className="relative flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-stc-purple-500 text-white flex items-center justify-center text-xs font-bold z-10 shrink-0 shadow-md">
                {group.code.split('-')[0]}
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Module {group.code}</h3>
                <p className="text-xs text-neutral-500">{group.title}</p>
              </div>
            </div>

            {/* Lessons in this module */}
            <div className="space-y-3 ml-5 pl-8 border-l-0">
              {group.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/lesson/${lesson.module.code}/${lesson.lessonNumber}`}
                  className="block bg-white rounded-xl border border-neutral-100 p-4 hover:shadow-md hover:border-stc-purple-200 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-stc-blue/10 text-stc-blue flex items-center justify-center text-sm font-bold">
                      {lesson.lessonNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 group-hover:text-stc-purple-600 transition-colors">
                        {lesson.title}
                      </p>
                      {lesson.chessConceptKey && (
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-stc-navy/10 text-stc-navy text-[11px] font-medium">
                          {lesson.chessConceptKey.replace(/-/g, ' ')}
                        </span>
                      )}
                      {lesson.storyExcerpt && (
                        <p className="mt-2 text-xs text-neutral-500 leading-relaxed line-clamp-3 italic">
                          "{lesson.storyExcerpt}"
                        </p>
                      )}
                    </div>
                    <ChevronRightIcon className="w-4 h-4 text-neutral-300 group-hover:text-stc-purple-400 transition-colors shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotosTab({ illustrations, onReload }: {
  illustrations: Illustration[];
  onReload: () => void;
}) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewingIll, setViewingIll] = useState<Illustration | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterSummary[]>([]);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);

  const goldStandards = illustrations.filter(i => i.isGoldStandard);
  const regularPhotos = illustrations.filter(i => !i.isGoldStandard)
    .sort((a, b) => {
      // BACKGROUND last, everything else keeps server order
      const aIsBg = a.artType === 'BACKGROUND' ? 1 : 0;
      const bIsBg = b.artType === 'BACKGROUND' ? 1 : 0;
      return aIsBg - bIsBg;
    });

  useEffect(() => {
    getCharacters().then(setAllCharacters).catch(console.error);
  }, []);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!viewingIll) return;
    const idx = illustrations.findIndex(i => i.id === viewingIll.id);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && idx < illustrations.length - 1) {
        setViewingIll(illustrations[idx + 1]);
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        setViewingIll(illustrations[idx - 1]);
      } else if (e.key === 'Escape') {
        setViewingIll(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [viewingIll, illustrations]);

  if (illustrations.length === 0) {
    return (
      <div className="py-12 text-center bg-neutral-50 rounded-xl">
        <p className="text-sm text-neutral-400 mb-3">No photos yet</p>
        <p className="text-xs text-neutral-400">Tag illustrations from the <span className="font-medium text-stc-purple-600">Images</span> section to see them here.</p>
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleUntag = () => {
    if (selected.size === 0) return;
    // Remove all character tags from selected illustrations
    const removals = Array.from(selected).flatMap(illId => {
      const ill = illustrations.find(i => i.id === illId);
      if (!ill?.characterTags) return [];
      return ill.characterTags.map(tag =>
        removeIllustrationCharacter(illId, tag.character.id)
      );
    });
    Promise.all(removals).then(() => {
      onReload();
      setSelected(new Set());
      setSelecting(false);
    });
  };

  // Navigate between photos in lightbox
  const currentIndex = viewingIll ? illustrations.findIndex(i => i.id === viewingIll.id) : -1;
  const goNext = () => { if (currentIndex < illustrations.length - 1) { setViewingIll(illustrations[currentIndex + 1]); setShowCharacterPicker(false); } };
  const goPrev = () => { if (currentIndex > 0) { setViewingIll(illustrations[currentIndex - 1]); setShowCharacterPicker(false); } };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
            selecting
              ? 'bg-stc-purple-100 text-stc-purple-700'
              : 'text-neutral-500 hover:bg-neutral-100'
          }`}
        >
          {selecting ? 'Cancel' : 'Select'}
        </button>
        {selecting && selected.size > 0 && (
          <button
            onClick={handleUntag}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stc-pink/10 text-stc-pink hover:bg-stc-pink/15 transition-colors min-h-[44px]"
          >
            Untag {selected.size} photo{selected.size !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Top References — gold standard showcase */}
      {goldStandards.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <StarIcon className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-neutral-700">Top References</h3>
            <span className="text-xs text-neutral-400">{goldStandards.length} gold standard{goldStandards.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {goldStandards.map(ill => {
              const thumb = ill.illustrationUrl || ill.sourcePhotoUrl;
              return (
                <button
                  key={ill.id}
                  onClick={() => setViewingIll(ill)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border-2 border-amber-300 hover:shadow-md transition-all duration-200"
                >
                  {thumb && <img src={thumb} alt={ill.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold shadow-sm">
                    <StarIcon className="w-3 h-3 fill-white text-white" />
                    {ill.goldStandardType === 'TPOSE' ? 'T-Pose' : 'Gold'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider between gold standards and regular photos */}
      {goldStandards.length > 0 && regularPhotos.length > 0 && (
        <div className="border-t border-neutral-200 mb-4" />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {regularPhotos.map((ill) => {
          const thumb = ill.illustrationUrl || ill.sourcePhotoUrl;
          const isSelected = selected.has(ill.id);

          if (selecting) {
            return (
              <button
                key={ill.id}
                onClick={() => toggleSelect(ill.id)}
                className={`group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border-2 transition-all duration-200 ${
                  isSelected ? 'border-stc-purple-500 ring-2 ring-stc-purple-200' : 'border-neutral-100 hover:border-neutral-300'
                }`}
              >
                {thumb ? (
                  <img src={thumb} alt={ill.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-neutral-300"><ImageIcon /></div>
                )}
                <div className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${
                  isSelected ? 'bg-stc-purple-500 border-stc-purple-500' : 'bg-white/80 border-neutral-300'
                }`}>
                  {isSelected && (
                    <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  )}
                </div>
                {ill.isGoldStandard && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold shadow-sm">
                    <StarIcon className="w-3 h-3 fill-white text-white" />
                    {ill.goldStandardType === 'TPOSE' ? 'T-Pose' : 'Gold'}
                  </div>
                )}
                {ill.name && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                    <p className="text-white text-xs font-medium truncate">{ill.name}</p>
                  </div>
                )}
              </button>
            );
          }

          return (
            <button
              key={ill.id}
              onClick={() => setViewingIll(ill)}
              className="group relative aspect-square rounded-xl overflow-hidden bg-neutral-100 border border-neutral-100 hover:shadow-md transition-all duration-200 text-left"
            >
              {thumb ? (
                <img src={thumb} alt={ill.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300"><ImageIcon /></div>
              )}
              {ill.isGoldStandard ? (
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/90 text-white text-[10px] font-bold shadow-sm">
                  <StarIcon className="w-3 h-3 fill-white text-white" />
                  {ill.goldStandardType === 'TPOSE' ? 'T-Pose' : 'Gold'}
                </div>
              ) : ill.artType !== 'CARTOON' && (
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium uppercase">
                  {ill.artType}
                </span>
              )}
              {ill.name && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs font-medium truncate">{ill.name}</p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Lightbox modal */}
      {viewingIll && (() => {
        const imgUrl = viewingIll.illustrationUrl || viewingIll.sourcePhotoUrl;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center sm:p-4" onClick={() => setViewingIll(null)}>
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-3xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-200">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 truncate">{viewingIll.name}</h3>
                  <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 text-[10px] font-medium uppercase flex-shrink-0">
                    {viewingIll.artType}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-neutral-400 mr-2">{currentIndex + 1} / {illustrations.length}</span>
                  <button onClick={() => setViewingIll(null)} aria-label="Close" className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Image */}
              <div className="flex-1 overflow-y-auto">
                <div className="relative bg-neutral-50">
                  {imgUrl && (
                    <img src={imgUrl} alt={viewingIll.name} className="w-full max-h-[50vh] sm:max-h-[60vh] object-contain" />
                  )}
                  {/* Prev/Next arrows */}
                  {currentIndex > 0 && (
                    <button
                      onClick={goPrev}
                      aria-label="Previous photo"
                      className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                  )}
                  {currentIndex < illustrations.length - 1 && (
                    <button
                      onClick={goNext}
                      aria-label="Next photo"
                      className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center transition-colors"
                    >
                      <ChevronRightIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Details */}
                <div className="px-5 py-4 space-y-3">
                  {viewingIll.description && (
                    <p className="text-sm text-neutral-600">{viewingIll.description}</p>
                  )}
                  {viewingIll.lesson && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-500">Lesson:</span>
                      <span className="text-xs text-stc-purple-600 font-medium">
                        {viewingIll.lesson.module.code} — L{viewingIll.lesson.lessonNumber}: {viewingIll.lesson.title}
                      </span>
                    </div>
                  )}
                  {/* Character tags */}
                  <div>
                    <p className="text-xs font-medium text-neutral-500 mb-1.5">Characters in this image</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {(() => {
                        const taggedChars = (viewingIll.characterTags || []).map(t => t.character);
                        // Also include FK character if not already in tags
                        if (viewingIll.character && !taggedChars.some(c => c.id === viewingIll.character!.id)) {
                          taggedChars.unshift(viewingIll.character);
                        }
                        return taggedChars.map(c => {
                          const charInfo = allCharacters.find(ac => ac.id === c.id);
                          return (
                            <span
                              key={c.id}
                              className="inline-flex items-center rounded-full bg-white border border-neutral-200 text-xs font-medium text-neutral-700 overflow-hidden"
                            >
                              <Link
                                to={`/characters/${c.id}`}
                                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 hover:bg-stc-purple-50 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {charInfo?.thumbnailUrl ? (
                                  <img src={charInfo.thumbnailUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-stc-purple-100 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-stc-purple-500">{c.name.charAt(0)}</span>
                                  </div>
                                )}
                                <span className="hover:text-stc-purple-600">{c.name}</span>
                              </Link>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await removeIllustrationCharacter(viewingIll.id, c.id);
                                  const updated = { ...viewingIll, characterTags: (viewingIll.characterTags || []).filter(t => t.character.id !== c.id) };
                                  setViewingIll(updated);
                                  onReload();
                                }}
                                className="px-2 py-1.5 text-neutral-400 hover:text-stc-pink hover:bg-stc-pink/10 transition-colors border-l border-neutral-200"
                                title={`Remove ${c.name}`}
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        });
                      })()}
                      <button
                        onClick={() => setShowCharacterPicker(!showCharacterPicker)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-dashed border-neutral-300 text-xs font-medium text-neutral-500
                          hover:border-stc-purple-300 hover:text-stc-purple-600 hover:bg-stc-purple-50/50 transition-all duration-200"
                      >
                        <PlusIcon className="w-3 h-3" />
                        Add
                      </button>
                    </div>
                    {showCharacterPicker && (
                      <div className="mt-2 border border-neutral-200 rounded-xl p-3 bg-neutral-50 space-y-2">
                        <p className="text-xs text-neutral-500">Click a character to tag them:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {allCharacters
                            .filter(c => {
                              const taggedIds = new Set((viewingIll.characterTags || []).map(t => t.character.id));
                              if (viewingIll.character) taggedIds.add(viewingIll.character.id);
                              return !taggedIds.has(c.id);
                            })
                            .map(char => (
                              <button
                                key={char.id}
                                onClick={async () => {
                                  await addIllustrationCharacter(viewingIll.id, char.id);
                                  const newTag = { character: { id: char.id, name: char.name } };
                                  const updated = { ...viewingIll, characterTags: [...(viewingIll.characterTags || []), newTag] };
                                  setViewingIll(updated);
                                  setShowCharacterPicker(false);
                                  onReload();
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-neutral-200 text-xs font-medium text-neutral-600
                                  hover:border-stc-purple-300 hover:bg-stc-purple-50 hover:text-stc-purple-600 transition-all duration-200 min-h-[32px]"
                              >
                                {char.thumbnailUrl ? (
                                  <img src={char.thumbnailUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-stc-purple-100 flex items-center justify-center">
                                    <span className="text-[9px] font-bold text-stc-purple-500">{char.name.charAt(0)}</span>
                                  </div>
                                )}
                                {char.name}
                              </button>
                            ))}
                          {allCharacters.filter(c => {
                            const taggedIds = new Set((viewingIll.characterTags || []).map(t => t.character.id));
                            if (viewingIll.character) taggedIds.add(viewingIll.character.id);
                            return !taggedIds.has(c.id);
                          }).length === 0 && (
                            <p className="text-xs text-neutral-400 italic">All characters are already tagged</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {viewingIll.aiDescription && (
                    <div>
                      <p className="text-xs font-medium text-neutral-500 mb-1">AI Description</p>
                      <p className="text-xs text-neutral-500 leading-relaxed">{viewingIll.aiDescription}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function VideosTab({ videos }: { videos: Illustration[] }) {
  if (videos.length === 0) {
    return <EmptyState label="No videos yet" />;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {videos.map((vid) => {
        const thumb = vid.thumbnailUrl || vid.illustrationUrl;
        return (
          <Link
            key={vid.id}
            to={`/video/${vid.id}`}
            className="group relative aspect-video rounded-xl overflow-hidden bg-neutral-100 border border-neutral-100 hover:shadow-md transition"
          >
            {thumb ? (
              <img src={thumb} alt={vid.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-300">
                <VideoIcon />
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                <PlayIconSolid className="w-5 h-5 text-white ml-0.5" />
              </div>
            </div>
            {vid.duration && (
              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/50 text-white text-[10px] font-medium">
                {vid.duration}s
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function AudioTab({
  voices,
  playingVoice,
  onToggleVoice,
}: {
  voices: CharacterVoiceRef[];
  playingVoice: string | null;
  onToggleVoice: (id: string, url: string) => void;
}) {
  if (voices.length === 0) {
    return <EmptyState label="No voices yet" />;
  }

  return (
    <div className="space-y-3">
      {voices.map((voice) => (
        <div
          key={voice.id}
          className="bg-white rounded-xl border border-neutral-100 p-4 flex items-center gap-4 hover:shadow-sm transition"
        >
          {/* Play button */}
          {voice.sampleUrl ? (
            <button
              onClick={() => onToggleVoice(voice.id, voice.sampleUrl!)}
              className="shrink-0 w-12 h-12 rounded-full bg-stc-green/10 text-stc-green hover:bg-stc-green/15 flex items-center justify-center transition-colors"
            >
              {playingVoice === voice.id ? (
                <PauseIconSolid className="w-5 h-5" />
              ) : (
                <PlayIconSolid className="w-5 h-5 ml-0.5" />
              )}
            </button>
          ) : (
            <div className="shrink-0 w-12 h-12 rounded-full bg-neutral-50 text-neutral-300 flex items-center justify-center">
              <MicIcon />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link
              to={`/audio/${voice.id}`}
              className="text-sm font-medium text-neutral-900 hover:text-stc-purple-600 transition-colors"
            >
              {voice.name}
            </Link>
            <p className="text-xs text-neutral-500 line-clamp-2 mt-0.5">{voice.description}</p>
          </div>
          <Link
            to={`/audio/${voice.id}`}
            className="shrink-0 text-neutral-300 hover:text-stc-purple-400 transition-colors"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>
      ))}
    </div>
  );
}

/* ---- Shared Components ---- */

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-12 text-center text-sm text-neutral-400 bg-neutral-50 rounded-xl">
      {label}
    </div>
  );
}

function StatBadge({ icon, count, label, color, onClick }: { icon: React.ReactNode; count: number; label: string; color: string; onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-stc-blue/10 text-stc-blue',
    amber: 'bg-stc-orange/10 text-stc-orange',
    rose: 'bg-stc-pink/10 text-stc-pink',
    green: 'bg-stc-green/10 text-stc-green',
  };
  const hoverColorMap: Record<string, string> = {
    blue: 'hover:bg-stc-blue/15',
    amber: 'hover:bg-stc-orange/15',
    rose: 'hover:bg-stc-pink/15',
    green: 'hover:bg-stc-green/15',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${onClick ? `cursor-pointer ${hoverColorMap[color] || 'hover:bg-neutral-100'}` : ''}`}
    >
      <div className={`w-7 h-7 rounded-lg ${colorMap[color]} flex items-center justify-center`}>
        {icon}
      </div>
      <div>
        <span className="font-bold text-neutral-900">{count}</span>
        <span className="text-neutral-500 ml-1">{label}</span>
      </div>
    </button>
  );
}

/* ---- Icons ---- */

function ChevronLeft() {
  return <ChevronLeftIcon className="w-4 h-4" />;
}

function BookIcon() {
  return <BookOpenIcon className="w-3.5 h-3.5" />;
}

function ImageIcon() {
  return <PhotoIcon className="w-3.5 h-3.5" />;
}

function VideoIcon() {
  return <VideoCameraIcon className="w-3.5 h-3.5" />;
}

function MicIcon() {
  return <MicrophoneIcon className="w-3.5 h-3.5" />;
}
