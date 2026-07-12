# Android ASTAP CLI — vendored binaries + integration guide

This directory vendors the official **ASTAP command-line solver** binaries for Android and
documents how to wire them into the Tauri Android build so plate solving works on mobile.

> **Status (2026-07-11):** Phase 2 (mobile ASTAP) — binaries vendored + verified, and
> sections **A–D below are implemented in the codebase**:
>
> - **A (Gradle)** — APPLIED: `sourceSets["main"].jniLibs.srcDir("../../../android-libs/jniLibs")`
>   is present in `gen/android/app/build.gradle.kts` (inside `android { defaultConfig }`'s parent
>   block). `gen/android` is git-ignored — **re-apply this one line after `tauri android init`**.
> - **B (nativeLibraryDir)** — DONE, **without Kotlin**: pure-Rust JNI via `ndk-context` + `jni`
>   (see `src/mobile_solver.rs::native_library_dir`). No Tauri mobile plugin project needed.
> - **C (Rust)** — DONE: platform-agnostic core extracted to `src/solver_core/` (types, FITS/INI
>   parsers, arg builder, `run_astap_solve`, database catalog + `download_astap_database`).
>   `platform::plate_solver` re-uses it (desktop API unchanged). Mobile commands in
>   `src/mobile_solver.rs`: `solve_image_local_mobile`, `cancel_plate_solve_mobile`,
>   `get_astap_databases_mobile`, `get_astap_data_dir_mobile`; `download_astap_database` is
>   registered on **both** desktop and mobile. Registered under `#[cfg(mobile)]` in `lib.rs`.
> - **D (Frontend)** — DONE: `lib/tauri/plate-solver-api.ts` gains mobile-guarded wrappers
>   (`solveImageLocalMobile`, `getAstapDatabasesMobile`, `downloadAstapDatabaseMobile`, ...);
>   `plate-solver-unified.tsx` offers Local (ASTAP-only) + Online tabs on mobile Tauri, with a
>   minimal database download UI (`mobile-astap-databases.tsx`). solve-field/astrometry options
>   are not shown on mobile.
> - **E (on-device verification)** — **STILL OPEN**: requires Android SDK/NDK + device/emulator
>   (`cargo check --target aarch64-linux-android` is blocked locally by `ring` needing NDK clang).
>   Follow section E below; the tracer-bullet (`libastap_cli.so -h`) is the first gate.
>
> Phase 1 (desktop ASTAP database download) is complete and shipped.

---

## Why this exists (the hard constraint)

