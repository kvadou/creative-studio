// BRAND Brand tokens for Remotion compositions
export const BRAND_BRAND = {
  colors: {
    primary: '#6A469D',       // BRAND Purple
    primaryDark: '#4A2D7A',   // Purple gradient end
    cyan: '#50C8DF',          // Accent cyan
    green: '#34B256',         // Success green
    yellow: '#FACC29',        // Highlight yellow
    pink: '#F472B6',          // Accent pink
    background: '#E8FBFF',    // Light background
    dark: '#1a1a2e',          // Dark text
    white: '#FFFFFF',
  },
  fonts: {
    primary: 'Poppins',
  },
  logo: {
    path: 'client/public/logo.png',
  },
} as const;

// Standard video dimensions
export const DIMENSIONS = {
  landscape: { width: 1920, height: 1080 },   // 16:9
  portrait: { width: 1080, height: 1920 },     // 9:16
  square: { width: 1080, height: 1080 },       // 1:1
} as const;

// Standard frame rates and durations
export const TIMING = {
  fps: 30,
  durations: {
    bumper: 3 * 30,           // 3 seconds in frames
    sceneShort: 4 * 30,       // 4 seconds
    sceneMedium: 6 * 30,      // 6 seconds
    sceneLong: 10 * 30,       // 10 seconds
    transition: 15,           // 0.5 seconds
  },
} as const;
