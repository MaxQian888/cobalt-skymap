/**
 * Tests for use-window-controls.ts
 * Window state and control actions
 */

import { act, renderHook } from '@testing-library/react';
import { useWindowControls } from '../use-window-controls';

const mockIsTauri = jest.fn(() => false);

jest.mock('@/lib/tauri/app-control-api', () => ({
  closeWindow: jest.fn(),
  minimizeWindow: jest.fn(),
  toggleMaximizeWindow: jest.fn(),
  isWindowMaximized: jest.fn(() => Promise.resolve(false)),
  toggleFullscreen: jest.fn(),
  restartApp: jest.fn(),
  quitApp: jest.fn(),
  reloadWebview: jest.fn(),
  isTauri: () => mockIsTauri(),
  setAlwaysOnTop: jest.fn(),
  isAlwaysOnTop: jest.fn(() => Promise.resolve(false)),
  saveWindowState: jest.fn(() => Promise.resolve()),
  centerWindow: jest.fn(),
  showWindow: jest.fn(() => Promise.resolve()),
  hideWindow: jest.fn(() => Promise.resolve()),
  unminimizeWindow: jest.fn(() => Promise.resolve()),
  focusWindow: jest.fn(() => Promise.resolve()),
  isWindowVisible: jest.fn(() => Promise.resolve(true)),
  isWindowMinimized: jest.fn(() => Promise.resolve(false)),
  isTrayPositioningReady: jest.fn(() => Promise.resolve(false)),
  listenForTrayActivation: jest.fn(() => Promise.resolve(() => {})),
  startWindowDragging: jest.fn(() => Promise.resolve()),
  startWindowResizeDragging: jest.fn(() => Promise.resolve()),
  getDesktopShell: jest.fn(() =>
    Promise.resolve({
      platform: 'web',
      mode: 'browser',
      dragStrategy: 'none',
      showsNativeWindowControls: false,
      supportsManualDragging: false,
      supportsDoubleClickMaximize: false,
      titlebarInsets: { left: 0, right: 0, top: 0 },
    })
  ),
}));

const mockMoveToPreset = jest.fn();
jest.mock('@/lib/tauri/positioner-api', () => ({
  TRAY_REVEAL_PRESET: 'TrayCenter',
  positionerApi: {
    moveToPreset: (preset: unknown) => mockMoveToPreset(preset),
    isTrayPositionPreset: (preset: string) => preset.startsWith('Tray'),
  },
}));

import {
  centerWindow,
  focusWindow,
  getDesktopShell,
  isTrayPositioningReady,
  listenForTrayActivation,
  restartApp,
  saveWindowState,
  showWindow,
  startWindowDragging,
  startWindowResizeDragging,
  unminimizeWindow,
} from '@/lib/tauri/app-control-api';

const mockCenterWindow = centerWindow as jest.Mock;
const mockShowWindow = showWindow as jest.Mock;
const mockUnminimizeWindow = unminimizeWindow as jest.Mock;
const mockFocusWindow = focusWindow as jest.Mock;
const mockIsTrayPositioningReady = isTrayPositioningReady as jest.Mock;
const mockListenForTrayActivation = listenForTrayActivation as jest.Mock;
const mockStartWindowDragging = startWindowDragging as jest.Mock;
const mockStartWindowResizeDragging = startWindowResizeDragging as jest.Mock;
const mockGetDesktopShell = getDesktopShell as jest.Mock;
const mockRestartApp = restartApp as jest.Mock;
const mockSaveWindowState = saveWindowState as jest.Mock;

