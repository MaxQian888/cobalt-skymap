/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as nextIntl from 'next-intl';

// Mock geocoding service
jest.mock('@/lib/services/geocoding-service', () => ({
  geocodingService: {
    geocode: jest.fn(),
    reverseGeocode: jest.fn(),
    getSearchCapabilities: jest.fn(() => ({
      autocompleteAvailable: true,
      mode: 'online-autocomplete',
      providers: ['google'],
    })),
  },
}));

jest.mock('@/lib/services/location-acquisition', () => ({
  acquireCurrentLocation: jest.fn(),
}));

import { geocodingService } from '@/lib/services/geocoding-service';
import { acquireCurrentLocation } from '@/lib/services/location-acquisition';

const mockGeocode = geocodingService.geocode as jest.Mock;
const mockReverseGeocode = geocodingService.reverseGeocode as jest.Mock;
const mockGetSearchCapabilities = geocodingService.getSearchCapabilities as jest.Mock;
const mockAcquireCurrentLocation = acquireCurrentLocation as jest.Mock;

// Mock UI components - Input must be defined inline to avoid hoisting issues
jest.mock('@/components/ui/input', () => ({
  Input: jest.fn().mockImplementation((props) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('input', {
      'data-testid': 'search-input',
      ...props,
    });
  }),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="scroll-area" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

import { LocationSearch } from '@/components/starmap/map/location-search';

describe('LocationSearch', () => {
  const mockOnLocationSelect = jest.fn();
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetSearchCapabilities.mockReturnValue({
      autocompleteAvailable: true,
      mode: 'online-autocomplete',
      providers: ['google'],
    });
    mockAcquireCurrentLocation.mockResolvedValue({
      status: 'success',
      source: 'browser',
      location: {
        latitude: 35.6762,
        longitude: 139.6503,
        altitude: null,
        accuracy: 10,
        timestamp: 1704067200000,
      },
    });
    
    // Mock localStorage
    const localStorageMock = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Rendering', () => {
    it('renders search input', () => {
      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      expect(screen.getByTestId('search-input')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          placeholder="Custom placeholder"
        />
      );
      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('renders with initial value', () => {
      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          initialValue="Tokyo"
        />
      );
      expect(screen.getByDisplayValue('Tokyo')).toBeInTheDocument();
    });

    it('renders disabled state', () => {
      render(<LocationSearch onLocationSelect={mockOnLocationSelect} disabled />);
      expect(screen.getByTestId('search-input')).toBeDisabled();
    });

    it('renders fallback labels when translations return empty strings', async () => {
      const nextIntlMock = jest.requireMock('next-intl') as typeof nextIntl;
      const originalUseTranslations = nextIntlMock.useTranslations;
      Object.defineProperty(nextIntlMock, 'useTranslations', {
        configurable: true,
        value: () => (((_key: string) => '') as ReturnType<typeof nextIntl.useTranslations>),
      });

      try {
        render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

        expect(screen.getByPlaceholderText('Search for a location...')).toBeInTheDocument();

        fireEvent.focus(screen.getByTestId('search-input'));

        await waitFor(() => {
          expect(screen.getByText('Current Location')).toBeInTheDocument();
        });
      } finally {
        Object.defineProperty(nextIntlMock, 'useTranslations', {
          configurable: true,
          value: originalUseTranslations,
        });
      }
    });
  });

  describe('Search Functionality', () => {
    it('triggers search after debounce period', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });

      // Debounce period is 300ms
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledWith('Tokyo', expect.objectContaining({ provider: 'google' }));
      });
    });

    it('aborts the previous in-flight search when a new query starts', async () => {
      const abortSpy = jest.spyOn(AbortController.prototype, 'abort');
      mockGeocode.mockImplementation(() => {
        return new Promise(() => undefined);
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tok' } });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledTimes(1);
      });

      fireEvent.change(input, { target: { value: 'Tokyo' } });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledTimes(2);
      });
      expect(abortSpy).toHaveBeenCalled();
      abortSpy.mockRestore();
    });

    it('does not search when query is empty', async () => {
      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: '' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it('displays search results', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
        {
          displayName: 'Kyoto, Japan',
          coordinates: { latitude: 35.0116, longitude: 135.7681 },
          address: 'Kyoto',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Japan' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
        expect(screen.getByText('Kyoto, Japan')).toBeInTheDocument();
      });
    });

    it('selects location from search results', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Tokyo, Japan'));

      expect(mockOnLocationSelect).toHaveBeenCalledWith({
        coordinates: { latitude: 35.6762, longitude: 139.6503 },
        address: 'Tokyo',
        displayName: 'Tokyo, Japan',
      });
    });

    it('handles search errors gracefully', async () => {
      mockGeocode.mockRejectedValue(new Error('Network error'));

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Error test' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Should not crash, results should be empty
      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalled();
      });
    });

    it('shows no-results message in online-autocomplete mode when nothing is found', async () => {
      mockGeocode.mockResolvedValue([]);
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() =>
            JSON.stringify([
              {
                query: 'History item',
                result: {
                  displayName: 'History Place',
                  coordinates: { latitude: 1, longitude: 2 },
                  address: 'History Address',
                },
                timestamp: Date.now(),
              },
            ])
          ),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
        writable: true,
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'NoSuchPlace' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText(/map\.noResults|No locations found/)).toBeInTheDocument();
      });
    });

    it('ignores aborted searches without logging an error', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockGeocode.mockRejectedValue(abortError);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalled();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Navigation', () => {
    it('closes dropdown on Escape key', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Tokyo, Japan')).not.toBeInTheDocument();
      });
    });

    it('navigates results with arrow keys', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
        {
          displayName: 'Osaka, Japan',
          coordinates: { latitude: 34.6937, longitude: 135.5023 },
          address: 'Osaka',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Japan' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      // Navigate up
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      // No assertion needed - just ensure it doesn't crash
    });

    it('selects item on Enter key', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);
      
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnLocationSelect).toHaveBeenCalled();
    });

    it('selects recent history entry on Enter when navigating history', async () => {
      const historyItem = {
        query: 'Kyoto',
        result: {
          displayName: 'Kyoto, Japan',
          coordinates: { latitude: 35.0116, longitude: 135.7681 },
          address: 'Kyoto',
        },
        timestamp: Date.now(),
      };
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: jest.fn(() => JSON.stringify([historyItem])),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        },
        writable: true,
      });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showCurrentLocation={false}
          showRecentSearches
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText('Kyoto, Japan')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnLocationSelect).toHaveBeenCalledWith({
        coordinates: { latitude: 35.0116, longitude: 135.7681 },
        address: 'Kyoto',
        displayName: 'Kyoto, Japan',
      });
    });
  });

  describe('Clear Button', () => {
    it('shows clear button when query is not empty', () => {
      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          initialValue="Tokyo"
        />
      );

      // Clear button should be visible
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('clears input when clear button is clicked', () => {
      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          initialValue="Tokyo"
        />
      );

      const clearButton = screen.getAllByRole('button')[0];
      fireEvent.click(clearButton);

      expect(screen.getByTestId('search-input')).toHaveValue('');
    });
  });

  describe('Current Location', () => {
    it('shows current location action', async () => {
      mockReverseGeocode.mockResolvedValue({
        displayName: 'Tokyo, Japan',
        address: 'Tokyo',
        coordinates: { latitude: 35.6762, longitude: 139.6503 },
      });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showCurrentLocation
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      // Current location option should be visible
      await waitFor(() => {
        expect(screen.getByText(/map\.currentLocation|Current Location/)).toBeInTheDocument();
      });
    });

    it('uses reverse geocode result when current location succeeds', async () => {
      mockReverseGeocode.mockResolvedValue({
        displayName: 'Shinjuku, Tokyo',
        address: 'Shinjuku',
        coordinates: { latitude: 35.6895, longitude: 139.6917 },
      });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showCurrentLocation
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/map\.currentLocation|Current Location/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/map\.currentLocation|Current Location/));

      await waitFor(() => {
        expect(mockOnLocationSelect).toHaveBeenCalledWith({
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Shinjuku',
          displayName: 'Shinjuku, Tokyo',
        });
        expect(screen.getByTestId('search-input')).toHaveValue('Shinjuku, Tokyo');
      });
    });
  });

  describe('Recent Searches', () => {
    it('handles malformed or inaccessible localStorage history gracefully', () => {
      const localStorageMock = {
        getItem: jest.fn(() => {
          throw new Error('Read failure');
        }),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      expect(() => {
        render(<LocationSearch onLocationSelect={mockOnLocationSelect} showRecentSearches />);
      }).not.toThrow();
      expect(localStorageMock.getItem).toHaveBeenCalledWith('skymap-location-search-history');
    });

    it('loads search history from localStorage', () => {
      const mockHistory = [
        {
          query: 'Tokyo',
          result: {
            displayName: 'Tokyo, Japan',
            coordinates: { latitude: 35.6762, longitude: 139.6503 },
            address: 'Tokyo',
          },
          timestamp: Date.now(),
        },
      ];

      const localStorageMock = {
        getItem: jest.fn(() => JSON.stringify(mockHistory)),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showRecentSearches
        />
      );

      expect(localStorageMock.getItem).toHaveBeenCalledWith('skymap-location-search-history');
    });

    it('saves search to history when location is selected', async () => {
      const localStorageMock = {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showRecentSearches
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Tokyo, Japan'));

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });
    });

    it('deduplicates history when selecting the same location again', async () => {
      const timestamp = Date.now();
      const existingHistory = [
        {
          query: 'Tokyo',
          result: {
            displayName: 'Tokyo, Japan',
            coordinates: { latitude: 35.6762, longitude: 139.6503 },
            address: 'Tokyo',
          },
          timestamp,
        },
      ];
      const localStorageMock = {
        getItem: jest.fn(() => JSON.stringify(existingHistory)),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} showRecentSearches />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Tokyo, Japan'));

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled();
      });

      const lastSaved = localStorageMock.setItem.mock.calls.at(-1)?.[1];
      const parsedHistory = JSON.parse(lastSaved as string);
      expect(parsedHistory).toHaveLength(1);
      expect(parsedHistory[0].query).toBe('Tokyo');
    });

    it('keeps selection working when localStorage write fails', async () => {
      const localStorageMock = {
        getItem: jest.fn(() => null),
        setItem: jest.fn(() => {
          throw new Error('Write failure');
        }),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      mockGeocode.mockResolvedValue([
        {
          displayName: 'Osaka, Japan',
          coordinates: { latitude: 34.6937, longitude: 135.5023 },
          address: 'Osaka',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} showRecentSearches />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Osaka' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Osaka, Japan')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Osaka, Japan'));

      await waitFor(() => {
        expect(mockOnLocationSelect).toHaveBeenCalledWith({
          coordinates: { latitude: 34.6937, longitude: 135.5023 },
          address: 'Osaka',
          displayName: 'Osaka, Japan',
        });
      });
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it('displays recent search history items in dropdown', () => {
      const mockHistory = [
        {
          query: 'Paris',
          result: {
            displayName: 'Paris, France',
            coordinates: { latitude: 48.8566, longitude: 2.3522 },
            address: 'Paris',
          },
          timestamp: Date.now(),
        },
      ];

      const localStorageMock = {
        getItem: jest.fn(() => JSON.stringify(mockHistory)),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showRecentSearches
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      expect(screen.getByText('Paris, France')).toBeInTheDocument();
    });

    it('filters out expired history items', () => {
      const expiredHistory = [
        {
          query: 'Old',
          result: {
            displayName: 'Old Place',
            coordinates: { latitude: 0, longitude: 0 },
            address: 'Old',
          },
          timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
        },
      ];

      const localStorageMock = {
        getItem: jest.fn(() => JSON.stringify(expiredHistory)),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      };
      Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showRecentSearches
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      expect(screen.queryByText('Old Place')).not.toBeInTheDocument();
    });
  });

  describe('Search Modes', () => {
    it('does not call geocode while typing in submit-search mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'submit-search',
        providers: ['openstreetmap'],
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Berlin' } });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it('shows submit-to-search message in submit-search mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'submit-search',
        providers: [],
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/map\.submitToSearch|Press Enter to search/)).toBeInTheDocument();
      });
    });

    it('triggers search on Enter in submit-search mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'submit-search',
        providers: ['openstreetmap'],
      });

      mockGeocode.mockResolvedValue([]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Berlin' } });
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockGeocode).toHaveBeenCalledWith('Berlin', expect.any(Object));
      });
    });

    it('shows offline message in offline-cache mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'offline-cache',
        providers: [],
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/map\.offlineSearchRestricted|Offline mode/)).toBeInTheDocument();
      });
    });

    it('does not trigger geocode on Enter in offline-cache mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'offline-cache',
        providers: [],
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockGeocode).not.toHaveBeenCalled();
    });

    it('shows disabled message in disabled search mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'disabled',
        providers: [],
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/map\.searchDisabled|Search is disabled/)).toBeInTheDocument();
      });
    });

    it('does not trigger geocode on Enter in disabled mode', async () => {
      mockGetSearchCapabilities.mockReturnValue({
        autocompleteAvailable: false,
        mode: 'disabled',
        providers: [],
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockGeocode).not.toHaveBeenCalled();
    });
  });

  describe('Click Outside', () => {
    it('closes dropdown when clicking outside', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo, Japan',
          coordinates: { latitude: 35.6762, longitude: 139.6503 },
          address: 'Tokyo',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('Tokyo, Japan')).toBeInTheDocument();
      });

      fireEvent.pointerDown(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Tokyo, Japan')).not.toBeInTheDocument();
      });
    });
  });

  describe('AutoFocus', () => {
    it('focuses input when autoFocus is true', () => {
      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          autoFocus
        />
      );

      const input = screen.getByTestId('search-input');
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Geolocation Edge Cases', () => {
    it('shows denied-location message when current location permission is denied', async () => {
      mockAcquireCurrentLocation.mockResolvedValue({
        status: 'permission_denied',
        source: 'browser',
        message: 'Permission denied',
      });

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showCurrentLocation
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/map\.currentLocation|Current Location/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/map\.currentLocation|Current Location/));

      await waitFor(() => {
        expect(mockAcquireCurrentLocation).toHaveBeenCalled();
        expect(screen.getByText(/map\.locationPermissionDenied|Location permission denied/)).toBeInTheDocument();
      });
    });

    it('falls back to coordinates string when reverse geocode fails', async () => {
      mockReverseGeocode.mockRejectedValue(new Error('Reverse geocode failed'));

      render(
        <LocationSearch
          onLocationSelect={mockOnLocationSelect}
          showCurrentLocation
        />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/map\.currentLocation|Current Location/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/map\.currentLocation|Current Location/));

      await waitFor(() => {
        expect(mockOnLocationSelect).toHaveBeenCalledWith(
          expect.objectContaining({
            coordinates: { latitude: 35.6762, longitude: 139.6503 },
          })
        );
      });
    });

    it('shows timeout message when current location request times out', async () => {
      mockAcquireCurrentLocation.mockResolvedValue({
        status: 'timeout',
        source: 'browser',
        message: 'Timed out',
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} showCurrentLocation />);

      fireEvent.focus(screen.getByTestId('search-input'));
      fireEvent.click(screen.getByText(/map\.currentLocation|Current Location/));

      await waitFor(() => {
        expect(screen.getByText(/map\.locationTimedOut|Location request timed out/)).toBeInTheDocument();
      });
    });

    it('shows unavailable message when geolocation is unavailable', async () => {
      mockAcquireCurrentLocation.mockResolvedValue({
        status: 'unavailable',
        source: 'browser',
        message: 'Unavailable',
      });

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} showCurrentLocation />);

      fireEvent.focus(screen.getByTestId('search-input'));
      fireEvent.click(screen.getByText(/map\.currentLocation|Current Location/));

      await waitFor(() => {
        expect(screen.getByText(/map\.geolocationNotSupported|Geolocation not supported/)).toBeInTheDocument();
      });
    });

    it('shows failed message when current location processing rejects', async () => {
      mockAcquireCurrentLocation.mockRejectedValue(new Error('Acquisition failed'));

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} showCurrentLocation />);

      fireEvent.focus(screen.getByTestId('search-input'));
      fireEvent.click(screen.getByText(/map\.currentLocation|Current Location/));

      await waitFor(() => {
        expect(screen.getByText(/map\.locationRequestFailed|Failed to get current location/)).toBeInTheDocument();
      });
    });
  });

  describe('Result Type Badge', () => {
    it('shows badge when result has type', async () => {
      mockGeocode.mockResolvedValue([
        {
          displayName: 'Tokyo Tower',
          coordinates: { latitude: 35.6586, longitude: 139.7454 },
          address: 'Tokyo',
          type: 'landmark',
        },
      ]);

      render(<LocationSearch onLocationSelect={mockOnLocationSelect} />);

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'Tokyo Tower' } });
      fireEvent.focus(input);

      act(() => {
        jest.advanceTimersByTime(300);
      });

      await waitFor(() => {
        expect(screen.getByText('landmark')).toBeInTheDocument();
      });
    });
  });

  describe('Unmount Cleanup', () => {
    it('cleans up timeout and abort controller on unmount', () => {
      const { unmount } = render(
        <LocationSearch onLocationSelect={mockOnLocationSelect} />
      );

      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'test' } });

      unmount();
    });
  });
});
