/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RTSTab } from '../rts-tab';

const mockComputeRiseTransitSet = jest.fn();
const mockFetchSmallBodyEphemeris = jest.fn();
const originalConsoleError = console.error;
const mockCopyTextWithFeedback = jest.fn();
const t = (key: string) => key;

jest.mock('next-intl', () => ({
  useTranslations: () => t,
}));

jest.mock('@/lib/astronomy/engine', () => ({
  computeRiseTransitSet: (...args: unknown[]) => mockComputeRiseTransitSet(...args),
  serializeCacheKey: (payload: unknown) => JSON.stringify(payload),
}));

jest.mock('../small-body-adapter', () => ({
  fetchSmallBodyEphemeris: (...args: unknown[]) => mockFetchSmallBodyEphemeris(...args),
}));

jest.mock('@/lib/utils/clipboard-feedback', () => ({
  copyTextWithFeedback: (...args: unknown[]) => mockCopyTextWithFeedback(...args),
}));

jest.mock('@/lib/astronomy/time/formats', () => ({
  formatTimeShort: (date: Date | null) => (date ? '12:00' : '--'),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
  degreesToDMS: (value: number) => `${value.toFixed(2)}d`,
}));

jest.mock('../../altitude-chart', () => ({
  AltitudeChart: () => <div data-testid="altitude-chart" />,
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <input value={value ?? ''} onChange={onChange} {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.PropsWithChildren) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollBar: () => null,
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

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('RTSTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (String(firstArg).includes('Not implemented: navigation')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    URL.createObjectURL = jest.fn(() => 'blob:rts-export');
    URL.revokeObjectURL = jest.fn();
    mockComputeRiseTransitSet.mockResolvedValue({
      riseTime: new Date('2025-01-01T10:00:00Z'),
      transitTime: new Date('2025-01-01T14:00:00Z'),
      setTime: new Date('2025-01-01T18:00:00Z'),
      transitAltitude: 60,
      currentAltitude: 30,
      currentAzimuth: 120,
      isCircumpolar: false,
      neverRises: false,
      darkImagingStart: null,
      darkImagingEnd: null,
      darkImagingHours: 2,
      meta: { backend: 'fallback', model: 'test' },
    });
    mockFetchSmallBodyEphemeris.mockResolvedValue({
      points: [{
        date: new Date('2025-01-01T12:00:00Z'),
        ra: 124.70441,
        dec: 2.32426,
        altitude: 10,
        azimuth: 120,
      }],
      meta: {
        source: 'horizons',
        degraded: false,
        warnings: [],
        resolvedName: '1P/Halley',
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows invalid coordinate warning and skips compute when custom coordinates are invalid', async () => {
    render(
      <RTSTab
        latitude={39.9}
        longitude={116.4}
        selectedTarget={{ name: 'M31', ra: 10.684, dec: 41.269 }}
      />
    );

    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    fireEvent.change(inputs[1], { target: { value: 'invalid-ra' } });
    fireEvent.change(inputs[2], { target: { value: 'invalid-dec' } });

    await waitFor(() => {
      expect(screen.getByText('astroCalc.invalidCoordinates')).toBeInTheDocument();
    });

    expect(mockComputeRiseTransitSet).not.toHaveBeenCalled();
  });

  it('uses small-body ephemeris points when the target name is an explicit minor object query', async () => {
    render(<RTSTab latitude={39.9} longitude={116.4} />);

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: '1P/Halley' } });

    await waitFor(() => {
      expect(mockFetchSmallBodyEphemeris).toHaveBeenCalledWith(expect.objectContaining({
        query: '1P/Halley',
      }));
    });
  });

  it('renders copy/export actions for computed rows', async () => {
    render(
      <RTSTab
        latitude={39.9}
        longitude={116.4}
        observerContext={{
          locationName: 'Mountain Base',
          latitude: 39.9,
          longitude: 116.4,
          elevation: 1250,
          timezone: 'Asia/Shanghai',
          sharedDate: '2025-01-01',
          sharedTime: '22:00',
          constraints: { minAltitude: 15, moonInterference: 'moderate' },
          source: 'saved-location',
          contextKey: 'site-a',
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('2.0h').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.copyResults' }));
    await waitFor(() => {
      expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Mountain Base'),
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.exportResults' }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('renders the compact-layout result action bar with full-width buttons', async () => {
    render(<RTSTab latitude={39.9} longitude={116.4} />);

    await waitFor(() => {
      expect(screen.getAllByText('2.0h').length).toBeGreaterThan(0);
    });

    const actionBar = screen.getByTestId('astro-calculator-result-actions');
    expect(actionBar.className).toContain('grid');
    expect(actionBar.className).toContain('sm:flex');
    expect(screen.getByRole('button', { name: 'astroCalc.copyResults' }).className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'astroCalc.exportResults' }).className).toContain('sm:w-auto');
  });
});
