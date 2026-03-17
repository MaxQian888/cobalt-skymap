/**
 * @jest-environment jsdom
 */

// Mock isTauri
jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => true),
}));

// Mock @tauri-apps/api/core
const mockInvoke = jest.fn();
jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const mockSaveWindowState = jest.fn();
const mockRestoreWindowState = jest.fn();
jest.mock('../app-control-api', () => ({
  saveWindowState: (...args: unknown[]) => mockSaveWindowState(...args),
  restoreWindowState: (...args: unknown[]) => mockRestoreWindowState(...args),
}));

import { isTauri } from '@/lib/storage/platform';
import {
  equipmentApi,
  locationsApi,
  observationLogApi,
  targetIoApi,
  appSettingsApi,
  tauriApi,
} from '../api';

const mockIsTauri = isTauri as jest.Mock;

describe('equipmentApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should load equipment', async () => {
    const mockEquipment = { telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [] };
    mockInvoke.mockResolvedValue(mockEquipment);

    const result = await equipmentApi.load();

    expect(mockInvoke).toHaveBeenCalledWith('load_equipment');
    expect(result).toEqual(mockEquipment);
  });

  it('should save equipment', async () => {
    const mockEquipment = { telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [] };
    mockInvoke.mockResolvedValue(undefined);

    await equipmentApi.save(mockEquipment);

    expect(mockInvoke).toHaveBeenCalledWith('save_equipment', { equipment: mockEquipment });
  });

  it('should add telescope', async () => {
    const telescope = { name: 'Test', focal_length: 1000, aperture: 200, focal_ratio: 5, telescope_type: 'refractor' as const, is_default: false };
    mockInvoke.mockResolvedValue({ telescopes: [{ id: '1', ...telescope }], cameras: [], barlow_reducers: [], eyepieces: [], filters: [] });

    const result = await equipmentApi.addTelescope(telescope);

    expect(mockInvoke).toHaveBeenCalledWith('add_telescope', { telescope });
    expect(result.telescopes.length).toBe(1);
  });

  it('should add camera', async () => {
    const camera = { name: 'Test Camera', sensor_width: 36, sensor_height: 24, pixel_size: 4.5, resolution_x: 6000, resolution_y: 4000, camera_type: 'cmos' as const, has_cooler: false, is_default: false };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [{ id: '1', ...camera }], barlow_reducers: [], eyepieces: [], filters: [] });

    const result = await equipmentApi.addCamera(camera);

    expect(mockInvoke).toHaveBeenCalledWith('add_camera', { camera });
    expect(result.cameras.length).toBe(1);
  });

  it('should add eyepiece', async () => {
    const eyepiece = { name: 'Test Eyepiece', focal_length: 25, apparent_fov: 68, barrel_size: 1.25 };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [{ id: '1', ...eyepiece }], filters: [] });

    const result = await equipmentApi.addEyepiece(eyepiece);

    expect(mockInvoke).toHaveBeenCalledWith('add_eyepiece', { eyepiece });
    expect(result.eyepieces.length).toBe(1);
  });

  it('should add barlow reducer', async () => {
    const barlow = { name: 'Test Barlow', factor: 2 };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [{ id: '1', ...barlow }], eyepieces: [], filters: [] });

    const result = await equipmentApi.addBarlowReducer(barlow);

    expect(mockInvoke).toHaveBeenCalledWith('add_barlow_reducer', { barlow });
    expect(result.barlow_reducers.length).toBe(1);
  });

  it('should add filter', async () => {
    const filter = { name: 'Test Filter', filter_type: 'ha' as const, bandwidth: 7 };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [{ id: '1', ...filter }] });

    const result = await equipmentApi.addFilter(filter);

    expect(mockInvoke).toHaveBeenCalledWith('add_filter', { filter });
    expect(result.filters.length).toBe(1);
  });

  it('should delete equipment', async () => {
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [] });

    const result = await equipmentApi.delete('equipment-1');

    expect(mockInvoke).toHaveBeenCalledWith('delete_equipment', { equipmentId: 'equipment-1' });
    expect(result).toBeDefined();
  });

  it('should update telescope', async () => {
    const telescope = { id: '1', name: 'Updated', focal_length: 1200, aperture: 250, focal_ratio: 4.8, telescope_type: 'refractor' as const, is_default: false, created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue({ telescopes: [telescope], cameras: [], barlow_reducers: [], eyepieces: [], filters: [] });

    const result = await equipmentApi.updateTelescope(telescope);

    expect(mockInvoke).toHaveBeenCalledWith('update_telescope', { telescope });
    expect(result.telescopes[0].name).toBe('Updated');
  });

  it('should update camera', async () => {
    const camera = { id: '1', name: 'Updated Camera', sensor_width: 36, sensor_height: 24, pixel_size: 4.5, resolution_x: 6000, resolution_y: 4000, camera_type: 'cmos' as const, has_cooler: false, is_default: false, created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [camera], barlow_reducers: [], eyepieces: [], filters: [] });

    const result = await equipmentApi.updateCamera(camera);

    expect(mockInvoke).toHaveBeenCalledWith('update_camera', { camera });
    expect(result.cameras[0].name).toBe('Updated Camera');
  });

  it('should update eyepiece', async () => {
    const eyepiece = { id: '1', name: 'Updated Eyepiece', focal_length: 20, apparent_fov: 72, barrel_size: 1.25, created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [eyepiece], filters: [] });

    const result = await equipmentApi.updateEyepiece(eyepiece);

    expect(mockInvoke).toHaveBeenCalledWith('update_eyepiece', { eyepiece });
    expect(result.eyepieces[0].name).toBe('Updated Eyepiece');
  });

  it('should update barlow reducer', async () => {
    const barlow = { id: '1', name: 'Updated Barlow', factor: 3, created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [barlow], eyepieces: [], filters: [] });

    const result = await equipmentApi.updateBarlowReducer(barlow);

    expect(mockInvoke).toHaveBeenCalledWith('update_barlow_reducer', { barlow });
    expect(result.barlow_reducers[0].factor).toBe(3);
  });

  it('should update filter', async () => {
    const filter = { id: '1', name: 'Updated Filter', filter_type: 'luminance' as const, bandwidth: 100, created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [filter] });

    const result = await equipmentApi.updateFilter(filter);

    expect(mockInvoke).toHaveBeenCalledWith('update_filter', { filter });
    expect(result.filters[0].name).toBe('Updated Filter');
  });

  it('should set default telescope', async () => {
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [], default_telescope_id: 'telescope-1' });

    const result = await equipmentApi.setDefaultTelescope('telescope-1');

    expect(mockInvoke).toHaveBeenCalledWith('set_default_telescope', { telescopeId: 'telescope-1' });
    expect(result).toBeDefined();
  });

  it('should set default camera', async () => {
    mockInvoke.mockResolvedValue({ telescopes: [], cameras: [], barlow_reducers: [], eyepieces: [], filters: [], default_camera_id: 'camera-1' });

    const result = await equipmentApi.setDefaultCamera('camera-1');

    expect(mockInvoke).toHaveBeenCalledWith('set_default_camera', { cameraId: 'camera-1' });
    expect(result).toBeDefined();
  });

  it('should get default telescope', async () => {
    const telescope = { id: '1', name: 'Default Telescope', focal_length: 1000, aperture: 200 };
    mockInvoke.mockResolvedValue(telescope);

    const result = await equipmentApi.getDefaultTelescope();

    expect(mockInvoke).toHaveBeenCalledWith('get_default_telescope');
    expect(result).toEqual(telescope);
  });

  it('should get default camera', async () => {
    const camera = { id: '1', name: 'Default Camera', sensor_width: 36, sensor_height: 24, pixel_size: 4.5 };
    mockInvoke.mockResolvedValue(camera);

    const result = await equipmentApi.getDefaultCamera();

    expect(mockInvoke).toHaveBeenCalledWith('get_default_camera');
    expect(result).toEqual(camera);
  });

  it('should throw error when not in Tauri', async () => {
    mockIsTauri.mockReturnValue(false);

    await expect(equipmentApi.load()).rejects.toThrow('Tauri API is only available in desktop environment');
  });
});

