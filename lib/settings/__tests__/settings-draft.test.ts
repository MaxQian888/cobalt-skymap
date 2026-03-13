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

import { useMountStore } from '@/lib/stores/mount-store';
import {
  DEFAULT_ACCESSIBILITY,
  DEFAULT_BACKEND_PROTOCOL,
  DEFAULT_CONNECTION,
  DEFAULT_NOTIFICATIONS,
  DEFAULT_PERFORMANCE,
  DEFAULT_PREFERENCES,
  DEFAULT_SEARCH,
  useSettingsStore,
} from '@/lib/stores/settings-store';
import {
  DEFAULT_SETTINGS_LOCATION,
  cloneSettingsDraft,
  computeDirtyFieldPaths,
  createDefaultSettingsDraft,
  createSettingsDraftSnapshot,
  deriveDirtyCategories,
  resetDraftCategory,
} from '../settings-draft';

describe('settings-draft', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      connection: { ip: '10.10.0.5', port: '7624' },
      backendProtocol: 'https',
      preferences: {
        ...DEFAULT_PREFERENCES,
        locale: 'zh',
        showSplash: false,
      },
      performance: {
        ...DEFAULT_PERFORMANCE,
        maxStarsRendered: 64000,
      },
      accessibility: {
        ...DEFAULT_ACCESSIBILITY,
        highContrast: true,
      },
      notifications: {
        ...DEFAULT_NOTIFICATIONS,
        enableToasts: false,
      },
      search: {
        ...DEFAULT_SEARCH,
        maxHistoryItems: 42,
      },
    });

    useMountStore.setState({
      profileInfo: {
        AstrometrySettings: {
          Latitude: 31.23,
          Longitude: 121.47,
          Elevation: 18,
        },
      },
    });
  });

  it('creates a default draft with cloned default values', () => {
    const draft = createDefaultSettingsDraft();

    expect(draft.connection).toEqual(DEFAULT_CONNECTION);
    expect(draft.backendProtocol).toBe(DEFAULT_BACKEND_PROTOCOL);
    expect(draft.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(draft.location).toEqual(DEFAULT_SETTINGS_LOCATION);

    draft.connection.ip = 'changed';
    draft.preferences.locale = 'zh';
    draft.location.latitude = 40;

    expect(DEFAULT_CONNECTION.ip).toBe('localhost');
    expect(DEFAULT_PREFERENCES.locale).toBe('en');
    expect(DEFAULT_SETTINGS_LOCATION.latitude).toBe(0);
  });

  it('captures the current settings and mount snapshot', () => {
    const snapshot = createSettingsDraftSnapshot();

    expect(snapshot.connection).toEqual({ ip: '10.10.0.5', port: '7624' });
    expect(snapshot.backendProtocol).toBe('https');
    expect(snapshot.preferences.locale).toBe('zh');
    expect(snapshot.performance.maxStarsRendered).toBe(64000);
    expect(snapshot.accessibility.highContrast).toBe(true);
    expect(snapshot.notifications.enableToasts).toBe(false);
    expect(snapshot.search.maxHistoryItems).toBe(42);
    expect(snapshot.location).toEqual({
      latitude: 31.23,
      longitude: 121.47,
      elevation: 18,
    });
  });

  it('falls back to the default location when mount astrometry settings are missing', () => {
    useMountStore.setState({
      profileInfo: {} as never,
    });

    const snapshot = createSettingsDraftSnapshot();

    expect(snapshot.location).toEqual(DEFAULT_SETTINGS_LOCATION);
  });

  it('clones drafts without sharing nested references', () => {
    const original = createSettingsDraftSnapshot();
    const clone = cloneSettingsDraft(original);

    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
    expect(clone.connection).not.toBe(original.connection);
    expect(clone.preferences).not.toBe(original.preferences);
    expect(clone.location).not.toBe(original.location);

    clone.connection.port = '9000';
    clone.preferences.locale = 'en';
    clone.location.longitude = 10;

    expect(original.connection.port).toBe('7624');
    expect(original.preferences.locale).toBe('zh');
    expect(original.location.longitude).toBe(121.47);
  });

  it('computes dirty field paths and derives ordered categories', () => {
    const baseline = createDefaultSettingsDraft();
    const draft = cloneSettingsDraft(baseline);

    draft.connection.port = '9000';
    draft.backendProtocol = 'https';
    draft.preferences.locale = 'zh';
    draft.search.maxHistoryItems = 40;
    draft.location.latitude = 45;

    const dirtyPaths = computeDirtyFieldPaths(baseline, draft);

    expect(dirtyPaths).toEqual([
      'connection.port',
      'backendProtocol',
      'preferences.locale',
      'search.maxHistoryItems',
      'location.latitude',
    ]);
    expect(deriveDirtyCategories(dirtyPaths)).toEqual([
      'connection',
      'preferences',
      'search',
      'location',
    ]);
  });

  it('resets one category while leaving other edits untouched', () => {
    const defaults = createDefaultSettingsDraft();
    defaults.connection = { ip: 'reset-host', port: '3040' };
    defaults.backendProtocol = 'https';
    defaults.location = { latitude: 10, longitude: 20, elevation: 30 };

    const draft = createSettingsDraftSnapshot();
    draft.connection = { ip: '192.168.0.2', port: '5000' };
    draft.backendProtocol = 'http';
    draft.preferences.locale = 'en';
    draft.location = { latitude: 80, longitude: 90, elevation: 100 };

    const connectionReset = resetDraftCategory(draft, 'connection', defaults);
    const locationReset = resetDraftCategory(draft, 'location', defaults);
    const unknownReset = resetDraftCategory(
      draft,
      'unknown' as unknown as Parameters<typeof resetDraftCategory>[1],
      defaults,
    );

    expect(connectionReset.connection).toEqual({ ip: 'reset-host', port: '3040' });
    expect(connectionReset.backendProtocol).toBe('https');
    expect(connectionReset.preferences.locale).toBe('en');

    expect(locationReset.location).toEqual({ latitude: 10, longitude: 20, elevation: 30 });
    expect(locationReset.connection).toEqual({ ip: '192.168.0.2', port: '5000' });

    expect(unknownReset).toBe(draft);
  });
});
