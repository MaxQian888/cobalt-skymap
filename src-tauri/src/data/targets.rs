//! Target list management module
//! Manages observation target lists with persistence

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::storage::StorageError;
use crate::utils::generate_id;

// ============================================================================
// Types
// ============================================================================

/// Observable window for a target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservableWindow {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
    pub max_altitude: f64,
    pub transit_time: DateTime<Utc>,
    pub is_circumpolar: bool,
}

/// Target priority
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TargetPriority {
    Low,
    Medium,
    High,
}

/// Target status
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TargetStatus {
    Planned,
    InProgress,
    Completed,
}

/// Mosaic settings for a target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MosaicSettings {
    pub enabled: bool,
    pub rows: u32,
    pub cols: u32,
    pub overlap: f64,
}

/// Exposure plan for a target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposurePlanAdvancedNoiseFractions {
    pub read: Option<f64>,
    pub sky: Option<f64>,
    pub dark: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposurePlanAdvancedStackEstimate {
    pub recommended_frame_count: Option<u32>,
    pub estimated_total_minutes: Option<f64>,
    pub frames_for_target_snr: Option<u32>,
    pub frames_for_time_noise: Option<u32>,
    pub target_snr: Option<f64>,
    pub target_time_noise_ratio: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposurePlanAdvanced {
    pub sqm: Option<f64>,
    pub filter_bandwidth_nm: Option<f64>,
    pub read_noise_limit_percent: Option<f64>,
    pub gain_strategy: Option<String>,
    pub recommended_gain: Option<f64>,
    pub recommended_exposure_sec: Option<f64>,
    pub sky_flux_per_pixel: Option<f64>,
    pub target_signal_per_pixel_per_sec: Option<f64>,
    pub dynamic_range_score: Option<f64>,
    pub dynamic_range_stops: Option<f64>,
    pub read_noise_used: Option<f64>,
    pub dark_current_used: Option<f64>,
    pub noise_fractions: Option<ExposurePlanAdvancedNoiseFractions>,
    pub stack_estimate: Option<ExposurePlanAdvancedStackEstimate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExposurePlan {
    pub single_exposure: f64, // seconds
    pub total_exposure: f64,  // minutes
    pub sub_frames: u32,
    pub filter: Option<String>,
    #[serde(default)]
    pub advanced: Option<ExposurePlanAdvanced>,
}

/// Target item for shot planning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetItem {
    pub id: String,
    pub name: String,
    pub ra: f64,  // degrees
    pub dec: f64, // degrees
    #[serde(default)]
    pub ra_string: String,
    #[serde(default)]
    pub dec_string: String,
    // Camera/FOV settings at time of adding
    pub sensor_width: Option<f64>,
    pub sensor_height: Option<f64>,
    pub focal_length: Option<f64>,
    pub rotation_angle: Option<f64>,
    // Mosaic settings
    pub mosaic: Option<MosaicSettings>,
    // Exposure plan
    pub exposure_plan: Option<ExposurePlan>,
    // Notes
    pub notes: Option<String>,
    // Timestamps
    pub added_at: i64,
    pub priority: TargetPriority,
    pub status: TargetStatus,
    // Tags for grouping
    pub tags: Vec<String>,
    // Cached observable window
    pub observable_window: Option<ObservableWindow>,
    // Favorite/archived flags
    pub is_favorite: bool,
    pub is_archived: bool,
}

/// Target list data
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TargetListData {
    pub targets: Vec<TargetItem>,
    pub available_tags: Vec<String>,
    pub active_target_id: Option<String>,
}

/// Target input for adding new targets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetInput {
    pub name: String,
    pub ra: f64,
    pub dec: f64,
    #[serde(default)]
    pub ra_string: String,
    #[serde(default)]
    pub dec_string: String,
    pub sensor_width: Option<f64>,
    pub sensor_height: Option<f64>,
    pub focal_length: Option<f64>,
    pub rotation_angle: Option<f64>,
    pub mosaic: Option<MosaicSettings>,
    pub exposure_plan: Option<ExposurePlan>,
    pub notes: Option<String>,
    pub priority: Option<TargetPriority>,
    pub tags: Option<Vec<String>>,
}

/// Batch target input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTargetInput {
    pub name: String,
    pub ra: f64,
    pub dec: f64,
    #[serde(default)]
    pub ra_string: String,
    #[serde(default)]
    pub dec_string: String,
}

