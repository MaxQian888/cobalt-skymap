/**
 * Stellarium Web Engine type definitions
 */

// ============================================================================
// Engine Types
// ============================================================================

export interface StellariumEngine {
  core: StellariumCore;
  observer: StellariumObserver;
  D2R: number;
  R2D: number;
  on?: (eventName: 'click' | 'rectSelection', callback: (event: unknown) => void) => void;
  onValueChanged?: (callback: (path: string, value: unknown) => void) => void;
  getObj: (name: string) => StellariumObject | null;
  createObj: (type: string, options: Record<string, unknown>) => StellariumObject;
  createLayer: (options: { id: string; z: number; visible: boolean }) => StellariumLayer;
  convertFrame: (observer: StellariumObserver, from: string, to: string, vec: number[]) => number[];
  c2s: (vec: number[]) => number[];
  s2c: (ra: number, dec: number) => number[];
  anp: (angle: number) => number;
  anpm: (angle: number) => number;
  pointAndLock: (obj: StellariumObject, duration?: number) => void;
  zoomTo: (fov: number, duration?: number) => void;
  lookAt: (pos: number[], duration?: number) => void;
  change: (callback: (obj: unknown, attr: string) => void) => void;
  setFont?: (face: 'regular' | 'bold', url: string) => Promise<void>;
  calendar?: (args: {
    start: Date;
    end: Date;
    onEvent: (event: unknown) => void;
    iterator?: boolean;
  }) => unknown;
  /**
   * Cobalt Skymap glue extension: setting this stops the instance's render loop on the
   * next frame. Engine instances cannot be truly disposed (the WASM runtime has
   * no teardown), so this is how stale/replaced instances are neutralized.
   */
  __skymapDestroyed?: boolean;
  /** Cobalt Skymap glue extension: overrides window.devicePixelRatio in the render loop
   *  so the render-quality DPR cap actually applies to the drawing buffer. */
  __skymapDpr?: number;
}

export interface StellariumHipsModule {
  visible: boolean;
  url: string;
  addDataSource?: (options: { url: string; key?: string }) => void;
}

export interface StellariumSatellitesModule {
  visible?: boolean;
  hints_visible?: boolean;
  addDataSource?: (options: { url: string; key?: string }) => void;
}

export interface StellariumCore {
  observer: StellariumObserver;
  selection: StellariumObject | null;
  time_speed: number;
  fov: number;

  // Core rendering properties exposed by engine core_klass
  projection: number;
  star_linear_scale: number;
  star_relative_scale: number;
  bortle_index: number;
  display_limit_mag: number;
  exposure_scale: number;
  tonemapper_p: number;
  flip_view_vertical: boolean;
  flip_view_horizontal: boolean;
  mount_frame: number;
  y_offset: number;

  // Modules
  stars: StellariumHintsModule;
  skycultures: StellariumDataModule;
  dsos: StellariumHintsModule;
  dss: StellariumDataModule;
  hips: StellariumHipsModule;
  milkyway: StellariumDataModule;
  minor_planets: StellariumDataModule;
  satellites?: StellariumSatellitesModule;
  planets: StellariumHintsModule;
  comets: StellariumCometsModule;
  landscapes: StellariumLandscapeModule;
  constellations: {
    lines_visible: boolean;
    labels_visible: boolean;
    images_visible?: boolean;
    boundaries_visible?: boolean;
  };
  lines: {
    azimuthal: { visible: boolean };
    equatorial: { visible: boolean };
    equatorial_jnow?: { visible: boolean };
    meridian: { visible: boolean };
    ecliptic: { visible: boolean };
    horizon?: { visible: boolean };
    galactic?: { visible: boolean };
  };
  atmosphere: { visible: boolean };
}

export interface StellariumObserver {
  latitude: number;
  longitude: number;
  elevation: number;
  utc: number;
  azalt: number[];
}

export interface StellariumObject {
  designations: () => string[];
  getInfo: (key: string, observer?: StellariumObserver) => unknown;
  pos: number[];
  color: number[];
  border_color?: number[];
  size: number[];
  frame?: string;
  label?: string;
  update: () => void;
}

export interface StellariumLayer {
  add: (obj: StellariumObject) => void;
}

export interface StellariumDataModule {
  visible?: boolean;
  addDataSource: (options: { url: string; key?: string }) => void;
}

export interface StellariumHintsModule extends StellariumDataModule {
  hints_visible?: boolean;
  hints_mag_offset?: number;
}

