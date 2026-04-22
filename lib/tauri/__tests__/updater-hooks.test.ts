/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';

const mockCheckForUpdate = jest.fn();
const mockDownloadUpdate = jest.fn();
const mockInstallUpdate = jest.fn();
const mockDownloadAndInstallUpdate = jest.fn();
const mockGetCurrentVersion = jest.fn();
const mockClearPendingUpdate = jest.fn();
const mockOnUpdateProgress = jest.fn();

jest.mock('../updater-api', () => ({
  checkForUpdate: () => mockCheckForUpdate(),
  downloadUpdate: () => mockDownloadUpdate(),
  installUpdate: () => mockInstallUpdate(),
  downloadAndInstallUpdate: () => mockDownloadAndInstallUpdate(),
  getCurrentVersion: () => mockGetCurrentVersion(),
  clearPendingUpdate: () => mockClearPendingUpdate(),
  onUpdateProgress: (callback: (status: unknown) => void) => mockOnUpdateProgress(callback),
  isUpdateAvailable: (status: { status: string }) => status.status === 'available',
  isUpdateReady: (status: { status: string }) => status.status === 'ready',
  isUpdateDownloading: (status: { status: string }) => status.status === 'downloading',
  isUpdateError: (status: { status: string }) => status.status === 'error',
}));

import { useUpdater, useAutoUpdater } from '../updater-hooks';
import { useUpdaterStore } from '@/lib/stores/updater-store';

