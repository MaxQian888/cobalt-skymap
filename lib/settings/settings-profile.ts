import {
  useDailyKnowledgeStore,
  useEquipmentStore,
  useEventSourcesStore,
  useGlobalShortcutStore,
  useMountStore,
  useSettingsStore,
} from '@/lib/stores';
import type { EventSourceConfig } from '@/lib/stores';
import {
  useThemeStore,
  isValidThemeColorValue,
  sanitizeThemePresets,
  type ThemePreset,
} from '@/lib/stores/theme-store';
import { useKeybindingStore } from '@/lib/stores/keybinding-store';
import { createSettingsDraftSnapshot } from './settings-draft';
import { validateSettingsDraft } from './settings-validation';
import { isTauri } from '@/lib/storage/platform';

export type SettingsThemeMode = 'light' | 'dark' | 'system';

export const SETTINGS_PROFILE_SCHEMA_VERSION = 6;
export const SUPPORTED_SETTINGS_PROFILE_VERSIONS = new Set([3, 4, 5, 6]);
export const SETTINGS_PROFILE_DOMAINS = [
  'settings',
  'theme',
  'keybindings',
  'globalShortcuts',
  'equipment',
  'location',
  'eventSources',
  'dailyKnowledge',
] as const;

export type SettingsProfileDomain = (typeof SETTINGS_PROFILE_DOMAINS)[number];

const SETTINGS_VALIDATION_CATEGORIES = new Set([
  'connection',
  'preferences',
  'performance',
  'accessibility',
  'notifications',
  'search',
]);

export interface SettingsProfileMetadata {
  schemaVersion: number;
  domains: readonly SettingsProfileDomain[];
}

export interface SettingsProfileData {
  version: number;
  exportedAt: string;
  metadata?: SettingsProfileMetadata;
  themeMode?: SettingsThemeMode;
  settings?: {
    connection: ReturnType<typeof useSettingsStore.getState>['connection'];
    backendProtocol: ReturnType<typeof useSettingsStore.getState>['backendProtocol'];
    skyEngine: ReturnType<typeof useSettingsStore.getState>['skyEngine'];
    stellarium: ReturnType<typeof useSettingsStore.getState>['stellarium'];
    preferences: ReturnType<typeof useSettingsStore.getState>['preferences'];
    performance: ReturnType<typeof useSettingsStore.getState>['performance'];
    accessibility: ReturnType<typeof useSettingsStore.getState>['accessibility'];
    notifications: ReturnType<typeof useSettingsStore.getState>['notifications'];
    search: ReturnType<typeof useSettingsStore.getState>['search'];
    aladinDisplay: ReturnType<typeof useSettingsStore.getState>['aladinDisplay'];
  };
  theme?: Partial<ReturnType<typeof useThemeStore.getState>['customization']> & {
    userPresets?: ThemePreset[];
  };
  keybindings?: ReturnType<typeof useKeybindingStore.getState>['customBindings'];
  globalShortcuts?: {
    enabled: ReturnType<typeof useGlobalShortcutStore.getState>['enabled'];
    customBindings: ReturnType<typeof useGlobalShortcutStore.getState>['customBindings'];
  };
  equipment?: {
    sensorWidth: number;
    sensorHeight: number;
    focalLength: number;
    pixelSize: number;
    aperture: number;
    rotationAngle: number;
    mosaic: ReturnType<typeof useEquipmentStore.getState>['mosaic'];
    fovDisplay: ReturnType<typeof useEquipmentStore.getState>['fovDisplay'];
    ocularDisplay: ReturnType<typeof useEquipmentStore.getState>['ocularDisplay'];
    exposureDefaults: ReturnType<typeof useEquipmentStore.getState>['exposureDefaults'];
    customCameras: ReturnType<typeof useEquipmentStore.getState>['customCameras'];
    customTelescopes: ReturnType<typeof useEquipmentStore.getState>['customTelescopes'];
    customEyepieces: ReturnType<typeof useEquipmentStore.getState>['customEyepieces'];
    customBarlows: ReturnType<typeof useEquipmentStore.getState>['customBarlows'];
    customOcularTelescopes: ReturnType<typeof useEquipmentStore.getState>['customOcularTelescopes'];
    selectedOcularTelescopeId: ReturnType<typeof useEquipmentStore.getState>['selectedOcularTelescopeId'];
    selectedEyepieceId: ReturnType<typeof useEquipmentStore.getState>['selectedEyepieceId'];
    selectedBarlowId: ReturnType<typeof useEquipmentStore.getState>['selectedBarlowId'];
  };
  location?: {
    latitude: number;
    longitude: number;
    elevation: number;
  };
  eventSources?: EventSourceConfig[];
  dailyKnowledge?: {
    favorites: ReturnType<typeof useDailyKnowledgeStore.getState>['favorites'];
    history: ReturnType<typeof useDailyKnowledgeStore.getState>['history'];
    startupState: {
      lastShownDate: ReturnType<typeof useDailyKnowledgeStore.getState>['lastShownDate'];
      snoozedDate: ReturnType<typeof useDailyKnowledgeStore.getState>['snoozedDate'];
      lastSeenItemId: ReturnType<typeof useDailyKnowledgeStore.getState>['lastSeenItemId'];
    };
  };
}

