/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
}));

jest.mock('@/lib/stores', () => ({
  useMountStore: jest.fn((selector) => {
    const state = {
      profileInfo: {
        AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 0 },
      },
    };
    return selector(state);
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetAltitudeOverTime = jest.fn<any, any[]>(() => [
  { hour: 0, altitude: 30 },
  { hour: 1, altitude: 45 },
  { hour: 2, altitude: 60 },
  { hour: 3, altitude: 50 },
]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetTransitTime = jest.fn<any, any[]>(() => ({ hoursUntilTransit: 3, transitTime: new Date() }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCalculateTargetVisibility = jest.fn<any, any[]>(() => ({
  riseTime: null,
  setTime: null,
  transitTime: null,
  maxAltitude: 45,
  transitAltitude: 45,
  isCircumpolar: false,
  isNeverVisible: false,
  isCurrentlyVisible: true,
  neverRises: false,
  imagingWindowStart: null,
  imagingWindowEnd: null,
  totalVisibleMinutes: 600,
  aboveThresholdMinutes: 400,
  bestImagingWindow: null,
  imagingHours: 8,
  darkImagingStart: null,
  darkImagingEnd: null,
  darkImagingHours: 6,
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  getAltitudeOverTime: (...args: unknown[]) => mockGetAltitudeOverTime(args[0], args[1], args[2], args[3], args[4], args[5]),
  getTransitTime: (...args: unknown[]) => mockGetTransitTime(args[0], args[1]),
  calculateTargetVisibility: (...args: unknown[]) => mockCalculateTargetVisibility(args[0], args[1], args[2], args[3], args[4]),
}));

// Capture the CustomTooltip component passed to Recharts Tooltip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedTooltipContent: any = null;
// Capture the XAxis props so the tickFormatter can be exercised directly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedXAxisProps: any = null;

jest.mock('recharts', () => ({
  AreaChart: ({ children }: React.PropsWithChildren) => <svg data-testid="area-chart">{children}</svg>,
  Area: () => <g data-testid="area" />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  XAxis: (props: any) => { capturedXAxisProps = props; return <g />; },
  YAxis: () => <g />,
  ReferenceLine: () => <g data-testid="reference-line" />,
  ResponsiveContainer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tooltip: ({ content }: { content?: any }) => {
    capturedTooltipContent = content;
    return <g data-testid="recharts-tooltip" />;
  },
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

// Import the CustomTooltip via re-rendering approach (it's not exported, so test via Recharts mock)
import { AltitudeChartCompact } from '../altitude-chart-compact';

describe('AltitudeChartCompact', () => {
  const defaultProps = {
    ra: 83.63,
    dec: -5.39,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('renders area element', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.getByTestId('area')).toBeInTheDocument();
  });

  it('displays time range indicator', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.getByText(/chart\.timeRange/)).toBeInTheDocument();
    expect(screen.getByText(/12h/)).toBeInTheDocument();
  });

  it('annotates the current altitude (hour=0 sample)', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    // mockGetAltitudeOverTime seeds hour=0 at 30°.
    expect(screen.getByText(/chart\.nowAltitude/)).toBeInTheDocument();
    expect(screen.getByText('30.0°')).toBeInTheDocument();
  });

  it('formats the x-axis as local clock time, not a "+Xh" offset', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    const formatted = capturedXAxisProps.tickFormatter(0);
    // Local clock time like "08:00" / "12:00 AM" — never the old "+0h" form.
    expect(formatted).toMatch(/\d{1,2}:\d{2}/);
    expect(formatted).not.toMatch(/\+\d+h/);
  });

  it('renders zoom-out button that decreases time range', async () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    // Initial is 12h
    expect(screen.getByText(/12h/)).toBeInTheDocument();

    // Click the minus button (first zoom button)
    const minusButton = screen.getByText('−').closest('button')!;
    await act(async () => {
      fireEvent.click(minusButton);
    });

    expect(screen.getByText(/10h/)).toBeInTheDocument();
  });

  it('renders zoom-in button that increases time range', async () => {
    render(<AltitudeChartCompact {...defaultProps} />);

    const plusButton = screen.getByText('+').closest('button')!;
    await act(async () => {
      fireEvent.click(plusButton);
    });

    expect(screen.getByText(/14h/)).toBeInTheDocument();
  });

  it('clamps time range to minimum 2h', async () => {
    render(<AltitudeChartCompact {...defaultProps} />);

    const minusButton = screen.getByText('−').closest('button')!;
    // Click many times to go below minimum
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        fireEvent.click(minusButton);
      }
    });

    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('clamps time range to maximum 24h', async () => {
    render(<AltitudeChartCompact {...defaultProps} />);

    const plusButton = screen.getByText('+').closest('button')!;
    await act(async () => {
      for (let i = 0; i < 10; i++) {
        fireEvent.click(plusButton);
      }
    });

    expect(screen.getByText(/24h/)).toBeInTheDocument();
  });

  it('renders chart legend items (Now, Transit, Rise, Set)', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.getByText('chart.now')).toBeInTheDocument();
    expect(screen.getByText('time.transit')).toBeInTheDocument();
    expect(screen.getByText('time.rise')).toBeInTheDocument();
    expect(screen.getByText('time.set')).toBeInTheDocument();
  });

  it('renders dark imaging window info when darkImagingHours > 0', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    // darkImagingHours is 6 in mock, so the info should be displayed
    const darkInfo = screen.getByText(/chart\.darkImagingWindow/);
    expect(darkInfo).toBeInTheDocument();
  });

  it('does not render dark imaging info when darkImagingHours is 0', () => {
    mockCalculateTargetVisibility.mockReturnValueOnce({
      riseTime: null,
      setTime: null,
      transitTime: null,
      maxAltitude: 45,
      transitAltitude: 45,
      isCircumpolar: false,
      isNeverVisible: false,
      isCurrentlyVisible: true,
      neverRises: false,
      imagingWindowStart: null,
      imagingWindowEnd: null,
      totalVisibleMinutes: 600,
      aboveThresholdMinutes: 400,
      bestImagingWindow: null,
      imagingHours: 0,
      darkImagingStart: null,
      darkImagingEnd: null,
      darkImagingHours: 0,
    });

    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.queryByText(/chart\.darkImagingWindow/)).not.toBeInTheDocument();
  });

  it('renders mobile hint text', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.getByText('chart.mobileHint')).toBeInTheDocument();
  });

  it('has accessible aria-label on chart container', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(screen.getByRole('img', { name: 'chart.altitudeChartLabel' })).toBeInTheDocument();
  });

  it('has zoom hint title on chart container', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    const container = screen.getByTitle('chart.zoomHint');
    expect(container).toBeInTheDocument();
  });

  it('calls astronomy functions with correct parameters', () => {
    render(<AltitudeChartCompact {...defaultProps} />);
    expect(mockGetAltitudeOverTime).toHaveBeenCalledWith(83.63, -5.39, 40, -74, 12, 30);
    expect(mockGetTransitTime).toHaveBeenCalledWith(83.63, -74);
    expect(mockCalculateTargetVisibility).toHaveBeenCalledWith(83.63, -5.39, 40, -74, 30);
  });

  describe('CustomTooltip (captured from Recharts)', () => {
    it('captures the tooltip content component', () => {
      render(<AltitudeChartCompact {...defaultProps} />);
      expect(capturedTooltipContent).toBeDefined();
    });

    it('renders tooltip content when active with payload', () => {
      render(<AltitudeChartCompact {...defaultProps} />);
      // capturedTooltipContent is the <CustomTooltip /> element; render its type with props
      const TooltipComponent = capturedTooltipContent.type;
      const tooltipProps = capturedTooltipContent.props;

      const { container } = render(
        <TooltipComponent
          {...tooltipProps}
          active={true}
          payload={[{ payload: { time: '22:30', altitude: 45.5, hour: 3 } }]}
        />
      );
      expect(container.textContent).toContain('22:30');
      expect(container.textContent).toContain('45.5°');
    });

    it('returns null when tooltip is not active', () => {
      render(<AltitudeChartCompact {...defaultProps} />);
      const TooltipComponent = capturedTooltipContent.type;
      const tooltipProps = capturedTooltipContent.props;

      const { container } = render(
        <TooltipComponent {...tooltipProps} active={false} payload={[]} />
      );
      expect(container.innerHTML).toBe('');
    });

    it('returns null when payload is empty', () => {
      render(<AltitudeChartCompact {...defaultProps} />);
      const TooltipComponent = capturedTooltipContent.type;
      const tooltipProps = capturedTooltipContent.props;

      const { container } = render(
        <TooltipComponent {...tooltipProps} active={true} payload={[]} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('native event handlers', () => {
    it('handles wheel event on chart container', () => {
      const { container } = render(<AltitudeChartCompact {...defaultProps} />);
      const chartDiv = container.querySelector('[role="img"]');
      expect(chartDiv).toBeTruthy();

      // Dispatch a native wheel event to trigger the addEventListener handler
      const wheelEvent = new WheelEvent('wheel', { deltaY: 100, bubbles: true });
      act(() => {
        chartDiv!.dispatchEvent(wheelEvent);
      });

      // Component should still function
      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('handles wheel zoom in (negative deltaY)', () => {
      const { container } = render(<AltitudeChartCompact {...defaultProps} />);
      const chartDiv = container.querySelector('[role="img"]');

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, bubbles: true });
      act(() => {
        chartDiv!.dispatchEvent(wheelEvent);
      });

      expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    });

    it('handles touch swipe right to decrease time range', () => {
      const { container } = render(<AltitudeChartCompact {...defaultProps} />);
      const chartDiv = container.querySelector('[role="img"]') as HTMLElement;
      expect(screen.getByText(/12h/)).toBeInTheDocument();

      const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, 'touches', {
        value: [{ clientX: 200, clientY: 100 }],
      });

      const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
      Object.defineProperty(touchEnd, 'touches', { value: [] });
      Object.defineProperty(touchEnd, 'changedTouches', {
        value: [{ clientX: 280, clientY: 100 }],
      });

      act(() => {
        chartDiv.dispatchEvent(touchStart);
        chartDiv.dispatchEvent(touchEnd);
      });

      expect(screen.getByText(/10h/)).toBeInTheDocument();
    });

    it('handles touch swipe left to increase time range', () => {
      const { container } = render(<AltitudeChartCompact {...defaultProps} />);
      const chartDiv = container.querySelector('[role="img"]') as HTMLElement;
      expect(screen.getByText(/12h/)).toBeInTheDocument();

      const touchStart = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(touchStart, 'touches', {
        value: [{ clientX: 280, clientY: 100 }],
      });

      const touchEnd = new Event('touchend', { bubbles: true, cancelable: true });
      Object.defineProperty(touchEnd, 'touches', { value: [] });
      Object.defineProperty(touchEnd, 'changedTouches', {
        value: [{ clientX: 180, clientY: 100 }],
      });

      act(() => {
        chartDiv.dispatchEvent(touchStart);
        chartDiv.dispatchEvent(touchEnd);
      });

      expect(screen.getByText(/14h/)).toBeInTheDocument();
    });

    it('handles pinch gesture to change time range', () => {
      const { container } = render(<AltitudeChartCompact {...defaultProps} />);
      const chartDiv = container.querySelector('[role="img"]') as HTMLElement;
      expect(screen.getByText(/12h/)).toBeInTheDocument();

      const pinchStart = new Event('touchstart', { bubbles: true, cancelable: true });
      Object.defineProperty(pinchStart, 'touches', {
        value: [
          { clientX: 100, clientY: 100 },
          { clientX: 200, clientY: 100 },
        ],
      });

      const pinchMove = new Event('touchmove', { bubbles: true, cancelable: true });
      Object.defineProperty(pinchMove, 'touches', {
        value: [
          { clientX: 80, clientY: 100 },
          { clientX: 260, clientY: 100 },
        ],
      });

      const pinchEnd = new Event('touchend', { bubbles: true, cancelable: true });
      Object.defineProperty(pinchEnd, 'touches', { value: [] });
      Object.defineProperty(pinchEnd, 'changedTouches', {
        value: [{ clientX: 80, clientY: 100 }],
      });

      act(() => {
        chartDiv.dispatchEvent(pinchStart);
        chartDiv.dispatchEvent(pinchMove);
        chartDiv.dispatchEvent(pinchEnd);
      });

      expect(screen.queryByText(/12h/)).not.toBeInTheDocument();
    });

    it('cleans up event listeners on unmount', () => {
      const { container, unmount } = render(<AltitudeChartCompact {...defaultProps} />);
      const chartDiv = container.querySelector('[role="img"]');
      expect(chartDiv).toBeTruthy();
      
      unmount();
      // No errors means cleanup worked correctly
    });
  });

  describe('with rise/set times in range', () => {
    it('renders reference lines for rise and set', () => {
      const now = new Date();
      mockCalculateTargetVisibility.mockReturnValueOnce({
        riseTime: new Date(now.getTime() + 2 * 3600000) as unknown as null,
        setTime: new Date(now.getTime() + 8 * 3600000) as unknown as null,
        transitTime: new Date(now.getTime() + 5 * 3600000) as unknown as null,
        maxAltitude: 60,
        transitAltitude: 60,
        isCircumpolar: false,
        isNeverVisible: false,
        isCurrentlyVisible: false,
        neverRises: false,
        imagingWindowStart: null,
        imagingWindowEnd: null,
        totalVisibleMinutes: 360,
        aboveThresholdMinutes: 240,
        bestImagingWindow: null,
        imagingHours: 6,
        darkImagingStart: null,
        darkImagingEnd: null,
        darkImagingHours: 4,
      });

      render(<AltitudeChartCompact {...defaultProps} />);
      // Reference lines are rendered by the chart
      const refLines = screen.getAllByTestId('reference-line');
      expect(refLines.length).toBeGreaterThanOrEqual(1);
    });
  });
});