export interface StellariumLandscapeModule extends StellariumDataModule {
  fog_visible?: boolean;
}

export interface StellariumCometsModule extends StellariumDataModule {
  listObjs?: (observer: StellariumObserver, limit: number, filter: () => boolean) => StellariumObject[];
}

// ============================================================================
// Settings Types
// ============================================================================

export type SkyCultureLanguage = 'native' | 'en' | 'zh';
export type ARCameraPreset = 'balanced' | 'performance' | 'quality';
export type ARCameraResolutionTier = 'auto' | '720p' | '1080p' | '4k';
export type ARCameraFacingMode = 'user' | 'environment';
export type ARCameraAcquisitionStage =
  | 'remembered-device'
  | 'preferred-device'
  | 'requested-facing-mode'
  | 'requested-facing-mode-safe'
  | 'fallback-facing-mode-safe'
  | 'safe-default';

export interface ARCameraPreferredDevice {
  deviceId: string | null;
  label: string | null;
  groupId: string | null;
}

export interface ARCameraLastKnownGoodAcquisition {
  deviceId: string | null;
  label: string | null;
  groupId: string | null;
  facingMode: ARCameraFacingMode;
  stage: ARCameraAcquisitionStage | null;
  updatedAt: number | null;
}

export interface ARAdaptiveLearnerState {
  version: number;
  acceptedRecommendations: number;
  rejectedRecommendations: number;
  repeatedManualAdjustmentCount: number;
  lastRecommendationAt: number | null;
  lastAcceptedAt: number | null;
  preferredProfileOverrides: Partial<{
    resolutionTier: ARCameraResolutionTier;
    targetFps: number;
    stabilizationStrength: number;
    sensorSmoothingFactor: number;
    calibrationSensitivity: number;
  }>;
  // Aggregate tuning signal only; payload MUST exclude raw media.
  aggregateSignals: {
    averageSessionFps: number;
    averageRecoveryActionsPerSession: number;
  };
}

export type StellariumProjection =
  | 'stereographic'
  | 'equal-area'
  | 'perspective'
  | 'fisheye'
  | 'hammer'
  | 'cylinder'
  | 'mercator'
  | 'orthographic'
  | 'sinusoidal'
  | 'miller';

export const PROJECTION_VALUES: Record<StellariumProjection, number> = {
  'stereographic': 1,
  'equal-area': 2,
  'perspective': 0,
  'fisheye': 3,
  'hammer': 4,
  'cylinder': 5,
  'mercator': 7,
  'orthographic': 8,
  'sinusoidal': 9,
  'miller': 10,
};

export interface StellariumSettings {
  constellationsLinesVisible: boolean;
  constellationArtVisible: boolean;
  constellationLabelsVisible: boolean;
  constellationBoundariesVisible: boolean;
  starLabelsVisible: boolean;
  planetLabelsVisible: boolean;
  azimuthalLinesVisible: boolean;
  equatorialLinesVisible: boolean;
  equatorialJnowLinesVisible: boolean;
  meridianLinesVisible: boolean;
  eclipticLinesVisible: boolean;
  horizonLinesVisible: boolean;
  galacticLinesVisible: boolean;
  atmosphereVisible: boolean;
  landscapesVisible: boolean;
  dsosVisible: boolean;
  milkyWayVisible: boolean;
  /** Render satellites from bundled TLE data (engine `core.satellites`). */
  satellitesVisible: boolean;
  fogVisible: boolean;
  surveyEnabled: boolean;
  surveyId: string;
  surveyUrl?: string;
  /** Active sky culture id (constellation set), e.g. 'western', 'chinese'. */
  skyCulture: string;
  skyCultureLanguage: SkyCultureLanguage;
  nightMode: boolean;
  sensorControl: boolean;
  sensorAbsolutePreferred: boolean;
  sensorUseCompassHeading: boolean;
  sensorUpdateHz: number;
  sensorDeadbandDeg: number;
  sensorSmoothingFactor: number;
  sensorCalibrationRequired: boolean;
  sensorCalibrationAzimuthOffsetDeg: number;
  sensorCalibrationAltitudeOffsetDeg: number;
  sensorCalibrationUpdatedAt: number | null;
  arMode: boolean;
  arOpacity: number;
  arShowCompass: boolean;
  arCameraPreset?: ARCameraPreset;
  arCameraFacingMode?: ARCameraFacingMode;
  arCameraResolutionTier?: ARCameraResolutionTier;
  arCameraTargetFps?: number;
  arCameraStabilizationStrength?: number;
  arCameraCalibrationSensitivity?: number;
  arCameraZoomLevel?: number;
  arCameraTorchPreferred?: boolean;
  arCameraPreferredDevice?: ARCameraPreferredDevice;
  arCameraLastKnownGoodAcquisition?: ARCameraLastKnownGoodAcquisition;
  arAdaptiveLearningEnabled?: boolean;
  arAdaptiveAutoApply?: boolean;
  arAdaptiveLearnerState?: ARAdaptiveLearnerState;
  arNetworkOptimizationEnabled?: boolean;
  arTelemetryOptIn?: boolean;
  arRemotePackVersion?: string | null;
  arRemotePackUpdatedAt?: number | null;
  crosshairVisible: boolean;
  crosshairColor: string;

