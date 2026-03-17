//! Local Astrometry.net plate solver integration.
//! Handles solving, result parsing, path detection, and index scanning.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::fits::{parse_fits_header_from_bytes, parse_value};
use super::helpers::{
    cleanup_local_solve_workspace, command_succeeds, create_local_solve_workspace, excerpt_output,
    get_default_index_path_internal, resolve_preferred_executable,
};
use super::index::parse_index_scale;
use super::types::{
    AstrometryIndex, IndexInfo, LocalInvocationDiagnostics, LocalSolveWorkspace,
    LocalSolverProfileId, PlateSolveResult, PlateSolverConfig, PlateSolverError, PlateSolverType,
    ScaleRange, SolverConfig, SolverInfo,
};

pub(super) async fn solve_with_local_astrometry(
    config: &PlateSolverConfig,
    solver_config: Option<&SolverConfig>,
) -> Result<PlateSolveResult, PlateSolverError> {
    let preferred_executable = solver_config.and_then(|sc| sc.executable_path.as_deref());
    let preferred_index_path = solver_config.and_then(|sc| sc.index_path.as_deref());
    let astrometry = detect_astrometry_solver(preferred_executable, preferred_index_path).ok_or(
        PlateSolverError::SolverNotInstalled("Astrometry.net".to_string()),
    )?;
    let workspace = create_local_solve_workspace("astrometry")?;
    let keep_wcs_file = solver_config.map(|sc| sc.keep_wcs_file).unwrap_or(true);

    let mut cmd = Command::new(&astrometry.executable_path);
    if let Some(config_ref) = solver_config {
        cmd.args(build_astrometry_command_args(
            config, config_ref, &workspace,
        ));
    } else {
        let fallback = SolverConfig::default();
        cmd.args(build_astrometry_command_args(config, &fallback, &workspace));
    }

    let timeout_secs = config.timeout_seconds.unwrap_or(120);
    let executable_path = astrometry.executable_path.clone();
    let workspace_path = workspace.root_dir.to_string_lossy().to_string();
    let profile_id = astrometry.profile_id;

    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs as u64),
        tokio::task::spawn_blocking(move || cmd.output()),
    )
    .await
    .map_err(|_| {
        PlateSolverError::LocalInvocation(Box::new(LocalInvocationDiagnostics {
            error_code: "timeout".to_string(),
            profile_id,
            executable_path: Some(executable_path.clone()),
            workspace_path: Some(workspace_path.clone()),
            exit_code: None,
            availability_reason: astrometry.availability_reason.clone(),
            stdout_excerpt: None,
            stderr_excerpt: None,
        }))
    })?
    .map_err(|e| PlateSolverError::SolveFailed(format!("Task join error: {}", e)))?
    .map_err(PlateSolverError::Io)?;

    if output.status.success() {
        let mut result = parse_astrometry_result(&workspace.wcs_file)?;
        result.wcs_file = keep_wcs_file.then(|| workspace.wcs_file.to_string_lossy().to_string());
        if !keep_wcs_file {
            cleanup_local_solve_workspace(&workspace);
        }
        Ok(result)
    } else {
        Err(PlateSolverError::LocalInvocation(Box::new(
            LocalInvocationDiagnostics {
                error_code: "nonzero_exit".to_string(),
                profile_id,
                executable_path: Some(astrometry.executable_path.clone()),
                workspace_path: Some(workspace.root_dir.to_string_lossy().to_string()),
                exit_code: output.status.code(),
                availability_reason: astrometry.availability_reason.clone(),
                stdout_excerpt: excerpt_output(&output.stdout),
                stderr_excerpt: excerpt_output(&output.stderr),
            },
        )))
    }
}

