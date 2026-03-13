/**
 * @jest-environment jsdom
 */
const mockIsTauri = jest.fn<boolean, []>(() => false);
const mockSaveDialog = jest.fn();
const mockOpenDialog = jest.fn();
const mockWriteTextFile = jest.fn();
const mockReadTextFile = jest.fn();

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => mockIsTauri(),
}));

jest.mock('@tauri-apps/plugin-dialog', () => ({
  save: (...args: unknown[]) => mockSaveDialog(...args),
  open: (...args: unknown[]) => mockOpenDialog(...args),
}));

jest.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...args: unknown[]) => mockWriteTextFile(...args),
  readTextFile: (...args: unknown[]) => mockReadTextFile(...args),
}));

import {
  getSettingsProfileFilename,
  openSettingsProfileFile,
  readSettingsProfileBrowserFile,
  saveSettingsProfileFile,
} from '../settings-profile-io';

const profile = {
  version: 6,
  exportedAt: '2026-02-03T10:00:00.000Z',
  metadata: {
    schemaVersion: 6,
    domains: ['settings'],
  },
} as const;

describe('settings-profile-io', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsTauri.mockReturnValue(false);
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: jest.fn(() => 'blob:settings-profile'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: jest.fn(),
    });
  });

  it('generates export filenames from the calendar date', () => {
    expect(getSettingsProfileFilename(new Date('2026-02-03T10:00:00.000Z'))).toBe(
      'skymap-settings-2026-02-03.json',
    );
  });

  it('downloads the profile through a browser link outside Tauri', async () => {
    const click = jest.fn();
    const anchor = document.createElement('a');
    const clickSpy = jest.spyOn(anchor, 'click').mockImplementation(click);
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(anchor);
    const appendSpy = jest.spyOn(document.body, 'appendChild');
    const removeSpy = jest.spyOn(document.body, 'removeChild');

    const result = await saveSettingsProfileFile(profile);

    expect(result).toBe('skymap-settings-2026-02-03.json');
    expect(anchor.download).toBe('skymap-settings-2026-02-03.json');
    expect(anchor.href).toBe('blob:settings-profile');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith(anchor);
    expect(removeSpy).toHaveBeenCalledWith(anchor);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:settings-profile');

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('writes the profile to a Tauri-selected file path', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSaveDialog.mockResolvedValue('C:/exports/settings.json');

    const result = await saveSettingsProfileFile(profile);

    expect(mockSaveDialog).toHaveBeenCalledWith({
      defaultPath: 'skymap-settings-2026-02-03.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      'C:/exports/settings.json',
      expect.stringContaining('"version": 6'),
    );
    expect(result).toBe('C:/exports/settings.json');
  });

  it('returns null when the Tauri save dialog is canceled', async () => {
    mockIsTauri.mockReturnValue(true);
    mockSaveDialog.mockResolvedValue(null);

    const result = await saveSettingsProfileFile(profile);

    expect(result).toBeNull();
    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it('reads a Tauri-selected settings profile file', async () => {
    mockIsTauri.mockReturnValue(true);
    mockOpenDialog.mockResolvedValue('C:/imports/settings.json');
    mockReadTextFile.mockResolvedValue('{"version":6}');

    const result = await openSettingsProfileFile();

    expect(mockOpenDialog).toHaveBeenCalledWith({
      multiple: false,
      filters: [{ name: 'JSON Files', extensions: ['json'] }],
    });
    expect(mockReadTextFile).toHaveBeenCalledWith('C:/imports/settings.json');
    expect(result).toBe('{"version":6}');
  });

  it('returns null when opening outside Tauri or when selection is not a file path', async () => {
    expect(await openSettingsProfileFile()).toBeNull();

    mockIsTauri.mockReturnValue(true);
    mockOpenDialog.mockResolvedValue(['C:/imports/settings.json']);

    expect(await openSettingsProfileFile()).toBeNull();
    expect(mockReadTextFile).not.toHaveBeenCalled();
  });

  it('reads browser-selected files through FileReader', async () => {
    const originalFileReader = global.FileReader;

    class SuccessfulFileReader {
      public result: string | null = null;

      public onload: null | (() => void) = null;

      public onerror: null | (() => void) = null;

      readAsText() {
        this.result = '{"version":6}';
        this.onload?.();
      }
    }

    Object.defineProperty(global, 'FileReader', {
      writable: true,
      value: SuccessfulFileReader,
    });

    await expect(
      readSettingsProfileBrowserFile(new File(['ignored'], 'settings.json', { type: 'application/json' })),
    ).resolves.toBe('{"version":6}');

    Object.defineProperty(global, 'FileReader', {
      writable: true,
      value: originalFileReader,
    });
  });

  it('surfaces FileReader failures for browser-selected files', async () => {
    const originalFileReader = global.FileReader;

    class FailingFileReader {
      public result: string | null = null;

      public onload: null | (() => void) = null;

      public onerror: null | (() => void) = null;

      readAsText() {
        this.onerror?.();
      }
    }

    Object.defineProperty(global, 'FileReader', {
      writable: true,
      value: FailingFileReader,
    });

    await expect(
      readSettingsProfileBrowserFile(new File(['ignored'], 'settings.json', { type: 'application/json' })),
    ).rejects.toThrow('Failed to read file');

    Object.defineProperty(global, 'FileReader', {
      writable: true,
      value: originalFileReader,
    });
  });
});
