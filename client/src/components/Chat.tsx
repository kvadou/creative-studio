import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AcademicCapIcon, UserIcon, BookOpenIcon, GlobeAltIcon, LightBulbIcon, DocumentTextIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import Message from './Message';
import UniversalSearch from './UniversalSearch';
import { chatApi, healthApi, getConversation, type ChatResponse } from '../lib/api';

// Auto-resize textarea hook
function useAutoResize(value: string) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get scrollHeight correctly
      textarea.style.height = 'auto';
      // Set height to scrollHeight, capped at max
      const maxHeight = 150;
      const newHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${newHeight}px`;
      // Show scrollbar if exceeds max
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [value]);

  return textareaRef;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatResponse['citations'];
  confidence?: string;
  queryId?: string;
  agenticMode?: boolean;
  region?: string;
  culturalSources?: string[];
  storyMode?: boolean;
  storyMetadata?: ChatResponse['storyMetadata'];
}

interface ChatProps {
  onHealthChange: (healthy: boolean) => void;
  conversationId?: string | null;
  onConversationCreated?: (id: string) => void;
  onMessageSent?: () => void;
  projectId?: string | null;
}

// Icon components for different categories
const ChessIcon = () => (
  <AcademicCapIcon className="w-6 h-6 text-stc-purple-500" />
);
const CharacterIcon = () => (
  <UserIcon className="w-6 h-6 text-stc-purple-500" />
);
const MnemonicIcon = () => (
  <BookOpenIcon className="w-6 h-6 text-stc-purple-500" />
);
const GlobeIcon = () => (
  <GlobeAltIcon className="w-6 h-6 text-stc-purple-500" />
);
const TeachingIcon = () => (
  <LightBulbIcon className="w-6 h-6 text-stc-purple-500" />
);
const LessonIcon = () => (
  <DocumentTextIcon className="w-6 h-6 text-stc-purple-500" />
);
const StoryIcon = () => (
  <BookOpenIcon className="w-6 h-6 text-stc-purple-500" />
);

// Cultural adaptation prompts (always include one)
const CULTURAL_QUERIES = [
  { text: 'Adapt the knight story for Japan', icon: <GlobeIcon /> },
  { text: 'How to adapt lesson 3 for Korea', icon: <GlobeIcon /> },
  { text: 'Adapt the curriculum for Dubai', icon: <GlobeIcon /> },
  { text: 'Singapore cultural considerations', icon: <GlobeIcon /> },
  { text: 'Hong Kong adaptation tips', icon: <GlobeIcon /> },
  { text: 'Adapt Module 2 for India', icon: <GlobeIcon /> },
  { text: 'Cultural tips for teaching in China', icon: <GlobeIcon /> },
  { text: 'Adapt the queen story for Saudi Arabia', icon: <GlobeIcon /> },
];

// Other example queries (pick 3 randomly)
const OTHER_QUERIES = [
  // Chess concepts (5)
  { text: 'How does the knight move?', icon: <ChessIcon /> },
  { text: 'How does the bishop move?', icon: <ChessIcon /> },
  { text: 'What is castling and when can you do it?', icon: <ChessIcon /> },
  { text: 'How do you get out of check?', icon: <ChessIcon /> },
  { text: 'What is checkmate?', icon: <ChessIcon /> },
  // Characters (5)
  { text: 'Who is King Chomper?', icon: <CharacterIcon /> },
  { text: 'Tell me about King Shaky', icon: <CharacterIcon /> },
  { text: 'Who is Queen Bella?', icon: <CharacterIcon /> },
  { text: 'Who are Clip and Clop?', icon: <CharacterIcon /> },
  { text: 'Tell me about Bea and Bop', icon: <CharacterIcon /> },
  // Mnemonics (4)
  { text: "What's the pawn capture mnemonic?", icon: <MnemonicIcon /> },
  { text: 'What does CPR mean in chess?', icon: <MnemonicIcon /> },
  { text: "What's gallop-gallop-step to the side?", icon: <MnemonicIcon /> },
  { text: 'What does 1-2-3 LOCKED mean?', icon: <MnemonicIcon /> },
  // Teaching tips (3)
  { text: 'How do I teach check to beginners?', icon: <TeachingIcon /> },
  { text: 'Activities for teaching knight movement', icon: <TeachingIcon /> },
  { text: 'Tips for teaching 3-4 year olds', icon: <TeachingIcon /> },
  // Lessons (2)
  { text: 'What happens in Module 1?', icon: <LessonIcon /> },
  { text: 'Overview of the pawn lessons', icon: <LessonIcon /> },
  // Story writing (3)
  { text: 'Write a story about King Chomper learning to castle', icon: <StoryIcon /> },
  { text: 'Create an adventure with Clip and Clop teaching forks', icon: <StoryIcon /> },
  { text: 'Draft a story introducing the bishop for 6 year olds', icon: <StoryIcon /> },
];

// Randomly select prompts: 1 cultural (always) + 3 from other categories
function getRandomPrompts() {
  // Pick 1 random cultural prompt
  const culturalIndex = Math.floor(Math.random() * CULTURAL_QUERIES.length);
  const culturalPrompt = CULTURAL_QUERIES[culturalIndex];

  // Pick 3 random from other categories
  const shuffledOthers = [...OTHER_QUERIES].sort(() => Math.random() - 0.5);
  const otherPrompts = shuffledOthers.slice(0, 3);

  // Combine and shuffle position (so cultural isn't always first)
  const combined = [culturalPrompt, ...otherPrompts];
  return combined.sort(() => Math.random() - 0.5);
}

export default function Chat({
  onHealthChange,
  conversationId,
  onConversationCreated,
  onMessageSent,
  projectId,
}: ChatProps) {
  const { conversationId: urlConversationId } = useParams<{ conversationId: string }>();
  const routerNavigate = useNavigate();

  // Use URL param first, then prop fallback
  const effectiveConversationId = urlConversationId || conversationId || null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [storyMode, setStoryMode] = useState(false); // Story Mode toggle
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useAutoResize(input);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top on mount
  useEffect(() => {
    if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = 0;
  }, []);

  // Select 4 random prompts on each mount (refreshes when user navigates to home)
  const exampleQueries = useMemo(() => getRandomPrompts(), []);

  // Health check
  useEffect(() => {
    healthApi()
      .then((data) => onHealthChange(data.status === 'healthy'))
      .catch(() => onHealthChange(false));
  }, [onHealthChange]);

  // Load conversation messages when effectiveConversationId changes
  useEffect(() => {
    // If effectiveConversationId is null, reset to new conversation state
    if (effectiveConversationId === null) {
      setMessages([]);
      setCurrentConversationId(null);
      return;
    }

    // If same conversation, skip loading
    if (effectiveConversationId === currentConversationId) {
      return;
    }

    const loadConversation = async () => {
      setIsLoadingConversation(true);
      try {
        const conversation = await getConversation(effectiveConversationId);
        const loadedMessages: Message[] = conversation.messages.map((m) => {
          const metadata = m.metadata as Record<string, unknown> | null;
          return {
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            citations: metadata?.citations as ChatResponse['citations'],
            confidence: metadata?.confidence as string | undefined,
            queryId: metadata?.queryId as string | undefined,
            agenticMode: metadata?.agenticMode as boolean | undefined,
            region: metadata?.region as string | undefined,
            culturalSources: metadata?.culturalSources as string[] | undefined,
            storyMode: metadata?.storyMode as boolean | undefined,
            storyMetadata: metadata?.storyMetadata as ChatResponse['storyMetadata'],
          };
        });
        setMessages(loadedMessages);
        setCurrentConversationId(effectiveConversationId);
      } catch (error) {
        console.error('Failed to load conversation:', error);
        // If conversation not found, reset to new state
        setMessages([]);
        setCurrentConversationId(null);
      } finally {
        setIsLoadingConversation(false);
      }
    };

    loadConversation();
  }, [effectiveConversationId, currentConversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    // Focus textarea on conversation change, but not on mobile to avoid keyboard popup
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (!isMobile) {
      textareaRef.current?.focus();
    }
  }, [effectiveConversationId]);

  const sendMessage = useCallback(async (text?: string) => {
    const query = text || input.trim();
    if (!query || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Pass current conversation ID to maintain context, projectId for new conversations, and storyMode
      const response = await chatApi(query, currentConversationId || undefined, projectId || undefined, storyMode);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        confidence: response.confidence,
        queryId: response.queryId,
        agenticMode: response.agenticMode,
        region: response.region,
        culturalSources: response.culturalSources,
        storyMode: response.storyMode,
        storyMetadata: response.storyMetadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Handle new conversation created
      if (response.conversationId && response.conversationId !== currentConversationId) {
        setCurrentConversationId(response.conversationId);
        onConversationCreated?.(response.conversationId);
        // Navigate to the new conversation URL
        routerNavigate(`/chat/${response.conversationId}`, { replace: true });
      } else {
        // Existing conversation updated, refresh sidebar
        onMessageSent?.();
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          'Sorry, I encountered an error processing your request. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Focus textarea after sending, but not on mobile
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (!isMobile) {
        textareaRef.current?.focus();
      }
    }
  }, [input, isLoading, currentConversationId, onConversationCreated, onMessageSent, projectId, storyMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter sends, Shift+Enter for new line
    // Mobile: Always require explicit send button click
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-3 sm:space-y-4">
        {/* Loading Conversation State */}
        {isLoadingConversation ? (
          <div className="flex flex-col items-center justify-center h-full py-8 sm:py-12">
            <div className="flex items-center gap-3 text-neutral-500">
              <ArrowPathIcon className="animate-spin h-5 w-5 text-stc-purple-500" />
              <span>Loading conversation...</span>
            </div>
          </div>
        ) : messages.length === 0 ? (
          /* Empty State - Welcome Screen */
          <div className="flex flex-col items-center min-h-full py-6 sm:py-12 animate-fade-in">
            {/* Welcome Text - condensed on mobile */}
            <h2 className="text-xl sm:text-3xl font-bold text-stc-purple-700 mb-2 sm:mb-3 text-center px-4">
              Curriculum Assistant
            </h2>
            <p className="text-neutral-600 mb-6 sm:mb-10 max-w-lg mx-auto text-center text-sm sm:text-lg px-4 leading-relaxed">
              Ask about lessons, characters, mnemonics, and teaching methods.
              <span className="hidden sm:inline"> Now with{' '}
                <span className="text-stc-blue font-semibold">cultural adaptation</span>{' '}
                for international markets.
              </span>
            </p>

            {/* Example Queries - Cards Grid */}
            <div className="w-full max-w-2xl px-3 sm:px-4">
              <p className="text-xs font-semibold text-stc-purple-400 uppercase tracking-widest mb-3 sm:mb-4 text-center">
                Try asking
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                {exampleQueries.map((query) => (
                  <button
                    key={query.text}
                    onClick={() => sendMessage(query.text)}
                    className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl shadow-card hover:shadow-card-hover active:scale-[0.98] transition-all duration-200 text-left border-2 border-transparent hover:border-stc-purple-200 touch-target"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-stc-purple-50 flex items-center justify-center flex-shrink-0 group-hover:bg-stc-purple-100 transition-colors">
                      <span className="[&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
                        {query.icon}
                      </span>
                    </div>
                    <span className="text-sm sm:text-base text-neutral-700 font-medium group-hover:text-stc-purple-600 transition-colors line-clamp-2">
                      {query.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Universal Search */}
            <UniversalSearch onTopicSelect={(question) => sendMessage(question)} />
          </div>
        ) : (
          /* Message List */
          messages.map((message) => (
            <Message key={message.id} message={message} />
          ))
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center gap-4 px-5 py-4 card w-fit message-enter">
            <div className="flex items-center gap-2">
              <div className="loading-dot" />
              <div className="loading-dot" />
              <div className="loading-dot" />
            </div>
            <span className="text-sm text-stc-purple-500 font-semibold">
              {storyMode ? 'Writing your story...' : 'Searching curriculum...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - sticky at bottom with safe area padding */}
      <div className="p-3 sm:p-4 safe-bottom bg-gradient-to-t from-stc-bg via-stc-bg to-transparent">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card p-3 sm:p-4">
          {/* Story Mode Toggle */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <button
              onClick={() => setStoryMode(!storyMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                storyMode
                  ? 'bg-stc-purple-500 text-white shadow-sm'
                  : 'bg-stc-purple-50 text-stc-purple-600 hover:bg-stc-purple-100'
              }`}
            >
              <BookOpenIcon className="w-4 h-4" />
              <span>Story Mode</span>
              {storyMode && (
                <CheckIcon className="w-3.5 h-3.5" />
              )}
            </button>
            {storyMode && (
              <span className="text-xs text-stc-purple-500 italic hidden sm:inline">
                Will generate a narrative story with Acme Creative characters
              </span>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={storyMode ? "Describe a story to write (e.g., 'King Chomper learns about forks')..." : "Ask about the curriculum..."}
                disabled={isLoading}
                rows={1}
                className="input input-mobile pr-12 sm:pr-4 resize-none overflow-hidden leading-normal"
                style={{ minHeight: '48px', maxHeight: '150px' }}
                aria-label="Message input"
              />
              {/* Send button inside textarea on mobile */}
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="sm:hidden absolute right-2 bottom-2
                         w-9 h-9 flex items-center justify-center rounded-xl
                         bg-stc-purple-500 text-white
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-all duration-200 active:scale-90 touch-target"
                aria-label="Send message"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
            {/* Desktop send button - inline styles to avoid btn-primary overriding hidden */}
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-3 flex-shrink-0
                       text-white font-semibold rounded-xl bg-stc-purple-500 hover:bg-stc-purple-600
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-stc-purple-300
                       shadow-card hover:shadow-card-hover active:scale-[0.98] transition-all duration-200"
              aria-label="Send message"
            >
              <span>Send</span>
              <PaperAirplaneIcon className="w-4 h-4" />
            </button>
          </div>
          {/* Helper text - hidden on mobile to save space */}
          <p className="hidden sm:block mt-3 text-xs text-center text-neutral-500">
            Responses are generated from curriculum content. Press Enter to send, Shift+Enter for new line.
          </p>
        </div>
      </div>
    </div>
  );
}
