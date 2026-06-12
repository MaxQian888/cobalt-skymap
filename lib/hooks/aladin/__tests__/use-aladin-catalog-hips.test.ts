/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useHipsSurveyStore } from '@/lib/stores/hips-survey-store';
import type { HiPSSurvey } from '@/lib/services/hips/types';

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() }),
}));

let mockSkyEngine = 'aladin';
jest.mock('@/lib/stores/settings-store', () => ({
  useSettingsStore: jest.fn((selector) => {
    const state = { skyEngine: mockSkyEngine };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

// aladin-lite resolves to __mocks__/aladin-lite.js via moduleNameMapper
// eslint-disable-next-line @typescript-eslint/no-require-imports
const aladinMock = require('aladin-lite').default;

const gaia: HiPSSurvey = {
  id: 'CDS-I-355-gaiadr3',
  name: 'Gaia DR3',
  url: 'https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3',
  catalogServiceUrl: 'https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3',
  category: 'optical',
  kind: 'catalog',
};

describe('useAladinCatalogHips', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSkyEngine = 'aladin';
    useHipsSurveyStore.setState({ discoveredCatalogs: [], selectedSurveyId: null, favoriteSurveyIds: [] });
  });

  it('exports the hook', async () => {
    const { useAladinCatalogHips } = await import('../use-aladin-catalog-hips');
    expect(typeof useAladinCatalogHips).toBe('function');
  });

  it('adds the selected catalog HiPS to the Aladin instance', async () => {
    const { useAladinCatalogHips } = await import('../use-aladin-catalog-hips');
    const aladinRef = { current: { addCatalog: jest.fn(), getRaDec: () => [0, 0] } };

    useHipsSurveyStore.setState({ discoveredCatalogs: [gaia], selectedSurveyId: gaia.id });

    renderHook(() => useAladinCatalogHips({ aladinRef: aladinRef as never, engineReady: true }));

    await waitFor(() =>
      expect(aladinMock.catalogHiPS).toHaveBeenCalledWith(
        gaia.catalogServiceUrl,
        expect.objectContaining({ name: gaia.name })
      )
    );
    expect(aladinRef.current.addCatalog).toHaveBeenCalled();
  });

  it('does nothing when the engine is not ready', async () => {
    const { useAladinCatalogHips } = await import('../use-aladin-catalog-hips');
    const aladinRef = { current: null };
    useHipsSurveyStore.setState({ discoveredCatalogs: [gaia], selectedSurveyId: gaia.id });

    renderHook(() => useAladinCatalogHips({ aladinRef, engineReady: false }));

    expect(aladinMock.catalogHiPS).not.toHaveBeenCalled();
  });

  it('does nothing when skyEngine is not aladin', async () => {
    mockSkyEngine = 'stellarium';
    const { useAladinCatalogHips } = await import('../use-aladin-catalog-hips');
    const aladinRef = { current: { addCatalog: jest.fn(), getRaDec: () => [0, 0] } };
    useHipsSurveyStore.setState({ discoveredCatalogs: [gaia], selectedSurveyId: gaia.id });

    renderHook(() => useAladinCatalogHips({ aladinRef: aladinRef as never, engineReady: true }));

    expect(aladinMock.catalogHiPS).not.toHaveBeenCalled();
  });
});
