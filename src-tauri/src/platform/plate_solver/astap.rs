//! ASTAP plate solver integration (desktop).
//! Detection on well-known install paths, version probing, image analysis.
//! The platform-agnostic solve/parse/database core lives in `crate::solver_core::astap`.

use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::solver_core::astap::{
    get_astap_db_scale_range, is_astap_database_dir, is_astap_database_file, list_astap_databases,
    run_astap_solve, AstapInvocation,
};
use super::helpers::{
    command_succeeds, get_default_index_path_internal, resolve_preferred_executable,
};
use super::types::{
    AstapDatabaseInfo, AstrometryIndex, ImageAnalysisResult, IndexInfo, LocalSolverProfileId,
    PlateSolveResult, PlateSolverConfig, PlateSolverError, PlateSolverType, ScaleRange,
    SolverConfig, SolverInfo, StarDetection,
};
use super::ACTIVE_SOLVE_PID;

// Re-export the shared download command so existing `platform::plate_solver`
// re-exports (and lib.rs registration) keep working unchanged on desktop.
pub use crate::solver_core::astap::download_astap_database;

pub(super) async fn solve_with_astap(
    config: &PlateSolverConfig,
) -> Result<PlateSolveResult, PlateSolverError> {
    solve_with_astap_enhanced(config, None).await
}

pub(super) async fn solve_with_astap_enhanced(
    config: &PlateSolverConfig,
    solver_config: Option<&SolverConfig>,
) -> Result<PlateSolveResult, PlateSolverError> {
    let preferred_executable = solver_config.and_then(|sc| sc.executable_path.as_deref());
    let preferred_index_path = solver_config.and_then(|sc| sc.index_path.as_deref());
    let astap = detect_astap_solver(preferred_executable, preferred_index_path)
        .ok_or(PlateSolverError::SolverNotInstalled("ASTAP".to_string()))?;

    let invocation = AstapInvocation {
        executable_path: astap.executable_path.clone(),
        profile_id: astap.profile_id,
        availability_reason: astap.availability_reason.clone(),
    };
    run_astap_solve(&invocation, config, solver_config, &ACTIVE_SOLVE_PID).await
}

pub fn validate_astap_executable(path: &str) -> Option<LocalSolverProfileId> {
    let lower = path.to_ascii_lowercase();
    let profile_id = if lower.contains("astap_cli") {
        LocalSolverProfileId::AstapCli
    } else if lower.contains("astap") {
        LocalSolverProfileId::AstapGui
    } else {
        return None;
    };

    (command_succeeds(path, &["-v"]) || command_succeeds(path, &["-h"])).then_some(profile_id)
}

pub fn detect_astap_solver(
    preferred_executable: Option<&str>,
    preferred_index_path: Option<&str>,
) -> Option<SolverInfo> {
    let executable_path = resolve_preferred_executable(preferred_executable, &get_astap_paths())?;
    let profile_id = validate_astap_executable(&executable_path)?;
    let uses_custom_executable =
        preferred_executable.is_some_and(|path| !path.trim().is_empty() && path == executable_path);
    let index_path = preferred_index_path
        .filter(|path| !path.trim().is_empty())
        .map(|path| path.to_string())
        .or_else(|| get_astap_index_path(&executable_path).filter(|p| PathBuf::from(p).is_dir()))
        .or_else(get_bundled_astap_data_dir)
        .or_else(|| get_default_index_path_internal("astap"));
    let installed_indexes =
        to_index_info(&get_astap_indexes_from_path(index_path.as_deref()).ok()?);
    let is_available = !installed_indexes.is_empty();

    Some(SolverInfo {
        solver_type: PlateSolverType::Astap,
        name: "ASTAP".to_string(),
        version: get_astap_version(&executable_path),
        executable_path,
        is_available,
        index_path,
        installed_indexes,
        profile_id: Some(profile_id),
        profile_name: Some(profile_id.display_name().to_string()),
        availability_reason: (!is_available).then(|| "No ASTAP database found".to_string()),
        uses_custom_executable,
    })
}

// ============================================================================
// ASTAP Path and Version Helpers
// ============================================================================

/// Directory of the star databases bundled via `bundle.resources`
/// (`resources/astap_data` -> `astap_data`). Resolved relative to the
/// executable so it works without an AppHandle:
/// - Windows installers place resources next to the exe -> `<exe_dir>/astap_data`
/// - macOS bundles -> `<exe_dir>/../Resources/astap_data`
/// - Linux deb/rpm/AppImage -> `<exe_dir>/../lib/<binary-name>/astap_data`
/// - `tauri dev` -> `src-tauri/resources/astap_data` via CARGO_MANIFEST_DIR
pub fn get_bundled_astap_data_dir() -> Option<String> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?.to_path_buf();
    let mut candidates = vec![
        exe_dir.join("astap_data"),
        exe_dir.join("../Resources/astap_data"),
    ];
    if let Some(stem) = exe.file_stem() {
        candidates.push(exe_dir.join("../lib").join(stem).join("astap_data"));
    }
    #[cfg(debug_assertions)]
    candidates.push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/astap_data"));
    candidates
        .into_iter()
        .find(|dir| dir.is_dir())
        .map(|dir| dir.to_string_lossy().to_string())
}

