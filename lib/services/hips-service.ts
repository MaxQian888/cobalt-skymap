/**
 * HiPS (Hierarchical Progressive Surveys) Service
 * Fetches available sky surveys from online registries like CDS Aladin
 */

import { smartFetch } from './http-fetch';
import { createLogger } from '@/lib/logger';

const logger = createLogger('hips-service');

export interface HiPSSurvey {
  id: string;
  name: string;
  url: string;
  description: string;
  category: 'optical' | 'infrared' | 'radio' | 'uv' | 'xray' | 'gamma' | 'other';
  maxOrder: number;
  tileFormat: string;
  frame: string;
  regime?: string;
  pixelScale?: number;
  isLocal?: boolean;
  isCached?: boolean;
}

export interface HiPSRegistryResponse {
  ID: string;
  obs_title: string;
  obs_description?: string;
  hips_service_url: string;
  hips_order?: string;
  hips_tile_format?: string;
  hips_frame?: string;
  obs_regime?: string;
  hips_pixel_scale?: string;
  client_category?: string;
}

// CDS HiPS registry endpoint
const HIPS_REGISTRY_URL = 'https://alasky.cds.unistra.fr/MocServer/query';

// Categories mapping from obs_regime
const REGIME_TO_CATEGORY: Record<string, HiPSSurvey['category']> = {
  'Optical': 'optical',
  'Infrared': 'infrared',
  'Radio': 'radio',
  'UV': 'uv',
  'X-ray': 'xray',
  'Gamma-ray': 'gamma',
  'EUV': 'uv',
  'Millimeter': 'radio',
  'Submillimeter': 'radio',
};

// Popular/recommended surveys for quick access
export const RECOMMENDED_SURVEY_IDS = [
  'CDS/P/DSS2/color',
  'CDS/P/DSS2/red',
  'CDS/P/DSS2/blue',
  'CDS/P/PanSTARRS/DR1/color-z-zg-g',
  'CDS/P/SDSS9/color',
  'CDS/P/2MASS/color',
  'CDS/P/allWISE/color',
  'CDS/P/Mellinger/color',
  'CDS/P/Fermi/color',
  'CDS/P/VTSS/Ha',
  'CDS/P/GALEXGR6_7/NUV',
];

