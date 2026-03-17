/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ARModeToggle } from '../ar-mode-toggle';
import type { ARSessionStatus } from '@/lib/core/ar-session';

const mockSetStellariumSetting = jest.fn();
const mockSetSensorRuntime = jest.fn();
const mockOpenLaunchAssistant = jest.fn();

let mockArMode = false;
let mockAtmosphereVisible = true;
let mockLandscapesVisible = true;
let mockFogVisible = false;
let mockMilkyWayVisible = true;
let mockSensorControl = false;
let mockARSessionStatus: ARSessionStatus = 'ready';
let mockIsSupported = true;
let mockIsPermissionGranted = false;
let mockSensorPath: 'sensor-primary' | 'camera-primary' | 'manual-only' = 'sensor-primary';

interface SettingsState {
  stellarium: {
    arMode: boolean;
    atmosphereVisible: boolean;
    landscapesVisible: boolean;
    fogVisible: boolean;
    milkyWayVisible: boolean;
    sensorControl: boolean;
    sensorCalibrationRequired: boolean;
    sensorCalibrationAzimuthOffsetDeg: number;
    sensorCalibrationAltitudeOffsetDeg: number;
    sensorCalibrationUpdatedAt: number | null;
  };
  setStellariumSetting: (key: string, value: unknown) => void;
}

jest.mock('@/lib/stores', () => ({
  useSettingsStore: <T,>(selector: (state: SettingsState) => T): T => {
    return selector({
      stellarium: {
        arMode: mockArMode,
        atmosphereVisible: mockAtmosphereVisible,
        landscapesVisible: mockLandscapesVisible,
        fogVisible: mockFogVisible,
        milkyWayVisible: mockMilkyWayVisible,
        sensorControl: mockSensorControl,
        sensorCalibrationRequired: true,
        sensorCalibrationAzimuthOffsetDeg: 0,
        sensorCalibrationAltitudeOffsetDeg: 0,
        sensorCalibrationUpdatedAt: null,
      },
      setStellariumSetting: mockSetStellariumSetting,
    });
  },
}));

jest.mock('@/lib/stores/ar-runtime-store', () => ({
  useARRuntimeStore: <T,>(selector: (state: {
    setSensorRuntime: (next: unknown) => void;
    openLaunchAssistant: (reason: string) => void;
    closeLaunchAssistant: () => void;
  }) => T): T =>
    selector({
      setSensorRuntime: mockSetSensorRuntime,
      openLaunchAssistant: mockOpenLaunchAssistant,
      closeLaunchAssistant: jest.fn(),
    }),
}));

jest.mock('@/lib/hooks/use-is-client', () => ({
  useIsClient: () => true,
}));

jest.mock('@/lib/hooks/use-ar-session-status', () => ({
  useARSessionStatus: () => ({
    status: mockARSessionStatus,
    cameraLayerEnabled: true,
    sensorPointingEnabled: true,
    compassEnabled: true,
    needsUserAction: mockARSessionStatus !== 'ready',
    recoveryActions: [],
  }),
}));

jest.mock('@/lib/hooks/use-device-orientation', () => ({
  useDeviceOrientation: () => ({
    isSupported: mockIsSupported,
    isPermissionGranted: mockIsPermissionGranted,
    requestPermission: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: 'edge-sheet',
    recoveryMode: 'compact-strip',
    cameraControlMode: 'compact-strip',
    sensorPath: mockSensorPath,
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

const messages = {
  settings: {
    arModeEnable: 'Enable AR sky overlay',
    arModeDisable: 'Disable AR mode',
    arStatusPreflight: 'Checking AR readiness...',
    arStatusDegradedCameraOnly: 'AR degraded: camera-only mode',
    arStatusDegradedSensorOnly: 'AR degraded: sensor-only mode',
    arStatusBlocked: 'AR blocked: action required',
    arAdaptationCameraFirst: 'Camera-first AR guidance available',
  },
};

const renderWithProviders = (ui: React.ReactElement) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  );

describe('ARModeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockArMode = false;
    mockAtmosphereVisible = true;
    mockLandscapesVisible = true;
    mockFogVisible = false;
    mockMilkyWayVisible = true;
    mockSensorControl = false;
    mockARSessionStatus = 'ready';
    mockIsSupported = true;
    mockIsPermissionGranted = false;
    mockSensorPath = 'sensor-primary';
  });

  it('renders a button with test id', () => {
    renderWithProviders(<ARModeToggle />);
    expect(screen.getByTestId('ar-mode-toggle')).toBeInTheDocument();
  });

  it('enables AR mode, disables opaque layers, and opens the launch assistant on click', () => {
    renderWithProviders(<ARModeToggle />);
    fireEvent.click(screen.getByTestId('ar-mode-toggle'));

    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', true);
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('atmosphereVisible', false);
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('landscapesVisible', false);
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('fogVisible', false);
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('milkyWayVisible', false);
    expect(mockOpenLaunchAssistant).toHaveBeenCalledWith('enter-ar');
  });

  it('disables AR mode on second click', () => {
    mockArMode = true;
    renderWithProviders(<ARModeToggle />);
    fireEvent.click(screen.getByTestId('ar-mode-toggle'));

    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', false);
  });

  it('shows active indicator when AR is on', () => {
    mockArMode = true;
    mockARSessionStatus = 'ready';
    renderWithProviders(<ARModeToggle />);
    const button = screen.getByTestId('ar-mode-toggle');
    expect(button.querySelector('.bg-blue-500')).toBeInTheDocument();
  });

  it('shows preflight status indicator when AR session is not ready', () => {
    mockArMode = true;
    mockARSessionStatus = 'preflight';
    renderWithProviders(<ARModeToggle />);
    const button = screen.getByTestId('ar-mode-toggle');
    expect(button).toHaveAttribute('data-ar-session-status', 'preflight');
    expect(button.querySelector('.bg-amber-400')).toBeInTheDocument();
  });

  it('keeps AR on and records unsupported sensor fallback without prompting permission inline', () => {
    mockIsSupported = false;
    renderWithProviders(<ARModeToggle />);

    fireEvent.click(screen.getByTestId('ar-mode-toggle'));

    expect(mockSetStellariumSetting).toHaveBeenCalledWith('arMode', true);
    expect(mockSetStellariumSetting).toHaveBeenCalledWith('sensorControl', false);
    expect(mockSetSensorRuntime).toHaveBeenCalled();
  });

  it('uses camera-first tooltip copy when blocked in camera-first path', () => {
    mockArMode = true;
    mockARSessionStatus = 'blocked';
    mockSensorPath = 'camera-primary';

    renderWithProviders(<ARModeToggle />);

    expect(screen.getByTestId('ar-mode-toggle')).toHaveAttribute('aria-label', 'settings.arAdaptationCameraFirst');
    expect(screen.getByTestId('ar-mode-toggle')).toHaveAttribute('data-ar-sensor-path', 'camera-primary');
  });
});