/// Path of the astap_cli sidecar bundled via `bundle.externalBin`.
/// Tauri places sidecars next to the main executable on every desktop platform
/// (and next to target/{debug,release} binaries during `tauri dev`).
pub fn get_bundled_astap_cli_path() -> Option<String> {
    let exe_dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    let name = if cfg!(windows) { "astap_cli.exe" } else { "astap_cli" };
    let candidate = exe_dir.join(name);
    candidate
        .exists()
        .then(|| candidate.to_string_lossy().to_string())
}

pub fn get_astap_paths() -> Vec<String> {
    let mut paths = get_astap_paths_system();
    // Bundled sidecar: preferred over bare PATH lookups but after explicit
    // system installs, so a user's full ASTAP install (with its databases)
    // keeps winning.
    if let Some(bundled) = get_bundled_astap_cli_path() {
        let bare_start = paths
            .iter()
            .position(|p| !p.contains('/') && !p.contains('\\'))
            .unwrap_or(paths.len());
        paths.insert(bare_start, bundled);
    }
    paths
}

fn get_astap_paths_system() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            r"C:\Program Files\astap\astap.exe".to_string(),
            r"C:\Program Files\astap\astap_cli.exe".to_string(),
            r"C:\Program Files (x86)\astap\astap.exe".to_string(),
            r"C:\Program Files (x86)\astap\astap_cli.exe".to_string(),
            "astap.exe".to_string(),
            "astap_cli.exe".to_string(),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        vec![
            "/Applications/ASTAP.app/Contents/MacOS/astap".to_string(),
            "/usr/local/bin/astap".to_string(),
            "/opt/homebrew/bin/astap".to_string(),
            "/usr/local/bin/astap_cli".to_string(),
            "astap".to_string(),
            "astap_cli".to_string(),
        ]
    }
    #[cfg(target_os = "linux")]
    {
        vec![
            "/usr/bin/astap".to_string(),
            "/usr/local/bin/astap".to_string(),
            "/usr/bin/astap_cli".to_string(),
            "/usr/local/bin/astap_cli".to_string(),
            "astap".to_string(),
            "astap_cli".to_string(),
        ]
    }
}

pub fn get_astap_version(path: &str) -> Option<String> {
    Command::new(path)
        .arg("-v")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
}

pub fn get_astap_index_path(astap_path: &str) -> Option<String> {
    PathBuf::from(astap_path)
        .parent()
        .map(|p| p.join("data").to_string_lossy().to_string())
}

// ============================================================================
// ASTAP Index / Database Helpers
// ============================================================================

pub fn get_astap_indexes() -> Result<Vec<AstrometryIndex>, PlateSolverError> {
    get_astap_indexes_from_path(None)
}

pub fn get_astap_indexes_from_path(
    index_path: Option<&str>,
) -> Result<Vec<AstrometryIndex>, PlateSolverError> {
    let data_path = index_path
        .map(|path| path.to_string())
        .or_else(|| get_default_index_path_internal("astap"));
    if let Some(path_str) = data_path {
        let path = PathBuf::from(&path_str);
        if path.exists() && path.is_dir() {
            let mut indexes = Vec::new();
            if let Ok(entries) = fs::read_dir(&path) {
                for entry in entries.flatten() {
                    let entry_path = entry.path();
                    let name = entry_path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_lowercase())
                        .unwrap_or_default();
                    // ASTAP databases are directories or .1476 files matching d80/d50/d20/d05/g05/w08/v17/h17/h18/t2
                    if is_astap_database_file(&name)
                        || (entry_path.is_dir() && is_astap_database_dir(&name))
                    {
                        let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                        let (scale_low, scale_high) = get_astap_db_scale_range(&name);
                        indexes.push(AstrometryIndex {
                            name: name.clone(),
                            path: entry_path.to_string_lossy().to_string(),
                            scale_low,
                            scale_high,
                            size_mb: size / (1024 * 1024),
                        });
                    }
                }
            }
            return Ok(indexes);
        }
    }
    Ok(Vec::new())
}