class HiPSService {
  private cachedSurveys: HiPSSurvey[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Parse regime string to category
   */
  private parseCategory(regime?: string, clientCategory?: string): HiPSSurvey['category'] {
    if (regime) {
      const normalizedRegime = regime.split('/')[0].trim();
      if (REGIME_TO_CATEGORY[normalizedRegime]) {
        return REGIME_TO_CATEGORY[normalizedRegime];
      }
    }
    
    // Fallback to client_category parsing
    if (clientCategory) {
      const lowerCategory = clientCategory.toLowerCase();
      if (lowerCategory.includes('optical')) return 'optical';
      if (lowerCategory.includes('infrared') || lowerCategory.includes('ir')) return 'infrared';
      if (lowerCategory.includes('radio')) return 'radio';
      if (lowerCategory.includes('uv') || lowerCategory.includes('ultraviolet')) return 'uv';
      if (lowerCategory.includes('x-ray') || lowerCategory.includes('xray')) return 'xray';
      if (lowerCategory.includes('gamma')) return 'gamma';
    }
    
    return 'other';
  }

  /**
   * Generate a unique ID from the survey URL
   */
  private generateId(url: string, obsId?: string): string {
    if (obsId) {
      return obsId.replace(/\//g, '_').replace(/\s+/g, '_');
    }
    // Extract ID from URL
    const urlParts = url.replace(/\/$/, '').split('/');
    return urlParts.slice(-3).join('_');
  }

  /**
   * Fetch available HiPS surveys from CDS registry
   */
  async fetchSurveys(options?: {
    category?: HiPSSurvey['category'];
    searchQuery?: string;
    limit?: number;
  }): Promise<HiPSSurvey[]> {
    const now = Date.now();
    
    // Return cached surveys if still valid and no specific query
    if (
      this.cachedSurveys.length > 0 &&
      now - this.lastFetchTime < this.CACHE_DURATION &&
      !options?.searchQuery
    ) {
      let surveys = [...this.cachedSurveys];
      
      if (options?.category) {
        surveys = surveys.filter(s => s.category === options.category);
      }
      
      if (options?.limit) {
        surveys = surveys.slice(0, options.limit);
      }
      
      return surveys;
    }

    try {
      // Build query parameters
      const params = new URLSearchParams({
        'fmt': 'json',
        'get': 'record',
        'dataproduct_type': 'image',
        'hips_service_url': '*',
      });

      // Add search filter if provided
      if (options?.searchQuery) {
        params.set('obs_title', `*${options.searchQuery}*`);
      }

      // Add regime filter if category specified
      if (options?.category && options.category !== 'other') {
        const regimeMap: Record<string, string> = {
          'optical': 'Optical',
          'infrared': 'Infrared',
          'radio': 'Radio',
          'uv': 'UV',
          'xray': 'X-ray',
          'gamma': 'Gamma-ray',
        };
        if (regimeMap[options.category]) {
          params.set('obs_regime', regimeMap[options.category] + '*');
        }
      }

      const response = await smartFetch(`${HIPS_REGISTRY_URL}?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
        },
        timeout: 30000, // 30 second timeout
        cachePolicy: 'hips-registry',
        cacheTtl: this.CACHE_DURATION,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch HiPS registry: ${response.statusText}`);
      }

      const data: HiPSRegistryResponse[] = await response.json();

      const surveys: HiPSSurvey[] = data
        .filter(item => item.hips_service_url && item.obs_title)
        .map(item => ({
          id: this.generateId(item.hips_service_url, item.ID),
          name: item.obs_title,
          url: item.hips_service_url.endsWith('/') 
            ? item.hips_service_url 
            : item.hips_service_url + '/',
          description: item.obs_description || item.obs_title,
          category: this.parseCategory(item.obs_regime, item.client_category),
          maxOrder: parseInt(item.hips_order || '11', 10),
          tileFormat: item.hips_tile_format || 'jpeg',
          frame: item.hips_frame || 'equatorial',
          regime: item.obs_regime,
          pixelScale: item.hips_pixel_scale ? parseFloat(item.hips_pixel_scale) : undefined,
        }));

      // Cache the results if it's a general fetch
      if (!options?.searchQuery) {
        this.cachedSurveys = surveys;
        this.lastFetchTime = now;
      }

      // Apply limit
      if (options?.limit) {
        return surveys.slice(0, options.limit);
      }

      return surveys;
    } catch (error) {
      logger.error('Error fetching HiPS surveys', error);
      // Return cached surveys as fallback
      return this.cachedSurveys;
    }
  }

  /**
   * Search surveys by name or description
   */
  async searchSurveys(query: string, limit = 20): Promise<HiPSSurvey[]> {
    return this.fetchSurveys({ searchQuery: query, limit });
  }

  /**
   * Get recommended/popular surveys
   */
  async getRecommendedSurveys(): Promise<HiPSSurvey[]> {
    const allSurveys = await this.fetchSurveys();
    
    // Filter to recommended surveys and maintain order
    const recommended: HiPSSurvey[] = [];
    for (const id of RECOMMENDED_SURVEY_IDS) {
      const survey = allSurveys.find(s => s.id.includes(id.replace('CDS/P/', '')));
      if (survey) {
        recommended.push(survey);
      }
    }
    
    return recommended;
  }

  /**
   * Get surveys by category
   */
  async getSurveysByCategory(category: HiPSSurvey['category']): Promise<HiPSSurvey[]> {
    return this.fetchSurveys({ category });
  }

  /**
   * Get survey by ID
   */
  async getSurveyById(id: string): Promise<HiPSSurvey | undefined> {
    const surveys = await this.fetchSurveys();
    return surveys.find(s => s.id === id);
  }

  /**
   * Get survey by URL
   */
  async getSurveyByUrl(url: string): Promise<HiPSSurvey | undefined> {
    const surveys = await this.fetchSurveys();
    const normalizedUrl = url.endsWith('/') ? url : url + '/';
    return surveys.find(s => s.url === normalizedUrl);
  }

  /**
   * Clear cached surveys
   */
  clearCache(): void {
    this.cachedSurveys = [];
    this.lastFetchTime = 0;
  }

  /**
   * Build raw HiPS tile path (without proxy)
   */
  private buildTilePath(survey: HiPSSurvey, order: number, pixelIndex: number): string {
    const dir = Math.floor(pixelIndex / 10000) * 10000;
    const format = survey.tileFormat.split(' ')[0]; // Use first format if multiple
    return `${survey.url}Norder${order}/Dir${dir}/Npix${pixelIndex}.${format}`;
  }

  /**
   * Get HiPS tile URL for a specific position
   */
  getTileUrl(
    survey: HiPSSurvey,
    order: number,
    pixelIndex: number
  ): string {
    return this.buildTilePath(survey, order, pixelIndex);
  }

  /**
   * Get all tile URLs for a given order (for caching)
   */
  getTileUrlsForOrder(survey: HiPSSurvey, order: number): string[] {
    const nside = Math.pow(2, order);
    const npix = 12 * nside * nside;
    const urls: string[] = [];
    
    for (let i = 0; i < npix; i++) {
      urls.push(this.buildTilePath(survey, order, i));
    }
    
    return urls;
  }

  /**
   * Estimate cache size for a survey at given order
   */
  estimateCacheSize(order: number, avgTileSize = 50 * 1024): number {
    const nside = Math.pow(2, order);
    const npix = 12 * nside * nside;
    return npix * avgTileSize;
  }
}

// Singleton instance
export const hipsService = new HiPSService();
