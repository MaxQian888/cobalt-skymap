//! App control commands for restart and quit functionality

use std::sync::atomic::{AtomicBool, Ordering};

use serde::Deserialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};

#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub const MAIN_TRAY_ID: &str = "main-tray";
pub const TRAY_ACTIVATED_EVENT: &str = "skymap-tray-activated";

// Stable, locale-independent identifiers for the tray context-menu items.
pub const TRAY_SHOW_ID: &str = "tray-show";
pub const TRAY_ROUTE_STARMAP_ID: &str = "tray-route-starmap";
pub const TRAY_ROUTE_SEARCH_ID: &str = "tray-route-search";
pub const TRAY_ROUTE_SETTINGS_ID: &str = "tray-route-settings";
pub const TRAY_ROUTE_SESSION_PLANNER_ID: &str = "tray-route-session-planner";
pub const TRAY_ROUTE_PLATE_SOLVER_ID: &str = "tray-route-plate-solver";
pub const TRAY_QUIT_ID: &str = "tray-quit";

/// Localized labels for the tray context menu, supplied by the frontend once the
/// active locale is known. Defaults are English so the menu is always usable,
/// even before the webview finishes booting.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayMenuLabels {
    pub show: String,
    pub starmap: String,
    pub search: String,
    pub settings: String,
    pub session_planner: String,
    pub plate_solver: String,
    pub quit: String,
}

impl Default for TrayMenuLabels {
    fn default() -> Self {
        Self {
            show: "Show Cobalt Skymap".to_string(),
            starmap: "Star Map".to_string(),
            search: "Search…".to_string(),
            settings: "Settings".to_string(),
            session_planner: "Session Planner".to_string(),
            plate_solver: "Plate Solver".to_string(),
            quit: "Quit Cobalt Skymap".to_string(),
        }
    }
}

/// Resolved intent for a tray context-menu selection.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrayMenuAction {
    /// Reveal and focus the main window.
    Show,
    /// Reveal the window and open a named application surface (reusing the CLI
    /// route pipeline the frontend already understands).
    OpenRoute(&'static str),
    /// Exit the application.
    Quit,
}

/// Map a stable menu-item id to its action. Pure so it can be unit-tested
/// without a running Tauri app.
fn tray_menu_action(menu_id: &str) -> Option<TrayMenuAction> {
    match menu_id {
        TRAY_SHOW_ID => Some(TrayMenuAction::Show),
        TRAY_ROUTE_STARMAP_ID => Some(TrayMenuAction::OpenRoute("starmap")),
        TRAY_ROUTE_SEARCH_ID => Some(TrayMenuAction::OpenRoute("search")),
        TRAY_ROUTE_SETTINGS_ID => Some(TrayMenuAction::OpenRoute("settings")),
        TRAY_ROUTE_SESSION_PLANNER_ID => Some(TrayMenuAction::OpenRoute("session-planner")),
        TRAY_ROUTE_PLATE_SOLVER_ID => Some(TrayMenuAction::OpenRoute("plate-solver")),
        TRAY_QUIT_ID => Some(TrayMenuAction::Quit),
        _ => None,
    }
}

#[derive(Debug, Default)]
pub struct TrayRuntimeState {
    tray_initialized: AtomicBool,
    tray_positioning_ready: AtomicBool,
    close_to_tray: AtomicBool,
}

impl TrayRuntimeState {
    pub fn can_emit_activation(&self) -> bool {
        self.tray_initialized.load(Ordering::Relaxed)
    }

    pub fn is_positioning_ready(&self) -> bool {
        self.tray_positioning_ready.load(Ordering::Relaxed)
    }

    pub fn set_initialized(&self, initialized: bool) {
        self.tray_initialized.store(initialized, Ordering::Relaxed);
    }

    pub fn set_positioning_ready(&self, ready: bool) {
        self.tray_positioning_ready.store(ready, Ordering::Relaxed);
    }

    pub fn close_to_tray_enabled(&self) -> bool {
        self.close_to_tray.load(Ordering::Relaxed)
    }

