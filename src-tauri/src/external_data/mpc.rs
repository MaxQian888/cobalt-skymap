//! Minor Planet Center orbital-element refresh.
//!
//! Downloads the latest comet (CometEls.txt) and asteroid (MPCORB.DAT.gz)
//! orbital elements, filters asteroids to a bright subset by absolute magnitude
//! H (the full MPCORB is >100 MB and would bog down rendering), and writes the
//! results to an app-data override directory that the Stellarium loader points
//! `core.comets` / `core.minor_planets` at via the Tauri asset protocol.

use std::fs;
use std::io::Read;
use std::path::PathBuf;

use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::ExternalDataError;
use crate::network::{http_client, security};

const COMET_URL: &str = "https://www.minorplanetcenter.net/iau/MPCORB/CometEls.txt";
const MPCORB_GZ_URL: &str = "https://www.minorplanetcenter.net/iau/MPCORB/MPCORB.DAT.gz";

const ALLOWED_HOSTS: &[&str] = &[
    "www.minorplanetcenter.net",
    "minorplanetcenter.net",
    "data.minorplanetcenter.net",
];

/// Default absolute-magnitude cutoff for the asteroid subset (~a few thousand).
const DEFAULT_MAX_H: f64 = 12.0;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MpcDataset {
    Comets,
    Asteroids,
}

#[derive(Debug, Clone, Serialize)]
pub struct OrbitalDataInfo {
    pub dataset: MpcDataset,
    /// Absolute path to the written override file.
    pub path: String,
    /// Number of data records written (asteroids kept after H filtering).
    pub count: u64,
    pub size_bytes: u64,
    /// Unix milliseconds when the refresh completed.
    pub fetched_at: i64,
}

/// Parse the MPCORB absolute magnitude H (1-indexed columns 9–13) from a line.
fn parse_h(line: &str) -> Option<f64> {
    if line.len() < 13 {
        return None;
    }
    let field = line.get(8..13)?.trim();
    if field.is_empty() {
        return None;
    }
    field.parse::<f64>().ok()
}

/// Keep MPCORB header/non-data lines verbatim and data lines with `H <= max_h`.
/// Returns the filtered content and the number of data records kept.
pub fn filter_mpcorb_by_h(content: &str, max_h: f64) -> (String, u64) {
    let mut out = String::with_capacity(content.len() / 4);
    let mut count: u64 = 0;
    for line in content.lines() {
        match parse_h(line) {
            Some(h) => {
                if h <= max_h {
                    out.push_str(line);
                    out.push('\n');
                    count += 1;
                }
            }
            None => {
                out.push_str(line);
                out.push('\n');
            }
        }
    }
    (out, count)
}

fn override_dir(app: &AppHandle) -> Result<PathBuf, ExternalDataError> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|_| ExternalDataError::Io("app data dir not found".into()))?;
    let dir = base.join("skymap").join("stellarium-override");
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

fn override_file_name(dataset: MpcDataset) -> &'static str {
    match dataset {
        MpcDataset::Comets => "CometEls.txt",
        MpcDataset::Asteroids => "mpcorb.dat",
    }
}

async fn download(app: &AppHandle, url: &str) -> Result<Vec<u8>, ExternalDataError> {
    security::validate_url(url, false, Some(ALLOWED_HOSTS))
        .map_err(|e| ExternalDataError::Security(e.to_string()))?;

    let response = http_client::http_request(
        app.clone(),
        http_client::RequestConfig {
            method: "GET".to_string(),
            url: url.to_string(),
            report_progress: true,
            request_id: Some(format!("mpc-{url}")),
            ..Default::default()
        },
    )
    .await
    .map_err(|e| ExternalDataError::Http(e.to_string()))?;

    if response.status < 200 || response.status >= 300 {
        return Err(ExternalDataError::Http(format!("status {}", response.status)));
    }
    Ok(response.body)
}

fn gunzip(bytes: &[u8]) -> Result<String, ExternalDataError> {
    let mut decoder = GzDecoder::new(bytes);
    let mut text = String::new();
    decoder
        .read_to_string(&mut text)
        .map_err(|e| ExternalDataError::Decode(e.to_string()))?;
    Ok(text)
}

/// Refresh comet or asteroid orbital elements into the Stellarium override dir.
#[tauri::command]
pub async fn refresh_orbital_data(
    app: AppHandle,
    dataset: MpcDataset,
    max_h: Option<f64>,
) -> Result<OrbitalDataInfo, ExternalDataError> {
    let dir = override_dir(&app)?;
    let path = dir.join(override_file_name(dataset));

    let (bytes, count): (Vec<u8>, u64) = match dataset {
        MpcDataset::Comets => {
            let raw = download(&app, COMET_URL).await?;
            // Count non-empty data lines for reporting.
            let text = String::from_utf8_lossy(&raw);
            let n = text.lines().filter(|l| !l.trim().is_empty()).count() as u64;
            (raw, n)
        }
        MpcDataset::Asteroids => {
            let gz = download(&app, MPCORB_GZ_URL).await?;
            let full = gunzip(&gz)?;
            let (filtered, n) = filter_mpcorb_by_h(&full, max_h.unwrap_or(DEFAULT_MAX_H));
            (filtered.into_bytes(), n)
        }
    };

    fs::write(&path, &bytes)?;

    Ok(OrbitalDataInfo {
        dataset,
        path: path.to_string_lossy().to_string(),
        count,
        size_bytes: bytes.len() as u64,
        fetched_at: chrono::Utc::now().timestamp_millis(),
    })
}

/// Return the override file path for a dataset if it has been refreshed, so the
/// Stellarium loader can prefer it over the bundled vendored file.
#[tauri::command]
pub fn get_orbital_override_path(
    app: AppHandle,
    dataset: MpcDataset,
) -> Result<Option<String>, ExternalDataError> {
    let path = override_dir(&app)?.join(override_file_name(dataset));
    if path.exists() {
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // H column is 1-indexed cols 9-13 == 0-indexed bytes [8..13].
    // desig(7) + blank(1) + H(5) + tail.
    fn line(desig7: &str, h5: &str, tail: &str) -> String {
        format!("{desig7} {h5}{tail}")
    }

    #[test]
    fn keeps_bright_drops_faint_and_preserves_header() {
        let bright = line("0000001", " 3.34", "  0.12  Ceres");
        let faint = line("0099999", "18.50", "  0.15  FaintRock");
        let content = format!("MPC Orbit Database\n----------\n{bright}\n{faint}\n");

        let (out, count) = filter_mpcorb_by_h(&content, 12.0);

        assert!(out.contains("Ceres"), "bright asteroid kept");
        assert!(!out.contains("FaintRock"), "faint asteroid dropped");
        assert!(out.contains("MPC Orbit Database"), "header preserved");
        assert!(out.contains("----------"), "separator preserved");
        assert_eq!(count, 1);
    }

    #[test]
    fn keeps_data_lines_without_parseable_magnitude() {
        // A short/blank-H line is treated as non-data and preserved.
        let content = "short line\n";
        let (out, count) = filter_mpcorb_by_h(content, 12.0);
        assert_eq!(out, "short line\n");
        assert_eq!(count, 0);
    }

    #[test]
    fn h_at_cutoff_is_kept() {
        let at = line("0000002", "12.00", "  tail");
        let (out, count) = filter_mpcorb_by_h(&format!("{at}\n"), 12.0);
        assert!(out.contains("tail"));
        assert_eq!(count, 1);
    }
}
