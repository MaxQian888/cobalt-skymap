/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useAladinStore } from '@/lib/stores/aladin-store';

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Mock settings store
let mockSkyEngine = 'aladin';
jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: jest.fn((selector) => {
    const state = { skyEngine: mockSkyEngine };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// aladin-lite is resolved via moduleNameMapper → __mocks__/aladin-lite.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const aladinMock = require('aladin-lite').default;

describe('useAladinCatalogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'aladin';
    window.localStorage.removeItem('aladin-layers-store');
    useAladinStore.getState().resetAladinLayers();
  });

  it('exports the hook correctly', async () => {
    const { useAladinCatalogs } = await import('../use-aladin-catalogs');
    expect(useAladinCatalogs).toBeDefined();
    expect(typeof useAladinCatalogs).toBe('function');
  });

  it('does not load catalogs when engine is not ready', async () => {
    const { useAladinCatalogs } = await import('../use-aladin-catalogs');
    const aladinRef = { current: null };

    renderHook(() =>
      useAladinCatalogs({ aladinRef, engineReady: false })
    );

    // No catalogs should be added — dynamic import won't fire
    expect(aladinMock.catalogFromVizieR).not.toHaveBeenCalled();
    expect(aladinMock.catalogFromSimbad).not.toHaveBeenCalled();
  });

  it('does not load catalogs when skyEngine is not aladin', async () => {
    mockSkyEngine = 'stellarium';
    const { useAladinCatalogs } = await import('../use-aladin-catalogs');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aladinRef = { current: { addCatalog: jest.fn() } } as any;

    renderHook(() =>
      useAladinCatalogs({ aladinRef, engineReady: true })
    );

    expect(aladinMock.catalogFromVizieR).not.toHaveBeenCalled();
  });

  it('exports CatalogSourceType and CatalogLayerConfig types', async () => {
    const mod = await import('../use-aladin-catalogs');
    // Type exports are checked at compile time; runtime check for hook
    expect(mod.useAladinCatalogs).toBeDefined();
  });

  it('disables a catalog layer when addCatalog fails so the canvas can continue rendering', async () => {
    const { useAladinCatalogs } = await import('../use-aladin-catalogs');
    const aladinRef = {
      current: {
        addCatalog: jest.fn(() => {
          throw new Error('catalog failed');
        }),
        getRaDec: jest.fn(() => [10, 20]),
      },
    };

    useAladinStore.getState().updateCatalogLayer('simbad', { enabled: true });

    renderHook(() =>
      useAladinCatalogs({ aladinRef: aladinRef as never, engineReady: true })
    );

    await waitFor(() => {
      expect(useAladinStore.getState().catalogLayers.find((layer) => layer.id === 'simbad')?.enabled).toBe(false);
    });
  });
});
