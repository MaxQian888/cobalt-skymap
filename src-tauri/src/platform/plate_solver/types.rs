//! Type definitions for the plate solver module
//! Contains all structs, enums, and error types used across solver submodules.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, thiserror::Error)]
pub enum PlateSolverError {
    #[error("No solver found")]
    NoSolverFound,
    #[error("Solver not installed: {0}")]
    SolverNotInstalled(String),
    #[error("Solve failed: {0}")]
    SolveFailed(String),
    #[error("Invalid image: {0}")]
    InvalidImage(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    #[error("Local invocation failed: {0:?}")]
    LocalInvocation(Box<LocalInvocationDiagnostics>),
}

impl Serialize for PlateSolverError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlateSolverType {
    #[serde(rename = "astap")]
    Astap,
    #[serde(rename = "astrometry_net_online")]
    AstrometryNet,
    #[serde(rename = "astrometry_net")]
    LocalAstrometry,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocalSolverProfileId {
    AstapGui,
    AstapCli,
    AstrometrySolveField,
}

impl LocalSolverProfileId {
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::AstapGui => "ASTAP",
            Self::AstapCli => "ASTAP CLI",
            Self::AstrometrySolveField => "solve-field",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverInfo {
    pub solver_type: PlateSolverType,
    pub name: String,
    pub version: Option<String>,
    pub executable_path: String,
    pub is_available: bool,
    pub index_path: Option<String>,
    #[serde(default)]
    pub installed_indexes: Vec<IndexInfo>,
    #[serde(default)]
    pub profile_id: Option<LocalSolverProfileId>,
    #[serde(default)]
    pub profile_name: Option<String>,
    #[serde(default)]
    pub availability_reason: Option<String>,
    #[serde(default)]
    pub uses_custom_executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalInvocationDiagnostics {
    pub error_code: String,
    pub profile_id: Option<LocalSolverProfileId>,
    pub executable_path: Option<String>,
    pub workspace_path: Option<String>,
    pub exit_code: Option<i32>,
    pub availability_reason: Option<String>,
    pub stdout_excerpt: Option<String>,
    pub stderr_excerpt: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LocalSolveWorkspace {
    pub root_dir: std::path::PathBuf,
    pub output_base: std::path::PathBuf,
    pub wcs_file: std::path::PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateSolverConfig {
    pub solver_type: PlateSolverType,
    pub image_path: String,
    pub ra_hint: Option<f64>,
    pub dec_hint: Option<f64>,
    pub radius_hint: Option<f64>,
    pub scale_low: Option<f64>,
    pub scale_high: Option<f64>,
    pub downsample: Option<u32>,
    pub timeout_seconds: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlateSolveResult {
    pub success: bool,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub rotation: Option<f64>,
    pub scale: Option<f64>,
    pub width_deg: Option<f64>,
    pub height_deg: Option<f64>,
    pub flipped: Option<bool>,
    pub error_message: Option<String>,
    pub wcs_file: Option<String>,
    pub solve_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstrometryIndex {
    pub name: String,
    pub path: String,
    pub scale_low: f64,
    pub scale_high: f64,
    pub size_mb: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadableIndex {
    pub name: String,
    pub url: String,
    pub scale_low: f64,
    pub scale_high: f64,
    pub size_mb: u64,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolveProgressEvent {
    pub stage: String,
    pub progress: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexDownloadProgress {
    pub index_name: String,
    pub downloaded: u64,
    pub total: u64,
    pub percent: f64,
}

// ============================================================================
// Image Analysis Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StarDetection {
    pub x: f64,
    pub y: f64,
    pub hfd: f64,
    pub flux: f64,
    pub snr: f64,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub magnitude: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAnalysisResult {
    pub success: bool,
    pub median_hfd: Option<f64>,
    pub star_count: u32,
    pub background: Option<f64>,
    pub noise: Option<f64>,
    pub stars: Vec<StarDetection>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstapDatabaseInfo {
    pub name: String,
    pub abbreviation: String,
    pub installed: bool,
    pub path: Option<String>,
    pub fov_min_deg: f64,
    pub fov_max_deg: f64,
    pub description: String,
    pub size_mb: u64,
    pub download_url: Option<String>,
}

// ============================================================================
// SIP Distortion Coefficients
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SipCoefficients {
    pub a_order: Option<u32>,
    pub b_order: Option<u32>,
    pub ap_order: Option<u32>,
    pub bp_order: Option<u32>,
    pub a_coeffs: HashMap<String, f64>,
    pub b_coeffs: HashMap<String, f64>,
    pub ap_coeffs: HashMap<String, f64>,
    pub bp_coeffs: HashMap<String, f64>,
}

// ============================================================================
// Enhanced PlateSolveResult with SIP support
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WcsResult {
    pub crpix1: Option<f64>,
    pub crpix2: Option<f64>,
    pub crval1: Option<f64>,
    pub crval2: Option<f64>,
    pub cdelt1: Option<f64>,
    pub cdelt2: Option<f64>,
    pub crota1: Option<f64>,
    pub crota2: Option<f64>,
    pub cd1_1: Option<f64>,
    pub cd1_2: Option<f64>,
    pub cd2_1: Option<f64>,
    pub cd2_2: Option<f64>,
    pub ctype1: Option<String>,
    pub ctype2: Option<String>,
    pub naxis1: Option<u32>,
    pub naxis2: Option<u32>,
    pub sip: Option<SipCoefficients>,
}

// ============================================================================
// Online Astrometry.net Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnlineSolveConfig {
    pub api_key: String,
    pub image_path: String,
    pub operation_id: Option<String>,
    pub base_url: Option<String>,
    pub ra_hint: Option<f64>,
    pub dec_hint: Option<f64>,
    pub radius: Option<f64>,
    pub scale_units: Option<String>,
    pub scale_lower: Option<f64>,
    pub scale_upper: Option<f64>,
    pub scale_est: Option<f64>,
    pub scale_err: Option<f64>,
    pub downsample_factor: Option<u32>,
    pub tweak_order: Option<u32>,
    pub crpix_center: Option<bool>,
    pub parity: Option<u32>,
    pub timeout_seconds: Option<u32>,
    pub publicly_visible: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnlineSolveProgress {
    pub stage: String,
    pub progress: f64,
    pub message: String,
    pub sub_id: Option<u64>,
    pub job_id: Option<u64>,
    pub operation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnlineSolveResult {
    pub success: bool,
    pub operation_id: Option<String>,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub orientation: Option<f64>,
    pub pixscale: Option<f64>,
    pub radius: Option<f64>,
    pub parity: Option<f64>,
    pub fov_width: Option<f64>,
    pub fov_height: Option<f64>,
    pub objects_in_field: Vec<String>,
    pub annotations: Vec<OnlineAnnotation>,
    pub job_id: Option<u64>,
    pub wcs: Option<WcsResult>,
    pub solve_time_ms: u64,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnlineAnnotation {
    pub names: Vec<String>,
    pub annotation_type: String,
    pub pixelx: f64,
    pub pixely: f64,
    pub radius: f64,
}

// ============================================================================
// Additional commands required by frontend
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScaleRange {
    pub min_arcmin: f64,
    pub max_arcmin: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexInfo {
    pub name: String,
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub scale_range: Option<ScaleRange>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverConfig {
    pub solver_type: String,
    pub executable_path: Option<String>,
    pub index_path: Option<String>,
    pub timeout_seconds: u32,
    pub downsample: u32,
    pub search_radius: f64,
    pub use_sip: bool,
    pub astap_database: Option<String>,
    pub astap_max_stars: u32,
    pub astap_tolerance: f64,
    pub astap_speed_mode: String,
    pub astap_min_star_size: f64,
    pub astap_equalise_background: bool,
    pub astrometry_scale_low: Option<f64>,
    pub astrometry_scale_high: Option<f64>,
    pub astrometry_scale_units: String,
    pub astrometry_depth: Option<String>,
    pub astrometry_no_plots: bool,
    pub astrometry_no_verify: bool,
    pub astrometry_crpix_center: bool,
    pub keep_wcs_file: bool,
    pub auto_hints: bool,
    pub retry_on_failure: bool,
    pub max_retries: u32,
}

impl Default for SolverConfig {
    fn default() -> Self {
        Self {
            solver_type: "astap".to_string(),
            executable_path: None,
            index_path: None,
            timeout_seconds: 120,
            downsample: 0,
            search_radius: 30.0,
            use_sip: true,
            astap_database: None,
            astap_max_stars: 500,
            astap_tolerance: 0.007,
            astap_speed_mode: "auto".to_string(),
            astap_min_star_size: 1.5,
            astap_equalise_background: false,
            astrometry_scale_low: None,
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
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolveParameters {
    pub image_path: String,
    pub ra_hint: Option<f64>,
    pub dec_hint: Option<f64>,
    pub fov_hint: Option<f64>,
    pub search_radius: Option<f64>,
    pub downsample: Option<u32>,
    pub timeout: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolveResult {
    pub success: bool,
    pub ra: Option<f64>,
    pub dec: Option<f64>,
    pub ra_hms: Option<String>,
    pub dec_dms: Option<String>,
    pub position_angle: Option<f64>,
    pub pixel_scale: Option<f64>,
    pub fov_width: Option<f64>,
    pub fov_height: Option<f64>,
    pub flipped: Option<bool>,
    pub solver_name: String,
    pub solve_time_ms: u64,
    pub error_message: Option<String>,
    pub wcs_file: Option<String>,
    pub local_diagnostics: Option<LocalInvocationDiagnostics>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadableIndexFull {
    pub name: String,
    pub file_name: String,
    pub download_url: String,
    pub size_bytes: u64,
    pub scale_range: ScaleRange,
    pub description: String,
    pub solver_type: String,
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // PlateSolverType Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_plate_solver_type_serialization() {
        let solver = PlateSolverType::Astap;
        let json = serde_json::to_string(&solver).unwrap();
        assert_eq!(json, "\"astap\"");

        let solver = PlateSolverType::AstrometryNet;
        let json = serde_json::to_string(&solver).unwrap();
        assert_eq!(json, "\"astrometry_net_online\"");
    }

    #[test]
    fn test_plate_solver_type_deserialization() {
        let solver: PlateSolverType = serde_json::from_str("\"astap\"").unwrap();
        assert!(matches!(solver, PlateSolverType::Astap));
    }

    #[test]
    fn test_plate_solver_type_frontend_contract_names() {
        let local = serde_json::to_string(&PlateSolverType::LocalAstrometry).unwrap();
        assert_eq!(local, "\"astrometry_net\"");

        let online = serde_json::to_string(&PlateSolverType::AstrometryNet).unwrap();
        assert_eq!(online, "\"astrometry_net_online\"");
    }

    // ------------------------------------------------------------------------
    // SolverConfig Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_solver_config_default() {
        let config = SolverConfig::default();
        assert_eq!(config.solver_type, "astap");
        assert_eq!(config.timeout_seconds, 120);
        assert!(config.use_sip);
        assert!(config.astrometry_no_plots);
    }

    #[test]
    fn test_solver_config_serialization() {
        let config = SolverConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"solver_type\":\"astap\""));
        assert!(json.contains("\"timeout_seconds\":120"));
    }

    // ------------------------------------------------------------------------
    // PlateSolveResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_plate_solve_result_success() {
        let result = PlateSolveResult {
            success: true,
            ra: Some(180.0),
            dec: Some(45.0),
            rotation: Some(0.0),
            scale: Some(1.5),
            width_deg: Some(2.0),
            height_deg: Some(1.5),
            flipped: Some(false),
            error_message: None,
            wcs_file: None,
            solve_time_ms: 1000,
        };

        assert!(result.success);
        assert!(result.ra.is_some());
        assert!(result.error_message.is_none());
    }

    #[test]
    fn test_plate_solve_result_failure() {
        let result = PlateSolveResult {
            success: false,
            ra: None,
            dec: None,
            rotation: None,
            scale: None,
            width_deg: None,
            height_deg: None,
            flipped: None,
            error_message: Some("Solve failed".to_string()),
            wcs_file: None,
            solve_time_ms: 500,
        };

        assert!(!result.success);
        assert!(result.error_message.is_some());
    }

    // ------------------------------------------------------------------------
    // SolveResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_solve_result_serialization() {
        let result = SolveResult {
            success: true,
            ra: Some(180.0),
            dec: Some(45.0),
            ra_hms: Some("12h 00m 00s".to_string()),
            dec_dms: Some("+45° 00' 00\"".to_string()),
            position_angle: Some(0.0),
            pixel_scale: Some(1.5),
            fov_width: Some(2.0),
            fov_height: Some(1.5),
            flipped: Some(false),
            solver_name: "astap".to_string(),
            solve_time_ms: 1000,
            error_message: None,
            wcs_file: None,
            local_diagnostics: None,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"ra\":180"));
    }

    // ------------------------------------------------------------------------
    // PlateSolverError Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_plate_solver_error_display() {
        let err = PlateSolverError::NoSolverFound;
        assert_eq!(format!("{}", err), "No solver found");

        let err = PlateSolverError::SolveFailed("Test error".to_string());
        assert!(format!("{}", err).contains("Test error"));
    }

    #[test]
    fn test_plate_solver_error_serialization() {
        let err = PlateSolverError::NoSolverFound;
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("No solver found"));
    }

    // ------------------------------------------------------------------------
    // SolverInfo Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_solver_info_structure() {
        let info = SolverInfo {
            solver_type: PlateSolverType::Astap,
            name: "ASTAP".to_string(),
            version: Some("0.9.7".to_string()),
            executable_path: "/usr/bin/astap".to_string(),
            is_available: true,
            index_path: Some("/data".to_string()),
            installed_indexes: vec![],
            profile_id: Some(LocalSolverProfileId::AstapCli),
            profile_name: Some("ASTAP CLI".to_string()),
            availability_reason: None,
            uses_custom_executable: false,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("ASTAP"));
        assert!(json.contains("0.9.7"));
        assert!(json.contains("executable_path"));
        assert!(json.contains("profile_id"));
    }

    // ------------------------------------------------------------------------
    // IndexInfo Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_index_info_structure() {
        let info = IndexInfo {
            name: "index-4107".to_string(),
            file_name: "index-4107.fits".to_string(),
            path: "/data/index-4107.fits".to_string(),
            size_bytes: 2 * 1024 * 1024,
            scale_range: Some(ScaleRange {
                min_arcmin: 22.0,
                max_arcmin: 30.0,
            }),
            description: Some("Wide field".to_string()),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("index-4107"));
        assert!(json.contains("scale_range"));
    }

    // ------------------------------------------------------------------------
    // ScaleRange Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_scale_range_serialization() {
        let range = ScaleRange {
            min_arcmin: 120.0,
            max_arcmin: 170.0,
        };
        let json = serde_json::to_string(&range).unwrap();
        assert!(json.contains("120.0") || json.contains("120"));
        assert!(json.contains("170.0") || json.contains("170"));
    }

    // ------------------------------------------------------------------------
    // SolveParameters Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_solve_parameters_structure() {
        let params = SolveParameters {
            image_path: "/path/to/image.fits".to_string(),
            ra_hint: Some(180.0),
            dec_hint: Some(45.0),
            fov_hint: Some(2.0),
            search_radius: Some(10.0),
            downsample: Some(2),
            timeout: Some(60),
        };

        let json = serde_json::to_string(&params).unwrap();
        assert!(json.contains("image_path"));
        assert!(json.contains("ra_hint"));
    }

    // ------------------------------------------------------------------------
    // DownloadableIndexFull Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_downloadable_index_full_structure() {
        let idx = DownloadableIndexFull {
            name: "index-4107".to_string(),
            file_name: "index-4107.fits".to_string(),
            download_url: "http://example.com/index-4107.fits".to_string(),
            size_bytes: 2 * 1024 * 1024,
            scale_range: ScaleRange {
                min_arcmin: 22.0,
                max_arcmin: 30.0,
            },
            description: "Wide field".to_string(),
            solver_type: "astap".to_string(),
        };

        let json = serde_json::to_string(&idx).unwrap();
        assert!(json.contains("download_url"));
        assert!(json.contains("solver_type"));
    }

    // ------------------------------------------------------------------------
    // IndexDownloadProgress Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_index_download_progress_structure() {
        let progress = IndexDownloadProgress {
            index_name: "index-4107".to_string(),
            downloaded: 1024 * 1024,
            total: 2 * 1024 * 1024,
            percent: 50.0,
        };

        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("index_name"));
        assert!(json.contains("percent"));
    }
}
