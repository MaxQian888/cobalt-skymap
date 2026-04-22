/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from '@/components/ui/tooltip';
import { altAzToRaDec } from '@/lib/astronomy/coordinates/transforms';
import { SensorControlToggle } from '../sensor-control-toggle';
import type { ARSessionStatus } from '@/lib/core/ar-session';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';

const mockToggleStellariumSetting = jest.fn();
const mockSetStellariumSetting = jest.fn();
const mockSetViewDirection = jest.fn();
const mockRequestPermission = jest.fn();
const mockCalibrateToCurrentView = jest.fn();
const mockResetCalibration = jest.fn();

let mockSensorControl = false;
let mockArMode = false;
let mockIsSupported = true;
let mockIsPermissionGranted = false;
let mockStatus = 'idle';
let mockSource: 'deviceorientationabsolute' | 'deviceorientation' | 'webkitCompassHeading' | 'none' = 'deviceorientation';
let mockSensorCalibrationRequired = true;
let mockDegradedReason: 'relative-source' | 'low-confidence' | 'stale-sample' | null = null;
let mockError: string | null = null;
let mockArSessionStatus: ARSessionStatus = 'ready';
let mockIsTauriDesktop = false;
let mockViewDirection: { ra: number; dec: number; alt: number; az: number } | null = {
  ra: 1.0,
  dec: 0.5,
  alt: 0.2,
  az: 0.3,
};

interface SettingsState {
  stellarium: {
    arMode: boolean;
    sensorControl: boolean;
    sensorSmoothingFactor: number;
    sensorUpdateHz: number;
    sensorDeadbandDeg: number;
    sensorAbsolutePreferred: boolean;
    sensorUseCompassHeading: boolean;
    sensorCalibrationRequired: boolean;
    sensorCalibrationAzimuthOffsetDeg: number;
    sensorCalibrationAltitudeOffsetDeg: number;
    sensorCalibrationUpdatedAt: number | null;
  };
  toggleStellariumSetting: (key: string) => void;
  setStellariumSetting: (key: string, value: unknown) => void;
}

interface StellariumState {
  setViewDirection: (ra: number, dec: number) => void;
  viewDirection: { ra: number; dec: number; alt: number; az: number } | null;
  getCurrentViewDirection: () => { ra: number; dec: number; alt: number; az: number } | null;
}

interface MountState {
  profileInfo: {
    AstrometrySettings: {
      Latitude: number;
      Longitude: number;
    };
  };
}

jest.mock('@/lib/stores', () => ({
  useSettingsStore: <T,>(selector: (state: SettingsState) => T): T => {
    return selector({
      stellarium: {
        arMode: mockArMode,
        sensorControl: mockSensorControl,
        sensorSmoothingFactor: 0.2,
        sensorUpdateHz: 30,
        sensorDeadbandDeg: 0.35,
        sensorAbsolutePreferred: true,
        sensorUseCompassHeading: true,
        sensorCalibrationRequired: mockSensorCalibrationRequired,
        sensorCalibrationAzimuthOffsetDeg: 0,
        sensorCalibrationAltitudeOffsetDeg: 0,
        sensorCalibrationUpdatedAt: null,
      },
      toggleStellariumSetting: mockToggleStellariumSetting,
      setStellariumSetting: mockSetStellariumSetting,
    });
  },
  useStellariumStore: <T,>(selector: (state: StellariumState) => T): T => {
    return selector({
      setViewDirection: mockSetViewDirection,
      viewDirection: mockViewDirection,
      getCurrentViewDirection: () => mockViewDirection,
    });
  },
  useMountStore: <T,>(selector: (state: MountState) => T): T => {
    return selector({
      profileInfo: {
        AstrometrySettings: {
          Latitude: 40.0,
          Longitude: -74.0,
        },
      },
    });
  },
}));

interface DeviceOrientationProps {
  onOrientationChange: (dir: { azimuth: number; altitude: number }) => void;
}

jest.mock('@/lib/hooks/use-device-orientation', () => ({
  useDeviceOrientation: ({ onOrientationChange }: DeviceOrientationProps) => {
    (global as unknown as { triggerOrientationChange: (dir: { azimuth: number; altitude: number }) => void }).triggerOrientationChange = onOrientationChange;
    return {
      isSupported: mockIsSupported,
      isPermissionGranted: mockIsPermissionGranted,
      status: mockStatus,
      source: mockSource,
      accuracyDeg: null,
      degradedReason: mockDegradedReason,
      calibration: {
        azimuthOffsetDeg: 0,
        altitudeOffsetDeg: 0,
        required: mockSensorCalibrationRequired,
        updatedAt: null,
      },
      requestPermission: mockRequestPermission,
      calibrateToCurrentView: mockCalibrateToCurrentView,
      resetCalibration: mockResetCalibration,
      error: mockError,
    };
  },
}));