describe('locationsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should load locations', async () => {
    const mockLocations = { locations: [], default_location_id: null };
    mockInvoke.mockResolvedValue(mockLocations);

    const result = await locationsApi.load();

    expect(mockInvoke).toHaveBeenCalledWith('load_locations');
    expect(result).toEqual(mockLocations);
  });

  it('should save locations', async () => {
    const locations = { locations: [], default_location_id: null };
    mockInvoke.mockResolvedValue(undefined);

    await locationsApi.save(locations);

    expect(mockInvoke).toHaveBeenCalledWith('save_locations', { locations });
  });

  it('should add location', async () => {
    const location = { name: 'Test Location', latitude: 45, longitude: -75, altitude: 100, is_default: false, is_current: false };
    mockInvoke.mockResolvedValue({ locations: [{ id: '1', ...location }], default_location_id: null });

    const result = await locationsApi.add(location);

    expect(mockInvoke).toHaveBeenCalledWith('add_location', { location });
    expect(result.locations.length).toBe(1);
  });

  it('should update location', async () => {
    const location = { id: '1', name: 'Updated Location', latitude: 46, longitude: -76, altitude: 200, is_default: false, is_current: false, created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue({ locations: [location], default_location_id: null });

    const result = await locationsApi.update(location);

    expect(mockInvoke).toHaveBeenCalledWith('update_location', { location });
    expect(result.locations[0].name).toBe('Updated Location');
  });

  it('should delete location', async () => {
    mockInvoke.mockResolvedValue({ locations: [], default_location_id: null });

    const result = await locationsApi.delete('location-1');

    expect(mockInvoke).toHaveBeenCalledWith('delete_location', { locationId: 'location-1' });
    expect(result).toBeDefined();
  });

  it('should set current location', async () => {
    mockInvoke.mockResolvedValue({ locations: [], current_location_id: 'location-1' });

    const result = await locationsApi.setCurrent('location-1');

    expect(mockInvoke).toHaveBeenCalledWith('set_current_location', { locationId: 'location-1' });
    expect(result.current_location_id).toBe('location-1');
  });

  it('should set default location', async () => {
    mockInvoke.mockResolvedValue({ locations: [], current_location_id: undefined });

    const result = await locationsApi.setDefault('location-1');

    expect(mockInvoke).toHaveBeenCalledWith('set_default_location', { locationId: 'location-1' });
    expect(result).toBeDefined();
  });

  it('should get current location', async () => {
    const location = { id: '1', name: 'Current Location', latitude: 45, longitude: -75, altitude: 100 };
    mockInvoke.mockResolvedValue(location);

    const result = await locationsApi.getCurrent();

    expect(mockInvoke).toHaveBeenCalledWith('get_current_location');
    expect(result).toEqual(location);
  });
});

