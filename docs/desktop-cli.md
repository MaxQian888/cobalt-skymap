# Desktop CLI

Cobalt Skymap exposes a desktop-only CLI through the Tauri CLI plugin.

## Examples

- `Cobalt Skymap.exe --focus`
- `Cobalt Skymap.exe --settings`
- `Cobalt Skymap.exe open object M31`
- `Cobalt Skymap.exe open route search`
- `Cobalt Skymap.exe import targets D:/astro/targets.csv`
- `Cobalt Skymap.exe import session-plan D:/astro/tonight.json`
- `Cobalt Skymap.exe solve image D:/astro/m31.fits --solver astap --ra-hint 10.684 --dec-hint 41.269 --fov-hint 2.5`

## Notes

- The CLI is desktop-only.
- When Cobalt Skymap is already running, later invocations are forwarded into the existing window.
- `solve image` opens the plate-solving workflow with the provided file and optional hints.
