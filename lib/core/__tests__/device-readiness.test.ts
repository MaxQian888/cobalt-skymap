import { evaluateDeviceReadiness } from '@/lib/core/device-readiness';
import type { DeviceProfile, DeviceConnectionState } from '@/lib/core/types/device';

function cameraProfile(): DeviceProfile<'camera'> {
  return {
    id: 'camera-1',
    name: 'Main Camera',
    type: 'camera',
    source: 'manual',
    enabled: true,
    metadata: {
      sensorWidth: 23.5,
      sensorHeight: 15.6,
      pixelSize: 3.76,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function telescopeProfile(): DeviceProfile<'telescope'> {
  return {
    id: 'scope-1',
    name: 'Main Scope',
    type: 'telescope',
    source: 'manual',
    enabled: true,
    metadata: {
      focalLength: 500,
      aperture: 80,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mountProfile(): DeviceProfile<'mount'> {
  return {
    id: 'mount-1',
    name: 'Mount',
    type: 'mount',
    source: 'manual',
    enabled: true,
    metadata: {
      protocol: 'alpaca',
      host: 'localhost',
      port: 11111,
      deviceId: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mountConnection(state: DeviceConnectionState['state']): DeviceConnectionState {
  return {
    profileId: 'mount-1',
    state,
    updatedAt: new Date().toISOString(),
    attempts: 0,
  };
}

describe('device-readiness', () => {
  it('returns blocked when required profile is missing', () => {
    const readiness = evaluateDeviceReadiness({
      profiles: [cameraProfile()],
      connections: {},
      requiredTypes: ['camera', 'telescope'],
      connectionRequiredTypes: [],
    });

    expect(readiness.state).toBe('blocked');
    expect(readiness.issues.some((issue) => issue.code === 'profile-missing' && issue.type === 'telescope')).toBe(true);
  });

  it('returns blocked when required mount is disconnected', () => {
    const readiness = evaluateDeviceReadiness({
      profiles: [cameraProfile(), telescopeProfile(), mountProfile()],
      connections: {
        'mount-1': mountConnection('idle'),
      },
      requiredTypes: ['camera', 'telescope', 'mount'],
      connectionRequiredTypes: ['mount'],
    });

    expect(readiness.state).toBe('blocked');
    expect(readiness.issues.some((issue) => issue.code === 'device-disconnected')).toBe(true);
  });

  it('returns warning when mount is degraded', () => {
    const readiness = evaluateDeviceReadiness({
      profiles: [cameraProfile(), telescopeProfile(), mountProfile()],
      connections: {
        'mount-1': {
          ...mountConnection('degraded'),
          lastError: {
            code: 'degraded',
            message: 'Intermittent transport timeout',
            recoverable: true,
          },
        },
      },
      requiredTypes: ['camera', 'telescope', 'mount'],
      connectionRequiredTypes: ['mount'],
    });

    expect(readiness.state).toBe('warning');
    expect(readiness.issues.some((issue) => issue.code === 'device-degraded')).toBe(true);
  });

  it('returns warning when mount is connected but optional actions are unavailable', () => {
    const readiness = evaluateDeviceReadiness({
      profiles: [
        cameraProfile(),
        telescopeProfile(),
        {
          ...mountProfile(),
          metadata: {
            ...mountProfile().metadata,
            actionAvailability: {
              connect: false,
              discover: true,
              slew: true,
              sync: false,
              park: false,
              unpark: true,
              tracking: true,
              trackingRate: false,
              moveAxis: false,
              abortSlew: false,
            },
          },
        },
      ],
      connections: {
        'mount-1': mountConnection('connected'),
      },
      requiredTypes: ['camera', 'telescope', 'mount'],
      connectionRequiredTypes: ['mount'],
    });

    expect(readiness.state).toBe('warning');
    expect(readiness.issues.some((issue) => issue.code === 'mount-capability-limited')).toBe(true);
  });

  it('returns ready when all required devices are valid and connected', () => {
    const readiness = evaluateDeviceReadiness({
      profiles: [cameraProfile(), telescopeProfile(), mountProfile()],
      connections: {
        'mount-1': mountConnection('connected'),
      },
      requiredTypes: ['camera', 'telescope', 'mount'],
      connectionRequiredTypes: ['mount'],
    });

    expect(readiness.state).toBe('ready');
    expect(readiness.issues).toHaveLength(0);
  });
});
