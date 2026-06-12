//! Platform module
//! Desktop-specific functionality for the Tauri application
//!
//! Submodules:
//! - `app_settings`: Application settings, window state, and preferences
//! - `app_control`: Application lifecycle control (restart, quit, reload)
//! - `cli`: Desktop CLI bridge helpers and commands
//! - `updater`: Application update checking and installation
//! - `plate_solver`: Astronomical plate solving integration

pub mod app_control;
pub mod app_settings;
pub mod cli;
pub mod map_keys;
pub mod path_config;
pub mod plate_solver;
pub mod secret_bootstrap;
pub mod updater;

pub use app_settings::{
    add_recent_file, clear_recent_files, get_system_info, load_app_settings, open_path,
    restore_window_state, reveal_in_file_manager, save_app_settings, save_window_state,
    AppSettings, RecentFile, SystemInfo, WindowState,
};

pub use app_control::{
    handle_tray_icon_event, initialize_tray, is_dev_mode, is_tray_positioning_ready, quit_app,
    reload_webview, restart_app, TrayRuntimeState,
};

pub use cli::{
    handle_forwarded_cli_invocation, parse_cli_matches_from_args, ForwardedCliInvocation,
    CLI_SECOND_INSTANCE_EVENT,
};

pub use updater::{
    check_for_update, clear_pending_update, download_and_install_update, download_update,
    get_current_version, has_pending_update, install_update, UpdateInfo, UpdateProgress,
    UpdateStatus, UpdaterError,
};

pub use path_config::{
    get_path_config, migrate_cache_dir, migrate_data_dir, reset_paths_to_default,
    set_custom_cache_dir, set_custom_data_dir, validate_directory, DirectoryValidation,
    MigrationResult, PathConfig, PathInfo,
};

pub use map_keys::{
    delete_map_api_key, get_map_api_key, list_map_api_keys_meta, save_map_api_key,
    set_active_map_api_key, MapApiKeyMeta, MapApiKeyQuota, MapApiKeyRecord, MapApiKeyRestrictions,
};

pub use secret_bootstrap::{get_or_create_secret_vault_bootstrap, SecretVaultBootstrap};

pub use plate_solver::{
    analyse_image, cancel_online_solve, cancel_plate_solve, delete_index, detect_plate_solvers,
    download_astap_database, download_index, extract_stars, get_astap_databases,
    get_available_indexes,
    get_default_index_path, get_downloadable_indexes, get_installed_indexes,
    get_recommended_indexes, get_solver_indexes, get_solver_info, load_solver_config, plate_solve,
    recommend_astap_database, save_solver_config, solve_image_local, solve_online,
    validate_solver_path, AstapDatabaseInfo, AstrometryIndex, DownloadableIndex,
    DownloadableIndexFull, ImageAnalysisResult, IndexDownloadProgress, IndexInfo, OnlineAnnotation,
    OnlineSolveConfig, OnlineSolveProgress, OnlineSolveResult, PlateSolveResult, PlateSolverConfig,
    PlateSolverError, PlateSolverType, ScaleRange, SipCoefficients, SolveParameters, SolveResult,
    SolverConfig, SolverInfo, StarDetection, WcsResult,
};
