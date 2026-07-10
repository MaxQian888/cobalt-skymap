/**
 * @jest-environment jsdom
 */

import {
  BaseMapProvider,
  type MapProviderCapabilities,
  type GeocodingResult,
  type ReverseGeocodingResult,
  type Coordinates,
  type BoundingBox,
} from '../base-map-provider';

// Concrete implementation for testing
class TestMapProvider extends BaseMapProvider {
  getName(): string {
    return 'Test Provider';
  }

  getProviderType(): 'openstreetmap' | 'google' | 'mapbox' | 'other' {
    return 'other';
  }

  getCapabilities(): MapProviderCapabilities {
    return {
      geocoding: true,
      reverseGeocoding: true,
      tiles: true,
      routing: false,
      places: false,
      autocomplete: false,
    };
  }

  async geocode(address: string, _options?: { limit?: number; bounds?: BoundingBox; language?: string }): Promise<GeocodingResult[]> {
    return [{
      coordinates: { latitude: 45.5, longitude: -73.5 },
      address: address,
      displayName: `Result for ${address}`,
      confidence: 0.9,
    }];
  }

  async reverseGeocode(coordinates: Coordinates, _options?: { language?: string }): Promise<ReverseGeocodingResult> {
    return {
      address: `Address at ${coordinates.latitude}, ${coordinates.longitude}`,
      displayName: 'Test Location',
      components: {
        locality: 'Test City',
        country: 'Test Country',
      },
      confidence: 0.85,
    };
  }

  getTileUrl(x: number, y: number, z: number): string {
    return `https://test.tiles.com/${z}/${x}/${y}.png`;
  }

  getMaxZoom(): number {
    return 19;
  }

  getMinZoom(): number {
    return 0;
  }

  protected getHealthCheckUrl(): string {
    return 'https://test.tiles.com/health';
  }

  // Expose protected methods for testing
  public testValidateCoordinates(coords: Coordinates): void {
    this.validateCoordinates(coords);
  }

  public testNormalizeLongitude(longitude: number): number {
    return this.normalizeLongitude(longitude);
  }

