//! Observation locations management module
//! Manages saved observation sites with geographic coordinates

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::storage::StorageError;
use crate::utils::generate_id;

/// Observation location/site
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservationLocation {
    pub id: String,
    pub name: String,
    pub latitude: f64,  // degrees, positive = North
    pub longitude: f64, // degrees, positive = East
    pub altitude: f64,  // meters above sea level
    pub timezone: Option<String>,
    pub bortle_class: Option<u8>, // 1-9 light pollution scale
    pub notes: Option<String>,
    pub is_default: bool,
    pub is_current: bool, // Currently active location
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Location data container
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocationsData {
    pub locations: Vec<ObservationLocation>,
    pub current_location_id: Option<String>,
}

fn pick_index_by_id(
    locations: &[ObservationLocation],
    preferred_id: Option<&str>,
) -> Option<usize> {
    preferred_id.and_then(|id| locations.iter().position(|loc| loc.id == id))
}

fn pick_current_index(data: &LocationsData, preferred_current_id: Option<&str>) -> usize {
    let locations = &data.locations;

    if let Some(index) = pick_index_by_id(locations, preferred_current_id) {
        return index;
    }
    if let Some(index) = pick_index_by_id(locations, data.current_location_id.as_deref()) {
        return index;
    }
    if let Some(index) = locations.iter().position(|loc| loc.is_current) {
        return index;
    }
    if let Some(index) = locations.iter().position(|loc| loc.is_default) {
        return index;
    }

    0
}

fn pick_default_index(data: &LocationsData, preferred_default_id: Option<&str>) -> usize {
    let locations = &data.locations;

    if let Some(index) = pick_index_by_id(locations, preferred_default_id) {
        return index;
    }
    if let Some(index) = locations.iter().position(|loc| loc.is_default) {
        return index;
    }

    0
}

fn normalize_locations(
    data: &mut LocationsData,
    preferred_current_id: Option<&str>,
    preferred_default_id: Option<&str>,
) -> bool {
    if data.locations.is_empty() {
        let changed = data.current_location_id.is_some();
        data.current_location_id = None;
        return changed;
    }

    let current_index = pick_current_index(data, preferred_current_id);
    let default_index = pick_default_index(data, preferred_default_id);
    let mut changed = false;

    for (index, loc) in data.locations.iter_mut().enumerate() {
        let should_be_current = index == current_index;
        let should_be_default = index == default_index;

        if loc.is_current != should_be_current {
            loc.is_current = should_be_current;
            changed = true;
        }
        if loc.is_default != should_be_default {
            loc.is_default = should_be_default;
            changed = true;
        }
    }

    let expected_current_id = data.locations[current_index].id.clone();
    if data.current_location_id.as_deref() != Some(expected_current_id.as_str()) {
        data.current_location_id = Some(expected_current_id);
        changed = true;
    }

    changed
}

fn get_locations_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|_| StorageError::AppDataDirNotFound)?;

    let dir = app_data_dir.join("skymap").join("locations");

    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }

    Ok(dir.join("locations.json"))
}

/// Load all locations
#[tauri::command]
pub async fn load_locations(app: AppHandle) -> Result<LocationsData, StorageError> {
    let path = get_locations_path(&app)?;

    if !path.exists() {
        return Ok(LocationsData::default());
    }

    let data = fs::read_to_string(&path)?;
    let mut locations: LocationsData = serde_json::from_str(&data)?;

    if normalize_locations(&mut locations, None, None) {
        save_locations(app, locations.clone()).await?;
    }

    Ok(locations)
}

/// Save all locations
#[tauri::command]
pub async fn save_locations(app: AppHandle, locations: LocationsData) -> Result<(), StorageError> {
    let path = get_locations_path(&app)?;
    let json = serde_json::to_string_pretty(&locations)?;
    fs::write(&path, json)?;

    log::info!("Saved locations data to {:?}", path);
    Ok(())
}

