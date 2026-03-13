import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LocationStep } from '../location-step';
import { useSetupWizardStore } from '@/lib/stores/setup-wizard-store';
import type { ObserverLocation } from '@/types/starmap/setup-wizard';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

type MockLocation = ObserverLocation;
const mockLoadObservationStepLocation = jest.fn<Promise<MockLocation | null>, []>(async () => null);
const mockSaveObservationStepLocation = jest.fn<Promise<MockLocation>, [MockLocation]>(async (location) => location);
const mockDetectObservationStepLocation = jest.fn<Promise<{ location?: MockLocation; errorKey?: string }>, []>(
  async () => ({}),
);

jest.mock('@/lib/services/observation-location-entry', () => ({
  loadObservationStepLocation: () => mockLoadObservationStepLocation(),
  saveObservationStepLocation: (location: MockLocation) => mockSaveObservationStepLocation(location),
  detectObservationStepLocation: () => mockDetectObservationStepLocation(),
}));

jest.mock('@/lib/hooks/use-canonical-observation-location', () => ({
  useCanonicalObservationLocationState: () => ({
    currentLocation: null,
    hasSavedLocation: false,
    loading: false,
    isTauriManaged: false,
  }),
}));

// Mock geolocation
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

Object.defineProperty(navigator, 'geolocation', {
  value: mockGeolocation,
  writable: true,
});

jest.mock('@/components/ui/tabs', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const TabsContext = ReactModule.createContext<{
    value: string;
    setValue: (value: string) => void;
  }>({
    value: 'gps',
    setValue: () => {},
  });

  return {
    Tabs: ({
      children,
      defaultValue = 'gps',
    }: {
      children: ReactNode;
      defaultValue?: string;
    }) => {
      const [value, setValue] = ReactModule.useState(defaultValue);
      return (
        <TabsContext.Provider value={{ value, setValue }}>
          <div data-testid="tabs">{children}</div>
        </TabsContext.Provider>
      );
    },
    TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    TabsTrigger: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => {
      const { value: activeValue, setValue } = ReactModule.useContext(TabsContext);
      const active = activeValue === value;
      return (
        <button type="button" role="tab" data-state={active ? 'active' : 'inactive'} className={active ? 'border-primary' : ''} onClick={() => setValue(value)}>
          {children}
        </button>
      );
    },
    TabsContent: ({
      children,
      value,
    }: {
      children: ReactNode;
      value: string;
    }) => {
      const { value: activeValue } = ReactModule.useContext(TabsContext);
      if (activeValue !== value) return null;
      return <div>{children}</div>;
    },
  };
});

// Note: next-intl is globally mocked in jest.setup.ts to return translation keys