fn parse_astrometry_result(wcs_path: &Path) -> Result<PlateSolveResult, PlateSolverError> {
    if !wcs_path.exists() {
        return Err(PlateSolverError::LocalInvocation(Box::new(
            LocalInvocationDiagnostics {
                error_code: "result_missing".to_string(),
                profile_id: Some(LocalSolverProfileId::AstrometrySolveField),
                executable_path: None,
                workspace_path: wcs_path
                    .parent()
                    .map(|path| path.to_string_lossy().to_string()),
                exit_code: None,
                availability_reason: None,
                stdout_excerpt: None,
                stderr_excerpt: None,
            },
        )));
    }

    // Parse the FITS WCS header from the .wcs file
    let data = fs::read(wcs_path)
        .map_err(|e| PlateSolverError::SolveFailed(format!("Failed to read WCS file: {}", e)))?;

    let header_str = parse_fits_header_from_bytes(&data);

    let mut result = PlateSolveResult {
        success: true,
        ra: None,
        dec: None,
        rotation: None,
        scale: None,
        width_deg: None,
        height_deg: None,
        flipped: None,
        error_message: None,
        wcs_file: None,
        solve_time_ms: 0,
    };

    let mut cdelt1: Option<f64> = None;
    let mut cdelt2: Option<f64> = None;
    let mut crota2: Option<f64> = None;
    let mut naxis1: Option<f64> = None;
    let mut naxis2: Option<f64> = None;
    let mut cd1_1: Option<f64> = None;
    let mut cd1_2: Option<f64> = None;
    let mut cd2_1: Option<f64> = None;
    let mut cd2_2: Option<f64> = None;

    for line in header_str.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("CRVAL1") {
            result.ra = parse_value(trimmed);
        } else if trimmed.starts_with("CRVAL2") {
            result.dec = parse_value(trimmed);
        } else if trimmed.starts_with("CROTA2") {
            crota2 = parse_value(trimmed);
        } else if trimmed.starts_with("CDELT1") {
            cdelt1 = parse_value(trimmed);
        } else if trimmed.starts_with("CDELT2") {
            cdelt2 = parse_value(trimmed);
        } else if trimmed.starts_with("NAXIS1") {
            naxis1 = parse_value(trimmed);
        } else if trimmed.starts_with("NAXIS2") {
            naxis2 = parse_value(trimmed);
        } else if trimmed.starts_with("CD1_1") {
            cd1_1 = parse_value(trimmed);
        } else if trimmed.starts_with("CD1_2") {
            cd1_2 = parse_value(trimmed);
        } else if trimmed.starts_with("CD2_1") {
            cd2_1 = parse_value(trimmed);
        } else if trimmed.starts_with("CD2_2") {
            cd2_2 = parse_value(trimmed);
        }
    }

    // Calculate rotation and scale from CD matrix or CDELT+CROTA
    if let (Some(c11), Some(c12), Some(c21), Some(c22)) = (cd1_1, cd1_2, cd2_1, cd2_2) {
        result.scale = Some((c11 * c11 + c21 * c21).sqrt() * 3600.0);
        result.rotation = Some(c21.atan2(c11).to_degrees());
        // Detect flipped: determinant of CD matrix > 0 means parity is flipped
        let det = c11 * c22 - c12 * c21;
        result.flipped = Some(det > 0.0);
        // Calculate FOV
        if let (Some(n1), Some(n2)) = (naxis1, naxis2) {
            let scale_x = (c11 * c11 + c21 * c21).sqrt();
            let scale_y = (c12 * c12 + c22 * c22).sqrt();
            result.width_deg = Some(scale_x * n1);
            result.height_deg = Some(scale_y * n2);
        }
    } else if let Some(cd1) = cdelt1 {
        result.scale = Some(cd1.abs() * 3600.0);
        result.rotation = crota2;
        if let Some(cd2) = cdelt2 {
            result.flipped = Some((cd1 > 0.0 && cd2 > 0.0) || (cd1 < 0.0 && cd2 < 0.0));
            if let (Some(n1), Some(n2)) = (naxis1, naxis2) {
                result.width_deg = Some(cd1.abs() * n1);
                result.height_deg = Some(cd2.abs() * n2);
            }
        }
    }

    Ok(result)
}

// ============================================================================
// Astrometry Path and Version Helpers
// ============================================================================

pub fn get_astrometry_paths() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            r"C:\cygwin64\bin\solve-field.exe".to_string(),
            r"C:\cygwin\bin\solve-field.exe".to_string(),
            "solve-field.exe".to_string(),
        ]
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        vec![
            "/usr/bin/solve-field".to_string(),
            "/usr/local/bin/solve-field".to_string(),
            "/opt/homebrew/bin/solve-field".to_string(),
            "solve-field".to_string(),
        ]
    }
}

