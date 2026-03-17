/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react';

// ---- Mount store mock ----
let mountState = {
  mountInfo: {
    Connected: true,
    Parked: false,
    Slewing: false,
  },
  capabilities: {
    canSync: false,
  },
  blockedActionReasons: {},
  activeTargetAction: null,
  latestCommandFailure: null,
  setActiveTargetAction: jest.fn(),
  clearActiveTargetAction: jest.fn(),
  setLatestCommandFailure: jest.fn(),
  clearLatestCommandFailure: jest.fn(),
  profileInfo: {
    AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 0 },
  },
  safetyConfig: {
    mountType: 'gem',
    hourAngleLimitEast: -90,
    hourAngleLimitWest: 90,
    declinationLimitMin: -85,
    declinationLimitMax: 85,
    minAltitude: 15,
    meridianFlip: {
      enabled: true,
      minutesAfterMeridian: 5,
      maxMinutesAfterMeridian: 15,
      pauseBeforeMeridian: 0,
    },
    telescopeLength: 500,
    counterweightBarLength: 300,
  },
};

jest.mock('@/lib/stores', () => ({
  useMountStore: (selector: (s: unknown) => unknown) => selector(mountState),
}));

jest.mock('@/lib/astronomy/mount-safety', () => ({
  checkTargetSafety: jest.fn(() => ({
    isSafe: true,
    issues: [],
    targetId: 'test',
    targetName: 'Test Target',
    ra: 180,
    dec: 45,
    startTime: new Date(),
    endTime: new Date(),
    pierSideAtStart: 'west',
    pierSideAtEnd: 'west',
    hourAngleAtStart: 0,
    hourAngleAtEnd: 0,
    minAltitude: 30,
    maxAltitude: 60,
    needsMeridianFlip: false,
    meridianFlipTime: null,
  })),
}));

jest.mock('@/lib/astronomy/starmap-utils', () => ({
  degreesToHMS: jest.fn(() => '12h 00m 00s'),
  degreesToDMS: jest.fn(() => '+45° 00\' 00"'),
}));

