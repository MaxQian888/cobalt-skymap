import { act, renderHook } from '@testing-library/react';
import { useDeviceStore, PRIMARY_MOUNT_DEVICE_PROFILE_ID } from '@/lib/stores/device-store';
import type { DeviceProfile } from '@/lib/core/types/device';

function resetDeviceStore(): void {
  useDeviceStore.setState({
    profiles: [],
    connections: {},
    diagnostics: {},
    requiredSessionDeviceTypes: ['camera', 'telescope'],
    activeSessionProfileIds: [],
    diagnosticsLimitPerProfile: 100,
    readiness: {
      state: 'blocked',
      requiredTypes: ['camera', 'telescope'],
      issues: [],
      checkedAt: new Date().toISOString(),
    },
  });
}

describe('useDeviceStore', () => {
  function isMountProfile(profile: DeviceProfile | undefined): profile is DeviceProfile<'mount'> {
    return profile?.type === 'mount';
  }

  beforeEach(() => {
    resetDeviceStore();
  });

  it('creates a valid profile', () => {
    const { result } = renderHook(() => useDeviceStore());

    let createResult: ReturnType<typeof result.current.createProfile> | undefined;
    act(() => {
      createResult = result.current.createProfile({
        id: 'camera-main',
        name: 'Main Camera',
        type: 'camera',
        metadata: {
          sensorWidth: 23.5,
          sensorHeight: 15.6,
          pixelSize: 3.76,
        },
      });
    });

    expect(createResult).toBeDefined();
    expect(createResult?.success).toBe(true);
    expect(result.current.profiles.some((profile) => profile.id === 'camera-main')).toBe(true);
  });

  it('rejects invalid profile creation', () => {
    const { result } = renderHook(() => useDeviceStore());

    let createResult: ReturnType<typeof result.current.createProfile> | undefined;
    act(() => {
      createResult = result.current.createProfile({
        id: 'scope-main',
        name: 'Scope',
        type: 'telescope',
        metadata: {
          focalLength: 0,
          aperture: 0,
        },
      });
    });

    expect(createResult).toBeDefined();
    expect(createResult?.success).toBe(false);
    expect(result.current.profiles).toHaveLength(0);
  });

  it('guards profile deletion when profile is bound to active session', () => {
    const { result } = renderHook(() => useDeviceStore());

    act(() => {
      result.current.createProfile({
        id: 'camera-bound',
        name: 'Bound Camera',
        type: 'camera',
        metadata: {
          sensorWidth: 22,
          sensorHeight: 15,
          pixelSize: 4,
        },
      });
      result.current.setActiveSessionProfileIds(['camera-bound']);
    });

    let deleteResult: ReturnType<typeof result.current.deleteProfile> | undefined;
    act(() => {
      deleteResult = result.current.deleteProfile('camera-bound');
    });

    expect(deleteResult).toBeDefined();
    expect(deleteResult?.success).toBe(false);
    expect(result.current.profiles.some((profile) => profile.id === 'camera-bound')).toBe(true);
  });

  it('applies connection lifecycle transitions and diagnostics logging', () => {
    const { result } = renderHook(() => useDeviceStore());

    act(() => {
      result.current.createProfile({
        id: PRIMARY_MOUNT_DEVICE_PROFILE_ID,
        name: 'Mount',
        type: 'mount',
        metadata: {
          protocol: 'alpaca',
          host: 'localhost',
          port: 11111,
          deviceId: 0,
        },
      });
      result.current.beginConnection(PRIMARY_MOUNT_DEVICE_PROFILE_ID);
      result.current.markFailed(
        PRIMARY_MOUNT_DEVICE_PROFILE_ID,
        {
          code: 'timeout',
          message: 'Connection timeout',
          recoverable: true,
        },
      );
      result.current.retryConnection(PRIMARY_MOUNT_DEVICE_PROFILE_ID);
      result.current.markConnected(PRIMARY_MOUNT_DEVICE_PROFILE_ID);
    });

    const connection = result.current.connections[PRIMARY_MOUNT_DEVICE_PROFILE_ID];
    expect(connection?.state).toBe('connected');
    expect(connection?.attempts).toBe(1);

    const diagnostics = result.current.getLatestDiagnostics(PRIMARY_MOUNT_DEVICE_PROFILE_ID, 20);
    expect(diagnostics.length).toBeGreaterThanOrEqual(4);
    expect(diagnostics[0]?.from).toBe('idle');
  });

  it('syncs equipment and mount snapshots into orchestration state', () => {
    const { result } = renderHook(() => useDeviceStore());

    act(() => {
      result.current.syncFromEquipmentStore({
        activeCameraId: 'cam-1',
        activeTelescopeId: 'scope-1',
        sensorWidth: 20,
        sensorHeight: 15,
        pixelSize: 3.7,
        focalLength: 800,
        aperture: 120,
        customCameras: [],
        customTelescopes: [],
      });
      result.current.syncFromMountStore({
        connected: true,
        protocol: 'alpaca',
        host: 'localhost',
        port: 11111,
        deviceId: 0,
        selectedDeviceId: 'alpaca://localhost:11111/telescope/0',
        selectedDevice: {
          id: 'alpaca://localhost:11111/telescope/0',
          protocol: 'alpaca',
          host: 'localhost',
          port: 11111,
          deviceId: 0,
          name: 'Primary Alpaca Mount',
          deviceType: 'telescope',
          source: 'alpaca-discovery',
        },
        capabilitySnapshot: {
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
          capturedAt: '2026-03-13T00:00:00.000Z',
        },
        actionAvailability: {
          connect: true,
          discover: true,
          slew: true,
          sync: true,
          park: true,
          unpark: true,
          tracking: true,
          trackingRate: true,
          moveAxis: true,
          abortSlew: false,
        },
      });
    });

    expect(result.current.profiles.some((profile) => profile.type === 'camera')).toBe(true);
    expect(result.current.profiles.some((profile) => profile.type === 'telescope')).toBe(true);
    expect(result.current.profiles.some((profile) => profile.type === 'mount')).toBe(true);
    expect(result.current.connections[PRIMARY_MOUNT_DEVICE_PROFILE_ID]?.state).toBe('connected');
    const mountProfile = result.current.profiles.find((profile) => profile.id === PRIMARY_MOUNT_DEVICE_PROFILE_ID);
    expect(isMountProfile(mountProfile)).toBe(true);
    if (!isMountProfile(mountProfile)) {
      throw new Error('Expected synchronized mount profile to be present.');
    }
    expect(mountProfile.metadata.selectedDeviceId).toBe('alpaca://localhost:11111/telescope/0');
    expect(mountProfile.metadata.selectedDevice?.name).toBe('Primary Alpaca Mount');
    expect(mountProfile.metadata.capabilitySnapshot?.canPark).toBe(true);
    expect(mountProfile.metadata.actionAvailability?.trackingRate).toBe(true);
  });

  it('returns blocked readiness when required mount is disconnected', () => {
    const { result } = renderHook(() => useDeviceStore());

    act(() => {
      result.current.syncFromEquipmentStore({
        activeCameraId: 'cam-1',
        activeTelescopeId: 'scope-1',
        sensorWidth: 20,
        sensorHeight: 15,
        pixelSize: 3.7,
        focalLength: 800,
        aperture: 120,
        customCameras: [],
        customTelescopes: [],
      });
      result.current.syncFromMountStore({
        connected: false,
        protocol: 'alpaca',
        host: 'localhost',
        port: 11111,
        deviceId: 0,
      });
    });

    const readiness = result.current.getSessionReadiness({
      requiredTypes: ['camera', 'telescope', 'mount'],
      connectionRequiredTypes: ['mount'],
    });
    expect(readiness.state).toBe('blocked');
  });
});