pub fn get_astrometry_version(path: &str) -> Option<String> {
    Command::new(path)
        .arg("--version")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.lines().next().unwrap_or("").trim().to_string())
}

pub fn get_astrometry_index_path() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        Some(r"C:\cygwin64\usr\share\astrometry".to_string())
    }
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        Some("/usr/share/astrometry".to_string())
    }
}

pub fn validate_astrometry_executable(path: &str) -> Option<LocalSolverProfileId> {
    command_succeeds(path, &["--version"]).then_some(LocalSolverProfileId::AstrometrySolveField)
}

pub fn detect_astrometry_solver(
    preferred_executable: Option<&str>,
    preferred_index_path: Option<&str>,
) -> Option<SolverInfo> {
    let executable_path =
        resolve_preferred_executable(preferred_executable, &get_astrometry_paths())?;
    let profile_id = validate_astrometry_executable(&executable_path)?;
    let uses_custom_executable =
        preferred_executable.is_some_and(|path| !path.trim().is_empty() && path == executable_path);
    let index_path = preferred_index_path
        .filter(|path| !path.trim().is_empty())
        .map(|path| path.to_string())
        .or_else(get_astrometry_index_path)
        .or_else(|| get_default_index_path_internal("astrometry_net"));
    let installed_indexes =
        to_index_info(&get_local_astrometry_indexes_from_path(index_path.as_deref()).ok()?);
    let is_available = !installed_indexes.is_empty();

    Some(SolverInfo {
        solver_type: PlateSolverType::LocalAstrometry,
        name: "Astrometry.net (Local)".to_string(),
        version: get_astrometry_version(&executable_path),
        executable_path,
        is_available,
        index_path,
        installed_indexes,
        profile_id: Some(profile_id),
        profile_name: Some(profile_id.display_name().to_string()),
        availability_reason: (!is_available).then(|| "No Astrometry.net indexes found".to_string()),
        uses_custom_executable,
    })
}

fn build_astrometry_command_args(
    config: &PlateSolverConfig,
    solver_config: &SolverConfig,
    workspace: &LocalSolveWorkspace,
) -> Vec<String> {
    let mut args = vec![
        config.image_path.clone(),
        "--overwrite".to_string(),
        "--dir".to_string(),
        workspace.root_dir.to_string_lossy().to_string(),
        "--wcs".to_string(),
        workspace.wcs_file.to_string_lossy().to_string(),
    ];

    if solver_config.astrometry_no_plots {
        args.push("--no-plots".to_string());
    }
    if let Some(ra) = config.ra_hint {
        args.push("--ra".to_string());
        args.push(ra.to_string());
    }
    if let Some(dec) = config.dec_hint {
        args.push("--dec".to_string());
        args.push(dec.to_string());
    }
    if let Some(radius) = config.radius_hint.or(Some(solver_config.search_radius)) {
        args.push("--radius".to_string());
        args.push(radius.to_string());
    }
    if let Some(scale_low) = solver_config.astrometry_scale_low.or(config.scale_low) {
        args.push("--scale-low".to_string());
        args.push(scale_low.to_string());
    }
    if let Some(scale_high) = solver_config.astrometry_scale_high.or(config.scale_high) {
        args.push("--scale-high".to_string());
        args.push(scale_high.to_string());
    }
    args.push("--scale-units".to_string());
    args.push(normalize_scale_units(&solver_config.astrometry_scale_units).to_string());
    if let Some(depth) = solver_config
        .astrometry_depth
        .as_ref()
        .filter(|depth| !depth.is_empty())
    {
        args.push("--depth".to_string());
        args.push(depth.clone());
    }
    if solver_config.downsample > 0 || config.downsample.unwrap_or_default() > 0 {
        args.push("--downsample".to_string());
        args.push(
            solver_config
                .downsample
                .max(config.downsample.unwrap_or_default())
                .to_string(),
        );
    }
    if solver_config.astrometry_no_verify {
        args.push("--no-verify".to_string());
    }
    if solver_config.astrometry_crpix_center {
        args.push("--crpix-center".to_string());
    }

    args
}

fn normalize_scale_units(value: &str) -> &str {
    match value {
        "deg_width" => "degwidth",
        "arcmin_width" => "arcminwidth",
        "arcsec_per_pix" => "arcsecperpix",
        other => other,
    }
}

