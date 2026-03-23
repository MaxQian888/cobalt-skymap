/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

type ShortcutActionId =
  | 'FOCUS_MAIN_WINDOW'
  | 'TOGGLE_SEARCH'
  | 'TOGGLE_SESSION_PANEL'
  | 'MOUNT_ABORT_SLEW';

const mockTranslate = (key: string, values?: Record<string, unknown>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

const mockDefaultBindings: Record<ShortcutActionId, string> = {
  FOCUS_MAIN_WINDOW: 'CommandOrControl+Shift+Space',
  TOGGLE_SEARCH: 'CommandOrControl+Shift+F',
  TOGGLE_SESSION_PANEL: 'CommandOrControl+Shift+P',
  MOUNT_ABORT_SLEW: 'CommandOrControl+Alt+Shift+X',
};

const mockEventToGlobalShortcutAccelerator = jest.fn<string | null, [KeyboardEvent]>();
const mockFindConflictWithLocalKeybindings = jest.fn<string | null, [string, Record<string, unknown>]>();
const mockFormatGlobalShortcutAccelerator = jest.fn((accelerator: string) => `formatted:${accelerator}`);

type MockGlobalShortcutState = {
  enabled: boolean;
  customBindings: Partial<Record<ShortcutActionId, string>>;
  registrationErrors: Partial<Record<ShortcutActionId, string>>;
  setEnabled: jest.Mock;
  getBinding: jest.Mock;
  setBinding: jest.Mock;
  resetBinding: jest.Mock;
  resetAllBindings: jest.Mock;
  isCustom: jest.Mock;
  clearRegistrationError: jest.Mock;
};

const mockGlobalShortcutState: MockGlobalShortcutState = {
  enabled: false,
  customBindings: {} as Partial<Record<ShortcutActionId, string>>,
  registrationErrors: {} as Partial<Record<ShortcutActionId, string>>,
  setEnabled: jest.fn(),
  getBinding: jest.fn(),
  setBinding: jest.fn(),
  resetBinding: jest.fn(),
  resetAllBindings: jest.fn(),
  isCustom: jest.fn(),
  clearRegistrationError: jest.fn(),
};

mockGlobalShortcutState.getBinding.mockImplementation(
  (actionId: ShortcutActionId) => mockGlobalShortcutState.customBindings[actionId] ?? mockDefaultBindings[actionId]
);
mockGlobalShortcutState.isCustom.mockImplementation(
  (actionId: ShortcutActionId) => actionId in mockGlobalShortcutState.customBindings
);

const mockKeybindingState = {
  customBindings: {} as Record<string, unknown>,
};

jest.mock('next-intl', () => ({
  useTranslations: () => mockTranslate,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
  }) => (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
    >
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

jest.mock('../settings-shared', () => ({
  SettingsSection: ({
    children,
    title,
  }: React.PropsWithChildren<{ title: string }>) => (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  ),
}));

jest.mock('@/lib/stores', () => ({
  DEFAULT_KEYBINDINGS: {
    TOGGLE_SEARCH: { key: 'f', ctrl: true },
    TOGGLE_SESSION_PANEL: { key: 'p' },
    TOGGLE_GRID: { key: 'g' },
  },
  eventToGlobalShortcutAccelerator: (event: KeyboardEvent) => mockEventToGlobalShortcutAccelerator(event),
  findConflictWithLocalKeybindings: (accelerator: string, keybindings: Record<string, unknown>) => (
    mockFindConflictWithLocalKeybindings(accelerator, keybindings)
  ),
  formatGlobalShortcutAccelerator: (accelerator: string) => mockFormatGlobalShortcutAccelerator(accelerator),
  useGlobalShortcutStore: (selector: (state: typeof mockGlobalShortcutState) => unknown) => selector(mockGlobalShortcutState),
  useKeybindingStore: (selector: (state: typeof mockKeybindingState) => unknown) => selector(mockKeybindingState),
}));

import { GlobalShortcutSettings } from '../global-shortcut-settings';

function resetShortcutState() {
  mockGlobalShortcutState.enabled = false;
  mockGlobalShortcutState.customBindings = {};
  mockGlobalShortcutState.registrationErrors = {};
  mockKeybindingState.customBindings = {};
  mockEventToGlobalShortcutAccelerator.mockReturnValue('Control+Shift+K');
  mockFindConflictWithLocalKeybindings.mockReturnValue(null);
  mockGlobalShortcutState.setBinding.mockReturnValue({
    ok: true,
    normalized: 'Control+Shift+K',
    error: null,
    conflictWith: null,
  });
}

describe('GlobalShortcutSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetShortcutState();
  });

  it('renders default bindings, disabled hint, and enables shortcuts from the switch', () => {
    render(<GlobalShortcutSettings />);

    expect(screen.getByText('settingsNew.globalShortcuts.title')).toBeInTheDocument();
    expect(screen.getByText('settingsNew.globalShortcuts.disabledHint')).toBeInTheDocument();
    expect(screen.getByText('formatted:CommandOrControl+Shift+Space')).toBeDisabled();
    expect(screen.getByText('formatted:CommandOrControl+Shift+F')).toBeDisabled();
    expect(screen.queryByText('settingsNew.globalShortcuts.resetAll')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch'));

    expect(mockGlobalShortcutState.setEnabled).toHaveBeenCalledWith(true);
  });

  it('shows custom shortcut count and resets all custom bindings', () => {
    mockGlobalShortcutState.enabled = true;
    mockGlobalShortcutState.customBindings = {
      TOGGLE_SEARCH: 'Control+Shift+K',
    };

    render(<GlobalShortcutSettings />);

    expect(screen.getByText('settingsNew.globalShortcuts.resetAll')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('settingsNew.globalShortcuts.resetAll'));

    expect(mockGlobalShortcutState.resetAllBindings).toHaveBeenCalledTimes(1);
  });

  it('shows an invalid shortcut error when recording captures no accelerator', () => {
    mockGlobalShortcutState.enabled = true;
    mockEventToGlobalShortcutAccelerator.mockReturnValue(null);

    render(<GlobalShortcutSettings />);

    fireEvent.click(screen.getByText('formatted:CommandOrControl+Shift+F'));
    fireEvent.keyDown(screen.getByText('settingsNew.globalShortcuts.recording'), {
      key: 'Shift',
      code: 'ShiftLeft',
    });

    expect(screen.getByText('settingsNew.globalShortcuts.errors.invalidShortcut')).toBeInTheDocument();
    expect(mockGlobalShortcutState.setBinding).not.toHaveBeenCalled();
  });

  it('shows a local-conflict error before saving a shortcut', () => {
    mockGlobalShortcutState.enabled = true;
    mockFindConflictWithLocalKeybindings.mockReturnValue('TOGGLE_SEARCH');

    render(<GlobalShortcutSettings />);

    fireEvent.click(screen.getByText('formatted:CommandOrControl+Shift+P'));
    fireEvent.keyDown(screen.getByText('settingsNew.globalShortcuts.recording'), {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(
      screen.getByText('settingsNew.globalShortcuts.errors.localConflict:{"action":"TOGGLE_SEARCH"}')
    ).toBeInTheDocument();
    expect(mockGlobalShortcutState.setBinding).not.toHaveBeenCalled();
  });

  it('shows a global-conflict error when the store rejects a binding', () => {
    mockGlobalShortcutState.enabled = true;
    mockGlobalShortcutState.setBinding.mockReturnValue({
      ok: false,
      normalized: 'Control+Shift+F',
      error: 'Shortcut already assigned to another global action',
      conflictWith: 'TOGGLE_SEARCH',
    });

    render(<GlobalShortcutSettings />);

    fireEvent.click(screen.getByText('formatted:CommandOrControl+Shift+P'));
    fireEvent.keyDown(screen.getByText('settingsNew.globalShortcuts.recording'), {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(
      screen.getByText('settingsNew.globalShortcuts.errors.globalConflict:{"action":"TOGGLE_SEARCH"}')
    ).toBeInTheDocument();
  });

  it('records a shortcut, clears runtime errors, and exits recording mode on success', () => {
    mockGlobalShortcutState.enabled = true;
    mockGlobalShortcutState.registrationErrors = {
      TOGGLE_SEARCH: 'shortcut already taken',
    };

    render(<GlobalShortcutSettings />);

    expect(screen.getByText('shortcut already taken')).toBeInTheDocument();

    fireEvent.click(screen.getByText('formatted:CommandOrControl+Shift+F'));
    fireEvent.keyDown(screen.getByText('settingsNew.globalShortcuts.recording'), {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(mockGlobalShortcutState.setBinding).toHaveBeenCalledWith('TOGGLE_SEARCH', 'Control+Shift+K');
    expect(mockGlobalShortcutState.clearRegistrationError).toHaveBeenCalledWith('TOGGLE_SEARCH');
    expect(screen.queryByText('settingsNew.globalShortcuts.recording')).not.toBeInTheDocument();
  });

  it('resets a custom binding from its row action', () => {
    mockGlobalShortcutState.enabled = true;
    mockGlobalShortcutState.customBindings = {
      TOGGLE_SEARCH: 'Control+Shift+K',
    };
    mockGlobalShortcutState.registrationErrors = {
      TOGGLE_SEARCH: 'shortcut already taken',
    };

    render(<GlobalShortcutSettings />);

    const searchRow = screen
      .getByText('settingsNew.globalShortcuts.actions.toggleSearch')
      .closest('div.space-y-1');

    expect(searchRow).not.toBeNull();

    const buttons = within(searchRow as HTMLElement).getAllByRole('button');
    fireEvent.click(buttons[1]);

    expect(mockGlobalShortcutState.resetBinding).toHaveBeenCalledWith('TOGGLE_SEARCH');
    expect(mockGlobalShortcutState.clearRegistrationError).toHaveBeenCalledWith('TOGGLE_SEARCH');
  });
});
