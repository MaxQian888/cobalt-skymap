import {
  getDefaultObjectInfoDataSourceConfigs,
  getObjectInfoProviderDefinition,
  getDefaultSearchSourceConfigs,
  getEligibleSearchProviders,
  getRenderEligibleProviders,
} from '../online-data-provider-registry';

describe('online-data-provider-registry', () => {
  it('includes SBDB in default search providers', () => {
    const defaults = getDefaultSearchSourceConfigs();

    expect(defaults.some((source) => source.id === 'sbdb')).toBe(true);
  });

  it('prioritizes small-body-capable providers for minor-object queries', () => {
    expect(getEligibleSearchProviders('minor')).toEqual(
      expect.arrayContaining(['sbdb', 'mpc'])
    );
    expect(getEligibleSearchProviders('minor')[0]).toBe('sbdb');
  });

  it('restricts coordinate search providers to coordinate-capable sources', () => {
    expect(getEligibleSearchProviders('coordinates')).toEqual(['simbad']);
  });

  it('includes cross-surface object-info defaults for description and small-body enrichment', () => {
    const defaults = getDefaultObjectInfoDataSourceConfigs();

    expect(defaults.some((source) => source.id === 'wikipedia')).toBe(true);
    expect(defaults.some((source) => source.id === 'sbdb')).toBe(true);
  });

  it('exposes deterministic render-eligible providers by tier', () => {
    expect(getRenderEligibleProviders('catalog').map((provider) => provider.id)).toEqual([
      'local',
      'stellarium',
    ]);

    expect(getRenderEligibleProviders('survey').map((provider) => provider.id)).toContain('dss');
    expect(getRenderEligibleProviders('enrichment').map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['simbad', 'wikipedia', 'sbdb'])
    );
  });

  it('includes render metadata in object-info data source defaults', () => {
    const defaults = getDefaultObjectInfoDataSourceConfigs();
    const wikipedia = defaults.find((source) => source.id === 'wikipedia');

    expect(wikipedia?.renderTier).toBe('enrichment');
    expect(wikipedia?.fallbackRole).toBeTruthy();
  });

  it('exposes executable support boundaries for object-info providers', () => {
    const simbad = getObjectInfoProviderDefinition('simbad');
    const wikipedia = getObjectInfoProviderDefinition('wikipedia');
    const local = getObjectInfoProviderDefinition('local');

    expect(simbad.objectInfo?.targetClasses).toEqual(
      expect.arrayContaining(['deep-sky', 'star', 'extragalactic'])
    );
    expect(simbad.objectInfo?.responseMode).toBe('json');
    expect(simbad.objectInfo?.authorityLevel).toBe('authoritative');
    expect(simbad.objectInfo?.healthCheck?.strategy).toBe('query');

    expect(wikipedia.objectInfo?.responseMode).toBe('json');
    expect(wikipedia.objectInfo?.authorityLevel).toBe('reference');

    expect(local.objectInfo?.authorityLevel).toBe('fallback-local');
    expect(local.objectInfo?.healthCheck?.strategy).toBe('none');
  });

  it('includes support-boundary metadata in object-info data source defaults', () => {
    const defaults = getDefaultObjectInfoDataSourceConfigs();
    const sbdb = defaults.find((source) => source.id === 'sbdb');

    expect(sbdb?.targetClasses).toEqual(['small-body']);
    expect(sbdb?.responseMode).toBe('json');
    expect(sbdb?.authorityLevel).toBe('authoritative');
    expect(sbdb?.healthCheck.strategy).toBe('query');
  });
});