fn to_index_info(indexes: &[AstrometryIndex]) -> Vec<IndexInfo> {
    indexes
        .iter()
        .map(|index| IndexInfo {
            name: index.name.clone(),
            file_name: PathBuf::from(&index.path)
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
                .unwrap_or_else(|| index.name.clone()),
            path: index.path.clone(),
            size_bytes: index.size_mb * 1024 * 1024,
            scale_range: Some(ScaleRange {
                min_arcmin: index.scale_low * 60.0,
                max_arcmin: index.scale_high * 60.0,
            }),
            description: None,
        })
        .collect()
}

// ============================================================================
// ASTAP Database Management Commands
// ============================================================================

#[tauri::command]
pub async fn get_astap_databases() -> Result<Vec<AstapDatabaseInfo>, PlateSolverError> {
    // Scan both the bundled resource dir (ships W08) and the system default.
    let scan_dirs: Vec<String> = [
        get_bundled_astap_data_dir(),
        get_default_index_path_internal("astap"),
    ]
    .into_iter()
    .flatten()
    .collect();

    Ok(list_astap_databases(&scan_dirs))
}

#[tauri::command]
pub async fn recommend_astap_database(
    fov_degrees: f64,
) -> Result<Vec<AstapDatabaseInfo>, PlateSolverError> {
    let all = get_astap_databases().await?;
    Ok(all
        .into_iter()
        .filter(|db| fov_degrees >= db.fov_min_deg && fov_degrees <= db.fov_max_deg)
        .collect())
}

// ============================================================================
// Image Analysis (ASTAP)
// ============================================================================

#[tauri::command]
pub async fn analyse_image(
    image_path: String,
    snr_minimum: Option<f64>,
) -> Result<ImageAnalysisResult, PlateSolverError> {
    if !PathBuf::from(&image_path).exists() {
        return Err(PlateSolverError::InvalidImage(format!(
            "Image not found: {}",
            image_path
        )));
    }

    let astap = detect_astap_solver(None, None)
        .ok_or(PlateSolverError::SolverNotInstalled("ASTAP".to_string()))?;

    let astap_path = astap.executable_path.clone();
    let snr = snr_minimum.unwrap_or(10.0);
    let img_path = image_path.clone();

    let output = tokio::task::spawn_blocking(move || {
        Command::new(&astap_path)
            .arg("-f")
            .arg(&img_path)
            .arg("-analyse")
            .arg(format!("{}", snr))
            .output()
    })
    .await
    .map_err(|e| PlateSolverError::SolveFailed(format!("Task join error: {}", e)))?
    .map_err(PlateSolverError::Io)?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    // Parse ASTAP analyse output
    let mut median_hfd = None;
    let mut star_count = 0u32;
    let mut background = None;

    for line in stdout.lines() {
        let trimmed = line.trim().to_lowercase();
        if trimmed.contains("hfd") {
            // Try to extract HFD value
            if let Some(val) = extract_float_after(&trimmed, "hfd") {
                median_hfd = Some(val);
            }
        }
        if trimmed.contains("stars") || trimmed.contains("star count") {
            if let Some(val) = extract_int_after(&trimmed, "star") {
                star_count = val;
            }
        }
        if trimmed.contains("background") {
            if let Some(val) = extract_float_after(&trimmed, "background") {
                background = Some(val);
            }
        }
    }

    // On Windows, ASTAP returns info via errorlevel: HFD*100M + star_count
    #[cfg(target_os = "windows")]
    if let Some(code) = output.status.code() {
        if code > 0 {
            let code_u64 = code as u64;
            let hfd_raw = code_u64 / 1_000_000;
            let stars_raw = code_u64 % 1_000_000;
            if median_hfd.is_none() && hfd_raw > 0 {
                median_hfd = Some(hfd_raw as f64 / 100.0);
            }
            if star_count == 0 && stars_raw > 0 {
                star_count = stars_raw as u32;
            }
        }
    }

    Ok(ImageAnalysisResult {
        success: median_hfd.is_some() || star_count > 0,
        median_hfd,
        star_count,
        background,
        noise: None,
        stars: Vec::new(),
        error_message: if median_hfd.is_none() && star_count == 0 {
            Some("Could not parse analysis output".to_string())
        } else {
            None
        },
    })
}

