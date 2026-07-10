'use client';

import { useCallback, useEffect, useRef, useState, RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { useStellariumStore, useSettingsStore, useMountStore } from '@/lib/stores';
import { degreesToHMS, degreesToDMS, rad2deg } from '@/lib/astronomy/starmap-utils';
import { createStellariumTranslator } from '@/lib/translations';
import { createLogger } from '@/lib/logger';
import { DEFAULT_FOV } from '@/lib/core/constants/fov';
import { SECONDARY_SKY_CULTURE_IDS } from '@/lib/core/constants/sky-cultures';
import { deriveStarmapTierReadiness } from '@/lib/core/starmap-data-tier';
import { getEffectiveDpr } from '@/lib/core/stellarium-canvas-utils';
import {
  SCRIPT_LOAD_TIMEOUT,
  WASM_INIT_TIMEOUT,
  MAX_RETRY_COUNT,
  SCRIPT_PATH,
  WASM_PATH,
  ENGINE_FOV_INIT_DELAY,
  ENGINE_SETTINGS_INIT_DELAY,
  RETRY_DELAY_MS,
  OVERALL_LOADING_TIMEOUT,
} from '@/lib/core/constants/stellarium-canvas';
import { withTimeout, fovToRad } from '@/lib/core/stellarium-canvas-utils';
import { pointAndLockTargetAt } from './target-object-pool';
import type { StellariumEngine, SelectedObjectData } from '@/lib/core/types';
import type { LoadingErrorCode, LoadingState } from '@/types/stellarium-canvas';
import { useStarmapBootstrapStore } from '@/lib/stores/starmap-bootstrap-store';
import { isTauri } from '@/lib/storage/platform';

const logger = createLogger('stellarium-loader');

/**
 * Resolve the URL the engine should fetch comet/asteroid orbital elements from.
 * Prefers a user-refreshed MPC override file (served via the Tauri asset
 * protocol) when present; otherwise falls back to the bundled vendored file.
 * Fully guarded so it can never break the default bundled load path.
 */
async function resolveOrbitalUrl(
  dataset: 'comets' | 'asteroids',
  fallbackUrl: string,
): Promise<string> {
  try {
    if (!isTauri()) return fallbackUrl;
    const { mpcApi } = await import('@/lib/tauri/mpc-api');
    const path = await mpcApi.getOverridePath(dataset);
    if (!path) return fallbackUrl;
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    return convertFileSrc(path);
  } catch {
    return fallbackUrl;
  }
}
const TWO_PI = 2 * Math.PI;
const STELLARIUM_SCRIPT_SELECTOR =
  'script[data-stellarium-engine="true"], script[src*="stellarium-web-engine.js"]';

function normalizeRadians(angle: number): number {
  return ((angle % TWO_PI) + TWO_PI) % TWO_PI;
}

function angularErrorArcsec(targetRad: number, actualRad: number): number {
  const delta = Math.abs(targetRad - actualRad);
  const wrapped = Math.min(delta, TWO_PI - delta);
  return wrapped * (180 / Math.PI) * 3600;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

function clearStellariumScriptTags(): void {
  if (typeof document === 'undefined') return;
  document
    .querySelectorAll<HTMLScriptElement>(STELLARIUM_SCRIPT_SELECTOR)
    .forEach((script) => script.remove());
}

/**
 * Stop an engine instance's render loop (checked each frame by the patched
 * glue in stellarium-web-engine.js). The WASM runtime has no real teardown, so
 * flagging is the only way to neutralize a stale instance. Without this, every
 * superseded instance keeps calling _core_update/_core_render forever: leaked
 * instances pile up across remounts/retries (jank), and a dataless instance
 * sharing the visible canvas renders an empty sky over the live one (black
 * star map on first load until a full page reload).
 */
function destroyEngineInstance(stel: StellariumEngine | null | undefined): void {
  if (!stel) return;
  try {
    stel.__skymapDestroyed = true;
  } catch {
    // Best-effort: the instance may already be torn down.
  }
}

type AssetPathMode = 'absolute' | 'dot' | 'dotdot';

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function resolveAssetPath(path: string, mode: AssetPathMode): string {
  if (mode === 'absolute') return path;
  const relativePath = stripLeadingSlash(path);
  return mode === 'dot' ? `./${relativePath}` : `../${relativePath}`;
}

function getAssetPathCandidates(path: string): Array<{ mode: AssetPathMode; value: string }> {
  if (typeof window === 'undefined') {
    return [{ mode: 'absolute', value: path }];
  }

  // Route exports like /starmap/index.html often require one level up in file protocol.
  if (window.location.protocol === 'file:') {
    return [
      { mode: 'dotdot', value: resolveAssetPath(path, 'dotdot') },
      { mode: 'dot', value: resolveAssetPath(path, 'dot') },
      { mode: 'absolute', value: resolveAssetPath(path, 'absolute') },
    ];
  }

  // For custom runtimes/proxies that serve the app under a sub-path, keep
  // relative fallbacks as backup when root-absolute paths are not mounted.
  return [
    { mode: 'absolute', value: resolveAssetPath(path, 'absolute') },
    { mode: 'dot', value: resolveAssetPath(path, 'dot') },
    { mode: 'dotdot', value: resolveAssetPath(path, 'dotdot') },
  ];
}

interface UseStellariumLoaderOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stelRef: RefObject<StellariumEngine | null>;
  onSelectionChange?: (selection: SelectedObjectData | null) => void;
  onFovChange?: (fov: number) => void;
}

interface UseStellariumLoaderResult {
  loadingState: LoadingState;
  engineReady: boolean;
  startLoading: () => Promise<void>;
  handleRetry: () => void;
  reloadEngine: () => void;
}

type LoaderStage = 'script' | 'engine';

interface LoaderStageError extends Error {
  stage: LoaderStage;
}

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown_error';
}

