import { useState, useEffect } from 'react';
import { getTacticalThemes, type TacticalTheme } from '../../lib/api';

interface TacticalThemeSelectProps {
  value: string;
  onChange: (themeId: string, theme: TacticalTheme | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'beginner': return 'bg-stc-green/15 text-stc-green';
    case 'intermediate': return 'bg-stc-yellow/15 text-stc-yellow';
    case 'advanced': return 'bg-stc-pink/15 text-stc-pink';
    default: return 'bg-neutral-100 text-neutral-700';
  }
}

export function TacticalThemeSelect({
  value,
  onChange,
  placeholder = "Select a tactical theme...",
  disabled = false,
}: TacticalThemeSelectProps) {
  const [themes, setThemes] = useState<TacticalTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<TacticalTheme | null>(null);
  const [loading, setLoading] = useState(true);

  // Load themes on mount
  useEffect(() => {
    async function loadThemes() {
      try {
        const data = await getTacticalThemes();
        setThemes(data);
        // If we have a value, find the selected theme
        if (value) {
          const theme = data.find(t => t.id === value);
          if (theme) {
            setSelectedTheme(theme);
          }
        }
      } catch (error) {
        console.error('Failed to load tactical themes:', error);
      } finally {
        setLoading(false);
      }
    }
    loadThemes();
  }, []);

  // Handle selection change
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeId = e.target.value;
    if (!themeId) {
      setSelectedTheme(null);
      onChange('', null);
      return;
    }
    const theme = themes.find(t => t.id === themeId);
    if (theme) {
      setSelectedTheme(theme);
      onChange(themeId, theme);
    }
  };

  return (
    <div className="space-y-3">
      {/* Select Dropdown */}
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled || loading}
        className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 disabled:bg-neutral-100 bg-white"
      >
        <option value="">{loading ? "Loading themes..." : placeholder}</option>
        {themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.name}
          </option>
        ))}
      </select>

      {/* Selected Theme Card */}
      {selectedTheme && (
        <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-stc-pink/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-stc-pink">{selectedTheme.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${getDifficultyColor(selectedTheme.difficulty)}`}>
                  {selectedTheme.difficulty}
                </span>
              </div>
              <p className="text-sm text-neutral-600 mt-1">{selectedTheme.description}</p>
            </div>
            <span className="text-2xl">⚔️</span>
          </div>

          {selectedTheme.examples.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium text-stc-pink mb-1">Key patterns:</div>
              <div className="flex flex-wrap gap-1">
                {selectedTheme.examples.map((example, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 bg-stc-pink/15 text-stc-pink rounded-full"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TacticalThemeSelect;
