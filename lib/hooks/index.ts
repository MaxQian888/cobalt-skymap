/**
 * React Hooks - Custom hooks for the application
 * 
 * Usage:
 * ```typescript
 * import { useGeolocation, useObjectSearch } from '@/lib/hooks';
 * ```
 */

// Device and location hooks
export { 
  useGeolocation,
  getLocationWithFallback,
  type GeolocationState,
  type UseGeolocationOptions,
  type UseGeolocationReturn,
} from './use-geolocation';

export { useOrientation } from './use-orientation';

export { 
  useDeviceOrientation,
  type DeviceOrientation,
  type SkyDirection,
  type SensorStatus,
  type OrientationSource,
  type SensorCalibrationState,
  type CalibrationReference,
} from './use-device-orientation';

export { useCacheInit, type CacheStartupStageEvent } from './use-cache-init';

// Search and object hooks
export { 
  useObjectSearch,
  getDetailedMatch,
  type ObjectType,
  type SortOption,
  type SearchMode,
} from './use-object-search';


export { 
  useCelestialName,
  useCelestialNames,
  useCelestialNameWithOriginal,
  useSkyCultureLanguage,
  getCelestialNameTranslation,
} from './use-celestial-name';

// Planning hooks
export { 
  useTonightRecommendations,
  type RecommendedTarget,
  type TonightConditions,
  type TwilightInfo,
} from './use-tonight-recommendations';

export { 
  useTargetPlanner,
  type TargetVisibility,
  type SessionPlan,
  type SessionConflict,
  type TargetScheduleSlot,
} from './use-target-planner';

// HTTP client hook (Tauri integration)
export {
  useHttpClient,
  useFetch,
  type UseHttpClientOptions,
  type UseHttpClientReturn,
  type HttpRequestState,
} from './use-http-client';

// Animation and performance hooks
export {
  useAnimationFrame,
  useThrottledUpdate,
  useGlobalAnimationLoop,
  globalAnimationLoop,
  AnimationLoopManager,
  type AnimationFrameOptions,
} from './use-animation-frame';

// Coordinate projection hooks (for overlays)
export {
  useCoordinateProjection,
  useBatchProjection,
  createCoordinateProjector,
  type ScreenPosition,
  type CelestialCoordinate,
  type ProjectedItem,
  type UseCoordinateProjectionOptions,
  type UseCoordinateProjectionReturn,
  type UseBatchProjectionOptions,
} from './use-coordinate-projection';

// Keyboard shortcuts
export {
  useKeyboardShortcuts,
  formatShortcut,
  STARMAP_SHORTCUT_KEYS,
  type KeyboardShortcut,
  type UseKeyboardShortcutsOptions,
} from './use-keyboard-shortcuts';

// Navigation history
export {
  useNavigationHistory,
  useNavigationHistoryStore,
  formatNavigationPoint,
  formatTimestamp,
  type NavigationPoint,
} from './use-navigation-history';

// Window state management (Tauri desktop)
export { useWindowState } from './use-window-state';

// Window controls (Tauri + web)
export {
  useWindowControls,
  type WindowControlsState,
  type WindowControlsActions,
  type UseWindowControlsReturn,
} from './use-window-controls';

// Client-side detection
export { useIsClient } from './use-is-client';

// System stats (FPS, online status, memory)
export {
  useSystemStats,
  type UseSystemStatsReturn,
} from './use-system-stats';

// Night mode CSS effect
export { useNightModeEffect } from './use-night-mode';

// Accessibility
export { usePrefersReducedMotion } from './use-prefers-reduced-motion';

// UI positioning
export {
  useAdaptivePosition,
  type AdaptivePositionOptions,
} from './use-adaptive-position';

// Target selection (shared between search components)
export { useSelectTarget } from './use-select-target';

// Target list actions (shared add/batch-add logic)
export { useTargetListActions } from './use-target-list-actions';

// Object actions (shared slew/add-to-list for InfoPanel & ObjectDetailDrawer)
export {
  useObjectActions,
  type UseObjectActionsOptions,
  type UseObjectActionsReturn,
} from './use-object-actions';

// Observing conditions
export {
  useObservingConditions,
  type UseObservingConditionsOptions,
} from './use-observing-conditions';

// Time controls (Stellarium engine)
export {
  useTimeControls,
  type TimeControlActions,
} from './use-time-controls';

// Landing page hooks
export {
  useCarousel,
  type UseCarouselOptions,
  type UseCarouselReturn,
} from './use-carousel';

export { useStarField } from './use-star-field';

export { useInView } from './use-in-view';

// Mount overlay
export {
  useMountOverlay,
  type UseMountOverlayReturn,
} from './use-mount-overlay';

export { useMountOperations } from './use-mount-operations';

// Object astronomical data (shared by InfoPanel & ObjectDetailDrawer)
export {
  useAstroEnvironment,
  useTargetAstroData,
  type AstroEnvironmentData,
  type TargetAstroData,
  type ObjectAstroDataV2,
} from './use-object-astro-data';

// JPL Horizons high-precision ephemeris hook
export {
  useHorizonsEphemeris,
  type HorizonsEphemerisState,
} from './use-horizons-ephemeris';

// Camera capture hook
export {
  useCamera,
  CAMERA_RESOLUTIONS,
  type FacingMode,
  type CameraErrorType,
  type CameraDevice,
  type CameraCapabilities,
  type CameraResolution,
  type UseCameraOptions,
  type UseCameraReturn,
} from './use-camera';

// Onboarding tour hooks
export { useTourPosition } from './use-tour-position';
export { useFocusTrap } from './use-focus-trap';

// Stellarium canvas hooks
export {
  useClickCoordinates,
  useStellariumZoom,
  useStellariumEvents,
  useObserverSync,
  useSettingsSync,
  useStellariumLoader,
} from './stellarium';
