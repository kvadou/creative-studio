import { interpolate, useCurrentFrame } from 'remotion';

// Reusable animation helpers for video compositions

/** Fade in from 0 to 1 opacity over a given number of frames */
export function useFadeIn(startFrame: number, durationFrames: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Slide up from offset to 0 over a given number of frames */
export function useSlideUp(startFrame: number, durationFrames: number = 20, distance: number = 50) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Scale from 0.8 to 1.0 for a subtle pop-in effect */
export function useScaleIn(startFrame: number, durationFrames: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + durationFrames], [0.8, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

/** Typewriter effect — returns how many characters to show */
export function useTypewriter(startFrame: number, text: string, charsPerFrame: number = 0.5) {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  return Math.min(Math.floor(elapsed * charsPerFrame), text.length);
}
