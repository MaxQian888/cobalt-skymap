//! Sky markers management module
//! Manages custom markers on the celestial sphere

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::storage::StorageError;
use crate::utils::generate_id;

/// Marker icon type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MarkerIcon {
    Star,
    Circle,
    Crosshair,
    Pin,
    Diamond,
    Triangle,
    Square,
    Flag,
}

/// Sky marker for annotating positions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkyMarker {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub ra: f64,
    pub dec: f64,
    #[serde(default)]
    pub ra_string: String,
    #[serde(default)]
    pub dec_string: String,
    pub color: String,
    pub icon: MarkerIcon,
    pub created_at: i64,
    pub updated_at: i64,
    pub group: Option<String>,
    pub visible: bool,
}

/// Marker input for creating new markers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkerInput {
    pub id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub ra: f64,
    pub dec: f64,
    #[serde(default)]
    pub ra_string: String,
    #[serde(default)]
    pub dec_string: String,
    pub color: String,
    pub icon: MarkerIcon,
    pub group: Option<String>,
    pub visible: Option<bool>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

/// Marker update payload
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MarkerUpdateInput {
    pub name: Option<String>,
    /// Some(None) means explicit clear; None means not provided.
    pub description: Option<Option<String>>,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub ra_string: Option<String>,
    pub dec_string: Option<String>,
    pub color: Option<String>,
    pub icon: Option<MarkerIcon>,
    /// Some(None) means explicit clear; None means not provided.
    pub group: Option<Option<String>>,
    pub visible: Option<bool>,
}

/// Markers data container
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MarkersData {
    pub markers: Vec<SkyMarker>,
    pub groups: Vec<String>,
    pub show_markers: bool,
    #[serde(default)]
    pub show_markers_updated_at: i64,
}

fn get_markers_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| StorageError::AppDataDirNotFound)?;
    let dir = app_data_dir.join("skymap").join("markers");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("markers.json"))
}

#[tauri::command]
pub async fn load_markers(app: AppHandle) -> Result<MarkersData, StorageError> {
    let path = get_markers_path(&app)?;
    if !path.exists() {
        return Ok(MarkersData {
            markers: Vec::new(),
            groups: vec!["Default".to_string()],
            show_markers: true,
            show_markers_updated_at: 0,
        });
    }
    let data = fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&data)?)
}

#[tauri::command]
pub async fn save_markers(app: AppHandle, markers_data: MarkersData) -> Result<(), StorageError> {
    let path = get_markers_path(&app)?;
    fs::write(&path, serde_json::to_string_pretty(&markers_data)?)?;
    log::info!("Saved markers to {:?}", path);
    Ok(())
}

