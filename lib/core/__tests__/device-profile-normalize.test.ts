import {
  normalizeLegacyEquipmentProfiles,
  normalizePersistedDeviceProfiles,
} from '@/lib/core/device-profile-normalize';
import type { DeviceProfile } from '@/lib/core/types/device';

describe('device-profile-normalize', () => {
  function isMountProfile(profile: DeviceProfile | undefined): profile is DeviceProfile<'mount'> {
    return profile?.type === 'mount';
  }

  it('normalizes valid persisted profiles and skips corrupted entries', () => {
    const report = normalizePersistedDeviceProfiles([
      {
        id: 'camera-1',
        name: 'Camera 1',
        type: 'camera',
        source: 'manual',
        enabled: true,
        metadata: {
          sensorWidth: 23.5,
          sensorHeight: 15.6,
          pixelSize: 3.76,
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: '',
        type: 'camera',
      },
      {
        foo: 'bar',
      },
    ]);

    expect(report.profiles).toHaveLength(1);
    expect(report.profiles[0]?.id).toBe('camera-1');
    expect(report.skippedCount).toBe(2);
  });

  it('creates legacy profiles from custom camera/telescope payloads', () => {
    const profiles = normalizeLegacyEquipmentProfiles(
      [
        { id: 'cam-1', name: 'Legacy Cam', sensorWidth: 10, sensorHeight: 8, pixelSize: 2.4 },
      ],
      [
        { id: 'scope-1', name: 'Legacy Scope', focalLength: 800, aperture: 120, type: 'APO' },
      ],
    );

    expect(profiles).toHaveLength(2);
    expect(profiles.some((profile) => profile.type === 'camera')).toBe(true);
    expect(profiles.some((profile) => profile.type === 'telescope')).toBe(true);
    expect(profiles[0]?.source).toBe('equipment-store');
  });

  it('ignores malformed legacy records', () => {
    const profiles = normalizeLegacyEquipmentProfiles(
      [{ id: 'cam-1', sensorWidth: 10 }],
      [{ id: 'scope-1', focalLength: 800 }],
    );
    expect(profiles).toHaveLength(0);
  });

  it('preserves supported mount device metadata and capability snapshots', () => {
    const report = normalizePersistedDeviceProfiles([
      {
        id: 'mount-1',
        name: 'Remote Mount',
        type: 'mount',
        source: 'manual',
        enabled: true,
        metadata: {
          protocol: 'alpaca',
          host: '10.0.0.5',
          port: 11111,
          deviceId: 2,
          selectedDeviceId: 'alpaca://10.0.0.5:11111/telescope/2',
          selectedDevice: {
            id: 'alpaca://10.0.0.5:11111/telescope/2',
            protocol: 'alpaca',
            host: '10.0.0.5',
            port: 11111,
            deviceId: 2,
            name: 'EQ6-R Pro',
            deviceType: 'telescope',
            source: 'alpaca-discovery',
            uniqueId: 'mount-uid-2',
            driverInfo: 'ASCOM.Alpaca.Test',
            driverVersion: '1.2.3',
          },
          capabilitySnapshot: {
            canSlew: true,
            canSlewAsync: true,
            canSync: false,
            canPark: true,
            canUnpark: true,
            canSetTracking: true,
            canMoveAxis: false,
            canPulseGuide: false,
            alignmentMode: 'GermanPolar',
            equatorialSystem: 'J2000',
            capturedAt: '2026-03-13T00:00:00.000Z',
          },
          actionAvailability: {
            connect: true,
            discover: true,
            slew: true,
            sync: false,
            park: true,
            unpark: true,
            tracking: true,
            trackingRate: true,
            moveAxis: false,
            abortSlew: false,
          },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(report.skippedCount).toBe(0);
    expect(report.profiles).toHaveLength(1);
    const mountProfile = report.profiles[0];
    expect(isMountProfile(mountProfile)).toBe(true);
    if (!isMountProfile(mountProfile)) {
      throw new Error('Expected normalized profile to be a mount profile.');
    }
    expect(mountProfile.metadata.selectedDeviceId).toBe('alpaca://10.0.0.5:11111/telescope/2');
    expect(mountProfile.metadata.selectedDevice?.name).toBe('EQ6-R Pro');
    expect(mountProfile.metadata.capabilitySnapshot?.canPark).toBe(true);
    expect(mountProfile.metadata.actionAvailability?.sync).toBe(false);
  });
});
