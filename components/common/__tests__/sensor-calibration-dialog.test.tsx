/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SensorCalibrationDialog } from '../sensor-calibration-dialog';

let mockActionDefaultPrevented = false;

jest.mock('@/components/ui/alert-dialog', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  interface DialogContextValue {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
  }

  const DialogContext = React.createContext<DialogContextValue>({ open: false });

  return {
    AlertDialog: ({
      open,
      onOpenChange,
      children,
    }: React.PropsWithChildren<{
      open: boolean;
      onOpenChange?: (open: boolean) => void;
    }>) => (
      <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
    ),
    AlertDialogContent: ({ children }: React.PropsWithChildren) => {
      const context = React.useContext(DialogContext);
      return context.open ? <div data-testid="sensor-calibration-dialog">{children}</div> : null;
    },
    AlertDialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
    AlertDialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
    AlertDialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    AlertDialogCancel: ({ children }: React.PropsWithChildren) => {
      const context = React.useContext(DialogContext);

      return (
        <button type="button" onClick={() => context.onOpenChange?.(false)}>
          {children}
        </button>
      );
    },
    AlertDialogAction: ({
      children,
      onClick,
    }: React.PropsWithChildren<{
      onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    }>) => (
      <button
        type="button"
        onClick={(event) => {
          mockActionDefaultPrevented = false;
          onClick?.(event);
          mockActionDefaultPrevented = event.defaultPrevented;
        }}
      >
        {children}
      </button>
    ),
  };
});

describe('SensorCalibrationDialog', () => {
  beforeEach(() => {
    mockActionDefaultPrevented = false;
  });

  it('does not render dialog content when closed', () => {
    render(
      <SensorCalibrationDialog open={false} onOpenChange={jest.fn()} onCalibrate={jest.fn()} />
    );

    expect(screen.queryByTestId('sensor-calibration-dialog')).not.toBeInTheDocument();
  });

  it('renders translated calibration guidance when open', () => {
    render(
      <SensorCalibrationDialog open={true} onOpenChange={jest.fn()} onCalibrate={jest.fn()} />
    );

    expect(screen.getByText('settings.sensorCalibrationRequired')).toBeInTheDocument();
    expect(screen.getByText('settings.sensorCalibrationDescription')).toBeInTheDocument();
    expect(screen.getByText('common.cancel')).toBeInTheDocument();
    expect(screen.getByText('settings.sensorCalibrateNow')).toBeInTheDocument();
  });

  it('closes the dialog when cancel is clicked', () => {
    const mockOnOpenChange = jest.fn();

    render(
      <SensorCalibrationDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        onCalibrate={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('common.cancel'));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('prevents the default dialog action and starts calibration', () => {
    const mockOnCalibrate = jest.fn();

    render(
      <SensorCalibrationDialog
        open={true}
        onOpenChange={jest.fn()}
        onCalibrate={mockOnCalibrate}
      />
    );

    fireEvent.click(screen.getByText('settings.sensorCalibrateNow'));

    expect(mockOnCalibrate).toHaveBeenCalledTimes(1);
    expect(mockActionDefaultPrevented).toBe(true);
  });
});
