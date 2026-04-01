import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getOpenings, type ChessOpening } from '../../lib/api';

interface OpeningSearchProps {
  value: string;
  onChange: (eco: string, opening: ChessOpening | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

// ECO code color coding by category
function getEcoColor(eco: string): string {
  const category = eco.charAt(0);
  switch (category) {
    case 'A': return 'bg-stc-green/15 text-stc-green'; // Flank openings
    case 'B': return 'bg-stc-orange/15 text-stc-orange';   // Semi-open (1.e4, not 1...e5)
    case 'C': return 'bg-stc-blue/15 text-stc-navy';       // Open (1.e4 e5)
    case 'D': return 'bg-stc-purple-100 text-stc-purple-700';   // Closed/Semi-closed (1.d4 d5)
    case 'E': return 'bg-stc-pink/15 text-stc-pink';       // Indian defenses
    default: return 'bg-neutral-100 text-neutral-700';
  }
}

function getEcoCategoryName(eco: string): string {
  const category = eco.charAt(0);
  switch (category) {
    case 'A': return 'Flank Opening';
    case 'B': return 'Semi-Open Game';
    case 'C': return 'Open Game';
    case 'D': return 'Closed Game';
    case 'E': return 'Indian Defense';
    default: return 'Opening';
  }
}

export function OpeningSearch({
  value,
  onChange,
  placeholder = "Search for an opening...",
  disabled = false,
}: OpeningSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allOpenings, setAllOpenings] = useState<ChessOpening[]>([]);
  const [filteredOpenings, setFilteredOpenings] = useState<ChessOpening[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedOpening, setSelectedOpening] = useState<ChessOpening | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all openings on mount
  useEffect(() => {
    async function loadOpenings() {
      try {
        const openings = await getOpenings();
        setAllOpenings(openings);
        // If we have a value, find the selected opening
        if (value) {
          const opening = openings.find(o => o.eco === value);
          if (opening) {
            setSelectedOpening(opening);
            setSearchTerm(opening.name);
          }
        }
      } catch (error) {
        console.error('Failed to load openings:', error);
      } finally {
        setLoading(false);
      }
    }
    loadOpenings();
  }, []);

  // Filter openings based on search term
  const filterOpenings = useCallback((term: string) => {
    if (!term) {
      setFilteredOpenings(allOpenings.slice(0, 15));
      return;
    }
    const lower = term.toLowerCase();
    const filtered = allOpenings.filter(opening =>
      opening.name.toLowerCase().includes(lower) ||
      opening.eco.toLowerCase().includes(lower) ||
      opening.moves.toLowerCase().includes(lower)
    );
    setFilteredOpenings(filtered.slice(0, 15));
  }, [allOpenings]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    filterOpenings(newValue);
    setShowDropdown(true);

    // Clear selection if user edits
    if (selectedOpening) {
      setSelectedOpening(null);
      onChange('', null);
    }
  };

  // Handle opening selection
  const handleSelectOpening = (opening: ChessOpening) => {
    setSearchTerm(opening.name);
    setSelectedOpening(opening);
    onChange(opening.eco, opening);
    setShowDropdown(false);
  };

  // Handle clear
  const handleClear = () => {
    setSearchTerm('');
    setSelectedOpening(null);
    onChange('', null);
    setFilteredOpenings(allOpenings.slice(0, 15));
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize filtered openings when all openings load
  useEffect(() => {
    if (allOpenings.length > 0 && filteredOpenings.length === 0) {
      setFilteredOpenings(allOpenings.slice(0, 15));
    }
  }, [allOpenings]);

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            filterOpenings(searchTerm);
            setShowDropdown(true);
          }}
          placeholder={loading ? "Loading openings..." : placeholder}
          disabled={disabled || loading}
          className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 disabled:bg-neutral-100"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && filteredOpenings.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
        >
          {filteredOpenings.map((opening) => (
            <button
              key={opening.eco}
              type="button"
              onClick={() => handleSelectOpening(opening)}
              className="w-full text-left px-4 py-2 hover:bg-stc-purple-50 border-b border-neutral-100 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${getEcoColor(opening.eco)}`}>
                  {opening.eco}
                </span>
                <span className="font-medium text-sm">{opening.name}</span>
              </div>
              <div className="text-xs text-neutral-500 mt-0.5 font-mono">
                {opening.moves}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Opening Card */}
      {selectedOpening && (
        <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-stc-blue/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${getEcoColor(selectedOpening.eco)}`}>
                  {selectedOpening.eco}
                </span>
                <span className="text-xs text-neutral-500">{getEcoCategoryName(selectedOpening.eco)}</span>
              </div>
              <div className="font-bold text-stc-navy mt-1">{selectedOpening.name}</div>
            </div>
            <span className="text-2xl">♟️</span>
          </div>
          <div className="text-sm font-mono text-stc-navy mt-2 bg-white/50 px-2 py-1 rounded">
            {selectedOpening.moves}
          </div>
          <p className="text-xs text-neutral-600 mt-2">{selectedOpening.description}</p>
        </div>
      )}
    </div>
  );
}

export default OpeningSearch;