    pub fn set_close_to_tray(&self, enabled: bool) {
        self.close_to_tray.store(enabled, Ordering::Relaxed);
    }

    /// Whether a window-close request should hide to the tray instead of
    /// exiting. Only honored once the tray exists, so the window can never be
    /// hidden with no way to bring it back.
    pub fn should_hide_on_close(&self) -> bool {
        self.tray_initialized.load(Ordering::Relaxed) && self.close_to_tray.load(Ordering::Relaxed)
    }
}

fn tray_positioning_supported() -> bool {
    !cfg!(target_os = "linux")
}

#[cfg(desktop)]
fn should_emit_tray_activation(button: MouseButton, button_state: MouseButtonState) -> bool {
    matches!(button, MouseButton::Left) && matches!(button_state, MouseButtonState::Up)
}

/// Build the tray context menu from the given (possibly localized) labels.
#[cfg(desktop)]
fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    labels: &TrayMenuLabels,
) -> Result<Menu<R>, String> {
    let item = |id: &str, text: &str| {
        MenuItem::with_id(app, id, text, true, None::<&str>)
            .map_err(|error| format!("Failed to create tray menu item '{id}': {error}"))
    };
    let separator = || {
        PredefinedMenuItem::separator(app)
            .map_err(|error| format!("Failed to create tray menu separator: {error}"))
    };

    let show = item(TRAY_SHOW_ID, &labels.show)?;
    let separator_top = separator()?;
    let starmap = item(TRAY_ROUTE_STARMAP_ID, &labels.starmap)?;
    let search = item(TRAY_ROUTE_SEARCH_ID, &labels.search)?;
    let settings = item(TRAY_ROUTE_SETTINGS_ID, &labels.settings)?;
    let session_planner = item(TRAY_ROUTE_SESSION_PLANNER_ID, &labels.session_planner)?;
    let plate_solver = item(TRAY_ROUTE_PLATE_SOLVER_ID, &labels.plate_solver)?;
    let separator_bottom = separator()?;
    let quit = item(TRAY_QUIT_ID, &labels.quit)?;

    Menu::with_items(
        app,
        &[
            &show,
            &separator_top,
            &starmap,
            &search,
            &settings,
            &session_planner,
            &plate_solver,
            &separator_bottom,
            &quit,
        ],
    )
    .map_err(|error| format!("Failed to build tray menu: {error}"))
}

/// Bring the main window back to the foreground (used by the tray "Show" item).
#[cfg(desktop)]
fn reveal_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Dispatch a tray context-menu selection to the matching action.
#[cfg(desktop)]
fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    match tray_menu_action(event.id.as_ref()) {
        Some(TrayMenuAction::Show) => reveal_main_window(app),
        Some(TrayMenuAction::OpenRoute(route)) => {
            // Reuse the CLI route pipeline: this shows/focuses the window and
            // emits the intent the frontend's CliLaunchProvider already handles.
            super::cli::handle_forwarded_cli_invocation(
                app,
                vec![
                    "cobalt-skymap".to_string(),
                    "open".to_string(),
                    "route".to_string(),
                    route.to_string(),
                ],
                String::new(),
            );
        }
        Some(TrayMenuAction::Quit) => {
            log::info!("Quitting application from tray menu");
            app.exit(0);
        }
        None => {}
    }
}

#[cfg(desktop)]
pub fn initialize_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let state = app.state::<TrayRuntimeState>();
    state.set_initialized(false);
    state.set_positioning_ready(false);

    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        "Default window icon is not available for tray initialization".to_string()
    })?;

    let menu = build_tray_menu(app, &TrayMenuLabels::default())?;

    TrayIconBuilder::with_id(MAIN_TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip("Cobalt Skymap")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_tray_menu_event(app, event))
        .build(app)
        .map_err(|error| format!("Failed to build tray icon: {error}"))?;

    state.set_initialized(true);

    let ready = tray_positioning_supported();
    state.set_positioning_ready(ready);

    if ready {
        log::info!("Tray icon initialized; tray-relative positioning is ready");
    } else {
        log::info!(
            "Tray icon initialized, but tray-relative positioning remains unavailable on this platform"
        );
    }

    Ok(())
}

