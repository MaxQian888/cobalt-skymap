//! SkyMap Tauri Backend
//!
//! Organized into the following modules:
//! - `astronomy`: Astronomical calculations and events
//! - `data`: Data storage, equipment, locations, targets, markers, observation logs
//! - `cache`: Offline tile caching and unified network caching
//! - `network`: HTTP client, security, rate limiting
//! - `platform`: App settings, control, updater, plate solver (desktop only)
//! - `utils`: Common utilities

pub mod astronomy;
pub mod cache;
pub mod data;
pub mod mount;
pub mod network;
pub mod utils;

#[cfg(desktop)]
pub mod platform;

// Re-export for backward compatibility and ease of use
#[cfg(not(test))]
use data::{
    // Equipment
    add_barlow_reducer,
    add_camera,
    add_eyepiece,
    add_filter,
    // Locations
    add_location,
    // Markers
    add_marker,
    add_marker_group,
    // Observation log
    add_observation,
    // Target list
    add_tag_to_targets,
    add_target,
    add_targets_batch,
    add_telescope,
    archive_completed_targets,
    // Storage
    clear_all_data,
    clear_all_markers,
    clear_all_targets,
    clear_completed_targets,
    create_planned_session,
    create_session,
    delete_equipment,
    delete_location,
    delete_observation,
    delete_session,
    delete_store_data,
    end_session,
    export_all_data,
    export_observation_log,
    // Session I/O
    export_session_plan,
    // Target I/O
    export_targets,
    get_current_location,
    get_data_directory,
    get_default_camera,
    get_default_telescope,
    get_observation_stats,
    get_storage_stats,
    get_target_stats,
    get_visible_markers,
    import_all_data,
    import_session_plan,
    import_targets,
    list_stores,
    load_equipment,
    load_locations,
    load_markers,
    load_observation_log,
    load_session_templates,
    load_store_data,
    load_target_list,
    remove_marker,
    remove_marker_group,
    remove_markers_by_group,
    remove_tag_from_targets,
    remove_target,
    remove_targets_batch,
    rename_marker_group,
    save_equipment,
    save_locations,
    save_markers,
    save_observation_log,
    save_session_template,
    save_store_data,
    save_target_list,
    search_observations,
    search_targets,
    set_active_target,
    set_all_markers_visible,
    set_current_location,
    set_default_camera,
    set_default_location,
    set_default_telescope,
    set_show_markers,
    set_targets_priority_batch,
    set_targets_status_batch,
    toggle_marker_visibility,
    toggle_target_archive,
    toggle_target_favorite,
    update_barlow_reducer,
    update_camera,
    update_eyepiece,
    update_filter,
    update_location,
    update_marker,
    update_observation,
    update_session,
    update_target,
    update_telescope,
};

#[cfg(not(test))]
use astronomy::{
    // Calculations
    angular_separation,
    calculate_fov,
    calculate_moon_phase,
    calculate_moon_position,
    calculate_mosaic_coverage,
    calculate_sun_position,
    calculate_twilight,
    calculate_visibility,
    ecliptic_to_equatorial,
    equatorial_to_ecliptic,
    equatorial_to_galactic,
    equatorial_to_horizontal,
    format_dec_dms,
    format_ra_hms,
    galactic_to_equatorial,
    // Events
    get_astro_events,
    get_daily_astro_events,
    get_meteor_showers,
    get_moon_phases_for_month,
    get_seasonal_events,
    get_tonight_highlights,
    horizontal_to_equatorial,
    parse_dec_dms,
    parse_ra_hms,
};

#[cfg(not(test))]
use cache::{
    // Unified cache
    cleanup_unified_cache,
    // Offline cache
    clear_all_cache,
    clear_survey_cache,
    clear_unified_cache,
    create_cache_region,
    delete_cache_region,
    delete_unified_cache_entry,
    flush_unified_cache,
    get_cache_directory,
    get_cache_stats,
    get_unified_cache_entry,
    get_unified_cache_size,
    get_unified_cache_stats,
    is_tile_cached,
    list_cache_regions,
    list_unified_cache_keys,
    load_cached_tile,
    prefetch_url,
    prefetch_urls,
    put_unified_cache_entry,
    save_cached_tile,
    update_cache_region,
};

#[cfg(not(test))]
use network::{
    cancel_request, get_active_requests, get_effective_proxy_state, get_http_config,
    http_batch_download, http_cancel_all_requests, http_cancel_request, http_check_url,
    http_download, http_get, http_head, http_post, http_request, set_http_config,
};

