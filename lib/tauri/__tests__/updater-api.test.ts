/**
 * @jest-environment jsdom
 */

const mockInvoke = jest.fn();
const mockListen = jest.fn();

jest.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

jest.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => true,
}));

import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  downloadAndInstallUpdate,
  getCurrentVersion,
  clearPendingUpdate,
  hasPendingUpdate,
  onUpdateProgress,
  isUpdateAvailable,
  isUpdateReady,
  isUpdateDownloading,
  isUpdateError,
  formatBytes,
  formatProgress,
  UpdateStatus,
  UpdateProgress,
} from '../updater-api';

describe('updater-api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkForUpdate', () => {
    it('should return update available status when update exists', async () => {
      const mockStatus: UpdateStatus = {
        status: 'available',
        data: {
          version: '1.0.1',
          current_version: '1.0.0',
          date: '2024-01-01T00:00:00Z',
          body: 'Bug fixes',
        },
      };
      mockInvoke.mockResolvedValue(mockStatus);

      const result = await checkForUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('check_for_update');
      expect(result).toEqual(mockStatus);
    });

    it('should return not_available status when no update', async () => {
      const mockStatus: UpdateStatus = { status: 'not_available' };
      mockInvoke.mockResolvedValue(mockStatus);

      const result = await checkForUpdate();

      expect(result).toEqual(mockStatus);
    });

    it('should return error status on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Network error'));

      const result = await checkForUpdate();

      expect(result).toEqual({
        status: 'error',
        data: 'Network error',
      });
    });

    it('should handle non-Error rejection', async () => {
      mockInvoke.mockRejectedValue('string error');

      const result = await checkForUpdate();

      expect(result).toEqual({
        status: 'error',
        data: 'string error',
      });
    });
  });

  describe('downloadUpdate', () => {
    it('should return ready status on success', async () => {
      const mockStatus: UpdateStatus = {
        status: 'ready',
        data: {
          version: '1.0.1',
          current_version: '1.0.0',
          date: null,
          body: null,
        },
      };
      mockInvoke.mockResolvedValue(mockStatus);

      const result = await downloadUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('download_update');
      expect(result).toEqual(mockStatus);
    });

    it('should return error status on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Download failed'));

      const result = await downloadUpdate();

      expect(result).toEqual({
        status: 'error',
        data: 'Download failed',
      });
    });
  });

  describe('installUpdate', () => {
    it('should return idle status on success', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const result = await installUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('install_update');
      expect(result).toEqual({ status: 'idle' });
    });

    it('should return error status on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Install failed'));

      const result = await installUpdate();

      expect(result).toEqual({
        status: 'error',
        data: 'Install failed',
      });
    });
  });

  describe('downloadAndInstallUpdate', () => {
    it('should return idle status on success', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const result = await downloadAndInstallUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('download_and_install_update');
      expect(result).toEqual({ status: 'idle' });
    });

    it('should return error status on failure', async () => {
      mockInvoke.mockRejectedValue(new Error('Download and install failed'));

      const result = await downloadAndInstallUpdate();

      expect(result).toEqual({
        status: 'error',
        data: 'Download and install failed',
      });
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current version string', async () => {
      mockInvoke.mockResolvedValue('1.0.0');

      const result = await getCurrentVersion();

      expect(mockInvoke).toHaveBeenCalledWith('get_current_version');
      expect(result).toBe('1.0.0');
    });
  });

  describe('clearPendingUpdate', () => {
    it('should call clear_pending_update command', async () => {
      mockInvoke.mockResolvedValue(undefined);

      await clearPendingUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('clear_pending_update');
    });
  });

  describe('hasPendingUpdate', () => {
    it('should return true when update is pending', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await hasPendingUpdate();

      expect(mockInvoke).toHaveBeenCalledWith('has_pending_update');
      expect(result).toBe(true);
    });

    it('should return false when no update is pending', async () => {
      mockInvoke.mockResolvedValue(false);

      const result = await hasPendingUpdate();

      expect(result).toBe(false);
    });
  });

  describe('onUpdateProgress', () => {
    it('should register event listener and return unlisten function', async () => {
      const mockUnlisten = jest.fn();
      mockListen.mockResolvedValue(mockUnlisten);
      const callback = jest.fn();

      const unlisten = await onUpdateProgress(callback);

      expect(mockListen).toHaveBeenCalledWith('update-progress', expect.any(Function));
      expect(unlisten).toBe(mockUnlisten);
    });

    it('should call callback with event payload', async () => {
      const mockUnlisten = jest.fn();
      let capturedHandler: (event: { payload: UpdateStatus }) => void = () => {};
      mockListen.mockImplementation((event, handler) => {
        capturedHandler = handler;
        return Promise.resolve(mockUnlisten);
      });
      const callback = jest.fn();

      await onUpdateProgress(callback);

      const mockPayload: UpdateStatus = {
        status: 'downloading',
        data: { downloaded: 100, total: 1000, percent: 10 },
      };
      capturedHandler({ payload: mockPayload });

      expect(callback).toHaveBeenCalledWith(mockPayload);
    });
  });

  describe('type guards', () => {
    describe('isUpdateAvailable', () => {
      it('should return true for available status', () => {
        const status: UpdateStatus = {
          status: 'available',
          data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
        };
        expect(isUpdateAvailable(status)).toBe(true);
      });

      it('should return false for other statuses', () => {
        expect(isUpdateAvailable({ status: 'idle' })).toBe(false);
        expect(isUpdateAvailable({ status: 'checking' })).toBe(false);
        expect(isUpdateAvailable({ status: 'not_available' })).toBe(false);
      });
    });

    describe('isUpdateReady', () => {
      it('should return true for ready status', () => {
        const status: UpdateStatus = {
          status: 'ready',
          data: { version: '1.0.1', current_version: '1.0.0', date: null, body: null },
        };
        expect(isUpdateReady(status)).toBe(true);
      });

      it('should return false for other statuses', () => {
        expect(isUpdateReady({ status: 'idle' })).toBe(false);
        expect(isUpdateReady({ status: 'downloading', data: { downloaded: 0, total: null, percent: 0 } })).toBe(false);
      });
    });

    describe('isUpdateDownloading', () => {
      it('should return true for downloading status', () => {
        const status: UpdateStatus = {
          status: 'downloading',
          data: { downloaded: 500, total: 1000, percent: 50 },
        };
        expect(isUpdateDownloading(status)).toBe(true);
      });

      it('should return false for other statuses', () => {
        expect(isUpdateDownloading({ status: 'idle' })).toBe(false);
      });
    });

    describe('isUpdateError', () => {
      it('should return true for error status', () => {
        const status: UpdateStatus = {
          status: 'error',
          data: 'Something went wrong',
        };
        expect(isUpdateError(status)).toBe(true);
      });

      it('should return false for other statuses', () => {
        expect(isUpdateError({ status: 'idle' })).toBe(false);
      });
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
      expect(formatBytes(1572864)).toBe('1.5 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('formatProgress', () => {
    it('should format progress with total', () => {
      const progress: UpdateProgress = {
        downloaded: 512000,
        total: 1024000,
        percent: 50,
      };
      expect(formatProgress(progress)).toBe('500 KB / 1000 KB (50.0%)');
    });

    it('should format progress without total', () => {
      const progress: UpdateProgress = {
        downloaded: 512000,
        total: null,
        percent: 0,
      };
      expect(formatProgress(progress)).toBe('500 KB');
    });
  });
});
