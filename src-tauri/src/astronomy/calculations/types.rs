//! Astronomy calculation types
//! All coordinate and result types used across calculation submodules

use serde::{Deserialize, Serialize};

// ============================================================================
// Coordinate Types
// ============================================================================

/// Equatorial coordinates (RA/Dec)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquatorialCoords {
    pub ra: f64,  // Right Ascension in degrees (0-360)
    pub dec: f64, // Declination in degrees (-90 to +90)
}

/// Horizontal/Altazimuth coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HorizontalCoords {
    pub alt: f64, // Altitude in degrees (-90 to +90)
    pub az: f64,  // Azimuth in degrees (0-360, N=0, E=90)
}

/// Geographic location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeoLocation {
    pub latitude: f64,  // degrees, positive = North
    pub longitude: f64, // degrees, positive = East
    pub altitude: f64,  // meters above sea level
}

/// Galactic coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalacticCoords {
    pub l: f64, // Galactic longitude in degrees
    pub b: f64, // Galactic latitude in degrees
}

/// Ecliptic coordinates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EclipticCoords {
    pub lon: f64, // Ecliptic longitude in degrees
    pub lat: f64, // Ecliptic latitude in degrees
}

// ============================================================================
// Visibility Types
// ============================================================================

/// Target visibility information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisibilityInfo {
    pub is_visible: bool,
    pub current_altitude: f64,
    pub current_azimuth: f64,
    pub rise_time: Option<i64>,
    pub set_time: Option<i64>,
    pub transit_time: Option<i64>,
    pub transit_altitude: f64,
    pub is_circumpolar: bool,
    pub never_rises: bool,
    pub hours_visible: f64,
}

// ============================================================================
// Twilight Types
// ============================================================================

/// Twilight times for a given date and location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TwilightTimes {
    pub date: String,
    pub sunrise: Option<i64>,
    pub sunset: Option<i64>,
    pub civil_dawn: Option<i64>,
    pub civil_dusk: Option<i64>,
    pub nautical_dawn: Option<i64>,
    pub nautical_dusk: Option<i64>,
    pub astronomical_dawn: Option<i64>,
    pub astronomical_dusk: Option<i64>,
    pub solar_noon: Option<i64>,
    pub is_polar_day: bool,
    pub is_polar_night: bool,
}

// ============================================================================
// Celestial Body Types
// ============================================================================

/// Moon phase information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoonPhase {
    pub phase: f64,        // 0-1 (0 = new, 0.5 = full)
    pub illumination: f64, // 0-100%
    pub age: f64,          // days since new moon
    pub phase_name: String,
    pub is_waxing: bool,
}

/// Moon position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoonPosition {
    pub ra: f64,
    pub dec: f64,
    pub altitude: f64,
    pub azimuth: f64,
    pub distance: f64, // km
}

/// Sun position
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SunPosition {
    pub ra: f64,
    pub dec: f64,
    pub altitude: f64,
    pub azimuth: f64,
}

// ============================================================================
// Imaging Types
// ============================================================================

/// FOV calculation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FOVResult {
    pub width_deg: f64,
    pub height_deg: f64,
    pub width_arcmin: f64,
    pub height_arcmin: f64,
    pub image_scale: f64, // arcsec/pixel
    pub f_ratio: f64,
}

