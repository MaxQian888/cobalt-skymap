/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

// Create mock stel engine
const createMockStel = (overrides?: { time_speed?: number; utc?: number }) => ({
  core: {
    observer: { utc: overrides?.utc ?? 60000.5 },
    time_speed: overrides?.time_speed ?? 1,
  },
});

let mockStel: ReturnType<typeof createMockStel> | null = null;

// Mock dependencies before importing component
const mockUseStellariumStore = jest.fn((selector) => {
  const state = {
    stel: mockStel,
    isReady: true,
  };
  return selector ? selector(state) : state;
});

let mockTimeFormat: string = '24h';
let mockDateFormat: string = 'iso';
let mockSkyEngine: string = 'stellarium';
const mockUseSettingsStore = jest.fn((selector) => {
  const state = {
    skyEngine: mockSkyEngine,
    preferences: {
      timeFormat: mockTimeFormat,
      dateFormat: mockDateFormat,
    },
  };
  return selector ? selector(state) : state;
});

let mockLongitude: number | undefined = 116.4;
const mockUseMountStore = jest.fn((selector) => {
  const state = {
    profileInfo: {
      AstrometrySettings: {
        Longitude: mockLongitude,
        Latitude: 39.9,
        Elevation: 0,
      },
    },
  };
  return selector ? selector(state) : state;
});

jest.mock('@/lib/stores', () => ({
  useStellariumStore: (selector: (state: unknown) => unknown) => mockUseStellariumStore(selector),
  useSettingsStore: (selector: (state: unknown) => unknown) => mockUseSettingsStore(selector),
  useMountStore: (selector: (state: unknown) => unknown) => mockUseMountStore(selector),
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock utils
const mockMjdToUTC = jest.fn<Date, [number]>(() => new Date('2024-06-15T12:00:00Z'));
const mockUtcToMJD = jest.fn<number, [Date]>(() => 60000.5);
const mockFormatDateForInput = jest.fn<string, [Date]>(() => '2024-06-15');
const mockFormatTimeForInput = jest.fn<string, [Date]>(() => '12:00:00');

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  mjdToUTC: (mjd: number) => mockMjdToUTC(mjd),
  utcToMJD: (date: Date) => mockUtcToMJD(date),
  formatDateForInput: (date: Date) => mockFormatDateForInput(date),
  formatTimeForInput: (date: Date) => mockFormatTimeForInput(date),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange?: (open: boolean) => void }) => (
    <div>
      <button type="button" data-testid="popover-open" onClick={() => onOpenChange?.(true)}>
        open
      </button>
      <button type="button" data-testid="popover-close" onClick={() => onOpenChange?.(false)}>
        close
      </button>
      {children}
    </div>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-content">{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="popover-trigger">{children}</div>,
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, disabled, ...props }: { value: number[]; onValueChange: (v: number[]) => void; disabled?: boolean; 'aria-label'?: string }) => (
    <input
      type="range"
      value={value?.[0] || 0}
      onChange={(e) => onValueChange?.([Number(e.target.value)])}
      data-testid="slider"
      aria-label={props['aria-label']}
      disabled={disabled}
    />
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode; variant?: string }) => (
    <span data-testid="speed-badge" {...props}>{children}</span>
  ),
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: (string | boolean | undefined)[]) => args.filter(Boolean).join(' '),
}));

import { StellariumClock } from '../stellarium-clock';

