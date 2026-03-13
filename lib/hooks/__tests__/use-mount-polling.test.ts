/**
 * Tests for use-mount-polling.ts
 * Mount state polling hook
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { useMountPolling } from '../use-mount-polling';

const mockApplyMountState = jest.fn();
const mockResetMountInfo = jest.fn();
const mockMarkDegraded = jest.fn();
const mockMarkFailed = jest.fn();
const mockMarkConnected = jest.fn();
const mockDisconnectConnection = jest.fn();

let connected = false;

jest.mock('@/lib/stores', () => ({
  useMountStore: jest.fn((selector) =>
    selector({
      mountInfo: { Connected: connected },
      applyMountState: mockApplyMountState,
      resetMountInfo: mockResetMountInfo,
    })
  ),
}));

jest.mock('@/lib/stores/device-store', () => ({
  PRIMARY_MOUNT_DEVICE_PROFILE_ID: 'mount-primary',
  useDeviceStore: jest.fn((selector) =>
    selector({
      markDegraded: mockMarkDegraded,
      markFailed: mockMarkFailed,
      markConnected: mockMarkConnected,
      disconnectConnection: mockDisconnectConnection,
    })
  ),
}));

jest.mock('@/lib/tauri/mount-api', () => ({
  mountApi: {
    getState: jest.fn(() => Promise.resolve({ connected: false })),
  },
}));

const mockIsTauri = jest.fn(() => false);
jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('useMountPolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    connected = false;
    mockIsTauri.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should not throw when rendered', () => {
    expect(() => {
      renderHook(() => useMountPolling());
    }).not.toThrow();
  });

  it('should accept custom interval', () => {
    expect(() => {
      renderHook(() => useMountPolling(3000));
    }).not.toThrow();
  });

  it('marks a connected mount as degraded after a transient poll failure', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { getState: jest.Mock };
    };

    connected = true;
    mockIsTauri.mockReturnValue(true);
    mountApi.getState
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue({
        connected: true,
        ra: 15,
        dec: 25,
        tracking: true,
        trackingRate: 'sidereal',
        slewing: false,
        parked: false,
        atHome: false,
        pierSide: 'west',
        slewRateIndex: 3,
      });

    renderHook(() => useMountPolling(50));

    await act(async () => {
      jest.advanceTimersByTime(60);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockMarkDegraded).toHaveBeenCalled();
    });
    expect(mockMarkFailed).not.toHaveBeenCalled();
  });

  it('marks a mount as failed after repeated polling failures', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { getState: jest.Mock };
    };

    connected = true;
    mockIsTauri.mockReturnValue(true);
    mountApi.getState.mockRejectedValue(new Error('transport down'));

    renderHook(() => useMountPolling(50));

    await act(async () => {
      jest.advanceTimersByTime(220);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockMarkFailed).toHaveBeenCalled();
    });
    expect(mockResetMountInfo).toHaveBeenCalled();
  });
});
