import { useMountStore } from '@/lib/stores/mount-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import type { SettingsDraft, SettingsDraftCategory } from './settings-draft';
import { applyCanonicalObservationLocation } from '@/lib/services/observation-location-controller';

export interface DomainApplyFailure {
  domain: SettingsDraftCategory;
  error: string;
}

export interface ApplySettingsTransactionResult {
  success: boolean;
  appliedDomains: SettingsDraftCategory[];
  failedDomains: DomainApplyFailure[];
  rolledBackDomains: SettingsDraftCategory[];
}

export interface ApplySettingsTransactionOptions {
  domainOrder?: SettingsDraftCategory[];
  domainWriters?: Partial<Record<SettingsDraftCategory, (draft: SettingsDraft) => void | Promise<void>>>;
}

const DEFAULT_DOMAIN_ORDER: SettingsDraftCategory[] = [
  'connection',
  'preferences',
  'performance',
  'accessibility',
  'notifications',
  'search',
  'location',
];

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error.';
}

export async function applySettingsTransaction(
  draft: SettingsDraft,
  options: ApplySettingsTransactionOptions = {},
): Promise<ApplySettingsTransactionResult> {
  const settingsStore = useSettingsStore.getState();
  const mountStore = useMountStore.getState();

  const order = options.domainOrder ?? DEFAULT_DOMAIN_ORDER;
  const appliedDomains: SettingsDraftCategory[] = [];
  const failedDomains: DomainApplyFailure[] = [];
  const rolledBackDomains: SettingsDraftCategory[] = [];

  const settingsSnapshot = {
    connection: { ...settingsStore.connection },
    backendProtocol: settingsStore.backendProtocol,
    proxy: { ...settingsStore.proxy },
    preferences: { ...settingsStore.preferences },
    performance: { ...settingsStore.performance },
    accessibility: { ...settingsStore.accessibility },
    notifications: { ...settingsStore.notifications },
    search: { ...settingsStore.search },
  };

  const locationSnapshot = {
    latitude: mountStore.profileInfo?.AstrometrySettings?.Latitude ?? 0,
    longitude: mountStore.profileInfo?.AstrometrySettings?.Longitude ?? 0,
    elevation: mountStore.profileInfo?.AstrometrySettings?.Elevation ?? 0,
  };

  const defaultWriters: Record<SettingsDraftCategory, (currentDraft: SettingsDraft) => void | Promise<void>> = {
    connection: (currentDraft) => {
      settingsStore.setConnection(currentDraft.connection);
      settingsStore.setBackendProtocol(currentDraft.backendProtocol);
      settingsStore.setProxySettings(currentDraft.proxy);
    },
    preferences: (currentDraft) => {
      settingsStore.setPreferences(currentDraft.preferences);
    },
    performance: (currentDraft) => {
      settingsStore.setPerformanceSettings(currentDraft.performance);
    },
    accessibility: (currentDraft) => {
      settingsStore.setAccessibilitySettings(currentDraft.accessibility);
    },
    notifications: (currentDraft) => {
      settingsStore.setNotificationSettings(currentDraft.notifications);
    },
    search: (currentDraft) => {
      settingsStore.setSearchSettings(currentDraft.search);
    },
    location: async (currentDraft) => {
      await applyCanonicalObservationLocation({
        latitude: currentDraft.location.latitude,
        longitude: currentDraft.location.longitude,
        altitude: currentDraft.location.elevation,
      });
      const currentProfile = useMountStore.getState().profileInfo;
      mountStore.setProfileInfo({
        ...currentProfile,
        AstrometrySettings: {
          ...currentProfile.AstrometrySettings,
          Latitude: currentDraft.location.latitude,
          Longitude: currentDraft.location.longitude,
          Elevation: currentDraft.location.elevation,
        },
      });
    },
  };

  const rollbackWriters: Record<SettingsDraftCategory, () => void> = {
    connection: () => {
      settingsStore.setConnection(settingsSnapshot.connection);
      settingsStore.setBackendProtocol(settingsSnapshot.backendProtocol);
      settingsStore.setProxySettings(settingsSnapshot.proxy);
    },
    preferences: () => {
      settingsStore.setPreferences(settingsSnapshot.preferences);
    },
    performance: () => {
      settingsStore.setPerformanceSettings(settingsSnapshot.performance);
    },
    accessibility: () => {
      settingsStore.setAccessibilitySettings(settingsSnapshot.accessibility);
    },
    notifications: () => {
      settingsStore.setNotificationSettings(settingsSnapshot.notifications);
    },
    search: () => {
      settingsStore.setSearchSettings(settingsSnapshot.search);
    },
    location: () => {
      const currentProfile = useMountStore.getState().profileInfo;
      mountStore.setProfileInfo({
        ...currentProfile,
        AstrometrySettings: {
          ...currentProfile.AstrometrySettings,
          Latitude: locationSnapshot.latitude,
          Longitude: locationSnapshot.longitude,
          Elevation: locationSnapshot.elevation,
        },
      });
    },
  };

  try {
    for (const domain of order) {
      const writer = options.domainWriters?.[domain] ?? defaultWriters[domain];
      await writer(draft);
      appliedDomains.push(domain);
    }
  } catch (error) {
    const failingDomain = order[appliedDomains.length] ?? order[order.length - 1] ?? 'connection';
    failedDomains.push({
      domain: failingDomain,
      error: toErrorMessage(error),
    });

    for (const domain of [...appliedDomains].reverse()) {
      try {
        rollbackWriters[domain]();
        rolledBackDomains.push(domain);
      } catch {
        // Rollback is best-effort; preserve original failure as the primary signal.
      }
    }

    return {
      success: false,
      appliedDomains,
      failedDomains,
      rolledBackDomains,
    };
  }

  return {
    success: true,
    appliedDomains,
    failedDomains,
    rolledBackDomains,
  };
}
