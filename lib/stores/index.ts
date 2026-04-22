/**
 * Zustand Stores - Centralized state management
 * 
 * Usage:
 * ```typescript
 * import { useStellariumStore, useSettingsStore } from '@/lib/stores';
 * ```
 */

// Core stores
export { useStellariumStore } from './stellarium-store';
export {
  useStarmapBootstrapStore,
  type StarmapBootstrapResourceRuntime,
  type StarmapBootstrapDiagnostic,
} from './starmap-bootstrap-store';
export {
  useSettingsStore,
  type PrecisionMode,
  type EopUpdatePolicy,
  type MobileFeaturePreferences,
} from './settings-store';
export { useSettingsSessionStore } from './settings-session-store';
export { useSettingsImportRestoreStore } from './settings-import-restore-store';
export { useAutostartStore } from './autostart-store';
export { useFramingStore } from './framing-store';
export { useMountStore } from './mount-store';
export {
  useMapInteractionStore,
  buildContinuityTargetSummary,
  buildContinuityActions,
  type MapInteractionAction,
  type MapInteractionCoordinates,
  type MapInteractionSiteContext,
  type MapInteractionSummaryStatus,
  type MapInteractionSourceSurface,
  type MapInteractionTargetSummary,
} from './map-interaction-store';

// Target and marker stores
export { 
  useTargetListStore, 
  type TargetItem,
  type TargetInput,
  type ObservableWindow,
} from './target-list-store';

export { 
  useMarkerStore, 
  type SkyMarker, 
  type MarkerIcon, 
  type MarkerInput,
  type MarkerSortBy,
  type PendingMarkerCoords, 
  MARKER_COLORS, 
  MARKER_ICONS,
  MAX_MARKERS,
} from './marker-store';

// Satellite store
export { 
  useSatelliteStore, 
  type TrackedSatellite 
} from './satellite-store';

// Aladin layers/configuration store
export {
  useAladinStore,
  type AladinCatalogLayer,
  type AladinImageOverlayLayer,
  type AladinMOCLayer,
  type AladinFitsLayer,
  type CatalogSourceType,
  type AladinFitsMode,
} from './aladin-store';

// Equipment store with presets and helpers
export {
  useEquipmentStore,
  BUILTIN_CAMERA_PRESETS,
  BUILTIN_TELESCOPE_PRESETS,
  getAllCameras,
  getAllTelescopes,
  findCameraById,
  findTelescopeById,
  type CameraPreset,
  type TelescopePreset,
  type MosaicSettings,
  type GridType,
  type BinningType,
  type TrackingType,
  type TargetType,
  type FOVDisplaySettings,
  type FOVSetup,
  type FOVSimulatorTab,
  type OcularDisplaySettings,
  type ExposureDefaults,
} from './equipment-store';

// Device orchestration store
export {
  useDeviceStore,
  PRIMARY_MOUNT_DEVICE_PROFILE_ID,
  type DeviceStoreState,
  type DeviceProfileDraftInput,
  type DeviceEquipmentSnapshot,
  type DeviceMountSnapshot,
} from './device-store';

// Onboarding store (unified: setup wizard + feature tour)
export {
  useOnboardingStore,
  TOUR_STEPS,
  SETUP_WIZARD_STEPS,
  type TourStep,
  type SetupWizardStep,
} from './onboarding-store';

// Onboarding bridge store (cross-component guide actions)
export { useOnboardingBridgeStore } from './onboarding-bridge-store';

// CLI bridge store (cross-component desktop CLI actions)
export { useCliBridgeStore } from './cli-bridge-store';

// @deprecated - Use useOnboardingStore instead
export {
  useSetupWizardStore,
} from './setup-wizard-store';

// Theme customization store
export {
  useThemeStore,
  themePresets,
  type ThemeColors,
  type ThemePreset,
  type ThemeCustomization,
} from './theme-store';

// Favorites store
export {
  useFavoritesStore,
  FAVORITE_TAGS,
  type FavoriteObject,
  type FavoriteTag,
} from './favorites-store';

// Bookmarks store
export {
  useBookmarksStore,
  BOOKMARK_ICONS,
  BOOKMARK_COLORS,
  DEFAULT_BOOKMARKS,
  type ViewBookmark,
  type BookmarkIcon,
} from './bookmarks-store';

// Keybinding store
export {
  useKeybindingStore,
  DEFAULT_KEYBINDINGS,
  formatKeyBinding,
  eventToKeyBinding,
  type KeyBinding,
  type ShortcutActionId,
} from './keybinding-store';

// Global shortcut store (desktop)
export {
  useGlobalShortcutStore,
  DEFAULT_GLOBAL_SHORTCUT_ENABLED,
  DEFAULT_GLOBAL_SHORTCUT_BINDINGS,
  validateGlobalShortcutAccelerator,
  normalizeGlobalShortcutAccelerator,
  acceleratorsEqual,
  keyBindingToAccelerator,
  eventToGlobalShortcutAccelerator,
  formatGlobalShortcutAccelerator,
  findConflictWithLocalKeybindings,
  type GlobalShortcutActionId,
  type GlobalShortcutValidationResult,
  type GlobalShortcutBindingUpdateResult,
} from './global-shortcut-store';

// Search store (online/offline, favorites, cache)
export {
  useSearchStore,
  selectSearchSettings,
  selectFavorites,
  selectRecentSearches,
  selectSearchMode,
  selectOnlineStatus,
  favoriteToSearchResult,
  getAllFavoriteTags,
  type SearchFavorite,
  type RecentSearch,
  type SearchSourceConfig,
  type SearchMode as OnlineSearchMode,
  type SearchSettings,
} from './search-store';

// Event sources store
export {
  useEventSourcesStore,
  type EventSourceConfig,
} from './event-sources-store';

// Planning UI bridge store
export { usePlanningUiStore } from './planning-ui-store';
export { useMessierMarathonStore } from './messier-marathon-store';
export {
  useStarmapMobileUiStore,
  type StarmapMobilePanelId,
} from './starmap-mobile-ui-store';

// Session plan store
export {
  useSessionPlanStore,
  type PlannedSessionExecution,
  type PlannedSessionExecutionTarget,
  type SavedSessionPlan,
  type SavedScheduledTarget,
  type SavedSessionTemplate,
} from './session-plan-store';

// Feedback store
export { useFeedbackStore } from './feedback-store';

// Updater store
export {
  useUpdaterStore,
  selectIsChecking,
  selectIsDownloading,
  selectIsReady,
  selectHasUpdate,
  selectUpdateInfo,
  selectProgress,
  selectError,
  type UpdaterState,
  type UpdaterActions,
  type UpdaterStore,
} from './updater-store';

// Daily knowledge store
export { useDailyKnowledgeStore, getLocalDateKey } from './daily-knowledge-store';


// Plate solver store
export {
  usePlateSolverStore,
  selectActiveSolver,
  selectIsLocalSolverAvailable,
  selectCanSolve,
  selectOnlineSession,
  type PlateSolverState,
  type SolveStatus,
} from './plate-solver-store';

