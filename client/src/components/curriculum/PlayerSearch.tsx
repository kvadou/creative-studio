import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  searchPlayers,
  getPlayerProfile,
  type FamousPlayer,
  type PlayerProfile,
} from '../../lib/api';

interface PlayerSearchProps {
  value: string;
  onChange: (value: string) => void;
  onPlayerSelect?: (profile: PlayerProfile | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Country code to flag emoji mapping
function getCountryFlag(countryCode: string | null): string {
  if (!countryCode) return '';
  // Convert country code to regional indicator symbols
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return '';
  const offset = 127397;
  return String.fromCodePoint(...[...code].map(c => c.charCodeAt(0) + offset));
}

// Title badge colors
function getTitleColor(title: string | null): string {
  if (!title) return '';
  switch (title) {
    case 'GM': return 'bg-stc-yellow text-white';
    case 'IM': return 'bg-stc-yellow text-neutral-900';
    case 'FM': return 'bg-stc-yellow text-neutral-900';
    case 'CM':
    case 'NM': return 'bg-neutral-400 text-white';
    case 'WGM': return 'bg-stc-pink text-white';
    case 'WIM': return 'bg-stc-pink/80 text-white';
    case 'WFM': return 'bg-stc-pink/40 text-neutral-900';
    default: return 'bg-neutral-300 text-neutral-900';
  }
}

export function PlayerSearch({
  value,
  onChange,
  onPlayerSelect,
  placeholder = "Search for a chess player...",
  disabled = false,
}: PlayerSearchProps) {
  const [searchTerm, setSearchTerm] = useState(value);
  const [results, setResults] = useState<FamousPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PlayerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  const performSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const players = await searchPlayers(term);
      setResults(players);
      setShowDropdown(players.length > 0);
    } catch (error) {
      console.error('Player search error:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);

    // Clear previous selection if user starts typing again
    if (selectedProfile) {
      setSelectedProfile(null);
      onPlayerSelect?.(null);
    }

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(newValue);
    }, 300);
  };

  // Handle player selection
  const handleSelectPlayer = async (player: FamousPlayer) => {
    setSearchTerm(player.name);
    onChange(player.name);
    setShowDropdown(false);
    setResults([]);

    // Fetch full profile
    setLoadingProfile(true);
    try {
      const profile = await getPlayerProfile(player.id);
      setSelectedProfile(profile);
      onPlayerSelect?.(profile);
    } catch (error) {
      console.error('Failed to fetch player profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Clear selection
  const handleClear = () => {
    setSearchTerm('');
    onChange('');
    setSelectedProfile(null);
    onPlayerSelect?.(null);
    setResults([]);
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

  // Sync external value changes
  useEffect(() => {
    if (value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 disabled:bg-neutral-100"
        />
        {/* Clear button or spinner */}
        {(searchTerm || isSearching) && (
          <button
            type="button"
            onClick={handleClear}
            disabled={isSearching || disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
          >
            {isSearching ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              <XMarkIcon className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {results.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => handleSelectPlayer(player)}
              className="w-full text-left px-4 py-2 hover:bg-stc-purple-50 flex items-center gap-2"
            >
              {player.title && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${getTitleColor(player.title)}`}>
                  {player.title}
                </span>
              )}
              <span className="font-medium">{player.name}</span>
              {player.country && (
                <span className="text-base">{getCountryFlag(player.country)}</span>
              )}
              {player.worldChampion && (
                <span className="ml-auto text-xs px-1.5 py-0.5 bg-stc-orange/15 text-stc-orange rounded font-medium">
                  World Champion
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Selected Player Card */}
      {(selectedProfile || loadingProfile) && (
        <div className="mt-3 p-4 bg-gradient-to-r from-stc-purple-50 to-stc-purple-100 rounded-lg border border-stc-purple-200">
          {loadingProfile ? (
            <div className="flex items-center gap-2 text-stc-purple-600">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span>Loading player profile...</span>
            </div>
          ) : selectedProfile && (
            <div className="space-y-2">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedProfile.title && (
                  <span className={`text-sm font-bold px-2 py-0.5 rounded ${getTitleColor(selectedProfile.title)}`}>
                    {selectedProfile.title}
                  </span>
                )}
                <span className="font-bold text-lg text-stc-purple-800">
                  {selectedProfile.name}
                </span>
                {selectedProfile.country && (
                  <span className="text-lg">{getCountryFlag(selectedProfile.country)}</span>
                )}
                {selectedProfile.worldChampion && (
                  <span className="text-xs px-2 py-0.5 bg-stc-orange/15 text-stc-orange rounded font-medium">
                    World Champion
                  </span>
                )}
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-3 text-sm">
                {selectedProfile.years && (
                  <span className="text-neutral-600">
                    <span className="font-medium">Years:</span> {selectedProfile.years}
                  </span>
                )}
                {selectedProfile.fideRating && (
                  <span className="text-neutral-700">
                    <span className="font-medium">Peak Rating:</span> {selectedProfile.fideRating}
                  </span>
                )}
                {selectedProfile.style && (
                  <span className="text-neutral-600">
                    <span className="font-medium">Style:</span> {selectedProfile.style}
                  </span>
                )}
              </div>

              {/* Bio */}
              {selectedProfile.bio && (
                <p className="text-sm text-neutral-600">{selectedProfile.bio}</p>
              )}

              {/* Teaching Focus */}
              {selectedProfile.teachingFocus && selectedProfile.teachingFocus.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs font-medium text-neutral-500">Teaching focus:</span>
                  {selectedProfile.teachingFocus.map((focus, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-white text-stc-purple-700 rounded border border-stc-purple-200">
                      {focus}
                    </span>
                  ))}
                </div>
              )}

              {/* Prompt hint */}
              <p className="text-xs text-stc-purple-600 italic mt-2">
                This lesson will feature {selectedProfile.name}'s approach to the chess concept.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayerSearch;
