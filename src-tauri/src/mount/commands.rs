//! Tauri commands for mount control
//!
//! All commands are async and use a global `Mutex` to hold the active mount instance.

use once_cell::sync::Lazy;
use tokio::sync::Mutex;

use crate::mount::alpaca_client::AlpacaClient;
use crate::mount::simulator::MountSimulator;
use crate::mount::types::*;

// ============================================================================
// Mount driver abstraction
// ============================================================================

enum MountDriver {
    Simulator(MountSimulator),
    Alpaca(AlpacaClient),
}

static MOUNT: Lazy<Mutex<Option<MountDriver>>> = Lazy::new(|| Mutex::new(None));

/// Tracks the user-selected slew rate index (shared across drivers)
static SLEW_RATE_INDEX: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(3);

// ============================================================================
// Connection commands
// ============================================================================

#[tauri::command]
pub async fn mount_connect(
    protocol: MountProtocol,
    host: String,
    port: u16,
    device_id: u32,
) -> Result<MountCapabilities, MountError> {
    let mut guard = MOUNT.lock().await;

    // Disconnect existing if any
    if let Some(ref mut driver) = *guard {
        match driver {
            MountDriver::Simulator(sim) => {
                let _ = sim.disconnect();
            }
            MountDriver::Alpaca(client) => {
                let _ = client.disconnect().await;
            }
        }
    }

    match protocol {
        MountProtocol::Simulator => {
            let mut sim = MountSimulator::new();
            sim.connect()?;
            let caps = sim.get_capabilities();
            *guard = Some(MountDriver::Simulator(sim));
            log::info!("Mount connected via Simulator");
            Ok(caps)
        }
        MountProtocol::Alpaca => {
            let client = AlpacaClient::new(&host, port, device_id);
            client.connect().await.map_err(|e| {
                MountError::ConnectionFailed(format!(
                    "Alpaca connection to {}:{} failed: {}",
                    host, port, e
                ))
            })?;
            let caps = client.get_capabilities().await.unwrap_or_default();
            *guard = Some(MountDriver::Alpaca(client));
            log::info!("Mount connected via Alpaca to {}:{}", host, port);
            Ok(caps)
        }
    }
}

#[tauri::command]
pub async fn mount_disconnect() -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    if let Some(ref mut driver) = *guard {
        match driver {
            MountDriver::Simulator(sim) => sim.disconnect()?,
            MountDriver::Alpaca(client) => client.disconnect().await?,
        }
    }
    *guard = None;
    Ok(())
}

// ============================================================================
// State query
// ============================================================================

#[tauri::command]
pub async fn mount_get_state() -> Result<MountState, MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => Ok(sim.get_state()),
        Some(MountDriver::Alpaca(client)) => {
            let mut state = client.get_state().await?;
            state.slew_rate_index = SLEW_RATE_INDEX.load(std::sync::atomic::Ordering::Relaxed);
            Ok(state)
        }
        None => Ok(MountState::default()),
    }
}

#[tauri::command]
pub async fn mount_get_capabilities() -> Result<MountCapabilities, MountError> {
    let guard = MOUNT.lock().await;
    match guard.as_ref() {
        Some(MountDriver::Simulator(sim)) => Ok(sim.get_capabilities()),
        Some(MountDriver::Alpaca(client)) => client.get_capabilities().await,
        None => Err(MountError::NotConnected),
    }
}

// ============================================================================
// Slew / Sync / Abort
// ============================================================================

/// Slew to coordinates (RA in degrees, Dec in degrees)
#[tauri::command]
pub async fn mount_slew_to(ra: f64, dec: f64) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.slew_to(ra, dec),
        Some(MountDriver::Alpaca(client)) => {
            // Alpaca expects RA in hours
            let ra_hours = ra / 15.0;
            client.slew_to_coordinates_async(ra_hours, dec).await
        }
        None => Err(MountError::NotConnected),
    }
}

/// Sync mount to coordinates (RA in degrees, Dec in degrees)
#[tauri::command]
pub async fn mount_sync_to(ra: f64, dec: f64) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.sync_to(ra, dec),
        Some(MountDriver::Alpaca(client)) => {
            let ra_hours = ra / 15.0;
            client.sync_to_coordinates(ra_hours, dec).await
        }
        None => Err(MountError::NotConnected),
    }
}

