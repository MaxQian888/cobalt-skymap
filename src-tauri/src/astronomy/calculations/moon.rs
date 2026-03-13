//! Moon calculations
//! Moon phase and position calculations

use chrono::{DateTime, Utc};
use std::f64::consts::PI;

use super::common::{normalize_degrees, DEG_TO_RAD};
use super::coordinates::{ecliptic_to_equatorial, equatorial_to_horizontal};
use super::time::datetime_to_jd;
use super::types::{MoonPhase, MoonPosition};

// ============================================================================
// Moon Calculations
// ============================================================================

/// Calculate moon phase
#[tauri::command]
pub fn calculate_moon_phase(timestamp: Option<i64>) -> MoonPhase {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);

    // Synodic month in days
    const SYNODIC_MONTH: f64 = 29.530588853;

    // Known new moon (Jan 6, 2000 18:14 UTC)
    const KNOWN_NEW_MOON: f64 = 2451550.1;

    let days_since = jd - KNOWN_NEW_MOON;
    let lunations = days_since / SYNODIC_MONTH;
    let phase = lunations.fract();
    let phase = if phase < 0.0 { phase + 1.0 } else { phase };

    let age = phase * SYNODIC_MONTH;

    // Illumination (simplified)
    let illumination = (1.0 - (2.0 * PI * phase).cos()) / 2.0 * 100.0;

    let is_waxing = phase < 0.5;

    let phase_name = match phase {
        p if p < 0.0625 => "New Moon",
        p if p < 0.1875 => "Waxing Crescent",
        p if p < 0.3125 => "First Quarter",
        p if p < 0.4375 => "Waxing Gibbous",
        p if p < 0.5625 => "Full Moon",
        p if p < 0.6875 => "Waning Gibbous",
        p if p < 0.8125 => "Last Quarter",
        p if p < 0.9375 => "Waning Crescent",
        _ => "New Moon",
    }
    .to_string();

    MoonPhase {
        phase,
        illumination,
        age,
        phase_name,
        is_waxing,
    }
}

