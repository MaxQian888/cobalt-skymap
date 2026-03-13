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

const settingsStoreState = {
  connection: { ip: 'localhost', port: '1888' },
  backendProtocol: 'http',
  skyEngine: 'stellarium',
  stellarium: { nightMode: false, atmosphere: true },
  preferences: {
    locale: 'en',
    timeFormat: '24h',
    dateFormat: 'iso',
    coordinateFormat: 'dms',
    distanceUnit: 'metric',
    temperatureUnit: 'celsius',
    skipCloseConfirmation: false,
    rightPanelCollapsed: false,
    startupView: 'last',
    launchOnStartup: false,
    showSplash: true,
    autoConnectBackend: true,
    dailyKnowledgeEnabled: true,
    dailyKnowledgeAutoShow: true,
    dailyKnowledgeOnlineEnhancement: true,
  },
  performance: {
    renderQuality: 'high',
    enableAnimations: true,
    reducedMotion: false,
    maxStarsRendered: 50000,
    enableAntialiasing: true,
    showFPS: false,
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    screenReaderOptimized: false,
    reduceTransparency: false,
    focusIndicators: true,
  },
  notifications: {
    enableSounds: false,
    enableToasts: true,
    toastDuration: 4000,
    showObjectAlerts: true,
    showSatelliteAlerts: true,
  },
  search: {
    autoSearchDelay: 300,
    enableFuzzySearch: true,
    maxSearchResults: 50,
    includeMinorObjects: false,
    rememberSearchHistory: true,
    maxHistoryItems: 20,
  },
  aladinDisplay: {
    showGrid: false,
  },
};

const themeStoreState = {
  customization: {
    radius: 0.5,
    fontFamily: 'default',
    fontSize: 'default',
    animationsEnabled: true,
    activePreset: null,
    customColors: {
      light: { primary: '#223344' },
      dark: { primary: '#ddeeff' },
    },
  },
  userPresets: [
    {
      id: 'custom-night',
      name: 'Night Watch',
      colors: {
        light: { primary: '#112233' },
        dark: { primary: '#445566' },
      },
    },
  ],
};

const keybindingStoreState = {
  customBindings: {
    centerView: { key: 'KeyC', ctrlKey: true },
  },
};

const globalShortcutStoreState = {
  enabled: true,
  customBindings: {
    openSettings: 'CommandOrControl+Shift+S',
  },
};

const equipmentStoreState = {
  sensorWidth: 23.5,
  sensorHeight: 15.6,
  focalLength: 420,
  pixelSize: 3.76,
  aperture: 72,
  rotationAngle: 90,
  mosaic: { enabled: false, rows: 1, cols: 1, overlap: 10, overlapUnit: 'percent' },
  fovDisplay: { showGrid: true },
  ocularDisplay: { enabled: false, opacity: 70, showCrosshair: true, appliedFov: null },
  exposureDefaults: { exposureTime: 60 },
  customCameras: [{ id: 'cam-1', name: 'Player One' }],
  customTelescopes: [{ id: 'scope-1', name: 'Refractor' }],
  customEyepieces: [{ id: 'eye-1', name: '25mm' }],
  customBarlows: [{ id: 'barlow-1', name: '2x' }],
  customOcularTelescopes: [{ id: 'ocular-1', name: 'Dob' }],
  selectedOcularTelescopeId: 'ocular-1',
  selectedEyepieceId: 'eye-1',
  selectedBarlowId: 'barlow-1',
};

const mountStoreState = {
  profileInfo: {
    AstrometrySettings: {
      Latitude: 31.23,
      Longitude: 121.47,
      Elevation: 18,
    },
  },
};

const eventSourcesStoreState = {
  sources: [
    {
      id: 'astronomyapi',
      name: 'Astronomy API',
      apiUrl: 'https://api.astronomyapi.com/api/v2',
      apiKey: 'secret-key',
      hasStoredSecret: true,
      enabled: true,
      priority: 1,
      cacheMinutes: 60,
    },
  ],
};

const dailyKnowledgeStoreState = {
  favorites: [{ itemId: 'fav-1', createdAt: 1 }],
  history: [{ itemId: 'hist-1', entry: 'manual', dateKey: '2026-02-03', shownAt: 2 }],
  lastShownDate: '2026-02-03',
  snoozedDate: null,
  lastSeenItemId: 'fav-1',
};

