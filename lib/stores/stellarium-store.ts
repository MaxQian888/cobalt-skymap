import { create } from 'zustand';
import type { StellariumEngine, StellariumSettings, SkyEngineType } from '@/lib/core/types';
import type A from 'aladin-lite';
import { PROJECTION_VALUES } from '@/lib/core/types';
import { SKY_SURVEYS } from '@/lib/core/constants';
import { updateStellariumTranslation } from '@/lib/translations';
import { createLogger } from '@/lib/logger';
import type { AstronomicalFrame, TimeScale, CoordinateQualityFlag, EopFreshness } from '@/lib/core/types';

type AladinInstance = ReturnType<typeof A.aladin>;

const logger = createLogger('stellarium-store');
const missingCapabilitiesLogged = new Set<string>();

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' ? (value as UnknownRecord) : null;
}

function logMissingCapabilityOnce(path: string): void {
  if (missingCapabilitiesLogged.has(path)) return;
  missingCapabilitiesLogged.add(path);
  logger.debug('Stellarium capability is not available in current engine build', { path });
}

function setIfSupported(root: unknown, path: string, value: unknown): boolean {
  const segments = path.split('.');
  let cursor = asRecord(root);
  if (!cursor) {
    logMissingCapabilityOnce(path);
    return false;
  }

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i];
    if (!(key in cursor)) {
      logMissingCapabilityOnce(path);
      return false;
    }
    cursor = asRecord(cursor[key]);
    if (!cursor) {
      logMissingCapabilityOnce(path);
      return false;
    }
  }

  const leaf = segments[segments.length - 1];
  if (!(leaf in cursor)) {
    logMissingCapabilityOnce(path);
    return false;
  }
  cursor[leaf] = value;
  return true;
}

function normalizeSurveyUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function resolveSurveyUrl(settings: StellariumSettings): string | undefined {
  const explicit = normalizeSurveyUrl(settings.surveyUrl);
  if (explicit) return explicit;

  const byId = SKY_SURVEYS.find((survey) => survey.id === settings.surveyId)
    ?? SKY_SURVEYS.find((survey) => survey.id.toLowerCase() === settings.surveyId.toLowerCase());
  return normalizeSurveyUrl(byId?.url);
}

function applyCoreRendering(core: StellariumEngine['core'], settings: StellariumSettings): void {
  setIfSupported(core, 'bortle_index', settings.bortleIndex);
  setIfSupported(core, 'star_linear_scale', settings.starLinearScale);
  setIfSupported(core, 'star_relative_scale', settings.starRelativeScale);
  setIfSupported(core, 'display_limit_mag', settings.displayLimitMag);
  setIfSupported(core, 'flip_view_vertical', settings.flipViewVertical);
  setIfSupported(core, 'flip_view_horizontal', settings.flipViewHorizontal);
  setIfSupported(core, 'exposure_scale', settings.exposureScale);
  setIfSupported(core, 'tonemapper_p', settings.tonemapperP);
  setIfSupported(core, 'mount_frame', settings.mountFrame);
  setIfSupported(core, 'y_offset', settings.viewYOffset);

  const projectionValue = PROJECTION_VALUES[settings.projectionType];
  if (projectionValue !== undefined) {
    setIfSupported(core, 'projection', projectionValue);
  }

  setIfSupported(core, 'stars.hints_visible', settings.starLabelsVisible);
  setIfSupported(core, 'planets.hints_visible', settings.planetLabelsVisible);
  setIfSupported(core, 'dsos.visible', settings.dsosVisible);
  setIfSupported(core, 'milkyway.visible', settings.milkyWayVisible);
  setIfSupported(core, 'atmosphere.visible', settings.atmosphereVisible);
}

function applyConstellations(core: StellariumEngine['core'], settings: StellariumSettings): void {
  setIfSupported(core, 'constellations.lines_visible', settings.constellationsLinesVisible);
  setIfSupported(core, 'constellations.labels_visible', settings.constellationLabelsVisible);
  setIfSupported(core, 'constellations.images_visible', settings.constellationArtVisible);
  setIfSupported(core, 'constellations.boundaries_visible', settings.constellationBoundariesVisible);
}

