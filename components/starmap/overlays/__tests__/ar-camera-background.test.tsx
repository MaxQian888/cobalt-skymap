/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ARCameraBackground } from '../ar-camera-background';
import type { ARSessionStatus } from '@/lib/core/ar-session';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';

const mockStart = jest.fn();
const mockStop = jest.fn();
const mockSwitchCamera = jest.fn();
const mockToggleTorch = jest.fn();
const mockApplyProfileLayers = jest.fn();

let mockStream: MediaStream | null = null;
let mockIsLoading = false;
let mockError: string | null = null;
let mockErrorType: string | null = null;
let mockIsSupported = true;
let mockHasMultipleCameras = false;
let mockTorchOn = false;
let mockCapabilities: { torch?: boolean } = {};
let mockSessionStatus: ARSessionStatus = 'ready';
let mockCameraControlMode: 'floating-card' | 'edge-sheet' | 'compact-strip' = 'compact-strip';
let mockDevices: Array<{ deviceId: string; label: string; groupId: string }> = [];
let mockLastKnownGoodAcquisition: {
  deviceId: string | null;
  label: string | null;
  groupId: string | null;
  facingMode: 'environment' | 'user';
  stage: string | null;
  updatedAt: number | null;
} | null = null;
let mockAcquisitionDiagnostics: {
  currentStage: string | null;
  attemptedStages: string[];
  lastFailureStage: string | null;
  lastFailureMessage: string | null;
  stalePreferredDevice: boolean;
  staleRememberedDevice: boolean;
  usedRememberedPlan: boolean;
  activeDevice: { deviceId: string; label: string; groupId: string } | null;
} = {
  currentStage: null,
  attemptedStages: [],
  lastFailureStage: null,
  lastFailureMessage: null,
  stalePreferredDevice: false,
  staleRememberedDevice: false,
  usedRememberedPlan: false,
  activeDevice: null,
};
const mockSetStellariumSetting = jest.fn();

jest.mock('@/lib/hooks/use-camera', () => ({
  useCamera: () => ({
    stream: mockStream,
    isLoading: mockIsLoading,
    error: mockError,
    errorType: mockErrorType,
    facingMode: 'environment',
    devices: mockDevices,
    capabilities: mockCapabilities,
    normalizedCapabilities: null,
    effectiveProfile: null,
    profileResolution: null,
    profileApplyError: null,
    profileFallbackReason: null,
    lastKnownGoodProfile: null,
    lastKnownGoodAcquisition: mockLastKnownGoodAcquisition,
    acquisitionDiagnostics: mockAcquisitionDiagnostics,
    isSupported: mockIsSupported,
    hasMultipleCameras: mockHasMultipleCameras,
    zoomLevel: 1,
    torchOn: mockTorchOn,
    start: mockStart,
    stop: mockStop,
    switchCamera: mockSwitchCamera,
    setFacingMode: jest.fn(),
    applyProfileLayers: mockApplyProfileLayers,
    capture: jest.fn(),
    setZoom: jest.fn(),
    toggleTorch: mockToggleTorch,
    enumerateDevices: jest.fn(),
  }),
}));

jest.mock('@/lib/stores', () => ({
  useSettingsStore: (selector: (state: {
    stellarium: {
      arCameraPreset: 'balanced';
      arCameraFacingMode: 'environment';
      arCameraResolutionTier: '1080p';
      arCameraTargetFps: 30;
      arOpacity: 0.7;
      arCameraStabilizationStrength: 0.6;
      sensorSmoothingFactor: 0.2;
      arCameraCalibrationSensitivity: 0.5;
      arCameraZoomLevel: 1;
      arCameraTorchPreferred: false;
      arCameraPreferredDevice: { deviceId: 'cam-back'; label: 'Back Camera'; groupId: 'g1' };
      arCameraLastKnownGoodAcquisition: null;
      arAdaptiveLearnerState: null;
      arAdaptiveLearningEnabled: false;
      arNetworkOptimizationEnabled: false;
      arRemotePackVersion: null;
      arTelemetryOptIn: false;
    };
    setStellariumSetting: (key: string, value: unknown) => void;
  }) => unknown) => selector({
    stellarium: {
      arCameraPreset: 'balanced',
      arCameraFacingMode: 'environment',
      arCameraResolutionTier: '1080p',
      arCameraTargetFps: 30,
      arOpacity: 0.7,
      arCameraStabilizationStrength: 0.6,
      sensorSmoothingFactor: 0.2,
      arCameraCalibrationSensitivity: 0.5,
      arCameraZoomLevel: 1,
      arCameraTorchPreferred: false,
      arCameraPreferredDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
      arCameraLastKnownGoodAcquisition: null,
      arAdaptiveLearnerState: null,
      arAdaptiveLearningEnabled: false,
      arNetworkOptimizationEnabled: false,
      arRemotePackVersion: null,
      arTelemetryOptIn: false,
    },
    setStellariumSetting: mockSetStellariumSetting,
  }),
}));

