/**
 * @jest-environment jsdom
 */

import type { ObjectDetailedInfo } from '../object-info-service';
import { enhanceObjectInfo } from '../object-info-service';
import { smartFetch } from '../http-fetch';
import { getActiveDataSources } from '../object-info-config';

jest.mock('../http-fetch', () => ({
  smartFetch: jest.fn(),
}));

jest.mock('../object-info-config', () => ({
  useObjectInfoConfigStore: {
    getState: () => ({
      settings: { defaultImageSize: 15 },
      setDataSourceStatus: jest.fn(),
    }),
  },
  getActiveImageSources: () => [],
  getActiveDataSources: jest.fn(),
  generateImageUrl: jest.fn(),
}));

const mockSmartFetch = smartFetch as jest.MockedFunction<typeof smartFetch>;
const mockGetActiveDataSources = getActiveDataSources as jest.MockedFunction<typeof getActiveDataSources>;

function makeBaseInfo(overrides: Partial<ObjectDetailedInfo> = {}): ObjectDetailedInfo {
  return {
    names: ['1P/Halley'],
    type: 'Comet',
    typeCategory: 'comet',
    ra: 139.0,
    dec: -4.0,
    raString: '09h 16m',
    decString: '-04° 00\'',
    images: [],
    sources: ['Local'],
    provenance: {
      description: {
        acceptedSource: 'Local',
        authorityLevel: 'fallback-local',
        contributors: ['Local'],
      },
    },
    diagnostics: [],
    ...overrides,
  };
}

describe('object-info-service enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetActiveDataSources.mockReturnValue([
      {
        id: 'simbad',
        name: 'SIMBAD',
        type: 'simbad',
        enabled: true,
        priority: 1,
        baseUrl: 'https://simbad.cds.unistra.fr',
        apiEndpoint: '/simbad/sim-tap/sync',
        timeout: 5000,
        description: 'SIMBAD Astronomical Database',
        status: 'online',
        builtIn: true,
        renderTier: 'enrichment',
        fallbackRole: 'primary',
        targetClasses: ['deep-sky', 'star', 'extragalactic', 'generic'],
        responseMode: 'json',
        authorityLevel: 'authoritative',
        healthCheck: { strategy: 'query', probePath: '/simbad/sim-tap/sync' },
      },
      {
        id: 'wikipedia',
        name: 'Wikipedia',
        type: 'wikipedia',
        enabled: true,
        priority: 2,
        baseUrl: 'https://en.wikipedia.org',
        apiEndpoint: '/api/rest_v1/page/summary',
        timeout: 5000,
        description: 'Wikipedia summaries',
        status: 'online',
        builtIn: true,
        renderTier: 'enrichment',
        fallbackRole: 'fallback',
        targetClasses: ['deep-sky', 'star', 'planetary', 'small-body', 'extragalactic', 'generic'],
        responseMode: 'json',
        authorityLevel: 'reference',
        healthCheck: { strategy: 'lookup', probePath: '/api/rest_v1/page/summary/M31' },
      },
      {
        id: 'sbdb',
        name: 'JPL SBDB',
        type: 'sbdb',
        enabled: true,
        priority: 3,
        baseUrl: 'https://ssd-api.jpl.nasa.gov',
        apiEndpoint: '/sbdb.api',
        timeout: 5000,
        description: 'JPL Small-Body Database',
        status: 'online',
        builtIn: true,
        renderTier: 'enrichment',
        fallbackRole: 'fallback',
        targetClasses: ['small-body'],
        responseMode: 'json',
        authorityLevel: 'authoritative',
        healthCheck: { strategy: 'query', probePath: '/sbdb.api?sstr=1P&phys-par=1' },
      },
    ] as never);
  });

  it('fills missing description from Wikipedia and appends provider provenance', async () => {
    mockSmartFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/simbad/sim-tap/sync')) {
        return {
          ok: true,
          json: async () => ({
            data: [['1P/Halley', 139.0, -4.0, 'Com', null, 2.1, null, null, null, null]],
          }),
        } as never;
      }
      if (url.includes('/api/rest_v1/page/summary/')) {
        return {
          ok: true,
          json: async () => ({
            extract: 'Halley is a short-period comet visible from Earth every 75–79 years.',
          }),
        } as never;
      }
      if (url.includes('/sbdb.api')) {
        return {
          ok: true,
          json: async () => ({
            object: { fullname: '1P/Halley', orbit_class: { name: 'Halley-type comet' } },
            phys_par: { diameter: 11.0 },
          }),
        } as never;
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const enhanced = await enhanceObjectInfo(makeBaseInfo({ description: undefined }));

    expect(enhanced.description).toContain('Halley');
    expect(enhanced.sources).toEqual(expect.arrayContaining(['Local', 'SIMBAD', 'Wikipedia', 'SBDB']));
    expect(enhanced.provenance.description?.acceptedSource).toBe('Wikipedia');
    expect(enhanced.provenance.description?.authorityLevel).toBe('reference');
    expect(enhanced.provenance.description?.contributors).toEqual(
      expect.arrayContaining(['Local', 'Wikipedia'])
    );
  });

  it('does not overwrite an existing description when lower-priority providers return one', async () => {
    mockSmartFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/simbad/sim-tap/sync')) {
        return {
          ok: true,
          json: async () => ({ data: [['1P/Halley', 139.0, -4.0, 'Com', null, 2.1, null, null, null, null]] }),
        } as never;
      }
      if (url.includes('/api/rest_v1/page/summary/')) {
        return {
          ok: true,
          json: async () => ({ extract: 'Replacement description from Wikipedia' }),
        } as never;
      }
      if (url.includes('/sbdb.api')) {
        return {
          ok: true,
          json: async () => ({ object: { fullname: '1P/Halley' } }),
        } as never;
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const enhanced = await enhanceObjectInfo(makeBaseInfo({ description: 'Existing local description' }));

    expect(enhanced.description).toBe('Existing local description');
    expect(enhanced.provenance.description?.acceptedSource).toBe('Local');
    expect(enhanced.provenance.description?.contributors).toEqual(
      expect.arrayContaining(['Local', 'Wikipedia'])
    );
  });

  it('records unsupported diagnostics when a provider is enabled but not eligible for the target class', async () => {
    mockSmartFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [['M31', 10.68, 41.27, 'G', null, 3.4, null, null, null, null]],
      }),
    } as never);

    const enhanced = await enhanceObjectInfo(makeBaseInfo({
      names: ['M31'],
      type: 'Galaxy',
      typeCategory: 'galaxy',
      description: undefined,
    }));

    expect(mockSmartFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/sbdb.api'),
      expect.anything()
    );
    expect(enhanced.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'sbdb',
          status: 'unsupported',
        }),
      ])
    );
  });
});
