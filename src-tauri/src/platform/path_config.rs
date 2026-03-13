//! Path configuration module
//! Allows users to customize data and cache storage directories
//! Configuration is always stored in the default app_data_dir to ensure it can be found on startup

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

use crate::data::StorageError;

// ============================================================================
// Types
// ============================================================================

/// User-customizable path configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathConfig {
    /// Custom data directory (stores, settings, solver config)
    /// When None, uses default app_data_dir/skymap
    pub custom_data_dir: Option<String>,
    /// Custom cache directory (offline tiles, unified cache)
    /// When None, uses default app_data_dir/skymap
    pub custom_cache_dir: Option<String>,
}

impl Default for PathConfig {
    fn default() -> Self {
        Self {
            custom_data_dir: None,
            custom_cache_dir: None,
        }
    }
}

/// Full path information returned to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathInfo {
    /// Current effective data directory
    pub data_dir: String,
    /// Current effective cache directory
    pub cache_dir: String,
    /// Default data directory (for reference)
    pub default_data_dir: String,
    /// Default cache directory (for reference)
    pub default_cache_dir: String,
    /// Whether a custom data directory is set
    pub has_custom_data_dir: bool,
    /// Whether a custom cache directory is set
    pub has_custom_cache_dir: bool,
}

/// Result of directory validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DirectoryValidation {
    pub valid: bool,
    pub exists: bool,
    pub writable: bool,
    pub available_bytes: Option<u64>,
    pub error: Option<String>,
}

/// Result of data migration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationResult {
    pub success: bool,
    pub files_copied: usize,
    pub bytes_copied: u64,
    pub error: Option<String>,
}

// ============================================================================
// Global Config Cache
// ============================================================================

static PATH_CONFIG: OnceLock<Mutex<Option<PathConfig>>> = OnceLock::new();

fn get_config_mutex() -> &'static Mutex<Option<PathConfig>> {
    PATH_CONFIG.get_or_init(|| Mutex::new(None))
}

// ============================================================================
// Internal Helpers
// ============================================================================

/// Get the fixed config file path (always in default app_data_dir)
fn get_config_file_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| StorageError::AppDataDirNotFound)?;
    let dir = app_data_dir.join("skymap");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("path_config.json"))
}

/// Get the default base directory for data/cache
fn get_default_base_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| StorageError::AppDataDirNotFound)?;
    let base = app_data_dir.join("skymap");
    if !base.exists() {
        fs::create_dir_all(&base)?;
    }
    Ok(base)
}

/// Load path config from disk
fn load_config_from_disk(app: &AppHandle) -> Result<PathConfig, StorageError> {
    let path = get_config_file_path(app)?;
    if !path.exists() {
        return Ok(PathConfig::default());
    }
    let data = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&data).unwrap_or_default())
}

/// Save path config to disk
fn save_config_to_disk(app: &AppHandle, config: &PathConfig) -> Result<(), StorageError> {
    let path = get_config_file_path(app)?;
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&path, json)?;
    Ok(())
}

/// Get cached config or load from disk
fn get_config(app: &AppHandle) -> Result<PathConfig, StorageError> {
    let mutex = get_config_mutex();
    let mut guard = mutex
        .lock()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;

    if let Some(config) = &*guard {
        return Ok(config.clone());
    }

    let config = load_config_from_disk(app)?;
    *guard = Some(config.clone());
    Ok(config)
}

/// Update cached config and persist to disk
fn update_config(app: &AppHandle, config: PathConfig) -> Result<(), StorageError> {
    save_config_to_disk(app, &config)?;
    let mutex = get_config_mutex();
    let mut guard = mutex
        .lock()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;
    *guard = Some(config);
    Ok(())
}

