/**
 * @jest-environment jsdom
 */

jest.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
}));

jest.mock('@/lib/storage', () => ({
  getZustandStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

interface MockSettingsDraft {
  connection: typeof settingsStoreState.connection;
  backendProtocol: typeof settingsStoreState.backendProtocol;
  proxy: typeof settingsStoreState.proxy;
  preferences: typeof settingsStoreState.preferences;
  performance: typeof settingsStoreState.performance;
  accessibility: typeof settingsStoreState.accessibility;
  notifications: typeof settingsStoreState.notifications;
  search: typeof settingsStoreState.search;
  location: { latitude: number; longitude: number; elevation: number };
}

type CustomCameraFixture = {
  id?: string;
  name?: string;
  sensorWidth?: number;
  sensorHeight?: number;
  pixelSize?: number;
};

type CustomTelescopeFixture = {
  id?: string;
  name?: string;
  focalLength?: number;
  aperture?: number;
  type?: string;
};

type CustomEyepieceFixture = {
  id?: string;
  name?: string;
  focalLength?: number;
  afov?: number;
  fieldStop?: number;
};

type CustomBarlowFixture = {
  id?: string;
  name?: string;
  magnification?: number;
};

type CustomOcularTelescopeFixture = {
  id?: string;
  name?: string;
  focalLength?: number;
  aperture?: number;
  type?: string;
};

const mockApplySettingsTransaction = jest.fn((draft: MockSettingsDraft, options: { domainOrder?: string[] } = {}) => {
  const domainOrder = options.domainOrder ?? [];
  if (domainOrder.includes('connection')) {
    settingsStoreState.connection = draft.connection;
    settingsStoreState.backendProtocol = draft.backendProtocol;
    settingsStoreState.proxy = draft.proxy;
  }
  if (domainOrder.includes('preferences')) {
    settingsStoreState.preferences = draft.preferences;
  }
  if (domainOrder.includes('performance')) {
    settingsStoreState.performance = draft.performance;
  }
  if (domainOrder.includes('accessibility')) {
    settingsStoreState.accessibility = draft.accessibility;
  }
  if (domainOrder.includes('notifications')) {
    settingsStoreState.notifications = draft.notifications;
  }
  if (domainOrder.includes('search')) {
    settingsStoreState.search = draft.search;
  }
  if (domainOrder.includes('location')) {
    mountStoreState.profileInfo = {
      ...mountStoreState.profileInfo,
      AstrometrySettings: {
        Latitude: draft.location.latitude,
        Longitude: draft.location.longitude,
        Elevation: draft.location.elevation,
      },
    };
  }
  return {
    success: true,
    appliedDomains: domainOrder,
    failedDomains: [],
    rolledBackDomains: [],
  };
});

const settingsStoreState = {
  connection: { ip: 'localhost', port: '1888' },
  backendProtocol: 'http',
  proxy: { mode: 'auto', manualUrl: '', fallbackToDirectOnFailure: true },
  skyEngine: 'stellarium-web-engine',
  stellarium: { nightMode: false },
  preferences: { locale: 'en' },
  performance: { reducedMotion: false },
  accessibility: { highContrast: false },
  notifications: { enableToasts: true },
  search: { maxSearchResults: 20 },
  aladinDisplay: { showGrid: false },
  setConnection: jest.fn(function (value) { settingsStoreState.connection = value; }),
  setBackendProtocol: jest.fn(function (value) { settingsStoreState.backendProtocol = value; }),
  setProxySettings: jest.fn(function (value) { settingsStoreState.proxy = value; }),
  setSkyEngine: jest.fn(function (value) { settingsStoreState.skyEngine = value; }),
  setStellariumSettings: jest.fn(function (value) { settingsStoreState.stellarium = value; }),
  setPreferences: jest.fn(function (value) { settingsStoreState.preferences = value; }),
  setPerformanceSettings: jest.fn(function (value) { settingsStoreState.performance = value; }),
  setAccessibilitySettings: jest.fn(function (value) { settingsStoreState.accessibility = value; }),
  setNotificationSettings: jest.fn(function (value) { settingsStoreState.notifications = value; }),
  setSearchSettings: jest.fn(function (value) { settingsStoreState.search = value; }),
  setAladinDisplaySettings: jest.fn(function (value) { settingsStoreState.aladinDisplay = value; }),
};

const mountStoreState = {
  profileInfo: { AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 } },
  setProfileInfo: jest.fn(function (value) { mountStoreState.profileInfo = value; }),
};

const themeStoreState = {
  customization: {
    radius: 0.5,
    fontFamily: 'default',
    fontSize: 'default',
    animationsEnabled: true,
    activePreset: null,
    componentStyle: {
      preset: 'default',
      density: 'comfortable',
      transparency: 'balanced',
      border: 'medium',
      elevation: 'raised',
    },
    customColors: { light: {}, dark: {} },
  },
  userPresets: [],
  replaceUserPresets: jest.fn(function (value) {
    themeStoreState.userPresets = value;
  }),
  setCustomization: jest.fn(function (value) {
    themeStoreState.customization = { ...themeStoreState.customization, ...value };
  }),
};

const keybindingStoreState = {
  customBindings: {},
  resetAllBindings: jest.fn(function () { keybindingStoreState.customBindings = {}; }),
  setBinding: jest.fn(function (actionId, binding) {
    keybindingStoreState.customBindings = { ...keybindingStoreState.customBindings, [actionId]: binding };
  }),
};

const globalShortcutStoreState = {
  enabled: false,
  customBindings: {},
  resetAllBindings: jest.fn(function () { globalShortcutStoreState.customBindings = {}; }),
  setBinding: jest.fn(function (actionId, binding) {
    globalShortcutStoreState.customBindings = { ...globalShortcutStoreState.customBindings, [actionId]: binding };
  }),
  setEnabled: jest.fn(function (enabled) { globalShortcutStoreState.enabled = enabled; }),
};

const equipmentStoreState = {
  sensorWidth: 10,
  sensorHeight: 8,
  focalLength: 400,
  pixelSize: 3.76,
  aperture: 72,
  rotationAngle: 0,
  mosaic: { enabled: false, rows: 1, cols: 1, overlap: 10, overlapUnit: 'percent' },
  fovDisplay: { showGrid: true },
  ocularDisplay: { enabled: false, opacity: 70, showCrosshair: true, appliedFov: null },
  exposureDefaults: { exposureTime: 60 },
  customCameras: [] as CustomCameraFixture[],
  customTelescopes: [] as CustomTelescopeFixture[],
  customEyepieces: [] as CustomEyepieceFixture[],
  customBarlows: [] as CustomBarlowFixture[],
  customOcularTelescopes: [] as CustomOcularTelescopeFixture[],
  selectedOcularTelescopeId: 't1',
  selectedEyepieceId: 'e1',
  selectedBarlowId: 'b0',
  setSensorWidth: jest.fn(function (value) { equipmentStoreState.sensorWidth = value; }),
  setSensorHeight: jest.fn(function (value) { equipmentStoreState.sensorHeight = value; }),
  setFocalLength: jest.fn(function (value) { equipmentStoreState.focalLength = value; }),
  setPixelSize: jest.fn(function (value) { equipmentStoreState.pixelSize = value; }),
  setAperture: jest.fn(function (value) { equipmentStoreState.aperture = value; }),
  setRotationAngle: jest.fn(function (value) { equipmentStoreState.rotationAngle = value; }),
  setMosaic: jest.fn(function (value) { equipmentStoreState.mosaic = value; }),
  setFOVDisplay: jest.fn(function (value) { equipmentStoreState.fovDisplay = value; }),
  setOcularDisplay: jest.fn(function (value) { equipmentStoreState.ocularDisplay = value; }),
  setExposureDefaults: jest.fn(function (value) { equipmentStoreState.exposureDefaults = value; }),
  removeCustomCamera: jest.fn(),
  addCustomCamera: jest.fn(),
  removeCustomTelescope: jest.fn(),
  addCustomTelescope: jest.fn(),
  removeCustomEyepiece: jest.fn(),
  addCustomEyepiece: jest.fn(),
  removeCustomBarlow: jest.fn(),
  addCustomBarlow: jest.fn(),
  removeCustomOcularTelescope: jest.fn(),
  addCustomOcularTelescope: jest.fn(),
  setSelectedOcularTelescopeId: jest.fn(function (value) { equipmentStoreState.selectedOcularTelescopeId = value; }),
  setSelectedEyepieceId: jest.fn(function (value) { equipmentStoreState.selectedEyepieceId = value; }),
  setSelectedBarlowId: jest.fn(function (value) { equipmentStoreState.selectedBarlowId = value; }),
};

const eventSourcesStoreState = {
  sources: [
    {
      id: 'astronomyapi',
      name: 'Astronomy API',
      apiUrl: 'https://api.astronomyapi.com/api/v2',
      apiKey: 'previous-secret',
      hasStoredSecret: true,
      enabled: true,
      priority: 1,
      cacheMinutes: 60,
    },
  ],
  resetToDefaults: jest.fn(function () {
    eventSourcesStoreState.sources = [];
  }),
  updateSource: jest.fn(function (_id, source) {
    eventSourcesStoreState.sources = [...eventSourcesStoreState.sources.filter((item) => item.id !== source.id), source];
  }),
};

const dailyKnowledgeStoreState = {
  favorites: [{ itemId: 'fav-1', createdAt: 1 }],
  history: [],
  lastShownDate: null,
  snoozedDate: null,
  lastSeenItemId: null,
  hydrateFromImport: jest.fn(function (payload) {
    dailyKnowledgeStoreState.favorites = payload.favorites;
    dailyKnowledgeStoreState.history = payload.history;
    dailyKnowledgeStoreState.lastShownDate = payload.lastShownDate;
    dailyKnowledgeStoreState.snoozedDate = payload.snoozedDate;
    dailyKnowledgeStoreState.lastSeenItemId = payload.lastSeenItemId;
  }),
};

const mockSetLocale = jest.fn();
const mockApplyThemeMode = jest.fn();

jest.mock('@/lib/stores', () => ({
  useSettingsStore: { getState: () => settingsStoreState },
  useEquipmentStore: { getState: () => equipmentStoreState },
  useMountStore: { getState: () => mountStoreState },
  useEventSourcesStore: { getState: () => eventSourcesStoreState },
  useDailyKnowledgeStore: { getState: () => dailyKnowledgeStoreState },
  useGlobalShortcutStore: { getState: () => globalShortcutStoreState },
}));

jest.mock('@/lib/stores/theme-store', () => ({
  useThemeStore: { getState: () => themeStoreState },
}));

jest.mock('@/lib/stores/keybinding-store', () => ({
  useKeybindingStore: { getState: () => keybindingStoreState },
}));

jest.mock('@/lib/i18n/locale-store', () => ({
  useLocaleStore: { getState: () => ({ setLocale: mockSetLocale }) },
}));

jest.mock('@/lib/storage/platform', () => ({
  isServer: jest.fn(() => false),
  isTauri: jest.fn(() => true),
}));

jest.mock('../apply-settings-transaction', () => ({
  applySettingsTransaction: (draft: MockSettingsDraft, options?: { domainOrder?: string[] }) => mockApplySettingsTransaction(draft, options),
}));

import type { SettingsProfileData } from '../settings-profile';
import { useSettingsImportRestoreStore } from '@/lib/stores/settings-import-restore-store';
import { applySettingsProfileImport, restoreLastSettingsImport } from '@/lib/settings/settings-profile-transaction';

describe('settings-profile-transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsImportRestoreStore.getState().clearRestorePoint();
    settingsStoreState.connection = { ip: 'localhost', port: '1888' };
    settingsStoreState.backendProtocol = 'http';
    settingsStoreState.proxy = { mode: 'auto', manualUrl: '', fallbackToDirectOnFailure: true };
    settingsStoreState.skyEngine = 'stellarium-web-engine';
    settingsStoreState.stellarium = { nightMode: false };
    settingsStoreState.preferences = { locale: 'en' };
    settingsStoreState.performance = { reducedMotion: false };
    settingsStoreState.accessibility = { highContrast: false };
    settingsStoreState.notifications = { enableToasts: true };
    settingsStoreState.search = { maxSearchResults: 20 };
    settingsStoreState.aladinDisplay = { showGrid: false };
    mountStoreState.profileInfo = { AstrometrySettings: { Latitude: 0, Longitude: 0, Elevation: 0 } };
    themeStoreState.customization.radius = 0.5;
    themeStoreState.customization.componentStyle = {
      preset: 'default',
      density: 'comfortable',
      transparency: 'balanced',
      border: 'medium',
      elevation: 'raised',
    };
    themeStoreState.userPresets = [];
    keybindingStoreState.customBindings = {};
    globalShortcutStoreState.enabled = false;
    globalShortcutStoreState.customBindings = {};
    equipmentStoreState.customCameras = [];
    equipmentStoreState.customTelescopes = [];
    equipmentStoreState.customEyepieces = [];
    equipmentStoreState.customBarlows = [];
    equipmentStoreState.customOcularTelescopes = [];
    equipmentStoreState.selectedOcularTelescopeId = 't1';
    equipmentStoreState.selectedEyepieceId = 'e1';
    equipmentStoreState.selectedBarlowId = 'b0';
    eventSourcesStoreState.sources = [{
      id: 'astronomyapi',
      name: 'Astronomy API',
      apiUrl: 'https://api.astronomyapi.com/api/v2',
      apiKey: 'previous-secret',
      hasStoredSecret: true,
      enabled: true,
      priority: 1,
      cacheMinutes: 60,
    }];
  });

  it('stores a restore point and applies only selected domains', async () => {
    const result = await applySettingsProfileImport({
      version: 6,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: { schemaVersion: 6, domains: ['settings', 'theme'] },
      settings: {
        connection: { ip: '10.0.0.5', port: '1889' },
        backendProtocol: 'https',
        skyEngine: 'aladin',
        stellarium: { nightMode: true },
        preferences: { locale: 'zh' },
        performance: { reducedMotion: true },
        accessibility: { highContrast: true },
        notifications: { enableToasts: false },
        search: { maxSearchResults: 15 },
        aladinDisplay: { showGrid: true },
      },
      themeMode: 'dark',
      theme: { radius: 0.8 },
    } as unknown as SettingsProfileData, {
      domains: ['theme'],
      applyThemeMode: mockApplyThemeMode,
    });

    expect(result.success).toBe(true);
    expect(settingsStoreState.connection).toEqual({ ip: 'localhost', port: '1888' });
    expect(themeStoreState.customization.radius).toBe(0.8);
    expect(mockApplyThemeMode).toHaveBeenCalledWith('dark');
    expect(useSettingsImportRestoreStore.getState().restorePoint).toEqual(
      expect.objectContaining({
        domains: ['theme'],
      })
    );
  });

  it('rolls back earlier domain changes when a later domain apply fails', async () => {
    const result = await applySettingsProfileImport({
      version: 6,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: { schemaVersion: 6, domains: ['settings', 'theme'] },
      settings: {
        connection: { ip: '10.0.0.5', port: '1889' },
        backendProtocol: 'https',
        skyEngine: 'aladin',
        stellarium: { nightMode: true },
        preferences: { locale: 'zh' },
        performance: { reducedMotion: true },
        accessibility: { highContrast: true },
        notifications: { enableToasts: false },
        search: { maxSearchResults: 15 },
        aladinDisplay: { showGrid: true },
      },
      theme: { radius: 0.8 },
    } as unknown as SettingsProfileData, {
      domains: ['settings', 'theme'],
      domainAppliers: {
        theme: () => {
          throw new Error('boom');
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.failedDomain).toBe('theme');
    expect(settingsStoreState.connection).toEqual({ ip: 'localhost', port: '1888' });
    expect(themeStoreState.customization.radius).toBe(0.5);
    expect(useSettingsImportRestoreStore.getState().restorePoint).toBeNull();
  });

  it('restores the last successful import snapshot', async () => {
    await applySettingsProfileImport({
      version: 6,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: { schemaVersion: 6, domains: ['theme', 'eventSources'] },
      themeMode: 'dark',
      theme: {
        radius: 0.8,
        componentStyle: {
          preset: 'floating',
          density: 'compact',
          transparency: 'high',
          border: 'soft',
          elevation: 'floating',
        },
      },
      eventSources: [{
        id: 'astronomyapi',
        name: 'Astronomy API',
        apiUrl: 'https://api.astronomyapi.com/api/v2',
        apiKey: '',
        hasStoredSecret: false,
        enabled: false,
        priority: 1,
        cacheMinutes: 30,
      }],
    } as unknown as SettingsProfileData, {
      domains: ['theme', 'eventSources'],
      applyThemeMode: mockApplyThemeMode,
    });

    const restoreResult = await restoreLastSettingsImport({
      applyThemeMode: mockApplyThemeMode,
    });

    expect(restoreResult.success).toBe(true);
    expect(themeStoreState.customization.radius).toBe(0.5);
    expect(themeStoreState.customization.componentStyle).toEqual({
      preset: 'default',
      density: 'comfortable',
      transparency: 'balanced',
      border: 'medium',
      elevation: 'raised',
    });
    expect(eventSourcesStoreState.sources[0].apiKey).toBe('previous-secret');
  });

  it('applies imported component style customization as part of the theme domain', async () => {
    const result = await applySettingsProfileImport({
      version: 7,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: { schemaVersion: 7, domains: ['theme'] },
      themeMode: 'dark',
      theme: {
        componentStyle: {
          preset: 'observatory',
          density: 'compact',
          transparency: 'solid',
          border: 'strong',
          elevation: 'flat',
        },
      },
    } as unknown as SettingsProfileData, {
      domains: ['theme'],
      applyThemeMode: mockApplyThemeMode,
    });

    expect(result.success).toBe(true);
    expect(themeStoreState.setCustomization).toHaveBeenCalledWith(expect.objectContaining({
      componentStyle: {
        preset: 'observatory',
        density: 'compact',
        transparency: 'solid',
        border: 'strong',
        elevation: 'flat',
      },
    }));
    expect(themeStoreState.customization.componentStyle).toEqual({
      preset: 'observatory',
      density: 'compact',
      transparency: 'solid',
      border: 'strong',
      elevation: 'flat',
    });
  });

  it('applies keybindings, shortcuts, equipment, event sources, and daily knowledge without persisting a restore point', async () => {
    equipmentStoreState.customCameras = [{ id: 'old-cam' }];
    equipmentStoreState.customTelescopes = [{ id: 'old-scope' }];
    equipmentStoreState.customEyepieces = [{ id: 'old-eye' }];
    equipmentStoreState.customBarlows = [{ id: 'old-barlow' }];
    equipmentStoreState.customOcularTelescopes = [{ id: 'old-ocular' }];

    const result = await applySettingsProfileImport({
      version: 6,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: {
        schemaVersion: 6,
        domains: ['keybindings', 'globalShortcuts', 'equipment', 'eventSources', 'dailyKnowledge'],
      },
      keybindings: {
        centerView: { key: 'KeyZ', altKey: true },
      },
      globalShortcuts: {
        enabled: true,
        customBindings: {
          openSettings: 'CommandOrControl+Shift+S',
          invalid: 123 as never,
        },
      },
      equipment: {
        sensorWidth: 26,
        sensorHeight: 17,
        focalLength: 600,
        pixelSize: 4.2,
        aperture: 102,
        rotationAngle: 45,
        mosaic: { enabled: true, rows: 2, cols: 2, overlap: 15, overlapUnit: 'percent' },
        fovDisplay: { showGrid: false },
        ocularDisplay: { enabled: true, opacity: 80, showCrosshair: false, appliedFov: null },
        exposureDefaults: { exposureTime: 180 },
        customCameras: [{ name: 'Imported Camera', sensorWidth: 13.2, sensorHeight: 8.8, pixelSize: 2.4 }],
        customTelescopes: [{ name: 'Imported Scope', focalLength: 650, aperture: 130, type: 'reflector' }],
        customEyepieces: [{ name: 'Imported Eyepiece', focalLength: 20, afov: 68, fieldStop: 24 }],
        customBarlows: [{ name: 'Imported Barlow', magnification: 2 }],
        customOcularTelescopes: [{ name: 'Imported Ocular Scope', focalLength: 900, aperture: 150, type: 'catadioptric' }],
        selectedOcularTelescopeId: 'missing-telescope',
        selectedEyepieceId: 'missing-eyepiece',
        selectedBarlowId: 'missing-barlow',
      },
      eventSources: [{
        id: 'custom-source',
        name: 'Custom Source',
        apiUrl: 'https://example.com',
        apiKey: '',
        hasStoredSecret: false,
        enabled: true,
        priority: 2,
        cacheMinutes: 30,
      }],
      dailyKnowledge: {
        favorites: [{ itemId: 'fav-2', createdAt: 2 }],
        history: [{ itemId: 'hist-2', entry: 'random', dateKey: '2026-01-02', shownAt: 3 }],
        startupState: {
          lastShownDate: '2026-01-02',
          snoozedDate: '2026-01-03',
          lastSeenItemId: 'hist-2',
        },
      },
    } as unknown as SettingsProfileData, {
      persistRestorePoint: false,
    });

    expect(result.success).toBe(true);
    expect(result.appliedDomains).toEqual([
      'keybindings',
      'globalShortcuts',
      'equipment',
      'eventSources',
      'dailyKnowledge',
    ]);
    expect(useSettingsImportRestoreStore.getState().restorePoint).toBeNull();
    expect(keybindingStoreState.resetAllBindings).toHaveBeenCalledTimes(1);
    expect(keybindingStoreState.setBinding).toHaveBeenCalledWith('centerView', { key: 'KeyZ', altKey: true });
    expect(globalShortcutStoreState.resetAllBindings).toHaveBeenCalledTimes(1);
    expect(globalShortcutStoreState.setEnabled).toHaveBeenCalledWith(true);
    expect(globalShortcutStoreState.setBinding).toHaveBeenCalledTimes(1);
    expect(globalShortcutStoreState.setBinding).toHaveBeenCalledWith(
      'openSettings',
      'CommandOrControl+Shift+S',
    );
    expect(equipmentStoreState.setSensorWidth).toHaveBeenCalledWith(26);
    expect(equipmentStoreState.setSensorHeight).toHaveBeenCalledWith(17);
    expect(equipmentStoreState.setFocalLength).toHaveBeenCalledWith(600);
    expect(equipmentStoreState.setPixelSize).toHaveBeenCalledWith(4.2);
    expect(equipmentStoreState.setAperture).toHaveBeenCalledWith(102);
    expect(equipmentStoreState.setRotationAngle).toHaveBeenCalledWith(45);
    expect(equipmentStoreState.setMosaic).toHaveBeenCalledWith({
      enabled: true,
      rows: 2,
      cols: 2,
      overlap: 15,
      overlapUnit: 'percent',
    });
    expect(equipmentStoreState.setFOVDisplay).toHaveBeenCalledWith({ showGrid: false });
    expect(equipmentStoreState.setOcularDisplay).toHaveBeenCalledWith({
      enabled: true,
      opacity: 80,
      showCrosshair: false,
      appliedFov: null,
    });
    expect(equipmentStoreState.setExposureDefaults).toHaveBeenCalledWith({ exposureTime: 180 });
    expect(equipmentStoreState.removeCustomCamera).toHaveBeenCalledWith('old-cam');
    expect(equipmentStoreState.removeCustomTelescope).toHaveBeenCalledWith('old-scope');
    expect(equipmentStoreState.removeCustomEyepiece).toHaveBeenCalledWith('old-eye');
    expect(equipmentStoreState.removeCustomBarlow).toHaveBeenCalledWith('old-barlow');
    expect(equipmentStoreState.removeCustomOcularTelescope).toHaveBeenCalledWith('old-ocular');
    expect(equipmentStoreState.addCustomCamera).toHaveBeenCalledWith({
      name: 'Imported Camera',
      sensorWidth: 13.2,
      sensorHeight: 8.8,
      pixelSize: 2.4,
    });
    expect(equipmentStoreState.addCustomTelescope).toHaveBeenCalledWith({
      name: 'Imported Scope',
      focalLength: 650,
      aperture: 130,
      type: 'reflector',
    });
    expect(equipmentStoreState.addCustomEyepiece).toHaveBeenCalledWith({
      name: 'Imported Eyepiece',
      focalLength: 20,
      afov: 68,
      fieldStop: 24,
    });
    expect(equipmentStoreState.addCustomBarlow).toHaveBeenCalledWith({
      name: 'Imported Barlow',
      magnification: 2,
    });
    expect(equipmentStoreState.addCustomOcularTelescope).toHaveBeenCalledWith({
      name: 'Imported Ocular Scope',
      focalLength: 900,
      aperture: 150,
      type: 'catadioptric',
    });
    expect(equipmentStoreState.setSelectedOcularTelescopeId).toHaveBeenCalledWith('t1');
    expect(equipmentStoreState.setSelectedEyepieceId).toHaveBeenCalledWith('e1');
    expect(equipmentStoreState.setSelectedBarlowId).toHaveBeenCalledWith('b0');
    expect(eventSourcesStoreState.resetToDefaults).toHaveBeenCalledTimes(1);
    expect(eventSourcesStoreState.updateSource).toHaveBeenCalledWith(
      'custom-source',
      expect.objectContaining({
        id: 'custom-source',
      }),
    );
    expect(dailyKnowledgeStoreState.hydrateFromImport).toHaveBeenCalledWith({
      favorites: [{ itemId: 'fav-2', createdAt: 2 }],
      history: [{ itemId: 'hist-2', entry: 'random', dateKey: '2026-01-02', shownAt: 3 }],
      lastShownDate: '2026-01-02',
      snoozedDate: '2026-01-03',
      lastSeenItemId: 'hist-2',
    });
  });

  it('rolls back applied settings and extras when locale synchronization fails', async () => {
    mockSetLocale.mockImplementationOnce(() => {
      throw new Error('locale failed');
    });

    const result = await applySettingsProfileImport({
      version: 6,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: { schemaVersion: 6, domains: ['settings', 'location'] },
      settings: {
        connection: { ip: '10.0.0.5', port: '1889' },
        backendProtocol: 'https',
        skyEngine: 'aladin',
        stellarium: { nightMode: true },
        preferences: { locale: 'zh' },
        performance: { reducedMotion: true },
        accessibility: { highContrast: true },
        notifications: { enableToasts: false },
        search: { maxSearchResults: 15 },
        aladinDisplay: { showGrid: true },
      },
      location: {
        latitude: 20,
        longitude: 30,
        elevation: 40,
      },
    } as unknown as SettingsProfileData, {
      domains: ['settings', 'location'],
    });

    expect(result.success).toBe(false);
    expect(result.failedDomain).toBe('settings');
    expect(result.error).toBe('locale failed');
    expect(mockApplySettingsTransaction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        connection: { ip: '10.0.0.5', port: '1889' },
        backendProtocol: 'https',
        location: { latitude: 20, longitude: 30, elevation: 40 },
      }),
      { domainOrder: ['connection', 'preferences', 'performance', 'accessibility', 'notifications', 'search', 'location'] },
    );
    expect(mockApplySettingsTransaction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        connection: { ip: 'localhost', port: '1888' },
        backendProtocol: 'http',
        location: { latitude: 0, longitude: 0, elevation: 0 },
      }),
      { domainOrder: ['connection', 'preferences', 'performance', 'accessibility', 'notifications', 'search', 'location'] },
    );
    expect(settingsStoreState.connection).toEqual({ ip: 'localhost', port: '1888' });
    expect(settingsStoreState.skyEngine).toBe('stellarium-web-engine');
    expect(settingsStoreState.stellarium).toEqual({ nightMode: false });
    expect(settingsStoreState.aladinDisplay).toEqual({ showGrid: false });
    expect(mountStoreState.profileInfo.AstrometrySettings).toEqual({
      Latitude: 0,
      Longitude: 0,
      Elevation: 0,
    });
    expect(useSettingsImportRestoreStore.getState().restorePoint).toBeNull();
  });

  it('reports when no restore point is available', async () => {
    useSettingsImportRestoreStore.getState().clearRestorePoint();

    const result = await restoreLastSettingsImport({
      applyThemeMode: mockApplyThemeMode,
    });

    expect(result).toEqual({
      success: false,
      appliedDomains: [],
      error: 'No restore point available',
    });
  });
});
