/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SolarSystemTab } from '../solar-system-tab';

const mockRunCalculatorEphemerisBatch = jest.fn();
const mockRunCalculatorRiseTransitSetBatch = jest.fn();
const mockSummarizeCalculatorMeta = jest.fn();
const translate = (key: string) => key;

jest.mock('next-intl', () => ({
  useTranslations: () => translate,
}));

jest.mock('../orchestrator', () => ({
  runCalculatorEphemerisBatch: (...args: unknown[]) => mockRunCalculatorEphemerisBatch(...args),
  runCalculatorRiseTransitSetBatch: (...args: unknown[]) => mockRunCalculatorRiseTransitSetBatch(...args),
  summarizeCalculatorMeta: (...args: unknown[]) => mockSummarizeCalculatorMeta(...args),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({
    value,
    onChange,
    ...props
  }: {
    value?: string;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    [key: string]: unknown;
  }) => <input value={value ?? ''} onChange={onChange} {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span {...props}>{children}</span>
  ),
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableHeader: ({ children }: React.PropsWithChildren) => <thead>{children}</thead>,
  TableBody: ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>,
  TableRow: ({ children }: React.PropsWithChildren) => <tr>{children}</tr>,
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableCell: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <td className={className}>{children}</td>
  ),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
  degreesToDMS: (value: number) => `${value.toFixed(2)}d`,
}));

jest.mock('@/lib/astronomy/time/formats', () => ({
  formatTimeShort: (value: Date | null) => (value ? value.toISOString().slice(11, 16) : '--'),
}));

function createEphemerisRow(body: string) {
  return {
    response: {
      body,
      points: [{
        date: new Date('2025-01-01T00:00:00.000Z'),
        ra: 100,
        dec: 20,
        altitude: 45,
        azimuth: 180,
        magnitude: -1,
        phaseFraction: 0.5,
      }],
    },
    meta: {
      source: 'fallback',
      cache: 'miss',
      degraded: false,
      warnings: [],
      computedAt: '2025-01-01T00:00:00.000Z',
    },
  };
}

function createRtsRow() {
  return {
    response: {
      riseTime: new Date('2025-01-01T07:00:00.000Z'),
      transitTime: new Date('2025-01-01T12:00:00.000Z'),
      setTime: new Date('2025-01-01T17:00:00.000Z'),
    },
    meta: {
      source: 'fallback',
      cache: 'hit',
      degraded: false,
      warnings: [],
      computedAt: '2025-01-01T00:05:00.000Z',
    },
  };
}