const mockIsTauri = jest.fn<boolean, []>(() => true);
const mockIsValidThemeColorValue = jest.fn((value: string) => value.startsWith('#'));
const mockSanitizeThemePresets = jest.fn((input: unknown) => {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter((item) => (
    !!item
    && typeof item === 'object'
    && typeof (item as { id?: unknown }).id === 'string'
    && typeof (item as { name?: unknown }).name === 'string'
  ));
});

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
  isValidThemeColorValue: (value: string) => mockIsValidThemeColorValue(value),
  sanitizeThemePresets: (input: unknown) => mockSanitizeThemePresets(input),
}));

jest.mock('@/lib/stores/keybinding-store', () => ({
  useKeybindingStore: { getState: () => keybindingStoreState },
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('../settings-draft', () => {
  const actual = jest.requireActual('../settings-draft');
  return {
    ...actual,
    createSettingsDraftSnapshot: () => actual.createDefaultSettingsDraft(),
  };
});

import {
  SETTINGS_PROFILE_SCHEMA_VERSION,
  buildSettingsProfile,
  parseSettingsProfile,
  sanitizeImportedEventSources,
} from '../settings-profile';

describe('settings-profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingsStoreState.connection = { ip: 'localhost', port: '1888' };
    settingsStoreState.backendProtocol = 'http';
    settingsStoreState.preferences.locale = 'en';
    settingsStoreState.search.maxSearchResults = 50;
    themeStoreState.customization = {
      radius: 0.5,
      fontFamily: 'default',
      fontSize: 'default',
      animationsEnabled: true,
      activePreset: null,
      customColors: {
        light: { primary: '#223344' },
        dark: { primary: '#ddeeff' },
      },
    };
    themeStoreState.userPresets = [
      {
        id: 'custom-night',
        name: 'Night Watch',
        colors: {
          light: { primary: '#112233' },
          dark: { primary: '#445566' },
        },
      },
    ];
    mountStoreState.profileInfo = {
      AstrometrySettings: {
        Latitude: 31.23,
        Longitude: 121.47,
        Elevation: 18,
      },
    };
    eventSourcesStoreState.sources = [
      {
        id: 'astronomyapi',
        name: 'Astronomy API',
        apiUrl: 'https://api.astronomyapi.com/api/v2',
        apiKey: 'secret-key',
        hasStoredSecret: true,
        enabled: true,
        priority: 1,
        cacheMinutes: 60,
      },
    ];
    dailyKnowledgeStoreState.favorites = [{ itemId: 'fav-1', createdAt: 1 }];
    dailyKnowledgeStoreState.history = [{ itemId: 'hist-1', entry: 'manual', dateKey: '2026-02-03', shownAt: 2 }];
    dailyKnowledgeStoreState.lastShownDate = '2026-02-03';
    dailyKnowledgeStoreState.snoozedDate = null;
    dailyKnowledgeStoreState.lastSeenItemId = 'fav-1';
    mockIsTauri.mockReturnValue(true);
    mockIsValidThemeColorValue.mockImplementation((value: string) => value.startsWith('#'));
    mockSanitizeThemePresets.mockImplementation((input: unknown) => {
      if (!Array.isArray(input)) {
        return [];
      }
      return input.filter((item) => (
        !!item
        && typeof item === 'object'
        && typeof (item as { id?: unknown }).id === 'string'
        && typeof (item as { name?: unknown }).name === 'string'
      ));
    });
  });

  it('builds a profile with canonical domains and stripped event-source secrets by default', () => {
    const profile = buildSettingsProfile({
      domains: ['theme', 'settings', 'eventSources', 'settings', 'dailyKnowledge'],
      exportedAt: '2026-02-03T10:00:00.000Z',
      themeMode: 'dark',
    });

    expect(profile.version).toBe(SETTINGS_PROFILE_SCHEMA_VERSION);
    expect(profile.exportedAt).toBe('2026-02-03T10:00:00.000Z');
    expect(profile.metadata).toEqual({
      schemaVersion: SETTINGS_PROFILE_SCHEMA_VERSION,
      domains: ['settings', 'theme', 'eventSources', 'dailyKnowledge'],
    });
    expect(profile.settings?.connection).toEqual({ ip: 'localhost', port: '1888' });
    expect(profile.themeMode).toBe('dark');
    expect(profile.theme?.userPresets).toEqual(themeStoreState.userPresets);
    expect(profile.eventSources?.[0]).toEqual(expect.objectContaining({
      apiKey: '',
      hasStoredSecret: true,
    }));
    expect(profile.dailyKnowledge).toEqual({
      favorites: dailyKnowledgeStoreState.favorites,
      history: dailyKnowledgeStoreState.history,
      startupState: {
        lastShownDate: '2026-02-03',
        snoozedDate: null,
        lastSeenItemId: 'fav-1',
      },
    });
    expect(profile.equipment).toBeUndefined();
  });

  it('keeps sensitive event-source fields only when requested', () => {
    const profile = buildSettingsProfile({
      domains: ['location', 'eventSources'],
      exportedAt: '2026-02-03T10:00:00.000Z',
      includeSensitiveFields: true,
    });

    expect(profile.metadata?.domains).toEqual(['location', 'eventSources']);
    expect(profile.location).toEqual({
      latitude: 31.23,
      longitude: 121.47,
      elevation: 18,
    });
    expect(profile.eventSources?.[0]).toEqual(expect.objectContaining({
      apiKey: 'secret-key',
      hasStoredSecret: true,
    }));
  });

  it('parses a profile, drops invalid settings and location domains, and reports warnings', () => {
    const result = parseSettingsProfile({
      version: 6,
      exportedAt: '',
      metadata: {
        schemaVersion: 4,
        domains: ['settings', 'theme', 'location', 'eventSources', 'unknown'],
      },
      themeMode: 'dark',
      settings: {
        connection: { ip: '', port: '70000' },
        backendProtocol: 'ftp',
        preferences: { locale: 'jp' },
        performance: { maxStarsRendered: 200000 },
        notifications: { toastDuration: 100 },
        search: { maxHistoryItems: 500 },
      },
      theme: {
        radius: 0.8,
        customColors: {
          light: { primary: '#112233' },
        },
        userPresets: [
          {
            id: 'custom-aurora',
            name: 'Aurora',
            colors: {
              light: { primary: '#112233' },
              dark: { primary: '#445566' },
            },
          },
        ],
      },
      location: {
        latitude: 999,
        longitude: 121.47,
        elevation: 18,
      },
      eventSources: [
        {
          id: 'astronomyapi',
          apiKey: '',
          hasStoredSecret: true,
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.importableDomains).toEqual(['theme', 'eventSources']);
    expect(result.skippedDomains).toEqual(expect.arrayContaining([
      { domain: 'settings', reason: 'invalidDomainPayload' },
      { domain: 'location', reason: 'invalidDomainPayload' },
    ]));
    expect(result.warnings).toEqual([
      { domain: 'eventSources', code: 'secretsNotIncluded' },
    ]);

    if (!result.ok) {
      throw new Error('expected parsed profile to be importable');
    }

    expect(result.data?.exportedAt).toBe(new Date(0).toISOString());
    expect(result.data?.metadata).toEqual({
      schemaVersion: 4,
      domains: ['theme', 'eventSources'],
    });
    expect(result.data?.themeMode).toBe('dark');
    expect(result.data?.theme).toEqual({
      radius: 0.8,
      customColors: {
        light: { primary: '#112233' },
      },
      userPresets: [
        {
          id: 'custom-aurora',
          name: 'Aurora',
          colors: {
            light: { primary: '#112233' },
            dark: { primary: '#445566' },
          },
        },
      ],
    });
    expect(result.data?.settings).toBeUndefined();
    expect(result.data?.location).toBeUndefined();
  });

  it('treats invalid theme payloads as skipped and returns no-importable-domains when nothing survives', () => {
    mockIsValidThemeColorValue.mockReturnValue(false);

    const result = parseSettingsProfile({
      version: 6,
      exportedAt: '2026-02-03T10:00:00.000Z',
      theme: {
        customColors: {
          light: { primary: 'not-a-color' },
        },
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('noImportableDomains');
    expect(result.skippedDomains).toEqual([
      { domain: 'theme', reason: 'invalidDomainPayload' },
    ]);
  });

  it('rejects unsupported profile versions', () => {
    const result = parseSettingsProfile({
      version: 2,
      exportedAt: '2026-02-03T10:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('unsupportedVersion');
    expect(result.importableDomains).toEqual([]);
  });

  it('sanitizes imported event-source secrets based on the active platform', () => {
    mockIsTauri.mockReturnValue(false);

    const webSources = sanitizeImportedEventSources([
      {
        id: 'astronomyapi',
        apiKey: 'secret-key',
        hasStoredSecret: true,
      } as never,
    ]);

    mockIsTauri.mockReturnValue(true);

    const tauriSources = sanitizeImportedEventSources([
      {
        id: 'astronomyapi',
        apiKey: 'secret-key',
        hasStoredSecret: false,
      } as never,
    ]);

    expect(webSources).toEqual([
      expect.objectContaining({
        id: 'astronomyapi',
        apiKey: '',
        hasStoredSecret: false,
      }),
    ]);
    expect(tauriSources).toEqual([
      expect.objectContaining({
        id: 'astronomyapi',
        apiKey: 'secret-key',
        hasStoredSecret: true,
      }),
    ]);
  });
});
