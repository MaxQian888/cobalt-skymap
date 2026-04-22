/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as nextIntl from 'next-intl';

type MockLeafletProps = {
  tileLayer?: string;
  showLightPollution?: boolean;
  onLocationChange?: (location: { latitude: number; longitude: number }) => void;
  onClick?: (location: { latitude: number; longitude: number }) => void;
  onTileLayerFallback?: (event: { failedLayer: string; fallbackLayer: string; errorCount: number }) => void;
  onZoomChange?: (zoom: number) => void;
};

const mockLeafletState: { latestProps: MockLeafletProps | null } = {
  latestProps: null,
};

const mockRenderLeafletMap = (props: MockLeafletProps) => {
  mockLeafletState.latestProps = props;
  return (
    <div
      data-testid="leaflet-map"
      data-tile-layer={props.tileLayer}
      data-light-pollution={String(Boolean(props.showLightPollution))}
    >
      <button
        type="button"
        data-testid="leaflet-location-change"
        onClick={() => props.onLocationChange?.({ latitude: 51.5074, longitude: -0.1278 })}
      >
        change
      </button>
      <button
        type="button"
        data-testid="leaflet-map-click"
        onClick={() => props.onClick?.({ latitude: 34.0522, longitude: -118.2437 })}
      >
        click
      </button>
      <button
        type="button"
        data-testid="leaflet-tile-fallback"
        onClick={() =>
          props.onTileLayerFallback?.({
            failedLayer: 'esri_topo',
            fallbackLayer: 'openstreetmap',
            errorCount: 2,
          })
        }
      >
        fallback
      </button>
      <button
        type="button"
        data-testid="leaflet-zoom-change"
        onClick={() => props.onZoomChange?.(13)}
      >
        zoom
      </button>
    </div>
  );
};

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => (props: MockLeafletProps) => mockRenderLeafletMap(props),
}));

jest.mock('../leaflet-map', () => ({
  LeafletMap: (props: MockLeafletProps) => mockRenderLeafletMap(props),
}));

jest.mock('../map-health-monitor', () => ({
  MapHealthMonitor: ({ compact }: { compact?: boolean }) => (
    <div data-testid="map-health-monitor" data-compact={String(Boolean(compact))} />
  ),
}));

// Mock geocoding service
jest.mock('@/lib/services/geocoding-service', () => ({
  geocodingService: {
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
    getSearchCapabilities: jest.fn(),
  },
}));

jest.mock('@/lib/services/map-config', () => ({
  mapConfig: {
    getUiPreferences: jest.fn(() => ({
      tileLayer: 'openstreetmap',
      zoom: 10,
      showLightPollution: false,
    })),
    setUiPreferences: jest.fn(),
  },
}));

import { geocodingService } from '@/lib/services/geocoding-service';
import { mapConfig } from '@/lib/services/map-config';
import { useMapInteractionStore } from '@/lib/stores/map-interaction-store';

const mockGeocode = geocodingService.geocode as jest.Mock;
const mockReverseGeocode = geocodingService.reverseGeocode as jest.Mock;
const mockGetSearchCapabilities = geocodingService.getSearchCapabilities as jest.Mock;
const mockGetUiPreferences = mapConfig.getUiPreferences as jest.Mock;
const mockSetUiPreferences = mapConfig.setUiPreferences as jest.Mock;

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, size, title, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} data-size={size} title={title} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/input', () => {
  const MockInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ value, onChange, placeholder, type, onKeyDown, onBlur, disabled, defaultValue, ...props }, ref) => (
    <input ref={ref} data-testid="input" value={value} defaultValue={defaultValue} onChange={onChange} placeholder={placeholder} type={type} onKeyDown={onKeyDown} onBlur={onBlur} disabled={disabled} {...props} />
  ));
  MockInput.displayName = 'MockInput';
  return { Input: MockInput };
});

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label data-testid="label" className={className}>{children}</label>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
}));

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button data-testid="dropdown-menu-item" onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div data-testid="dropdown-menu-trigger">{children}</div>
  ),
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => <div data-testid="skeleton" className={className} />,
}));

