//! Common utilities module
//! Provides shared functionality for ID generation and path management

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

// ============================================================================
// Path Utilities
// ============================================================================

/// Error type for path operations
#[derive(Debug, thiserror::Error)]
pub enum PathError {
    #[error("Failed to get app data directory")]
    AppDataDirNotFound,
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Get the base application data directory
/// Creates the directory if it doesn't exist
pub fn get_app_data_dir(app: &AppHandle) -> Result<PathBuf, PathError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| PathError::AppDataDirNotFound)?;

    let skymap_dir = app_data_dir.join("skymap");

    if !skymap_dir.exists() {
        fs::create_dir_all(&skymap_dir)?;
    }

    Ok(skymap_dir)
}

/// Get a subdirectory under the app data directory
/// Creates the directory if it doesn't exist
pub fn get_app_subdir(app: &AppHandle, subdir: &str) -> Result<PathBuf, PathError> {
    let base_dir = get_app_data_dir(app)?;
    let sub_dir = base_dir.join(subdir);

    if !sub_dir.exists() {
        fs::create_dir_all(&sub_dir)?;
    }

    Ok(sub_dir)
}

/// Get a file path under the app data directory
/// Creates parent directories if they don't exist
pub fn get_app_file_path(
    app: &AppHandle,
    subdir: &str,
    filename: &str,
) -> Result<PathBuf, PathError> {
    let dir = get_app_subdir(app, subdir)?;
    Ok(dir.join(filename))
}

/// Perform atomic file write using temp file and rename
/// This ensures data integrity even if the operation is interrupted
pub fn atomic_write(path: &PathBuf, data: &[u8]) -> Result<(), PathError> {
    let temp_path = path.with_extension("tmp");

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    // Write to temp file first
    fs::write(&temp_path, data)?;

    // Atomic rename
    fs::rename(&temp_path, path)?;

    Ok(())
}

/// Perform atomic JSON write with pretty formatting
pub fn atomic_write_json<T: serde::Serialize>(path: &PathBuf, data: &T) -> Result<(), PathError> {
    let json = serde_json::to_string_pretty(data)
        .map_err(|e| PathError::Io(std::io::Error::new(std::io::ErrorKind::InvalidData, e)))?;
    atomic_write(path, json.as_bytes())
}

// ============================================================================
// Fast ID Generation
// ============================================================================

