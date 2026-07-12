//! Mobile (Android) ASTAP plate solving.
//!
//! Android 10+ W^X forbids executing binaries from app data, so the ASTAP CLI
//! is shipped inside the APK as a fake native library (`libastap_cli.so`,
//! vendored in `src-tauri/android-libs/jniLibs/<abi>/`) and executed from the
//! app's `nativeLibraryDir`.
//!
//! Design decision (README section B): instead of a Kotlin Tauri plugin, the
//! native library dir is resolved in pure Rust via `ndk-context` (which Tauri
//! initializes on Android) + a small JNI call to
//! `Context.getApplicationInfo().nativeLibraryDir`. This avoids an entire
//! mobile plugin project (Kotlin sources, build.gradle, permission plumbing)
//! for a single string lookup.
//!
//! Star databases are plain data files and live in
//! `<app_data_dir>/astap_data`, installed by the shared
//! `download_astap_database` command (`solver_core::astap`).

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

use crate::solver_core::astap::{
    kill_solver_process, list_astap_databases, run_astap_solve, AstapInvocation,
};
use crate::solver_core::types::{
    AstapDatabaseInfo, LocalInvocationDiagnostics, LocalSolverProfileId, PlateSolveResult,
    PlateSolverConfig, PlateSolverError, PlateSolverType, SolveParameters, SolveProgressEvent,
    SolveResult, SolverConfig,
};
use crate::solver_core::workspace::{format_dec_dms, format_ra_hms};

/// PID of the currently running mobile solve (for cancellation).
static MOBILE_SOLVE_PID: Mutex<Option<u32>> = Mutex::new(None);

const ASTAP_LIB_NAME: &str = "libastap_cli.so";

/// Resolve `applicationInfo.nativeLibraryDir` via JNI. Returns `None` on
/// non-Android mobile targets (iOS has no ASTAP build) or if any JNI step fails.
#[cfg(target_os = "android")]
fn native_library_dir() -> Option<String> {
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
    let mut env = vm.attach_current_thread().ok()?;
    let context = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };
    let app_info = env
        .call_method(
            &context,
            "getApplicationInfo",
            "()Landroid/content/pm/ApplicationInfo;",
            &[],
        )
        .ok()?
        .l()
        .ok()?;
    let dir_obj = env
        .get_field(&app_info, "nativeLibraryDir", "Ljava/lang/String;")
        .ok()?
        .l()
        .ok()?;
    let dir_str = env
        .get_string(&jni::objects::JString::from(dir_obj))
        .ok()?;
    Some(dir_str.into())
}

#[cfg(not(target_os = "android"))]
fn native_library_dir() -> Option<String> {
    None
}

fn default_astap_data_dir(app: &AppHandle) -> Result<PathBuf, PlateSolverError> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("astap_data"))
        .map_err(|e| {
            PlateSolverError::SolveFailed(format!("Failed to resolve app data dir: {}", e))
        })
}

fn resolve_astap_executable() -> Result<String, PlateSolverError> {
    let dir = native_library_dir().ok_or_else(|| {
        PlateSolverError::SolverNotInstalled("ASTAP (nativeLibraryDir unavailable)".to_string())
    })?;
    let path = PathBuf::from(&dir).join(ASTAP_LIB_NAME);
    if path.exists() {
        Ok(path.to_string_lossy().to_string())
    } else {
        Err(PlateSolverError::SolverNotInstalled(format!(
            "ASTAP ({} not found in {})",
            ASTAP_LIB_NAME, dir
        )))
    }
}

/// Directory where mobile ASTAP star databases are installed
/// (`<app_data_dir>/astap_data`). Frontend uses this as the download `dest_dir`.
#[tauri::command]
pub async fn get_astap_data_dir_mobile(app: AppHandle) -> Result<String, PlateSolverError> {
    Ok(default_astap_data_dir(&app)?.to_string_lossy().to_string())
}

/// The full ASTAP database catalog with installation status, scanning the
/// mobile data dir.
#[tauri::command]
pub async fn get_astap_databases_mobile(
    app: AppHandle,
) -> Result<Vec<AstapDatabaseInfo>, PlateSolverError> {
    let data_dir = default_astap_data_dir(&app)?.to_string_lossy().to_string();
    Ok(list_astap_databases(&[data_dir]))
}

