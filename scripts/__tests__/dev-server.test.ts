/**
 * @jest-environment node
 */

import * as devServer from '../dev-server.cjs';

const {
  buildNextDevSpawnSpec,
  launchNextDevServer,
  parseCliConfig,
} = devServer;

describe('dev server startup script', () => {
  it('parses pnpm forwarded port arguments and kill flag', () => {
    expect(
      parseCliConfig(['--', '--port', '1421', '--kill'], { DEV_PORT: '1500', NODE_ENV: 'test' }),
    ).toEqual({
      killFlag: true,
      devPort: 1421,
    });
  });

  it('launches Next.js directly through node without enabling shell mode', () => {
    const spawnImpl = jest.fn().mockReturnValue({
      kill: jest.fn(),
      on: jest.fn(),
    });

    const child = launchNextDevServer({
      port: 1421,
      env: {
        NODE_ENV: 'test',
        npm_config_store_dir: 'D:/pnpm/store',
      },
      cwd: 'D:/Project/cobalt-skymap',
      nextBinPath: 'D:/Project/cobalt-skymap/node_modules/next/dist/bin/next',
      spawnImpl,
    } as never);

    expect(child).toBeDefined();
    expect(buildNextDevSpawnSpec({
      port: 1421,
      env: {
        NODE_ENV: 'test',
        npm_config_store_dir: 'D:/pnpm/store',
      },
      cwd: 'D:/Project/cobalt-skymap',
      nextBinPath: 'D:/Project/cobalt-skymap/node_modules/next/dist/bin/next',
    } as never)).toMatchObject({
      command: process.execPath,
      args: [
        'D:/Project/cobalt-skymap/node_modules/next/dist/bin/next',
        'dev',
        '-p',
        '1421',
      ],
      options: {
        shell: false,
        stdio: 'inherit',
        windowsHide: true,
        cwd: 'D:/Project/cobalt-skymap',
        env: {
          PORT: '1421',
          npm_config_store_dir: 'D:/pnpm/store',
        },
      },
    });

    expect(spawnImpl).toHaveBeenCalledWith(
      process.execPath,
      [
        'D:/Project/cobalt-skymap/node_modules/next/dist/bin/next',
        'dev',
        '-p',
        '1421',
      ],
      expect.objectContaining({
        shell: false,
        stdio: 'inherit',
        windowsHide: true,
        cwd: 'D:/Project/cobalt-skymap',
        env: expect.objectContaining({
          PORT: '1421',
          npm_config_store_dir: 'D:/pnpm/store',
        }),
      }),
    );
  });
});
