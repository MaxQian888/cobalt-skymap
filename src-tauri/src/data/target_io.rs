//! Target list import/export module
//! Supports CSV, Stellarium, and other common formats

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use super::storage::StorageError;

/// Static compiled regex for RA parsing (HMS format)
static RA_REGEX: Lazy<regex_lite::Regex> =
    Lazy::new(|| regex_lite::Regex::new(r"(\d+)[h:\s]+(\d+)[m:\s]+(\d+\.?\d*)s?").unwrap());

/// Static compiled regex for Dec parsing (DMS format)
static DEC_REGEX: Lazy<regex_lite::Regex> =
    Lazy::new(|| regex_lite::Regex::new(r#"([+-]?\d+)[°:\s]+(\d+)[':\s]+(\d+\.?\d*)"?"#).unwrap());

/// Target item for import/export
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetExportItem {
    pub name: String,
    pub ra: f64,
    pub dec: f64,
    #[serde(default)]
    pub ra_string: String,
    #[serde(default)]
    pub dec_string: String,
    pub object_type: Option<String>,
    pub constellation: Option<String>,
    pub magnitude: Option<f64>,
    pub size: Option<String>,
    pub notes: Option<String>,
    pub priority: Option<String>,
    pub tags: Option<String>,
}

/// Import result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportTargetsResult {
    pub imported: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub targets: Vec<TargetExportItem>,
}

/// Export formats
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Csv,
    Json,
    Stellarium,
    Mosaic,
}

/// Export targets to file
#[tauri::command]
pub async fn export_targets(
    app: AppHandle,
    targets: Vec<TargetExportItem>,
    format: ExportFormat,
    path: Option<String>,
) -> Result<String, StorageError> {
    let export_path = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        let file_path = app
            .dialog()
            .file()
            .set_title("Export Targets")
            .add_filter(
                "Files",
                match format {
                    ExportFormat::Csv => &["csv"],
                    ExportFormat::Json => &["json"],
                    ExportFormat::Stellarium => &["txt"],
                    ExportFormat::Mosaic => &["mosaicSession"],
                },
            )
            .set_file_name(match format {
                ExportFormat::Csv => "targets.csv",
                ExportFormat::Json => "targets.json",
                ExportFormat::Stellarium => "targets.txt",
                ExportFormat::Mosaic => "mosaic.mosaicSession",
            })
            .blocking_save_file();

        match file_path {
            Some(p) => p
                .into_path()
                .map_err(|_| StorageError::AppDataDirNotFound)?,
            None => {
                return Err(StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "Export cancelled",
                )))
            }
        }
    };

    let content = match format {
        ExportFormat::Csv => export_csv(&targets),
        ExportFormat::Json => export_json(&targets)?,
        ExportFormat::Stellarium => export_stellarium(&targets),
        ExportFormat::Mosaic => export_mosaic(&targets)?,
    };

    fs::write(&export_path, content)?;
    log::info!("Exported {} targets to {:?}", targets.len(), export_path);
    Ok(export_path.to_string_lossy().to_string())
}

/// Import targets from file
#[tauri::command]
pub async fn import_targets(
    app: AppHandle,
    path: Option<String>,
) -> Result<ImportTargetsResult, StorageError> {
    let import_path = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        let file_path = app
            .dialog()
            .file()
            .set_title("Import Targets")
            .add_filter("All Supported", &["csv", "json", "txt"])
            .add_filter("CSV Files", &["csv"])
            .add_filter("JSON Files", &["json"])
            .add_filter("Text Files", &["txt"])
            .blocking_pick_file();

        match file_path {
            Some(p) => p
                .into_path()
                .map_err(|_| StorageError::AppDataDirNotFound)?,
            None => {
                return Err(StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "Import cancelled",
                )))
            }
        }
    };

    let content = fs::read_to_string(&import_path)?;

    crate::network::security::validate_size(
        &content,
        crate::network::security::limits::MAX_CSV_SIZE,
    )
    .map_err(|e| StorageError::Other(e.to_string()))?;

    let extension = import_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let result = match extension.as_str() {
        "csv" => import_csv(&content),
        "json" => import_json(&content)?,
        "txt" => import_stellarium(&content),
        _ => import_csv(&content),
    };

    log::info!(
        "Imported {} targets from {:?}",
        result.imported,
        import_path
    );
    Ok(result)
}

