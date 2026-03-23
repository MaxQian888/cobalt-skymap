/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AlmanacTab } from '../almanac-tab';

const mockComputeAlmanac = jest.fn();
const mockComputeRiseTransitSet = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/astronomy/engine', () => ({
  computeAlmanac: (...args: unknown[]) => mockComputeAlmanac(...args),
  computeRiseTransitSet: (...args: unknown[]) => mockComputeRiseTransitSet(...args),
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
  degreesToDMS: (value: number) => `${value.toFixed(2)}d`,
}));

jest.mock('@/lib/astronomy/time/formats', () => ({
  formatTimeShort: (date: Date | null) => (date ? '12:00' : '--'),
  formatDuration: (value: number) => `${value.toFixed(1)}h`,
}));

jest.mock('../../moon-phase-svg', () => ({
  MoonPhaseSVG: () => <div data-testid="moon-phase-svg" />,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <input value={value ?? ''} onChange={onChange} {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

describe('AlmanacTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeAlmanac.mockResolvedValue({
      twilight: {
        sunrise: new Date('2025-01-01T07:00:00Z'),
        sunset: new Date('2025-01-01T17:00:00Z'),
        civilDawn: new Date('2025-01-01T06:30:00Z'),
        civilDusk: new Date('2025-01-01T17:30:00Z'),
        nauticalDawn: new Date('2025-01-01T06:00:00Z'),
        nauticalDusk: new Date('2025-01-01T18:00:00Z'),
        astronomicalDawn: new Date('2025-01-01T05:30:00Z'),
        astronomicalDusk: new Date('2025-01-01T18:30:00Z'),
        nightDuration: 10,
        darknessDuration: 8,
        isCurrentlyNight: true,
        currentTwilightPhase: 'night',
      },
      sun: {
        ra: 120,
        dec: 20,
        altitude: 15,
        azimuth: 200,
      },
      moon: {
        ra: 200,
        dec: -10,
        altitude: 35,
        azimuth: 130,
        phase: 0.4,
        illumination: 40,
        riseTime: new Date('2025-01-01T10:00:00Z'),
        setTime: new Date('2025-01-01T22:00:00Z'),
      },
      meta: { backend: 'fallback', model: 'test-model' },
    });
    mockComputeRiseTransitSet.mockResolvedValue({
      riseTime: new Date('2025-01-01T07:00:00Z'),
      transitTime: new Date('2025-01-01T12:00:00Z'),
      setTime: new Date('2025-01-01T17:00:00Z'),
      transitAltitude: 45,
      currentAltitude: 10,
      currentAzimuth: 100,
      isCircumpolar: false,
      neverRises: false,
      darkImagingStart: null,
      darkImagingEnd: null,
      darkImagingHours: 0,
      meta: { backend: 'fallback', model: 'test-model' },
    });
  });

  it('loads and renders almanac summary from engine', async () => {
    render(<AlmanacTab latitude={39.9} longitude={116.4} />);

    await waitFor(() => {
      expect(mockComputeAlmanac).toHaveBeenCalled();
      expect(mockComputeRiseTransitSet).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('astroCalc.solarNoon')).toBeInTheDocument();
    });
    expect(screen.getByText('120.00h')).toBeInTheDocument();
    expect(screen.getAllByText('40.0%').length).toBeGreaterThan(0);
  });
});
