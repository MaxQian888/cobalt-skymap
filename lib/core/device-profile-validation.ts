import type {
  DeviceProfile,
  DeviceType,
  CameraDeviceMetadata,
  TelescopeDeviceMetadata,
  GuiderDeviceMetadata,
  FocuserDeviceMetadata,
  MountDeviceMetadata,
} from '@/lib/core/types/device';

export interface DeviceProfileValidationIssue {
  field: string;
  code: string;
  message: string;
}

export interface DeviceProfileValidationResult {
  valid: boolean;
  issues: DeviceProfileValidationIssue[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isMountProtocol(value: unknown): value is MountDeviceMetadata['protocol'] {
  return value === 'alpaca' || value === 'simulator';
}

function validateMountMetadata(metadata: MountDeviceMetadata): DeviceProfileValidationIssue[] {
  const issues: DeviceProfileValidationIssue[] = [];
  if (!isMountProtocol(metadata.protocol)) {
    issues.push({
      field: 'metadata.protocol',
      code: 'required',
      message: 'Mount protocol is required.',
    });
    return issues;
  }

  if (metadata.protocol === 'simulator') {
    if (metadata.selectedDeviceId !== undefined && metadata.selectedDeviceId !== null && !isNonEmptyString(metadata.selectedDeviceId)) {
      issues.push({
        field: 'metadata.selectedDeviceId',
        code: 'invalid',
        message: 'Simulator selectedDeviceId must be a non-empty string when provided.',
      });
    }
    if (metadata.selectedDevice) {
      if (!isNonEmptyString(metadata.selectedDevice.id)) {
        issues.push({
          field: 'metadata.selectedDevice.id',
          code: 'required',
          message: 'Simulator selected device id is required.',
        });
      }
      if (!isNonEmptyString(metadata.selectedDevice.name)) {
        issues.push({
          field: 'metadata.selectedDevice.name',
          code: 'required',
          message: 'Simulator selected device name is required.',
        });
      }
    }
    return issues;
  }

  if (!isNonEmptyString(metadata.host)) {
    issues.push({
      field: 'metadata.host',
      code: 'required',
      message: 'Mount host is required.',
    });
  }
  if (!isPositiveNumber(metadata.port)) {
    issues.push({
      field: 'metadata.port',
      code: 'invalid',
      message: 'Mount port must be a positive number.',
    });
  }
  if (typeof metadata.deviceId !== 'number' || metadata.deviceId < 0 || !Number.isFinite(metadata.deviceId)) {
    issues.push({
      field: 'metadata.deviceId',
      code: 'invalid',
      message: 'Mount deviceId must be a non-negative number.',
    });
  }
  return issues;
}

function validateCameraMetadata(metadata: CameraDeviceMetadata): DeviceProfileValidationIssue[] {
  const issues: DeviceProfileValidationIssue[] = [];
  if (!isPositiveNumber(metadata.sensorWidth)) {
    issues.push({
      field: 'metadata.sensorWidth',
      code: 'invalid',
      message: 'Camera sensorWidth must be a positive number.',
    });
  }
  if (!isPositiveNumber(metadata.sensorHeight)) {
    issues.push({
      field: 'metadata.sensorHeight',
      code: 'invalid',
      message: 'Camera sensorHeight must be a positive number.',
    });
  }
  return issues;
}

function validateTelescopeMetadata(metadata: TelescopeDeviceMetadata): DeviceProfileValidationIssue[] {
  const issues: DeviceProfileValidationIssue[] = [];
  if (!isPositiveNumber(metadata.focalLength)) {
    issues.push({
      field: 'metadata.focalLength',
      code: 'invalid',
      message: 'Telescope focalLength must be a positive number.',
    });
  }
  if (!isPositiveNumber(metadata.aperture)) {
    issues.push({
      field: 'metadata.aperture',
      code: 'invalid',
      message: 'Telescope aperture must be a positive number.',
    });
  }
  return issues;
}

function validateGuiderMetadata(metadata: GuiderDeviceMetadata): DeviceProfileValidationIssue[] {
  const issues: DeviceProfileValidationIssue[] = [];
  if (!isPositiveNumber(metadata.guideRate)) {
    issues.push({
      field: 'metadata.guideRate',
      code: 'invalid',
      message: 'Guider guideRate must be a positive number.',
    });
  }
  return issues;
}

function validateFocuserMetadata(metadata: FocuserDeviceMetadata): DeviceProfileValidationIssue[] {
  const issues: DeviceProfileValidationIssue[] = [];
  if (!isPositiveNumber(metadata.stepSizeMicrons)) {
    issues.push({
      field: 'metadata.stepSizeMicrons',
      code: 'invalid',
      message: 'Focuser stepSizeMicrons must be a positive number.',
    });
  }
  return issues;
}

function validateMetadataByType(profile: DeviceProfile): DeviceProfileValidationIssue[] {
  switch (profile.type) {
    case 'mount':
      return validateMountMetadata(profile.metadata);
    case 'camera':
      return validateCameraMetadata(profile.metadata);
    case 'telescope':
      return validateTelescopeMetadata(profile.metadata);
    case 'guider':
      return validateGuiderMetadata(profile.metadata);
    case 'focuser':
      return validateFocuserMetadata(profile.metadata);
    default: {
      return [{
        field: 'type',
        code: 'unsupported',
        message: 'Unsupported device type.',
      }];
    }
  }
}

function validateDeviceType(value: unknown): value is DeviceType {
  return value === 'mount'
    || value === 'camera'
    || value === 'telescope'
    || value === 'guider'
    || value === 'focuser';
}

export function validateDeviceProfile(profile: DeviceProfile): DeviceProfileValidationResult {
  const issues: DeviceProfileValidationIssue[] = [];

  if (!isNonEmptyString(profile.id)) {
    issues.push({
      field: 'id',
      code: 'required',
      message: 'Profile id is required.',
    });
  }
  if (!isNonEmptyString(profile.name)) {
    issues.push({
      field: 'name',
      code: 'required',
      message: 'Profile name is required.',
    });
  }
  if (!validateDeviceType(profile.type)) {
    issues.push({
      field: 'type',
      code: 'invalid',
      message: 'Profile type is invalid.',
    });
  }

  issues.push(...validateMetadataByType(profile));

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function isDeviceProfileValid(profile: DeviceProfile): boolean {
  return validateDeviceProfile(profile).valid;
}