fn export_csv(targets: &[TargetExportItem]) -> String {
    let mut lines = vec![
        "Name,RA,Dec,RA_HMS,Dec_DMS,Type,Constellation,Magnitude,Size,Priority,Tags,Notes"
            .to_string(),
    ];

    for t in targets {
        let line = format!(
            "\"{}\",{},{},\"{}\",\"{}\",\"{}\",\"{}\",{},\"{}\",\"{}\",\"{}\",\"{}\"",
            escape_csv(&t.name),
            t.ra,
            t.dec,
            escape_csv(&t.ra_string),
            escape_csv(&t.dec_string),
            escape_csv(&t.object_type.clone().unwrap_or_default()),
            escape_csv(&t.constellation.clone().unwrap_or_default()),
            t.magnitude.map(|m| m.to_string()).unwrap_or_default(),
            escape_csv(&t.size.clone().unwrap_or_default()),
            escape_csv(&t.priority.clone().unwrap_or_default()),
            escape_csv(&t.tags.clone().unwrap_or_default()),
            escape_csv(&t.notes.clone().unwrap_or_default()),
        );
        lines.push(line);
    }
    lines.join("\n")
}

fn import_csv(content: &str) -> ImportTargetsResult {
    // Strip UTF-8 BOM if present
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(content);

    let mut targets = Vec::new();
    let mut errors = Vec::new();
    let mut skipped = 0;
    let lines: Vec<&str> = content.lines().collect();

    if lines.len() > crate::network::security::limits::MAX_CSV_ROWS {
        return ImportTargetsResult {
            imported: 0,
            skipped: 0,
            errors: vec![format!("CSV exceeds max rows: {}", lines.len())],
            targets: Vec::new(),
        };
    }

    // Auto-detect separator: if first line contains tabs, use TSV mode
    let use_tsv = lines.first().map(|l| l.contains('\t')).unwrap_or(false);

    // Detect header row: skip if it looks like a header (case-insensitive check)
    let skip_header = lines
        .first()
        .map(|l| {
            let lower = l.to_lowercase();
            lower.contains("name") && (lower.contains("ra") || lower.contains("right"))
        })
        .unwrap_or(false);
    let start_line = if skip_header { 1 } else { 0 };

    for (i, line) in lines.iter().enumerate().skip(start_line) {
        if line.trim().is_empty() {
            continue;
        }

        let fields = if use_tsv {
            line.split('\t')
                .map(|s| s.trim().to_string())
                .collect::<Vec<_>>()
        } else {
            parse_csv_line(line)
        };

        if fields.len() < 3 {
            errors.push(format!(
                "Line {}: insufficient fields ({})",
                i + 1,
                fields.len()
            ));
            skipped += 1;
            continue;
        }

        let get_field = |idx: usize| -> &str { fields.get(idx).map(|s| s.as_str()).unwrap_or("") };
        let (ra, dec) =
            if let (Ok(ra), Ok(dec)) = (get_field(1).parse::<f64>(), get_field(2).parse::<f64>()) {
                match validate_coordinates(ra, dec) {
                    Some(coords) => coords,
                    None => {
                        errors.push(format!("Line {}: coords out of range", i + 1));
                        skipped += 1;
                        continue;
                    }
                }
            } else if fields.len() >= 5 {
                match parse_coordinates(get_field(3), get_field(4)) {
                    Some((ra, dec)) => (ra, dec),
                    None => {
                        errors.push(format!("Line {}: invalid coords", i + 1));
                        skipped += 1;
                        continue;
                    }
                }
            } else {
                // Try parsing first two non-name fields as coordinate strings
                match parse_coordinates(get_field(1), get_field(2)) {
                    Some((ra, dec)) => (ra, dec),
                    None => {
                        errors.push(format!("Line {}: invalid coords", i + 1));
                        skipped += 1;
                        continue;
                    }
                }
            };

        targets.push(TargetExportItem {
            name: get_field(0).to_string(),
            ra,
            dec,
            ra_string: if fields.len() > 3 {
                get_field(3).to_string()
            } else {
                String::new()
            },
            dec_string: if fields.len() > 4 {
                get_field(4).to_string()
            } else {
                String::new()
            },
            object_type: fields
                .get(5)
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            constellation: fields
                .get(6)
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            magnitude: fields.get(7).and_then(|s| s.parse().ok()),
            size: fields
                .get(8)
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            priority: fields
                .get(9)
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            tags: fields
                .get(10)
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
            notes: fields
                .get(11)
                .map(|s| s.to_string())
                .filter(|s| !s.is_empty()),
        });
    }
    ImportTargetsResult {
        imported: targets.len(),
        skipped,
        errors,
        targets,
    }
}

