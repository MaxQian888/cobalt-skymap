/**
 * @jest-environment jsdom
 */
import { DEFAULT_MOBILE_PRIORITIZED_TOOLS } from '@/lib/constants/mobile-tools';

let capturedPersistOptions: {
  migrate?: (state: unknown, version: number) => unknown;
  merge?: (persistedState: unknown, currentState: unknown) => unknown;
} | null = null;

jest.mock('zustand/middleware', () => ({
  persist: (
    config: unknown,
    options: {
      migrate?: (state: unknown, version: number) => unknown;
      merge?: (persistedState: unknown, currentState: unknown) => unknown;
    },
  ) => {
    capturedPersistOptions = options;
    return config;
  },
}));

jest.mock('@/lib/storage', () => ({
  getZustandStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

describe('settings-store migration', () => {
  beforeAll(async () => {
    await import('../settings-store');
  });

  it('normalizes invalid prioritized tools in v14 migration', () => {
    const migrate = capturedPersistOptions?.migrate;
    expect(migrate).toBeDefined();

    const migrated = migrate!(
      {
        mobileFeaturePreferences: {
          compactBottomBar: true,
          oneHandMode: true,
          prioritizedTools: ['search', 'tonight', 'tonight'],
        },
      },
      13,
    ) as {
      mobileFeaturePreferences?: { prioritizedTools?: string[] };
    };

    expect(migrated.mobileFeaturePreferences?.prioritizedTools).toEqual([
      'tonight',
      ...DEFAULT_MOBILE_PRIORITIZED_TOOLS.filter((toolId) => toolId !== 'tonight'),
    ]);
  });

  it('fills default order for older migrations after filtering', () => {
    const migrate = capturedPersistOptions?.migrate;
    expect(migrate).toBeDefined();

    const migrated = migrate!(
      {
        skyEngine: 'stellarium',
        mobileFeaturePreferences: {
          compactBottomBar: false,
          oneHandMode: false,
          prioritizedTools: ['target-list', 'equipment-manager', 'equipment-manager'],
        },
      },
      8,
    ) as {
      mobileFeaturePreferences?: { prioritizedTools?: string[] };
    };

    expect(migrated.mobileFeaturePreferences?.prioritizedTools).toEqual([
      'equipment-manager',
      ...DEFAULT_MOBILE_PRIORITIZED_TOOLS.filter((toolId) => toolId !== 'equipment-manager'),
    ]);
  });

  it('normalizes v14 persisted partial mobile preferences in merge', () => {
    const merge = capturedPersistOptions?.merge;
    expect(merge).toBeDefined();

    const merged = merge!(
      {
        mobileFeaturePreferences: {
          compactBottomBar: true,
          oneHandMode: true,
        },
      },
      {
        mobileFeaturePreferences: {
          compactBottomBar: false,
          oneHandMode: false,
          prioritizedTools: DEFAULT_MOBILE_PRIORITIZED_TOOLS,
        },
      },
    ) as {
      mobileFeaturePreferences?: {
        compactBottomBar?: boolean;
        oneHandMode?: boolean;
        prioritizedTools?: string[];
      };
    };

    expect(merged.mobileFeaturePreferences).toEqual({
      compactBottomBar: true,
      oneHandMode: true,
      prioritizedTools: DEFAULT_MOBILE_PRIORITIZED_TOOLS,
    });
  });
});

describe('settings-store migration - additional versions', () => {
  it('should migrate from version < 7 (full reset)', () => {
    const migrate = capturedPersistOptions?.migrate;
    expect(migrate).toBeDefined();

    const migrated = migrate!({ stellarium: { fov: 90 } }, 6) as Record<string, unknown>;
    expect(migrated.skyEngine).toBe('stellarium');
    expect(migrated.observationProfile).toBe('imaging');
    expect(migrated.precisionMode).toBe('core_high_precision');
    expect(migrated.eopUpdatePolicy).toBe('auto_with_offline_fallback');
    expect(migrated.stellarium).toBeDefined();
    expect(migrated.preferences).toBeDefined();
    expect(migrated.performance).toBeDefined();
    expect(migrated.accessibility).toBeDefined();
    expect(migrated.notifications).toBeDefined();
    expect(migrated.search).toBeDefined();
  });

  it('should migrate from version < 9 (add aladinDisplay)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 8) as Record<string, unknown>;
    expect(migrated.aladinDisplay).toBeDefined();
    expect(migrated.observationProfile).toBe('imaging');
  });

  it('should migrate from version < 10 (new Stellarium fields)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 9) as Record<string, unknown>;
    expect(migrated.stellarium).toBeDefined();
    expect(migrated.observationProfile).toBe('imaging');
  });

  it('should migrate from version < 11 (sensor orientation)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 10) as Record<string, unknown>;
    expect(migrated.stellarium).toBeDefined();
    expect(migrated.precisionMode).toBe('core_high_precision');
  });

  it('should migrate from version < 12 (observation & precision)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 11) as Record<string, unknown>;
    expect(migrated.observationProfile).toBe('imaging');
    expect(migrated.precisionMode).toBe('core_high_precision');
    expect(migrated.eopUpdatePolicy).toBe('auto_with_offline_fallback');
  });

  it('should migrate from version < 13 (preferences + mobile)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 12) as Record<string, unknown>;
    expect(migrated.preferences).toBeDefined();
  });

  it('should migrate from version < 15 (AR mode)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 14) as Record<string, unknown>;
    expect(migrated.stellarium).toBeDefined();
  });

  it('should migrate from version < 16 (AR profile/adaptive/network)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 15) as Record<string, unknown>;
    expect(migrated.stellarium).toBeDefined();
  });

  it('should return state as-is for current version', () => {
    const migrate = capturedPersistOptions?.migrate;
    const input = { skyEngine: 'stellarium', foo: 'bar' };
    const migrated = migrate!(input, 19) as Record<string, unknown>;
    expect(migrated.skyEngine).toBe(input.skyEngine);
    expect(migrated.foo).toBe(input.foo);
  });

  it('merge should handle null/undefined persisted state', () => {
    const merge = capturedPersistOptions?.merge;
    expect(merge).toBeDefined();
    const currentState = { skyEngine: 'stellarium', stellarium: { fov: 60 } };
    const merged = merge!(undefined, currentState) as Record<string, unknown>;
    expect(merged.skyEngine).toBe('stellarium');
  });
});

describe('settings-store migration - proxy settings', () => {
  it('should migrate from version < 19 (proxy defaults)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 18) as {
      proxy?: {
        mode?: string;
        manualUrl?: string;
        fallbackToDirectOnFailure?: boolean;
      };
    };

    expect(migrated.proxy).toEqual({
      mode: 'auto',
      manualUrl: '',
      fallbackToDirectOnFailure: true,
    });
  });
});

describe('settings-store migration - AR camera acquisition fields', () => {
  it('should migrate from version < 17 (AR preferred device and last-known-good acquisition)', () => {
    const migrate = capturedPersistOptions?.migrate;
    const migrated = migrate!({ skyEngine: 'stellarium' }, 16) as {
      stellarium?: {
        arCameraPreferredDevice?: unknown;
        arCameraLastKnownGoodAcquisition?: unknown;
      };
    };

    expect(migrated.stellarium?.arCameraPreferredDevice).toEqual({
      deviceId: null,
      label: null,
      groupId: null,
    });
    expect(migrated.stellarium?.arCameraLastKnownGoodAcquisition).toEqual({
      deviceId: null,
      label: null,
      groupId: null,
      facingMode: 'environment',
      stage: null,
      updatedAt: null,
    });
  });
});

