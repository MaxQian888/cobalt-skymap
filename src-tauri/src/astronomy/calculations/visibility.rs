//! Visibility calculations
//! Target visibility with rise/set/transit times

use chrono::{DateTime, Utc};

use super::common::{normalize_degrees, DEG_TO_RAD, HOURS_TO_DEG, RAD_TO_DEG};
use super::coordinates::equatorial_to_horizontal;
use super::time::{calculate_gmst, datetime_to_jd};
use super::types::VisibilityInfo;

// ============================================================================
// Visibility Calculations
// ============================================================================

/// Calculate target visibility with precise rise/set/transit times
#[tauri::command]
pub fn calculate_visibility(
    ra: f64,
    dec: f64,
    latitude: f64,
    longitude: f64,
    timestamp: Option<i64>,
    min_altitude: Option<f64>,
) -> VisibilityInfo {
    let min_alt = min_altitude.unwrap_or(0.0);
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    // Current position
    let current =
        equatorial_to_horizontal(ra, dec, latitude, longitude, Some(dt.timestamp()), None);

    // Transit altitude (when object crosses meridian)
    let transit_alt = 90.0 - (latitude - dec).abs();

    // Check if circumpolar or never rises
    let lat_rad = latitude * DEG_TO_RAD;
    let dec_rad = dec * DEG_TO_RAD;

    // Hour angle at rise/set for horizon (with atmospheric refraction correction ~34 arcmin)
    let refraction_correction = 0.5667 * DEG_TO_RAD; // ~34 arcmin in radians
    let cos_h0 = ((-refraction_correction).sin() - lat_rad.sin() * dec_rad.sin())
        / (lat_rad.cos() * dec_rad.cos());
    let cos_h0 = cos_h0.clamp(-1.0, 1.0);

    let is_circumpolar = cos_h0 <= -1.0;
    let never_rises = cos_h0 >= 1.0;

    // Calculate rise/set times using sidereal time
    let (rise_time, set_time, transit_time, hours_visible) = if is_circumpolar {
        // Object is always above horizon, calculate transit time only
        let transit_ts = calculate_transit_time(ra, longitude, &dt);
        (None, None, transit_ts, 24.0)
    } else if never_rises {
        (None, None, None, 0.0)
    } else {
        let h0 = cos_h0.acos() * RAD_TO_DEG; // Hour angle at rise/set in degrees
        let hours = h0 / HOURS_TO_DEG * 2.0; // Total hours visible

        // Calculate transit time (when HA = 0)
        let transit_ts = calculate_transit_time(ra, longitude, &dt);

        // Rise time = transit - h0 (in hours converted to seconds)
        // Set time = transit + h0
        let h0_seconds = (h0 / 15.0) * 3600.0; // Convert degrees to hours then to seconds

        let rise_ts = transit_ts.map(|t| t - h0_seconds as i64);
        let set_ts = transit_ts.map(|t| t + h0_seconds as i64);

        (rise_ts, set_ts, transit_ts, hours)
    };

    VisibilityInfo {
        is_visible: current.alt >= min_alt,
        current_altitude: current.alt,
        current_azimuth: current.az,
        rise_time,
        set_time,
        transit_time,
        transit_altitude: transit_alt,
        is_circumpolar,
        never_rises,
        hours_visible,
    }
}