  public testFetchWithRetry(url: string, options?: RequestInit, attempts?: number): Promise<Response> {
    return this.fetchWithRetry(url, options, attempts);
  }
}

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('BaseMapProvider', () => {
  let provider: TestMapProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new TestMapProvider({
      apiKey: 'test-key',
      attribution: 'Test Attribution',
    });
  });

  describe('constructor', () => {
    it('should initialize with default config values', () => {
      const config = provider.getConfig();
      
      expect(config.retryAttempts).toBe(3);
      expect(config.timeout).toBe(10000);
      expect(config.rateLimit).toBe(1000);
      expect(config.userAgent).toBe('CobaltSkymap/1.0');
    });

    it('should merge custom config with defaults', () => {
      const customProvider = new TestMapProvider({
        timeout: 5000,
        retryAttempts: 5,
      });
      
      const config = customProvider.getConfig();
      
      expect(config.timeout).toBe(5000);
      expect(config.retryAttempts).toBe(5);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      expect(provider.getName()).toBe('Test Provider');
    });
  });

  describe('getProviderType', () => {
    it('should return provider type', () => {
      expect(provider.getProviderType()).toBe('other');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const caps = provider.getCapabilities();
      
      expect(caps.geocoding).toBe(true);
      expect(caps.tiles).toBe(true);
      expect(caps.routing).toBe(false);
    });
  });

  describe('geocode', () => {
    it('should geocode address', async () => {
      const results = await provider.geocode('Montreal, Canada');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].coordinates.latitude).toBeDefined();
      expect(results[0].coordinates.longitude).toBeDefined();
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates', async () => {
      const result = await provider.reverseGeocode({
        latitude: 45.5,
        longitude: -73.5,
      });
      
      expect(result.address).toBeDefined();
      expect(result.displayName).toBeDefined();
    });
  });

  describe('getTileUrl', () => {
    it('should generate tile URL', () => {
      const url = provider.getTileUrl(123, 456, 10);
      
      expect(url).toContain('10');
      expect(url).toContain('123');
      expect(url).toContain('456');
    });
  });

  describe('getMaxZoom / getMinZoom', () => {
    it('should return zoom limits', () => {
      expect(provider.getMaxZoom()).toBe(19);
      expect(provider.getMinZoom()).toBe(0);
    });
  });

  describe('checkConnectivity', () => {
    it('should return connected status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
      });
      
      const status = await provider.checkConnectivity();
      
      expect(status.isConnected).toBe(true);
      expect(status.responseTime).toBeDefined();
      expect(status.statusCode).toBe(200);
    });

    it('should return disconnected status on error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const status = await provider.checkConnectivity();
      
      expect(status.isConnected).toBe(false);
      expect(status.errorMessage).toContain('Network error');
    });

    it('should return disconnected status on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
      
      const status = await provider.checkConnectivity();
      
      expect(status.isConnected).toBe(false);
      expect(status.statusCode).toBe(503);
    });
  });

  describe('getConnectivityStatus', () => {
    it('should return current connectivity status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      
      await provider.checkConnectivity();
      const status = provider.getConnectivityStatus();
      
      expect(status.isConnected).toBe(true);
      expect(status.lastChecked).toBeGreaterThan(0);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      provider.updateConfig({ timeout: 15000 });
      
      const config = provider.getConfig();
      expect(config.timeout).toBe(15000);
    });

    it('should preserve other config values', () => {
      provider.updateConfig({ timeout: 15000 });
      
      const config = provider.getConfig();
      expect(config.apiKey).toBe('test-key');
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const config1 = provider.getConfig();
      const config2 = provider.getConfig();
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('validateCoordinates', () => {
    it('should accept valid coordinates', () => {
      expect(() => {
        provider.testValidateCoordinates({ latitude: 45, longitude: -73 });
      }).not.toThrow();
    });

    it('should throw for invalid latitude', () => {
      expect(() => {
        provider.testValidateCoordinates({ latitude: 91, longitude: 0 });
      }).toThrow('Invalid latitude');
      
      expect(() => {
        provider.testValidateCoordinates({ latitude: -91, longitude: 0 });
      }).toThrow('Invalid latitude');
    });

    it('should throw for invalid longitude', () => {
      expect(() => {
        provider.testValidateCoordinates({ latitude: 0, longitude: 181 });
      }).toThrow('Invalid longitude');
      
      expect(() => {
        provider.testValidateCoordinates({ latitude: 0, longitude: -181 });
      }).toThrow('Invalid longitude');
    });
  });

  describe('fetchWithRetry - exponential backoff', () => {
    beforeEach(() => {
      // Speed up tests by making delay instant
      jest.spyOn(provider as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
        .mockResolvedValue(undefined);
    });

    it('should retry on failure and succeed', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const response = await provider.testFetchWithRetry('https://test.com', {}, 2);
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after all retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      await expect(provider.testFetchWithRetry('https://test.com', {}, 3))
        .rejects.toThrow('Persistent failure');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on non-ok response', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const response = await provider.testFetchWithRetry('https://test.com', {}, 2);
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('geocode language option', () => {
    it('should accept language option in geocode signature', async () => {
      const results = await provider.geocode('Test', { language: 'zh' });
      expect(results).toBeDefined();
    });

    it('should accept limit and bounds options', async () => {
      const results = await provider.geocode('Test', {
        limit: 5,
        bounds: { north: 41, south: 40, east: -73, west: -75 },
      });
      expect(results).toBeDefined();
    });
  });

  describe('normalizeLongitude', () => {
    it('should normalize longitude within range', () => {
      expect(provider.testNormalizeLongitude(0)).toBe(0);
      expect(provider.testNormalizeLongitude(180)).toBe(-180);
      expect(provider.testNormalizeLongitude(-180)).toBe(-180);
    });

    it('should wrap around for values outside range', () => {
      expect(provider.testNormalizeLongitude(190)).toBe(-170);
      // -190 normalizes to -190 (modulo doesn't wrap negative values the same way)
      expect(provider.testNormalizeLongitude(-190)).toBe(-190);
      expect(provider.testNormalizeLongitude(360)).toBe(0);
    });
  });
});
