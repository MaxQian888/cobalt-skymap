/**
 * @jest-environment jsdom
 *
 * Regression test for the dev-only "star map stuck on the loading overlay until
 * Ctrl+R" bug. React re-runs effects on the same instance in dev (Fast Refresh,
 * and StrictMode's mount→unmount→mount probe) while `useRef` values persist. The
 * loader's mounted-flag effect must therefore restore `mountedRef = true` on
 * setup; otherwise the cleanup latches it to `false` forever and every
 * `startLoading()` early-returns, hanging the loader.
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';

import { useStellariumLoader } from '../use-stellarium-loader';
import type { StellariumEngine } from '@/lib/core/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/translations', () => ({
  createStellariumTranslator: () => (s: string) => s,
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => false,
}));

jest.mock('@/lib/core/stellarium-canvas-utils', () => ({
  getEffectiveDpr: () => 1,
  withTimeout: <T,>(p: Promise<T>) => p,
  fovToRad: (deg: number) => deg,
}));

const bootstrapState = {
  resources: {},
  sessionId: 'session-1',
  warmStartUsed: false,
  beginSession: jest.fn(() => 'session-1'),
  markResourceLoading: jest.fn(),
  markResourceReady: jest.fn(),
  markResourceFailed: jest.fn(),
  markResourceRetry: jest.fn(),
  recordStageEvent: jest.fn(),
  requestRecovery: jest.fn(),
};
jest.mock('@/lib/stores/starmap-bootstrap-store', () => ({
  useStarmapBootstrapStore: Object.assign(
    jest.fn((selector: (s: typeof bootstrapState) => unknown) => selector(bootstrapState)),
    { getState: () => bootstrapState },
  ),
}));

const stellariumStoreState = {
  setStel: jest.fn(),
  setBaseUrl: jest.fn(),
  setHelpers: jest.fn(),
  updateStellariumCore: jest.fn(),
};
const settingsState = {
  stellarium: { skyCultureLanguage: 'native' },
  performance: { renderQuality: 'high' },
};
const mountState = {
  profileInfo: { AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 } },
};
jest.mock('@/lib/stores', () => ({
  useStellariumStore: Object.assign(
    jest.fn((selector: (s: typeof stellariumStoreState) => unknown) => selector(stellariumStoreState)),
    { getState: () => stellariumStoreState },
  ),
  useSettingsStore: Object.assign(
    jest.fn((selector: (s: typeof settingsState) => unknown) => selector(settingsState)),
    { getState: () => settingsState },
  ),
  useMountStore: Object.assign(
    jest.fn((selector: (s: typeof mountState) => unknown) => selector(mountState)),
    { getState: () => mountState },
  ),
}));

function createFakeEngine() {
  return {
    D2R: Math.PI / 180,
    core: {
      observer: { latitude: 0, longitude: 0, elevation: 0 },
      time_speed: 0,
      fov: 0,
      stars: {},
      skycultures: {},
      planets: {},
      dsos: {},
      dss: {},
      milkyway: {},
      minor_planets: {},
      comets: {},
      satellites: {},
    },
    change: jest.fn(),
  } as unknown as StellariumEngine;
}

describe('useStellariumLoader (dev effect re-run regression)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;
  });

  it('still loads after StrictMode re-runs effects (mountedRef restored on setup)', async () => {
    const factory = jest.fn((opts: { onReady: (stel: StellariumEngine) => void }) => {
      opts.onReady(createFakeEngine());
    });
    (window as unknown as { StelWebEngine: typeof factory }).StelWebEngine = factory;

    const container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;
    const canvas = document.createElement('canvas');

    const containerRef = { current: container } as React.RefObject<HTMLDivElement>;
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>;
    const stelRef = { current: null } as React.RefObject<StellariumEngine | null>;

    // StrictMode forces the mount→unmount→mount effect probe that poisons a
    // ref-based mounted flag if it is not restored on setup.
    const { result } = renderHook(
      () => useStellariumLoader({ containerRef, canvasRef, stelRef }),
      { wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> },
    );

    await act(async () => {
      await result.current.startLoading();
    });

    // Before the fix: startLoading would early-return on the latched mountedRef,
    // the engine factory is never invoked, and isLoading stays true forever.
    expect(factory).toHaveBeenCalledTimes(1);
    expect(result.current.loadingState.isLoading).toBe(false);
    expect(stelRef.current).not.toBeNull();
  });
});

describe('useStellariumLoader (engine instance lifecycle)', () => {
  function createRefs() {
    const container = document.createElement('div');
    container.getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON() {} }) as DOMRect;
    return {
      containerRef: { current: container } as React.RefObject<HTMLDivElement>,
      canvasRef: { current: document.createElement('canvas') } as React.RefObject<HTMLCanvasElement>,
      stelRef: { current: null } as React.RefObject<StellariumEngine | null>,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    delete (window as { StelWebEngine?: unknown }).StelWebEngine;
  });

  it('destroys an engine whose onReady fires after the loader unmounted (zombie)', async () => {
    // WASM init cannot be cancelled: capture onReady and fire it late.
    let lateOnReady: ((stel: StellariumEngine) => void) | null = null;
    const factory = jest.fn((opts: { onReady: (stel: StellariumEngine) => void }) => {
      lateOnReady = opts.onReady;
    });
    (window as unknown as { StelWebEngine: typeof factory }).StelWebEngine = factory;

    const refs = createRefs();
    const { result, unmount } = renderHook(() => useStellariumLoader(refs));

    await act(async () => {
      void result.current.startLoading();
      // Let loadScript resolve (StelWebEngine already present) and reach the factory.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(factory).toHaveBeenCalledTimes(1);

    unmount();

    const zombie = createFakeEngine();
    act(() => {
      lateOnReady!(zombie);
    });

    // The instance still booted a render loop; the flag is what stops it.
    expect(zombie.__skymapDestroyed).toBe(true);
    expect(refs.stelRef.current).toBeNull();
  });

  it('destroys the live engine on unmount (engine switch / navigation)', async () => {
    const engines: StellariumEngine[] = [];
    const factory = jest.fn((opts: { onReady: (stel: StellariumEngine) => void }) => {
      const engine = createFakeEngine();
      engines.push(engine);
      opts.onReady(engine);
    });
    (window as unknown as { StelWebEngine: typeof factory }).StelWebEngine = factory;

    const refs = createRefs();
    const { result, unmount } = renderHook(() => useStellariumLoader(refs));

    await act(async () => {
      await result.current.startLoading();
    });
    expect(engines).toHaveLength(1);
    expect(engines[0].__skymapDestroyed).toBeUndefined();

    unmount();

    expect(engines[0].__skymapDestroyed).toBe(true);
  });

  it('destroys the previous engine before a new load attempt supersedes it', async () => {
    const engines: StellariumEngine[] = [];
    const factory = jest.fn((opts: { onReady: (stel: StellariumEngine) => void }) => {
      const engine = createFakeEngine();
      engines.push(engine);
      opts.onReady(engine);
    });
    (window as unknown as { StelWebEngine: typeof factory }).StelWebEngine = factory;

    const refs = createRefs();
    const { result } = renderHook(() => useStellariumLoader(refs));

    await act(async () => {
      await result.current.startLoading();
    });
    expect(engines).toHaveLength(1);

    // User-triggered retry boots a second instance on the same canvas — the
    // first must be stopped or the two fight over the shared GL context.
    await act(async () => {
      result.current.handleRetry();
      await Promise.resolve();
    });

    expect(engines[0].__skymapDestroyed).toBe(true);
  });
});
