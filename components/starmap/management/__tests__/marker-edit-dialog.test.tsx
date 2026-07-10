/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MarkerEditDialog } from '../marker-edit-dialog';

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open: boolean }>) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean }>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}));
jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}));
jest.mock('@/components/ui/textarea', () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  PopoverContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/toggle-group', () => ({
  ToggleGroup: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  ToggleGroupItem: ({ children, value }: React.PropsWithChildren<{ value: string }>) => <button data-value={value}>{children}</button>,
}));

jest.mock('@/lib/constants/marker-icons', () => ({
  MarkerIconDisplay: new Proxy({}, {
    get: () => ({ className }: { className?: string }) => <svg className={className} data-testid="marker-icon" />,
  }),
}));

jest.mock('@/lib/stores', () => ({
  MARKER_COLORS: ['#ff0000', '#00ff00', '#0000ff'],
  MARKER_ICONS: ['star', 'pin'],
}));

describe('MarkerEditDialog', () => {
  const defaultFormData = {
    name: 'Test Marker',
    description: 'A test marker',
    icon: 'star' as const,
    color: '#ff0000',
    group: '',
    raString: '12h 30m',
    decString: '+45° 00\'',
    ra: 0,
    dec: 0,
  };

  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    formData: defaultFormData,
    onFormDataChange: jest.fn(),
    editingMarker: null,
    groups: ['Group A', 'Group B'],
    onSave: jest.fn(),
    t: (key: string) => key,
  };

  it('renders dialog when open', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<MarkerEditDialog {...defaultProps} open={false} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('shows add title when no editing marker', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    expect(screen.getByText('markers.addMarker')).toBeInTheDocument();
  });

  it('shows edit title when editing marker is present', () => {
    const marker = { id: '1', name: 'M', ra: 0, dec: 0, raString: '', decString: '', icon: 'star' as const, color: '#fff', visible: true, createdAt: Date.now(), updatedAt: Date.now() };
    render(<MarkerEditDialog {...defaultProps} editingMarker={marker} />);
    expect(screen.getByText('markers.editMarker')).toBeInTheDocument();
  });

  it('calls onSave when save button clicked', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    const saveBtn = screen.getByText('common.save');
    fireEvent.click(saveBtn);
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('disables save button when name is empty', () => {
    render(<MarkerEditDialog {...defaultProps} formData={{ ...defaultFormData, name: '' }} />);
    const saveBtn = screen.getByText('common.save');
    expect(saveBtn).toBeDisabled();
  });

  it('shows editable coordinates for new markers', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    expect(screen.getByDisplayValue('12h 30m')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+45° 00\'')).toBeInTheDocument();
  });

  it('shows editable coordinates when editing an existing marker too', () => {
    const marker = { id: '1', name: 'M', ra: 0, dec: 0, raString: '12h', decString: '+45', icon: 'star' as const, color: '#fff', visible: true, createdAt: Date.now(), updatedAt: Date.now() };
    render(<MarkerEditDialog {...defaultProps} editingMarker={marker} formData={{ ...defaultFormData, raString: '12h', decString: '+45' }} />);
    expect(screen.getByDisplayValue('12h')).toBeInTheDocument();
    expect(screen.getByDisplayValue('+45')).toBeInTheDocument();
  });

  describe('coordinate editing', () => {
    const raInput = () => screen.getByPlaceholderText('00h 42m 44s');
    const decInput = () => screen.getByPlaceholderText('+41° 16\' 09"');

    it('accepts decimal-degree input and propagates parsed values', () => {
      render(<MarkerEditDialog {...defaultProps} />);
      fireEvent.change(raInput(), { target: { value: '83.8221' } });

      expect(defaultProps.onFormDataChange).toHaveBeenCalledWith(
        expect.objectContaining({ ra: 83.8221, raString: expect.any(String) }),
      );
      expect(screen.queryByTestId('marker-coords-error')).not.toBeInTheDocument();
    });

    it('accepts sexagesimal input', () => {
      render(<MarkerEditDialog {...defaultProps} />);
      fireEvent.change(raInput(), { target: { value: '00h42m44s' } });
      fireEvent.change(decInput(), { target: { value: "+41°16'09\"" } });

      expect(screen.queryByTestId('marker-coords-error')).not.toBeInTheDocument();
      const raCall = (defaultProps.onFormDataChange as jest.Mock).mock.calls
        .map((c) => c[0])
        .find((data) => typeof data.ra === 'number' && Math.abs(data.ra - 10.68) < 0.1);
      expect(raCall).toBeDefined();
    });

    it('shows an error and disables Save on invalid coordinates', () => {
      render(<MarkerEditDialog {...defaultProps} />);
      fireEvent.change(decInput(), { target: { value: 'not-a-coordinate' } });

      expect(screen.getByTestId('marker-coords-error')).toBeInTheDocument();
      expect(screen.getByText('common.save')).toBeDisabled();
    });

    it('re-enables Save when the invalid value is corrected', () => {
      render(<MarkerEditDialog {...defaultProps} />);
      fireEvent.change(decInput(), { target: { value: '999' } }); // out of range
      expect(screen.getByText('common.save')).toBeDisabled();

      fireEvent.change(decInput(), { target: { value: '41.27' } });
      expect(screen.getByText('common.save')).toBeEnabled();
    });
  });

  // 测试 name 输入回调
  it('calls onFormDataChange when name changes', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    const nameInput = screen.getByDisplayValue('Test Marker');
    fireEvent.change(nameInput, { target: { value: 'New Name' } });
    expect(defaultProps.onFormDataChange).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }));
  });

  // 测试 description 输入回调
  it('calls onFormDataChange when description changes', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    const descInput = screen.getByDisplayValue('A test marker');
    fireEvent.change(descInput, { target: { value: 'New desc' } });
    expect(defaultProps.onFormDataChange).toHaveBeenCalledWith(expect.objectContaining({ description: 'New desc' }));
  });

  // 测试颜色选择回调
  it('calls onFormDataChange when color selected', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    const colorBtns = screen.getAllByRole('button').filter(b => b.getAttribute('aria-label'));
    if (colorBtns.length > 0) {
      fireEvent.click(colorBtns[0]);
      expect(defaultProps.onFormDataChange).toHaveBeenCalledWith(expect.objectContaining({ color: expect.any(String) }));
    }
  });

  // 测试取消按钮
  it('calls onOpenChange when cancel clicked', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  // 测试 group 输入回调
  it('calls onFormDataChange when group changes', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    const groupInput = screen.getByPlaceholderText('markers.groupPlaceholder');
    fireEvent.change(groupInput, { target: { value: 'New Group' } });
    expect(defaultProps.onFormDataChange).toHaveBeenCalledWith(expect.objectContaining({ group: 'New Group' }));
  });

  // 测试 group 下拉选择
  it('shows group suggestions', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    expect(screen.getByText('Group A')).toBeInTheDocument();
    expect(screen.getByText('Group B')).toBeInTheDocument();
  });

  // 点击 group 建议
  it('calls onFormDataChange when group suggestion clicked', () => {
    render(<MarkerEditDialog {...defaultProps} />);
    fireEvent.click(screen.getByText('Group A'));
    expect(defaultProps.onFormDataChange).toHaveBeenCalledWith(expect.objectContaining({ group: 'Group A' }));
  });
});
