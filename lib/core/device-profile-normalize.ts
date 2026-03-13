import type {
  DeviceProfile,
  DeviceType,
  DeviceProfileSource,
  DeviceMetadataByType,
  DeviceProfileMetadata,
} from '@/lib/core/types/device';
import type {
  MountActionAvailability,
  MountCapabilitySnapshot,
  MountProtocol,
  SupportedMountDevice,
} from '@/lib/core/types';
import {
  buildSupportedMountDeviceId,
  createSimulatorMountDevice,
  normalizeSupportedMountSource,
} from '@/lib/core/mount-support';
import { validateDeviceProfile } from '@/lib/core/device-profile-validation';

export interface DeviceProfileNormalizeReport {
  profiles: DeviceProfile[];
  skippedCount: number;
}

interface LegacyCameraLike {
  id: string;
  name: string;
  sensorWidth: number;
  sensorHeight: number;
  pixelSize?: number;
}

interface LegacyTelescopeLike {
  id: string;
  name: string;
  focalLength: number;
  aperture: number;
  type?: string;
}

const DEVICE_TYPE_SET: Record<DeviceType, true> = {
  mount: true,
  camera: true,
  telescope: true,
  guider: true,
  focuser: true,
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function toNumberValue(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return value;
}

function toBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function parseDeviceType(value: unknown): DeviceType | null {
  if (typeof value !== 'string') return null;
  return DEVICE_TYPE_SET[value as DeviceType] ? (value as DeviceType) : null;
}

function parseMountProtocol(value: unknown): MountProtocol | undefined {
  return value === 'alpaca' || value === 'simulator'
    ? value
    : undefined;
}

function normalizeSupportedMountDevice(
  value: unknown,
  fallback: {
    protocol?: MountProtocol;
    host?: string;
    port?: number;
    deviceId?: number;
  } = {},
): SupportedMountDevice | undefined {
  const record = toRecord(value);
  if (!record) return undefined;

  const protocol = parseMountProtocol(record.protocol) ?? fallback.protocol;
  const host = toStringValue(record.host) ?? fallback.host ?? 'localhost';
  const port = toNumberValue(record.port) ?? fallback.port ?? 11111;
  const deviceId = toNumberValue(record.deviceId) ?? fallback.deviceId ?? 0;
  const name = toStringValue(record.name);
  const deviceType = toStringValue(record.deviceType);
  if (!protocol || !name || !deviceType) return undefined;

  const uniqueId = toStringValue(record.uniqueId);
  return {
    id: toStringValue(record.id) ?? buildSupportedMountDeviceId({
      protocol,
      host,
      port,
      deviceId,
      uniqueId,
    }),
    protocol,
    host,
    port,
    deviceId,
    name,
    deviceType,
    source: normalizeSupportedMountSource(record.source, protocol === 'simulator' ? 'simulator' : 'manual'),
    uniqueId,
    manufacturer: toStringValue(record.manufacturer),
    model: toStringValue(record.model),
    description: toStringValue(record.description),
    driverInfo: toStringValue(record.driverInfo),
    driverVersion: toStringValue(record.driverVersion),
  };
}

function normalizeMountCapabilitySnapshot(value: unknown): Partial<MountCapabilitySnapshot> | undefined {
  const record = toRecord(value);
  if (!record) return undefined;

  const snapshot: Partial<MountCapabilitySnapshot> = {
    canSlew: toBooleanValue(record.canSlew),
    canSlewAsync: toBooleanValue(record.canSlewAsync),
    canSync: toBooleanValue(record.canSync),
    canPark: toBooleanValue(record.canPark),
    canUnpark: toBooleanValue(record.canUnpark),
    canSetTracking: toBooleanValue(record.canSetTracking),
    canMoveAxis: toBooleanValue(record.canMoveAxis),
    canPulseGuide: toBooleanValue(record.canPulseGuide),
    alignmentMode: toStringValue(record.alignmentMode),
    equatorialSystem: toStringValue(record.equatorialSystem),
    capturedAt: typeof record.capturedAt === 'string' ? record.capturedAt : undefined,
  };

  return Object.values(snapshot).some((entry) => entry !== undefined)
    ? snapshot
    : undefined;
}

function normalizeMountActionAvailability(value: unknown): Partial<MountActionAvailability> | undefined {
  const record = toRecord(value);
  if (!record) return undefined;

  const availability: Partial<MountActionAvailability> = {
    connect: toBooleanValue(record.connect),
    discover: toBooleanValue(record.discover),
    slew: toBooleanValue(record.slew),
    sync: toBooleanValue(record.sync),
    park: toBooleanValue(record.park),
    unpark: toBooleanValue(record.unpark),
    tracking: toBooleanValue(record.tracking),
    trackingRate: toBooleanValue(record.trackingRate),
    moveAxis: toBooleanValue(record.moveAxis),
    abortSlew: toBooleanValue(record.abortSlew),
  };

  return Object.values(availability).some((entry) => entry !== undefined)
    ? availability
    : undefined;
}

function normalizeMountMetadata(raw: Record<string, unknown>): DeviceMetadataByType['mount'] {
  const protocol = parseMountProtocol(raw.protocol);
  const isSimulator = protocol === 'simulator';
  const host = toStringValue(raw.host) ?? (isSimulator ? 'localhost' : undefined);
  const port = toNumberValue(raw.port) ?? (isSimulator ? 11111 : undefined);
  const deviceId = toNumberValue(raw.deviceId) ?? (isSimulator ? 0 : undefined);
  const selectedDevice = normalizeSupportedMountDevice(raw.selectedDevice, {
    protocol,
    host,
    port,
    deviceId,
  }) ?? (isSimulator ? createSimulatorMountDevice() : undefined);
  const selectedDeviceId = toStringValue(raw.selectedDeviceId)
    ?? selectedDevice?.id
    ?? (protocol ? buildSupportedMountDeviceId({ protocol, host, port, deviceId }) : undefined);

  return {
    protocol,
    host,
    port,
    deviceId,
    model: toStringValue(raw.model),
    selectedDeviceId,
    selectedDevice,
    capabilitySnapshot: normalizeMountCapabilitySnapshot(raw.capabilitySnapshot),
    actionAvailability: normalizeMountActionAvailability(raw.actionAvailability),
  };
}

function normalizeCameraMetadata(raw: Record<string, unknown>): DeviceMetadataByType['camera'] {
  return {
    sensorWidth: toNumberValue(raw.sensorWidth),
    sensorHeight: toNumberValue(raw.sensorHeight),
    pixelSize: toNumberValue(raw.pixelSize),
    resolutionX: toNumberValue(raw.resolutionX),
    resolutionY: toNumberValue(raw.resolutionY),
    model: toStringValue(raw.model),
  };
}

function normalizeTelescopeMetadata(raw: Record<string, unknown>): DeviceMetadataByType['telescope'] {
  return {
    focalLength: toNumberValue(raw.focalLength),
    aperture: toNumberValue(raw.aperture),
    design: toStringValue(raw.design),
    model: toStringValue(raw.model),
  };
}

function normalizeGuiderMetadata(raw: Record<string, unknown>): DeviceMetadataByType['guider'] {
  return {
    guideRate: toNumberValue(raw.guideRate),
    model: toStringValue(raw.model),
  };
}

function normalizeFocuserMetadata(raw: Record<string, unknown>): DeviceMetadataByType['focuser'] {
  return {
    stepSizeMicrons: toNumberValue(raw.stepSizeMicrons),
    maxSteps: toNumberValue(raw.maxSteps),
    model: toStringValue(raw.model),
  };
}

function normalizeMetadataByType(
  type: DeviceType,
  metadataValue: unknown,
): DeviceProfileMetadata {
  const metadata = toRecord(metadataValue) ?? {};
  switch (type) {
    case 'mount':
      return normalizeMountMetadata(metadata);
    case 'camera':
      return normalizeCameraMetadata(metadata);
    case 'telescope':
      return normalizeTelescopeMetadata(metadata);
    case 'guider':
      return normalizeGuiderMetadata(metadata);
    case 'focuser':
      return normalizeFocuserMetadata(metadata);
    default: {
      const exhaustive: never = type;
      throw new Error(`Unsupported device type: ${String(exhaustive)}`);
    }
  }
}

function normalizeSource(value: unknown): DeviceProfileSource {
  if (value === 'manual' || value === 'equipment-store' || value === 'mount-store' || value === 'import') {
    return value;
  }
  return 'import';
}

function normalizeDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

export function normalizeDeviceProfileCandidate(candidate: unknown): DeviceProfile | null {
  const record = toRecord(candidate);
  if (!record) return null;

  const type = parseDeviceType(record.type);
  const id = toStringValue(record.id);
  const name = toStringValue(record.name);
  if (!type || !id || !name) return null;

  const now = new Date().toISOString();
  const profile: DeviceProfile = {
    id,
    type,
    name,
    source: normalizeSource(record.source),
    enabled: record.enabled === false ? false : true,
    linkedEntityId: toStringValue(record.linkedEntityId),
    metadata: normalizeMetadataByType(type, record.metadata),
    createdAt: normalizeDate(record.createdAt, now),
    updatedAt: normalizeDate(record.updatedAt, now),
    lastValidatedAt: normalizeDate(record.lastValidatedAt, now),
    validationIssues: Array.isArray(record.validationIssues)
      ? record.validationIssues.filter((issue): issue is string => typeof issue === 'string')
      : undefined,
  };

  const validation = validateDeviceProfile(profile);
  if (!validation.valid) return null;
  return profile;
}

export function normalizePersistedDeviceProfiles(value: unknown): DeviceProfileNormalizeReport {
  if (!Array.isArray(value)) {
    return {
      profiles: [],
      skippedCount: 0,
    };
  }

  const profiles: DeviceProfile[] = [];
  let skippedCount = 0;
  for (const candidate of value) {
    const normalized = normalizeDeviceProfileCandidate(candidate);
    if (normalized) {
      profiles.push(normalized);
    } else {
      skippedCount += 1;
    }
  }

  return { profiles, skippedCount };
}

function isLegacyCameraLike(value: unknown): value is LegacyCameraLike {
  const record = toRecord(value);
  return Boolean(
    record
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.sensorWidth === 'number'
    && typeof record.sensorHeight === 'number',
  );
}

function isLegacyTelescopeLike(value: unknown): value is LegacyTelescopeLike {
  const record = toRecord(value);
  return Boolean(
    record
    && typeof record.id === 'string'
    && typeof record.name === 'string'
    && typeof record.focalLength === 'number'
    && typeof record.aperture === 'number',
  );
}

export function normalizeLegacyEquipmentProfiles(
  rawCustomCameras: unknown,
  rawCustomTelescopes: unknown,
): DeviceProfile[] {
  const now = new Date().toISOString();
  const profiles: DeviceProfile[] = [];

  const cameras = Array.isArray(rawCustomCameras) ? rawCustomCameras : [];
  for (const camera of cameras) {
    if (!isLegacyCameraLike(camera)) continue;
    profiles.push({
      id: `legacy-camera-${camera.id}`,
      type: 'camera',
      name: camera.name,
      source: 'equipment-store',
      enabled: true,
      linkedEntityId: camera.id,
      metadata: {
        sensorWidth: camera.sensorWidth,
        sensorHeight: camera.sensorHeight,
        pixelSize: camera.pixelSize,
      },
      createdAt: now,
      updatedAt: now,
      lastValidatedAt: now,
      validationIssues: [],
    });
  }

  const telescopes = Array.isArray(rawCustomTelescopes) ? rawCustomTelescopes : [];
  for (const telescope of telescopes) {
    if (!isLegacyTelescopeLike(telescope)) continue;
    profiles.push({
      id: `legacy-telescope-${telescope.id}`,
      type: 'telescope',
      name: telescope.name,
      source: 'equipment-store',
      enabled: true,
      linkedEntityId: telescope.id,
      metadata: {
        focalLength: telescope.focalLength,
        aperture: telescope.aperture,
        design: telescope.type,
      },
      createdAt: now,
      updatedAt: now,
      lastValidatedAt: now,
      validationIssues: [],
    });
  }

  return profiles;
}
