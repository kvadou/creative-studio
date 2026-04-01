import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, MagnifyingGlassIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import type { DailySuggestion, Illustration, IllustrationGeneration, GenerateArtRequest, PromptAnalysis } from '../lib/types';
import { getIllustrations, generateSuggestionArt, pollIllustrationStatus, selectIllustrationVariant, analyzeArtPrompt } from '../lib/api';

type ModalState = 'idle' | 'analyzing' | 'preflight' | 'generating' | 'results' | 'saving';

interface Props {
  suggestion: DailySuggestion;
  onClose: () => void;
  onGenerated: (suggestionId: string, illustrationId: string) => void;
}

export default function GenerateArtModal({ suggestion, onClose, onGenerated }: Props) {
  const [state, setState] = useState<ModalState>('idle');
  const [prompt, setPrompt] = useState(
    suggestion.generationPrompts?.[0]?.prompt || `Create a social media image featuring ${suggestion.characterNames?.[0] || 'Acme Creative characters'} for: ${suggestion.title}`
  );
  const [references, setReferences] = useState<Illustration[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [refSearch, setRefSearch] = useState('');
  const [refSearchResults, setRefSearchResults] = useState<Illustration[] | null>(null);
  const [searchingRefs, setSearchingRefs] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [generations, setGenerations] = useState<IllustrationGeneration[]>([]);
  const [analysis, setAnalysis] = useState<PromptAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const characterName = suggestion.characterNames?.[0];
    if (!characterName) return;

    // Search by name AND by characterId to catch all relevant illustrations
    // "Queen Bella" might be named "Bella" in the DB, and linked via characterId
    const nameVariants = [characterName];
    // Also try just the last word (e.g. "Queen Bella" → "Bella")
    const parts = characterName.split(' ');
    if (parts.length > 1) nameVariants.push(parts[parts.length - 1]);

    const searches = nameVariants.map(name =>
      getIllustrations({ search: name, artType: 'ORIGINAL', limit: 12 })
        .then(res => res.illustrations.filter(i => i.illustrationUrl))
        .catch(() => [] as Illustration[])
    );

    Promise.all(searches).then(results => {
      // Merge and deduplicate by id
      const seen = new Set<string>();
      const merged: Illustration[] = [];
      for (const list of results) {
        for (const ill of list) {
          if (!seen.has(ill.id)) {
            seen.add(ill.id);
            merged.push(ill);
          }
        }
      }
      setReferences(merged);
      setSelectedRefIds(merged.slice(0, 6).map(i => i.id));
    });
  }, [suggestion.characterNames]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleRefSearch = (query: string) => {
    setRefSearch(query);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setRefSearchResults(null);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearchingRefs(true);
      try {
        const res = await getIllustrations({ search: query, artType: 'ORIGINAL', limit: 12 });
        setRefSearchResults(res.illustrations.filter(i => i.illustrationUrl));
      } catch {
        setRefSearchResults([]);
      }
      setSearchingRefs(false);
    }, 300);
  };

  const handleAnalyze = async () => {
    setError(null);
    setState('analyzing');
    try {
      const result = await analyzeArtPrompt(prompt);
      // Fast path: no issues → skip straight to generation
      if (result.warnings.length === 0 && result.questions.length === 0) {
        setAnalysis(null);
        doGenerate();
        return;
      }
      setAnalysis(result);
      setState('preflight');
    } catch {
      // Analysis failed — don't block generation, just proceed
      doGenerate();
    }
  };

  const doGenerate = async () => {
    setError(null);
    setState('generating');
    try {
      const request: GenerateArtRequest = {
        prompt,
        engine: 'gemini',
        referenceImageIds: selectedRefIds.length > 0 ? selectedRefIds : undefined,
      };
      const result = await generateSuggestionArt(suggestion.id, request);
      setGeneratedId(result.illustrationId);
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollIllustrationStatus(result.illustrationId);
          if (status.status === 'COMPLETED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setGenerations(status.generations || []);
            setState('results');
          } else if (status.status === 'FAILED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setError(status.error || 'Generation failed');
            setState('idle');
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
      setState('idle');
    }
  };

  const handleSelect = async (genId: string) => {
    if (!generatedId) return;
    setState('saving');
    try {
      await selectIllustrationVariant(generatedId, genId);
      onGenerated(suggestion.id, generatedId);
      onClose();
    } catch {
      setError('Failed to save selected image');
      setState('results');
    }
  };

  const handleUseSingle = () => {
    if (generatedId) {
      onGenerated(suggestion.id, generatedId);
      onClose();
    }
  };

  const toggleRef = (id: string) => {
    setSelectedRefIds(prev =>
      prev.includes(id)
        ? prev.filter(r => r !== id)
        : prev.length < 6 ? [...prev, id] : prev
    );
  };

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === backdropRef.current && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Generate Art</h2>
            <p className="text-sm text-neutral-500 mt-0.5">{suggestion.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 transition-colors">
            <XMarkIcon className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="bg-stc-pink/10 border border-stc-pink/20 rounded-xl px-4 py-3 text-sm text-stc-pink">
              {error}
            </div>
          )}

          {state === 'idle' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">
                  Reference Images ({selectedRefIds.length}/6 selected)
                </label>

                {/* Search box */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={refSearch}
                    onChange={(e) => handleRefSearch(e.target.value)}
                    placeholder="Search characters, tags, or illustrations..."
                    className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 pl-9 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                  {searchingRefs && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <ArrowPathIcon className="w-4 h-4 text-stc-purple-400 animate-spin" />
                    </div>
                  )}
                </div>

                {/* Image grid — show search results when searching, otherwise auto-loaded refs */}
                {(() => {
                  const displayRefs = refSearchResults !== null ? refSearchResults : references;
                  if (displayRefs.length === 0 && refSearchResults !== null) {
                    return <p className="text-xs text-neutral-400 py-2">No illustrations found</p>;
                  }
                  return (
                    <div className="grid grid-cols-6 gap-2">
                      {displayRefs.map(ref => (
                        <button
                          key={ref.id}
                          onClick={() => toggleRef(ref.id)}
                          className={`aspect-square rounded-xl overflow-hidden border-2 transition-all relative group ${
                            selectedRefIds.includes(ref.id)
                              ? 'border-stc-purple-500 ring-2 ring-stc-purple-200'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                          title={ref.name}
                        >
                          <img
                            src={ref.illustrationUrl || ref.sourcePhotoUrl || ''}
                            alt={ref.name}
                            className="w-full h-full object-cover"
                          />
                          {selectedRefIds.includes(ref.id) && (
                            <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-stc-purple-500 rounded-full flex items-center justify-center">
                              <CheckIcon className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-[9px] text-white truncate">{ref.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="bg-neutral-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase mb-1">Caption preview</p>
                <p className="text-xs text-neutral-600 line-clamp-3">{suggestion.caption}</p>
              </div>

              <button
                onClick={handleAnalyze}
                disabled={!prompt.trim()}
                className="w-full py-3 rounded-xl bg-stc-purple-500 text-white font-semibold text-sm hover:bg-stc-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Generate
              </button>
            </>
          )}

          {state === 'analyzing' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-stc-purple-50 mb-3">
                <ArrowPathIcon className="w-6 h-6 text-stc-purple-500 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-neutral-900">Analyzing prompt...</p>
              <p className="text-xs text-neutral-500 mt-1">Checking for character issues</p>
            </div>
          )}

          {state === 'preflight' && analysis && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <ExclamationTriangleIcon className="w-5 h-5 text-stc-orange" />
                <h3 className="text-sm font-bold text-neutral-900">Pre-flight Check</h3>
              </div>

              {/* Characters detected */}
              {analysis.characters.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-2">Characters Detected</label>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.characters.map((char, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                          char.isChesslandia
                            ? 'bg-stc-green/10 text-stc-green border border-stc-green/20'
                            : 'bg-stc-pink/10 text-stc-pink border border-stc-pink/20'
                        }`}
                      >
                        {char.isChesslandia ? (
                          <CheckIcon className="w-3 h-3" />
                        ) : (
                          <ExclamationTriangleIcon className="w-3 h-3" />
                        )}
                        {char.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {analysis.warnings.length > 0 && (
                <div className="bg-stc-orange/10 border border-stc-orange/20 rounded-xl px-4 py-3">
                  <ul className="space-y-1">
                    {analysis.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-neutral-700 flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">&#x26A0;</span>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions */}
              {analysis.questions.length > 0 && (
                <div className="bg-stc-blue/10 border border-stc-blue/20 rounded-xl px-4 py-3">
                  <ul className="space-y-1.5">
                    {analysis.questions.map((q, i) => (
                      <li key={i} className="text-xs text-stc-navy flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0">?</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested prompt */}
              {analysis.suggestedPrompt && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase mb-1.5">Suggested Prompt</label>
                  <div className="bg-stc-green/10 border border-stc-green/20 rounded-xl px-4 py-3">
                    <p className="text-xs text-stc-green mb-2">{analysis.suggestedPrompt}</p>
                    <button
                      onClick={() => {
                        setPrompt(analysis.suggestedPrompt!);
                        setAnalysis(null);
                        setState('idle');
                      }}
                      className="text-xs font-semibold text-stc-green hover:text-stc-green/80 underline"
                    >
                      Use this prompt
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setAnalysis(null); setState('idle'); }}
                  className="flex-1 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold text-neutral-600 hover:bg-neutral-50 transition-colors"
                >
                  Edit Prompt
                </button>
                <button
                  onClick={() => { setAnalysis(null); doGenerate(); }}
                  className="flex-1 py-2.5 rounded-xl bg-stc-purple-500 text-white text-sm font-semibold hover:bg-stc-purple-600 transition-colors"
                >
                  Generate Anyway
                </button>
              </div>
            </div>
          )}

          {state === 'generating' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-stc-purple-50 mb-4">
                <ArrowPathIcon className="w-8 h-8 text-stc-purple-500 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-neutral-900">
                Generating...
              </p>
              <p className="text-xs text-neutral-500 mt-1">
                Usually takes ~10 seconds
              </p>
            </div>
          )}

          {state === 'results' && (
            <div>
              <p className="text-sm font-semibold text-neutral-900 mb-3">
                {generations.length > 1 ? 'Select your favorite' : 'Generation complete'}
              </p>
              {generations.length > 1 ? (
                <div className="grid grid-cols-3 gap-3">
                  {generations.map(gen => (
                    <button
                      key={gen.id}
                      onClick={() => handleSelect(gen.id)}
                      className="aspect-square rounded-xl overflow-hidden border-2 border-neutral-200 hover:border-stc-purple-500 hover:ring-2 hover:ring-stc-purple-200 transition-all"
                    >
                      <img
                        src={gen.savedImageUrl || gen.outputImageUrl || ''}
                        alt="Generated variant"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center">
                  {generations[0] && (
                    <img
                      src={generations[0].savedImageUrl || generations[0].outputImageUrl || ''}
                      alt="Generated image"
                      className="max-h-80 mx-auto rounded-xl border border-neutral-200 mb-4"
                    />
                  )}
                  <button
                    onClick={handleUseSingle}
                    className="px-6 py-3 rounded-xl bg-stc-purple-500 text-white font-semibold text-sm hover:bg-stc-purple-600 transition-colors"
                  >
                    Use This Image
                  </button>
                </div>
              )}
              <button
                onClick={() => { setState('idle'); setGenerations([]); setError(null); }}
                className="w-full mt-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 font-medium"
              >
                Regenerate
              </button>
            </div>
          )}

          {state === 'saving' && (
            <div className="text-center py-8">
              <p className="text-sm text-neutral-500">Saving selection...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
