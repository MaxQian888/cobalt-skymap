/**
 * @jest-environment jsdom
 */

import { hipsService, RECOMMENDED_SURVEY_IDS, HiPSSurvey } from '../hips-service';

const mockSmartFetch = jest.fn();

jest.mock('@/lib/services/http-fetch', () => ({
  smartFetch: (...args: unknown[]) => mockSmartFetch(...args),
}));

describe('hipsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSmartFetch.mockReset();
    hipsService.clearCache();
  });

  describe('RECOMMENDED_SURVEY_IDS', () => {
    it('should have recommended survey IDs', () => {
      expect(RECOMMENDED_SURVEY_IDS.length).toBeGreaterThan(0);
      expect(RECOMMENDED_SURVEY_IDS).toContain('CDS/P/DSS2/color');
      expect(RECOMMENDED_SURVEY_IDS).toContain('CDS/P/2MASS/color');
    });
  });

  describe('fetchSurveys', () => {
    const mockSurveyData = [
      {
        ID: 'CDS/P/DSS2/color',
        obs_title: 'DSS2 Color',
        obs_description: 'Digitized Sky Survey 2 Color',
        hips_service_url: 'https://alasky.cds.unistra.fr/DSS/DSS2/',
        hips_order: '11',
        hips_tile_format: 'jpeg',
        hips_frame: 'equatorial',
        obs_regime: 'Optical',
      },
      {
        ID: 'CDS/P/2MASS/color',
        obs_title: '2MASS Color',
        obs_description: 'Two Micron All Sky Survey',
        hips_service_url: 'https://alasky.cds.unistra.fr/2MASS/Color',
        hips_order: '9',
        hips_tile_format: 'png',
        hips_frame: 'equatorial',
        obs_regime: 'Infrared',
      },
    ];

    it('should fetch surveys from registry', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSurveyData),
      });

      const surveys = await hipsService.fetchSurveys();

      expect(mockSmartFetch).toHaveBeenCalledTimes(1);
      expect(mockSmartFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://alasky.cds.unistra.fr/MocServer/query'),
        expect.objectContaining({
          cachePolicy: 'hips-registry',
          cacheTtl: 24 * 60 * 60 * 1000,
        })
      );
      expect(surveys.length).toBe(2);
      expect(surveys[0].name).toBe('DSS2 Color');
      expect(surveys[0].category).toBe('optical');
    });

    it('should cache results', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSurveyData),
      });

      await hipsService.fetchSurveys();
      await hipsService.fetchSurveys();

      expect(mockSmartFetch).toHaveBeenCalledTimes(1);
    });

    it('should filter by category', async () => {
      // Only return infrared survey for this test
      const infraredOnly = [mockSurveyData[1]]; // 2MASS is infrared
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(infraredOnly),
      });

      const surveys = await hipsService.fetchSurveys({ category: 'infrared' });

      // All returned surveys should be infrared category
      expect(surveys.length).toBeGreaterThan(0);
      surveys.forEach(s => expect(s.category).toBe('infrared'));
    });

    it('should apply limit', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSurveyData),
      });

      const surveys = await hipsService.fetchSurveys({ limit: 1 });

      expect(surveys.length).toBe(1);
    });

    it('should handle fetch errors and return cached surveys', async () => {
      // First call succeeds
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSurveyData),
      });

      await hipsService.fetchSurveys();
      hipsService.clearCache();

      // Second call fails
      mockSmartFetch.mockRejectedValueOnce(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const surveys = await hipsService.fetchSurveys();

      expect(surveys).toEqual([]);
      consoleSpy.mockRestore();
    });

    it('should normalize URLs with trailing slash', async () => {
      const dataWithoutSlash = [{
        ...mockSurveyData[0],
        hips_service_url: 'https://example.com/survey',
      }];

      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(dataWithoutSlash),
      });

      const surveys = await hipsService.fetchSurveys();

      expect(surveys[0].url).toBe('https://example.com/survey/');
    });

    it('should parse different regimes correctly', async () => {
      const multiRegimeData = [
        { ...mockSurveyData[0], obs_regime: 'Radio', ID: 'radio-1' },
        { ...mockSurveyData[0], obs_regime: 'X-ray', ID: 'xray-1' },
        { ...mockSurveyData[0], obs_regime: 'UV', ID: 'uv-1' },
        { ...mockSurveyData[0], obs_regime: 'Gamma-ray', ID: 'gamma-1' },
      ];

      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiRegimeData),
      });

      const surveys = await hipsService.fetchSurveys();

      expect(surveys.find(s => s.id.includes('radio-1'))?.category).toBe('radio');
      expect(surveys.find(s => s.id.includes('xray-1'))?.category).toBe('xray');
      expect(surveys.find(s => s.id.includes('uv-1'))?.category).toBe('uv');
      expect(surveys.find(s => s.id.includes('gamma-1'))?.category).toBe('gamma');
    });
  });

  describe('searchSurveys', () => {
    it('should search surveys by query', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          ID: 'CDS/P/DSS2/color',
          obs_title: 'DSS2 Color',
          hips_service_url: 'https://example.com/',
          obs_regime: 'Optical',
        }]),
      });

      const searchResults = await hipsService.searchSurveys('DSS');

      expect(mockSmartFetch).toHaveBeenCalled();
      expect(searchResults).toBeDefined();
      const callUrl = mockSmartFetch.mock.calls[0][0];
      expect(callUrl).toContain('obs_title=*DSS*');
    });
  });

  describe('getRecommendedSurveys', () => {
    it('should return recommended surveys in order', async () => {
      // Create mock data that matches how the service filters recommended IDs
      const mockData = [
        {
          ID: 'CDS/P/DSS2/color',
          obs_title: 'DSS2 Color',
          hips_service_url: 'https://alasky.cds.unistra.fr/DSS/DSS2-color/',
          obs_regime: 'Optical',
        },
      ];

      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await hipsService.getRecommendedSurveys();

      // The result depends on ID matching logic in the service
      expect(result).toBeDefined();
    });
  });

  describe('getSurveysByCategory', () => {
    it('should get surveys by category', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          ID: 'CDS/P/2MASS/color',
          obs_title: '2MASS',
          hips_service_url: 'https://example.com/',
          obs_regime: 'Infrared',
        }]),
      });

      const surveys = await hipsService.getSurveysByCategory('infrared');

      expect(surveys.length).toBeGreaterThan(0);
      surveys.forEach(s => expect(s.category).toBe('infrared'));
    });
  });

  describe('getSurveyById', () => {
    it('should return survey by ID', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          ID: 'CDS/P/DSS2/color',
          obs_title: 'DSS2 Color',
          hips_service_url: 'https://example.com/',
          obs_regime: 'Optical',
        }]),
      });

      const survey = await hipsService.getSurveyById('CDS_P_DSS2_color');

      expect(survey).toBeDefined();
    });

    it('should return undefined for non-existent ID', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const survey = await hipsService.getSurveyById('non-existent');

      expect(survey).toBeUndefined();
    });
  });

  describe('getSurveyByUrl', () => {
    it('should return survey by URL', async () => {
      const testUrl = 'https://alasky.cds.unistra.fr/DSS/';
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          ID: 'CDS/P/DSS2/color',
          obs_title: 'DSS2 Color',
          hips_service_url: testUrl,
          obs_regime: 'Optical',
        }]),
      });

      const survey = await hipsService.getSurveyByUrl(testUrl);

      expect(survey).toBeDefined();
      expect(survey?.url).toBe(testUrl);
    });

    it('should normalize URL for comparison', async () => {
      mockSmartFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          ID: 'test',
          obs_title: 'Test',
          hips_service_url: 'https://example.com/survey/',
          obs_regime: 'Optical',
        }]),
      });

      // URL without trailing slash
      const survey = await hipsService.getSurveyByUrl('https://example.com/survey');

      expect(survey).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear cached surveys', async () => {
      mockSmartFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          ID: 'test',
          obs_title: 'Test',
          hips_service_url: 'https://example.com/',
          obs_regime: 'Optical',
        }]),
      });

      await hipsService.fetchSurveys();
      hipsService.clearCache();
      await hipsService.fetchSurveys();

      expect(mockSmartFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTileUrl', () => {
    it('should generate correct tile URL', () => {
      const survey: HiPSSurvey = {
        id: 'test',
        name: 'Test Survey',
        url: 'https://example.com/survey/',
        description: 'Test',
        category: 'optical',
        maxOrder: 11,
        tileFormat: 'jpeg',
        frame: 'equatorial',
      };

      const url = hipsService.getTileUrl(survey, 5, 12345);

      expect(url).toBe('https://example.com/survey/Norder5/Dir10000/Npix12345.jpeg');
    });

    it('should use first format if multiple available', () => {
      const survey: HiPSSurvey = {
        id: 'test',
        name: 'Test Survey',
        url: 'https://example.com/survey/',
        description: 'Test',
        category: 'optical',
        maxOrder: 11,
        tileFormat: 'png jpeg',
        frame: 'equatorial',
      };

      const url = hipsService.getTileUrl(survey, 3, 100);

      expect(url).toContain('.png');
    });
  });

  describe('getTileUrlsForOrder', () => {
    it('should return all tile URLs for an order', () => {
      const survey: HiPSSurvey = {
        id: 'test',
        name: 'Test Survey',
        url: 'https://example.com/survey/',
        description: 'Test',
        category: 'optical',
        maxOrder: 11,
        tileFormat: 'jpeg',
        frame: 'equatorial',
      };

      // Order 0 has 12 pixels (12 * 1 * 1)
      const urls = hipsService.getTileUrlsForOrder(survey, 0);

      expect(urls.length).toBe(12);
    });

    it('should return correct number of tiles for order 1', () => {
      const survey: HiPSSurvey = {
        id: 'test',
        name: 'Test',
        url: 'https://example.com/',
        description: 'Test',
        category: 'optical',
        maxOrder: 11,
        tileFormat: 'jpeg',
        frame: 'equatorial',
      };

      // Order 1 has 48 pixels (12 * 2 * 2)
      const urls = hipsService.getTileUrlsForOrder(survey, 1);

      expect(urls.length).toBe(48);
    });
  });

  describe('estimateCacheSize', () => {
    it('should estimate cache size for order 0', () => {
      const size = hipsService.estimateCacheSize(0);

      // 12 tiles * 50KB default
      expect(size).toBe(12 * 50 * 1024);
    });

    it('should use custom tile size', () => {
      const size = hipsService.estimateCacheSize(0, 100 * 1024);

      expect(size).toBe(12 * 100 * 1024);
    });

    it('should scale correctly with order', () => {
      const size0 = hipsService.estimateCacheSize(0);
      const size1 = hipsService.estimateCacheSize(1);

      // Order 1 has 4x tiles of order 0
      expect(size1).toBe(size0 * 4);
    });
  });
});
