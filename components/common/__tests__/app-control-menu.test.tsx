/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AppControlMenu } from '../app-control-menu';
import { TooltipProvider } from '@/components/ui/tooltip';

jest.mock('@/components/ui/dropdown-menu', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  const Wrapper = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const Content = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const Item = ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type="button" onClick={onClick}>{children}</button>
  );
  const Trigger = ({ children }: { children: React.ReactElement }) => React.cloneElement(children, {
    'aria-haspopup': 'menu',
    'aria-expanded': 'false',
  } as React.HTMLAttributes<HTMLElement>);

  return {
    DropdownMenu: Wrapper,
    DropdownMenuContent: Content,
    DropdownMenuItem: Item,
    DropdownMenuLabel: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuSub: Wrapper,
    DropdownMenuSubContent: Content,
    DropdownMenuSubTrigger: Item,
    DropdownMenuTrigger: Trigger,
  };
});

// Mock next-intl's useTranslations
jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) => namespace ? `${namespace}.${key}` : key,
}));

// Mock the app-control-api
const mockCloseWindow = jest.fn();
const mockMinimizeWindow = jest.fn();
const mockToggleMaximizeWindow = jest.fn();
const mockIsWindowMaximized = jest.fn();
const mockToggleFullscreen = jest.fn();
const mockRestartApp = jest.fn();
const mockQuitApp = jest.fn();
const mockReloadWebview = jest.fn();
const mockIsTauri = jest.fn();
const mockSetAlwaysOnTop = jest.fn();
const mockIsAlwaysOnTop = jest.fn();
const mockSaveWindowState = jest.fn();
const mockCenterWindow = jest.fn();
const mockShowWindow = jest.fn();
const mockHideWindow = jest.fn();
const mockUnminimizeWindow = jest.fn();
const mockFocusWindow = jest.fn();
const mockIsWindowVisible = jest.fn();
const mockIsWindowMinimized = jest.fn();
const mockIsTrayPositioningReady = jest.fn();
const mockListenForTrayActivation = jest.fn();
const mockGetDesktopShell = jest.fn();
const mockStartWindowDragging = jest.fn();

jest.mock('@/lib/tauri/app-control-api', () => ({
  closeWindow: () => mockCloseWindow(),
  minimizeWindow: () => mockMinimizeWindow(),
  toggleMaximizeWindow: () => mockToggleMaximizeWindow(),
  isWindowMaximized: () => mockIsWindowMaximized(),
  toggleFullscreen: () => mockToggleFullscreen(),
  restartApp: () => mockRestartApp(),
  quitApp: () => mockQuitApp(),
  reloadWebview: () => mockReloadWebview(),
  isTauri: () => mockIsTauri(),
  setAlwaysOnTop: (value: boolean) => mockSetAlwaysOnTop(value),
  isAlwaysOnTop: () => mockIsAlwaysOnTop(),
  saveWindowState: () => mockSaveWindowState(),
  centerWindow: () => mockCenterWindow(),
  showWindow: () => mockShowWindow(),
  hideWindow: () => mockHideWindow(),
  unminimizeWindow: () => mockUnminimizeWindow(),
  focusWindow: () => mockFocusWindow(),
  isWindowVisible: () => mockIsWindowVisible(),
  isWindowMinimized: () => mockIsWindowMinimized(),
  isTrayPositioningReady: () => mockIsTrayPositioningReady(),
  listenForTrayActivation: (...args: unknown[]) => mockListenForTrayActivation(...args),
  getDesktopShell: () => mockGetDesktopShell(),
  startWindowDragging: () => mockStartWindowDragging(),
}));

async function flushWindowControlEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

const renderWithProviders = async (ui: React.ReactElement) => {
  const rendered = render(
    <TooltipProvider>
      {ui}
    </TooltipProvider>
  );
  await flushWindowControlEffects();
  return rendered;
};

