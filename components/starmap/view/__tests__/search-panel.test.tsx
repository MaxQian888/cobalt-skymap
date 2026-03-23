/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/components/ui/button', () => ({ Button: ({ children, ...props }: React.PropsWithChildren) => <button {...props}>{children}</button> }));
jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => <div className={className}>{children}</div>,
  CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  CardTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ children }: React.PropsWithChildren) => <div>{children}</div> }));
jest.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerContent: ({ children }: React.PropsWithChildren) => <div data-testid="search-mobile-drawer">{children}</div>,
  DrawerHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DrawerTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/starmap/search/stellarium-search', () => ({
  StellariumSearch: () => <div data-testid="stellarium-search" />,
}));
jest.mock('@/components/starmap/search/favorites-quick-access', () => ({
  FavoritesQuickAccess: ({
    onSelect,
    onNavigate,
  }: {
    onSelect: (item: unknown) => void;
    onNavigate: (item: unknown) => void;
  }) => (
    <div>
      <button data-testid="favorites-select" onClick={() => onSelect({ id: 'favorite' })}>
        select favorite
      </button>
      <button data-testid="favorites-navigate" onClick={() => onNavigate({ id: 'favorite' })}>
        navigate favorite
      </button>
    </div>
  ),
}));
jest.mock('@/components/starmap/search/online-search-settings', () => ({
  OnlineSearchSettings: () => <div data-testid="online-search-settings" />,
}));

import { SearchPanel } from '../search-panel';

describe('SearchPanel', () => {
  it('renders without crashing when open', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
  });

  it('renders StellariumSearch by default', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByTestId('stellarium-search')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(<SearchPanel isOpen={true} onClose={onClose} onSelect={jest.fn()} />);
    // Close button is the last button (X icon)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows favorites panel when favorites button is clicked', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    // First button is favorites (Star icon)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    // StellariumSearch should no longer be visible
    expect(screen.queryByTestId('stellarium-search')).not.toBeInTheDocument();
  });

  it('shows settings panel when settings button is clicked', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    // Second button is settings (Settings2 icon)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(screen.getByTestId('online-search-settings')).toBeInTheDocument();
  });

  it('toggles favorites off when clicked again', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    // Click favorites on
    fireEvent.click(buttons[0]);
    expect(screen.queryByTestId('stellarium-search')).not.toBeInTheDocument();
    // Click favorites off
    fireEvent.click(buttons[0]);
    expect(screen.getByTestId('stellarium-search')).toBeInTheDocument();
  });

  it('favorites and settings are mutually exclusive', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    const buttons = screen.getAllByRole('button');
    // Open favorites
    fireEvent.click(buttons[0]);
    // Open settings (should close favorites)
    fireEvent.click(buttons[1]);
    // Close settings
    fireEvent.click(buttons[1]);
    // Should be back to search
    expect(screen.getByTestId('stellarium-search')).toBeInTheDocument();
  });

  it('displays search title', () => {
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByText('starmap.searchObjects')).toBeInTheDocument();
  });

  it('applies closed styles when isOpen is false', () => {
    const { container } = render(<SearchPanel isOpen={false} onClose={jest.fn()} onSelect={jest.fn()} />);
    // When closed, should have pointer-events-none class
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('pointer-events-none');
  });

  it('renders mobile drawer variant when mobile shell is enabled', () => {
    render(<SearchPanel isOpen={true} isMobileShell={true} onClose={jest.fn()} onSelect={jest.fn()} />);
    expect(screen.getByTestId('search-mobile-drawer')).toBeInTheDocument();
  });

  it('closes favorites and forwards selection callbacks when a favorite is selected', () => {
    const onSelect = jest.fn();
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByTestId('favorites-select'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('stellarium-search')).toBeInTheDocument();
  });

  it('closes favorites and forwards navigation callbacks when a favorite is navigated to', () => {
    const onSelect = jest.fn();
    render(<SearchPanel isOpen={true} onClose={jest.fn()} onSelect={onSelect} />);

    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByTestId('favorites-navigate'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('stellarium-search')).toBeInTheDocument();
  });
});
