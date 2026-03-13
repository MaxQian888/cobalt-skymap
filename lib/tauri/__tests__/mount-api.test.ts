/**
 * Tests for mount-api.ts
 * Mount control API wrapper for Tauri IPC
 */

import { mountApi, SLEW_RATE_PRESETS, DEFAULT_CONNECTION_CONFIG } from '../mount-api';

jest.mock('@/lib/storage/platform', () => ({
  isTauri: () => false,
}));

describe('mountApi (non-Tauri)', () => {
  it('should reject connect in non-Tauri env', async () => {
    await expect(mountApi.connect(DEFAULT_CONNECTION_CONFIG)).rejects.toThrow(
      'Mount API is only available in Tauri desktop environment'
    );
  });

  it('should reject disconnect in non-Tauri env', async () => {
    await expect(mountApi.disconnect()).rejects.toThrow(
      'Mount API is only available in Tauri desktop environment'
    );
  });

  it('should reject getState in non-Tauri env', async () => {
    await expect(mountApi.getState()).rejects.toThrow(
      'Mount API is only available in Tauri desktop environment'
    );
  });

  it('should reject getCapabilities in non-Tauri env', async () => {
    await expect(mountApi.getCapabilities()).rejects.toThrow(
      'Mount API is only available in Tauri desktop environment'
    );
  });
});

describe('SLEW_RATE_PRESETS', () => {
  it('should have multiple presets', () => {
    expect(SLEW_RATE_PRESETS.length).toBeGreaterThan(0);
  });

  it('should have label and value for each preset', () => {
    for (const preset of SLEW_RATE_PRESETS) {
      expect(typeof preset.label).toBe('string');
      expect(typeof preset.value).toBe('number');
    }
  });
});

describe('DEFAULT_CONNECTION_CONFIG', () => {
  it('should have valid defaults', () => {
    expect(DEFAULT_CONNECTION_CONFIG.protocol).toBe('simulator');
    expect(DEFAULT_CONNECTION_CONFIG.host).toBe('localhost');
    expect(typeof DEFAULT_CONNECTION_CONFIG.port).toBe('number');
    expect(typeof DEFAULT_CONNECTION_CONFIG.deviceId).toBe('number');
    expect((DEFAULT_CONNECTION_CONFIG as typeof DEFAULT_CONNECTION_CONFIG & { selectedDeviceId?: string | null }).selectedDeviceId).toBe('simulator://builtin');
  });
});
