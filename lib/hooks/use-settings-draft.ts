import { useMemo } from 'react';
import { useMountStore } from '@/lib/stores/mount-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { applyCanonicalObservationLocation } from '@/lib/services/observation-location-controller';
import {
  useSettingsSessionStore,
} from '@/lib/stores/settings-session-store';
import type {
  SettingsDraftCategory,
} from '@/lib/settings/settings-draft';

export function useSettingsDraftLifecycle() {
  const startSession = useSettingsSessionStore((state) => state.startSession);
  const cancelSession = useSettingsSessionStore((state) => state.cancelSession);
  const clearSession = useSettingsSessionStore((state) => state.clearSession);
  const applyDraft = useSettingsSessionStore((state) => state.applyDraft);
  const resetCategoryDraft = useSettingsSessionStore((state) => state.resetCategoryDraft);
  const resetAllDraftToDefaults = useSettingsSessionStore((state) => state.resetAllDraftToDefaults);
  const clearLastApplyResult = useSettingsSessionStore((state) => state.clearLastApplyResult);

  return {
    startSession,
    cancelSession,
    clearSession,
    applyDraft,
    resetCategoryDraft,
    resetAllDraftToDefaults,
    clearLastApplyResult,
  };
}

export function useSettingsDraftStatus() {
  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const dirtyPaths = useSettingsSessionStore((state) => state.dirtyPaths);
  const dirtyCategories = useSettingsSessionStore((state) => state.dirtyCategories);
  const validation = useSettingsSessionStore((state) => state.validation);
  const lastApplyResult = useSettingsSessionStore((state) => state.lastApplyResult);

  return useMemo(() => ({
    sessionActive,
    dirtyPaths,
    dirtyCategories,
    validation,
    lastApplyResult,
    hasDirty: dirtyPaths.length > 0,
    canApply: dirtyPaths.length > 0 && validation.isValid,
  }), [
    sessionActive,
    dirtyPaths,
    dirtyCategories,
    validation,
    lastApplyResult,
  ]);
}

export function useConnectionDraftModel() {
  const connection = useSettingsStore((state) => state.connection);
  const backendProtocol = useSettingsStore((state) => state.backendProtocol);
  const proxy = useSettingsStore((state) => state.proxy);
  const setConnection = useSettingsStore((state) => state.setConnection);
  const setBackendProtocol = useSettingsStore((state) => state.setBackendProtocol);
  const setProxySettings = useSettingsStore((state) => state.setProxySettings);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftConnection = useSettingsSessionStore((state) => state.draft?.connection);
  const draftBackendProtocol = useSettingsSessionStore((state) => state.draft?.backendProtocol);
  const draftProxy = useSettingsSessionStore((state) => state.draft?.proxy);
  const setDraftConnection = useSettingsSessionStore((state) => state.setConnection);
  const setDraftBackendProtocol = useSettingsSessionStore((state) => state.setBackendProtocol);
  const setDraftProxySettings = useSettingsSessionStore((state) => state.setProxySettings);

  return {
    connection: (sessionActive && draftConnection) ? draftConnection : connection,
    backendProtocol: (sessionActive && draftBackendProtocol) ? draftBackendProtocol : backendProtocol,
    proxy: (sessionActive && draftProxy) ? draftProxy : proxy,
    setConnection: sessionActive ? setDraftConnection : setConnection,
    setBackendProtocol: sessionActive ? setDraftBackendProtocol : setBackendProtocol,
    setProxySettings: sessionActive ? setDraftProxySettings : setProxySettings,
  };
}

export function usePreferencesDraftModel() {
  const preferences = useSettingsStore((state) => state.preferences);
  const setPreference = useSettingsStore((state) => state.setPreference);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftPreferences = useSettingsSessionStore((state) => state.draft?.preferences);
  const setDraftPreference = useSettingsSessionStore((state) => state.setPreference);

  return {
    preferences: (sessionActive && draftPreferences) ? draftPreferences : preferences,
    setPreference: sessionActive ? setDraftPreference : setPreference,
  };
}