#[cfg(desktop)]
pub fn handle_tray_icon_event<R: Runtime>(app: &AppHandle<R>, event: &TrayIconEvent) {
    if !app.state::<TrayRuntimeState>().can_emit_activation() {
        return;
    }

    match event {
        TrayIconEvent::Click {
            button,
            button_state,
            ..
        } if should_emit_tray_activation(*button, *button_state) => {
            if let Err(error) = app.emit(TRAY_ACTIVATED_EVENT, ()) {
                log::warn!("Failed to emit tray activation event: {error}");
            }
        }
        TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        } => {
            if let Err(error) = app.emit(TRAY_ACTIVATED_EVENT, ()) {
                log::warn!("Failed to emit tray activation event on double click: {error}");
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn restart_app<R: Runtime>(app: AppHandle<R>) {
    log::info!("Restarting application...");
    app.restart();
}

#[tauri::command]
pub fn quit_app<R: Runtime>(app: AppHandle<R>, exit_code: Option<i32>) {
    let code = exit_code.unwrap_or(0);
    log::info!("Quitting application with exit code: {}", code);
    app.exit(code);
}

#[tauri::command]
pub async fn reload_webview<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    log::info!("Reloading webview...");
    if let Some(window) = app.get_webview_window("main") {
        window
            .eval("window.location.reload()")
            .map_err(|e| format!("Failed to reload: {}", e))?;
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub fn is_dev_mode() -> bool {
    cfg!(debug_assertions)
}

#[tauri::command]
pub fn is_tray_positioning_ready(state: State<'_, TrayRuntimeState>) -> bool {
    state.is_positioning_ready()
}

/// Rebuild the tray context menu with localized labels supplied by the frontend.
#[cfg(desktop)]
#[tauri::command]
pub fn update_tray_menu<R: Runtime>(
    app: AppHandle<R>,
    labels: TrayMenuLabels,
) -> Result<(), String> {
    let tray = app
        .tray_by_id(MAIN_TRAY_ID)
        .ok_or_else(|| "Tray icon is not initialized".to_string())?;
    let menu = build_tray_menu(&app, &labels)?;
    tray.set_menu(Some(menu))
        .map_err(|error| format!("Failed to update tray menu: {error}"))?;
    Ok(())
}

/// Toggle whether closing the window hides it to the tray instead of quitting.
#[cfg(desktop)]
#[tauri::command]
pub fn set_close_to_tray(state: State<'_, TrayRuntimeState>, enabled: bool) {
    state.set_close_to_tray(enabled);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_dev_mode() {
        let result = is_dev_mode();
        #[cfg(debug_assertions)]
        assert!(result);
        #[cfg(not(debug_assertions))]
        assert!(!result);
    }

    #[test]
    fn test_is_dev_mode_consistency() {
        assert_eq!(is_dev_mode(), is_dev_mode());
    }

    #[test]
    fn test_tray_positioning_support_flag_matches_platform() {
        #[cfg(target_os = "linux")]
        assert!(!tray_positioning_supported());

        #[cfg(not(target_os = "linux"))]
        assert!(tray_positioning_supported());
    }

    #[test]
    fn test_tray_runtime_state_keeps_activation_available_without_positioning() {
        let state = TrayRuntimeState::default();

        assert!(!state.can_emit_activation());
        assert!(!state.is_positioning_ready());

        state.set_initialized(true);

        assert!(state.can_emit_activation());
        assert!(!state.is_positioning_ready());

        state.set_positioning_ready(true);

        assert!(state.can_emit_activation());
        assert!(state.is_positioning_ready());
    }

    #[test]
    fn test_close_to_tray_only_hides_once_tray_is_initialized() {
        let state = TrayRuntimeState::default();

        // Disabled by default.
        assert!(!state.close_to_tray_enabled());
        assert!(!state.should_hide_on_close());

        // Enabling the preference alone is not enough without a tray to restore from.
        state.set_close_to_tray(true);
        assert!(state.close_to_tray_enabled());
        assert!(!state.should_hide_on_close());

        // Once the tray exists, closing hides to tray.
        state.set_initialized(true);
        assert!(state.should_hide_on_close());

        // Turning the preference back off resumes normal close-to-quit behavior.
        state.set_close_to_tray(false);
        assert!(!state.should_hide_on_close());
    }

    #[test]
    fn test_tray_menu_action_maps_every_known_id() {
        assert_eq!(tray_menu_action(TRAY_SHOW_ID), Some(TrayMenuAction::Show));
        assert_eq!(
            tray_menu_action(TRAY_ROUTE_STARMAP_ID),
            Some(TrayMenuAction::OpenRoute("starmap"))
        );
        assert_eq!(
            tray_menu_action(TRAY_ROUTE_SEARCH_ID),
            Some(TrayMenuAction::OpenRoute("search"))
        );
        assert_eq!(
            tray_menu_action(TRAY_ROUTE_SETTINGS_ID),
            Some(TrayMenuAction::OpenRoute("settings"))
        );
        assert_eq!(
            tray_menu_action(TRAY_ROUTE_SESSION_PLANNER_ID),
            Some(TrayMenuAction::OpenRoute("session-planner"))
        );
        assert_eq!(
            tray_menu_action(TRAY_ROUTE_PLATE_SOLVER_ID),
            Some(TrayMenuAction::OpenRoute("plate-solver"))
        );
        assert_eq!(tray_menu_action(TRAY_QUIT_ID), Some(TrayMenuAction::Quit));
        assert_eq!(tray_menu_action("unknown-id"), None);
    }

    #[test]
    fn test_tray_menu_routes_match_cli_possible_values() {
        // These must stay in lockstep with the CLI `open route` possibleValues
        // in tauri.conf.json so the frontend route pipeline accepts them.
        let routes: Vec<&str> = [
            TRAY_ROUTE_STARMAP_ID,
            TRAY_ROUTE_SEARCH_ID,
            TRAY_ROUTE_SETTINGS_ID,
            TRAY_ROUTE_SESSION_PLANNER_ID,
            TRAY_ROUTE_PLATE_SOLVER_ID,
        ]
        .iter()
        .filter_map(|id| match tray_menu_action(id) {
            Some(TrayMenuAction::OpenRoute(route)) => Some(route),
            _ => None,
        })
        .collect();

        assert_eq!(
            routes,
            vec!["starmap", "search", "settings", "session-planner", "plate-solver"]
        );
    }

    #[test]
    fn test_default_tray_menu_labels_are_populated() {
        let labels = TrayMenuLabels::default();
        assert!(!labels.show.is_empty());
        assert!(!labels.starmap.is_empty());
        assert!(!labels.search.is_empty());
        assert!(!labels.settings.is_empty());
        assert!(!labels.session_planner.is_empty());
        assert!(!labels.plate_solver.is_empty());
        assert!(!labels.quit.is_empty());
    }

    #[test]
    fn test_tray_menu_labels_deserialize_from_camel_case() {
        let json = r#"{
            "show": "显示 Cobalt Skymap",
            "starmap": "星图",
            "search": "搜索…",
            "settings": "设置",
            "sessionPlanner": "观测计划",
            "plateSolver": "板解析",
            "quit": "退出 Cobalt Skymap"
        }"#;

        let labels: TrayMenuLabels = serde_json::from_str(json).expect("labels should deserialize");
        assert_eq!(labels.session_planner, "观测计划");
        assert_eq!(labels.plate_solver, "板解析");
        assert_eq!(labels.starmap, "星图");
    }

    #[cfg(desktop)]
    #[test]
    fn test_tray_activation_only_uses_left_button_release() {
        assert!(should_emit_tray_activation(
            MouseButton::Left,
            MouseButtonState::Up,
        ));
        assert!(!should_emit_tray_activation(
            MouseButton::Left,
            MouseButtonState::Down,
        ));
        assert!(!should_emit_tray_activation(
            MouseButton::Right,
            MouseButtonState::Up,
        ));
    }
}