  // Engine core rendering settings
  projectionType: StellariumProjection;
  bortleIndex: number;
  starLinearScale: number;
  starRelativeScale: number;
  displayLimitMag: number;
  flipViewVertical: boolean;
  flipViewHorizontal: boolean;
  exposureScale: number;
  tonemapperP: number;
  mountFrame: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  viewYOffset: number;
}

// ============================================================================
// Aladin Display Settings
// ============================================================================

export type AladinCooFrameSetting = 'ICRSd' | 'galactic';

export type AladinColormap =
  | 'native'
  | 'grayscale'
  | 'blues'
  | 'cividis'
  | 'cubehelix'
  | 'eosb'
  | 'inferno'
  | 'magma'
  | 'parula'
  | 'plasma'
  | 'rainbow'
  | 'rdbu'
  | 'rdyibu'
  | 'redtemperature'
  | 'viridis';

export interface AladinDisplaySettings {
  // Coordinate grid
  showCooGrid: boolean;
  cooGridColor: string;
  cooGridOpacity: number;
  cooGridLabelSize: number;

  // Reticle
  showReticle: boolean;
  reticleColor: string;
  reticleSize: number;

  // Coordinate frame
  cooFrame: AladinCooFrameSetting;

  // Image adjustments
  colormap: AladinColormap;
  colormapReversed: boolean;
  brightness: number;  // -1 to 1, default 0
  contrast: number;    // 0 to 3, default 1
  saturation: number;  // 0 to 3, default 1
  gamma: number;       // 0.1 to 5, default 1
}

export const DEFAULT_ALADIN_DISPLAY_SETTINGS: AladinDisplaySettings = {
  showCooGrid: false,
  cooGridColor: 'rgb(178, 50, 178)',
  cooGridOpacity: 0.6,
  cooGridLabelSize: 12,
  showReticle: false,
  reticleColor: '#ff0000',
  reticleSize: 22,
  cooFrame: 'ICRSd',
  colormap: 'native',
  colormapReversed: false,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  gamma: 1,
};

// ============================================================================
// Framing Types
// ============================================================================

export interface FramingState {
  RAangle: number;
  DECangle: number;
  RAangleString: string;
  DECangleString: string;
  rotationAngle: number;
  showFramingModal: boolean;
  selectedItem: {
    Name: string;
    RA: number;
    Dec: number;
  } | null;
  containerSize: number;
  isSlewing: boolean;
  isSlewingAndCentering: boolean;
}

// ============================================================================
// Mount Types
// ============================================================================

export type MountProtocol = 'alpaca' | 'simulator';
export type MountTrackingRate = 'sidereal' | 'lunar' | 'solar' | 'stopped';
export type MountPierSide = 'east' | 'west' | 'unknown';
export type SupportedMountSource = 'simulator' | 'alpaca-discovery' | 'manual';

export interface SupportedMountDevice {
  id: string;
  protocol: MountProtocol;
  host: string;
  port: number;
  deviceId: number;
  name: string;
  deviceType: string;
  source: SupportedMountSource;
  uniqueId?: string;
  manufacturer?: string;
  model?: string;
  description?: string;
  driverInfo?: string;
  driverVersion?: string;
}

export interface MountConnectionConfig {
  protocol: MountProtocol;
  host: string;
  port: number;
  deviceId: number;
  selectedDeviceId?: string | null;
}

export interface MountCapabilities {
  canSlew: boolean;
  canSlewAsync: boolean;
  canSync: boolean;
  canPark: boolean;
  canUnpark: boolean;
  canSetTracking: boolean;
  canMoveAxis: boolean;
  canPulseGuide: boolean;
  alignmentMode: string;
  equatorialSystem: string;
}

