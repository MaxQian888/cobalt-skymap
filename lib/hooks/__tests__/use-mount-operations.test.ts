/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import { useMountOperations } from '../use-mount-operations';

const mockSetActiveTargetAction = jest.fn();
const mockClearActiveTargetAction = jest.fn();
const mockSetLatestCommandFailure = jest.fn();
const mockClearLatestCommandFailure = jest.fn();

const mountState = {
  mountInfo: {
    Connected: true,
    Tracking: false,
    Parked: false,
    Slewing: false,
  },
  blockedActionReasons: {} as Record<string, string | undefined>,
  activeTargetAction: null as null | {
    action: 'slew' | 'sync';
    targetName: string;
    ra: number;
    dec: number;
    source: string;
  },
  latestCommandFailure: null as null | { action: string; message: string; at: string },
  setActiveTargetAction: mockSetActiveTargetAction,
  clearActiveTargetAction: mockClearActiveTargetAction,
  setLatestCommandFailure: mockSetLatestCommandFailure,
  clearLatestCommandFailure: mockClearLatestCommandFailure,
};

type MockMountStore = jest.Mock<unknown, [(state: typeof mountState) => unknown]> & {
  getState: () => typeof mountState;
};

jest.mock('@/lib/stores', () => {
  const store = Object.assign(
    jest.fn((selector: (state: typeof mountState) => unknown) => selector(mountState)),
    {
      getState: () => mountState,
    }
  ) as MockMountStore;
  return {
    useMountStore: store,
  };
});

jest.mock('@/lib/tauri/mount-api', () => ({
  mountApi: {
    slewTo: jest.fn().mockResolvedValue(undefined),
    syncTo: jest.fn().mockResolvedValue(undefined),
    abortSlew: jest.fn().mockResolvedValue(undefined),
    setTracking: jest.fn().mockResolvedValue(undefined),
    park: jest.fn().mockResolvedValue(undefined),
    unpark: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: jest.fn(() => true),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
}));

describe('useMountOperations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mountState.mountInfo.Connected = true;
    mountState.mountInfo.Tracking = false;
    mountState.mountInfo.Parked = false;
    mountState.mountInfo.Slewing = false;
    mountState.blockedActionReasons = {};
    mountState.activeTargetAction = null;
    mountState.latestCommandFailure = null;
  });

  it('queues a target action in the mount store', () => {
    const { result } = renderHook(() => useMountOperations());

    act(() => {
      result.current.queueTargetAction({
        action: 'slew',
        targetName: 'M31',
        ra: 10.68,
        dec: 41.27,
        source: 'info-panel',
      });
    });

    expect(mockClearLatestCommandFailure).toHaveBeenCalled();
    expect(mockSetActiveTargetAction).toHaveBeenCalledWith({
      action: 'slew',
      targetName: 'M31',
      ra: 10.68,
      dec: 41.27,
      source: 'info-panel',
    });
  });

  it('executes sync actions through mountApi.syncTo and clears staged state', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { syncTo: jest.Mock };
    };
    mountState.activeTargetAction = {
      action: 'sync',
      targetName: 'M31',
      ra: 10.68,
      dec: 41.27,
      source: 'info-panel',
    };

    const { result } = renderHook(() => useMountOperations());

    await act(async () => {
      await result.current.executeTargetAction();
    });

    expect(mountApi.syncTo).toHaveBeenCalledWith(10.68, 41.27);
    expect(mockClearLatestCommandFailure).toHaveBeenCalled();
    expect(mockClearActiveTargetAction).toHaveBeenCalled();
  });

  it('blocks staged target actions when the action has a runtime blocked reason', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { syncTo: jest.Mock };
    };
    mountState.activeTargetAction = {
      action: 'sync',
      targetName: 'M31',
      ra: 10.68,
      dec: 41.27,
      source: 'info-panel',
    };
    mountState.blockedActionReasons = {
      sync: 'parked',
    };

    const { result } = renderHook(() => useMountOperations());

    await act(async () => {
      await result.current.executeTargetAction();
    });

    expect(mountApi.syncTo).not.toHaveBeenCalled();
    expect(mockSetLatestCommandFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'sync',
        message: 'blocked:parked',
      }),
    );
  });

  it('toggles tracking based on current mount state', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { setTracking: jest.Mock };
    };
    mountState.mountInfo.Tracking = false;

    const { result } = renderHook(() => useMountOperations());

    await act(async () => {
      await result.current.toggleTracking();
    });

    expect(mountApi.setTracking).toHaveBeenCalledWith(true);
  });

  it('parks or unparks based on the current parked state', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { unpark: jest.Mock };
    };
    mountState.mountInfo.Parked = true;

    const { result } = renderHook(() => useMountOperations());

    await act(async () => {
      await result.current.togglePark();
    });

    expect(mountApi.unpark).toHaveBeenCalled();
  });

  it('blocks abort when the mount is not slewing', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api') as {
      mountApi: { abortSlew: jest.Mock };
    };
    mountState.blockedActionReasons = {
      abortSlew: 'not-slewing',
    };

    const { result } = renderHook(() => useMountOperations());

    await act(async () => {
      await result.current.abortSlew();
    });

    expect(mountApi.abortSlew).not.toHaveBeenCalled();
    expect(mockSetLatestCommandFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'abortSlew',
        message: 'blocked:not-slewing',
      }),
    );
  });
});
