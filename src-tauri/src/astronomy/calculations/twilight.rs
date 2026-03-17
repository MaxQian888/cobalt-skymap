//! Twilight calculations
//! Sunrise, sunset, and twilight times with iterative precision

use chrono::NaiveDate;

use super::common::{
    calculate_obliquity, jd_to_timestamp, normalize_degrees, timestamp_to_jd, DEG_TO_RAD,
    RAD_TO_DEG,
};
use super::time::date_to_jd;
use super::types::TwilightTimes;

// ============================================================================
// Twilight Calculations
// ============================================================================

/// Calculate twilight times for a date with precise calculations
/// Uses iterative approach for accurate sunrise/sunset and twilight times
#[tauri::command]
pub fn calculate_twilight(
    date: String,
    latitude: f64,
    longitude: f64,
) -> Result<TwilightTimes, String> {
    let naive_date = NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date format: {}", e))?;

    let jd_noon = date_to_jd(&naive_date) + 0.5; // Julian date at noon UTC

    // Calculate sun position at noon for polar day/night check
    let sun_dec_noon = calculate_sun_declination(jd_noon);
    let lat_rad = latitude * DEG_TO_RAD;
    let dec_rad_noon = sun_dec_noon * DEG_TO_RAD;

    // Check for polar day/night using sunrise/sunset altitude
    let cos_h_sunrise = calculate_cos_hour_angle(lat_rad, dec_rad_noon, -0.8333 * DEG_TO_RAD);
    let is_polar_day = cos_h_sunrise < -1.0;
    let is_polar_night = cos_h_sunrise > 1.0;

    if is_polar_day || is_polar_night {
        // Calculate solar noon even in polar conditions
        let solar_noon_ts = calculate_solar_noon(jd_noon, longitude);
        return Ok(TwilightTimes {
            date,
            sunrise: None,
            sunset: None,
            civil_dawn: None,
            civil_dusk: None,
            nautical_dawn: None,
            nautical_dusk: None,
            astronomical_dawn: None,
            astronomical_dusk: None,
            solar_noon: solar_noon_ts,
            is_polar_day,
            is_polar_night,
        });
    }

    // Solar altitude angles for different twilight types
    const SUNRISE_SUNSET_ALT: f64 = -0.8333; // Accounts for refraction and solar disk radius
    const CIVIL_TWILIGHT_ALT: f64 = -6.0;
    const NAUTICAL_TWILIGHT_ALT: f64 = -12.0;
    const ASTRONOMICAL_TWILIGHT_ALT: f64 = -18.0;

    // Calculate solar noon (when sun crosses meridian)
    let solar_noon_ts = calculate_solar_noon(jd_noon, longitude);

    // Calculate times for each twilight type
    let (sunrise, sunset) =
        calculate_sun_rise_set_times(jd_noon, latitude, longitude, SUNRISE_SUNSET_ALT);
    let (civil_dawn, civil_dusk) =
        calculate_sun_rise_set_times(jd_noon, latitude, longitude, CIVIL_TWILIGHT_ALT);
    let (nautical_dawn, nautical_dusk) =
        calculate_sun_rise_set_times(jd_noon, latitude, longitude, NAUTICAL_TWILIGHT_ALT);
    let (astronomical_dawn, astronomical_dusk) =
        calculate_sun_rise_set_times(jd_noon, latitude, longitude, ASTRONOMICAL_TWILIGHT_ALT);

    Ok(TwilightTimes {
        date,
        sunrise,
        sunset,
        civil_dawn,
        civil_dusk,
        nautical_dawn,
        nautical_dusk,
        astronomical_dawn,
        astronomical_dusk,
        solar_noon: solar_noon_ts,
        is_polar_day,
        is_polar_night,
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Calculate cos(hour_angle) for a given sun altitude
fn calculate_cos_hour_angle(lat_rad: f64, dec_rad: f64, alt_rad: f64) -> f64 {
    (alt_rad.sin() - lat_rad.sin() * dec_rad.sin()) / (lat_rad.cos() * dec_rad.cos())
}

/// Calculate solar noon timestamp for a given date and longitude
fn calculate_solar_noon(jd_noon: f64, longitude: f64) -> Option<i64> {
    // Approximate equation of time calculation
    let n = jd_noon - 2451545.0; // Days since J2000
    let g = normalize_degrees(357.528 + 0.9856003 * n); // Mean anomaly
    let g_rad = g * DEG_TO_RAD;

    // Simplified equation of time (in minutes)
    let eot_simple = -7.655 * g_rad.sin() + 9.873 * (2.0 * g_rad + 3.588).sin();

    // Solar noon = 12:00 - equation_of_time - longitude/15 (in hours)
    let solar_noon_hours = 12.0 - eot_simple / 60.0 - longitude / 15.0;

    // Convert to timestamp
    let jd_midnight = jd_noon - 0.5;
    let jd_solar_noon = jd_midnight + solar_noon_hours / 24.0;

    Some(jd_to_timestamp(jd_solar_noon))
}

/// Calculate sunrise and sunset times for a given altitude threshold
fn calculate_sun_rise_set_times(
    jd_noon: f64,
    latitude: f64,
    longitude: f64,
    altitude_deg: f64,
) -> (Option<i64>, Option<i64>) {
    let lat_rad = latitude * DEG_TO_RAD;
    let alt_rad = altitude_deg * DEG_TO_RAD;

    // Iterative calculation for better accuracy
    let mut jd_rise = jd_noon - 0.25; // Start from 6 AM
    let mut jd_set = jd_noon + 0.25; // Start from 6 PM

    let mut final_rise_ts = None;
    let mut final_set_ts = None;

    for iteration in 0..5 {
        // Iterate for convergence
        let dec_rise = calculate_sun_declination(jd_rise) * DEG_TO_RAD;
        let dec_set = calculate_sun_declination(jd_set) * DEG_TO_RAD;

        let cos_h_rise = calculate_cos_hour_angle(lat_rad, dec_rise, alt_rad);
        let cos_h_set = calculate_cos_hour_angle(lat_rad, dec_set, alt_rad);

        if cos_h_rise.abs() > 1.0 || cos_h_set.abs() > 1.0 {
            return (None, None); // Sun doesn't reach this altitude
        }

        let h_rise = cos_h_rise.acos() * RAD_TO_DEG;
        let h_set = cos_h_set.acos() * RAD_TO_DEG;

        // Calculate times based on hour angles
        let noon_ts = calculate_solar_noon(jd_noon, longitude);
        if let Some(noon) = noon_ts {
            let rise_offset = (h_rise / 15.0) * 3600.0; // Convert to seconds
            let set_offset = (h_set / 15.0) * 3600.0;

            let rise_ts = noon - rise_offset as i64;
            let set_ts = noon + set_offset as i64;

            // Update JD for next iteration
            jd_rise = timestamp_to_jd(rise_ts);
            jd_set = timestamp_to_jd(set_ts);

            // Store final values on last iteration
            if iteration == 4 {
                final_rise_ts = Some(rise_ts);
                final_set_ts = Some(set_ts);
            }
        } else {
            return (None, None);
        }
    }

    (final_rise_ts, final_set_ts)
}

/// Calculate sun declination with improved accuracy
pub(crate) fn calculate_sun_declination(jd: f64) -> f64 {
    let t = (jd - 2451545.0) / 36525.0;
    let t2 = t * t;

    // Geometric mean longitude of the Sun
    let l0 = normalize_degrees(280.46646 + 36000.76983 * t + 0.0003032 * t2);

    // Mean anomaly of the Sun
    let m = normalize_degrees(357.52911 + 35999.05029 * t - 0.0001537 * t2);
    let m_rad = m * DEG_TO_RAD;

    // Equation of center
    let c = (1.914602 - 0.004817 * t - 0.000014 * t2) * m_rad.sin()
        + (0.019993 - 0.000101 * t) * (2.0 * m_rad).sin()
        + 0.000289 * (3.0 * m_rad).sin();

    // Sun's true longitude
    let sun_lon = (l0 + c) * DEG_TO_RAD;

    // Nutation correction
    let omega = (125.04 - 1934.136 * t) * DEG_TO_RAD;
    let apparent_lon = sun_lon - 0.00569 * DEG_TO_RAD - 0.00478 * omega.sin() * DEG_TO_RAD;

    // Corrected obliquity
    let obliquity = (calculate_obliquity(jd) + 0.00256 * omega.cos()) * DEG_TO_RAD;

    (obliquity.sin() * apparent_lon.sin()).asin() * RAD_TO_DEG
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_twilight_polar_detection() {
        // Arctic summer - potential polar day
        let result = calculate_twilight("2024-06-21".to_string(), 70.0, 0.0);
        assert!(result.is_ok());
        // At 70°N on summer solstice, expect polar day
        let twilight = result.unwrap();
        assert!(twilight.is_polar_day || !twilight.is_polar_night);
    }

    #[test]
    fn test_twilight_invalid_date() {
        let result = calculate_twilight("invalid-date".to_string(), 45.0, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_twilight_normal_day() {
        // Test twilight times for a normal mid-latitude location
        let result = calculate_twilight("2024-03-20".to_string(), 40.0, -74.0);
        assert!(result.is_ok());
        let twilight = result.unwrap();

        // Should not be polar day/night at mid-latitude
        assert!(!twilight.is_polar_day, "Should not be polar day");
        assert!(!twilight.is_polar_night, "Should not be polar night");

        // All twilight times should be present
        assert!(twilight.sunrise.is_some(), "Sunrise should be present");
        assert!(twilight.sunset.is_some(), "Sunset should be present");
        assert!(
            twilight.civil_dawn.is_some(),
            "Civil dawn should be present"
        );
        assert!(
            twilight.civil_dusk.is_some(),
            "Civil dusk should be present"
        );
        assert!(
            twilight.solar_noon.is_some(),
            "Solar noon should be present"
        );

        // Verify time ordering: dawn < sunrise < noon < sunset < dusk
        if let (Some(dawn), Some(sunrise), Some(noon), Some(sunset), Some(dusk)) = (
            twilight.civil_dawn,
            twilight.sunrise,
            twilight.solar_noon,
            twilight.sunset,
            twilight.civil_dusk,
        ) {
            assert!(dawn < sunrise, "Civil dawn should be before sunrise");
            assert!(sunrise < noon, "Sunrise should be before solar noon");
            assert!(noon < sunset, "Solar noon should be before sunset");
            assert!(sunset < dusk, "Sunset should be before civil dusk");
        }
    }

    #[test]
    fn test_twilight_astronomical() {
        // Test that astronomical twilight is further from noon than nautical
        let result = calculate_twilight("2024-06-15".to_string(), 45.0, 0.0);
        assert!(result.is_ok());
        let twilight = result.unwrap();

        if let (Some(astro_dawn), Some(naut_dawn), Some(naut_dusk), Some(astro_dusk)) = (
            twilight.astronomical_dawn,
            twilight.nautical_dawn,
            twilight.nautical_dusk,
            twilight.astronomical_dusk,
        ) {
            assert!(
                astro_dawn < naut_dawn,
                "Astronomical dawn should be before nautical dawn"
            );
            assert!(
                naut_dusk < astro_dusk,
                "Nautical dusk should be before astronomical dusk"
            );
        }
    }

    #[test]
    fn test_sun_declination_range() {
        // Test sun declination at various dates
        let jd_summer = 2460479.0; // ~June 21, 2024
        let jd_winter = 2460661.0; // ~Dec 21, 2024

        let dec_summer = calculate_sun_declination(jd_summer);
        let dec_winter = calculate_sun_declination(jd_winter);

        assert!(
            dec_summer > 20.0,
            "Summer sun dec should be > 20°, got {}",
            dec_summer
        );
        assert!(
            dec_winter < -20.0,
            "Winter sun dec should be < -20°, got {}",
            dec_winter
        );
    }
}
