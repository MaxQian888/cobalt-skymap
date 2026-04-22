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

describe('useAladinMOC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'aladin';
    window.localStorage.removeItem('aladin-layers-store');
    useAladinStore.getState().resetAladinLayers();
  });

  it('exports the hook and WELL_KNOWN_MOCS', async () => {
    const { useAladinMOC, WELL_KNOWN_MOCS } = await import('../use-aladin-moc');
    expect(useAladinMOC).toBeDefined();
    expect(Array.isArray(WELL_KNOWN_MOCS)).toBe(true);
    expect(WELL_KNOWN_MOCS.length).toBeGreaterThan(0);
    // Each well-known MOC should have name, url, color
    for (const moc of WELL_KNOWN_MOCS) {
      expect(moc).toHaveProperty('name');
      expect(moc).toHaveProperty('url');
      expect(moc).toHaveProperty('color');
    }
  });

  it('returns initial empty MOC layers', async () => {
    const { useAladinMOC } = await import('../use-aladin-moc');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinMOC({ aladinRef, engineReady: false })
    );

    expect(result.current.mocLayers).toEqual([]);
    expect(typeof result.current.addMOC).toBe('function');
    expect(typeof result.current.removeMOC).toBe('function');
    expect(typeof result.current.toggleMOC).toBe('function');
    expect(typeof result.current.setMOCOpacity).toBe('function');
  });

  it('does not add MOC when engine not ready', async () => {
    const { useAladinMOC } = await import('../use-aladin-moc');
    const aladinRef = { current: null };

    const { result } = renderHook(() =>
      useAladinMOC({ aladinRef, engineReady: false })
    );

    act(() => {
      result.current.addMOC('https://example.com/moc', 'Test MOC');
    });

    expect(result.current.mocLayers).toHaveLength(1);
    expect(result.current.mocLayers[0]).toEqual(
      expect.objectContaining({
        name: 'Test MOC',
        visible: true,
      })
    );
    expect(aladinMock.MOCFromURL).not.toHaveBeenCalled();
  });

  it('hides a MOC layer when addMOC fails so the base canvas remains usable', async () => {
    const { useAladinMOC } = await import('../use-aladin-moc');
    const aladinRef = {
      current: {
        addMOC: jest.fn(() => {
          throw new Error('moc failed');
        }),
      },
    };

    useAladinStore.getState().addMocLayer({
      id: 'broken-moc',
      name: 'Broken MOC',
      url: 'https://example.com/moc',
      color: '#3b82f6',
      opacity: 0.3,
      lineWidth: 1,
      visible: true,
    });

    renderHook(() =>
      useAladinMOC({ aladinRef: aladinRef as never, engineReady: true })
    );

    await waitFor(() => {
      expect(useAladinStore.getState().mocLayers.find((layer) => layer.id === 'broken-moc')?.visible).toBe(false);
    });
  });
});