#[tauri::command]
pub async fn extract_stars(
    image_path: String,
    snr_minimum: Option<f64>,
    include_coordinates: bool,
) -> Result<ImageAnalysisResult, PlateSolverError> {
    if !PathBuf::from(&image_path).exists() {
        return Err(PlateSolverError::InvalidImage(format!(
            "Image not found: {}",
            image_path
        )));
    }

    let astap = detect_astap_solver(None, None)
        .ok_or(PlateSolverError::SolverNotInstalled("ASTAP".to_string()))?;

    let astap_path = astap.executable_path.clone();
    let snr = snr_minimum.unwrap_or(10.0);
    let img_path = image_path.clone();
    let extract_flag = if include_coordinates {
        "-extract2"
    } else {
        "-extract"
    };

    let output = tokio::task::spawn_blocking(move || {
        Command::new(&astap_path)
            .arg("-f")
            .arg(&img_path)
            .arg(extract_flag)
            .arg(format!("{}", snr))
            .output()
    })
    .await
    .map_err(|e| PlateSolverError::SolveFailed(format!("Task join error: {}", e)))?
    .map_err(PlateSolverError::Io)?;

    // Parse the CSV output file
    let csv_path = PathBuf::from(&image_path).with_extension("csv");
    let mut stars = Vec::new();

    if csv_path.exists() {
        if let Ok(csv_content) = fs::read_to_string(&csv_path) {
            for (i, line) in csv_content.lines().enumerate() {
                if i == 0 {
                    continue;
                } // skip header
                let fields: Vec<&str> = line.split(',').collect();
                if fields.len() >= 5 {
                    let x = fields[0].trim().parse::<f64>().unwrap_or(0.0);
                    let y = fields[1].trim().parse::<f64>().unwrap_or(0.0);
                    let hfd = fields[2].trim().parse::<f64>().unwrap_or(0.0);
                    let flux = fields[3].trim().parse::<f64>().unwrap_or(0.0);
                    let snr_val = fields[4].trim().parse::<f64>().unwrap_or(0.0);

                    let (ra, dec) = if include_coordinates && fields.len() >= 7 {
                        (
                            fields[5].trim().parse::<f64>().ok(),
                            fields[6].trim().parse::<f64>().ok(),
                        )
                    } else {
                        (None, None)
                    };

                    stars.push(StarDetection {
                        x,
                        y,
                        hfd,
                        flux,
                        snr: snr_val,
                        ra,
                        dec,
                        magnitude: None,
                    });
                }
            }
        }
    }

    // Calculate median HFD
    let median_hfd = if !stars.is_empty() {
        let mut hfds: Vec<f64> = stars.iter().map(|s| s.hfd).collect();
        hfds.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
        Some(hfds[hfds.len() / 2])
    } else {
        None
    };

    let star_count = stars.len() as u32;

    Ok(ImageAnalysisResult {
        success: !stars.is_empty(),
        median_hfd,
        star_count,
        background: None,
        noise: None,
        stars,
        error_message: if star_count == 0 {
            Some(String::from_utf8_lossy(&output.stderr).to_string())
        } else {
            None
        },
    })
}

fn extract_float_after(text: &str, keyword: &str) -> Option<f64> {
    if let Some(pos) = text.find(keyword) {
        let after = &text[pos + keyword.len()..];
        for word in after.split_whitespace() {
            let cleaned: String = word
                .chars()
                .filter(|c| c.is_ascii_digit() || *c == '.' || *c == '-')
                .collect();
            if let Ok(v) = cleaned.parse::<f64>() {
                return Some(v);
            }
        }
    }
    None
}

fn extract_int_after(text: &str, keyword: &str) -> Option<u32> {
    if let Some(pos) = text.find(keyword) {
        let after = &text[pos + keyword.len()..];
        for word in after.split_whitespace() {
            let cleaned: String = word.chars().filter(|c| c.is_ascii_digit()).collect();
            if let Ok(v) = cleaned.parse::<u32>() {
                return Some(v);
            }
        }
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
    // Path Helper Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_astap_paths() {
        let paths = get_astap_paths();
        assert!(!paths.is_empty());
        for path in &paths {
            assert!(path.contains("astap"));
        }
    }

    #[test]
    fn test_get_astap_paths_include_cli_variant() {
        let paths = get_astap_paths();
        assert!(paths
            .iter()
            .any(|path| path.to_ascii_lowercase().contains("astap_cli")));
    }

    #[test]
    fn test_get_astap_index_path() {
        #[cfg(target_os = "windows")]
        {
            let path = get_astap_index_path(r"C:\Program Files\astap\astap.exe");
            assert!(path.is_some());
            assert!(path.unwrap().contains("data"));
        }
        #[cfg(not(target_os = "windows"))]
        {
            let path = get_astap_index_path("/usr/bin/astap");
            assert!(path.is_some());
            assert!(path.unwrap().contains("data"));
        }
    }

    #[tokio::test]
    async fn test_astap_databases_desktop_command_returns_catalog() {
        let dbs = get_astap_databases().await.unwrap();
        assert!(dbs.iter().any(|d| d.abbreviation == "w08"));
        assert!(dbs.iter().any(|d| d.abbreviation == "d50"));
        assert!(approx_eq(
            dbs.iter().find(|d| d.abbreviation == "w08").unwrap().fov_min_deg,
            20.0
        ));
    }
}