- **Tauri 2 sidecar / `externalBin` does NOT support mobile** (tracking issue tauri-apps#9774),
  so `app.shell().sidecar()` cannot run `astap_cli` on Android.
- **Android 10+ (W^X / SELinux) forbids executing a binary from app data** (`/data/data/.../files`).
  Executables may only run from the app's **`nativeLibraryDir`**, which is populated from the
  APK's `jniLibs`. Therefore `astap_cli` **must be shipped inside the APK as a native library**
  (`libastap_cli.so`) — it cannot be downloaded at runtime and exec'd.
- `astrometry.net` / `solve-field` is **not viable on Android** (needs python/netpbm/Unix pipe),
  so **mobile = ASTAP only**.

## Vendored binaries

| File | ABI | Source | Verified |
|------|-----|--------|----------|
| `jniLibs/arm64-v8a/libastap_cli.so` | aarch64 (real phones) | `astap_command-line_version_Android_aarch64.zip` | ELF aarch64, 1027152 B, sha256 `c8b937037ca2b1ae2bbcb2f7adca14d4ea0f0bddd9b45e66ed5aa3d4bd5e063f` |
| `jniLibs/x86_64/libastap_cli.so` | x86_64 (emulator) | `astap_command-line_version_Android_x86_64.zip` | ELF x86-64 (NDK r15c), 976736 B, sha256 `91adffd13968942f61684d2ce81953a0eb3a928c3b0d66e2830fefed05ec2d23` |

- Renamed from `astap_cli` → `libastap_cli.so` (the `lib*.so` name is what makes Android pack &
  extract it into `nativeLibraryDir`).
- Downloaded 2026-06-12 from <https://sourceforge.net/projects/astap-program/files/android/>
  (binary date 2025-05-19). To add 32-bit ABIs, fetch `..._Android_armhf.zip` (→ `armeabi-v7a/`)
  and `..._Android_x86.zip` (→ `x86/`).
- Stored here (a **tracked** dir) on purpose: `src-tauri/gen/android/` is git-ignored and
  regenerated, so jniLibs placed there would be lost. A Gradle `sourceSets` entry (below) points
  the generated project at this tracked dir.

## Official integration recipe (from the binaries' readme.txt)

1. Rename `astap_cli` → `libastap_cli.so`, place where native libs go. *(done above)*
2. `android:extractNativeLibs="true"` in the manifest — **already the default** in this project
   (`gen/android/app/src/main/AndroidManifest.xml` has no `extractNativeLibs="false"`).
3. Execute `libastap_cli.so` **with its full path** (from `nativeLibraryDir`).

Reference working app using this technique:
<https://github.com/artyom-beilis/android_live_stacker> · discussion:
<https://www.cloudynights.com/topic/793549-astrometric-plate-solving-on-your-phone-astap-for-android/>

## Star databases on mobile (FOV ranges per readme.txt)

`D50` (0.2–6°) · `D20` (0.3–6°) · `D05` (0.6–6°) · `G05` (3–20°) · `W08` (>20°). Preset **W08**
(327 KB) in-app; download the rest via the existing `download_astap_database` command into
`app.path().app_data_dir()?/astap_data` (data files are non-executable, so app-data storage is
fine — only the *binary* must live in jniLibs).

---

## Remaining wiring (device-gated — apply on a machine with Android SDK/NDK + a device/emulator)

### A. Gradle: point the generated project at the tracked jniLibs
In `src-tauri/gen/android/app/build.gradle.kts`, inside `android { ... }` add:
```kotlin
sourceSets["main"].jniLibs.srcDir("../../../android-libs/jniLibs")
```
(`gen/android` is git-ignored/regenerated — re-apply after `tauri android init`, or script it.)

### B. Kotlin: expose `nativeLibraryDir` to Rust
Tauri's `app_data_dir()` is **not** `nativeLibraryDir`. Add a tiny Tauri Android plugin (Kotlin)
returning `applicationContext.applicationInfo.nativeLibraryDir`, modeled on the geolocation plugin
pattern. Call it from the frontend (guard `isTauri() && isMobile()`, dynamic import — mirror
`lib/tauri/geolocation-api.ts`). The frontend then has `<nativeLibraryDir>/libastap_cli.so`.

### C. Rust: a mobile solve command (verifiable with `cargo check --target aarch64-linux-android`)
The ASTAP solve logic in `src-tauri/src/platform/plate_solver/astap.rs` is platform-agnostic
(builds argv, spawns `Command`, parses INI/WCS). The whole `platform` module is `#[cfg(desktop)]`,
so extract the reusable core (`build_astap_command_args`, `parse_astap_ini_file`,
`parse_astap_result`) into a module compiled for `any(desktop, mobile)`, then add a `#[cfg(mobile)]`
command:
```rust
#[tauri::command]
pub async fn solve_image_local_mobile(
    app: AppHandle,
    executable_path: String, // <nativeLibraryDir>/libastap_cli.so, from the Kotlin bridge (B)
    config: SolverConfig,    // index_path = <app_data_dir>/astap_data
    params: SolveParameters,
) -> Result<SolveResult, PlateSolverError> { /* reuse the extracted core */ }
```
Register it under `#[cfg(mobile)]` in `lib.rs` (keep desktop registration untouched). Avoid
re-gating the whole `platform` module for mobile — it pulls desktop-only deps (updater,
app_settings) that will not build for Android.

### D. Frontend: mobile solve path
Hide local-`solve-field` and (optionally) online options on mobile; route ASTAP solves through the
new command. Preset W08 on first run; reuse the Index-Manager download UI for the rest.

### E. Device verification (tracer-bullet first)
1. `pnpm tauri android init` (if needed) → ensure the Gradle `jniLibs.srcDir` (A) is applied.
2. `pnpm tauri android dev` on an **x86_64 emulator, Android 11+** (runs both x86_64 and arm64 code).
3. **Tracer-bullet:** from the app, resolve `nativeLibraryDir` (B) and run
   `libastap_cli.so -h` / `-v`; confirm it returns a version string (proves the binary is present,
   executable, and the path is right). Manual ADB equivalent:
   `adb push astap_cli /data/local/tmp/ && adb shell chmod +x /data/local/tmp/astap_cli && adb shell /data/local/tmp/astap_cli`.
4. Push W08 + a wide-field test image; run a solve; confirm RA/Dec returned.
5. Repeat on a real arm64 device.
6. Update root `CLAUDE.md` + module docs with the shipped mobile-ASTAP capability and limits.
