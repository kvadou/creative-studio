import { useState, useCallback } from 'react';
import {
  BookOpenIcon,
  UserGroupIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import type { StyleBible, PipelineCharacter } from '../../lib/api';
import { updateStyleBible } from '../../lib/api';

interface StyleBibleEditorProps {
  styleBible: StyleBible | null;
  characters: PipelineCharacter[];
  onSaved: (updated: StyleBible) => void;
}

const DEFAULT_INSTRUCTIONS = `You are generating illustrations for Acme Creative, a children's chess education brand.

WORLD: All scenes take place in CHESSLANDIA — a whimsical fantasy kingdom on a giant chess board.
The landscape features chess-themed architecture, checkered patterns, chess piece-shaped buildings,
and a colorful storybook atmosphere. Think medieval fairy tale meets chess board.

ART STYLE — You MUST match this exactly:
- Bold black outlines around all characters and objects
- Flat, vibrant colors with minimal shading or gradients
- Cartoon proportions — large heads, expressive eyes
- Storybook illustration feel, like a children's picture book
- Clean, vector-style lines
- Warm, inviting color palette

CHARACTERS — These are the ONLY characters that exist in Chesslandia.
Do NOT invent new characters. Do NOT draw realistic humans.
Every character is either a cartoon animal or an anthropomorphized chess piece:

CRITICAL RULES:
1. ONLY draw characters from the list above — never invent new ones
2. Characters are cartoon animals or chess pieces, NOT realistic humans
3. If reference images are provided, match those character designs EXACTLY
4. The setting must feel like Chesslandia — chess-themed fantasy world
5. Match the art style of the reference images precisely`;

export default function StyleBibleEditor({ styleBible, characters, onSaved }: StyleBibleEditorProps) {
  const [instructions, setInstructions] = useState(
    styleBible?.instructions || DEFAULT_INSTRUCTIONS
  );
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const handleChange = useCallback((value: string) => {
    setInstructions(value);
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updated = await updateStyleBible(instructions);
      onSaved(updated);
      setDirty(false);
      setToast('Style bible saved');
      setTimeout(() => setToast(null), 3000);
    } catch {
      setToast('Failed to save — try again');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  }, [instructions, onSaved]);

  // Build full prompt preview (instructions + character roster)
  const fullPrompt = `${instructions}\n\nCHARACTER ROSTER:\n${characters.map(c => {
    const parts = [c.name];
    if (c.piece) parts.push(`(${c.piece})`);
    if (c.trait) parts.push(`— ${c.trait}`);
    return `  - ${parts.join(' ')}`;
  }).join('\n')}`;

  return (
    <div>
      <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
        <BookOpenIcon className="h-5 w-5 text-stc-purple-500" />
        Style Bible
      </h2>

      {/* Character Registry */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3 flex items-center gap-1.5">
          <UserGroupIcon className="h-4 w-4 text-stc-purple-400" />
          Character Registry ({characters.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Name</th>
                <th className="text-left py-2 pr-4 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Piece</th>
                <th className="text-left py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Trait</th>
              </tr>
            </thead>
            <tbody>
              {characters.map((char) => (
                <tr key={char.id} className="border-b border-neutral-50 last:border-0">
                  <td className="py-2 pr-4 font-medium"><a href={`/characters/${char.id}`} className="text-stc-purple-600 hover:text-stc-purple-800 hover:underline">{char.name}</a></td>
                  <td className="py-2 pr-4 text-neutral-600">{char.piece || '—'}</td>
                  <td className="py-2 text-neutral-600">{char.trait || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-400 mt-3">
          Edit characters from the <a href="/characters" className="text-stc-purple-500 hover:underline">Characters page</a>
        </p>
      </div>

      {/* Style Instructions */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <h3 className="text-sm font-semibold text-neutral-700 mb-3">
          Art Direction Instructions
        </h3>
        <textarea
          value={instructions}
          onChange={(e) => handleChange(e.target.value)}
          rows={24}
          className="w-full rounded-xl border border-neutral-200 p-4 text-sm text-neutral-700 font-mono
                     focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-100 focus:outline-none
                     resize-y min-h-[400px]"
          placeholder="Enter style bible instructions..."
        />

        {styleBible?.updatedAt && (
          <p className="text-xs text-neutral-400 mt-2">
            Last updated {new Date(styleBible.updatedAt).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
            {styleBible.updatedBy && ` by ${styleBible.updatedBy}`}
          </p>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="px-5 py-2.5 bg-stc-purple-500 text-white text-sm font-semibold rounded-[10px]
                       hover:bg-stc-purple-600 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors duration-200 min-h-[44px]"
          >
            {saving ? 'Saving...' : 'Save Instructions'}
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded-[10px]
                       hover:bg-neutral-200 transition-colors duration-200 min-h-[44px]"
          >
            Preview Full Prompt
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(instructions);
              setToast('Copied to clipboard — paste into Google Docs');
              setTimeout(() => setToast(null), 3000);
            }}
            className="px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded-[10px]
                       hover:bg-neutral-200 transition-colors duration-200 min-h-[44px] flex items-center gap-2"
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
            Copy to Clipboard
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50 animate-fade-in">
          {toast}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPreview(false)}>
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-semibold text-neutral-900">Full Prompt Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors"
                aria-label="Close preview"
              >
                <XMarkIcon className="h-5 w-5 text-neutral-400" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-mono leading-relaxed">
                {fullPrompt}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
