/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { RiseTransitSetGrid } from '../rise-transit-set-grid';

jest.mock('@/components/ui/card', () => ({
  Card: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="card" data-slot="card" className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({
    children,
    className,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) => (
    <div data-testid="card-content" data-slot="card-content" className={className} {...props}>
      {children}
    </div>
  ),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/astronomy/astro-utils', () => ({
  formatTimeShort: jest.fn((date: Date | null) => date ? '12:00' : '--:--'),
}));

describe('RiseTransitSetGrid', () => {
  const baseVisibility = {
    riseTime: new Date('2026-01-01T06:00:00'),
    transitTime: new Date('2026-01-01T12:00:00'),
    setTime: new Date('2026-01-01T18:00:00'),
    maxAltitude: 60,
    transitAltitude: 60,
    isCircumpolar: false,
    isNeverVisible: false,
    isCurrentlyVisible: true,
    neverRises: false,
    imagingWindowStart: null,
    imagingWindowEnd: null,
    totalVisibleMinutes: 720,
    aboveThresholdMinutes: 600,
    bestImagingWindow: null,
    imagingHours: 10,
    darkImagingStart: null,
    darkImagingEnd: null,
    darkImagingHours: 8,
  } as const;

  it('renders rise, transit, set labels', () => {
    render(<RiseTransitSetGrid visibility={baseVisibility} />);
    expect(screen.getByText('time.rise')).toBeInTheDocument();
    expect(screen.getByText('time.transit')).toBeInTheDocument();
    expect(screen.getByText('time.set')).toBeInTheDocument();
  });

  it('renders formatted times', () => {
    render(<RiseTransitSetGrid visibility={baseVisibility} />);
    const times = screen.getAllByText('12:00');
    expect(times.length).toBeGreaterThanOrEqual(1);
  });

  it('renders infinity symbol for circumpolar objects', () => {
    render(<RiseTransitSetGrid visibility={{ ...baseVisibility, isCircumpolar: true }} />);
    const infinities = screen.getAllByText('∞');
    expect(infinities).toHaveLength(2);
  });

  it('renders compact variant', () => {
    const { container } = render(<RiseTransitSetGrid visibility={baseVisibility} variant="compact" />);
    expect(container.firstChild).toHaveClass('text-xs');
  });

  it('renders full variant with icons', () => {
    const { container } = render(<RiseTransitSetGrid visibility={baseVisibility} variant="full" />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('applies custom className', () => {
    const { container } = render(<RiseTransitSetGrid visibility={baseVisibility} className="custom" />);
    expect(container.firstChild).toHaveClass('custom');
  });

  it('renders --:-- for null rise/set times when not circumpolar', () => {
    const vis = { ...baseVisibility, riseTime: null as unknown as Date, setTime: null as unknown as Date };
    render(<RiseTransitSetGrid visibility={vis} />);
    const dashes = screen.getAllByText('--:--');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it('defaults to full variant when no variant specified', () => {
    const { container } = render(<RiseTransitSetGrid visibility={baseVisibility} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('renders grid with 3 columns', () => {
    const { container } = render(<RiseTransitSetGrid visibility={baseVisibility} />);
    expect(container.firstChild).toHaveClass('grid-cols-3');
  });

  it('renders each metric cell with shadcn card surfaces', () => {
    render(<RiseTransitSetGrid visibility={baseVisibility} />);
    expect(screen.getAllByTestId('card')).toHaveLength(3);
  });
});
