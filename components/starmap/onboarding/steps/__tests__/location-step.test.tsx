/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ObserverLocation } from '@/types/starmap/onboarding';

// --- Mocks ---

const mockSetProfileInfo = jest.fn();
const mockUpdateSetupData = jest.fn();
type MockLocation = ObserverLocation;
const mockIsValidLocation = jest.fn(
  (loc: { latitude: number; longitude: number } | null) =>
    loc !== null &&
    Number.isFinite(loc.latitude) &&
    Number.isFinite(loc.longitude) &&
    loc.latitude >= -90 &&
    loc.latitude <= 90 &&
    loc.longitude >= -180 &&
    loc.longitude <= 180,
);
const mockLoadObservationStepLocation = jest.fn<Promise<MockLocation | null>, []>(async () => null);
const mockSaveObservationStepLocation = jest.fn<Promise<MockLocation>, [MockLocation]>(async (location) => location);
const mockDetectObservationStepLocation = jest.fn<Promise<{ location?: MockLocation; errorKey?: string }>, []>(
  async () => ({}),
);

jest.mock('@/lib/stores/mount-store', () => ({
  useMountStore: Object.assign(
    jest.fn((selector: (s: Record<string, unknown>) => unknown) => {
      const state = {
        profileInfo: {
          AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 },
        },
        setProfileInfo: mockSetProfileInfo,
      };
      return selector(state);
    }),
    {
      getState: jest.fn(() => ({
        profileInfo: {
          AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 },
        },
        setProfileInfo: mockSetProfileInfo,
      })),
    },
  ),
}));

jest.mock('@/lib/stores/onboarding-store', () => ({
  useOnboardingStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) => {
    const state = { updateSetupData: mockUpdateSetupData };
    return selector(state);
  }),
}));

jest.mock('@/lib/utils/observer-location', () => ({
  isValidLocation: (loc: { latitude: number; longitude: number } | null) => mockIsValidLocation(loc),
}));

jest.mock('@/lib/services/observation-location-entry', () => ({
  loadObservationStepLocation: () => mockLoadObservationStepLocation(),
  saveObservationStepLocation: (location: MockLocation) => mockSaveObservationStepLocation(location),
  detectObservationStepLocation: () => mockDetectObservationStepLocation(),
}));

jest.mock('@/lib/hooks/use-canonical-observation-location', () => ({
  useCanonicalObservationLocationState: () => ({
    currentLocation: { id: 'loc-1', name: 'Backyard' },
    hasSavedLocation: true,
    loading: false,
    isTauriManaged: false,
  }),
}));

import { LocationStep } from '../location-step';

describe('LocationStep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadObservationStepLocation.mockResolvedValue(null);
    mockSaveObservationStepLocation.mockImplementation(async (location) => location);
    mockDetectObservationStepLocation.mockResolvedValue({});
  });

  it('renders description and two tabs (GPS / Manual)', () => {
    render(<LocationStep />);
    expect(screen.getByText('setupWizard.steps.location.description')).toBeInTheDocument();
    expect(screen.getByText('setupWizard.steps.location.useGPS')).toBeInTheDocument();
    expect(screen.getByText('setupWizard.steps.location.enterManually')).toBeInTheDocument();
  });

  it('renders GPS detect button', () => {
    render(<LocationStep />);
    expect(screen.getByText('setupWizard.steps.location.detectLocation')).toBeInTheDocument();
  });

  it('calls updateSetupData on mount', () => {
    render(<LocationStep />);
    expect(mockUpdateSetupData).toHaveBeenCalledWith({ locationConfigured: false });
  });

  it('loads stored location on mount and updates mount store', () => {
    const stored = { latitude: 40.7128, longitude: -74.006, altitude: 10 };
    mockLoadObservationStepLocation.mockResolvedValue(stored);

    render(<LocationStep />);

    return waitFor(() => {
      expect(mockSetProfileInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          AstrometrySettings: expect.objectContaining({
            Latitude: 40.7128,
            Longitude: -74.006,
            Elevation: 10,
          }),
        }),
      );
    });
  });

  it('handles GPS success and displays location summary', async () => {
    mockDetectObservationStepLocation.mockResolvedValue({
      location: { latitude: 51.5074, longitude: -0.1278, altitude: 15 },
    });

    render(<LocationStep />);

    const detectBtn = screen.getByText('setupWizard.steps.location.detectLocation');
    fireEvent.click(detectBtn);

    await waitFor(() => {
      expect(mockSaveObservationStepLocation).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 51.5074, longitude: -0.1278, altitude: 15 }),
      );
    });
  });

  it('handles GPS permission denied error', async () => {
    mockDetectObservationStepLocation.mockResolvedValue({
      errorKey: 'setupWizard.steps.location.permissionDenied',
    });

    render(<LocationStep />);

    const detectBtn = screen.getByText('setupWizard.steps.location.detectLocation');
    fireEvent.click(detectBtn);

    await waitFor(() => {
      expect(screen.getByText('setupWizard.steps.location.permissionDenied')).toBeInTheDocument();
    });
  });

  it('handles GPS position unavailable error', async () => {
    mockDetectObservationStepLocation.mockResolvedValue({
      errorKey: 'setupWizard.steps.location.positionUnavailable',
    });

    render(<LocationStep />);
    fireEvent.click(screen.getByText('setupWizard.steps.location.detectLocation'));

    await waitFor(() => {
      expect(screen.getByText('setupWizard.steps.location.positionUnavailable')).toBeInTheDocument();
    });
  });

  it('handles GPS timeout error', async () => {
    mockDetectObservationStepLocation.mockResolvedValue({
      errorKey: 'setupWizard.steps.location.timeout',
    });

    render(<LocationStep />);
    fireEvent.click(screen.getByText('setupWizard.steps.location.detectLocation'));

    await waitFor(() => {
      expect(screen.getByText('setupWizard.steps.location.timeout')).toBeInTheDocument();
    });
  });

  it('renders skip note', () => {
    render(<LocationStep />);
    expect(screen.getByText('setupWizard.steps.location.skipNote')).toBeInTheDocument();
  });
});
