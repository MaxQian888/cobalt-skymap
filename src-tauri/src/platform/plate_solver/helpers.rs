//! Shared utility functions: path detection, coordinate formatting, solver validation.

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::AppHandle;

use super::types::{PlateSolverError, SolverInfo};
use super::{astap, astrometry};

// Workspace + formatting helpers moved to the platform-agnostic core;
// re-exported here so existing `helpers::` call sites keep working.
pub use crate::solver_core::workspace::{
    cleanup_local_solve_workspace, create_local_solve_workspace, excerpt_output, format_dec_dms,
    format_ra_hms,
};

/// Get default index path for a given solver type (platform-specific)
pub fn get_default_index_path_internal(solver_type: &str) -> Option<String> {
    match solver_type.to_lowercase().as_str() {
        "astap" => {
            #[cfg(target_os = "windows")]
            {
                Some(r"C:\Program Files\astap\data".to_string())
            }
            #[cfg(target_os = "macos")]
            {
                Some("/Applications/ASTAP.app/Contents/Resources/data".to_string())
            }
            #[cfg(target_os = "linux")]
            {
                Some("/usr/share/astap/data".to_string())
            }
        }
        "astrometry_net" | "astrometry" | "localastrometry" => {
            #[cfg(target_os = "windows")]
            {
                Some(r"C:\cygwin64\usr\share\astrometry".to_string())
            }
            #[cfg(any(target_os = "macos", target_os = "linux"))]
            {
                Some("/usr/share/astrometry".to_string())
            }
        }
        _ => None,
    }
}

#[tauri::command]
pub async fn get_default_index_path(
    solver_type: String,
) -> Result<Option<String>, PlateSolverError> {
    Ok(get_default_index_path_internal(&solver_type))
}

#[tauri::command]
pub async fn get_solver_info(
    app: AppHandle,
    solver_type: String,
) -> Result<SolverInfo, PlateSolverError> {
    let solvers = super::detect_plate_solvers(app).await?;
    solvers
        .into_iter()
        .find(|s| {
            serde_json::to_string(&s.solver_type)
                .ok()
                .map(|value| value.trim_matches('"').eq_ignore_ascii_case(&solver_type))
                .unwrap_or(false)
                || s.name.to_lowercase().contains(&solver_type.to_lowercase())
        })
        .ok_or(PlateSolverError::SolverNotInstalled(solver_type))
}

#[tauri::command]
pub async fn validate_solver_path(
    solver_type: String,
    path: String,
) -> Result<bool, PlateSolverError> {
    let resolved = resolve_executable_path(&path).unwrap_or(path);
    Ok(match solver_type.to_lowercase().as_str() {
        "astap" => astap::validate_astap_executable(&resolved).is_some(),
        "astrometry_net" | "astrometry" => {
            astrometry::validate_astrometry_executable(&resolved).is_some()
        }
        _ => false,
    })
}

pub fn resolve_executable_path(candidate: &str) -> Option<String> {
    if candidate.trim().is_empty() {
        return None;
    }

    let path = PathBuf::from(candidate);
    if path.is_absolute()
        || candidate.contains(std::path::MAIN_SEPARATOR)
        || candidate.contains('/')
        || candidate.contains('\\')
    {
        return path.exists().then(|| path.to_string_lossy().to_string());
    }

    std::env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| std::env::split_paths(&paths).collect::<Vec<_>>())
        .map(|entry| entry.join(candidate))
        .find(|entry| entry.exists())
        .map(|entry| entry.to_string_lossy().to_string())
}

pub fn resolve_preferred_executable(
    preferred: Option<&str>,
    candidates: &[String],
) -> Option<String> {
    preferred.and_then(resolve_executable_path).or_else(|| {
        candidates
            .iter()
            .find_map(|candidate| resolve_executable_path(candidate))
    })
}

