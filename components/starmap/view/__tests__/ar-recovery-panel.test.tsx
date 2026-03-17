/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ARRecoveryPanel } from '../ar-recovery-panel';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';

const mockSetStellariumSetting = jest.fn();
let mockRecoveryMode: 'floating-card' | 'edge-sheet' | 'compact-strip' = 'compact-strip';

jest.mock('@/lib/stores', () => ({
  useSettingsStore: (selector: (state: { setStellariumSetting: (key: string, value: unknown) => void }) => unknown) =>
    selector({
      setStellariumSetting: mockSetStellariumSetting,
    }),
  useOnboardingBridgeStore: (selector: (state: { openSettingsDrawer: (tab?: string) => void }) => unknown) =>
    selector({
      openSettingsDrawer: jest.fn(),
    }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: 'edge-sheet',
    recoveryMode: mockRecoveryMode,
    cameraControlMode: 'compact-strip',
    sensorPath: 'sensor-primary',
    runtimeClass: 'browser-mobile',
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

describe('ARRecoveryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoveryMode = 'compact-strip';
    useARRuntimeStore.getState().resetRecoveryState();
  });

  it('renders nothing when status is ready', () => {
    const { container } = render(
      <ARRecoveryPanel
        status="ready"
        recoveryActions={[]}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders recovery actions for degraded status', () => {
    render(
      <ARRecoveryPanel
        status="degraded-camera-only"
        recoveryActions={['request-sensor-permission', 'calibrate-sensor', 'disable-ar']}
      />
    );
    
    expect(screen.getByTestId('ar-recovery-panel')).toBeInTheDocument();
    expect(screen.getByTestId('ar-recovery-open-launch-assistant')).toBeInTheDocument();
    expect(screen.getByTestId('ar-recovery-action-request-sensor-permission')).toBeInTheDocument();
    expect(screen.getByTestId('ar-recovery-action-calibrate-sensor')).toBeInTheDocument();
    expect(screen.getByTestId('ar-recovery-action-disable-ar')).toBeInTheDocument();
  });

  it('reopens launch assistant from recovery panel', () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    fireEvent.click(screen.getByTestId('ar-recovery-open-launch-assistant'));
    expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(true);
  });

  it('dispatches retry-camera recovery action through shared handlers', async () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    fireEvent.click(screen.getByTestId('ar-recovery-action-retry-camera'));

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['retry-camera']).toBe(1);
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBe('settings.arRecoveryNoticeRetryCameraRequested');
    });
  });

  it('disables AR when disable action is clicked', () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['disable-ar']}
      />
    );

    fireEvent.click(screen.getByTestId('ar-recovery-action-disable-ar'));
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', false);
  });
  it('dispatches switch-camera recovery action through shared handlers', async () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['switch-camera']}
      />
    );

    fireEvent.click(screen.getByTestId('ar-recovery-action-switch-camera'));

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['switch-camera']).toBe(1);
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBe('settings.arRecoveryNoticeSwitchCameraRequested');
    });
  });

  it('renders acquisition diagnostics from runtime store', () => {
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        acquisitionDiagnostics: {
          currentStage: 'preferred-device',
          attemptedStages: ['preferred-device'],
          lastFailureStage: 'requested-facing-mode-safe',
          lastFailureMessage: 'Failed once',
          stalePreferredDevice: false,
          staleRememberedDevice: false,
          usedRememberedPlan: false,
          activeDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
        },
      },
    }));

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    expect(screen.getByText(/Back Camera/)).toBeInTheDocument();
  });

  it('records timestamp when recovery action is dispatched', () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    const before = Date.now();
    fireEvent.click(screen.getByTestId('ar-recovery-action-retry-camera'));
    const after = Date.now();

    const lastFired = useARRuntimeStore.getState().recoveryActionLastFiredAt['retry-camera'];
    expect(lastFired).toBeGreaterThanOrEqual(before);
    expect(lastFired).toBeLessThanOrEqual(after);
  });

  it('exposes adaptation metadata for compact recovery presentation', () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    expect(screen.getByTestId('ar-recovery-panel')).toHaveAttribute('data-ar-recovery-mode', 'compact-strip');
    expect(screen.getByTestId('ar-recovery-panel')).toHaveAttribute('data-ar-sticky-actions', 'true');
  });
});
