//! Coordinate conversion calculations
//! Equatorial, horizontal, galactic, ecliptic conversions and angular separation

use chrono::{DateTime, Utc};
use std::f64::consts::PI;

use super::common::{
    atmospheric_refraction, calculate_obliquity, normalize_degrees, DEG_TO_RAD, EQ_TO_GAL_MATRIX,
    GAL_TO_EQ_MATRIX, RAD_TO_DEG,
};
use super::time::{calculate_hour_angle, calculate_lst, datetime_to_jd};
use super::types::{EclipticCoords, EquatorialCoords, GalacticCoords, HorizontalCoords};

// ============================================================================
// Coordinate Conversions
// ============================================================================

/// Convert equatorial to horizontal coordinates
/// When `apply_refraction` is true (default), atmospheric refraction correction is applied
/// to the altitude using Bennett's formula.
#[tauri::command]
pub fn equatorial_to_horizontal(
    ra: f64,
    dec: f64,
    latitude: f64,
    longitude: f64,
    timestamp: Option<i64>,
    apply_refraction: Option<bool>,
) -> HorizontalCoords {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);
    let lst = calculate_lst(jd, longitude);
    let ha = calculate_hour_angle(lst, ra);

    let ha_rad = ha * DEG_TO_RAD;
    let dec_rad = dec * DEG_TO_RAD;
    let lat_rad = latitude * DEG_TO_RAD;

    let sin_alt = dec_rad.sin() * lat_rad.sin() + dec_rad.cos() * lat_rad.cos() * ha_rad.cos();
    let alt = sin_alt.asin();

    let cos_az = (dec_rad.sin() - alt.sin() * lat_rad.sin()) / (alt.cos() * lat_rad.cos());
    let az = if ha_rad.sin() > 0.0 {
        2.0 * PI - cos_az.clamp(-1.0, 1.0).acos()
    } else {
        cos_az.clamp(-1.0, 1.0).acos()
    };

    let alt_deg = alt * RAD_TO_DEG;
    let corrected_alt = if apply_refraction.unwrap_or(true) {
        alt_deg + atmospheric_refraction(alt_deg)
    } else {
        alt_deg
    };

    HorizontalCoords {
        alt: corrected_alt,
        az: az * RAD_TO_DEG,
    }
}

/// Convert horizontal to equatorial coordinates
#[tauri::command]
pub fn horizontal_to_equatorial(
    alt: f64,
    az: f64,
    latitude: f64,
    longitude: f64,
    timestamp: Option<i64>,
) -> EquatorialCoords {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);
    let lst = calculate_lst(jd, longitude);

    let alt_rad = alt * DEG_TO_RAD;
    let az_rad = az * DEG_TO_RAD;
    let lat_rad = latitude * DEG_TO_RAD;

    let sin_dec = alt_rad.sin() * lat_rad.sin() + alt_rad.cos() * lat_rad.cos() * az_rad.cos();
    let dec = sin_dec.asin();

    let cos_ha = (alt_rad.sin() - lat_rad.sin() * dec.sin()) / (lat_rad.cos() * dec.cos());
    let ha = if az_rad.sin() > 0.0 {
        2.0 * PI - cos_ha.clamp(-1.0, 1.0).acos()
    } else {
        cos_ha.clamp(-1.0, 1.0).acos()
    };

    let ra = normalize_degrees(lst - ha * RAD_TO_DEG);

    EquatorialCoords {
        ra,
        dec: dec * RAD_TO_DEG,
    }
}

/// Convert equatorial to galactic coordinates
#[tauri::command]
pub fn equatorial_to_galactic(ra: f64, dec: f64) -> GalacticCoords {
    let ra_rad = ra * DEG_TO_RAD;
    let dec_rad = dec * DEG_TO_RAD;
    let cos_dec = dec_rad.cos();
    let equatorial = [
        cos_dec * ra_rad.cos(),
        cos_dec * ra_rad.sin(),
        dec_rad.sin(),
    ];

    let galactic = [
        EQ_TO_GAL_MATRIX[0][0] * equatorial[0]
            + EQ_TO_GAL_MATRIX[0][1] * equatorial[1]
            + EQ_TO_GAL_MATRIX[0][2] * equatorial[2],
        EQ_TO_GAL_MATRIX[1][0] * equatorial[0]
            + EQ_TO_GAL_MATRIX[1][1] * equatorial[1]
            + EQ_TO_GAL_MATRIX[1][2] * equatorial[2],
        EQ_TO_GAL_MATRIX[2][0] * equatorial[0]
            + EQ_TO_GAL_MATRIX[2][1] * equatorial[1]
            + EQ_TO_GAL_MATRIX[2][2] * equatorial[2],
    ];

    let l = normalize_degrees(galactic[1].atan2(galactic[0]) * RAD_TO_DEG);
    let b = galactic[2].clamp(-1.0, 1.0).asin() * RAD_TO_DEG;

    GalacticCoords { l, b }
}

