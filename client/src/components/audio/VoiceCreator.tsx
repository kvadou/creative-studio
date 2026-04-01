import { useState, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  SpeakerWaveIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { PlayIcon as PlayIconSolid, PauseIcon as PauseIconSolid, CheckIcon as CheckIconSolid } from '@heroicons/react/20/solid';
import type { VoicePreview } from '../../lib/types';
import { designVoice, saveVoice, cloneVoice } from '../../lib/api';

type Tab = 'design' | 'clone';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ACCEPTED_TYPES = ['.mp3', '.wav', '.m4a', '.ogg'];
const ACCEPTED_MIME = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/ogg'];

export default function VoiceCreator() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('design');

  // --- Design tab state ---
  const [description, setDescription] = useState('');
  const [sampleText, setSampleText] = useState('');
  const [isDesigning, setIsDesigning] = useState(false);
  const [previews, setPreviews] = useState<(VoicePreview & { audioBase64?: string })[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Save form (design tab)
  const [name, setName] = useState('');
  const [character, setCharacter] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Clone tab state ---
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [cloneCharacter, setCloneCharacter] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // --- Design tab handlers ---
  const handleDesign = useCallback(async () => {
    if (!description.trim()) return;
    setIsDesigning(true);
    setError(null);
    setPreviews([]);
    setSelectedPreview(null);
    try {
      const result = await designVoice({
        description: description.trim(),
        text: sampleText.trim() || undefined,
      });
      setPreviews(result.previews);
      setPreviewText(result.text);
      if (result.previews.length > 0) {
        setSelectedPreview(result.previews[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to design voice');
    } finally {
      setIsDesigning(false);
    }
  }, [description, sampleText]);

  const handlePlay = useCallback((preview: VoicePreview) => {
    if (!preview.audioUrl) return;
    if (playingId === preview.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(preview.audioUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(preview.id);
  }, [playingId]);

  const handleSave = useCallback(async () => {
    if (!name.trim() || !selectedPreview) return;
    const preview = previews.find(p => p.id === selectedPreview);
    if (!preview) return;

    setIsSaving(true);
    setError(null);
    try {
      const voice = await saveVoice({
        name: name.trim(),
        description: description.trim(),
        generatedVoiceId: preview.generatedVoiceId,
        character: character.trim() || undefined,
        previewId: preview.id,
      });
      navigate(`/audio/${voice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save voice');
      setIsSaving(false);
    }
  }, [name, character, description, selectedPreview, previews, navigate]);

  // --- Clone tab handlers ---
  const validateFile = useCallback((file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext) && !ACCEPTED_MIME.includes(file.type)) {
      return `Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (${formatFileSize(file.size)}). Max size: 25MB`;
    }
    return null;
  }, []);

  const handleFileSelect = useCallback((file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setCloneError(validationError);
      return;
    }
    setCloneError(null);
    setCloneFile(file);
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClone = useCallback(async () => {
    if (!cloneFile || !cloneName.trim() || !cloneDescription.trim()) return;
    setIsCloning(true);
    setCloneError(null);

    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the data:audio/...;base64, prefix
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read audio file'));
        reader.readAsDataURL(cloneFile);
      });

      const voice = await cloneVoice({
        name: cloneName.trim(),
        description: cloneDescription.trim(),
        audioBase64,
        audioFilename: cloneFile.name,
        character: cloneCharacter.trim() || undefined,
      });
      navigate(`/audio/${voice.id}`);
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : 'Failed to clone voice');
    } finally {
      setIsCloning(false);
    }
  }, [cloneFile, cloneName, cloneDescription, cloneCharacter, navigate]);

  const cloneReady = cloneFile && cloneName.trim() && cloneDescription.trim();

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Back link */}
        <Link
          to="/audio"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-stc-purple-600 transition-colors mb-6 min-h-[44px]"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Back to Audio
        </Link>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('design')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors min-h-[44px] ${
              activeTab === 'design'
                ? 'bg-stc-purple-500 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Design
          </button>
          <button
            onClick={() => setActiveTab('clone')}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors min-h-[44px] ${
              activeTab === 'clone'
                ? 'bg-stc-purple-500 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            Clone
          </button>
        </div>

        {/* ========== DESIGN TAB ========== */}
        {activeTab === 'design' && (
          <>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Design a Voice</h1>
            <p className="text-sm text-neutral-500 mb-8">
              Describe the voice you want and we'll generate options to choose from.
            </p>

            {/* Voice Description */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
              <div>
                <label htmlFor="voice-desc" className="block text-xs font-medium text-neutral-500 mb-1">
                  Voice Description
                </label>
                <textarea
                  id="voice-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Warm, grandfatherly voice with a slight British accent. Age 60s. Gentle and wise, like a beloved storytelling king."
                  className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl resize-none
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="sample-text" className="block text-xs font-medium text-neutral-500 mb-1">
                  Sample Text <span className="text-neutral-400">(optional — auto-generated if blank)</span>
                </label>
                <textarea
                  id="sample-text"
                  rows={2}
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value)}
                  placeholder="e.g. Once upon a time, in the magical kingdom of Chesslandia, the brave Knight set out on a grand adventure."
                  className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl resize-none
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                />
              </div>

              <button
                onClick={handleDesign}
                disabled={!description.trim() || isDesigning}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white
                  bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50
                  transition-colors min-h-[44px] flex items-center justify-center gap-2"
              >
                {isDesigning ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Designing voices...
                  </>
                ) : (
                  'Generate Voice Previews'
                )}
              </button>
            </div>

            {error && (
              <div className="bg-stc-pink/10 border border-stc-pink/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-stc-pink">{error}</p>
              </div>
            )}

            {/* Previews */}
            {previews.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
                <h2 className="text-sm font-semibold text-neutral-900">Voice Previews</h2>
                {previewText && (
                  <p className="text-xs text-neutral-400 italic">"{previewText}"</p>
                )}

                <div className="space-y-3">
                  {previews.map((preview, idx) => (
                    <div
                      key={preview.id}
                      onClick={() => setSelectedPreview(preview.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedPreview === preview.id
                          ? 'border-stc-purple-400 bg-stc-purple-50/50'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePlay(preview); }}
                        className="w-10 h-10 rounded-full bg-stc-purple-500 hover:bg-stc-purple-600 flex items-center
                          justify-center transition-colors flex-shrink-0 min-h-[44px] min-w-[44px]"
                        aria-label={playingId === preview.id ? 'Pause' : 'Play preview'}
                      >
                        {playingId === preview.id ? (
                          <PauseIconSolid className="w-4 h-4 text-white" />
                        ) : (
                          <PlayIconSolid className="w-4 h-4 text-white ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">Voice Option {idx + 1}</p>
                        {preview.durationSecs && (
                          <p className="text-xs text-neutral-400">{preview.durationSecs.toFixed(1)}s</p>
                        )}
                      </div>
                      {selectedPreview === preview.id && (
                        <CheckIconSolid className="w-5 h-5 text-stc-purple-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save Form */}
            {selectedPreview && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4">
                <h2 className="text-sm font-semibold text-neutral-900">Save as Character Voice</h2>

                <div>
                  <label htmlFor="voice-name" className="block text-xs font-medium text-neutral-500 mb-1">Voice Name</label>
                  <input
                    id="voice-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. King Chomper"
                    className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl
                      focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="voice-char" className="block text-xs font-medium text-neutral-500 mb-1">
                    Character <span className="text-neutral-400">(optional)</span>
                  </label>
                  <input
                    id="voice-char"
                    type="text"
                    value={character}
                    onChange={(e) => setCharacter(e.target.value)}
                    placeholder="e.g. King, Queen, Knight, Bishop..."
                    className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl
                      focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={!name.trim() || isSaving}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white
                    bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50
                    transition-colors min-h-[44px] flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Character Voice'
                  )}
                </button>
              </div>
            )}
          </>
        )}

        {/* ========== CLONE TAB ========== */}
        {activeTab === 'clone' && (
          <>
            <h1 className="text-2xl font-bold text-neutral-900 mb-2">Clone a Voice</h1>
            <p className="text-sm text-neutral-500 mb-8">
              Upload an audio sample and we'll clone the voice for use in your projects.
            </p>

            {cloneError && (
              <div className="bg-stc-pink/10 border border-stc-pink/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-stc-pink">{cloneError}</p>
              </div>
            )}

            {/* File Upload Area */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
              <label className="block text-xs font-medium text-neutral-500 mb-1">Audio Sample</label>

              {!cloneFile ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-stc-purple-400 bg-stc-purple-50/50'
                      : 'border-neutral-300 hover:border-stc-purple-300 hover:bg-neutral-50'
                  }`}
                >
                  <ArrowUpTrayIcon className="w-10 h-10 mx-auto mb-3 text-neutral-400" />
                  <p className="text-sm font-medium text-neutral-700 mb-1">
                    Drop an audio file here or click to browse
                  </p>
                  <p className="text-xs text-neutral-400">
                    MP3, WAV, M4A, or OGG — max 25MB
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <SpeakerWaveIcon className="w-8 h-8 text-stc-purple-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{cloneFile.name}</p>
                    <p className="text-xs text-neutral-400">{formatFileSize(cloneFile.size)}</p>
                  </div>
                  <button
                    onClick={() => { setCloneFile(null); setCloneError(null); }}
                    className="p-2 rounded-lg text-neutral-400 hover:text-stc-pink hover:bg-stc-pink/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Remove file"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Clone Form Fields */}
            <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-4 mb-6">
              <div>
                <label htmlFor="clone-name" className="block text-xs font-medium text-neutral-500 mb-1">
                  Name
                </label>
                <input
                  id="clone-name"
                  type="text"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g. King Chomper"
                  className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="clone-desc" className="block text-xs font-medium text-neutral-500 mb-1">
                  Description
                </label>
                <textarea
                  id="clone-desc"
                  rows={3}
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="Describe the voice characteristics"
                  className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl resize-none
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="clone-char" className="block text-xs font-medium text-neutral-500 mb-1">
                  Character <span className="text-neutral-400">(optional)</span>
                </label>
                <input
                  id="clone-char"
                  type="text"
                  value={cloneCharacter}
                  onChange={(e) => setCloneCharacter(e.target.value)}
                  placeholder="e.g. King, Queen, Knight..."
                  className="w-full px-3 py-2.5 text-sm text-neutral-700 border border-neutral-200 rounded-xl
                    focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 outline-none transition-colors"
                />
              </div>
            </div>

            {/* Clone Button */}
            <button
              onClick={handleClone}
              disabled={!cloneReady || isCloning}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white
                bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-50
                transition-colors min-h-[44px] flex items-center justify-center gap-2"
            >
              {isCloning ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Cloning voice...
                </>
              ) : (
                'Clone Voice'
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