#[tauri::command]
pub async fn mount_abort_slew() -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.abort_slew(),
        Some(MountDriver::Alpaca(client)) => client.abort_slew().await,
        None => Err(MountError::NotConnected),
    }
}

// ============================================================================
// Park / Unpark
// ============================================================================

#[tauri::command]
pub async fn mount_park() -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.park(),
        Some(MountDriver::Alpaca(client)) => client.park().await,
        None => Err(MountError::NotConnected),
    }
}

#[tauri::command]
pub async fn mount_unpark() -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.unpark(),
        Some(MountDriver::Alpaca(client)) => client.unpark().await,
        None => Err(MountError::NotConnected),
    }
}

// ============================================================================
// Tracking
// ============================================================================

#[tauri::command]
pub async fn mount_set_tracking(enabled: bool) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.set_tracking(enabled),
        Some(MountDriver::Alpaca(client)) => client.set_tracking(enabled).await,
        None => Err(MountError::NotConnected),
    }
}

#[tauri::command]
pub async fn mount_set_tracking_rate(rate: TrackingRate) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.set_tracking_rate(rate),
        Some(MountDriver::Alpaca(client)) => client.set_tracking_rate(rate).await,
        None => Err(MountError::NotConnected),
    }
}

// ============================================================================
// Manual motion
// ============================================================================

/// Move axis at a rate multiplier (e.g., 16.0 = 16x sidereal)
#[tauri::command]
pub async fn mount_move_axis(axis: MountAxis, rate: f64) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.move_axis(axis, rate),
        Some(MountDriver::Alpaca(client)) => {
            // Alpaca MoveAxis expects rate in degrees/sec
            let deg_per_sec = rate * SIDEREAL_RATE_DEG_PER_SEC;
            client.move_axis(axis, deg_per_sec).await
        }
        None => Err(MountError::NotConnected),
    }
}

#[tauri::command]
pub async fn mount_stop_axis(axis: MountAxis) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => sim.stop_axis(axis),
        Some(MountDriver::Alpaca(client)) => client.stop_axis(axis).await,
        None => Err(MountError::NotConnected),
    }
}

/// Set the slew rate index (for UI display, simulator uses internally)
#[tauri::command]
pub async fn mount_set_slew_rate(index: usize) -> Result<(), MountError> {
    let mut guard = MOUNT.lock().await;
    match guard.as_mut() {
        Some(MountDriver::Simulator(sim)) => {
            sim.set_slew_rate_index(index);
            SLEW_RATE_INDEX.store(index, std::sync::atomic::Ordering::Relaxed);
            Ok(())
        }
        Some(MountDriver::Alpaca(_)) => {
            SLEW_RATE_INDEX.store(index, std::sync::atomic::Ordering::Relaxed);
            Ok(())
        }
        None => Err(MountError::NotConnected),
    }
}

// ============================================================================
// Discovery
// ============================================================================

#[tauri::command]
pub async fn mount_discover() -> Result<Vec<DiscoveredDevice>, MountError> {
    AlpacaClient::discover(3000).await
}

#[tauri::command]
pub async fn mount_get_observing_conditions() -> Result<ObservingConditions, MountError> {
    let guard = MOUNT.lock().await;
    match guard.as_ref() {
        Some(MountDriver::Simulator(_)) => Ok(ObservingConditions {
            cloud_cover: Some(20.0),
            humidity: Some(55.0),
            wind_speed: Some(6.0),
            dew_point: Some(8.0),
        }),
        Some(MountDriver::Alpaca(client)) => client.get_observing_conditions().await,
        None => Err(MountError::NotConnected),
    }
}

