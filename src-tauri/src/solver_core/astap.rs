//! Shared ASTAP core: argument builder, solve runner, result parsers,
//! star-database catalog and download. Platform-agnostic — used by the
//! desktop `platform::plate_solver` module and the mobile solver.

use std::fs;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

use super::fits::{parse_fits_header_from_bytes, parse_ini_value, parse_value};
use super::types::{
    AstapDatabaseInfo, IndexDownloadProgress, LocalInvocationDiagnostics, LocalSolverProfileId,
    PlateSolveResult, PlateSolverConfig, PlateSolverError, SolverConfig,
};
use super::workspace::{
    cleanup_local_solve_workspace, create_local_solve_workspace, excerpt_output,
};

/// Identity of a resolved ASTAP executable, passed to [`run_astap_solve`].
#[derive(Debug, Clone)]
pub struct AstapInvocation {
    pub executable_path: String,
    pub profile_id: Option<LocalSolverProfileId>,
    pub availability_reason: Option<String>,
}

pub fn kill_solver_process(pid: u32) {
    #[cfg(target_os = "windows")]
    {
        let _ = Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }
}

/// Run an already-resolved ASTAP executable against `config` and parse the
/// result (INI file → WCS file → stdout fallback). `pid_slot` receives the
/// child PID for the duration of the run so callers can support cancellation.
pub async fn run_astap_solve(
    invocation: &AstapInvocation,
    config: &PlateSolverConfig,
    solver_config: Option<&SolverConfig>,
    pid_slot: &'static Mutex<Option<u32>>,
) -> Result<PlateSolveResult, PlateSolverError> {
    let workspace = create_local_solve_workspace("astap")?;
    let keep_wcs_file = solver_config.map(|sc| sc.keep_wcs_file).unwrap_or(true);

    let mut cmd = Command::new(&invocation.executable_path);
    cmd.args(build_astap_command_args(
        config,
        solver_config,
        &workspace.output_base,
    ));

    // Execute with timeout and cancellation support
    let timeout_secs = config.timeout_seconds.unwrap_or(120);
    let executable_path = invocation.executable_path.clone();
    let workspace_path = workspace.root_dir.to_string_lossy().to_string();
    let profile_id = invocation.profile_id;
    let availability_reason = invocation.availability_reason.clone();
    let output = tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs as u64),
        tokio::task::spawn_blocking(move || {
            cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
            let child = cmd.spawn()?;
            // Store PID for cancel support
            {
                let mut guard = pid_slot.lock().unwrap();
                *guard = Some(child.id());
            }
            let result = child.wait_with_output();
            // Clear PID after completion
            {
                let mut guard = pid_slot.lock().unwrap();
                *guard = None;
            }
            result
        }),
    )
    .await
    .map_err(|_| {
        // On timeout, also kill the process
        let pid = pid_slot.lock().unwrap().take();
        if let Some(pid) = pid {
            kill_solver_process(pid);
        }
        PlateSolverError::LocalInvocation(Box::new(LocalInvocationDiagnostics {
            error_code: "timeout".to_string(),
            profile_id,
            executable_path: Some(executable_path.clone()),
            workspace_path: Some(workspace_path.clone()),
            exit_code: None,
            availability_reason: availability_reason.clone(),
            stdout_excerpt: None,
            stderr_excerpt: None,
        }))
    })?
    .map_err(|e| PlateSolverError::SolveFailed(format!("Task join error: {}", e)))?
    .map_err(PlateSolverError::Io)?;

    // Try parsing INI output file first (more reliable than stdout)
    let ini_path = workspace.output_base.with_extension("ini");
    let wcs_path = workspace.wcs_file.clone();

    if ini_path.exists() {
        match parse_astap_ini_file(&ini_path) {
            Ok(mut result) => {
                result.wcs_file = keep_wcs_file.then(|| wcs_path.to_string_lossy().to_string());
                if !keep_wcs_file {
                    cleanup_local_solve_workspace(&workspace);
                }
                return Ok(result);
            }
            Err(e) => log::warn!("Failed to parse ASTAP INI file: {}", e),
        }
    }

    // Try parsing WCS file
    if wcs_path.exists() {
        match parse_astap_wcs_file(&wcs_path) {
            Ok(mut result) => {
                result.wcs_file = keep_wcs_file.then(|| wcs_path.to_string_lossy().to_string());
                if !keep_wcs_file {
                    cleanup_local_solve_workspace(&workspace);
                }
                return Ok(result);
            }
            Err(e) => log::warn!("Failed to parse ASTAP WCS file: {}", e),
        }
    }

    // Fall back to stdout parsing
    let stdout = String::from_utf8_lossy(&output.stdout);
    if output.status.success() && stdout.contains("Solution found") {
        let mut result = parse_astap_result(&stdout)?;
        result.wcs_file = keep_wcs_file.then(|| wcs_path.to_string_lossy().to_string());
        if !keep_wcs_file {
            cleanup_local_solve_workspace(&workspace);
        }
        Ok(result)
    } else {
        Err(PlateSolverError::LocalInvocation(Box::new(
            LocalInvocationDiagnostics {
                error_code: if output.status.success() {
                    "result_missing".to_string()
                } else {
                    "nonzero_exit".to_string()
                },
                profile_id,
                executable_path: Some(invocation.executable_path.clone()),
                workspace_path: Some(workspace.root_dir.to_string_lossy().to_string()),
                exit_code: output.status.code(),
                availability_reason: invocation.availability_reason.clone(),
                stdout_excerpt: excerpt_output(&output.stdout),
                stderr_excerpt: excerpt_output(&output.stderr),
            },
        )))
    }
}

