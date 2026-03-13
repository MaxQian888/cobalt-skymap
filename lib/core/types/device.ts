import type {
  MountActionAvailability,
  MountCapabilitySnapshot,
  MountProtocol,
  SupportedMountDevice,
} from './stellarium';

export type DeviceType = 'mount' | 'camera' | 'telescope' | 'guider' | 'focuser';

export type DeviceProfileSource =
  | 'manual'
  | 'equipment-store'
  | 'mount-store'
  | 'import';

export type DeviceConnectionLifecycle =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'degraded'
  | 'failed';

export type DeviceConnectionTrigger =
  | 'user_connect'
  | 'user_disconnect'
  | 'user_retry'
  | 'health_check'
  | 'sync'
  | 'system';

export interface MountDeviceMetadata {
  protocol?: MountProtocol;
  host?: string;
  port?: number;
  deviceId?: number;
  model?: string;
  selectedDeviceId?: string | null;
  selectedDevice?: SupportedMountDevice;
  capabilitySnapshot?: Partial<MountCapabilitySnapshot>;
  actionAvailability?: Partial<MountActionAvailability>;
}

export interface CameraDeviceMetadata {
  sensorWidth?: number;
  sensorHeight?: number;
  pixelSize?: number;
  resolutionX?: number;
  resolutionY?: number;
  model?: string;
}

export interface TelescopeDeviceMetadata {
  focalLength?: number;
  aperture?: number;
  design?: string;
  model?: string;
}

export interface GuiderDeviceMetadata {
  guideRate?: number;
  model?: string;
}

export interface FocuserDeviceMetadata {
  stepSizeMicrons?: number;
  maxSteps?: number;
  model?: string;
}

export interface DeviceMetadataByType {
  mount: MountDeviceMetadata;
  camera: CameraDeviceMetadata;
  telescope: TelescopeDeviceMetadata;
  guider: GuiderDeviceMetadata;
  focuser: FocuserDeviceMetadata;
}

export type DeviceProfileMetadata = DeviceMetadataByType[DeviceType];

interface DeviceProfileShape<T extends DeviceType> {
  id: string;
  name: string;
  type: T;
  source: DeviceProfileSource;
  enabled: boolean;
  linkedEntityId?: string;
  metadata: DeviceMetadataByType[T];
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
  validationIssues?: string[];
}

export type DeviceProfile<T extends DeviceType = DeviceType> = T extends DeviceType
  ? DeviceProfileShape<T>
  : never;

export interface DeviceConnectionError {
  code: string;
  message: string;
  recoverable: boolean;
  details?: string;
}

export interface DeviceConnectionTransition {
  from: DeviceConnectionLifecycle;
  to: DeviceConnectionLifecycle;
  at: string;
  trigger: DeviceConnectionTrigger;
}

export interface DeviceConnectionState {
  profileId: string;
  state: DeviceConnectionLifecycle;
  updatedAt: string;
  attempts: number;
  lastConnectedAt?: string;
  lastError?: DeviceConnectionError;
  transition?: DeviceConnectionTransition;
}

export interface DeviceConnectionEvent {
  id: string;
  profileId: string;
  at: string;
  from: DeviceConnectionLifecycle;
  to: DeviceConnectionLifecycle;
  trigger: DeviceConnectionTrigger;
  errorMessage?: string;
  context?: string;
}

export type DeviceReadinessState = 'ready' | 'blocked' | 'warning';
export type DeviceReadinessLevel = 'blocked' | 'warning';

export interface DeviceReadinessIssue {
  code: string;
  level: DeviceReadinessLevel;
  type: DeviceType | 'system';
  profileId?: string;
  message: string;
  remediation: string;
}

export interface DeviceReadiness {
  state: DeviceReadinessState;
  requiredTypes: DeviceType[];
  issues: DeviceReadinessIssue[];
  checkedAt: string;
}