export interface SettingsProfileSkippedDomain {
  domain: SettingsProfileDomain;
  reason: 'invalidDomainPayload';
}

export interface SettingsProfileWarning {
  domain?: SettingsProfileDomain;
  code: 'secretsNotIncluded';
}

export interface ParsedSettingsProfileResult {
  ok: boolean;
  data?: SettingsProfileData;
  importableDomains: SettingsProfileDomain[];
  skippedDomains: SettingsProfileSkippedDomain[];
  warnings: SettingsProfileWarning[];
  error?: 'invalidFileFormat' | 'unsupportedVersion' | 'noImportableDomains';
}

interface BuildSettingsProfileOptions {
  domains?: SettingsProfileDomain[];
  exportedAt?: string;
  themeMode?: SettingsThemeMode | null | undefined;
  includeSensitiveFields?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeThemeMode(value: unknown): SettingsThemeMode | null {
  return value === 'light' || value === 'dark' || value === 'system' ? value : null;
}

function uniqueDomains(domains: readonly SettingsProfileDomain[]): SettingsProfileDomain[] {
  return SETTINGS_PROFILE_DOMAINS.filter((domain) => domains.includes(domain));
}

function sanitizeEventSourcesForExport(
  eventSources: EventSourceConfig[],
  includeSensitiveFields = false,
): EventSourceConfig[] {
  return eventSources.map((source) => ({
    ...source,
    apiKey: includeSensitiveFields ? source.apiKey : '',
    hasStoredSecret: includeSensitiveFields
      ? (source.hasStoredSecret ?? !!source.apiKey)
      : (source.hasStoredSecret ?? !!source.apiKey),
  }));
}

export function sanitizeImportedEventSources(eventSources: EventSourceConfig[]): EventSourceConfig[] {
  return eventSources.map((source) => {
    const apiKey = isTauri() && typeof source.apiKey === 'string' ? source.apiKey : '';
    const hasStoredSecret = apiKey.trim().length > 0;
    return {
      ...source,
      apiKey,
      hasStoredSecret,
    };
  });
}

function getDomainsFromPayload(payload: Partial<SettingsProfileData>): SettingsProfileDomain[] {
  const domains: SettingsProfileDomain[] = [];
  if (payload.settings) domains.push('settings');
  if (payload.theme) domains.push('theme');
  if (payload.keybindings) domains.push('keybindings');
  if (payload.globalShortcuts) domains.push('globalShortcuts');
  if (payload.equipment) domains.push('equipment');
  if (payload.location) domains.push('location');
  if (payload.eventSources) domains.push('eventSources');
  if (payload.dailyKnowledge) domains.push('dailyKnowledge');
  return domains;
}

function validateSettingsAndLocation(
  settings: SettingsProfileData['settings'] | undefined,
  location: SettingsProfileData['location'] | undefined,
): { settingsValid: boolean; locationValid: boolean } {
  const draft = createSettingsDraftSnapshot();

  if (settings?.connection) {
    draft.connection = { ...draft.connection, ...settings.connection };
  }
  if (settings?.backendProtocol) {
    draft.backendProtocol = settings.backendProtocol;
  }
  if (settings?.preferences) {
    draft.preferences = { ...draft.preferences, ...settings.preferences };
  }
  if (settings?.performance) {
    draft.performance = { ...draft.performance, ...settings.performance };
  }
  if (settings?.accessibility) {
    draft.accessibility = { ...draft.accessibility, ...settings.accessibility };
  }
  if (settings?.notifications) {
    draft.notifications = { ...draft.notifications, ...settings.notifications };
  }
  if (settings?.search) {
    draft.search = { ...draft.search, ...settings.search };
  }
  if (location) {
    draft.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      elevation: location.elevation,
    };
  }

  const validation = validateSettingsDraft(draft);
  if (validation.isValid) {
    return { settingsValid: true, locationValid: true };
  }

  const hasSettingsValidationError = validation.issues.some((issue) =>
    SETTINGS_VALIDATION_CATEGORIES.has(issue.category),
  );
  const hasLocationValidationError = validation.issues.some((issue) => issue.category === 'location');

