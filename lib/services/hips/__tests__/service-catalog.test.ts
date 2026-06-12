import {
  parseCatalogRegistryEntries,
  fetchCatalogHiPS,
  DEFAULT_CATALOG_HIPS,
  __resetRegistryCacheForTests,
} from '../service';
import type { HiPSRegistryEntry } from '../types';

const mockSmartFetch = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockSmartFetch(...args),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const MOCSERVER_RECORDS: HiPSRegistryEntry[] = [
  {
    ID: 'CDS/I/355/gaiadr3',
    obs_title: 'Gaia DR3',
    hips_service_url: 'https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3',
    obs_regime: 'Optical',
    dataproduct_type: 'catalog',
  },
  {
    // Missing hips_service_url -> should be filtered out.
    ID: 'CDS/bad',
    obs_title: 'Broken',
    hips_service_url: '',
    dataproduct_type: 'catalog',
  },
];

describe('parseCatalogRegistryEntries', () => {
  it('maps MocServer catalog records to catalog HiPS surveys', () => {
    const surveys = parseCatalogRegistryEntries(MOCSERVER_RECORDS);
    expect(surveys).toHaveLength(1);
    const gaia = surveys[0];
    expect(gaia.id).toBe('CDS-I-355-gaiadr3');
    expect(gaia.name).toBe('Gaia DR3');
    expect(gaia.kind).toBe('catalog');
    expect(gaia.catalogServiceUrl).toBe(
      'https://hipscat.cds.unistra.fr/HiPSCatService/I/355/gaiadr3'
    );
    expect(gaia.category).toBe('optical');
  });
});

describe('DEFAULT_CATALOG_HIPS', () => {
  it('includes Gaia DR3 as a curated fallback', () => {
    const gaia = DEFAULT_CATALOG_HIPS.find((s) => s.id.includes('gaiadr3'));
    expect(gaia).toBeDefined();
    expect(gaia!.kind).toBe('catalog');
    expect(gaia!.catalogServiceUrl).toContain('HiPSCatService');
  });
});

describe('fetchCatalogHiPS', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSmartFetch.mockReset();
    __resetRegistryCacheForTests();
  });

  it('queries the MocServer with the catalog cache policy and parses records', async () => {
    mockSmartFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => MOCSERVER_RECORDS,
    });

    const surveys = await fetchCatalogHiPS();
    expect(surveys.some((s) => s.id === 'CDS-I-355-gaiadr3')).toBe(true);

    const [url, options] = mockSmartFetch.mock.calls[0];
    expect(url).toContain('MocServer');
    expect(decodeURIComponent(url)).toContain('dataproduct_type=catalog');
    expect(options).toEqual(expect.objectContaining({ cachePolicy: 'hips-catalog-registry' }));
  });

  it('falls back to the curated defaults when the request fails', async () => {
    mockSmartFetch.mockRejectedValueOnce(new Error('offline'));
    const surveys = await fetchCatalogHiPS();
    expect(surveys).toEqual(DEFAULT_CATALOG_HIPS);
  });
});
