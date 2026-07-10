import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getZustandStorage } from '@/lib/storage';
import type { StellariumSettings, SkyEngineType, AladinDisplaySettings, RecommendationProfile } from '@/lib/core/types';
import { DEFAULT_ALADIN_DISPLAY_SETTINGS } from '@/lib/core/types/stellarium';
import { DEFAULT_STELLARIUM_SETTINGS } from '@/components/starmap/settings/settings-constants';
import {
  DEFAULT_MOBILE_PRIORITIZED_TOOLS,
  normalizeMobilePrioritizedTools,
} from '@/lib/constants/mobile-tools';

// ============================================================================
// Types
// ============================================================================

export type AppLocale = 'en' | 'zh';
export type TimeFormat = '12h' | '24h';
export type DateFormat = 'iso' | 'us' | 'eu';
export type CoordinateFormat = 'degrees' | 'dms' | 'hms';
export type DistanceUnit = 'metric' | 'imperial';
export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type RenderQuality = 'low' | 'medium' | 'high' | 'ultra';
export type StartupView = 'last' | 'default' | 'custom';
export type ProxyMode = 'auto' | 'manual' | 'off';

export interface ProxySettings {
  mode: ProxyMode;
  manualUrl: string;
  fallbackToDirectOnFailure: boolean;
}

export interface AppPreferences {
  locale: AppLocale;
  timeFormat: TimeFormat;
  dateFormat: DateFormat;
  coordinateFormat: CoordinateFormat;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  skipCloseConfirmation: boolean;
  rightPanelCollapsed: boolean;
  startupView: StartupView;
  launchOnStartup: boolean;
  showSplash: boolean;
  autoConnectBackend: boolean;
  dailyKnowledgeEnabled: boolean;
  dailyKnowledgeAutoShow: boolean;
  dailyKnowledgeOnlineEnhancement: boolean;
}

export interface PerformanceSettings {
  renderQuality: RenderQuality;
  enableAnimations: boolean;
  reducedMotion: boolean;
  maxStarsRendered: number;
  enableAntialiasing: boolean;
  showFPS: boolean;
}

export type ColorBlindMode =
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia';

export interface AccessibilitySettings {
  highContrast: boolean;
  /** Global UI font scale multiplier (1.0 = 100%). Range 0.9–2.0. */
  fontScale: number;
  colorBlindMode: ColorBlindMode;
  screenReaderOptimized: boolean;
  reduceTransparency: boolean;
  focusIndicators: boolean;
}

export interface NotificationSettings {
  enableSounds: boolean;
  enableToasts: boolean;
  toastDuration: number;
  showObjectAlerts: boolean;
  showSatelliteAlerts: boolean;
}

export interface SearchSettings {
  autoSearchDelay: number;
  enableFuzzySearch: boolean;
  maxSearchResults: number;
  includeMinorObjects: boolean;
  rememberSearchHistory: boolean;
  maxHistoryItems: number;
}

export type PrecisionMode = 'core_high_precision' | 'realtime_lightweight';
export type EopUpdatePolicy = 'auto_with_offline_fallback' | 'embedded_only' | 'strict_offline';

export interface MobileFeaturePreferences {
  compactBottomBar: boolean;
  oneHandMode: boolean;
  prioritizedTools: string[];
}

export interface SettingsState {
  // Connection settings
  connection: {
    ip: string;
    port: string;
  };
  backendProtocol: 'http' | 'https';
  proxy: ProxySettings;
  
  // Sky engine selection
  skyEngine: SkyEngineType;

  // Offline tile cache mode: serve survey tiles from the local Rust cache only
  offlineTileMode: boolean;

  // Stellarium display settings
  stellarium: StellariumSettings;
  
  // App preferences
  preferences: AppPreferences;
  
  // Performance settings
  performance: PerformanceSettings;
  
  // Accessibility settings
  accessibility: AccessibilitySettings;
  
  // Notification settings
  notifications: NotificationSettings;
  
  // Search settings
  search: SearchSettings;
  
