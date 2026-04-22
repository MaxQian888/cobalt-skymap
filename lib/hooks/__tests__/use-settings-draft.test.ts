/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';
import {
  useAccessibilityDraftModel,
  useCategoryValidationState,
  useConnectionDraftModel,
  useLocationDraftModel,
  useNotificationDraftModel,
  usePerformanceDraftModel,
  usePreferencesDraftModel,
  useSearchDraftModel,
  useSettingsDraftLifecycle,
  useSettingsDraftStatus,
} from '../use-settings-draft';
import { createDefaultSettingsDraft } from '@/lib/settings/settings-draft';
import { useMountStore } from '@/lib/stores/mount-store';
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
import { useSettingsSessionStore } from '@/lib/stores/settings-session-store';

jest.mock('@/lib/services/observation-location-controller', () => ({
  applyCanonicalObservationLocation: jest.fn(() => new Promise(() => undefined)),
}));

function resetStores() {
  useSettingsSessionStore.getState().clearSession();
  useSettingsStore.setState({
    connection: { ...DEFAULT_CONNECTION },
    backendProtocol: DEFAULT_BACKEND_PROTOCOL,
    proxy: { ...DEFAULT_PROXY },
    preferences: { ...DEFAULT_PREFERENCES },
    performance: { ...DEFAULT_PERFORMANCE },
    accessibility: { ...DEFAULT_ACCESSIBILITY },
    notifications: { ...DEFAULT_NOTIFICATIONS },
    search: { ...DEFAULT_SEARCH },
  });
  useMountStore.setState({
    profileInfo: {
      AstrometrySettings: {
        Latitude: 35.2,
        Longitude: 118.7,
        Elevation: 460,
      },
    },
  });
}

function startSessionWithDraft() {
  const snapshot = createDefaultSettingsDraft();
  snapshot.connection = { ip: '10.0.0.5', port: '6789' };
  snapshot.backendProtocol = 'https';
  snapshot.proxy = {
    mode: 'manual',
    manualUrl: 'http://127.0.0.1:7890',
    fallbackToDirectOnFailure: false,
  };
  snapshot.preferences.locale = 'zh';
  snapshot.performance.renderQuality = 'ultra';
  snapshot.accessibility.highContrast = true;
  snapshot.notifications.enableSounds = true;
  snapshot.search.maxSearchResults = 120;
  snapshot.location = {
    latitude: -22.5,
    longitude: 130.2,
    elevation: 550,
  };
  useSettingsSessionStore.getState().startSession(snapshot);
  return snapshot;
}

