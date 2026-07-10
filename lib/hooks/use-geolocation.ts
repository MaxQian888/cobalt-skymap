'use client';

import { useState, useCallback, useEffect } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  timestamp: number | null;
  permissionStatus: PermissionState | null;
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoRequest?: boolean;
}

export interface UseGeolocationReturn extends GeolocationState {
  requestLocation: () => Promise<void>;
  clearLocation: () => void;
  isSupported: boolean;
}

// ============================================================================
// Default Location (Beijing, China as fallback)
// ============================================================================

const DEFAULT_LOCATION = {
  latitude: 39.9042,
  longitude: 116.4074,
  altitude: 44,
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 60000, // 1 minute cache
    autoRequest = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    altitude: null,
    accuracy: null,
    loading: false,
    error: null,
    timestamp: null,
    permissionStatus: null,
  });

  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  // Check permission status
  const checkPermission = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return null;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setState(prev => ({ ...prev, permissionStatus: result.state }));
      return result.state;
    } catch {
      return null;
    }
  }, []);

  // Request location
  const requestLocation = useCallback(async () => {
    if (!isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser',
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    const geolocationOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, geolocationOptions);
      });

      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        accuracy: position.coords.accuracy,
        loading: false,
        error: null,
        timestamp: position.timestamp,
        permissionStatus: 'granted',
      });

      // Store in localStorage for persistence
      localStorage.setItem('user-location', JSON.stringify({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        altitude: position.coords.altitude,
        timestamp: position.timestamp,
      }));
    } catch (error) {
      let errorMessage = 'Failed to get location';
      
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            setState(prev => ({ ...prev, permissionStatus: 'denied' }));
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
      }

      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, [isSupported, enableHighAccuracy, timeout, maximumAge]);

  // Clear location
  const clearLocation = useCallback(() => {
    setState({
      latitude: null,
      longitude: null,
      altitude: null,
      accuracy: null,
      loading: false,
      error: null,
      timestamp: null,
      permissionStatus: state.permissionStatus,
    });
    localStorage.removeItem('user-location');
  }, [state.permissionStatus]);

  // Initialize from localStorage
  useEffect(() => {
    // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving mount-init timing
    queueMicrotask(() => {
      const stored = localStorage.getItem('user-location');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          // Check if stored location is less than 1 hour old
          if (parsed.timestamp && Date.now() - parsed.timestamp < 3600000) {
            setState(prev => ({
              ...prev,
              latitude: parsed.latitude,
              longitude: parsed.longitude,
              altitude: parsed.altitude,
              timestamp: parsed.timestamp,
            }));
          }
        } catch {
          // Invalid stored data
        }
      }

      checkPermission();
    });
  }, [checkPermission]);

  // Auto request if enabled
  useEffect(() => {
    if (autoRequest && isSupported && state.latitude === null && !state.loading) {
      // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving auto-request timing
      queueMicrotask(() => {
        requestLocation();
      });
    }
  }, [autoRequest, isSupported, state.latitude, state.loading, requestLocation]);

  return {
    ...state,
    requestLocation,
    clearLocation,
    isSupported,
  };
}

// ============================================================================
// Utility: Get location with fallback
// ============================================================================

export function getLocationWithFallback(
  geolocation: GeolocationState
): { latitude: number; longitude: number; altitude: number } {
  if (geolocation.latitude !== null && geolocation.longitude !== null) {
    return {
      latitude: geolocation.latitude,
      longitude: geolocation.longitude,
      altitude: geolocation.altitude ?? DEFAULT_LOCATION.altitude,
    };
  }
  return DEFAULT_LOCATION;
}
