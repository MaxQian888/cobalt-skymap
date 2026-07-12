/**
 * Tests for Smart HTTP Fetch Utility
 */

import {
  smartFetch,
  cancelRequest,
  checkUrl,
  batchDownload,
  httpFetch,
} from '../http-fetch';
import type { FetchResponse, DownloadProgress } from '../http-fetch';

const mockUnifiedCacheFetch = jest.fn();

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: jest.fn(),
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: jest.fn(() => false),
}));

jest.mock('@/lib/offline/unified-cache', () => ({
  unifiedCache: {
    fetch: (...args: unknown[]) => mockUnifiedCacheFetch(...args),
  },
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Smart HTTP Fetch Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    mockUnifiedCacheFetch.mockReset();
  });

  describe('smartFetch', () => {
    it('should make a GET request in browser environment', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/data',
        arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode('{"test":true}').buffer),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await smartFetch('https://api.example.com/data');

      expect(response.ok).toBe(true);
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should make a POST request with JSON body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/data',
        arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode('{"id":1}').buffer),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await smartFetch('https://api.example.com/data', {
        method: 'POST',
        body: { name: 'test' },
      });

      expect(response.ok).toBe(true);
      expect(response.status).toBe(201);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'POST',
          body: '{"name":"test"}',
        })
      );
    });

    it('should handle request timeout', async () => {
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100);
      }));

      await expect(smartFetch('https://api.example.com/data', { timeout: 50 }))
        .rejects.toThrow();
    });

    it('should convert response to JSON', async () => {
      const testData = { message: 'Hello', count: 42 };
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'https://api.example.com/data',
        arrayBuffer: jest.fn().mockResolvedValue(
          new TextEncoder().encode(JSON.stringify(testData)).buffer
        ),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await smartFetch('https://api.example.com/data');
      const json = await response.json<typeof testData>();

      expect(json).toEqual(testData);
    });

    it('should convert response to text', async () => {
      const testText = 'Hello, World!';
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        url: 'https://api.example.com/text',
        arrayBuffer: jest.fn().mockResolvedValue(
          new TextEncoder().encode(testText).buffer
        ),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await smartFetch('https://api.example.com/text');
      const text = await response.text();

      expect(text).toBe(testText);
    });

    it('should convert response to bytes', async () => {
      const testBytes = new Uint8Array([1, 2, 3, 4, 5]);
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/octet-stream' }),
        url: 'https://api.example.com/binary',
        arrayBuffer: jest.fn().mockResolvedValue(testBytes.buffer),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await smartFetch('https://api.example.com/binary');
      const bytes = await response.bytes();

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        url: 'https://api.example.com/notfound',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response = await smartFetch('https://api.example.com/notfound');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
    });

    it('should include custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        url: 'https://api.example.com/auth',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await smartFetch('https://api.example.com/auth', {
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/auth',
        expect.objectContaining({
          headers: expect.any(Headers),
        })
      );
    });

    it('routes persistent cache policies through unified cache', async () => {
      mockUnifiedCacheFetch.mockResolvedValue(
        {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'application/json' }),
          url: 'https://aladin.cds.unistra.fr/hips/list',
          arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode('{"cached":true}').buffer),
        }
      );

      const response = await smartFetch('https://aladin.cds.unistra.fr/hips/list', {
        cachePolicy: 'hips-registry',
      });
      const json = await response.json<{ cached: boolean }>();

      expect(json).toEqual({ cached: true });
      expect(mockUnifiedCacheFetch).toHaveBeenCalledWith(
        'https://aladin.cds.unistra.fr/hips/list',
        expect.objectContaining({
          cacheable: true,
          ttl: expect.any(Number),
        }),
        'network-first'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('bypasses persistent cache routing for uncached policies', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        url: 'http://api.open-notify.org/iss-now.json',
        arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode('{"ok":true}').buffer),
      };
      mockFetch.mockResolvedValue(mockResponse);

      await smartFetch('http://api.open-notify.org/iss-now.json', {
        allowHttp: true,
        cachePolicy: 'astro-iss-position',
      });

      expect(mockUnifiedCacheFetch).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('httpFetch convenience methods', () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        url: 'https://api.example.com/test',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      mockFetch.mockResolvedValue(mockResponse);
    });

    it('should have get method', async () => {
      await httpFetch.get('https://api.example.com/test');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should have post method', async () => {
      await httpFetch.post('https://api.example.com/test', { data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should have put method', async () => {
      await httpFetch.put('https://api.example.com/test', { data: 'test' });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should have delete method', async () => {
      await httpFetch.delete('https://api.example.com/test');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should have head method', async () => {
      await httpFetch.head('https://api.example.com/test');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({ method: 'HEAD' })
      );
    });
  });

  describe('checkUrl', () => {
    it('should return true for accessible URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        url: 'https://api.example.com/health',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await checkUrl('https://api.example.com/health');
      expect(result).toBe(true);
    });

    it('should return false for inaccessible URL', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await checkUrl('https://api.example.com/notfound');
      expect(result).toBe(false);
    });

    it('should return false for 404 response', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
        url: 'https://api.example.com/missing',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await checkUrl('https://api.example.com/missing');
      expect(result).toBe(false);
    });
  });

  describe('batchDownload', () => {
    it('should download multiple URLs', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        url: 'https://api.example.com/file',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const urls = [
        'https://api.example.com/file1',
        'https://api.example.com/file2',
        'https://api.example.com/file3',
      ];

      const result = await batchDownload(urls);

      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it('should handle partial failures', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          url: 'https://api.example.com/file1',
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
        })
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers(),
          url: 'https://api.example.com/file3',
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
        });

      const urls = [
        'https://api.example.com/file1',
        'https://api.example.com/file2',
        'https://api.example.com/file3',
      ];

      const result = await batchDownload(urls, { concurrency: 1 });

      expect(result.success).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should call onItemComplete callback', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        url: 'https://api.example.com/file',
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const onItemComplete = jest.fn();
      const urls = ['https://api.example.com/file1', 'https://api.example.com/file2'];

      await batchDownload(urls, { onItemComplete });

      expect(onItemComplete).toHaveBeenCalledTimes(2);
      expect(onItemComplete).toHaveBeenCalledWith('https://api.example.com/file1', true);
      expect(onItemComplete).toHaveBeenCalledWith('https://api.example.com/file2', true);
    });
  });

  describe('cancelRequest', () => {
    it('should return false when not in Tauri environment', async () => {
      const result = await cancelRequest('test-request-id');
      expect(result).toBe(false);
    });
  });

  describe('FetchResponse interface', () => {
    it('should have correct structure', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json', 'x-custom': 'value' }),
        url: 'https://api.example.com/data',
        arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode('{}').buffer),
      };
      mockFetch.mockResolvedValue(mockResponse);

      const response: FetchResponse = await smartFetch('https://api.example.com/data');

      expect(response).toHaveProperty('ok');
      expect(response).toHaveProperty('status');
      expect(response).toHaveProperty('statusText');
      expect(response).toHaveProperty('headers');
      expect(response).toHaveProperty('url');
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('json');
      expect(response).toHaveProperty('bytes');
      expect(response).toHaveProperty('blob');
      expect(typeof response.text).toBe('function');
      expect(typeof response.json).toBe('function');
      expect(typeof response.bytes).toBe('function');
      expect(typeof response.blob).toBe('function');
    });
  });
});

describe('DownloadProgress type', () => {
  it('should have correct structure', () => {
    const progress: DownloadProgress = {
      request_id: 'test-123',
      downloaded: 1024,
      total: 2048,
      percent: 50,
    };

    expect(progress.request_id).toBe('test-123');
    expect(progress.downloaded).toBe(1024);
    expect(progress.total).toBe(2048);
    expect(progress.percent).toBe(50);
  });

  it('should allow null values for optional fields', () => {
    const progress: DownloadProgress = {
      request_id: 'test-456',
      downloaded: 512,
      total: null,
      percent: null,
    };

    expect(progress.total).toBeNull();
    expect(progress.percent).toBeNull();
  });
});
