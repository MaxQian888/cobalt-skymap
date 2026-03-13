//! Data management module
//! Provides persistent storage and data management for the application
//!
//! Submodules:
//! - `storage`: Base storage utilities and store management
//! - `equipment`: Telescope, camera, eyepiece, and filter configurations
//! - `locations`: Observation site management
//! - `targets`: Target list management for observation planning
//! - `target_io`: Target import/export (CSV, JSON, Stellarium formats)
//! - `session_io`: Session planner import/export and templates
//! - `markers`: Sky marker annotations
//! - `observation_log`: Observation session logging

pub mod equipment;
pub mod locations;
pub mod markers;
pub mod observation_log;
pub mod session_io;
mod session_io_core;
pub mod storage;
pub mod target_io;
pub mod targets;

// Re-export storage error type
pub use storage::StorageError;

// Re-export storage commands
pub use storage::{
    clear_all_data, delete_store_data, export_all_data, get_data_directory, get_storage_stats,
    import_all_data, list_stores, load_store_data, save_store_data,
};

// Re-export equipment types and commands
pub use equipment::{
    // Commands
    add_barlow_reducer,
    add_camera,
    add_eyepiece,
    add_filter,
    add_telescope,
    delete_equipment,
    get_default_camera,
    get_default_telescope,
    load_equipment,
    save_equipment,
    set_default_camera,
    set_default_telescope,
    update_barlow_reducer,
    update_camera,
    update_eyepiece,
    update_filter,
    update_telescope,
    // Types
    BarlowReducer,
    Camera,
    CameraType,
    EquipmentData,
    Eyepiece,
    Filter,
    FilterType,
    Telescope,
    TelescopeType,
};

// Re-export locations types and commands
pub use locations::{
    // Commands
    add_location,
    delete_location,
    get_current_location,
    load_locations,
    save_locations,
    set_current_location,
    set_default_location,
    update_location,
    // Types
    LocationsData,
    ObservationLocation,
};

// Re-export target list types and commands
pub use targets::{
    // Commands
    add_tag_to_targets,
    add_target,
    add_targets_batch,
    archive_completed_targets,
    clear_all_targets,
    clear_completed_targets,
    get_target_stats,
    load_target_list,
    remove_tag_from_targets,
    remove_target,
    remove_targets_batch,
    save_target_list,
    search_targets,
    set_active_target,
    set_targets_priority_batch,
    set_targets_status_batch,
    toggle_target_archive,
    toggle_target_favorite,
    update_target,
    // Types
    BatchTargetInput,
    ExposurePlan,
    MosaicSettings,
    ObservableWindow,
    TargetInput,
    TargetItem,
    TargetListData,
    TargetPriority,
    TargetStats,
    TargetStatus,
};

// Re-export target I/O
pub use target_io::{export_targets, import_targets};

// Re-export session planner I/O
pub use session_io::{
    export_session_plan, import_session_plan, load_session_templates, save_session_template,
};

// Re-export markers types and commands
pub use markers::{
    // Commands
    add_marker,
    add_marker_group,
    clear_all_markers,
    get_visible_markers,
    load_markers,
    remove_marker,
    remove_marker_group,
    remove_markers_by_group,
    rename_marker_group,
    save_markers,
    set_all_markers_visible,
    set_show_markers,
    toggle_marker_visibility,
    update_marker,
    // Types
    MarkerIcon,
    MarkerInput,
    MarkerUpdateInput,
    MarkersData,
    SkyMarker,
};

// Re-export observation log types and commands
pub use observation_log::{
    // Commands
    add_observation,
    create_planned_session,
    create_session,
    delete_observation,
    delete_session,
    end_session,
    export_observation_log,
    get_observation_stats,
    load_observation_log,
    save_observation_log,
    search_observations,
    update_observation,
    update_session,
    // Types
    CreatePlannedSessionPayload,
    ExecutionSummary,
    ExecutionTarget,
    Observation,
    ObservationLogData,
    ObservationQueryFilters,
    ObservationSearchHit,
    ObservationSession,
    ObservationStats,
    WeatherConditions,
};
