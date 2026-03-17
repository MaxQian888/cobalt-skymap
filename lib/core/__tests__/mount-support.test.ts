/**
 * @jest-environment node
 */

import {
  BUILT_IN_SIMULATOR_MOUNT_ID,
  createMountActionBlockReasons,
  buildSupportedMountDeviceId,
  createMountActionAvailability,
  createSimulatorMountDevice,
  normalizeSupportedMountSource,
} from '../mount-support';

describe('mount-support', () => {
  describe('buildSupportedMountDeviceId', () => {
    it('returns the built-in simulator id for simulator mounts', () => {
      expect(buildSupportedMountDeviceId({ protocol: 'simulator' })).toBe(BUILT_IN_SIMULATOR_MOUNT_ID);
    });

    it('uses sane defaults and encodes the unique id for alpaca mounts', () => {
      expect(
        buildSupportedMountDeviceId({
          protocol: 'alpaca',
          host: '   ',
          port: Number.NaN,
          deviceId: Number.POSITIVE_INFINITY,
          uniqueId: '  EQ6-R Pro / East  ',
        }),
      ).toBe('alpaca://localhost:11111/telescope/0?uid=EQ6-R%20Pro%20%2F%20East');
    });

    it('uses the provided host, port, and device id when they are valid', () => {
      expect(
        buildSupportedMountDeviceId({
          protocol: 'alpaca',
          host: '192.168.1.5',
          port: 4567,
          deviceId: 3,
        }),
      ).toBe('alpaca://192.168.1.5:4567/telescope/3');
    });
  });

  describe('createSimulatorMountDevice', () => {
    it('creates a consistent built-in simulator device record', () => {
      expect(createSimulatorMountDevice()).toEqual({
        id: BUILT_IN_SIMULATOR_MOUNT_ID,
        protocol: 'simulator',
        host: 'localhost',
        port: 11111,
        deviceId: 0,
        name: 'Built-in Simulator',
        deviceType: 'simulator',
        source: 'simulator',
        description: 'Built-in virtual mount for development and testing.',
      });
    });
  });

  describe('normalizeSupportedMountSource', () => {
    it('accepts supported sources and falls back for unknown values', () => {
      expect(normalizeSupportedMountSource('simulator', 'manual')).toBe('simulator');
      expect(normalizeSupportedMountSource('alpaca-discovery', 'manual')).toBe('alpaca-discovery');
      expect(normalizeSupportedMountSource('manual', 'simulator')).toBe('manual');
      expect(normalizeSupportedMountSource('unsupported', 'manual')).toBe('manual');
    });
  });

  describe('createMountActionAvailability', () => {
    it('disables device actions while disconnected', () => {
      expect(
        createMountActionAvailability({
          connected: false,
          capabilities: {
            canSlew: true,
            canSync: true,
            canPark: true,
            canUnpark: true,
            canSetTracking: true,
            canMoveAxis: true,
          },
          parked: false,
          slewing: true,
        }),
      ).toEqual({
        connect: true,
        discover: true,
        slew: false,
        sync: false,
        park: false,
        unpark: false,
        tracking: false,
        trackingRate: false,
        moveAxis: false,
        abortSlew: false,
      });
    });

    it('enables actions based on capability flags and runtime mount state', () => {
      expect(
        createMountActionAvailability({
          connected: true,
          capabilities: {
            canSlewAsync: true,
            canSync: true,
            canPark: true,
            canUnpark: true,
            canSetTracking: true,
            canMoveAxis: true,
          },
          parked: false,
          slewing: true,
        }),
      ).toEqual({
        connect: false,
        discover: true,
        slew: true,
        sync: true,
        park: true,
        unpark: false,
        tracking: true,
        trackingRate: true,
        moveAxis: true,
        abortSlew: true,
      });
    });

    it('switches from park to unpark and blocks manual movement when parked', () => {
      const availability = createMountActionAvailability({
        connected: true,
        capabilities: {
          canPark: true,
          canUnpark: true,
          canMoveAxis: true,
        },
        parked: true,
        slewing: false,
      });

      expect(availability.park).toBe(false);
      expect(availability.unpark).toBe(true);
      expect(availability.moveAxis).toBe(false);
      expect(availability.abortSlew).toBe(false);
    });
  });

  describe('createMountActionBlockReasons', () => {
    it('explains why core controls are blocked while disconnected', () => {
      expect(
        createMountActionBlockReasons({
          connected: false,
          capabilities: {
            canSlew: true,
            canSync: true,
            canPark: true,
            canUnpark: true,
            canSetTracking: true,
            canMoveAxis: true,
          },
          tracking: false,
          parked: false,
          slewing: false,
        }),
      ).toMatchObject({
        slew: 'disconnected',
        sync: 'disconnected',
        park: 'disconnected',
        unpark: 'disconnected',
        tracking: 'disconnected',
        trackingRate: 'disconnected',
        moveAxis: 'disconnected',
        abortSlew: 'disconnected',
      });
    });

    it('uses runtime mount state to describe supported but temporarily blocked actions', () => {
      expect(
        createMountActionBlockReasons({
          connected: true,
          capabilities: {
            canSlewAsync: true,
            canSync: true,
            canPark: true,
            canUnpark: true,
            canSetTracking: true,
            canMoveAxis: true,
          },
          tracking: false,
          parked: true,
          slewing: true,
        }),
      ).toMatchObject({
        slew: 'parked',
        sync: 'parked',
        park: 'already-parked',
        tracking: 'parked',
        trackingRate: 'parked',
        moveAxis: 'parked',
      });
    });

    it('reports unsupported and state-specific reasons independently', () => {
      expect(
        createMountActionBlockReasons({
          connected: true,
          capabilities: {
            canSlew: true,
            canSync: false,
            canPark: false,
            canUnpark: true,
            canSetTracking: true,
            canMoveAxis: false,
          },
          tracking: false,
          parked: false,
          slewing: false,
        }),
      ).toMatchObject({
        sync: 'unsupported',
        park: 'unsupported',
        trackingRate: 'tracking-disabled',
        moveAxis: 'unsupported',
        abortSlew: 'not-slewing',
      });
    });
  });
});