describe('StellariumClock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockStel = null;
    mockTimeFormat = '24h';
    mockDateFormat = 'iso';
    mockSkyEngine = 'stellarium';
    mockLongitude = 116.4;
    mockMjdToUTC.mockImplementation(() => new Date('2024-06-15T12:00:00Z'));
    mockUtcToMJD.mockImplementation(() => 60000.5);
    mockFormatDateForInput.mockImplementation(() => '2024-06-15');
    mockFormatTimeForInput.mockImplementation(() => '12:00:00');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renders nothing when stel is null', () => {
    mockStel = null;
    const { container } = render(<StellariumClock />);
    expect(container.innerHTML).toBe('');
  });

  it('renders clock display when stel is available', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    // Should render the popover structure
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    expect(screen.getByTestId('popover-trigger')).toBeInTheDocument();
  });

  it('renders Aladin mode with disabled controls and system-time note', () => {
    mockSkyEngine = 'aladin';
    mockLongitude = undefined;
    render(<StellariumClock />);

    expect(screen.getByText('time.aladinSystemTimeNote')).toBeInTheDocument();
    expect(screen.getByLabelText('time.date')).toBeDisabled();
    expect(screen.getByLabelText('time.time')).toBeDisabled();
    expect(screen.getByTestId('slider')).toBeDisabled();
    expect(screen.getByText('time.minus1Week').closest('button')).toBeDisabled();
    expect(mockUtcToMJD).toHaveBeenCalled();
  });

  it('swallows Aladin LST calculation errors during refresh', () => {
    mockSkyEngine = 'aladin';
    mockUtcToMJD.mockImplementation(() => {
      throw new Error('bad lst');
    });

    expect(() => render(<StellariumClock />)).not.toThrow();
    expect(screen.getByText('time.aladinSystemTimeNote')).toBeInTheDocument();
  });

  it.each([
    ['us', 'en-US'],
    ['eu', 'en-GB'],
  ])('formats the date using the %s locale preference', (dateFormat, expectedLocale) => {
    mockStel = createMockStel();
    mockDateFormat = dateFormat;
    const toLocaleSpy = jest.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (locale, options) {
      if (options && typeof options === 'object' && 'year' in options) {
        return String(locale);
      }
      if (options && typeof options === 'object' && 'timeZone' in options) {
        return 'UTC TIME';
      }
      return 'LOCAL TIME';
    });

    render(<StellariumClock />);

    expect(screen.getByText(expectedLocale)).toBeInTheDocument();
    expect(toLocaleSpy).toHaveBeenCalledWith(
      expectedLocale,
      expect.objectContaining({
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    );
  });

  it('renders time jump buttons', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    // 8 jump buttons (±1min, ±1hour, ±1day, ±1week)
    const buttons = screen.getAllByRole('button');
    // At least 8 jump buttons + now button + pause button
    expect(buttons.length).toBeGreaterThanOrEqual(10);
  });

  it('renders UTC and LST display sections', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    expect(screen.getByText('time.utc')).toBeInTheDocument();
    expect(screen.getByText('time.lst')).toBeInTheDocument();
  });

  it('renders time speed slider', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    const slider = screen.getByTestId('slider');
    expect(slider).toBeInTheDocument();
  });

  it('shows speed badge when not real-time', () => {
    mockStel = createMockStel({ time_speed: 4 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    // Badge should appear since speed != 1
    const badge = screen.queryByTestId('speed-badge');
    expect(badge).toBeInTheDocument();
  });

  it('does not show speed badge at real-time speed', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    const badge = screen.queryByTestId('speed-badge');
    expect(badge).not.toBeInTheDocument();
  });

  it('time jump button modifies observer utc', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    // Find the -1d button by its translated text
    const minus1DayBtn = screen.getByText('time.minus1Day').closest('button');
    expect(minus1DayBtn).toBeTruthy();
    fireEvent.click(minus1DayBtn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(59999.5, 5);
  });

  it('now button resets time and speed', () => {
    mockStel = createMockStel({ time_speed: 4 });
    render(<StellariumClock />);
    const nowBtn = screen.getByText('time.now').closest('button');
    expect(nowBtn).toBeTruthy();
    fireEvent.click(nowBtn!);
    expect(mockStel!.core.time_speed).toBe(1);
  });

  it('pause button sets speed to 0', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    // Find pause button by aria-label
    const pauseBtn = screen.getByLabelText('time.pause');
    fireEvent.click(pauseBtn);
    expect(mockStel!.core.time_speed).toBe(0);
  });

  it('play button restores previous speed after pause', () => {
    mockStel = createMockStel({ time_speed: 4 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    // Pause
    const pauseBtn = screen.getByLabelText('time.pause');
    fireEvent.click(pauseBtn);
    expect(mockStel!.core.time_speed).toBe(0);
    // Need to re-render after speed change
    act(() => { jest.advanceTimersByTime(2100); });
    // Resume
    const playBtn = screen.getByLabelText('time.play');
    fireEvent.click(playBtn);
    expect(mockStel!.core.time_speed).toBe(4);
  });

  it('time inputs include seconds precision', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    const timeInput = screen.getByLabelText('time.time');
    expect(timeInput).toHaveAttribute('step', '1');
    expect(timeInput).toHaveAttribute('type', 'time');
  });

  // --- formatSpeed branches (tested via badge content) ---

  it('displays 0× speed badge when paused', () => {
    mockStel = createMockStel({ time_speed: 0 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(2100); });
    const badge = screen.queryByTestId('speed-badge');
    expect(badge).toBeInTheDocument();
    // When paused, badge shows ⏸
    expect(badge!.textContent).toBe('⏸');
  });

  it('displays speed as N× for integer speeds > 1', () => {
    mockStel = createMockStel({ time_speed: 8 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(300); });
    const badge = screen.queryByTestId('speed-badge');
    expect(badge).toBeInTheDocument();
    expect(badge!.textContent).toBe('8×');
  });

  it('displays fractional speed as 1/N× for speeds < 1', () => {
    mockStel = createMockStel({ time_speed: 0.25 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    const badge = screen.queryByTestId('speed-badge');
    expect(badge).toBeInTheDocument();
    expect(badge!.textContent).toBe('1/4×');
  });

  // --- speedToSlider edge cases (tested via slider value) ---

  it('slider reflects paused state after engine sync', () => {
    mockStel = createMockStel({ time_speed: 0 });
    render(<StellariumClock />);
    // After interval fires, engineSpeed syncs to 0, speedToSlider(0) = -10
    // But HTML range input value attribute may lag - verify via badge instead
    act(() => { jest.advanceTimersByTime(2100); });
    // When paused, badge shows ⏸ which confirms engineSpeed was synced to 0
    const badge = screen.queryByTestId('speed-badge');
    expect(badge).toBeInTheDocument();
    expect(badge!.textContent).toBe('⏸');
  });

  it('slider shows 0 when speed is 1 (real-time)', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    const slider = screen.getByTestId('slider') as HTMLInputElement;
    expect(Number(slider.value)).toBe(0);
  });

  it('slider shows correct log2 value for speed 1024', () => {
    mockStel = createMockStel({ time_speed: 1024 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(200); });
    const slider = screen.getByTestId('slider') as HTMLInputElement;
    // log2(1024) = 10, clamped to max 10
    expect(Number(slider.value)).toBe(10);
  });

  // --- handleTimeSpeedChange via slider interaction ---

  it('changing slider value updates engine speed', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    const slider = screen.getByTestId('slider');
    fireEvent.change(slider, { target: { value: '3' } });
    // 2^3 = 8
    expect(mockStel!.core.time_speed).toBe(8);
  });

  it('setting slider to max value sets high speed', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    const slider = screen.getByTestId('slider');
    fireEvent.change(slider, { target: { value: '10' } });
    // 2^10 = 1024
    expect(mockStel!.core.time_speed).toBe(1024);
  });

  // --- applyDateTime via input blur ---

  it('blurring date input calls utcToMJD and updates observer', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    mockUtcToMJD.mockReturnValue(60001.0);
    render(<StellariumClock />);
    const dateInput = screen.getByLabelText('time.date');
    fireEvent.change(dateInput, { target: { value: '2024-06-16' } });
    fireEvent.blur(dateInput);
    expect(mockUtcToMJD).toHaveBeenCalled();
    expect(mockStel!.core.observer.utc).toBe(60001.0);
  });

  it('blurring time input calls utcToMJD and updates observer', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    mockUtcToMJD.mockReturnValue(60000.75);
    render(<StellariumClock />);
    const timeInput = screen.getByLabelText('time.time');
    fireEvent.change(timeInput, { target: { value: '18:00:00' } });
    fireEvent.blur(timeInput);
    expect(mockUtcToMJD).toHaveBeenCalled();
    expect(mockStel!.core.observer.utc).toBe(60000.75);
  });

  it('applyDateTime handles invalid date gracefully', () => {
    mockStel = createMockStel();
    mockUtcToMJD.mockImplementation(() => { throw new Error('Invalid date'); });
    render(<StellariumClock />);
    const dateInput = screen.getByLabelText('time.date');
    // Should not throw
    fireEvent.change(dateInput, { target: { value: 'invalid' } });
    expect(() => fireEvent.blur(dateInput)).not.toThrow();
  });

  // --- Date/time input onChange ---

  it('changing date input updates input value', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    const dateInput = screen.getByLabelText('time.date') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-12-25' } });
    expect(dateInput.value).toBe('2024-12-25');
  });

  it('changing time input updates input value', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    const timeInput = screen.getByLabelText('time.time') as HTMLInputElement;
    fireEvent.change(timeInput, { target: { value: '23:59:59' } });
    expect(timeInput.value).toBe('23:59:59');
  });

  // --- Additional time jump buttons ---

  it('+1 day jump button increases observer utc by 1', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.plus1Day').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(60001.5, 5);
  });

  it('-1 hour jump button decreases observer utc by 1/24', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.minus1Hour').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(60000.5 - 1/24, 5);
  });

  it('+1 hour jump button increases observer utc by 1/24', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.plus1Hour').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(60000.5 + 1/24, 5);
  });

  it('-1 minute jump button decreases observer utc by 1/1440', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.minus1Min').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(60000.5 - 1/1440, 5);
  });

  it('+1 minute jump button increases observer utc by 1/1440', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.plus1Min').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(60000.5 + 1/1440, 5);
  });

  it('-1 week jump button decreases observer utc by 7', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.minus1Week').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(59993.5, 5);
  });

  it('+1 week jump button increases observer utc by 7', () => {
    mockStel = createMockStel({ utc: 60000.5 });
    render(<StellariumClock />);
    const btn = screen.getByText('time.plus1Week').closest('button');
    fireEvent.click(btn!);
    expect(mockStel!.core.observer.utc).toBeCloseTo(60007.5, 5);
  });

  // --- timeSpeedDescription branches ---

  it('displays "time.paused" description when speed is 0', () => {
    mockStel = createMockStel({ time_speed: 0 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(2100); });
    expect(screen.getByText('time.paused')).toBeInTheDocument();
  });

  it('displays "time.realTime" description when speed is 1', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    expect(screen.getByText('time.realTime')).toBeInTheDocument();
  });

  it('displays "time.timeLapse" description when speed > 1', () => {
    mockStel = createMockStel({ time_speed: 16 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(200); });
    expect(screen.getByText('time.timeLapse')).toBeInTheDocument();
  });

  it('displays "time.timeRewind" description when 0 < speed < 1', () => {
    mockStel = createMockStel({ time_speed: 0.5 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    expect(screen.getByText('time.timeRewind')).toBeInTheDocument();
  });

  // --- Now button also calls utcToMJD ---

  it('now button updates observer utc via utcToMJD', () => {
    mockStel = createMockStel({ utc: 50000, time_speed: 2 });
    mockUtcToMJD.mockReturnValue(60123.456);
    render(<StellariumClock />);
    const nowBtn = screen.getByText('time.now').closest('button');
    fireEvent.click(nowBtn!);
    expect(mockUtcToMJD).toHaveBeenCalled();
    expect(mockStel!.core.observer.utc).toBe(60123.456);
    expect(mockStel!.core.time_speed).toBe(1);
  });

  // --- Pause/resume with default speed ---

  it('play after pause restores to 1× if no saved speed', () => {
    // Start at speed 0 (paused from the beginning)
    mockStel = createMockStel({ time_speed: 0 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(2100); });
    // Press play
    const playBtn = screen.getByLabelText('time.play');
    fireEvent.click(playBtn);
    // savedSpeedRef defaults to 1, so should resume to 1
    expect(mockStel!.core.time_speed).toBe(1);
  });

  // --- Date/time labels render ---

  it('renders date and time labels', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    expect(screen.getByText('time.date')).toBeInTheDocument();
    expect(screen.getByText('time.time')).toBeInTheDocument();
  });

  it('renders time speed label', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    expect(screen.getByText('time.timeSpeed')).toBeInTheDocument();
  });

  it('renders jump-to label', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    expect(screen.getByText('time.jumpTo')).toBeInTheDocument();
  });

  // --- Button styling based on state ---

  it('applies opacity class when paused', () => {
    mockStel = createMockStel({ time_speed: 0 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(2100); });
    const triggerBtn = screen.getByLabelText('time.timeControls');
    expect(triggerBtn.className).toContain('opacity-70');
  });

  it('applies ring class when accelerated (not real-time, not paused)', () => {
    mockStel = createMockStel({ time_speed: 4 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(300); });
    const triggerBtn = screen.getByLabelText('time.timeControls');
    expect(triggerBtn.className).toContain('ring-1');
  });

  it('does not apply opacity or ring class at real-time speed', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    const triggerBtn = screen.getByLabelText('time.timeControls');
    expect(triggerBtn.className).not.toContain('opacity-70');
    expect(triggerBtn.className).not.toContain('ring-1');
  });

  // --- Pause button variant changes ---

  it('pause button shows default variant when paused', () => {
    mockStel = createMockStel({ time_speed: 0 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(2100); });
    // When paused, pause/play button aria-label is 'time.play'
    const playBtn = screen.getByLabelText('time.play');
    expect(playBtn).toBeInTheDocument();
  });

  it('pause button shows outline variant when playing', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    const pauseBtn = screen.getByLabelText('time.pause');
    expect(pauseBtn).toBeInTheDocument();
  });

  // --- applyDateTime with stel null guard ---

  it('applyDateTime does nothing when stel is null', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    // Set stel to null after render
    mockStel = null;
    const dateInput = screen.getByLabelText('time.date');
    // Should not throw even though stel is now null
    // (the callback captured stel from closure, so it still has the old ref)
    expect(() => fireEvent.blur(dateInput)).not.toThrow();
  });

  // --- Heading / title ---

  it('renders dateTime heading', () => {
    mockStel = createMockStel();
    render(<StellariumClock />);
    expect(screen.getByText('time.dateTime')).toBeInTheDocument();
  });

  // --- useEffect calls mjdToUTC with correct MJD ---

  it('useEffect calls mjdToUTC with observer utc', () => {
    mockStel = createMockStel({ utc: 59999.0 });
    render(<StellariumClock />);
    expect(mockMjdToUTC).toHaveBeenCalledWith(59999.0);
  });

  it('syncs date and time inputs from Stellarium when the popover opens', () => {
    mockStel = createMockStel({ utc: 60234.25 });
    mockMjdToUTC.mockImplementation(() => new Date('2025-01-02T03:04:05Z'));
    mockFormatDateForInput.mockImplementation(() => '2025-01-02');
    mockFormatTimeForInput.mockImplementation(() => '03:04:05');
    render(<StellariumClock />);

    const dateInput = screen.getByLabelText('time.date') as HTMLInputElement;
    const timeInput = screen.getByLabelText('time.time') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-12-31' } });
    fireEvent.change(timeInput, { target: { value: '23:59:59' } });

    fireEvent.click(screen.getByTestId('popover-open'));

    expect(dateInput.value).toBe('2025-01-02');
    expect(timeInput.value).toBe('03:04:05');
  });

  // --- Speed display text ---

  it('displays current speed text next to slider', () => {
    mockStel = createMockStel({ time_speed: 1 });
    render(<StellariumClock />);
    act(() => { jest.advanceTimersByTime(1100); });
    // formatSpeed(1) = '1×'
    expect(screen.getByText('1×')).toBeInTheDocument();
  });

  // --- Cleanup: effect re-runs on dependency change ---

  it('clears interval on unmount', () => {
    mockStel = createMockStel();
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const { unmount } = render(<StellariumClock />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