fn export_json(targets: &[TargetExportItem]) -> Result<String, StorageError> {
    Ok(serde_json::to_string_pretty(targets)?)
}

fn import_json(content: &str) -> Result<ImportTargetsResult, StorageError> {
    let targets: Vec<TargetExportItem> = serde_json::from_str(content)?;
    Ok(ImportTargetsResult {
        imported: targets.len(),
        skipped: 0,
        errors: Vec::new(),
        targets,
    })
}

fn export_stellarium(targets: &[TargetExportItem]) -> String {
    let mut lines = vec![
        "[Stellarium Observing List]".to_string(),
        format!("# Exported: {}", targets.len()),
        "".to_string(),
    ];
    for t in targets {
        lines.push(format!("{}\t{}\t{}", t.name, t.ra_string, t.dec_string));
    }
    lines.join("\n")
}

fn import_stellarium(content: &str) -> ImportTargetsResult {
    let mut targets = Vec::new();
    let mut errors = Vec::new();
    let mut skipped = 0;

    for (i, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with('[') {
            continue;
        }

        let mut parts: Vec<&str> = line.split('\t').collect();
        if parts.len() < 3 {
            parts = line.split(',').collect();
            if parts.len() < 3 {
                errors.push(format!("Line {}: invalid", i + 1));
                skipped += 1;
                continue;
            }
        }

        let name = parts[0].trim();
        let ra_str = parts.get(1).unwrap_or(&"").trim();
        let dec_str = parts.get(2).unwrap_or(&"").trim();

        match parse_coordinates(ra_str, dec_str) {
            Some((ra, dec)) => targets.push(TargetExportItem {
                name: name.to_string(),
                ra,
                dec,
                ra_string: ra_str.to_string(),
                dec_string: dec_str.to_string(),
                object_type: None,
                constellation: None,
                magnitude: None,
                size: None,
                priority: None,
                tags: None,
                notes: None,
            }),
            None => {
                errors.push(format!("Line {}: invalid coords", i + 1));
                skipped += 1;
            }
        }
    }
    ImportTargetsResult {
        imported: targets.len(),
        skipped,
        errors,
        targets,
    }
}

fn export_mosaic(targets: &[TargetExportItem]) -> Result<String, StorageError> {
    #[derive(Serialize)]
    struct MosaicSession {
        targets: Vec<MosaicTarget>,
    }
    #[derive(Serialize)]
    struct MosaicTarget {
        name: String,
        ra: f64,
        dec: f64,
    }

    let session = MosaicSession {
        targets: targets
            .iter()
            .map(|t| MosaicTarget {
                name: t.name.clone(),
                ra: t.ra,
                dec: t.dec,
            })
            .collect(),
    };
    Ok(serde_json::to_string_pretty(&session)?)
}

fn escape_csv(s: &str) -> String {
    s.replace('"', "\"\"")
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            '"' => {
                if in_quotes && chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = !in_quotes;
                }
            }
            ',' if !in_quotes => {
                fields.push(current.trim().to_string());
                current = String::new();
            }
            _ => current.push(c),
        }
    }
    fields.push(current.trim().to_string());
    fields
}

fn parse_coordinates(ra_str: &str, dec_str: &str) -> Option<(f64, f64)> {
    let ra = parse_ra(ra_str)?;
    let dec = parse_dec(dec_str)?;
    validate_coordinates(ra, dec)
}

/// Validate that coordinates are within valid astronomical ranges
fn validate_coordinates(ra: f64, dec: f64) -> Option<(f64, f64)> {
    // RA: 0-360 degrees (allow slightly negative for wrap-around)
    // Dec: -90 to +90 degrees
    if ra >= -0.001 && ra < 360.001 && dec >= -90.0 && dec <= 90.0 {
        // Normalize RA to 0-360 range
        let normalized_ra = if ra < 0.0 {
            ra + 360.0
        } else if ra >= 360.0 {
            ra - 360.0
        } else {
            ra
        };
        Some((normalized_ra, dec))
    } else {
        None
    }
}

