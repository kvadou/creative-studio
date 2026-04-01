import { useState, useRef, useCallback, useEffect } from 'react';
import {
  PaintBrushIcon,
  XMarkIcon,
  CameraIcon,
  PencilSquareIcon,
  SparklesIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import type {
  Illustration,
  IllustrationGeneration,
  IllustrationMessage,
  IllustrationChatResponse,
} from '../../lib/types';
import {
  uploadIllustrationPhoto,
  generateIllustration,
  pollIllustrationStatus,
  selectIllustrationVariant,
  getIllustrationMessages,
  sendIllustrationChat,
} from '../../lib/api';

interface WorkspaceProps {
  /** If provided, we're editing an existing illustration */
  illustration?: Illustration | null;
  onComplete: (illustration: Illustration) => void;
  onClose: () => void;
}

type Phase = 'upload' | 'generating' | 'review' | 'chat-generating';

export default function IllustrationWorkspace({
  illustration: initialIllustration,
  onComplete,
  onClose,
}: WorkspaceProps) {
  const [phase, setPhase] = useState<Phase>(initialIllustration ? 'review' : 'upload');
  const [illustration, setIllustration] = useState<Illustration | null>(
    initialIllustration || null
  );
  const [generations, setGenerations] = useState<IllustrationGeneration[]>(
    initialIllustration?.generations || []
  );
  const [selectedGenId, setSelectedGenId] = useState<string | null>(null);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [characterName, setCharacterName] = useState(initialIllustration?.name || '');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<IllustrationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingGeneration, setPendingGeneration] = useState<
    IllustrationChatResponse['generation'] | null
  >(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat messages if editing existing
  useEffect(() => {
    if (initialIllustration) {
      getIllustrationMessages(initialIllustration.id)
        .then(setMessages)
        .catch(() => {});
    }
  }, [initialIllustration]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // ── File handling ──
  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      if (!selectedFile.type.startsWith('image/')) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError(null);
    },
    [previewUrl]
  );

  // ── Polling ──
  const startPolling = useCallback((illustrationId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const result = await pollIllustrationStatus(illustrationId);

        if (result.status === 'COMPLETED' && result.generations) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setGenerations(result.generations);
          setPhase('review');
        } else if (result.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          setError(result.error || 'Generation failed');
          setPhase('review');
        }
      } catch {
        // Transient error, keep polling
      }
    }, 2000);
  }, []);

  // ── Upload + Generate ──
  const handleUploadAndGenerate = useCallback(async () => {
    if (!file || !characterName.trim()) return;

    try {
      setIsUploading(true);
      setError(null);

      const uploaded = await uploadIllustrationPhoto(characterName.trim(), file);
      setIllustration(uploaded);

      setPhase('generating');
      setIsUploading(false);

      const genResult = await generateIllustration(uploaded.id);
      startPolling(genResult.illustrationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsUploading(false);
    }
  }, [file, characterName, startPolling]);

  // ── Regenerate with params ──
  const handleRegenerate = useCallback(
    async (options?: { prompt?: string; loraScale?: number; guidanceScale?: number }) => {
      if (!illustration) return;

      try {
        setPhase('chat-generating');
        setError(null);
        setSelectedGenId(null);

        const genResult = await generateIllustration(illustration.id, options);
        startPolling(genResult.illustrationId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        setPhase('review');
      }
    },
    [illustration, startPolling]
  );

  // ── Chat ──
  const handleSendMessage = useCallback(async () => {
    if (!illustration || !chatInput.trim() || isSending) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setIsSending(true);
    setError(null);

    // Optimistic user message
    const tempUserMsg: IllustrationMessage = {
      id: `temp-${Date.now()}`,
      illustrationId: illustration.id,
      role: 'user',
      content: userMsg,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const result = await sendIllustrationChat(illustration.id, userMsg);

      // Add assistant response
      const assistantMsg: IllustrationMessage = {
        id: `temp-${Date.now()}-assistant`,
        illustrationId: illustration.id,
        role: 'assistant',
        content: result.response,
        metadata: result.generation || null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Store pending generation params if provided
      if (result.generation) {
        setPendingGeneration(result.generation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [illustration, chatInput, isSending]);

  // ── Apply generation from chat ──
  const handleApplyGeneration = useCallback(() => {
    if (!pendingGeneration) return;
    handleRegenerate(pendingGeneration);
    setPendingGeneration(null);
  }, [pendingGeneration, handleRegenerate]);

  // ── Save to library ──
  const handleSave = useCallback(async () => {
    if (!illustration || !selectedGenId) return;

    try {
      await selectIllustrationVariant(illustration.id, selectedGenId);
      onComplete(illustration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }, [illustration, selectedGenId, onComplete]);

  const sourcePhotoUrl = previewUrl || illustration?.sourcePhotoUrl;
  const isGenerating = phase === 'generating' || phase === 'chat-generating';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stc-purple-100 flex items-center justify-center">
              <PaintBrushIcon className="w-4 h-4 text-stc-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              {illustration ? `Illustrate: ${illustration.name}` : 'New Illustration'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Image area */}
          <div className="flex-1 flex flex-col border-r border-neutral-100 min-w-0">
            {/* Upload phase */}
            {phase === 'upload' && !illustration && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                {/* Drop zone / preview */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f) handleFileSelect(f);
                  }}
                  onClick={() => !file && fileInputRef.current?.click()}
                  className={`
                    relative w-64 h-64 rounded-2xl border-2 border-dashed
                    transition-all duration-200 cursor-pointer overflow-hidden
                    ${file ? 'border-stc-purple-300' : ''}
                    ${isDragOver
                      ? 'border-stc-purple-400 bg-stc-purple-50 scale-[1.02]'
                      : !file
                        ? 'border-neutral-300 hover:border-stc-purple-300 hover:bg-stc-purple-50/50'
                        : ''
                    }
                  `}
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center">
                        <CameraIcon className="w-8 h-8 text-neutral-400" />
                      </div>
                      <p className="text-sm text-neutral-500 text-center px-4">
                        Drop a photo or <span className="text-stc-purple-500 font-medium">click to browse</span>
                      </p>
                    </div>
                  )}
                  {file && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="absolute bottom-2 right-2 p-2 rounded-lg bg-white/90 shadow-sm hover:bg-white transition-colors"
                    >
                      <PencilSquareIcon className="w-4 h-4 text-neutral-600" />
                    </button>
                  )}
                </div>

                {/* Name + Generate */}
                <div className="w-64 space-y-3">
                  <input
                    type="text"
                    value={characterName}
                    onChange={(e) => setCharacterName(e.target.value)}
                    placeholder="Character name..."
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                      placeholder:text-neutral-400 transition-shadow"
                    autoFocus
                  />
                  <button
                    onClick={handleUploadAndGenerate}
                    disabled={!file || !characterName.trim() || isUploading}
                    className={`
                      w-full py-3 rounded-xl text-sm font-semibold text-white min-h-[44px]
                      transition-all duration-200
                      ${file && characterName.trim() && !isUploading
                        ? 'bg-stc-purple-500 hover:bg-stc-purple-600 shadow-sm'
                        : 'bg-neutral-300 cursor-not-allowed'
                      }
                    `}
                  >
                    {isUploading ? 'Uploading...' : 'Generate Illustration'}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }} className="hidden" />
              </div>
            )}

            {/* Generating spinner */}
            {isGenerating && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-2 border-stc-purple-200 animate-ping opacity-20" />
                  <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80" fill="none" style={{ animationDuration: '1.5s' }}>
                    <circle cx="40" cy="40" r="35" stroke="#E8E3F0" strokeWidth="3" />
                    <path d="M40 5a35 35 0 0 1 35 35" stroke="url(#ws-grad)" strokeWidth="3" strokeLinecap="round" />
                    <defs>
                      <linearGradient id="ws-grad" x1="40" y1="5" x2="75" y2="40" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6A469D" />
                        <stop offset="1" stopColor="#50C8DF" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <SparklesIcon className="w-8 h-8 text-stc-purple-500" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-neutral-800 animate-pulse">Generating illustration...</p>
                <p className="text-xs text-neutral-400">This usually takes 15-30 seconds</p>
              </div>
            )}

            {/* Review: show generated variants */}
            {phase === 'review' && generations.length > 0 && (
              <div className="flex-1 flex flex-col p-6 min-h-0">
                {/* Source photo + arrow + variants */}
                <div className="flex items-start gap-4 mb-4">
                  {sourcePhotoUrl && (
                    <div className="flex-shrink-0">
                      <p className="text-xs font-medium text-neutral-500 mb-1.5">Source</p>
                      <img
                        src={sourcePhotoUrl}
                        alt="Source"
                        className="w-20 h-20 rounded-xl object-cover border border-neutral-200"
                      />
                    </div>
                  )}
                  <div className="flex items-center self-center pt-5">
                    <ArrowRightIcon className="w-6 h-6 text-neutral-300" />
                  </div>
                </div>

                {/* Variants grid */}
                <p className="text-xs font-medium text-neutral-500 mb-2">
                  Generated Variants — Click to select
                </p>
                <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
                  {generations.map((gen) => {
                    const imgUrl = gen.savedImageUrl || gen.outputImageUrl;
                    const isSelected = selectedGenId === gen.id;

                    return (
                      <button
                        key={gen.id}
                        onClick={() => setSelectedGenId(gen.id)}
                        className={`
                          relative rounded-xl overflow-hidden border-2 transition-all duration-200
                          ${isSelected
                            ? 'border-stc-purple-500 ring-2 ring-stc-purple-200 scale-[1.01]'
                            : 'border-neutral-200 hover:border-stc-purple-300'
                          }
                        `}
                      >
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt="Variant"
                            className="w-full h-full object-contain bg-neutral-50"
                          />
                        ) : (
                          <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                            <span className="text-xs text-neutral-400">No image</span>
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-stc-purple-500 flex items-center justify-center shadow-sm">
                            <CheckIcon className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Action bar */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => handleRegenerate()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-neutral-200 text-neutral-700
                      hover:bg-neutral-50 transition-colors min-h-[44px]"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!selectedGenId}
                    className={`
                      flex-1 py-2.5 rounded-xl text-sm font-semibold text-white min-h-[44px]
                      transition-all duration-200
                      ${selectedGenId
                        ? 'bg-stc-purple-500 hover:bg-stc-purple-600 shadow-sm'
                        : 'bg-neutral-300 cursor-not-allowed'
                      }
                    `}
                  >
                    Save to Library
                  </button>
                </div>
              </div>
            )}

            {/* Review with no generations (error state) */}
            {phase === 'review' && generations.length === 0 && error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-stc-pink/10 flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-6 h-6 text-stc-pink" />
                </div>
                <p className="text-sm text-neutral-600">{error}</p>
                <button
                  onClick={() => handleRegenerate()}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-stc-purple-500 hover:bg-stc-purple-600 min-h-[44px]"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Right: Chat panel */}
          {illustration && (
            <div className="w-[380px] flex flex-col bg-neutral-50">
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-neutral-200 bg-white">
                <h3 className="text-sm font-semibold text-neutral-800">AI Illustrator</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Describe changes and I'll refine the style
                </p>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.length === 0 && !isSending && (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto rounded-full bg-stc-purple-100 flex items-center justify-center mb-3">
                      <ChatBubbleLeftRightIcon className="w-6 h-6 text-stc-purple-500" />
                    </div>
                    <p className="text-sm text-neutral-500">
                      Tell me how you'd like the illustration to look
                    </p>
                    <div className="mt-4 space-y-2">
                      {[
                        'Make it more cartoony with simpler lines',
                        'Match the existing Acme Creative illustration style',
                        'Bigger head, simpler features, bolder outlines',
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setChatInput(suggestion);
                          }}
                          className="block w-full text-left px-3 py-2 rounded-lg text-xs text-neutral-600
                            bg-white border border-neutral-200 hover:border-stc-purple-300 hover:bg-stc-purple-50/50
                            transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                        ${msg.role === 'user'
                          ? 'bg-stc-purple-500 text-white rounded-br-md'
                          : 'bg-white text-neutral-800 border border-neutral-200 rounded-bl-md'
                        }
                      `}
                    >
                      <p>{msg.content}</p>
                      {msg.role === 'assistant' && msg.metadata?.prompt && (
                        <div className="mt-2 pt-2 border-t border-neutral-100">
                          <p className="text-xs text-neutral-400 mb-1">Suggested generation:</p>
                          <p className="text-xs text-neutral-500 font-mono truncate">
                            {msg.metadata.prompt.substring(0, 60)}...
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="bg-white text-neutral-400 border border-neutral-200 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Generate button (if AI suggested params) */}
              {pendingGeneration && !isGenerating && (
                <div className="px-4 py-2 border-t border-neutral-200 bg-stc-purple-50">
                  <button
                    onClick={handleApplyGeneration}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white
                      bg-stc-purple-500 hover:bg-stc-purple-600 transition-colors min-h-[44px]
                      flex items-center justify-center gap-2"
                  >
                    <SparklesIcon className="w-4 h-4" />
                    Generate with AI suggestion
                  </button>
                </div>
              )}

              {/* Chat input */}
              <div className="p-3 border-t border-neutral-200 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Describe changes..."
                    disabled={isSending || isGenerating}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-neutral-200 text-sm
                      focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500
                      placeholder:text-neutral-400 disabled:opacity-50 transition-shadow"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!chatInput.trim() || isSending || isGenerating}
                    className={`
                      p-2.5 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center
                      transition-colors
                      ${chatInput.trim() && !isSending && !isGenerating
                        ? 'bg-stc-purple-500 text-white hover:bg-stc-purple-600'
                        : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                      }
                    `}
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error banner */}
        {error && phase !== 'review' && (
          <div className="px-6 py-3 bg-stc-pink/10 border-t border-red-100">
            <p className="text-sm text-stc-pink">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