describe('updater-hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetCurrentVersion.mockImplementation(() => new Promise<string>(() => undefined));
    mockOnUpdateProgress.mockResolvedValue(jest.fn());
    // Reset the Zustand store between tests
    useUpdaterStore.getState().reset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('useUpdater', () => {
    it('should initialize with idle status', async () => {
      const { result } = renderHook(() => useUpdater());

      expect(result.current.status).toEqual({ status: 'idle' });
      expect(result.current.isChecking).toBe(false);
      expect(result.current.isDownloading).toBe(false);
      expect(result.current.isReady).toBe(false);
      expect(result.current.hasUpdate).toBe(false);
    });

    it('should fetch current version on mount', async () => {
      renderHook(() => useUpdater());

      await waitFor(() => {
        expect(mockGetCurrentVersion).toHaveBeenCalled();
      });
    });

    it('should set up update progress listener on mount', async () => {
      renderHook(() => useUpdater());

      await waitFor(() => {
        expect(mockOnUpdateProgress).toHaveBeenCalled();
      });
    });

    it('should update status when checking for updates', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.hasUpdate).toBe(true);
      expect(result.current.updateInfo).toEqual({
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      });
    });

    it('should handle no update available', async () => {
      mockCheckForUpdate.mockResolvedValue({ status: 'not_available' });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.hasUpdate).toBe(false);
      expect(result.current.updateInfo).toBeNull();
    });

    it('should handle check error', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'error',
        data: 'Network error',
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.error).toBe('Network error');
    });

    it('should call onUpdateAvailable callback when update is found', async () => {
      const onUpdateAvailable = jest.fn();
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater({ onUpdateAvailable }));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(onUpdateAvailable).toHaveBeenCalledWith({
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      });
    });

    it('should call onError callback when error occurs', async () => {
      const onError = jest.fn();
      mockCheckForUpdate.mockResolvedValue({
        status: 'error',
        data: 'Network error',
      });

      const { result } = renderHook(() => useUpdater({ onError }));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(onError).toHaveBeenCalledWith('Network error');
    });

    it('should download update when downloadUpdate is called', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadUpdate.mockResolvedValue({
        status: 'ready',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadUpdate();
      });

      expect(mockDownloadUpdate).toHaveBeenCalled();
      expect(result.current.isReady).toBe(true);
    });

    it('should not download if no update is available', async () => {
      mockCheckForUpdate.mockResolvedValue({ status: 'not_available' });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadUpdate();
      });

      expect(mockDownloadUpdate).not.toHaveBeenCalled();
    });

    it('should install update when installUpdate is called', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadUpdate.mockResolvedValue({
        status: 'ready',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockInstallUpdate.mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadUpdate();
      });

      await act(async () => {
        await result.current.installUpdate();
      });

      expect(mockInstallUpdate).toHaveBeenCalled();
    });

    it('should download and install when downloadAndInstall is called', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadAndInstallUpdate.mockResolvedValue(undefined);

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(mockDownloadAndInstallUpdate).toHaveBeenCalled();
    });

    it('should store error state when downloadAndInstall returns an error status', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadAndInstallUpdate.mockResolvedValue({
        status: 'error',
        data: 'Signature verification failed.',
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.error).toBe('Signature verification failed.');
    });

    it('should store error state when installUpdate returns an error status', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadUpdate.mockResolvedValue({
        status: 'ready',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockInstallUpdate.mockResolvedValue({
        status: 'error',
        data: 'Update service is not configured for this build.',
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadUpdate();
      });

      await act(async () => {
        await result.current.installUpdate();
      });

      expect(result.current.error).toBe('Update service is not configured for this build.');
    });

    it('should dismiss update when dismissUpdate is called', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.hasUpdate).toBe(true);

      act(() => {
        result.current.dismissUpdate();
      });

      expect(mockClearPendingUpdate).toHaveBeenCalled();
      expect(result.current.status).toEqual({ status: 'idle' });
    });

    it('should return current version', async () => {
      mockGetCurrentVersion.mockResolvedValue('1.0.0');
      const { result } = renderHook(() => useUpdater());

      await waitFor(() => {
        expect(result.current.currentVersion).toBe('1.0.0');
      });
    });

    it('should set lastChecked timestamp after checking', async () => {
      mockCheckForUpdate.mockResolvedValue({ status: 'not_available' });

      const { result } = renderHook(() => useUpdater());

      expect(result.current.lastChecked).toBeNull();

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.lastChecked).not.toBeNull();
      expect(typeof result.current.lastChecked).toBe('number');
    });

    it('should skip version when skipVersion is called', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      expect(result.current.hasUpdate).toBe(true);

      act(() => {
        result.current.skipVersion('1.0.1');
      });

      expect(result.current.skippedVersion).toBe('1.0.1');
      expect(mockClearPendingUpdate).toHaveBeenCalled();
      expect(result.current.status).toEqual({ status: 'idle' });
    });

    it('should filter out skipped version on check', async () => {
      // First, skip version 1.0.1
      useUpdaterStore.getState().setSkippedVersion('1.0.1');

      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      // Should be treated as not available since version is skipped
      expect(result.current.hasUpdate).toBe(false);
    });
  });

  describe('useAutoUpdater', () => {
    it('should automatically check for updates on mount', async () => {
      mockCheckForUpdate.mockResolvedValue({ status: 'not_available' });

      renderHook(() => useAutoUpdater());

      // Advance timers to trigger the setTimeout(doCheck, 0)
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalled();
      });
    });

    it('should periodically check for updates based on checkInterval', async () => {
      mockCheckForUpdate.mockResolvedValue({ status: 'not_available' });
      const checkInterval = 60000; // 1 minute

      renderHook(() => useAutoUpdater({ checkInterval }));

      // Initial check
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
      });

      // Advance to next interval
      await act(async () => {
        jest.advanceTimersByTime(checkInterval);
      });

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalledTimes(2);
      });
    });

    it('should clean up interval on unmount', async () => {
      mockCheckForUpdate.mockResolvedValue({ status: 'not_available' });
      const checkInterval = 60000;

      const { unmount } = renderHook(() => useAutoUpdater({ checkInterval }));

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Advance time after unmount - should not trigger more checks
      await act(async () => {
        jest.advanceTimersByTime(checkInterval * 2);
      });

      expect(mockCheckForUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('progress tracking', () => {
    it('should return download progress when downloading', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      // Simulate downloading state
      await act(async () => {
        mockDownloadUpdate.mockImplementation(async () => {
          return {
            status: 'downloading',
            data: { downloaded: 500000, total: 1000000, percent: 50 },
          };
        });
        await result.current.downloadUpdate();
      });

      expect(mockDownloadUpdate).toHaveBeenCalled();
    });

    it('should initialize downloadSpeed and estimatedTimeRemaining as null', () => {
      const { result } = renderHook(() => useUpdater());

      expect(result.current.downloadSpeed).toBeNull();
      expect(result.current.estimatedTimeRemaining).toBeNull();
    });

    it('should reset download metrics when starting download', async () => {
      // Pre-set some metrics in the store
      useUpdaterStore.getState().setDownloadMetrics(5000, 10);
      useUpdaterStore.getState().setStatus({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      mockDownloadUpdate.mockResolvedValue({
        status: 'ready',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.downloadUpdate();
      });

      // After download completes, speed/eta should be null (reset at start)
      expect(result.current.downloadSpeed).toBeNull();
      expect(result.current.estimatedTimeRemaining).toBeNull();
    });
  });

  describe('install guard', () => {
    it('should not call installUpdate if not ready', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      // Status is 'available', not 'ready'
      await act(async () => {
        await result.current.installUpdate();
      });

      expect(mockInstallUpdate).not.toHaveBeenCalled();
    });
  });

  describe('downloadAndInstall error handling', () => {
    it('should set error status when downloadAndInstall throws', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadAndInstallUpdate.mockRejectedValue(new Error('Install crashed'));

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.error).toBe('Install crashed');
    });

    it('should handle non-Error rejection in downloadAndInstall', async () => {
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadAndInstallUpdate.mockRejectedValue('string error');

      const { result } = renderHook(() => useUpdater());

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.error).toBe('string error');
    });
  });

  describe('dismissUpdate reset', () => {
    it('should reset download metrics when dismissing', async () => {
      // Put metrics in the store
      useUpdaterStore.getState().setDownloadMetrics(2048, 5);
      useUpdaterStore.getState().setStatus({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater());

      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.downloadSpeed).toBeNull();
      expect(result.current.estimatedTimeRemaining).toBeNull();
      expect(result.current.status).toEqual({ status: 'idle' });
      expect(mockClearPendingUpdate).toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('should call onUpdateReady callback when update is ready', async () => {
      const onUpdateReady = jest.fn();
      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });
      mockDownloadUpdate.mockResolvedValue({
        status: 'ready',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useUpdater({ onUpdateReady }));

      await act(async () => {
        await result.current.checkForUpdate();
      });

      await act(async () => {
        await result.current.downloadUpdate();
      });

      expect(onUpdateReady).toHaveBeenCalledWith({
        version: '1.0.1',
        current_version: '1.0.0',
        date: null,
        body: null,
      });
    });
  });

  describe('currentVersion caching', () => {
    it('should not re-fetch currentVersion if already set', async () => {
      // Pre-set version in store
      useUpdaterStore.getState().setCurrentVersion('2.0.0');

      renderHook(() => useUpdater());

      // Wait a tick
      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      // Should not call getCurrentVersion since it's already set
      expect(mockGetCurrentVersion).not.toHaveBeenCalled();
    });
  });

  describe('autoCheck with skipped version', () => {
    it('should filter skipped version during auto check', async () => {
      useUpdaterStore.getState().setSkippedVersion('1.0.1');

      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useAutoUpdater());

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalled();
      });

      expect(result.current.hasUpdate).toBe(false);
    });

    it('should not filter different version during auto check', async () => {
      useUpdaterStore.getState().setSkippedVersion('1.0.0');

      mockCheckForUpdate.mockResolvedValue({
        status: 'available',
        data: { version: '1.0.2', current_version: '1.0.0', date: null, body: null },
      });

      const { result } = renderHook(() => useAutoUpdater());

      await act(async () => {
        jest.advanceTimersByTime(0);
      });

      await waitFor(() => {
        expect(mockCheckForUpdate).toHaveBeenCalled();
      });

      expect(result.current.hasUpdate).toBe(true);
    });
  });
});
