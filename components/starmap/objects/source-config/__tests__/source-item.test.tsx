/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceItem } from '../source-item';
import type { DataSourceConfig } from '@/lib/services/object-info-config';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange, ...props }: { checked: boolean; onCheckedChange: (v: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} {...props} />
  ),
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));
jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));
jest.mock('../status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

describe('SourceItem', () => {
  const mockSource: DataSourceConfig = {
    id: 'src-1',
    name: 'SIMBAD',
    type: 'simbad' as const,
    description: 'SIMBAD astronomical database',
    enabled: true,
    priority: 1,
    builtIn: true,
    status: 'online' as const,
    responseTime: 100,
    baseUrl: 'https://simbad.u-strasbg.fr',
    apiEndpoint: '/api',
    timeout: 5000,
    renderTier: 'enrichment' as const,
    fallbackRole: 'primary' as const,
    targetClasses: ['generic'],
    responseMode: 'json' as const,
    authorityLevel: 'reference' as const,
    healthCheck: { strategy: 'disabled' as const },
  };

  const defaultProps = {
    source: mockSource,
    onToggle: jest.fn(),
    onCheck: jest.fn(),
    onEdit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders source name', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.getByText('SIMBAD')).toBeInTheDocument();
  });

  it('renders source description', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.getByText('SIMBAD astronomical database')).toBeInTheDocument();
  });

  it('renders source type badge', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.getByText('simbad')).toBeInTheDocument();
  });

  it('renders built-in badge for built-in sources', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.getByText('sourceConfig.builtIn')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.getByTestId('status-badge')).toBeInTheDocument();
  });

  it('renders switch for toggling', () => {
    render(<SourceItem {...defaultProps} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('calls onToggle when switch is changed', () => {
    render(<SourceItem {...defaultProps} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(defaultProps.onToggle).toHaveBeenCalled();
  });

  it('does not show delete button for built-in sources', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.queryByText('common.delete')).not.toBeInTheDocument();
  });

  it('shows delete button for custom sources', () => {
    const customSource = { ...mockSource, builtIn: false };
    render(<SourceItem {...defaultProps} source={customSource} onRemove={jest.fn()} />);
    expect(screen.getByText('common.delete')).toBeInTheDocument();
  });

  it('calls onCheck when check button is clicked', () => {
    render(<SourceItem {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    // Find the refresh button (first button that isn't the switch)
    const checkButton = buttons.find(btn => btn.querySelector('.lucide-refresh-cw'));
    expect(checkButton).toBeDefined();
    fireEvent.click(checkButton!);
    expect(defaultProps.onCheck).toHaveBeenCalled();
  });

  it('calls onEdit when edit button is clicked', () => {
    render(<SourceItem {...defaultProps} />);
    const buttons = screen.getAllByRole('button');
    const editButton = buttons.find(btn => btn.querySelector('.lucide-settings'));
    expect(editButton).toBeDefined();
    fireEvent.click(editButton!);
    expect(defaultProps.onEdit).toHaveBeenCalled();
  });

  it('disables check button when status is checking', () => {
    const checkingSource = { ...mockSource, status: 'checking' as const };
    render(<SourceItem {...defaultProps} source={checkingSource} />);
    const buttons = screen.getAllByRole('button');
    const checkButton = buttons.find(btn => btn.querySelector('.lucide-refresh-cw'));
    expect(checkButton).toBeDisabled();
  });

  it('renders priority number', () => {
    render(<SourceItem {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('applies opacity when source is disabled', () => {
    const disabledSource = { ...mockSource, enabled: false };
    const { container } = render(<SourceItem {...defaultProps} source={disabledSource} />);
    expect(container.firstChild).toHaveClass('opacity-60');
  });

  it('calls onRemove when delete action is confirmed for custom source', () => {
    const mockOnRemove = jest.fn();
    const customSource = { ...mockSource, builtIn: false };
    render(<SourceItem {...defaultProps} source={customSource} onRemove={mockOnRemove} />);
    fireEvent.click(screen.getByText('common.delete'));
    expect(mockOnRemove).toHaveBeenCalled();
  });
});
