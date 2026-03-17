//! App control commands for restart and quit functionality

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

#[cfg(desktop)]
use tauri::{
    menu::Menu,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

pub const MAIN_TRAY_ID: &str = "main-tray";
pub const TRAY_ACTIVATED_EVENT: &str = "skymap-tray-activated";

#[derive(Debug, Default)]
pub struct TrayRuntimeState {
    tray_initialized: AtomicBool,
    tray_positioning_ready: AtomicBool,
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
}

fn tray_positioning_supported() -> bool {
    !cfg!(target_os = "linux")
}

#[cfg(desktop)]
fn should_emit_tray_activation(button: MouseButton, button_state: MouseButtonState) -> bool {
    matches!(button, MouseButton::Left) && matches!(button_state, MouseButtonState::Up)
}

#[cfg(desktop)]
pub fn initialize_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let state = app.state::<TrayRuntimeState>();
    state.set_initialized(false);
    state.set_positioning_ready(false);

    let icon = app.default_window_icon().cloned().ok_or_else(|| {
        "Default window icon is not available for tray initialization".to_string()
    })?;

    let menu = Menu::new(app).map_err(|error| format!("Failed to create tray menu: {error}"))?;

    TrayIconBuilder::with_id(MAIN_TRAY_ID)
        .icon(icon)
        .menu(&menu)
        .tooltip("SkyMap")
        .show_menu_on_left_click(false)
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
