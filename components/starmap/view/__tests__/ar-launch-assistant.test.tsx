/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import type { ARRecoveryAction } from '@/lib/core/ar-session';
import { ARLaunchAssistant } from '../ar-launch-assistant';

const mockSetStellariumSetting = jest.fn();
const mockOpenSettingsDrawer = jest.fn();

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

describe('ARLaunchAssistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('renders launch assistant checklist and diagnostics when visible', () => {
    render(<ARLaunchAssistant />);

    expect(screen.getByTestId('ar-launch-assistant')).toBeInTheDocument();
    expect(screen.getByText('Back Camera')).toBeInTheDocument();
    expect(screen.getByTestId('ar-launch-check-sensor')).toBeInTheDocument();
  });

  it('allows explicit degraded continuation', () => {
    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-continue-degraded'));

    expect(useARRuntimeStore.getState().launchAssistant.degradedConfirmed).toBe(true);
    expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(false);
  });

  it('dispatches shared recovery actions from launch assistant', async () => {
    render(<ARLaunchAssistant />);

    fireEvent.click(screen.getByTestId('ar-launch-action-request-sensor-permission'));

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
});
