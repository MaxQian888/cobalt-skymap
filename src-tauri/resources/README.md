# Bundled resources

## astap_data/ (fetched, git-ignored)

W08 wide-field star database (FOV 20°–180°, ~0.5 MB) for the bundled ASTAP
command-line plate solver. Fetched by `pnpm fetch:astap` (see
`scripts/fetch-astap.mjs`) from
https://sourceforge.net/projects/astap-program/files/star_databases/ and
bundled via `bundle.resources` in `tauri.conf.json` (installed as
`astap_data/` in the app's resource directory).

Larger databases (G05/D05/D20/D50) are downloaded in-app via the
`download_astap_database` command into `<appData>/astap_data`.

The matching `astap_cli` executable is bundled as a Tauri sidecar from
`src-tauri/binaries/astap_cli-<target-triple>` (`bundle.externalBin`), fetched
by the same script. On Android the CLI ships via jniLibs instead — see
`src-tauri/android-libs/README.md`.

## Licensing / attribution

- ASTAP and astap_cli: © Han Kleijn, https://www.hnsky.org/astap.htm,
  Mozilla Public License 2.0 (source: https://github.com/han-k59/astap).
- Star databases are derived from ESA Gaia data — credit "ESA/Gaia/DPAC".