/// Cancel an in-flight mobile solve.
#[tauri::command]
pub async fn cancel_plate_solve_mobile() -> Result<(), PlateSolverError> {
    let pid = {
        let mut guard = MOBILE_SOLVE_PID.lock().unwrap();
        guard.take()
    };
    if let Some(pid) = pid {
        log::info!("Cancelling mobile plate solve process with PID {}", pid);
        kill_solver_process(pid);
    }
    Ok(())
}

/// Solve an image locally on mobile using the bundled ASTAP CLI.
/// Mirrors desktop `solve_image_local`, but is ASTAP-only and resolves the
/// executable from the APK's native library dir.
#[tauri::command]
pub async fn solve_image_local_mobile(
    app: AppHandle,
    config: SolverConfig,
    params: SolveParameters,
) -> Result<SolveResult, PlateSolverError> {
    let start = std::time::Instant::now();

    if !PathBuf::from(&params.image_path).exists() {
        return Err(PlateSolverError::InvalidImage(format!(
            "Image not found: {}",
            params.image_path
        )));
    }

    let _ = app.emit(
        "solve-progress",
        SolveProgressEvent {
            stage: "preparing".to_string(),
            progress: 5.0,
            message: "Validating image and building solver arguments...".to_string(),
        },
    );

    // Mobile is ASTAP-only; default the index path to the app-data database dir.
    let mut config = config;
    config.solver_type = "astap".to_string();
    if config
        .index_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .is_none()
    {
        config.index_path = Some(default_astap_data_dir(&app)?.to_string_lossy().to_string());
    }
    if let Some(fov) = params.fov_hint.filter(|v| v.is_finite() && *v > 0.0) {
        if config.astrometry_scale_low.is_none() {
            config.astrometry_scale_low = Some(fov);
        }
    }

    let solver_config = PlateSolverConfig {
        solver_type: PlateSolverType::Astap,
        image_path: params.image_path.clone(),
        ra_hint: params.ra_hint,
        dec_hint: params.dec_hint,
        radius_hint: params.search_radius,
        scale_low: config.astrometry_scale_low,
        scale_high: config.astrometry_scale_high,
        downsample: params.downsample.or(Some(config.downsample)),
        timeout_seconds: params.timeout.or(Some(config.timeout_seconds)),
    };

    let _ = app.emit(
        "solve-progress",
        SolveProgressEvent {
            stage: "solving".to_string(),
            progress: 15.0,
            message: "Running plate solver...".to_string(),
        },
    );

    let result = match resolve_astap_executable() {
        Ok(executable_path) => {
            let invocation = AstapInvocation {
                executable_path,
                profile_id: Some(LocalSolverProfileId::AstapCli),
                availability_reason: None,
            };
            run_astap_solve(&invocation, &solver_config, Some(&config), &MOBILE_SOLVE_PID).await
        }
        Err(e) => Err(e),
    };

    let _ = app.emit(
        "solve-progress",
        SolveProgressEvent {
            stage: "parsing".to_string(),
            progress: 85.0,
            message: "Parsing solve results...".to_string(),
        },
    );

    let solve_time_ms = start.elapsed().as_millis() as u64;
    Ok(to_solve_result(result, solve_time_ms))
}

fn to_solve_result(
    result: Result<PlateSolveResult, PlateSolverError>,
    solve_time_ms: u64,
) -> SolveResult {
    match result {
        Ok(r) => SolveResult {
            success: r.success,
            ra: r.ra,
            dec: r.dec,
            ra_hms: r.ra.map(format_ra_hms),
            dec_dms: r.dec.map(format_dec_dms),
            position_angle: r.rotation,
            pixel_scale: r.scale,
            fov_width: r.width_deg,
            fov_height: r.height_deg,
            flipped: r.flipped,
            solver_name: "astap".to_string(),
            solve_time_ms,
            error_message: r.error_message,
            wcs_file: r.wcs_file,
            local_diagnostics: None,
        },
        Err(e) => {
            let local_diagnostics: Option<LocalInvocationDiagnostics> = match &e {
                PlateSolverError::LocalInvocation(diagnostics) => Some((**diagnostics).clone()),
                _ => None,
            };
            SolveResult {
                success: false,
                ra: None,
                dec: None,
                ra_hms: None,
                dec_dms: None,
                position_angle: None,
                pixel_scale: None,
                fov_width: None,
                fov_height: None,
                flipped: None,
                solver_name: "astap".to_string(),
                solve_time_ms,
                error_message: Some(e.to_string()),
                wcs_file: None,
                local_diagnostics,
            }
        }
    }
}
