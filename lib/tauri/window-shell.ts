import type { SystemInfo } from './types';

export type DesktopShellPlatform = 'web' | 'windows' | 'macos' | 'linux' | 'unknown';
export type DesktopShellMode = 'browser' | 'custom-frameless' | 'native-overlay';
export type DesktopShellDragStrategy = 'none' | 'manual';

export interface DesktopShellInsets {
  left: number;
  right: number;
  top: number;
}

export interface DesktopSystemInfoLike {
  os?: SystemInfo['os'] | null;
  platform?: SystemInfo['platform'] | null;
  family?: SystemInfo['family'] | null;
}

export interface DesktopShell {
  platform: DesktopShellPlatform;
  mode: DesktopShellMode;
  dragStrategy: DesktopShellDragStrategy;
  showsNativeWindowControls: boolean;
  supportsManualDragging: boolean;
  supportsDoubleClickMaximize: boolean;
  titlebarInsets: DesktopShellInsets;
}

const ZERO_INSETS: DesktopShellInsets = {
  left: 0,
  right: 0,
  top: 0,
};

const CUSTOM_SHELL_INSETS: DesktopShellInsets = {
  left: 12,
  right: 12,
  top: 0,
};

const MACOS_OVERLAY_INSETS: DesktopShellInsets = {
  left: 76,
  right: 16,
  top: 0,
};

export function normalizeDesktopPlatform(
  info?: DesktopSystemInfoLike | null
): DesktopShellPlatform {
  const candidates = [info?.platform, info?.os, info?.family]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.toLowerCase());

  if (candidates.some((value) => value.includes('mac') || value.includes('darwin'))) {
    return 'macos';
  }
  if (candidates.some((value) => value.includes('win'))) {
    return 'windows';
  }
  if (candidates.some((value) => value.includes('linux'))) {
    return 'linux';
  }

  return 'unknown';
}

export function resolveDesktopShell(
  info?: DesktopSystemInfoLike | null,
  isTauriEnv: boolean = true
): DesktopShell {
  if (!isTauriEnv) {
    return {
      platform: 'web',
      mode: 'browser',
      dragStrategy: 'none',
      showsNativeWindowControls: false,
      supportsManualDragging: false,
      supportsDoubleClickMaximize: false,
      titlebarInsets: ZERO_INSETS,
    };
  }

  const platform = normalizeDesktopPlatform(info);

  if (platform === 'macos') {
    return {
      platform,
      mode: 'native-overlay',
      dragStrategy: 'manual',
      showsNativeWindowControls: true,
      supportsManualDragging: true,
      supportsDoubleClickMaximize: true,
      titlebarInsets: MACOS_OVERLAY_INSETS,
    };
  }

  return {
    platform,
    mode: 'custom-frameless',
    dragStrategy: 'manual',
    showsNativeWindowControls: false,
    supportsManualDragging: true,
    supportsDoubleClickMaximize: true,
    titlebarInsets: CUSTOM_SHELL_INSETS,
  };
}
