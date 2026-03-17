/**
 * Tauri API wrapper for Rust backend commands
 * Only available in Tauri desktop environment
 */

import { isTauri } from '@/lib/storage/platform';
import { mapKeysApi } from './map-keys-api';
import { positionerApi } from './positioner-api';
import {
  restoreWindowState as restorePluginWindowState,
  saveWindowState as savePluginWindowState,
} from './app-control-api';
import type {
  EquipmentData,
  Telescope,
  Camera,
  Eyepiece,
  BarlowReducer,
  Filter,
  LocationsData,
  ObservationLocation,
  ObservationLogData,
  ObservationSession,
  Observation,
  ObservationStats,
  CreatePlannedSessionPayload,
  ObservationQueryFilters,
  ObservationSearchHit,
  TargetExportItem,
  ImportTargetsResult,
  ExportFormat,
  SessionTemplateEntry,
  AppSettings,
  SystemInfo,
} from './types';

// Lazy import to avoid errors in web environment
async function getInvoke() {
  if (!isTauri()) {
    throw new Error('Tauri API is only available in desktop environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

// ============================================================================
// Equipment API
// ============================================================================

export const equipmentApi = {
  async load(): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('load_equipment');
  },

  async save(equipment: EquipmentData): Promise<void> {
    const invoke = await getInvoke();
    return invoke('save_equipment', { equipment });
  },

  async addTelescope(telescope: Omit<Telescope, 'id' | 'created_at' | 'updated_at'>): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('add_telescope', { telescope });
  },

  async addCamera(camera: Omit<Camera, 'id' | 'created_at' | 'updated_at'>): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('add_camera', { camera });
  },

  async addEyepiece(eyepiece: Omit<Eyepiece, 'id' | 'created_at' | 'updated_at'>): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('add_eyepiece', { eyepiece });
  },

  async delete(equipmentId: string): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('delete_equipment', { equipmentId });
  },

  async addBarlowReducer(barlow: { name: string; factor: number; notes?: string }): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('add_barlow_reducer', { barlow });
  },

  async addFilter(filter: { name: string; filter_type: string; bandwidth?: number; notes?: string }): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('add_filter', { filter });
  },

  async updateTelescope(telescope: Telescope): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('update_telescope', { telescope });
  },

  async updateCamera(camera: Camera): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('update_camera', { camera });
  },

  async updateEyepiece(eyepiece: Eyepiece): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('update_eyepiece', { eyepiece });
  },

  async updateBarlowReducer(barlow: BarlowReducer): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('update_barlow_reducer', { barlow });
  },

  async updateFilter(filter: Filter): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('update_filter', { filter });
  },

  async setDefaultTelescope(telescopeId: string): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('set_default_telescope', { telescopeId });
  },

  async setDefaultCamera(cameraId: string): Promise<EquipmentData> {
    const invoke = await getInvoke();
    return invoke('set_default_camera', { cameraId });
  },

  async getDefaultTelescope(): Promise<Telescope | null> {
    const invoke = await getInvoke();
    return invoke('get_default_telescope');
  },

  async getDefaultCamera(): Promise<Camera | null> {
    const invoke = await getInvoke();
    return invoke('get_default_camera');
  },
};

// ============================================================================
// Locations API
// ============================================================================

export const locationsApi = {
  async load(): Promise<LocationsData> {
    const invoke = await getInvoke();
    return invoke('load_locations');
  },

  async save(locations: LocationsData): Promise<void> {
    const invoke = await getInvoke();
    return invoke('save_locations', { locations });
  },

  async add(location: Omit<ObservationLocation, 'id' | 'created_at' | 'updated_at'>): Promise<LocationsData> {
    const invoke = await getInvoke();
    return invoke('add_location', { location });
  },

  async update(location: ObservationLocation): Promise<LocationsData> {
    const invoke = await getInvoke();
    return invoke('update_location', { location });
  },

  async delete(locationId: string): Promise<LocationsData> {
    const invoke = await getInvoke();
    return invoke('delete_location', { locationId });
  },

  async setCurrent(locationId: string): Promise<LocationsData> {
    const invoke = await getInvoke();
    return invoke('set_current_location', { locationId });
  },

  async setDefault(locationId: string): Promise<LocationsData> {
    const invoke = await getInvoke();
    return invoke('set_default_location', { locationId });
  },

  async getCurrent(): Promise<ObservationLocation | null> {
    const invoke = await getInvoke();
    return invoke('get_current_location');
  },
};

// ============================================================================
// Observation Log API
// ============================================================================

