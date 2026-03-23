/**
 * Tauri HTTP Client API wrapper
 * Provides enhanced HTTP functionality with:
 * - Configurable timeouts, retries, proxy support
 * - Download progress reporting
 * - Request cancellation
 * - Batch/parallel downloads
 * - Rate limiting integration
 */

import { isTauri } from '@/lib/storage/platform';

// Lazy import to avoid errors in web environment
async function getInvoke() {
  if (!isTauri()) {
    throw new Error('Tauri HTTP API is only available in desktop environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

async function getListen() {
  if (!isTauri()) {
    throw new Error('Tauri events are only available in desktop environment');
  }
  const { listen } = await import('@tauri-apps/api/event');
  return listen;
}

// ============================================================================
// Types
// ============================================================================

/**
 * HTTP client configuration
 */
export type ProxyMode = 'auto' | 'manual' | 'off';
export type ProxySource = 'manual' | 'env' | 'system' | 'none';

export interface EffectiveProxyState {
  mode: ProxyMode;
  source: ProxySource;
  source_detail: string | null;
  resolved_proxy: string | null;
  fallback_to_direct_on_failure: boolean;
  fallback_applied: boolean;
  last_error: string | null;
}

export interface HttpClientConfig {
  /** Connection timeout in milliseconds */
  connect_timeout_ms: number;
  /** Read timeout in milliseconds */
  read_timeout_ms: number;
  /** Total request timeout in milliseconds */
  request_timeout_ms: number;
  /** Maximum number of retries */
  max_retries: number;
  /** Base delay for exponential backoff in milliseconds */
  retry_base_delay_ms: number;
  /** Maximum delay between retries in milliseconds */
  retry_max_delay_ms: number;
  /** User agent string */
  user_agent: string;
  /** Proxy mode: auto-discovery, manual URL, or disabled */
  proxy_mode: ProxyMode;
  /** Manual proxy URL when mode is manual */
  manual_proxy_url: string | null;
  /** Whether manual proxy failure can fallback to direct connection */
  fallback_to_direct_on_failure: boolean;
  /** Legacy proxy URL field kept for backward compatibility */
  proxy_url: string | null;
  /** Maximum response size in bytes */
  max_response_size: number;
  /** Enable gzip/deflate compression */
  enable_compression: boolean;
  /** Follow redirects */
  follow_redirects: boolean;
  /** Maximum number of redirects to follow */
  max_redirects: number;
}

/**
 * Request configuration for individual requests
 */
export interface RequestConfig {
  /** HTTP method */
  method: string;
  /** Request URL */
  url: string;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (for POST/PUT) */
  body?: number[];
  /** Content type */
  content_type?: string;
  /** Override timeout for this request (milliseconds) */
  timeout_ms?: number;
  /** Skip URL security validation (dangerous - use carefully) */
  skip_security_check?: boolean;
  /** Allow HTTP (non-HTTPS) URLs */
  allow_http?: boolean;
  /** Request ID for tracking/cancellation */
  request_id?: string;
}

/**
 * HTTP response data
 */
export interface HttpResponse {
  /** HTTP status code */
  status: number;
  /** Status text */
  status_text: string;
  /** Response headers */
  headers: Record<string, string>;
  /** Response body as bytes */
  body: number[];
  /** Content type */
  content_type: string | null;
  /** Content length */
  content_length: number | null;
  /** Final URL (after redirects) */
  final_url: string;
  /** Response time in milliseconds */
  response_time_ms: number;
}

/**
 * Download progress event
 */
export interface DownloadProgress {
  /** Request ID */
  request_id: string;
  /** URL being downloaded */
  url: string;
  /** Bytes downloaded so far */
  downloaded: number;
  /** Total bytes (if known) */
  total: number | null;
  /** Progress percentage (0-100) */
  percentage: number | null;
  /** Download speed in bytes per second */
  speed_bps: number | null;
  /** Estimated time remaining in seconds */
  eta_seconds: number | null;
  /** Is download complete */
  is_complete: boolean;
  /** Error message if failed */
  error: string | null;
}

/**
 * Batch download result
 */
export interface BatchDownloadResult {
  /** Total number of requests */
  total: number;
  /** Number of successful downloads */
  success: number;
  /** Number of failed downloads */
  failed: number;
  /** Individual results */
  results: BatchItemResult[];
  /** Total time in milliseconds */
  total_time_ms: number;
}

/**
 * Individual batch item result
 */
export interface BatchItemResult {
  url: string;
  success: boolean;
  status: number | null;
  size: number | null;
  error: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Uint8Array to number array for Tauri
 */
function uint8ArrayToNumberArray(data: Uint8Array): number[] {
  return Array.from(data);
}

/**
 * Convert number array from Tauri to Uint8Array
 */
function numberArrayToUint8Array(data: number[]): Uint8Array {
  return new Uint8Array(data);
}

/**
 * Convert response body to string
 */
export function responseToString(response: HttpResponse): string {
  return new TextDecoder().decode(numberArrayToUint8Array(response.body));
}

/**
 * Convert response body to JSON
 */
export function responseToJson<T = unknown>(response: HttpResponse): T {
  const text = responseToString(response);
  return JSON.parse(text);
}

/**
 * Convert response body to Uint8Array
 */
export function responseToBytes(response: HttpResponse): Uint8Array {
  return numberArrayToUint8Array(response.body);
}

/**
 * Convert response body to Blob
 */
export function responseToBlob(response: HttpResponse): Blob {
  const bytes = responseToBytes(response);
  const type = response.content_type || 'application/octet-stream';
  // Create ArrayBuffer copy to avoid SharedArrayBuffer compatibility issues
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type });
}

/**
 * Generate unique request ID
 */
export function generateRequestId(prefix = 'req'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================================================
// HTTP Client API
// ============================================================================

export const httpApi = {
  /**
   * Get current HTTP client configuration
   */
  async getConfig(): Promise<HttpClientConfig> {
    const invoke = await getInvoke();
    return invoke('get_http_config');
  },

  /**
   * Update HTTP client configuration
   */
  async setConfig(config: Partial<HttpClientConfig>): Promise<void> {
    const invoke = await getInvoke();
    const currentConfig = await this.getConfig();
    return invoke('set_http_config', { config: { ...currentConfig, ...config } });
  },

  /**
   * Get the currently effective proxy state after resolution/fallback.
   */
  async getEffectiveProxyState(): Promise<EffectiveProxyState> {
    const invoke = await getInvoke();
    return invoke('get_effective_proxy_state');
  },

  /**
   * Execute a custom HTTP request
   */
  async request(config: RequestConfig): Promise<HttpResponse> {
    const invoke = await getInvoke();
    return invoke('http_request', { config });
  },

  /**
   * Simple GET request
   */
  async get(
    url: string,
    options?: {
      headers?: Record<string, string>;
      allowHttp?: boolean;
    }
  ): Promise<HttpResponse> {
    const invoke = await getInvoke();
    return invoke('http_get', {
      url,
      headers: options?.headers,
      allowHttp: options?.allowHttp,
    });
  },

  /**
   * Simple POST request
   */
  async post(
    url: string,
    body: string | Uint8Array | object,
    options?: {
      contentType?: string;
      headers?: Record<string, string>;
      allowHttp?: boolean;
    }
  ): Promise<HttpResponse> {
    const invoke = await getInvoke();

    let bodyBytes: number[];
    let contentType = options?.contentType;

    if (typeof body === 'string') {
      bodyBytes = uint8ArrayToNumberArray(new TextEncoder().encode(body));
      contentType = contentType || 'text/plain';
    } else if (body instanceof Uint8Array) {
      bodyBytes = uint8ArrayToNumberArray(body);
      contentType = contentType || 'application/octet-stream';
    } else {
      bodyBytes = uint8ArrayToNumberArray(new TextEncoder().encode(JSON.stringify(body)));
      contentType = contentType || 'application/json';
    }

    return invoke('http_post', {
      url,
      body: bodyBytes,
      contentType,
      headers: options?.headers,
      allowHttp: options?.allowHttp,
    });
  },

  /**
   * Download file with progress reporting
   */
  async download(
    url: string,
    requestId?: string,
    options?: {
      allowHttp?: boolean;
    }
  ): Promise<HttpResponse> {
    const invoke = await getInvoke();
    return invoke('http_download', {
      url,
      requestId: requestId || generateRequestId('download'),
      allowHttp: options?.allowHttp,
    });
  },

  /**
   * Cancel a request by ID
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const invoke = await getInvoke();
    return invoke('http_cancel_request', { requestId });
  },

  /**
   * Cancel all pending requests
   */
  async cancelAllRequests(): Promise<void> {
    const invoke = await getInvoke();
    return invoke('http_cancel_all_requests');
  },

  /**
   * Batch download multiple URLs
   */
  async batchDownload(
    urls: string[],
    options?: {
      concurrency?: number;
      allowHttp?: boolean;
    }
  ): Promise<BatchDownloadResult> {
    const invoke = await getInvoke();
    return invoke('http_batch_download', {
      urls,
      concurrency: options?.concurrency,
      allowHttp: options?.allowHttp,
    });
  },

  /**
   * Check if a URL is accessible (HEAD request)
   */
  async checkUrl(url: string, allowHttp?: boolean): Promise<boolean> {
    const invoke = await getInvoke();
    return invoke('http_check_url', { url, allowHttp });
  },

  /**
   * Get response headers only (HEAD request)
   */
  async head(url: string, allowHttp?: boolean): Promise<Record<string, string>> {
    const invoke = await getInvoke();
    return invoke('http_head', { url, allowHttp });
  },

  /**
   * Subscribe to download progress events
   */
  async onDownloadProgress(
    callback: (progress: DownloadProgress) => void
  ): Promise<() => void> {
    const listen = await getListen();
    const unlisten = await listen<DownloadProgress>('download-progress', (event) => {
      callback(event.payload);
    });
    return unlisten;
  },

  /**
   * Subscribe to download progress for a specific request
   */
  async onRequestProgress(
    requestId: string,
    callback: (progress: DownloadProgress) => void
  ): Promise<() => void> {
    const listen = await getListen();
    const unlisten = await listen<DownloadProgress>('download-progress', (event) => {
      if (event.payload.request_id === requestId) {
        callback(event.payload);
      }
    });
    return unlisten;
  },

  /** Check if HTTP API is available */
  isAvailable: isTauri,
};

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Fetch JSON data from a URL
 */
export async function fetchJson<T = unknown>(
  url: string,
  options?: {
    headers?: Record<string, string>;
    allowHttp?: boolean;
  }
): Promise<T> {
  const response = await httpApi.get(url, options);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP error ${response.status}: ${response.status_text}`);
  }
  return responseToJson<T>(response);
}

/**
 * Fetch text content from a URL
 */
export async function fetchText(
  url: string,
  options?: {
    headers?: Record<string, string>;
    allowHttp?: boolean;
  }
): Promise<string> {
  const response = await httpApi.get(url, options);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP error ${response.status}: ${response.status_text}`);
  }
  return responseToString(response);
}

/**
 * Fetch binary data from a URL
 */
export async function fetchBytes(
  url: string,
  options?: {
    headers?: Record<string, string>;
    allowHttp?: boolean;
  }
): Promise<Uint8Array> {
  const response = await httpApi.get(url, options);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP error ${response.status}: ${response.status_text}`);
  }
  return responseToBytes(response);
}

/**
 * Download with progress callback
 */
export async function downloadWithProgress(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
  options?: {
    allowHttp?: boolean;
  }
): Promise<HttpResponse> {
  const requestId = generateRequestId('download');

  // Subscribe to progress
  const unlisten = await httpApi.onRequestProgress(requestId, onProgress);

  try {
    const response = await httpApi.download(url, requestId, options);
    return response;
  } finally {
    unlisten();
  }
}

/**
 * Post JSON data to a URL
 */
export async function postJson<T = unknown>(
  url: string,
  data: object,
  options?: {
    headers?: Record<string, string>;
    allowHttp?: boolean;
  }
): Promise<T> {
  const response = await httpApi.post(url, data, {
    contentType: 'application/json',
    ...options,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP error ${response.status}: ${response.status_text}`);
  }
  return responseToJson<T>(response);
}

export default httpApi;