/// Mosaic coverage result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MosaicCoverage {
    pub total_width_deg: f64,
    pub total_height_deg: f64,
    pub total_panels: u32,
    pub panel_width_deg: f64,
    pub panel_height_deg: f64,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{de::DeserializeOwned, Serialize};
    use serde_json::json;

    fn assert_json_contract<T>(value: &T, expected: serde_json::Value)
    where
        T: Serialize + DeserializeOwned,
    {
        assert_eq!(serde_json::to_value(value).unwrap(), expected);

        let roundtrip: T = serde_json::from_value(expected.clone()).unwrap();
        assert_eq!(serde_json::to_value(&roundtrip).unwrap(), expected);
    }

    #[test]
    fn test_coordinate_types_follow_expected_json_contract() {
        assert_json_contract(
            &EquatorialCoords {
                ra: 83.6331,
                dec: 22.0145,
            },
            json!({
                "ra": 83.6331,
                "dec": 22.0145
            }),
        );

        assert_json_contract(
            &HorizontalCoords {
                alt: 45.25,
                az: 182.5,
            },
            json!({
                "alt": 45.25,
                "az": 182.5
            }),
        );

        assert_json_contract(
            &GeoLocation {
                latitude: 35.6895,
                longitude: 139.6917,
                altitude: 40.0,
            },
            json!({
                "latitude": 35.6895,
                "longitude": 139.6917,
                "altitude": 40.0
            }),
        );

        assert_json_contract(
            &GalacticCoords {
                l: 121.1743,
                b: -21.5729,
            },
            json!({
                "l": 121.1743,
                "b": -21.5729
            }),
        );

        assert_json_contract(
            &EclipticCoords {
                lon: 84.0,
                lat: -1.3,
            },
            json!({
                "lon": 84.0,
                "lat": -1.3
            }),
        );
    }

    #[test]
    fn test_visibility_and_twilight_types_follow_expected_json_contract() {
        assert_json_contract(
            &VisibilityInfo {
                is_visible: true,
                current_altitude: 37.8,
                current_azimuth: 155.4,
                rise_time: Some(1_704_067_200),
                set_time: Some(1_704_103_200),
                transit_time: Some(1_704_085_200),
                transit_altitude: 72.5,
                is_circumpolar: false,
                never_rises: false,
                hours_visible: 10.0,
            },
            json!({
                "is_visible": true,
                "current_altitude": 37.8,
                "current_azimuth": 155.4,
                "rise_time": 1704067200i64,
                "set_time": 1704103200i64,
                "transit_time": 1704085200i64,
                "transit_altitude": 72.5,
                "is_circumpolar": false,
                "never_rises": false,
                "hours_visible": 10.0
            }),
        );

        assert_json_contract(
            &TwilightTimes {
                date: "2026-03-13".to_string(),
                sunrise: Some(1_741_820_800),
                sunset: Some(1_741_864_600),
                civil_dawn: Some(1_741_819_000),
                civil_dusk: Some(1_741_866_400),
                nautical_dawn: Some(1_741_816_900),
                nautical_dusk: Some(1_741_868_500),
                astronomical_dawn: Some(1_741_814_800),
                astronomical_dusk: Some(1_741_870_600),
                solar_noon: Some(1_741_842_600),
                is_polar_day: false,
                is_polar_night: false,
            },
            json!({
                "date": "2026-03-13",
                "sunrise": 1741820800i64,
                "sunset": 1741864600i64,
                "civil_dawn": 1741819000i64,
                "civil_dusk": 1741866400i64,
                "nautical_dawn": 1741816900i64,
                "nautical_dusk": 1741868500i64,
                "astronomical_dawn": 1741814800i64,
                "astronomical_dusk": 1741870600i64,
                "solar_noon": 1741842600i64,
                "is_polar_day": false,
                "is_polar_night": false
            }),
        );
    }

    #[test]
    fn test_celestial_and_imaging_types_follow_expected_json_contract() {
        assert_json_contract(
            &MoonPhase {
                phase: 0.5,
                illumination: 99.8,
                age: 14.7,
                phase_name: "Full Moon".to_string(),
                is_waxing: false,
            },
            json!({
                "phase": 0.5,
                "illumination": 99.8,
                "age": 14.7,
                "phase_name": "Full Moon",
                "is_waxing": false
            }),
        );

        assert_json_contract(
            &MoonPosition {
                ra: 120.0,
                dec: -12.5,
                altitude: 28.4,
                azimuth: 132.7,
                distance: 384_400.0,
            },
            json!({
                "ra": 120.0,
                "dec": -12.5,
                "altitude": 28.4,
                "azimuth": 132.7,
                "distance": 384400.0
            }),
        );

        assert_json_contract(
            &SunPosition {
                ra: 352.1,
                dec: -3.2,
                altitude: -12.4,
                azimuth: 258.8,
            },
            json!({
                "ra": 352.1,
                "dec": -3.2,
                "altitude": -12.4,
                "azimuth": 258.8
            }),
        );

        assert_json_contract(
            &FOVResult {
                width_deg: 5.15,
                height_deg: 3.44,
                width_arcmin: 309.0,
                height_arcmin: 206.4,
                image_scale: 2.22,
                f_ratio: 5.0,
            },
            json!({
                "width_deg": 5.15,
                "height_deg": 3.44,
                "width_arcmin": 309.0,
                "height_arcmin": 206.4,
                "image_scale": 2.22,
                "f_ratio": 5.0
            }),
        );

        assert_json_contract(
            &MosaicCoverage {
                total_width_deg: 8.2,
                total_height_deg: 5.4,
                total_panels: 6,
                panel_width_deg: 3.0,
                panel_height_deg: 2.0,
            },
            json!({
                "total_width_deg": 8.2,
                "total_height_deg": 5.4,
                "total_panels": 6,
                "panel_width_deg": 3.0,
                "panel_height_deg": 2.0
            }),
        );
    }
}
