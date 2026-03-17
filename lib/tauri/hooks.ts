/**
 * React hooks for Tauri API
 * Provides easy access to Rust backend functionality
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { isTauri } from '@/lib/storage/platform';
import { tauriApi } from './api';
import { createLogger } from '@/lib/logger';

const logger = createLogger('tauri-hooks');
import type {
  EquipmentData,
  LocationsData,
  ObservationLocation,
  ObservationLogData,
  ObservationStats,
  AppSettings,
  SystemInfo,
} from './types';

// ============================================================================
// Equipment Hook
// ============================================================================

export function useEquipment() {
  const [equipment, setEquipment] = useState<EquipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await tauriApi.equipment.load();
      setEquipment(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => load(), [load]);

  return {
    equipment,
    loading,
    error,
    refresh,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Locations Hook
// ============================================================================

export function useLocations() {
  const [locations, setLocations] = useState<LocationsData | null>(null);
  const [currentLocation, setCurrentLocation] = useState<ObservationLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const [data, current] = await Promise.all([
        tauriApi.locations.load(),
        tauriApi.locations.getCurrent(),
      ]);
      setLocations(data);
      setCurrentLocation(current);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setCurrent = useCallback(async (locationId: string) => {
    if (!isTauri()) return;
    
    try {
      const data = await tauriApi.locations.setCurrent(locationId);
      setLocations(data);
      const loc = data.locations.find(l => l.id === locationId);
      setCurrentLocation(loc || null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  return {
    locations,
    currentLocation,
    loading,
    error,
    refresh: load,
    setCurrent,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Observation Log Hook
// ============================================================================

export function useObservationLog() {
  const [log, setLog] = useState<ObservationLogData | null>(null);
  const [stats, setStats] = useState<ObservationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const [logData, statsData] = await Promise.all([
        tauriApi.observationLog.load(),
        tauriApi.observationLog.getStats(),
      ]);
      setLog(logData);
      setStats(statsData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    log,
    stats,
    loading,
    error,
    refresh: load,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// App Settings Hook
// ============================================================================

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const [settingsData, infoData] = await Promise.all([
        tauriApi.appSettings.load(),
        tauriApi.appSettings.getSystemInfo(),
      ]);
      setSettings(settingsData);
      setSystemInfo(infoData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    if (!isTauri() || !settings) return;
    
    try {
      const newSettings = { ...settings, ...updates };
      await tauriApi.appSettings.save(newSettings);
      setSettings(newSettings);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [settings]);

  return {
    settings,
    systemInfo,
    loading,
    error,
    refresh: load,
    updateSettings,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Window State Hook
// ============================================================================

export function useWindowState() {
  const [saving, setSaving] = useState(false);

  const saveWindowState = useCallback(async () => {
    if (!isTauri()) return;
    
    try {
      setSaving(true);
      await tauriApi.appSettings.saveWindowState();
    } catch (e) {
      logger.error('Failed to save window state', e);
    } finally {
      setSaving(false);
    }
  }, []);

  const restoreWindowState = useCallback(async () => {
    if (!isTauri()) return;
    
    try {
      await tauriApi.appSettings.restoreWindowState();
    } catch (e) {
      logger.error('Failed to restore window state', e);
    }
  }, []);

  // Restore on mount; the plugin handles close-time persistence for us.
  useEffect(() => {
    restoreWindowState();
  }, [restoreWindowState]);

  return {
    saveWindowState,
    restoreWindowState,
    saving,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Target List Hook
// ============================================================================

import { targetListApi, type TargetListData, type TargetItem, type TargetStats } from './target-list-api';

export function useTargetList() {
  const [data, setData] = useState<TargetListData | null>(null);
  const [stats, setStats] = useState<TargetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const [listData, statsData] = await Promise.all([
        targetListApi.load(),
        targetListApi.getStats(),
      ]);
      setData(listData);
      setStats(statsData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addTarget = useCallback(async (target: Parameters<typeof targetListApi.addTarget>[0]) => {
    if (!isTauri()) return null;
    try {
      const result = await targetListApi.addTarget(target);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const removeTarget = useCallback(async (targetId: string) => {
    if (!isTauri()) return null;
    try {
      const result = await targetListApi.removeTarget(targetId);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const updateTarget = useCallback(async (targetId: string, updates: Partial<TargetItem>) => {
    if (!isTauri()) return null;
    try {
      const result = await targetListApi.updateTarget(targetId, updates);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const setActiveTarget = useCallback(async (targetId: string | null) => {
    if (!isTauri()) return null;
    try {
      const result = await targetListApi.setActiveTarget(targetId);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const toggleFavorite = useCallback(async (targetId: string) => {
    if (!isTauri()) return null;
    try {
      const result = await targetListApi.toggleFavorite(targetId);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  return {
    targets: data?.targets ?? [],
    availableTags: data?.available_tags ?? [],
    activeTargetId: data?.active_target_id ?? null,
    stats,
    loading,
    error,
    refresh: load,
    addTarget,
    removeTarget,
    updateTarget,
    setActiveTarget,
    toggleFavorite,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Markers Hook
// ============================================================================

import { markersApi, type MarkersData, type MarkerInput, type MarkerUpdateInput } from './markers-api';

export function useMarkers() {
  const [data, setData] = useState<MarkersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const markersData = await markersApi.load();
      setData(markersData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addMarker = useCallback(async (marker: MarkerInput) => {
    if (!isTauri()) return null;
    try {
      const result = await markersApi.addMarker(marker);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const removeMarker = useCallback(async (markerId: string) => {
    if (!isTauri()) return null;
    try {
      const result = await markersApi.removeMarker(markerId);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const updateMarker = useCallback(async (markerId: string, updates: MarkerUpdateInput) => {
    if (!isTauri()) return null;
    try {
      const result = await markersApi.updateMarker(markerId, updates);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const toggleVisibility = useCallback(async (markerId: string) => {
    if (!isTauri()) return null;
    try {
      const result = await markersApi.toggleVisibility(markerId);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const setShowMarkers = useCallback(async (show: boolean) => {
    if (!isTauri()) return null;
    try {
      const result = await markersApi.setShowMarkers(show);
      setData(result);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  return {
    markers: data?.markers ?? [],
    groups: data?.groups ?? [],
    showMarkers: data?.show_markers ?? true,
    loading,
    error,
    refresh: load,
    addMarker,
    removeMarker,
    updateMarker,
    toggleVisibility,
    setShowMarkers,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Astronomy Hook
// ============================================================================

import { astronomyApi, type MoonPhase, type MoonPosition, type SunPosition, type VisibilityInfo } from './astronomy-api';

export function useAstronomy(latitude?: number, longitude?: number) {
  const [moonPhase, setMoonPhase] = useState<MoonPhase | null>(null);
  const [moonPosition, setMoonPosition] = useState<MoonPosition | null>(null);
  const [sunPosition, setSunPosition] = useState<SunPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    if (latitude === undefined || longitude === undefined) return;
    
    try {
      setLoading(true);
      const timestamp = Math.floor(Date.now() / 1000);
      const [phase, moon, sun] = await Promise.all([
        astronomyApi.celestial.getMoonPhase(timestamp),
        astronomyApi.celestial.getMoonPosition(latitude, longitude, timestamp),
        astronomyApi.celestial.getSunPosition(latitude, longitude, timestamp),
      ]);
      setMoonPhase(phase);
      setMoonPosition(moon);
      setSunPosition(sun);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getVisibility = useCallback(async (ra: number, dec: number, minAltitude?: number): Promise<VisibilityInfo | null> => {
    if (!isTauri()) return null;
    if (latitude === undefined || longitude === undefined) return null;
    
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      return await astronomyApi.visibility.calculateVisibility(ra, dec, latitude, longitude, timestamp, minAltitude);
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [latitude, longitude]);

  return {
    moonPhase,
    moonPosition,
    sunPosition,
    loading,
    error,
    refresh,
    getVisibility,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Cache Hook
// ============================================================================

import { cacheApi, type CacheStats, type CacheRegion } from './cache-api';

export function useCache() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [regions, setRegions] = useState<CacheRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const [statsData, regionsData] = await Promise.all([
        cacheApi.getStats(),
        cacheApi.listRegions(),
      ]);
      setStats(statsData);
      setRegions(regionsData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clearAll = useCallback(async () => {
    if (!isTauri()) return 0;
    try {
      const count = await cacheApi.clearAllCache();
      await load();
      return count;
    } catch (e) {
      setError((e as Error).message);
      return 0;
    }
  }, [load]);

  const clearSurvey = useCallback(async (surveyId: string) => {
    if (!isTauri()) return 0;
    try {
      const count = await cacheApi.clearSurveyCache(surveyId);
      await load();
      return count;
    } catch (e) {
      setError((e as Error).message);
      return 0;
    }
  }, [load]);

  return {
    stats,
    regions,
    loading,
    error,
    refresh: load,
    clearAll,
    clearSurvey,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Astro Events Hook
// ============================================================================

import { eventsApi, type AstroEvent, type MeteorShowerInfo } from './events-api';
import { geolocationApi, type Position, type PermissionStatus, type WatchId } from './geolocation-api';
import { isMobile } from '@/lib/storage/platform';

export function useAstroEvents(startDate?: string, endDate?: string) {
  const [events, setEvents] = useState<AstroEvent[]>([]);
  const [meteorShowers, setMeteorShowers] = useState<MeteorShowerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isTauri()) return;
    if (!startDate || !endDate) return;
    
    try {
      setLoading(true);
      const year = new Date().getFullYear();
      const [eventsData, showersData] = await Promise.all([
        eventsApi.getAstroEvents(startDate, endDate),
        eventsApi.getMeteorShowers(year),
      ]);
      setEvents(eventsData);
      setMeteorShowers(showersData);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  const getTonightHighlights = useCallback(async (latitude: number, longitude: number): Promise<string[]> => {
    if (!isTauri()) return [];
    try {
      return await eventsApi.getTonightHighlights(latitude, longitude);
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  }, []);

  const getDailyEvents = useCallback(async (
    date: string,
    timezone: string,
    includeOngoing: boolean = true
  ): Promise<AstroEvent[]> => {
    if (!isTauri()) return [];
    try {
      return await eventsApi.getDailyAstroEvents(date, timezone, includeOngoing);
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  }, []);

  return {
    events,
    meteorShowers,
    loading,
    error,
    refresh: load,
    getTonightHighlights,
    getDailyEvents,
    isAvailable: isTauri(),
  };
}

// ============================================================================
// Geolocation Hook (Mobile Only)
// ============================================================================

export interface GeolocationState {
  position: Position | null;
  permissionStatus: PermissionStatus | null;
  loading: boolean;
  error: string | null;
  isAvailable: boolean;
  isWatching: boolean;
}

export function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<WatchId | null>(null);

  const isAvailable = isTauri() && isMobile();

  const checkPermissions = useCallback(async (): Promise<PermissionStatus | null> => {
    if (!isAvailable) return null;
    
    try {
      const status = await geolocationApi.checkPermissions();
      setPermissionStatus(status);
      return status;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [isAvailable]);

  const requestPermissions = useCallback(async (): Promise<PermissionStatus | null> => {
    if (!isAvailable) return null;
    
    try {
      const status = await geolocationApi.requestPermissions(['location']);
      setPermissionStatus(status);
      return status;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [isAvailable]);

  const getCurrentPosition = useCallback(async (): Promise<Position | null> => {
    if (!isAvailable) return null;
    
    try {
      setLoading(true);
      setError(null);
      const pos = await geolocationApi.getPositionWithPermission({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      setPosition(pos);
      return pos;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isAvailable]);

  const startWatching = useCallback(async (): Promise<boolean> => {
    if (!isAvailable) return false;
    if (watchId !== null) return true; // Already watching
    
    try {
      setError(null);
      const id = await geolocationApi.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        (pos, err) => {
          if (err) {
            setError(err);
          } else if (pos) {
            setPosition(pos);
          }
        }
      );
      setWatchId(id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }, [isAvailable, watchId]);

  const stopWatching = useCallback(async () => {
    if (watchId === null) return;
    
    try {
      await geolocationApi.clearWatch(watchId);
      setWatchId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [watchId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        geolocationApi.clearWatch(watchId).catch(err => logger.error('Failed to clear geolocation watch', err));
      }
    };
  }, [watchId]);

  return {
    position,
    permissionStatus,
    loading,
    error,
    isAvailable,
    isWatching: watchId !== null,
    checkPermissions,
    requestPermissions,
    getCurrentPosition,
    startWatching,
    stopWatching,
  };
}