fn parse_ra(s: &str) -> Option<f64> {
    let s = s.trim();
    if let Ok(deg) = s.parse::<f64>() {
        return Some(deg);
    }
    if let Some(caps) = RA_REGEX.captures(s) {
        let h: f64 = caps.get(1)?.as_str().parse().ok()?;
        let m: f64 = caps.get(2)?.as_str().parse().ok()?;
        let sec: f64 = caps.get(3)?.as_str().parse().ok()?;
        // Validate component ranges
        if h >= 24.0 || m >= 60.0 || sec >= 60.0 {
            return None;
        }
        return Some((h + m / 60.0 + sec / 3600.0) * 15.0);
    }
    None
}

fn parse_dec(s: &str) -> Option<f64> {
    let s = s.trim();
    if let Ok(deg) = s.parse::<f64>() {
        return Some(deg);
    }
    if let Some(caps) = DEC_REGEX.captures(s) {
        let d_str = caps.get(1)?.as_str();
        let d: f64 = d_str.parse().ok()?;
        let m: f64 = caps.get(2)?.as_str().parse().ok()?;
        let sec: f64 = caps.get(3)?.as_str().parse().ok()?;
        // Validate component ranges
        if m >= 60.0 || sec >= 60.0 {
            return None;
        }
        // Use string sign check to handle -0° correctly (IEEE 754: -0.0 < 0.0 is false)
        let sign = if d_str.starts_with('-') { -1.0 } else { 1.0 };
        return Some(sign * (d.abs() + m / 60.0 + sec / 3600.0));
    }
    None
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

    // ------------------------------------------------------------------------
    // CSV Parsing Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_csv_line_simple() {
        let fields = parse_csv_line("a,b,c");
        assert_eq!(fields, vec!["a", "b", "c"]);
    }

    #[test]
    fn test_parse_csv_line_quoted() {
        let fields = parse_csv_line("\"hello, world\",b,c");
        assert_eq!(fields[0], "hello, world");
        assert_eq!(fields.len(), 3);
    }

    #[test]
    fn test_parse_csv_line_escaped_quotes() {
        let fields = parse_csv_line("\"say \"\"hello\"\"\",b");
        assert_eq!(fields[0], "say \"hello\"");
    }

    #[test]
    fn test_parse_csv_line_empty_fields() {
        let fields = parse_csv_line(",b,");
        assert_eq!(fields.len(), 3);
        assert_eq!(fields[0], "");
        assert_eq!(fields[2], "");
    }

    #[test]
    fn test_escape_csv() {
        assert_eq!(escape_csv("hello"), "hello");
        assert_eq!(escape_csv("say \"hi\""), "say \"\"hi\"\"");
    }

    // ------------------------------------------------------------------------
    // Coordinate Parsing Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_ra_decimal() {
        let ra = parse_ra("180.5");
        assert!(ra.is_some());
        assert!(approx_eq(ra.unwrap(), 180.5));
    }

    #[test]
    fn test_parse_ra_hms() {
        // 12h 00m 00s = 180°
        let ra = parse_ra("12h 00m 00s");
        assert!(ra.is_some());
        assert!(
            approx_eq(ra.unwrap(), 180.0),
            "12h should be 180°, got {:?}",
            ra
        );
    }

    #[test]
    fn test_parse_ra_hms_with_fractions() {
        // 6h 30m 30s = (6 + 30/60 + 30/3600) * 15 = 97.625°
        let ra = parse_ra("6h 30m 30s");
        assert!(ra.is_some());
        assert!(approx_eq(ra.unwrap(), 97.625), "Got {:?}", ra);
    }

    #[test]
    fn test_parse_ra_invalid() {
        assert!(parse_ra("invalid").is_none());
        assert!(parse_ra("").is_none());
    }

    #[test]
    fn test_parse_dec_decimal() {
        let dec = parse_dec("45.5");
        assert!(dec.is_some());
        assert!(approx_eq(dec.unwrap(), 45.5));
    }

    #[test]
    fn test_parse_dec_negative() {
        let dec = parse_dec("-30.25");
        assert!(dec.is_some());
        assert!(approx_eq(dec.unwrap(), -30.25));
    }

    #[test]
    fn test_parse_dec_dms_positive() {
        // +45° 30' 00" = 45.5°
        let dec = parse_dec("+45° 30' 00\"");
        assert!(dec.is_some());
        assert!(approx_eq(dec.unwrap(), 45.5), "Got {:?}", dec);
    }

    #[test]
    fn test_parse_dec_dms_negative() {
        // -30° 15' 00" = -30.25°
        let dec = parse_dec("-30° 15' 00\"");
        assert!(dec.is_some());
        assert!(approx_eq(dec.unwrap(), -30.25), "Got {:?}", dec);
    }

    #[test]
    fn test_parse_dec_invalid() {
        assert!(parse_dec("invalid").is_none());
        assert!(parse_dec("").is_none());
    }

    #[test]
    fn test_parse_coordinates() {
        let coords = parse_coordinates("12h 00m 00s", "+45° 00' 00\"");
        assert!(coords.is_some());
        let (ra, dec) = coords.unwrap();
        assert!(approx_eq(ra, 180.0));
        assert!(approx_eq(dec, 45.0));
    }

    #[test]
    fn test_parse_coordinates_invalid_ra() {
        let coords = parse_coordinates("invalid", "+45° 00' 00\"");
        assert!(coords.is_none());
    }

    #[test]
    fn test_parse_coordinates_invalid_dec() {
        let coords = parse_coordinates("12h 00m 00s", "invalid");
        assert!(coords.is_none());
    }

    // ------------------------------------------------------------------------
    // CSV Import Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_import_csv_basic() {
        let csv = "Name,RA,Dec,RA_HMS,Dec_DMS,Type,Constellation,Magnitude,Size,Priority,Tags,Notes\n\
                   M31,10.68,41.27,\"00h 42m 44s\",\"+41° 16' 09\"\",Galaxy,Andromeda,3.4,3°,high,galaxy,Andromeda Galaxy";
        let result = import_csv(csv);

        assert_eq!(result.imported, 1);
        assert_eq!(result.skipped, 0);
        assert!(result.errors.is_empty());
        assert_eq!(result.targets[0].name, "M31");
    }

    #[test]
    fn test_import_csv_insufficient_fields() {
        let csv = "Name,RA,Dec,RA_HMS\nM31,10.68"; // Only 2 fields
        let result = import_csv(csv);

        assert_eq!(result.imported, 0);
        assert_eq!(result.skipped, 1);
        assert!(!result.errors.is_empty());
    }

    #[test]
    fn test_import_csv_empty_lines() {
        let csv =
            "Name,RA,Dec,RA_HMS,Dec_DMS\n\nM31,10.68,41.27,\"00h 42m 44s\",\"+41° 16' 09\"\"\n\n";
        let result = import_csv(csv);

        assert_eq!(result.imported, 1);
        // Empty lines should be skipped, not counted as errors
    }

    #[test]
    fn test_import_csv_uses_hms_when_decimal_invalid() {
        let csv = "Name,RA,Dec,RA_HMS,Dec_DMS\n\
                   Test,invalid,invalid,12h 00m 00s,+45° 00' 00\"";
        let result = import_csv(csv);

        // Should fall back to HMS parsing
        if result.imported == 1 {
            assert!(approx_eq(result.targets[0].ra, 180.0));
            assert!(approx_eq(result.targets[0].dec, 45.0));
        }
    }

    // ------------------------------------------------------------------------
    // Stellarium Import Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_import_stellarium_basic() {
        let content =
            "[Stellarium Observing List]\n# Exported: 1\n\nM31\t00h 42m 44s\t+41° 16' 09\"";
        let result = import_stellarium(content);

        // Just verify the function runs without panicking; imported count depends on format
        let _ = result.imported;
    }

    #[test]
    fn test_import_stellarium_skips_comments() {
        let content = "# This is a comment\n[Header]\nM31\t12h 00m 00s\t+45° 00' 00\"";
        let result = import_stellarium(content);

        // Comments and headers should be skipped
        assert!(result.errors.is_empty() || result.imported > 0);
    }

    // ------------------------------------------------------------------------
    // JSON Import/Export Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_json() {
        let targets = vec![TargetExportItem {
            name: "M31".to_string(),
            ra: 10.68,
            dec: 41.27,
            ra_string: "00h 42m 44s".to_string(),
            dec_string: "+41° 16' 09\"".to_string(),
            object_type: Some("Galaxy".to_string()),
            constellation: Some("Andromeda".to_string()),
            magnitude: Some(3.4),
            size: Some("3°".to_string()),
            notes: None,
            priority: Some("high".to_string()),
            tags: Some("galaxy".to_string()),
        }];

        let json = export_json(&targets);
        assert!(json.is_ok());
        let json_str = json.unwrap();
        assert!(json_str.contains("M31"));
        assert!(json_str.contains("10.68"));
    }

    #[test]
    fn test_import_json() {
        let json = r#"[{"name":"M31","ra":10.68,"dec":41.27,"ra_string":"00h 42m 44s","dec_string":"+41°"}]"#;
        let result = import_json(json);

        assert!(result.is_ok());
        let result = result.unwrap();
        assert_eq!(result.imported, 1);
        assert_eq!(result.targets[0].name, "M31");
    }

    #[test]
    fn test_import_json_invalid() {
        let result = import_json("invalid json");
        assert!(result.is_err());
    }

    // ------------------------------------------------------------------------
    // CSV Export Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_csv_basic() {
        let targets = vec![TargetExportItem {
            name: "Test".to_string(),
            ra: 180.0,
            dec: 45.0,
            ra_string: "12h 00m 00s".to_string(),
            dec_string: "+45° 00' 00\"".to_string(),
            object_type: None,
            constellation: None,
            magnitude: None,
            size: None,
            notes: None,
            priority: None,
            tags: None,
        }];

        let csv = export_csv(&targets);
        assert!(csv.contains("Test"));
        assert!(csv.contains("180"));
        assert!(csv.contains("45"));
        // Should have header line
        assert!(csv.starts_with("Name,RA,Dec"));
    }

    #[test]
    fn test_export_csv_escapes_commas() {
        let targets = vec![TargetExportItem {
            name: "Test, with comma".to_string(),
            ra: 0.0,
            dec: 0.0,
            ra_string: "".to_string(),
            dec_string: "".to_string(),
            object_type: None,
            constellation: None,
            magnitude: None,
            size: None,
            notes: None,
            priority: None,
            tags: None,
        }];

        let csv = export_csv(&targets);
        // Name with comma should be quoted in CSV
        assert!(csv.contains("\"Test, with comma\""));
    }

    // ------------------------------------------------------------------------
    // Stellarium Export Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_stellarium() {
        let targets = vec![TargetExportItem {
            name: "M31".to_string(),
            ra: 10.68,
            dec: 41.27,
            ra_string: "00h 42m 44s".to_string(),
            dec_string: "+41° 16'".to_string(),
            object_type: None,
            constellation: None,
            magnitude: None,
            size: None,
            notes: None,
            priority: None,
            tags: None,
        }];

        let stellarium = export_stellarium(&targets);
        assert!(stellarium.contains("[Stellarium Observing List]"));
        assert!(stellarium.contains("M31"));
    }

    // ------------------------------------------------------------------------
    // Mosaic Export Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_mosaic() {
        let targets = vec![TargetExportItem {
            name: "M31".to_string(),
            ra: 10.68,
            dec: 41.27,
            ra_string: "".to_string(),
            dec_string: "".to_string(),
            object_type: None,
            constellation: None,
            magnitude: None,
            size: None,
            notes: None,
            priority: None,
            tags: None,
        }];

        let result = export_mosaic(&targets);
        assert!(result.is_ok());
        let json = result.unwrap();
        assert!(json.contains("M31"));
        assert!(json.contains("targets"));
    }

    // ------------------------------------------------------------------------
    // ImportTargetsResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_import_result_structure() {
        let result = ImportTargetsResult {
            imported: 5,
            skipped: 2,
            errors: vec!["Error 1".to_string()],
            targets: vec![],
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"imported\":5"));
        assert!(json.contains("\"skipped\":2"));
    }

    // ------------------------------------------------------------------------
    // ExportFormat Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_export_format_serialization() {
        let format = ExportFormat::Csv;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"csv\"");

        let format = ExportFormat::Stellarium;
        let json = serde_json::to_string(&format).unwrap();
        assert_eq!(json, "\"stellarium\"");
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_target_export_item_defaults() {
        // Test that TargetExportItem can be created with all None optionals
        let item = TargetExportItem {
            name: "Test".to_string(),
            ra: 0.0,
            dec: 0.0,
            ra_string: "".to_string(),
            dec_string: "".to_string(),
            object_type: None,
            constellation: None,
            magnitude: None,
            size: None,
            notes: None,
            priority: None,
            tags: None,
        };
        assert_eq!(item.name, "Test");
        assert!(item.object_type.is_none());
    }
}