describe('useSettingsDraft hooks', () => {
  beforeEach(() => {
    act(() => {
      resetStores();
    });
  });

  afterEach(() => {
    act(() => {
      resetStores();
    });
  });

  it('exposes the session lifecycle actions from the settings session store', () => {
    const { result } = renderHook(() => useSettingsDraftLifecycle());
    const sessionState = useSettingsSessionStore.getState();

    expect(result.current.startSession).toBe(sessionState.startSession);
    expect(result.current.cancelSession).toBe(sessionState.cancelSession);
    expect(result.current.clearSession).toBe(sessionState.clearSession);
    expect(result.current.applyDraft).toBe(sessionState.applyDraft);
    expect(result.current.resetCategoryDraft).toBe(sessionState.resetCategoryDraft);
    expect(result.current.resetAllDraftToDefaults).toBe(sessionState.resetAllDraftToDefaults);
    expect(result.current.clearLastApplyResult).toBe(sessionState.clearLastApplyResult);
  });

  it('derives dirty and apply flags from session state and validation results', () => {
    act(() => {
      startSessionWithDraft();
    });

    const { result } = renderHook(() => useSettingsDraftStatus());

    expect(result.current.sessionActive).toBe(true);
    expect(result.current.hasDirty).toBe(false);
    expect(result.current.canApply).toBe(false);

    act(() => {
      useSettingsSessionStore.getState().setConnection({ ip: '' });
    });

    expect(result.current.hasDirty).toBe(true);
    expect(result.current.canApply).toBe(false);
    expect(result.current.validation.fieldErrors['connection.ip']).toBe(
      'Connection IP/host is required.',
    );

    act(() => {
      useSettingsSessionStore.getState().setConnection({ ip: '10.0.0.6' });
    });

    expect(result.current.canApply).toBe(true);
    expect(result.current.dirtyCategories).toContain('connection');
  });

  it('uses persisted connection state outside a session and draft state inside a session', () => {
    const inactiveHook = renderHook(() => useConnectionDraftModel());

    expect(inactiveHook.result.current.connection).toEqual(DEFAULT_CONNECTION);
    expect(inactiveHook.result.current.backendProtocol).toBe(DEFAULT_BACKEND_PROTOCOL);
    expect(inactiveHook.result.current.proxy).toEqual(DEFAULT_PROXY);

    act(() => {
      inactiveHook.result.current.setConnection({ ip: '127.0.0.1' });
      inactiveHook.result.current.setBackendProtocol('https');
      inactiveHook.result.current.setProxySettings({
        mode: 'manual',
        manualUrl: ' http://127.0.0.1:8888 ',
      });
    });

    expect(useSettingsStore.getState().connection).toEqual({
      ip: '127.0.0.1',
      port: DEFAULT_CONNECTION.port,
    });
    expect(useSettingsStore.getState().backendProtocol).toBe('https');
    expect(useSettingsStore.getState().proxy).toEqual({
      mode: 'manual',
      manualUrl: 'http://127.0.0.1:8888',
      fallbackToDirectOnFailure: true,
    });
    inactiveHook.unmount();

    act(() => {
      resetStores();
      startSessionWithDraft();
    });

    const activeHook = renderHook(() => useConnectionDraftModel());

    expect(activeHook.result.current.connection).toEqual({
      ip: '10.0.0.5',
      port: '6789',
    });
    expect(activeHook.result.current.backendProtocol).toBe('https');
    expect(activeHook.result.current.proxy).toEqual({
      mode: 'manual',
      manualUrl: 'http://127.0.0.1:7890',
      fallbackToDirectOnFailure: false,
    });

    act(() => {
      activeHook.result.current.setConnection({ port: '6790' });
      activeHook.result.current.setBackendProtocol('http');
      activeHook.result.current.setProxySettings({
        mode: 'off',
        fallbackToDirectOnFailure: true,
      });
    });

    expect(useSettingsSessionStore.getState().draft?.connection.port).toBe('6790');
    expect(useSettingsSessionStore.getState().draft?.backendProtocol).toBe('http');
    expect(useSettingsSessionStore.getState().draft?.proxy.mode).toBe('off');
    expect(useSettingsStore.getState().connection).toEqual(DEFAULT_CONNECTION);
  });

  it('uses persisted preferences outside a session and draft preferences inside a session', () => {
    const inactiveHook = renderHook(() => usePreferencesDraftModel());

    expect(inactiveHook.result.current.preferences.locale).toBe('en');

    act(() => {
      inactiveHook.result.current.setPreference('locale', 'zh');
    });

    expect(useSettingsStore.getState().preferences.locale).toBe('zh');
    inactiveHook.unmount();

    act(() => {
      resetStores();
      startSessionWithDraft();
    });

    const activeHook = renderHook(() => usePreferencesDraftModel());

    expect(activeHook.result.current.preferences.locale).toBe('zh');

    act(() => {
      activeHook.result.current.setPreference('timeFormat', '12h');
    });

    expect(useSettingsSessionStore.getState().draft?.preferences.timeFormat).toBe('12h');
    expect(useSettingsStore.getState().preferences.timeFormat).toBe('24h');
  });

  it('uses persisted performance outside a session and draft performance inside a session', () => {
    const inactiveHook = renderHook(() => usePerformanceDraftModel());

    expect(inactiveHook.result.current.performance.renderQuality).toBe('high');

    act(() => {
      inactiveHook.result.current.setPerformanceSetting('renderQuality', 'medium');
    });

    expect(useSettingsStore.getState().performance.renderQuality).toBe('medium');
    inactiveHook.unmount();

    act(() => {
      resetStores();
      startSessionWithDraft();
    });

    const activeHook = renderHook(() => usePerformanceDraftModel());

    expect(activeHook.result.current.performance.renderQuality).toBe('ultra');

    act(() => {
      activeHook.result.current.setPerformanceSetting('showFPS', true);
    });

    expect(useSettingsSessionStore.getState().draft?.performance.showFPS).toBe(true);
    expect(useSettingsStore.getState().performance.showFPS).toBe(false);
  });

  it('uses persisted accessibility outside a session and draft accessibility inside a session', () => {
    const inactiveHook = renderHook(() => useAccessibilityDraftModel());

    expect(inactiveHook.result.current.accessibility.highContrast).toBe(false);

    act(() => {
      inactiveHook.result.current.setAccessibilitySetting('highContrast', true);
    });

    expect(useSettingsStore.getState().accessibility.highContrast).toBe(true);
    inactiveHook.unmount();

    act(() => {
      resetStores();
      startSessionWithDraft();
    });

    const activeHook = renderHook(() => useAccessibilityDraftModel());

    expect(activeHook.result.current.accessibility.highContrast).toBe(true);

    act(() => {
      activeHook.result.current.setAccessibilitySetting('reduceTransparency', true);
    });

    expect(useSettingsSessionStore.getState().draft?.accessibility.reduceTransparency).toBe(true);
    expect(useSettingsStore.getState().accessibility.reduceTransparency).toBe(false);
  });

  it('uses persisted notifications outside a session and draft notifications inside a session', () => {
    const inactiveHook = renderHook(() => useNotificationDraftModel());

    expect(inactiveHook.result.current.notifications.enableSounds).toBe(false);

    act(() => {
      inactiveHook.result.current.setNotificationSetting('enableSounds', true);
    });

    expect(useSettingsStore.getState().notifications.enableSounds).toBe(true);
    inactiveHook.unmount();

    act(() => {
      resetStores();
      startSessionWithDraft();
    });

    const activeHook = renderHook(() => useNotificationDraftModel());

    expect(activeHook.result.current.notifications.enableSounds).toBe(true);

    act(() => {
      activeHook.result.current.setNotificationSetting('toastDuration', 5000);
    });

    expect(useSettingsSessionStore.getState().draft?.notifications.toastDuration).toBe(5000);
    expect(useSettingsStore.getState().notifications.toastDuration).toBe(4000);
  });

  it('uses persisted search settings outside a session and draft search settings inside a session', () => {
    const inactiveHook = renderHook(() => useSearchDraftModel());

    expect(inactiveHook.result.current.search.maxSearchResults).toBe(50);

    act(() => {
      inactiveHook.result.current.setSearchSetting('maxSearchResults', 80);
    });

    expect(useSettingsStore.getState().search.maxSearchResults).toBe(80);
    inactiveHook.unmount();

    act(() => {
      resetStores();
      startSessionWithDraft();
    });

    const activeHook = renderHook(() => useSearchDraftModel());

    expect(activeHook.result.current.search.maxSearchResults).toBe(120);

    act(() => {
      activeHook.result.current.setSearchSetting('autoSearchDelay', 450);
    });

    expect(useSettingsSessionStore.getState().draft?.search.autoSearchDelay).toBe(450);
    expect(useSettingsStore.getState().search.autoSearchDelay).toBe(300);
  });

  it('writes location updates back to the mount store when no draft session is active', () => {
    const { result } = renderHook(() => useLocationDraftModel());

    expect(result.current.location).toEqual({
      latitude: 35.2,
      longitude: 118.7,
      elevation: 460,
    });

    act(() => {
      result.current.setLocation({ latitude: 40.5 });
    });

    expect(useMountStore.getState().profileInfo.AstrometrySettings).toEqual({
      Latitude: 40.5,
      Longitude: 118.7,
      Elevation: 460,
    });
  });

  it('uses draft location data when a session is active', () => {
    act(() => {
      startSessionWithDraft();
    });

    const { result } = renderHook(() => useLocationDraftModel());

    expect(result.current.location).toEqual({
      latitude: -22.5,
      longitude: 130.2,
      elevation: 550,
    });

    act(() => {
      result.current.setLocation({ longitude: 135.1 });
    });

    expect(useSettingsSessionStore.getState().draft?.location).toEqual({
      latitude: -22.5,
      longitude: 135.1,
      elevation: 550,
    });
    expect(useMountStore.getState().profileInfo.AstrometrySettings.Longitude).toBe(118.7);
  });

  it('returns category validation state for the requested draft category', () => {
    act(() => {
      startSessionWithDraft();
      useSettingsSessionStore.getState().setConnection({ ip: '' });
    });

    const { result } = renderHook(() => useCategoryValidationState('connection'));

    expect(result.current.category).toBe('connection');
    expect(result.current.hasError).toBe(true);
    expect(result.current.errors).toEqual(['Connection IP/host is required.']);
  });
});