  return {
    settingsValid: !hasSettingsValidationError,
    locationValid: !hasLocationValidationError,
  };
}

function isValidStringRecord(record: unknown, valuePredicate?: (value: unknown) => boolean): boolean {
  if (!isRecord(record)) {
    return false;
  }
  return Object.values(record).every((value) => (valuePredicate ? valuePredicate(value) : true));
}

function sanitizeThemeDomain(theme: unknown): SettingsProfileData['theme'] | undefined {
  if (!isRecord(theme)) {
    return undefined;
  }

  const radius = theme.radius;
  const fontFamily = theme.fontFamily;
  const fontSize = theme.fontSize;
  const animationsEnabled = theme.animationsEnabled;
  const activePreset = theme.activePreset;
  const customColors = theme.customColors;
  const userPresets = theme.userPresets;

  if (radius !== undefined && typeof radius !== 'number') return undefined;
  if (fontFamily !== undefined && !['default', 'serif', 'mono', 'system'].includes(String(fontFamily))) return undefined;
  if (fontSize !== undefined && !['small', 'default', 'large'].includes(String(fontSize))) return undefined;
  if (animationsEnabled !== undefined && typeof animationsEnabled !== 'boolean') return undefined;
  if (activePreset !== undefined && activePreset !== null && typeof activePreset !== 'string') return undefined;
  if (customColors !== undefined) {
    if (!isRecord(customColors)) return undefined;
    for (const mode of ['light', 'dark'] as const) {
      const palette = customColors[mode];
      if (palette !== undefined) {
        if (!isRecord(palette)) return undefined;
        if (Object.values(palette).some((value) => typeof value !== 'string' || !isValidThemeColorValue(value))) {
          return undefined;
        }
      }
    }
  }

  if (userPresets !== undefined && !Array.isArray(userPresets)) {
    return undefined;
  }

  return {
    ...(theme as SettingsProfileData['theme']),
    ...(userPresets !== undefined ? { userPresets: sanitizeThemePresets(userPresets) } : {}),
  };
}

function sanitizeKeybindingsDomain(keybindings: unknown): SettingsProfileData['keybindings'] | undefined {
  if (!isRecord(keybindings)) {
    return undefined;
  }
  const isValid = Object.values(keybindings).every((binding) => isRecord(binding));
  return isValid ? (keybindings as SettingsProfileData['keybindings']) : undefined;
}

function sanitizeGlobalShortcutsDomain(
  globalShortcuts: unknown,
): SettingsProfileData['globalShortcuts'] | undefined {
  if (!isRecord(globalShortcuts)) {
    return undefined;
  }
  if (globalShortcuts.enabled !== undefined && typeof globalShortcuts.enabled !== 'boolean') {
    return undefined;
  }
  if (
    globalShortcuts.customBindings !== undefined
    && !isValidStringRecord(globalShortcuts.customBindings, (value) => typeof value === 'string')
  ) {
    return undefined;
  }
  return globalShortcuts as SettingsProfileData['globalShortcuts'];
}

function sanitizeEquipmentDomain(equipment: unknown): SettingsProfileData['equipment'] | undefined {
  if (!isRecord(equipment)) {
    return undefined;
  }

  const numericKeys = [
    'sensorWidth',
    'sensorHeight',
    'focalLength',
    'pixelSize',
    'aperture',
    'rotationAngle',
  ] as const;
  for (const key of numericKeys) {
    if (equipment[key] !== undefined && typeof equipment[key] !== 'number') {
      return undefined;
    }
  }

  const arrayKeys = [
    'customCameras',
    'customTelescopes',
    'customEyepieces',
    'customBarlows',
    'customOcularTelescopes',
  ] as const;
  for (const key of arrayKeys) {
    if (equipment[key] !== undefined && !Array.isArray(equipment[key])) {
      return undefined;
    }
  }

  const stringKeys = ['selectedOcularTelescopeId', 'selectedEyepieceId', 'selectedBarlowId'] as const;
  for (const key of stringKeys) {
    if (equipment[key] !== undefined && typeof equipment[key] !== 'string') {
      return undefined;
    }
  }

  return equipment as SettingsProfileData['equipment'];
}

function sanitizeLocationDomain(location: unknown): SettingsProfileData['location'] | undefined {
  if (!isRecord(location)) {
    return undefined;
  }
  if (
    typeof location.latitude !== 'number'
    || typeof location.longitude !== 'number'
    || typeof location.elevation !== 'number'
  ) {
    return undefined;
  }
  return location as SettingsProfileData['location'];
}

