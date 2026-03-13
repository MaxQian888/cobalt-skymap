import type {
  MountActionAvailability,
  MountCapabilities,
  MountProtocol,
  SupportedMountDevice,
  SupportedMountSource,
} from '@/lib/core/types';

export const BUILT_IN_SIMULATOR_MOUNT_ID = 'simulator://builtin';

export function buildSupportedMountDeviceId(input: {
  protocol: MountProtocol;
  host?: string;
  port?: number;
  deviceId?: number;
  uniqueId?: string;
}): string {
  if (input.protocol === 'simulator') {
    return BUILT_IN_SIMULATOR_MOUNT_ID;
  }

  const host = input.host?.trim() || 'localhost';
  const port = Number.isFinite(input.port) ? input.port : 11111;
  const deviceId = Number.isFinite(input.deviceId) ? input.deviceId : 0;
  const uniqueId = input.uniqueId?.trim();
  const baseId = `${input.protocol}://${host}:${port}/telescope/${deviceId}`;

  return uniqueId
    ? `${baseId}?uid=${encodeURIComponent(uniqueId)}`
    : baseId;
}

export function createSimulatorMountDevice(): SupportedMountDevice {
  return {
    id: BUILT_IN_SIMULATOR_MOUNT_ID,
    protocol: 'simulator',
    host: 'localhost',
    port: 11111,
    deviceId: 0,
    name: 'Built-in Simulator',
    deviceType: 'simulator',
    source: 'simulator',
    description: 'Built-in virtual mount for development and testing.',
  };
}

export function normalizeSupportedMountSource(
  value: unknown,
  fallback: SupportedMountSource,
): SupportedMountSource {
  if (value === 'simulator' || value === 'alpaca-discovery' || value === 'manual') {
    return value;
  }
  return fallback;
}

export function createMountActionAvailability(input: {
  connected: boolean;
  capabilities: Partial<MountCapabilities>;
  parked?: boolean;
  slewing?: boolean;
}): MountActionAvailability {
  const connected = input.connected;
  const parked = Boolean(input.parked);
  const slewing = Boolean(input.slewing);

  return {
    connect: !connected,
    discover: true,
    slew: connected && Boolean(input.capabilities.canSlew || input.capabilities.canSlewAsync),
    sync: connected && Boolean(input.capabilities.canSync),
    park: connected && Boolean(input.capabilities.canPark) && !parked,
    unpark: connected && Boolean(input.capabilities.canUnpark) && parked,
    tracking: connected && Boolean(input.capabilities.canSetTracking),
    trackingRate: connected && Boolean(input.capabilities.canSetTracking),
    moveAxis: connected && Boolean(input.capabilities.canMoveAxis) && !parked,
    abortSlew: connected && slewing,
  };
}