function applyGridLines(core: StellariumEngine['core'], settings: StellariumSettings): void {
  setIfSupported(core, 'lines.azimuthal.visible', settings.azimuthalLinesVisible);
  setIfSupported(core, 'lines.equatorial.visible', settings.equatorialLinesVisible);
  setIfSupported(core, 'lines.equatorial_jnow.visible', settings.equatorialJnowLinesVisible);
  setIfSupported(core, 'lines.meridian.visible', settings.meridianLinesVisible);
  setIfSupported(core, 'lines.ecliptic.visible', settings.eclipticLinesVisible);
  setIfSupported(core, 'lines.horizon.visible', settings.horizonLinesVisible);
  setIfSupported(core, 'lines.galactic.visible', settings.galacticLinesVisible);
}

function applyLandscapeAndFog(
  core: StellariumEngine['core'],
  settings: StellariumSettings,
  baseUrl: string
): void {
  if (!core.landscapes || !baseUrl) return;
  const landscapes = asRecord(core.landscapes);
  const addDataSource = landscapes?.addDataSource;
  if (typeof addDataSource !== 'function') {
    logMissingCapabilityOnce('landscapes.addDataSource');
    return;
  }

  const landscapeKey = settings.landscapesVisible ? 'guereins' : 'gray';
  const landscapeUrl = `${baseUrl}landscapes/${landscapeKey}`;
  try {
    (addDataSource as (options: { url: string; key?: string }) => void)({
      url: landscapeUrl,
      key: landscapeKey,
    });
    setIfSupported(core, 'landscapes.visible', true);
    setIfSupported(core, 'landscapes.fog_visible', settings.fogVisible);
  } catch (error) {
    logger.warn('Failed to load Stellarium landscape data source, disabling landscape overlay', {
      landscapeKey,
      landscapeUrl,
      error,
    });
    setIfSupported(core, 'landscapes.visible', false);
    setIfSupported(core, 'landscapes.fog_visible', false);
  }
}

function applySurvey(core: StellariumEngine['core'], settings: StellariumSettings): void {
  const surveyUrl = resolveSurveyUrl(settings);
  if (!settings.surveyEnabled || !surveyUrl) {
    setIfSupported(core, 'hips.visible', false);
    return;
  }

  setIfSupported(core, 'hips.visible', true);
  if (!setIfSupported(core, 'hips.url', surveyUrl)) {
    const hips = asRecord(core.hips);
    const addDataSource = hips?.addDataSource;
    if (typeof addDataSource === 'function') {
      (addDataSource as (options: { url: string; key?: string }) => void)({ url: surveyUrl });
    }
  }
}

function applyLocalization(settings: StellariumSettings): void {
  if (settings.skyCultureLanguage) {
    updateStellariumTranslation(settings.skyCultureLanguage);
  }
}

interface StellariumState {
  // Engine instances
  stel: StellariumEngine | null;
  aladin: AladinInstance | null;
  activeEngine: SkyEngineType;
  baseUrl: string;
  
  // Search state
  search: {
    RAangle: number;
    DECangle: number;
    RAangleString: string;
    DECangleString: string;
  };
  
  // Helper functions stored on the engine
  getCurrentViewDirection: (() => {
    ra: number;
    dec: number;
    alt: number;
    az: number;
    frame?: AstronomicalFrame;
    timeScale?: TimeScale;
    qualityFlag?: CoordinateQualityFlag;
    dataFreshness?: EopFreshness;
  }) | null;
  setViewDirection: ((raDeg: number, decDeg: number) => void) | null;
  
  // Saved view state for engine switching (degrees + FOV)
  savedViewState: { raDeg: number; decDeg: number; fov: number } | null;

  // Cached view direction (radians) — updated by a single polling source
  viewDirection: {
    ra: number;
    dec: number;
    alt: number;
    az: number;
    frame?: AstronomicalFrame;
    timeScale?: TimeScale;
    qualityFlag?: CoordinateQualityFlag;
    dataFreshness?: EopFreshness;
  } | null;
  
  // Actions
  setStel: (stel: StellariumEngine | null) => void;
  setAladin: (aladin: AladinInstance | null) => void;
  setActiveEngine: (engine: SkyEngineType) => void;
  setBaseUrl: (url: string) => void;
  setSearch: (search: Partial<StellariumState['search']>) => void;
  setHelpers: (helpers: {
    getCurrentViewDirection?: StellariumState['getCurrentViewDirection'];
    setViewDirection?: StellariumState['setViewDirection'];
  }) => void;
  updateViewDirection: () => void;
  updateStellariumCore: (settings: StellariumSettings) => void;
  saveViewState: (fov?: number) => void;
  clearSavedViewState: () => void;
}

