//! FITS header parsing, WCS extraction, and SIP distortion coefficient handling.

use std::collections::HashMap;

use super::types::{PlateSolverError, SipCoefficients, WcsResult};

/// Parse FITS header cards from raw bytes into a string of "KEY = VALUE" lines
pub fn parse_fits_header_from_bytes(data: &[u8]) -> String {
    let mut result = String::new();
    let card_size = 80;
    let block_size = 2880;
    let max_blocks = 100;
    let mut offset = 0;
    let mut blocks = 0;

    while offset + card_size <= data.len() && blocks < max_blocks {
        let card = &data[offset..offset + card_size];
        // Convert bytes to string (ASCII)
        let card_str: String = card
            .iter()
            .map(|&b| {
                if (0x20..=0x7E).contains(&b) {
                    b as char
                } else {
                    ' '
                }
            })
            .collect();

        if card_str.trim_start().starts_with("END") && card_str[3..].trim().is_empty() {
            break;
        }

        result.push_str(&card_str);
        result.push('\n');

        offset += card_size;
        // Track block boundaries
        if offset % block_size == 0 {
            blocks += 1;
        }
    }

    result
}

/// Parse FITS header cards from raw bytes into a HashMap of key-value pairs
pub fn parse_fits_header_map_from_bytes(data: &[u8]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let card_size = 80;
    let mut offset = 0;

    while offset + card_size <= data.len() {
        let card = &data[offset..offset + card_size];
        let card_str: String = card
            .iter()
            .map(|&b| {
                if (0x20..=0x7E).contains(&b) {
                    b as char
                } else {
                    ' '
                }
            })
            .collect();

        let key = card_str.get(0..8).unwrap_or("").trim().to_string();
        if key.is_empty() {
            offset += card_size;
            continue;
        }
        if key == "END" {
            break;
        }

        if card_str.as_bytes().get(8) == Some(&b'=') {
            let raw_value = card_str.get(10..).unwrap_or("").trim_end();
            map.insert(key, parse_fits_card_value(raw_value));
        }

        offset += card_size;
    }

    map
}

/// Parse a FITS card value, handling quoted strings and comments
fn parse_fits_card_value(value: &str) -> String {
    let mut in_quotes = false;
    let mut result = String::new();

    for ch in value.chars() {
        if ch == '\'' {
            in_quotes = !in_quotes;
            result.push(ch);
            continue;
        }
        if ch == '/' && !in_quotes {
            break;
        }
        result.push(ch);
    }

    result.trim().to_string()
}

/// Parse FITS `KEY = VALUE / comment` format
pub fn parse_value(line: &str) -> Option<f64> {
    line.split('=')
        .nth(1)?
        .split('/')
        .next()?
        .trim()
        .parse()
        .ok()
}

/// Parse INI `KEY=VALUE // comment` format
pub fn parse_ini_value(line: &str) -> Option<f64> {
    // INI format: KEY=VALUE // comment
    let after_eq = line.split('=').nth(1)?;
    let value_str = after_eq.split("//").next()?.trim();
    value_str.parse::<f64>().ok()
}

pub fn parse_f64_header_value(header: &HashMap<String, String>, key: &str) -> Option<f64> {
    let raw = header.get(key)?;
    let normalized = raw.trim().replace('D', "E");
    normalized.parse::<f64>().ok()
}

pub fn parse_u32_header_value(header: &HashMap<String, String>, key: &str) -> Option<u32> {
    let value = parse_f64_header_value(header, key)?;
    if value >= 0.0 {
        Some(value.round() as u32)
    } else {
        None
    }
}

pub fn parse_string_header_value(header: &HashMap<String, String>, key: &str) -> Option<String> {
    let raw = header.get(key)?.trim();
    if raw.is_empty() {
        return None;
    }
    let unquoted = raw
        .strip_prefix('\'')
        .and_then(|s| s.strip_suffix('\''))
        .unwrap_or(raw)
        .trim();
    if unquoted.is_empty() {
        None
    } else {
        Some(unquoted.to_string())
    }
}

