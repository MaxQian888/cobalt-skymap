import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('desktop Tauri capabilities', () => {
  it('grants fullscreen window control to the main capability', () => {
    const capabilityPath = path.join(process.cwd(), 'src-tauri', 'capabilities', 'default.json');
    const capability = JSON.parse(readFileSync(capabilityPath, 'utf8')) as {
      permissions?: string[];
    };

    expect(capability.permissions).toContain('core:window:allow-set-fullscreen');
  });

  it('grants always-on-top window control to the main capability', () => {
    const capabilityPath = path.join(process.cwd(), 'src-tauri', 'capabilities', 'default.json');
    const capability = JSON.parse(readFileSync(capabilityPath, 'utf8')) as {
      permissions?: string[];
    };

    expect(capability.permissions).toContain('core:window:allow-set-always-on-top');
  });
});