#[tauri::command]
pub async fn add_marker(app: AppHandle, marker: MarkerInput) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    let now = Utc::now().timestamp_millis();
    let id = match marker.id {
        Some(existing_id)
            if !existing_id.trim().is_empty()
                && !data.markers.iter().any(|m| m.id == existing_id) =>
        {
            existing_id
        }
        _ => generate_id("marker"),
    };
    let created_at = marker.created_at.unwrap_or(now);
    let updated_at = marker.updated_at.unwrap_or(now);
    let new_marker = SkyMarker {
        id,
        name: marker.name,
        description: marker.description,
        ra: marker.ra,
        dec: marker.dec,
        ra_string: marker.ra_string,
        dec_string: marker.dec_string,
        color: marker.color,
        icon: marker.icon,
        created_at,
        updated_at,
        group: marker.group.clone(),
        visible: marker.visible.unwrap_or(true),
    };
    if let Some(ref group) = new_marker.group {
        if !data.groups.contains(group) {
            data.groups.push(group.clone());
        }
    }
    data.markers.push(new_marker);
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn update_marker(
    app: AppHandle,
    marker_id: String,
    updates: MarkerUpdateInput,
) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    if let Some(marker) = data.markers.iter_mut().find(|m| m.id == marker_id) {
        if let Some(name) = updates.name {
            marker.name = name;
        }
        if let Some(desc) = updates.description {
            marker.description = desc;
        }
        if let Some(ra) = updates.ra {
            marker.ra = ra;
        }
        if let Some(dec) = updates.dec {
            marker.dec = dec;
        }
        if let Some(ra_string) = updates.ra_string {
            marker.ra_string = ra_string;
        }
        if let Some(dec_string) = updates.dec_string {
            marker.dec_string = dec_string;
        }
        if let Some(color) = updates.color {
            marker.color = color;
        }
        if let Some(icon) = updates.icon {
            marker.icon = icon;
        }
        if let Some(group_update) = updates.group {
            marker.group = group_update.clone();
            if let Some(group) = group_update {
                if !data.groups.contains(&group) {
                    data.groups.push(group);
                }
            }
        }
        if let Some(visible) = updates.visible {
            marker.visible = visible;
        }
        marker.updated_at = Utc::now().timestamp_millis();
    }
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn remove_marker(app: AppHandle, marker_id: String) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    data.markers.retain(|m| m.id != marker_id);
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn remove_markers_by_group(
    app: AppHandle,
    group: String,
) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    data.markers.retain(|m| m.group.as_ref() != Some(&group));
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn clear_all_markers(app: AppHandle) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    data.markers.clear();
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn toggle_marker_visibility(
    app: AppHandle,
    marker_id: String,
) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    if let Some(marker) = data.markers.iter_mut().find(|m| m.id == marker_id) {
        marker.visible = !marker.visible;
    }
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn set_all_markers_visible(
    app: AppHandle,
    visible: bool,
) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    for marker in &mut data.markers {
        marker.visible = visible;
    }
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn set_show_markers(app: AppHandle, show: bool) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    data.show_markers = show;
    data.show_markers_updated_at = Utc::now().timestamp_millis();
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn add_marker_group(app: AppHandle, group: String) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    if !data.groups.contains(&group) {
        data.groups.push(group);
    }
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn remove_marker_group(
    app: AppHandle,
    group: String,
) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    data.groups.retain(|g| g != &group);
    for marker in &mut data.markers {
        if marker.group.as_ref() == Some(&group) {
            marker.group = Some("Default".to_string());
        }
    }
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn rename_marker_group(
    app: AppHandle,
    old_name: String,
    new_name: String,
) -> Result<MarkersData, StorageError> {
    let mut data = load_markers(app.clone()).await?;
    if let Some(group) = data.groups.iter_mut().find(|g| *g == &old_name) {
        *group = new_name.clone();
    }
    for marker in &mut data.markers {
        if marker.group.as_ref() == Some(&old_name) {
            marker.group = Some(new_name.clone());
        }
    }
    save_markers(app, data.clone()).await?;
    Ok(data)
}