function sanitizeEventSourcesDomain(eventSources: unknown): SettingsProfileData['eventSources'] | undefined {
  if (!Array.isArray(eventSources)) {
    return undefined;
  }
  const isValid = eventSources.every((source) => isRecord(source) && typeof source.id === 'string');
  return isValid ? (eventSources as SettingsProfileData['eventSources']) : undefined;
}

function sanitizeDailyKnowledgeDomain(dailyKnowledge: unknown): SettingsProfileData['dailyKnowledge'] | undefined {
  if (!isRecord(dailyKnowledge)) {
    return undefined;
  }
  if (
    dailyKnowledge.favorites !== undefined && !Array.isArray(dailyKnowledge.favorites)
    || dailyKnowledge.history !== undefined && !Array.isArray(dailyKnowledge.history)
  ) {
    return undefined;
  }
  const startupState = dailyKnowledge.startupState;
  if (startupState !== undefined) {
    if (!isRecord(startupState)) {
      return undefined;
    }
    const nullableStringKeys = ['lastShownDate', 'snoozedDate', 'lastSeenItemId'] as const;
    for (const key of nullableStringKeys) {
      const value = startupState[key];
      if (value !== undefined && value !== null && typeof value !== 'string') {
        return undefined;
      }
    }
  }
  return dailyKnowledge as SettingsProfileData['dailyKnowledge'];
}

export function buildSettingsProfile(options: BuildSettingsProfileOptions = {}): SettingsProfileData {
  const domains = uniqueDomains(options.domains ?? SETTINGS_PROFILE_DOMAINS);
  const settingsState = useSettingsStore.getState();
  const themeState = useThemeStore.getState();
  const keybindingState = useKeybindingStore.getState();
  const globalShortcutState = useGlobalShortcutStore.getState();
  const equipmentState = useEquipmentStore.getState();
  const mountState = useMountStore.getState();
  const eventSourcesState = useEventSourcesStore.getState();
  const dailyKnowledgeState = useDailyKnowledgeStore.getState();

  const profile: SettingsProfileData = {
    version: SETTINGS_PROFILE_SCHEMA_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    metadata: {
      schemaVersion: SETTINGS_PROFILE_SCHEMA_VERSION,
      domains,
    },
  };

  if (domains.includes('settings')) {
    profile.settings = {
      connection: settingsState.connection,
      backendProtocol: settingsState.backendProtocol,
      skyEngine: settingsState.skyEngine,
      stellarium: settingsState.stellarium,
      preferences: settingsState.preferences,
      performance: settingsState.performance,
      accessibility: settingsState.accessibility,
      notifications: settingsState.notifications,
      search: settingsState.search,
      aladinDisplay: settingsState.aladinDisplay,
    };
  }

  if (domains.includes('theme')) {
    profile.themeMode = normalizeThemeMode(options.themeMode) ?? undefined;
    profile.theme = {
      ...themeState.customization,
      userPresets: themeState.userPresets,
    };
  }

  if (domains.includes('keybindings')) {
    profile.keybindings = keybindingState.customBindings;
  }

  if (domains.includes('globalShortcuts')) {
    profile.globalShortcuts = {
      enabled: globalShortcutState.enabled,
      customBindings: globalShortcutState.customBindings,
    };
  }

  if (domains.includes('equipment')) {
    profile.equipment = {
      sensorWidth: equipmentState.sensorWidth,
      sensorHeight: equipmentState.sensorHeight,
      focalLength: equipmentState.focalLength,
      pixelSize: equipmentState.pixelSize,
      aperture: equipmentState.aperture,
      rotationAngle: equipmentState.rotationAngle,
      mosaic: equipmentState.mosaic,
      fovDisplay: equipmentState.fovDisplay,
      ocularDisplay: equipmentState.ocularDisplay,
      exposureDefaults: equipmentState.exposureDefaults,
      customCameras: equipmentState.customCameras,
      customTelescopes: equipmentState.customTelescopes,
      customEyepieces: equipmentState.customEyepieces,
      customBarlows: equipmentState.customBarlows,
      customOcularTelescopes: equipmentState.customOcularTelescopes,
      selectedOcularTelescopeId: equipmentState.selectedOcularTelescopeId,
      selectedEyepieceId: equipmentState.selectedEyepieceId,
      selectedBarlowId: equipmentState.selectedBarlowId,
    };
  }

  if (domains.includes('location')) {
    profile.location = {
      latitude: mountState.profileInfo.AstrometrySettings.Latitude,
      longitude: mountState.profileInfo.AstrometrySettings.Longitude,
      elevation: mountState.profileInfo.AstrometrySettings.Elevation,
    };
  }

  if (domains.includes('eventSources')) {
    profile.eventSources = sanitizeEventSourcesForExport(
      eventSourcesState.sources,
      options.includeSensitiveFields,
    );
  }

  if (domains.includes('dailyKnowledge')) {
    profile.dailyKnowledge = {
      favorites: dailyKnowledgeState.favorites,
      history: dailyKnowledgeState.history,
      startupState: {
        lastShownDate: dailyKnowledgeState.lastShownDate,
        snoozedDate: dailyKnowledgeState.snoozedDate,
        lastSeenItemId: dailyKnowledgeState.lastSeenItemId,
      },
    };
  }

  return profile;
}