jest.mock('@/lib/tauri/mount-api', () => ({
  mountApi: {
    slewTo: jest.fn().mockResolvedValue(undefined),
    syncTo: jest.fn().mockResolvedValue(undefined),
    unpark: jest.fn().mockResolvedValue(undefined),
    abortSlew: jest.fn().mockResolvedValue(undefined),
    setTracking: jest.fn().mockResolvedValue(undefined),
    park: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/tauri/app-control-api', () => ({
  isTauri: jest.fn(() => true),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ---- UI component mocks ----
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled} data-disabled={disabled ? 'true' : 'false'} {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div data-testid="dialog-footer">{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

import { SlewConfirmDialog } from '../slew-confirm-dialog';

describe('SlewConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    targetName: 'M31',
    targetRa: 180,
    targetDec: 45,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { isTauri } = jest.requireMock('@/lib/tauri/app-control-api');
    isTauri.mockReturnValue(true);
    mountState = {
      mountInfo: { Connected: true, Parked: false, Slewing: false },
      capabilities: { canSync: false },
      blockedActionReasons: {},
      activeTargetAction: null,
      latestCommandFailure: null,
      setActiveTargetAction: jest.fn(),
      clearActiveTargetAction: jest.fn(),
      setLatestCommandFailure: jest.fn(),
      clearLatestCommandFailure: jest.fn(),
      profileInfo: {
        AstrometrySettings: { Latitude: 40, Longitude: -74, Elevation: 0 },
      },
      safetyConfig: {
        mountType: 'gem',
        hourAngleLimitEast: -90,
        hourAngleLimitWest: 90,
        declinationLimitMin: -85,
        declinationLimitMax: 85,
        minAltitude: 15,
        meridianFlip: {
          enabled: true,
          minutesAfterMeridian: 5,
          maxMinutesAfterMeridian: 15,
          pauseBeforeMeridian: 0,
        },
        telescopeLength: 500,
        counterweightBarLength: 300,
      },
    };
  });

  it('renders nothing when closed', () => {
    const { queryByTestId } = render(
      <SlewConfirmDialog {...defaultProps} open={false} />
    );
    expect(queryByTestId('dialog')).toBeNull();
  });

  it('renders dialog when open', () => {
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog')).toBeTruthy();
  });

  it('shows target name in dialog', () => {
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog').textContent).toContain('M31');
  });

  it('disables slew button when mount is not connected', () => {
    mountState.mountInfo.Connected = false;
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];
    expect(slewBtn.getAttribute('data-disabled')).toBe('true');
  });

  it('disables slew button when mount is parked', () => {
    mountState.mountInfo.Parked = true;
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];
    expect(slewBtn.getAttribute('data-disabled')).toBe('true');
  });

  it('enables slew button when connected and not parked', () => {
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];
    expect(slewBtn.getAttribute('data-disabled')).toBe('false');
  });

  it('slew button is enabled in initial state (slewing is local state)', () => {
    // The `slewing` flag is local useState(false), not from the store.
    // It only becomes true mid-handleSlew. So on initial render it's enabled.
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];
    expect(slewBtn.getAttribute('data-disabled')).toBe('false');
  });

  it('handleSlew calls slewTo, onSlewStarted, and closes dialog on success', async () => {
    const mockSlewStarted = jest.fn();
    const mockOnOpenChange = jest.fn();
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api');

    const { getByTestId } = render(
      <SlewConfirmDialog
        {...defaultProps}
        onOpenChange={mockOnOpenChange}
        onSlewStarted={mockSlewStarted}
      />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];

    await act(async () => {
      fireEvent.click(slewBtn);
    });

    await waitFor(() => {
      expect(mountApi.slewTo).toHaveBeenCalledWith(180, 45);
      expect(mockSlewStarted).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handleSlew shows error on failure', async () => {
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api');
    mountApi.slewTo.mockRejectedValueOnce(new Error('Slew failed'));

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];

    await act(async () => {
      fireEvent.click(slewBtn);
    });

    await waitFor(() => {
      expect(mountApi.slewTo).toHaveBeenCalled();
    });
    // Error message should appear in the dialog
    expect(getByTestId('dialog').textContent).toContain('Slew failed');
  });

  it('handleSlew does nothing when isTauri returns false', async () => {
    const { isTauri } = jest.requireMock('@/lib/tauri/app-control-api');
    isTauri.mockReturnValue(false);
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api');

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];

    await act(async () => {
      fireEvent.click(slewBtn);
    });

    expect(mountApi.slewTo).not.toHaveBeenCalled();
  });

  it('handleSlew does nothing when not connected', async () => {
    mountState.mountInfo.Connected = false;
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api');

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];

    await act(async () => {
      fireEvent.click(slewBtn);
    });

    expect(mountApi.slewTo).not.toHaveBeenCalled();
  });

  it('shows safety clear message when no issues', () => {
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog').textContent).toContain('safetyClear');
  });

  it('shows danger issues when safety check returns danger', () => {
    const { checkTargetSafety } = jest.requireMock('@/lib/astronomy/mount-safety');
    checkTargetSafety.mockReturnValue({
      isSafe: false,
      issues: [{ severity: 'danger', type: 'hour_angle_limit' }],
      targetId: 'test',
      targetName: 'Test',
      ra: 180,
      dec: 45,
      startTime: new Date(),
      endTime: new Date(),
      pierSideAtStart: 'west',
      pierSideAtEnd: 'west',
      hourAngleAtStart: 0,
      hourAngleAtEnd: 0,
      minAltitude: 30,
      maxAltitude: 60,
      needsMeridianFlip: false,
      meridianFlipTime: null,
    });

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog').textContent).toContain('safetyIssues.hour_angle_limit');
  });

  it('shows warning issues when safety check returns warning', () => {
    const { checkTargetSafety } = jest.requireMock('@/lib/astronomy/mount-safety');
    checkTargetSafety.mockReturnValue({
      isSafe: true,
      issues: [{ severity: 'warning', type: 'counterweight_up' }],
      targetId: 'test',
      targetName: 'Test',
      ra: 180,
      dec: 45,
      startTime: new Date(),
      endTime: new Date(),
      pierSideAtStart: 'west',
      pierSideAtEnd: 'west',
      hourAngleAtStart: 0,
      hourAngleAtEnd: 0,
      minAltitude: 30,
      maxAltitude: 60,
      needsMeridianFlip: false,
      meridianFlipTime: null,
    });

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog').textContent).toContain('safetyIssues.counterweight_up');
  });

  it('slew button text changes to slewAnyway when danger present', () => {
    const { checkTargetSafety } = jest.requireMock('@/lib/astronomy/mount-safety');
    checkTargetSafety.mockReturnValue({
      isSafe: false,
      issues: [{ severity: 'danger', type: 'below_horizon' }],
      targetId: 'test',
      targetName: 'Test',
      ra: 180,
      dec: 45,
      startTime: new Date(),
      endTime: new Date(),
      pierSideAtStart: 'west',
      pierSideAtEnd: 'west',
      hourAngleAtStart: 0,
      hourAngleAtEnd: 0,
      minAltitude: -5,
      maxAltitude: 60,
      needsMeridianFlip: false,
      meridianFlipTime: null,
    });

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const footer = getByTestId('dialog-footer');
    const slewBtn = footer.querySelectorAll('button')[1];
    expect(slewBtn.textContent).toContain('slewAnyway');
  });

  it('shows parked warning when mount is parked', () => {
    mountState.mountInfo.Parked = true;
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog').textContent).toContain('mountParkedWarning');
  });

  it('shows not connected warning when mount is disconnected', () => {
    mountState.mountInfo.Connected = false;
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    expect(getByTestId('dialog').textContent).toContain('notConnectedWarning');
  });

  it('displays RA/Dec coordinates in the dialog', () => {
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );
    const dialog = getByTestId('dialog');
    expect(dialog.textContent).toContain('12h 00m 00s');
    expect(dialog.textContent).toContain('+45° 00\' 00"');
  });

  it('cancel button calls onOpenChange(false)', () => {
    const mockOnOpenChange = jest.fn();
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} onOpenChange={mockOnOpenChange} />
    );
    const footer = getByTestId('dialog-footer');
    const cancelBtn = footer.querySelectorAll('button')[0];

    fireEvent.click(cancelBtn);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows sync action when the active mount supports sync', () => {
    mountState.capabilities.canSync = true;
    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} />
    );

    expect(getByTestId('dialog').textContent).toContain('syncMount');
  });

  it('executes sync through mountApi.syncTo when the sync action is chosen', async () => {
    mountState.capabilities.canSync = true;
    const { mountApi } = jest.requireMock('@/lib/tauri/mount-api');
    const mockOnOpenChange = jest.fn();

    const { getByTestId } = render(
      <SlewConfirmDialog {...defaultProps} onOpenChange={mockOnOpenChange} />
    );
    const footer = getByTestId('dialog-footer');
    const syncBtn = Array.from(footer.querySelectorAll('button')).find((button) => (
      button.textContent?.includes('syncMount')
    ));

    expect(syncBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(syncBtn!);
    });

    await waitFor(() => {
      expect(mountApi.syncTo).toHaveBeenCalledWith(180, 45);
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
