/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TargetDetailDialog } from '../target-detail-dialog';

const mockUpdateTarget = jest.fn();
const mockAddTag = jest.fn();

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@/lib/stores', () => ({
  useTargetListStore: (selector: (s: unknown) => unknown) =>
    selector({
      updateTarget: mockUpdateTarget,
      availableTags: ['nebula', 'galaxy', 'cluster'],
      addTag: mockAddTag,
    }),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: React.PropsWithChildren<{ open: boolean }>) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void }>) => <button onClick={onClick} {...props}>{children}</button>,
}));
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => <span data-testid="badge" onClick={onClick}>{children}</span>,
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
jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange }: React.PropsWithChildren<{ value?: string; onValueChange?: (v: string) => void }>) => (
    <div data-testid="select" data-value={value} onClick={() => onValueChange?.('high')}>{children}</div>
  ),
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectValue: () => <div />,
}));

const baseTarget = {
  id: 't1',
  name: 'M31',
  ra: 10.68,
  dec: 41.26,
  raString: '00h 42m',
  decString: "+41° 16'",
  priority: 'medium' as const,
  status: 'planned' as const,
  notes: 'some notes',
  tags: ['galaxy'] as string[],
  addedAt: Date.now(),
  type: 'Galaxy',
  isFavorite: false,
  isArchived: false,
};

