/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditSourceDialog } from '../edit-source-dialog';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));
jest.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (v: number[]) => void }) => (
    <input type="range" value={value[0]} onChange={(e) => onValueChange([Number(e.target.value)])} data-testid="slider" />
  ),
}));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open: boolean }>) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogDescription: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

describe('EditSourceDialog', () => {
  const mockSource = {
    id: 'src-1',
    name: 'SIMBAD',
    type: 'simbad' as const,
    description: 'SIMBAD database',
    enabled: true,
    priority: 5,
    builtIn: true,
    baseUrl: 'https://simbad.example.com',
    apiEndpoint: '/api/query',
    timeout: 10000,
    status: 'online' as const,
    renderTier: 'enrichment' as const,
    fallbackRole: 'primary' as const,
  };

  const defaultProps = {
    source: mockSource,
    type: 'data' as const,
    open: true,
    onOpenChange: jest.fn(),
    onSave: jest.fn(),
  };

  it('renders dialog when open', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<EditSourceDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('shows source name in title', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByText(/SIMBAD/)).toBeInTheDocument();
  });

  it('shows priority slider', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByTestId('slider')).toBeInTheDocument();
  });

  it('shows source info section', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByText('https://simbad.example.com')).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', () => {
    render(<EditSourceDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('common.save'));
    expect(defaultProps.onSave).toHaveBeenCalledWith({ priority: 5, description: 'SIMBAD database' });
  });

  it('calls onOpenChange when cancel clicked', () => {
    render(<EditSourceDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not show description field for built-in sources', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.queryByLabelText('sourceConfig.sourceDescription')).not.toBeInTheDocument();
  });

  it('shows description field for custom (non-built-in) sources', () => {
    const customSource = { ...mockSource, builtIn: false };
    render(<EditSourceDialog {...defaultProps} source={customSource} />);
    expect(screen.getByPlaceholderText('sourceConfig.descriptionPlaceholder')).toBeInTheDocument();
  });

  it('updates priority via slider', () => {
    render(<EditSourceDialog {...defaultProps} />);
    const slider = screen.getByTestId('slider');
    fireEvent.change(slider, { target: { value: '10' } });
    
    // Click save to verify updated priority
    fireEvent.click(screen.getByText('common.save'));
    expect(defaultProps.onSave).toHaveBeenCalledWith({ priority: 10, description: 'SIMBAD database' });
  });

  it('renders read-only source info for image type with urlTemplate', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageSource: any = {
      id: 'img-1',
      name: 'SkyView',
      type: 'survey',
      description: 'NASA SkyView',
      enabled: true,
      priority: 1,
      builtIn: true,
      baseUrl: 'https://skyview.example.com',
      urlTemplate: '/cgi-bin/images?',
      credit: 'NASA',
      status: 'online',
      renderTier: 'survey',
      fallbackRole: 'primary',
    };
    render(<EditSourceDialog source={imageSource} type="image" open={true} onOpenChange={jest.fn()} onSave={jest.fn()} />);
    // Source info section should show base URL
    expect(screen.getByText('https://skyview.example.com')).toBeInTheDocument();
    // urlTemplate is rendered when type === 'image' && 'urlTemplate' in source
    expect(screen.getByText('/cgi-bin/images?')).toBeInTheDocument();
  });

  it('shows built-in description for built-in sources', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByText('sourceConfig.editBuiltInDescription')).toBeInTheDocument();
  });

  it('shows custom description for custom sources', () => {
    const customSource = { ...mockSource, builtIn: false };
    render(<EditSourceDialog {...defaultProps} source={customSource} />);
    expect(screen.getByText('sourceConfig.editCustomDescription')).toBeInTheDocument();
  });

  it('displays source type in read-only section', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByText('simbad')).toBeInTheDocument();
  });

  it('displays base URL in read-only section', () => {
    render(<EditSourceDialog {...defaultProps} />);
    expect(screen.getByText('https://simbad.example.com')).toBeInTheDocument();
  });
});