/// Calculate moon position with improved accuracy
/// Uses simplified lunar theory with major perturbation terms
#[tauri::command]
pub fn calculate_moon_position(
    latitude: f64,
    longitude: f64,
    timestamp: Option<i64>,
) -> MoonPosition {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);
    let t = (jd - 2451545.0) / 36525.0;
    let t2 = t * t;
    let t3 = t2 * t;

    // Fundamental arguments (in degrees)
    // Mean longitude of the Moon
    let l_prime =
        normalize_degrees(218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841.0);
    // Mean anomaly of the Moon
    let m_prime =
        normalize_degrees(134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699.0);
    // Mean anomaly of the Sun
    let m = normalize_degrees(357.5291092 + 35999.0502909 * t - 0.0001536 * t2);
    // Mean elongation of the Moon
    let d = normalize_degrees(297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868.0);
    // Mean distance of Moon from ascending node
    let f = normalize_degrees(93.2720950 + 483202.0175233 * t - 0.0036539 * t2);

    // Convert to radians for calculations
    let _l_prime_rad = l_prime * DEG_TO_RAD; // Reserved for future use
    let m_prime_rad = m_prime * DEG_TO_RAD;
    let m_rad = m * DEG_TO_RAD;
    let d_rad = d * DEG_TO_RAD;
    let f_rad = f * DEG_TO_RAD;

    // Longitude perturbations (main terms)
    let mut sigma_l = 0.0;
    sigma_l += 6288774.0 * m_prime_rad.sin();
    sigma_l += 1274027.0 * (2.0 * d_rad - m_prime_rad).sin();
    sigma_l += 658314.0 * (2.0 * d_rad).sin();
    sigma_l += 213618.0 * (2.0 * m_prime_rad).sin();
    sigma_l -= 185116.0 * m_rad.sin();
    sigma_l -= 114332.0 * (2.0 * f_rad).sin();
    sigma_l += 58793.0 * (2.0 * d_rad - 2.0 * m_prime_rad).sin();
    sigma_l += 57066.0 * (2.0 * d_rad - m_rad - m_prime_rad).sin();
    sigma_l += 53322.0 * (2.0 * d_rad + m_prime_rad).sin();
    sigma_l += 45758.0 * (2.0 * d_rad - m_rad).sin();
    sigma_l -= 40923.0 * (m_rad - m_prime_rad).sin();
    sigma_l -= 34720.0 * d_rad.sin();
    sigma_l -= 30383.0 * (m_rad + m_prime_rad).sin();
    sigma_l += 15327.0 * (2.0 * d_rad - 2.0 * f_rad).sin();

    // Latitude perturbations (main terms)
    let mut sigma_b = 0.0;
    sigma_b += 5128122.0 * f_rad.sin();
    sigma_b += 280602.0 * (m_prime_rad + f_rad).sin();
    sigma_b += 277693.0 * (m_prime_rad - f_rad).sin();
    sigma_b += 173237.0 * (2.0 * d_rad - f_rad).sin();
    sigma_b += 55413.0 * (2.0 * d_rad - m_prime_rad + f_rad).sin();
    sigma_b += 46271.0 * (2.0 * d_rad - m_prime_rad - f_rad).sin();
    sigma_b += 32573.0 * (2.0 * d_rad + f_rad).sin();
    sigma_b += 17198.0 * (2.0 * m_prime_rad + f_rad).sin();

    // Distance perturbations (main terms)
    let mut sigma_r = 0.0;
    sigma_r -= 20905355.0 * m_prime_rad.cos();
    sigma_r -= 3699111.0 * (2.0 * d_rad - m_prime_rad).cos();
    sigma_r -= 2955968.0 * (2.0 * d_rad).cos();
    sigma_r -= 569925.0 * (2.0 * m_prime_rad).cos();
    sigma_r += 48888.0 * m_rad.cos();
    sigma_r -= 3149.0 * (2.0 * f_rad).cos();
    sigma_r += 246158.0 * (2.0 * d_rad - 2.0 * m_prime_rad).cos();
    sigma_r -= 152138.0 * (2.0 * d_rad - m_rad - m_prime_rad).cos();

    // Calculate final values
    let lon = l_prime + sigma_l / 1000000.0;
    let lat = sigma_b / 1000000.0;
    let distance = 385000.56 + sigma_r / 1000.0; // km

    // Convert to equatorial
    let eq = ecliptic_to_equatorial(lon, lat, Some(dt.timestamp()));

    // Convert to horizontal
    let hor = equatorial_to_horizontal(
        eq.ra,
        eq.dec,
        latitude,
        longitude,
        Some(dt.timestamp()),
        None,
    );

    MoonPosition {
        ra: eq.ra,
        dec: eq.dec,
        altitude: hor.alt,
        azimuth: hor.az,
        distance,
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
    fn test_moon_phase_known_new_moon() {
        // Jan 6, 2000 was a known new moon
        let dt = Utc.with_ymd_and_hms(2000, 1, 6, 18, 0, 0).unwrap();
        let phase = calculate_moon_phase(Some(dt.timestamp()));
        assert!(
            phase.phase < 0.1 || phase.phase > 0.9,
            "Should be near new moon, got phase {}",
            phase.phase
        );
        assert!(
            phase.illumination < 10.0,
            "New moon illumination should be low, got {}",
            phase.illumination
        );
    }

    #[test]
    fn test_moon_phase_range() {
        let phase = calculate_moon_phase(None);
        assert!(
            phase.phase >= 0.0 && phase.phase <= 1.0,
            "Phase should be 0-1"
        );
        assert!(
            phase.illumination >= 0.0 && phase.illumination <= 100.0,
            "Illumination should be 0-100%"
        );
        assert!(
            phase.age >= 0.0 && phase.age <= 30.0,
            "Age should be 0-30 days"
        );
    }

    #[test]
    fn test_moon_phase_names() {
        let valid_names = [
            "New Moon",
            "Waxing Crescent",
            "First Quarter",
            "Waxing Gibbous",
            "Full Moon",
            "Waning Gibbous",
            "Last Quarter",
            "Waning Crescent",
        ];
        let phase = calculate_moon_phase(None);
        assert!(
            valid_names.contains(&phase.phase_name.as_str()),
            "Invalid phase name: {}",
            phase.phase_name
        );
    }

    #[test]
    fn test_moon_position_range() {
        let moon = calculate_moon_position(45.0, 0.0, None);
        assert!(
            moon.ra >= 0.0 && moon.ra < 360.0,
            "Moon RA out of range: {}",
            moon.ra
        );
        assert!(
            moon.dec >= -90.0 && moon.dec <= 90.0,
            "Moon Dec out of range: {}",
            moon.dec
        );
        assert!(
            moon.distance > 350000.0 && moon.distance < 410000.0,
            "Moon distance out of range: {} km",
            moon.distance
        );
    }

    #[test]
    fn test_moon_position_distance_variation() {
        // Moon distance varies between ~356,500 km (perigee) and ~406,700 km (apogee)
        // Test multiple timestamps to verify distance stays in range
        let test_timestamps = vec![
            Utc.with_ymd_and_hms(2024, 1, 15, 12, 0, 0)
                .unwrap()
                .timestamp(),
            Utc.with_ymd_and_hms(2024, 4, 15, 12, 0, 0)
                .unwrap()
                .timestamp(),
            Utc.with_ymd_and_hms(2024, 7, 15, 12, 0, 0)
                .unwrap()
                .timestamp(),
            Utc.with_ymd_and_hms(2024, 10, 15, 12, 0, 0)
                .unwrap()
                .timestamp(),
        ];

        for ts in test_timestamps {
            let moon = calculate_moon_position(0.0, 0.0, Some(ts));
            assert!(
                moon.distance >= 350000.0,
                "Moon too close: {} km at ts {}",
                moon.distance,
                ts
            );
            assert!(
                moon.distance <= 410000.0,
                "Moon too far: {} km at ts {}",
                moon.distance,
                ts
            );
        }
    }

    #[test]
    fn test_moon_declination_range() {
        // Moon declination varies roughly between -28.5° and +28.5° over 18.6-year cycle
        // In any given month, it should stay within ±30°
        let moon = calculate_moon_position(45.0, 0.0, None);
        assert!(
            moon.dec >= -30.0 && moon.dec <= 30.0,
            "Moon Dec should be within ±30°, got {}",
            moon.dec
        );
    }

    #[test]
    fn test_moon_position_consistency() {
        // Test that moon position changes smoothly over time
        let base_ts = Utc
            .with_ymd_and_hms(2024, 6, 15, 12, 0, 0)
            .unwrap()
            .timestamp();
        let moon1 = calculate_moon_position(0.0, 0.0, Some(base_ts));
        let moon2 = calculate_moon_position(0.0, 0.0, Some(base_ts + 3600)); // 1 hour later

        // Moon moves about 0.5° per hour in RA
        let ra_diff = (moon2.ra - moon1.ra).abs();
        let ra_diff_normalized = if ra_diff > 180.0 {
            360.0 - ra_diff
        } else {
            ra_diff
        };
        assert!(
            ra_diff_normalized < 2.0,
            "Moon RA should change smoothly over 1 hour, got {} degree change",
            ra_diff_normalized
        );
    }
}