// ============================================================================
// Astrometry Index Scanning
// ============================================================================

pub fn get_local_astrometry_indexes() -> Result<Vec<AstrometryIndex>, PlateSolverError> {
    get_local_astrometry_indexes_from_path(None)
}

pub fn get_local_astrometry_indexes_from_path(
    index_path: Option<&str>,
) -> Result<Vec<AstrometryIndex>, PlateSolverError> {
    let mut directories = Vec::new();

    if let Some(index_path) = index_path.filter(|path| !path.trim().is_empty()) {
        directories.push(PathBuf::from(index_path));
    }

    if directories.is_empty() {
        if let Some(env_path) = std::env::var_os("SKYMAP_ASTROMETRY_INDEX_PATH") {
            for p in std::env::split_paths(&env_path) {
                if !p.as_os_str().is_empty() {
                    directories.push(p);
                }
            }
        }
    }

    if directories.is_empty() {
        if let Some(path) = get_astrometry_index_path() {
            directories.push(PathBuf::from(path));
        }
        if let Some(path) = get_default_index_path_internal("astrometry_net") {
            directories.push(PathBuf::from(path));
        }
    }

    let mut all_indexes = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();

    for dir in directories {
        if !dir.exists() || !dir.is_dir() {
            continue;
        }

        for index in scan_astrometry_indexes_in_directory(&dir) {
            if seen_paths.insert(index.path.clone()) {
                all_indexes.push(index);
            }
        }
    }

    all_indexes.sort_by(compare_astrometry_indexes);
    Ok(all_indexes)
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
                min_arcmin: index.scale_low,
                max_arcmin: index.scale_high,
            }),
            description: None,
        })
        .collect()
}

pub fn scan_astrometry_indexes_in_directory(dir: &Path) -> Vec<AstrometryIndex> {
    let mut indexes = Vec::new();

    let Ok(entries) = fs::read_dir(dir) else {
        return indexes;
    };

    for entry in entries.flatten() {
        let entry_path = entry.path();
        if !entry_path.is_file() {
            continue;
        }

        let is_fits = entry_path
            .extension()
            .map(|ext| ext.to_string_lossy().eq_ignore_ascii_case("fits"))
            .unwrap_or(false);
        if !is_fits {
            continue;
        }

        let name = entry_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        if name.is_empty() {
            continue;
        }

        let metadata = entry.metadata().ok();
        let size_bytes = metadata.map(|m| m.len()).unwrap_or(0);
        let size_mb = size_bytes.div_ceil(1024 * 1024);

        let scale = parse_index_scale(&name);
        indexes.push(AstrometryIndex {
            name: name.clone(),
            path: entry_path.to_string_lossy().to_string(),
            scale_low: scale.as_ref().map(|s| s.min_arcmin).unwrap_or(0.0),
            scale_high: scale.as_ref().map(|s| s.max_arcmin).unwrap_or(0.0),
            size_mb,
        });
    }

    indexes.sort_by(compare_astrometry_indexes);
    indexes
}

