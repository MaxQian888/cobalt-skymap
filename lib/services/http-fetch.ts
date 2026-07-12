/**
 * Smart HTTP Fetch Utility
 * 
 * Automatically uses Tauri HTTP client when in desktop environment,
 * falls back to browser fetch in web environment.
 * 
 * Benefits of using Tauri HTTP client:
 * - Automatic retries with exponential backoff
 * - Request cancellation support
 * - Progress reporting for downloads
 * - Rate limiting integration
 * - Proxy support
 * - Better error handling
 */

import { isTauri } from '@/lib/storage/platform';
import { unifiedCache, type CacheStrategy, type FetchOptions as UnifiedCacheFetchOptions } from '@/lib/offline/unified-cache';
import { resolveCachePolicy, type CachePolicyId } from '@/lib/cache/integration-policy';

// Types
export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | object | Uint8Array;
  timeout?: number;
  allowHttp?: boolean;
  signal?: AbortSignal;
  /** Request ID for cancellation (Tauri only) */
  requestId?: string;
  /** Progress callback for downloads (Tauri only) */
  onProgress?: (progress: DownloadProgress) => void;
  /** Named cache policy for audited integrations */
  cachePolicy?: CachePolicyId;
  /** Override cache strategy for the selected policy */
  cacheStrategy?: CacheStrategy;
  /** Override cache TTL for the selected policy */
  cacheTtl?: number;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  text: () => Promise<string>;
  json: <T = unknown>() => Promise<T>;
  bytes: () => Promise<Uint8Array>;
  blob: () => Promise<Blob>;
}

export interface DownloadProgress {
  request_id: string;
  downloaded: number;
  total: number | null;
  percent: number | null;
}

// Lazy load Tauri HTTP API to avoid import errors in web environment
let tauriHttpApi: typeof import('@/lib/tauri/http-api').httpApi | null = null;
let tauriListen: typeof import('@tauri-apps/api/event').listen | null = null;

async function getTauriHttpApi() {
  if (!isTauri()) return null;
  
  if (!tauriHttpApi) {
    try {
      const httpModule = await import('@/lib/tauri/http-api');
      tauriHttpApi = httpModule.httpApi;
    } catch {
      return null;
    }
  }
  return tauriHttpApi;
}