  // Aladin display settings
  aladinDisplay: AladinDisplaySettings;

  // Observation profile and precision policy
  observationProfile: RecommendationProfile;
  precisionMode: PrecisionMode;
  eopUpdatePolicy: EopUpdatePolicy;
  mobileFeaturePreferences: MobileFeaturePreferences;
  
  // Actions - Connection
  setConnection: (connection: Partial<SettingsState['connection']>) => void;
  setBackendProtocol: (protocol: 'http' | 'https') => void;
  setProxySettings: (proxy: Partial<ProxySettings>) => void;
  
  // Actions - Sky Engine
  setSkyEngine: (engine: SkyEngineType) => void;
  setOfflineTileMode: (enabled: boolean) => void;
  
  // Actions - Stellarium
  setStellariumSetting: <K extends keyof StellariumSettings>(key: K, value: StellariumSettings[K]) => void;
  setStellariumSettings: (settings: StellariumSettings) => void;
  toggleStellariumSetting: (key: keyof StellariumSettings) => void;
  
  // Actions - Preferences
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
  setPreferences: (preferences: Partial<AppPreferences>) => void;
  
  // Actions - Performance
  setPerformanceSetting: <K extends keyof PerformanceSettings>(key: K, value: PerformanceSettings[K]) => void;
  setPerformanceSettings: (settings: Partial<PerformanceSettings>) => void;
  
  // Actions - Accessibility
  setAccessibilitySetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  setAccessibilitySettings: (settings: Partial<AccessibilitySettings>) => void;
  
  // Actions - Notifications
  setNotificationSetting: <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => void;
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  
  // Actions - Search
  setSearchSetting: <K extends keyof SearchSettings>(key: K, value: SearchSettings[K]) => void;
  setSearchSettings: (settings: Partial<SearchSettings>) => void;
  
  // Actions - Aladin Display
  setAladinDisplaySetting: <K extends keyof AladinDisplaySettings>(key: K, value: AladinDisplaySettings[K]) => void;
  setAladinDisplaySettings: (settings: Partial<AladinDisplaySettings>) => void;
  toggleAladinDisplaySetting: (key: keyof AladinDisplaySettings) => void;

  // Actions - Observation/Precision
  setObservationProfile: (profile: RecommendationProfile) => void;
  setPrecisionMode: (mode: PrecisionMode) => void;
  setEopUpdatePolicy: (policy: EopUpdatePolicy) => void;
  setMobileFeaturePreferences: (prefs: Partial<MobileFeaturePreferences>) => void;
  
  // Actions - Reset
  resetToDefaults: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_CONNECTION: SettingsState['connection'] = {
  ip: 'localhost',
  port: '1888',
};

export const DEFAULT_BACKEND_PROTOCOL: SettingsState['backendProtocol'] = 'http';
export const DEFAULT_PROXY: ProxySettings = {
  mode: 'auto',
  manualUrl: '',
  fallbackToDirectOnFailure: true,
};

export const DEFAULT_PREFERENCES: AppPreferences = {
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
};

export const DEFAULT_PERFORMANCE: PerformanceSettings = {
  renderQuality: 'high',
  enableAnimations: true,
  reducedMotion: false,
  maxStarsRendered: 50000,
  enableAntialiasing: true,
  showFPS: false,
};

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  highContrast: false,
  fontScale: 1.0,
  colorBlindMode: 'none',
  screenReaderOptimized: false,
  reduceTransparency: false,
  focusIndicators: true,
};

/** Allowed UI font-scale steps (multiplier of base size). */
export const FONT_SCALE_STEPS = [0.9, 1.0, 1.125, 1.25, 1.5, 2.0] as const;
export const FONT_SCALE_MIN = 0.9;
export const FONT_SCALE_MAX = 2.0;

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enableSounds: false,
  enableToasts: true,
  toastDuration: 4000,
  showObjectAlerts: true,
  showSatelliteAlerts: true,
};

export const DEFAULT_SEARCH: SearchSettings = {
  autoSearchDelay: 300,
  enableFuzzySearch: true,
  maxSearchResults: 50,
  includeMinorObjects: false,
  rememberSearchHistory: true,
  maxHistoryItems: 20,
};

