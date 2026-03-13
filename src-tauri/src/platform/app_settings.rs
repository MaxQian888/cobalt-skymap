//! Application settings module
//! Manages window state, recent files, and app preferences

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize};

use crate::data::StorageError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub width: u32,
    pub height: u32,
    pub x: i32,
    pub y: i32,
    pub maximized: bool,
    pub fullscreen: bool,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 800,
            x: 100,
            y: 100,
            maximized: false,
            fullscreen: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFile {
    pub path: String,
    pub name: String,
    pub file_type: String,
    pub accessed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub window_state: WindowState,
    pub recent_files: Vec<RecentFile>,
    pub last_export_dir: Option<String>,
    pub last_import_dir: Option<String>,
    pub auto_save_interval: u32,
    pub check_updates: bool,
    pub telemetry_enabled: bool,
    pub theme: String,
    pub sidebar_collapsed: bool,
    pub show_welcome: bool,
    pub language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            window_state: WindowState::default(),
            recent_files: Vec::new(),
            last_export_dir: None,
            last_import_dir: None,
            auto_save_interval: 300,
            check_updates: true,
            telemetry_enabled: false,
            theme: "system".to_string(),
            sidebar_collapsed: false,
            show_welcome: true,
            language: "en".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub app_version: String,
    pub tauri_version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub family: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub os_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exe_extension: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host_id: Option<String>,
}

fn get_settings_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let dir = super::path_config::resolve_data_dir(app)?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("app_settings.json"))
}

fn to_optional_non_empty(value: String) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn derive_host_id(hostname: &str) -> Option<String> {
    let trimmed = hostname.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Stable non-reversible identifier for diagnostics grouping.
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in trimmed.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x100000001b3);
    }
    Some(format!("host-{hash:016x}"))
}

#[tauri::command]
pub async fn load_app_settings(app: AppHandle) -> Result<AppSettings, StorageError> {
    let path = get_settings_path(&app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    Ok(serde_json::from_str(&fs::read_to_string(&path)?)?)
}

#[tauri::command]
pub async fn save_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), StorageError> {
    fs::write(
        &get_settings_path(&app)?,
        serde_json::to_string_pretty(&settings)?,
    )?;
    Ok(())
}

#[tauri::command]
pub async fn save_window_state(app: AppHandle) -> Result<(), StorageError> {
    let window = app.get_webview_window("main").ok_or_else(|| {
        StorageError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Main window not found",
        ))
    })?;

    let mut settings = load_app_settings(app.clone()).await?;
    if let Ok(size) = window.outer_size() {
        settings.window_state.width = size.width;
        settings.window_state.height = size.height;
    }
    if let Ok(pos) = window.outer_position() {
        settings.window_state.x = pos.x;
        settings.window_state.y = pos.y;
    }
    if let Ok(maximized) = window.is_maximized() {
        settings.window_state.maximized = maximized;
    }
    if let Ok(fullscreen) = window.is_fullscreen() {
        settings.window_state.fullscreen = fullscreen;
    }
    save_app_settings(app, settings).await
}

#[tauri::command]
pub async fn restore_window_state(app: AppHandle) -> Result<(), StorageError> {
    let settings = load_app_settings(app.clone()).await?;
    let state = settings.window_state;

    let window = app.get_webview_window("main").ok_or_else(|| {
        StorageError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Main window not found",
        ))
    })?;

    let _ = window.set_size(PhysicalSize::new(state.width, state.height));
    let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
    if state.fullscreen {
        let _ = window.set_fullscreen(true);
    } else if state.maximized {
        let _ = window.maximize();
    }
    Ok(())
}

#[tauri::command]
pub async fn add_recent_file(
    app: AppHandle,
    path: String,
    file_type: String,
) -> Result<(), StorageError> {
    let mut settings = load_app_settings(app.clone()).await?;
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    settings.recent_files.retain(|f| f.path != path);
    settings.recent_files.insert(
        0,
        RecentFile {
            path,
            name,
            file_type,
            accessed_at: chrono::Utc::now().timestamp(),
        },
    );
    settings.recent_files.truncate(20);
    save_app_settings(app, settings).await
}

#[tauri::command]
pub async fn clear_recent_files(app: AppHandle) -> Result<(), StorageError> {
    let mut settings = load_app_settings(app.clone()).await?;
    settings.recent_files.clear();
    save_app_settings(app, settings).await
}

#[tauri::command]
pub async fn get_system_info() -> Result<SystemInfo, StorageError> {
    let detected_arch = tauri_plugin_os::arch();
    let arch = if detected_arch.trim().is_empty() {
        std::env::consts::ARCH.to_string()
    } else {
        detected_arch.to_string()
    };

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        tauri_version: tauri::VERSION.to_string(),
        platform: to_optional_non_empty(tauri_plugin_os::platform().to_string()),
        family: to_optional_non_empty(tauri_plugin_os::family().to_string()),
        os_type: to_optional_non_empty(tauri_plugin_os::type_().to_string()),
        os_version: to_optional_non_empty(tauri_plugin_os::version().to_string()),
        locale: tauri_plugin_os::locale().and_then(to_optional_non_empty),
        exe_extension: to_optional_non_empty(tauri_plugin_os::exe_extension().to_string()),
        host_id: derive_host_id(&tauri_plugin_os::hostname()),
    })
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), StorageError> {
    open::that(&path).map_err(|e| StorageError::Io(std::io::Error::other(e.to_string())))?;
    Ok(())
}

