//! Unified cache module for Tauri
//! Provides file-system based caching for network resources
//!
//! Performance optimization: Uses in-memory cache index with lazy disk writes
//! to reduce I/O overhead for frequent cache operations.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::AppHandle;
#[cfg(not(desktop))]
use tauri::Manager;

use crate::data::StorageError;
use crate::network::{http_client, security};

// ============================================================================
// In-Memory Cache Index (Performance Optimization)
// ============================================================================

/// Global in-memory cache index for faster access
/// Uses OnceLock for lazy initialization and Mutex for thread safety
static CACHE_INDEX: OnceLock<Mutex<Option<CacheIndexState>>> = OnceLock::new();

/// Tracks the state of the in-memory cache index
#[derive(Debug, Clone)]
struct CacheIndexState {
    index: CacheIndex,
    dirty: bool,
    last_persist: i64,
    hits: u64,
    misses: u64,
}

impl CacheIndexState {
    fn new(index: CacheIndex) -> Self {
        Self {
            index,
            dirty: false,
            last_persist: Utc::now().timestamp_millis(),
            hits: 0,
            misses: 0,
        }
    }
}

/// Minimum interval between disk writes (5 seconds)
const PERSIST_INTERVAL_MS: i64 = 5000;

/// Get or initialize the global cache index mutex
fn get_cache_index_mutex() -> &'static Mutex<Option<CacheIndexState>> {
    CACHE_INDEX.get_or_init(|| Mutex::new(None))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheEntryMeta {
    pub key: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub timestamp: i64,
    pub ttl: i64,
    pub etag: Option<String>,
    #[serde(default)]
    pub access_count: u64,
    #[serde(default)]
    pub last_access: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheIndex {
    pub entries: HashMap<String, CacheEntryMeta>,
    pub total_size: u64,
    pub last_cleanup: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCacheResponse {
    pub data: Vec<u8>,
    pub content_type: String,
    pub timestamp: i64,
    pub ttl: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnifiedCacheStats {
    pub total_entries: usize,
    pub total_size: u64,
    pub max_size: u64,
    pub max_entries: usize,
    pub hit_rate: f64,
    pub expired_entries: usize,
    pub expired_size: u64,
    pub last_cleanup: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrefetchResult {
    pub success: usize,
    pub failed: usize,
}

fn get_unified_cache_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    #[cfg(desktop)]
    let base = crate::platform::path_config::resolve_cache_dir(app)?;

    #[cfg(not(desktop))]
    let base = {
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

    let cache_dir = base.join("unified_cache");
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)?;
    }
    Ok(cache_dir)
}

fn get_cache_index_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    Ok(get_unified_cache_dir(app)?.join("index.json"))
}

fn get_cache_data_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let data_dir = get_unified_cache_dir(app)?.join("data");
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)?;
    }
    Ok(data_dir)
}