pub fn parse_sip_coefficients(header: &HashMap<String, String>) -> Option<SipCoefficients> {
    let mut sip = SipCoefficients {
        a_order: parse_u32_header_value(header, "A_ORDER"),
        b_order: parse_u32_header_value(header, "B_ORDER"),
        ap_order: parse_u32_header_value(header, "AP_ORDER"),
        bp_order: parse_u32_header_value(header, "BP_ORDER"),
        ..Default::default()
    };

    for (key, raw) in header {
        let parsed = raw.trim().replace('D', "E").parse::<f64>();
        let Ok(value) = parsed else {
            continue;
        };

        if key.starts_with("A_") && key != "A_ORDER" {
            sip.a_coeffs.insert(key.clone(), value);
        } else if key.starts_with("B_") && key != "B_ORDER" {
            sip.b_coeffs.insert(key.clone(), value);
        } else if key.starts_with("AP_") && key != "AP_ORDER" {
            sip.ap_coeffs.insert(key.clone(), value);
        } else if key.starts_with("BP_") && key != "BP_ORDER" {
            sip.bp_coeffs.insert(key.clone(), value);
        }
    }

    let has_sip = sip.a_order.is_some()
        || sip.b_order.is_some()
        || sip.ap_order.is_some()
        || sip.bp_order.is_some()
        || !sip.a_coeffs.is_empty()
        || !sip.b_coeffs.is_empty()
        || !sip.ap_coeffs.is_empty()
        || !sip.bp_coeffs.is_empty();

    if has_sip {
        Some(sip)
    } else {
        None
    }
}

/// Build a WcsResult from a parsed FITS header map
pub fn wcs_from_header_map(header: &HashMap<String, String>) -> WcsResult {
    let sip = parse_sip_coefficients(header);
    WcsResult {
        crpix1: parse_f64_header_value(header, "CRPIX1"),
        crpix2: parse_f64_header_value(header, "CRPIX2"),
        crval1: parse_f64_header_value(header, "CRVAL1"),
        crval2: parse_f64_header_value(header, "CRVAL2"),
        cdelt1: parse_f64_header_value(header, "CDELT1"),
        cdelt2: parse_f64_header_value(header, "CDELT2"),
        crota1: parse_f64_header_value(header, "CROTA1"),
        crota2: parse_f64_header_value(header, "CROTA2"),
        cd1_1: parse_f64_header_value(header, "CD1_1"),
        cd1_2: parse_f64_header_value(header, "CD1_2"),
        cd2_1: parse_f64_header_value(header, "CD2_1"),
        cd2_2: parse_f64_header_value(header, "CD2_2"),
        ctype1: parse_string_header_value(header, "CTYPE1"),
        ctype2: parse_string_header_value(header, "CTYPE2"),
        naxis1: parse_u32_header_value(header, "NAXIS1"),
        naxis2: parse_u32_header_value(header, "NAXIS2"),
        sip,
    }
}

/// Parse WCS result from raw FITS bytes
pub fn parse_wcs_result_from_fits_bytes(data: &[u8]) -> Result<WcsResult, PlateSolverError> {
    let header = parse_fits_header_map_from_bytes(data);
    let wcs = wcs_from_header_map(&header);

    if wcs.crval1.is_none() && wcs.crval2.is_none() && wcs.cd1_1.is_none() && wcs.cdelt1.is_none() {
        return Err(PlateSolverError::SolveFailed(
            "WCS header did not contain usable calibration fields".to_string(),
        ));
    }

    Ok(wcs)
}