export function parseSettingsProfile(raw: unknown): ParsedSettingsProfileResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      importableDomains: [],
      skippedDomains: [],
      warnings: [],
      error: 'invalidFileFormat',
    };
  }

  const version = raw.version;
  if (typeof version !== 'number' || !SUPPORTED_SETTINGS_PROFILE_VERSIONS.has(version)) {
    return {
      ok: false,
      importableDomains: [],
      skippedDomains: [],
      warnings: [],
      error: 'unsupportedVersion',
    };
  }

  const skippedDomains: SettingsProfileSkippedDomain[] = [];
  const warnings: SettingsProfileWarning[] = [];

  const data: SettingsProfileData = {
    version,
    exportedAt: typeof raw.exportedAt === 'string' && raw.exportedAt.trim().length > 0
      ? raw.exportedAt
      : new Date(0).toISOString(),
    themeMode: normalizeThemeMode(raw.themeMode) ?? undefined,
    settings: isRecord(raw.settings) ? (raw.settings as SettingsProfileData['settings']) : undefined,
    theme: sanitizeThemeDomain(raw.theme),
    keybindings: sanitizeKeybindingsDomain(raw.keybindings),
    globalShortcuts: sanitizeGlobalShortcutsDomain(raw.globalShortcuts),
    equipment: sanitizeEquipmentDomain(raw.equipment),
    location: sanitizeLocationDomain(raw.location),
    eventSources: sanitizeEventSourcesDomain(raw.eventSources),
    dailyKnowledge: sanitizeDailyKnowledgeDomain(raw.dailyKnowledge),
  };

  for (const [domain, value, normalized] of [
    ['theme', raw.theme, data.theme],
    ['keybindings', raw.keybindings, data.keybindings],
    ['globalShortcuts', raw.globalShortcuts, data.globalShortcuts],
    ['equipment', raw.equipment, data.equipment],
    ['location', raw.location, data.location],
    ['eventSources', raw.eventSources, data.eventSources],
    ['dailyKnowledge', raw.dailyKnowledge, data.dailyKnowledge],
  ] as const) {
    if (value !== undefined && !normalized) {
      skippedDomains.push({ domain, reason: 'invalidDomainPayload' });
    }
  }

  if (raw.settings && !data.settings) {
    skippedDomains.push({ domain: 'settings', reason: 'invalidDomainPayload' });
  }

  if (data.settings || data.location) {
    const { settingsValid, locationValid } = validateSettingsAndLocation(data.settings, data.location);
    if (!settingsValid && data.settings) {
      data.settings = undefined;
      skippedDomains.push({ domain: 'settings', reason: 'invalidDomainPayload' });
    }
    if (!locationValid && data.location) {
      data.location = undefined;
      skippedDomains.push({ domain: 'location', reason: 'invalidDomainPayload' });
    }
  }

  if (data.eventSources?.some((source) => !!source.hasStoredSecret && (!source.apiKey || source.apiKey.trim().length === 0))) {
    warnings.push({ domain: 'eventSources', code: 'secretsNotIncluded' });
  }

  const detectedDomains = getDomainsFromPayload(data);
  const metadataSource = isRecord(raw.metadata) ? raw.metadata : undefined;
  data.metadata = {
    schemaVersion: typeof metadataSource?.schemaVersion === 'number' ? metadataSource.schemaVersion : version,
    domains: Array.isArray(metadataSource?.domains)
      ? uniqueDomains(metadataSource.domains.filter((domain): domain is SettingsProfileDomain => typeof domain === 'string'))
          .filter((domain) => detectedDomains.includes(domain))
      : detectedDomains,
  };

  const importableDomains = detectedDomains;
  if (importableDomains.length === 0) {
    return {
      ok: false,
      importableDomains: [],
      skippedDomains,
      warnings,
      error: 'noImportableDomains',
    };
  }

  return {
    ok: true,
    data,
    importableDomains,
    skippedDomains,
    warnings,
  };
}
