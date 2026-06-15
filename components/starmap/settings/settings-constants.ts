import type { GridType, BinningType } from '@/lib/stores';

// ============================================================================
// Display Settings Configuration
// ============================================================================

export const DISPLAY_SETTINGS = [
  { key: 'constellationsLinesVisible' as const, labelKey: 'settings.constellationLines' },
  { key: 'constellationArtVisible' as const, labelKey: 'settings.constellationArt' },
  { key: 'constellationLabelsVisible' as const, labelKey: 'settings.constellationLabels' },
  { key: 'constellationBoundariesVisible' as const, labelKey: 'settings.constellationBoundaries' },
  { key: 'starLabelsVisible' as const, labelKey: 'settings.starLabels' },
  { key: 'planetLabelsVisible' as const, labelKey: 'settings.planetLabels' },
  { key: 'dsosVisible' as const, labelKey: 'settings.deepSkyObjects' },
  { key: 'milkyWayVisible' as const, labelKey: 'settings.milkyWay' },
  { key: 'atmosphereVisible' as const, labelKey: 'settings.atmosphere' },
  { key: 'landscapesVisible' as const, labelKey: 'settings.landscape' },
  { key: 'fogVisible' as const, labelKey: 'settings.fog' },
] as const;

export const GRID_SETTINGS = [
  { key: 'azimuthalLinesVisible' as const, labelKey: 'settings.azimuthalGrid' },
  { key: 'equatorialLinesVisible' as const, labelKey: 'settings.equatorialGrid' },
  { key: 'equatorialJnowLinesVisible' as const, labelKey: 'settings.equatorialJnowGrid' },
  { key: 'meridianLinesVisible' as const, labelKey: 'settings.meridianLine' },
  { key: 'eclipticLinesVisible' as const, labelKey: 'settings.eclipticLine' },
  { key: 'horizonLinesVisible' as const, labelKey: 'settings.horizonLine' },
  { key: 'galacticLinesVisible' as const, labelKey: 'settings.galacticLine' },
] as const;

// ============================================================================
// Exposure Settings Configuration
// ============================================================================

export const TRACKING_OPTIONS = [
  { value: 'none' as const, labelKey: 'exposure.trackingNone' },
  { value: 'basic' as const, labelKey: 'exposure.trackingBasic' },
  { value: 'guided' as const, labelKey: 'exposure.trackingGuided' },
] as const;

export const TARGET_TYPE_OPTIONS = [
  { value: 'galaxy' as const, labelKey: 'exposure.galaxy' },
  { value: 'nebula' as const, labelKey: 'exposure.nebula' },
  { value: 'cluster' as const, labelKey: 'exposure.cluster' },
  { value: 'planetary' as const, labelKey: 'exposure.planetary' },
] as const;

export const BINNING_OPTIONS: BinningType[] = ['1x1', '2x2', '3x3', '4x4'];

export const FILTER_OPTIONS = [
  { id: 'L', nameKey: 'exposure.filterLuminance' },
  { id: 'R', nameKey: 'exposure.filterRed' },
  { id: 'G', nameKey: 'exposure.filterGreen' },
  { id: 'B', nameKey: 'exposure.filterBlue' },
  { id: 'Ha', nameKey: 'exposure.filterHAlpha' },
  { id: 'OIII', nameKey: 'exposure.filterOiii' },
  { id: 'SII', nameKey: 'exposure.filterSii' },
  { id: 'NoFilter', nameKey: 'exposure.filterNoFilter' },
];

export const GAIN_STRATEGY_OPTIONS = [
  { value: 'unity' as const, labelKey: 'exposure.gainStrategyUnity' },
  { value: 'max_dynamic_range' as const, labelKey: 'exposure.gainStrategyMaxDynamicRange' },
  { value: 'manual' as const, labelKey: 'exposure.gainStrategyManual' },
] as const;

// ============================================================================
// FOV Settings Configuration
// ============================================================================

