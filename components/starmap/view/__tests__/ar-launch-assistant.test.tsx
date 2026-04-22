/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import type { ARRecoveryAction } from '@/lib/core/ar-session';
import { ARLaunchAssistant } from '../ar-launch-assistant';

const originalConsoleError = console.error;

const mockSetStellariumSetting = jest.fn();
const mockOpenSettingsDrawer = jest.fn();
let mockAssistantMode: 'floating-card' | 'edge-sheet' | 'compact-strip' = 'edge-sheet';
let mockSensorPath: 'sensor-primary' | 'camera-primary' | 'manual-only' = 'sensor-primary';
let mockRuntimeClass: 'browser-mobile' | 'browser-desktop' | 'tauri-desktop' = 'browser-mobile';
let mockOperatingMode: 'sensor-first' | 'camera-first' | 'manual-first' = 'sensor-first';

jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: (selector: (state: { setStellariumSetting: (key: string, value: unknown) => void }) => unknown) =>
    selector({
      setStellariumSetting: mockSetStellariumSetting,
    }),
}));

jest.mock('@/lib/stores', () => ({
  useOnboardingBridgeStore: (selector: (state: { openSettingsDrawer: (tab?: string) => void }) => unknown) =>
    selector({
      openSettingsDrawer: mockOpenSettingsDrawer,
    }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: mockAssistantMode,
    recoveryMode: 'compact-strip',
    cameraControlMode: 'compact-strip',
    sensorPath: mockSensorPath,
    runtimeClass: mockRuntimeClass,
    operatingMode: mockOperatingMode,
    layoutTier: 'phone-compact',
    controlDensity: 'compact',
    capabilityTier: 'limited',
    isLandscape: false,
    isViewportReduced: false,
    viewportWidth: 390,
    viewportHeight: 844,
    safeAreaInsets: { top: 24, right: 0, bottom: 34, left: 0 },
  }),
}));

