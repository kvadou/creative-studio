import { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { GlobeAltIcon, SparklesIcon, FolderIcon, Cog6ToothIcon, PaperAirplaneIcon, ChevronRightIcon, InboxIcon } from '@heroicons/react/24/outline';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { Project, ConversationSummary } from '../lib/types';

// Icons for suggested prompts
const GlobeIconSmall = () => (
  <GlobeAltIcon className="w-4 h-4" />
);

const ChessIconSmall = () => (
  <SparklesIcon className="w-4 h-4" />
);

// Suggested prompts for new projects
const SUGGESTED_PROMPTS = [
  { text: 'How should I adapt this for the target culture?', icon: <GlobeIconSmall /> },
  { text: 'What characters work well for this region?', icon: <ChessIconSmall /> },
  { text: 'Suggest lesson modifications', icon: <ChessIconSmall /> },
  { text: 'Cultural considerations for teaching', icon: <GlobeIconSmall /> },
];

// Auto-resize textarea hook
function useAutoResize(value: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 120;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [value]);

  return textareaRef;
}

interface ProjectViewProps {
  project: Project;
  conversations: ConversationSummary[];
  onSelectConversation: (id: string) => void;
  onStartChat: (message: string) => Promise<void>;
  onOpenSettings: () => void;
  isLoading?: boolean;
  isSending?: boolean;
}

export default function ProjectView({
  project,
  conversations,
  onSelectConversation,
  onStartChat,
  onOpenSettings,
  isLoading,
  isSending,
}: ProjectViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const textareaRef = useAutoResize(input);

  const handleSubmit = async () => {
    if (!input.trim() || isSending) return;
    const message = input.trim();
    setInput('');
    await onStartChat(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="h-full flex flex-col bg-stc-bg">
      {/* Project Header */}
      <div className="border-b border-stc-purple-100 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-stc-purple-100 rounded-xl flex items-center justify-center">
                <FolderIcon className="w-5 h-5 text-stc-purple-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{project.name}</h1>
                {project.memberCount > 1 && (
                  <p className="text-sm text-neutral-500">{project.memberCount} members</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Settings button */}
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 px-4 py-2 min-h-[44px] text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                <Cog6ToothIcon className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-medium">Settings</span>
              </button>
            </div>
          </div>

          {/* Project Instructions Preview */}
          {project.instructions && (
            <div className="mt-4 p-3 bg-stc-purple-50 rounded-xl">
              <p className="text-sm text-stc-purple-700 line-clamp-2">{project.instructions}</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Input */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-3 sm:py-4">
        <div className="bg-white rounded-2xl shadow-card p-3 sm:p-4">
          <div className="flex gap-2 sm:gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`New chat in ${project.name}...`}
                disabled={isSending}
                rows={1}
                className="w-full px-4 py-3 bg-stc-purple-50 focus:bg-white border-2 border-transparent focus:border-stc-purple-500 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none transition-all resize-none overflow-hidden leading-normal min-h-[48px]"
                style={{ maxHeight: '120px' }}
              />
              {/* Send button inside textarea on mobile */}
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isSending}
                className="sm:hidden absolute right-2 bottom-2 w-9 h-9 flex items-center justify-center rounded-xl bg-stc-purple-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 active:scale-90"
                aria-label="Send message"
              >
                {isSending ? (
                  <ArrowPathIcon className="animate-spin h-4 w-4" />
                ) : (
                  <PaperAirplaneIcon className="w-5 h-5" />
                )}
              </button>
            </div>
            {/* Desktop send button */}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isSending}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-3 flex-shrink-0 text-white font-semibold rounded-xl bg-stc-purple-500 hover:bg-stc-purple-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-stc-purple-300 shadow-card hover:shadow-card-hover active:scale-[0.98] transition-all duration-200"
              aria-label="Send message"
            >
              {isSending ? (
                <>
                  <ArrowPathIcon className="animate-spin h-4 w-4" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <PaperAirplaneIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="animate-spin h-6 w-6 text-stc-purple-500" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-6 sm:py-8">
              <div className="text-center mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-stc-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <InboxIcon className="w-7 h-7 sm:w-8 sm:h-8 text-stc-purple-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-neutral-900 mb-1">Get started</h3>
                <p className="text-sm text-neutral-500">Try one of these prompts or type your own</p>
              </div>

              {/* Suggested Prompts - mobile-optimized grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setInput(prompt.text);
                    }}
                    className="flex items-center gap-3 p-3 sm:p-4 bg-white hover:bg-stc-purple-50 active:bg-stc-purple-100 rounded-xl border border-neutral-200 hover:border-stc-purple-200 text-left transition-all duration-200 min-h-[52px] touch-target"
                  >
                    <span className="text-stc-purple-500 flex-shrink-0">{prompt.icon}</span>
                    <span className="text-sm text-neutral-700 leading-snug">{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  onMouseEnter={() => setHoveredId(conv.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="w-full text-left p-3 sm:p-4 bg-white hover:bg-stc-purple-50 active:bg-stc-purple-100 rounded-xl sm:rounded-2xl border border-neutral-200 hover:border-stc-purple-200 transition-all duration-200 group min-h-[52px] touch-target"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-neutral-900 truncate group-hover:text-stc-purple-700">
                        {conv.title}
                      </h3>
                      {conv.lastMessage && (
                        <p className="text-sm text-neutral-500 mt-1 line-clamp-2">
                          {conv.lastMessage.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-neutral-400">{formatDate(conv.updatedAt)}</span>
                      {hoveredId === conv.id && (
                        <ChevronRightIcon className="w-4 h-4 text-stc-purple-500" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
