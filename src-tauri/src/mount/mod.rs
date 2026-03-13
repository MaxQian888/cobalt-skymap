//! Mount control module
//!
//! Provides telescope mount communication via:
//! - ASCOM Alpaca REST API
//! - Built-in simulator (for development/testing)
//!
//! Submodules:
//! - `types`: Shared type definitions
//! - `simulator`: Built-in mount simulator
//! - `alpaca_client`: ASCOM Alpaca REST client
//! - `commands`: Tauri commands

pub mod alpaca_client;
pub mod commands;
pub mod simulator;
pub mod types;

pub use commands::{
    mount_abort_slew, mount_connect, mount_disconnect, mount_discover, mount_get_capabilities,
    mount_get_observing_conditions, mount_get_safety_state, mount_get_state, mount_move_axis,
    mount_park, mount_set_slew_rate, mount_set_tracking, mount_set_tracking_rate, mount_slew_to,
    mount_stop_axis, mount_sync_to, mount_unpark,
};