/// Add a new location
#[tauri::command]
pub async fn add_location(
    app: AppHandle,
    mut location: ObservationLocation,
) -> Result<LocationsData, StorageError> {
    let mut data = load_locations(app.clone()).await?;

    location.id = generate_id("location");
    location.created_at = Utc::now();
    location.updated_at = Utc::now();
    let new_id = location.id.clone();
    let prefers_current = location.is_current;
    let prefers_default = location.is_default;

    data.locations.push(location);
    normalize_locations(
        &mut data,
        prefers_current.then_some(new_id.as_str()),
        prefers_default.then_some(new_id.as_str()),
    );
    save_locations(app, data.clone()).await?;

    Ok(data)
}

/// Update a location
#[tauri::command]
pub async fn update_location(
    app: AppHandle,
    location: ObservationLocation,
) -> Result<LocationsData, StorageError> {
    let mut data = load_locations(app.clone()).await?;
    let mut preferred_current_id: Option<String> = None;
    let mut preferred_default_id: Option<String> = None;

    if let Some(existing) = data.locations.iter_mut().find(|l| l.id == location.id) {
        // Update fields
        existing.name = location.name;
        existing.latitude = location.latitude;
        existing.longitude = location.longitude;
        existing.altitude = location.altitude;
        existing.timezone = location.timezone;
        existing.bortle_class = location.bortle_class;
        existing.notes = location.notes;
        existing.is_default = location.is_default;
        existing.is_current = location.is_current;
        existing.updated_at = Utc::now();

        if location.is_default {
            preferred_default_id = Some(location.id.clone());
        }

        if location.is_current {
            preferred_current_id = Some(location.id.clone());
        }
    }

    normalize_locations(
        &mut data,
        preferred_current_id.as_deref(),
        preferred_default_id.as_deref(),
    );
    save_locations(app, data.clone()).await?;

    Ok(data)
}

/// Delete a location
#[tauri::command]
pub async fn delete_location(
    app: AppHandle,
    location_id: String,
) -> Result<LocationsData, StorageError> {
    let mut data = load_locations(app.clone()).await?;

    data.locations.retain(|l| l.id != location_id);
    normalize_locations(&mut data, None, None);

    save_locations(app, data.clone()).await?;

    Ok(data)
}

/// Set current location
#[tauri::command]
pub async fn set_current_location(
    app: AppHandle,
    location_id: String,
) -> Result<LocationsData, StorageError> {
    let mut data = load_locations(app.clone()).await?;

    if !data.locations.iter().any(|loc| loc.id == location_id) {
        return Err(StorageError::Other(format!(
            "Location not found: {}",
            location_id
        )));
    }

    normalize_locations(&mut data, Some(location_id.as_str()), None);

    save_locations(app, data.clone()).await?;

    Ok(data)
}

/// Set default location
#[tauri::command]
pub async fn set_default_location(
    app: AppHandle,
    location_id: String,
) -> Result<LocationsData, StorageError> {
    let mut data = load_locations(app.clone()).await?;

    if !data.locations.iter().any(|loc| loc.id == location_id) {
        return Err(StorageError::Other(format!(
            "Location not found: {}",
            location_id
        )));
    }

    normalize_locations(&mut data, None, Some(location_id.as_str()));

    save_locations(app, data.clone()).await?;

    Ok(data)
}

