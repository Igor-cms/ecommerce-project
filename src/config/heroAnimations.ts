export const ANIMATION_DURATIONS = {
  panel: 600,
  wholesale: 300,
  modal: 300,
} as const;

export const ANIMATION_EASING = 'ease-in-out';

// Base clip paths for diagonal split
export const BASE_CLIP_PATHS = {
  legendary: 'polygon(0 0, 100% 0, 0 100%)', // Top-left triangle (cream)
  everyday: 'polygon(100% 0, 0% 100%, 100% 100%)' // Bottom-right triangle (pink)
} as const;

// Rotation angles for each mode
export const ROTATION_ANGLES = {
  entering: {
    legendary: -180, // Start rotated off-screen from left
    everyday: -90   // Start rotated off-screen from right  
  },
  idle: {
    legendary: 0,
    everyday: 0
  },
  legendary: {
    legendary: 0, // Cream stays put
    everyday: -90 // Pink rotates counter-clockwise to reveal cream
  },
  everyday: {
    legendary: -180, // Cream rotates counter-clockwise to reveal pink
    everyday: 0 // Pink stays put
  },
  wholesale: {
    legendary: 14, // Cream rotates clockwise to open seam
    everyday: -14 // Pink rotates counter-clockwise to open seam
  }
} as const;

// Transform origins for rotation pivots
export const TRANSFORM_ORIGINS = {
  legendary: 'left bottom', // Cream rotator pinned at bottom-left
  everyday: 'right top'     // Pink rotator pinned at top-right
} as const;

export type HeroMode = 'entering' | 'idle' | 'legendary' | 'everyday' | 'wholesale';