export interface MountCapabilitySnapshot extends MountCapabilities {
  capturedAt: string;
}

export interface MountActionAvailability {
  connect: boolean;
  discover: boolean;
  slew: boolean;
  sync: boolean;
  park: boolean;
  unpark: boolean;
  tracking: boolean;
  trackingRate: boolean;
  moveAxis: boolean;
  abortSlew: boolean;
}

export type MountCommandAction = Exclude<keyof MountActionAvailability, 'connect' | 'discover'>;

export type MountBlockedReason =
  | 'disconnected'
  | 'unsupported'
  | 'parked'
  | 'already-parked'
  | 'not-parked'
  | 'tracking-disabled'
  | 'not-slewing'
  | 'slewing';

export type MountBlockedReasonMap = Partial<Record<MountCommandAction, MountBlockedReason>>;

export interface MountTargetAction {
  action: Extract<MountCommandAction, 'slew' | 'sync'>;
  targetName: string;
  ra: number;
  dec: number;
  source: string;
  requestedAt: string;
}

export interface MountCommandFailure {
  action: MountCommandAction;
  message: string;
  at: string;
}

export interface MountInfo {
  Connected: boolean;
  Coordinates: {
    RADegrees: number;
    Dec: number;
  };
  Tracking?: boolean;
  TrackMode?: MountTrackingRate;
  Slewing?: boolean;
  Parked?: boolean;
  AtHome?: boolean;
  PierSide?: MountPierSide;
  SlewRateIndex?: number;
}

export interface ProfileInfo {
  AstrometrySettings: {
    Latitude: number;
    Longitude: number;
    Elevation: number;
  };
}

// ============================================================================
// Selected Object Types
// ============================================================================

export interface SelectedObjectData {
  names: string[];
  ra: string;
  dec: string;
  raDeg: number;
  decDeg: number;
  selectionSource?: 'engine' | 'catalog' | 'coordinate' | 'enriched';
  selectionFallback?: 'resolved' | 'catalog_partial' | 'coordinate_fallback';
  sourceCatalog?: string | null;
  selectionTimestamp?: string;
  frame?: import('./astronomy').AstronomicalFrame;
  timeScale?: import('./astronomy').TimeScale;
  qualityFlag?: import('./astronomy').CoordinateQualityFlag;
  dataFreshness?: import('./astronomy').EopFreshness;
  coordinateSource?: 'engine' | 'calculation';
  coordinateTimestamp?: string;
  type?: string;
  magnitude?: number;
  size?: string;
  constellation?: string;
}

// ============================================================================
// Coordinate Types
// ============================================================================

/**
 * Context menu click coordinates type
 * Used for right-click context menus on the star map
 */
export interface ClickCoords {
  ra: number;
  dec: number;
  raStr: string;
  decStr: string;
  frame?: import('./astronomy').AstronomicalFrame;
  timeScale?: import('./astronomy').TimeScale;
  qualityFlag?: import('./astronomy').CoordinateQualityFlag;
  dataFreshness?: import('./astronomy').EopFreshness;
  source?: 'engine' | 'calculation';
  epochJd?: number;
}

// ============================================================================
// Overlay Position Types
// ============================================================================

/**
 * Satellite data for overlay display
 */
export type SatelliteType = 'iss' | 'starlink' | 'weather' | 'gps' | 'communication' | 'scientific' | 'amateur' | 'other';

export interface SatelliteData {
  id: string;
  name: string;
  noradId: number;
  type: SatelliteType;
  altitude: number;
  velocity: number;
  ra?: number;
  dec?: number;
  azimuth?: number;
  elevation?: number;
  isVisible: boolean;
  inclination?: number;
  period?: number;
  magnitude?: number;
  source?: string;
}

/**
 * Satellite position on screen overlay
 */
export interface SatellitePosition {
  satellite: SatelliteData;
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Marker position on screen overlay
 */
export interface MarkerPosition {
  marker: import('@/lib/stores').SkyMarker;
  x: number;
  y: number;
  visible: boolean;
}

// ============================================================================
// Global Window Extension
// ============================================================================

declare global {
  interface Window {
    StelWebEngine?: (options: {
      wasmFile: string;
      canvasElement: HTMLCanvasElement;
      translateFn?: (domain: string, text: string) => string;
      onReady: (stel: StellariumEngine) => void;
    }) => void;
  }
}

