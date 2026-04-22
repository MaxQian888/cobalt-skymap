/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CoordinateTab } from '../coordinate-tab';

const originalConsoleError = console.error;

const mockRunCalculatorCoordinates = jest.fn();
const mockAltAzToRaDecAtTime = jest.fn();
const mockGalacticToRaDec = jest.fn();
const mockEclipticToRaDec = jest.fn();
const translate = (key: string) => key;

jest.mock('next-intl', () => ({
  useTranslations: () => translate,
}));

jest.mock('../orchestrator', () => ({
  runCalculatorCoordinates: (...args: unknown[]) => mockRunCalculatorCoordinates(...args),
}));

jest.mock('@/lib/astronomy/coordinates/transforms', () => ({
  altAzToRaDecAtTime: (...args: unknown[]) => mockAltAzToRaDecAtTime(...args),
  galacticToRaDec: (...args: unknown[]) => mockGalacticToRaDec(...args),
  eclipticToRaDec: (...args: unknown[]) => mockEclipticToRaDec(...args),
  raDecToGalactic: () => ({ l: 120, b: -20 }),
  raDecToEcliptic: () => ({ longitude: 140, latitude: 5 }),
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

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: (value: number) => `${value.toFixed(2)}h`,
  degreesToDMS: (value: number) => `${value.toFixed(2)}d`,
}));

function createCoordinateResult() {
  return {
    response: {
      equatorial: { ra: 10.68, dec: 41.26 },
      horizontal: { altitude: 30, azimuth: 100 },
      galactic: { l: 120, b: -20 },
      ecliptic: { longitude: 140, latitude: 5 },
      sidereal: { gmst: 200, lst: 220, hourAngle: 10 },
    },
    meta: {
      source: 'fallback',
      cache: 'hit',
      degraded: false,
      warnings: [],
      computedAt: '2025-01-01T00:00:00.000Z',
    },
  };
}

describe('CoordinateTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const [firstArg] = args;
      if (typeof firstArg === 'string' && firstArg.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args as Parameters<typeof console.error>);
    });
    mockRunCalculatorCoordinates.mockResolvedValue(createCoordinateResult());
    mockAltAzToRaDecAtTime.mockReturnValue({ ra: 12.5, dec: 34.5 });
    mockGalacticToRaDec.mockReturnValue({ ra: 22.5, dec: 11.5 });
    mockEclipticToRaDec.mockReturnValue({ ra: 44.5, dec: -12.5 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the coordinate calculation and renders result badges', async () => {
    render(<CoordinateTab latitude={39.9} longitude={116.4} />);

    await waitFor(() => {
      expect(mockRunCalculatorCoordinates).toHaveBeenCalledWith(
        expect.objectContaining({
          coordinate: { ra: 10.684708, dec: 41.26875 },
          observer: { latitude: 39.9, longitude: 116.4 },
          refraction: 'normal',
        }),
      );
    });

    expect(await screen.findByText(/astroCalc\.roundTripError/)).toBeInTheDocument();
    expect(screen.getByTestId('coordinate-meta')).toHaveTextContent('src:fallback cache:1/1');
  });

  it('shows a validation error and skips recalculation when coordinates become invalid', async () => {
    render(<CoordinateTab latitude={39.9} longitude={116.4} />);

    await waitFor(() => {
      expect(mockRunCalculatorCoordinates.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    mockRunCalculatorCoordinates.mockClear();
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'not-a-number' },
    });

    expect(await screen.findByText('astroCalc.invalidCoordinates')).toBeInTheDocument();
    expect(mockRunCalculatorCoordinates).not.toHaveBeenCalled();
  });

  it('switches source systems and converts horizontal coordinates before calling the orchestrator', async () => {
    render(<CoordinateTab latitude={39.9} longitude={116.4} />);

    mockRunCalculatorCoordinates.mockClear();
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'horizontal' },
    });

    expect(await screen.findByText('astroCalc.azimuth')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.altitude')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockAltAzToRaDecAtTime).toHaveBeenCalled();
      expect(mockRunCalculatorCoordinates).toHaveBeenCalledWith(
        expect.objectContaining({
          coordinate: { ra: 12.5, dec: 34.5 },
        }),
      );
    });
  });

  it('propagates shared date and time edits to parent callbacks', () => {
    const onSharedDateChange = jest.fn();
    const onSharedTimeChange = jest.fn();

    render(
      <CoordinateTab
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

  it('syncs incoming shared date/time props and supports galactic plus ecliptic conversions', async () => {
    const { rerender } = render(
      <CoordinateTab
        latitude={39.9}
        longitude={116.4}
        sharedDate="2025-07-01"
        sharedTime="21:45"
      />,
    );

    expect(screen.getByDisplayValue('2025-07-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('21:45')).toBeInTheDocument();

    rerender(
      <CoordinateTab
        latitude={39.9}
        longitude={116.4}
        sharedDate="2025-07-02"
        sharedTime="05:15"
      />,
    );

    expect(await screen.findByDisplayValue('2025-07-02')).toBeInTheDocument();
    expect(screen.getByDisplayValue('05:15')).toBeInTheDocument();

    mockRunCalculatorCoordinates.mockClear();
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'galactic' },
    });

    expect(await screen.findByText('astroCalc.galacticL')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.galacticB')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGalacticToRaDec).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'ecliptic' },
    });

    expect(await screen.findByText('astroCalc.eclipticLon')).toBeInTheDocument();
    expect(screen.getByText('astroCalc.eclipticLat')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockEclipticToRaDec).toHaveBeenCalled();
    });
  });

  it('supports refraction changes, tauri metadata, and observer edits', async () => {
    mockRunCalculatorCoordinates.mockResolvedValue({
      ...createCoordinateResult(),
      meta: {
        source: 'tauri',
        cache: 'miss',
        degraded: false,
        warnings: ['fallback warning'],
        computedAt: '2025-01-02T00:00:00.000Z',
      },
    });

    render(<CoordinateTab latitude={39.9} longitude={116.4} />);

    expect(await screen.findByTestId('coordinate-meta')).toHaveTextContent('src:tauri cache:0/1');

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByDisplayValue('39.9000'), {
      target: { value: '40.0000' },
    });
    fireEvent.change(screen.getByDisplayValue('116.4000'), {
      target: { value: '120.0000' },
    });

    await waitFor(() => {
      expect(mockRunCalculatorCoordinates).toHaveBeenLastCalledWith(
        expect.objectContaining({
          observer: { latitude: 40, longitude: 120 },
          refraction: 'none',
        }),
      );
    });
  });

  it('renders orchestrator failures as an error banner', async () => {
    mockRunCalculatorCoordinates.mockRejectedValue(new Error('coordinate failed'));

    render(<CoordinateTab latitude={39.9} longitude={116.4} />);

    expect(await screen.findByText('coordinate failed')).toBeInTheDocument();
  });
});