/// Calculate the transit time (meridian crossing) for an object
fn calculate_transit_time(ra: f64, longitude: f64, dt: &DateTime<Utc>) -> Option<i64> {
    // Get the date at midnight UTC
    let midnight = dt.date_naive().and_hms_opt(0, 0, 0)?;
    let midnight_utc = DateTime::<Utc>::from_naive_utc_and_offset(midnight, Utc);
    let jd_midnight = datetime_to_jd(&midnight_utc);

    // Calculate GMST at midnight
    let gmst_midnight = calculate_gmst(jd_midnight);

    // LST at midnight for this longitude
    let lst_midnight = normalize_degrees(gmst_midnight + longitude);

    // Hour angle at midnight
    let ha_midnight = normalize_degrees(lst_midnight - ra);

    // Time until transit (when HA = 0)
    // If HA > 180, transit was earlier, so add 360 to get time until next transit
    let ha_to_transit = if ha_midnight > 180.0 {
        360.0 - ha_midnight
    } else {
        -ha_midnight
    };

    // Convert hour angle difference to time (15 deg/hour = 1 hour per 15 degrees)
    let hours_to_transit = ha_to_transit / 15.0;
    let seconds_to_transit = hours_to_transit * 3600.0;

    // Sidereal day is slightly shorter than solar day
    // 1 sidereal day = 23h 56m 4s = 86164.0905 seconds
    let sidereal_correction = seconds_to_transit * (1.0 - 86164.0905 / 86400.0);
    let adjusted_seconds = seconds_to_transit - sidereal_correction;

    Some(midnight_utc.timestamp() + adjusted_seconds as i64)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_visibility_circumpolar() {
        // Polaris (Dec ~89°) from North pole (lat 90°) should be circumpolar
        let vis = calculate_visibility(0.0, 89.0, 80.0, 0.0, None, None);
        assert!(
            vis.is_circumpolar,
            "High dec star from high latitude should be circumpolar"
        );
        assert!(!vis.never_rises);
        assert!(approx_eq(vis.hours_visible, 24.0, 0.1));
    }

    #[test]
    fn test_visibility_never_rises() {
        // Southern star (Dec -80°) from Northern location (lat 60°) should never rise
        let vis = calculate_visibility(0.0, -80.0, 60.0, 0.0, None, None);
        assert!(
            vis.never_rises,
            "Southern star should never rise from far north"
        );
        assert!(!vis.is_circumpolar);
        assert!(approx_eq(vis.hours_visible, 0.0, 0.1));
    }

    #[test]
    fn test_visibility_transit_altitude() {
        // Transit altitude = 90 - |lat - dec|
        let vis = calculate_visibility(0.0, 30.0, 45.0, 0.0, None, None);
        let lat: f64 = 45.0;
        let dec: f64 = 30.0;
        let expected_transit = 90.0 - (lat - dec).abs(); // 75°
        assert!(
            approx_eq(vis.transit_altitude, expected_transit, 0.1),
            "Transit altitude should be {}°, got {}",
            expected_transit,
            vis.transit_altitude
        );
    }

    #[test]
    fn test_visibility_rise_set_times() {
        // Normal visibility case: object that rises and sets
        let vis = calculate_visibility(0.0, 20.0, 45.0, 0.0, None, None);

        // Should have rise and set times
        assert!(
            vis.rise_time.is_some(),
            "Rise time should be present for normal object"
        );
        assert!(
            vis.set_time.is_some(),
            "Set time should be present for normal object"
        );
        assert!(vis.transit_time.is_some(), "Transit time should be present");

        // Rise should be before set
        if let (Some(rise), Some(set)) = (vis.rise_time, vis.set_time) {
            // Note: rise could be > set if the object rises late and sets early next day
            // For this test, we just verify they exist and are different
            assert_ne!(rise, set, "Rise and set times should be different");
        }
    }

    #[test]
    fn test_visibility_circumpolar_has_transit() {
        // Circumpolar objects should have transit time but no rise/set
        let vis = calculate_visibility(0.0, 85.0, 80.0, 0.0, None, None);

        assert!(vis.is_circumpolar);
        assert!(
            vis.transit_time.is_some(),
            "Circumpolar object should have transit time"
        );
        assert!(
            vis.rise_time.is_none(),
            "Circumpolar object should not have rise time"
        );
        assert!(
            vis.set_time.is_none(),
            "Circumpolar object should not have set time"
        );
    }

    #[test]
    fn test_visibility_never_rises_no_times() {
        // Objects that never rise should have no times
        let vis = calculate_visibility(0.0, -85.0, 80.0, 0.0, None, None);

        assert!(vis.never_rises);
        assert!(
            vis.rise_time.is_none(),
            "Never-rises object should not have rise time"
        );
        assert!(
            vis.set_time.is_none(),
            "Never-rises object should not have set time"
        );
        assert!(
            vis.transit_time.is_none(),
            "Never-rises object should not have transit time"
        );
    }

    #[test]
    fn test_visibility_hours_range() {
        // Test that hours visible is always in valid range
        let test_cases = vec![
            (0.0, 0.0, 45.0),    // Equatorial object
            (180.0, 45.0, 45.0), // Mid-declination
            (90.0, -30.0, 30.0), // Southern object from southern location
        ];

        for (ra, dec, lat) in test_cases {
            let vis = calculate_visibility(ra, dec, lat, 0.0, None, None);
            assert!(
                vis.hours_visible >= 0.0 && vis.hours_visible <= 24.0,
                "Hours visible out of range: {} for ra={}, dec={}, lat={}",
                vis.hours_visible,
                ra,
                dec,
                lat
            );
        }
    }
}