pub fn command_succeeds(path: &str, args: &[&str]) -> bool {
    if !Path::new(path).exists() {
        return false;
    }

    Command::new(path)
        .args(args)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // Coordinate Formatting Tests (via solver_core::workspace re-exports)
    // ------------------------------------------------------------------------

    #[test]
    fn test_format_ra_hms_zero() {
        let result = format_ra_hms(0.0);
        assert!(
            result.starts_with("00h 00m"),
            "0° should be 00h 00m, got {}",
            result
        );
    }

    #[test]
    fn test_format_ra_hms_180() {
        let result = format_ra_hms(180.0);
        assert!(
            result.starts_with("12h 00m"),
            "180° should be 12h 00m, got {}",
            result
        );
    }

    #[test]
    fn test_format_ra_hms_90() {
        let result = format_ra_hms(90.0);
        assert!(
            result.starts_with("06h 00m"),
            "90° should be 06h 00m, got {}",
            result
        );
    }

    #[test]
    fn test_format_ra_hms_with_minutes() {
        // 97.5° = 6.5h = 6h 30m
        let result = format_ra_hms(97.5);
        assert!(
            result.starts_with("06h 30m"),
            "97.5° should be 06h 30m, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_zero() {
        let result = format_dec_dms(0.0);
        assert!(
            result.starts_with("+0°"),
            "0° should start with +0°, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_positive() {
        let result = format_dec_dms(45.0);
        assert!(
            result.starts_with("+45°"),
            "45° should start with +45°, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_negative() {
        let result = format_dec_dms(-45.0);
        assert!(
            result.starts_with("-45°"),
            "-45° should start with -45°, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_with_minutes() {
        // 45.5° = 45° 30'
        let result = format_dec_dms(45.5);
        assert!(
            result.contains("30'"),
            "45.5° should have 30', got {}",
            result
        );
    }

    // ------------------------------------------------------------------------
    // Default Index Path Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_default_index_path_internal_astap() {
        let path = get_default_index_path_internal("astap");
        assert!(path.is_some());
        // Path should contain "astap" or "ASTAP"
        let path_str = path.unwrap().to_lowercase();
        assert!(path_str.contains("astap") || path_str.contains("data"));
    }

    #[test]
    fn test_get_default_index_path_internal_astrometry() {
        let path = get_default_index_path_internal("astrometry_net");
        assert!(path.is_some());
        let path_str = path.unwrap().to_lowercase();
        assert!(path_str.contains("astrometry"));
    }

    #[test]
    fn test_get_default_index_path_internal_unknown() {
        let path = get_default_index_path_internal("unknown_solver");
        assert!(path.is_none());
    }

    #[test]
    fn test_get_default_index_path_internal_case_insensitive() {
        assert!(get_default_index_path_internal("ASTAP").is_some());
        assert!(get_default_index_path_internal("Astap").is_some());
        assert!(get_default_index_path_internal("ASTROMETRY_NET").is_some());
    }

    #[test]
    fn test_get_default_index_path_internal_localastrometry_alias() {
        assert!(get_default_index_path_internal("localastrometry").is_some());
        assert!(get_default_index_path_internal("astrometry").is_some());
    }

    // ------------------------------------------------------------------------
    // Coordinate Formatting Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_format_ra_hms_full_circle() {
        // 360° = 24h = wraps to 24h 00m (edge case)
        let result = format_ra_hms(360.0);
        assert!(
            result.starts_with("24h 00m"),
            "360° should be 24h 00m, got {}",
            result
        );
    }

    #[test]
    fn test_format_ra_hms_with_seconds() {
        // 15.5° = 1.0333h = 1h 02m 00s
        let result = format_ra_hms(15.5);
        assert!(
            result.starts_with("01h 02m"),
            "15.5° should be 01h 02m, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_max() {
        let result = format_dec_dms(90.0);
        assert!(
            result.starts_with("+90°"),
            "90° should start with +90°, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_min() {
        let result = format_dec_dms(-90.0);
        assert!(
            result.starts_with("-90°"),
            "-90° should start with -90°, got {}",
            result
        );
    }

    #[test]
    fn test_format_dec_dms_with_seconds() {
        // 45.5125° = 45° 30' 45"
        let result = format_dec_dms(45.5125);
        assert!(
            result.contains("30'"),
            "45.5125° should have 30', got {}",
            result
        );
        assert!(
            result.contains("45"),
            "45.5125° should have 45\", got {}",
            result
        );
    }
}
