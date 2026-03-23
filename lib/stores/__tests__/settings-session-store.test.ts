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

import { createDefaultSettingsDraft } from '@/lib/settings/settings-draft';
import { useSettingsSessionStore } from '../settings-session-store';

describe('settings-session-store', () => {
  beforeEach(() => {
    useSettingsSessionStore.getState().clearSession();
  });

  it('starts a session with baseline and draft snapshot', () => {
    const snapshot = createDefaultSettingsDraft();
    useSettingsSessionStore.getState().startSession(snapshot);

    const state = useSettingsSessionStore.getState();
    expect(state.sessionActive).toBe(true);
    expect(state.baseline).toEqual(snapshot);
    expect(state.draft).toEqual(snapshot);
    expect(state.dirtyPaths).toHaveLength(0);
  });

  it('tracks dirty fields from updateDraft', () => {
    const snapshot = createDefaultSettingsDraft();
    useSettingsSessionStore.getState().startSession(snapshot);

    useSettingsSessionStore.getState().setConnection({ ip: '127.0.0.1' });
    useSettingsSessionStore.getState().setProxySettings({ mode: 'manual' });

    const state = useSettingsSessionStore.getState();
    expect(state.dirtyPaths).toContain('connection.ip');
    expect(state.dirtyPaths).toContain('proxy.mode');
    expect(state.dirtyCategories).toContain('connection');
  });

  it('cancels changes back to baseline', () => {
    const snapshot = createDefaultSettingsDraft();
    useSettingsSessionStore.getState().startSession(snapshot);
    useSettingsSessionStore.getState().setSearchSetting('maxSearchResults', 120);
    useSettingsSessionStore.getState().cancelSession();

    const state = useSettingsSessionStore.getState();
    expect(state.draft?.search.maxSearchResults).toBe(snapshot.search.maxSearchResults);
    expect(state.dirtyPaths).toHaveLength(0);
  });

  it('resets one category while preserving others', () => {
    const snapshot = createDefaultSettingsDraft();
    snapshot.preferences.locale = 'zh';
    useSettingsSessionStore.getState().startSession(snapshot);

    useSettingsSessionStore.getState().setPreference('locale', 'en');
    useSettingsSessionStore.getState().setConnection({ ip: '192.168.1.10' });
    useSettingsSessionStore.getState().resetCategoryDraft('connection');

    const state = useSettingsSessionStore.getState();
    expect(state.draft?.connection.ip).toBe('localhost');
    expect(state.draft?.preferences.locale).toBe('en');
  });
});
