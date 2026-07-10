/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SolarSystemTab } from '../solar-system-tab';

const mockRunCalculatorEphemerisBatch = jest.fn();
const mockRunCalculatorRiseTransitSetBatch = jest.fn();
const mockSummarizeCalculatorMeta = jest.fn();
const mockFetchSmallBodyEphemeris = jest.fn();
const mockCopyTextWithFeedback = jest.fn();
const mockAddTarget = jest.fn();
const mockCreateList = jest.fn(() => 'list-1');
const mockSetActiveList = jest.fn();
const mockAddEntryToList = jest.fn((listId: string, target: Record<string, unknown>) => ({
  id: 'entry-1',
  listId,
  ...target,
}));
const mockLaunchPlannerWithDraftSeed = jest.fn();
const translate = (key: string) => key;
const originalConsoleError = console.error;

jest.mock('next-intl', () => ({
  useTranslations: () => translate,
}));

jest.mock('../orchestrator', () => ({
  runCalculatorEphemerisBatch: (...args: unknown[]) => mockRunCalculatorEphemerisBatch(...args),
  runCalculatorRiseTransitSetBatch: (...args: unknown[]) => mockRunCalculatorRiseTransitSetBatch(...args),
  summarizeCalculatorMeta: (...args: unknown[]) => mockSummarizeCalculatorMeta(...args),
}));

jest.mock('../small-body-adapter', () => ({
  fetchSmallBodyEphemeris: (...args: unknown[]) => mockFetchSmallBodyEphemeris(...args),
}));

jest.mock('@/lib/utils/clipboard-feedback', () => ({
  copyTextWithFeedback: (...args: unknown[]) => mockCopyTextWithFeedback(...args),
}));

jest.mock('@/lib/stores/target-list-store', () => ({
  useTargetListStore: (selector: (state: unknown) => unknown) => selector({
    addTarget: mockAddTarget,
    createList: mockCreateList,
    setActiveList: mockSetActiveList,
    addEntryToList: mockAddEntryToList,
  }),
}));

jest.mock('@/lib/stores/planning-ui-store', () => ({
  usePlanningUiStore: (selector: (state: unknown) => unknown) => selector({
    launchPlannerWithDraftSeed: mockLaunchPlannerWithDraftSeed,
  }),
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

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollBar: () => null,
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
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      if (String(firstArg).includes('Not implemented: navigation')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    URL.createObjectURL = jest.fn(() => 'blob:solar-system-export');
    URL.revokeObjectURL = jest.fn();
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
    mockFetchSmallBodyEphemeris.mockResolvedValue({
      points: [{
        date: new Date('2025-01-01T00:00:00.000Z'),
        ra: 210,
        dec: -5,
        altitude: 15,
        azimuth: 220,
        magnitude: 14.2,
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

  it('passes observer context keys into batch requests', async () => {
    render(
      <SolarSystemTab
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

    await screen.findByText('Sun');

    const ephemerisRequests = mockRunCalculatorEphemerisBatch.mock.calls.at(-1)?.[0] as Array<{ contextKey?: string }>;
    const rtsRequests = mockRunCalculatorRiseTransitSetBatch.mock.calls.at(-1)?.[0] as Array<{ contextKey?: string }>;

    expect(ephemerisRequests.every((item) => item.contextKey === 'site-a')).toBe(true);
    expect(rtsRequests.every((item) => item.contextKey === 'site-a')).toBe(true);
  });

  it('appends a small-body spotlight row when a minor-object query is provided', async () => {
    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    fireEvent.change(screen.getByLabelText('astroCalc.minorObjectQuery'), {
      target: { value: '1P/Halley' },
    });

    await waitFor(() => {
      expect(mockFetchSmallBodyEphemeris).toHaveBeenCalledWith(expect.objectContaining({
        query: '1P/Halley',
      }));
    });

    expect(await screen.findByText('1P/Halley')).toBeInTheDocument();
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

  it('renders result actions and per-row handoff controls', async () => {
    render(
      <SolarSystemTab
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

    await screen.findByText('Sun');

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.copyResults' }));
    await waitFor(() => {
      expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Mountain Base'),
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.exportResults' }));
    expect(URL.createObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('astroCalc.addToList: Sun'));
    expect(mockAddTarget).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Sun',
      ra: 100,
      dec: 20,
    }));

    fireEvent.click(screen.getByLabelText('astroCalc.openPlanner: Sun'));
    expect(mockCreateList).toHaveBeenCalled();
    expect(mockSetActiveList).toHaveBeenCalledWith('list-1');
    expect(mockAddEntryToList).toHaveBeenCalledWith('list-1', expect.objectContaining({
      name: 'Sun',
      ra: 100,
      dec: 20,
    }));
    expect(mockLaunchPlannerWithDraftSeed).toHaveBeenCalledWith(expect.objectContaining({
      constraints: expect.objectContaining({
        minAltitude: 15,
      }),
    }));
  });

  it('uses responsive wrappers for header and row-level result actions', async () => {
    render(<SolarSystemTab latitude={39.9} longitude={116.4} />);

    await screen.findByText('Sun');

    const actionBar = screen.getByTestId('astro-calculator-result-actions');
    expect(actionBar.className).toContain('grid');
    expect(actionBar.className).toContain('sm:flex');
    expect(screen.getByRole('button', { name: 'astroCalc.copyResults' }).className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'astroCalc.exportResults' }).className).toContain('sm:w-auto');

    const rowActions = screen.getByTestId('astro-calculator-row-actions-Sun');
    expect(rowActions.className).toContain('flex-wrap');
    expect(screen.getByLabelText('astroCalc.addToList: Sun').className).toContain('shrink-0');
    expect(screen.getByLabelText('astroCalc.openPlanner: Sun').className).toContain('shrink-0');
  });
});