export const GRID_TYPE_OPTIONS: { value: GridType; labelKey: string; icon: string }[] = [
  { value: 'none', labelKey: 'fov.gridNone', icon: 'O' },
  { value: 'crosshair', labelKey: 'fov.gridCrosshair', icon: '+' },
  { value: 'thirds', labelKey: 'fov.gridThirds', icon: '#' },
  { value: 'golden', labelKey: 'fov.gridGolden', icon: 'G' },
  { value: 'diagonal', labelKey: 'fov.gridDiagonal', icon: 'X' },
];

// Mosaic configuration limits
export const MAX_MOSAIC_ROWS = 10;
export const MAX_MOSAIC_COLS = 10;

export const FRAME_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff',
];

// ============================================================================
// Default Settings Values
// ============================================================================

export const DEFAULT_STELLARIUM_SETTINGS = {
  constellationsLinesVisible: true,
  constellationArtVisible: false,
  constellationLabelsVisible: true,
  constellationBoundariesVisible: false,
  starLabelsVisible: true,
  planetLabelsVisible: true,
  azimuthalLinesVisible: false,
  equatorialLinesVisible: false,
  equatorialJnowLinesVisible: false,
  meridianLinesVisible: false,
  eclipticLinesVisible: false,
  horizonLinesVisible: false,
  galacticLinesVisible: false,
  atmosphereVisible: false,
  landscapesVisible: false,
  dsosVisible: true,
  milkyWayVisible: true,
  fogVisible: false,
  surveyEnabled: true,
  surveyId: 'dss',
  surveyUrl: undefined,
  skyCulture: 'western',
  skyCultureLanguage: 'native' as const,
  nightMode: false,
  sensorControl: false,
  sensorAbsolutePreferred: true,
  sensorUseCompassHeading: true,
  sensorUpdateHz: 30,
  sensorDeadbandDeg: 0.35,
  sensorSmoothingFactor: 0.2,
  sensorCalibrationRequired: true,
  sensorCalibrationAzimuthOffsetDeg: 0,
  sensorCalibrationAltitudeOffsetDeg: 0,
  sensorCalibrationUpdatedAt: null,
  arMode: false,
  arOpacity: 0.7,
  arShowCompass: true,
  arCameraPreset: 'balanced' as const,
  arCameraFacingMode: 'environment' as const,
  arCameraResolutionTier: '1080p' as const,
  arCameraTargetFps: 30,
  arCameraStabilizationStrength: 0.6,
  arCameraCalibrationSensitivity: 0.5,
  arCameraZoomLevel: 1,
  arCameraTorchPreferred: false,
  arCameraPreferredDevice: {
    deviceId: null,
    label: null,
    groupId: null,
  },
  arCameraLastKnownGoodAcquisition: {
    deviceId: null,
    label: null,
    groupId: null,
    facingMode: 'environment' as const,
    stage: null,
    updatedAt: null,
  },
  arAdaptiveLearningEnabled: true,
  arAdaptiveAutoApply: false,
  arAdaptiveLearnerState: {
    version: 1,
    acceptedRecommendations: 0,
    rejectedRecommendations: 0,
    repeatedManualAdjustmentCount: 0,
    lastRecommendationAt: null,
    lastAcceptedAt: null,
    preferredProfileOverrides: {},
    aggregateSignals: {
      averageSessionFps: 0,
      averageRecoveryActionsPerSession: 0,
    },
  },
  arNetworkOptimizationEnabled: true,
  arTelemetryOptIn: false,
  arRemotePackVersion: null,
  arRemotePackUpdatedAt: null,
  crosshairVisible: true,
  crosshairColor: 'rgba(255, 255, 255, 0.3)',

  // Engine core rendering settings
  projectionType: 'stereographic' as const,
  bortleIndex: 3,
  starLinearScale: 0.8,
  starRelativeScale: 1.1,
  displayLimitMag: 99,
  flipViewVertical: false,
  flipViewHorizontal: false,
  exposureScale: 2,
  tonemapperP: 0.5,
  mountFrame: 5 as const,
  viewYOffset: 0,
};

