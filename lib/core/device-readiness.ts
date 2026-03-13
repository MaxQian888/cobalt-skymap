import type {
  DeviceProfile,
  DeviceReadiness,
  DeviceReadinessIssue,
  DeviceType,
  DeviceConnectionState,
} from '@/lib/core/types/device';
import { isDeviceProfileValid } from '@/lib/core/device-profile-validation';

export interface EvaluateDeviceReadinessInput {
  profiles: DeviceProfile[];
  connections: Record<string, DeviceConnectionState | undefined>;
  requiredTypes?: DeviceType[];
  connectionRequiredTypes?: DeviceType[];
}

export const DEFAULT_REQUIRED_SESSION_DEVICE_TYPES: DeviceType[] = [
  'camera',
  'telescope',
];

export const DEFAULT_CONNECTION_REQUIRED_DEVICE_TYPES: DeviceType[] = [
  'mount',
];

const OPTIONAL_MOUNT_ACTION_KEYS = ['sync', 'park', 'trackingRate', 'moveAxis'] as const;

function createIssue(
  issue: Omit<DeviceReadinessIssue, 'level'> & { level: 'blocked' | 'warning' },
): DeviceReadinessIssue {
  return {
    code: issue.code,
    level: issue.level,
    type: issue.type,
    profileId: issue.profileId,
    message: issue.message,
    remediation: issue.remediation,
  };
}

export function evaluateDeviceReadiness({
  profiles,
  connections,
  requiredTypes = DEFAULT_REQUIRED_SESSION_DEVICE_TYPES,
  connectionRequiredTypes = DEFAULT_CONNECTION_REQUIRED_DEVICE_TYPES,
}: EvaluateDeviceReadinessInput): DeviceReadiness {
  const issues: DeviceReadinessIssue[] = [];
  const enabledProfiles = profiles.filter((profile) => profile.enabled);

  for (const type of requiredTypes) {
    const typedProfiles = enabledProfiles.filter((profile) => profile.type === type);

    if (typedProfiles.length === 0) {
      issues.push(createIssue({
        code: 'profile-missing',
        level: 'blocked',
        type,
        message: `Missing required ${type} profile.`,
        remediation: `Add and enable at least one ${type} profile.`,
      }));
      continue;
    }

    const validProfiles = typedProfiles.filter((profile) => isDeviceProfileValid(profile));
    if (validProfiles.length === 0) {
      issues.push(createIssue({
        code: 'profile-invalid',
        level: 'blocked',
        type,
        profileId: typedProfiles[0]?.id,
        message: `All enabled ${type} profiles are invalid.`,
        remediation: `Update ${type} profile metadata until validation passes.`,
      }));
      continue;
    }

    const primaryProfile = validProfiles[0];
    const connection = connections[primaryProfile.id];
    const requiresConnection = connectionRequiredTypes.includes(type);

    if (!requiresConnection && !connection) continue;

    if (!connection || connection.state === 'idle') {
      issues.push(createIssue({
        code: 'device-disconnected',
        level: 'blocked',
        type,
        profileId: primaryProfile.id,
        message: `${primaryProfile.name} is disconnected.`,
        remediation: 'Connect the device before starting the session.',
      }));
      continue;
    }

    if (connection.state === 'connecting') {
      issues.push(createIssue({
        code: 'device-connecting',
        level: 'blocked',
        type,
        profileId: primaryProfile.id,
        message: `${primaryProfile.name} is still connecting.`,
        remediation: 'Wait for connection to complete or retry.',
      }));
      continue;
    }

    if (connection.state === 'failed') {
      issues.push(createIssue({
        code: 'device-failed',
        level: 'blocked',
        type,
        profileId: primaryProfile.id,
        message: connection.lastError?.message
          ?? `${primaryProfile.name} connection failed.`,
        remediation: 'Retry connection and resolve the reported error.',
      }));
      continue;
    }

    if (connection.state === 'degraded') {
      issues.push(createIssue({
        code: 'device-degraded',
        level: 'warning',
        type,
        profileId: primaryProfile.id,
        message: connection.lastError?.message
          ?? `${primaryProfile.name} is in degraded state.`,
        remediation: 'Continue with caution or reconnect for full functionality.',
      }));
    }

    if (type === 'mount' && primaryProfile.type === 'mount') {
      const unavailableOptionalActions = OPTIONAL_MOUNT_ACTION_KEYS.filter((key) => (
        primaryProfile.metadata.actionAvailability?.[key] === false
      ));

      if (unavailableOptionalActions.length > 0) {
        issues.push(createIssue({
          code: 'mount-capability-limited',
          level: 'warning',
          type,
          profileId: primaryProfile.id,
          message: `${primaryProfile.name} has limited optional controls: ${unavailableOptionalActions.join(', ')}.`,
          remediation: 'Continue with caution or reconnect to refresh supported mount capabilities.',
        }));
      }
    }
  }

  const hasBlocked = issues.some((issue) => issue.level === 'blocked');
  const hasWarning = issues.some((issue) => issue.level === 'warning');

  return {
    state: hasBlocked ? 'blocked' : (hasWarning ? 'warning' : 'ready'),
    requiredTypes: [...requiredTypes],
    issues,
    checkedAt: new Date().toISOString(),
  };
}
