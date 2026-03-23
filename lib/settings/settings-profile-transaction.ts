import {
  BARLOW_PRESETS,
  EYEPIECE_PRESETS,
  OCULAR_TELESCOPE_PRESETS,
} from '@/lib/constants/equipment-presets';
import {
  useDailyKnowledgeStore,
  useEquipmentStore,
  useEventSourcesStore,
  useGlobalShortcutStore,
  useSettingsStore,
} from '@/lib/stores';
import { useThemeStore } from '@/lib/stores/theme-store';
import { useKeybindingStore } from '@/lib/stores/keybinding-store';
import { useLocaleStore } from '@/lib/i18n/locale-store';
import { useSettingsImportRestoreStore, type SettingsImportRestorePoint } from '@/lib/stores/settings-import-restore-store';
import { applySettingsTransaction } from './apply-settings-transaction';
import {
  SETTINGS_PROFILE_DOMAINS,
  buildSettingsProfile,
  sanitizeImportedEventSources,
  type SettingsProfileData,
  type SettingsProfileDomain,
  type SettingsThemeMode,
} from './settings-profile';
import { createSettingsDraftSnapshot } from './settings-draft';

type DomainApplier = (
  profile: SettingsProfileData,
  options: ApplySettingsProfileOptions,
) => void | Promise<void>;

export interface ApplySettingsProfileOptions {
  domains?: SettingsProfileDomain[];
  applyThemeMode?: (mode: SettingsThemeMode) => void;
  currentThemeMode?: SettingsThemeMode | null | undefined;
  persistRestorePoint?: boolean;
  domainAppliers?: Partial<Record<SettingsProfileDomain, DomainApplier>>;
}

