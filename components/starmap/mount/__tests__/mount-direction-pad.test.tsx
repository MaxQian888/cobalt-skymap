/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react';

// ---- Mount store mock ----
let mountState = {
  mountInfo: {
    Connected: true,
    SlewRateIndex: 1,
    Parked: false,
  },
  capabilities: {
    canMoveAxis: true,
  },
  actionAvailability: {
    moveAxis: true,
  },
};

const mockSetMountInfo = jest.fn();

// Must define the mock inline to avoid hoisting issues with jest.mock
jest.mock('@/lib/stores', () => {
  const store = (selector: (s: unknown) => unknown) => selector(mountState);
  store.getState = () => ({ setMountInfo: mockSetMountInfo });
  return { useMountStore: store };
});

// ---- Tauri API mock ----
const mockMoveAxis = jest.fn().mockResolvedValue(undefined);
const mockStopAxis = jest.fn().mockResolvedValue(undefined);
const mockSetSlewRate = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/tauri/mount-api', () => ({
  mountApi: {
    moveAxis: (...args: unknown[]) => mockMoveAxis(...args),
    stopAxis: (...args: unknown[]) => mockStopAxis(...args),
    setSlewRate: (...args: unknown[]) => mockSetSlewRate(...args),
  },
  SLEW_RATE_PRESETS: [
    { label: '1x', value: 1 },
    { label: '16x', value: 16 },
  ],
}));

const mockIsTauri = jest.fn(() => true);
jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

// ---- UI component mocks ----
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}));

let capturedOnValueChange: ((value: string) => void) | undefined;
jest.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange?: (v: string) => void }) => {
    capturedOnValueChange = onValueChange;
    return <div>{children}</div>;
  },
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <span />,
}));

import { MountDirectionPad } from '../mount-direction-pad';