function classifyLoaderFailure(
  stage: LoaderStage | null,
  message: string,
  scriptTimeoutMessage: string,
  engineTimeoutMessage: string
): LoadingErrorCode {
  if (stage === 'script') {
    return message === scriptTimeoutMessage ? 'script_timeout' : 'script_failed';
  }
  if (stage === 'engine') {
    return message === engineTimeoutMessage ? 'engine_timeout' : 'engine_init_failed';
  }
  return 'unknown';
}

/**
 * Hook for loading and initializing the Stellarium engine
 */
export function useStellariumLoader({
  containerRef,
  canvasRef,
  stelRef,
  onSelectionChange,
  onFovChange,
}: UseStellariumLoaderOptions): UseStellariumLoaderResult {
  const t = useTranslations('canvas');
  
  const initializingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryObserverRef = useRef<ResizeObserver | null>(null);
  const overallTimeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const overallDeadlineRef = useRef<number>(0);
  const assetPathModeRef = useRef<AssetPathMode>('absolute');
  // Every engine instance this loader ever booted. Instances survive React
  // unmounts (their render loop is engine-owned), so each one must be
  // explicitly destroyed when superseded or on unmount.
  const createdEnginesRef = useRef<Set<StellariumEngine>>(new Set());
  
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
  // Provide an immediate, non-empty status so the loading overlay doesn't render blank
  // for a frame before startLoading kicks in (scheduled via requestAnimationFrame).
  const [loadingStatus, setLoadingStatus] = useState(() => t('preparingResources'));
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<LoadingState['phase']>('preparing');
  const [loadingErrorCode, setLoadingErrorCode] = useState<LoadingState['errorCode']>(null);
  const [engineReady, setEngineReady] = useState(false);
  const bootstrapResources = useStarmapBootstrapStore((state) => state.resources);
  
  const setStel = useStellariumStore((state) => state.setStel);
  const setBaseUrl = useStellariumStore((state) => state.setBaseUrl);
  const setHelpers = useStellariumStore((state) => state.setHelpers);
  const tierReadiness = deriveStarmapTierReadiness(
    Object.values(bootstrapResources).map((resource) => ({
      id: resource.id,
      tier: resource.tier,
      critical: resource.critical,
      state: resource.state,
    }))
  );
  const updateStellariumCore = useStellariumStore((state) => state.updateStellariumCore);
  const getRenderQuality = useCallback(() => {
    // Defensive fallback for partially-migrated persisted settings.
    return useSettingsStore.getState().performance?.renderQuality ?? 'high';
  }, []);
  const recordBootstrapStage = useCallback((
    stage: string,
    event: 'start' | 'complete' | 'failed',
    metadata?: { attempt?: number; reason?: string; sessionId?: string; classification?: 'blocking' | 'deferred' }
  ) => {
    const bootstrap = useStarmapBootstrapStore.getState();
    bootstrap.recordStageEvent(stage, event, metadata);
    logger.debug('Starmap bootstrap stage event', {
      sessionId: metadata?.sessionId ?? bootstrap.sessionId,
      stage,
      event,
      attempt: metadata?.attempt,
      reason: metadata?.reason,
    });
  }, []);

  // Callback refs to keep initStellarium stable (avoids re-init on callback changes)
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onFovChangeRef = useRef(onFovChange);
  useEffect(() => { onSelectionChangeRef.current = onSelectionChange; }, [onSelectionChange]);
  useEffect(() => { onFovChangeRef.current = onFovChange; }, [onFovChange]);
  useEffect(() => {
    // Restore the mounted flag on (re)mount. `useRef` values persist across the
    // effect re-runs that React performs in dev (Fast Refresh, and StrictMode's
    // mount→unmount→mount probe), so without this assignment the cleanup below
    // would latch `mountedRef` to `false` permanently — `startLoading` then
    // early-returns forever and the loader hangs on the loading overlay until a
    // full page reload (Ctrl+R). Production export never re-runs this effect on a
    // preserved instance, which is why the hang was dev-only.
    mountedRef.current = true;
    const createdEngines = createdEnginesRef.current;
    return () => {
      mountedRef.current = false;
      // Stop all engine render loops owned by this loader (engine switch /
      // page navigation) — otherwise they keep rendering a detached canvas
      // every frame for the rest of the app's lifetime.
      for (const engine of createdEngines) {
        destroyEngineInstance(engine);
      }
      createdEngines.clear();
      abortControllerRef.current?.abort();
      retryObserverRef.current?.disconnect();
      retryObserverRef.current = null;
      if (retryTimeoutRef.current !== null) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (overallTimeoutRef.current !== null) {
        window.clearTimeout(overallTimeoutRef.current);
        overallTimeoutRef.current = null;
      }
      overallDeadlineRef.current = 0;
      initializingRef.current = false;
    };
  }, []);
  
  // Initialize Stellarium engine with all data sources
  const initStellarium = useCallback((stel: StellariumEngine, sessionId: string) => {
    if (!mountedRef.current) {
      return;
    }

    logger.info('Stellarium is ready!');
    (stelRef as React.MutableRefObject<StellariumEngine | null>).current = stel;
    // The glue's render loop reads this every frame; without it the loop uses
    // the raw devicePixelRatio and ignores the render-quality cap.
    stel.__skymapDpr = getEffectiveDpr(getRenderQuality());
    setStel(stel);

    // Set observer location from profile (read latest from store, subsequent syncs handled by useObserverSync)
    const currentProfile = useMountStore.getState().profileInfo;
    const lat = currentProfile.AstrometrySettings.Latitude || 0;
    const lon = currentProfile.AstrometrySettings.Longitude || 0;
    const elev = currentProfile.AstrometrySettings.Elevation || 0;
    
    // Use direct property assignment for Stellarium engine compatibility
    stel.core.observer.latitude = lat * stel.D2R;
    stel.core.observer.longitude = lon * stel.D2R;
    stel.core.observer.elevation = elev;

    // Set time speed to 1 and initial FOV
    // Use setTimeout to ensure the engine is fully initialized before setting FOV
    stel.core.time_speed = 1;
    setTimeout(() => {
      if (stelRef.current) {
        stelRef.current.core.fov = fovToRad(DEFAULT_FOV);
        onFovChangeRef.current?.(DEFAULT_FOV);
      }
    }, ENGINE_FOV_INIT_DELAY);

    // Helper function to get current view direction
    const getCurrentViewDirection = () => {
      const obs = stel.core.observer;
      const viewVec = [0, 0, -1];
      const icrfVec = stel.convertFrame(stel.observer, 'VIEW', 'ICRF', viewVec);
      const raDecSpherical = stel.c2s(icrfVec);
      const alt = obs.azalt[0];
      const az = obs.azalt[1];

      return {
        ra: normalizeRadians(raDecSpherical[0]),
        dec: stel.anpm(raDecSpherical[1]),
        alt,
        az,
        frame: 'ICRF' as const,
        timeScale: 'UTC' as const,
        qualityFlag: 'precise' as const,
        dataFreshness: 'fallback' as const,
      };
    };

    // Helper function to set view direction
    const setViewDirection = (raDeg: number, decDeg: number) => {
      try {
        const raRad = raDeg * stel.D2R;
        const decRad = decDeg * stel.D2R;
        const icrfVec = stel.s2c(raRad, decRad);
        const cirsVec = stel.convertFrame(stel.observer, 'ICRF', 'CIRS', icrfVec);
        pointAndLockTargetAt(stel, cirsVec);

        const actual = getCurrentViewDirection();
        const raErrArcsec = angularErrorArcsec(normalizeRadians(raRad), normalizeRadians(actual.ra));
        const decErrArcsec = Math.abs(decRad - actual.dec) * (180 / Math.PI) * 3600;
        logger.debug('setViewDirection roundtrip', {
          target: { raDeg, decDeg },
          actual: { raDeg: rad2deg(actual.ra), decDeg: rad2deg(actual.dec) },
          errorArcsec: {
            ra: Number(raErrArcsec.toFixed(3)),
            dec: Number(decErrArcsec.toFixed(3)),
          },
        });
      } catch (error) {
        logger.error('Error setting view direction', error);
      }
    };

    setHelpers({ getCurrentViewDirection, setViewDirection });

    // Data source URLs - use local data from /stellarium-data/
    const baseUrl = resolveAssetPath('/stellarium-data/', assetPathModeRef.current);
    setBaseUrl(baseUrl);

    const core = stel.core;

    // Safe wrapper: isolate each data source load so one failure doesn't block others
    const safeAdd = (
      module: { addDataSource?: (opts: { url: string; key?: string }) => void } | undefined,
      options: { url: string; key?: string },
      label: string
    ) => {
      try {
        module?.addDataSource?.(options);
      } catch (error) {
        logger.warn(`Failed to load data source: ${label}`, error);
      }
    };

    // Essential data sources (loaded synchronously — needed for first render)
    safeAdd(core.stars, { url: baseUrl + 'stars' }, 'stars');
    safeAdd(core.skycultures, { url: baseUrl + 'skycultures/western', key: 'western' }, 'skycultures');
    safeAdd(core.planets, { url: baseUrl + 'surveys/sso', key: 'default' }, 'planets-default');

    // Secondary data sources (deferred via microtask to unblock initStellarium return)
    const loadSecondarySources = () => {
      // Register the additional bundled sky cultures so they can be switched at
      // runtime via core.skycultures.current_id (data loads lazily on select).
      for (const culture of SECONDARY_SKY_CULTURE_IDS) {
        safeAdd(
          core.skycultures,
          { url: `${baseUrl}skycultures/${culture}`, key: culture },
          `skyculture-${culture}`
        );
      }
      safeAdd(core.dsos, { url: baseUrl + 'dso' }, 'dsos');
      safeAdd(core.dss, { url: baseUrl + 'surveys/dss' }, 'dss');
      safeAdd(core.milkyway, { url: baseUrl + 'surveys/milkyway' }, 'milkyway');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/moon', key: 'moon' }, 'moon');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/sun', key: 'sun' }, 'sun');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/mercury', key: 'mercury' }, 'mercury');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/venus', key: 'venus' }, 'venus');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/mars', key: 'mars' }, 'mars');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/jupiter', key: 'jupiter' }, 'jupiter');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/saturn', key: 'saturn' }, 'saturn');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/uranus', key: 'uranus' }, 'uranus');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/neptune', key: 'neptune' }, 'neptune');
      useStarmapBootstrapStore.getState().markResourceReady('online_metadata', { sessionId });
    };
    useStarmapBootstrapStore.getState().markResourceLoading('online_metadata', { sessionId });
    setTimeout(loadSecondarySources, 0);

    // Tertiary data sources (loaded during idle time)
    const loadTertiarySources = async () => {
      const [asteroidUrl, cometUrl] = await Promise.all([
        resolveOrbitalUrl('asteroids', baseUrl + 'mpcorb.dat'),
        resolveOrbitalUrl('comets', baseUrl + 'CometEls.txt'),
      ]);
      safeAdd(core.minor_planets, { url: asteroidUrl, key: 'mpc_asteroids' }, 'minor_planets');
      safeAdd(core.comets, { url: cometUrl, key: 'mpc_comets' }, 'comets');
      // Satellites from bundled TLE data (engine requires key 'jsonl/sat').
      safeAdd(
        core.satellites,
        { url: baseUrl + 'tle_satellite.jsonl.gz', key: 'jsonl/sat' },
        'satellites'
      );
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/io', key: 'io' }, 'io');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/europa', key: 'europa' }, 'europa');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/ganymede', key: 'ganymede' }, 'ganymede');
      safeAdd(core.planets, { url: baseUrl + 'surveys/sso/callisto', key: 'callisto' }, 'callisto');
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(loadTertiarySources);
    } else {
      setTimeout(loadTertiarySources, 500);
    }

    // Apply initial settings - get latest from store to avoid stale closure
    const currentSettings = useSettingsStore.getState().stellarium;
    // Delay initial settings application to ensure engine is fully ready
    setTimeout(() => {
      if (!mountedRef.current || stelRef.current !== stel) return;
      updateStellariumCore(currentSettings);
      setEngineReady(true);
      const bootstrap = useStarmapBootstrapStore.getState();
      bootstrap.markResourceReady('engine_core', { sessionId });
      recordBootstrapStage('engine_core.initialize', 'complete', { sessionId, classification: 'blocking' });
    }, ENGINE_SETTINGS_INIT_DELAY);

    // Watch for selection changes (guard against callback firing after unmount)
    stel.change((_obj: unknown, attr: string) => {
      // Continuous FOV reporting: covers zoomTo animations and mobile pinch,
      // which never went through the app-side zoom handlers before.
      if (attr === 'fov') {
        if (!stelRef.current) return;
        onFovChangeRef.current?.(rad2deg(core.fov));
        return;
      }
      if (attr === 'selection') {
        if (!stelRef.current) return;

        const selection = core.selection;
        if (!selection) {
          onSelectionChangeRef.current?.(null);
          return;
        }

        const selectedDesignations = selection.designations();
        const radecVector = selection.getInfo('RADEC') as number[];
        const radecIcrfVec = stel.convertFrame(stel.observer, 'CIRS', 'ICRF', radecVector);
        const radecIcrf = stel.c2s(radecIcrfVec);
        const ra = normalizeRadians(radecIcrf[0]);
        const dec = stel.anpm(radecIcrf[1]);

        onSelectionChangeRef.current?.({
          names: selectedDesignations,
          ra: degreesToHMS(rad2deg(ra)),
          dec: degreesToDMS(rad2deg(dec)),
          raDeg: rad2deg(ra),
          decDeg: rad2deg(dec),
          frame: 'ICRF',
          timeScale: 'UTC',
          qualityFlag: 'precise',
          dataFreshness: 'fallback',
          coordinateSource: 'engine',
          coordinateTimestamp: new Date().toISOString(),
        });
      }
    });
  // Note: stellariumSettings is intentionally NOT in deps - initial settings applied once,
  // subsequent changes handled by useSettingsSync hook.
  // onSelectionChange/onFovChange accessed via refs to keep this callback stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stelRef,
    setStel,
    setBaseUrl,
    setHelpers,
    recordBootstrapStage,
    getRenderQuality,
  ]);

  // Load the Stellarium engine script with timeout and cancellation support.
  const loadScript = useCallback((signal: AbortSignal): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      if (window.StelWebEngine) {
        resolve();
        return;
      }

      clearStellariumScriptTags();

      const candidates = getAssetPathCandidates(SCRIPT_PATH);
      const perAttemptTimeout = Math.max(
        3000,
        Math.floor(SCRIPT_LOAD_TIMEOUT / Math.max(candidates.length, 1))
      );

      let tryIndex = 0;
      let settled = false;
      let activeScript: HTMLScriptElement | null = null;
      let activeTimeout: number | null = null;
      let lastError: Error | null = null;

      const cleanupActiveAttempt = () => {
        if (activeTimeout !== null) {
          window.clearTimeout(activeTimeout);
          activeTimeout = null;
        }
        if (activeScript) {
          activeScript.onload = null;
          activeScript.onerror = null;
          activeScript.remove();
          activeScript = null;
        }
      };

      const finalize = (finish: () => void) => {
        if (settled) return;
        settled = true;
        cleanupActiveAttempt();
        signal.removeEventListener('abort', onAbort);
        finish();
      };

      const onAbort = () => {
        finalize(() => reject(new DOMException('Aborted', 'AbortError')));
      };

      const tryNext = () => {
        if (signal.aborted) {
          onAbort();
          return;
        }

        if (window.StelWebEngine) {
          finalize(resolve);
          return;
        }

        if (tryIndex >= candidates.length) {
          finalize(() => reject(lastError ?? new Error(t('scriptLoadFailed'))));
          return;
        }

        const current = candidates[tryIndex++];
        const script = document.createElement('script');
        activeScript = script;
        script.src = current.value;
        script.async = true;
        script.dataset.stellariumEngine = 'true';
        logger.debug('Trying Stellarium script path', { path: current.value, mode: current.mode });

        activeTimeout = window.setTimeout(() => {
          lastError = new Error(t('scriptLoadTimedOut'));
          cleanupActiveAttempt();
          tryNext();
        }, perAttemptTimeout);

        script.onload = () => {
          if (activeTimeout !== null) {
            window.clearTimeout(activeTimeout);
            activeTimeout = null;
          }

          if (!window.StelWebEngine) {
            script.remove();
            activeScript = null;
            lastError = new Error(t('engineScriptNotLoaded'));
            tryNext();
            return;
          }

          assetPathModeRef.current = current.mode;
          logger.info('Stellarium script loaded', { path: current.value, mode: current.mode });
          activeScript = null;
          finalize(resolve);
        };

        script.onerror = () => {
          if (activeTimeout !== null) {
            window.clearTimeout(activeTimeout);
            activeTimeout = null;
          }
          script.remove();
          activeScript = null;
          lastError = new Error(t('scriptLoadFailed'));
          tryNext();
        };

        document.head.appendChild(script);
      };

      signal.addEventListener('abort', onAbort, { once: true });
      tryNext();
    });
  }, [t]);

  // Initialize the Stellarium engine with WASM
  const initializeEngine = useCallback(async (signal: AbortSignal, sessionId: string): Promise<void> => {
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (!canvasRef.current) {
      throw new Error(t('canvasNotAvailable'));
    }

    if (!window.StelWebEngine) {
      throw new Error(t('engineScriptNotLoaded'));
    }

    const currentLanguage = useSettingsStore.getState().stellarium.skyCultureLanguage;
    const translateFn = createStellariumTranslator(currentLanguage);

    // Capture reference after check (TypeScript narrowing)
    const StelWebEngine = window.StelWebEngine;

    const wasmPath = resolveAssetPath(WASM_PATH, assetPathModeRef.current);

    return new Promise<void>((resolve, reject) => {
      let resolved = false;
      const onAbort = () => {
        if (resolved) return;
        resolved = true;
        reject(new DOMException('Aborted', 'AbortError'));
      };

      try {
        signal.addEventListener('abort', onAbort, { once: true });

        // StelWebEngine expects: wasmFile, canvasElement, translateFn, onReady
        const engineResult = StelWebEngine({
          wasmFile: wasmPath,
          canvasElement: canvasRef.current!,
          translateFn,
          onReady: (stel: StellariumEngine) => {
            createdEnginesRef.current.add(stel);
            if (resolved || signal.aborted || !mountedRef.current) {
              // This attempt was superseded (retry/unmount) but the engine
              // booted anyway — WASM init cannot be cancelled. Stop it now:
              // a dataless instance on the shared canvas renders an empty sky
              // over the live instance and corrupts shared GL state.
              destroyEngineInstance(stel);
              return;
            }
            try {
              initStellarium(stel, sessionId);
              resolved = true;
              signal.removeEventListener('abort', onAbort);
              resolve();
            } catch (err) {
              resolved = true;
              signal.removeEventListener('abort', onAbort);
              reject(err);
            }
          },
        }) as unknown;

        // Handle if StelWebEngine returns a promise (for error handling)
        if (engineResult && typeof (engineResult as Promise<unknown>).then === 'function') {
          (engineResult as Promise<unknown>).catch((err: unknown) => {
            if (!resolved) {
              resolved = true;
              signal.removeEventListener('abort', onAbort);
              reject(err);
            }
          });
        }
      } catch (err) {
        if (!resolved) {
          resolved = true;
          signal.removeEventListener('abort', onAbort);
          reject(err);
        }
      }
    });
  }, [canvasRef, initStellarium, t]);

  const createStageError = useCallback((stage: LoaderStage, error: unknown): LoaderStageError => {
    const message = error instanceof Error ? error.message : t('loadFailed');
    const stagedError = new Error(message) as LoaderStageError;
    stagedError.stage = stage;
    return stagedError;
  }, [t]);

  // Main loading function with retry support
  const startLoading = useCallback(async () => {
    if (!mountedRef.current) return;

    // Prevent concurrent initialization
    if (initializingRef.current) return;
    initializingRef.current = true;

    retryObserverRef.current?.disconnect();
    retryObserverRef.current = null;
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Create abort controller for this load attempt
    abortControllerRef.current?.abort();
    const loadAbortController = new AbortController();
    abortControllerRef.current = loadAbortController;

    // Any instance from a previous attempt is superseded. Stop it before
    // booting a new one — two live instances on the same canvas share one GL
    // context and fight over it (black/corrupted map that only a full page
    // reload used to fix).
    for (const engine of createdEnginesRef.current) {
      destroyEngineInstance(engine);
    }
    createdEnginesRef.current.clear();

    const bootstrapStore = useStarmapBootstrapStore.getState();
    const bootstrapSessionId = bootstrapStore.beginSession();
    bootstrapStore.markResourceLoading('engine_core', { sessionId: bootstrapSessionId });
    if (bootstrapStore.warmStartUsed || window.StelWebEngine) {
      recordBootstrapStage('engine_core.warm_reuse', 'complete', {
        sessionId: bootstrapSessionId,
        classification: 'deferred',
        reason: bootstrapStore.warmStartUsed ? 'previous_ready_session' : 'script_runtime_reuse',
      });
    }
    recordBootstrapStage('engine_core.session', 'start', { sessionId: bootstrapSessionId, classification: 'blocking' });
    logger.debug('Starmap bootstrap in progress', { sessionId: bootstrapSessionId });

    // Set loading session window once. Keep the same deadline across retries.
    if (overallDeadlineRef.current === 0) {
      const startedAt = Date.now();
      overallDeadlineRef.current = startedAt + OVERALL_LOADING_TIMEOUT;
      setLoadingStartTime(startedAt);

      if (overallTimeoutRef.current !== null) {
        window.clearTimeout(overallTimeoutRef.current);
      }
      overallTimeoutRef.current = window.setTimeout(() => {
        if (!mountedRef.current) return;
        abortControllerRef.current?.abort();
        initializingRef.current = false;
        setErrorMessage(t('overallTimeout'));
        setIsLoading(false);
        setLoadingPhase('timed_out');
        setLoadingErrorCode('overall_timeout');
        const timeoutStore = useStarmapBootstrapStore.getState();
        timeoutStore.recordStageEvent('engine_core.deadline', 'failed', {
          sessionId: bootstrapSessionId,
          classification: 'blocking',
          reason: 'overall_timeout',
        });
        timeoutStore.markResourceFailed('engine_core', 'overall_timeout', { sessionId: bootstrapSessionId });
      }, OVERALL_LOADING_TIMEOUT);
    }

    if (mountedRef.current) {
      setErrorMessage(null);
      setLoadingErrorCode(null);
      setIsLoading(true);
      setLoadingStatus(t('preparingResources'));
      setLoadingProgress(5);
      setLoadingPhase('preparing');
      recordBootstrapStage('engine_core.preparing', 'start', { sessionId: bootstrapSessionId, classification: 'blocking' });
    }

    let shouldRetry = false;

    try {
      // Step 1: Setup canvas
      if (!canvasRef.current || !containerRef.current) {
        setLoadingStatus(t('canvasContainerNotReady'));
        setLoadingPhase('failed');
        setLoadingErrorCode('container_not_ready');
        recordBootstrapStage('engine_core.container', 'failed', {
          sessionId: bootstrapSessionId,
          classification: 'blocking',
          reason: 'container_not_ready',
        });
        shouldRetry = true;
      } else {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
          setLoadingStatus(t('canvasContainerNotReady'));
          setLoadingPhase('failed');
          setLoadingErrorCode('container_not_ready');
          recordBootstrapStage('engine_core.container', 'failed', {
            sessionId: bootstrapSessionId,
            classification: 'blocking',
            reason: 'container_not_ready',
          });
          shouldRetry = true;
        } else {
          const dpr = getEffectiveDpr(getRenderQuality());
          canvas.width = Math.round(rect.width * dpr);
          canvas.height = Math.round(rect.height * dpr);

          // Step 2: Hint browser to prefetch WASM (non-blocking, no await).
          // The actual WASM fetch is performed by StelWebEngine via
          // WebAssembly.instantiateStreaming; this hint just warms the HTTP cache.
          setLoadingStatus(t('preparingResources'));
          setLoadingProgress(10);
          setLoadingPhase('preparing');
          recordBootstrapStage('engine_core.preparing', 'complete', {
            sessionId: bootstrapSessionId,
            classification: 'blocking',
          });
          const wasmPath = resolveAssetPath(WASM_PATH, assetPathModeRef.current);
          if (!document.querySelector('link[href$=".wasm"][rel="prefetch"]')) {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'fetch';
            link.href = wasmPath;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
          }

          // Step 3: Load script
          setLoadingStatus(t('loadingScript'));
          setLoadingProgress(20);
          setLoadingPhase('loading_script');
          recordBootstrapStage('engine_core.loading_script', 'start', {
            sessionId: bootstrapSessionId,
            classification: 'blocking',
          });
          try {
            await loadScript(loadAbortController.signal);
            recordBootstrapStage('engine_core.loading_script', 'complete', {
              sessionId: bootstrapSessionId,
              classification: 'blocking',
            });
          } catch (error) {
            if (isAbortError(error)) throw error;
            throw createStageError('script', error);
          }

          // Check if aborted
          if (loadAbortController.signal.aborted || !mountedRef.current) {
            return;
          }

          // Step 4: Initialize WASM engine
          setLoadingStatus(t('initializingStarmap'));
          setLoadingProgress(40);
          setLoadingPhase('initializing_engine');
          recordBootstrapStage('engine_core.initialization', 'start', {
            sessionId: bootstrapSessionId,
            classification: 'blocking',
          });
          try {
            await withTimeout(
              initializeEngine(loadAbortController.signal, bootstrapSessionId),
              WASM_INIT_TIMEOUT,
              t('starmapInitTimedOut')
            );
          } catch (error) {
            if (isAbortError(error)) throw error;
            throw createStageError('engine', error);
          }

          // Check if aborted
          if (loadAbortController.signal.aborted || !mountedRef.current) {
            return;
          }

          // Success
          if (mountedRef.current) {
            setLoadingProgress(100);
            setIsLoading(false);
            setErrorMessage(null);
            setLoadingErrorCode(null);
            setLoadingPhase('ready');
          }
          retryCountRef.current = 0;
          overallDeadlineRef.current = 0;
          if (overallTimeoutRef.current !== null) {
            window.clearTimeout(overallTimeoutRef.current);
            overallTimeoutRef.current = null;
          }
        }
      }

    } catch (err) {
      const stage = err instanceof Error && 'stage' in err
        ? (err as LoaderStageError).stage
        : null;
      if (isAbortError(err)) {
        return;
      }
      if (stage === 'script' || stage === 'engine') {
        logger.error('Error loading star map', err);
      } else {
        logger.warn('Stellarium loader waiting for runtime readiness', err);
      }
      
      // Check if aborted (component unmounted)
      if (loadAbortController.signal.aborted || !mountedRef.current) {
        return;
      }

      const errorMsg = err instanceof Error ? err.message : t('loadFailed');
      
      // Auto-retry if under limit and within overall deadline
      const withinDeadline = Date.now() < overallDeadlineRef.current;
      if (retryCountRef.current < MAX_RETRY_COUNT && withinDeadline) {
        retryCountRef.current++;
        setLoadingStatus(t('retrying', { current: retryCountRef.current, max: MAX_RETRY_COUNT }));
        setLoadingPhase('retrying');
        useStarmapBootstrapStore.getState().markResourceRetry(
          'engine_core',
          retryCountRef.current,
          normalizeErrorMessage(err),
          { sessionId: bootstrapSessionId }
        );
        shouldRetry = true;
      } else {
        // Max retries or overall deadline exceeded
        if (mountedRef.current) {
          const didTimeOut = !withinDeadline;
          const classifiedCode = didTimeOut
            ? 'overall_timeout'
            : classifyLoaderFailure(stage, errorMsg, t('scriptLoadTimedOut'), t('starmapInitTimedOut'));
          setErrorMessage(didTimeOut ? t('overallTimeout') : errorMsg);
          setIsLoading(false);
          setLoadingPhase(didTimeOut ? 'timed_out' : 'degraded');
          setLoadingErrorCode(classifiedCode);
          recordBootstrapStage('engine_core.terminal', 'failed', {
            sessionId: bootstrapSessionId,
            classification: 'blocking',
            attempt: retryCountRef.current,
            reason: `${classifiedCode}:${errorMsg}`,
          });
          useStarmapBootstrapStore.getState().markResourceFailed(
            'engine_core',
            `${classifiedCode}:${errorMsg}`,
            { sessionId: bootstrapSessionId }
          );
        }
        overallDeadlineRef.current = 0;
        if (overallTimeoutRef.current !== null) {
          window.clearTimeout(overallTimeoutRef.current);
          overallTimeoutRef.current = null;
        }
      }
    } finally {
      initializingRef.current = false;
    }

    if (shouldRetry && mountedRef.current && !loadAbortController.signal.aborted) {
      const withinDeadline = Date.now() < overallDeadlineRef.current;
      if (!withinDeadline) {
        if (mountedRef.current) {
          setErrorMessage(t('overallTimeout'));
          setIsLoading(false);
          setLoadingPhase('timed_out');
          setLoadingErrorCode('overall_timeout');
          recordBootstrapStage('engine_core.deadline', 'failed', {
            sessionId: bootstrapSessionId,
            classification: 'blocking',
            reason: 'overall_timeout',
          });
          useStarmapBootstrapStore.getState().markResourceFailed('engine_core', 'overall_timeout', {
            sessionId: bootstrapSessionId,
          });
        }
        overallDeadlineRef.current = 0;
        if (overallTimeoutRef.current !== null) {
          window.clearTimeout(overallTimeoutRef.current);
          overallTimeoutRef.current = null;
        }
      } else if (containerRef.current) {
        // Use ResizeObserver to retry as soon as the container has a non-zero size,
        // instead of a fixed 1s poll delay.
        const obs = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            if (retryTimeoutRef.current !== null) {
              window.clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = null;
            }
            obs.disconnect();
            if (retryObserverRef.current === obs) {
              retryObserverRef.current = null;
            }
            if (mountedRef.current && !loadAbortController.signal.aborted) {
              void startLoading();
            }
          }
        });
        retryObserverRef.current = obs;
        obs.observe(containerRef.current);
        // Safety fallback: if observer doesn't fire within RETRY_DELAY_MS, use timeout
        retryTimeoutRef.current = window.setTimeout(() => {
          obs.disconnect();
          if (retryObserverRef.current === obs) {
            retryObserverRef.current = null;
          }
          retryTimeoutRef.current = null;
          if (mountedRef.current && !loadAbortController.signal.aborted) {
            void startLoading();
          }
        }, RETRY_DELAY_MS);
      } else {
        retryTimeoutRef.current = window.setTimeout(() => {
          retryTimeoutRef.current = null;
          if (mountedRef.current && !loadAbortController.signal.aborted) {
            void startLoading();
          }
        }, RETRY_DELAY_MS);
      }
    }
  }, [
    containerRef,
    canvasRef,
    createStageError,
    loadScript,
    initializeEngine,
    t,
    getRenderQuality,
    recordBootstrapStage,
  ]);

  // Retry loading (user-triggered)
  const handleRetry = useCallback(() => {
    useStarmapBootstrapStore.getState().requestRecovery();
    abortControllerRef.current?.abort();
    retryObserverRef.current?.disconnect();
    retryObserverRef.current = null;
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (overallTimeoutRef.current !== null) {
      window.clearTimeout(overallTimeoutRef.current);
      overallTimeoutRef.current = null;
    }
    clearStellariumScriptTags();
    retryCountRef.current = 0;
    overallDeadlineRef.current = 0;
    initializingRef.current = false;
    assetPathModeRef.current = 'absolute';
    void startLoading();
  }, [startLoading]);

  // Debug: Force reload the engine (clears current engine and restarts)
  const reloadEngine = useCallback(() => {
    logger.debug('Reloading Stellarium engine...');
    useStarmapBootstrapStore.getState().requestRecovery();
    
    // Abort any ongoing loading
    abortControllerRef.current?.abort();
    retryObserverRef.current?.disconnect();
    retryObserverRef.current = null;
    if (retryTimeoutRef.current !== null) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (overallTimeoutRef.current !== null) {
      window.clearTimeout(overallTimeoutRef.current);
      overallTimeoutRef.current = null;
    }
    
    // Clear current engine
    if (stelRef.current) {
      (stelRef as React.MutableRefObject<StellariumEngine | null>).current = null;
      setStel(null);
    }
    
    // Remove existing script to force reload
    clearStellariumScriptTags();
    
    // Clear StelWebEngine from window
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;
    
    // Reset state
    setEngineReady(false);
    retryCountRef.current = 0;
    overallDeadlineRef.current = 0;
    initializingRef.current = false;
    assetPathModeRef.current = 'absolute';
    
    // Start fresh loading
    void startLoading();
  }, [stelRef, startLoading, setStel]);

  return {
    loadingState: {
      isLoading,
      loadingStatus,
      errorMessage,
      startTime: loadingStartTime,
      progress: loadingProgress,
      phase: loadingPhase,
      errorCode: loadingErrorCode,
      retryCount: retryCountRef.current,
      tierReadiness,
    },
    engineReady,
    startLoading,
    handleRetry,
    reloadEngine,
  };
}
