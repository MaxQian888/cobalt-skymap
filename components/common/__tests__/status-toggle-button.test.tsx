/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusToggleButton } from '../status-toggle-button';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderWithTooltip = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

describe('StatusToggleButton', () => {
  it('renders the icon and exposes the label as accessible name', () => {
    renderWithTooltip(
      <StatusToggleButton
        icon={<span data-testid="icon">I</span>}
        label="Toggle search"
        active={false}
        onClick={() => {}}
      />
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Toggle search' })).toBeInTheDocument();
  });

  it('reflects active state via aria-pressed and the primary tone class', () => {
    renderWithTooltip(
      <StatusToggleButton
        icon={<span>I</span>}
        label="Search"
        active
        onClick={() => {}}
      />
    );
    const button = screen.getByRole('button', { name: 'Search' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('text-primary');
  });

  it('uses the night tone active styling when tone="night"', () => {
    renderWithTooltip(
      <StatusToggleButton
        icon={<span>I</span>}
        label="Night"
        tone="night"
        active
        onClick={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Night' })).toHaveClass('text-red-400');
  });

  it('fires onClick', () => {
    const onClick = jest.fn();
    renderWithTooltip(
      <StatusToggleButton icon={<span>I</span>} label="X" active={false} onClick={onClick} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'X' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges custom className', () => {
    renderWithTooltip(
      <StatusToggleButton icon={<span>I</span>} label="X" active={false} onClick={() => {}} className="custom" />
    );
    expect(screen.getByRole('button', { name: 'X' })).toHaveClass('custom');
  });
});
