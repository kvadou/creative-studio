import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { GeneratedContent, GeneratedPuzzle, SourceAttribution } from '../../lib/api';

interface LessonPreviewProps {
  lesson: GeneratedContent;
}

type TabKey = 'full' | 'story' | 'chess' | 'tips' | 'exercises' | 'puzzles' | 'sources';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'full', label: 'Full Lesson' },
  { key: 'story', label: 'Story' },
  { key: 'chess', label: 'Chess Lesson' },
  { key: 'tips', label: 'Teacher Tips' },
  { key: 'exercises', label: 'Chessercises' },
  { key: 'puzzles', label: 'Puzzles' },
  { key: 'sources', label: 'Sources' },
];

export function LessonPreview({ lesson }: LessonPreviewProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('full');

  function getContent(): string | null {
    switch (activeTab) {
      case 'full':
        return lesson.rawContent;
      case 'story':
        return lesson.sections.story || null;
      case 'chess':
        return lesson.sections.chessLesson || null;
      case 'tips':
        return lesson.sections.teacherTips || null;
      case 'exercises':
        return lesson.sections.chessercises || null;
      default:
        return null;
    }
  }

  const content = getContent();

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <div className="px-4 py-3 border-b border-neutral-200 bg-white">
        <h2 className="text-lg font-semibold text-neutral-900">{lesson.title}</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-neutral-200 bg-neutral-50 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-stc-purple-500 text-white'
                : 'text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'puzzles' ? (
          <PuzzleDisplay puzzles={lesson.sections.puzzles || []} />
        ) : activeTab === 'sources' ? (
          <SourcesDisplay attributions={lesson.sourceAttributions || []} />
        ) : content ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center text-neutral-500 py-8">
            No {activeTab} content found in this lesson.
          </div>
        )}
      </div>
    </div>
  );
}

function PuzzleDisplay({ puzzles }: { puzzles: GeneratedPuzzle[] }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  async function copyFen(fen: string, index: number) {
    await navigator.clipboard.writeText(fen);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  if (puzzles.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-8">
        No puzzles extracted from this lesson.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {puzzles.map((puzzle, index) => (
        <div
          key={index}
          className="border border-neutral-200 rounded-lg overflow-hidden bg-white"
        >
          <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
            <span className="font-medium text-sm">Puzzle #{index + 1}</span>
            {puzzle.fen && (
              <button
                onClick={() => copyFen(puzzle.fen, index)}
                className="text-xs px-2 py-1 rounded bg-neutral-200 hover:bg-neutral-300 transition-colors"
              >
                {copiedIndex === index ? 'Copied!' : 'Copy FEN'}
              </button>
            )}
          </div>
          <div className="p-4 space-y-3">
            {puzzle.fen && (
              <div>
                <span className="text-xs font-medium text-neutral-500 block mb-1">FEN:</span>
                <code className="text-xs bg-neutral-100 px-2 py-1 rounded block overflow-x-auto">
                  {puzzle.fen}
                </code>
                {/* Lichess board preview link */}
                <a
                  href={`https://lichess.org/editor/${encodeURIComponent(puzzle.fen)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-stc-purple-600 hover:underline mt-1 inline-block"
                >
                  View on Lichess Board Editor ↗
                </a>
              </div>
            )}
            {puzzle.narrative && (
              <div>
                <span className="text-xs font-medium text-neutral-500 block mb-1">Setup:</span>
                <p className="text-sm text-neutral-700">{puzzle.narrative}</p>
              </div>
            )}
            {puzzle.hint && (
              <div>
                <span className="text-xs font-medium text-neutral-500 block mb-1">Hint:</span>
                <p className="text-sm text-neutral-600 italic">{puzzle.hint}</p>
              </div>
            )}
            {puzzle.answer && (
              <div>
                <span className="text-xs font-medium text-neutral-500 block mb-1">Answer:</span>
                <p className="text-sm font-medium text-stc-green">{puzzle.answer}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcesDisplay({ attributions }: { attributions: SourceAttribution[] }) {
  if (attributions.length === 0) {
    return (
      <div className="text-center text-neutral-500 py-8">
        <div className="mb-2">No source attributions found.</div>
        <p className="text-xs text-neutral-400">
          Source attributions appear when the AI references real players, historical events, or chess literature.
        </p>
      </div>
    );
  }

  const typeColors: Record<string, { bg: string; text: string; label: string }> = {
    FACT: { bg: 'bg-stc-green/15', text: 'text-stc-green', label: 'Fact' },
    INSPIRED_BY: { bg: 'bg-stc-blue/15', text: 'text-stc-navy', label: 'Inspired By' },
    INVENTED: { bg: 'bg-stc-yellow/15', text: 'text-neutral-700', label: 'Invented' },
  };

  const confidenceColors: Record<string, string> = {
    high: 'bg-stc-green',
    medium: 'bg-stc-yellow',
    low: 'bg-stc-pink',
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-neutral-600 mb-4">
        <strong>{attributions.length}</strong> source attribution{attributions.length !== 1 ? 's' : ''} found in this lesson.
      </div>

      {attributions.map((attr, index) => {
        const typeStyle = typeColors[attr.type] || typeColors.INVENTED;
        return (
          <div
            key={index}
            className="border border-neutral-200 rounded-lg overflow-hidden bg-white"
          >
            <div className="px-4 py-2 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${typeStyle.bg} ${typeStyle.text}`}>
                {typeStyle.label}
              </span>
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <span>Confidence:</span>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${confidenceColors[attr.confidence]}`} />
                  <span className="capitalize">{attr.confidence}</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div>
                <span className="text-xs font-medium text-neutral-500 block mb-1">Content:</span>
                <p className="text-sm text-neutral-700 italic">"{attr.content}"</p>
              </div>
              {attr.source && (
                <div>
                  <span className="text-xs font-medium text-neutral-500 block mb-1">Source:</span>
                  <p className="text-sm text-stc-purple-700 font-medium">{attr.source}</p>
                </div>
              )}
              {!attr.source && attr.type !== 'INVENTED' && (
                <div className="text-xs text-stc-yellow bg-stc-yellow/10 px-2 py-1 rounded">
                  ⚠️ No specific source provided - verify accuracy before use
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="text-xs text-neutral-400 mt-4 p-3 bg-neutral-50 rounded">
        <strong>Note:</strong> Source attributions help verify educational accuracy.
        Review all "Fact" and "Inspired By" items to ensure historical accuracy before publishing.
      </div>
    </div>
  );
}