describe('observationLogApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should load observation log', async () => {
    const mockLog = { sessions: [], version: 1 };
    mockInvoke.mockResolvedValue(mockLog);

    const result = await observationLogApi.load();

    expect(mockInvoke).toHaveBeenCalledWith('load_observation_log');
    expect(result).toEqual(mockLog);
  });

  it('should save observation log', async () => {
    const log = { sessions: [], version: 1 };
    mockInvoke.mockResolvedValue(undefined);

    await observationLogApi.save(log);

    expect(mockInvoke).toHaveBeenCalledWith('save_observation_log', { log });
  });

  it('should create session', async () => {
    const mockSession = { id: '1', date: '2024-01-01', observations: [] };
    mockInvoke.mockResolvedValue(mockSession);

    const result = await observationLogApi.createSession('2024-01-01', 'loc-1', 'Home');

    expect(mockInvoke).toHaveBeenCalledWith('create_session', { date: '2024-01-01', locationId: 'loc-1', locationName: 'Home' });
    expect(result).toEqual(mockSession);
  });

  it('should add observation', async () => {
    const observation = { object_name: 'M31', object_type: 'galaxy', notes: 'Great view', image_paths: [] };
    const mockSession = { id: '1', date: '2024-01-01', observations: [{ id: '1', ...observation }] };
    mockInvoke.mockResolvedValue(mockSession);

    const result = await observationLogApi.addObservation('session-1', observation);

    expect(mockInvoke).toHaveBeenCalledWith('add_observation', { sessionId: 'session-1', observation });
    expect(result.observations.length).toBe(1);
  });

  it('should create a planned session with execution payload', async () => {
    const payload = {
      planDate: '2026-03-06',
      locationId: 'loc-1',
      locationName: 'Backyard',
      sourcePlanId: 'plan-1',
      sourcePlanName: 'Tonight Plan',
      executionTargets: [
        {
          id: 'plan-1-m31',
          targetId: 'm31',
          targetName: 'M31',
          scheduledStart: '2026-03-06T12:00:00.000Z',
          scheduledEnd: '2026-03-06T13:30:00.000Z',
          scheduledDurationMinutes: 90,
          order: 1,
          status: 'planned' as const,
          observationIds: [],
        },
      ],
    };
    mockInvoke.mockResolvedValue({
      id: 'session-1',
      date: '2026-03-06',
      observations: [],
      equipment_ids: [],
      execution_status: 'active',
      created_at: '',
      updated_at: '',
    });

    const result = await observationLogApi.createPlannedSession(payload);

    expect(mockInvoke).toHaveBeenCalledWith('create_planned_session', { payload });
    expect(result.execution_status).toBe('active');
  });

  it('should update session', async () => {
    const session = { id: '1', date: '2024-01-01', notes: 'Updated notes', observations: [], equipment_ids: [], created_at: '', updated_at: '' };
    mockInvoke.mockResolvedValue(session);

    const result = await observationLogApi.updateSession(session);

    expect(mockInvoke).toHaveBeenCalledWith('update_session', { session });
    expect(result.notes).toBe('Updated notes');
  });

  it('should end session', async () => {
    const mockSession = { id: '1', date: '2024-01-01', end_time: '2024-01-02T00:00:00Z', observations: [], equipment_ids: [], created_at: '2024-01-01', updated_at: '2024-01-01' };
    mockInvoke.mockResolvedValue(mockSession);

    const result = await observationLogApi.endSession('session-1');

    expect(mockInvoke).toHaveBeenCalledWith('end_session', { sessionId: 'session-1' });
    expect(result.end_time).toBeDefined();
  });

  it('should delete session', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await observationLogApi.deleteSession('session-1');

    expect(mockInvoke).toHaveBeenCalledWith('delete_session', { sessionId: 'session-1' });
  });

  it('should get stats', async () => {
    const mockStats = { totalObservations: 100, uniqueObjects: 50, totalSessions: 20 };
    mockInvoke.mockResolvedValue(mockStats);

    const result = await observationLogApi.getStats();

    expect(mockInvoke).toHaveBeenCalledWith('get_observation_stats');
    expect(result).toEqual(mockStats);
  });

  it('should search observations', async () => {
    const mockObservations = [{ id: '1', object_name: 'M31', object_type: 'galaxy', session_id: 's1', session_date: '2024-01-01' }];
    mockInvoke.mockResolvedValue(mockObservations);

    const result = await observationLogApi.search('M31');

    expect(mockInvoke).toHaveBeenCalledWith('search_observations', { query: 'M31', filters: undefined });
    expect(result).toEqual(mockObservations);
  });

  it('should search observations with filter payload', async () => {
    const mockObservations = [{ id: '1', object_name: 'M31', session_id: 's1', session_date: '2024-01-01' }];
    mockInvoke.mockResolvedValue(mockObservations);

    const result = await observationLogApi.search({
      text: 'M31',
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      objectType: 'galaxy',
      minRating: 3,
    });

    expect(mockInvoke).toHaveBeenCalledWith('search_observations', {
      query: 'M31',
      filters: {
        text: 'M31',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        objectType: 'galaxy',
        minRating: 3,
      },
    });
    expect(result).toEqual(mockObservations);
  });

  it('should export observation log with optional filters', async () => {
    mockInvoke.mockResolvedValue('csv-content');

    const result = await observationLogApi.exportLog('csv', {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });

    expect(mockInvoke).toHaveBeenCalledWith('export_observation_log', {
      format: 'csv',
      filters: {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    });
    expect(result).toBe('csv-content');
  });
});

