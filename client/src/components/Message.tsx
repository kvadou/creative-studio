import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { GlobeAltIcon, BookOpenIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Citation from './Citation';
import WebSourceModal from './WebSourceModal';

// Transform citation references like [Module 1A-3-4yo, Lesson 5] into clickable links
function transformCitationLinks(content: string): string {
  // Pattern to match single citation: Module X, Lesson Y or Module X Lesson Y
  const singleCitationPattern = /Module\s+([^\],;]+?)(?:,\s*|\s+)Lesson\s+(\d+)/gi;

  // First, handle multi-citation brackets like [Module X, Lesson 5; Module Y, Lesson 1]
  const multiBracketPattern = /\[([^\]]*Module[^\]]*)\]/gi;

  let result = content.replace(multiBracketPattern, (match, innerContent) => {
    // Check if it contains multiple citations (semicolon-separated)
    if (innerContent.includes(';')) {
      const citations = innerContent.split(';').map((part: string) => {
        const citationMatch = part.match(/Module\s+([^\],;]+?)(?:,\s*|\s+)Lesson\s+(\d+)/i);
        if (citationMatch) {
          const [, moduleCode, lessonNumber] = citationMatch;
          const cleanModuleCode = moduleCode.trim();
          return `[Module ${cleanModuleCode}, Lesson ${lessonNumber}](/lesson/${encodeURIComponent(cleanModuleCode)}/${lessonNumber})`;
        }
        return part.trim();
      });
      return citations.join('; ');
    }

    // Single citation in brackets
    const citationMatch = innerContent.match(/Module\s+([^\],;]+?)(?:,\s*|\s+)Lesson\s+(\d+)/i);
    if (citationMatch) {
      const [, moduleCode, lessonNumber] = citationMatch;
      const cleanModuleCode = moduleCode.trim();
      return `[Module ${cleanModuleCode}, Lesson ${lessonNumber}](/lesson/${encodeURIComponent(cleanModuleCode)}/${lessonNumber})`;
    }

    return match; // Return unchanged if no citation pattern found
  });

  return result;
}

interface MessageProps {
  message: {
    role: 'user' | 'assistant';
    content: string;
    citations?: Array<{
      text: string;
      moduleCode: string;
      lessonNumber: number;
      section: string;
    }>;
    confidence?: string;
    queryId?: string;
    agenticMode?: boolean;
    region?: string;
    culturalSources?: string[];
  };
}

