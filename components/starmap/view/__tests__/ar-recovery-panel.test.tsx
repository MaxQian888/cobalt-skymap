/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ARRecoveryPanel } from '../ar-recovery-panel';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';

const originalConsoleError = console.error;

const mockSetStellariumSetting = jest.fn();
const mockOpenSettingsDrawer = jest.fn();
let mockRecoveryMode: 'floating-card' | 'edge-sheet' | 'compact-strip' = 'compact-strip';
let mockRuntimeClass: 'browser-mobile' | 'browser-desktop' | 'tauri-desktop' = 'browser-mobile';
let mockSensorPath: 'sensor-primary' | 'camera-primary' | 'manual-only' = 'sensor-primary';
let mockOperatingMode: 'sensor-first' | 'camera-first' | 'manual-first' = 'sensor-first';

jest.mock('@/lib/stores', () => ({
  useSettingsStore: (selector: (state: { setStellariumSetting: (key: string, value: unknown) => void }) => unknown) =>
    selector({
      setStellariumSetting: mockSetStellariumSetting,
    }),
  useOnboardingBridgeStore: (selector: (state: { openSettingsDrawer: (tab?: string) => void }) => unknown) =>
    selector({
      openSettingsDrawer: mockOpenSettingsDrawer,
    }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: 'edge-sheet',
    recoveryMode: mockRecoveryMode,
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

describe('ARRecoveryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    mockRecoveryMode = 'compact-strip';
    mockRuntimeClass = 'browser-mobile';
    mockSensorPath = 'sensor-primary';
    mockOperatingMode = 'sensor-first';
    useARRuntimeStore.getState().resetRecoveryState();
    useMapInteractionStore.getState().reset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    act(() => {
      fireEvent.click(screen.getByTestId('ar-recovery-open-launch-assistant'));
    });
    expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(true);
  });

  it('dispatches retry-camera recovery action through shared handlers', async () => {
    const user = userEvent.setup();

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    await user.click(screen.getByTestId('ar-recovery-action-retry-camera'));

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['retry-camera']).toBe(1);
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBe('settings.arRecoveryNoticeRetryCameraRequested');
    });
  });

  it('reopens the guided assistant when retrying recovery actions from the panel', async () => {
    const user = userEvent.setup();

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    await user.click(screen.getByTestId('ar-recovery-action-retry-camera'));

    await waitFor(() => {
      expect(useARRuntimeStore.getState().launchAssistant.visible).toBe(true);
      expect(useARRuntimeStore.getState().launchAssistant.reason).toBe('recovery');
    });
  });

  it('disables AR when disable action is clicked', () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['disable-ar']}
      />
    );

    act(() => {
      fireEvent.click(screen.getByTestId('ar-recovery-action-disable-ar'));
    });
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', false);
  });
  it('dispatches switch-camera recovery action through shared handlers', async () => {
    const user = userEvent.setup();

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['switch-camera']}
      />
    );

    await user.click(screen.getByTestId('ar-recovery-action-switch-camera'));

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

  it('shows remembered-plan diagnostics with the shared summary contract', () => {
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        acquisitionDiagnostics: {
          currentStage: 'remembered-device',
          attemptedStages: ['remembered-device'],
          lastFailureStage: 'requested-facing-mode-safe',
          lastFailureMessage: 'Failed once',
          stalePreferredDevice: false,
          staleRememberedDevice: false,
          usedRememberedPlan: true,
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

    expect(screen.getByTestId('ar-recovery-diagnostics').textContent).toContain('settings.arCameraRememberedPlan');
  });

  it('records timestamp when recovery action is dispatched', () => {
    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    const before = Date.now();
    act(() => {
      fireEvent.click(screen.getByTestId('ar-recovery-action-retry-camera'));
    });
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

  it('surfaces manual-first desktop recovery guidance when sensor-driven AR is unavailable', () => {
    mockRecoveryMode = 'floating-card';
    mockRuntimeClass = 'tauri-desktop';
    mockSensorPath = 'manual-only';
    mockOperatingMode = 'manual-first';

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera', 'disable-ar']}
      />
    );

    expect(screen.getByTestId('ar-recovery-panel')).toHaveAttribute('data-ar-operating-mode', 'manual-first');
    expect(screen.getByText('settings.arAdaptationManualOnly')).toBeInTheDocument();
  });

  it('opens camera settings from the shared recovery handler', async () => {
    const user = userEvent.setup();

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['open-camera-settings']}
      />
    );

    await user.click(screen.getByTestId('ar-recovery-action-open-camera-settings'));

    expect(mockOpenSettingsDrawer).toHaveBeenCalledWith('display');
    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBe('settings.arRecoveryNoticeOpenCameraSettingsRequested');
    });
  });

  it('renders preserved observing context and allows returning to the target workflow', async () => {
    const user = userEvent.setup();

    useMapInteractionStore.getState().setSiteContext({
      kind: 'committed',
      sourceSurface: 'starmap',
      coordinates: { latitude: 35.6762, longitude: 139.6503 },
      summaryStatus: 'ready',
      displayName: 'Tokyo',
      actions: ['open-target-details'],
    });
    useMapInteractionStore.getState().setTargetContext({
      objectName: 'M31',
      primaryName: 'M31',
      aliases: ['Andromeda Galaxy'],
      ra: '00h 42m 44s',
      dec: '+41° 16\' 09"',
      raDeg: 10.6847,
      decDeg: 41.2689,
      type: 'Galaxy',
      sourceQuality: 'normal',
      siteName: 'Tokyo',
      siteCoordinates: { latitude: 35.6762, longitude: 139.6503 },
    });

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['retry-camera']}
      />
    );

    expect(screen.getByText(/M31/)).toBeInTheDocument();
    expect(screen.getByText(/Tokyo/)).toBeInTheDocument();

    await user.click(screen.getByTestId('ar-recovery-return-to-target'));

    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', false);
  });

  it('requests profile revert and renders stabilizing hint when asked', async () => {
    const user = userEvent.setup();

    render(
      <ARRecoveryPanel
        status="blocked"
        recoveryActions={['revert-last-known-good-profile']}
        isStabilizing={true}
      />
    );

    expect(screen.getByTestId('ar-recovery-stabilizing')).toBeInTheDocument();

    await user.click(screen.getByTestId('ar-recovery-action-revert-last-known-good-profile'));

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryRequestVersion['revert-last-known-good-profile']).toBe(1);
    });
  });

  it('clears a stale recovery notice once the session returns to ready', async () => {
    await act(async () => {
      useARRuntimeStore.getState().setRecoveryNoticeKey('settings.arRecoveryNoticeRetryCameraRequested');

      render(
        <ARRecoveryPanel
          status="ready"
          recoveryActions={[]}
        />
      );
    });

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBeNull();
    });
  });
});
