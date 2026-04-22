/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { altAzToRaDec } from '@/lib/astronomy/coordinates/transforms';
import {
  __resetDeviceOrientationPermissionCacheForTests,
  useDeviceOrientation,
} from '../use-device-orientation';

type RequestPermissionFn = jest.Mock<Promise<string>, [boolean?]>;

function createOrientationEvent(
  type: string,
  payload: Partial<DeviceOrientationEvent> & {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  } = {}
): DeviceOrientationEvent {
  const event = new Event(type) as DeviceOrientationEvent & {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  };
  Object.assign(event, payload);
  return event;
}

describe('useDeviceOrientation', () => {
  let originalDeviceOrientationEvent: unknown;
  let originalScreenOrientation: ScreenOrientation | undefined;
  let originalPermissions: Permissions | undefined;
  let requestPermissionMock: RequestPermissionFn;
  let permissionsState: PermissionState;
  let permissionsQueryMock: jest.Mock;
  let rafSpy: jest.SpyInstance;
  let cafSpy: jest.SpyInstance;
  let visibilityState: DocumentVisibilityState = 'visible';

  beforeEach(() => {
    jest.clearAllMocks();
    __resetDeviceOrientationPermissionCacheForTests();
    originalDeviceOrientationEvent = (global as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent;
    originalScreenOrientation = window.screen.orientation;

    requestPermissionMock = jest.fn().mockResolvedValue('granted');
    (global as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {
      static requestPermission = requestPermissionMock;
    };

    originalPermissions = navigator.permissions;
    permissionsState = 'granted';
    permissionsQueryMock = jest.fn().mockImplementation(async () => ({
      state: permissionsState,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: {
        query: permissionsQueryMock,
      },
    });

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {
        angle: 0,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });

    rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0);
    });
    cafSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
      clearTimeout(handle);
    });
  });

  afterEach(() => {
    (global as unknown as { DeviceOrientationEvent?: unknown }).DeviceOrientationEvent = originalDeviceOrientationEvent;
    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: originalScreenOrientation,
    });
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: originalPermissions,
    });
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });

  it('returns the extended initial state shape', async () => {
    const { result } = renderHook(() => useDeviceOrientation());

    await waitFor(() => {
      expect(typeof result.current.isSupported).toBe('boolean');
    });

    expect(result.current.orientation).toBeNull();
    expect(result.current.skyDirection).toBeNull();
    expect(result.current.status).toBeDefined();
    expect(result.current.source).toBe('none');
    expect(result.current.accuracyDeg).toBeNull();
    expect(result.current.degradedReason).toBeNull();
    expect(result.current.calibration.required).toBe(true);
  });

  it('requests permission with absolute preference first', async () => {
    const { result } = renderHook(() => useDeviceOrientation());

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(requestPermissionMock).toHaveBeenCalled();
    expect(requestPermissionMock.mock.calls[0][0]).toBe(true);
    expect(result.current.isPermissionGranted).toBe(true);
  });

  it('handles denied permission and reports status', async () => {
    permissionsState = 'denied';
    requestPermissionMock.mockResolvedValueOnce('denied');
    requestPermissionMock.mockResolvedValueOnce('denied');

    const { result } = renderHook(() => useDeviceOrientation({ enabled: true }));

    await act(async () => {
      await result.current.requestPermission();
    });

    expect(result.current.isPermissionGranted).toBe(false);
    expect(result.current.status).toBe('permission-denied');
  });

  it('prioritizes deviceorientationabsolute source and emits active status', async () => {
    const onOrientationChange = jest.fn();
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        smoothingFactor: 1,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
        onOrientationChange,
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientationabsolute', {
          alpha: 45,
          beta: 30,
          gamma: 15,
          absolute: true,
        })
      );
    });

    await waitFor(() => {
      expect(onOrientationChange).toHaveBeenCalled();
      expect(result.current.source).toBe('deviceorientationabsolute');
      expect(result.current.status).toBe('active');
    });
  });

  it('uses webkit compass heading fallback when available', async () => {
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        useCompassHeading: true,
        absolutePreferred: false,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 120,
          beta: 45,
          gamma: 5,
          absolute: false,
          webkitCompassHeading: 12,
          webkitCompassAccuracy: 6,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.source).toBe('webkitCompassHeading');
      expect(result.current.accuracyDeg).toBe(6);
      expect(result.current.skyDirection).not.toBeNull();
    });
  });

  it('compensates screen orientation changes', async () => {
    const directions: Array<{ azimuth: number; altitude: number }> = [];
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        smoothingFactor: 1,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
        onOrientationChange: (direction) => directions.push(direction),
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 0,
          beta: 90,
          gamma: 0,
          absolute: false,
        })
      );
    });

    await waitFor(() => {
      expect(directions.length).toBeGreaterThan(0);
    });
    const first = directions[directions.length - 1];

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: {
        angle: 90,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });

    await act(async () => {
      window.dispatchEvent(new Event('orientationchange'));
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 0,
          beta: 90,
          gamma: 0,
          absolute: false,
        })
      );
    });

    await waitFor(() => {
      expect(directions.length).toBeGreaterThan(1);
    });
    const second = directions[directions.length - 1];
    expect(Math.round(first.azimuth)).toBe(0);
    expect(second.azimuth).toBeGreaterThan(30);
    expect(second.azimuth).toBeLessThan(100);
  });

  it('applies deadband to suppress tiny changes', async () => {
    const onOrientationChange = jest.fn();
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        deadbandDeg: 1.0,
        smoothingFactor: 1,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
        onOrientationChange,
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 20,
          beta: 60,
          gamma: 3,
          absolute: false,
        })
      );
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 20.2,
          beta: 60.1,
          gamma: 3,
          absolute: false,
        })
      );
    });

    await waitFor(() => {
      expect(onOrientationChange).toHaveBeenCalledTimes(1);
    });
  });

  it('marks session as degraded when non-absolute source is used under absolute preference', async () => {
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        absolutePreferred: true,
        smoothingFactor: 1,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 20,
          beta: 40,
          gamma: 5,
          absolute: false,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe('degraded');
      expect(result.current.degradedReason).toBe('relative-source');
    });
  });

  it('marks session as degraded on stale sensor samples', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    let now = 1_000;
    nowSpy.mockImplementation(() => now);
    try {
      const { result } = renderHook(() =>
        useDeviceOrientation({
          enabled: true,
          smoothingFactor: 1,
          calibration: {
            azimuthOffsetDeg: 0,
            altitudeOffsetDeg: 0,
            required: false,
            updatedAt: null,
          },
        })
      );

      await act(async () => {
        await result.current.requestPermission();
      });

      await act(async () => {
        window.dispatchEvent(
          createOrientationEvent('deviceorientationabsolute', {
            alpha: 50,
            beta: 30,
            gamma: 10,
            absolute: true,
          })
        );
      });

      await waitFor(() => {
        expect(result.current.status).toBe('active');
        expect(result.current.degradedReason).toBeNull();
      });

      now = 4_000;

      await waitFor(() => {
        expect(result.current.status).toBe('degraded');
        expect(result.current.degradedReason).toBe('stale-sample');
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('updates calibration from current view reference', async () => {
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: true,
          updatedAt: null,
        },
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientation', {
          alpha: 90,
          beta: 40,
          gamma: 10,
          absolute: false,
        })
      );
    });

    const latitude = 35;
    const longitude = 120;
    const measured = result.current.skyDirection ?? { altitude: 45, azimuth: 180 };
    const { ra, dec } = altAzToRaDec(measured.altitude, measured.azimuth, latitude, longitude);

    await act(async () => {
      result.current.calibrateToCurrentView({
        raDeg: ra,
        decDeg: dec,
        latitude,
        longitude,
        at: new Date(),
      });
    });

    expect(result.current.calibration.required).toBe(false);
    expect(Number.isFinite(result.current.calibration.azimuthOffsetDeg)).toBe(true);
    expect(Number.isFinite(result.current.calibration.altitudeOffsetDeg)).toBe(true);
    expect(result.current.calibration.updatedAt).not.toBeNull();
  });

  it('clears active sample when page is hidden and recovers on new sample', async () => {
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        smoothingFactor: 1,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await act(async () => {
      window.dispatchEvent(
        createOrientationEvent('deviceorientationabsolute', {
          alpha: 35,
          beta: 20,
          gamma: 10,
          absolute: true,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe('active');
      expect(result.current.skyDirection).not.toBeNull();
    });

    visibilityState = 'hidden';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(result.current.status).toBe('idle');
      expect(result.current.skyDirection).toBeNull();
      expect(result.current.source).toBe('none');
    });

    visibilityState = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(
        createOrientationEvent('deviceorientationabsolute', {
          alpha: 45,
          beta: 30,
          gamma: 15,
          absolute: true,
        })
      );
    });

    await waitFor(() => {
      expect(result.current.status).toBe('active');
      expect(result.current.skyDirection).not.toBeNull();
    });
  });

  it('revalidates permission on visibility and reflects revoked permission', async () => {
    const { result } = renderHook(() =>
      useDeviceOrientation({
        enabled: true,
        calibration: {
          azimuthOffsetDeg: 0,
          altitudeOffsetDeg: 0,
          required: false,
          updatedAt: null,
        },
      })
    );

    await act(async () => {
      await result.current.requestPermission();
    });

    await waitFor(() => {
      expect(result.current.isPermissionGranted).toBe(true);
    });

    permissionsState = 'denied';
    visibilityState = 'hidden';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    visibilityState = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(result.current.isPermissionGranted).toBe(false);
      expect(result.current.status).toBe('permission-denied');
      expect(result.current.error).toBe('Permission denied');
    });
  });

  it('times out permission request and keeps sensor in permission-required state', async () => {
    requestPermissionMock
      .mockRejectedValueOnce(new Error('Permission request timed out'))
      .mockRejectedValueOnce(new Error('Permission request timed out'));

    const { result } = renderHook(() => useDeviceOrientation({ enabled: true }));

    let granted = true;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(granted).toBe(false);
    expect(result.current.isPermissionGranted).toBe(false);
    expect(result.current.status).toBe('permission-required');
    expect(result.current.error).toBe('Permission request timed out');
  });

  it('downgrades likely desktop runtimes when no orientation samples ever arrive', async () => {
    jest.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    const originalMaxTouchPoints = window.navigator.maxTouchPoints;
    try {
      (global as unknown as { DeviceOrientationEvent: unknown }).DeviceOrientationEvent = class {};
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        configurable: true,
        value: 0,
      });
      window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)' ? false : false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const { result } = renderHook(() =>
        useDeviceOrientation({
          enabled: true,
          calibration: {
            azimuthOffsetDeg: 0,
            altitudeOffsetDeg: 0,
            required: false,
            updatedAt: null,
          },
        })
      );

      await act(async () => {
        jest.advanceTimersByTime(2500);
      });

      expect(result.current.isSupported).toBe(false);
      expect(result.current.status).toBe('unsupported');
    } finally {
      window.matchMedia = originalMatchMedia;
      Object.defineProperty(window.navigator, 'maxTouchPoints', {
        configurable: true,
        value: originalMaxTouchPoints,
      });
      jest.useRealTimers();
    }
  });
});