describe('useWindowControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    mockMoveToPreset.mockResolvedValue({ moved: true, usedFallback: false });
    mockIsTrayPositioningReady.mockResolvedValue(false);
    mockListenForTrayActivation.mockResolvedValue(() => {});
    mockGetDesktopShell.mockResolvedValue({
      platform: 'web',
      mode: 'browser',
      dragStrategy: 'none',
      showsNativeWindowControls: false,
      supportsManualDragging: false,
      supportsDoubleClickMaximize: false,
      titlebarInsets: { left: 0, right: 0, top: 0 },
    });
  });

  it('should return initial state for non-Tauri env', () => {
    const { result } = renderHook(() => useWindowControls());
    expect(result.current.isTauriEnv).toBe(false);
    expect(result.current.isMaximized).toBe(false);
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.isPinned).toBe(false);
    expect(result.current.shell.mode).toBe('browser');
  });

  it('should provide all action handlers', () => {
    const { result } = renderHook(() => useWindowControls());
    expect(typeof result.current.handleMinimize).toBe('function');
    expect(typeof result.current.handleMaximize).toBe('function');
    expect(typeof result.current.handleClose).toBe('function');
    expect(typeof result.current.handleCloseWithSave).toBe('function');
    expect(typeof result.current.handleRestart).toBe('function');
    expect(typeof result.current.handleQuit).toBe('function');
    expect(typeof result.current.handleQuitWithSave).toBe('function');
    expect(typeof result.current.handleReload).toBe('function');
    expect(typeof result.current.handleToggleFullscreen).toBe('function');
    expect(typeof result.current.handleTogglePin).toBe('function');
    expect(typeof result.current.handleCenterWindow).toBe('function');
    expect(typeof result.current.handleMoveWindow).toBe('function');
    expect(typeof result.current.handleRevealFromTray).toBe('function');
    expect(typeof result.current.handleWebReload).toBe('function');
    expect(typeof result.current.handleStartWindowDrag).toBe('function');
    expect(typeof result.current.handleStartWindowResize).toBe('function');
  });

  it('starts window resize dragging through the desktop control API', async () => {
    mockIsTauri.mockReturnValue(true);
    mockStartWindowResizeDragging.mockResolvedValue(undefined);
    mockGetDesktopShell.mockResolvedValue({
      platform: 'windows',
      mode: 'custom-frameless',
      dragStrategy: 'manual',
      showsNativeWindowControls: false,
      supportsManualDragging: true,
      supportsDoubleClickMaximize: true,
      titlebarInsets: { left: 0, right: 0, top: 0 },
    });

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleStartWindowResize('SouthEast');
    });

    expect(mockStartWindowResizeDragging).toHaveBeenCalledWith('SouthEast');
  });

  it('should route move window actions through positionerApi', async () => {
    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleMoveWindow('TopRight');
    });

    expect(mockMoveToPreset).toHaveBeenCalledWith('TopRight');
  });

  it('tracks tray readiness in Tauri environments', async () => {
    mockIsTauri.mockReturnValue(true);
    mockIsTrayPositioningReady.mockResolvedValue(true);
    mockGetDesktopShell.mockResolvedValue({
      platform: 'macos',
      mode: 'native-overlay',
      dragStrategy: 'manual',
      showsNativeWindowControls: true,
      supportsManualDragging: true,
      supportsDoubleClickMaximize: true,
      titlebarInsets: { left: 72, right: 12, top: 0 },
    });

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isTrayReady).toBe(true);
    expect(result.current.shell.mode).toBe('native-overlay');
    expect(result.current.shell.showsNativeWindowControls).toBe(true);
  });

  it('starts window dragging through the desktop control API', async () => {
    mockIsTauri.mockReturnValue(true);
    mockStartWindowDragging.mockResolvedValue(undefined);
    mockGetDesktopShell.mockResolvedValue({
      platform: 'windows',
      mode: 'custom-frameless',
      dragStrategy: 'manual',
      showsNativeWindowControls: false,
      supportsManualDragging: true,
      supportsDoubleClickMaximize: true,
      titlebarInsets: { left: 0, right: 0, top: 0 },
    });

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleStartWindowDrag();
    });

    expect(mockStartWindowDragging).toHaveBeenCalledTimes(1);
  });

  it('persists window state before restarting', async () => {
    mockIsTauri.mockReturnValue(true);
    mockGetDesktopShell.mockResolvedValue({
      platform: 'windows',
      mode: 'custom-frameless',
      dragStrategy: 'manual',
      showsNativeWindowControls: false,
      supportsManualDragging: true,
      supportsDoubleClickMaximize: true,
      titlebarInsets: { left: 12, right: 12, top: 0 },
    });

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleRestart();
    });

    expect(mockSaveWindowState).toHaveBeenCalledTimes(1);
    expect(mockRestartApp).toHaveBeenCalledTimes(1);
  });

  it('reveals and repositions the window when tray activation is received', async () => {
    let trayHandler: (() => Promise<void>) | undefined;
    mockIsTauri.mockReturnValue(true);
    mockIsTrayPositioningReady.mockResolvedValue(true);
    mockListenForTrayActivation.mockImplementation(async (handler: () => Promise<void>) => {
      trayHandler = handler;
      return () => {};
    });

    renderHook(() => useWindowControls());

    await act(async () => {
      await Promise.resolve();
    });

    expect(trayHandler).toBeDefined();

    await act(async () => {
      await trayHandler?.();
    });

    expect(mockShowWindow).toHaveBeenCalledTimes(1);
    expect(mockUnminimizeWindow).toHaveBeenCalledTimes(1);
    expect(mockMoveToPreset).toHaveBeenCalledWith('TrayCenter');
    expect(mockFocusWindow).toHaveBeenCalledTimes(1);
  });

  it('falls back to centering when tray reveal positioning cannot move', async () => {
    mockMoveToPreset.mockResolvedValue({
      moved: false,
      usedFallback: false,
      reason: 'tray-not-ready',
    });

    const { result } = renderHook(() => useWindowControls());

    await act(async () => {
      await result.current.handleRevealFromTray();
    });

    expect(mockCenterWindow).toHaveBeenCalledTimes(1);
    expect(mockFocusWindow).toHaveBeenCalledTimes(1);
  });
});
