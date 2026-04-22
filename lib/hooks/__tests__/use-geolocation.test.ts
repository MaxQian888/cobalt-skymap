/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '../use-geolocation';

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// Mock permissions API
const mockPermissions = {
  query: jest.fn(),
};

// Mock GeolocationPositionError
class MockGeolocationPositionError extends Error {
  static PERMISSION_DENIED = 1;
  static POSITION_UNAVAILABLE = 2;
  static TIMEOUT = 3;
  
  PERMISSION_DENIED = 1;
  POSITION_UNAVAILABLE = 2;
  TIMEOUT = 3;
  code: number;
  
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

// @ts-expect-error - Adding global mock
global.GeolocationPositionError = MockGeolocationPositionError;

describe('useGeolocation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup geolocation mock
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
      configurable: true,
    });
    
    // Setup permissions mock
    Object.defineProperty(navigator, 'permissions', {
      value: mockPermissions,
      writable: true,
      configurable: true,
    });

    mockPermissions.query.mockImplementation(() => new Promise(() => undefined));
  });

  // ============================================================================
  // Initial state
  // ============================================================================
  describe('initial state', () => {
    it('returns initial state', () => {
      const { result } = renderHook(() => useGeolocation());

      expect(result.current.latitude).toBeNull();
      expect(result.current.longitude).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('isSupported is true when geolocation is available', () => {
      const { result } = renderHook(() => useGeolocation());
      expect(result.current.isSupported).toBe(true);
    });

    it('has requestLocation function', () => {
      const { result } = renderHook(() => useGeolocation());
      expect(typeof result.current.requestLocation).toBe('function');
    });

    it('has clearLocation function', () => {
      const { result } = renderHook(() => useGeolocation());
      expect(typeof result.current.clearLocation).toBe('function');
    });
  });

  // ============================================================================
  // Location request
  // ============================================================================
  describe('requestLocation', () => {
    it('sets loading to true when requesting', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation(() => {
        // Never resolve - simulates pending request
      });

      const { result } = renderHook(() => useGeolocation());

      act(() => {
        result.current.requestLocation();
      });

      expect(result.current.loading).toBe(true);
    });

    it('updates state with position on success', async () => {
      const mockPosition = {
        coords: {
          latitude: 39.9042,
          longitude: 116.4074,
          altitude: 44,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.requestLocation();
      });

      expect(result.current.latitude).toBe(39.9042);
      expect(result.current.longitude).toBe(116.4074);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('sets error on failure', async () => {
      const mockError = {
        code: 1,
        message: 'User denied Geolocation',
      };

      mockGeolocation.getCurrentPosition.mockImplementation((_, error) => {
        error(mockError);
      });

      const { result } = renderHook(() => useGeolocation());

      await act(async () => {
        await result.current.requestLocation();
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });

  // ============================================================================
  // Options
  // ============================================================================
  describe('options', () => {
    it('accepts enableHighAccuracy option', () => {
      const { result } = renderHook(() =>
        useGeolocation({ enableHighAccuracy: false })
      );
      expect(result.current.isSupported).toBe(true);
    });

    it('accepts timeout option', () => {
      const { result } = renderHook(() =>
        useGeolocation({ timeout: 5000 })
      );
      expect(result.current.isSupported).toBe(true);
    });

    it('accepts maximumAge option', () => {
      const { result } = renderHook(() =>
        useGeolocation({ maximumAge: 30000 })
      );
      expect(result.current.isSupported).toBe(true);
    });
  });

  // ============================================================================
  // clearLocation
  // ============================================================================
  describe('clearLocation', () => {
    it('resets location state', async () => {
      const mockPosition = {
        coords: {
          latitude: 39.9042,
          longitude: 116.4074,
          altitude: 44,
          accuracy: 10,
        },
        timestamp: Date.now(),
      };

      mockGeolocation.getCurrentPosition.mockImplementation((success) => {
        success(mockPosition);
      });

      const { result } = renderHook(() => useGeolocation());

      // First get location
      await act(async () => {
        await result.current.requestLocation();
      });

      expect(result.current.latitude).toBe(39.9042);

      // Then clear it
      act(() => {
        result.current.clearLocation();
      });

      expect(result.current.latitude).toBeNull();
      expect(result.current.longitude).toBeNull();
    });
  });
});
