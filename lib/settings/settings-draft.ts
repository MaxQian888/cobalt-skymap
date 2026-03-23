import type {
  AccessibilitySettings,
  AppPreferences,
  NotificationSettings,
  PerformanceSettings,
  SearchSettings,
  SettingsState,
} from '@/lib/stores/settings-store';
import {
  DEFAULT_ACCESSIBILITY,
  DEFAULT_BACKEND_PROTOCOL,
  DEFAULT_CONNECTION,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PERFORMANCE,
  DEFAULT_PREFERENCES,
  DEFAULT_PROXY,
  DEFAULT_SEARCH,
  useSettingsStore,
} from '@/lib/stores/settings-store';
import { useMountStore } from '@/lib/stores/mount-store';

export type SettingsDraftCategory =
  | 'connection'
  | 'preferences'
  | 'performance'
  | 'accessibility'
  | 'notifications'
  | 'search'
  | 'location';

export interface SettingsLocationDraft {
  latitude: number;
  longitude: number;
  elevation: number;
}

export interface SettingsDraft {
  connection: SettingsState['connection'];
  backendProtocol: SettingsState['backendProtocol'];
  proxy: SettingsState['proxy'];
  preferences: AppPreferences;
  performance: PerformanceSettings;
  accessibility: AccessibilitySettings;
  notifications: NotificationSettings;
  search: SearchSettings;
  location: SettingsLocationDraft;
}

export type SettingsDraftPath =
  | 'connection.ip'
  | 'connection.port'
  | 'backendProtocol'
  | `proxy.${keyof SettingsState['proxy'] & string}`
  | `preferences.${keyof AppPreferences & string}`
  | `performance.${keyof PerformanceSettings & string}`
  | `accessibility.${keyof AccessibilitySettings & string}`
  | `notifications.${keyof NotificationSettings & string}`
  | `search.${keyof SearchSettings & string}`
  | 'location.latitude'
  | 'location.longitude'
  | 'location.elevation';

export const SETTINGS_DRAFT_CATEGORIES: SettingsDraftCategory[] = [
  'connection',
  'preferences',
  'performance',
  'accessibility',
  'notifications',
  'search',
  'location',
];

export const DEFAULT_SETTINGS_LOCATION: SettingsLocationDraft = {
  latitude: 0,
  longitude: 0,
  elevation: 0,
};

const PREFERENCE_KEYS = Object.keys(DEFAULT_PREFERENCES) as Array<keyof AppPreferences>;
const PERFORMANCE_KEYS = Object.keys(DEFAULT_PERFORMANCE) as Array<keyof PerformanceSettings>;
const ACCESSIBILITY_KEYS = Object.keys(DEFAULT_ACCESSIBILITY) as Array<keyof AccessibilitySettings>;
const NOTIFICATION_KEYS = Object.keys(DEFAULT_NOTIFICATIONS) as Array<keyof NotificationSettings>;
const SEARCH_KEYS = Object.keys(DEFAULT_SEARCH) as Array<keyof SearchSettings>;

export function createDefaultSettingsDraft(): SettingsDraft {
  return {
    connection: { ...DEFAULT_CONNECTION },
    backendProtocol: DEFAULT_BACKEND_PROTOCOL,
    proxy: { ...DEFAULT_PROXY },
    preferences: { ...DEFAULT_PREFERENCES },
    performance: { ...DEFAULT_PERFORMANCE },
    accessibility: { ...DEFAULT_ACCESSIBILITY },
    notifications: { ...DEFAULT_NOTIFICATIONS },
    search: { ...DEFAULT_SEARCH },
    location: { ...DEFAULT_SETTINGS_LOCATION },
  };
}

export function createSettingsDraftSnapshot(): SettingsDraft {
  const settingsState = useSettingsStore.getState();
  const mountState = useMountStore.getState();
  const astrometrySettings = mountState.profileInfo?.AstrometrySettings;

  return {
    connection: { ...settingsState.connection },
    backendProtocol: settingsState.backendProtocol,
    proxy: { ...settingsState.proxy },
    preferences: { ...settingsState.preferences },
    performance: { ...settingsState.performance },
    accessibility: { ...settingsState.accessibility },
    notifications: { ...settingsState.notifications },
    search: { ...settingsState.search },
    location: {
      latitude: astrometrySettings?.Latitude ?? DEFAULT_SETTINGS_LOCATION.latitude,
      longitude: astrometrySettings?.Longitude ?? DEFAULT_SETTINGS_LOCATION.longitude,
      elevation: astrometrySettings?.Elevation ?? DEFAULT_SETTINGS_LOCATION.elevation,
    },
  };
}