/// Calculate FOV width and height from WCS result
pub fn calculate_fov_from_wcs(wcs: &WcsResult) -> (Option<f64>, Option<f64>) {
    let (Some(naxis1), Some(naxis2)) = (wcs.naxis1, wcs.naxis2) else {
        return (None, None);
    };

    if let (Some(cd1_1), Some(cd1_2), Some(cd2_1), Some(cd2_2)) =
        (wcs.cd1_1, wcs.cd1_2, wcs.cd2_1, wcs.cd2_2)
    {
        let scale_x = (cd1_1 * cd1_1 + cd2_1 * cd2_1).sqrt();
        let scale_y = (cd1_2 * cd1_2 + cd2_2 * cd2_2).sqrt();
        return (Some(scale_x * naxis1 as f64), Some(scale_y * naxis2 as f64));
    }

    if let (Some(cdelt1), Some(cdelt2)) = (wcs.cdelt1, wcs.cdelt2) {
        return (
            Some(cdelt1.abs() * naxis1 as f64),
            Some(cdelt2.abs() * naxis2 as f64),
        );
    }

    (None, None)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-4;

    fn approx_eq(a: f64, b: f64) -> bool {
        (a - b).abs() < EPSILON
    }

    #[test]
    fn test_parse_value_basic() {
        let value = parse_value("CRVAL1 = 180.0 / comment");
        assert!(value.is_some());
        assert!(approx_eq(value.unwrap(), 180.0));
    }

    #[test]
    fn test_parse_value_no_comment() {
        let value = parse_value("CRVAL2 = 45.5");
        assert!(value.is_some());
        assert!(approx_eq(value.unwrap(), 45.5));
    }

    #[test]
    fn test_parse_value_invalid() {
        assert!(parse_value("invalid").is_none());
        assert!(parse_value("KEY = abc").is_none());
    }

    #[test]
    fn test_parse_wcs_result_from_fits_bytes_with_sip() {
        let fits_data = build_test_fits(&[
            "SIMPLE  =                    T",
            "BITPIX  =                   16",
            "NAXIS   =                    2",
            "NAXIS1  =                 3000",
            "NAXIS2  =                 2000",
            "CRPIX1  =              1500.5",
            "CRPIX2  =              1000.5",
            "CRVAL1  =               83.633",
            "CRVAL2  =               22.014",
            "CD1_1   =            -1.2E-04",
            "CD1_2   =             0.0E+00",
            "CD2_1   =             0.0E+00",
            "CD2_2   =             1.2E-04",
            "CTYPE1  = 'RA---TAN-SIP'",
            "CTYPE2  = 'DEC--TAN-SIP'",
            "A_ORDER =                    2",
            "B_ORDER =                    2",
            "A_0_2   =             1.0E-05",
            "B_1_1   =            -2.0E-05",
        ]);

        let wcs = parse_wcs_result_from_fits_bytes(&fits_data).unwrap();
        let (fov_w, fov_h) = calculate_fov_from_wcs(&wcs);

        assert!(approx_eq(wcs.crval1.unwrap(), 83.633));
        assert!(approx_eq(wcs.crval2.unwrap(), 22.014));
        assert!(approx_eq(wcs.cd1_1.unwrap(), -1.2e-4));
        assert!(wcs.ctype1.unwrap().contains("RA---TAN"));
        assert!(wcs.sip.is_some());
        let sip = wcs.sip.unwrap();
        assert_eq!(sip.a_order, Some(2));
        assert_eq!(sip.b_order, Some(2));
        assert!(sip.a_coeffs.contains_key("A_0_2"));
        assert!(sip.b_coeffs.contains_key("B_1_1"));
        assert!(fov_w.unwrap() > 0.3 && fov_w.unwrap() < 0.4);
        assert!(fov_h.unwrap() > 0.2 && fov_h.unwrap() < 0.3);
    }

    // ------------------------------------------------------------------------
    // parse_ini_value Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_ini_value_basic() {
        let value = parse_ini_value("CRVAL1=180.0 // RA center");
        assert!(value.is_some());
        assert!(approx_eq(value.unwrap(), 180.0));
    }

    #[test]
    fn test_parse_ini_value_no_comment() {
        let value = parse_ini_value("CDELT1=-0.00012");
        assert!(value.is_some());
        assert!(approx_eq(value.unwrap(), -0.00012));
    }

    #[test]
    fn test_parse_ini_value_scientific_notation() {
        let value = parse_ini_value("CD1_1=1.2E-04 // scale");
        assert!(value.is_some());
        assert!(approx_eq(value.unwrap(), 1.2e-4));
    }

    #[test]
    fn test_parse_ini_value_invalid() {
        assert!(parse_ini_value("invalid").is_none());
        assert!(parse_ini_value("KEY=abc").is_none());
    }

    // ------------------------------------------------------------------------
    // parse_fits_header_map_from_bytes Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_fits_header_map_basic() {
        let fits_data = build_test_fits(&[
            "SIMPLE  =                    T",
            "NAXIS1  =                 1024",
            "CRVAL1  =             180.5000",
        ]);
        let map = parse_fits_header_map_from_bytes(&fits_data);
        assert_eq!(map.get("SIMPLE").map(|s| s.as_str()), Some("T"));
        assert_eq!(map.get("NAXIS1").map(|s| s.as_str()), Some("1024"));
        assert!(map.get("CRVAL1").unwrap().contains("180.5"));
    }

    #[test]
    fn test_parse_fits_header_map_with_string_value() {
        let fits_data = build_test_fits(&["CTYPE1  = 'RA---TAN'", "CTYPE2  = 'DEC--TAN'"]);
        let map = parse_fits_header_map_from_bytes(&fits_data);
        assert!(map.get("CTYPE1").unwrap().contains("RA---TAN"));
        assert!(map.get("CTYPE2").unwrap().contains("DEC--TAN"));
    }

    #[test]
    fn test_parse_fits_header_map_empty() {
        // Just an END card
        let fits_data = build_test_fits(&[]);
        let map = parse_fits_header_map_from_bytes(&fits_data);
        assert!(map.is_empty());
    }

    // ------------------------------------------------------------------------
    // parse_f64/u32/string_header_value Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_f64_header_value() {
        let mut header = HashMap::new();
        header.insert("CRVAL1".to_string(), "180.5".to_string());
        header.insert("CD1_1".to_string(), "-1.2D-04".to_string()); // Fortran D notation
        header.insert("BAD".to_string(), "not_a_number".to_string());

        assert!(approx_eq(
            parse_f64_header_value(&header, "CRVAL1").unwrap(),
            180.5
        ));
        assert!(approx_eq(
            parse_f64_header_value(&header, "CD1_1").unwrap(),
            -1.2e-4
        ));
        assert!(parse_f64_header_value(&header, "BAD").is_none());
        assert!(parse_f64_header_value(&header, "MISSING").is_none());
    }

    #[test]
    fn test_parse_u32_header_value() {
        let mut header = HashMap::new();
        header.insert("NAXIS1".to_string(), "3000".to_string());
        header.insert("NEG".to_string(), "-5".to_string());

        assert_eq!(parse_u32_header_value(&header, "NAXIS1"), Some(3000));
        assert!(parse_u32_header_value(&header, "NEG").is_none()); // negative
        assert!(parse_u32_header_value(&header, "MISSING").is_none());
    }

    #[test]
    fn test_parse_string_header_value() {
        let mut header = HashMap::new();
        header.insert("CTYPE1".to_string(), "'RA---TAN-SIP'".to_string());
        header.insert("EMPTY".to_string(), "''".to_string());
        header.insert("BARE".to_string(), "HELLO".to_string());

        assert_eq!(
            parse_string_header_value(&header, "CTYPE1").unwrap(),
            "RA---TAN-SIP"
        );
        assert!(parse_string_header_value(&header, "EMPTY").is_none()); // empty after unquote
        assert_eq!(parse_string_header_value(&header, "BARE").unwrap(), "HELLO");
        assert!(parse_string_header_value(&header, "MISSING").is_none());
    }

    // ------------------------------------------------------------------------
    // calculate_fov_from_wcs Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_calculate_fov_from_cd_matrix() {
        let wcs = WcsResult {
            naxis1: Some(2000),
            naxis2: Some(1500),
            cd1_1: Some(-0.0003),
            cd1_2: Some(0.0),
            cd2_1: Some(0.0),
            cd2_2: Some(0.0003),
            ..Default::default()
        };
        let (w, h) = calculate_fov_from_wcs(&wcs);
        assert!(approx_eq(w.unwrap(), 0.6)); // 0.0003 * 2000
        assert!(approx_eq(h.unwrap(), 0.45)); // 0.0003 * 1500
    }

    #[test]
    fn test_calculate_fov_from_cdelt() {
        let wcs = WcsResult {
            naxis1: Some(3000),
            naxis2: Some(2000),
            cdelt1: Some(-0.00012),
            cdelt2: Some(0.00012),
            ..Default::default()
        };
        let (w, h) = calculate_fov_from_wcs(&wcs);
        assert!(approx_eq(w.unwrap(), 0.36)); // 0.00012 * 3000
        assert!(approx_eq(h.unwrap(), 0.24)); // 0.00012 * 2000
    }

    #[test]
    fn test_calculate_fov_no_naxis() {
        let wcs = WcsResult {
            cd1_1: Some(-0.0003),
            cd1_2: Some(0.0),
            cd2_1: Some(0.0),
            cd2_2: Some(0.0003),
            ..Default::default()
        };
        let (w, h) = calculate_fov_from_wcs(&wcs);
        assert!(w.is_none());
        assert!(h.is_none());
    }

    #[test]
    fn test_calculate_fov_no_scale_info() {
        let wcs = WcsResult {
            naxis1: Some(2000),
            naxis2: Some(1500),
            ..Default::default()
        };
        let (w, h) = calculate_fov_from_wcs(&wcs);
        assert!(w.is_none());
        assert!(h.is_none());
    }

    // ------------------------------------------------------------------------
    // parse_sip_coefficients Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_sip_coefficients_present() {
        let mut header = HashMap::new();
        header.insert("A_ORDER".to_string(), "2".to_string());
        header.insert("B_ORDER".to_string(), "2".to_string());
        header.insert("A_0_2".to_string(), "1.5E-05".to_string());
        header.insert("B_1_1".to_string(), "-2.0E-05".to_string());

        let sip = parse_sip_coefficients(&header);
        assert!(sip.is_some());
        let sip = sip.unwrap();
        assert_eq!(sip.a_order, Some(2));
        assert_eq!(sip.b_order, Some(2));
        assert!(sip.a_coeffs.contains_key("A_0_2"));
        assert!(sip.b_coeffs.contains_key("B_1_1"));
    }

    #[test]
    fn test_parse_sip_coefficients_absent() {
        let header = HashMap::new();
        assert!(parse_sip_coefficients(&header).is_none());
    }

    #[test]
    fn test_parse_sip_coefficients_only_ap_bp() {
        let mut header = HashMap::new();
        header.insert("AP_ORDER".to_string(), "3".to_string());
        header.insert("BP_ORDER".to_string(), "3".to_string());
        header.insert("AP_0_1".to_string(), "1.0E-06".to_string());

        let sip = parse_sip_coefficients(&header);
        assert!(sip.is_some());
        let sip = sip.unwrap();
        assert_eq!(sip.ap_order, Some(3));
        assert!(sip.ap_coeffs.contains_key("AP_0_1"));
    }

    // ------------------------------------------------------------------------
    // parse_fits_header_from_bytes Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_fits_header_from_bytes_basic() {
        let fits_data = build_test_fits(&[
            "CRVAL1  =               180.0 / RA",
            "CRVAL2  =                45.0 / DEC",
        ]);
        let header = parse_fits_header_from_bytes(&fits_data);
        assert!(header.contains("CRVAL1"));
        assert!(header.contains("180.0"));
        assert!(header.contains("CRVAL2"));
    }

    #[test]
    fn test_parse_wcs_result_missing_calibration() {
        // FITS with no WCS fields should fail
        let fits_data = build_test_fits(&[
            "SIMPLE  =                    T",
            "BITPIX  =                   16",
        ]);
        let result = parse_wcs_result_from_fits_bytes(&fits_data);
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------------
    // build_test_fits helper (used by tests above)
    // ------------------------------------------------------------------------

    fn build_test_fits(cards: &[&str]) -> Vec<u8> {
        let mut data = Vec::new();
        for card in cards {
            let mut padded = String::from(*card);
            if padded.len() > 80 {
                padded.truncate(80);
            } else if padded.len() < 80 {
                padded.push_str(&" ".repeat(80 - padded.len()));
            }
            data.extend_from_slice(padded.as_bytes());
        }

        let mut end_card = String::from("END");
        end_card.push_str(&" ".repeat(77));
        data.extend_from_slice(end_card.as_bytes());

        let remainder = data.len() % 2880;
        if remainder != 0 {
            data.extend_from_slice(&vec![b' '; 2880 - remainder]);
        }

        data
    }
}