describe('AppControlMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(true);
    mockIsWindowMaximized.mockResolvedValue(false);
    mockIsAlwaysOnTop.mockResolvedValue(false);
    mockSaveWindowState.mockResolvedValue(undefined);
    mockShowWindow.mockResolvedValue(undefined);
    mockHideWindow.mockResolvedValue(undefined);
    mockUnminimizeWindow.mockResolvedValue(undefined);
    mockFocusWindow.mockResolvedValue(undefined);
    mockIsWindowVisible.mockResolvedValue(true);
    mockIsWindowMinimized.mockResolvedValue(false);
    mockIsTrayPositioningReady.mockResolvedValue(false);
    mockListenForTrayActivation.mockResolvedValue(() => {});
    mockGetDesktopShell.mockResolvedValue({
      platform: 'windows',
      mode: 'custom-frameless',
      dragStrategy: 'manual',
      showsNativeWindowControls: false,
      supportsManualDragging: true,
      supportsDoubleClickMaximize: true,
      titlebarInsets: { left: 12, right: 12, top: 0 },
    });
  });

  describe('dropdown variant', () => {
    it('renders dropdown trigger button', async () => {
      await renderWithProviders(<AppControlMenu variant="dropdown" />);
      const trigger = screen.getByLabelText('appControl.appControls');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute('aria-label', 'appControl.appControls');
    });

    it('renders trigger with correct aria attributes', async () => {
      await renderWithProviders(<AppControlMenu variant="dropdown" />);
      const trigger = screen.getByLabelText('appControl.appControls');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('hides tray positioning controls until tray support is ready', async () => {
      await renderWithProviders(<AppControlMenu variant="dropdown" />);

      await waitFor(() => {
        expect(screen.getByText('appControl.screenPositions')).toBeInTheDocument();
      });

      expect(screen.queryByText('appControl.trayPositions')).not.toBeInTheDocument();
    });

    it('does not duplicate native window controls in macOS overlay shell mode', async () => {
      mockGetDesktopShell.mockResolvedValue({
        platform: 'macos',
        mode: 'native-overlay',
        dragStrategy: 'manual',
        showsNativeWindowControls: true,
        supportsManualDragging: true,
        supportsDoubleClickMaximize: true,
        titlebarInsets: { left: 72, right: 12, top: 0 },
      });

      await renderWithProviders(<AppControlMenu variant="dropdown" />);

      await waitFor(() => {
        expect(screen.getByText('appControl.reload')).toBeInTheDocument();
      });

      expect(screen.queryByText('appControl.minimize')).not.toBeInTheDocument();
      expect(screen.queryByText('appControl.maximize')).not.toBeInTheDocument();
      expect(screen.queryByText('appControl.close')).not.toBeInTheDocument();
    });

  });

  describe('inline variant', () => {
    it('renders Tauri controls correctly', async () => {
      await renderWithProviders(<AppControlMenu variant="inline" />);

      await waitFor(() => {
        // Tauri inline variant shows: pinWindow, minimize, maximize, fullscreen, close
        expect(screen.getByLabelText('appControl.pinWindow')).toBeInTheDocument();
        expect(screen.getByLabelText('appControl.minimize')).toBeInTheDocument();
        expect(screen.getByLabelText('appControl.maximize')).toBeInTheDocument();
        expect(screen.getByLabelText('appControl.fullscreen')).toBeInTheDocument();
        expect(screen.getByLabelText('appControl.close')).toBeInTheDocument();
      });
    });

    it('renders Web controls correctly when not in Tauri', async () => {
      mockIsTauri.mockReturnValue(false);
      await renderWithProviders(<AppControlMenu variant="inline" />);
      
      // Component starts with isTauriEnv = false when isTauri() returns false
      // Since isTauri() returns false synchronously, web controls show immediately
      await waitFor(() => {
        expect(screen.getByLabelText('appControl.reload')).toBeInTheDocument();
        expect(screen.getByLabelText('appControl.fullscreen')).toBeInTheDocument();
      });
    });

    it('calls minimize on Tauri environment', async () => {
      await renderWithProviders(<AppControlMenu variant="inline" />);

      const minimizeBtn = await screen.findByLabelText('appControl.minimize');
      fireEvent.click(minimizeBtn);
      expect(mockMinimizeWindow).toHaveBeenCalled();
    });

    it('calls toggleFullscreen', async () => {
      await renderWithProviders(<AppControlMenu variant="inline" />);

      const fullscreenBtn = await screen.findByLabelText('appControl.fullscreen');
      await act(async () => {
        fireEvent.click(fullscreenBtn);
      });
      expect(mockToggleFullscreen).toHaveBeenCalled();
    });
  });

  it('updates state on window resize in Tauri environment', async () => {
    await renderWithProviders(<AppControlMenu variant="inline" />);

    await waitFor(() => {
      expect(screen.getByLabelText('appControl.maximize')).toBeInTheDocument();
    });

    mockIsWindowMaximized.mockResolvedValue(true);
    
    await act(async () => {
      fireEvent(window, new Event('resize'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText('appControl.restore')).toBeInTheDocument();
    });
  });
});