fn key_to_filename(key: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Load cache index from disk (internal use only)
fn load_cache_index_from_disk(app: &AppHandle) -> Result<CacheIndex, StorageError> {
    let path = get_cache_index_path(app)?;
    if !path.exists() {
        return Ok(CacheIndex::default());
    }
    Ok(serde_json::from_str(&fs::read_to_string(&path)?)?)
}

/// Save cache index to disk (internal use only)
fn save_cache_index_to_disk(app: &AppHandle, index: &CacheIndex) -> Result<(), StorageError> {
    fs::write(
        &get_cache_index_path(app)?,
        serde_json::to_string_pretty(index)?,
    )?;
    Ok(())
}

/// Get or load the cache index (uses in-memory cache)
fn get_cache_index(app: &AppHandle) -> Result<CacheIndex, StorageError> {
    let mutex = get_cache_index_mutex();
    let mut guard = mutex
        .lock()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;

    match &*guard {
        Some(state) => Ok(state.index.clone()),
        None => {
            let index = load_cache_index_from_disk(app)?;
            *guard = Some(CacheIndexState::new(index.clone()));
            Ok(index)
        }
    }
}

/// Update the cache index (marks as dirty, persists if interval exceeded)
fn update_cache_index(
    app: &AppHandle,
    index: CacheIndex,
    force_persist: bool,
) -> Result<(), StorageError> {
    let mutex = get_cache_index_mutex();
    let mut guard = mutex
        .lock()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;

    let now = Utc::now().timestamp_millis();
    let should_persist = force_persist
        || match &*guard {
            Some(state) => now - state.last_persist > PERSIST_INTERVAL_MS,
            None => true,
        };

    let (prev_hits, prev_misses) = match &*guard {
        Some(state) => (state.hits, state.misses),
        None => (0, 0),
    };

    if should_persist {
        save_cache_index_to_disk(app, &index)?;
        *guard = Some(CacheIndexState {
            index,
            dirty: false,
            last_persist: now,
            hits: prev_hits,
            misses: prev_misses,
        });
    } else {
        *guard = Some(CacheIndexState {
            index,
            dirty: true,
            last_persist: guard.as_ref().map(|s| s.last_persist).unwrap_or(now),
            hits: prev_hits,
            misses: prev_misses,
        });
    }

    Ok(())
}

/// Force persist any dirty cache index to disk
fn flush_cache_index(app: &AppHandle) -> Result<(), StorageError> {
    let mutex = get_cache_index_mutex();
    let mut guard = mutex
        .lock()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;

    if let Some(state) = &*guard {
        if state.dirty {
            save_cache_index_to_disk(app, &state.index)?;
            *guard = Some(CacheIndexState {
                index: state.index.clone(),
                dirty: false,
                last_persist: Utc::now().timestamp_millis(),
                hits: state.hits,
                misses: state.misses,
            });
        }
    }

    Ok(())
}

/// Invalidate the in-memory cache (forces reload from disk on next access)
#[allow(dead_code)]
fn invalidate_cache_index() {
    if let Ok(mut guard) = get_cache_index_mutex().lock() {
        *guard = None;
    }
}

#[tauri::command]
pub async fn get_unified_cache_entry(
    app: AppHandle,
    key: String,
) -> Result<Option<UnifiedCacheResponse>, StorageError> {
    let mut index = get_cache_index(&app)?;
    let meta = match index.entries.get(&key) {
        Some(m) => m.clone(),
        None => {
            record_cache_miss();
            return Ok(None);
        }
    };

    if meta.ttl > 0 {
        let now = Utc::now().timestamp_millis();
        if now > meta.timestamp + meta.ttl {
            record_cache_miss();
            delete_unified_cache_entry(app, key).await?;
            return Ok(None);
        }
    }

    let data_path = get_cache_data_dir(&app)?.join(key_to_filename(&key));
    if !data_path.exists() {
        record_cache_miss();
        // Clean up orphaned index entry
        delete_unified_cache_entry(app, key).await?;
        return Ok(None);
    }

    // Update access tracking
    let now = Utc::now().timestamp_millis();
    if let Some(entry) = index.entries.get_mut(&key) {
        entry.access_count += 1;
        entry.last_access = now;
    }
    update_cache_index(&app, index, false)?;
    record_cache_hit();

    Ok(Some(UnifiedCacheResponse {
        data: fs::read(&data_path)?,
        content_type: meta.content_type,
        timestamp: meta.timestamp,
        ttl: meta.ttl,
    }))
}

/// Record a cache hit in the in-memory state
fn record_cache_hit() {
    if let Ok(mut guard) = get_cache_index_mutex().lock() {
        if let Some(state) = guard.as_mut() {
            state.hits += 1;
        }
    }
}

/// Record a cache miss in the in-memory state
fn record_cache_miss() {
    if let Ok(mut guard) = get_cache_index_mutex().lock() {
        if let Some(state) = guard.as_mut() {
            state.misses += 1;
        }
    }
}

/// Get cache hit rate from in-memory state
fn get_hit_rate() -> f64 {
    if let Ok(guard) = get_cache_index_mutex().lock() {
        if let Some(state) = &*guard {
            let total = state.hits + state.misses;
            if total > 0 {
                return state.hits as f64 / total as f64;
            }
        }
    }
    0.0
}

fn lru_entries(index: &CacheIndex) -> Vec<(String, i64, u64)> {
    let mut entries: Vec<(String, i64, u64)> = index
        .entries
        .iter()
        .map(|(key, meta)| (key.clone(), meta.last_access, meta.size_bytes))
        .collect();
    entries.sort_by_key(|(_, last_access, _)| *last_access);
    entries
}

fn expired_keys(index: &CacheIndex, now: i64) -> Vec<String> {
    index
        .entries
        .iter()
        .filter(|(_, meta)| meta.ttl > 0 && now > meta.timestamp + meta.ttl)
        .map(|(key, _)| key.clone())
        .collect()
}

fn expired_stats(index: &CacheIndex, now: i64) -> (usize, u64) {
    index
        .entries
        .values()
        .filter(|meta| meta.ttl > 0 && now > meta.timestamp + meta.ttl)
        .fold((0usize, 0u64), |(count, size), meta| {
            (count + 1, size + meta.size_bytes)
        })
}

/// Evict the N least-recently-accessed entries from the cache
fn evict_lru_entries(
    app: &AppHandle,
    index: &mut CacheIndex,
    count: usize,
) -> Result<u64, StorageError> {
    let data_dir = get_cache_data_dir(app)?;

    let mut deleted = 0u64;
    for (key, _, size) in lru_entries(index).into_iter().take(count) {
        let path = data_dir.join(key_to_filename(&key));
        let _ = fs::remove_file(&path);
        index.entries.remove(&key);
        index.total_size = index.total_size.saturating_sub(size);
        deleted += 1;
    }
    Ok(deleted)
}

/// Evict least-recently-accessed entries until at least `target_bytes` are freed
fn evict_lru_by_size(
    app: &AppHandle,
    index: &mut CacheIndex,
    target_bytes: u64,
) -> Result<u64, StorageError> {
    let data_dir = get_cache_data_dir(app)?;

    let mut freed = 0u64;
    let mut deleted = 0u64;
    for (key, _, size) in lru_entries(index) {
        if freed >= target_bytes {
            break;
        }
        let path = data_dir.join(key_to_filename(&key));
        let _ = fs::remove_file(&path);
        index.entries.remove(&key);
        index.total_size = index.total_size.saturating_sub(size);
        freed += size;
        deleted += 1;
    }
    Ok(deleted)
}

#[tauri::command]
pub async fn put_unified_cache_entry(
    app: AppHandle,
    key: String,
    data: Vec<u8>,
    content_type: String,
    ttl: i64,
) -> Result<(), StorageError> {
    let mut index = get_cache_index(&app)?;

    if index.entries.len() >= security::limits::MAX_CACHE_ENTRIES {
        let _ = cleanup_expired_entries_internal(&app, &mut index);
        if index.entries.len() >= security::limits::MAX_CACHE_ENTRIES {
            let evict_count = index.entries.len() / 10;
            evict_lru_entries(&app, &mut index, evict_count)?;
        }
    }

    if index.total_size + data.len() as u64 > security::limits::MAX_CACHE_TOTAL_SIZE as u64 {
        let _ = cleanup_expired_entries_internal(&app, &mut index);
        if index.total_size + data.len() as u64 > security::limits::MAX_CACHE_TOTAL_SIZE as u64 {
            let target = (index.total_size + data.len() as u64)
                .saturating_sub(security::limits::MAX_CACHE_TOTAL_SIZE as u64);
            evict_lru_by_size(&app, &mut index, target)?;
        }
    }

    let data_path = get_cache_data_dir(&app)?.join(key_to_filename(&key));
    let size_bytes = data.len() as u64;
    fs::write(&data_path, &data)?;

    if let Some(old_meta) = index.entries.get(&key) {
        index.total_size = index.total_size.saturating_sub(old_meta.size_bytes);
    }

    let now = Utc::now().timestamp_millis();
    index.entries.insert(
        key.clone(),
        CacheEntryMeta {
            key,
            content_type,
            size_bytes,
            timestamp: now,
            ttl,
            etag: None,
            access_count: 0,
            last_access: now,
        },
    );
    index.total_size += size_bytes;
    update_cache_index(&app, index, false)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_unified_cache_entry(app: AppHandle, key: String) -> Result<bool, StorageError> {
    let mut index = get_cache_index(&app)?;
    if let Some(meta) = index.entries.remove(&key) {
        index.total_size = index.total_size.saturating_sub(meta.size_bytes);
        let data_path = get_cache_data_dir(&app)?.join(key_to_filename(&key));
        if data_path.exists() {
            fs::remove_file(&data_path)?;
        }
        update_cache_index(&app, index, false)?;
        return Ok(true);
    }
    Ok(false)
}

#[tauri::command]
pub async fn clear_unified_cache(app: AppHandle) -> Result<u64, StorageError> {
    let index = get_cache_index(&app)?;
    let deleted_count = index.entries.len() as u64;
    let data_dir = get_cache_data_dir(&app)?;
    if data_dir.exists() {
        fs::remove_dir_all(&data_dir)?;
        fs::create_dir_all(&data_dir)?;
    }
    update_cache_index(&app, CacheIndex::default(), true)?;
    Ok(deleted_count)
}

#[tauri::command]
pub async fn get_unified_cache_size(app: AppHandle) -> Result<u64, StorageError> {
    Ok(get_cache_index(&app)?.total_size)
}

#[tauri::command]
pub async fn list_unified_cache_keys(app: AppHandle) -> Result<Vec<String>, StorageError> {
    Ok(get_cache_index(&app)?.entries.keys().cloned().collect())
}

#[tauri::command]
pub async fn get_unified_cache_stats(app: AppHandle) -> Result<UnifiedCacheStats, StorageError> {
    let index = get_cache_index(&app)?;
    let now = Utc::now().timestamp_millis();
    let (expired_count, expired_size) = expired_stats(&index, now);
    Ok(UnifiedCacheStats {
        total_entries: index.entries.len(),
        total_size: index.total_size,
        max_size: security::limits::MAX_CACHE_TOTAL_SIZE as u64,
        max_entries: security::limits::MAX_CACHE_ENTRIES,
        hit_rate: get_hit_rate(),
        expired_entries: expired_count,
        expired_size,
        last_cleanup: index.last_cleanup.map(|dt| dt.to_rfc3339()),
    })
}

fn cleanup_expired_entries_internal(
    app: &AppHandle,
    index: &mut CacheIndex,
) -> Result<u64, StorageError> {
    let data_dir = get_cache_data_dir(app)?;
    let now = Utc::now().timestamp_millis();
    let mut deleted_count = 0u64;

    for key in expired_keys(index, now) {
        if let Some(meta) = index.entries.remove(&key) {
            index.total_size = index.total_size.saturating_sub(meta.size_bytes);
            let data_path = data_dir.join(key_to_filename(&key));
            if data_path.exists() {
                let _ = fs::remove_file(&data_path);
            }
            deleted_count += 1;
        }
    }
    Ok(deleted_count)
}

#[tauri::command]
pub async fn cleanup_unified_cache(app: AppHandle) -> Result<u64, StorageError> {
    let mut index = get_cache_index(&app)?;
    let deleted_count = cleanup_expired_entries_internal(&app, &mut index)?;
    index.last_cleanup = Some(Utc::now());
    update_cache_index(&app, index, true)?; // Force persist after cleanup
    Ok(deleted_count)
}

/// Flush any pending cache index changes to disk
/// Call this before app shutdown to ensure data is persisted
#[tauri::command]
pub async fn flush_unified_cache(app: AppHandle) -> Result<(), StorageError> {
    flush_cache_index(&app)
}

#[tauri::command]
pub async fn prefetch_url(app: AppHandle, url: String, ttl: i64) -> Result<bool, StorageError> {
    log::info!("Prefetching URL: {}", url);
    let request_id = format!("prefetch-{}", chrono::Utc::now().timestamp_millis());

    match http_client::http_request(
        app.clone(),
        http_client::RequestConfig {
            method: "GET".to_string(),
            url: url.clone(),
            request_id: Some(request_id),
            allow_http: false,
            ..Default::default()
        },
    )
    .await
    {
        Ok(response) => {
            if response.status >= 200 && response.status < 300 {
                let content_type = response
                    .content_type
                    .unwrap_or_else(|| "application/octet-stream".to_string());
                security::validate_size(&response.body, security::limits::MAX_TILE_SIZE)
                    .map_err(|e| StorageError::Other(e.to_string()))?;
                let key = url_to_cache_key(&url);
                put_unified_cache_entry(app, key, response.body, content_type, ttl).await?;
                Ok(true)
            } else {
                log::warn!("Prefetch failed with status: {}", response.status);
                Ok(false)
            }
        }
        Err(e) => {
            log::warn!("Prefetch error: {}", e);
            Ok(false)
        }
    }
}

#[tauri::command]
pub async fn prefetch_urls(
    app: AppHandle,
    urls: Vec<String>,
    ttl: i64,
) -> Result<PrefetchResult, StorageError> {
    let mut success = 0;
    let mut failed = 0;
    for url in urls {
        match prefetch_url(app.clone(), url, ttl).await {
            Ok(true) => success += 1,
            _ => failed += 1,
        }
    }
    Ok(PrefetchResult { success, failed })
}

fn url_to_cache_key(url: &str) -> String {
    url.replace("https://", "")
        .replace("http://", "")
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '/' || *c == '.' || *c == '-' || *c == '_')
        .take(200)
        .collect()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::test_support::cache_test_lock;

    fn test_entry_meta(
        key: &str,
        size_bytes: u64,
        timestamp: i64,
        last_access: i64,
    ) -> CacheEntryMeta {
        CacheEntryMeta {
            key: key.to_string(),
            content_type: "application/octet-stream".to_string(),
            size_bytes,
            timestamp,
            ttl: 0,
            etag: None,
            access_count: 0,
            last_access,
        }
    }

    // ------------------------------------------------------------------------
    // key_to_filename Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_key_to_filename_consistency() {
        let key = "https://example.com/path/to/resource";
        let filename1 = key_to_filename(key);
        let filename2 = key_to_filename(key);
        assert_eq!(
            filename1, filename2,
            "Same key should produce same filename"
        );
    }

    #[test]
    fn test_key_to_filename_different_keys() {
        let key1 = "https://example.com/path1";
        let key2 = "https://example.com/path2";
        let filename1 = key_to_filename(key1);
        let filename2 = key_to_filename(key2);
        assert_ne!(
            filename1, filename2,
            "Different keys should produce different filenames"
        );
    }

    #[test]
    fn test_key_to_filename_format() {
        let key = "test-key";
        let filename = key_to_filename(key);
        // Should be 16 hex characters
        assert_eq!(filename.len(), 16);
        assert!(filename.chars().all(|c| c.is_ascii_hexdigit()));
    }

    // ------------------------------------------------------------------------
    // url_to_cache_key Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_url_to_cache_key_https() {
        let url = "https://example.com/path";
        let key = url_to_cache_key(url);
        assert!(!key.contains("https://"));
        assert!(key.contains("example.com"));
    }

    #[test]
    fn test_url_to_cache_key_http() {
        let url = "http://example.com/path";
        let key = url_to_cache_key(url);
        assert!(!key.contains("http://"));
    }

    #[test]
    fn test_url_to_cache_key_max_length() {
        let long_url = "https://".to_string() + &"a".repeat(500);
        let key = url_to_cache_key(&long_url);
        assert!(key.len() <= 200, "Key should be truncated to 200 chars");
    }

    #[test]
    fn test_url_to_cache_key_special_chars() {
        let url = "https://example.com/path?query=value&foo=bar";
        let key = url_to_cache_key(url);
        // Query string chars like ? and & should be filtered out
        assert!(!key.contains("?"));
        assert!(!key.contains("&"));
        assert!(!key.contains("="));
    }

    #[test]
    fn test_url_to_cache_key_allowed_chars() {
        let url = "https://example.com/path-to_file.jpg";
        let key = url_to_cache_key(url);
        assert!(key.contains("-"));
        assert!(key.contains("_"));
        assert!(key.contains("."));
    }

    // ------------------------------------------------------------------------
    // Unified Cache Behavior Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_index_state_new_initializes_tracking_fields() {
        let before = Utc::now().timestamp_millis();
        let state = CacheIndexState::new(CacheIndex::default());
        let after = Utc::now().timestamp_millis();

        assert!(!state.dirty);
        assert_eq!(state.hits, 0);
        assert_eq!(state.misses, 0);
        assert!(
            state.last_persist >= before && state.last_persist <= after,
            "last_persist should be initialized to current time"
        );
    }

    #[test]
    fn test_record_cache_hit_and_miss_updates_hit_rate() {
        let _guard = cache_test_lock();
        invalidate_cache_index();

        {
            let mut state = get_cache_index_mutex().lock().unwrap();
            *state = Some(CacheIndexState::new(CacheIndex::default()));
        }

        record_cache_hit();
        record_cache_miss();
        record_cache_hit();

        {
            let state = get_cache_index_mutex().lock().unwrap();
            let state = state.as_ref().unwrap();
            assert_eq!(state.hits, 2);
            assert_eq!(state.misses, 1);
        }
        assert!(
            (get_hit_rate() - (2.0 / 3.0)).abs() < f64::EPSILON,
            "hit rate should reflect hit/miss counters"
        );

        invalidate_cache_index();
    }

    #[test]
    fn test_lru_entries_sorts_oldest_access_first() {
        let now = Utc::now().timestamp_millis();
        let mut index = CacheIndex::default();
        index.entries.insert(
            "newest".to_string(),
            test_entry_meta("newest", 30, now - 100, now - 10),
        );
        index.entries.insert(
            "oldest".to_string(),
            test_entry_meta("oldest", 10, now - 100, now - 30),
        );
        index.entries.insert(
            "middle".to_string(),
            test_entry_meta("middle", 20, now - 100, now - 20),
        );

        let ordered_keys: Vec<String> = lru_entries(&index)
            .into_iter()
            .map(|(key, _, _)| key)
            .collect();

        assert_eq!(ordered_keys, vec!["oldest", "middle", "newest"]);
    }

    #[test]
    fn test_expired_keys_returns_only_elapsed_ttl_entries() {
        let now = Utc::now().timestamp_millis();
        let mut index = CacheIndex::default();
        index.entries.insert(
            "expired".to_string(),
            CacheEntryMeta {
                ttl: 10,
                timestamp: now - 50,
                ..test_entry_meta("expired", 128, now - 50, now - 50)
            },
        );
        index.entries.insert(
            "fresh".to_string(),
            CacheEntryMeta {
                ttl: 100,
                timestamp: now - 50,
                ..test_entry_meta("fresh", 64, now - 50, now - 20)
            },
        );
        index.entries.insert(
            "no-ttl".to_string(),
            test_entry_meta("no-ttl", 32, now - 100, now - 100),
        );

        assert_eq!(expired_keys(&index, now), vec!["expired".to_string()]);
    }

    #[test]
    fn test_expired_stats_aggregates_count_and_size() {
        let now = Utc::now().timestamp_millis();
        let mut index = CacheIndex::default();
        index.entries.insert(
            "expired-a".to_string(),
            CacheEntryMeta {
                ttl: 10,
                timestamp: now - 100,
                ..test_entry_meta("expired-a", 40, now - 100, now - 100)
            },
        );
        index.entries.insert(
            "expired-b".to_string(),
            CacheEntryMeta {
                ttl: 20,
                timestamp: now - 100,
                ..test_entry_meta("expired-b", 60, now - 100, now - 50)
            },
        );
        index.entries.insert(
            "fresh".to_string(),
            CacheEntryMeta {
                ttl: 200,
                timestamp: now - 100,
                ..test_entry_meta("fresh", 80, now - 100, now - 10)
            },
        );

        assert_eq!(expired_stats(&index, now), (2, 100));
    }

    #[test]
    fn test_invalidate_cache_index_clears_global_state() {
        let _guard = cache_test_lock();
        {
            let mut state = get_cache_index_mutex().lock().unwrap();
            *state = Some(CacheIndexState::new(CacheIndex::default()));
        }

        invalidate_cache_index();

        let state = get_cache_index_mutex().lock().unwrap();
        assert!(state.is_none(), "invalidate should drop cached index state");
    }

    // ------------------------------------------------------------------------
    // CacheEntryMeta Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_entry_meta_serialization() {
        let meta = CacheEntryMeta {
            key: "test-key".to_string(),
            content_type: "image/jpeg".to_string(),
            size_bytes: 1024,
            timestamp: 1704067200000,
            ttl: 3600000,
            etag: Some("abc123".to_string()),
            access_count: 0,
            last_access: 1704067200000,
        };

        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("test-key"));
        assert!(json.contains("image/jpeg"));
        assert!(json.contains("1024"));
        assert!(json.contains("abc123"));
    }

    #[test]
    fn test_cache_entry_meta_deserialization() {
        let json = r#"{
            "key": "my-key",
            "content_type": "text/plain",
            "size_bytes": 512,
            "timestamp": 1704067200000,
            "ttl": 7200000,
            "etag": null
        }"#;

        let meta: CacheEntryMeta = serde_json::from_str(json).unwrap();
        assert_eq!(meta.key, "my-key");
        assert_eq!(meta.content_type, "text/plain");
        assert_eq!(meta.size_bytes, 512);
        assert!(meta.etag.is_none());
    }

    #[test]
    fn test_cache_entry_meta_clone() {
        let meta = CacheEntryMeta {
            key: "key".to_string(),
            content_type: "text/html".to_string(),
            size_bytes: 100,
            timestamp: 0,
            ttl: 1000,
            etag: None,
            access_count: 0,
            last_access: 0,
        };

        let cloned = meta.clone();
        assert_eq!(cloned.key, meta.key);
        assert_eq!(cloned.content_type, meta.content_type);
    }

    // ------------------------------------------------------------------------
    // CacheIndex Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_index_default() {
        let index = CacheIndex::default();
        assert!(index.entries.is_empty());
        assert_eq!(index.total_size, 0);
        assert!(index.last_cleanup.is_none());
    }

    #[test]
    fn test_cache_index_serialization() {
        let mut index = CacheIndex::default();
        index.entries.insert(
            "key1".to_string(),
            CacheEntryMeta {
                key: "key1".to_string(),
                content_type: "text/plain".to_string(),
                size_bytes: 100,
                timestamp: 0,
                ttl: 1000,
                etag: None,
                access_count: 0,
                last_access: 0,
            },
        );
        index.total_size = 100;

        let json = serde_json::to_string(&index).unwrap();
        assert!(json.contains("entries"));
        assert!(json.contains("total_size"));
        assert!(json.contains("key1"));
    }

    #[test]
    fn test_cache_index_with_cleanup_timestamp() {
        let index = CacheIndex {
            last_cleanup: Some(Utc::now()),
            ..Default::default()
        };

        let json = serde_json::to_string(&index).unwrap();
        let back: CacheIndex = serde_json::from_str(&json).unwrap();
        assert!(back.last_cleanup.is_some());
    }

    // ------------------------------------------------------------------------
    // UnifiedCacheResponse Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_unified_cache_response_serialization() {
        let response = UnifiedCacheResponse {
            data: vec![1, 2, 3, 4, 5],
            content_type: "application/octet-stream".to_string(),
            timestamp: 1704067200000,
            ttl: 3600000,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("content_type"));
        assert!(json.contains("timestamp"));
        assert!(json.contains("ttl"));
    }

    #[test]
    fn test_unified_cache_response_clone() {
        let response = UnifiedCacheResponse {
            data: vec![10, 20, 30],
            content_type: "image/png".to_string(),
            timestamp: 0,
            ttl: 0,
        };

        let cloned = response.clone();
        assert_eq!(cloned.data, response.data);
        assert_eq!(cloned.content_type, response.content_type);
    }

    // ------------------------------------------------------------------------
    // UnifiedCacheStats Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_unified_cache_stats_serialization() {
        let stats = UnifiedCacheStats {
            total_entries: 100,
            total_size: 1024 * 1024,
            max_size: 1024 * 1024 * 1024,
            max_entries: 10000,
            hit_rate: 0.85,
            expired_entries: 10,
            expired_size: 50000,
            last_cleanup: None,
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("total_entries"));
        assert!(json.contains("100"));
        assert!(json.contains("expired_entries"));
        assert!(json.contains("10"));
    }

    #[test]
    fn test_unified_cache_stats_deserialization() {
        let json = r#"{
            "total_entries": 50,
            "total_size": 500000,
            "max_size": 1073741824,
            "max_entries": 10000,
            "hit_rate": 0.75,
            "expired_entries": 5,
            "expired_size": 25000,
            "last_cleanup": null
        }"#;

        let stats: UnifiedCacheStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.total_entries, 50);
        assert_eq!(stats.total_size, 500000);
        assert_eq!(stats.max_entries, 10000);
        assert_eq!(stats.expired_entries, 5);
        assert_eq!(stats.expired_size, 25000);
    }

    // ------------------------------------------------------------------------
    // PrefetchResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_prefetch_result_serialization() {
        let result = PrefetchResult {
            success: 8,
            failed: 2,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":8"));
        assert!(json.contains("\"failed\":2"));
    }

    #[test]
    fn test_prefetch_result_deserialization() {
        let json = r#"{"success": 10, "failed": 0}"#;
        let result: PrefetchResult = serde_json::from_str(json).unwrap();
        assert_eq!(result.success, 10);
        assert_eq!(result.failed, 0);
    }

    #[test]
    fn test_prefetch_result_clone() {
        let result = PrefetchResult {
            success: 5,
            failed: 3,
        };
        let cloned = result.clone();
        assert_eq!(cloned.success, result.success);
        assert_eq!(cloned.failed, result.failed);
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_url_to_cache_key_empty() {
        let key = url_to_cache_key("");
        assert!(key.is_empty());
    }

    #[test]
    fn test_key_to_filename_empty() {
        let filename = key_to_filename("");
        // Even empty string should produce a valid hash
        assert_eq!(filename.len(), 16);
    }

    #[test]
    fn test_cache_entry_meta_with_etag() {
        let meta = CacheEntryMeta {
            key: "etag-test".to_string(),
            content_type: "text/css".to_string(),
            size_bytes: 256,
            timestamp: 1000,
            ttl: 5000,
            etag: Some("W/\"abc123\"".to_string()),
            access_count: 0,
            last_access: 1000,
        };

        let json = serde_json::to_string(&meta).unwrap();
        let back: CacheEntryMeta = serde_json::from_str(&json).unwrap();
        assert_eq!(back.etag, Some("W/\"abc123\"".to_string()));
    }

    #[test]
    fn test_cache_index_multiple_entries() {
        let mut index = CacheIndex::default();

        for i in 0..5 {
            index.entries.insert(
                format!("key-{}", i),
                CacheEntryMeta {
                    key: format!("key-{}", i),
                    content_type: "text/plain".to_string(),
                    size_bytes: 100 * (i + 1) as u64,
                    timestamp: 0,
                    ttl: 1000,
                    etag: None,
                    access_count: 0,
                    last_access: 0,
                },
            );
        }
        index.total_size = 100 + 200 + 300 + 400 + 500;

        assert_eq!(index.entries.len(), 5);
        assert_eq!(index.total_size, 1500);
    }
}