pub fn compare_astrometry_indexes(a: &AstrometryIndex, b: &AstrometryIndex) -> std::cmp::Ordering {
    match (parse_index_number(&a.name), parse_index_number(&b.name)) {
        (Some(left), Some(right)) => left.cmp(&right).then_with(|| a.name.cmp(&b.name)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => a.name.cmp(&b.name),
    }
}

pub fn parse_index_number(name: &str) -> Option<u32> {
    let normalized = name.trim().to_ascii_lowercase();
    let index_part = normalized.strip_prefix("index-")?;
    let number_part = index_part.split('-').next()?;
    number_part.parse::<u32>().ok()
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
    fn test_get_astrometry_paths() {
        let paths = get_astrometry_paths();
        assert!(!paths.is_empty());
        for path in &paths {
            assert!(path.contains("solve-field"));
        }
    }

    #[test]
    fn test_get_astrometry_index_path() {
        let path = get_astrometry_index_path();
        assert!(path.is_some());
        assert!(path.unwrap().to_lowercase().contains("astrometry"));
    }

    #[test]
    fn test_build_astrometry_command_args_uses_documented_cli_flags() {
        let config = PlateSolverConfig {
            solver_type: PlateSolverType::LocalAstrometry,
            image_path: "/images/m42.fit".to_string(),
            ra_hint: Some(83.822),
            dec_hint: Some(-5.391),
            radius_hint: Some(6.0),
            scale_low: Some(1.2),
            scale_high: Some(2.4),
            downsample: Some(2),
            timeout_seconds: Some(180),
        };

        let solver_config = SolverConfig {
            solver_type: "astrometry_net".to_string(),
            executable_path: Some("/usr/bin/solve-field".to_string()),
            index_path: Some("/data/astrometry".to_string()),
            timeout_seconds: 180,
            downsample: 2,
            search_radius: 6.0,
            use_sip: true,
            astap_database: None,
            astap_max_stars: 500,
            astap_tolerance: 0.007,
            astap_speed_mode: "auto".to_string(),
            astap_min_star_size: 1.5,
            astap_equalise_background: false,
            astrometry_scale_low: Some(1.2),
            astrometry_scale_high: Some(2.4),
            astrometry_scale_units: "degwidth".to_string(),
            astrometry_depth: Some("1-20".to_string()),
            astrometry_no_plots: true,
            astrometry_no_verify: true,
            astrometry_crpix_center: true,
            keep_wcs_file: true,
            auto_hints: true,
            retry_on_failure: false,
            max_retries: 2,
        };

        let workspace = LocalSolveWorkspace {
            root_dir: PathBuf::from("/tmp/skymap-solve"),
            output_base: PathBuf::from("/tmp/skymap-solve/result"),
            wcs_file: PathBuf::from("/tmp/skymap-solve/result.wcs"),
        };

        let args = build_astrometry_command_args(&config, &solver_config, &workspace);
        let joined = args.join(" ");

        assert!(joined.contains("--scale-low 1.2"));
        assert!(joined.contains("--scale-high 2.4"));
        assert!(joined.contains("--scale-units degwidth"));
        assert!(joined.contains("--downsample 2"));
        assert!(joined.contains("--depth 1-20"));
        assert!(joined.contains("--no-verify"));
        assert!(joined.contains("--crpix-center"));
        assert!(joined.contains("--dir /tmp/skymap-solve"));
        assert!(joined.contains("--wcs /tmp/skymap-solve/result.wcs"));
        assert!(joined.contains("--overwrite"));
    }

    // ------------------------------------------------------------------------
    // parse_index_number Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_index_number_valid() {
        assert_eq!(parse_index_number("index-4107"), Some(4107));
        assert_eq!(parse_index_number("index-4119"), Some(4119));
        assert_eq!(parse_index_number("index-4200"), Some(4200));
    }

    #[test]
    fn test_parse_index_number_with_subindex() {
        // "index-4107-00" should parse the first numeric part as 4107
        assert_eq!(parse_index_number("index-4107-00"), Some(4107));
    }

    #[test]
    fn test_parse_index_number_case_insensitive() {
        assert_eq!(parse_index_number("INDEX-4107"), Some(4107));
        assert_eq!(parse_index_number("Index-4112"), Some(4112));
    }

    #[test]
    fn test_parse_index_number_invalid() {
        assert!(parse_index_number("invalid").is_none());
        assert!(parse_index_number("").is_none());
        assert!(parse_index_number("4107").is_none()); // Missing "index-" prefix
        assert!(parse_index_number("index-abc").is_none());
    }

    #[test]
    fn test_parse_index_number_whitespace() {
        assert_eq!(parse_index_number("  index-4107  "), Some(4107));
    }

    // ------------------------------------------------------------------------
    // compare_astrometry_indexes Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_compare_astrometry_indexes_by_number() {
        let a = AstrometryIndex {
            name: "index-4107".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        let b = AstrometryIndex {
            name: "index-4112".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        assert_eq!(compare_astrometry_indexes(&a, &b), std::cmp::Ordering::Less);
        assert_eq!(
            compare_astrometry_indexes(&b, &a),
            std::cmp::Ordering::Greater
        );
    }

    #[test]
    fn test_compare_astrometry_indexes_same_number() {
        let a = AstrometryIndex {
            name: "index-4107".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        let b = AstrometryIndex {
            name: "index-4107".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        assert_eq!(
            compare_astrometry_indexes(&a, &b),
            std::cmp::Ordering::Equal
        );
    }

    #[test]
    fn test_compare_astrometry_indexes_numbered_before_unnumbered() {
        let a = AstrometryIndex {
            name: "index-4107".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        let b = AstrometryIndex {
            name: "custom-index".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        assert_eq!(compare_astrometry_indexes(&a, &b), std::cmp::Ordering::Less);
        assert_eq!(
            compare_astrometry_indexes(&b, &a),
            std::cmp::Ordering::Greater
        );
    }

    #[test]
    fn test_compare_astrometry_indexes_both_unnumbered() {
        let a = AstrometryIndex {
            name: "alpha-index".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        let b = AstrometryIndex {
            name: "beta-index".into(),
            path: "".into(),
            scale_low: 0.0,
            scale_high: 0.0,
            size_mb: 0,
        };
        // Falls back to string comparison
        assert_eq!(compare_astrometry_indexes(&a, &b), std::cmp::Ordering::Less);
    }

    // ------------------------------------------------------------------------
    // scan_astrometry_indexes_in_directory Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_scan_astrometry_indexes_in_directory() {
        let temp_root = std::env::temp_dir().join(format!(
            "skymap-plate-index-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_root).unwrap();

        let idx_4107 = temp_root.join("index-4107.fits");
        let idx_4112 = temp_root.join("index-4112.fits");
        fs::write(&idx_4107, vec![0_u8; 1024]).unwrap();
        fs::write(&idx_4112, vec![0_u8; 2048]).unwrap();

        let indexes = scan_astrometry_indexes_in_directory(&temp_root);
        fs::remove_dir_all(&temp_root).unwrap();

        assert_eq!(indexes.len(), 2);
        let index_4107 = indexes.iter().find(|i| i.name == "index-4107").unwrap();
        let index_4112 = indexes.iter().find(|i| i.name == "index-4112").unwrap();
        assert!(approx_eq(index_4107.scale_low, 22.0));
        assert!(approx_eq(index_4107.scale_high, 30.0));
        assert!(approx_eq(index_4112.scale_low, 120.0));
        assert!(approx_eq(index_4112.scale_high, 170.0));
    }

    #[test]
    fn test_scan_astrometry_indexes_ignores_non_fits() {
        let temp_root = std::env::temp_dir().join(format!(
            "skymap-plate-nonfits-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_root).unwrap();

        fs::write(temp_root.join("index-4107.fits"), vec![0_u8; 1024]).unwrap();
        fs::write(temp_root.join("readme.txt"), b"not an index").unwrap();
        fs::write(temp_root.join("data.csv"), b"1,2,3").unwrap();

        let indexes = scan_astrometry_indexes_in_directory(&temp_root);
        fs::remove_dir_all(&temp_root).unwrap();

        assert_eq!(indexes.len(), 1);
        assert_eq!(indexes[0].name, "index-4107");
    }

    #[test]
    fn test_scan_astrometry_indexes_empty_directory() {
        let temp_root = std::env::temp_dir().join(format!(
            "skymap-plate-empty-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_root).unwrap();

        let indexes = scan_astrometry_indexes_in_directory(&temp_root);
        fs::remove_dir_all(&temp_root).unwrap();

        assert!(indexes.is_empty());
    }

    #[test]
    fn test_scan_astrometry_indexes_nonexistent_directory() {
        let indexes = scan_astrometry_indexes_in_directory(Path::new("/nonexistent/path"));
        assert!(indexes.is_empty());
    }

    #[test]
    fn test_scan_astrometry_indexes_sorted_by_number() {
        let temp_root = std::env::temp_dir().join(format!(
            "skymap-plate-sort-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        fs::create_dir_all(&temp_root).unwrap();

        // Write in reverse order
        fs::write(temp_root.join("index-4119.fits"), vec![0_u8; 512]).unwrap();
        fs::write(temp_root.join("index-4107.fits"), vec![0_u8; 512]).unwrap();
        fs::write(temp_root.join("index-4112.fits"), vec![0_u8; 512]).unwrap();

        let indexes = scan_astrometry_indexes_in_directory(&temp_root);
        fs::remove_dir_all(&temp_root).unwrap();

        assert_eq!(indexes.len(), 3);
        assert_eq!(indexes[0].name, "index-4107");
        assert_eq!(indexes[1].name, "index-4112");
        assert_eq!(indexes[2].name, "index-4119");
    }
}
