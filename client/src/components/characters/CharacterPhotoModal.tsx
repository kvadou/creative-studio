import { useState, useRef, useCallback, useEffect } from 'react';
import { XMarkIcon, MagnifyingGlassMinusIcon, MagnifyingGlassPlusIcon } from '@heroicons/react/24/outline';
import type { Illustration } from '../../lib/types';
import { getIllustrations, updateCharacter } from '../../lib/api';

type PhotoType = 'avatar' | 'cover' | 'profile';

interface CharacterPhotoModalProps {
  characterId: string;
  type: PhotoType;
  currentUrl: string | null;
  currentPosition: string | null;
  currentIllustrationId: string | null;
  illustrations: Illustration[]; // Character's illustrations for quick picks
  onSave: () => void;
  onClose: () => void;
}

type Mode = 'view' | 'pick' | 'position';

export default function CharacterPhotoModal({
  characterId,
  type,
  currentUrl,
  currentPosition,
  currentIllustrationId,
  illustrations,
  onSave,
  onClose,
}: CharacterPhotoModalProps) {
  // Parse position string: "50% 30% 1.5" → { x: 50, y: 30, scale: 1.5 }
  const parsePosition = (pos: string | null) => {
    const parts = (pos || '50% 50% 1').split(' ');
    return {
      x: parseInt(parts[0]) || 50,
      y: parseInt(parts[1]) || 50,
      scale: parseFloat(parts[2]) || 1,
    };
  };
  const initial = parsePosition(currentPosition);
  const DEFAULT_SCALE = 1;

  const [mode, setMode] = useState<Mode>(currentUrl ? 'view' : 'pick');
  const [selectedUrl, setSelectedUrl] = useState<string | null>(currentUrl);
  const [selectedId, setSelectedId] = useState<string | null>(currentIllustrationId);
  const [posX, setPosX] = useState(initial.x);
  const [posY, setPosY] = useState(initial.y);
  const [scale, setScale] = useState(initial.scale || DEFAULT_SCALE);
  const [saving, setSaving] = useState(false);

  const positionStr = `${posX}% ${posY}% ${scale}`;

  // Library search
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Illustration[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Position drag state
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const isCover = type === 'cover';
  const isAvatar = type === 'avatar';
  const aspectLabel = isCover ? 'landscape banner' : isAvatar ? 'sidebar thumbnail' : 'circular profile';

  // Search illustrations
  const doSearch = useCallback(async (query: string) => {
    setSearchLoading(true);
    try {
      const data = await getIllustrations({
        search: query || undefined,
        excludeArtType: 'CARTOON',
        limit: 50,
      });
      setSearchResults(data.illustrations);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'pick') doSearch('');
  }, [mode, doSearch]);

  const handleSearchInput = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const selectIllustration = (ill: Illustration) => {
    const url = ill.illustrationUrl || ill.sourcePhotoUrl;
    setSelectedUrl(url);
    setSelectedId(ill.id);
    setPosX(50);
    setPosY(50);
    setScale(DEFAULT_SCALE);
    setMode('position');
  };

  // Handle scroll-wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(0.3, Math.min(3, prev - e.deltaY * 0.002)));
  }, []);

  // Handle drag to reposition — delta-based so image doesn't jump
  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerUp = () => {
    isDragging.current = false;
    lastPointer.current = null;
  };
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current || !lastPointer.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Convert pixel delta to percentage (natural — drag left moves image left)
    const dx = ((e.clientX - lastPointer.current.x) / rect.width) * 100;
    const dy = ((e.clientY - lastPointer.current.y) / rect.height) * 100;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    // Sensitivity scales with zoom — higher zoom = finer control
    const sensitivity = 1 / Math.max(scale, 0.5);
    setPosX(prev => Math.max(0, Math.min(100, Math.round(prev + dx * sensitivity))));
    setPosY(prev => Math.max(0, Math.min(100, Math.round(prev + dy * sensitivity))));
  }, [scale]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, string | null> = {};
      if (type === 'cover') {
        data.coverIllustrationId = selectedId;
        data.coverPosition = positionStr;
      } else if (type === 'avatar') {
        data.avatarIllustrationId = selectedId;
        data.avatarPosition = positionStr;
      } else {
        // Profile photo also serves as the avatar/thumbnail if no avatar is set
        data.profileIllustrationId = selectedId;
        data.profilePosition = positionStr;
        data.avatarIllustrationId = selectedId;
        data.avatarPosition = positionStr;
      }
      await updateCharacter(characterId, data);
      onSave();
    } catch (error) {
      console.error('Failed to save photo:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-2xl shadow-2xl w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {mode === 'view' && (isCover ? 'Cover Photo' : isAvatar ? 'Sidebar Thumbnail' : 'Profile Photo')}
              {mode === 'pick' && 'Choose from Library'}
              {mode === 'position' && `Adjust ${aspectLabel}`}
            </h2>
            {mode === 'position' && (
              <p className="text-xs text-neutral-400 mt-0.5">Drag to reposition the image</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* VIEW mode — full image */}
          {mode === 'view' && selectedUrl && (
            <div className="p-6 flex flex-col items-center gap-4">
              <div className={`relative overflow-hidden bg-neutral-100 ${isCover ? 'w-full aspect-[3/1] rounded-xl' : 'w-full aspect-square max-w-xs mx-auto rounded-full'}`}>
                <img
                  src={selectedUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: 'contain',
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: `${posX}% ${posY}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* PICK mode — unified searchable grid */}
          {mode === 'pick' && (
            <div className="p-4 space-y-3">
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchInput(e.target.value)}
                placeholder="Search illustrations..."
                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm
                  focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                  placeholder:text-neutral-400"
                autoFocus
              />
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-5 w-5 border-2 border-stc-purple-500 border-t-transparent rounded-full" />
                </div>
              ) : (() => {
                // Merge character illustrations + search results, deduped, character's first
                const charIlls = illustrations.filter(ill => ill.illustrationUrl || ill.sourcePhotoUrl);
                const charIds = new Set(charIlls.map(ill => ill.id));
                const libraryIlls = searchResults.filter(ill =>
                  !charIds.has(ill.id) && (ill.illustrationUrl || ill.sourcePhotoUrl)
                );
                const allIlls = [...charIlls, ...libraryIlls];
                return allIlls.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-8">No illustrations found</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
                    {allIlls.map(ill => {
                      const imgUrl = ill.illustrationUrl || ill.sourcePhotoUrl;
                      const isCharIll = charIds.has(ill.id);
                      return (
                        <button
                          key={ill.id}
                          onClick={() => selectIllustration(ill)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedId === ill.id
                              ? 'border-stc-purple-500 ring-1 ring-stc-purple-200'
                              : 'border-transparent hover:border-stc-purple-300'
                          }`}
                        >
                          <img src={imgUrl!} alt={ill.name} className="w-full h-full object-cover" />
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 pt-6">
                            <p className="text-white text-xs font-medium truncate">{ill.name}</p>
                          </div>
                          {isCharIll && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-stc-purple-500 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* POSITION mode — drag to reposition */}
          {mode === 'position' && selectedUrl && (
            <div className="p-6 space-y-4">
              <div
                ref={containerRef}
                className={`relative overflow-hidden bg-neutral-100 cursor-move select-none ${
                  isCover ? 'aspect-[3/1] rounded-xl' : 'aspect-square max-w-xs mx-auto rounded-full'
                }`}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerMove={handlePointerMove}
                onWheel={handleWheel}
              >
                {/* Checkerboard background for transparency */}
                <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)', backgroundSize: '16px 16px', backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px' }} />
                <img
                  src={selectedUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  style={{
                    objectFit: 'contain',
                    objectPosition: `${posX}% ${posY}%`,
                    transform: `scale(${scale})`,
                    transformOrigin: `${posX}% ${posY}%`,
                  }}
                  draggable={false}
                />
                {/* Grab hint overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
                  <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                  </svg>
                </div>
              </div>

              {/* Zoom slider */}
              <div className="flex items-center gap-3 px-1">
                <MagnifyingGlassMinusIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <input
                  type="range"
                  min="0.3"
                  max="3"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-neutral-200 rounded-full appearance-none cursor-pointer accent-stc-purple-500"
                />
                <MagnifyingGlassPlusIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span className="text-xs text-neutral-400 w-10 text-right flex-shrink-0">{Math.round(scale * 100)}%</span>
              </div>

              <p className="text-xs text-neutral-400 text-center">Drag to reposition, scroll or slide to zoom</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-neutral-200 bg-neutral-50 gap-2">
          <div className="flex gap-2">
            {mode === 'view' && (
              <>
                <button
                  onClick={() => setMode('pick')}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                    hover:bg-white transition-colors min-h-[44px]"
                >
                  Change Photo
                </button>
                <button
                  onClick={() => setMode('position')}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                    hover:bg-white transition-colors min-h-[44px]"
                >
                  Edit Position
                </button>
              </>
            )}
            {mode === 'position' && (
              <button
                onClick={() => setMode('pick')}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                  hover:bg-white transition-colors min-h-[44px]"
              >
                Pick Different
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            {(mode === 'position' || (mode === 'view' && selectedId)) && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500
                  hover:bg-stc-purple-600 transition-colors min-h-[44px] disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