#[tauri::command]
pub async fn get_visible_markers(app: AppHandle) -> Result<Vec<SkyMarker>, StorageError> {
    let data = load_markers(app).await?;
    if !data.show_markers {
        return Ok(Vec::new());
    }
    Ok(data.markers.into_iter().filter(|m| m.visible).collect())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // MarkerIcon Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_marker_icon_serialization() {
        let icons = vec![
            (MarkerIcon::Star, "\"star\""),
            (MarkerIcon::Circle, "\"circle\""),
            (MarkerIcon::Crosshair, "\"crosshair\""),
            (MarkerIcon::Pin, "\"pin\""),
            (MarkerIcon::Diamond, "\"diamond\""),
            (MarkerIcon::Triangle, "\"triangle\""),
            (MarkerIcon::Square, "\"square\""),
            (MarkerIcon::Flag, "\"flag\""),
        ];

        for (icon, expected) in icons {
            let json = serde_json::to_string(&icon).unwrap();
            assert_eq!(json, expected);
        }
    }

    #[test]
    fn test_marker_icon_deserialization() {
        let icon: MarkerIcon = serde_json::from_str("\"star\"").unwrap();
        assert!(matches!(icon, MarkerIcon::Star));

        let icon: MarkerIcon = serde_json::from_str("\"crosshair\"").unwrap();
        assert!(matches!(icon, MarkerIcon::Crosshair));
    }

    // ------------------------------------------------------------------------
    // SkyMarker Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_sky_marker_serialization() {
        let marker = SkyMarker {
            id: "marker-1".to_string(),
            name: "M31 Location".to_string(),
            description: Some("Andromeda Galaxy".to_string()),
            ra: 10.68,
            dec: 41.27,
            ra_string: "00h 42m 44s".to_string(),
            dec_string: "+41° 16' 09\"".to_string(),
            color: "#FF0000".to_string(),
            icon: MarkerIcon::Star,
            created_at: 1704067200000,
            updated_at: 1704067200000,
            group: Some("Galaxies".to_string()),
            visible: true,
        };

        let json = serde_json::to_string(&marker).unwrap();
        assert!(json.contains("marker-1"));
        assert!(json.contains("M31 Location"));
        assert!(json.contains("10.68"));
        assert!(json.contains("#FF0000"));
        assert!(json.contains("Galaxies"));
    }

    #[test]
    fn test_sky_marker_deserialization() {
        let json = r##"{
            "id": "m1",
            "name": "Test Marker",
            "description": null,
            "ra": 180.0,
            "dec": 45.0,
            "ra_string": "12h 00m 00s",
            "dec_string": "+45 00 00",
            "color": "#00FF00",
            "icon": "circle",
            "created_at": 1704067200000,
            "updated_at": 1704067200000,
            "group": null,
            "visible": false
        }"##;

        let marker: SkyMarker = serde_json::from_str(json).unwrap();
        assert_eq!(marker.name, "Test Marker");
        assert_eq!(marker.ra, 180.0);
        assert!(!marker.visible);
        assert!(marker.group.is_none());
    }

    #[test]
    fn test_sky_marker_clone() {
        let marker = SkyMarker {
            id: "clone-test".to_string(),
            name: "Cloneable".to_string(),
            description: None,
            ra: 0.0,
            dec: 0.0,
            ra_string: String::new(),
            dec_string: String::new(),
            color: "#FFFFFF".to_string(),
            icon: MarkerIcon::Pin,
            created_at: 0,
            updated_at: 0,
            group: None,
            visible: true,
        };

        let cloned = marker.clone();
        assert_eq!(cloned.id, marker.id);
        assert_eq!(cloned.name, marker.name);
    }

    // ------------------------------------------------------------------------
    // MarkerInput Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_marker_input_serialization() {
        let input = MarkerInput {
            id: None,
            name: "New Marker".to_string(),
            description: Some("A test marker".to_string()),
            ra: 90.0,
            dec: -30.0,
            ra_string: "06h 00m 00s".to_string(),
            dec_string: "-30° 00' 00\"".to_string(),
            color: "#0000FF".to_string(),
            icon: MarkerIcon::Diamond,
            group: Some("Test Group".to_string()),
            visible: Some(true),
            created_at: Some(1704067200000),
            updated_at: Some(1704067200000),
        };

        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("New Marker"));
        assert!(json.contains("diamond"));
        assert!(json.contains("Test Group"));
    }

    #[test]
    fn test_marker_input_deserialization() {
        let json = r##"{
            "name": "Input Test",
            "description": null,
            "ra": 45.0,
            "dec": 60.0,
            "ra_string": "03h 00m 00s",
            "dec_string": "+60 00 00",
            "color": "#FFFF00",
            "icon": "flag",
            "group": null
        }"##;

        let input: MarkerInput = serde_json::from_str(json).unwrap();
        assert_eq!(input.name, "Input Test");
        assert_eq!(input.ra, 45.0);
        assert!(matches!(input.icon, MarkerIcon::Flag));
    }

    // ------------------------------------------------------------------------
    // MarkersData Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_markers_data_default() {
        let data = MarkersData::default();
        assert!(data.markers.is_empty());
        assert!(data.groups.is_empty());
        assert!(!data.show_markers); // Default is false
        assert_eq!(data.show_markers_updated_at, 0);
    }

    #[test]
    fn test_markers_data_serialization() {
        let mut data = MarkersData::default();
        data.groups.push("Default".to_string());
        data.show_markers = true;
        data.show_markers_updated_at = 1704067200000;
        data.markers.push(SkyMarker {
            id: "m1".to_string(),
            name: "Test".to_string(),
            description: None,
            ra: 0.0,
            dec: 0.0,
            ra_string: String::new(),
            dec_string: String::new(),
            color: "#000000".to_string(),
            icon: MarkerIcon::Circle,
            created_at: 0,
            updated_at: 0,
            group: Some("Default".to_string()),
            visible: true,
        });

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("markers"));
        assert!(json.contains("groups"));
        assert!(json.contains("show_markers"));
        assert!(json.contains("show_markers_updated_at"));
    }

    #[test]
    fn test_markers_data_deserialization() {
        let json = r##"{
            "markers": [],
            "groups": ["Default", "Favorites"],
            "show_markers": true
        }"##;

        let data: MarkersData = serde_json::from_str(json).unwrap();
        assert_eq!(data.groups.len(), 2);
        assert!(data.show_markers);
        assert!(data.markers.is_empty());
    }

    #[test]
    fn test_markers_data_clone() {
        let mut data = MarkersData::default();
        data.show_markers = true;
        data.show_markers_updated_at = 1704067200000;
        data.groups.push("Test".to_string());

        let cloned = data.clone();
        assert_eq!(cloned.show_markers, data.show_markers);
        assert_eq!(cloned.show_markers_updated_at, data.show_markers_updated_at);
        assert_eq!(cloned.groups.len(), data.groups.len());
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_marker_with_special_characters_in_name() {
        let marker = SkyMarker {
            id: "special".to_string(),
            name: "M31 \"Andromeda\" Galaxy".to_string(),
            description: Some("Contains special chars: <>&".to_string()),
            ra: 10.68,
            dec: 41.27,
            ra_string: "00h 42m 44s".to_string(),
            dec_string: "+41° 16'".to_string(),
            color: "#FF00FF".to_string(),
            icon: MarkerIcon::Star,
            created_at: 0,
            updated_at: 0,
            group: None,
            visible: true,
        };

        let json = serde_json::to_string(&marker).unwrap();
        let back: SkyMarker = serde_json::from_str(&json).unwrap();
        assert_eq!(back.name, "M31 \"Andromeda\" Galaxy");
    }

    #[test]
    fn test_marker_coordinates_at_poles() {
        let north_pole = SkyMarker {
            id: "np".to_string(),
            name: "North Celestial Pole".to_string(),
            description: None,
            ra: 0.0,
            dec: 90.0,
            ra_string: "00h 00m 00s".to_string(),
            dec_string: "+90° 00' 00\"".to_string(),
            color: "#FFFFFF".to_string(),
            icon: MarkerIcon::Crosshair,
            created_at: 0,
            updated_at: 0,
            group: None,
            visible: true,
        };

        let json = serde_json::to_string(&north_pole).unwrap();
        let back: SkyMarker = serde_json::from_str(&json).unwrap();
        assert_eq!(back.dec, 90.0);
    }

    #[test]
    fn test_multiple_markers_in_same_group() {
        let mut data = MarkersData::default();
        data.groups.push("Messier".to_string());

        for i in 1..=5 {
            data.markers.push(SkyMarker {
                id: format!("m{}", i),
                name: format!("M{}", i),
                description: None,
                ra: i as f64 * 10.0,
                dec: i as f64 * 5.0,
                ra_string: String::new(),
                dec_string: String::new(),
                color: "#FF0000".to_string(),
                icon: MarkerIcon::Circle,
                created_at: 0,
                updated_at: 0,
                group: Some("Messier".to_string()),
                visible: true,
            });
        }

        assert_eq!(data.markers.len(), 5);
        assert!(data
            .markers
            .iter()
            .all(|m| m.group == Some("Messier".to_string())));
    }
}