jest.mock('@/lib/hooks/use-ar-session-status', () => ({
  useARSessionStatus: () => ({
    status: mockArSessionStatus,
    cameraLayerEnabled: true,
    sensorPointingEnabled: true,
    compassEnabled: true,
    needsUserAction: mockArSessionStatus !== 'ready',
    recoveryActions: [],
  }),
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauriDesktop,
}));

const messages = {
  common: {
    cancel: 'Cancel',
  },
  settings: {
    sensorControl: 'Sensor Control',
    sensorControlEnable: 'Enable Sensor Control',
    sensorControlDisable: 'Disable Sensor Control',
    sensorControlPermission: 'Permission Required',
    sensorCalibrationRequired: 'Calibration Required',
    sensorCalibrateNow: 'Calibrate Now',
    sensorRecalibrate: 'Recalibrate',
    sensorStatusPermissionDenied: 'Permission denied',
    sensorStatusUnsupported: 'Not supported',
    sensorStatusDegraded: 'Limited tracking',
    sensorDegradedRelativeSource: 'Using fallback source',
    sensorDegradedLowConfidence: 'Low confidence',
    sensorDegradedStaleSample: 'Sample stale',
    sensorRetryPermission: 'Retry permission',
    arStatusDegradedCameraOnly: 'AR degraded: camera-only mode',
    arRecoveryPermissionRequestFailed: 'Permission is still denied. Check browser settings.',
    arRecoveryCalibrationUnavailable: 'Unable to calibrate from the current view.',
    sensorStatusActive: 'Tracking',
    sensorAccuracy: 'Accuracy',
    sensorCalibrationDescription: 'Point to current map center.',
  },
};

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>
  );
};

