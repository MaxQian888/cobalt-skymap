//! Time calculations
//! Julian Date, GMST, LST, and hour angle calculations

use chrono::{DateTime, Datelike, NaiveDate, Timelike, Utc};

use super::common::normalize_degrees;

// ============================================================================
// Time Calculations
// ============================================================================

/// Calculate Julian Date from DateTime
pub fn datetime_to_jd(dt: &DateTime<Utc>) -> f64 {
    let year = dt.year() as f64;
    let month = dt.month() as f64;
    let day = dt.day() as f64;
    let hour = dt.hour() as f64;
    let minute = dt.minute() as f64;
    let second = dt.second() as f64;

    let day_fraction = day + (hour + minute / 60.0 + second / 3600.0) / 24.0;

    let (y, m) = if month <= 2.0 {
        (year - 1.0, month + 12.0)
    } else {
        (year, month)
    };

    let a = (y / 100.0).floor();
    let b = 2.0 - a + (a / 4.0).floor();

    (365.25 * (y + 4716.0)).floor() + (30.6001 * (m + 1.0)).floor() + day_fraction + b - 1524.5
}

/// Calculate Julian Date from NaiveDate
pub fn date_to_jd(date: &NaiveDate) -> f64 {
    let year = date.year() as f64;
    let month = date.month() as f64;
    let day = date.day() as f64;

    let (y, m) = if month <= 2.0 {
        (year - 1.0, month + 12.0)
    } else {
        (year, month)
    };

    let a = (y / 100.0).floor();
    let b = 2.0 - a + (a / 4.0).floor();

    (365.25 * (y + 4716.0)).floor() + (30.6001 * (m + 1.0)).floor() + day + b - 1524.5
}

/// Calculate Greenwich Mean Sidereal Time (GMST) in degrees
pub fn calculate_gmst(jd: f64) -> f64 {
    let t = (jd - 2451545.0) / 36525.0;
    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t
        - t * t * t / 38710000.0;

    normalize_degrees(gmst)
}

/// Calculate Local Sidereal Time (LST) in degrees
pub fn calculate_lst(jd: f64, longitude: f64) -> f64 {
    let gmst = calculate_gmst(jd);
    normalize_degrees(gmst + longitude)
}

/// Calculate hour angle in degrees
pub fn calculate_hour_angle(lst: f64, ra: f64) -> f64 {
    normalize_degrees(lst - ra)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    const EPSILON: f64 = 1e-6;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_datetime_to_jd_j2000() {
        // J2000.0 epoch: January 1, 2000, 12:00 TT = JD 2451545.0
        let dt = Utc.with_ymd_and_hms(2000, 1, 1, 12, 0, 0).unwrap();
        let jd = datetime_to_jd(&dt);
        assert!(
            approx_eq(jd, 2451545.0, 0.001),
            "J2000 JD should be ~2451545.0, got {}",
            jd
        );
    }

    #[test]
    fn test_datetime_to_jd_known_date() {
        // October 15, 1582 (Gregorian calendar start) = JD 2299160.5
        let dt = Utc.with_ymd_and_hms(1582, 10, 15, 0, 0, 0).unwrap();
        let jd = datetime_to_jd(&dt);
        assert!(
            approx_eq(jd, 2299160.5, 0.5),
            "Expected ~2299160.5, got {}",
            jd
        );
    }

    #[test]
    fn test_date_to_jd() {
        let date = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
        let jd = date_to_jd(&date);
        // Noon on J2000.0 day
        assert!(
            approx_eq(jd, 2451544.5, 0.001),
            "Expected ~2451544.5, got {}",
            jd
        );
    }

    #[test]
    fn test_calculate_gmst() {
        // At J2000.0 (JD 2451545.0), GMST ≈ 280.46°
        let gmst = calculate_gmst(2451545.0);
        assert!(
            approx_eq(gmst, 280.46, 0.1),
            "GMST at J2000 should be ~280.46°, got {}",
            gmst
        );
    }

    #[test]
    fn test_calculate_lst() {
        let jd = 2451545.0;
        let longitude = 0.0; // Greenwich
        let lst = calculate_lst(jd, longitude);
        let gmst = calculate_gmst(jd);
        assert!(
            approx_eq(lst, gmst, EPSILON),
            "LST at Greenwich should equal GMST"
        );
    }

    #[test]
    fn test_calculate_hour_angle() {
        let lst = 90.0;
        let ra = 30.0;
        let ha = calculate_hour_angle(lst, ra);
        assert!(approx_eq(ha, 60.0, EPSILON), "HA should be 60°, got {}", ha);
    }
}
