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
    const state = {
      skyEngine: mockSkyEngine,
      stellarium: { surveyId: 'default', surveyEnabled: true },
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// Mock aladin-compat
jest.mock('@/lib/aladin/aladin-compat', () => ({
  removeImageLayerCompat: jest.fn(),
}));

// Mock sky-surveys
jest.mock('@/lib/core/constants/sky-surveys', () => ({
  getSurveyById: jest.fn(() => ({ url: 'https://example.com/survey' })),
}));

// aladin-lite is resolved via moduleNameMapper → __mocks__/aladin-lite.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const aladinMock = require('aladin-lite').default;

describe('useAladinFits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'aladin';
    window.localStorage.removeItem('aladin-layers-store');
    useAladinStore.getState().resetAladinLayers();
  });

  it('exports the hook correctly', async () => {
    const { useAladinFits } = await import('../use-aladin-fits');
    expect(useAladinFits).toBeDefined();
    expect(typeof useAladinFits).toBe('function');
  });

  it('returns initial empty state', async () => {
    const { useAladinFits } = await import('../use-aladin-fits');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinFits({ aladinRef, engineReady: false })
    );

    expect(result.current.fitsLayers).toEqual([]);
    expect(typeof result.current.addFitsLayer).toBe('function');
    expect(typeof result.current.removeFitsLayer).toBe('function');
    expect(typeof result.current.toggleFitsLayer).toBe('function');
    expect(typeof result.current.setFitsOpacity).toBe('function');
    expect(typeof result.current.setFitsMode).toBe('function');
  });

  it('guards against engine not ready', async () => {
    const { useAladinFits } = await import('../use-aladin-fits');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinFits({ aladinRef, engineReady: false })
    );

    act(() => {
      result.current.addFitsLayer({
        url: 'https://example.com/fits',
        name: 'Test FITS',
        enabled: true,
        opacity: 1,
        mode: 'overlay',
      });
    });

    // Layer is added to store state but aladin is not called
    expect(result.current.fitsLayers).toHaveLength(1);
    expect(result.current.fitsLayers[0]).toEqual(
      expect.objectContaining({
        name: 'Test FITS',
        enabled: true,
      })
    );
    expect(aladinMock.imageHiPS).not.toHaveBeenCalled();
  });

  it('guards against non-aladin engine', async () => {
    mockSkyEngine = 'stellarium';
    const { useAladinFits } = await import('../use-aladin-fits');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinFits({ aladinRef, engineReady: true })
    );

    act(() => {
      result.current.addFitsLayer({
        url: 'https://example.com/fits',
        name: 'Stellarium FITS',
        enabled: true,
        opacity: 1,
        mode: 'base',
      });
    });

    // Layer is in store but aladin engine should not be invoked
    expect(aladinMock.imageHiPS).not.toHaveBeenCalled();
  });

  it('disables a FITS layer when mounting it fails', async () => {
    const { useAladinFits } = await import('../use-aladin-fits');
    const aladinRef = {
      current: {
        setOverlayImageLayer: jest.fn(() => {
          throw new Error('fits failed');
        }),
        setBaseImageLayer: jest.fn(),
        newImageSurvey: jest.fn(),
      },
    };

    useAladinStore.getState().addFitsLayer({
      id: 'broken-fits',
      url: 'https://example.com/fits',
      name: 'Broken FITS',
      enabled: true,
      opacity: 1,
      mode: 'overlay',
    });

    renderHook(() =>
      useAladinFits({ aladinRef: aladinRef as never, engineReady: true })
    );

    await waitFor(() => {
      expect(useAladinStore.getState().fitsLayers.find((layer) => layer.id === 'broken-fits')?.enabled).toBe(false);
    });
  });
});
