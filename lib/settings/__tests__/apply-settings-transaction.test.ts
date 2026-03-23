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

const mockApplyCanonicalObservationLocation = jest.fn();

jest.mock('@/lib/services/observation-location-controller', () => ({
  applyCanonicalObservationLocation: (...args: unknown[]) => mockApplyCanonicalObservationLocation(...args),
}));

import { useMountStore } from '@/lib/stores/mount-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { createDefaultSettingsDraft } from '../settings-draft';
import { applySettingsTransaction } from '../apply-settings-transaction';

describe('apply-settings-transaction', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      connection: { ip: 'localhost', port: '1888' },
      backendProtocol: 'http',
      proxy: {
        mode: 'auto',
        manualUrl: '',
        fallbackToDirectOnFailure: true,
      },
      preferences: {
        ...useSettingsStore.getState().preferences,
        locale: 'en',
      },
    });

    useMountStore.setState({
      profileInfo: {
        AstrometrySettings: {
          Latitude: 0,
          Longitude: 0,
          Elevation: 0,
        },
      },
    });
  });

  it('applies settings in deterministic order', async () => {
    const draft = createDefaultSettingsDraft();
    draft.connection = { ip: '127.0.0.1', port: '9999' };
    draft.backendProtocol = 'https';
    draft.proxy = {
      mode: 'manual',
      manualUrl: 'http://127.0.0.1:7890',
      fallbackToDirectOnFailure: false,
    };
    draft.preferences.locale = 'zh';
    draft.location = { latitude: 20, longitude: 30, elevation: 50 };

    mockApplyCanonicalObservationLocation.mockResolvedValue({
      id: 'loc-1',
      name: 'Current Site',
      latitude: 20,
      longitude: 30,
      altitude: 50,
      is_current: true,
      is_default: true,
    });

    const result = await applySettingsTransaction(draft);

    expect(result.success).toBe(true);
    expect(result.appliedDomains).toEqual([
      'connection',
      'preferences',
      'performance',
      'accessibility',
      'notifications',
      'search',
      'location',
    ]);
    expect(useSettingsStore.getState().connection).toEqual({ ip: '127.0.0.1', port: '9999' });
    expect(useSettingsStore.getState().backendProtocol).toBe('https');
    expect(useSettingsStore.getState().proxy).toEqual({
      mode: 'manual',
      manualUrl: 'http://127.0.0.1:7890',
      fallbackToDirectOnFailure: false,
    });
    expect(useSettingsStore.getState().preferences.locale).toBe('zh');
    expect(useMountStore.getState().profileInfo.AstrometrySettings.Latitude).toBe(20);
    expect(mockApplyCanonicalObservationLocation).toHaveBeenCalledWith({
      latitude: 20,
      longitude: 30,
      altitude: 50,
    });
  });

  it('rolls back applied domains on failure', async () => {
    const draft = createDefaultSettingsDraft();
    draft.connection = { ip: '10.0.0.5', port: '1889' };
    draft.preferences.locale = 'zh';

    const result = await applySettingsTransaction(draft, {
      domainOrder: ['connection', 'preferences'],
      domainWriters: {
        preferences: () => {
          throw new Error('forced failure');
        },
      },
    });

    expect(result.success).toBe(false);
    expect(result.failedDomains[0]).toEqual({
      domain: 'preferences',
      error: 'forced failure',
    });
    expect(result.rolledBackDomains).toContain('connection');
    expect(useSettingsStore.getState().connection).toEqual({ ip: 'localhost', port: '1888' });
  });
});