/// Get current location
#[tauri::command]
pub async fn get_current_location(
    app: AppHandle,
) -> Result<Option<ObservationLocation>, StorageError> {
    let data = load_locations(app).await?;

    if let Some(id) = data.current_location_id {
        if let Some(current) = data.locations.iter().find(|l| l.id == id) {
            return Ok(Some(current.clone()));
        }
    }

    Ok(data.locations.into_iter().find(|l| l.is_default))
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn test_location(
        id: &str,
        name: &str,
        is_default: bool,
        is_current: bool,
    ) -> ObservationLocation {
        ObservationLocation {
            id: id.to_string(),
            name: name.to_string(),
            latitude: 0.0,
            longitude: 0.0,
            altitude: 0.0,
            timezone: None,
            bortle_class: None,
            notes: None,
            is_default,
            is_current,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    // ------------------------------------------------------------------------
    // ObservationLocation Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_observation_location_serialization() {
        let location = ObservationLocation {
            id: "loc-1".to_string(),
            name: "Dark Sky Site".to_string(),
            latitude: 34.0522,
            longitude: -118.2437,
            altitude: 100.0,
            timezone: Some("America/Los_Angeles".to_string()),
            bortle_class: Some(3),
            notes: Some("Great for deep sky".to_string()),
            is_default: true,
            is_current: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&location).unwrap();
        assert!(json.contains("loc-1"));
        assert!(json.contains("Dark Sky Site"));
        assert!(json.contains("34.0522"));
        assert!(json.contains("-118.2437"));
        assert!(json.contains("bortle_class"));
    }

    #[test]
    fn test_observation_location_deserialization() {
        let json = r#"{
            "id": "l1",
            "name": "Home Observatory",
            "latitude": 51.5074,
            "longitude": -0.1278,
            "altitude": 50.0,
            "timezone": "Europe/London",
            "bortle_class": 6,
            "notes": null,
            "is_default": false,
            "is_current": true,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }"#;

        let location: ObservationLocation = serde_json::from_str(json).unwrap();
        assert_eq!(location.name, "Home Observatory");
        assert_eq!(location.latitude, 51.5074);
        assert_eq!(location.bortle_class, Some(6));
        assert!(location.is_current);
    }

    #[test]
    fn test_observation_location_clone() {
        let location = ObservationLocation {
            id: "clone-test".to_string(),
            name: "Test".to_string(),
            latitude: 0.0,
            longitude: 0.0,
            altitude: 0.0,
            timezone: None,
            bortle_class: None,
            notes: None,
            is_default: false,
            is_current: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let cloned = location.clone();
        assert_eq!(cloned.id, location.id);
        assert_eq!(cloned.name, location.name);
    }

    #[test]
    fn test_observation_location_without_optional_fields() {
        let json = r#"{
            "id": "l2",
            "name": "Basic Site",
            "latitude": 45.0,
            "longitude": 10.0,
            "altitude": 200.0,
            "timezone": null,
            "bortle_class": null,
            "notes": null,
            "is_default": true,
            "is_current": false,
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }"#;

        let location: ObservationLocation = serde_json::from_str(json).unwrap();
        assert!(location.timezone.is_none());
        assert!(location.bortle_class.is_none());
        assert!(location.notes.is_none());
    }

    // ------------------------------------------------------------------------
    // LocationsData Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_locations_data_default() {
        let data = LocationsData::default();
        assert!(data.locations.is_empty());
        assert!(data.current_location_id.is_none());
    }

    #[test]
    fn test_locations_data_serialization() {
        let mut data = LocationsData::default();
        data.locations.push(ObservationLocation {
            id: "l1".to_string(),
            name: "Site 1".to_string(),
            latitude: 30.0,
            longitude: -90.0,
            altitude: 10.0,
            timezone: None,
            bortle_class: Some(4),
            notes: None,
            is_default: true,
            is_current: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        });
        data.current_location_id = Some("l1".to_string());

        let json = serde_json::to_string(&data).unwrap();
        assert!(json.contains("locations"));
        assert!(json.contains("current_location_id"));
        assert!(json.contains("l1"));
    }

    #[test]
    fn test_locations_data_deserialization() {
        let json = r#"{
            "locations": [
                {
                    "id": "loc1",
                    "name": "Location 1",
                    "latitude": 40.0,
                    "longitude": -74.0,
                    "altitude": 50.0,
                    "timezone": null,
                    "bortle_class": null,
                    "notes": null,
                    "is_default": true,
                    "is_current": true,
                    "created_at": "2024-01-01T00:00:00Z",
                    "updated_at": "2024-01-01T00:00:00Z"
                }
            ],
            "current_location_id": "loc1"
        }"#;

        let data: LocationsData = serde_json::from_str(json).unwrap();
        assert_eq!(data.locations.len(), 1);
        assert_eq!(data.current_location_id, Some("loc1".to_string()));
    }

    #[test]
    fn test_locations_data_clone() {
        let data = LocationsData {
            current_location_id: Some("test-id".to_string()),
            ..Default::default()
        };

        let cloned = data.clone();
        assert_eq!(cloned.current_location_id, data.current_location_id);
    }

    // ------------------------------------------------------------------------
    // Coordinate Validation Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_location_coordinates_range() {
        // Valid coordinates at extremes
        let north_pole = ObservationLocation {
            id: "np".to_string(),
            name: "North Pole".to_string(),
            latitude: 90.0,
            longitude: 0.0,
            altitude: 0.0,
            timezone: None,
            bortle_class: None,
            notes: None,
            is_default: false,
            is_current: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&north_pole).unwrap();
        let back: ObservationLocation = serde_json::from_str(&json).unwrap();
        assert_eq!(back.latitude, 90.0);
    }

    #[test]
    fn test_location_negative_coordinates() {
        let location = ObservationLocation {
            id: "south".to_string(),
            name: "Southern Site".to_string(),
            latitude: -45.0,
            longitude: -120.0,
            altitude: 500.0,
            timezone: None,
            bortle_class: None,
            notes: None,
            is_default: false,
            is_current: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        let json = serde_json::to_string(&location).unwrap();
        assert!(json.contains("-45"));
        assert!(json.contains("-120"));
    }

    // ------------------------------------------------------------------------
    // Bortle Scale Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_bortle_class_range() {
        // Bortle scale is 1-9
        for bortle in 1..=9u8 {
            let location = ObservationLocation {
                id: format!("b{}", bortle),
                name: format!("Bortle {} Site", bortle),
                latitude: 0.0,
                longitude: 0.0,
                altitude: 0.0,
                timezone: None,
                bortle_class: Some(bortle),
                notes: None,
                is_default: false,
                is_current: false,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };

            let json = serde_json::to_string(&location).unwrap();
            let back: ObservationLocation = serde_json::from_str(&json).unwrap();
            assert_eq!(back.bortle_class, Some(bortle));
        }
    }

    #[test]
    fn test_normalize_locations_enforces_single_current_and_default() {
        let mut data = LocationsData {
            locations: vec![
                test_location("l1", "One", false, true),
                test_location("l2", "Two", false, true),
                test_location("l3", "Three", false, false),
            ],
            current_location_id: None,
        };

        let changed = normalize_locations(&mut data, None, None);
        assert!(changed);
        assert_eq!(data.locations.iter().filter(|l| l.is_current).count(), 1);
        assert_eq!(data.locations.iter().filter(|l| l.is_default).count(), 1);
        assert_eq!(
            data.current_location_id,
            Some(
                data.locations
                    .iter()
                    .find(|l| l.is_current)
                    .unwrap()
                    .id
                    .clone()
            )
        );
    }

    #[test]
    fn test_normalize_locations_respects_preferred_default() {
        let mut data = LocationsData {
            locations: vec![
                test_location("l1", "One", true, true),
                test_location("l2", "Two", false, false),
            ],
            current_location_id: Some("l1".to_string()),
        };

        let changed = normalize_locations(&mut data, None, Some("l2"));
        assert!(changed);

        assert!(
            data.locations
                .iter()
                .find(|l| l.id == "l2")
                .unwrap()
                .is_default
        );
        assert!(
            !data
                .locations
                .iter()
                .find(|l| l.id == "l1")
                .unwrap()
                .is_default
        );
        // current stays on l1 because no preferred current was requested
        assert!(
            data.locations
                .iter()
                .find(|l| l.id == "l1")
                .unwrap()
                .is_current
        );
    }

    #[test]
    fn test_normalize_locations_promotes_remaining_location_after_delete() {
        let mut data = LocationsData {
            locations: vec![
                test_location("l1", "One", true, true),
                test_location("l2", "Two", false, false),
            ],
            current_location_id: Some("l1".to_string()),
        };

        data.locations.retain(|l| l.id != "l1");
        normalize_locations(&mut data, None, None);

        assert_eq!(data.locations.len(), 1);
        assert_eq!(data.locations[0].id, "l2");
        assert!(data.locations[0].is_current);
        assert!(data.locations[0].is_default);
        assert_eq!(data.current_location_id, Some("l2".to_string()));
    }
}
