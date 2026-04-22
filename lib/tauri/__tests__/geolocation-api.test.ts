/**
 * @jest-environment jsdom
 */

// Mock platform functions
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => true),
  isMobile: jest.fn(() => true),
}));

// Mock @tauri-apps/plugin-geolocation
const mockCheckPermissions = jest.fn();
const mockRequestPermissions = jest.fn();
const mockGetCurrentPosition = jest.fn();
const mockWatchPosition = jest.fn();
const mockClearWatch = jest.fn();

jest.mock('@tauri-apps/plugin-geolocation', () => ({
  checkPermissions: mockCheckPermissions,
  requestPermissions: mockRequestPermissions,
  getCurrentPosition: mockGetCurrentPosition,
  watchPosition: mockWatchPosition,
  clearWatch: mockClearWatch,
}));

import { isTauri, isMobile } from '@/lib/storage/platform';
import { logManager } from '@/lib/logger';
import { geolocationApi } from '../geolocation-api';

const mockIsTauri = isTauri as jest.Mock;
const mockIsMobile = isMobile as jest.Mock;

describe('geolocationApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockIsMobile.mockReturnValue(true);
    logManager.initialize({ enableConsole: false, enablePersistence: false });
  });

  describe('isAvailable', () => {
    it('should return true when Tauri and mobile', () => {
      mockIsTauri.mockReturnValue(true);
      mockIsMobile.mockReturnValue(true);

      expect(geolocationApi.isAvailable()).toBe(true);
    });

    it('should return false when not Tauri', () => {
      mockIsTauri.mockReturnValue(false);
      mockIsMobile.mockReturnValue(true);

      expect(geolocationApi.isAvailable()).toBe(false);
    });

    it('should return false when not mobile', () => {
      mockIsTauri.mockReturnValue(true);
      mockIsMobile.mockReturnValue(false);

      expect(geolocationApi.isAvailable()).toBe(false);
    });
  });

  describe('checkPermissions', () => {
    it('should check permissions', async () => {
      const mockStatus = { location: 'granted', coarseLocation: 'granted' };
      mockCheckPermissions.mockResolvedValue(mockStatus);

      const result = await geolocationApi.checkPermissions();

      expect(mockCheckPermissions).toHaveBeenCalled();
      expect(result).toEqual(mockStatus);
    });

    it('should throw error when not available', async () => {
      mockIsTauri.mockReturnValue(false);

      await expect(geolocationApi.checkPermissions()).rejects.toThrow(
        'Geolocation API is only available on Tauri mobile platforms'
      );
    });
  });

  describe('requestPermissions', () => {
    it('should request location permission', async () => {
      const mockStatus = { location: 'granted', coarseLocation: 'prompt' };
      mockRequestPermissions.mockResolvedValue(mockStatus);

      const result = await geolocationApi.requestPermissions(['location']);

      expect(mockRequestPermissions).toHaveBeenCalledWith(['location']);
      expect(result).toEqual(mockStatus);
    });

    it('should request default permissions', async () => {
      const mockStatus = { location: 'granted', coarseLocation: 'prompt' };
      mockRequestPermissions.mockResolvedValue(mockStatus);

      await geolocationApi.requestPermissions();

      expect(mockRequestPermissions).toHaveBeenCalledWith(['location']);
    });

    it('should request coarse location', async () => {
      const mockStatus = { location: 'denied', coarseLocation: 'granted' };
      mockRequestPermissions.mockResolvedValue(mockStatus);

      const result = await geolocationApi.requestPermissions(['coarseLocation']);

      expect(mockRequestPermissions).toHaveBeenCalledWith(['coarseLocation']);
      expect(result).toEqual(mockStatus);
    });
  });

  describe('getCurrentPosition', () => {
    it('should get current position', async () => {
      const mockPosition = {
        coords: {
          latitude: 45.5,
          longitude: -75.5,
          accuracy: 10,
          altitude: 100,
          altitudeAccuracy: 5,
          heading: null,
          speed: null,
        },
        timestamp: 1704067200000,
      };
      mockGetCurrentPosition.mockResolvedValue(mockPosition);

      const result = await geolocationApi.getCurrentPosition();

      expect(mockGetCurrentPosition).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockPosition);
    });

    it('should get position with options', async () => {
      const mockPosition = {
        coords: {
          latitude: 45.5,
          longitude: -75.5,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: 1704067200000,
      };
      mockGetCurrentPosition.mockResolvedValue(mockPosition);

      const options = { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 };
      const result = await geolocationApi.getCurrentPosition(options);

      expect(mockGetCurrentPosition).toHaveBeenCalledWith(options);
      expect(result).toEqual(mockPosition);
    });
  });

  describe('watchPosition', () => {
    it('should watch position changes', async () => {
      mockWatchPosition.mockResolvedValue(12345);

      const callback = jest.fn();
      const result = await geolocationApi.watchPosition({ enableHighAccuracy: true }, callback);

      expect(mockWatchPosition).toHaveBeenCalledWith(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        callback
      );
      expect(result).toBe(12345);
    });

    it('should use default options', async () => {
      mockWatchPosition.mockResolvedValue(12345);

      const callback = jest.fn();
      await geolocationApi.watchPosition(undefined, callback);

      expect(mockWatchPosition).toHaveBeenCalledWith(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        callback
      );
    });

    it('should merge partial options', async () => {
      mockWatchPosition.mockResolvedValue(12345);

      const callback = jest.fn();
      await geolocationApi.watchPosition({ timeout: 5000 }, callback);

      expect(mockWatchPosition).toHaveBeenCalledWith(
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
        callback
      );
    });
  });

  describe('clearWatch', () => {
    it('should clear watch', async () => {
      mockClearWatch.mockResolvedValue(undefined);

      await geolocationApi.clearWatch(12345);

      expect(mockClearWatch).toHaveBeenCalledWith(12345);
    });
  });

  describe('getPositionWithPermission', () => {
    it('should return null when not available', async () => {
      mockIsTauri.mockReturnValue(false);

      const result = await geolocationApi.getPositionWithPermission();

      expect(result).toBeNull();
    });

    it('should get position when already granted', async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      const mockPosition = {
        coords: { latitude: 45.5, longitude: -75.5, accuracy: 10 },
        timestamp: 1704067200000,
      };
      mockGetCurrentPosition.mockResolvedValue(mockPosition);

      const result = await geolocationApi.getPositionWithPermission();

      expect(mockCheckPermissions).toHaveBeenCalled();
      expect(mockRequestPermissions).not.toHaveBeenCalled();
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(result).toEqual(mockPosition);
    });

    it('should request permission when prompt', async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'prompt', coarseLocation: 'prompt' });
      mockRequestPermissions.mockResolvedValue({ location: 'granted', coarseLocation: 'granted' });
      const mockPosition = {
        coords: { latitude: 45.5, longitude: -75.5, accuracy: 10 },
        timestamp: 1704067200000,
      };
      mockGetCurrentPosition.mockResolvedValue(mockPosition);

      const result = await geolocationApi.getPositionWithPermission();

      expect(mockCheckPermissions).toHaveBeenCalled();
      expect(mockRequestPermissions).toHaveBeenCalledWith(['location']);
      expect(mockGetCurrentPosition).toHaveBeenCalled();
      expect(result).toEqual(mockPosition);
    });

    it('should return null when permission denied', async () => {
      mockCheckPermissions.mockResolvedValue({ location: 'denied', coarseLocation: 'denied' });

      const result = await geolocationApi.getPositionWithPermission();

      expect(result).toBeNull();
      expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockCheckPermissions.mockRejectedValue(new Error('Permission error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      logManager.initialize({ enableConsole: true, enablePersistence: false });

      const result = await geolocationApi.getPositionWithPermission();

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      logManager.initialize({ enableConsole: false, enablePersistence: false });
    });
  });
});