#[cfg(not(test))]
use mount::{
    mount_abort_slew, mount_connect, mount_disconnect, mount_discover, mount_get_capabilities,
    mount_get_observing_conditions, mount_get_safety_state, mount_get_state, mount_move_axis,
    mount_park, mount_set_slew_rate, mount_set_tracking, mount_set_tracking_rate, mount_slew_to,
    mount_stop_axis, mount_sync_to, mount_unpark,
};

#[cfg(all(desktop, not(test)))]
use platform::{
    // App settings
    add_recent_file,
    // Plate solver
    analyse_image,
    cancel_online_solve,
    cancel_plate_solve,
    // Updater
    check_for_update,
    clear_pending_update,
    clear_recent_files,
    delete_index,
    delete_map_api_key,
    detect_plate_solvers,
    download_and_install_update,
    download_index,
    download_update,
    extract_stars,
    get_astap_databases,
    get_available_indexes,
    get_current_version,
    get_default_index_path,
    get_downloadable_indexes,
    get_installed_indexes,
    get_map_api_key,
    // Secret vault bootstrap
    get_or_create_secret_vault_bootstrap,
    // Path config
    get_path_config,
    get_recommended_indexes,
    get_solver_indexes,
    get_solver_info,
    get_system_info,
    // CLI bridge
    handle_forwarded_cli_invocation,
    // App control
    handle_tray_icon_event,
    has_pending_update,
    initialize_tray,
    install_update,
    is_dev_mode,
    is_tray_positioning_ready,
    list_map_api_keys_meta,
    load_app_settings,
    load_solver_config,
    migrate_cache_dir,
    migrate_data_dir,
    open_path,
    parse_cli_matches_from_args,
    plate_solve,
    quit_app,
    recommend_astap_database,
    reload_webview,
    reset_paths_to_default,
    restart_app,
    restore_window_state,
    reveal_in_file_manager,
    save_app_settings,
    // Secure map API keys
    save_map_api_key,
    save_solver_config,
    save_window_state,
    set_active_map_api_key,
    set_custom_cache_dir,
    set_custom_data_dir,
    solve_image_local,
    solve_online,
    validate_directory,
    validate_solver_path,
    TrayRuntimeState,
};

#[cfg(all(desktop, not(test)))]
use tauri::Manager;

const fn desktop_debug_tooling_enabled(is_desktop: bool, is_debug: bool) -> bool {
    is_desktop && is_debug
}

const fn persistent_logging_enabled(is_desktop: bool, is_debug: bool) -> bool {
    !desktop_debug_tooling_enabled(is_desktop, is_debug)
}