describe('ARLaunchAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    mockAssistantMode = 'edge-sheet';
    mockSensorPath = 'sensor-primary';
    mockRuntimeClass = 'browser-mobile';
    mockOperatingMode = 'sensor-first';
    useARRuntimeStore.getState().resetRecoveryState();
    useARRuntimeStore.getState().openLaunchAssistant('enter-ar');
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        availableDevices: [
          { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
          { deviceId: 'cam-wide', label: 'Wide Camera', groupId: 'g2' },
        ],
        acquisitionDiagnostics: {
          ...state.camera.acquisitionDiagnostics,
          activeDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
          currentStage: 'preferred-device',
        },
      },
      launchAssistant: {
        ...state.launchAssistant,
        visible: true,
        phase: 'sensor-check',
        outcome: 'degraded',
        checks: [
          { key: 'camera', status: 'pass', titleKey: 'settings.arLaunchCameraCheck', detailKey: 'settings.arStatusReady' },
          { key: 'sensor', status: 'block', titleKey: 'settings.arLaunchSensorCheck', detailKey: 'settings.sensorControlPermission' },
          { key: 'calibration', status: 'pending', titleKey: 'settings.arLaunchCalibrationCheck', detailKey: 'settings.sensorCalibrationRequired' },
        ],
        summaryActions: ['request-sensor-permission', 'disable-ar'] as ARRecoveryAction[],
        degradedConfirmed: false,
      },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders launch assistant checklist and diagnostics when visible', () => {
    render(<ARLaunchAssistant />);

    expect(screen.getByTestId('ar-launch-assistant')).toBeInTheDocument();
    expect(screen.getAllByText('Back Camera').length).toBeGreaterThan(0);
    expect(screen.getByTestId('ar-launch-check-sensor')).toBeInTheDocument();
  });

  it('allows explicit degraded continuation', () => {
    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-continue-degraded'));

    expect(useARRuntimeStore.getState().launchAssistant.degradedConfirmed).toBe(true);
    expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(false);
  });

  it('dispatches shared recovery actions from launch assistant', async () => {
    const user = userEvent.setup();
    render(<ARLaunchAssistant />);

    await act(async () => {
      await user.click(screen.getByTestId('ar-launch-action-request-sensor-permission'));
    });

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['request-sensor-permission']).toBe(1);
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBe('settings.arRecoveryNoticeSensorPermissionRequested');
    });
    expect(screen.getByTestId('ar-launch-recovery-notice')).toBeInTheDocument();
  });

  it('updates preferred device and requests retry when selecting a camera', () => {
    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-device-cam-wide'));

    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arCameraPreferredDevice', {
      deviceId: 'cam-wide',
      label: 'Wide Camera',
      groupId: 'g2',
    });
    expect(useARRuntimeStore.getState().recoveryRequestVersion['retry-camera']).toBe(1);
  });

  it('exposes adaptation metadata for compact launch presentation', () => {
    mockAssistantMode = 'edge-sheet';
    mockSensorPath = 'camera-primary';
    mockRuntimeClass = 'tauri-desktop';
    mockOperatingMode = 'camera-first';

    render(<ARLaunchAssistant />);

    expect(screen.getByTestId('ar-launch-assistant')).toHaveAttribute('data-ar-assistant-mode', 'edge-sheet');
    expect(screen.getByTestId('ar-launch-assistant')).toHaveAttribute('data-ar-sensor-path', 'camera-primary');
    expect(screen.getByTestId('ar-launch-assistant')).toHaveAttribute('data-ar-sticky-actions', 'true');
    expect(screen.getByTestId('ar-launch-assistant')).toHaveAttribute('data-ar-operating-mode', 'camera-first');
    expect(screen.getAllByText('settings.arAdaptationCameraFirst').length).toBeGreaterThan(0);
  });

  it('surfaces manual-first desktop guidance when no viable AR sensor or camera path exists', () => {
    mockAssistantMode = 'floating-card';
    mockSensorPath = 'manual-only';
    mockRuntimeClass = 'browser-desktop';
    mockOperatingMode = 'manual-first';

    render(<ARLaunchAssistant />);

    expect(screen.getByTestId('ar-launch-assistant')).toHaveAttribute('data-ar-operating-mode', 'manual-first');
    expect(screen.getAllByText('settings.arAdaptationManualOnly').length).toBeGreaterThan(0);
  });

  it('shows remembered-plan diagnostics using the shared summary contract', () => {
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        acquisitionDiagnostics: {
          ...state.camera.acquisitionDiagnostics,
          currentStage: 'remembered-device',
          usedRememberedPlan: true,
          lastFailureStage: 'requested-facing-mode-safe',
        },
      },
    }));

    render(<ARLaunchAssistant />);

    expect(screen.getByTestId('ar-launch-assistant').textContent).toContain('settings.arCameraRememberedPlan');
  });

  it('closes the assistant when the dismiss button is clicked', () => {
    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-close'));

    expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(false);
  });

  it('marks the assistant as resumed when the page becomes visible again', () => {
    const before = useARRuntimeStore.getState().launchAssistant.resumeCount;
    render(<ARLaunchAssistant />);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(useARRuntimeStore.getState().launchAssistant.resumeCount).toBe(before + 1);
  });

  it('dispatches switch-camera and calibrate-sensor actions through shared recovery handlers', async () => {
    useARRuntimeStore.setState((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        summaryActions: ['switch-camera', 'calibrate-sensor'],
      },
    }));

    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-action-switch-camera'));
    fireEvent.click(screen.getByTestId('ar-launch-action-calibrate-sensor'));

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['switch-camera']).toBe(1);
      expect(useARRuntimeStore.getState().recoveryRequestVersion['calibrate-sensor']).toBe(1);
    });
  });

  it('opens camera settings and reverts the profile from launch assistant actions', async () => {
    useARRuntimeStore.setState((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        summaryActions: ['open-camera-settings', 'revert-last-known-good-profile'],
      },
    }));

    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-action-open-camera-settings'));
    fireEvent.click(screen.getByTestId('ar-launch-action-revert-last-known-good-profile'));

    expect(mockOpenSettingsDrawer).toHaveBeenCalledWith('display');
    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['revert-last-known-good-profile']).toBe(1);
    });
  });

  it('disables AR from the launch assistant summary action', () => {
    useARRuntimeStore.setState((state) => ({
      launchAssistant: {
        ...state.launchAssistant,
        summaryActions: ['disable-ar'],
      },
    }));

    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-action-disable-ar'));

    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', false);
  });
});
