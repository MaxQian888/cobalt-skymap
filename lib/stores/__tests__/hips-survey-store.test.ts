import { act, renderHook } from '@testing-library/react';
import { useHipsSurveyStore } from '../hips-survey-store';
import type { HiPSSurvey } from '@/lib/services/hips/types';

const gaia: HiPSSurvey = {
  id: 'CDS-I-355-gaiadr3',
  name: 'Gaia DR3',
  url: 'https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3',
  catalogServiceUrl: 'https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3',
  category: 'optical',
  kind: 'catalog',
};

describe('useHipsSurveyStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useHipsSurveyStore());
    act(() => {
      result.current.setSelectedSurvey(null);
      result.current.setDiscoveredCatalogs([]);
      // clear favorites
      result.current.favoriteSurveyIds.forEach((id) => result.current.toggleFavorite(id));
    });
  });

  it('starts with no selection and empty collections', () => {
    const { result } = renderHook(() => useHipsSurveyStore());
    expect(result.current.selectedSurveyId).toBeNull();
    expect(result.current.favoriteSurveyIds).toEqual([]);
    expect(result.current.discoveredCatalogs).toEqual([]);
  });

  it('sets the selected survey', () => {
    const { result } = renderHook(() => useHipsSurveyStore());
    act(() => result.current.setSelectedSurvey('CDS-I-355-gaiadr3'));
    expect(result.current.selectedSurveyId).toBe('CDS-I-355-gaiadr3');
  });

  it('toggles a favorite on and off', () => {
    const { result } = renderHook(() => useHipsSurveyStore());
    act(() => result.current.toggleFavorite('CDS-I-355-gaiadr3'));
    expect(result.current.favoriteSurveyIds).toContain('CDS-I-355-gaiadr3');
    act(() => result.current.toggleFavorite('CDS-I-355-gaiadr3'));
    expect(result.current.favoriteSurveyIds).not.toContain('CDS-I-355-gaiadr3');
  });

  it('stores discovered catalogs', () => {
    const { result } = renderHook(() => useHipsSurveyStore());
    act(() => result.current.setDiscoveredCatalogs([gaia]));
    expect(result.current.discoveredCatalogs).toHaveLength(1);
    expect(result.current.discoveredCatalogs[0].id).toBe('CDS-I-355-gaiadr3');
  });
});