// ============================================================================
// Path Helpers
// ============================================================================

fn get_target_list_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| StorageError::AppDataDirNotFound)?;

    let dir = app_data_dir.join("skymap").join("targets");

    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }

    Ok(dir.join("target_list.json"))
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Load target list
#[tauri::command]
pub async fn load_target_list(app: AppHandle) -> Result<TargetListData, StorageError> {
    let path = get_target_list_path(&app)?;

    if !path.exists() {
        return Ok(TargetListData {
            targets: Vec::new(),
            available_tags: vec![
                "galaxy".to_string(),
                "nebula".to_string(),
                "cluster".to_string(),
                "planetary".to_string(),
                "tonight".to_string(),
                "priority".to_string(),
            ],
            active_target_id: None,
        });
    }

    let data = fs::read_to_string(&path)?;
    let target_list: TargetListData = serde_json::from_str(&data)?;

    Ok(target_list)
}

/// Save target list
#[tauri::command]
pub async fn save_target_list(
    app: AppHandle,
    target_list: TargetListData,
) -> Result<(), StorageError> {
    let path = get_target_list_path(&app)?;
    let json = serde_json::to_string_pretty(&target_list)?;
    fs::write(&path, json)?;

    log::info!("Saved target list to {:?}", path);
    Ok(())
}