pub fn build_astap_command_args(
    config: &PlateSolverConfig,
    solver_config: Option<&SolverConfig>,
    output_base: &std::path::Path,
) -> Vec<String> {
    let mut args = vec![
        "-f".to_string(),
        config.image_path.clone(),
        "-o".to_string(),
        output_base.to_string_lossy().to_string(),
        "-wcs".to_string(),
    ];

    if let Some(ra) = config.ra_hint {
        args.push("-ra".to_string());
        args.push(format!("{}", ra / 15.0));
    }
    if let Some(dec) = config.dec_hint {
        args.push("-spd".to_string());
        args.push(format!("{}", dec + 90.0));
    }
    if let Some(radius) = config.radius_hint {
        args.push("-r".to_string());
        args.push(format!("{}", radius));
    }
    if let Some(downsample) = config.downsample {
        args.push("-z".to_string());
        args.push(format!("{}", downsample));
    }

    if let Some(sc) = solver_config {
        if let Some(db) = sc.astap_database.as_ref().filter(|db| !db.is_empty()) {
            args.push("-D".to_string());
            args.push(db.clone());
        }
        if let Some(index_path) = sc.index_path.as_ref().filter(|path| !path.is_empty()) {
            args.push("-d".to_string());
            args.push(index_path.clone());
        }
        if sc.astap_max_stars > 0 && sc.astap_max_stars != 500 {
            args.push("-s".to_string());
            args.push(sc.astap_max_stars.to_string());
        }
        if sc.astap_tolerance > 0.0 && (sc.astap_tolerance - 0.007).abs() > 0.0001 {
            args.push("-t".to_string());
            args.push(sc.astap_tolerance.to_string());
        }
        if sc.astap_min_star_size > 0.0 && (sc.astap_min_star_size - 1.5).abs() > 0.01 {
            args.push("-m".to_string());
            args.push(sc.astap_min_star_size.to_string());
        }
        if sc.astap_speed_mode == "slow" {
            args.push("-speed".to_string());
            args.push("slow".to_string());
        }
        if !sc.use_sip {
            args.push("-sip".to_string());
            args.push("n".to_string());
        }
        if sc.astap_equalise_background {
            // -eqbg equalises the background prior to solving (ASTAP 2025-07+).
            args.push("-eqbg".to_string());
            args.push("y".to_string());
        }
        if let Some(scale_low) = sc.astrometry_scale_low.filter(|value| *value > 0.0) {
            args.push("-fov".to_string());
            args.push(scale_low.to_string());
        }
    }

    args
}

