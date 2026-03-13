/**
 * Tests for mount-store.ts
 */

import { renderHook, act } from '@testing-library/react';
import { useMountStore } from '../mount-store';

describe('useMountStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useMountStore());
    act(() => {
      result.current.setMountConnected(false);
      result.current.setMountCoordinates(0, 0);
      result.current.setSequenceRunning(false);
      result.current.setCurrentTab('showSlew');
    });
  });

  describe('initial state', () => {
    it('should have mountInfo with Connected false', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.mountInfo.Connected).toBe(false);
    });

    it('should have default coordinates', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.mountInfo.Coordinates).toBeDefined();
    });

    it('should have sequenceRunning as false', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.sequenceRunning).toBe(false);
    });

    it('should have default currentTab', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.currentTab).toBe('showSlew');
    });
  });

  describe('setMountConnected', () => {
    it('should update mount connected status', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setMountConnected(true);
      });
      expect(result.current.mountInfo.Connected).toBe(true);
    });

    it('should set connected to false', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setMountConnected(true);
        result.current.setMountConnected(false);
      });
      expect(result.current.mountInfo.Connected).toBe(false);
    });
  });

  describe('setMountCoordinates', () => {
    it('should update RA and Dec', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setMountCoordinates(180, 45);
      });
      expect(result.current.mountInfo.Coordinates?.RADegrees).toBe(180);
      expect(result.current.mountInfo.Coordinates?.Dec).toBe(45);
    });

    it('should handle negative declination', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setMountCoordinates(90, -30);
      });
      expect(result.current.mountInfo.Coordinates?.Dec).toBe(-30);
    });
  });

  describe('setMountInfo', () => {
    it('should update partial mount info', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setMountInfo({ Connected: true });
      });
      expect(result.current.mountInfo.Connected).toBe(true);
    });
  });

  describe('setProfileInfo', () => {
    it('should update profile info', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setProfileInfo({
          AstrometrySettings: { Latitude: 45, Longitude: -75, Elevation: 100 },
        });
      });
      expect(result.current.profileInfo.AstrometrySettings?.Latitude).toBe(45);
    });
  });

  describe('setSequenceRunning', () => {
    it('should update sequence running status', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setSequenceRunning(true);
      });
      expect(result.current.sequenceRunning).toBe(true);
    });
  });

  describe('setCurrentTab', () => {
    it('should update current tab', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setCurrentTab('settings');
      });
      expect(result.current.currentTab).toBe('settings');
    });
  });

  describe('connectionConfig', () => {
    it('should have default connection config', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.connectionConfig).toBeDefined();
      expect(result.current.connectionConfig.protocol).toBe('simulator');
      expect(result.current.connectionConfig.host).toBe('localhost');
      expect(result.current.connectionConfig.port).toBe(11111);
      expect(result.current.connectionConfig.deviceId).toBe(0);
      expect((result.current.connectionConfig as typeof result.current.connectionConfig & { selectedDeviceId?: string | null }).selectedDeviceId).toBe('simulator://builtin');
    });

    it('should update connection config partially', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setConnectionConfig({ host: '192.168.1.100', port: 8080 });
      });
      expect(result.current.connectionConfig.host).toBe('192.168.1.100');
      expect(result.current.connectionConfig.port).toBe(8080);
      expect(result.current.connectionConfig.protocol).toBe('simulator');
    });

    it('should update protocol to alpaca', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setConnectionConfig({ protocol: 'alpaca' });
      });
      expect(result.current.connectionConfig.protocol).toBe('alpaca');
    });
  });

  describe('capabilities', () => {
    it('should have default capabilities (all false)', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.capabilities).toBeDefined();
      expect(result.current.capabilities.canSlew).toBe(false);
      expect(result.current.capabilities.canPark).toBe(false);
      expect(result.current.capabilities.canSync).toBe(false);
    });

    it('should update capabilities', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.applyMountState({
          connected: true,
          ra: 120.5,
          dec: 45.3,
          tracking: true,
          trackingRate: 'sidereal',
          slewing: true,
          parked: false,
          atHome: false,
          pierSide: 'west',
          slewRateIndex: 3,
        });
        result.current.setCapabilities({
          canSlew: true,
          canSlewAsync: true,
          canSync: true,
          canPark: true,
          canUnpark: true,
          canSetTracking: true,
          canMoveAxis: true,
          canPulseGuide: false,
          alignmentMode: 'GermanPolar',
          equatorialSystem: 'J2000',
        });
      });
      expect(result.current.capabilities.canSlew).toBe(true);
      expect(result.current.capabilities.canPark).toBe(true);
      expect(result.current.capabilities.alignmentMode).toBe('GermanPolar');
      expect((result.current as typeof result.current & { capabilitySnapshot?: { canPark?: boolean }; actionAvailability?: { park?: boolean; trackingRate?: boolean; abortSlew?: boolean } }).capabilitySnapshot?.canPark).toBe(true);
      expect((result.current as typeof result.current & { actionAvailability?: { park?: boolean; trackingRate?: boolean; abortSlew?: boolean } }).actionAvailability?.park).toBe(true);
      expect((result.current as typeof result.current & { actionAvailability?: { park?: boolean; trackingRate?: boolean; abortSlew?: boolean } }).actionAvailability?.trackingRate).toBe(true);
      expect((result.current as typeof result.current & { actionAvailability?: { park?: boolean; trackingRate?: boolean; abortSlew?: boolean } }).actionAvailability?.abortSlew).toBe(true);
    });
  });

  describe('applyMountState', () => {
    it('should batch-update mount info from polling state', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.applyMountState({
          connected: true,
          ra: 120.5,
          dec: 45.3,
          tracking: true,
          trackingRate: 'sidereal',
          slewing: false,
          parked: false,
          atHome: false,
          pierSide: 'west',
          slewRateIndex: 3,
        });
      });
      expect(result.current.mountInfo.Connected).toBe(true);
      expect(result.current.mountInfo.Coordinates.RADegrees).toBe(120.5);
      expect(result.current.mountInfo.Coordinates.Dec).toBe(45.3);
      expect(result.current.mountInfo.Tracking).toBe(true);
      expect(result.current.mountInfo.TrackMode).toBe('sidereal');
      expect(result.current.mountInfo.Slewing).toBe(false);
      expect(result.current.mountInfo.Parked).toBe(false);
      expect(result.current.mountInfo.AtHome).toBe(false);
      expect(result.current.mountInfo.PierSide).toBe('west');
      expect(result.current.mountInfo.SlewRateIndex).toBe(3);
    });

    it('should handle slewing state', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.applyMountState({
          connected: true,
          ra: 90,
          dec: 30,
          tracking: false,
          trackingRate: 'sidereal',
          slewing: true,
          parked: false,
          atHome: false,
          pierSide: 'east',
          slewRateIndex: 5,
        });
      });
      expect(result.current.mountInfo.Slewing).toBe(true);
      expect(result.current.mountInfo.PierSide).toBe('east');
    });
  });

  describe('resetMountInfo', () => {
    it('should reset mount info and capabilities to defaults', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.applyMountState({
          connected: true,
          ra: 100,
          dec: 50,
          tracking: true,
          trackingRate: 'lunar',
          slewing: true,
          parked: false,
          atHome: false,
          pierSide: 'west',
          slewRateIndex: 4,
        });
        result.current.setCapabilities({
          canSlew: true,
          canSlewAsync: true,
          canSync: true,
          canPark: true,
          canUnpark: true,
          canSetTracking: true,
          canMoveAxis: true,
          canPulseGuide: true,
          alignmentMode: 'GermanPolar',
          equatorialSystem: 'J2000',
        });
      });
      expect(result.current.mountInfo.Connected).toBe(true);
      expect(result.current.capabilities.canSlew).toBe(true);

      act(() => {
        result.current.resetMountInfo();
      });
      expect(result.current.mountInfo.Connected).toBe(false);
      expect(result.current.mountInfo.Coordinates.RADegrees).toBe(0);
      expect(result.current.mountInfo.Coordinates.Dec).toBe(0);
      expect(result.current.capabilities.canSlew).toBe(false);
    });
  });

  describe('safetyConfig', () => {
    it('should have default safety config', () => {
      const { result } = renderHook(() => useMountStore());
      expect(result.current.safetyConfig).toBeDefined();
      expect(result.current.safetyConfig.mountType).toBe('gem');
      expect(result.current.safetyConfig.minAltitude).toBe(15);
      expect(result.current.safetyConfig.meridianFlip.enabled).toBe(true);
    });

    it('should update safety config partially', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setSafetyConfig({ minAltitude: 25, mountType: 'fork' });
      });
      expect(result.current.safetyConfig.minAltitude).toBe(25);
      expect(result.current.safetyConfig.mountType).toBe('fork');
      // Other fields should remain at defaults
      expect(result.current.safetyConfig.hourAngleLimitEast).toBe(-90);
    });

    it('should update meridian flip config partially', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setSafetyConfig({
          meridianFlip: { enabled: true, minutesAfterMeridian: 10, maxMinutesAfterMeridian: 20, pauseBeforeMeridian: 3 },
        });
      });
      expect(result.current.safetyConfig.meridianFlip.minutesAfterMeridian).toBe(10);
      expect(result.current.safetyConfig.meridianFlip.maxMinutesAfterMeridian).toBe(20);
      expect(result.current.safetyConfig.meridianFlip.pauseBeforeMeridian).toBe(3);
    });

    it('should reset safety config to defaults', () => {
      const { result } = renderHook(() => useMountStore());
      act(() => {
        result.current.setSafetyConfig({ minAltitude: 50, mountType: 'altaz' });
      });
      expect(result.current.safetyConfig.minAltitude).toBe(50);
      act(() => {
        result.current.resetSafetyConfig();
      });
      expect(result.current.safetyConfig.minAltitude).toBe(15);
      expect(result.current.safetyConfig.mountType).toBe('gem');
    });
  });
});
