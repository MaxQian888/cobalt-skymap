/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { useARRuntimeStore } from '@/lib/stores/ar-runtime-store';

const mockSettingsState = {
  skyEngine: 'stellarium' as const,
  setSkyEngine: jest.fn(),
  stellarium: {
    constellationsLinesVisible: true,
    constellationArtVisible: false,
    constellationLabelsVisible: true,
    constellationBoundariesVisible: false,
    starLabelsVisible: true,
    planetLabelsVisible: true,
    azimuthalLinesVisible: false,
    equatorialLinesVisible: false,
    equatorialJnowLinesVisible: false,
    meridianLinesVisible: false,
    eclipticLinesVisible: false,
    horizonLinesVisible: false,
    galacticLinesVisible: false,
    atmosphereVisible: false,
    landscapesVisible: false,
    dsosVisible: true,
    milkyWayVisible: true,
    fogVisible: false,
    surveyEnabled: true,
    surveyId: 'dss',
    surveyUrl: undefined,
    skyCultureLanguage: 'native' as const,
    nightMode: false,
    sensorControl: false,
    sensorAbsolutePreferred: true,
    sensorUseCompassHeading: true,
    sensorUpdateHz: 30,
    sensorDeadbandDeg: 0.35,
    sensorSmoothingFactor: 0.2,
    sensorCalibrationRequired: true,
    sensorCalibrationAzimuthOffsetDeg: 0,
    sensorCalibrationAltitudeOffsetDeg: 0,
    sensorCalibrationUpdatedAt: null,
    arCameraPreset: 'balanced' as const,
    arCameraFacingMode: 'environment' as const,
    arCameraResolutionTier: '1080p' as const,
    arCameraTargetFps: 30,
    arCameraStabilizationStrength: 0.6,
    arCameraCalibrationSensitivity: 0.5,
    arCameraZoomLevel: 1,
    arCameraTorchPreferred: false,
    arCameraPreferredDevice: { deviceId: null, label: null, groupId: null },
    arCameraLastKnownGoodAcquisition: null,
    arAdaptiveLearningEnabled: false,
    arAdaptiveAutoApply: false,
    arAdaptiveLearnerState: null,
    arNetworkOptimizationEnabled: false,
    arTelemetryOptIn: false,
    arRemotePackVersion: null,
    arRemotePackUpdatedAt: null,
    arMode: false,
    arOpacity: 0.7,
    arShowCompass: true,
    crosshairVisible: true,
    crosshairColor: 'rgba(255, 255, 255, 0.3)',
    projectionType: 'stereographic' as const,
    bortleIndex: 3,
    starLinearScale: 0.8,
    starRelativeScale: 1.1,
    displayLimitMag: 99,
    flipViewVertical: false,
    flipViewHorizontal: false,
    exposureScale: 2,
    tonemapperP: 0.5,
    mountFrame: 5 as const,
    viewYOffset: 0,
  },
  toggleStellariumSetting: jest.fn(),
  setStellariumSetting: jest.fn(),
};

const mockSatelliteState = {
  showSatellites: true,
  showLabels: true,
  showOrbits: false,
  setShowSatellites: jest.fn(),
  setShowLabels: jest.fn(),
  setShowOrbits: jest.fn(),
};

jest.mock('@/lib/stores', () => ({
  useSatelliteStore: (selector: (state: unknown) => unknown) => selector(mockSatelliteState),
  useSettingsStore: (selector: (state: unknown) => unknown) => selector(mockSettingsState),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, id }: { checked?: boolean; id?: string }) => (
    <input type="checkbox" checked={checked} data-testid={`switch-${id || 'default'}`} readOnly />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label data-testid="label">{children}</label>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: () => <div data-testid="slider" />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div data-testid="select">{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <option>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: () => <span>Select...</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => <button data-testid="button">{children}</button>,
}));

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible">{children}</div>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div data-testid="collapsible-content">{children}</div>,
  CollapsibleTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
}));

jest.mock('@/components/starmap/settings/stellarium-survey-selector', () => ({
  StellariumSurveySelector: () => <div data-testid="stellarium-survey-selector">StellariumSurveySelector</div>,
}));

jest.mock('@/components/starmap/objects/object-info-sources-config', () => ({
  ObjectInfoSourcesConfig: () => <div data-testid="object-info-sources-config">ObjectInfoSourcesConfig</div>,
}));

