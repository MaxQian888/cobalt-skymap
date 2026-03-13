//! Mount control type definitions
//!
//! Shared types for mount communication (Alpaca client and simulator).

use serde::{Deserialize, Serialize};

// ============================================================================
// Protocol & Connection
// ============================================================================

/// Supported mount communication protocols
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MountProtocol {
    Alpaca,
    Simulator,
}

/// Connection configuration for a mount device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub protocol: MountProtocol,
    pub host: String,
    pub port: u16,
    pub device_id: u32,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            protocol: MountProtocol::Simulator,
            host: "localhost".to_string(),
            port: 11111,
            device_id: 0,
        }
    }
}

// ============================================================================
// Mount State
// ============================================================================

/// Tracking rate presets
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrackingRate {
    Sidereal,
    Lunar,
    Solar,
    Stopped,
}

/// Pier side (for German Equatorial Mounts)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PierSide {
    East,
    West,
    Unknown,
}

/// Mount axis identifier
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MountAxis {
    /// Right Ascension / Azimuth axis
    Primary,
    /// Declination / Altitude axis
    Secondary,
}

/// Slew speed presets (multiples of sidereal rate)
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct SlewRate {
    pub label: &'static str,
    pub value: f64,
}

/// Common slew rate presets
pub const SLEW_RATES: &[SlewRate] = &[
    SlewRate {
        label: "1x",
        value: 1.0,
    },
    SlewRate {
        label: "2x",
        value: 2.0,
    },
    SlewRate {
        label: "8x",
        value: 8.0,
    },
    SlewRate {
        label: "16x",
        value: 16.0,
    },
    SlewRate {
        label: "64x",
        value: 64.0,
    },
    SlewRate {
        label: "Max",
        value: 800.0,
    },
];

/// Sidereal rate in degrees per second
pub const SIDEREAL_RATE_DEG_PER_SEC: f64 = 15.0 / 3600.0;

/// Full mount state snapshot returned to the frontend
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MountState {
    pub connected: bool,
    pub ra: f64,
    pub dec: f64,
    pub tracking: bool,
    pub tracking_rate: TrackingRate,
    pub slewing: bool,
    pub parked: bool,
    pub at_home: bool,
    pub pier_side: PierSide,
    pub slew_rate_index: usize,
}

impl Default for MountState {
    fn default() -> Self {
        Self {
            connected: false,
            ra: 0.0,
            dec: 90.0,
            tracking: false,
            tracking_rate: TrackingRate::Sidereal,
            slewing: false,
            parked: true,
            at_home: true,
            pier_side: PierSide::Unknown,
            slew_rate_index: 3,
        }
    }
}

// ============================================================================
// Mount Capabilities
// ============================================================================

/// Reported device capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MountCapabilities {
    pub can_slew: bool,
    pub can_slew_async: bool,
    pub can_sync: bool,
    pub can_park: bool,
    pub can_unpark: bool,
    pub can_set_tracking: bool,
    pub can_move_axis: bool,
    pub can_pulse_guide: bool,
    pub alignment_mode: String,
    pub equatorial_system: String,
}

impl Default for MountCapabilities {
    fn default() -> Self {
        Self {
            can_slew: true,
            can_slew_async: true,
            can_sync: true,
            can_park: true,
            can_unpark: true,
            can_set_tracking: true,
            can_move_axis: true,
            can_pulse_guide: true,
            alignment_mode: "GermanPolar".to_string(),
            equatorial_system: "J2000".to_string(),
        }
    }
}

// ============================================================================
// Alpaca Discovery
// ============================================================================

/// A device discovered via Alpaca UDP broadcast
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredDevice {
    pub id: String,
    pub protocol: MountProtocol,
    pub host: String,
    pub port: u16,
    pub device_id: u32,
    pub name: String,
    pub device_type: String,
    pub source: String,
    pub unique_id: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub description: Option<String>,
    pub driver_info: Option<String>,
    pub driver_version: Option<String>,
}