async function getTauriListen() {
  if (!isTauri()) return null;
  
  if (!tauriListen) {
    try {
      const eventModule = await import('@tauri-apps/api/event');
      tauriListen = eventModule.listen;
    } catch {
      return null;
    }
  }
  return tauriListen;
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `fetch-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Convert Tauri response to FetchResponse interface
 */
function createTauriResponse(tauriResponse: {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: number[];
  content_type: string | null;
  final_url: string;
}): FetchResponse {
  const bodyBytes = new Uint8Array(tauriResponse.body);
  let bodyUsed = false;

  const getBody = () => {
    if (bodyUsed) {
      throw new Error('Body has already been consumed');
    }
    bodyUsed = true;
    return bodyBytes;
  };

  return {
    ok: tauriResponse.status >= 200 && tauriResponse.status < 300,
    status: tauriResponse.status,
    statusText: tauriResponse.status_text,
    headers: tauriResponse.headers,
    url: tauriResponse.final_url,
    text: async () => new TextDecoder().decode(getBody()),
    json: async <T = unknown>() => JSON.parse(new TextDecoder().decode(getBody())) as T,
    bytes: async () => getBody(),
    blob: async () => {
      const bytes = getBody();
      const type = tauriResponse.content_type || 'application/octet-stream';
      const buffer = new ArrayBuffer(bytes.length);
      new Uint8Array(buffer).set(bytes);
      return new Blob([buffer], { type });
    },
  };
}

/**
 * Convert browser Response to FetchResponse interface
 */
function createBrowserResponse(response: Response, fallbackUrl?: string): FetchResponse {
  let bodyUsed = false;
  let cachedBody: Uint8Array | null = null;

  const getBody = async () => {
    if (cachedBody) return cachedBody;
    if (bodyUsed) {
      throw new Error('Body has already been consumed');
    }
    bodyUsed = true;
    cachedBody = new Uint8Array(await response.arrayBuffer());
    return cachedBody;
  };

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers,
    url: response.url || fallbackUrl || '',
    text: async () => new TextDecoder().decode(await getBody()),
    json: async <T = unknown>() => JSON.parse(new TextDecoder().decode(await getBody())) as T,
    bytes: async () => getBody(),
    blob: async () => {
      const bytes = await getBody();
      const type = response.headers.get('content-type') || 'application/octet-stream';
      const buffer = new ArrayBuffer(bytes.length);
      new Uint8Array(buffer).set(bytes);
      return new Blob([buffer], { type });
    },
  };
}

function createNativeResponseFromTauri(tauriResponse: {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: number[];
  content_type: string | null;
}): Response {
  const headers = new Headers(tauriResponse.headers);
  if (tauriResponse.content_type && !headers.has('content-type')) {
    headers.set('content-type', tauriResponse.content_type);
  }

  return new Response(new Uint8Array(tauriResponse.body), {
    status: tauriResponse.status,
    statusText: tauriResponse.status_text,
    headers,
  });
}

function headersInitToRecord(headers?: HeadersInit): Record<string, string> | undefined {
  if (!headers) return undefined;

  if (headers instanceof Headers) {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return { ...headers };
}

function toFetchResponse(value: Response | Partial<FetchResponse>, requestUrl: string): FetchResponse {
  if (isNativeResponse(value)) {
    return createBrowserResponse(value, requestUrl);
  }

  if (isFetchResponseLike(value)) {
    return createFetchResponseFromLike(value, requestUrl);
  }

  throw new Error('Invalid fetch response');
}

function shouldUsePersistentCache(options: FetchOptions): boolean {
  if (!options.cachePolicy) return false;

  const method = options.method || 'GET';
  if (method !== 'GET') return false;

  const policy = resolveCachePolicy(options.cachePolicy, {
    strategy: options.cacheStrategy,
    ttl: options.cacheTtl,
  });

  return policy.mode === 'persistent-shared';
}

function isNativeResponse(value: unknown): value is Response {
  const v = value as Response | null;
  return !!v && typeof (v as Response).arrayBuffer === 'function' && !!(v as Response).headers;
}

function isFetchResponseLike(value: unknown): value is Partial<FetchResponse> {
  const v = value as Partial<FetchResponse> | null;
  return (
    !!v &&
    typeof v.ok === 'boolean' &&
    (typeof v.json === 'function' || typeof v.text === 'function')
  );
}

function createFetchResponseFromLike(value: Partial<FetchResponse>, requestUrl: string): FetchResponse {
  const ok = Boolean(value.ok);
  const status = typeof value.status === 'number' ? value.status : ok ? 200 : 500;
  const statusText = typeof value.statusText === 'string' ? value.statusText : ok ? 'OK' : 'Error';
  const headers = (value.headers as Record<string, string> | undefined) ?? {};
  const url = typeof value.url === 'string' ? value.url : requestUrl;

  const text =
    typeof value.text === 'function'
      ? value.text.bind(value)
      : async () => '';

  const json =
    typeof value.json === 'function'
      ? value.json.bind(value)
      : (async <T = unknown>() => JSON.parse(await text()) as T);

  const bytes =
    typeof value.bytes === 'function'
      ? value.bytes.bind(value)
      : async () => new Uint8Array();

  const blob =
    typeof value.blob === 'function'
      ? value.blob.bind(value)
      : async () => {
        const b = await bytes();
        const ab = new ArrayBuffer(b.byteLength);
        new Uint8Array(ab).set(b);
        return new Blob([ab], { type: 'application/octet-stream' });
      };

  return {
    ok,
    status,
    statusText,
    headers,
    url,
    text,
    json,
    bytes,
    blob,
  };
}

/**
 * Smart fetch function that uses Tauri HTTP client when available
 */
export async function smartFetch(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResponse> {
  if (shouldUsePersistentCache(options)) {
    const policy = resolveCachePolicy(options.cachePolicy!, {
      strategy: options.cacheStrategy,
      ttl: options.cacheTtl,
    });

    const cacheResponse = await unifiedCache.fetch(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body as BodyInit | null | undefined,
        signal: options.signal,
        ttl: policy.ttl,
        cacheable: true,
        networkFetcher: async (requestUrl, init) => {
          const mergedOptions: FetchOptions = {
            ...options,
            method: (init.method as FetchOptions['method']) || options.method || 'GET',
            headers: headersInitToRecord(init.headers) || options.headers,
            body: options.body,
            signal: init.signal || options.signal,
          };

          const httpApi = await getTauriHttpApi();
          if (httpApi) {
            return fetchWithTauriNative(httpApi, requestUrl, mergedOptions);
          }

          return fetchWithBrowserNative(requestUrl, mergedOptions);
        },
      } as UnifiedCacheFetchOptions,
      policy.strategy
    );

    return toFetchResponse(cacheResponse, url);
  }

  const httpApi = await getTauriHttpApi();

  // Use Tauri HTTP client if available
  if (httpApi) {
    return fetchWithTauri(httpApi, url, options);
  }

  // Fallback to browser fetch
  return fetchWithBrowser(url, options);
}

async function fetchWithTauriNative(
  httpApi: NonNullable<typeof tauriHttpApi>,
  url: string,
  options: FetchOptions
): Promise<Response> {
  const requestId = options.requestId || generateRequestId();
  let unlisten: (() => void) | null = null;

  try {
    if (options.onProgress) {
      const listen = await getTauriListen();
      if (listen) {
        unlisten = await listen<DownloadProgress>('download-progress', (event) => {
          if (event.payload.request_id === requestId) {
            options.onProgress!(event.payload);
          }
        });
      }
    }

    const method = options.method || 'GET';
    let bodyBytes: number[] | undefined;
    let contentType = options.headers?.['Content-Type'] || options.headers?.['content-type'];

    if (options.body) {
      if (typeof options.body === 'string') {
        bodyBytes = Array.from(new TextEncoder().encode(options.body));
        contentType = contentType || 'text/plain';
      } else if (options.body instanceof Uint8Array) {
        bodyBytes = Array.from(options.body);
        contentType = contentType || 'application/octet-stream';
      } else {
        bodyBytes = Array.from(new TextEncoder().encode(JSON.stringify(options.body)));
        contentType = contentType || 'application/json';
      }
    }

    const headers: Record<string, string> = { ...options.headers };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const response = await httpApi.request({
      method,
      url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: bodyBytes,
      content_type: contentType,
      timeout_ms: options.timeout,
      allow_http: options.allowHttp || false,
      request_id: requestId,
    });

    return createNativeResponseFromTauri(response);
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}

async function fetchWithBrowserNative(
  url: string,
  options: FetchOptions
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (options.timeout) {
    timeoutId = setTimeout(() => controller.abort(), options.timeout);
  }

  const signal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal;

  try {
    let body: string | undefined;
    const headers = new Headers(options.headers);

    if (options.body) {
      if (typeof options.body === 'string') {
        body = options.body;
      } else if (options.body instanceof Uint8Array) {
        body = new TextDecoder().decode(options.body);
      } else {
        body = JSON.stringify(options.body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      signal,
    });

    if (isNativeResponse(response)) {
      return response;
    }

    throw new Error('Invalid fetch response');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Fetch using Tauri HTTP client
 */
async function fetchWithTauri(
  httpApi: NonNullable<typeof tauriHttpApi>,
  url: string,
  options: FetchOptions
): Promise<FetchResponse> {
  const requestId = options.requestId || generateRequestId();
  let unlisten: (() => void) | null = null;

  try {
    // Set up progress listener if callback provided
    if (options.onProgress) {
      const listen = await getTauriListen();
      if (listen) {
        unlisten = await listen<DownloadProgress>('download-progress', (event) => {
          if (event.payload.request_id === requestId) {
            options.onProgress!(event.payload);
          }
        });
      }
    }

    const method = options.method || 'GET';

    // Prepare body
    let bodyBytes: number[] | undefined;
    let contentType = options.headers?.['Content-Type'] || options.headers?.['content-type'];

    if (options.body) {
      if (typeof options.body === 'string') {
        bodyBytes = Array.from(new TextEncoder().encode(options.body));
        contentType = contentType || 'text/plain';
      } else if (options.body instanceof Uint8Array) {
        bodyBytes = Array.from(options.body);
        contentType = contentType || 'application/octet-stream';
      } else {
        bodyBytes = Array.from(new TextEncoder().encode(JSON.stringify(options.body)));
        contentType = contentType || 'application/json';
      }
    }

    // Build headers
    const headers: Record<string, string> = { ...options.headers };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    // Execute request
    const response = await httpApi.request({
      method,
      url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: bodyBytes,
      content_type: contentType,
      timeout_ms: options.timeout,
      allow_http: options.allowHttp || false,
      request_id: requestId,
    });

    return createTauriResponse(response);
  } finally {
    if (unlisten) {
      unlisten();
    }
  }
}

/**
 * Fetch using browser fetch API
 */
async function fetchWithBrowser(
  url: string,
  options: FetchOptions
): Promise<FetchResponse> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (options.timeout) {
    timeoutId = setTimeout(() => controller.abort(), options.timeout);
  }

  // Combine abort signals
  const signal = options.signal
    ? anySignal([options.signal, controller.signal])
    : controller.signal;

  try {
    // Prepare body
    let body: string | undefined;
    const headers = new Headers(options.headers);

    if (options.body) {
      if (typeof options.body === 'string') {
        body = options.body;
      } else if (options.body instanceof Uint8Array) {
        body = new TextDecoder().decode(options.body);
      } else {
        body = JSON.stringify(options.body);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      }
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body,
      signal,
    });

    if (isNativeResponse(response)) {
      return createBrowserResponse(response);
    }

    if (isFetchResponseLike(response)) {
      return createFetchResponseFromLike(response, url);
    }

    throw new Error('Invalid fetch response');
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Combine multiple AbortSignals into one
 */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), {
      once: true,
    });
  }

  return controller.signal;
}

/**
 * Cancel a request by ID (Tauri only)
 */
export async function cancelRequest(requestId: string): Promise<boolean> {
  const httpApi = await getTauriHttpApi();
  if (httpApi) {
    return httpApi.cancelRequest(requestId);
  }
  return false;
}

/**
 * Cancel all pending requests (Tauri only)
 */
export async function cancelAllRequests(): Promise<void> {
  const httpApi = await getTauriHttpApi();
  if (httpApi) {
    await httpApi.cancelAllRequests();
  }
}

/**
 * Check if a URL is accessible
 */
export async function checkUrl(url: string, options?: { allowHttp?: boolean; timeout?: number }): Promise<boolean> {
  try {
    const httpApi = await getTauriHttpApi();
    if (httpApi) {
      return httpApi.checkUrl(url, options?.allowHttp);
    }

    // Browser fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || 5000);

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      });
      return response.ok;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return false;
  }
}

/**
 * Batch download multiple URLs
 */
export async function batchDownload(
  urls: string[],
  options?: {
    concurrency?: number;
    allowHttp?: boolean;
    onItemComplete?: (url: string, success: boolean) => void;
  }
): Promise<{ success: number; failed: number; results: Array<{ url: string; success: boolean; error?: string }> }> {
  const httpApi = await getTauriHttpApi();

  if (httpApi) {
    const result = await httpApi.batchDownload(urls, {
      concurrency: options?.concurrency,
      allowHttp: options?.allowHttp,
    });

    // Call onItemComplete for each result
    if (options?.onItemComplete) {
      for (const item of result.results) {
        options.onItemComplete(item.url, item.success);
      }
    }

    return {
      success: result.success,
      failed: result.failed,
      results: result.results.map(r => ({
        url: r.url,
        success: r.success,
        error: r.error || undefined,
      })),
    };
  }

  // Browser fallback with Promise.allSettled
  const concurrency = options?.concurrency || 4;
  const results: Array<{ url: string; success: boolean; error?: string }> = [];
  let success = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const response = await smartFetch(url, { allowHttp: options?.allowHttp });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return url;
      })
    );

    for (let j = 0; j < batchResults.length; j++) {
      const url = batch[j];
      const result = batchResults[j];

      if (result.status === 'fulfilled') {
        success++;
        results.push({ url, success: true });
        options?.onItemComplete?.(url, true);
      } else {
        failed++;
        results.push({ url, success: false, error: result.reason?.message });
        options?.onItemComplete?.(url, false);
      }
    }
  }

  return { success, failed, results };
}

// Convenience functions
export const httpFetch = {
  get: (url: string, options?: Omit<FetchOptions, 'method'>) =>
    smartFetch(url, { ...options, method: 'GET' }),

  post: (url: string, body?: FetchOptions['body'], options?: Omit<FetchOptions, 'method' | 'body'>) =>
    smartFetch(url, { ...options, method: 'POST', body }),

  put: (url: string, body?: FetchOptions['body'], options?: Omit<FetchOptions, 'method' | 'body'>) =>
    smartFetch(url, { ...options, method: 'PUT', body }),

  delete: (url: string, options?: Omit<FetchOptions, 'method'>) =>
    smartFetch(url, { ...options, method: 'DELETE' }),

  head: (url: string, options?: Omit<FetchOptions, 'method'>) =>
    smartFetch(url, { ...options, method: 'HEAD' }),
};

export default smartFetch;