export function cloneSettingsDraft(draft: SettingsDraft): SettingsDraft {
  return {
    connection: { ...draft.connection },
    backendProtocol: draft.backendProtocol,
    proxy: { ...draft.proxy },
    preferences: { ...draft.preferences },
    performance: { ...draft.performance },
    accessibility: { ...draft.accessibility },
    notifications: { ...draft.notifications },
    search: { ...draft.search },
    location: { ...draft.location },
  };
}

export function computeDirtyFieldPaths(
  baseline: SettingsDraft,
  draft: SettingsDraft,
): SettingsDraftPath[] {
  const paths: SettingsDraftPath[] = [];

  if (baseline.connection.ip !== draft.connection.ip) {
    paths.push('connection.ip');
  }
  if (baseline.connection.port !== draft.connection.port) {
    paths.push('connection.port');
  }
  if (baseline.backendProtocol !== draft.backendProtocol) {
    paths.push('backendProtocol');
  }
  if (baseline.proxy.mode !== draft.proxy.mode) {
    paths.push('proxy.mode');
  }
  if (baseline.proxy.manualUrl !== draft.proxy.manualUrl) {
    paths.push('proxy.manualUrl');
  }
  if (
    baseline.proxy.fallbackToDirectOnFailure
    !== draft.proxy.fallbackToDirectOnFailure
  ) {
    paths.push('proxy.fallbackToDirectOnFailure');
  }

  for (const key of PREFERENCE_KEYS) {
    if (baseline.preferences[key] !== draft.preferences[key]) {
      paths.push(`preferences.${key}` as SettingsDraftPath);
    }
  }

  for (const key of PERFORMANCE_KEYS) {
    if (baseline.performance[key] !== draft.performance[key]) {
      paths.push(`performance.${key}` as SettingsDraftPath);
    }
  }

  for (const key of ACCESSIBILITY_KEYS) {
    if (baseline.accessibility[key] !== draft.accessibility[key]) {
      paths.push(`accessibility.${key}` as SettingsDraftPath);
    }
  }

  for (const key of NOTIFICATION_KEYS) {
    if (baseline.notifications[key] !== draft.notifications[key]) {
      paths.push(`notifications.${key}` as SettingsDraftPath);
    }
  }

  for (const key of SEARCH_KEYS) {
    if (baseline.search[key] !== draft.search[key]) {
      paths.push(`search.${key}` as SettingsDraftPath);
    }
  }

  if (baseline.location.latitude !== draft.location.latitude) {
    paths.push('location.latitude');
  }
  if (baseline.location.longitude !== draft.location.longitude) {
    paths.push('location.longitude');
  }
  if (baseline.location.elevation !== draft.location.elevation) {
    paths.push('location.elevation');
  }

  return paths;
}

export function deriveDirtyCategories(paths: readonly SettingsDraftPath[]): SettingsDraftCategory[] {
  const categories = new Set<SettingsDraftCategory>();
  for (const path of paths) {
    if (path === 'backendProtocol' || path.startsWith('proxy.')) {
      categories.add('connection');
      continue;
    }
    const [category] = path.split('.');
    if (SETTINGS_DRAFT_CATEGORIES.includes(category as SettingsDraftCategory)) {
      categories.add(category as SettingsDraftCategory);
    }
  }
  return SETTINGS_DRAFT_CATEGORIES.filter((category) => categories.has(category));
}

export function resetDraftCategory(
  draft: SettingsDraft,
  category: SettingsDraftCategory,
  defaults: SettingsDraft = createDefaultSettingsDraft(),
): SettingsDraft {
  switch (category) {
    case 'connection':
      return {
        ...draft,
        connection: { ...defaults.connection },
        backendProtocol: defaults.backendProtocol,
        proxy: { ...defaults.proxy },
      };
    case 'preferences':
      return { ...draft, preferences: { ...defaults.preferences } };
    case 'performance':
      return { ...draft, performance: { ...defaults.performance } };
    case 'accessibility':
      return { ...draft, accessibility: { ...defaults.accessibility } };
    case 'notifications':
      return { ...draft, notifications: { ...defaults.notifications } };
    case 'search':
      return { ...draft, search: { ...defaults.search } };
    case 'location':
      return { ...draft, location: { ...defaults.location } };
    default:
      return draft;
  }
}