/// Convert galactic to equatorial coordinates
#[tauri::command]
pub fn galactic_to_equatorial(l: f64, b: f64) -> EquatorialCoords {
    let l_rad = l * DEG_TO_RAD;
    let b_rad = b * DEG_TO_RAD;
    let cos_b = b_rad.cos();
    let galactic = [cos_b * l_rad.cos(), cos_b * l_rad.sin(), b_rad.sin()];

    let equatorial = [
        GAL_TO_EQ_MATRIX[0][0] * galactic[0]
            + GAL_TO_EQ_MATRIX[0][1] * galactic[1]
            + GAL_TO_EQ_MATRIX[0][2] * galactic[2],
        GAL_TO_EQ_MATRIX[1][0] * galactic[0]
            + GAL_TO_EQ_MATRIX[1][1] * galactic[1]
            + GAL_TO_EQ_MATRIX[1][2] * galactic[2],
        GAL_TO_EQ_MATRIX[2][0] * galactic[0]
            + GAL_TO_EQ_MATRIX[2][1] * galactic[1]
            + GAL_TO_EQ_MATRIX[2][2] * galactic[2],
    ];

    let ra = normalize_degrees(equatorial[1].atan2(equatorial[0]) * RAD_TO_DEG);
    let dec = equatorial[2].clamp(-1.0, 1.0).asin() * RAD_TO_DEG;

    EquatorialCoords { ra, dec }
}

/// Convert equatorial to ecliptic coordinates
#[tauri::command]
pub fn equatorial_to_ecliptic(ra: f64, dec: f64, timestamp: Option<i64>) -> EclipticCoords {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);
    let obliquity = calculate_obliquity(jd);

    let ra_rad = ra * DEG_TO_RAD;
    let dec_rad = dec * DEG_TO_RAD;
    let eps_rad = obliquity * DEG_TO_RAD;

    let sin_lat = dec_rad.sin() * eps_rad.cos() - dec_rad.cos() * eps_rad.sin() * ra_rad.sin();
    let lat = sin_lat.asin();

    let y = ra_rad.sin() * eps_rad.cos() + dec_rad.tan() * eps_rad.sin();
    let x = ra_rad.cos();
    let lon = normalize_degrees(y.atan2(x) * RAD_TO_DEG);

    EclipticCoords {
        lon,
        lat: lat * RAD_TO_DEG,
    }
}

/// Convert ecliptic to equatorial coordinates
#[tauri::command]
pub fn ecliptic_to_equatorial(lon: f64, lat: f64, timestamp: Option<i64>) -> EquatorialCoords {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let jd = datetime_to_jd(&dt);
    let obliquity = calculate_obliquity(jd);

    let lon_rad = lon * DEG_TO_RAD;
    let lat_rad = lat * DEG_TO_RAD;
    let eps_rad = obliquity * DEG_TO_RAD;

    let sin_dec = lat_rad.sin() * eps_rad.cos() + lat_rad.cos() * eps_rad.sin() * lon_rad.sin();
    let dec = sin_dec.asin();

    let y = lon_rad.sin() * eps_rad.cos() - lat_rad.tan() * eps_rad.sin();
    let x = lon_rad.cos();
    let ra = normalize_degrees(y.atan2(x) * RAD_TO_DEG);

    EquatorialCoords {
        ra,
        dec: dec * RAD_TO_DEG,
    }
}

// ============================================================================
// Angular Separation
// ============================================================================