// ============================================================================
// Observing Conditions & Safety
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ObservingConditions {
    pub cloud_cover: Option<f64>,
    pub humidity: Option<f64>,
    pub wind_speed: Option<f64>,
    pub dew_point: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetyState {
    pub is_safe: bool,
    pub source: String,
}

// ============================================================================
// Error Types
// ============================================================================

/// Mount operation errors
#[derive(Debug, thiserror::Error)]
pub enum MountError {
    #[error("Mount not connected")]
    NotConnected,

    #[error("Connection failed: {0}")]
    ConnectionFailed(String),

    #[error("Alpaca error ({code}): {message}")]
    AlpacaError { code: i32, message: String },

    #[error("HTTP request failed: {0}")]
    HttpError(String),

    #[error("Mount is parked")]
    Parked,

    #[error("Mount is already slewing")]
    AlreadySlewing,

    #[error("Target below horizon")]
    BelowHorizon,

    #[error("Operation not supported: {0}")]
    NotSupported(String),

    #[error("Timeout: {0}")]
    Timeout(String),

    #[error("{0}")]
    Other(String),
}

impl From<reqwest::Error> for MountError {
    fn from(e: reqwest::Error) -> Self {
        MountError::HttpError(e.to_string())
    }
}

impl Serialize for MountError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn connection_config_defaults_to_local_simulator() {
        let config = ConnectionConfig::default();

        assert_eq!(config.protocol, MountProtocol::Simulator);
        assert_eq!(config.host, "localhost");
        assert_eq!(config.port, 11111);
        assert_eq!(config.device_id, 0);
    }

    #[test]
    fn mount_state_default_matches_parked_home_state() {
        let state = MountState::default();

        assert!(!state.connected);
        assert_eq!(state.ra, 0.0);
        assert_eq!(state.dec, 90.0);
        assert!(!state.tracking);
        assert_eq!(state.tracking_rate, TrackingRate::Sidereal);
        assert!(!state.slewing);
        assert!(state.parked);
        assert!(state.at_home);
        assert_eq!(state.pier_side, PierSide::Unknown);
        assert_eq!(state.slew_rate_index, 3);
    }

    #[test]
    fn mount_capabilities_default_matches_simulator_capabilities() {
        let capabilities = MountCapabilities::default();

        assert!(capabilities.can_slew);
        assert!(capabilities.can_slew_async);
        assert!(capabilities.can_sync);
        assert!(capabilities.can_park);
        assert!(capabilities.can_unpark);
        assert!(capabilities.can_set_tracking);
        assert!(capabilities.can_move_axis);
        assert!(capabilities.can_pulse_guide);
        assert_eq!(capabilities.alignment_mode, "GermanPolar");
        assert_eq!(capabilities.equatorial_system, "J2000");
    }

    #[test]
    fn serde_uses_expected_case_conventions() {
        let state = MountState {
            connected: true,
            ra: 180.0,
            dec: -12.5,
            tracking: true,
            tracking_rate: TrackingRate::Solar,
            slewing: false,
            parked: false,
            at_home: false,
            pier_side: PierSide::West,
            slew_rate_index: 4,
        };

        let serialized_state = serde_json::to_value(&state).expect("state should serialize");
        let serialized_protocol =
            serde_json::to_value(MountProtocol::Alpaca).expect("protocol should serialize");
        let serialized_axis =
            serde_json::to_value(MountAxis::Secondary).expect("axis should serialize");

        assert_eq!(serialized_state["trackingRate"], json!("solar"));
        assert_eq!(serialized_state["pierSide"], json!("west"));
        assert_eq!(serialized_state["slewRateIndex"], json!(4));
        assert_eq!(serialized_protocol, json!("alpaca"));
        assert_eq!(serialized_axis, json!("secondary"));
    }

    #[test]
    fn mount_error_serializes_to_display_string() {
        let error = MountError::AlpacaError {
            code: 1031,
            message: "Mount busy".to_string(),
        };

        let serialized = serde_json::to_string(&error).expect("mount error should serialize");

        assert_eq!(serialized, "\"Alpaca error (1031): Mount busy\"");
        assert_eq!(MountError::Parked.to_string(), "Mount is parked");
    }
}
