/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FeasibilityBadge } from '../feasibility-badge';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <span data-testid="badge" className={className}>{children}</span>
  ),
}));

jest.mock('@/components/ui/item', () => ({
  Item: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="item" data-slot="item" className={className}>{children}</div>
  ),
  ItemContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="item-content" data-slot="item-content" className={className}>{children}</div>
  ),
  ItemTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="item-title" data-slot="item-title" className={className}>{children}</div>
  ),
  ItemActions: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="item-actions" data-slot="item-actions" className={className}>{children}</div>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div data-testid="tooltip-content">{children}</div>,
}));

jest.mock('@/lib/core/constants/planning-styles', () => ({
  getFeasibilityColor: jest.fn(() => 'bg-green-500/10'),
  getFeasibilityBadgeColor: jest.fn(() => 'bg-green-500'),
}));

const mockFeasibility = {
  score: 85,
  recommendation: 'excellent' as const,
  moonScore: 90,
  altitudeScore: 80,
  durationScore: 85,
  twilightScore: 88,
  warnings: [] as string[],
  tips: [] as string[],
};

describe('FeasibilityBadge', () => {
  it('renders badge variant by default', () => {
    render(<FeasibilityBadge feasibility={mockFeasibility} />);
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByText('85/100')).toBeInTheDocument();
  });

  it('renders inline variant', () => {
    render(<FeasibilityBadge feasibility={mockFeasibility} variant="inline" />);
    expect(screen.getByText('85/100')).toBeInTheDocument();
  });

  it('renders inline variant with shadcn item surface', () => {
    render(<FeasibilityBadge feasibility={mockFeasibility} variant="inline" />);
    expect(screen.getByTestId('item')).toHaveAttribute('data-slot', 'item');
  });

  it('displays score details in tooltip', () => {
    render(<FeasibilityBadge feasibility={mockFeasibility} />);
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('shows warnings when present', () => {
    const withWarnings = { ...mockFeasibility, warnings: ['Moon too bright'] };
    render(<FeasibilityBadge feasibility={withWarnings} />);
    expect(screen.getByText('Moon too bright')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <FeasibilityBadge feasibility={mockFeasibility} className="my-badge" />
    );
    expect(container.innerHTML).toContain('my-badge');
  });
});
