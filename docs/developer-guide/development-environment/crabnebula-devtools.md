# CrabNebula DevTools

This guide explains how to debug the Cobalt Skymap desktop shell with the official CrabNebula DevTools workflow.

## Scope

- DevTools support is enabled for desktop debug sessions started with `pnpm tauri dev`.
- DevTools support is not shipped in production desktop builds.
- In desktop debug mode, Cobalt Skymap enables `tauri-plugin-devtools` and intentionally skips `tauri-plugin-log` because the two plugins conflict.
- In desktop release mode, Cobalt Skymap keeps the existing persistent `tauri-plugin-log` pipeline.

## Prerequisites

1. Install the normal Cobalt Skymap desktop development prerequisites from the development environment guide.
2. Download and install the CrabNebula DevTools desktop application from CrabNebula.
3. Keep your local Rust and Tauri toolchain up to date before testing desktop changes.

## Start a Debug Session

Run Cobalt Skymap in desktop development mode:

```bash
pnpm tauri dev
```

This starts the Next.js frontend, launches the Tauri desktop shell, and registers CrabNebula DevTools instrumentation during debug startup.

## Attach CrabNebula DevTools

1. Open the CrabNebula DevTools desktop application.
2. Wait for the running Cobalt Skymap desktop process to appear.
3. Attach to the Cobalt Skymap app from the DevTools UI.
4. Use the inspector to review windows, commands, events, and runtime logs for the active debug session.

Cobalt Skymap currently uses the standalone DevTools workflow. This change does not embed a DevTools panel inside the main application window.

## Expected Logging Behavior

- `pnpm tauri dev`: frontend console and in-memory logs stay available, and DevTools is the desktop debugging surface.
- `pnpm tauri build`: release binaries do not include DevTools instrumentation and continue using the persistent Tauri log backend.
- If the frontend logger attempts to reach the legacy Rust log backend during a debug session, it now disables repeated backend forwarding after the first failure and continues without throwing.

## Troubleshooting

### DevTools cannot see the Cobalt Skymap app

- Confirm you started Cobalt Skymap with `pnpm tauri dev` instead of a release build.
- Confirm the CrabNebula DevTools desktop app is installed and running.
- Restart both Cobalt Skymap and CrabNebula DevTools after dependency or Rust bootstrap changes.

### Desktop debug startup fails with logger initialization errors

- Check that desktop debug builds are not registering `tauri-plugin-log`.
- Keep `tauri-plugin-devtools` registration early in `src-tauri/src/lib.rs`.

### Release build behavior looks different from debug mode

- This is expected for desktop diagnostics.
- Debug builds optimize for inspection with DevTools.
- Release builds optimize for persistent log capture and packaged runtime behavior.

## Validation Checklist

- Launch `pnpm tauri dev` successfully.
- Verify the Cobalt Skymap desktop process appears in CrabNebula DevTools.
- Confirm desktop debug mode does not rely on persisted Rust log files.
- Confirm release verification still exercises the persistent Tauri log path.
