/**
 * FOV (Field of View) constants shared across the application
 * Extracted from components/starmap/canvas/constants.ts for reuse
 */

// FOV limits (degrees)
export const MIN_FOV = 0.5;
export const MAX_FOV = 180;
export const DEFAULT_FOV = 60;

// Smooth-zoom animation durations (seconds, passed to the engine's zoomTo).
// A new zoomTo call retargets the in-flight animation from the current FOV,
// so rapid successive calls stay smooth (last call wins).
export const WHEEL_ZOOM_DURATION = 0.12;
export const BUTTON_ZOOM_DURATION = 0.25;
export const SLIDER_ZOOM_DURATION = 0.05;
// Clear the accumulated wheel-zoom target after this idle period so the next
// gesture starts from the engine's actual FOV.
export const ZOOM_TARGET_RESET_MS = 300;

// Common zoom presets (FOV in degrees)
export const ZOOM_PRESETS = [
  { fov: 90, labelKey: 'wideField' },
  { fov: 60, labelKey: 'normal' },
  { fov: 30, labelKey: 'medium' },
  { fov: 15, labelKey: 'closeUp' },
  { fov: 5, labelKey: 'detail' },
  { fov: 1, labelKey: 'maxZoom' },
] as const;
