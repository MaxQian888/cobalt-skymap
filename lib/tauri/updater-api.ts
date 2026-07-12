import type { UnlistenFn } from '@tauri-apps/api/event';
import { isTauri } from '@/lib/storage/platform';

// Lazy import to avoid errors in web environment
async function getInvoke() {
  if (!isTauri()) {
    throw new Error('Tauri API is only available in desktop environment');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

async function invoke<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
  const doInvoke = await getInvoke();
  return args === undefined ? doInvoke<T>(command) : doInvoke<T>(command, args);
}

export interface UpdateInfo {
  version: string;
  current_version: string;
  date: string | null;
  body: string | null;
}

export interface UpdateProgress {
  downloaded: number;
  total: number | null;
  percent: number;
}

export type UpdateStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; data: UpdateInfo }
  | { status: 'not_available' }
  | { status: 'downloading'; data: UpdateProgress }
  | { status: 'ready'; data: UpdateInfo }
  | { status: 'error'; data: string };

export interface UpdateCheckOptions {
  silent?: boolean;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  try {
    return await invoke<UpdateStatus>('check_for_update');
  } catch (error) {
    return {
      status: 'error',
      data: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  try {
    return await invoke<UpdateStatus>('download_update');
  } catch (error) {
    return {
      status: 'error',
      data: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function installUpdate(): Promise<UpdateStatus> {
  try {
    await invoke('install_update');
    return { status: 'idle' };
  } catch (error) {
    return {
      status: 'error',
      data: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function downloadAndInstallUpdate(): Promise<UpdateStatus> {
  try {
    await invoke('download_and_install_update');
    return { status: 'idle' };
  } catch (error) {
    return {
      status: 'error',
      data: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getCurrentVersion(): Promise<string> {
  return await invoke<string>('get_current_version');
}

export async function clearPendingUpdate(): Promise<void> {
  await invoke('clear_pending_update');
}

export async function hasPendingUpdate(): Promise<boolean> {
  return await invoke<boolean>('has_pending_update');
}

export async function onUpdateProgress(
  callback: (status: UpdateStatus) => void
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  const { listen } = await import('@tauri-apps/api/event');
  return await listen<UpdateStatus>('update-progress', (event) => {
    callback(event.payload);
  });
}

export function isUpdateAvailable(status: UpdateStatus): status is { status: 'available'; data: UpdateInfo } {
  return status.status === 'available';
}

export function isUpdateReady(status: UpdateStatus): status is { status: 'ready'; data: UpdateInfo } {
  return status.status === 'ready';
}

export function isUpdateDownloading(status: UpdateStatus): status is { status: 'downloading'; data: UpdateProgress } {
  return status.status === 'downloading';
}

export function isUpdateError(status: UpdateStatus): status is { status: 'error'; data: string } {
  return status.status === 'error';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function formatProgress(progress: UpdateProgress): string {
  const downloaded = formatBytes(progress.downloaded);
  if (progress.total) {
    const total = formatBytes(progress.total);
    return `${downloaded} / ${total} (${progress.percent.toFixed(1)}%)`;
  }
  return downloaded;
}
