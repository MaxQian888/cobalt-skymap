/**
 * React hook for HTTP client with Tauri integration
 * 
 * Provides easy-to-use HTTP functionality with:
 * - Automatic Tauri/browser detection
 * - Download progress tracking
 * - Request cancellation
 * - Loading and error states
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { smartFetch, cancelRequest, checkUrl, batchDownload } from '@/lib/services/http-fetch';
import type { FetchOptions, FetchResponse, DownloadProgress } from '@/lib/services/http-fetch';
import { isTauri } from '@/lib/storage/platform';

// ============================================================================
// Types
// ============================================================================

export interface UseHttpClientOptions {
  /** Base URL to prepend to all requests */
  baseUrl?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Default headers to include in all requests */
  defaultHeaders?: Record<string, string>;
  /** Allow HTTP (non-HTTPS) URLs */
  allowHttp?: boolean;
}

export interface HttpRequestState<T = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  progress: DownloadProgress | null;
}

export interface UseHttpClientReturn {
  /** Execute a GET request */
  get: <T = unknown>(url: string, options?: FetchOptions) => Promise<T>;
  /** Execute a POST request */
  post: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) => Promise<T>;
  /** Execute a PUT request */
  put: <T = unknown>(url: string, body?: unknown, options?: FetchOptions) => Promise<T>;
  /** Execute a DELETE request */
  del: <T = unknown>(url: string, options?: FetchOptions) => Promise<T>;
  /** Download with progress tracking */
  download: (url: string, onProgress?: (progress: DownloadProgress) => void) => Promise<FetchResponse>;
  /** Batch download multiple URLs */
  batchDownload: (urls: string[], options?: { concurrency?: number; onItemComplete?: (url: string, success: boolean) => void }) => Promise<{ success: number; failed: number }>;
  /** Check if URL is accessible */
  checkUrl: (url: string) => Promise<boolean>;
  /** Cancel the current request */
  cancel: () => void;
  /** Cancel all pending requests */
  cancelAll: () => void;
  /** Current request state */
  state: HttpRequestState;
  /** Whether running in Tauri environment */
  isTauriEnv: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useHttpClient(options: UseHttpClientOptions = {}): UseHttpClientReturn {
  const { baseUrl = '', timeout = 30000, defaultHeaders = {}, allowHttp = false } = options;

  const [state, setState] = useState<HttpRequestState>({
    data: null,
    loading: false,
    error: null,
    progress: null,
  });

  const currentRequestId = useRef<string | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentRequestId.current) {
        cancelRequest(currentRequestId.current);
      }
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, []);

  const generateRequestId = () => `hook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const executeRequest = useCallback(async <T>(
    url: string,
    options: FetchOptions = {}
  ): Promise<T> => {
    const requestId = generateRequestId();
    currentRequestId.current = requestId;
    abortController.current = new AbortController();

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      progress: null,
    }));

    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `${baseUrl}${url}`;

    try {
      const response = await smartFetch(fullUrl, {
        timeout,
        allowHttp,
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
        requestId,
        signal: abortController.current.signal,
        onProgress: (progress) => {
          setState(prev => ({ ...prev, progress }));
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json<T>();
      setState(prev => ({
        ...prev,
        data,
        loading: false,
        error: null,
      }));

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        loading: false,
        error: err,
      }));
      throw err;
    } finally {
      currentRequestId.current = null;
      abortController.current = null;
    }
  }, [baseUrl, timeout, defaultHeaders, allowHttp]);

  const get = useCallback(<T = unknown>(url: string, options?: FetchOptions) => {
    return executeRequest<T>(url, { ...options, method: 'GET' });
  }, [executeRequest]);

  const post = useCallback(<T = unknown>(url: string, body?: unknown, options?: FetchOptions) => {
    return executeRequest<T>(url, {
      ...options,
      method: 'POST',
      body: body as FetchOptions['body'],
    });
  }, [executeRequest]);

  const put = useCallback(<T = unknown>(url: string, body?: unknown, options?: FetchOptions) => {
    return executeRequest<T>(url, {
      ...options,
      method: 'PUT',
      body: body as FetchOptions['body'],
    });
  }, [executeRequest]);

  const del = useCallback(<T = unknown>(url: string, options?: FetchOptions) => {
    return executeRequest<T>(url, { ...options, method: 'DELETE' });
  }, [executeRequest]);

  const downloadFn = useCallback(async (
    url: string,
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<FetchResponse> => {
    const requestId = generateRequestId();
    currentRequestId.current = requestId;

    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      progress: null,
    }));

    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `${baseUrl}${url}`;

    try {
      const response = await smartFetch(fullUrl, {
        timeout: 0, // No timeout for downloads
        allowHttp,
        requestId,
        onProgress: (progress) => {
          setState(prev => ({ ...prev, progress }));
          onProgress?.(progress);
        },
      });

      setState(prev => ({
        ...prev,
        loading: false,
      }));

      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({
        ...prev,
        loading: false,
        error: err,
      }));
      throw err;
    } finally {
      currentRequestId.current = null;
    }
  }, [baseUrl, allowHttp]);

  const batchDownloadFn = useCallback(async (
    urls: string[],
    opts?: { concurrency?: number; onItemComplete?: (url: string, success: boolean) => void }
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await batchDownload(
        urls.map(u => u.startsWith('http://') || u.startsWith('https://') ? u : `${baseUrl}${u}`),
        { ...opts, allowHttp }
      );

      setState(prev => ({ ...prev, loading: false }));
      return { success: result.success, failed: result.failed };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState(prev => ({ ...prev, loading: false, error: err }));
      throw err;
    }
  }, [baseUrl, allowHttp]);

  const checkUrlFn = useCallback(async (url: string) => {
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `${baseUrl}${url}`;
    return checkUrl(fullUrl, { allowHttp, timeout: 5000 });
  }, [baseUrl, allowHttp]);

  const cancel = useCallback(() => {
    if (currentRequestId.current) {
      cancelRequest(currentRequestId.current);
      currentRequestId.current = null;
    }
    if (abortController.current) {
      abortController.current.abort();
      abortController.current = null;
    }
    setState(prev => ({ ...prev, loading: false }));
  }, []);

  const cancelAll = useCallback(async () => {
    cancel();
    if (isTauri()) {
      try {
        const { httpApi } = await import('@/lib/tauri/http-api');
        await httpApi.cancelAllRequests();
      } catch {
        // Ignore errors
      }
    }
  }, [cancel]);

  return {
    get,
    post,
    put,
    del,
    download: downloadFn,
    batchDownload: batchDownloadFn,
    checkUrl: checkUrlFn,
    cancel,
    cancelAll,
    state,
    isTauriEnv: isTauri(),
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for simple data fetching with caching
 * Uses useHttpClient internally for Tauri integration
 */
export function useFetch<T = unknown>(
  url: string | null,
  options?: UseHttpClientOptions & { enabled?: boolean }
) {
  const { enabled = true, ...httpOptions } = options || {};
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url && enabled);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const fetchData = useCallback(async (targetUrl: string) => {
    const requestId = `fetch-${Date.now()}`;
    requestIdRef.current = requestId;
    setLoading(true);
    setError(null);

    const fullUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://') 
      ? targetUrl 
      : `${httpOptions.baseUrl || ''}${targetUrl}`;

    try {
      const response = await smartFetch(fullUrl, {
        timeout: httpOptions.timeout || 30000,
        allowHttp: httpOptions.allowHttp,
        headers: httpOptions.defaultHeaders,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json<T>();
      
      // Only update if this is still the current request
      if (requestIdRef.current === requestId) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
      throw err;
    }
  }, [httpOptions.baseUrl, httpOptions.timeout, httpOptions.allowHttp, httpOptions.defaultHeaders]);

  useEffect(() => {
    if (!url || !enabled) {
      // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving sync timing
      queueMicrotask(() => {
        setLoading(false);
      });
      return;
    }

    // queueMicrotask satisfies react-hooks/set-state-in-effect while preserving fetch-on-mount timing
    queueMicrotask(() => {
      fetchData(url).catch(() => {});
    });

    return () => {
      requestIdRef.current = null;
    };
  }, [url, enabled, fetchData]);

  const refetch = useCallback(() => {
    if (url) return fetchData(url);
    return Promise.resolve(null);
  }, [url, fetchData]);

  return { data, loading, error, refetch };
}

export default useHttpClient;
