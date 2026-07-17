# rust-platform Module

[Root](../../../CLAUDE.md) > [src-tauri/src](../) > **platform**

> **Last Updated:** 2025-01-31
> **Module Type:** Rust (Desktop Only)

---

## Breadcrumb

`[Root](../../../CLAUDE.md) > [src-tauri/src](../) > **platform**`

---

## Module Responsibility

The `platform` module provides desktop-only features including app settings persistence, window management, auto-updates, and plate solver integration.

**Note:** This module is only available on desktop platforms (Windows, macOS, Linux). Mobile apps use different approaches for these features.

---

## Files

| File | Purpose |
|------|---------|
| `mod.rs` | Module exports |
| `app_settings.rs` | App settings persistence |
| `app_control.rs` | App restart, quit, reload |
| `updater.rs` | Auto-update functionality |
| `plate_solver.rs` | Plate solving integration |

---

## Tauri Commands

### App Settings Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `load_app_settings` | - | `AppSettings` | Load settings |
| `save_app_settings` | settings | `()` | Save settings |
| `save_window_state` | state | `()` | Save window state |
| `restore_window_state` | - | `WindowState` | Get window state |
| `add_recent_file` | path | `()` | Add recent file |
| `clear_recent_files` | - | `()` | Clear recents |
| `get_system_info` | - | `SystemInfo` | Get system info |
| `open_path` | path | `()` | Open file/folder |
| `reveal_in_file_manager` | path | `()` | Show in explorer |

### App Control Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `restart_app` | - | `()` | Restart app |
| `quit_app` | - | `()` | Quit app |
| `reload_webview` | - | `()` | Reload webview |
| `is_dev_mode` | - | `bool` | Check dev mode |
| `is_tray_positioning_ready` | - | `bool` | Tray-relative positioning ready |
| `update_tray_menu` | labels | `()` | Rebuild tray menu with localized labels |
| `set_close_to_tray` | enabled | `()` | Hide window to tray on close vs. quit |

### Updater Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `check_for_update` | - | `UpdateInfo` | Check updates |
| `download_update` | - | `()` | Download update |
| `install_update` | - | `()` | Install update |
| `download_and_install_update` | - | `()` | Download + install |
| `get_current_version` | - | `String` | Get version |
| `clear_pending_update` | - | `()` | Clear pending |
| `has_pending_update` | - | `bool` | Check pending |

### Plate Solver Commands

| Command | Parameters | Returns | Description |
|---------|------------|---------|-------------|
| `detect_plate_solvers` | - | `Vec<SolverInfo>` | Detect solvers |
| `plate_solve` | image, config | `SolveResult` | Solve image |
| `get_solver_info` | path | `SolverInfo` | Get solver info |
| `validate_solver_path` | path | `bool` | Validate path |
| `solve_image_local` | image, index | `SolveResult` | Local solve |
| `get_solver_indexes` | solver | `Vec<Index>` | Get indexes |
| `get_available_indexes` | - | `Vec<Index>` | Available indexes |
| `get_installed_indexes` | - | `Vec<Index>` | Installed indexes |
| `get_downloadable_indexes` | - | `Vec<Index>` | Downloadable |
| `get_recommended_indexes` | fov | `Vec<Index>` | Recommended |
| `download_index` | url, path | `()` | Download index |
| `delete_index` | path | `()` | Delete index |
| `get_default_index_path` | - | `String` | Default index |
| `load_solver_config` | - | `SolverConfig` | Load config |
| `save_solver_config` | config | `()` | Save config |

---

## Data Types

### App Settings

```rust
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub auto_update: bool,
    pub check_updates_on_startup: bool,
    pub recent_files: Vec<String>,
    pub window_state: WindowState,
}

pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub is_maximized: bool,
    pub is_fullscreen: bool,
}
```

### Update Types

```rust
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
    pub release_notes: String,
    pub size: u64,
}
```

### Plate Solver Types

```rust
pub struct SolverInfo {
    pub name: String,
    pub path: String,
    pub version: String,
    pub is_available: bool,
}

pub struct SolveResult {
    pub success: bool,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub orientation: Option<f64>,
    pub pixel_scale: Option<f64>,
    pub error: Option<String>,
}

pub struct Index {
    pub name: String,
    pub path: String,
    pub url: String,
    pub size: u64,
    pub fov_min: f64,
    pub fov_max: f64,
}
```

---

## Platform Differences

### Windows

- Uses `WebView2` for webview
- Updates via MSIX or NSIS installer
- File explorer integration via `explorer.exe`

### macOS

- Uses WKWebView
- Updates via DMG or Sparkle
- File explorer via `open` and `open -R`

### Linux

- Uses WebKitGTK
- Updates via AppImage or deb/rpm
- File explorer via `xdg-open`

---

## Related Files

- [`mod.rs`](./mod.rs) - Module exports
- [`app_settings.rs`](./app_settings.rs) - Settings
- [`app_control.rs`](./app_control.rs) - App control
- [`updater.rs`](./updater.rs) - Updates
- [`plate_solver.rs`](./plate_solver.rs) - Plate solving
- [../CLAUDE.md](../CLAUDE.md) - Backend documentation