/// Validate a directory path without creating it (read-only check).
/// Checks the parent directory for writability if the path doesn't exist yet.
fn validate_dir(path: &str) -> DirectoryValidation {
    let p = PathBuf::from(path);

    if path.is_empty() {
        return DirectoryValidation {
            valid: false,
            exists: false,
            writable: false,
            available_bytes: None,
            error: Some("Path is empty".to_string()),
        };
    }

    let exists = p.exists();

    // Determine the directory to check for writability:
    // - If it exists, check the directory itself
    // - If not, check the nearest existing ancestor
    let check_dir = if exists {
        p.clone()
    } else {
        let mut ancestor = p.parent().map(|p| p.to_path_buf());
        while let Some(ref dir) = ancestor {
            if dir.exists() {
                break;
            }
            ancestor = dir.parent().map(|p| p.to_path_buf());
        }
        match ancestor {
            Some(dir) => dir,
            None => {
                return DirectoryValidation {
                    valid: false,
                    exists: false,
                    writable: false,
                    available_bytes: None,
                    error: Some("No accessible parent directory found".to_string()),
                };
            }
        }
    };

    // Check writability by creating a temp file in the check directory
    let test_file = check_dir.join(".skymap_write_test");
    let writable = match fs::write(&test_file, "test") {
        Ok(_) => {
            let _ = fs::remove_file(&test_file);
            true
        }
        Err(_) => false,
    };

    // Get available space (platform-specific)
    let available_bytes = get_available_space(&check_dir);

    DirectoryValidation {
        valid: writable,
        exists,
        writable,
        available_bytes,
        error: if !writable {
            Some("Directory is not writable".to_string())
        } else {
            None
        },
    }
}

/// Get available disk space for a path using native OS APIs.
/// Safe, fast, and cross-platform (no shell commands).
fn get_available_space(path: &PathBuf) -> Option<u64> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        // Convert path to wide string for Windows API
        let wide: Vec<u16> = path
            .as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut free_bytes_available: u64 = 0;
        let ret = unsafe {
            windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                wide.as_ptr(),
                &mut free_bytes_available as *mut u64,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            )
        };
        if ret != 0 {
            Some(free_bytes_available)
        } else {
            None
        }
    }

    #[cfg(unix)]
    {
        use std::ffi::CString;
        let c_path = CString::new(path.to_str()?).ok()?;
        unsafe {
            let mut stat: libc::statvfs = std::mem::zeroed();
            if libc::statvfs(c_path.as_ptr(), &mut stat) == 0 {
                Some(stat.f_bavail as u64 * stat.f_frsize as u64)
            } else {
                None
            }
        }
    }
}

/// Copy directory contents recursively
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(usize, u64), StorageError> {
    if !src.exists() {
        return Ok((0, 0));
    }
    if !dst.exists() {
        fs::create_dir_all(dst)?;
    }

    let mut files_copied = 0usize;
    let mut bytes_copied = 0u64;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            let (f, b) = copy_dir_recursive(&src_path, &dst_path)?;
            files_copied += f;
            bytes_copied += b;
        } else if src_path.is_file() {
            fs::copy(&src_path, &dst_path)?;
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            files_copied += 1;
            bytes_copied += size;
        }
    }

    Ok((files_copied, bytes_copied))
}

// ============================================================================
// Public API (used by other Rust modules)
// ============================================================================

/// Resolve the effective data directory
/// Returns custom_data_dir if set and valid, otherwise default
pub fn resolve_data_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let config = get_config(app)?;
    if let Some(ref custom) = config.custom_data_dir {
        let p = PathBuf::from(custom);
        if p.exists() || fs::create_dir_all(&p).is_ok() {
            return Ok(p);
        }
        log::warn!(
            "Custom data dir '{}' is not accessible, falling back to default",
            custom
        );
    }
    get_default_base_dir(app)
}

/// Resolve the effective cache directory
/// Returns custom_cache_dir if set and valid, otherwise default
pub fn resolve_cache_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let config = get_config(app)?;
    if let Some(ref custom) = config.custom_cache_dir {
        let p = PathBuf::from(custom);
        if p.exists() || fs::create_dir_all(&p).is_ok() {
            return Ok(p);
        }
        log::warn!(
            "Custom cache dir '{}' is not accessible, falling back to default",
            custom
        );
    }
    get_default_base_dir(app)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Get current path configuration
#[tauri::command]
pub async fn get_path_config(app: AppHandle) -> Result<PathInfo, StorageError> {
    let config = get_config(&app)?;
    let default_base = get_default_base_dir(&app)?;
    let data_dir = resolve_data_dir(&app)?;
    let cache_dir = resolve_cache_dir(&app)?;

    Ok(PathInfo {
        data_dir: data_dir.to_string_lossy().to_string(),
        cache_dir: cache_dir.to_string_lossy().to_string(),
        default_data_dir: default_base.to_string_lossy().to_string(),
        default_cache_dir: default_base.to_string_lossy().to_string(),
        has_custom_data_dir: config.custom_data_dir.is_some(),
        has_custom_cache_dir: config.custom_cache_dir.is_some(),
    })
}

