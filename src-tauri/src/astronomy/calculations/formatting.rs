//! Coordinate formatting and parsing
//! RA/Dec format conversion between degrees and HMS/DMS strings

use super::common::{DEC_DMS_REGEX, HOURS_TO_DEG, RA_HMS_REGEX};

// ============================================================================
// Coordinate Formatting
// ============================================================================

/// Format RA as HMS string
#[tauri::command]
pub fn format_ra_hms(ra_deg: f64) -> String {
    let ra_hours = ra_deg / 15.0;
    let h = ra_hours.floor() as i32;
    let m_float = (ra_hours - h as f64) * 60.0;
    let m = m_float.floor() as i32;
    let s = (m_float - m as f64) * 60.0;

    format!("{:02}h {:02}m {:05.2}s", h, m, s)
}

/// Format Dec as DMS string
#[tauri::command]
pub fn format_dec_dms(dec_deg: f64) -> String {
    let sign = if dec_deg >= 0.0 { "+" } else { "-" };
    let dec_abs = dec_deg.abs();
    let d = dec_abs.floor() as i32;
    let m_float = (dec_abs - d as f64) * 60.0;
    let m = m_float.floor() as i32;
    let s = (m_float - m as f64) * 60.0;

    format!("{}{}° {:02}' {:05.2}\"", sign, d, m, s)
}

/// Parse RA from HMS string
#[tauri::command]
pub fn parse_ra_hms(ra_str: String) -> Result<f64, String> {
    // Try various formats using static compiled regex
    if let Some(caps) = RA_HMS_REGEX.captures(&ra_str) {
        let h: f64 = caps
            .get(1)
            .unwrap()
            .as_str()
            .parse()
            .map_err(|e: std::num::ParseFloatError| e.to_string())?;
        let m: f64 = caps
            .get(2)
            .unwrap()
            .as_str()
            .parse()
            .map_err(|e: std::num::ParseFloatError| e.to_string())?;
        let s: f64 = caps
            .get(3)
            .unwrap()
            .as_str()
            .parse()
            .map_err(|e: std::num::ParseFloatError| e.to_string())?;

        // Validate component ranges
        if h >= 24.0 || m >= 60.0 || s >= 60.0 {
            return Err(format!("Invalid HMS components: {}h {}m {}s", h, m, s));
        }

        let deg = (h + m / 60.0 + s / 3600.0) * HOURS_TO_DEG;
        return Ok(deg);
    }

    // Try decimal degrees
    let deg = ra_str.trim().parse::<f64>().map_err(|e| e.to_string())?;
    if deg < 0.0 || deg >= 360.0 {
        return Err(format!("RA out of range [0, 360): {}", deg));
    }
    Ok(deg)
}

/// Parse Dec from DMS string
#[tauri::command]
pub fn parse_dec_dms(dec_str: String) -> Result<f64, String> {
    // Try various formats using static compiled regex
    if let Some(caps) = DEC_DMS_REGEX.captures(&dec_str) {
        let d_str = caps.get(1).unwrap().as_str();
        let d: f64 = d_str
            .parse()
            .map_err(|e: std::num::ParseFloatError| e.to_string())?;
        let m: f64 = caps
            .get(2)
            .unwrap()
            .as_str()
            .parse()
            .map_err(|e: std::num::ParseFloatError| e.to_string())?;
        let s: f64 = caps
            .get(3)
            .unwrap()
            .as_str()
            .parse()
            .map_err(|e: std::num::ParseFloatError| e.to_string())?;

        // Validate component ranges
        if m >= 60.0 || s >= 60.0 {
            return Err(format!("Invalid DMS components: {} {}' {}\"", d, m, s));
        }

        // Use string sign check to handle -0° correctly (IEEE 754: -0.0 < 0.0 is false)
        let sign = if d_str.starts_with('-') { -1.0 } else { 1.0 };
        let result = sign * (d.abs() + m / 60.0 + s / 3600.0);

        if result < -90.0 || result > 90.0 {
            return Err(format!("Dec out of range [-90, 90]: {}", result));
        }
        return Ok(result);
    }

    // Try decimal degrees
    let deg = dec_str.trim().parse::<f64>().map_err(|e| e.to_string())?;
    if deg < -90.0 || deg > 90.0 {
        return Err(format!("Dec out of range [-90, 90]: {}", deg));
    }
    Ok(deg)
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
    fn test_format_ra_hms() {
        // 0° = 00h 00m 00s
        assert!(format_ra_hms(0.0).starts_with("00h 00m"));

        // 180° = 12h
        let ra_12h = format_ra_hms(180.0);
        assert!(
            ra_12h.starts_with("12h 00m"),
            "180° should be 12h, got {}",
            ra_12h
        );
    }

    #[test]
    fn test_format_dec_dms() {
        // 0° = +0°
        let dec_0 = format_dec_dms(0.0);
        assert!(
            dec_0.starts_with("+0°"),
            "0° should start with +0°, got {}",
            dec_0
        );

        // -45° should have negative sign
        let dec_neg = format_dec_dms(-45.0);
        assert!(
            dec_neg.starts_with("-45°"),
            "-45° should start with -45°, got {}",
            dec_neg
        );
    }

    #[test]
    fn test_parse_ra_hms_standard() {
        let result = parse_ra_hms("12h 30m 45s".to_string());
        assert!(result.is_ok());
        let ra = result.unwrap();
        // 12h 30m 45s = (12 + 30/60 + 45/3600) * 15 ≈ 187.6875°
        assert!(
            approx_eq(ra, 187.6875, 0.01),
            "Parsed RA should be ~187.69°, got {}",
            ra
        );
    }

    #[test]
    fn test_parse_ra_hms_decimal() {
        let result = parse_ra_hms("123.45".to_string());
        assert!(result.is_ok());
        assert!(approx_eq(result.unwrap(), 123.45, EPSILON));
    }

    #[test]
    fn test_parse_dec_dms_positive() {
        let result = parse_dec_dms("+45° 30' 00\"".to_string());
        assert!(result.is_ok());
        let dec = result.unwrap();
        assert!(
            approx_eq(dec, 45.5, 0.01),
            "Parsed Dec should be ~45.5°, got {}",
            dec
        );
    }

    #[test]
    fn test_parse_dec_dms_negative() {
        let result = parse_dec_dms("-30° 15' 30\"".to_string());
        assert!(result.is_ok());
        let dec = result.unwrap();
        // -30° 15' 30" = -(30 + 15/60 + 30/3600) ≈ -30.2583°
        assert!(
            approx_eq(dec, -30.2583, 0.01),
            "Parsed Dec should be ~-30.26°, got {}",
            dec
        );
    }
}