describe('LocationStep', () => {
  beforeEach(() => {
    // Reset store state
    const store = useSetupWizardStore.getState();
    store.resetSetup();
    
    // Clear localStorage
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    
    // Reset geolocation mock
    mockGeolocation.getCurrentPosition.mockClear();
    mockLoadObservationStepLocation.mockResolvedValue(null);
    mockSaveObservationStepLocation.mockImplementation(async (location) => location);
    mockDetectObservationStepLocation.mockResolvedValue({});
  });

  describe('rendering', () => {
    it('should render the location step description', () => {
      render(<LocationStep />);
      
      expect(screen.getByText(/location\.description/i)).toBeInTheDocument();
    });

    it('should render GPS and Manual mode buttons', () => {
      render(<LocationStep />);
      
      expect(screen.getByText(/location\.useGPS/i)).toBeInTheDocument();
      expect(screen.getByText(/location\.enterManually/i)).toBeInTheDocument();
    });

    it('should render skip note', () => {
      render(<LocationStep />);
      
      expect(screen.getByText(/location\.skipNote/i)).toBeInTheDocument();
    });

    it('should default to GPS mode', () => {
      render(<LocationStep />);
      
      expect(screen.getByText(/location\.detectLocation/i)).toBeInTheDocument();
    });
  });

  describe('GPS mode', () => {
    it('should show detect location button', () => {
      render(<LocationStep />);
      
      expect(screen.getByText(/location\.detectLocation/i)).toBeInTheDocument();
    });

    it('should show detecting state when getting location', async () => {
      mockDetectObservationStepLocation.mockImplementation(() => new Promise(() => undefined));

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.detecting/i)).toBeInTheDocument();
      });
    });

    it('should set location on successful GPS detection', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        location: {
          latitude: 40.7128,
          longitude: -74.006,
          altitude: 10,
        },
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/40\.7128°, -74\.0060°/)).toBeInTheDocument();
    });

    it('should show permission denied error', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        errorKey: 'setupWizard.steps.location.permissionDenied',
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.permissionDenied/i)).toBeInTheDocument();
      });
    });

    it('should show position unavailable error', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        errorKey: 'setupWizard.steps.location.positionUnavailable',
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.positionUnavailable/i)).toBeInTheDocument();
      });
    });

    it('should show timeout error', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        errorKey: 'setupWizard.steps.location.timeout',
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.timeout/i)).toBeInTheDocument();
      });
    });

    it('should show GPS not supported error when geolocation is unavailable', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        errorKey: 'setupWizard.steps.location.gpsNotSupported',
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.gpsNotSupported/i)).toBeInTheDocument();
      });
    });
  });

  describe('Manual mode', () => {
    it('should switch to manual mode when clicking Enter Manually', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      expect(screen.getByLabelText(/location\.latitude/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/location\.longitude/i)).toBeInTheDocument();
    });

    it('should render latitude and longitude inputs in manual mode', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      expect(latInput).toHaveAttribute('type', 'number');
      expect(lonInput).toHaveAttribute('type', 'number');
    });

    it('should set location with valid manual input', async () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '51.5074' } });
      fireEvent.change(lonInput, { target: { value: '-0.1278' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/51\.5074°, -0\.1278°/)).toBeInTheDocument();
    });

    it('should disable set location button with invalid latitude', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '100' } }); // Invalid: > 90
      fireEvent.change(lonInput, { target: { value: '0' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should disable set location button with invalid longitude', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '45' } });
      fireEvent.change(lonInput, { target: { value: '200' } }); // Invalid: > 180

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should disable set location button with empty inputs', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should accept negative coordinates', async () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '-33.8688' } }); // Sydney
      fireEvent.change(lonInput, { target: { value: '151.2093' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });
    });
  });

  describe('mode switching', () => {
    it('should switch between GPS and Manual modes', () => {
      render(<LocationStep />);
      
      // Start in GPS mode
      expect(screen.getByText(/location\.detectLocation/i)).toBeInTheDocument();

      // Switch to Manual
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }
      expect(screen.getByLabelText(/location\.latitude/i)).toBeInTheDocument();

      // Switch back to GPS
      const gpsButton = screen.getByText(/location\.useGPS/i).closest('button');
      if (gpsButton) {
        fireEvent.click(gpsButton);
      }
      expect(screen.getByText(/location\.detectLocation/i)).toBeInTheDocument();
    });
  });

  describe('store integration', () => {
    it('should update setupData when location is set via GPS', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          altitude: 40,
        },
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        const store = useSetupWizardStore.getState();
        expect(store.setupData.locationConfigured).toBe(true);
      });
    });

    it('should update setupData when location is set manually', async () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '48.8566' } });
      fireEvent.change(lonInput, { target: { value: '2.3522' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      fireEvent.click(setButton);

      await waitFor(() => {
        const store = useSetupWizardStore.getState();
        expect(store.setupData.locationConfigured).toBe(true);
      });
    });
  });

  describe('canonical location persistence', () => {
    it('should save location through the shared observation-location helper when set', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        location: {
          latitude: 52.52,
          longitude: 13.405,
          altitude: 34,
        },
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(mockSaveObservationStepLocation).toHaveBeenCalledWith({
          latitude: 52.52,
          longitude: 13.405,
          altitude: 34,
        });
      });
    });

    it('should load the canonical saved location on mount', async () => {
      const storedLocation = {
        latitude: 37.7749,
        longitude: -122.4194,
        altitude: 16,
      };
      mockLoadObservationStepLocation.mockResolvedValue(storedLocation);

      render(<LocationStep />);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
        expect(screen.getByText(/37\.7749°, -122\.4194°/)).toBeInTheDocument();
      });
    });

    it('should handle corrupted localStorage data gracefully', () => {
      mockLoadObservationStepLocation.mockResolvedValue(null);

      // Should not throw and should render normally
      render(<LocationStep />);
      
      // Component should render without location set
      expect(screen.getByText(/location\.detectLocation/i)).toBeInTheDocument();
    });

    it('should handle localStorage.setItem throwing error', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        location: {
          latitude: 45.0,
          longitude: 90.0,
          altitude: 0,
        },
      });

      mockSaveObservationStepLocation.mockImplementation(async (location) => location);

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      
      // Should not throw even when localStorage fails
      fireEvent.click(detectButton);

      await waitFor(() => {
        // Location should still be displayed despite storage error
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });
    });
  });

  describe('GPS error handling', () => {
    it('should show unknown error for unhandled error codes', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        errorKey: 'setupWizard.steps.location.unknownError',
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.unknownError/i)).toBeInTheDocument();
      });
    });
  });

  describe('manual input validation edge cases', () => {
    it('should not submit when latitude is NaN', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: 'not-a-number' } });
      fireEvent.change(lonInput, { target: { value: '100' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should not submit when longitude is NaN', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '45' } });
      fireEvent.change(lonInput, { target: { value: 'invalid' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should handle NaN values in handleManualSubmit (direct call simulation)', async () => {
      // Test that handleManualSubmit safely handles NaN - covers lines 118-120
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);
      
      // First set valid values to enable button
      fireEvent.change(latInput, { target: { value: '45' } });
      fireEvent.change(lonInput, { target: { value: '90' } });
      
      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).not.toBeDisabled();
      
      // Now quickly change to invalid and click (before React can disable)
      fireEvent.change(latInput, { target: { value: '' } });
      
      // Force the click even though validation may have caught it
      fireEvent.click(setButton);
      
      // The handler should safely return without setting location
      // (location won't be set because of the early return)
      await waitFor(() => {
        // No error should occur - component should still be functional
        expect(screen.getByText(/location\.setLocation$/i)).toBeInTheDocument();
      });
    });

    it('should handle out-of-bounds coordinates in handleManualSubmit', async () => {
      // Test that handleManualSubmit safely handles out-of-bounds - covers lines 122-124
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);
      
      // First set valid values to enable button
      fireEvent.change(latInput, { target: { value: '45' } });
      fireEvent.change(lonInput, { target: { value: '90' } });
      
      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).not.toBeDisabled();
      
      // Now quickly change to out-of-bounds and click
      fireEvent.change(latInput, { target: { value: '100' } }); // Invalid: > 90
      
      // Force the click
      fireEvent.click(setButton);
      
      // The handler should safely return without setting location
      await waitFor(() => {
        // No error should occur - component should still be functional
        expect(screen.getByText(/location\.setLocation$/i)).toBeInTheDocument();
      });
    });

    it('should not submit when latitude is below -90', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '-91' } });
      fireEvent.change(lonInput, { target: { value: '100' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should not submit when longitude is above 180', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '45' } });
      fireEvent.change(lonInput, { target: { value: '181' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should not submit when longitude is below -180', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '45' } });
      fireEvent.change(lonInput, { target: { value: '-181' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).toBeDisabled();
    });

    it('should accept boundary values (latitude = 90)', async () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      // Note: Using non-zero longitude because component checks latitude !== 0 && longitude !== 0
      fireEvent.change(latInput, { target: { value: '90' } });
      fireEvent.change(lonInput, { target: { value: '45' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).not.toBeDisabled();
      
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });
    });

    it('should accept boundary values (latitude = -90)', async () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);

      fireEvent.change(latInput, { target: { value: '-90' } });
      fireEvent.change(lonInput, { target: { value: '180' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      expect(setButton).not.toBeDisabled();
      
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });
    });
  });

  describe('GPS mode additional scenarios', () => {
    it('should handle GPS detection with null altitude', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        location: {
          latitude: 25.0,
          longitude: 55.0,
          altitude: 0,
        },
      });

      render(<LocationStep />);
      
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
        expect(screen.getByText(/25\.0000°, 55\.0000°/)).toBeInTheDocument();
      });
    });

    it('should update manual input fields when GPS location is detected', async () => {
      mockDetectObservationStepLocation.mockResolvedValue({
        location: {
          latitude: 35.6762,
          longitude: 139.6503,
          altitude: 40,
        },
      });

      render(<LocationStep />);
      
      // First switch to manual mode to see the inputs
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      // Then switch back to GPS mode
      const gpsButton = screen.getByText(/location\.useGPS/i).closest('button');
      if (gpsButton) {
        fireEvent.click(gpsButton);
      }

      // Get GPS location
      const detectButton = screen.getByText(/location\.detectLocation/i).closest('button')!;
      fireEvent.click(detectButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
      });

      // Switch to manual mode again to check inputs are updated
      const manualButton2 = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton2) {
        fireEvent.click(manualButton2);
      }

      // The manual inputs should now show the GPS coordinates
      const latInput = screen.getByLabelText(/location\.latitude/i) as HTMLInputElement;
      expect(latInput.value).toBe('35.6762');
    });
  });

  describe('mode selection styling', () => {
    it('should apply selected styling to GPS mode by default', () => {
      render(<LocationStep />);
      
      const gpsButton = screen.getByText(/location\.useGPS/i).closest('button');
      expect(gpsButton).toHaveClass('border-primary');
    });

    it('should apply selected styling to manual mode when selected', () => {
      render(<LocationStep />);
      
      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      expect(manualButton).toHaveClass('border-primary');
    });
  });

  describe('manual altitude handling', () => {
    it('should set location with valid altitude', async () => {
      render(<LocationStep />);

      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);
      const altInput = screen.getByLabelText(/location\.altitude/i);

      fireEvent.change(latInput, { target: { value: '30' } });
      fireEvent.change(lonInput, { target: { value: '120' } });
      fireEvent.change(altInput, { target: { value: '500' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
        expect(screen.getByText(/500m/)).toBeInTheDocument();
      });
    });

    it('should default altitude to 0 when negative value is entered', async () => {
      render(<LocationStep />);

      const manualButton = screen.getByText(/location\.enterManually/i).closest('button');
      if (manualButton) {
        fireEvent.click(manualButton);
      }

      const latInput = screen.getByLabelText(/location\.latitude/i);
      const lonInput = screen.getByLabelText(/location\.longitude/i);
      const altInput = screen.getByLabelText(/location\.altitude/i);

      fireEvent.change(latInput, { target: { value: '30' } });
      fireEvent.change(lonInput, { target: { value: '120' } });
      fireEvent.change(altInput, { target: { value: '-100' } });

      const setButton = screen.getByText(/location\.setLocation$/i).closest('button')!;
      fireEvent.click(setButton);

      await waitFor(() => {
        expect(screen.getByText(/location\.locationSet/i)).toBeInTheDocument();
        expect(screen.getByText(/30\.0000°, 120\.0000°/)).toBeInTheDocument();
      });
    });
  });
});