export function usePerformanceDraftModel() {
  const performance = useSettingsStore((state) => state.performance);
  const setPerformanceSetting = useSettingsStore((state) => state.setPerformanceSetting);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftPerformance = useSettingsSessionStore((state) => state.draft?.performance);
  const setDraftPerformanceSetting = useSettingsSessionStore((state) => state.setPerformanceSetting);

  return {
    performance: (sessionActive && draftPerformance) ? draftPerformance : performance,
    setPerformanceSetting: sessionActive ? setDraftPerformanceSetting : setPerformanceSetting,
  };
}

export function useAccessibilityDraftModel() {
  const accessibility = useSettingsStore((state) => state.accessibility);
  const setAccessibilitySetting = useSettingsStore((state) => state.setAccessibilitySetting);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftAccessibility = useSettingsSessionStore((state) => state.draft?.accessibility);
  const setDraftAccessibilitySetting = useSettingsSessionStore((state) => state.setAccessibilitySetting);

  return {
    accessibility: (sessionActive && draftAccessibility) ? draftAccessibility : accessibility,
    setAccessibilitySetting: sessionActive ? setDraftAccessibilitySetting : setAccessibilitySetting,
  };
}

export function useNotificationDraftModel() {
  const notifications = useSettingsStore((state) => state.notifications);
  const setNotificationSetting = useSettingsStore((state) => state.setNotificationSetting);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftNotifications = useSettingsSessionStore((state) => state.draft?.notifications);
  const setDraftNotificationSetting = useSettingsSessionStore((state) => state.setNotificationSetting);

  return {
    notifications: (sessionActive && draftNotifications) ? draftNotifications : notifications,
    setNotificationSetting: sessionActive ? setDraftNotificationSetting : setNotificationSetting,
  };
}

export function useSearchDraftModel() {
  const search = useSettingsStore((state) => state.search);
  const setSearchSetting = useSettingsStore((state) => state.setSearchSetting);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftSearch = useSettingsSessionStore((state) => state.draft?.search);
  const setDraftSearchSetting = useSettingsSessionStore((state) => state.setSearchSetting);

  return {
    search: (sessionActive && draftSearch) ? draftSearch : search,
    setSearchSetting: sessionActive ? setDraftSearchSetting : setSearchSetting,
  };
}

export function useLocationDraftModel() {
  const profileInfo = useMountStore((state) => state.profileInfo);
  const setProfileInfo = useMountStore((state) => state.setProfileInfo);

  const sessionActive = useSettingsSessionStore((state) => state.sessionActive);
  const draftLocation = useSettingsSessionStore((state) => state.draft?.location);
  const setDraftLocation = useSettingsSessionStore((state) => state.setLocation);

  const persistedLocation = useMemo(() => ({
    latitude: profileInfo?.AstrometrySettings?.Latitude ?? 0,
    longitude: profileInfo?.AstrometrySettings?.Longitude ?? 0,
    elevation: profileInfo?.AstrometrySettings?.Elevation ?? 0,
  }), [profileInfo]);

  const setPersistedLocation = (location: Partial<typeof persistedLocation>) => {
    const current = useMountStore.getState().profileInfo;
    const nextLocation = {
      latitude: location.latitude ?? current.AstrometrySettings.Latitude,
      longitude: location.longitude ?? current.AstrometrySettings.Longitude,
      elevation: location.elevation ?? current.AstrometrySettings.Elevation,
    };

    setProfileInfo({
      ...current,
      AstrometrySettings: {
        ...current.AstrometrySettings,
        Latitude: nextLocation.latitude,
        Longitude: nextLocation.longitude,
        Elevation: nextLocation.elevation,
      },
    });

    void applyCanonicalObservationLocation({
      latitude: nextLocation.latitude,
      longitude: nextLocation.longitude,
      altitude: nextLocation.elevation,
    });
  };

  return {
    location: (sessionActive && draftLocation) ? draftLocation : persistedLocation,
    setLocation: sessionActive ? setDraftLocation : setPersistedLocation,
  };
}

export function useCategoryValidationState(category: SettingsDraftCategory) {
  const validation = useSettingsSessionStore((state) => state.validation);
  return {
    category,
    hasError: (validation.categoryErrors[category]?.length ?? 0) > 0,
    errors: validation.categoryErrors[category] ?? [],
  };
}
