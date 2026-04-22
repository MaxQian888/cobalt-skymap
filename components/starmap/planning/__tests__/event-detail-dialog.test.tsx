/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-header">{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2 data-testid="dialog-title">{children}</h2>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, asChild: _asChild, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode; asChild?: boolean }) => (
    <button onClick={onClick} data-testid="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span data-testid="badge">{children}</span>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div data-testid="scroll-area">{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    asChild ? <>{children}</> : <div>{children}</div>
  ),
}));

import { EventDetailDialog } from '../event-detail-dialog';
import type { AstroEvent } from '@/lib/services/astro-data-sources';

const mockEvent: AstroEvent = {
  id: 'test-1',
  type: 'meteor_shower',
  name: 'Perseids',
  date: new Date('2025-08-12'),
  endDate: new Date('2025-08-24'),
  description: 'One of the best annual meteor showers.',
  visibility: 'excellent',
  magnitude: undefined,
  ra: 48.0,
  dec: 58.0,
  source: 'IMO',
  url: 'https://www.imo.net',
};

const mockLunarEvent: AstroEvent = {
  id: 'lunar-1',
  type: 'lunar_phase',
  name: 'Full Moon',
  date: new Date('2025-03-14'),
  description: 'Full Moon in March.',
  visibility: 'good',
  source: 'USNO',
};

describe('EventDetailDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnGoTo = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when event is null', () => {
    const { container } = render(
      <EventDetailDialog event={null} open={false} onOpenChange={mockOnOpenChange} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <EventDetailDialog event={mockEvent} open={false} onOpenChange={mockOnOpenChange} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders event name when open', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('Perseids')).toBeInTheDocument();
  });

  it('renders event description', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('One of the best annual meteor showers.')).toBeInTheDocument();
  });

  it('renders visibility badge for excellent visibility', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('events.excellent')).toBeInTheDocument();
  });

  it('renders coordinates when RA/Dec available', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('48.0000°')).toBeInTheDocument();
    expect(screen.getByText('58.0000°')).toBeInTheDocument();
  });

  it('does not render coordinates when RA/Dec not available', () => {
    render(
      <EventDetailDialog event={mockLunarEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.queryByText('RA')).not.toBeInTheDocument();
  });

  it('renders go-to button when coordinates and onGoTo provided', () => {
    render(
      <EventDetailDialog
        event={mockEvent}
        open={true}
        onOpenChange={mockOnOpenChange}
        onGoTo={mockOnGoTo}
      />
    );
    expect(screen.getByText('eventDetail.goToLocation')).toBeInTheDocument();
  });

  it('does not render go-to button without onGoTo', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.queryByText('eventDetail.goToLocation')).not.toBeInTheDocument();
  });

  it('calls onGoTo and closes dialog when go-to button clicked', () => {
    render(
      <EventDetailDialog
        event={mockEvent}
        open={true}
        onOpenChange={mockOnOpenChange}
        onGoTo={mockOnGoTo}
      />
    );
    const goToButton = screen.getByText('eventDetail.goToLocation').closest('button');
    fireEvent.click(goToButton!);
    expect(mockOnGoTo).toHaveBeenCalledWith(48.0, 58.0);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders source badge', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    expect(screen.getByText('IMO')).toBeInTheDocument();
  });

  it('renders external link when url provided', () => {
    render(
      <EventDetailDialog event={mockEvent} open={true} onOpenChange={mockOnOpenChange} />
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://www.imo.net');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