jest.mock('@/lib/services/ar-optimization-pack-service', () => ({
  fetchAROptimizationPack: jest.fn().mockResolvedValue({ pack: null, source: 'none', error: null }),
  syncARLearningTelemetry: jest.fn().mockResolvedValue({ ok: true, error: null }),
}));

jest.mock('@/lib/hooks/use-ar-session-status', () => ({
  useARSessionStatus: () => ({
    status: mockSessionStatus,
    cameraLayerEnabled: true,
    sensorPointingEnabled: true,
    compassEnabled: true,
    needsUserAction: mockSessionStatus !== 'ready',
    recoveryActions: [],
  }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: 'edge-sheet',
    recoveryMode: 'compact-strip',
    cameraControlMode: mockCameraControlMode,
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

// jsdom has no MediaStream, create a minimal mock
class MockMediaStream {
  getTracks() { return []; }
  getAudioTracks() { return []; }
  getVideoTracks() { return []; }
}

// jest.setup.ts globally mocks next-intl: useTranslations returns raw key,
// NextIntlClientProvider is a passthrough. So we render directly.
const renderComponent = (ui: React.ReactElement) => render(ui);

describe('ARCameraBackground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useARRuntimeStore.getState().resetRecoveryState();
    mockStream = null;
    mockIsLoading = false;
    mockError = null;
    mockErrorType = null;
    mockIsSupported = true;
    mockHasMultipleCameras = false;
    mockTorchOn = false;
    mockCapabilities = {};
    mockSessionStatus = 'ready';
    mockCameraControlMode = 'compact-strip';
    mockDevices = [];
    mockLastKnownGoodAcquisition = null;
    mockAcquisitionDiagnostics = {
      currentStage: null,
      attemptedStages: [],
      lastFailureStage: null,
      lastFailureMessage: null,
      stalePreferredDevice: false,
      staleRememberedDevice: false,
      usedRememberedPlan: false,
      activeDevice: null,
    };
    mockApplyProfileLayers.mockResolvedValue(undefined);
  });

  it('renders nothing when disabled', () => {
    const { container } = renderComponent(<ARCameraBackground enabled={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls camera.start when enabled', () => {
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(mockStart).toHaveBeenCalled();
  });

  it('shows loading state when camera is loading', () => {
    mockIsLoading = true;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('shows error state for permission denied', () => {
    mockError = 'Permission denied';
    mockErrorType = 'permission-denied';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arCameraPermission')).toBeInTheDocument();
  });

  it('shows error state for not supported', () => {
    mockError = 'Not supported';
    mockErrorType = 'not-supported';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arNotSupported')).toBeInTheDocument();
  });

  it('shows generic error for unknown camera error', () => {
    mockError = 'Unknown error';
    mockErrorType = 'unknown';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arCameraError')).toBeInTheDocument();
  });

  it('shows retry button on error', () => {
    mockError = 'Failed';
    mockErrorType = 'unknown';
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('common.retry')).toBeInTheDocument();
  });

  it('retries camera start when retry button is clicked in error state', () => {
    mockError = 'Failed';
    mockErrorType = 'unknown';
    renderComponent(<ARCameraBackground enabled={true} />);
    fireEvent.click(screen.getByText('common.retry'));
    expect(mockStart).toHaveBeenCalledTimes(2);
  });

  it('renders video element when stream is available', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    renderComponent(<ARCameraBackground enabled={true} />);
    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video?.getAttribute('aria-label')).toBe('AR camera background');
  });

  it('renders switch camera button when multiple cameras available', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockHasMultipleCameras = true;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByLabelText(/switchCamera|Switch camera/i)).toBeInTheDocument();
  });

  it('invokes switchCamera when switch button is clicked', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockHasMultipleCameras = true;
    renderComponent(<ARCameraBackground enabled={true} />);
    fireEvent.click(screen.getByLabelText(/switchCamera|Switch camera/i));
    expect(mockSwitchCamera).toHaveBeenCalled();
  });

  it('renders torch button when torch capability is available', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockCapabilities = { torch: true };
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByLabelText('Torch')).toBeInTheDocument();
  });

  it('invokes toggleTorch when torch button is clicked', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockCapabilities = { torch: true };
    renderComponent(<ARCameraBackground enabled={true} />);
    fireEvent.click(screen.getByLabelText('Torch'));
    expect(mockToggleTorch).toHaveBeenCalled();
  });

  it('exposes adaptation metadata for camera controls', () => {
    mockStream = new MockMediaStream() as unknown as MediaStream;
    mockHasMultipleCameras = true;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByTestId('ar-camera-controls')).toHaveAttribute('data-ar-camera-controls-mode', 'compact-strip');
  });

  it('does not render camera controls when no stream', () => {
    mockHasMultipleCameras = true;
    mockCapabilities = { torch: true };
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.queryByLabelText('Torch')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    mockError = 'Failed';
    mockErrorType = 'unknown';
    const { container } = renderComponent(<ARCameraBackground enabled={true} className="my-class" />);
    expect(container.querySelector('.my-class')).toBeInTheDocument();
  });

  it('shows AR preflight status chip when session is not ready', () => {
    mockSessionStatus = 'preflight';
    mockStream = new MockMediaStream() as unknown as MediaStream;
    renderComponent(<ARCameraBackground enabled={true} />);
    expect(screen.getByText('settings.arStatusPreflight')).toBeInTheDocument();
  });

  it('passes session-scoped adaptation defaults into camera profile layers', () => {
    renderComponent(<ARCameraBackground enabled={true} />);

    expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({
      profileLayers: expect.objectContaining({
        sessionDefaults: expect.objectContaining({
          resolutionTier: '720p',
          targetFps: 24,
        }),
      }),
    }));
  });

  it('retries camera start when recovery retry action is requested', () => {
    renderComponent(<ARCameraBackground enabled={true} />);
    const initialCalls = mockStart.mock.calls.length;

    act(() => {
      useARRuntimeStore.getState().requestRecoveryAction('retry-camera');
    });

    expect(mockStart.mock.calls.length).toBeGreaterThan(initialCalls);
    expect(mockStart).toHaveBeenLastCalledWith(expect.objectContaining({
      preferredDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
    }));
  });

  it('does not register duplicate visibility lifecycle listeners in component layer', () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    renderComponent(<ARCameraBackground enabled={true} />);
    const visibilityCalls = addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'visibilitychange');
    expect(visibilityCalls).toHaveLength(0);
    addEventListenerSpy.mockRestore();
  });
});