#[tauri::command]
pub async fn reveal_in_file_manager(path: String) -> Result<(), StorageError> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(StorageError::Io)?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(StorageError::Io)?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(StorageError::Io)?;
    }
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // WindowState Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_window_state_default() {
        let state = WindowState::default();
        assert_eq!(state.width, 1280);
        assert_eq!(state.height, 800);
        assert_eq!(state.x, 100);
        assert_eq!(state.y, 100);
        assert!(!state.maximized);
        assert!(!state.fullscreen);
    }

    #[test]
    fn test_window_state_serialization() {
        let state = WindowState {
            width: 1920,
            height: 1080,
            x: 0,
            y: 0,
            maximized: true,
            fullscreen: false,
        };

        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("1920"));
        assert!(json.contains("1080"));
        assert!(json.contains("maximized"));
    }

    #[test]
    fn test_window_state_deserialization() {
        let json = r#"{
            "width": 2560,
            "height": 1440,
            "x": 50,
            "y": 50,
            "maximized": false,
            "fullscreen": true
        }"#;

        let state: WindowState = serde_json::from_str(json).unwrap();
        assert_eq!(state.width, 2560);
        assert_eq!(state.height, 1440);
        assert!(state.fullscreen);
    }

    #[test]
    fn test_window_state_clone() {
        let state = WindowState::default();
        let cloned = state.clone();
        assert_eq!(cloned.width, state.width);
        assert_eq!(cloned.height, state.height);
    }

    // ------------------------------------------------------------------------
    // RecentFile Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_recent_file_serialization() {
        let file = RecentFile {
            path: "/path/to/file.json".to_string(),
            name: "file.json".to_string(),
            file_type: "target_list".to_string(),
            accessed_at: 1704067200,
        };

        let json = serde_json::to_string(&file).unwrap();
        assert!(json.contains("/path/to/file.json"));
        assert!(json.contains("file.json"));
        assert!(json.contains("target_list"));
    }

    #[test]
    fn test_recent_file_deserialization() {
        let json = r#"{
            "path": "/home/user/targets.csv",
            "name": "targets.csv",
            "file_type": "csv",
            "accessed_at": 1704153600
        }"#;

        let file: RecentFile = serde_json::from_str(json).unwrap();
        assert_eq!(file.name, "targets.csv");
        assert_eq!(file.file_type, "csv");
    }

    // ------------------------------------------------------------------------
    // AppSettings Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_app_settings_default() {
        let settings = AppSettings::default();
        assert_eq!(settings.window_state.width, 1280);
        assert!(settings.recent_files.is_empty());
        assert!(settings.last_export_dir.is_none());
        assert_eq!(settings.auto_save_interval, 300);
        assert!(settings.check_updates);
        assert!(!settings.telemetry_enabled);
        assert_eq!(settings.theme, "system");
        assert!(!settings.sidebar_collapsed);
        assert!(settings.show_welcome);
        assert_eq!(settings.language, "en");
    }

    #[test]
    fn test_app_settings_serialization() {
        let settings = AppSettings {
            window_state: WindowState::default(),
            recent_files: vec![RecentFile {
                path: "/test.json".to_string(),
                name: "test.json".to_string(),
                file_type: "json".to_string(),
                accessed_at: 0,
            }],
            last_export_dir: Some("/exports".to_string()),
            last_import_dir: None,
            auto_save_interval: 60,
            check_updates: false,
            telemetry_enabled: true,
            theme: "dark".to_string(),
            sidebar_collapsed: true,
            show_welcome: false,
            language: "zh".to_string(),
        };

        let json = serde_json::to_string(&settings).unwrap();
        assert!(json.contains("window_state"));
        assert!(json.contains("recent_files"));
        assert!(json.contains("dark"));
        assert!(json.contains("zh"));
    }

    #[test]
    fn test_app_settings_deserialization() {
        let json = r#"{
            "window_state": {"width": 1920, "height": 1080, "x": 0, "y": 0, "maximized": true, "fullscreen": false},
            "recent_files": [],
            "last_export_dir": null,
            "last_import_dir": "/imports",
            "auto_save_interval": 120,
            "check_updates": true,
            "telemetry_enabled": false,
            "theme": "light",
            "sidebar_collapsed": false,
            "show_welcome": true,
            "language": "en"
        }"#;

        let settings: AppSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.window_state.width, 1920);
        assert!(settings.window_state.maximized);
        assert_eq!(settings.last_import_dir, Some("/imports".to_string()));
        assert_eq!(settings.theme, "light");
    }

    #[test]
    fn test_app_settings_clone() {
        let settings = AppSettings::default();
        let cloned = settings.clone();
        assert_eq!(cloned.language, settings.language);
        assert_eq!(cloned.theme, settings.theme);
    }

    // ------------------------------------------------------------------------
    // SystemInfo Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_system_info_serialization() {
        let info = SystemInfo {
            os: "windows".to_string(),
            arch: "x86_64".to_string(),
            app_version: "0.1.0".to_string(),
            tauri_version: "2.0.0".to_string(),
            platform: Some("windows".to_string()),
            family: Some("windows".to_string()),
            os_type: Some("Windows_NT".to_string()),
            os_version: Some("11".to_string()),
            locale: Some("en-US".to_string()),
            exe_extension: Some("exe".to_string()),
            host_id: Some("host-1234abcd".to_string()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("windows"));
        assert!(json.contains("x86_64"));
        assert!(json.contains("0.1.0"));
        assert!(json.contains("host-1234abcd"));
    }

    #[test]
    fn test_system_info_deserialization() {
        let json = r#"{
            "os": "macos",
            "arch": "aarch64",
            "app_version": "1.0.0",
            "tauri_version": "2.1.0"
        }"#;

        let info: SystemInfo = serde_json::from_str(json).unwrap();
        assert_eq!(info.os, "macos");
        assert_eq!(info.arch, "aarch64");
        assert_eq!(info.host_id, None);
    }

    #[test]
    fn test_system_info_clone() {
        let info = SystemInfo {
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            app_version: "0.1.0".to_string(),
            tauri_version: "2.0.0".to_string(),
            platform: Some("linux".to_string()),
            family: Some("unix".to_string()),
            os_type: Some("Linux".to_string()),
            os_version: Some("6.10".to_string()),
            locale: Some("en-US".to_string()),
            exe_extension: None,
            host_id: Some("host-4f2d10aa".to_string()),
        };

        let cloned = info.clone();
        assert_eq!(cloned.os, info.os);
        assert_eq!(cloned.host_id, info.host_id);
    }

    #[test]
    fn test_system_info_deserialization_with_optional_fields() {
        let json = r#"{
            "os": "linux",
            "arch": "x86_64",
            "app_version": "1.0.0",
            "tauri_version": "2.2.0",
            "platform": "linux",
            "family": "unix",
            "os_type": "Linux",
            "os_version": "6.8",
            "locale": "en-US",
            "exe_extension": "",
            "host_id": "host-b53f4ba2"
        }"#;

        let info: SystemInfo = serde_json::from_str(json).unwrap();
        assert_eq!(info.platform.as_deref(), Some("linux"));
        assert_eq!(info.host_id.as_deref(), Some("host-b53f4ba2"));
        assert_eq!(info.exe_extension.as_deref(), Some(""));
    }

    #[test]
    fn test_derive_host_id_is_stable() {
        let first = derive_host_id("observatory-host");
        let second = derive_host_id("observatory-host");
        let third = derive_host_id("different-host");

        assert_eq!(first, second);
        assert_ne!(first, third);
        assert!(first.unwrap().starts_with("host-"));
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_multiple_recent_files() {
        let settings = AppSettings {
            recent_files: (0..10)
                .map(|i| RecentFile {
                    path: format!("/file{}.json", i),
                    name: format!("file{}.json", i),
                    file_type: "json".to_string(),
                    accessed_at: i as i64,
                })
                .collect(),
            ..AppSettings::default()
        };

        let json = serde_json::to_string(&settings).unwrap();
        let back: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(back.recent_files.len(), 10);
    }

    #[test]
    fn test_window_state_extreme_values() {
        let state = WindowState {
            width: 7680,  // 8K width
            height: 4320, // 8K height
            x: -100,      // Negative position (multi-monitor)
            y: -50,
            maximized: false,
            fullscreen: false,
        };

        let json = serde_json::to_string(&state).unwrap();
        let back: WindowState = serde_json::from_str(&json).unwrap();
        assert_eq!(back.width, 7680);
        assert_eq!(back.x, -100);
    }

    #[test]
    fn test_all_themes() {
        let themes = vec!["system", "light", "dark"];

        for theme in themes {
            let settings = AppSettings {
                theme: theme.to_string(),
                ..AppSettings::default()
            };

            let json = serde_json::to_string(&settings).unwrap();
            let back: AppSettings = serde_json::from_str(&json).unwrap();
            assert_eq!(back.theme, theme);
        }
    }

    #[test]
    fn test_language_options() {
        let languages = vec!["en", "zh", "ja", "de", "fr"];

        for lang in languages {
            let settings = AppSettings {
                language: lang.to_string(),
                ..AppSettings::default()
            };

            let json = serde_json::to_string(&settings).unwrap();
            let back: AppSettings = serde_json::from_str(&json).unwrap();
            assert_eq!(back.language, lang);
        }
    }
}
