//! Storage module for Cobalt Skymap application
//! Provides file-based persistent storage for the desktop application

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
#[cfg(not(desktop))]
use tauri::Manager;
use thiserror::Error;

/// Storage-related errors
#[derive(Error, Debug)]
pub enum StorageError {
    #[error("Failed to get app data directory")]
    AppDataDirNotFound,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Store not found: {0}")]
    StoreNotFound(String),
    #[error("{0}")]
    Other(String),
}

impl serde::Serialize for StorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Metadata for exported data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMetadata {
    pub version: String,
    pub exported_at: DateTime<Utc>,
    pub app_version: String,
    pub store_count: usize,
}

/// Full export data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportData {
    pub metadata: ExportMetadata,
    pub stores: HashMap<String, serde_json::Value>,
}

/// Known store names for validation and export/import operations
const KNOWN_STORES: &[&str] = &[
    "starmap-target-list",
    "starmap-markers",
    "starmap-settings",
    "starmap-equipment",
    "starmap-feedback",
    "starmap-onboarding",
    "starmap-locations",
    "starmap-observation-log",
    "skymap-offline",
    "skymap-unified-cache",
    "skymap-locale",
    "skymap-solver-config",
    "skymap-app-settings",
];

/// Get the base storage directory for the application
/// Uses custom data directory if configured (desktop only), otherwise default
fn get_storage_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    #[cfg(desktop)]
    let base_dir = crate::platform::path_config::resolve_data_dir(app)?;

    #[cfg(not(desktop))]
    let base_dir = {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|_| StorageError::AppDataDirNotFound)?;
        let d = app_data_dir.join("skymap");
        if !d.exists() {
            fs::create_dir_all(&d)?;
        }
        d
    };

    let storage_dir = base_dir.join("stores");

    // Ensure the directory exists
    if !storage_dir.exists() {
        fs::create_dir_all(&storage_dir)?;
    }

    Ok(storage_dir)
}

/// Get the file path for a specific store
fn get_store_path(app: &AppHandle, store_name: &str) -> Result<PathBuf, StorageError> {
    let storage_dir = get_storage_dir(app)?;
    Ok(storage_dir.join(format!("{}.json", store_name)))
}

/// Save store data to file
///
/// Performance: uses `IgnoredAny` for cheap JSON validation (no `Value` tree
/// allocation) and `tokio::fs` for non-blocking I/O. Writes go through a
/// `.tmp` file + rename for crash-safety; on Windows and modern Linux/macOS
/// the rename is atomic so a partial write never replaces a good file.
#[tauri::command]
pub async fn save_store_data(
    app: AppHandle,
    store_name: String,
    data: String,
) -> Result<(), StorageError> {
    let path = get_store_path(&app, &store_name)?;

    // SECURITY: Validate input size to prevent DoS
    crate::network::security::validate_size(&data, crate::network::security::limits::MAX_JSON_SIZE)
        .map_err(|e| StorageError::Other(e.to_string()))?;

    // Validate JSON syntax without materializing the value tree.
    serde_json::from_slice::<serde::de::IgnoredAny>(data.as_bytes())?;

    let tmp_path = path.with_extension("json.tmp");
    tokio::fs::write(&tmp_path, &data).await?;
    if let Err(err) = tokio::fs::rename(&tmp_path, &path).await {
        // Best-effort cleanup; ignore if the temp is already gone.
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return Err(err.into());
    }

    log::info!(
        "Saved store '{}' to {:?} ({} bytes)",
        store_name,
        path,
        data.len()
    );

    Ok(())
}

/// Load store data from file
#[tauri::command]
pub async fn load_store_data(
    app: AppHandle,
    store_name: String,
) -> Result<Option<String>, StorageError> {
    let path = get_store_path(&app, &store_name)?;

    if !path.exists() {
        log::info!("Store '{}' not found at {:?}", store_name, path);
        return Ok(None);
    }

    let data = fs::read_to_string(&path)?;
    log::info!("Loaded store '{}' from {:?}", store_name, path);

    Ok(Some(data))
}

/// Delete store data
#[tauri::command]
pub async fn delete_store_data(app: AppHandle, store_name: String) -> Result<bool, StorageError> {
    let path = get_store_path(&app, &store_name)?;

    if path.exists() {
        fs::remove_file(&path)?;
        log::info!("Deleted store '{}' at {:?}", store_name, path);
        return Ok(true);
    }

    Ok(false)
}

