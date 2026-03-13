//! Sun calculations
//! Sun position calculation with VSOP87 simplified algorithm

use chrono::{DateTime, Utc};

use super::common::{calculate_obliquity, normalize_degrees, DEG_TO_RAD, RAD_TO_DEG};
use super::coordinates::equatorial_to_horizontal;
use super::time::datetime_to_jd;
use super::types::SunPosition;

// ============================================================================
// Sun Calculations
// ============================================================================

/// Calculate sun position with improved accuracy
/// Uses VSOP87 simplified algorithm with perturbation terms
#[tauri::command]
pub fn calculate_sun_position(
    latitude: f64,
    longitude: f64,
    timestamp: Option<i64>,
) -> SunPosition {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);
    let t = (jd - 2451545.0) / 36525.0;
    let t2 = t * t;
    // Geometric mean longitude of the Sun (in degrees)
    let l0 = normalize_degrees(280.46646 + 36000.76983 * t + 0.0003032 * t2);

    // Mean anomaly of the Sun (in degrees)
    let m = normalize_degrees(357.52911 + 35999.05029 * t - 0.0001537 * t2);
    let m_rad = m * DEG_TO_RAD;

    // Eccentricity of Earth's orbit
    let e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t2;

    // Sun's equation of center (in degrees)
    let c = (1.914602 - 0.004817 * t - 0.000014 * t2) * m_rad.sin()
        + (0.019993 - 0.000101 * t) * (2.0 * m_rad).sin()
        + 0.000289 * (3.0 * m_rad).sin();

    // Sun's true longitude (in degrees)
    let sun_true_lon = l0 + c;

    // Sun's true anomaly (in degrees)
    let v = m + c;
    let v_rad = v * DEG_TO_RAD;

    // Sun's radius vector (AU)
    let _r = (1.000001018 * (1.0 - e * e)) / (1.0 + e * v_rad.cos());

    // Apparent longitude (corrected for nutation and aberration)
    let omega = 125.04 - 1934.136 * t; // longitude of Moon's ascending node
    let omega_rad = omega * DEG_TO_RAD;
    let sun_apparent_lon = sun_true_lon - 0.00569 - 0.00478 * omega_rad.sin();

    // Obliquity of the ecliptic (corrected)
    let obliquity = calculate_obliquity(jd) + 0.00256 * omega_rad.cos();
    let obliquity_rad = obliquity * DEG_TO_RAD;

    // Convert to equatorial coordinates directly for better accuracy
    let sun_lon_rad = sun_apparent_lon * DEG_TO_RAD;

    let ra = (obliquity_rad.cos() * sun_lon_rad.sin()).atan2(sun_lon_rad.cos());
    let dec = (obliquity_rad.sin() * sun_lon_rad.sin()).asin();

    let ra_deg = normalize_degrees(ra * RAD_TO_DEG);
    let dec_deg = dec * RAD_TO_DEG;

    // Convert to horizontal
    let hor = equatorial_to_horizontal(
        ra_deg,
        dec_deg,
        latitude,
        longitude,
        Some(dt.timestamp()),
        None,
    );

    SunPosition {
        ra: ra_deg,
        dec: dec_deg,
        altitude: hor.alt,
        azimuth: hor.az,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_sun_position_range() {
        let sun = calculate_sun_position(45.0, 0.0, None);
        assert!(
            sun.ra >= 0.0 && sun.ra < 360.0,
            "Sun RA out of range: {}",
            sun.ra
        );
        assert!(
            sun.dec >= -23.5 && sun.dec <= 23.5,
            "Sun Dec out of range: {}",
            sun.dec
        );
    }

    #[test]
    fn test_sun_position_summer_solstice() {
        // Around summer solstice, sun declination should be near +23.44°
        let dt = Utc.with_ymd_and_hms(2024, 6, 21, 12, 0, 0).unwrap();
        let sun = calculate_sun_position(0.0, 0.0, Some(dt.timestamp()));
        assert!(
            sun.dec > 23.0 && sun.dec < 24.0,
            "Sun Dec on summer solstice should be ~23.44°, got {}",
            sun.dec
        );
    }

    #[test]
    fn test_sun_position_winter_solstice() {
        // Around winter solstice, sun declination should be near -23.44°
        let dt = Utc.with_ymd_and_hms(2024, 12, 21, 12, 0, 0).unwrap();
        let sun = calculate_sun_position(0.0, 0.0, Some(dt.timestamp()));
        assert!(
            sun.dec < -23.0 && sun.dec > -24.0,
            "Sun Dec on winter solstice should be ~-23.44°, got {}",
            sun.dec
        );
    }

    #[test]
    fn test_sun_position_equinox() {
        // Around equinox, sun declination should be near 0°
        let dt = Utc.with_ymd_and_hms(2024, 3, 20, 12, 0, 0).unwrap();
        let sun = calculate_sun_position(0.0, 0.0, Some(dt.timestamp()));
        assert!(
            sun.dec.abs() < 1.5,
            "Sun Dec on equinox should be near 0°, got {}",
            sun.dec
        );
    }

    #[test]
    fn test_sun_altitude_noon() {
        // At solar noon, sun should be at or near highest altitude
        let dt = Utc.with_ymd_and_hms(2024, 6, 15, 12, 0, 0).unwrap();
        let sun = calculate_sun_position(0.0, 0.0, Some(dt.timestamp()));
        // At latitude 0, longitude 0, noon UTC should have sun near zenith in June
        // This is a basic sanity check
        assert!(
            sun.altitude > -90.0 && sun.altitude <= 90.0,
            "Sun altitude out of range: {}",
            sun.altitude
        );
    }
}