/// Parse ASTAP .ini output file for solve results
pub fn parse_astap_ini_file(ini_path: &PathBuf) -> Result<PlateSolveResult, PlateSolverError> {
    let content = fs::read_to_string(ini_path)
        .map_err(|e| PlateSolverError::SolveFailed(format!("Failed to read INI: {}", e)))?;

    let mut solved = false;
    let mut result = PlateSolveResult {
        success: false,
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
    let mut crota1: Option<f64> = None;
    let mut crota2: Option<f64> = None;
    let mut naxis1: Option<f64> = None;
    let mut naxis2: Option<f64> = None;
    let mut cd1_1: Option<f64> = None;
    let mut cd1_2: Option<f64> = None;
    let mut cd2_1: Option<f64> = None;
    let mut cd2_2: Option<f64> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("PLTSOLVD") {
            solved = trimmed.contains("T");
        } else if trimmed.starts_with("CRVAL1") {
            result.ra = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CRVAL2") {
            result.dec = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CDELT1") {
            cdelt1 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CDELT2") {
            cdelt2 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CROTA1") {
            crota1 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CROTA2") {
            crota2 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("NAXIS1") {
            naxis1 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("NAXIS2") {
            naxis2 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CD1_1") {
            cd1_1 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CD1_2") {
            cd1_2 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CD2_1") {
            cd2_1 = parse_ini_value(trimmed);
        } else if trimmed.starts_with("CD2_2") {
            cd2_2 = parse_ini_value(trimmed);
        }
    }

    if !solved {
        return Err(PlateSolverError::SolveFailed(
            "ASTAP INI reports PLTSOLVD=F".to_string(),
        ));
    }

    result.success = true;
    result.rotation = crota2.or(crota1);

    // Calculate pixel scale and flipped from CD matrix or CDELT
    if let (Some(c11), Some(c12), Some(c21), Some(c22)) = (cd1_1, cd1_2, cd2_1, cd2_2) {
        result.scale = Some((c11 * c11 + c21 * c21).sqrt() * 3600.0);
        if result.rotation.is_none() {
            result.rotation = Some(c21.atan2(c11).to_degrees());
        }
        let det = c11 * c22 - c12 * c21;
        result.flipped = Some(det > 0.0);
    } else if let Some(cd1) = cdelt1 {
        result.scale = Some(cd1.abs() * 3600.0);
        if let Some(cd2) = cdelt2 {
            result.flipped = Some((cd1 > 0.0 && cd2 > 0.0) || (cd1 < 0.0 && cd2 < 0.0));
        }
    }

    // Calculate FOV dimensions
    if let (Some(n1), Some(n2)) = (naxis1, naxis2) {
        if let (Some(c11), Some(c12), Some(c21), Some(c22)) = (cd1_1, cd1_2, cd2_1, cd2_2) {
            let scale_x = (c11 * c11 + c21 * c21).sqrt();
            let scale_y = (c12 * c12 + c22 * c22).sqrt();
            result.width_deg = Some(scale_x * n1);
            result.height_deg = Some(scale_y * n2);
        } else if let (Some(cd1), Some(cd2)) = (cdelt1, cdelt2) {
            result.width_deg = Some(cd1.abs() * n1);
            result.height_deg = Some(cd2.abs() * n2);
        }
    }

    Ok(result)
}

/// Parse ASTAP .wcs output file (FITS header format)
pub fn parse_astap_wcs_file(wcs_path: &PathBuf) -> Result<PlateSolveResult, PlateSolverError> {
    let data = fs::read(wcs_path)
        .map_err(|e| PlateSolverError::SolveFailed(format!("Failed to read WCS: {}", e)))?;

    let header_str = parse_fits_header_from_bytes(&data);
    parse_astap_result(&header_str)
}

pub fn parse_astap_result(output: &str) -> Result<PlateSolveResult, PlateSolverError> {
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
    let mut naxis1: Option<f64> = None;
    let mut naxis2: Option<f64> = None;
    let mut cd1_1: Option<f64> = None;
    let mut cd1_2: Option<f64> = None;
    let mut cd2_1: Option<f64> = None;
    let mut cd2_2: Option<f64> = None;

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("CRVAL1") {
            result.ra = parse_value(trimmed);
        } else if trimmed.starts_with("CRVAL2") {
            result.dec = parse_value(trimmed);
        } else if trimmed.starts_with("CROTA2") {
            result.rotation = parse_value(trimmed);
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

    // Calculate pixel scale and rotation from CD matrix or CDELT
    if let (Some(c11), Some(c12), Some(c21), Some(c22)) = (cd1_1, cd1_2, cd2_1, cd2_2) {
        result.scale = Some((c11 * c11 + c21 * c21).sqrt() * 3600.0);
        if result.rotation.is_none() {
            result.rotation = Some(c21.atan2(c11).to_degrees());
        }
        // Detect flipped: determinant of CD matrix > 0 means parity is flipped
        let det = c11 * c22 - c12 * c21;
        result.flipped = Some(det > 0.0);
    } else if let Some(cd1) = cdelt1 {
        result.scale = Some(cd1.abs() * 3600.0);
        // Detect flipped from CDELT signs: normally CDELT1 < 0 and CDELT2 > 0
        if let Some(cd2) = cdelt2 {
            result.flipped = Some((cd1 > 0.0 && cd2 > 0.0) || (cd1 < 0.0 && cd2 < 0.0));
        }
    }

    // Calculate FOV dimensions
    if let (Some(n1), Some(n2)) = (naxis1, naxis2) {
        if let (Some(c11), Some(c12), Some(c21), Some(c22)) = (cd1_1, cd1_2, cd2_1, cd2_2) {
            let scale_x = (c11 * c11 + c21 * c21).sqrt();
            let scale_y = (c12 * c12 + c22 * c22).sqrt();
            result.width_deg = Some(scale_x * n1);
            result.height_deg = Some(scale_y * n2);
        } else if let (Some(cd1), Some(cd2)) = (cdelt1, cdelt2) {
            result.width_deg = Some(cd1.abs() * n1);
            result.height_deg = Some(cd2.abs() * n2);
        }
    }

    Ok(result)
}

// ============================================================================
// ASTAP Database Catalog / Detection
// ============================================================================

pub fn is_astap_database_file(name: &str) -> bool {
    // ASTAP database files follow pattern like d80_*, d50_*, d20_*, d05_*, g05_*, etc.
    let prefixes = [
        "d80", "d50", "d20", "d05", "g05", "g17", "g18", "w08", "v17", "h17", "h18", "t2",
    ];
    prefixes.iter().any(|p| name.starts_with(p))
}

pub fn is_astap_database_dir(name: &str) -> bool {
    is_astap_database_file(name)
}

pub fn get_astap_db_scale_range(name: &str) -> (f64, f64) {
    // FOV ranges for ASTAP databases (in degrees)
    if ["d80", "d50", "d20"]
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        (0.3, 10.0)
    } else if name.starts_with("d05") {
        (0.2, 5.0)
    } else if ["g05", "g17", "g18"]
        .iter()
        .any(|prefix| name.starts_with(prefix))
    {
        (0.1, 2.0)
    } else if ["w08", "v17"].iter().any(|prefix| name.starts_with(prefix)) {
        (0.5, 20.0)
    } else if name.starts_with("h17") || name.starts_with("h18") {
        (0.1, 5.0)
    } else {
        (0.3, 10.0)
    }
}

type AstapDbDefinition = (
    &'static str,
    &'static str,
    f64,
    f64,
    &'static str,
    u64,
    Option<String>,
);

/// Real ASTAP star databases hosted on SourceForge. Only databases that ship a
/// cross-platform `.zip` (raw database files) expose a download URL; the rest are
/// listed as informational entries pointing users to the ASTAP website.
/// Reference: https://sourceforge.net/projects/astap-program/files/star_databases/
fn astap_database_definitions() -> Vec<AstapDbDefinition> {
    const SF: &str = "https://sourceforge.net/projects/astap-program/files/star_databases";
    vec![
        (
            "W08",
            "w08",
            20.0,
            180.0,
            "Very wide field (mag≤8), FOV 20°-180°, ~0.3MB",
            1,
            Some(format!("{SF}/w08_star_database_mag08_astap.zip/download")),
        ),
        (
            "G05",
            "g05",
            3.0,
            20.0,
            "Galaxy/wide field (500 stars/deg²), FOV 3°-20°, ~102MB",
            102,
            Some(format!("{SF}/g05_star_database.zip/download")),
        ),
        (
            "D05",
            "d05",
            0.1,
            5.0,
            "General 500 stars/deg², small FOV, ~102MB",
            102,
            Some(format!("{SF}/d05_star_database.zip/download")),
        ),
        (
            "D20",
            "d20",
            0.2,
            10.0,
            "General 2000 stars/deg², FOV 0.2°-10°, ~400MB",
            400,
            Some(format!("{SF}/d20_star_database.zip/download")),
        ),
        (
            "D50",
            "d50",
            0.3,
            10.0,
            "General 5000 stars/deg² (recommended), FOV 0.3°-10°, ~900MB",
            901,
            Some(format!("{SF}/d50_star_database.zip/download")),
        ),
        // .exe/.pkg only (no .zip): informational entries, download from ASTAP website.
        (
            "D80",
            "d80",
            0.1,
            10.0,
            "General 8000 stars/deg² (largest, ~1.3GB) — download from ASTAP website",
            1300,
            None,
        ),
        (
            "V50",
            "v50",
            10.0,
            180.0,
            "Photometry (Johnson-V + Gaia color, ~1.1GB) — download from ASTAP website",
            1100,
            None,
        ),
    ]
}

/// Build the full ASTAP database catalog, marking as installed any database
/// whose files are found in one of `scan_dirs`.
pub fn list_astap_databases(scan_dirs: &[String]) -> Vec<AstapDatabaseInfo> {
    let mut databases = Vec::new();

    for (name, abbr, fov_min, fov_max, desc, size, url) in &astap_database_definitions() {
        let mut installed = false;
        let mut db_path = None;

        'dirs: for dp in scan_dirs {
            let dir = PathBuf::from(dp);
            if dir.exists() {
                // Check if any files in the data dir start with this abbreviation
                if let Ok(entries) = fs::read_dir(&dir) {
                    for entry in entries.flatten() {
                        let fname = entry.file_name().to_string_lossy().to_lowercase();
                        if fname.starts_with(abbr) {
                            installed = true;
                            db_path = Some(dir.to_string_lossy().to_string());
                            break 'dirs;
                        }
                    }
                }
            }
        }

        databases.push(AstapDatabaseInfo {
            name: name.to_string(),
            abbreviation: abbr.to_string(),
            installed,
            path: db_path,
            fov_min_deg: *fov_min,
            fov_max_deg: *fov_max,
            description: desc.to_string(),
            size_mb: *size,
            download_url: url.clone(),
        });
    }

    databases
}

// ============================================================================
// ASTAP Database Download
// ============================================================================

/// Extract an ASTAP database zip into `dest_dir`, flattening entries to their file
/// name (ASTAP databases are a flat set of `.290`/`.1476` files). Synchronous; call
/// inside `spawn_blocking`. Guards against zip-slip by using the file name only.
fn extract_zip_to_dir(
    zip_path: &std::path::Path,
    dest_dir: &std::path::Path,
) -> Result<(), PlateSolverError> {
    std::fs::create_dir_all(dest_dir)?;
    let file = std::fs::File::open(zip_path)?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| PlateSolverError::ExtractionFailed(e.to_string()))?;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| PlateSolverError::ExtractionFailed(e.to_string()))?;
        if entry.is_dir() {
            continue;
        }
        let name = match entry
            .enclosed_name()
            .and_then(|p| p.file_name().map(|f| f.to_owned()))
        {
            Some(n) => n,
            None => continue,
        };
        let out_path = dest_dir.join(name);
        let mut out = std::fs::File::create(&out_path)?;
        std::io::copy(&mut entry, &mut out)?;
    }
    Ok(())
}