/// List all available stores
#[tauri::command]
pub async fn list_stores(app: AppHandle) -> Result<Vec<String>, StorageError> {
    let storage_dir = get_storage_dir(&app)?;

    let mut stores = Vec::new();

    if storage_dir.exists() {
        for entry in fs::read_dir(&storage_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" {
                        if let Some(name) = path.file_stem() {
                            stores.push(name.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    Ok(stores)
}

/// Export all store data to a JSON file
#[tauri::command]
pub async fn export_all_data(app: AppHandle, export_path: String) -> Result<(), StorageError> {
    let storage_dir = get_storage_dir(&app)?;
    let mut stores: HashMap<String, serde_json::Value> = HashMap::new();

    // Read all known stores
    for store_name in KNOWN_STORES {
        let store_path = storage_dir.join(format!("{}.json", store_name));

        if store_path.exists() {
            let data = fs::read_to_string(&store_path)?;
            let value: serde_json::Value = serde_json::from_str(&data)?;
            stores.insert(store_name.to_string(), value);
        }
    }

    // Also read any additional stores that exist
    if storage_dir.exists() {
        for entry in fs::read_dir(&storage_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" {
                        if let Some(name) = path.file_stem() {
                            let name_str = name.to_string_lossy().to_string();
                            if let std::collections::hash_map::Entry::Vacant(e) =
                                stores.entry(name_str)
                            {
                                let data = fs::read_to_string(&path)?;
                                let value: serde_json::Value = serde_json::from_str(&data)?;
                                e.insert(value);
                            }
                        }
                    }
                }
            }
        }
    }

    let export_data = ExportData {
        metadata: ExportMetadata {
            version: "1.0".to_string(),
            exported_at: Utc::now(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            store_count: stores.len(),
        },
        stores,
    };

    let json = serde_json::to_string_pretty(&export_data)?;
    fs::write(&export_path, json)?;

    log::info!(
        "Exported {} stores to {}",
        export_data.metadata.store_count,
        export_path
    );

    Ok(())
}

/// Import all store data from a JSON file
#[tauri::command]
pub async fn import_all_data(
    app: AppHandle,
    import_path: String,
) -> Result<ImportResult, StorageError> {
    let data = fs::read_to_string(&import_path)?;
    let export_data: ExportData = serde_json::from_str(&data)?;

    let storage_dir = get_storage_dir(&app)?;
    let mut imported_count = 0;
    let mut skipped_count = 0;
    let mut errors: Vec<String> = Vec::new();

    for (store_name, value) in export_data.stores {
        let store_path = storage_dir.join(format!("{}.json", store_name));

        match serde_json::to_string_pretty(&value) {
            Ok(json) => match fs::write(&store_path, json) {
                Ok(_) => {
                    imported_count += 1;
                    log::info!("Imported store '{}' to {:?}", store_name, store_path);
                }
                Err(e) => {
                    errors.push(format!("{}: {}", store_name, e));
                    skipped_count += 1;
                }
            },
            Err(e) => {
                errors.push(format!("{}: {}", store_name, e));
                skipped_count += 1;
            }
        }
    }

    Ok(ImportResult {
        imported_count,
        skipped_count,
        errors,
        metadata: export_data.metadata,
    })
}

/// Result of import operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub imported_count: usize,
    pub skipped_count: usize,
    pub errors: Vec<String>,
    pub metadata: ExportMetadata,
}

/// Get the data directory path
#[tauri::command]
pub async fn get_data_directory(app: AppHandle) -> Result<String, StorageError> {
    let storage_dir = get_storage_dir(&app)?;
    Ok(storage_dir.to_string_lossy().to_string())
}

/// Get storage statistics
#[tauri::command]
pub async fn get_storage_stats(app: AppHandle) -> Result<StorageStats, StorageError> {
    let storage_dir = get_storage_dir(&app)?;

    let mut total_size: u64 = 0;
    let mut store_count: usize = 0;
    let mut stores: Vec<StoreInfo> = Vec::new();

    if storage_dir.exists() {
        for entry in fs::read_dir(&storage_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" {
                        let metadata = entry.metadata()?;
                        let size = metadata.len();
                        total_size += size;
                        store_count += 1;

                        if let Some(name) = path.file_stem() {
                            stores.push(StoreInfo {
                                name: name.to_string_lossy().to_string(),
                                size,
                                modified: metadata.modified().ok().map(DateTime::<Utc>::from),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(StorageStats {
        total_size,
        store_count,
        stores,
        directory: storage_dir.to_string_lossy().to_string(),
    })
}

/// Storage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageStats {
    pub total_size: u64,
    pub store_count: usize,
    pub stores: Vec<StoreInfo>,
    pub directory: String,
}

/// Individual store information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreInfo {
    pub name: String,
    pub size: u64,
    pub modified: Option<DateTime<Utc>>,
}

/// Clear all stored data
#[tauri::command]
pub async fn clear_all_data(app: AppHandle) -> Result<usize, StorageError> {
    let storage_dir = get_storage_dir(&app)?;
    let mut deleted_count = 0;

    if storage_dir.exists() {
        for entry in fs::read_dir(&storage_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() {
                if let Some(ext) = path.extension() {
                    if ext == "json" {
                        fs::remove_file(&path)?;
                        deleted_count += 1;
                    }
                }
            }
        }
    }

    log::info!("Cleared {} stores from {:?}", deleted_count, storage_dir);
    Ok(deleted_count)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // StorageError Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_storage_error_display() {
        let err = StorageError::AppDataDirNotFound;
        assert_eq!(format!("{}", err), "Failed to get app data directory");

        let err = StorageError::StoreNotFound("test-store".to_string());
        assert!(format!("{}", err).contains("test-store"));

        let err = StorageError::Other("Custom error".to_string());
        assert!(format!("{}", err).contains("Custom error"));
    }

    #[test]
    fn test_storage_error_serialization() {
        let err = StorageError::AppDataDirNotFound;
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("Failed to get app data directory"));
    }

    #[test]
    fn test_storage_error_from_io() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let storage_err: StorageError = io_err.into();
        assert!(format!("{}", storage_err).contains("IO error"));
    }

    // ------------------------------------------------------------------------
    // ExportMetadata Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_metadata_serialization() {
        let meta = ExportMetadata {
            version: "1.0".to_string(),
            exported_at: Utc::now(),
            app_version: "0.1.0".to_string(),
            store_count: 5,
        };

        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("\"version\":\"1.0\""));
        assert!(json.contains("\"app_version\":\"0.1.0\""));
        assert!(json.contains("\"store_count\":5"));
    }

    #[test]
    fn test_export_metadata_deserialization() {
        let json = r#"{
            "version": "2.0",
            "exported_at": "2024-01-01T12:00:00Z",
            "app_version": "1.0.0",
            "store_count": 10
        }"#;

        let meta: ExportMetadata = serde_json::from_str(json).unwrap();
        assert_eq!(meta.version, "2.0");
        assert_eq!(meta.app_version, "1.0.0");
        assert_eq!(meta.store_count, 10);
    }

    #[test]
    fn test_export_metadata_clone() {
        let meta = ExportMetadata {
            version: "1.0".to_string(),
            exported_at: Utc::now(),
            app_version: "0.1.0".to_string(),
            store_count: 3,
        };

        let cloned = meta.clone();
        assert_eq!(cloned.version, meta.version);
        assert_eq!(cloned.store_count, meta.store_count);
    }

    // ------------------------------------------------------------------------
    // ExportData Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_data_serialization() {
        let mut stores = HashMap::new();
        stores.insert(
            "test-store".to_string(),
            serde_json::json!({"key": "value"}),
        );

        let data = ExportData {
            metadata: ExportMetadata {
                version: "1.0".to_string(),
                exported_at: Utc::now(),
                app_version: "0.1.0".to_string(),
                store_count: 1,
            },
            stores,
        };

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("metadata"));
        assert!(json.contains("stores"));
        assert!(json.contains("test-store"));
    }

    #[test]
    fn test_export_data_deserialization() {
        let json = r#"{
            "metadata": {
                "version": "1.0",
                "exported_at": "2024-01-01T00:00:00Z",
                "app_version": "0.1.0",
                "store_count": 2
            },
            "stores": {
                "store1": {"data": 1},
                "store2": {"data": 2}
            }
        }"#;

        let data: ExportData = serde_json::from_str(json).unwrap();
        assert_eq!(data.metadata.store_count, 2);
        assert_eq!(data.stores.len(), 2);
        assert!(data.stores.contains_key("store1"));
    }

    // ------------------------------------------------------------------------
    // ImportResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_import_result_serialization() {
        let result = ImportResult {
            imported_count: 5,
            skipped_count: 2,
            errors: vec!["Error 1".to_string(), "Error 2".to_string()],
            metadata: ExportMetadata {
                version: "1.0".to_string(),
                exported_at: Utc::now(),
                app_version: "0.1.0".to_string(),
                store_count: 7,
            },
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"imported_count\":5"));
        assert!(json.contains("\"skipped_count\":2"));
        assert!(json.contains("Error 1"));
    }

    #[test]
    fn test_import_result_deserialization() {
        let json = r#"{
            "imported_count": 10,
            "skipped_count": 0,
            "errors": [],
            "metadata": {
                "version": "1.0",
                "exported_at": "2024-06-01T00:00:00Z",
                "app_version": "0.2.0",
                "store_count": 10
            }
        }"#;

        let result: ImportResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.imported_count, 10);
        assert_eq!(result.skipped_count, 0);
        assert!(result.errors.is_empty());
    }

    // ------------------------------------------------------------------------
    // StorageStats Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_storage_stats_serialization() {
        let stats = StorageStats {
            total_size: 1024 * 1024,
            store_count: 5,
            stores: vec![StoreInfo {
                name: "store1".to_string(),
                size: 500000,
                modified: Some(Utc::now()),
            }],
            directory: "/path/to/stores".to_string(),
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("total_size"));
        assert!(json.contains("store_count"));
        assert!(json.contains("store1"));
    }

    #[test]
    fn test_storage_stats_deserialization() {
        let json = r#"{
            "total_size": 2048,
            "store_count": 2,
            "stores": [],
            "directory": "/test/path"
        }"#;

        let stats: StorageStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.total_size, 2048);
        assert_eq!(stats.store_count, 2);
        assert_eq!(stats.directory, "/test/path");
    }

    // ------------------------------------------------------------------------
    // StoreInfo Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_store_info_serialization() {
        let info = StoreInfo {
            name: "my-store".to_string(),
            size: 4096,
            modified: Some(Utc::now()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("my-store"));
        assert!(json.contains("4096"));
    }

    #[test]
    fn test_store_info_without_modified() {
        let info = StoreInfo {
            name: "test".to_string(),
            size: 100,
            modified: None,
        };

        let json = serde_json::to_string(&info).unwrap();
        let back: StoreInfo = serde_json::from_str(&json).unwrap();
        assert!(back.modified.is_none());
    }

    #[test]
    fn test_store_info_clone() {
        let info = StoreInfo {
            name: "clone-test".to_string(),
            size: 256,
            modified: None,
        };

        let cloned = info.clone();
        assert_eq!(cloned.name, info.name);
        assert_eq!(cloned.size, info.size);
    }

    // ------------------------------------------------------------------------
    // KNOWN_STORES Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_known_stores_contains_expected() {
        // Core starmap stores
        assert!(KNOWN_STORES.contains(&"starmap-target-list"));
        assert!(KNOWN_STORES.contains(&"starmap-markers"));
        assert!(KNOWN_STORES.contains(&"starmap-settings"));
        assert!(KNOWN_STORES.contains(&"starmap-equipment"));
        assert!(KNOWN_STORES.contains(&"starmap-feedback"));
        assert!(KNOWN_STORES.contains(&"starmap-onboarding"));
        assert!(KNOWN_STORES.contains(&"starmap-locations"));
        assert!(KNOWN_STORES.contains(&"starmap-observation-log"));

        // Skymap stores
        assert!(KNOWN_STORES.contains(&"skymap-offline"));
        assert!(KNOWN_STORES.contains(&"skymap-unified-cache"));
        assert!(KNOWN_STORES.contains(&"skymap-locale"));
        assert!(KNOWN_STORES.contains(&"skymap-solver-config"));
        assert!(KNOWN_STORES.contains(&"skymap-app-settings"));
    }

    #[test]
    fn test_known_stores_count() {
        // Should have exactly 13 known stores after the update
        assert_eq!(
            KNOWN_STORES.len(),
            13,
            "Should have exactly 13 known stores, got {}",
            KNOWN_STORES.len()
        );
    }

    #[test]
    fn test_known_stores_no_duplicates() {
        let mut seen = std::collections::HashSet::new();
        for store in KNOWN_STORES {
            assert!(seen.insert(store), "Duplicate store found: {}", store);
        }
    }

    #[test]
    fn test_known_stores_naming_convention() {
        // All stores should follow naming convention (lowercase with hyphens)
        for store in KNOWN_STORES {
            assert!(
                store.chars().all(|c| c.is_ascii_lowercase() || c == '-'),
                "Store '{}' should use lowercase and hyphens only",
                store
            );
        }
    }
}