// Radians (~0.2 arcsec) — far below visual/display precision. Two polled view
// directions within this tolerance on every numeric axis are treated as identical
// so a static view does not publish a fresh reference each poll tick.
const VIEW_DIRECTION_EPSILON = 1e-6;

function isSameViewDirection(
  a: NonNullable<StellariumState['viewDirection']>,
  b: NonNullable<StellariumState['viewDirection']>,
): boolean {
  return (
    Math.abs(a.ra - b.ra) < VIEW_DIRECTION_EPSILON &&
    Math.abs(a.dec - b.dec) < VIEW_DIRECTION_EPSILON &&
    Math.abs(a.alt - b.alt) < VIEW_DIRECTION_EPSILON &&
    Math.abs(a.az - b.az) < VIEW_DIRECTION_EPSILON &&
    a.frame === b.frame &&
    a.timeScale === b.timeScale &&
    a.qualityFlag === b.qualityFlag &&
    a.dataFreshness === b.dataFreshness
  );
}

export const useStellariumStore = create<StellariumState>((set, get) => ({
  stel: null,
  aladin: null,
  activeEngine: 'stellarium' as SkyEngineType,
  baseUrl: '',
  search: {
    RAangle: 0,
    DECangle: 0,
    RAangleString: '',
    DECangleString: '',
  },
  getCurrentViewDirection: null,
  setViewDirection: null,
  viewDirection: null,
  savedViewState: null,
  
  setStel: (stel) => set({ stel }),
  setAladin: (aladin) => set({ aladin }),
  setActiveEngine: (activeEngine) => set({ activeEngine }),
  setBaseUrl: (baseUrl) => set({ baseUrl }),
  setSearch: (search) => set((state) => ({ 
    search: { ...state.search, ...search } 
  })),
  setHelpers: (helpers) => set({
    // Use 'in' check so explicit null clears the helper (vs ?? which would keep stale value).
    // The `as` cast is needed because the property type is `T | null` but TypeScript
    // sees the optional param as `T | null | undefined`; at runtime the value is always
    // either a function or null when the key is present.
    getCurrentViewDirection: 'getCurrentViewDirection' in helpers
      ? (helpers.getCurrentViewDirection ?? null) as StellariumState['getCurrentViewDirection']
      : get().getCurrentViewDirection,
    setViewDirection: 'setViewDirection' in helpers
      ? (helpers.setViewDirection ?? null) as StellariumState['setViewDirection']
      : get().setViewDirection,
  }),
  updateViewDirection: () => {
    const fn = get().getCurrentViewDirection;
    if (!fn) return;
    let next: StellariumState['viewDirection'];
    try {
      next = fn();
    } catch {
      // Engine not ready yet
      return;
    }
    const prev = get().viewDirection;
    // Skip the publish when the view is static — keeping the same object
    // reference prevents every viewDirection subscriber (top toolbar clock,
    // bookmarks, status bar) from re-rendering at the 2Hz poll cadence.
    if (next && prev && isSameViewDirection(prev, next)) return;
    set({ viewDirection: next });
  },
  
  saveViewState: (fov?: number) => {
    const { viewDirection, stel, aladin } = get();
    if (!viewDirection) return;
    const raDeg = viewDirection.ra * (180 / Math.PI);
    const decDeg = viewDirection.dec * (180 / Math.PI);
    let currentFov = fov;
    if (currentFov === undefined) {
      if (stel) {
        currentFov = stel.core.fov * (180 / Math.PI);
      } else if (aladin) {
        currentFov = (aladin as { getFov?: () => number[] }).getFov?.()[0] ?? 60;
      } else {
        currentFov = 60;
      }
    }
    set({ savedViewState: { raDeg, decDeg, fov: currentFov } });
  },
  clearSavedViewState: () => set({ savedViewState: null }),

  updateStellariumCore: (settings) => {
    const { stel, baseUrl } = get();
    if (!stel) {
      logger.warn('Stellarium engine not ready, settings update skipped');
      return;
    }

    const core = stel.core;

    try {
      applyCoreRendering(core, settings);
      applyConstellations(core, settings);
      applyGridLines(core, settings);
      applyLandscapeAndFog(core, settings, baseUrl);
      applySurvey(core, settings);
      applyLocalization(settings);

      logger.debug('Stellarium settings updated successfully');
    } catch (error) {
      logger.error('Error updating Stellarium settings', error);
    }
  },
}));