/// Download and install an ASTAP star database (`.zip` → extracted into `dest_dir`).
/// Streams the download, reusing the `index-download-progress` event so the existing
/// index-manager progress listener can render it (payload `index_name == database.name`).
/// Registered on both desktop and mobile.
#[tauri::command]
pub async fn download_astap_database(
    app: AppHandle,
    database: AstapDatabaseInfo,
    dest_dir: String,
) -> Result<(), PlateSolverError> {
    let url = database.download_url.clone().ok_or_else(|| {
        PlateSolverError::DownloadFailed(format!(
            "Database {} has no downloadable .zip",
            database.name
        ))
    })?;
    log::info!("Downloading ASTAP database {} from {}", database.name, url);

    let dest = PathBuf::from(&dest_dir);
    std::fs::create_dir_all(&dest)?;
    let tmp_zip = dest.join(format!(".{}.download.zip", database.abbreviation));

    // 1) Stream download to a temp zip, emitting progress.
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| PlateSolverError::DownloadFailed(e.to_string()))?;
    let total = response
        .content_length()
        .unwrap_or(database.size_mb * 1024 * 1024);
    let mut downloaded = 0u64;
    {
        use futures_util::StreamExt;
        use std::io::Write;
        let mut file = std::fs::File::create(&tmp_zip)?;
        let mut stream = response.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|e| PlateSolverError::DownloadFailed(e.to_string()))?;
            file.write_all(&chunk)?;
            downloaded += chunk.len() as u64;
            let _ = app.emit(
                "index-download-progress",
                IndexDownloadProgress {
                    index_name: database.name.clone(),
                    downloaded,
                    total,
                    percent: if total > 0 {
                        (downloaded as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    },
                },
            );
        }
    }

    // 2) Extract (blocking) off the async runtime.
    let tmp_zip2 = tmp_zip.clone();
    let dest2 = dest.clone();
    tokio::task::spawn_blocking(move || extract_zip_to_dir(&tmp_zip2, &dest2))
        .await
        .map_err(|e| PlateSolverError::SolveFailed(format!("Join error: {}", e)))??;

    let _ = std::fs::remove_file(&tmp_zip);
    log::info!(
        "ASTAP database {} installed to {}",
        database.name,
        dest_dir
    );
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::super::types::{PlateSolverType, SolverConfig};
    use super::*;

    const EPSILON: f64 = 1e-4;

    fn approx_eq(a: f64, b: f64) -> bool {
        (a - b).abs() < EPSILON
    }

    #[test]
    fn test_build_astap_command_args_respects_output_base_and_options() {
        let config = PlateSolverConfig {
            solver_type: PlateSolverType::Astap,
            image_path: "/images/m31.fit".to_string(),
            ra_hint: Some(10.0),
            dec_hint: Some(20.0),
            radius_hint: Some(5.0),
            scale_low: None,
            scale_high: None,
            downsample: Some(2),
            timeout_seconds: Some(120),
        };

        let solver_config = SolverConfig {
            solver_type: "astap".to_string(),
            executable_path: Some("/usr/bin/astap_cli".to_string()),
            index_path: Some("/data/astap".to_string()),
            timeout_seconds: 120,
            downsample: 2,
            search_radius: 5.0,
            use_sip: false,
            astap_database: Some("d50".to_string()),
            astap_max_stars: 800,
            astap_tolerance: 0.01,
            astap_speed_mode: "slow".to_string(),
            astap_min_star_size: 2.0,
            astap_equalise_background: true,
            astrometry_scale_low: Some(1.4),
            astrometry_scale_high: None,
            astrometry_scale_units: "deg_width".to_string(),
            astrometry_depth: None,
            astrometry_no_plots: true,
            astrometry_no_verify: false,
            astrometry_crpix_center: true,
            keep_wcs_file: true,
            auto_hints: true,
            retry_on_failure: false,
            max_retries: 2,
        };

        let args = build_astap_command_args(
            &config,
            Some(&solver_config),
            std::path::Path::new("/tmp/skymap/result"),
        );
        let joined = args.join(" ");

        assert!(joined.contains("-o /tmp/skymap/result"));
        assert!(joined.contains("-wcs"));
        assert!(joined.contains("-D d50"));
        assert!(joined.contains("-d /data/astap"));
        assert!(joined.contains("-s 800"));
        assert!(joined.contains("-t 0.01"));
        assert!(joined.contains("-m 2"));
        assert!(joined.contains("-speed slow"));
        assert!(joined.contains("-sip n"));
        assert!(joined.contains("-eqbg y"));
        assert!(joined.contains("-fov 1.4"));
    }

    // ------------------------------------------------------------------------
    // parse_astap_result Tests (FITS header stdout format)
    // ------------------------------------------------------------------------

    #[test]
    fn test_parse_astap_result_with_cd_matrix() {
        let output = "\
CRVAL1  =        180.0000000 / RA center
CRVAL2  =         45.0000000 / DEC center
CD1_1   =      -0.0003000000 / scale
CD1_2   =       0.0000000000
CD2_1   =       0.0000000000
CD2_2   =       0.0003000000
NAXIS1  =               2000
NAXIS2  =               1500
";
        let result = parse_astap_result(output).unwrap();
        assert!(result.success);
        assert!(approx_eq(result.ra.unwrap(), 180.0));
        assert!(approx_eq(result.dec.unwrap(), 45.0));
        // scale = sqrt(cd1_1^2 + cd2_1^2) * 3600 = 0.0003 * 3600 = 1.08
        assert!(approx_eq(result.scale.unwrap(), 1.08));
        // flipped: det = cd1_1*cd2_2 - cd1_2*cd2_1 = -0.0003*0.0003 - 0 < 0 => false
        assert_eq!(result.flipped, Some(false));
        // FOV: scale_x * naxis1 = 0.0003 * 2000 = 0.6
        assert!(approx_eq(result.width_deg.unwrap(), 0.6));
        assert!(approx_eq(result.height_deg.unwrap(), 0.45));
    }

    #[test]
    fn test_parse_astap_result_with_cdelt() {
        let output = "\
CRVAL1  =        83.6330000 / RA
CRVAL2  =        22.0140000 / DEC
CDELT1  =      -0.0001200000
CDELT2  =       0.0001200000
CROTA2  =        1.50000000
NAXIS1  =               3000
NAXIS2  =               2000
";
        let result = parse_astap_result(output).unwrap();
        assert!(result.success);
        assert!(approx_eq(result.ra.unwrap(), 83.633));
        assert!(approx_eq(result.dec.unwrap(), 22.014));
        assert!(approx_eq(result.rotation.unwrap(), 1.5));
        // scale = |cdelt1| * 3600 = 0.00012 * 3600 = 0.432
        assert!(approx_eq(result.scale.unwrap(), 0.432));
        // flipped: (cd1 > 0.0 && cd2 > 0.0) || (cd1 < 0.0 && cd2 < 0.0)
        // cd1 = -0.00012 (neg), cd2 = 0.00012 (pos) => false || false = false
        assert_eq!(result.flipped, Some(false));
        // FOV = |cdelt1| * naxis1 = 0.00012 * 3000 = 0.36
        assert!(approx_eq(result.width_deg.unwrap(), 0.36));
        assert!(approx_eq(result.height_deg.unwrap(), 0.24));
    }

    #[test]
    fn test_parse_astap_result_empty_output() {
        let result = parse_astap_result("").unwrap();
        assert!(result.success);
        assert!(result.ra.is_none());
        assert!(result.dec.is_none());
        assert!(result.scale.is_none());
    }

    #[test]
    fn test_parse_astap_result_flipped_image() {
        // Both CDELT positive => flipped
        let output = "\
CRVAL1  =        180.0
CRVAL2  =         45.0
CDELT1  =       0.0001
CDELT2  =       0.0001
";
        let result = parse_astap_result(output).unwrap();
        assert_eq!(result.flipped, Some(true));
    }

    // ------------------------------------------------------------------------
    // ASTAP Database Helpers Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_is_astap_database_file_valid() {
        assert!(is_astap_database_file("d80_stars"));
        assert!(is_astap_database_file("d50_index"));
        assert!(is_astap_database_file("d20_catalog"));
        assert!(is_astap_database_file("d05_data"));
        assert!(is_astap_database_file("g05_gaia"));
        assert!(is_astap_database_file("g17_dr2"));
        assert!(is_astap_database_file("g18_dr2"));
        assert!(is_astap_database_file("w08_wide"));
        assert!(is_astap_database_file("v17_ucac"));
        assert!(is_astap_database_file("h17_halpha"));
        assert!(is_astap_database_file("h18_halpha"));
        assert!(is_astap_database_file("t2_tycho"));
    }

    #[test]
    fn test_is_astap_database_file_invalid() {
        assert!(!is_astap_database_file("readme"));
        assert!(!is_astap_database_file("config.ini"));
        assert!(!is_astap_database_file(""));
        assert!(!is_astap_database_file("x99_unknown"));
    }

    #[test]
    fn test_get_astap_db_scale_range() {
        let (low, high) = get_astap_db_scale_range("d80_stars");
        assert!(approx_eq(low, 0.3));
        assert!(approx_eq(high, 10.0));

        let (low, high) = get_astap_db_scale_range("g05_gaia");
        assert!(approx_eq(low, 0.1));
        assert!(approx_eq(high, 2.0));

        let (low, high) = get_astap_db_scale_range("w08_wide");
        assert!(approx_eq(low, 0.5));
        assert!(approx_eq(high, 20.0));

        let (low, high) = get_astap_db_scale_range("h17_halpha");
        assert!(approx_eq(low, 0.1));
        assert!(approx_eq(high, 5.0));

        // Unknown defaults
        let (low, high) = get_astap_db_scale_range("unknown");
        assert!(approx_eq(low, 0.3));
        assert!(approx_eq(high, 10.0));
    }

    #[test]
    fn test_is_astap_database_dir_delegates() {
        // is_astap_database_dir delegates to is_astap_database_file
        assert!(is_astap_database_dir("d50_data"));
        assert!(!is_astap_database_dir("random_dir"));
    }

    #[test]
    fn test_astap_databases_use_real_sourceforge_urls() {
        let dbs = list_astap_databases(&[]);
        // Only databases with a real .zip are exposed as downloadable.
        let downloadable: Vec<_> = dbs.iter().filter(|d| d.download_url.is_some()).collect();
        let abbrs: Vec<&str> = downloadable.iter().map(|d| d.abbreviation.as_str()).collect();
        assert!(abbrs.contains(&"w08"));
        assert!(abbrs.contains(&"g05"));
        assert!(abbrs.contains(&"d05"));
        assert!(abbrs.contains(&"d20"));
        assert!(abbrs.contains(&"d50"));
        // Obsolete magnitude-based databases must no longer be downloadable.
        assert!(!abbrs.contains(&"h17"));
        assert!(!abbrs.contains(&"h18"));
        assert!(!abbrs.contains(&"g17"));
        for d in &downloadable {
            let url = d.download_url.as_ref().unwrap();
            assert!(
                url.contains("sourceforge.net/projects/astap-program/files/star_databases/"),
                "unexpected url: {url}"
            );
            assert!(url.ends_with(".zip/download"), "unexpected url: {url}");
        }
    }

    #[test]
    fn test_extract_zip_to_dir_writes_files() {
        use std::io::Write;
        let tmp = std::env::temp_dir().join(format!(
            "skymap-ziptest-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        let zip_path = tmp.join("test.zip");

        // Build a zip containing a flat database file plus a nested dir entry.
        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zw = zip::ZipWriter::new(file);
            let opts: zip::write::FileOptions<()> = zip::write::FileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated);
            zw.start_file("d50_star_database.290", opts).unwrap();
            zw.write_all(b"DATA").unwrap();
            // nested path must be flattened to file name
            zw.start_file("nested/d50_star_database.1476", opts).unwrap();
            zw.write_all(b"MORE").unwrap();
            zw.finish().unwrap();
        }

        let out = tmp.join("data");
        extract_zip_to_dir(&zip_path, &out).unwrap();
        assert!(out.join("d50_star_database.290").exists());
        assert!(out.join("d50_star_database.1476").exists());
        let _ = std::fs::remove_dir_all(&tmp);
    }
}
