// ============================================================================
// Stellarium Canvas Constants
// ============================================================================

// FOV constants (MIN_FOV, MAX_FOV, DEFAULT_FOV, ZOOM_PRESETS) are in ./fov.ts

// Timeout configurations
export const SCRIPT_LOAD_TIMEOUT = 15000; // 15s for script
export const WASM_INIT_TIMEOUT = 30000;   // 30s for WASM init
export const MAX_RETRY_COUNT = 2;
export const OVERALL_LOADING_TIMEOUT = 45000; // 45s - maximum total time for entire loading flow (incl. retries)

// Resource paths
export const SCRIPT_PATH = '/stellarium-js/stellarium-web-engine.js';
export const WASM_PATH = '/stellarium-js/stellarium-web-engine.wasm';

// Touch/Mouse interaction thresholds
export const LONG_PRESS_DURATION = 500; // ms
export const TOUCH_MOVE_THRESHOLD = 10; // pixels
export const RIGHT_CLICK_THRESHOLD = 5; // pixels - if moved more than this, it's a drag
export const RIGHT_CLICK_TIME_THRESHOLD = 300; // ms - max time for a click
// A pointer that moves further than this after going down on a marker is a
// sky-pan gesture and gets forwarded to the engine canvas.
export const MARKER_DRAG_FORWARD_THRESHOLD = 5; // pixels

// Engine initialization delays
export const ENGINE_FOV_INIT_DELAY = 100;      // ms - delay before setting initial FOV after engine ready
export const ENGINE_SETTINGS_INIT_DELAY = 200;  // ms - delay before applying initial settings after engine ready
export const RETRY_DELAY_MS = 1000;             // ms - delay between auto-retry attempts

// Settings debounce
export const SETTINGS_DEBOUNCE_MS = 50;
