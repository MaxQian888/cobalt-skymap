/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { EphemerisTab } from '../ephemeris-tab';

const mockComputeEphemeris = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/astronomy/engine', () => ({
  computeEphemeris: (...args: unknown[]) => mockComputeEphemeris(...args),
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
  degreesToDMS: (value: number) => `${value.toFixed(2)}d`,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <input value={value ?? ''} onChange={onChange} {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableHeader: ({ children }: React.PropsWithChildren) => <thead>{children}</thead>,
  TableBody: ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>,
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({ children }: React.PropsWithChildren) => <td>{children}</td>,
}));

describe('EphemerisTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeEphemeris.mockResolvedValue({
      body: 'Moon',
      points: [
        {
          date: new Date('2025-01-01T00:00:00Z'),
          ra: 12.3,
          dec: 45.6,
          altitude: 30,
          azimuth: 150,
          galacticL: 130,
          galacticB: -20,
          eclipticLon: 100,
          eclipticLat: 10,
          phaseFraction: 0.5,
          magnitude: -1,
        },
      ],
      meta: { backend: 'fallback', model: 'test-model' },
    });
  });

  it('loads ephemeris via unified engine', async () => {
    render(<EphemerisTab latitude={39.9} longitude={116.4} />);

    await waitFor(() => {
      expect(mockComputeEphemeris).toHaveBeenCalled();
    });

    expect(screen.getByText('astroCalc.coordinateOutput')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('12.30h')).toBeInTheDocument();
    });
  });
});
