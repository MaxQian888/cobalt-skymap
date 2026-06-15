//! Offline cache management module
//! Manages tile caching for offline use in the desktop application

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{OnceLock, RwLock};
use tauri::AppHandle;
#[cfg(not(desktop))]
use tauri::Manager;

use crate::data::StorageError;
use crate::network::security::limits;
use crate::utils::generate_id;

/// Global in-memory cache data for offline tile metadata.
/// Avoids reading cache_meta.json from disk on every operation.
/// Uses an RwLock so concurrent `is_tile_cached` / `get_cache_stats` reads
/// can proceed without blocking each other.
static OFFLINE_CACHE_DATA: OnceLock<RwLock<Option<CacheData>>> = OnceLock::new();

fn get_offline_cache_lock() -> &'static RwLock<Option<CacheData>> {
    OFFLINE_CACHE_DATA.get_or_init(|| RwLock::new(None))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheRegion {
    pub id: String,
    pub name: String,
    pub center_ra: f64,
    pub center_dec: f64,
    pub radius_deg: f64,
    pub min_zoom: u8,
    pub max_zoom: u8,
    pub survey_id: String,
    pub tile_count: u64,
    pub size_bytes: u64,
    pub status: CacheStatus,
    pub progress: f64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CacheStatus {
    Pending,
    Downloading,
    Paused,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_regions: usize,
    pub total_tiles: u64,
    pub total_size_bytes: u64,
    pub completed_regions: usize,
    pub surveys: Vec<SurveyCacheInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurveyCacheInfo {
    pub survey_id: String,
    pub tile_count: u64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TileMetadata {
    pub survey_id: String,
    pub zoom: u8,
    pub x: u64,
    pub y: u64,
    pub size_bytes: u64,
    pub cached_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CacheData {
    pub regions: Vec<CacheRegion>,
    pub tiles: HashMap<String, TileMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRegionArgs {
    pub name: String,
    pub center_ra: f64,
    pub center_dec: f64,
    pub radius_deg: f64,
    pub min_zoom: u8,
    pub max_zoom: u8,
    pub survey_id: String,
}

fn get_cache_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
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

    let cache_dir = base.join("cache");
    if !cache_dir.exists() {
        fs::create_dir_all(&cache_dir)?;
    }
    Ok(cache_dir)
}

fn get_cache_meta_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    Ok(get_cache_dir(app)?.join("cache_meta.json"))
}

fn get_tiles_dir(app: &AppHandle, survey_id: &str) -> Result<PathBuf, StorageError> {
    let tiles_dir = get_cache_dir(app)?.join("tiles").join(survey_id);
    if !tiles_dir.exists() {
        fs::create_dir_all(&tiles_dir)?;
    }
    Ok(tiles_dir)
}

fn get_tile_path(
    app: &AppHandle,
    survey_id: &str,
    zoom: u8,
    x: u64,
    y: u64,
) -> Result<PathBuf, StorageError> {
    let zoom_dir = get_tiles_dir(app, survey_id)?.join(zoom.to_string());
    if !zoom_dir.exists() {
        fs::create_dir_all(&zoom_dir)?;
    }
    Ok(zoom_dir.join(format!("{}_{}.jpg", x, y)))
}

fn load_cache_data_from_disk(app: &AppHandle) -> Result<CacheData, StorageError> {
    let path = get_cache_meta_path(app)?;
    if !path.exists() {
        return Ok(CacheData::default());
    }
    Ok(serde_json::from_str(&fs::read_to_string(&path)?)?)
}

fn save_cache_data_to_disk(app: &AppHandle, data: &CacheData) -> Result<(), StorageError> {
    fs::write(
        &get_cache_meta_path(app)?,
        serde_json::to_string_pretty(data)?,
    )?;
    Ok(())
}

/// Get cache data from in-memory cache, loading from disk if needed.
/// Fast path uses a read lock; only the first uninitialized call upgrades
/// to a write lock to load from disk.
fn get_cache_data(app: &AppHandle) -> Result<CacheData, StorageError> {
    let lock = get_offline_cache_lock();

    // Fast path: read lock allows concurrent readers once initialized.
    {
        let guard = lock
            .read()
            .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;
        if let Some(data) = &*guard {
            return Ok(data.clone());
        }
    }

    // Slow path: take write lock to initialize. Re-check under the write
    // guard in case another thread won the race.
    let mut guard = lock
        .write()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;
    if let Some(data) = &*guard {
        return Ok(data.clone());
    }
    let data = load_cache_data_from_disk(app)?;
    *guard = Some(data.clone());
    Ok(data)
}

/// Update cache data in memory and persist to disk
fn update_cache_data(app: &AppHandle, data: CacheData) -> Result<(), StorageError> {
    let lock = get_offline_cache_lock();
    let mut guard = lock
        .write()
        .map_err(|e| StorageError::Other(format!("Lock error: {}", e)))?;

    save_cache_data_to_disk(app, &data)?;
    *guard = Some(data);
    Ok(())
}

/// Invalidate the in-memory cache (forces reload from disk on next access)
#[allow(dead_code)]
fn invalidate_offline_cache() {
    if let Ok(mut guard) = get_offline_cache_lock().write() {
        *guard = None;
    }
}

#[tauri::command]
pub async fn get_cache_stats(app: AppHandle) -> Result<CacheStats, StorageError> {
    let data = get_cache_data(&app)?;
    let total_regions = data.regions.len();
    let completed_regions = data
        .regions
        .iter()
        .filter(|r| r.status == CacheStatus::Completed)
        .count();

    // Derive tile counts and per-survey breakdown from the actually-cached
    // tiles (populated by `save_cached_tile`, including the tile-cache
    // protocol), not from region metadata which may be empty.
    let total_tiles: u64 = data.tiles.len() as u64;
    let total_size_bytes: u64 = data.tiles.values().map(|t| t.size_bytes).sum();

    let mut survey_map: HashMap<String, (u64, u64)> = HashMap::new();
    for tile in data.tiles.values() {
        let entry = survey_map.entry(tile.survey_id.clone()).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += tile.size_bytes;
    }
    let surveys: Vec<SurveyCacheInfo> = survey_map
        .into_iter()
        .map(|(survey_id, (tile_count, size_bytes))| SurveyCacheInfo {
            survey_id,
            tile_count,
            size_bytes,
        })
        .collect();

    Ok(CacheStats {
        total_regions,
        total_tiles,
        total_size_bytes,
        completed_regions,
        surveys,
    })
}

#[tauri::command]
pub async fn list_cache_regions(app: AppHandle) -> Result<Vec<CacheRegion>, StorageError> {
    Ok(get_cache_data(&app)?.regions)
}

#[tauri::command]
pub async fn create_cache_region(
    app: AppHandle,
    args: CreateRegionArgs,
) -> Result<CacheRegion, StorageError> {
    let mut data = get_cache_data(&app)?;
    let tile_count = estimate_tile_count(args.radius_deg, args.min_zoom, args.max_zoom);
    let region = CacheRegion {
        id: generate_id("region"),
        name: args.name,
        center_ra: args.center_ra,
        center_dec: args.center_dec,
        radius_deg: args.radius_deg,
        min_zoom: args.min_zoom,
        max_zoom: args.max_zoom,
        survey_id: args.survey_id,
        tile_count,
        size_bytes: 0,
        status: CacheStatus::Pending,
        progress: 0.0,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    data.regions.push(region.clone());
    update_cache_data(&app, data)?;
    Ok(region)
}

#[tauri::command]
pub async fn update_cache_region(
    app: AppHandle,
    region_id: String,
    status: Option<CacheStatus>,
    progress: Option<f64>,
    size_bytes: Option<u64>,
) -> Result<CacheRegion, StorageError> {
    let mut data = get_cache_data(&app)?;
    let region = data
        .regions
        .iter_mut()
        .find(|r| r.id == region_id)
        .ok_or_else(|| StorageError::StoreNotFound(region_id.clone()))?;
    if let Some(s) = status {
        region.status = s;
    }
    if let Some(p) = progress {
        region.progress = p;
    }
    if let Some(size) = size_bytes {
        region.size_bytes = size;
    }
    region.updated_at = Utc::now();
    let result = region.clone();
    update_cache_data(&app, data)?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_cache_region(
    app: AppHandle,
    region_id: String,
    delete_tiles: bool,
) -> Result<(), StorageError> {
    let mut data = get_cache_data(&app)?;
    if let Some(region) = data.regions.iter().find(|r| r.id == region_id).cloned() {
        data.regions.retain(|r| r.id != region_id);
        if delete_tiles {
            let prefix = format!("{}_", region.survey_id);
            data.tiles.retain(|k, _| !k.starts_with(&prefix));
        }
        update_cache_data(&app, data)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_cached_tile(
    app: AppHandle,
    survey_id: String,
    zoom: u8,
    x: u64,
    y: u64,
    data: Vec<u8>,
) -> Result<(), StorageError> {
    crate::network::security::validate_size(&data, limits::MAX_TILE_SIZE)
        .map_err(|e| StorageError::Other(e.to_string()))?;
    let mut cache_data = get_cache_data(&app)?;
    let current_total: u64 = cache_data.tiles.values().map(|t| t.size_bytes).sum();
    if current_total + data.len() as u64 > limits::MAX_CACHE_TOTAL_SIZE as u64 {
        return Err(StorageError::Other(format!(
            "Cache size limit reached ({} bytes)",
            limits::MAX_CACHE_TOTAL_SIZE
        )));
    }

    // Use atomic write: write to temp file then rename
    let tile_path = get_tile_path(&app, &survey_id, zoom, x, y)?;
    let temp_path = tile_path.with_extension("tmp");

    // Ensure parent directory exists
    if let Some(parent) = tile_path.parent() {
        fs::create_dir_all(parent)?;
    }

    // Write to temp file first
    fs::write(&temp_path, &data)?;

    // Atomic rename (on most filesystems this is atomic)
    fs::rename(&temp_path, &tile_path)?;

    // Update metadata in the same loaded instance (fixes race condition)
    cache_data.tiles.insert(
        format!("{}_{}_{}_{}", survey_id, zoom, x, y),
        TileMetadata {
            survey_id,
            zoom,
            x,
            y,
            size_bytes: data.len() as u64,
            cached_at: Utc::now(),
        },
    );
    update_cache_data(&app, cache_data)?;
    Ok(())
}

#[tauri::command]
pub async fn load_cached_tile(
    app: AppHandle,
    survey_id: String,
    zoom: u8,
    x: u64,
    y: u64,
) -> Result<Option<Vec<u8>>, StorageError> {
    let tile_path = get_tile_path(&app, &survey_id, zoom, x, y)?;
    if tile_path.exists() {
        return Ok(Some(fs::read(&tile_path)?));
    }
    Ok(None)
}

#[tauri::command]
pub async fn is_tile_cached(
    app: AppHandle,
    survey_id: String,
    zoom: u8,
    x: u64,
    y: u64,
) -> Result<bool, StorageError> {
    Ok(get_tile_path(&app, &survey_id, zoom, x, y)?.exists())
}

#[tauri::command]
pub async fn clear_survey_cache(app: AppHandle, survey_id: String) -> Result<u64, StorageError> {
    let tiles_dir = get_tiles_dir(&app, &survey_id)?;
    let mut deleted_count = 0u64;
    if tiles_dir.exists() {
        deleted_count = count_files_recursive(&tiles_dir)?;
        fs::remove_dir_all(&tiles_dir)?;
    }
    let mut cache_data = get_cache_data(&app)?;
    cache_data.tiles.retain(|_, v| v.survey_id != survey_id);
    cache_data.regions.retain(|r| r.survey_id != survey_id);
    update_cache_data(&app, cache_data)?;
    Ok(deleted_count)
}

#[tauri::command]
pub async fn clear_all_cache(app: AppHandle) -> Result<u64, StorageError> {
    let tiles_dir = get_cache_dir(&app)?.join("tiles");
    let mut deleted_count = 0u64;
    if tiles_dir.exists() {
        deleted_count = count_files_recursive(&tiles_dir)?;
        fs::remove_dir_all(&tiles_dir)?;
    }
    update_cache_data(&app, CacheData::default())?;
    Ok(deleted_count)
}

#[tauri::command]
pub async fn get_cache_directory(app: AppHandle) -> Result<String, StorageError> {
    Ok(get_cache_dir(&app)?.to_string_lossy().to_string())
}

fn estimate_tile_count(radius_deg: f64, min_zoom: u8, max_zoom: u8) -> u64 {
    let mut total = 0u64;
    for zoom in min_zoom..=max_zoom {
        let tiles_per_deg = 2f64.powi(zoom as i32) / 360.0;
        let tiles_in_radius = (radius_deg * tiles_per_deg).ceil() as u64;
        total += tiles_in_radius * tiles_in_radius * 4;
    }
    total
}

fn count_files_recursive(dir: &PathBuf) -> Result<u64, StorageError> {
    let mut count = 0u64;
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let path = entry?.path();
            if path.is_dir() {
                count += count_files_recursive(&path)?;
            } else {
                count += 1;
            }
        }
    }
    Ok(count)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::test_support::{cache_test_lock, unique_temp_dir};
    use std::fs;

    // ------------------------------------------------------------------------
    // estimate_tile_count Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_estimate_tile_count_single_zoom() {
        // Single zoom level
        let count = estimate_tile_count(1.0, 5, 5);
        assert!(count > 0, "Should return non-zero tile count");
    }

    #[test]
    fn test_estimate_tile_count_multiple_zooms() {
        // Multiple zoom levels should have more tiles
        let count_single = estimate_tile_count(1.0, 5, 5);
        let count_multi = estimate_tile_count(1.0, 5, 7);
        assert!(
            count_multi > count_single,
            "More zoom levels should mean more tiles"
        );
    }

    #[test]
    fn test_estimate_tile_count_larger_radius() {
        // Larger radius should have more tiles (use higher zoom where difference is visible)
        let count_small = estimate_tile_count(1.0, 8, 8);
        let count_large = estimate_tile_count(10.0, 8, 8);
        assert!(
            count_large > count_small,
            "Larger radius should mean more tiles: small={}, large={}",
            count_small,
            count_large
        );
    }

    #[test]
    fn test_estimate_tile_count_zero_radius() {
        // Zero radius should still return something due to ceil
        let count = estimate_tile_count(0.0, 5, 5);
        assert_eq!(count, 0, "Zero radius should have zero tiles");
    }

    #[test]
    fn test_estimate_tile_count_higher_zoom_more_tiles() {
        // Higher zoom levels have more tiles per degree
        let count_low = estimate_tile_count(1.0, 1, 1);
        let count_high = estimate_tile_count(1.0, 10, 10);
        assert!(
            count_high > count_low,
            "Higher zoom should have more tiles per area"
        );
    }

    // ------------------------------------------------------------------------
    // Cache File Behavior Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_count_files_recursive_counts_nested_files() {
        let _guard = cache_test_lock();
        let root = unique_temp_dir("offline-count-files");
        let nested = root.join("survey").join("8");

        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("root.txt"), b"root").unwrap();
        fs::write(root.join("survey").join("tile-a.jpg"), b"a").unwrap();
        fs::write(nested.join("tile-b.jpg"), b"b").unwrap();

        assert_eq!(count_files_recursive(&root).unwrap(), 3);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_count_files_recursive_returns_zero_for_empty_directory() {
        let _guard = cache_test_lock();
        let root = unique_temp_dir("offline-count-empty");
        fs::create_dir_all(&root).unwrap();

        assert_eq!(count_files_recursive(&root).unwrap(), 0);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_invalidate_offline_cache_clears_in_memory_state() {
        let _guard = cache_test_lock();
        let mut guard = get_offline_cache_lock().write().unwrap();
        *guard = Some(CacheData {
            regions: vec![],
            tiles: HashMap::from([(
                "DSS_1_2_3".to_string(),
                TileMetadata {
                    survey_id: "DSS".to_string(),
                    zoom: 1,
                    x: 2,
                    y: 3,
                    size_bytes: 42,
                    cached_at: Utc::now(),
                },
            )]),
        });
        drop(guard);

        invalidate_offline_cache();

        let guard = get_offline_cache_lock().read().unwrap();
        assert!(
            guard.is_none(),
            "invalidate should clear in-memory cache data"
        );
    }

    // ------------------------------------------------------------------------
    // CacheStatus Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_status_serialization() {
        let status = CacheStatus::Pending;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"pending\"");

        let status = CacheStatus::Downloading;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"downloading\"");

        let status = CacheStatus::Completed;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"completed\"");
    }

    #[test]
    fn test_cache_status_deserialization() {
        let status: CacheStatus = serde_json::from_str("\"pending\"").unwrap();
        assert_eq!(status, CacheStatus::Pending);

        let status: CacheStatus = serde_json::from_str("\"completed\"").unwrap();
        assert_eq!(status, CacheStatus::Completed);

        let status: CacheStatus = serde_json::from_str("\"failed\"").unwrap();
        assert_eq!(status, CacheStatus::Failed);
    }

    #[test]
    fn test_cache_status_equality() {
        assert_eq!(CacheStatus::Pending, CacheStatus::Pending);
        assert_ne!(CacheStatus::Pending, CacheStatus::Completed);
    }

    // ------------------------------------------------------------------------
    // CacheRegion Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_region_serialization() {
        let region = CacheRegion {
            id: "region-123".to_string(),
            name: "Test Region".to_string(),
            center_ra: 180.0,
            center_dec: 45.0,
            radius_deg: 5.0,
            min_zoom: 5,
            max_zoom: 10,
            survey_id: "DSS".to_string(),
            tile_count: 1000,
            size_bytes: 50000,
            status: CacheStatus::Pending,
            progress: 0.0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&region).unwrap();
        assert!(json.contains("region-123"));
        assert!(json.contains("Test Region"));
        assert!(json.contains("180"));
        assert!(json.contains("DSS"));
    }

    #[test]
    fn test_cache_region_deserialization() {
        let json = r#"{
            "id": "region-1",
            "name": "My Region",
            "center_ra": 100.0,
            "center_dec": -30.0,
            "radius_deg": 2.0,
            "min_zoom": 3,
            "max_zoom": 8,
            "survey_id": "2MASS",
            "tile_count": 500,
            "size_bytes": 25000,
            "status": "downloading",
            "progress": 50.0,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T12:00:00Z"
        }"#;

        let region: CacheRegion = serde_json::from_str(json).unwrap();
        assert_eq!(region.id, "region-1");
        assert_eq!(region.name, "My Region");
        assert_eq!(region.center_ra, 100.0);
        assert_eq!(region.status, CacheStatus::Downloading);
        assert_eq!(region.progress, 50.0);
    }

    // ------------------------------------------------------------------------
    // CacheStats Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_stats_serialization() {
        let stats = CacheStats {
            total_regions: 5,
            total_tiles: 10000,
            total_size_bytes: 500000,
            completed_regions: 3,
            surveys: vec![SurveyCacheInfo {
                survey_id: "DSS".to_string(),
                tile_count: 5000,
                size_bytes: 250000,
            }],
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("total_regions"));
        assert!(json.contains("10000"));
        assert!(json.contains("DSS"));
    }

    // ------------------------------------------------------------------------
    // SurveyCacheInfo Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_survey_cache_info_structure() {
        let info = SurveyCacheInfo {
            survey_id: "SDSS".to_string(),
            tile_count: 1234,
            size_bytes: 56789,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("SDSS"));
        assert!(json.contains("1234"));
        assert!(json.contains("56789"));
    }

    // ------------------------------------------------------------------------
    // TileMetadata Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_tile_metadata_serialization() {
        let meta = TileMetadata {
            survey_id: "DSS".to_string(),
            zoom: 8,
            x: 123,
            y: 456,
            size_bytes: 50000,
            cached_at: Utc::now(),
        };

        let json = serde_json::to_string(&meta).unwrap();
        assert!(json.contains("DSS"));
        assert!(json.contains("\"zoom\":8"));
        assert!(json.contains("\"x\":123"));
        assert!(json.contains("\"y\":456"));
    }

    #[test]
    fn test_tile_metadata_deserialization() {
        let json = r#"{
            "survey_id": "2MASS",
            "zoom": 5,
            "x": 10,
            "y": 20,
            "size_bytes": 1024,
            "cached_at": "2024-06-15T10:30:00Z"
        }"#;

        let meta: TileMetadata = serde_json::from_str(json).unwrap();
        assert_eq!(meta.survey_id, "2MASS");
        assert_eq!(meta.zoom, 5);
        assert_eq!(meta.x, 10);
        assert_eq!(meta.y, 20);
        assert_eq!(meta.size_bytes, 1024);
    }

    // ------------------------------------------------------------------------
    // CacheData Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cache_data_default() {
        let data = CacheData::default();
        assert!(data.regions.is_empty());
        assert!(data.tiles.is_empty());
    }

    #[test]
    fn test_cache_data_serialization() {
        let mut data = CacheData::default();
        data.tiles.insert(
            "DSS_5_10_20".to_string(),
            TileMetadata {
                survey_id: "DSS".to_string(),
                zoom: 5,
                x: 10,
                y: 20,
                size_bytes: 1024,
                cached_at: Utc::now(),
            },
        );

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("regions"));
        assert!(json.contains("tiles"));
        assert!(json.contains("DSS_5_10_20"));
    }

    // ------------------------------------------------------------------------
    // CreateRegionArgs Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_create_region_args_serialization() {
        let args = CreateRegionArgs {
            name: "Orion Nebula".to_string(),
            center_ra: 83.82,
            center_dec: -5.39,
            radius_deg: 1.0,
            min_zoom: 5,
            max_zoom: 12,
            survey_id: "DSS".to_string(),
        };

        let json = serde_json::to_string(&args).unwrap();
        assert!(json.contains("Orion Nebula"));
        assert!(json.contains("83.82"));
    }

    #[test]
    fn test_create_region_args_deserialization() {
        let json = r#"{
            "name": "Andromeda",
            "center_ra": 10.68,
            "center_dec": 41.27,
            "radius_deg": 3.0,
            "min_zoom": 3,
            "max_zoom": 10,
            "survey_id": "SDSS"
        }"#;

        let args: CreateRegionArgs = serde_json::from_str(json).unwrap();
        assert_eq!(args.name, "Andromeda");
        assert_eq!(args.center_ra, 10.68);
        assert_eq!(args.center_dec, 41.27);
        assert_eq!(args.survey_id, "SDSS");
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_estimate_tile_count_min_equals_max() {
        // When min_zoom equals max_zoom, should only count one level
        let count = estimate_tile_count(2.0, 7, 7);
        assert!(count > 0);
    }

    #[test]
    fn test_cache_region_clone() {
        let region = CacheRegion {
            id: "test".to_string(),
            name: "Test".to_string(),
            center_ra: 0.0,
            center_dec: 0.0,
            radius_deg: 1.0,
            min_zoom: 1,
            max_zoom: 5,
            survey_id: "DSS".to_string(),
            tile_count: 100,
            size_bytes: 1000,
            status: CacheStatus::Pending,
            progress: 0.0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let cloned = region.clone();
        assert_eq!(cloned.id, region.id);
        assert_eq!(cloned.name, region.name);
        assert_eq!(cloned.status, region.status);
    }

    #[test]
    fn test_all_cache_statuses() {
        let statuses = vec![
            CacheStatus::Pending,
            CacheStatus::Downloading,
            CacheStatus::Paused,
            CacheStatus::Completed,
            CacheStatus::Failed,
            CacheStatus::Cancelled,
        ];

        for status in statuses {
            // Test that each status can be serialized and deserialized
            let json = serde_json::to_string(&status).unwrap();
            let back: CacheStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(back, status);
        }
    }
}