export default function Message({ message }: MessageProps) {
  const [showSources, setShowSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const isUser = message.role === 'user';

  // Transform citation references to links (memoized for performance)
  const transformedContent = useMemo(
    () => transformCitationLinks(message.content),
    [message.content]
  );

  const confidenceConfig = {
    high: {
      label: 'High confidence',
      classes: 'badge-green',
      icon: '✓',
    },
    medium: {
      label: 'Medium confidence',
      classes: 'badge-yellow',
      icon: '~',
    },
    low: {
      label: 'Low confidence',
      classes: 'badge-orange',
      icon: '!',
    },
    no_answer: {
      label: 'No match found',
      classes: 'badge-gray',
      icon: '—',
    },
  };

  const conf = message.confidence
    ? confidenceConfig[message.confidence as keyof typeof confidenceConfig]
    : null;

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} message-enter`}
    >
      <div
        className={`message-bubble max-w-[92%] sm:max-w-[85%] md:max-w-[80%] ${
          isUser
            ? 'bg-gradient-to-br from-stc-purple-500 to-stc-purple-600 text-white rounded-2xl rounded-br-sm shadow-card'
            : 'card rounded-2xl rounded-bl-sm'
        } px-3.5 py-3 sm:px-5 sm:py-4`}
      >
        {/* Agentic Mode Badge */}
        {!isUser && message.agenticMode && (
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-stc-blue/20">
            <span className="badge badge-blue">
              <GlobeAltIcon className="w-3.5 h-3.5 mr-1.5" />
              Cultural Adaptation
            </span>
            {message.region && (
              <span className="text-xs text-neutral-500 font-medium">
                for {message.region}
              </span>
            )}
          </div>
        )}

        {/* Message Content */}
        {isUser ? (
          <div className="whitespace-pre-wrap text-[15px] sm:text-base leading-relaxed text-white selectable">
            {message.content}
          </div>
        ) : (
          <div className="prose prose-sm sm:prose-base max-w-none selectable
            prose-headings:font-semibold prose-headings:text-neutral-900 prose-headings:mt-3 prose-headings:mb-2
            prose-h2:text-base sm:prose-h2:text-lg prose-h2:border-b prose-h2:border-neutral-200 prose-h2:pb-2
            prose-h3:text-sm sm:prose-h3:text-base prose-h3:text-stc-purple-700
            prose-p:text-neutral-700 prose-p:leading-relaxed prose-p:my-2 prose-p:text-[15px] sm:prose-p:text-base
            prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4 sm:prose-ul:pl-5
            prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-4 sm:prose-ol:pl-5
            prose-li:text-neutral-700 prose-li:my-0.5 prose-li:text-[15px] sm:prose-li:text-base
            prose-strong:text-neutral-900 prose-strong:font-semibold
            prose-em:italic
            prose-a:text-stc-purple-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-a:break-words
          ">
            <ReactMarkdown
              components={{
                // Custom link component to open lesson links in new tabs
                a: ({ href, children }) => {
                  const isLessonLink = href?.startsWith('/lesson/');
                  return (
                    <a
                      href={href}
                      target={isLessonLink ? '_blank' : undefined}
                      rel={isLessonLink ? 'noopener noreferrer' : undefined}
                      className="text-stc-purple-600 font-medium hover:underline break-words"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {transformedContent}
            </ReactMarkdown>
          </div>
        )}

        {/* Assistant Footer (confidence, citations, cultural sources) */}
        {!isUser && (message.confidence || message.citations?.length || message.culturalSources?.length) && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-stc-purple-100 space-y-2 sm:space-y-3">
            {/* Top Row: Confidence + Sources Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Confidence Badge */}
              {conf && (
                <span className={`badge ${conf.classes} text-[11px] sm:text-xs`}>
                  <span className="mr-1 sm:mr-1.5 font-bold">{conf.icon}</span>
                  <span className="hidden xs:inline">{conf.label}</span>
                  <span className="xs:hidden">{message.confidence}</span>
                </span>
              )}

              {/* Sources Toggle */}
              <div className="flex items-center gap-2 sm:gap-3">
                {message.citations && message.citations.length > 0 && (
                  <button
                    onClick={() => setShowSources(!showSources)}
                    className="btn-link text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 font-semibold touch-target py-1"
                    aria-expanded={showSources}
                  >
                    <BookOpenIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden xs:inline">{showSources ? 'Hide' : 'Show'} sources</span>
                    <span className="xs:hidden">{showSources ? 'Hide' : 'Sources'}</span>
                    <span className="text-neutral-400">({message.citations.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Curriculum Sources Panel */}
            {showSources && message.citations && (
              <div className="space-y-2 animate-fade-in">
                {message.citations.map((citation, i) => (
                  <Citation key={i} citation={citation} />
                ))}
              </div>
            )}

            {/* Cultural Sources (for agentic responses) */}
            {message.culturalSources && message.culturalSources.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                  Web Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {message.culturalSources.slice(0, 5).map((source, i) => {
                    const isUrl = source.startsWith('http://') || source.startsWith('https://');
                    const displayText = isUrl ? new URL(source).hostname.replace('www.', '') : source;

                    return isUrl ? (
                      <a
                        key={i}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="badge badge-blue truncate max-w-[200px] hover:bg-stc-blue/30 transition-colors cursor-pointer"
                        title={source}
                      >
                        <ArrowTopRightOnSquareIcon className="w-3 h-3 flex-shrink-0 mr-1.5" />
                        <span className="truncate">{displayText}</span>
                      </a>
                    ) : (
                      <button
                        key={i}
                        onClick={() => setSelectedSource(source)}
                        className="badge badge-blue truncate max-w-[200px] hover:bg-stc-blue/30 transition-colors cursor-pointer"
                        title="Click for more details"
                      >
                        <BookOpenIcon className="w-3 h-3 flex-shrink-0 mr-1.5" />
                        <span className="truncate">{source}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Web Source Modal */}
            <WebSourceModal
              source={selectedSource || ''}
              region={message.region}
              isOpen={!!selectedSource}
              onClose={() => setSelectedSource(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