export const observationLogApi = {
  async load(): Promise<ObservationLogData> {
    const invoke = await getInvoke();
    return invoke('load_observation_log');
  },

  async save(log: ObservationLogData): Promise<void> {
    const invoke = await getInvoke();
    return invoke('save_observation_log', { log });
  },

  async createSession(
    date: string,
    locationId?: string,
    locationName?: string
  ): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('create_session', { date, locationId, locationName });
  },

  async createPlannedSession(
    payload: CreatePlannedSessionPayload,
  ): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('create_planned_session', { payload });
  },

  async addObservation(
    sessionId: string,
    observation: Omit<Observation, 'id' | 'observed_at'>
  ): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('add_observation', { sessionId, observation });
  },

  async updateSession(session: ObservationSession): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('update_session', { session });
  },

  async endSession(sessionId: string): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('end_session', { sessionId });
  },

  async deleteSession(sessionId: string): Promise<void> {
    const invoke = await getInvoke();
    return invoke('delete_session', { sessionId });
  },

  async getStats(): Promise<ObservationStats> {
    const invoke = await getInvoke();
    return invoke('get_observation_stats');
  },

  async search(
    queryOrFilters?: string | ObservationQueryFilters,
    filtersArg?: ObservationQueryFilters,
  ): Promise<ObservationSearchHit[]> {
    const invoke = await getInvoke();

    let query: string | undefined;
    let filters: ObservationQueryFilters | undefined = filtersArg;

    if (typeof queryOrFilters === 'string') {
      query = queryOrFilters;
      if (filters && !filters.text) {
        filters = { ...filters, text: queryOrFilters };
      }
    } else if (queryOrFilters) {
      filters = queryOrFilters;
      query = queryOrFilters.text;
    }

    return invoke('search_observations', { query, filters });
  },

  async updateObservation(
    sessionId: string,
    observation: Observation
  ): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('update_observation', { sessionId, observation });
  },

  async deleteObservation(
    sessionId: string,
    observationId: string
  ): Promise<ObservationSession> {
    const invoke = await getInvoke();
    return invoke('delete_observation', { sessionId, observationId });
  },

  async exportLog(
    format: 'csv' | 'json',
    filters?: ObservationQueryFilters,
  ): Promise<string> {
    const invoke = await getInvoke();
    return invoke('export_observation_log', { format, filters });
  },
};

// ============================================================================
// Target Import/Export API
// ============================================================================

export const targetIoApi = {
  async exportTargets(
    targets: TargetExportItem[],
    format: ExportFormat,
    path?: string
  ): Promise<string> {
    const invoke = await getInvoke();
    return invoke('export_targets', { targets, format, path });
  },

  async importTargets(path?: string): Promise<ImportTargetsResult> {
    const invoke = await getInvoke();
    return invoke('import_targets', { path });
  },
};

// ============================================================================
// Session Planner Import/Export API
// ============================================================================

export const sessionIoApi = {
  async exportSessionPlan(
    content: string,
    format: string,
    path?: string
  ): Promise<string> {
    const invoke = await getInvoke();
    return invoke('export_session_plan', { content, format, path });
  },

  async importSessionPlan(path?: string): Promise<string> {
    const invoke = await getInvoke();
    return invoke('import_session_plan', { path });
  },

  async saveSessionTemplate(name: string, draft: unknown): Promise<SessionTemplateEntry> {
    const invoke = await getInvoke();
    return invoke('save_session_template', { name, draft: JSON.stringify(draft) });
  },

  async loadSessionTemplates(): Promise<SessionTemplateEntry[]> {
    const invoke = await getInvoke();
    return invoke('load_session_templates');
  },
};

// ============================================================================
// App Settings API
// ============================================================================

export const appSettingsApi = {
  async load(): Promise<AppSettings> {
    const invoke = await getInvoke();
    return invoke('load_app_settings');
  },

  async save(settings: AppSettings): Promise<void> {
    const invoke = await getInvoke();
    return invoke('save_app_settings', { settings });
  },

  async saveWindowState(): Promise<void> {
    return savePluginWindowState();
  },

  async restoreWindowState(): Promise<void> {
    return restorePluginWindowState();
  },

  async addRecentFile(path: string, fileType: string): Promise<void> {
    const invoke = await getInvoke();
    return invoke('add_recent_file', { path, fileType });
  },

  async clearRecentFiles(): Promise<void> {
    const invoke = await getInvoke();
    return invoke('clear_recent_files');
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const invoke = await getInvoke();
    return invoke('get_system_info');
  },

  async openPath(path: string): Promise<void> {
    const invoke = await getInvoke();
    return invoke('open_path', { path });
  },

  async revealInFileManager(path: string): Promise<void> {
    const invoke = await getInvoke();
    return invoke('reveal_in_file_manager', { path });
  },
};

// ============================================================================
// Unified API Object
// ============================================================================

export const tauriApi = {
  equipment: equipmentApi,
  locations: locationsApi,
  observationLog: observationLogApi,
  targetIo: targetIoApi,
  sessionIo: sessionIoApi,
  appSettings: appSettingsApi,
  mapKeys: mapKeysApi,
  positioner: positionerApi,
  
  /** Check if Tauri API is available */
  isAvailable: isTauri,
};

export default tauriApi;