describe('SolarSystemTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunCalculatorEphemerisBatch.mockImplementation((requests: Array<{ body: string }>) =>
      Promise.resolve(requests.map((request) => createEphemerisRow(request.body))),
    );
    mockRunCalculatorRiseTransitSetBatch.mockImplementation((requests: Array<unknown>) =>
      Promise.resolve(requests.map(() => createRtsRow())),
    );
    mockSummarizeCalculatorMeta.mockImplementation((metas: Array<{ cache?: string }>) => ({
      total: metas.length,
      sourceCounts: { tauri: 0, fallback: metas.length },
      cacheHits: metas.filter((item) => item.cache === 'hit').length,
      cacheMisses: metas.filter((item) => item.cache === 'miss').length,
      degradedCount: 0,
      warningsCount: 0,
      latestComputedAt: '2025-01-01T00:05:00.000Z',
    }));
  });

  it('loads solar system rows and shows meta/count badges', async () => {
    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    expect(await screen.findByText('Sun')).toBeInTheDocument();
    expect(mockRunCalculatorEphemerisBatch).toHaveBeenCalled();
    expect(mockRunCalculatorRiseTransitSetBatch).toHaveBeenCalled();
    expect(screen.getByTestId('solar-system-meta')).toHaveTextContent('src:fallback cache:10/20');
    expect(screen.getByText('10 astroCalc.objects')).toBeInTheDocument();
  });

  it('recomputes with eight bodies when Pluto is excluded', async () => {
    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    await screen.findByText('Sun');

    fireEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      const latestBodies = mockRunCalculatorEphemerisBatch.mock.calls.at(-1)?.[0] as Array<{ body: string }>;
      expect(latestBodies).toHaveLength(9);
      expect(latestBodies.map((item) => item.body)).not.toContain('Pluto');
    });
  });

  it('shows an error banner when the batch request fails', async () => {
    mockRunCalculatorEphemerisBatch.mockRejectedValueOnce(new Error('ephemeris failed'));

    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    expect(await screen.findByText('ephemeris failed')).toBeInTheDocument();
  });

  it('propagates shared date and time edits to parent callbacks', () => {
    const onSharedDateChange = jest.fn();
    const onSharedTimeChange = jest.fn();

    render(
      <SolarSystemTab
        latitude={39.9}
        longitude={116.4}
        onSharedDateChange={onSharedDateChange}
        onSharedTimeChange={onSharedTimeChange}
      />,
    );

    fireEvent.change(screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/), {
      target: { value: '2025-07-01' },
    });
    fireEvent.change(screen.getByDisplayValue(/\d{2}:\d{2}/), {
      target: { value: '21:45' },
    });

    expect(onSharedDateChange).toHaveBeenCalledWith('2025-07-01');
    expect(onSharedTimeChange).toHaveBeenCalledWith('21:45');
  });

  it('renders no-data state when the batch responses are empty', async () => {
    mockRunCalculatorEphemerisBatch.mockResolvedValueOnce([]);
    mockRunCalculatorRiseTransitSetBatch.mockResolvedValueOnce([]);
    mockSummarizeCalculatorMeta.mockReturnValueOnce({
      total: 0,
      sourceCounts: { tauri: 0, fallback: 0 },
      cacheHits: 0,
      cacheMisses: 0,
      degradedCount: 0,
      warningsCount: 0,
      latestComputedAt: null,
    });

    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    expect(await screen.findByText('astroCalc.noData')).toBeInTheDocument();
  });

  it('renders fallback cells and altitude color branches for partial row data', async () => {
    mockRunCalculatorEphemerisBatch.mockImplementationOnce((requests: Array<{ body: string }>) =>
      Promise.resolve(
        requests.map((request) => ({
          response: {
            body: request.body,
            points: [{
              date: new Date('2025-01-01T00:00:00.000Z'),
              ra: request.body === 'Moon' ? 101 : 100,
              dec: request.body === 'Moon' ? 21 : 20,
              altitude: request.body === 'Sun' ? 10 : request.body === 'Moon' ? -5 : 35,
              azimuth: request.body === 'Moon' ? 181 : 180,
              magnitude: request.body === 'Sun' || request.body === 'Moon' ? undefined : -1,
              phaseFraction: request.body === 'Sun' || request.body === 'Moon' ? undefined : 0.5,
            }],
          },
          meta: {
            source: 'fallback',
            cache: 'miss',
            degraded: false,
            warnings: [],
            computedAt: '2025-01-01T00:00:00.000Z',
          },
        })),
      ),
    );
    mockRunCalculatorRiseTransitSetBatch.mockImplementationOnce((requests: Array<unknown>) =>
      Promise.resolve(requests.map(() => createRtsRow())),
    );
    mockSummarizeCalculatorMeta.mockReturnValueOnce({
      total: 20,
      sourceCounts: { tauri: 0, fallback: 20 },
      cacheHits: 10,
      cacheMisses: 10,
      degradedCount: 0,
      warningsCount: 0,
      latestComputedAt: '2025-01-01T00:05:00.000Z',
    });

    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    expect(await screen.findByText('Moon')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('10.00°')).toHaveClass('text-yellow-500');
    expect(screen.getByText('-5.00°')).toHaveClass('text-red-500');
  });
});
