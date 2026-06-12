import { renderHook, waitFor } from '@testing-library/react';
import { useHorizonsEphemeris } from '../use-horizons-ephemeris';
import { fetchHorizonsEphemeris } from '@/lib/services/horizons/service';

jest.mock('@/lib/services/horizons/service', () => ({
  fetchHorizonsEphemeris: jest.fn(),
}));

const mockFetch = fetchHorizonsEphemeris as jest.MockedFunction<typeof fetchHorizonsEphemeris>;

describe('useHorizonsEphemeris', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches an ephemeris for the body and exposes the first row', async () => {
    mockFetch.mockResolvedValueOnce({
      body: '499',
      center: '500@399',
      rows: [{ timeUtc: '2026-Jun-12 00:00', raDeg: 157.65, decDeg: 11.22 }],
    });

    const { result } = renderHook(() => useHorizonsEphemeris('Mars', true));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.current.row?.raDeg).toBeCloseTo(157.65, 2);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when disabled', async () => {
    renderHook(() => useHorizonsEphemeris('Mars', false));
    await Promise.resolve();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not fetch when body is null', async () => {
    renderHook(() => useHorizonsEphemeris(null, true));
    await Promise.resolve();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('exposes an error message when the fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useHorizonsEphemeris('Mars', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.row).toBeNull();
    expect(result.current.error).toBe('boom');
  });
});
