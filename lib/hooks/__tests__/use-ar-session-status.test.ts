/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useARSessionStatus } from '../use-ar-session-status';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import {
  DEFAULT_AR_CAMERA_RUNTIME_STATE,
  DEFAULT_AR_SENSOR_RUNTIME_STATE,
} from '@/lib/core/ar-session';
import { DEFAULT_AR_LAUNCH_ASSISTANT_STATE } from '@/lib/core/ar-launch-assistant';

describe('useARSessionStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();

    useSettingsStore.setState((state) => ({
      stellarium: {
        ...state.stellarium,
        arMode: true,
        arShowCompass: true,
      },
    }));

    useARRuntimeStore.setState({
      camera: {
        ...DEFAULT_AR_CAMERA_RUNTIME_STATE,
        isSupported: true,
        isLoading: false,
        hasStream: true,
        errorType: null,
      },
      sensor: {
        ...DEFAULT_AR_SENSOR_RUNTIME_STATE,
        isSupported: true,
        isPermissionGranted: true,
        status: 'active',
        calibrationRequired: false,
      },
      launchAssistant: DEFAULT_AR_LAUNCH_ASSISTANT_STATE,
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('enters stabilization hold when transitioning from ready to failure state', async () => {
    const { result } = renderHook(() => useARSessionStatus({ enabled: true }));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    act(() => {
      useARRuntimeStore.getState().setSensorRuntime({
        isPermissionGranted: false,
        status: 'permission-denied',
      });
    });

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
      expect(result.current.isStabilizing).toBe(true);
    });

    expect(result.current.rawStatus).toBe('degraded-camera-only');
  });

  it('auto-closes launch assistant when session is ready', async () => {
    act(() => {
      useARRuntimeStore.getState().openLaunchAssistant('enter-ar');
    });

    renderHook(() => useARSessionStatus({ enabled: true }));

    expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(true);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    await waitFor(() => {
      expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(false);
    });
  });
});
