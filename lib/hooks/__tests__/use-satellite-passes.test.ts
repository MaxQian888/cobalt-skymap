import { renderHook, waitFor } from '@testing-library/react';
import { useSatellitePasses } from '../use-satellite-passes';

jest.mock('@/lib/services/satellite/data-sources', () => ({
  fetchTLEByNoradId: jest.fn(),
}));

jest.mock('@/lib/services/satellite-propagator', () => ({
  parseTLE: jest.fn(),
  predictPasses: jest.fn(),
}));

import { fetchTLEByNoradId } from '@/lib/services/satellite/data-sources';
import { parseTLE, predictPasses } from '@/lib/services/satellite-propagator';

const mockFetchTLE = fetchTLEByNoradId as jest.Mock;
const mockParseTLE = parseTLE as jest.Mock;
const mockPredictPasses = predictPasses as jest.Mock;

describe('useSatellitePasses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('stays idle without a NORAD id', () => {
    const { result } = renderHook(() => useSatellitePasses(null, 40, -74));
    expect(result.current.status).toBe('idle');
    expect(mockFetchTLE).not.toHaveBeenCalled();
  });

  it('predicts and caps passes when a TLE resolves', async () => {
    const pass = (h: number) => ({
      startTime: new Date(Date.now() + h * 3600000),
      maxTime: new Date(Date.now() + h * 3600000 + 300000),
      endTime: new Date(Date.now() + h * 3600000 + 600000),
      startAzimuth: 0, startElevation: 0, maxAzimuth: 90, maxElevation: 45,
      endAzimuth: 180, endElevation: 0, duration: 600, isVisible: true,
    });
    mockFetchTLE.mockResolvedValue({ name: 'ISS', line1: 'l1', line2: 'l2' });
    mockParseTLE.mockReturnValue({ satnum: 25544 });
    mockPredictPasses.mockReturnValue([pass(1), pass(3), pass(5), pass(7), pass(9)]);

    const { result } = renderHook(() => useSatellitePasses(25544, 40, -74));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.passes).toHaveLength(3);
    expect(mockFetchTLE).toHaveBeenCalledWith(25544);
    expect(mockPredictPasses).toHaveBeenCalledWith(
      { satnum: 25544 },
      { latitude: 40, longitude: -74, altitude: 0 },
      expect.any(Date),
      24,
      10,
    );
  });

  it('reports unavailable when the TLE cannot be fetched', async () => {
    mockFetchTLE.mockResolvedValue(null);

    const { result } = renderHook(() => useSatellitePasses(99999, 40, -74));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
    expect(result.current.passes).toEqual([]);
  });

  it('reports unavailable on fetch errors', async () => {
    mockFetchTLE.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useSatellitePasses(25544, 40, -74));

    await waitFor(() => expect(result.current.status).toBe('unavailable'));
  });
});