#[tauri::command]
pub async fn mount_get_safety_state() -> Result<SafetyState, MountError> {
    let guard = MOUNT.lock().await;
    match guard.as_ref() {
        Some(MountDriver::Simulator(_)) => Ok(SafetyState {
            is_safe: true,
            source: "simulator".to_string(),
        }),
        Some(MountDriver::Alpaca(client)) => client.get_safety_state().await,
        None => Err(MountError::NotConnected),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::Ordering;
    use std::time::Duration;

    use super::*;

    static TEST_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

    async fn reset_mount_state() {
        let mut guard = MOUNT.lock().await;
        *guard = None;
        SLEW_RATE_INDEX.store(3, Ordering::Relaxed);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn disconnected_commands_report_default_state_and_errors() {
        let _suite_guard = TEST_LOCK.lock().await;
        reset_mount_state().await;

        let state = mount_get_state()
            .await
            .expect("getting state without a connection should succeed");
        let capabilities = mount_get_capabilities().await;

        assert!(!state.connected);
        assert_eq!(state.ra, 0.0);
        assert_eq!(state.dec, 90.0);
        assert!(state.parked);
        assert!(state.at_home);
        assert_eq!(state.slew_rate_index, 3);
        assert!(matches!(capabilities, Err(MountError::NotConnected)));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn simulator_connect_and_disconnect_cycle_updates_state() {
        let _suite_guard = TEST_LOCK.lock().await;
        reset_mount_state().await;

        let capabilities =
            mount_connect(MountProtocol::Simulator, "localhost".to_string(), 11111, 0)
                .await
                .expect("simulator should connect");
        let connected_state = mount_get_state()
            .await
            .expect("connected simulator state should be readable");

        assert!(capabilities.can_slew);
        assert!(connected_state.connected);
        assert!(connected_state.parked);
        assert_eq!(connected_state.slew_rate_index, 3);

        mount_disconnect()
            .await
            .expect("disconnect should clear the active mount");

        let disconnected_state = mount_get_state()
            .await
            .expect("state should still be readable after disconnect");
        assert!(!disconnected_state.connected);
        assert_eq!(disconnected_state.ra, 0.0);
        assert_eq!(disconnected_state.dec, 90.0);
        assert!(disconnected_state.parked);
        assert!(disconnected_state.at_home);
        assert_eq!(disconnected_state.slew_rate_index, 3);
    }

    #[tokio::test(flavor = "current_thread")]
    async fn simulator_commands_require_unpark_before_motion() {
        let _suite_guard = TEST_LOCK.lock().await;
        reset_mount_state().await;
        mount_connect(MountProtocol::Simulator, "localhost".to_string(), 11111, 0)
            .await
            .expect("simulator should connect");

        let tracking_result = mount_set_tracking(true).await;
        let move_axis_result = mount_move_axis(MountAxis::Primary, 16.0).await;

        assert!(matches!(tracking_result, Err(MountError::Parked)));
        assert!(matches!(move_axis_result, Err(MountError::Parked)));
    }

    #[tokio::test(flavor = "current_thread")]
    async fn simulator_commands_update_motion_state_and_auxiliary_queries() {
        let _suite_guard = TEST_LOCK.lock().await;
        reset_mount_state().await;
        mount_connect(MountProtocol::Simulator, "localhost".to_string(), 11111, 0)
            .await
            .expect("simulator should connect");
        mount_unpark()
            .await
            .expect("simulator should unpark before motion commands");
        mount_set_tracking(false)
            .await
            .expect("tracking should be configurable once unparked");
        mount_set_slew_rate(1)
            .await
            .expect("valid slew rate index should be accepted");
        mount_sync_to(45.0, -20.0)
            .await
            .expect("sync should update the simulator immediately");

        let synced_state = mount_get_state()
            .await
            .expect("synced state should be available");
        assert!(synced_state.connected);
        assert!(!synced_state.parked);
        assert!((synced_state.ra - 45.0).abs() < 0.001);
        assert!((synced_state.dec + 20.0).abs() < 0.001);
        assert_eq!(synced_state.slew_rate_index, 1);

        mount_slew_to(180.0, 30.0)
            .await
            .expect("slew should start on unparked simulator");
        tokio::time::sleep(Duration::from_millis(20)).await;

        let slewing_state = mount_get_state()
            .await
            .expect("slew progress should be observable");
        assert!(slewing_state.slewing);
        assert!(!slewing_state.at_home);

        mount_abort_slew()
            .await
            .expect("abort should stop simulator slew");
        let aborted_state = mount_get_state()
            .await
            .expect("state should be available after abort");
        assert!(!aborted_state.slewing);

        let conditions = mount_get_observing_conditions()
            .await
            .expect("simulator should expose canned observing conditions");
        let safety_state = mount_get_safety_state()
            .await
            .expect("simulator should expose a safe safety state");

        assert_eq!(conditions.cloud_cover, Some(20.0));
        assert_eq!(conditions.humidity, Some(55.0));
        assert_eq!(conditions.wind_speed, Some(6.0));
        assert_eq!(conditions.dew_point, Some(8.0));
        assert!(safety_state.is_safe);
        assert_eq!(safety_state.source, "simulator");
    }
}
