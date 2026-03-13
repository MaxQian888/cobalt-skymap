/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Control the mock return values
let mockIsTooLarge = false;
const mockDims = {
  isTooLarge: false,
  scaledPanelWidth: 100,
  scaledPanelHeight: 80,
  scaledStepX: 90,
  scaledStepY: 72,
  scaledTotalWidth: 200,
  scaledTotalHeight: 160,
  cameraFovWidth: 2.5,
  cameraFovHeight: 1.7,
};

jest.mock('@/lib/astronomy/fov-calculations', () => ({
  calculateOverlayDimensions: () => ({
    ...mockDims,
    isTooLarge: mockIsTooLarge,
  }),
  calculateMosaicLayout: (pw: number, ph: number, sx: number, sy: number, cols: number, rows: number) => {
    const panels = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        panels.push({
          x: c * sx,
          y: r * sy,
          isCenter: (cols <= 1 && rows <= 1) || (c === Math.floor((cols - 1) / 2) && r === Math.floor((rows - 1) / 2)),
        });
      }
    }
    return panels;
  },
}));

import { FOVOverlay } from '../fov-overlay';

describe('FOVOverlay', () => {
  const defaultProps = {
    enabled: true,
    sensorWidth: 36,
    sensorHeight: 24,
    focalLength: 500,
    currentFov: 2,
    rotationAngle: 0,
    onRotationChange: jest.fn(),
    mosaic: {
      enabled: false,
      rows: 1,
      cols: 1,
      overlap: 10,
      overlapUnit: 'percent' as const,
    },
    gridType: 'crosshair' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTooLarge = false;
  });

  it('renders without crashing', () => {
    render(<FOVOverlay {...defaultProps} />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders container when disabled (for ResizeObserver)', () => {
    const { container } = render(<FOVOverlay {...defaultProps} enabled={false} />);
    expect(container.querySelector('.pointer-events-none')).toBeInTheDocument();
  });

  it('shows warning alert when isTooLarge', () => {
    mockIsTooLarge = true;
    render(<FOVOverlay {...defaultProps} />);
    expect(screen.getByText(/Camera FOV.*is larger than current view/)).toBeInTheDocument();
  });

  it('does not show warning when not isTooLarge', () => {
    render(<FOVOverlay {...defaultProps} />);
    expect(screen.queryByText(/is larger than current view/)).not.toBeInTheDocument();
  });

  it('renders with mosaic enabled and shows panel numbers', () => {
    const { container } = render(
      <FOVOverlay
        {...defaultProps}
        mosaic={{ enabled: true, rows: 2, cols: 2, overlap: 10, overlapUnit: 'percent' }}
      />
    );
    // Should render 4 panels (2x2)
    const panelBorders = container.querySelectorAll('.border-2');
    expect(panelBorders.length).toBe(4);
    // Panel numbers 1-4
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders FOV label for single panel', () => {
    render(<FOVOverlay {...defaultProps} />);
    expect(screen.getByText(/2\.5° × 1\.7°/)).toBeInTheDocument();
  });

  it('renders FOV label for mosaic panel', () => {
    render(
      <FOVOverlay
        {...defaultProps}
        mosaic={{ enabled: true, rows: 2, cols: 3, overlap: 10, overlapUnit: 'percent' }}
      />
    );
    expect(screen.getByText(/3×2/)).toBeInTheDocument();
  });

  it('shows rotation angle in label when non-zero', () => {
    render(<FOVOverlay {...defaultProps} rotationAngle={45} />);
    expect(screen.getByText('(45°)')).toBeInTheDocument();
  });

  it('does not show rotation angle in label when zero', () => {
    render(<FOVOverlay {...defaultProps} rotationAngle={0} />);
    expect(screen.queryByText(/\(\d+°\)/)).not.toBeInTheDocument();
  });

  it('renders rotation handle when onRotationChange is provided', () => {
    const { container } = render(<FOVOverlay {...defaultProps} onRotationChange={jest.fn()} />);
    expect(container.querySelector('.cursor-grab')).toBeInTheDocument();
  });

  it('does not render rotation handle when onRotationChange is undefined', () => {
    const { container } = render(<FOVOverlay {...defaultProps} onRotationChange={undefined} />);
    expect(container.querySelector('.cursor-grab')).not.toBeInTheDocument();
  });

  it('renders with different grid types without crashing', () => {
    const gridTypes = ['none', 'crosshair', 'thirds', 'golden', 'diagonal'] as const;
    gridTypes.forEach((gridType) => {
      const { unmount } = render(<FOVOverlay {...defaultProps} gridType={gridType} />);
      expect(document.body).toBeInTheDocument();
      unmount();
    });
  });

  it('applies overlayOpacity style', () => {
    const { container } = render(<FOVOverlay {...defaultProps} overlayOpacity={50} />);
    const rotatedDiv = container.querySelector('.transition-transform') as HTMLElement;
    expect(rotatedDiv?.style.opacity).toBe('0.5');
  });

  it('applies frame style from props', () => {
    const { container } = render(<FOVOverlay {...defaultProps} frameStyle="dashed" />);
    const panel = container.querySelector('.border-2') as HTMLElement;
    expect(panel?.style.borderStyle).toBe('dashed');
  });

  it('applies rotation transform', () => {
    const { container } = render(<FOVOverlay {...defaultProps} rotationAngle={90} />);
    const rotatedDiv = container.querySelector('.transition-transform') as HTMLElement;
    expect(rotatedDiv?.style.transform).toContain('translate(0px, 0px)');
    expect(rotatedDiv?.style.transform).toContain('rotate(90deg)');
  });

  it('handles mouse drag on rotation handle', () => {
    const onRotationChange = jest.fn();
    const { container } = render(<FOVOverlay {...defaultProps} onRotationChange={onRotationChange} />);
    const handle = container.querySelector('.cursor-grab') as HTMLElement;
    expect(handle).toBeInTheDocument();

    // Mock parent getBoundingClientRect
    const parentEl = handle.parentElement;
    if (parentEl) {
      parentEl.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 200, height: 160,
        right: 200, bottom: 160, x: 0, y: 0, toJSON: () => ({}),
      });
    }

    // Simulate mouse drag
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 0, preventDefault: jest.fn() });
    fireEvent.mouseMove(document, { clientX: 200, clientY: 80 });
    fireEvent.mouseUp(document);

    expect(onRotationChange).toHaveBeenCalled();
  });

  it('handles touch drag on rotation handle', () => {
    const onRotationChange = jest.fn();
    const { container } = render(<FOVOverlay {...defaultProps} onRotationChange={onRotationChange} />);
    const handle = container.querySelector('.cursor-grab') as HTMLElement;

    const parentEl = handle.parentElement;
    if (parentEl) {
      parentEl.getBoundingClientRect = () => ({
        left: 0, top: 0, width: 200, height: 160,
        right: 200, bottom: 160, x: 0, y: 0, toJSON: () => ({}),
      });
    }

    fireEvent.touchStart(handle, { touches: [{ clientX: 100, clientY: 0 }], preventDefault: jest.fn() });
    fireEvent.touchMove(document, { touches: [{ clientX: 200, clientY: 80 }] });
    fireEvent.touchEnd(document);

    expect(onRotationChange).toHaveBeenCalled();
  });

  it('renders corner markers on panels', () => {
    const { container } = render(<FOVOverlay {...defaultProps} />);
    // Each panel has 4 corner markers with border styles
    const corners = container.querySelectorAll('.border-t-2.border-l-2');
    expect(corners.length).toBeGreaterThanOrEqual(1);
  });

  it('applies normalized frame placement as translate transform', () => {
    const { container } = render(
      <FOVOverlay
        {...(defaultProps as React.ComponentProps<typeof FOVOverlay> & Record<string, unknown>)}
        framePlacement={{ x: 0.5, y: -0.5 }}
      />
    );

    const frame = container.querySelector('[data-testid="fov-overlay-frame"]') as HTMLElement | null;
    expect(frame?.style.transform).toContain('translate(');
    expect(frame?.style.transform).toContain('rotate(0deg)');
  });

  it('emits frame placement changes when drag-to-position is enabled', () => {
    const onFramePlacementChange = jest.fn();
    const { container } = render(
      <FOVOverlay
        {...(defaultProps as React.ComponentProps<typeof FOVOverlay> & Record<string, unknown>)}
        dragToPosition
        framePlacement={{ x: 0, y: 0 }}
        onFramePlacementChange={onFramePlacementChange}
      />
    );

    const frame = container.querySelector('[data-testid="fov-overlay-frame"]') as HTMLElement;
    expect(frame).toBeInTheDocument();

    fireEvent.mouseDown(frame, { clientX: 100, clientY: 100, preventDefault: jest.fn() });
    fireEvent.mouseMove(document, { clientX: 140, clientY: 120 });
    fireEvent.mouseUp(document);

    expect(onFramePlacementChange).toHaveBeenCalled();
  });

  it('does not emit frame placement changes when drag-to-position is disabled', () => {
    const onFramePlacementChange = jest.fn();
    const { container } = render(
      <FOVOverlay
        {...(defaultProps as React.ComponentProps<typeof FOVOverlay> & Record<string, unknown>)}
        dragToPosition={false}
        framePlacement={{ x: 0, y: 0 }}
        onFramePlacementChange={onFramePlacementChange}
      />
    );

    const frame = container.querySelector('[data-testid="fov-overlay-frame"]') as HTMLElement;
    expect(frame).toBeInTheDocument();

    fireEvent.mouseDown(frame, { clientX: 100, clientY: 100, preventDefault: jest.fn() });
    fireEvent.mouseMove(document, { clientX: 140, clientY: 120 });
    fireEvent.mouseUp(document);

    expect(onFramePlacementChange).not.toHaveBeenCalled();
  });
});
