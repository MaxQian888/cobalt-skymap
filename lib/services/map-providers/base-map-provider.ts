/**
 * Base abstract class for map providers
 * Defines common interface for different map API implementations
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeocodingResult {
  coordinates: Coordinates;
  address: string;
  displayName: string;
  confidence: number;
  boundingBox?: BoundingBox;
  type?: 'city' | 'street' | 'building' | 'poi' | 'administrative' | 'natural' | 'other';
  countryCode?: string;
  region?: string;
  locality?: string;
}

export interface ReverseGeocodingResult {
  address: string;
  displayName: string;
  components: {
    houseNumber?: string;
    street?: string;
    locality?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;
  };
  confidence: number;
  type?: string;
}

export interface TileInfo {
  x: number;
  y: number;
  z: number;
  url: string;
}

export interface MapProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  attribution?: string;
  maxZoom?: number;
  minZoom?: number;
  tileSize?: number;
  retryAttempts?: number;
  timeout?: number;
  rateLimit?: number;
  userAgent?: string;
}

export interface ConnectivityStatus {
  isConnected: boolean;
  responseTime?: number;
  lastChecked: number;
  errorMessage?: string;
  statusCode?: number;
}

export interface MapProviderCapabilities {
  geocoding: boolean;
  reverseGeocoding: boolean;
  tiles: boolean;
  routing: boolean;
  places: boolean;
  autocomplete: boolean;
}

export abstract class BaseMapProvider {
  protected config: MapProviderConfig;
  protected capabilities: MapProviderCapabilities;
  protected connectivityStatus: ConnectivityStatus = {
    isConnected: false,
    lastChecked: 0,
  };

  constructor(config: MapProviderConfig) {
    this.config = {
      retryAttempts: 3,
      timeout: 10000,
      rateLimit: 1000,
      userAgent: 'CobaltSkymap/1.0',
      ...config,
    };
    
    this.capabilities = this.getCapabilities();
  }

  // Abstract methods that must be implemented by concrete providers
  abstract getName(): string;
  abstract getProviderType(): 'openstreetmap' | 'google' | 'mapbox' | 'other';
  abstract getCapabilities(): MapProviderCapabilities;

  // Geocoding methods
  abstract geocode(address: string, options?: { limit?: number; bounds?: BoundingBox; language?: string }): Promise<GeocodingResult[]>;
  abstract reverseGeocode(coordinates: Coordinates, options?: { language?: string }): Promise<ReverseGeocodingResult>;

  // Tile methods
  abstract getTileUrl(x: number, y: number, z: number): string;
  abstract getMaxZoom(): number;
  abstract getMinZoom(): number;

  // Connectivity and health checks
  async checkConnectivity(): Promise<ConnectivityStatus> {
    const startTime = Date.now();
    
    try {
      const testUrl = this.getHealthCheckUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': this.config.userAgent || 'CobaltSkymap/1.0',
        },
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      
      this.connectivityStatus = {
        isConnected: response.ok,
        responseTime,
        lastChecked: Date.now(),
        statusCode: response.status,
        errorMessage: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
      };

      return this.connectivityStatus;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.connectivityStatus = {
        isConnected: false,
        responseTime,
        lastChecked: Date.now(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };

      return this.connectivityStatus;
    }
  }

  getConnectivityStatus(): ConnectivityStatus {
    return { ...this.connectivityStatus };
  }

  // Configuration methods
  updateConfig(newConfig: Partial<MapProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): MapProviderConfig {
    return { ...this.config };
  }

  // Utility methods
  protected async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    attempts: number = this.config.retryAttempts || 3
  ): Promise<Response> {
    const maxAttempts = this.config.retryAttempts || 3;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    // If an external signal is provided, abort our controller when it fires
    if (options.signal) {
      const externalSignal = options.signal;
      if (externalSignal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    const fetchOptions: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': this.config.userAgent || 'CobaltSkymap/1.0',
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (!response.ok && attempts > 1) {
        const retryDelay = this.getRetryDelay(maxAttempts - attempts);
        await this.delay(retryDelay);
        return this.fetchWithRetry(url, options, attempts - 1);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      if (attempts > 1) {
        const retryDelay = this.getRetryDelay(maxAttempts - attempts);
        await this.delay(retryDelay);
        return this.fetchWithRetry(url, options, attempts - 1);
      }

      throw error;
    }
  }

  // Exponential backoff with jitter: 1s, 2s, 4s (capped at 8s)
  private getRetryDelay(attempt: number): number {
    const baseDelay = Math.min(1000 * Math.pow(2, attempt), 8000);
    const jitter = Math.random() * baseDelay * 0.2; // Up to 20% jitter
    return baseDelay + jitter;
  }

  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected validateCoordinates(coordinates: Coordinates): void {
    if (typeof coordinates.latitude !== 'number' || 
        coordinates.latitude < -90 || 
        coordinates.latitude > 90) {
      throw new Error('Invalid latitude: must be between -90 and 90');
    }

    if (typeof coordinates.longitude !== 'number' || 
        coordinates.longitude < -180 || 
        coordinates.longitude > 180) {
      throw new Error('Invalid longitude: must be between -180 and 180');
    }
  }

  protected normalizeLongitude(longitude: number): number {
    return ((longitude + 180) % 360) - 180;
  }

  // Abstract method for health check URL
  protected abstract getHealthCheckUrl(): string;

  // Rate limiting
  private lastRequestTime = 0;
  
  protected async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = this.config.rateLimit || 1000;

    if (timeSinceLastRequest < minInterval) {
      await this.delay(minInterval - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();
  }
}