export interface ApplySettingsProfileResult {
  success: boolean;
  appliedDomains: SettingsProfileDomain[];
  failedDomain?: SettingsProfileDomain;
  error?: string;
  restorePoint?: SettingsImportRestorePoint;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

function withDomainError(error: unknown, domain: SettingsProfileDomain): Error & { settingsProfileDomain: SettingsProfileDomain } {
  const wrapped = error instanceof Error ? error : new Error(toErrorMessage(error));
  return Object.assign(wrapped, { settingsProfileDomain: domain });
}

function normalizeDomains(profile: SettingsProfileData, domains?: SettingsProfileDomain[]): SettingsProfileDomain[] {
  const sourceDomains = domains ?? profile.metadata?.domains ?? SETTINGS_PROFILE_DOMAINS.filter((domain) => {
    switch (domain) {
      case 'settings':
        return !!profile.settings;
      case 'theme':
        return !!profile.theme;
      case 'keybindings':
        return !!profile.keybindings;
      case 'globalShortcuts':
        return !!profile.globalShortcuts;
      case 'equipment':
        return !!profile.equipment;
      case 'location':
        return !!profile.location;
      case 'eventSources':
        return !!profile.eventSources;
      case 'dailyKnowledge':
        return !!profile.dailyKnowledge;
      default:
        return false;
    }
  });

  return SETTINGS_PROFILE_DOMAINS.filter((domain) => sourceDomains.includes(domain));
}

async function applySettingsAndLocationDomains(
  profile: SettingsProfileData,
  domains: SettingsProfileDomain[],
): Promise<void> {
  const includeSettings = domains.includes('settings');
  const includeLocation = domains.includes('location');
  if (!includeSettings && !includeLocation) {
    return;
  }

  const settingsStore = useSettingsStore.getState();
  const extrasSnapshot = {
    skyEngine: settingsStore.skyEngine,
    stellarium: settingsStore.stellarium,
    aladinDisplay: settingsStore.aladinDisplay,
  };
  const draftSnapshot = createSettingsDraftSnapshot();
  const draft = createSettingsDraftSnapshot();

  if (profile.settings?.connection) {
    draft.connection = { ...draft.connection, ...profile.settings.connection };
  }
  if (profile.settings?.backendProtocol) {
    draft.backendProtocol = profile.settings.backendProtocol;
  }
  if (profile.settings?.proxy) {
    draft.proxy = { ...draft.proxy, ...profile.settings.proxy };
  }
  if (profile.settings?.preferences) {
    draft.preferences = { ...draft.preferences, ...profile.settings.preferences };
  }
  if (profile.settings?.performance) {
    draft.performance = { ...draft.performance, ...profile.settings.performance };
  }
  if (profile.settings?.accessibility) {
    draft.accessibility = { ...draft.accessibility, ...profile.settings.accessibility };
  }
  if (profile.settings?.notifications) {
    draft.notifications = { ...draft.notifications, ...profile.settings.notifications };
  }
  if (profile.settings?.search) {
    draft.search = { ...draft.search, ...profile.settings.search };
  }
  if (includeLocation && profile.location) {
    draft.location = {
      latitude: profile.location.latitude,
      longitude: profile.location.longitude,
      elevation: profile.location.elevation,
    };
  }

  const draftOrder = [
    ...(includeSettings ? ['connection', 'preferences', 'performance', 'accessibility', 'notifications', 'search'] as const : []),
    ...(includeLocation ? ['location'] as const : []),
  ];

  const transactionResult = draftOrder.length > 0
    ? await applySettingsTransaction(draft, { domainOrder: draftOrder })
    : { success: true, appliedDomains: [], failedDomains: [], rolledBackDomains: [] };

  if (!transactionResult.success) {
    throw new Error(transactionResult.failedDomains[0]?.error ?? 'Failed to apply settings');
  }

  try {
    if (includeSettings && profile.settings) {
      settingsStore.setSkyEngine(profile.settings.skyEngine);
      settingsStore.setStellariumSettings(profile.settings.stellarium);
      settingsStore.setAladinDisplaySettings(profile.settings.aladinDisplay);
      useLocaleStore.getState().setLocale(profile.settings.preferences.locale);
    }
  } catch (error) {
    if (draftOrder.length > 0) {
      await applySettingsTransaction(draftSnapshot, { domainOrder: draftOrder });
    }
    settingsStore.setSkyEngine(extrasSnapshot.skyEngine);
    settingsStore.setStellariumSettings(extrasSnapshot.stellarium);
    settingsStore.setAladinDisplaySettings(extrasSnapshot.aladinDisplay);
    throw error;
  }
}

function applyThemeDomain(profile: SettingsProfileData, options: ApplySettingsProfileOptions): void {
  if (profile.themeMode && options.applyThemeMode) {
    options.applyThemeMode(profile.themeMode);
  }
  if (profile.theme) {
    const { userPresets, ...customization } = profile.theme;
    const themeStore = useThemeStore.getState();
    themeStore.replaceUserPresets(userPresets ?? []);
    themeStore.setCustomization(customization);
  }
}

function applyKeybindingsDomain(profile: SettingsProfileData): void {
  if (!profile.keybindings) {
    return;
  }

  const store = useKeybindingStore.getState();
  store.resetAllBindings();
  for (const [actionId, binding] of Object.entries(profile.keybindings)) {
    store.setBinding(actionId as never, binding);
  }
}

function applyGlobalShortcutsDomain(profile: SettingsProfileData): void {
  if (!profile.globalShortcuts) {
    return;
  }

  const store = useGlobalShortcutStore.getState();
  store.resetAllBindings();
  store.setEnabled(Boolean(profile.globalShortcuts.enabled));
  for (const [actionId, accelerator] of Object.entries(profile.globalShortcuts.customBindings ?? {})) {
    if (typeof accelerator !== 'string') {
      continue;
    }
    store.setBinding(actionId as never, accelerator);
  }
}

function applyEquipmentDomain(profile: SettingsProfileData): void {
  const equipment = profile.equipment;
  if (!equipment) {
    return;
  }

  const store = useEquipmentStore.getState();
  store.setSensorWidth(equipment.sensorWidth);
  store.setSensorHeight(equipment.sensorHeight);
  store.setFocalLength(equipment.focalLength);
  store.setPixelSize(equipment.pixelSize);
  store.setAperture(equipment.aperture);
  store.setRotationAngle(equipment.rotationAngle);
  store.setMosaic(equipment.mosaic);
  store.setFOVDisplay(equipment.fovDisplay);
  store.setOcularDisplay(equipment.ocularDisplay);
  store.setExposureDefaults(equipment.exposureDefaults);

  for (const camera of store.customCameras) store.removeCustomCamera(camera.id);
  for (const camera of equipment.customCameras) {
    store.addCustomCamera({
      name: camera.name,
      sensorWidth: camera.sensorWidth,
      sensorHeight: camera.sensorHeight,
      pixelSize: camera.pixelSize,
    });
  }

  for (const telescope of store.customTelescopes) store.removeCustomTelescope(telescope.id);
  for (const telescope of equipment.customTelescopes) {
    store.addCustomTelescope({
      name: telescope.name,
      focalLength: telescope.focalLength,
      aperture: telescope.aperture,
      type: telescope.type,
    });
  }

  for (const eyepiece of store.customEyepieces) store.removeCustomEyepiece(eyepiece.id);
  for (const eyepiece of equipment.customEyepieces) {
    store.addCustomEyepiece({
      name: eyepiece.name,
      focalLength: eyepiece.focalLength,
      afov: eyepiece.afov,
      fieldStop: eyepiece.fieldStop,
    });
  }

  for (const barlow of store.customBarlows) store.removeCustomBarlow(barlow.id);
  for (const barlow of equipment.customBarlows) {
    store.addCustomBarlow({
      name: barlow.name,
      magnification: barlow.magnification,
    });
  }

  for (const telescope of store.customOcularTelescopes) store.removeCustomOcularTelescope(telescope.id);
  for (const telescope of equipment.customOcularTelescopes) {
    store.addCustomOcularTelescope({
      name: telescope.name,
      focalLength: telescope.focalLength,
      aperture: telescope.aperture,
      type: telescope.type,
    });
  }

  const latestState = useEquipmentStore.getState();
  const availableTelescopeIds = new Set([
    ...OCULAR_TELESCOPE_PRESETS.map((item) => item.id),
    ...latestState.customOcularTelescopes.map((item) => item.id),
  ]);
  const availableEyepieceIds = new Set([
    ...EYEPIECE_PRESETS.map((item) => item.id),
    ...latestState.customEyepieces.map((item) => item.id),
  ]);
  const availableBarlowIds = new Set([
    ...BARLOW_PRESETS.map((item) => item.id),
    ...latestState.customBarlows.map((item) => item.id),
  ]);

  latestState.setSelectedOcularTelescopeId(
    availableTelescopeIds.has(equipment.selectedOcularTelescopeId)
      ? equipment.selectedOcularTelescopeId
      : OCULAR_TELESCOPE_PRESETS[0]?.id,
  );
  latestState.setSelectedEyepieceId(
    availableEyepieceIds.has(equipment.selectedEyepieceId)
      ? equipment.selectedEyepieceId
      : EYEPIECE_PRESETS[0]?.id,
  );
  latestState.setSelectedBarlowId(
    availableBarlowIds.has(equipment.selectedBarlowId)
      ? equipment.selectedBarlowId
      : BARLOW_PRESETS[0]?.id,
  );
}

function applyEventSourcesDomain(profile: SettingsProfileData): void {
  if (!profile.eventSources) {
    return;
  }

  const store = useEventSourcesStore.getState();
  store.resetToDefaults();
  for (const source of sanitizeImportedEventSources(profile.eventSources)) {
    store.updateSource(source.id, source);
  }
}

function applyDailyKnowledgeDomain(profile: SettingsProfileData): void {
  if (!profile.dailyKnowledge) {
    return;
  }

  useDailyKnowledgeStore.getState().hydrateFromImport({
    favorites: profile.dailyKnowledge.favorites ?? [],
    history: profile.dailyKnowledge.history ?? [],
    lastShownDate: profile.dailyKnowledge.startupState?.lastShownDate ?? null,
    snoozedDate: profile.dailyKnowledge.startupState?.snoozedDate ?? null,
    lastSeenItemId: profile.dailyKnowledge.startupState?.lastSeenItemId ?? null,
  });
}

const defaultDomainAppliers: Record<Exclude<SettingsProfileDomain, 'settings' | 'location'>, DomainApplier> = {
  theme: applyThemeDomain,
  keybindings: applyKeybindingsDomain,
  globalShortcuts: applyGlobalShortcutsDomain,
  equipment: applyEquipmentDomain,
  eventSources: applyEventSourcesDomain,
  dailyKnowledge: applyDailyKnowledgeDomain,
};

async function applyDomains(
  profile: SettingsProfileData,
  options: ApplySettingsProfileOptions,
  appliers: Partial<Record<SettingsProfileDomain, DomainApplier>> = {},
): Promise<SettingsProfileDomain[]> {
  const domains = normalizeDomains(profile, options.domains);
  const appliedDomains: SettingsProfileDomain[] = [];
  let settingsGroupApplied = false;

  for (const domain of domains) {
    if ((domain === 'settings' || domain === 'location') && !settingsGroupApplied) {
      try {
        await applySettingsAndLocationDomains(profile, domains);
      } catch (error) {
        throw withDomainError(error, domains.includes('settings') ? 'settings' : 'location');
      }
      if (domains.includes('settings')) appliedDomains.push('settings');
      if (domains.includes('location')) appliedDomains.push('location');
      settingsGroupApplied = true;
      continue;
    }

    if (domain === 'settings' || domain === 'location') {
      continue;
    }

    const applier = appliers[domain] ?? defaultDomainAppliers[domain];
    try {
      await applier(profile, options);
    } catch (error) {
      throw withDomainError(error, domain);
    }
    appliedDomains.push(domain);
  }

  return appliedDomains;
}

export async function applySettingsProfileImport(
  profile: SettingsProfileData,
  options: ApplySettingsProfileOptions = {},
): Promise<ApplySettingsProfileResult> {
  const domains = normalizeDomains(profile, options.domains);
  const restorePointProfile = buildSettingsProfile({
    domains,
    themeMode: options.currentThemeMode,
    includeSensitiveFields: true,
  });
  const restorePoint: SettingsImportRestorePoint = {
    createdAt: new Date().toISOString(),
    domains,
    profile: restorePointProfile,
  };

  try {
    const appliedDomains = await applyDomains(profile, options, options.domainAppliers);
    if (options.persistRestorePoint !== false) {
      useSettingsImportRestoreStore.getState().setRestorePoint(restorePoint);
    }
    return {
      success: true,
      appliedDomains,
      restorePoint,
    };
  } catch (error) {
    try {
      await applyDomains(restorePointProfile, {
        domains,
        applyThemeMode: options.applyThemeMode,
        currentThemeMode: restorePoint.profile.themeMode,
        persistRestorePoint: false,
      });
    } catch {
      // Best effort rollback; preserve original failure.
    }
    return {
      success: false,
      appliedDomains: [],
      failedDomain: (error as { settingsProfileDomain?: SettingsProfileDomain }).settingsProfileDomain ?? domains[0],
      error: toErrorMessage(error),
    };
  }
}

export async function restoreLastSettingsImport(
  options: Pick<ApplySettingsProfileOptions, 'applyThemeMode'> = {},
): Promise<ApplySettingsProfileResult> {
  const restorePoint = useSettingsImportRestoreStore.getState().restorePoint;
  if (!restorePoint) {
    return {
      success: false,
      appliedDomains: [],
      error: 'No restore point available',
    };
  }

  return applySettingsProfileImport(restorePoint.profile, {
    domains: restorePoint.domains,
    applyThemeMode: options.applyThemeMode,
    currentThemeMode: restorePoint.profile.themeMode,
    persistRestorePoint: false,
  });
}