/// Atomic counter for unique IDs within the same millisecond
static ID_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Generate a fast, unique ID with a given prefix
/// Uses timestamp + counter + random for uniqueness without UUID overhead
#[inline]
pub fn generate_id(prefix: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    let counter = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    // Simple random based on nanoseconds
    let random = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos()
        .wrapping_mul(1103515245)
        .wrapping_add(12345);
    format!(
        "{}-{:x}{:04x}{:08x}",
        prefix,
        timestamp,
        counter & 0xFFFF,
        random
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    // ------------------------------------------------------------------------
    // ID Generation Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_generate_id_uniqueness() {
        let id1 = generate_id("test");
        let id2 = generate_id("test");
        assert!(id1.starts_with("test-"));
        assert!(id2.starts_with("test-"));
        assert_ne!(id1, id2, "IDs should be unique");
    }

    #[test]
    fn test_generate_id_prefix() {
        let id = generate_id("marker");
        assert!(id.starts_with("marker-"));

        let id2 = generate_id("session");
        assert!(id2.starts_with("session-"));
    }

    #[test]
    fn test_generate_id_format() {
        let id = generate_id("test");
        // Format: prefix-timestamp_hex+counter_hex+random_hex
        let parts: Vec<&str> = id.split('-').collect();
        assert_eq!(parts.len(), 2);
        assert_eq!(parts[0], "test");
        // The second part should be hex characters
        assert!(parts[1].chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_generate_id_multiple_rapid() {
        // Generate multiple IDs rapidly and verify uniqueness
        let mut ids = Vec::new();
        for _ in 0..100 {
            ids.push(generate_id("rapid"));
        }

        // Check all IDs are unique
        let unique_count = ids.iter().collect::<std::collections::HashSet<_>>().len();
        assert_eq!(unique_count, 100, "All 100 IDs should be unique");
    }

    #[test]
    fn test_generate_id_empty_prefix() {
        let id = generate_id("");
        assert!(
            id.starts_with("-"),
            "Empty prefix should result in leading dash"
        );
    }

    // ------------------------------------------------------------------------
    // Path Error Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_path_error_display() {
        let err = PathError::AppDataDirNotFound;
        assert_eq!(err.to_string(), "Failed to get app data directory");

        let io_err = PathError::Io(std::io::Error::new(std::io::ErrorKind::NotFound, "test"));
        assert!(io_err.to_string().contains("test"));
    }

    // ------------------------------------------------------------------------
    // Atomic Write Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_atomic_write_creates_file() {
        let temp_dir = env::temp_dir();
        let test_file = temp_dir.join(format!("skymap_test_{}.txt", generate_id("test")));

        let data = b"test data content";
        let result = atomic_write(&test_file, data);

        assert!(result.is_ok(), "Atomic write should succeed");
        assert!(test_file.exists(), "File should exist after write");

        // Verify content
        let content = fs::read(&test_file).unwrap();
        assert_eq!(content, data);

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_atomic_write_creates_parent_dirs() {
        let temp_dir = env::temp_dir();
        let nested_path = temp_dir
            .join(format!("skymap_test_{}", generate_id("dir")))
            .join("nested")
            .join("test.txt");

        let data = b"nested content";
        let result = atomic_write(&nested_path, data);

        assert!(result.is_ok(), "Atomic write should create parent dirs");
        assert!(nested_path.exists(), "Nested file should exist");

        // Cleanup
        let _ = fs::remove_file(&nested_path);
        let _ = fs::remove_dir_all(nested_path.parent().unwrap().parent().unwrap());
    }

    #[test]
    fn test_atomic_write_overwrites_existing() {
        let temp_dir = env::temp_dir();
        let test_file = temp_dir.join(format!("skymap_test_{}.txt", generate_id("overwrite")));

        // Write initial content
        let _ = fs::write(&test_file, b"initial content");

        // Overwrite with atomic write
        let new_data = b"new content";
        let result = atomic_write(&test_file, new_data);

        assert!(result.is_ok());
        let content = fs::read(&test_file).unwrap();
        assert_eq!(content, new_data);

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_atomic_write_no_temp_file_left() {
        let temp_dir = env::temp_dir();
        let test_file = temp_dir.join(format!("skymap_test_{}.txt", generate_id("temp")));
        let temp_file = test_file.with_extension("tmp");

        let _ = atomic_write(&test_file, b"data");

        // Temp file should not exist after successful write
        assert!(!temp_file.exists(), "Temp file should be cleaned up");

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    // ------------------------------------------------------------------------
    // Atomic JSON Write Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_atomic_write_json() {
        use serde::Serialize;

        #[derive(Serialize)]
        struct TestData {
            name: String,
            value: i32,
        }

        let temp_dir = env::temp_dir();
        let test_file = temp_dir.join(format!("skymap_test_{}.json", generate_id("json")));

        let data = TestData {
            name: "test".to_string(),
            value: 42,
        };

        let result = atomic_write_json(&test_file, &data);
        assert!(result.is_ok(), "Atomic JSON write should succeed");

        // Verify content is valid JSON
        let content = fs::read_to_string(&test_file).unwrap();
        assert!(content.contains("\"name\""));
        assert!(content.contains("\"test\""));
        assert!(content.contains("42"));

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }

    #[test]
    fn test_atomic_write_json_pretty_format() {
        use serde::Serialize;

        #[derive(Serialize)]
        struct SimpleData {
            key: String,
        }

        let temp_dir = env::temp_dir();
        let test_file = temp_dir.join(format!("skymap_test_{}.json", generate_id("pretty")));

        let data = SimpleData {
            key: "value".to_string(),
        };

        let _ = atomic_write_json(&test_file, &data);

        let content = fs::read_to_string(&test_file).unwrap();
        // Pretty format should have newlines
        assert!(content.contains('\n'), "JSON should be pretty-printed");

        // Cleanup
        let _ = fs::remove_file(&test_file);
    }
}
