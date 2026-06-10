/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ToolbarButton, ToolbarGroup, ToolbarSeparator } from '../toolbar-button';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Search: () => <span data-testid="icon-search">S</span>,
}));

const renderWithTooltip = (ui: React.ReactElement) => {
  return render(
    <TooltipProvider>
      {ui}
    </TooltipProvider>
  );
};

describe('ToolbarButton', () => {
  it('renders correctly with icon and label', () => {
    renderWithTooltip(
      <ToolbarButton 
        icon={<span data-testid="test-icon">I</span>} 
        label="Test Label" 
      />
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWithTooltip(
      <ToolbarButton 
        icon={<span>I</span>} 
        label="Label" 
        className="custom-btn"
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-btn');
  });

  it('shows active state styles', () => {
    renderWithTooltip(
      <ToolbarButton 
        icon={<span>I</span>} 
        label="Label" 
        isActive={true}
      />
    );
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-primary/20');
  });

  it('hides label when iconOnly is true', () => {
    renderWithTooltip(
      <ToolbarButton 
        icon={<span>I</span>} 
        label="Label" 
        iconOnly={true}
      />
    );
    
    const label = screen.getByText('Label');
    expect(label).toHaveClass('hidden');
  });

  it('applies responsive label visibility classes', () => {
    const { rerender } = renderWithTooltip(
      <ToolbarButton 
        icon={<span>I</span>} 
        label="Label" 
        showLabelAt="sm"
      />
    );
    expect(screen.getByText('Label')).toHaveClass('sm:inline');

    rerender(
      <TooltipProvider>
        <ToolbarButton 
          icon={<span>I</span>} 
          label="Label" 
          showLabelAt="md"
        />
      </TooltipProvider>
    );
    expect(screen.getByText('Label')).toHaveClass('md:inline');
  });
});

describe('ToolbarGroup', () => {
  it('renders children correctly', () => {
    render(
      <ToolbarGroup>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </ToolbarGroup>
    );
    
    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  it('has role="toolbar" and aria-orientation="horizontal"', () => {
    render(
      <ToolbarGroup>
        <div>Child</div>
      </ToolbarGroup>
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('applies gap classes', () => {
    const { rerender, container } = render(
      <ToolbarGroup gap="none">
        <div>Child</div>
      </ToolbarGroup>
    );
    expect(container.querySelector('.flex')).toHaveClass('gap-0');

    rerender(
      <ToolbarGroup gap="sm">
        <div>Child</div>
      </ToolbarGroup>
    );
    expect(container.querySelector('.flex')).toHaveClass('gap-1');

    rerender(
      <ToolbarGroup gap="md">
        <div>Child</div>
      </ToolbarGroup>
    );
    expect(container.querySelector('.flex')).toHaveClass('gap-2');
  });

  it('defaults to horizontal orientation', () => {
    render(
      <ToolbarGroup>
        <div>Child</div>
      </ToolbarGroup>
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-orientation', 'horizontal');
    expect(toolbar).toHaveClass('flex-row');
  });

  it('applies vertical orientation', () => {
    render(
      <ToolbarGroup orientation="vertical">
        <div>Child</div>
      </ToolbarGroup>
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('aria-orientation', 'vertical');
    expect(toolbar).toHaveClass('flex-col');
  });
});

describe('ToolbarSeparator', () => {
  it('renders correctly', () => {
    const { container } = render(<ToolbarSeparator />);
    expect(container.firstChild).toHaveClass('bg-border/50');
  });

  it('applies vertical orientation classes', () => {
    const { container } = render(<ToolbarSeparator orientation="vertical" />);
    expect(container.firstChild).toHaveClass('w-px');
    expect(container.firstChild).toHaveClass('h-6');
  });

  it('applies horizontal orientation classes', () => {
    const { container } = render(<ToolbarSeparator orientation="horizontal" />);
    expect(container.firstChild).toHaveClass('h-px');
    expect(container.firstChild).toHaveClass('w-full');
  });
});