/// Calculate angular separation between two points
#[tauri::command]
pub fn angular_separation(ra1: f64, dec1: f64, ra2: f64, dec2: f64) -> f64 {
    let ra1_rad = ra1 * DEG_TO_RAD;
    let dec1_rad = dec1 * DEG_TO_RAD;
    let ra2_rad = ra2 * DEG_TO_RAD;
    let dec2_rad = dec2 * DEG_TO_RAD;

    let cos_sep = dec1_rad.sin() * dec2_rad.sin()
        + dec1_rad.cos() * dec2_rad.cos() * (ra1_rad - ra2_rad).cos();

    cos_sep.clamp(-1.0, 1.0).acos() * RAD_TO_DEG
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-6;
    const ARCSEC_IN_DEGREES: f64 = 1.0 / 3600.0;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    fn angular_difference_degrees(a: f64, b: f64) -> f64 {
        let diff = (a - b).abs() % 360.0;
        if diff > 180.0 {
            360.0 - diff
        } else {
            diff
        }
    }

    #[test]
    fn test_equatorial_to_galactic_center() {
        // Galactic center: RA ≈ 266.4°, Dec ≈ -29.0° → l ≈ 0°, b ≈ 0°
        let gc = equatorial_to_galactic(266.4, -29.0);
        assert!(
            gc.l.abs() < 5.0 || gc.l > 355.0,
            "Galactic center l should be near 0°, got {}",
            gc.l
        );
        assert!(
            gc.b.abs() < 5.0,
            "Galactic center b should be near 0°, got {}",
            gc.b
        );
    }

    #[test]
    fn test_equatorial_to_galactic_m31_arcsec() {
        let gal = equatorial_to_galactic(10.68470833, 41.26875);
        assert!(
            angular_difference_degrees(gal.l, 121.1743221) < ARCSEC_IN_DEGREES,
            "M31 galactic l error exceeds 1 arcsec: got {}",
            gal.l
        );
        assert!(
            (gal.b - -21.5733112).abs() < ARCSEC_IN_DEGREES,
            "M31 galactic b error exceeds 1 arcsec: got {}",
            gal.b
        );
    }

    #[test]
    fn test_galactic_to_equatorial() {
        // Test galactic_to_equatorial with known galactic coordinates
        // Galactic north pole (l=0, b=90) should be roughly at RA≈192.86°, Dec≈27.13°
        let eq = galactic_to_equatorial(0.0, 90.0);

        // Verify output is in valid range
        assert!(eq.ra >= 0.0 && eq.ra < 360.0, "RA out of range: {}", eq.ra);
        assert!(
            eq.dec >= -90.0 && eq.dec <= 90.0,
            "Dec out of range: {}",
            eq.dec
        );
        // Galactic north pole Dec should be positive (northern hemisphere)
        assert!(
            eq.dec > 0.0,
            "Galactic north pole should have positive Dec, got {}",
            eq.dec
        );
    }

    #[test]
    fn test_galactic_to_equatorial_m31_arcsec() {
        let eq = galactic_to_equatorial(121.1743221, -21.5733112);
        assert!(
            angular_difference_degrees(eq.ra, 10.68470833) < ARCSEC_IN_DEGREES,
            "M31 RA error exceeds 1 arcsec: got {}",
            eq.ra
        );
        assert!(
            (eq.dec - 41.26875).abs() < ARCSEC_IN_DEGREES,
            "M31 Dec error exceeds 1 arcsec: got {}",
            eq.dec
        );
    }

    #[test]
    fn test_equatorial_to_ecliptic_roundtrip() {
        let original_ra = 120.0;
        let original_dec = 30.0;
        let timestamp = Some(0i64); // Use fixed timestamp

        let ecliptic = equatorial_to_ecliptic(original_ra, original_dec, timestamp);
        let back = ecliptic_to_equatorial(ecliptic.lon, ecliptic.lat, timestamp);

        assert!(
            approx_eq(back.ra, original_ra, 0.1),
            "RA roundtrip failed: {} vs {}",
            back.ra,
            original_ra
        );
        assert!(
            approx_eq(back.dec, original_dec, 0.1),
            "Dec roundtrip failed: {} vs {}",
            back.dec,
            original_dec
        );
    }

    // ------------------------------------------------------------------------
    // Equatorial-to-Horizontal Refraction Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_equatorial_to_horizontal_refraction_default() {
        // Default (None) should apply refraction — altitude slightly raised
        let ts = Some(0i64);
        let with_refraction = equatorial_to_horizontal(0.0, 0.0, 45.0, 0.0, ts, None);
        let without_refraction = equatorial_to_horizontal(0.0, 0.0, 45.0, 0.0, ts, Some(false));
        // Refraction always raises the apparent altitude
        assert!(
            with_refraction.alt >= without_refraction.alt,
            "Default (refraction on) alt {} should be >= no-refraction alt {}",
            with_refraction.alt,
            without_refraction.alt
        );
    }

    #[test]
    fn test_equatorial_to_horizontal_refraction_explicit_true() {
        let ts = Some(0i64);
        let explicit_true = equatorial_to_horizontal(0.0, 0.0, 45.0, 0.0, ts, Some(true));
        let default_none = equatorial_to_horizontal(0.0, 0.0, 45.0, 0.0, ts, None);
        assert!(
            approx_eq(explicit_true.alt, default_none.alt, 1e-10),
            "Explicit true should match default: {} vs {}",
            explicit_true.alt,
            default_none.alt
        );
    }

    #[test]
    fn test_equatorial_to_horizontal_refraction_false() {
        let ts = Some(0i64);
        let no_refraction = equatorial_to_horizontal(0.0, 0.0, 45.0, 0.0, ts, Some(false));
        let with_refraction = equatorial_to_horizontal(0.0, 0.0, 45.0, 0.0, ts, Some(true));
        // Without refraction, altitude should be lower (or equal for zenith)
        assert!(
            no_refraction.alt <= with_refraction.alt,
            "No-refraction alt {} should be <= refraction alt {}",
            no_refraction.alt,
            with_refraction.alt
        );
    }

    #[test]
    fn test_equatorial_to_horizontal_refraction_azimuth_unchanged() {
        // Refraction only affects altitude, not azimuth
        let ts = Some(0i64);
        let with = equatorial_to_horizontal(90.0, 20.0, 40.0, -74.0, ts, Some(true));
        let without = equatorial_to_horizontal(90.0, 20.0, 40.0, -74.0, ts, Some(false));
        assert!(
            approx_eq(with.az, without.az, 1e-10),
            "Azimuth should not change with refraction: {} vs {}",
            with.az,
            without.az
        );
    }

    #[test]
    fn test_equatorial_to_horizontal_refraction_magnitude() {
        // Near the horizon, refraction correction should be ~0.5°
        // Near zenith, correction should be negligible
        let ts = Some(0i64);
        // Test multiple declinations to find a near-horizon case
        let results: Vec<(f64, f64)> = (-80..=80)
            .step_by(10)
            .map(|dec| {
                let with = equatorial_to_horizontal(0.0, dec as f64, 45.0, 0.0, ts, Some(true));
                let without = equatorial_to_horizontal(0.0, dec as f64, 45.0, 0.0, ts, Some(false));
                (without.alt, with.alt - without.alt)
            })
            .collect();

        for (geo_alt, correction) in &results {
            // Correction should always be non-negative
            assert!(
                *correction >= 0.0,
                "Refraction correction should be >= 0 at geo_alt {}, got {}",
                geo_alt,
                correction
            );
            // At high altitudes, correction is small
            if *geo_alt > 60.0 {
                assert!(
                    *correction < 0.05,
                    "Refraction at high alt {}° should be < 0.05°, got {}",
                    geo_alt,
                    correction
                );
            }
        }
    }

    // ------------------------------------------------------------------------
    // Angular Separation Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_angular_separation_same_point() {
        let sep = angular_separation(100.0, 45.0, 100.0, 45.0);
        assert!(
            approx_eq(sep, 0.0, EPSILON),
            "Same point separation should be 0"
        );
    }

    #[test]
    fn test_angular_separation_poles() {
        // North pole to south pole = 180°
        let sep = angular_separation(0.0, 90.0, 0.0, -90.0);
        assert!(
            approx_eq(sep, 180.0, 0.01),
            "Pole to pole should be 180°, got {}",
            sep
        );
    }

    #[test]
    fn test_angular_separation_known_value() {
        // Separation between two points 90° apart on equator
        let sep = angular_separation(0.0, 0.0, 90.0, 0.0);
        assert!(approx_eq(sep, 90.0, 0.01), "Should be 90°, got {}", sep);
    }
}
