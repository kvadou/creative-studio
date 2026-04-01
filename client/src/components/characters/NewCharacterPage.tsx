import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createCharacter } from '../../lib/api';

export default function NewCharacterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [piece, setPiece] = useState('');
  const [trait, setTrait] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const character = await createCharacter({ name: name.trim(), piece: piece.trim() || undefined, trait: trait.trim() || undefined });
      navigate(`/characters/${character.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create character';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const pieces = ['White King', 'Black King', 'White Queen', 'Black Queen', 'White Rook', 'Black Rook', 'White Bishop', 'Black Bishop', 'White Knight', 'Black Knight', 'White Pawn', 'Black Pawn', 'Other'];

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1.5 text-sm mb-6">
        <Link to="/characters" className="text-neutral-400 hover:text-stc-purple-600 transition-colors font-medium">Characters</Link>
        <span className="text-neutral-300">/</span>
        <span className="text-neutral-700 font-semibold">New Character</span>
      </nav>

      <h1 className="text-2xl font-bold text-stc-navy mb-6">Create Character</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Octavia"
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-200 outline-none transition-colors text-sm"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="piece" className="block text-sm font-medium text-neutral-700 mb-1">Chess Piece</label>
          <select
            id="piece"
            value={piece}
            onChange={e => setPiece(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-200 outline-none transition-colors text-sm bg-white"
          >
            <option value="">Select a piece (optional)</option>
            {pieces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="trait" className="block text-sm font-medium text-neutral-700 mb-1">Defining Trait</label>
          <input
            id="trait"
            type="text"
            value={trait}
            onChange={e => setTrait(e.target.value)}
            placeholder="e.g., Diagonal dancer"
            className="w-full px-4 py-3 rounded-xl border border-neutral-300 focus:border-stc-purple-500 focus:ring-2 focus:ring-stc-purple-200 outline-none transition-colors text-sm"
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-6 py-3 rounded-xl bg-stc-purple-500 text-white font-medium hover:bg-stc-purple-600 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {saving ? 'Creating...' : 'Create Character'}
          </button>
          <Link
            to="/characters"
            className="px-6 py-3 rounded-xl border border-neutral-300 text-neutral-600 font-medium hover:bg-neutral-50 transition-colors min-h-[44px] inline-flex items-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
