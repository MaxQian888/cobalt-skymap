/**
 * @jest-environment jsdom
 */

import {
  normalizeDesktopPlatform,
  resolveDesktopShell,
  type DesktopSystemInfoLike,
} from '../window-shell';

describe('window-shell', () => {
  it('resolves browser shell when not running in Tauri', () => {
    const shell = resolveDesktopShell(undefined, false);

    expect(shell.platform).toBe('web');
    expect(shell.mode).toBe('browser');
    expect(shell.showsNativeWindowControls).toBe(false);
    expect(shell.dragStrategy).toBe('none');
  });

  it('resolves custom frameless shell for Windows', () => {
    const shell = resolveDesktopShell({
      os: 'windows',
      platform: 'windows',
      family: 'windows',
    });

    expect(shell.platform).toBe('windows');
    expect(shell.mode).toBe('custom-frameless');
    expect(shell.showsNativeWindowControls).toBe(false);
    expect(shell.dragStrategy).toBe('manual');
    expect(shell.supportsDoubleClickMaximize).toBe(true);
  });

  it('resolves native overlay shell for macOS', () => {
    const shell = resolveDesktopShell({
      os: 'macos',
      platform: 'macos',
      family: 'unix',
    });

    expect(shell.platform).toBe('macos');
    expect(shell.mode).toBe('native-overlay');
    expect(shell.showsNativeWindowControls).toBe(true);
    expect(shell.dragStrategy).toBe('manual');
    expect(shell.titlebarInsets.left).toBeGreaterThan(0);
  });

  it('normalizes platform from fallback fields', () => {
    const info: DesktopSystemInfoLike = {
      os: 'darwin',
      platform: null,
      family: 'unix',
    };

    expect(normalizeDesktopPlatform(info)).toBe('macos');
  });
});
