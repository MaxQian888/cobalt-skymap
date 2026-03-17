//! Common constants, regex patterns, and helper functions
//! Shared across all calculation submodules

use once_cell::sync::Lazy;
use std::f64::consts::PI;

// ============================================================================
// Constants
// ============================================================================

pub const DEG_TO_RAD: f64 = PI / 180.0;
pub const RAD_TO_DEG: f64 = 180.0 / PI;
pub const HOURS_TO_DEG: f64 = 15.0;
pub const EQ_TO_GAL_MATRIX: [[f64; 3]; 3] = [
    [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
    [
        0.4941094278755837,
        -0.4448296299600112,
        0.746_982_244_497_219,
    ],
    [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
];
pub const GAL_TO_EQ_MATRIX: [[f64; 3]; 3] = [
    [
        EQ_TO_GAL_MATRIX[0][0],
        EQ_TO_GAL_MATRIX[1][0],
        EQ_TO_GAL_MATRIX[2][0],
    ],
    [
        EQ_TO_GAL_MATRIX[0][1],
        EQ_TO_GAL_MATRIX[1][1],
        EQ_TO_GAL_MATRIX[2][1],
    ],
    [
        EQ_TO_GAL_MATRIX[0][2],
        EQ_TO_GAL_MATRIX[1][2],
        EQ_TO_GAL_MATRIX[2][2],
    ],
];

/// Coordinate convention contract (aligned with TS pipeline):
/// - Longitude is positive east
/// - Azimuth is north=0°, east=90°
pub const _LONGITUDE_EAST_POSITIVE: bool = true;
pub const _AZIMUTH_NORTH_ZERO_EAST_NINETY: bool = true;

// ============================================================================
// Regex Patterns
// ============================================================================

/// Static compiled regex for RA parsing (HMS format)
pub static RA_HMS_REGEX: Lazy<regex_lite::Regex> =
    Lazy::new(|| regex_lite::Regex::new(r"(\d+)[h:\s]+(\d+)[m:\s]+(\d+\.?\d*)s?").unwrap());

/// Static compiled regex for Dec parsing (DMS format)
pub static DEC_DMS_REGEX: Lazy<regex_lite::Regex> =
    Lazy::new(|| regex_lite::Regex::new(r#"([+-]?\d+)[°:\s]+(\d+)[':\s]+(\d+\.?\d*)"?"#).unwrap());

// ============================================================================
// Helper Functions
// ============================================================================

/// Normalize angle to 0-360 degrees
pub fn normalize_degrees(deg: f64) -> f64 {
    let mut result = deg % 360.0;
    if result < 0.0 {
        result += 360.0;
    }
    result
}

/// Calculate obliquity of the ecliptic
pub fn calculate_obliquity(jd: f64) -> f64 {
    let t = (jd - 2451545.0) / 36525.0;
    23.439291 - 0.0130042 * t - 0.00000016 * t * t + 0.000000504 * t * t * t
}

/// Atmospheric refraction correction using Bennett's formula.
/// Returns correction in degrees to ADD to geometric altitude.
/// Valid for altitudes above -1°; returns 0 for deeply negative altitudes.
pub fn atmospheric_refraction(alt_deg: f64) -> f64 {
    if alt_deg < -1.0 {
        return 0.0;
    }
    let alt = alt_deg.max(0.0);
    // Bennett's formula: R (arcminutes) = 1 / tan(h + 7.31/(h + 4.4))
    let r = 1.0 / ((alt + 7.31 / (alt + 4.4)).to_radians().tan());
    r / 60.0 // Convert arcminutes to degrees
}

/// Convert Julian Date to Unix timestamp
pub fn jd_to_timestamp(jd: f64) -> i64 {
    ((jd - 2440587.5) * 86400.0) as i64
}

/// Convert Unix timestamp to Julian Date
pub fn timestamp_to_jd(ts: i64) -> f64 {
    ts as f64 / 86400.0 + 2440587.5
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-6;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_normalize_degrees() {
        assert!(approx_eq(normalize_degrees(0.0), 0.0, EPSILON));
        assert!(approx_eq(normalize_degrees(360.0), 0.0, EPSILON));
        assert!(approx_eq(normalize_degrees(720.0), 0.0, EPSILON));
        assert!(approx_eq(normalize_degrees(-90.0), 270.0, EPSILON));
        assert!(approx_eq(normalize_degrees(450.0), 90.0, EPSILON));
    }

    #[test]
    fn test_calculate_obliquity() {
        // At J2000.0, obliquity ≈ 23.439°
        let obliquity = calculate_obliquity(2451545.0);
        assert!(
            approx_eq(obliquity, 23.439, 0.01),
            "Obliquity at J2000 should be ~23.439°, got {}",
            obliquity
        );
    }

    // ------------------------------------------------------------------------
    // Atmospheric Refraction Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_atmospheric_refraction_horizon() {
        // At the horizon (0°), refraction ≈ 0.58° (about 34 arcmin)
        let r = atmospheric_refraction(0.0);
        assert!(
            r > 0.5 && r < 0.7,
            "Refraction at horizon should be ~0.58°, got {}",
            r
        );
    }

    #[test]
    fn test_atmospheric_refraction_zenith() {
        // At zenith (90°), refraction should be negligible (< 0.01°)
        let r = atmospheric_refraction(90.0);
        assert!(r < 0.01, "Refraction at zenith should be near 0, got {}", r);
    }

    #[test]
    fn test_atmospheric_refraction_positive() {
        // Refraction is always positive (raises apparent altitude)
        // Allow tiny negative at 90° due to Bennett's formula floating-point limit
        for alt in [0.0, 5.0, 10.0, 20.0, 45.0, 60.0, 80.0, 90.0] {
            let r = atmospheric_refraction(alt);
            assert!(
                r >= -1e-4,
                "Refraction should be non-negative at {}°, got {}",
                alt,
                r
            );
        }
    }

    #[test]
    fn test_atmospheric_refraction_decreasing() {
        // Refraction decreases with increasing altitude
        let mut prev = atmospheric_refraction(0.0);
        for alt in [5.0, 10.0, 20.0, 45.0, 60.0, 80.0, 90.0] {
            let r = atmospheric_refraction(alt);
            assert!(
                r <= prev,
                "Refraction should decrease: at {}° got {} > prev {}",
                alt,
                r,
                prev
            );
            prev = r;
        }
    }

    #[test]
    fn test_atmospheric_refraction_deeply_negative() {
        // Below -1°, returns 0
        assert!(approx_eq(atmospheric_refraction(-5.0), 0.0, EPSILON));
        assert!(approx_eq(atmospheric_refraction(-90.0), 0.0, EPSILON));
    }

    #[test]
    fn test_atmospheric_refraction_near_horizon() {
        // At -0.5° (slightly below horizon), should still return a correction
        let r = atmospheric_refraction(-0.5);
        assert!(r > 0.0, "Refraction at -0.5° should be positive, got {}", r);
    }

    #[test]
    fn test_atmospheric_refraction_known_values() {
        // At 10°, Bennett's formula gives ≈ 5.3 arcmin ≈ 0.089°
        let r10 = atmospheric_refraction(10.0);
        assert!(
            r10 > 0.07 && r10 < 0.12,
            "Refraction at 10° should be ~0.09°, got {}",
            r10
        );

        // At 45°, refraction ≈ 1.0 arcmin ≈ 0.017°
        let r45 = atmospheric_refraction(45.0);
        assert!(
            r45 > 0.01 && r45 < 0.03,
            "Refraction at 45° should be ~0.017°, got {}",
            r45
        );
    }
}