/// Set custom data directory (does not migrate data)
#[tauri::command]
pub async fn set_custom_data_dir(app: AppHandle, path: String) -> Result<(), StorageError> {
    let validation = validate_dir(&path);
    if !validation.valid {
        return Err(StorageError::Other(
            validation
                .error
                .unwrap_or_else(|| "Directory is not valid".to_string()),
        ));
    }

    let mut config = get_config(&app)?;
    config.custom_data_dir = Some(path.clone());
    update_config(&app, config)?;
    log::info!("Custom data directory set to: {}", path);
    Ok(())
}

/// Set custom cache directory (does not migrate data)
#[tauri::command]
pub async fn set_custom_cache_dir(app: AppHandle, path: String) -> Result<(), StorageError> {
    let validation = validate_dir(&path);
    if !validation.valid {
        return Err(StorageError::Other(
            validation
                .error
                .unwrap_or_else(|| "Directory is not valid".to_string()),
        ));
    }

    let mut config = get_config(&app)?;
    config.custom_cache_dir = Some(path.clone());
    update_config(&app, config)?;
    log::info!("Custom cache directory set to: {}", path);
    Ok(())
}

/// Migrate data to a new directory
#[tauri::command]
pub async fn migrate_data_dir(
    app: AppHandle,
    target_dir: String,
) -> Result<MigrationResult, StorageError> {
    let validation = validate_dir(&target_dir);
    if !validation.valid {
        return Ok(MigrationResult {
            success: false,
            files_copied: 0,
            bytes_copied: 0,
            error: validation.error,
        });
    }

    let current_data_dir = resolve_data_dir(&app)?;
    let target = PathBuf::from(&target_dir);

    // Don't migrate to the same directory
    if current_data_dir == target {
        return Ok(MigrationResult {
            success: true,
            files_copied: 0,
            bytes_copied: 0,
            error: None,
        });
    }

    // Copy stores directory
    let stores_src = current_data_dir.join("stores");
    let stores_dst = target.join("stores");
    let (mut total_files, mut total_bytes) = copy_dir_recursive(&stores_src, &stores_dst)?;

    // Copy individual config files
    let config_files = ["app_settings.json", "solver_config.json"];
    for filename in &config_files {
        let src = current_data_dir.join(filename);
        if src.exists() {
            let dst = target.join(filename);
            let size = fs::metadata(&src).map(|m| m.len()).unwrap_or(0);
            fs::copy(&src, &dst)?;
            total_files += 1;
            total_bytes += size;
        }
    }

    // Update config to use new directory
    let mut config = get_config(&app)?;
    config.custom_data_dir = Some(target_dir.clone());
    update_config(&app, config)?;

    log::info!(
        "Data migrated to '{}': {} files, {} bytes",
        target_dir,
        total_files,
        total_bytes
    );

    Ok(MigrationResult {
        success: true,
        files_copied: total_files,
        bytes_copied: total_bytes,
        error: None,
    })
}

/// Migrate cache to a new directory
#[tauri::command]
pub async fn migrate_cache_dir(
    app: AppHandle,
    target_dir: String,
) -> Result<MigrationResult, StorageError> {
    let validation = validate_dir(&target_dir);
    if !validation.valid {
        return Ok(MigrationResult {
            success: false,
            files_copied: 0,
            bytes_copied: 0,
            error: validation.error,
        });
    }

    let current_cache_dir = resolve_cache_dir(&app)?;
    let target = PathBuf::from(&target_dir);

    // Don't migrate to the same directory
    if current_cache_dir == target {
        return Ok(MigrationResult {
            success: true,
            files_copied: 0,
            bytes_copied: 0,
            error: None,
        });
    }

    // Copy cache directory
    let cache_src = current_cache_dir.join("cache");
    let cache_dst = target.join("cache");
    let (mut total_files, mut total_bytes) = copy_dir_recursive(&cache_src, &cache_dst)?;

    // Copy unified_cache directory
    let unified_src = current_cache_dir.join("unified_cache");
    let unified_dst = target.join("unified_cache");
    let (f, b) = copy_dir_recursive(&unified_src, &unified_dst)?;
    total_files += f;
    total_bytes += b;

    // Update config to use new directory
    let mut config = get_config(&app)?;
    config.custom_cache_dir = Some(target_dir.clone());
    update_config(&app, config)?;

    log::info!(
        "Cache migrated to '{}': {} files, {} bytes",
        target_dir,
        total_files,
        total_bytes
    );

    Ok(MigrationResult {
        success: true,
        files_copied: total_files,
        bytes_copied: total_bytes,
        error: None,
    })
}