describe('AR camera acquisition persistence', () => {
  it('publishes acquisition diagnostics and persists last-known-good acquisition', () => {
    mockDevices = [
      { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
      { deviceId: 'cam-front', label: 'Front Camera', groupId: 'g2' },
    ];
    mockLastKnownGoodAcquisition = {
      deviceId: 'cam-back',
      label: 'Back Camera',
      groupId: 'g1',
      facingMode: 'environment',
      stage: 'preferred-device',
      updatedAt: 1700000000000,
    };
    mockAcquisitionDiagnostics = {
      currentStage: 'preferred-device',
      attemptedStages: ['preferred-device'],
      lastFailureStage: null,
      lastFailureMessage: null,
      stalePreferredDevice: false,
      staleRememberedDevice: false,
      usedRememberedPlan: false,
      activeDevice: mockDevices[0],
    };

    renderComponent(<ARCameraBackground enabled={true} />);

    expect(useARRuntimeStore.getState().camera.availableDevices).toEqual(mockDevices);
    expect(useARRuntimeStore.getState().camera.acquisitionDiagnostics.currentStage).toBe('preferred-device');
    expect(mockSetStellariumSetting).toHaveBeenCalledWith(
      'arCameraLastKnownGoodAcquisition',
      mockLastKnownGoodAcquisition,
    );
  });
});