describe('TargetDetailDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when target is null', () => {
    const { container } = render(<TargetDetailDialog target={null} open={true} onOpenChange={jest.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('does not render when closed', () => {
    render(<TargetDetailDialog target={baseTarget} open={false} onOpenChange={jest.fn()} />);
    expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('renders target name and coordinates when open', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('M31')).toBeInTheDocument();
    expect(screen.getByText("RA: 00h 42m / Dec: +41° 16'")).toBeInTheDocument();
  });

  it('renders notes textarea with existing value', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    const textarea = screen.getByDisplayValue('some notes');
    expect(textarea).toBeInTheDocument();
  });

  it('renders existing tags', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('galaxy')).toBeInTheDocument();
  });

  it('renders available tags that are not already applied', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('+ nebula')).toBeInTheDocument();
    expect(screen.getByText('+ cluster')).toBeInTheDocument();
    expect(screen.queryByText('+ galaxy')).not.toBeInTheDocument();
  });

  it('calls updateTarget and closes on save', () => {
    const onOpenChange = jest.fn();
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={onOpenChange} />);
    const saveBtn = screen.getByText('common.save');
    fireEvent.click(saveBtn);
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      priority: 'medium',
      status: 'planned',
      tags: ['galaxy'],
    }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('calls onOpenChange(false) on cancel', () => {
    const onOpenChange = jest.fn();
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('updates notes via textarea', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    const textarea = screen.getByDisplayValue('some notes');
    fireEvent.change(textarea, { target: { value: 'updated notes' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      notes: 'updated notes',
    }));
  });

  it('adds a new tag via input and button', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    const tagInput = screen.getByPlaceholderText('targetDetail.newTag');
    fireEvent.change(tagInput, { target: { value: 'newTag' } });
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      tags: ['galaxy', 'newTag'],
    }));
    expect(mockAddTag).toHaveBeenCalledWith('newTag');
  });

  it('adds tag via Enter key', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    const tagInput = screen.getByPlaceholderText('targetDetail.newTag');
    fireEvent.change(tagInput, { target: { value: 'enterTag' } });
    fireEvent.keyDown(tagInput, { key: 'Enter' });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      tags: ['galaxy', 'enterTag'],
    }));
  });

  it('does not add duplicate tag', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    const tagInput = screen.getByPlaceholderText('targetDetail.newTag');
    fireEvent.change(tagInput, { target: { value: 'galaxy' } });
    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      tags: ['galaxy'],
    }));
  });

  it('removes a tag when remove button clicked', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    const removeBtn = screen.getByText('galaxy').parentElement?.querySelector('button');
    if (removeBtn) fireEvent.click(removeBtn);
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      tags: [],
    }));
  });

  it('adds existing available tag when clicked', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByText('+ nebula'));
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      tags: ['galaxy', 'nebula'],
    }));
  });

  it('handles exposure plan single exposure change with auto-calc', () => {
    const target = { ...baseTarget, exposurePlan: { singleExposure: 60, totalExposure: 10, subFrames: 10, filter: 'L' } };
    render(<TargetDetailDialog target={target} open={true} onOpenChange={jest.fn()} />);
    const singleInput = screen.getByDisplayValue('60');
    fireEvent.change(singleInput, { target: { value: '120' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      exposurePlan: expect.objectContaining({
        singleExposure: 120,
      }),
    }));
  });

  it('handles sub-frames change with auto-calc', () => {
    const target = { ...baseTarget, exposurePlan: { singleExposure: 60, totalExposure: 5, subFrames: 8, filter: 'L' } };
    render(<TargetDetailDialog target={target} open={true} onOpenChange={jest.fn()} />);
    const subInput = screen.getByDisplayValue('8');
    fireEvent.change(subInput, { target: { value: '20' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      exposurePlan: expect.objectContaining({
        subFrames: 20,
      }),
    }));
  });

  it('handles total exposure change with auto-calc of sub frames', () => {
    const target = { ...baseTarget, exposurePlan: { singleExposure: 60, totalExposure: 5, subFrames: 8, filter: 'L' } };
    render(<TargetDetailDialog target={target} open={true} onOpenChange={jest.fn()} />);
    const totalInput = screen.getByDisplayValue('5');
    fireEvent.change(totalInput, { target: { value: '30' } });
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalled();
  });

  it('renders focal length info when present', () => {
    const target = { ...baseTarget, focalLength: 1000 };
    render(<TargetDetailDialog target={target} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('1000mm')).toBeInTheDocument();
  });

  it('renders mosaic info when enabled', () => {
    const target = { ...baseTarget, focalLength: 500, mosaic: { enabled: true, cols: 2, rows: 3, overlap: 10 } };
    render(<TargetDetailDialog target={target} open={true} onOpenChange={jest.fn()} />);
    expect(screen.getByText('500mm')).toBeInTheDocument();
    expect(screen.getByText('• Mosaic 2×3')).toBeInTheDocument();
  });

  it('renders advanced mosaic planning summary when available', () => {
    const target = {
      ...baseTarget,
      focalLength: 500,
      mosaic: {
        enabled: true,
        cols: 2,
        rows: 3,
        overlap: 10,
        overlapUnit: 'percent' as const,
        layoutMode: 'staggered' as const,
        panelOrder: 'center-out' as const,
      },
      mosaicPlan: {
        layoutMode: 'staggered' as const,
        panelOrder: 'center-out' as const,
        totalPanels: 6,
        width: 4.5,
        height: 2.2,
        overlapFactor: 0.9,
        estimatedPanelMinutes: 30,
        estimatedTotalMinutes: 180,
        panels: [],
        warnings: [],
      },
    };

    render(<TargetDetailDialog target={target} open={true} onOpenChange={jest.fn()} />);

    expect(screen.getByText('targetDetail.mosaicPlanPanels')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('targetDetail.mosaicPlanLayout')).toBeInTheDocument();
    expect(screen.getByText('staggered')).toBeInTheDocument();
    expect(screen.getByText('targetDetail.mosaicPlanOrder')).toBeInTheDocument();
    expect(screen.getByText('center-out')).toBeInTheDocument();
    expect(screen.getByText('targetDetail.mosaicPlanTime')).toBeInTheDocument();
    expect(screen.getByText('180 min')).toBeInTheDocument();
  });

  it('saves without exposure plan when fields are empty', () => {
    render(<TargetDetailDialog target={baseTarget} open={true} onOpenChange={jest.fn()} />);
    fireEvent.click(screen.getByText('common.save'));
    expect(mockUpdateTarget).toHaveBeenCalledWith('t1', expect.objectContaining({
      exposurePlan: undefined,
    }));
  });
});