describe('MountDirectionPad', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mountState = {
      mountInfo: { Connected: true, SlewRateIndex: 1, Parked: false },
      capabilities: { canMoveAxis: true },
      actionAvailability: { moveAxis: true },
    };
  });

  it('renders direction buttons with correct aria labels', () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    expect(getByLabelText('north')).toBeTruthy();
    expect(getByLabelText('south')).toBeTruthy();
    expect(getByLabelText('east')).toBeTruthy();
    expect(getByLabelText('west')).toBeTruthy();
    expect(getByLabelText('stop')).toBeTruthy();
  });

  it('calls moveAxis on pointerDown and stopAxis on pointerUp', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    expect(mockMoveAxis).toHaveBeenCalledWith('secondary', 16);

    await act(async () => {
      fireEvent.pointerUp(northBtn);
    });
    expect(mockStopAxis).toHaveBeenCalledWith('secondary');
  });

  it('calls stopAxis on pointerLeave', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const eastBtn = getByLabelText('east');

    await act(async () => {
      fireEvent.pointerDown(eastBtn);
    });

    await act(async () => {
      fireEvent.pointerLeave(eastBtn);
    });
    expect(mockStopAxis).toHaveBeenCalledWith('primary');
  });

  it('calls stopAxis on pointerCancel (touch safety)', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const westBtn = getByLabelText('west');

    await act(async () => {
      fireEvent.pointerDown(westBtn);
    });

    await act(async () => {
      fireEvent.pointerCancel(westBtn);
    });
    expect(mockStopAxis).toHaveBeenCalledWith('primary');
  });

  it('stops motion on global window pointerup (safety net)', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const southBtn = getByLabelText('south');

    await act(async () => {
      fireEvent.pointerDown(southBtn);
    });
    mockStopAxis.mockClear();

    await act(async () => {
      fireEvent(window, new Event('pointerup'));
    });
    expect(mockStopAxis).toHaveBeenCalledWith('secondary');
  });

  it('stops motion on window blur (safety net)', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    mockStopAxis.mockClear();

    await act(async () => {
      fireEvent(window, new Event('blur'));
    });
    expect(mockStopAxis).toHaveBeenCalledWith('secondary');
  });

  it('does not call moveAxis when disabled (parked)', async () => {
    mountState.mountInfo.Parked = true;
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    expect(mockMoveAxis).not.toHaveBeenCalled();
  });

  it('does not call moveAxis when disconnected', async () => {
    mountState.mountInfo.Connected = false;
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    expect(mockMoveAxis).not.toHaveBeenCalled();
  });

  it('stopAll button stops both axes', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const stopBtn = getByLabelText('stop');

    await act(async () => {
      fireEvent.click(stopBtn);
    });
    expect(mockStopAxis).toHaveBeenCalledWith('primary');
    expect(mockStopAxis).toHaveBeenCalledWith('secondary');
  });

  it('cleans up global listeners and stops axes on unmount', async () => {
    const { getByLabelText, unmount } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    mockStopAxis.mockClear();

    unmount();
    expect(mockStopAxis).toHaveBeenCalledWith('primary');
    expect(mockStopAxis).toHaveBeenCalledWith('secondary');
  });

  it('west button calls moveAxis with primary axis and negative rate', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const westBtn = getByLabelText('west');

    await act(async () => {
      fireEvent.pointerDown(westBtn);
    });
    expect(mockMoveAxis).toHaveBeenCalledWith('primary', -16);
  });

  it('south button calls moveAxis with secondary axis and negative rate', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const southBtn = getByLabelText('south');

    await act(async () => {
      fireEvent.pointerDown(southBtn);
    });
    expect(mockMoveAxis).toHaveBeenCalledWith('secondary', -16);
  });

  it('east button calls moveAxis with primary axis and positive rate', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const eastBtn = getByLabelText('east');

    await act(async () => {
      fireEvent.pointerDown(eastBtn);
    });
    expect(mockMoveAxis).toHaveBeenCalledWith('primary', 16);
  });

  it('does not call moveAxis when canMoveAxis is false', async () => {
    mountState.capabilities.canMoveAxis = false;
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    expect(mockMoveAxis).not.toHaveBeenCalled();
  });

  it('does not call moveAxis when shared action availability disables axis motion', async () => {
    mountState.actionAvailability.moveAxis = false;
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    expect(mockMoveAxis).not.toHaveBeenCalled();
  });

  it('shows toast error when moveAxis fails', async () => {
    const { toast } = jest.requireMock('sonner');
    mockMoveAxis.mockRejectedValueOnce(new Error('Axis error'));

    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });

    expect(mockMoveAxis).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Axis error');
  });

  it('stopMove is no-op when no motion is active', async () => {
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    // Trigger pointerUp without prior pointerDown — movingRef should be null
    await act(async () => {
      fireEvent.pointerUp(northBtn);
    });
    expect(mockStopAxis).not.toHaveBeenCalled();
  });

  it('handleRateChange calls setSlewRate and setMountInfo', async () => {
    render(<MountDirectionPad />);
    expect(capturedOnValueChange).toBeDefined();

    await act(async () => {
      capturedOnValueChange!('0');
    });

    expect(mockSetSlewRate).toHaveBeenCalledWith(0);
    expect(mockSetMountInfo).toHaveBeenCalledWith({ SlewRateIndex: 0 });
  });

  it('handleRateChange shows toast on error', async () => {
    const { toast } = jest.requireMock('sonner');
    mockSetSlewRate.mockRejectedValueOnce(new Error('Rate failed'));

    render(<MountDirectionPad />);
    expect(capturedOnValueChange).toBeDefined();

    await act(async () => {
      capturedOnValueChange!('1');
    });

    expect(mockSetSlewRate).toHaveBeenCalledWith(1);
    expect(toast.error).toHaveBeenCalledWith('Rate failed');
  });

  it('handleRateChange does nothing when isTauri is false', async () => {
    mockIsTauri.mockReturnValue(false);

    render(<MountDirectionPad />);
    expect(capturedOnValueChange).toBeDefined();

    await act(async () => {
      capturedOnValueChange!('0');
    });

    expect(mockSetSlewRate).not.toHaveBeenCalled();
  });

  it('uses correct slew rate from SlewRateIndex', async () => {
    mountState.mountInfo.SlewRateIndex = 0; // 1x rate
    const { getByLabelText } = render(<MountDirectionPad />);
    const northBtn = getByLabelText('north');

    await act(async () => {
      fireEvent.pointerDown(northBtn);
    });
    expect(mockMoveAxis).toHaveBeenCalledWith('secondary', 1);
  });
});
