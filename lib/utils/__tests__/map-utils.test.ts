/**
 * @jest-environment jsdom
 */

import { maskApiKey, getQuotaUsagePercent, formatResponseTime, fetchElevation } from '../map-utils';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('map-utils', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('maskApiKey', () => {
    it('should mask keys longer than 8 chars', () => {
      expect(maskApiKey('abcdefghijkl')).toBe('abcd••••••••ijkl');
    });

    it('should fully mask short keys', () => {
      expect(maskApiKey('short')).toBe('••••••••');
    });
  });

  describe('getQuotaUsagePercent', () => {
    it('should return 0 when no quota', () => {
      expect(getQuotaUsagePercent({ id: '1', provider: 'google', apiKey: 'k', createdAt: '' })).toBe(0);
    });

    it('should fall back to monthly quota when daily quota is missing', () => {
      expect(getQuotaUsagePercent({
        id: '1', provider: 'google', apiKey: 'k', createdAt: '',
        quota: { monthly: 2000, used: 500 },
      })).toBe(25);
    });

    it('should return 0 when quota exists but no limits are configured', () => {
      expect(getQuotaUsagePercent({
        id: '1', provider: 'google', apiKey: 'k', createdAt: '',
        quota: { used: 500 },
      })).toBe(0);
    });

    it('should calculate percentage', () => {
      expect(getQuotaUsagePercent({
        id: '1', provider: 'google', apiKey: 'k', createdAt: '',
        quota: { daily: 1000, used: 500 },
      })).toBe(50);
    });

    it('should cap at 100%', () => {
      expect(getQuotaUsagePercent({
        id: '1', provider: 'google', apiKey: 'k', createdAt: '',
        quota: { daily: 100, used: 200 },
      })).toBe(100);
    });
  });

  describe('formatResponseTime', () => {
    it('should format milliseconds', () => {
      expect(formatResponseTime(500)).toBe('500ms');
    });

    it('should format seconds', () => {
      expect(formatResponseTime(1500)).toBe('1.5s');
    });
  });

  describe('fetchElevation', () => {
    it('should return elevation on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [{ elevation: 123 }],
        }),
      });

      const elevation = await fetchElevation(40.7128, -74.006);
      expect(elevation).toBe(123);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const url = mockFetch.mock.calls[0][0];
      expect(url).toContain('40.7128');
      expect(url).toContain('-74.006');
    });

    it('should return null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const elevation = await fetchElevation(0, 0);
      expect(elevation).toBeNull();
    });

    it('should return null on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });

      const elevation = await fetchElevation(0, 0);
      expect(elevation).toBeNull();
    });

    it('should return null when results are empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: [] }),
      });

      const elevation = await fetchElevation(0, 0);
      expect(elevation).toBeNull();
    });

    it('should use custom timeout', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: [{ elevation: 50 }] }),
      });

      const elevation = await fetchElevation(0, 0, { timeout: 2000 });
      expect(elevation).toBe(50);
    });
  });
});