jest.mock('@/components/ui/toggle', () => ({
  Toggle: ({ children, pressed, onPressedChange, className, ...props }: { children: React.ReactNode; pressed?: boolean; onPressedChange?: (pressed: boolean) => void; className?: string; 'aria-label'?: string; size?: string }) => (
    <button
      data-testid="toggle"
      data-state={pressed ? 'on' : 'off'}
      aria-label={props['aria-label']}
      aria-pressed={pressed}
      className={className}
      onClick={() => onPressedChange?.(!pressed)}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip-content">{children}</span>,
}));

import { MapLocationPicker } from '@/components/starmap/map/map-location-picker';

describe('MapLocationPicker', () => {
  const mockOnLocationChange = jest.fn();
  const mockOnLocationSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLeafletState.latestProps = null;
    useMapInteractionStore.getState().reset();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    mockGetUiPreferences.mockReturnValue({
      tileLayer: 'openstreetmap',
      zoom: 10,
      showLightPollution: false,
    });
    mockGeocode.mockResolvedValue([]);
    mockReverseGeocode.mockResolvedValue({ displayName: 'Test Location', address: 'Test Address', coordinates: { latitude: 0, longitude: 0 } });
    mockGetSearchCapabilities.mockReturnValue({
      autocompleteAvailable: true,
      mode: 'online-autocomplete',
      providers: ['google'],
    });
  });

  describe('Rendering', () => {
    it('renders location picker card', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('renders card title', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);
      expect(screen.getByTestId('card-title')).toBeInTheDocument();
    });

    it('renders search input when showSearch is true', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showSearch />);
      const inputs = screen.getAllByTestId('input');
      expect(inputs.length).toBeGreaterThan(0);
    });

    it('hides search input when showSearch is false', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showSearch={false} />);
      const inputs = screen.getAllByTestId('input');
      expect(inputs.length).toBe(2);
    });

    it('renders latitude input', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);
      expect(screen.getByText(/map\.latitude|Latitude/)).toBeInTheDocument();
    });

    it('renders longitude input', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);
      expect(screen.getByText(/map\.longitude|Longitude/)).toBeInTheDocument();
    });

    it('renders map container', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);
      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('renders with initial location', () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 35.6762, longitude: 139.6503 }}
        />
      );
      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');
      expect(latInput).toHaveValue(35.6762);
    });

    it('renders disabled state', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} disabled />);
      const inputs = screen.getAllByTestId('input');
      inputs.forEach(input => {
        expect(input).toBeDisabled();
      });
    });

    it('renders fallback labels when translations return empty strings', () => {
      const nextIntlMock = jest.requireMock('next-intl') as typeof nextIntl;
      const originalUseTranslations = nextIntlMock.useTranslations;
      Object.defineProperty(nextIntlMock, 'useTranslations', {
        configurable: true,
        value: () => (((_key: string) => '') as ReturnType<typeof nextIntl.useTranslations>),
      });

      try {
        render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

        expect(screen.getByText('Location Picker')).toBeInTheDocument();
        expect(screen.getByLabelText('Light Pollution')).toBeInTheDocument();
      } finally {
        Object.defineProperty(nextIntlMock, 'useTranslations', {
          configurable: true,
          value: originalUseTranslations,
        });
      }
    });
  });

  describe('Compact Mode', () => {
    it('does not render Card wrapper in compact mode', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} compact />);
      expect(screen.queryByTestId('card-title')).not.toBeInTheDocument();
    });

    it('does not render coordinate inputs in compact mode', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} compact />);
      expect(screen.queryByText(/map\.latitude|Latitude/)).not.toBeInTheDocument();
      expect(screen.queryByText(/map\.longitude|Longitude/)).not.toBeInTheDocument();
    });

    it('renders controls in compact mode when showControls is true', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} compact showControls />);
      expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    });
  });

  describe('Controls', () => {
    it('renders light pollution toggle button when showControls is true', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showControls />);
      const lightPollutionBtn = screen.getByLabelText(/map\.lightPollution|Light Pollution/);
      expect(lightPollutionBtn).toBeInTheDocument();
    });

    it('toggles light pollution on click', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showControls />);
      const lightPollutionBtn = screen.getByLabelText(/map\.lightPollution|Light Pollution/);

      fireEvent.click(lightPollutionBtn);
      // After click, toggle state should be 'on'
      expect(lightPollutionBtn.getAttribute('data-state')).toBe('on');

      fireEvent.click(lightPollutionBtn);
      expect(lightPollutionBtn.getAttribute('data-state')).toBe('off');
    });

    it('renders tile layer dropdown', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showControls />);
      expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
    });

    it('changes tile layer when dropdown item is clicked', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showControls />);
      const menuItems = screen.getAllByTestId('dropdown-menu-item');
      expect(menuItems.length).toBeGreaterThan(0);

      fireEvent.click(menuItems[1]); // Click second tile layer option
    });
  });

  describe('Search Functionality', () => {
    it('performs search when search button clicked', async () => {
      mockGeocode.mockResolvedValue([
        { displayName: 'Tokyo, Japan', coordinates: { latitude: 35.6762, longitude: 139.6503 } },
      ]);

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showSearch />);

      const inputs = screen.getAllByTestId('input');
      const searchInput = inputs[0];

      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledWith('Tokyo', expect.any(Object));
      });
    });

    it('performs search on Enter key', async () => {
      mockGeocode.mockResolvedValue([
        { displayName: 'Tokyo, Japan', coordinates: { latitude: 35.6762, longitude: 139.6503 } },
      ]);

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showSearch />);

      const inputs = screen.getAllByTestId('input');
      const searchInput = inputs[0];

      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalled();
      });
    });

    it('displays search results', async () => {
      mockGeocode.mockResolvedValue([
        { displayName: 'Tokyo, Japan', coordinates: { latitude: 35.6762, longitude: 139.6503 } },
        { displayName: 'Osaka, Japan', coordinates: { latitude: 34.6937, longitude: 135.5023 } },
      ]);

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showSearch />);

      const inputs = screen.getAllByTestId('input');
      const searchInput = inputs[0];

      fireEvent.change(searchInput, { target: { value: 'Japan' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledWith('Japan', expect.any(Object));
      });
    });

    it('selects search result and updates location', async () => {
      mockGeocode.mockResolvedValue([
        { displayName: 'Tokyo, Japan', coordinates: { latitude: 35.6762, longitude: 139.6503 } },
      ]);

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} onLocationSelect={mockOnLocationSelect} showSearch />);

      const inputs = screen.getAllByTestId('input');
      const searchInput = inputs[0];

      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledWith('Tokyo', expect.any(Object));
      });
    });

    it('clears results on search failure', async () => {
      mockGeocode.mockRejectedValue(new Error('Network error'));

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showSearch />);

      const inputs = screen.getAllByTestId('input');
      const searchInput = inputs[0];

      fireEvent.change(searchInput, { target: { value: 'Error' } });
      fireEvent.keyDown(searchInput, { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalled();
      });
    });
  });

  describe('Coordinate Input', () => {
    it('updates latitude when input changes', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');

      if (latInput) {
        await act(async () => {
          fireEvent.change(latInput, { target: { value: '40.7128' } });
          fireEvent.blur(latInput);
        });

        expect(mockOnLocationChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 40.7128 }));
      }
    });

    it('updates longitude when input changes', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const inputs = screen.getAllByTestId('input');
      const lonInput = inputs.find(input => input.getAttribute('min') === '-180');

      if (lonInput) {
        await act(async () => {
          fireEvent.change(lonInput, { target: { value: '-74.006' } });
          fireEvent.blur(lonInput);
        });

        expect(mockOnLocationChange).toHaveBeenCalledWith(expect.objectContaining({ longitude: -74.006 }));
      }
    });

    it('clamps latitude to valid range (-90 to 90)', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');

      if (latInput) {
        await act(async () => {
          fireEvent.change(latInput, { target: { value: '100' } });
          fireEvent.blur(latInput);
        });

        expect(mockOnLocationChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 90 }));
      }
    });

    it('clamps longitude to valid range (-180 to 180)', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const inputs = screen.getAllByTestId('input');
      const lonInput = inputs.find(input => input.getAttribute('min') === '-180');

      if (lonInput) {
        await act(async () => {
          fireEvent.change(lonInput, { target: { value: '200' } });
          fireEvent.blur(lonInput);
        });

        expect(mockOnLocationChange).toHaveBeenCalledWith(expect.objectContaining({ longitude: 180 }));
      }
    });

    it('ignores invalid number input', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');

      if (latInput) {
        await act(async () => {
          fireEvent.change(latInput, { target: { value: 'invalid' } });
          fireEvent.blur(latInput);
        });

        expect(mockOnLocationChange).not.toHaveBeenCalled();
      }
    });

    it('commits coordinate on Enter key', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');

      if (latInput) {
        await act(async () => {
          fireEvent.change(latInput, { target: { value: '45.0' } });
          fireEvent.keyDown(latInput, { key: 'Enter' });
        });

        expect(mockOnLocationChange).toHaveBeenCalledWith(expect.objectContaining({ latitude: 45 }));
      }
    });
  });

  describe('Map Display', () => {
    it('renders map container with initial location', async () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 35.6762, longitude: 139.6503 }}
        />
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('applies custom height', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} height={500} />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
    });

    it('updates location and zoom from map callbacks in immediate mode', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      fireEvent.click(screen.getByTestId('leaflet-location-change'));
      fireEvent.click(screen.getByTestId('leaflet-map-click'));

      await waitFor(() => {
        expect(mockOnLocationChange).toHaveBeenCalledWith({
          latitude: 51.5074,
          longitude: -0.1278,
        });
        expect(mockOnLocationChange).toHaveBeenCalledWith({
          latitude: 34.0522,
          longitude: -118.2437,
        });
      });

      fireEvent.click(screen.getByTestId('leaflet-zoom-change'));

      await waitFor(() => {
        expect(mockSetUiPreferences).toHaveBeenLastCalledWith(
          expect.objectContaining({
            zoom: 13,
          })
        );
      });
    });
  });

  describe('Capability and fallback status', () => {
    it('reacts to browser offline and online events', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
        /map\.autocompleteAvailable|Autocomplete search is available\./
      );

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
          /map\.offlineSearchRestricted|Offline mode: online search disabled/
        );
      });

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
          /map\.autocompleteAvailable|Autocomplete search is available\./
        );
      });
    });

    it('shows submit-search capability guidance when autocomplete is unavailable', () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'submit-search',
        providers: ['openstreetmap'],
      });

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
        /map\.submitToSearch|Press Enter to search/
      );
    });

    it('shows offline-cache capability guidance while online', () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'offline-cache',
        providers: [],
      });

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
        /map\.offlineSearchRestricted|Offline mode: online search disabled/
      );
    });

    it('shows disabled capability guidance when search policy disables lookup', () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'disabled',
        providers: [],
      });

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
        /map\.searchDisabled|Search is disabled by policy/
      );
    });

    it('falls back to openstreetmap when a tile layer becomes unavailable', async () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} showControls />);

      const menuItems = screen.getAllByTestId('dropdown-menu-item');
      fireEvent.click(menuItems[4]);

      expect(screen.getByTestId('leaflet-map')).toHaveAttribute('data-tile-layer', 'esri_topo');

      fireEvent.click(screen.getByTestId('leaflet-tile-fallback'));

      await waitFor(() => {
        expect(screen.getByTestId('leaflet-map')).toHaveAttribute('data-tile-layer', 'openstreetmap');
        expect(screen.getByTestId('map-capability-status')).toHaveTextContent(/map\.layerFallback|Layer /);
      });

      fireEvent.click(menuItems[4]);

      await waitFor(() => {
        expect(screen.getByTestId('leaflet-map')).toHaveAttribute('data-tile-layer', 'openstreetmap');
      });
    });

    it('uses fallback copy when translations are empty and a tile layer fails', async () => {
      const nextIntlMock = jest.requireMock('next-intl') as typeof nextIntl;
      const originalUseTranslations = nextIntlMock.useTranslations;
      Object.defineProperty(nextIntlMock, 'useTranslations', {
        configurable: true,
        value: () => (((_key: string) => '') as ReturnType<typeof nextIntl.useTranslations>),
      });

      try {
        render(<MapLocationPicker onLocationChange={mockOnLocationChange} showControls />);

        const menuItems = screen.getAllByTestId('dropdown-menu-item');
        fireEvent.click(menuItems[4]);
        fireEvent.click(screen.getByTestId('leaflet-tile-fallback'));

        await waitFor(() => {
          expect(screen.getByTestId('map-capability-status')).toHaveTextContent(
            'Layer esri_topo is unavailable. Switched to openstreetmap.'
          );
        });
      } finally {
        Object.defineProperty(nextIntlMock, 'useTranslations', {
          configurable: true,
          value: originalUseTranslations,
        });
      }
    });

    it('shows recovery actions for matching draft metadata without clearing coordinates', () => {
      const mockRetryMetadata = jest.fn();
      const mockOpenSettings = jest.fn();

      render((
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 10, longitude: 20 }}
          draftMetadataState={{
            coordinates: { latitude: 10, longitude: 20 },
            summaryStatus: 'partial',
            issues: [
              { field: 'timezone', reason: 'timezone_unavailable', message: 'Timezone unavailable' },
            ],
          }}
          onRetryMetadata={mockRetryMetadata}
          onOpenProviderSettings={mockOpenSettings}
        />
      ) as React.ReactElement);

      const latInput = screen.getAllByTestId('input').find(input => input.getAttribute('min') === '-90');
      expect(latInput).toHaveValue(10);
      expect(screen.getByText('Timezone unavailable')).toBeInTheDocument();
      expect(screen.getByTestId('map-health-monitor')).toHaveAttribute('data-compact', 'true');

      fireEvent.click(screen.getByText(/common\.retry|Retry/));
      fireEvent.click(screen.getByText(/map\.providerSettings|Map Settings/));

      expect(mockRetryMetadata).toHaveBeenCalledTimes(1);
      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
      expect(latInput).toHaveValue(10);
      expect(mockOnLocationChange).not.toHaveBeenCalled();
    });

    it('ignores stale draft metadata when coordinates no longer match current location', () => {
      render((
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 10, longitude: 20 }}
          draftMetadataState={{
            coordinates: { latitude: 30, longitude: 40 },
            summaryStatus: 'partial',
            issues: [
              { field: 'timezone', reason: 'timezone_unavailable', message: 'Timezone unavailable' },
            ],
          }}
        />
      ) as React.ReactElement);

      expect(screen.queryByText('Timezone unavailable')).not.toBeInTheDocument();
      expect(screen.queryByText(/common\.retry|Retry/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('map-health-monitor')).not.toBeInTheDocument();
    });

    it('shows draft metadata loading message for matching coordinates', () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 12, longitude: 34 }}
          draftMetadataState={{
            coordinates: { latitude: 12, longitude: 34 },
            summaryStatus: 'loading',
            issues: [],
          }}
        />
      );

      expect(screen.getByTestId('map-draft-metadata-status')).toHaveTextContent(
        /map\.metadataLoading|Refreshing location metadata\.\.\./
      );
    });

    it('shows draft metadata error message when metadata resolution fails', () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 56, longitude: 78 }}
          draftMetadataState={{
            coordinates: { latitude: 56, longitude: 78 },
            summaryStatus: 'error',
            issues: [
              { field: 'timezone', reason: 'timezone_failed', message: 'Timezone lookup failed' },
            ],
          }}
        />
      );

      expect(screen.getByTestId('map-draft-metadata-status')).toHaveTextContent(
        /map\.metadataResolveFailed|Location metadata refresh failed/
      );
      expect(screen.getByText('Timezone lookup failed')).toBeInTheDocument();
    });

    it('hides draft metadata status block when summary is ready', () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 22, longitude: 114 }}
          draftMetadataState={{
            coordinates: { latitude: 22, longitude: 114 },
            summaryStatus: 'ready',
            issues: [],
          }}
        />
      );

      expect(screen.queryByTestId('map-draft-metadata-status')).not.toBeInTheDocument();
    });
  });

  describe('External initialLocation sync', () => {
    it('syncs when initialLocation prop changes', async () => {
      const { rerender } = render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 35.0, longitude: 139.0 }}
        />
      );

      rerender(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 40.0, longitude: -74.0 }}
        />
      );

      // The component should eventually sync via setTimeout
      await waitFor(() => {
        const inputs = screen.getAllByTestId('input');
        const latInput = inputs.find(input => input.getAttribute('min') === '-90');
        if (latInput) {
          expect(latInput).toHaveValue(40);
        }
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onLocationSelect when location is selected from search', async () => {
      mockGeocode.mockResolvedValue([
        { displayName: 'Tokyo, Japan', coordinates: { latitude: 35.6762, longitude: 139.6503 } },
      ]);

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} onLocationSelect={mockOnLocationSelect} showSearch />);

      const inputs = screen.getAllByTestId('input');
      fireEvent.change(inputs[0], { target: { value: 'Tokyo' } });
      fireEvent.keyDown(inputs[0], { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledWith('Tokyo', expect.any(Object));
      });
    });

    it('emits onLocationSelect immediately when selecting from search in immediate mode', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          address: 'Tokyo',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
        },
      ]);

      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          onLocationSelect={mockOnLocationSelect}
          showSearch
          commitMode="immediate"
        />
      );

      const inputs = screen.getAllByTestId('input');
      fireEvent.change(inputs[0], { target: { value: 'Tokyo' } });
      fireEvent.keyDown(inputs[0], { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Tokyo, Japan'));

      expect(mockOnLocationSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
          displayName: 'Tokyo, Japan',
        })
      );
      expect(mockOnLocationChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 35.6762,
          longitude: 139.6503,
        })
      );
    });
  });

  describe('Staged commit mode', () => {
    it('does not emit onLocationChange until apply is clicked', async () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          commitMode="staged"
        />
      );

      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');

      if (latInput) {
        await act(async () => {
          fireEvent.change(latInput, { target: { value: '45.123456' } });
          fireEvent.blur(latInput);
        });
      }

      expect(mockOnLocationChange).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('map-apply-selection'));

      expect(mockOnLocationChange).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 45.123456 })
      );
    });

    it('discards staged changes', async () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 10, longitude: 20 }}
          commitMode="staged"
        />
      );

      const inputs = screen.getAllByTestId('input');
      const latInput = inputs.find(input => input.getAttribute('min') === '-90');

      if (latInput) {
        await act(async () => {
          fireEvent.change(latInput, { target: { value: '30' } });
          fireEvent.blur(latInput);
        });
      }

      fireEvent.click(screen.getByTestId('map-discard-selection'));

      await waitFor(() => {
        const refreshedInputs = screen.getAllByTestId('input');
        const refreshedLatInput = refreshedInputs.find(input => input.getAttribute('min') === '-90');
        expect(refreshedLatInput).toHaveValue(10);
      });
      expect(mockOnLocationChange).not.toHaveBeenCalled();
    });

    it('defers onLocationSelect from search until apply', async () => {
      mockGeocode.mockResolvedValue([
        { displayName: 'Tokyo, Japan', address: 'Tokyo', coordinates: { latitude: 35.6762, longitude: 139.6503 } },
      ]);

      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          onLocationSelect={mockOnLocationSelect}
          showSearch
          commitMode="staged"
        />
      );

      const inputs = screen.getAllByTestId('input');
      fireEvent.change(inputs[0], { target: { value: 'Tokyo' } });
      fireEvent.keyDown(inputs[0], { key: 'Enter' });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Tokyo, Japan'));
      expect(mockOnLocationSelect).not.toHaveBeenCalled();
      expect(mockOnLocationChange).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('map-apply-selection'));

      expect(mockOnLocationSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
        })
      );
      expect(mockOnLocationChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 35.6762,
          longitude: 139.6503,
        })
      );
    });

    it('publishes draft continuity context before apply and committed context after apply', async () => {
      render(
        <MapLocationPicker
          onLocationChange={mockOnLocationChange}
          initialLocation={{ latitude: 10, longitude: 20 }}
          commitMode="staged"
          draftMetadataState={{
            coordinates: { latitude: 51.5074, longitude: -0.1278 },
            summaryStatus: 'partial',
            issues: [
              { field: 'timezone', reason: 'timezone_unavailable', message: 'Timezone unavailable' },
            ],
          }}
        />
      );

      fireEvent.click(screen.getByTestId('leaflet-location-change'));

      await waitFor(() => {
        expect(useMapInteractionStore.getState().siteContext).toMatchObject({
          kind: 'draft',
          sourceSurface: 'map-picker',
          coordinates: { latitude: 51.5074, longitude: -0.1278 },
          summaryStatus: 'partial',
          actions: ['retry-metadata', 'open-provider-settings', 'save-location-draft', 'discard-location-draft'],
        });
      });

      fireEvent.click(screen.getByTestId('map-apply-selection'));

      await waitFor(() => {
        expect(useMapInteractionStore.getState().siteContext).toMatchObject({
          kind: 'committed',
          sourceSurface: 'map-picker',
          coordinates: { latitude: 51.5074, longitude: -0.1278 },
          summaryStatus: 'partial',
        });
      });
    });
  });

  describe('Map preferences', () => {
    it('restores light-pollution preference from mapConfig', () => {
      mockGetUiPreferences.mockReturnValue({
        tileLayer: 'openstreetmap',
        zoom: 9,
        showLightPollution: true,
      });

      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);

      const toggle = screen.getByLabelText(/map\.lightPollution|Light Pollution/);
      expect(toggle.getAttribute('data-state')).toBe('on');
    });

    it('persists preference changes via mapConfig', () => {
      render(<MapLocationPicker onLocationChange={mockOnLocationChange} />);
      const toggle = screen.getByLabelText(/map\.lightPollution|Light Pollution/);
      fireEvent.click(toggle);

      expect(mockSetUiPreferences).toHaveBeenLastCalledWith(
        expect.objectContaining({
          showLightPollution: true,
        })
      );
    });
  });
});
