/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EphemerisTab } from '../ephemeris-tab';

const mockComputeEphemeris = jest.fn();
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
const originalConsoleError = console.error;

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
  Input: ({ value, onChange, ...props }: { value?: string; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <input value={value ?? ''} onChange={onChange} {...props} />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ScrollBar: () => null,
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
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (String(firstArg).includes('Not implemented: navigation')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    URL.createObjectURL = jest.fn(() => 'blob:ephemeris-export');
    URL.revokeObjectURL = jest.fn();
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
    mockFetchSmallBodyEphemeris.mockResolvedValue({
      points: [{
        date: new Date('2025-01-01T00:00:00Z'),
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

  it('uses the small-body adapter when a minor-object query is provided', async () => {
    render(<EphemerisTab latitude={39.9} longitude={116.4} />);

    fireEvent.change(screen.getByLabelText('astroCalc.minorObjectQuery'), {
      target: { value: '1P/Halley' },
    });

    await waitFor(() => {
      expect(mockFetchSmallBodyEphemeris).toHaveBeenCalledWith(expect.objectContaining({
        query: '1P/Halley',
      }));
    });

    expect(mockComputeEphemeris).not.toHaveBeenCalledWith(expect.objectContaining({
      body: 'Custom',
    }));
  });

  it('renders result actions and routes copy/export/target handoff', async () => {
    render(
      <EphemerisTab
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

    await screen.findByText('12.30h');

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.copyResults' }));

    await waitFor(() => {
      expect(mockCopyTextWithFeedback).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('Mountain Base'),
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.exportResults' }));
    expect(URL.createObjectURL).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.addToList' }));
    expect(mockAddTarget).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Moon',
      ra: 12.3,
      dec: 45.6,
    }));

    fireEvent.click(screen.getByRole('button', { name: 'astroCalc.openPlanner' }));
    expect(mockCreateList).toHaveBeenCalled();
    expect(mockSetActiveList).toHaveBeenCalledWith('list-1');
    expect(mockAddEntryToList).toHaveBeenCalledWith('list-1', expect.objectContaining({
      name: 'Moon',
      ra: 12.3,
      dec: 45.6,
    }));
    expect(mockLaunchPlannerWithDraftSeed).toHaveBeenCalledWith(expect.objectContaining({
      planDate: expect.any(String),
      constraints: expect.objectContaining({
        minAltitude: 15,
      }),
    }));
  });

  it('keeps result actions reachable with responsive compact-layout classes', async () => {
    render(<EphemerisTab latitude={39.9} longitude={116.4} />);

    await screen.findByText('12.30h');

    const actionBar = screen.getByTestId('astro-calculator-result-actions');
    expect(actionBar.className).toContain('grid');
    expect(actionBar.className).toContain('sm:flex');

    expect(screen.getByRole('button', { name: 'astroCalc.copyResults' }).className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'astroCalc.copyResults' }).className).toContain('sm:w-auto');
    expect(screen.getByRole('button', { name: 'astroCalc.exportResults' }).className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'astroCalc.addToList' }).className).toContain('w-full');
    expect(screen.getByRole('button', { name: 'astroCalc.openPlanner' }).className).toContain('w-full');
  });
});