#[cfg(not(test))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Single instance plugin must be registered FIRST (desktop only)
    #[cfg(desktop)]
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            handle_forwarded_cli_invocation(app, args, cwd);
        }));

    #[cfg(all(desktop, debug_assertions))]
    let builder = builder.plugin(tauri_plugin_devtools::init());

    #[cfg(desktop)]
    let builder = builder.on_tray_icon_event(|app, event| {
        tauri_plugin_positioner::on_tray_event(app, &event);
        handle_tray_icon_event(app, &event);
    });

    #[cfg(not(desktop))]
    let builder = tauri::Builder::default();

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Geolocation plugin (mobile only)
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_geolocation::init())?;

            // Process plugin (desktop only)
            #[cfg(desktop)]
            {
                app.manage(TrayRuntimeState::default());
                app.handle().plugin(tauri_plugin_cli::init())?;
                app.handle().plugin(tauri_plugin_positioner::init())?;
                app.handle()
                    .plugin(tauri_plugin_clipboard_manager::init())?;
                app.handle()
                    .plugin(tauri_plugin_window_state::Builder::default().build())?;
                app.handle().plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                    None::<Vec<&str>>,
                ))?;
                let salt_path = app
                    .path()
                    .app_local_data_dir()
                    .map_err(|error| {
                        format!("failed to resolve app local data directory: {error}")
                    })?
                    .join("stronghold-salt.txt");
                app.handle()
                    .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
                app.handle()
                    .plugin(tauri_plugin_global_shortcut::Builder::new().build())?;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
                app.handle().plugin(tauri_plugin_os::init())?;

                if let Err(error) = initialize_tray(app.handle()) {
                    log::warn!("Tray initialization skipped: {error}");
                }
            }

            if persistent_logging_enabled(cfg!(desktop), cfg!(debug_assertions)) {
                let log_level = if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                };

                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log_level)
                        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                        .max_file_size(5_000_000)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Storage
            save_store_data,
            load_store_data,
            delete_store_data,
            list_stores,
            export_all_data,
            import_all_data,
            get_data_directory,
            get_storage_stats,
            clear_all_data,
            // Equipment
            load_equipment,
            save_equipment,
            add_telescope,
            add_camera,
            add_eyepiece,
            delete_equipment,
            add_barlow_reducer,
            add_filter,
            update_telescope,
            update_camera,
            update_eyepiece,
            update_barlow_reducer,
            update_filter,
            set_default_telescope,
            set_default_camera,
            get_default_telescope,
            get_default_camera,
            // Locations
            load_locations,
            save_locations,
            add_location,
            update_location,
            delete_location,
            set_current_location,
            set_default_location,
            get_current_location,
            // Observation log
            load_observation_log,
            save_observation_log,
            create_session,
            create_planned_session,
            add_observation,
            update_observation,
            delete_observation,
            update_session,
            end_session,
            delete_session,
            get_observation_stats,
            search_observations,
            export_observation_log,
            // Target import/export
            export_targets,
            import_targets,
            // Session plan import/export/templates
            export_session_plan,
            import_session_plan,
            save_session_template,
            load_session_templates,
            // Astronomy calculations
            equatorial_to_horizontal,
            horizontal_to_equatorial,
            equatorial_to_galactic,
            galactic_to_equatorial,
            equatorial_to_ecliptic,
            ecliptic_to_equatorial,
            calculate_visibility,
            calculate_twilight,
            calculate_moon_phase,
            calculate_moon_position,
            calculate_sun_position,
            calculate_fov,
            calculate_mosaic_coverage,
            angular_separation,
            format_ra_hms,
            format_dec_dms,
            parse_ra_hms,
            parse_dec_dms,
            // Offline cache
            get_cache_stats,
            list_cache_regions,
            create_cache_region,
            update_cache_region,
            delete_cache_region,
            save_cached_tile,
            load_cached_tile,
            is_tile_cached,
            clear_survey_cache,
            clear_all_cache,
            get_cache_directory,
            // Unified cache
            get_unified_cache_entry,
            put_unified_cache_entry,
            delete_unified_cache_entry,
            clear_unified_cache,
            get_unified_cache_size,
            list_unified_cache_keys,
            get_unified_cache_stats,
            cleanup_unified_cache,
            flush_unified_cache,
            prefetch_url,
            prefetch_urls,
            // Astro events
            get_moon_phases_for_month,
            get_meteor_showers,
            get_seasonal_events,
            get_astro_events,
            get_daily_astro_events,
            get_tonight_highlights,
            // Target list
            load_target_list,
            save_target_list,
            add_target,
            add_targets_batch,
            update_target,
            remove_target,
            remove_targets_batch,
            set_active_target,
            toggle_target_favorite,
            toggle_target_archive,
            set_targets_status_batch,
            set_targets_priority_batch,
            add_tag_to_targets,
            remove_tag_from_targets,
            archive_completed_targets,
            clear_completed_targets,
            clear_all_targets,
            search_targets,
            get_target_stats,
            // Markers
            load_markers,
            save_markers,
            add_marker,
            update_marker,
            remove_marker,
            remove_markers_by_group,
            clear_all_markers,
            toggle_marker_visibility,
            set_all_markers_visible,
            set_show_markers,
            add_marker_group,
            remove_marker_group,
            rename_marker_group,
            get_visible_markers,
            // HTTP Client
            http_request,
            http_download,
            cancel_request,
            get_active_requests,
            get_effective_proxy_state,
            get_http_config,
            set_http_config,
            http_get,
            http_post,
            http_head,
            http_check_url,
            http_cancel_request,
            http_cancel_all_requests,
            http_batch_download,
            // Mount control
            mount_connect,
            mount_disconnect,
            mount_get_state,
            mount_get_capabilities,
            mount_slew_to,
            mount_sync_to,
            mount_abort_slew,
            mount_park,
            mount_unpark,
            mount_set_tracking,
            mount_set_tracking_rate,
            mount_move_axis,
            mount_stop_axis,
            mount_set_slew_rate,
            mount_discover,
            mount_get_observing_conditions,
            mount_get_safety_state,
            // Desktop-only commands
            #[cfg(desktop)]
            load_app_settings,
            #[cfg(desktop)]
            save_app_settings,
            #[cfg(desktop)]
            save_window_state,
            #[cfg(desktop)]
            restore_window_state,
            #[cfg(desktop)]
            add_recent_file,
            #[cfg(desktop)]
            clear_recent_files,
            #[cfg(desktop)]
            get_system_info,
            #[cfg(desktop)]
            open_path,
            #[cfg(desktop)]
            reveal_in_file_manager,
            // Updater (desktop only)
            #[cfg(desktop)]
            check_for_update,
            #[cfg(desktop)]
            download_update,
            #[cfg(desktop)]
            install_update,
            #[cfg(desktop)]
            download_and_install_update,
            #[cfg(desktop)]
            get_current_version,
            #[cfg(desktop)]
            clear_pending_update,
            #[cfg(desktop)]
            has_pending_update,
            // App control (desktop only)
            #[cfg(desktop)]
            restart_app,
            #[cfg(desktop)]
            quit_app,
            #[cfg(desktop)]
            reload_webview,
            #[cfg(desktop)]
            is_dev_mode,
            #[cfg(desktop)]
            parse_cli_matches_from_args,
            #[cfg(desktop)]
            is_tray_positioning_ready,
            // Secure Map API Keys (desktop only)
            #[cfg(desktop)]
            save_map_api_key,
            #[cfg(desktop)]
            list_map_api_keys_meta,
            #[cfg(desktop)]
            get_map_api_key,
            #[cfg(desktop)]
            delete_map_api_key,
            #[cfg(desktop)]
            set_active_map_api_key,
            #[cfg(desktop)]
            get_or_create_secret_vault_bootstrap,
            // Plate Solver (desktop only)
            #[cfg(desktop)]
            detect_plate_solvers,
            #[cfg(desktop)]
            plate_solve,
            #[cfg(desktop)]
            cancel_plate_solve,
            #[cfg(desktop)]
            get_solver_indexes,
            #[cfg(desktop)]
            get_downloadable_indexes,
            #[cfg(desktop)]
            download_index,
            #[cfg(desktop)]
            get_solver_info,
            #[cfg(desktop)]
            validate_solver_path,
            #[cfg(desktop)]
            solve_image_local,
            #[cfg(desktop)]
            get_available_indexes,
            #[cfg(desktop)]
            get_installed_indexes,
            #[cfg(desktop)]
            delete_index,
            #[cfg(desktop)]
            get_recommended_indexes,
            #[cfg(desktop)]
            get_default_index_path,
            #[cfg(desktop)]
            save_solver_config,
            #[cfg(desktop)]
            load_solver_config,
            // New plate solver commands
            #[cfg(desktop)]
            get_astap_databases,
            #[cfg(desktop)]
            recommend_astap_database,
            #[cfg(desktop)]
            analyse_image,
            #[cfg(desktop)]
            extract_stars,
            #[cfg(desktop)]
            solve_online,
            #[cfg(desktop)]
            cancel_online_solve,
            // Path config (desktop only)
            #[cfg(desktop)]
            get_path_config,
            #[cfg(desktop)]
            set_custom_data_dir,
            #[cfg(desktop)]
            set_custom_cache_dir,
            #[cfg(desktop)]
            migrate_data_dir,
            #[cfg(desktop)]
            migrate_cache_dir,
            #[cfg(desktop)]
            reset_paths_to_default,
            #[cfg(desktop)]
            validate_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
pub fn run() {}

#[cfg(test)]
mod tests {
    use super::{desktop_debug_tooling_enabled, persistent_logging_enabled};

    #[test]
    fn desktop_runtime_policy_enables_debug_tooling_for_debug_desktop_mode() {
        assert!(desktop_debug_tooling_enabled(true, true));
        assert!(!desktop_debug_tooling_enabled(true, false));
        assert!(!desktop_debug_tooling_enabled(false, true));
    }

    #[test]
    fn desktop_runtime_policy_keeps_persistent_logging_out_of_debug_desktop_mode() {
        assert!(!persistent_logging_enabled(true, true));
        assert!(persistent_logging_enabled(true, false));
        assert!(persistent_logging_enabled(false, true));
        assert!(persistent_logging_enabled(false, false));
    }
}