describe('targetIoApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should export targets', async () => {
    const targets = [{ name: 'M31', ra: 10.68, dec: 41.27, ra_string: '00h 42m 44s', dec_string: "+41° 16' 09\"" }];
    mockInvoke.mockResolvedValue('/path/to/export.csv');

    const result = await targetIoApi.exportTargets(targets, 'csv', '/export/path');

    expect(mockInvoke).toHaveBeenCalledWith('export_targets', { targets, format: 'csv', path: '/export/path' });
    expect(result).toBe('/path/to/export.csv');
  });

  it('should import targets', async () => {
    const mockResult = { imported: 10, skipped: 2, errors: [] };
    mockInvoke.mockResolvedValue(mockResult);

    const result = await targetIoApi.importTargets('/path/to/import.csv');

    expect(mockInvoke).toHaveBeenCalledWith('import_targets', { path: '/path/to/import.csv' });
    expect(result).toEqual(mockResult);
  });
});

describe('appSettingsApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
  });

  it('should load settings', async () => {
    const mockSettings = { theme: 'dark', language: 'en' };
    mockInvoke.mockResolvedValue(mockSettings);

    const result = await appSettingsApi.load();

    expect(mockInvoke).toHaveBeenCalledWith('load_app_settings');
    expect(result).toEqual(mockSettings);
  });

  it('should save settings', async () => {
    const settings = { theme: 'light', language: 'zh', window_state: { width: 1200, height: 800, x: 0, y: 0, maximized: false, fullscreen: false }, recent_files: [], auto_save_interval: 300, check_updates: true, telemetry_enabled: false, sidebar_collapsed: false, show_welcome: true };
    mockInvoke.mockResolvedValue(undefined);

    await appSettingsApi.save(settings);

    expect(mockInvoke).toHaveBeenCalledWith('save_app_settings', { settings });
  });

  it('should save window state', async () => {
    mockSaveWindowState.mockResolvedValue(undefined);

    await appSettingsApi.saveWindowState();

    expect(mockSaveWindowState).toHaveBeenCalled();
  });

  it('should restore window state', async () => {
    mockRestoreWindowState.mockResolvedValue(undefined);

    await appSettingsApi.restoreWindowState();

    expect(mockRestoreWindowState).toHaveBeenCalled();
  });

  it('should add recent file', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await appSettingsApi.addRecentFile('/path/to/file.txt', 'text');

    expect(mockInvoke).toHaveBeenCalledWith('add_recent_file', { path: '/path/to/file.txt', fileType: 'text' });
  });

  it('should clear recent files', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await appSettingsApi.clearRecentFiles();

    expect(mockInvoke).toHaveBeenCalledWith('clear_recent_files');
  });

  it('should get system info', async () => {
    const mockSystemInfo = {
      os: 'windows',
      arch: 'x64',
      app_version: '1.0.0',
      tauri_version: '2.9.0',
      platform: 'windows',
      family: 'windows',
      os_type: 'Windows_NT',
      os_version: '11',
      locale: 'en-US',
      host_id: 'host-1234abcd',
    };
    mockInvoke.mockResolvedValue(mockSystemInfo);

    const result = await appSettingsApi.getSystemInfo();

    expect(mockInvoke).toHaveBeenCalledWith('get_system_info');
    expect(result).toEqual(mockSystemInfo);
  });

  it('should open path', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await appSettingsApi.openPath('/path/to/open');

    expect(mockInvoke).toHaveBeenCalledWith('open_path', { path: '/path/to/open' });
  });

  it('should reveal in file manager', async () => {
    mockInvoke.mockResolvedValue(undefined);

    await appSettingsApi.revealInFileManager('/path/to/reveal');

    expect(mockInvoke).toHaveBeenCalledWith('reveal_in_file_manager', { path: '/path/to/reveal' });
  });
});

describe('tauriApi', () => {
  it('should have all API modules', () => {
    expect(tauriApi.equipment).toBeDefined();
    expect(tauriApi.locations).toBeDefined();
    expect(tauriApi.observationLog).toBeDefined();
    expect(tauriApi.targetIo).toBeDefined();
    expect(tauriApi.appSettings).toBeDefined();
    expect(tauriApi.positioner).toBeDefined();
  });

  it('should have isAvailable function', () => {
    expect(tauriApi.isAvailable).toBeDefined();
    expect(typeof tauriApi.isAvailable).toBe('function');
  });
});