jest.mock('@/lib/hooks/use-ar-adaptation', () => ({
  useARAdaptation: () => ({
    assistantMode: 'edge-sheet',
    recoveryMode: 'compact-strip',
    cameraControlMode: 'compact-strip',
    sensorPath: 'camera-primary',
    runtimeClass: 'tauri-desktop',
    layoutTier: 'desktop',
    controlDensity: 'comfortable',
    capabilityTier: 'limited',
    isLandscape: true,
    isViewportReduced: false,
    viewportWidth: 1440,
    viewportHeight: 900,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  }),
}));


import { DisplaySettings } from '../display-settings';

describe('DisplaySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        availableDevices: [
          { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
          { deviceId: 'cam-front', label: 'Front Camera', groupId: 'g2' },
        ],
        acquisitionDiagnostics: {
          currentStage: 'preferred-device',
          attemptedStages: ['preferred-device'],
          lastFailureStage: null,
          lastFailureMessage: null,
          stalePreferredDevice: false,
          staleRememberedDevice: false,
          usedRememberedPlan: false,
          activeDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
        },
      },
    }));
  });

  it('renders display settings sections', () => {
    render(<DisplaySettings />);
    expect(screen.getAllByTestId('collapsible').length).toBeGreaterThan(0);
  });

  it('renders separators between sections', () => {
    render(<DisplaySettings />);
    expect(screen.getAllByTestId('separator').length).toBeGreaterThan(0);
  });

  it('renders stellarium survey selector', () => {
    render(<DisplaySettings />);
    expect(screen.getByTestId('stellarium-survey-selector')).toBeInTheDocument();
  });

  it('renders object info sources config', () => {
    render(<DisplaySettings />);
    expect(screen.getByTestId('object-info-sources-config')).toBeInTheDocument();
  });

  it('renders sky culture language select', () => {
    render(<DisplaySettings />);
    expect(screen.getAllByTestId('select').length).toBeGreaterThan(0);
  });
});

describe('DisplaySettings state rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useARRuntimeStore.setState((state) => ({
      camera: {
        ...state.camera,
        availableDevices: [
          { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
          { deviceId: 'cam-front', label: 'Front Camera', groupId: 'g2' },
        ],
        acquisitionDiagnostics: {
          currentStage: 'preferred-device',
          attemptedStages: ['preferred-device'],
          lastFailureStage: null,
          lastFailureMessage: null,
          stalePreferredDevice: false,
          staleRememberedDevice: false,
          usedRememberedPlan: false,
          activeDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
        },
      },
    }));
  });

  it('renders with default settings from store', () => {
    render(<DisplaySettings />);
    expect(screen.getAllByTestId('collapsible').length).toBeGreaterThan(0);
  });

  it('renders all collapsible sections', () => {
    render(<DisplaySettings />);
    expect(screen.getAllByTestId('collapsible').length).toBeGreaterThanOrEqual(4);
  });

  it('renders stellarium survey selector component', () => {
    render(<DisplaySettings />);
    expect(screen.getByTestId('stellarium-survey-selector')).toBeInTheDocument();
  });
});

it('renders AR camera device preference and diagnostics', () => {
  render(<DisplaySettings />);
  expect(screen.getByText('settings.arCameraDevicePreference')).toBeInTheDocument();
  expect(screen.getAllByText(/Back Camera/).length).toBeGreaterThan(0);
});

it('renders remembered-plan AR diagnostics using the shared summary contract', () => {
  useARRuntimeStore.setState((state) => ({
    camera: {
      ...state.camera,
      acquisitionDiagnostics: {
        currentStage: 'remembered-device',
        attemptedStages: ['remembered-device'],
        lastFailureStage: 'requested-facing-mode-safe',
        lastFailureMessage: null,
        stalePreferredDevice: false,
        staleRememberedDevice: false,
        usedRememberedPlan: true,
        activeDevice: { deviceId: 'cam-back', label: 'Back Camera', groupId: 'g1' },
      },
    },
  }));

  render(<DisplaySettings />);

  expect(screen.getByText(/settings\.arCameraRememberedPlan/)).toBeInTheDocument();
});

it('renders AR launch assistant entry in camera settings', () => {
  render(<DisplaySettings />);
  expect(screen.getByText('settings.arLaunchOpenAssistant')).toBeInTheDocument();
});

it('renders AR adaptation guidance inside camera settings', () => {
  render(<DisplaySettings />);
  expect(screen.getByText('settings.arAdaptationSummary')).toBeInTheDocument();
  expect(screen.getByText('settings.arAdaptationCameraFirst')).toBeInTheDocument();
  expect(screen.getByText('settings.arAdaptationLimitedProfile')).toBeInTheDocument();
});