describe('SensorControlToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSensorControl = false;
    mockArMode = false;
    mockIsSupported = true;
    mockIsPermissionGranted = false;
    mockStatus = 'idle';
    mockSource = 'deviceorientation';
    mockSensorCalibrationRequired = true;
    mockDegradedReason = null;
    mockError = null;
    mockArSessionStatus = 'ready';
    mockIsTauriDesktop = false;
    mockViewDirection = {
      ra: 1.0,
      dec: 0.5,
      alt: 0.2,
      az: 0.3,
    };
    useARRuntimeStore.getState().resetRecoveryState();
  });

  it('renders a button with test id', () => {
    renderWithProviders(<SensorControlToggle />);
    expect(screen.getByTestId('sensor-control-toggle')).toBeInTheDocument();
  });

  it('renders disabled when sensor is unsupported', () => {
    mockIsSupported = false;
    renderWithProviders(<SensorControlToggle />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('requests permission if not granted when turning on', async () => {
    mockIsPermissionGranted = false;
    mockRequestPermission.mockResolvedValue(true);

    renderWithProviders(<SensorControlToggle />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockRequestPermission).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockToggleStellariumSetting).toHaveBeenCalledWith('sensorControl');
    });
  });

  it('does not toggle if permission request is denied', async () => {
    mockRequestPermission.mockResolvedValue(false);

    renderWithProviders(<SensorControlToggle />);
    fireEvent.click(screen.getByRole('button'));

    expect(mockRequestPermission).toHaveBeenCalled();
    expect(mockToggleStellariumSetting).not.toHaveBeenCalled();
  });

  it('toggles directly when permission is already granted', () => {
    mockIsPermissionGranted = true;
    renderWithProviders(<SensorControlToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockToggleStellariumSetting).toHaveBeenCalledWith('sensorControl');
  });

  it('auto-disables when control is on but sensor support is unavailable', () => {
    mockSensorControl = true;
    mockIsSupported = false;
    renderWithProviders(<SensorControlToggle />);
    expect(mockToggleStellariumSetting).toHaveBeenCalledWith('sensorControl');
  });

  it('converts orientation Alt/Az to RA/Dec and updates view direction', () => {
    mockSensorControl = true;
    mockIsPermissionGranted = true;
    renderWithProviders(<SensorControlToggle />);

    (global as unknown as { triggerOrientationChange: (dir: { azimuth: number; altitude: number }) => void }).triggerOrientationChange({
      azimuth: 120,
      altitude: 45,
    });

    const expected = altAzToRaDec(45, 120, 40, -74);
    expect(mockSetViewDirection).toHaveBeenCalledTimes(1);
    const [ra, dec] = mockSetViewDirection.mock.calls[0] as [number, number];
    // Small timing differences (ms-level) can cause tiny sidereal-time deltas; allow a tight tolerance.
    expect(ra).toBeCloseTo(expected.ra, 4);
    expect(dec).toBeCloseTo(expected.dec, 4);
  });

  it('shows calibration dialog after enabling when calibration is required', async () => {
    mockIsPermissionGranted = true;
    mockRequestPermission.mockResolvedValue(true);
    mockSensorCalibrationRequired = true;

    renderWithProviders(<SensorControlToggle />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('settings.sensorCalibrationRequired')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('settings.sensorCalibrateNow'));
    expect(mockCalibrateToCurrentView).toHaveBeenCalled();
  });

  it('shows AR degraded label when AR mode is active and sensor is not ready', () => {
    mockArMode = true;
    mockSensorControl = true;
    mockIsPermissionGranted = true;
    mockStatus = 'idle';
    mockArSessionStatus = 'degraded-camera-only';

    renderWithProviders(<SensorControlToggle showStatusLabel />);
    expect(screen.getByText('settings.arStatusDegradedCameraOnly')).toBeInTheDocument();
  });

  it('shows degraded reason label when status is degraded', () => {
    mockSensorControl = true;
    mockIsPermissionGranted = true;
    mockStatus = 'degraded';
    mockDegradedReason = 'low-confidence';

    renderWithProviders(<SensorControlToggle showStatusLabel />);
    expect(screen.getByText('settings.sensorStatusDegraded')).toBeInTheDocument();
    expect(screen.getByText('settings.sensorDegradedLowConfidence')).toBeInTheDocument();
  });

  it('shows retry permission action for denied status', () => {
    mockSensorControl = true;
    mockIsPermissionGranted = false;
    mockStatus = 'permission-denied';

    renderWithProviders(<SensorControlToggle showStatusLabel />);
    expect(screen.getByText('settings.sensorRetryPermission')).toBeInTheDocument();
  });

  it('handles recovery permission request from AR recovery panel actions', async () => {
    mockSensorControl = false;
    mockIsPermissionGranted = false;
    mockRequestPermission.mockResolvedValue(true);

    renderWithProviders(<SensorControlToggle />);

    act(() => {
      useARRuntimeStore.getState().requestRecoveryAction('request-sensor-permission');
    });

    await waitFor(() => {
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockToggleStellariumSetting).toHaveBeenCalledWith('sensorControl');
    });
  });

  it('projects desktop AR idle sensors to camera-first runtime when sensor control is off', async () => {
    mockArMode = true;
    mockSensorControl = false;
    mockIsSupported = true;
    mockIsPermissionGranted = true;
    mockStatus = 'idle';
    mockSource = 'none';
    mockIsTauriDesktop = true;

    renderWithProviders(<SensorControlToggle />);

    await waitFor(() => {
      expect(useARRuntimeStore.getState().sensor).toMatchObject({
        isSupported: false,
        isPermissionGranted: false,
        status: 'unsupported',
        error: 'Desktop AR defaults to camera-first mode until sensor data is confirmed.',
      });
    });
  });

  it('handles quick calibration request from AR recovery panel actions', async () => {
    mockSensorControl = true;
    mockIsPermissionGranted = true;
    mockStatus = 'calibration-required';

    renderWithProviders(<SensorControlToggle />);

    act(() => {
      useARRuntimeStore.getState().requestRecoveryAction('calibrate-sensor');
    });

    await waitFor(() => {
      expect(mockCalibrateToCurrentView).toHaveBeenCalled();
    });
    expect(useARRuntimeStore.getState().recoveryNoticeKey).toBeNull();
  });

  it('sets recovery notice when quick calibration context is unavailable', async () => {
    mockSensorControl = true;
    mockIsPermissionGranted = true;
    mockStatus = 'calibration-required';
    mockViewDirection = null;

    renderWithProviders(<SensorControlToggle />);

    act(() => {
      useARRuntimeStore.getState().requestRecoveryAction('calibrate-sensor');
    });

    await waitFor(() => {
      expect(useARRuntimeStore.getState().recoveryNoticeKey).toBe('settings.arRecoveryCalibrationUnavailable');
    });
  });
});
