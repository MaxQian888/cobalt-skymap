/**
 * Dev server startup script for Tauri development.
 *
 * Ensures the configured dev port is free before launching Next.js,
 * preventing the silent port-fallback that causes Tauri to open the
 * wrong URL.
 *
 * Usage:  node scripts/dev-server.cjs [--port <number>] [--kill]
 *   --port   Override the default dev port (default: 1420)
 *   --kill   Automatically kill the process occupying the port
 */

const net = require("net");
const { execSync, spawn } = require("child_process");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function parseCliConfig(args = process.argv.slice(2), env = process.env) {
  const killFlag = args.includes("--kill");
  const portArgIdx = args.indexOf("--port");
  const devPort =
    portArgIdx !== -1 && args[portArgIdx + 1]
      ? Number(args[portArgIdx + 1])
      : Number(env.DEV_PORT) || 1420;

  return {
    killFlag,
    devPort,
  };
}

const { killFlag, devPort: DEV_PORT } = parseCliConfig();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve once the port is confirmed free (true) or occupied (false). */
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

/** Try to find the PID using the given port (Windows & Unix). */
function findPidOnPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `netstat -ano | findstr ":${port}" | findstr "LISTENING"`,
        { encoding: "utf-8" },
      );
      const match = out.trim().split(/\s+/).pop();
      return match ? Number(match) : null;
    }
    // macOS / Linux
    const out = execSync(`lsof -ti :${port}`, { encoding: "utf-8" });
    return out.trim() ? Number(out.trim().split("\n")[0]) : null;
  } catch {
    return null;
  }
}

/** Kill a process by PID. */
function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGKILL");
    }
    return true;
  } catch {
    return false;
  }
}

function buildNextDevSpawnSpec({
  port,
  env = process.env,
  cwd = process.cwd(),
  nextBinPath = require.resolve("next/dist/bin/next"),
} = {}) {
  return {
    command: process.execPath,
    args: [nextBinPath, "dev", "-p", String(port)],
    options: {
      stdio: "inherit",
      shell: false,
      windowsHide: true,
      env: { ...env, PORT: String(port) },
      cwd,
    },
  };
}

function launchNextDevServer({
  port,
  env = process.env,
  cwd = process.cwd(),
  nextBinPath,
  spawnImpl = spawn,
} = {}) {
  const { command, args, options } = buildNextDevSpawnSpec({
    port,
    env,
    cwd,
    nextBinPath,
  });

  return spawnImpl(command, args, options);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const free = await isPortFree(DEV_PORT);

  if (!free) {
    const pid = findPidOnPort(DEV_PORT);
    const pidInfo = pid ? ` (PID: ${pid})` : "";

    if (killFlag && pid) {
      console.log(
        `⚠  Port ${DEV_PORT} is occupied${pidInfo}. --kill flag set, terminating…`,
      );
      if (killPid(pid)) {
        console.log(`✓  Killed PID ${pid}. Waiting for port to free up…`);
        // Give the OS a moment to release the port
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        console.error(`✗  Failed to kill PID ${pid}. Please free port ${DEV_PORT} manually.`);
        process.exit(1);
      }
    } else {
      console.error(
        [
          "",
          `✗  Port ${DEV_PORT} is already in use${pidInfo}.`,
          `   Tauri devUrl is configured for this port — using a different`,
          `   port would cause Tauri to open the wrong address.`,
          "",
          `   Fix options:`,
          `     1. Free the port manually:`,
          process.platform === "win32"
            ? `          netstat -ano | findstr :${DEV_PORT}`
            : `          lsof -i :${DEV_PORT}`,
          process.platform === "win32"
            ? `          taskkill /PID <pid> /F`
            : `          kill -9 <pid>`,
          `     2. Re-run with --kill flag:`,
          `          pnpm dev:tauri -- --kill`,
          "",
        ].join("\n"),
      );
      process.exit(1);
    }
  }

  console.log(`✓  Port ${DEV_PORT} is available. Starting Next.js dev server…\n`);

  // Spawn next dev with the guaranteed port
  const child = launchNextDevServer({ port: DEV_PORT });

  // Forward exit signals so Tauri can clean up
  child.on("exit", (code) => process.exit(code ?? 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
}

module.exports = {
  buildNextDevSpawnSpec,
  findPidOnPort,
  isPortFree,
  killPid,
  launchNextDevServer,
  main,
  parseCliConfig,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
