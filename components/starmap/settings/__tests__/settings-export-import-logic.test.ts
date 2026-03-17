/**
 * @jest-environment jsdom
 */

const mockSetLocale = jest.fn();

const settingsStoreState = {
  connection: { ip: '127.0.0.1', port: '1888' },
  backendProtocol: 'https',
  skyEngine: 'aladin',
  stellarium: { nightMode: true },
  preferences: { locale: 'en', launchOnStartup: false },
  performance: { reducedMotion: true },
  accessibility: { highContrast: false },
  notifications: { enableToasts: true },
  search: { maxSearchResults: 20 },
  aladinDisplay: { showGrid: true },
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
  customCameras: [],
  customTelescopes: [],
  customEyepieces: [],
  customBarlows: [],
  customOcularTelescopes: [],
  selectedOcularTelescopeId: 't1',
  selectedEyepieceId: 'e1',
  selectedBarlowId: 'b0',
};

const mountStoreState = {
  profileInfo: { AstrometrySettings: { Latitude: 1, Longitude: 2, Elevation: 3 } },
};

const eventSourcesStoreState = {
  sources: [
    {
      id: 'astronomyapi',
      name: 'Astronomy API',
      apiUrl: 'https://api.astronomyapi.com/api/v2',
      apiKey: 'secret',
      hasStoredSecret: true,
      enabled: true,
      priority: 1,
      cacheMinutes: 60,
    },
  ],
};

const dailyKnowledgeStoreState = {
  favorites: [{ itemId: 'fav-1', createdAt: 1 }],
  history: [{ itemId: 'fav-1', entry: 'manual', dateKey: '2026-01-01', shownAt: 1 }],
  lastShownDate: '2026-01-01',
  snoozedDate: null,
  lastSeenItemId: 'fav-1',
};

const themeStoreState = {
  customization: {
    radius: 0.5,
    fontFamily: 'default',
    fontSize: 'default',
    animationsEnabled: true,
    activePreset: null,
    customColors: { light: {}, dark: {} },
  },
  userPresets: [
    {
      id: 'custom-night',
      name: 'Custom Night',
      colors: {
        light: { primary: '#123456', background: '#fafafa' },
        dark: { primary: '#abcdef', background: '#050505' },
      },
    },
  ],
};

const keybindingStoreState = {
  customBindings: {
    TOGGLE_GRID: { key: 'g' },
  },
};

const globalShortcutStoreState = {
  enabled: true,
  customBindings: {
    TOGGLE_SEARCH: 'Control+Shift+K',
  },
};

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
  defaultComponentStyle: {
    preset: 'default',
    density: 'comfortable',
    transparency: 'balanced',
    border: 'medium',
    elevation: 'raised',
  },
  sanitizeThemePresets: (value: unknown) => value,
  sanitizeThemeComponentStyle: (value: unknown, fallback: unknown) => value ?? fallback,
  isValidThemeColorValue: () => true,
}));

jest.mock('@/lib/stores/keybinding-store', () => ({
  useKeybindingStore: { getState: () => keybindingStoreState },
}));

jest.mock('@/lib/i18n/locale-store', () => ({
  useLocaleStore: { getState: () => ({ setLocale: mockSetLocale }) },
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
  isServer: jest.fn(() => false),
}));

import {
  buildSettingsProfile,
  parseSettingsProfile,
  SETTINGS_PROFILE_SCHEMA_VERSION,
} from '@/lib/settings/settings-profile';

describe('settings-profile', () => {
  it('builds a scoped export payload with metadata and sanitized event source secrets', () => {
    const data = buildSettingsProfile({
      domains: ['theme', 'eventSources', 'dailyKnowledge'],
      themeMode: 'dark',
    });

    expect(data).toEqual(expect.objectContaining({
      version: SETTINGS_PROFILE_SCHEMA_VERSION,
      themeMode: 'dark',
      metadata: {
        schemaVersion: SETTINGS_PROFILE_SCHEMA_VERSION,
        domains: ['theme', 'eventSources', 'dailyKnowledge'],
      },
      theme: expect.any(Object),
      dailyKnowledge: expect.any(Object),
    }));
    expect(data.settings).toBeUndefined();
    expect(data.eventSources).toEqual([
      expect.objectContaining({
        id: 'astronomyapi',
        apiKey: '',
        hasStoredSecret: true,
      }),
    ]);
  });

  it('reports skipped domains and warnings separately when parsing imports', () => {
    const result = parseSettingsProfile({
      version: SETTINGS_PROFILE_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: {
        schemaVersion: SETTINGS_PROFILE_SCHEMA_VERSION,
        domains: ['theme', 'equipment', 'eventSources'],
      },
      themeMode: 'light',
      theme: {
        radius: 0.6,
        fontFamily: 'serif',
        fontSize: 'large',
        animationsEnabled: false,
        activePreset: null,
        customColors: { light: {}, dark: {} },
        userPresets: [
          {
            id: 'portable-theme',
            name: 'Portable Theme',
            colors: {
              light: { primary: '#222222' },
              dark: { primary: '#eeeeee' },
            },
          },
        ],
      },
      equipment: {
        sensorWidth: 'bad-value',
      },
      eventSources: [
        {
          id: 'astronomyapi',
          name: 'Astronomy API',
          apiUrl: 'https://api.astronomyapi.com/api/v2',
          apiKey: '',
          hasStoredSecret: true,
          enabled: true,
          priority: 1,
          cacheMinutes: 60,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.importableDomains).toEqual(['theme', 'eventSources']);
    expect(result.skippedDomains).toEqual([
      expect.objectContaining({
        domain: 'equipment',
        reason: 'invalidDomainPayload',
      }),
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        domain: 'eventSources',
        code: 'secretsNotIncluded',
      }),
    ]);
  });

  it('keeps legacy theme payloads importable when custom preset libraries are absent', () => {
    const result = parseSettingsProfile({
      version: SETTINGS_PROFILE_SCHEMA_VERSION,
      exportedAt: '2026-01-01T00:00:00.000Z',
      metadata: {
        schemaVersion: SETTINGS_PROFILE_SCHEMA_VERSION,
        domains: ['theme'],
      },
      themeMode: 'dark',
      theme: {
        radius: 0.5,
        fontFamily: 'default',
        fontSize: 'default',
        animationsEnabled: true,
        activePreset: null,
        customColors: { light: {}, dark: {} },
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.importableDomains).toEqual(['theme']);
    }
  });

  it('rejects unsupported schema versions before preview', () => {
    const result = parseSettingsProfile({
      version: 999,
      exportedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('unsupportedVersion');
  });
});
