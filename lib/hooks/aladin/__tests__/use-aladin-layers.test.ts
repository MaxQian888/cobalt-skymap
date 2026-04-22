/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
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

describe('useAladinLayers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'aladin';
    window.localStorage.removeItem('aladin-layers-store');
    useAladinStore.getState().resetAladinLayers();
  });

  it('exports the hook correctly', async () => {
    const { useAladinLayers } = await import('../use-aladin-layers');
    expect(useAladinLayers).toBeDefined();
    expect(typeof useAladinLayers).toBe('function');
  });

  it('returns initial empty overlay layers', async () => {
    const { useAladinLayers } = await import('../use-aladin-layers');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinLayers({ aladinRef, engineReady: false })
    );

    expect(result.current.overlayLayers).toEqual([]);
    expect(typeof result.current.addOverlayLayer).toBe('function');
    expect(typeof result.current.removeOverlayLayer).toBe('function');
    expect(typeof result.current.setOverlayOpacity).toBe('function');
    expect(typeof result.current.setOverlayBlending).toBe('function');
  });

  it('does not add layer when engine not ready', async () => {
    const { useAladinLayers } = await import('../use-aladin-layers');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinLayers({ aladinRef, engineReady: false })
    );

    act(() => {
      result.current.addOverlayLayer('CDS/P/DSS2/color', 'DSS2 Color');
    });

    expect(result.current.overlayLayers).toHaveLength(1);
    expect(result.current.overlayLayers[0]).toEqual(
      expect.objectContaining({
        name: 'DSS2 Color',
        enabled: true,
      })
    );
    expect(aladinMock.imageHiPS).not.toHaveBeenCalled();
  });

  it('disables an overlay layer when Aladin rejects it', async () => {
    const { useAladinLayers } = await import('../use-aladin-layers');
    const aladinRef = {
      current: {
        setOverlayImageLayer: jest.fn(() => {
          throw new Error('overlay failed');
        }),
      },
    };

    useAladinStore.getState().addImageOverlayLayer({
      id: 'broken-overlay',
      name: 'Broken',
      surveyId: 'CDS/P/DSS2/color',
      enabled: true,
      opacity: 0.5,
      additive: false,
    });

    renderHook(() =>
      useAladinLayers({ aladinRef: aladinRef as never, engineReady: true })
    );

    await waitFor(() => {
      expect(useAladinStore.getState().imageOverlayLayers.find((layer) => layer.id === 'broken-overlay')?.enabled).toBe(false);
    });
  });
});