/// Reset all paths to default
#[tauri::command]
pub async fn reset_paths_to_default(app: AppHandle) -> Result<(), StorageError> {
    update_config(&app, PathConfig::default())?;
    log::info!("Path configuration reset to defaults");
    Ok(())
}

/// Validate a directory path
#[tauri::command]
pub async fn validate_directory(path: String) -> Result<DirectoryValidation, StorageError> {
    Ok(validate_dir(&path))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_path_config_default() {
        let config = PathConfig::default();
        assert!(config.custom_data_dir.is_none());
        assert!(config.custom_cache_dir.is_none());
    }

    #[test]
    fn test_path_config_serialization() {
        let config = PathConfig {
            custom_data_dir: Some("/custom/data".to_string()),
            custom_cache_dir: Some("/custom/cache".to_string()),
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("/custom/data"));
        assert!(json.contains("/custom/cache"));
    }

    #[test]
    fn test_path_config_deserialization() {
        let json = r#"{"custom_data_dir": "/my/data", "custom_cache_dir": null}"#;
        let config: PathConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.custom_data_dir, Some("/my/data".to_string()));
        assert!(config.custom_cache_dir.is_none());
    }

    #[test]
    fn test_path_info_serialization() {
        let info = PathInfo {
            data_dir: "/data".to_string(),
            cache_dir: "/cache".to_string(),
            default_data_dir: "/default".to_string(),
            default_cache_dir: "/default".to_string(),
            has_custom_data_dir: true,
            has_custom_cache_dir: false,
        };
        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("has_custom_data_dir"));
    }

    #[test]
    fn test_directory_validation_serialization() {
        let v = DirectoryValidation {
            valid: true,
            exists: true,
            writable: true,
            available_bytes: Some(1024 * 1024 * 1024),
            error: None,
        };
        let json = serde_json::to_string(&v).unwrap();
        assert!(json.contains("\"valid\":true"));
    }

    #[test]
    fn test_migration_result_serialization() {
        let r = MigrationResult {
            success: true,
            files_copied: 10,
            bytes_copied: 5000,
            error: None,
        };
        let json = serde_json::to_string(&r).unwrap();
        assert!(json.contains("\"files_copied\":10"));
    }

    #[test]
    fn test_validate_empty_path() {
        let v = validate_dir("");
        assert!(!v.valid);
        assert!(v.error.is_some());
    }

    #[test]
    fn test_validate_temp_dir() {
        // Validate a non-existent subdirectory — should check parent writability
        let temp = std::env::temp_dir().join("skymap_test_validate_nonexistent");
        // Ensure it doesn't exist before validation
        let _ = fs::remove_dir_all(&temp);
        let v = validate_dir(temp.to_str().unwrap());
        assert!(v.valid, "parent temp dir should be writable");
        assert!(v.writable);
        assert!(!v.exists, "validate_dir should not create the directory");

        // Also validate an existing directory
        fs::create_dir_all(&temp).unwrap();
        let v2 = validate_dir(temp.to_str().unwrap());
        assert!(v2.valid);
        assert!(v2.exists);
        // Cleanup
        let _ = fs::remove_dir_all(&temp);
    }

    #[test]
    fn test_copy_dir_recursive_empty() {
        let src = PathBuf::from("/nonexistent_skymap_test_src");
        let dst = std::env::temp_dir().join("skymap_test_copy_dst");
        let (files, bytes) = copy_dir_recursive(&src, &dst).unwrap();
        assert_eq!(files, 0);
        assert_eq!(bytes, 0);
        let _ = fs::remove_dir_all(&dst);
    }
}