/// Add a target
#[tauri::command]
pub async fn add_target(
    app: AppHandle,
    target: TargetInput,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    let new_target = TargetItem {
        id: generate_id("target"),
        name: target.name,
        ra: target.ra,
        dec: target.dec,
        ra_string: target.ra_string,
        dec_string: target.dec_string,
        sensor_width: target.sensor_width,
        sensor_height: target.sensor_height,
        focal_length: target.focal_length,
        rotation_angle: target.rotation_angle,
        mosaic: target.mosaic,
        exposure_plan: target.exposure_plan,
        notes: target.notes,
        added_at: Utc::now().timestamp_millis(),
        priority: target.priority.unwrap_or(TargetPriority::Medium),
        status: TargetStatus::Planned,
        tags: target.tags.unwrap_or_default(),
        observable_window: None,
        is_favorite: false,
        is_archived: false,
    };

    data.targets.push(new_target);
    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Add multiple targets in batch
#[tauri::command]
pub async fn add_targets_batch(
    app: AppHandle,
    targets: Vec<BatchTargetInput>,
    default_priority: Option<TargetPriority>,
    default_tags: Option<Vec<String>>,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    for target in targets {
        let new_target = TargetItem {
            id: generate_id("target"),
            name: target.name,
            ra: target.ra,
            dec: target.dec,
            ra_string: target.ra_string,
            dec_string: target.dec_string,
            sensor_width: None,
            sensor_height: None,
            focal_length: None,
            rotation_angle: None,
            mosaic: None,
            exposure_plan: None,
            notes: None,
            added_at: Utc::now().timestamp_millis(),
            priority: default_priority.clone().unwrap_or(TargetPriority::Medium),
            status: TargetStatus::Planned,
            tags: default_tags.clone().unwrap_or_default(),
            observable_window: None,
            is_favorite: false,
            is_archived: false,
        };
        data.targets.push(new_target);
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Update a target
#[tauri::command]
pub async fn update_target(
    app: AppHandle,
    target_id: String,
    updates: serde_json::Value,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    if let Some(target) = data.targets.iter_mut().find(|t| t.id == target_id) {
        // Apply updates from JSON
        if let Some(name) = updates.get("name").and_then(|v| v.as_str()) {
            target.name = name.to_string();
        }
        if let Some(notes) = updates.get("notes").and_then(|v| v.as_str()) {
            target.notes = Some(notes.to_string());
        }
        if let Some(priority) = updates.get("priority").and_then(|v| v.as_str()) {
            target.priority = match priority {
                "low" => TargetPriority::Low,
                "high" => TargetPriority::High,
                _ => TargetPriority::Medium,
            };
        }
        if let Some(status) = updates.get("status").and_then(|v| v.as_str()) {
            target.status = match status {
                "in_progress" => TargetStatus::InProgress,
                "completed" => TargetStatus::Completed,
                _ => TargetStatus::Planned,
            };
        }
        if let Some(is_favorite) = updates.get("is_favorite").and_then(|v| v.as_bool()) {
            target.is_favorite = is_favorite;
        }
        if let Some(is_archived) = updates.get("is_archived").and_then(|v| v.as_bool()) {
            target.is_archived = is_archived;
        }
        if let Some(tags) = updates.get("tags").and_then(|v| v.as_array()) {
            target.tags = tags
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
        }
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Remove a target
#[tauri::command]
pub async fn remove_target(
    app: AppHandle,
    target_id: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    data.targets.retain(|t| t.id != target_id);

    if data.active_target_id.as_ref() == Some(&target_id) {
        data.active_target_id = None;
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Remove multiple targets
#[tauri::command]
pub async fn remove_targets_batch(
    app: AppHandle,
    target_ids: Vec<String>,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    let ids_set: std::collections::HashSet<_> = target_ids.iter().collect();
    data.targets.retain(|t| !ids_set.contains(&t.id));

    if let Some(ref active_id) = data.active_target_id {
        if ids_set.contains(active_id) {
            data.active_target_id = None;
        }
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Set active target
#[tauri::command]
pub async fn set_active_target(
    app: AppHandle,
    target_id: Option<String>,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;
    data.active_target_id = target_id;
    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Toggle target favorite status
#[tauri::command]
pub async fn toggle_target_favorite(
    app: AppHandle,
    target_id: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    if let Some(target) = data.targets.iter_mut().find(|t| t.id == target_id) {
        target.is_favorite = !target.is_favorite;
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Toggle target archive status
#[tauri::command]
pub async fn toggle_target_archive(
    app: AppHandle,
    target_id: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    if let Some(target) = data.targets.iter_mut().find(|t| t.id == target_id) {
        target.is_archived = !target.is_archived;
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Set status for multiple targets
#[tauri::command]
pub async fn set_targets_status_batch(
    app: AppHandle,
    target_ids: Vec<String>,
    status: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    let ids_set: std::collections::HashSet<_> = target_ids.iter().collect();
    let new_status = match status.as_str() {
        "in_progress" => TargetStatus::InProgress,
        "completed" => TargetStatus::Completed,
        _ => TargetStatus::Planned,
    };

    for target in &mut data.targets {
        if ids_set.contains(&target.id) {
            target.status = new_status.clone();
        }
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Set priority for multiple targets
#[tauri::command]
pub async fn set_targets_priority_batch(
    app: AppHandle,
    target_ids: Vec<String>,
    priority: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    let ids_set: std::collections::HashSet<_> = target_ids.iter().collect();
    let new_priority = match priority.as_str() {
        "low" => TargetPriority::Low,
        "high" => TargetPriority::High,
        _ => TargetPriority::Medium,
    };

    for target in &mut data.targets {
        if ids_set.contains(&target.id) {
            target.priority = new_priority.clone();
        }
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Add tag to multiple targets
#[tauri::command]
pub async fn add_tag_to_targets(
    app: AppHandle,
    target_ids: Vec<String>,
    tag: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    let ids_set: std::collections::HashSet<_> = target_ids.iter().collect();

    for target in &mut data.targets {
        if ids_set.contains(&target.id) && !target.tags.contains(&tag) {
            target.tags.push(tag.clone());
        }
    }

    // Add to available tags if not present
    if !data.available_tags.contains(&tag) {
        data.available_tags.push(tag);
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Remove tag from multiple targets
#[tauri::command]
pub async fn remove_tag_from_targets(
    app: AppHandle,
    target_ids: Vec<String>,
    tag: String,
) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    let ids_set: std::collections::HashSet<_> = target_ids.iter().collect();

    for target in &mut data.targets {
        if ids_set.contains(&target.id) {
            target.tags.retain(|t| t != &tag);
        }
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Archive all completed targets
#[tauri::command]
pub async fn archive_completed_targets(app: AppHandle) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    for target in &mut data.targets {
        if matches!(target.status, TargetStatus::Completed) {
            target.is_archived = true;
        }
    }

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Clear all completed targets
#[tauri::command]
pub async fn clear_completed_targets(app: AppHandle) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    data.targets
        .retain(|t| !matches!(t.status, TargetStatus::Completed));

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Clear all targets
#[tauri::command]
pub async fn clear_all_targets(app: AppHandle) -> Result<TargetListData, StorageError> {
    let mut data = load_target_list(app.clone()).await?;

    data.targets.clear();
    data.active_target_id = None;

    save_target_list(app, data.clone()).await?;

    Ok(data)
}

/// Search targets
#[tauri::command]
pub async fn search_targets(
    app: AppHandle,
    query: String,
) -> Result<Vec<TargetItem>, StorageError> {
    let data = load_target_list(app).await?;
    let query_lower = query.to_lowercase();

    let results: Vec<TargetItem> = data
        .targets
        .into_iter()
        .filter(|t| {
            t.name.to_lowercase().contains(&query_lower)
                || t.notes
                    .as_ref()
                    .map(|n| n.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || t.tags
                    .iter()
                    .any(|tag| tag.to_lowercase().contains(&query_lower))
        })
        .collect();

    Ok(results)
}

/// Get target statistics
#[tauri::command]
pub async fn get_target_stats(app: AppHandle) -> Result<TargetStats, StorageError> {
    let data = load_target_list(app).await?;

    let total = data.targets.len();
    let planned = data
        .targets
        .iter()
        .filter(|t| matches!(t.status, TargetStatus::Planned))
        .count();
    let in_progress = data
        .targets
        .iter()
        .filter(|t| matches!(t.status, TargetStatus::InProgress))
        .count();
    let completed = data
        .targets
        .iter()
        .filter(|t| matches!(t.status, TargetStatus::Completed))
        .count();
    let favorites = data.targets.iter().filter(|t| t.is_favorite).count();
    let archived = data.targets.iter().filter(|t| t.is_archived).count();

    // Count by priority
    let high_priority = data
        .targets
        .iter()
        .filter(|t| matches!(t.priority, TargetPriority::High))
        .count();
    let medium_priority = data
        .targets
        .iter()
        .filter(|t| matches!(t.priority, TargetPriority::Medium))
        .count();
    let low_priority = data
        .targets
        .iter()
        .filter(|t| matches!(t.priority, TargetPriority::Low))
        .count();

    // Count by tags
    let mut tag_counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    for target in &data.targets {
        for tag in &target.tags {
            *tag_counts.entry(tag.clone()).or_insert(0) += 1;
        }
    }

    Ok(TargetStats {
        total,
        planned,
        in_progress,
        completed,
        favorites,
        archived,
        high_priority,
        medium_priority,
        low_priority,
        by_tag: tag_counts.into_iter().collect(),
    })
}

/// Target statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetStats {
    pub total: usize,
    pub planned: usize,
    pub in_progress: usize,
    pub completed: usize,
    pub favorites: usize,
    pub archived: usize,
    pub high_priority: usize,
    pub medium_priority: usize,
    pub low_priority: usize,
    pub by_tag: Vec<(String, usize)>,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // TargetPriority Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_priority_serialization() {
        let priorities = vec![
            (TargetPriority::Low, "\"low\""),
            (TargetPriority::Medium, "\"medium\""),
            (TargetPriority::High, "\"high\""),
        ];

        for (priority, expected) in priorities {
            let json = serde_json::to_string(&priority).unwrap();
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_target_priority_deserialization() {
        let p: TargetPriority = serde_json::from_str("\"low\"").unwrap();
        assert!(matches!(p, TargetPriority::Low));

        let p: TargetPriority = serde_json::from_str("\"high\"").unwrap();
        assert!(matches!(p, TargetPriority::High));
    }

    // ------------------------------------------------------------------------
    // TargetStatus Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_status_serialization() {
        let statuses = vec![
            (TargetStatus::Planned, "\"planned\""),
            (TargetStatus::InProgress, "\"in_progress\""),
            (TargetStatus::Completed, "\"completed\""),
        ];

        for (status, expected) in statuses {
            let json = serde_json::to_string(&status).unwrap();
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_target_status_deserialization() {
        let s: TargetStatus = serde_json::from_str("\"planned\"").unwrap();
        assert!(matches!(s, TargetStatus::Planned));

        let s: TargetStatus = serde_json::from_str("\"in_progress\"").unwrap();
        assert!(matches!(s, TargetStatus::InProgress));
    }

    // ------------------------------------------------------------------------
    // MosaicSettings Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_mosaic_settings_serialization() {
        let mosaic = MosaicSettings {
            enabled: true,
            rows: 3,
            cols: 2,
            overlap: 15.0,
        };

        let json = serde_json::to_string(&mosaic).unwrap();
        assert!(json.contains("\"enabled\":true"));
        assert!(json.contains("\"rows\":3"));
        assert!(json.contains("\"cols\":2"));
        assert!(json.contains("\"overlap\":15"));
    }

    #[test]
    fn test_mosaic_settings_deserialization() {
        let json = r#"{"enabled": false, "rows": 4, "cols": 4, "overlap": 20.0}"#;
        let mosaic: MosaicSettings = serde_json::from_str(json).unwrap();
        assert!(!mosaic.enabled);
        assert_eq!(mosaic.rows, 4);
        assert_eq!(mosaic.cols, 4);
        assert_eq!(mosaic.overlap, 20.0);
    }

    // ------------------------------------------------------------------------
    // ExposurePlan Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_exposure_plan_serialization() {
        let plan = ExposurePlan {
            single_exposure: 300.0,
            total_exposure: 180.0,
            sub_frames: 36,
            filter: Some("Ha".to_string()),
            advanced: None,
        };

        let json = serde_json::to_string(&plan).unwrap();
        assert!(json.contains("300"));
        assert!(json.contains("180"));
        assert!(json.contains("36"));
        assert!(json.contains("Ha"));
    }

    #[test]
    fn test_exposure_plan_deserialization() {
        let json = r#"{"single_exposure": 120.0, "total_exposure": 60.0, "sub_frames": 30, "filter": null}"#;
        let plan: ExposurePlan = serde_json::from_str(json).unwrap();
        assert_eq!(plan.single_exposure, 120.0);
        assert_eq!(plan.sub_frames, 30);
        assert!(plan.filter.is_none());
        assert!(plan.advanced.is_none());
    }

    #[test]
    fn test_exposure_plan_with_advanced_fields() {
        let json = r#"{
            "single_exposure": 180.0,
            "total_exposure": 120.0,
            "sub_frames": 40,
            "filter": "L",
            "advanced": {
                "read_noise_limit_percent": 5.0,
                "gain_strategy": "unity",
                "recommended_gain": 100.0,
                "dynamic_range_score": 4523.4,
                "noise_fractions": {
                    "read": 0.05,
                    "sky": 0.9,
                    "dark": 0.05
                },
                "stack_estimate": {
                    "recommended_frame_count": 120,
                    "estimated_total_minutes": 360.0
                }
            }
        }"#;

        let plan: ExposurePlan = serde_json::from_str(json).unwrap();
        assert_eq!(plan.single_exposure, 180.0);
        assert!(plan.advanced.is_some());

        let advanced = plan.advanced.unwrap();
        assert_eq!(advanced.gain_strategy, Some("unity".to_string()));
        assert_eq!(advanced.read_noise_limit_percent, Some(5.0));
        assert_eq!(
            advanced
                .stack_estimate
                .as_ref()
                .and_then(|stack| stack.recommended_frame_count),
            Some(120)
        );
    }

    // ------------------------------------------------------------------------
    // ObservableWindow Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_observable_window_serialization() {
        let window = ObservableWindow {
            start: Utc::now(),
            end: Utc::now(),
            max_altitude: 75.5,
            transit_time: Utc::now(),
            is_circumpolar: false,
        };

        let json = serde_json::to_string(&window).unwrap();
        assert!(json.contains("start"));
        assert!(json.contains("max_altitude"));
        assert!(json.contains("is_circumpolar"));
    }

    #[test]
    fn test_observable_window_clone() {
        let window = ObservableWindow {
            start: Utc::now(),
            end: Utc::now(),
            max_altitude: 60.0,
            transit_time: Utc::now(),
            is_circumpolar: true,
        };

        let cloned = window.clone();
        assert_eq!(cloned.max_altitude, window.max_altitude);
        assert_eq!(cloned.is_circumpolar, window.is_circumpolar);
    }

    // ------------------------------------------------------------------------
    // TargetItem Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_item_serialization() {
        let target = TargetItem {
            id: "target-1".to_string(),
            name: "M31".to_string(),
            ra: 10.68,
            dec: 41.27,
            ra_string: "00h 42m 44s".to_string(),
            dec_string: "+41 16".to_string(),
            sensor_width: Some(23.2),
            sensor_height: Some(15.5),
            focal_length: Some(400.0),
            rotation_angle: Some(0.0),
            mosaic: None,
            exposure_plan: None,
            notes: Some("Andromeda Galaxy".to_string()),
            added_at: 1704067200000,
            priority: TargetPriority::High,
            status: TargetStatus::Planned,
            tags: vec!["galaxy".to_string()],
            observable_window: None,
            is_favorite: true,
            is_archived: false,
        };

        let json = serde_json::to_string(&target).unwrap();
        assert!(json.contains("target-1"));
        assert!(json.contains("M31"));
        assert!(json.contains("10.68"));
        assert!(json.contains("high"));
        assert!(json.contains("galaxy"));
    }

    #[test]
    fn test_target_item_deserialization() {
        let json = r##"{
            "id": "t1",
            "name": "Orion Nebula",
            "ra": 83.82,
            "dec": -5.39,
            "ra_string": "05h 35m 17s",
            "dec_string": "-05 23",
            "sensor_width": null,
            "sensor_height": null,
            "focal_length": null,
            "rotation_angle": null,
            "mosaic": null,
            "exposure_plan": null,
            "notes": null,
            "added_at": 1704067200000,
            "priority": "medium",
            "status": "planned",
            "tags": ["nebula", "tonight"],
            "observable_window": null,
            "is_favorite": false,
            "is_archived": false
        }"##;

        let target: TargetItem = serde_json::from_str(json).unwrap();
        assert_eq!(target.name, "Orion Nebula");
        assert_eq!(target.ra, 83.82);
        assert_eq!(target.tags.len(), 2);
        assert!(!target.is_favorite);
    }

    // ------------------------------------------------------------------------
    // TargetListData Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_list_data_default() {
        let data = TargetListData::default();
        assert!(data.targets.is_empty());
        assert!(data.available_tags.is_empty());
        assert!(data.active_target_id.is_none());
    }

    #[test]
    fn test_target_list_data_serialization() {
        let mut data = TargetListData::default();
        data.available_tags = vec!["galaxy".to_string(), "nebula".to_string()];
        data.active_target_id = Some("target-1".to_string());

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("targets"));
        assert!(json.contains("available_tags"));
        assert!(json.contains("active_target_id"));
        assert!(json.contains("galaxy"));
    }

    #[test]
    fn test_target_list_data_clone() {
        let mut data = TargetListData::default();
        data.active_target_id = Some("test".to_string());

        let cloned = data.clone();
        assert_eq!(cloned.active_target_id, data.active_target_id);
    }

    // ------------------------------------------------------------------------
    // TargetInput Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_input_serialization() {
        let input = TargetInput {
            name: "New Target".to_string(),
            ra: 120.0,
            dec: 30.0,
            ra_string: "08h 00m 00s".to_string(),
            dec_string: "+30 00".to_string(),
            sensor_width: Some(23.2),
            sensor_height: Some(15.5),
            focal_length: Some(500.0),
            rotation_angle: None,
            mosaic: Some(MosaicSettings {
                enabled: true,
                rows: 2,
                cols: 2,
                overlap: 10.0,
            }),
            exposure_plan: None,
            notes: Some("Test target".to_string()),
            priority: Some(TargetPriority::High),
            tags: Some(vec!["test".to_string()]),
        };

        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("New Target"));
        assert!(json.contains("mosaic"));
        assert!(json.contains("high"));
    }

    // ------------------------------------------------------------------------
    // BatchTargetInput Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_batch_target_input_serialization() {
        let input = BatchTargetInput {
            name: "Batch Target".to_string(),
            ra: 180.0,
            dec: 45.0,
            ra_string: "12h 00m 00s".to_string(),
            dec_string: "+45 00".to_string(),
        };

        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("Batch Target"));
        assert!(json.contains("180"));
    }

    #[test]
    fn test_batch_target_input_deserialization() {
        let json = r#"{"name": "Test", "ra": 90.0, "dec": -30.0, "ra_string": "06h", "dec_string": "-30"}"#;
        let input: BatchTargetInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.name, "Test");
        assert_eq!(input.ra, 90.0);
        assert_eq!(input.dec, -30.0);
    }

    // ------------------------------------------------------------------------
    // TargetStats Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_stats_serialization() {
        let stats = TargetStats {
            total: 10,
            planned: 5,
            in_progress: 3,
            completed: 2,
            favorites: 4,
            archived: 1,
            high_priority: 3,
            medium_priority: 4,
            low_priority: 3,
            by_tag: vec![("galaxy".to_string(), 5), ("nebula".to_string(), 3)],
        };

        let json = serde_json::to_string(&stats).unwrap();
        assert!(json.contains("\"total\":10"));
        assert!(json.contains("\"planned\":5"));
        assert!(json.contains("by_tag"));
    }

    #[test]
    fn test_target_stats_deserialization() {
        let json = r#"{
            "total": 20,
            "planned": 10,
            "in_progress": 5,
            "completed": 5,
            "favorites": 8,
            "archived": 2,
            "high_priority": 6,
            "medium_priority": 8,
            "low_priority": 6,
            "by_tag": [["cluster", 4]]
        }"#;

        let stats: TargetStats = serde_json::from_str(json).unwrap();
        assert_eq!(stats.total, 20);
        assert_eq!(stats.favorites, 8);
        assert_eq!(stats.by_tag.len(), 1);
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_with_all_optional_fields() {
        let target = TargetItem {
            id: "full".to_string(),
            name: "Full Target".to_string(),
            ra: 0.0,
            dec: 0.0,
            ra_string: String::new(),
            dec_string: String::new(),
            sensor_width: Some(36.0),
            sensor_height: Some(24.0),
            focal_length: Some(1000.0),
            rotation_angle: Some(45.0),
            mosaic: Some(MosaicSettings {
                enabled: true,
                rows: 3,
                cols: 3,
                overlap: 20.0,
            }),
            exposure_plan: Some(ExposurePlan {
                single_exposure: 600.0,
                total_exposure: 300.0,
                sub_frames: 30,
                filter: Some("L".to_string()),
                advanced: None,
            }),
            notes: Some("Complete target".to_string()),
            added_at: 0,
            priority: TargetPriority::High,
            status: TargetStatus::InProgress,
            tags: vec!["test".to_string(), "complete".to_string()],
            observable_window: Some(ObservableWindow {
                start: Utc::now(),
                end: Utc::now(),
                max_altitude: 80.0,
                transit_time: Utc::now(),
                is_circumpolar: false,
            }),
            is_favorite: true,
            is_archived: false,
        };

        let json = serde_json::to_string(&target).unwrap();
        let back: TargetItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back.mosaic.as_ref().unwrap().rows, 3);
        assert_eq!(
            back.exposure_plan.as_ref().unwrap().filter,
            Some("L".to_string())
        );
    }

    #[test]
    fn test_target_coordinates_at_extremes() {
        let target = TargetItem {
            id: "extreme".to_string(),
            name: "Near Pole".to_string(),
            ra: 359.99,
            dec: 89.99,
            ra_string: "23h 59m 58s".to_string(),
            dec_string: "+89 59".to_string(),
            sensor_width: None,
            sensor_height: None,
            focal_length: None,
            rotation_angle: None,
            mosaic: None,
            exposure_plan: None,
            notes: None,
            added_at: 0,
            priority: TargetPriority::Low,
            status: TargetStatus::Planned,
            tags: vec![],
            observable_window: None,
            is_favorite: false,
            is_archived: false,
        };

        let json = serde_json::to_string(&target).unwrap();
        let back: TargetItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back.ra, 359.99);
        assert_eq!(back.dec, 89.99);
    }

    #[test]
    fn test_multiple_tags() {
        let target = TargetItem {
            id: "multi-tag".to_string(),
            name: "Multi Tag Target".to_string(),
            ra: 0.0,
            dec: 0.0,
            ra_string: String::new(),
            dec_string: String::new(),
            sensor_width: None,
            sensor_height: None,
            focal_length: None,
            rotation_angle: None,
            mosaic: None,
            exposure_plan: None,
            notes: None,
            added_at: 0,
            priority: TargetPriority::Medium,
            status: TargetStatus::Planned,
            tags: vec![
                "galaxy".to_string(),
                "tonight".to_string(),
                "priority".to_string(),
                "favorite".to_string(),
            ],
            observable_window: None,
            is_favorite: true,
            is_archived: false,
        };

        let json = serde_json::to_string(&target).unwrap();
        let back: TargetItem = serde_json::from_str(&json).unwrap();
        assert_eq!(back.tags.len(), 4);
        assert!(back.tags.contains(&"tonight".to_string()));
    }
}