export const DEFAULT_MOBILE_FEATURE_PREFERENCES: MobileFeaturePreferences = {
  compactBottomBar: false,
  oneHandMode: false,
  prioritizedTools: DEFAULT_MOBILE_PRIORITIZED_TOOLS,
};

export const DEFAULT_STELLARIUM: StellariumSettings = DEFAULT_STELLARIUM_SETTINGS;

function normalizeMobileFeaturePreferences(
  mobileFeaturePreferences: Partial<MobileFeaturePreferences> | undefined,
  options: { appendDefaultOrder?: boolean } = {},
): MobileFeaturePreferences {
  return {
    compactBottomBar:
      mobileFeaturePreferences?.compactBottomBar ?? DEFAULT_MOBILE_FEATURE_PREFERENCES.compactBottomBar,
    oneHandMode:
      mobileFeaturePreferences?.oneHandMode ?? DEFAULT_MOBILE_FEATURE_PREFERENCES.oneHandMode,
    prioritizedTools: normalizeMobilePrioritizedTools(mobileFeaturePreferences?.prioritizedTools, {
      appendDefaultOrder: options.appendDefaultOrder ?? false,
    }),
  };
}

// ============================================================================
// Store
// ============================================================================

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Initial state
      connection: DEFAULT_CONNECTION,
      backendProtocol: DEFAULT_BACKEND_PROTOCOL,
      proxy: DEFAULT_PROXY,
      skyEngine: 'stellarium' as SkyEngineType,
      offlineTileMode: false,
      stellarium: DEFAULT_STELLARIUM,
      preferences: DEFAULT_PREFERENCES,
      performance: DEFAULT_PERFORMANCE,
      accessibility: DEFAULT_ACCESSIBILITY,
      notifications: DEFAULT_NOTIFICATIONS,
      search: DEFAULT_SEARCH,
      aladinDisplay: DEFAULT_ALADIN_DISPLAY_SETTINGS,
      observationProfile: 'imaging',
      precisionMode: 'core_high_precision',
      eopUpdatePolicy: 'auto_with_offline_fallback',
      mobileFeaturePreferences: normalizeMobileFeaturePreferences(
        DEFAULT_MOBILE_FEATURE_PREFERENCES,
      ),
      
      // Actions - Connection
      setConnection: (connection) => set((state) => ({
        connection: { ...state.connection, ...connection }
      })),
      
      setBackendProtocol: (backendProtocol) => set({ backendProtocol }),
      setProxySettings: (proxy) => set((state) => ({
        proxy: {
          ...state.proxy,
          ...proxy,
          manualUrl: (proxy.manualUrl ?? state.proxy.manualUrl).trim(),
        },
      })),
      
      // Actions - Sky Engine
      setSkyEngine: (skyEngine) => set({ skyEngine }),
      setOfflineTileMode: (offlineTileMode) => set({ offlineTileMode }),
      
      // Actions - Stellarium
      setStellariumSetting: (key, value) => set((state) => ({
        stellarium: { ...state.stellarium, [key]: value }
      })),
      
      setStellariumSettings: (settings) => set({ stellarium: settings }),
      
      toggleStellariumSetting: (key) => set((state) => {
        const currentValue = state.stellarium[key];
        if (typeof currentValue === 'boolean') {
          return {
            stellarium: { ...state.stellarium, [key]: !currentValue }
          };
        }
        return state;
      }),
      
      // Actions - Preferences
      setPreference: (key, value) => set((state) => ({
        preferences: { ...state.preferences, [key]: value }
      })),
      
      setPreferences: (preferences) => set((state) => ({
        preferences: { ...state.preferences, ...preferences }
      })),
      
      // Actions - Performance
      setPerformanceSetting: (key, value) => set((state) => ({
        performance: { ...state.performance, [key]: value }
      })),
      
      setPerformanceSettings: (settings) => set((state) => ({
        performance: { ...state.performance, ...settings }
      })),
      
      // Actions - Accessibility
      setAccessibilitySetting: (key, value) => set((state) => ({
        accessibility: { ...state.accessibility, [key]: value }
      })),
      
      setAccessibilitySettings: (settings) => set((state) => ({
        accessibility: { ...state.accessibility, ...settings }
      })),
      
      // Actions - Notifications
      setNotificationSetting: (key, value) => set((state) => ({
        notifications: { ...state.notifications, [key]: value }
      })),
      
      setNotificationSettings: (settings) => set((state) => ({
        notifications: { ...state.notifications, ...settings }
      })),
      
      // Actions - Search
      setSearchSetting: (key, value) => set((state) => ({
        search: { ...state.search, [key]: value }
      })),
      
      setSearchSettings: (settings) => set((state) => ({
        search: { ...state.search, ...settings }
      })),
      
      // Actions - Aladin Display
      setAladinDisplaySetting: (key, value) => set((state) => ({
        aladinDisplay: { ...state.aladinDisplay, [key]: value }
      })),
      
      setAladinDisplaySettings: (settings) => set((state) => ({
        aladinDisplay: { ...state.aladinDisplay, ...settings }
      })),
      
      toggleAladinDisplaySetting: (key) => set((state) => {
        const currentValue = state.aladinDisplay[key];
        if (typeof currentValue === 'boolean') {
          return {
            aladinDisplay: { ...state.aladinDisplay, [key]: !currentValue }
          };
        }
        return state;
      }),

      // Actions - Observation/Precision
      setObservationProfile: (observationProfile) => set({ observationProfile }),
      setPrecisionMode: (precisionMode) => set({ precisionMode }),
      setEopUpdatePolicy: (eopUpdatePolicy) => set({ eopUpdatePolicy }),
      setMobileFeaturePreferences: (prefs) => set((state) => ({
        mobileFeaturePreferences: normalizeMobileFeaturePreferences({
          ...state.mobileFeaturePreferences,
          ...prefs,
        }),
      })),
      
      // Actions - Reset
      resetToDefaults: () => set({
        skyEngine: 'stellarium' as SkyEngineType,
        offlineTileMode: false,
        proxy: DEFAULT_PROXY,
        stellarium: DEFAULT_STELLARIUM,
        preferences: DEFAULT_PREFERENCES,
        performance: DEFAULT_PERFORMANCE,
        accessibility: DEFAULT_ACCESSIBILITY,
        notifications: DEFAULT_NOTIFICATIONS,
        search: DEFAULT_SEARCH,
        aladinDisplay: DEFAULT_ALADIN_DISPLAY_SETTINGS,
        observationProfile: 'imaging',
        precisionMode: 'core_high_precision',
        eopUpdatePolicy: 'auto_with_offline_fallback',
        mobileFeaturePreferences: normalizeMobileFeaturePreferences(
          DEFAULT_MOBILE_FEATURE_PREFERENCES,
        ),
      }),
    }),
    {
      name: 'starmap-settings',
      storage: getZustandStorage(),
      version: 21, // v21: a11y fontScale + colorBlindMode (replaces largeText)
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<SettingsState>;
        
        // Migration from older versions
        if (version < 7) {
          return {
            ...state,
            skyEngine: 'stellarium' as SkyEngineType,
            stellarium: {
              ...DEFAULT_STELLARIUM,
              ...state.stellarium,
            },
            preferences: {
              ...DEFAULT_PREFERENCES,
              ...state.preferences,
            },
            performance: {
              ...DEFAULT_PERFORMANCE,
              ...state.performance,
            },
            accessibility: {
              ...DEFAULT_ACCESSIBILITY,
              ...state.accessibility,
            },
            notifications: {
              ...DEFAULT_NOTIFICATIONS,
              ...state.notifications,
            },
            search: {
              ...DEFAULT_SEARCH,
              ...state.search,
            },
            observationProfile: 'imaging',
            precisionMode: 'core_high_precision',
            eopUpdatePolicy: 'auto_with_offline_fallback',
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              DEFAULT_MOBILE_FEATURE_PREFERENCES,
              { appendDefaultOrder: true },
            ),
          };
        }
        
        // Migration from v7 to v8: add skyEngine
        if (version < 8) {
          return {
            ...state,
            skyEngine: state.skyEngine ?? ('stellarium' as SkyEngineType),
            observationProfile: state.observationProfile ?? 'imaging',
            precisionMode: state.precisionMode ?? 'core_high_precision',
            eopUpdatePolicy: state.eopUpdatePolicy ?? 'auto_with_offline_fallback',
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              {
                ...DEFAULT_MOBILE_FEATURE_PREFERENCES,
                ...state.mobileFeaturePreferences,
              },
              { appendDefaultOrder: true },
            ),
          };
        }
        
        // Migration from v8 to v9: add aladinDisplay
        if (version < 9) {
          return {
            ...state,
            aladinDisplay: {
              ...DEFAULT_ALADIN_DISPLAY_SETTINGS,
              ...(state as Record<string, unknown>).aladinDisplay as Partial<AladinDisplaySettings> | undefined,
            },
            observationProfile: state.observationProfile ?? 'imaging',
            precisionMode: state.precisionMode ?? 'core_high_precision',
            eopUpdatePolicy: state.eopUpdatePolicy ?? 'auto_with_offline_fallback',
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              {
                ...DEFAULT_MOBILE_FEATURE_PREFERENCES,
                ...state.mobileFeaturePreferences,
              },
              { appendDefaultOrder: true },
            ),
          };
        }

        // Migration from v9 to v10: add new Stellarium capability fields
        if (version < 10) {
          return {
            ...state,
            stellarium: {
              ...DEFAULT_STELLARIUM,
              ...state.stellarium,
            },
            observationProfile: state.observationProfile ?? 'imaging',
            precisionMode: state.precisionMode ?? 'core_high_precision',
            eopUpdatePolicy: state.eopUpdatePolicy ?? 'auto_with_offline_fallback',
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              {
                ...DEFAULT_MOBILE_FEATURE_PREFERENCES,
                ...state.mobileFeaturePreferences,
              },
              { appendDefaultOrder: true },
            ),
          };
        }

        // Migration from v10 to v11: add sensor orientation pipeline fields
        if (version < 11) {
          return {
            ...state,
            stellarium: {
              ...DEFAULT_STELLARIUM,
              ...state.stellarium,
            },
            observationProfile: state.observationProfile ?? 'imaging',
            precisionMode: state.precisionMode ?? 'core_high_precision',
            eopUpdatePolicy: state.eopUpdatePolicy ?? 'auto_with_offline_fallback',
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              {
                ...DEFAULT_MOBILE_FEATURE_PREFERENCES,
                ...state.mobileFeaturePreferences,
              },
              { appendDefaultOrder: true },
            ),
          };
        }

        // Migration from v11 to v12: add observation & precision policy fields
        if (version < 12) {
          return {
            ...state,
            observationProfile: state.observationProfile ?? 'imaging',
            precisionMode: state.precisionMode ?? 'core_high_precision',
            eopUpdatePolicy: state.eopUpdatePolicy ?? 'auto_with_offline_fallback',
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              {
                ...DEFAULT_MOBILE_FEATURE_PREFERENCES,
                ...state.mobileFeaturePreferences,
              },
              { appendDefaultOrder: true },
            ),
          };
        }

        if (version < 13) {
          return {
            ...state,
            preferences: {
              ...DEFAULT_PREFERENCES,
              ...state.preferences,
            },
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              state.mobileFeaturePreferences,
              { appendDefaultOrder: true },
            ),
          };
        }

        if (version < 14) {
          return {
            ...state,
            mobileFeaturePreferences: normalizeMobileFeaturePreferences(
              state.mobileFeaturePreferences,
              { appendDefaultOrder: true },
            ),
          };
        }

        // Migration from v14 to v15: add AR mode fields
        if (version < 15) {
          return {
            ...state,
            stellarium: {
              ...DEFAULT_STELLARIUM,
              ...state.stellarium,
            },
          };
        }

        // Migration from v15 to v16: add AR camera profile and adaptive/network optimization fields
        if (version < 16) {
          return {
            ...state,
            stellarium: {
              ...DEFAULT_STELLARIUM,
              ...state.stellarium,
            },
          };
        }


        // Migration from v16 to v17: add AR camera device preference and last-known-good acquisition fields
        if (version < 17) {
          return {
            ...state,
            stellarium: {
              ...DEFAULT_STELLARIUM,
              ...state.stellarium,
            },
          };
        }

        if (version < 18) {
          return {
            ...state,
            preferences: {
              ...DEFAULT_PREFERENCES,
              ...state.preferences,
            },
          };
        }

        if (version < 19) {
          return {
            ...state,
            proxy: {
              ...DEFAULT_PROXY,
              ...(state.proxy ?? {}),
            },
          };
        }

        if (version < 20) {
          return {
            ...state,
            offlineTileMode: state.offlineTileMode ?? false,
          };
        }

        // Migration from v20 to v21: replace boolean largeText with graded
        // fontScale and add colorBlindMode.
        if (version < 21) {
          const legacy = (state.accessibility ?? {}) as Partial<AccessibilitySettings> & {
            largeText?: boolean;
          };
          const { largeText, ...restAccessibility } = legacy;
          return {
            ...state,
            accessibility: {
              ...DEFAULT_ACCESSIBILITY,
              ...restAccessibility,
              fontScale: legacy.fontScale ?? (largeText ? 1.125 : 1.0),
              colorBlindMode: legacy.colorBlindMode ?? 'none',
            },
          };
        }


        return state;
      },
      merge: (persistedState, currentState) => {
        const state = (persistedState as Partial<SettingsState> | undefined) ?? {};
        const currentProxy = (currentState as Partial<SettingsState>).proxy ?? DEFAULT_PROXY;

        return {
          ...currentState,
          ...state,
          connection: {
            ...currentState.connection,
            ...state.connection,
          },
          proxy: {
            ...DEFAULT_PROXY,
            ...currentProxy,
            ...state.proxy,
            manualUrl: String(state.proxy?.manualUrl ?? currentProxy.manualUrl).trim(),
          },
          stellarium: {
            ...currentState.stellarium,
            ...state.stellarium,
          },
          preferences: {
            ...currentState.preferences,
            ...state.preferences,
          },
          performance: {
            ...currentState.performance,
            ...state.performance,
          },
          accessibility: {
            ...currentState.accessibility,
            ...state.accessibility,
          },
          notifications: {
            ...currentState.notifications,
            ...state.notifications,
          },
          search: {
            ...currentState.search,
            ...state.search,
          },
          aladinDisplay: {
            ...currentState.aladinDisplay,
            ...state.aladinDisplay,
          },
          mobileFeaturePreferences: normalizeMobileFeaturePreferences(
            {
              ...currentState.mobileFeaturePreferences,
              ...state.mobileFeaturePreferences,
            },
            { appendDefaultOrder: true },
          ),
          observationProfile: state.observationProfile ?? currentState.observationProfile,
          precisionMode: state.precisionMode ?? currentState.precisionMode,
          eopUpdatePolicy: state.eopUpdatePolicy ?? currentState.eopUpdatePolicy,
        };
      },
      partialize: (state) => ({
        connection: state.connection,
        backendProtocol: state.backendProtocol,
        proxy: state.proxy,
        skyEngine: state.skyEngine,
        offlineTileMode: state.offlineTileMode,
        stellarium: state.stellarium,
        preferences: state.preferences,
        performance: state.performance,
        accessibility: state.accessibility,
        notifications: state.notifications,
        search: state.search,
        aladinDisplay: state.aladinDisplay,
        observationProfile: state.observationProfile,
        precisionMode: state.precisionMode,
        eopUpdatePolicy: state.eopUpdatePolicy,
        mobileFeaturePreferences: state.mobileFeaturePreferences,
      }),
    }
  )
);

