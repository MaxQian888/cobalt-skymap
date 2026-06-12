//! External astronomy data refresh (downloads that must be processed in Rust).
//!
//! Most external data sources in this app go through the frontend `smartFetch`
//! (which routes through the Rust HTTP client in Tauri, bypassing CORS, with the
//! shared cache policies). This module is reserved for the cases that genuinely
//! need native processing — currently MPC orbital-element refresh, which gunzips
//! a large file, filters asteroids by magnitude, and writes files the Stellarium
//! WASM engine can re-fetch.

pub mod mpc;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExternalDataError {
    #[error("security: {0}")]
    Security(String),
    #[error("http: {0}")]
    Http(String),
    #[error("io: {0}")]
    Io(String),
    #[error("decode: {0}")]
    Decode(String),
}

impl serde::Serialize for ExternalDataError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl From<std::io::Error> for ExternalDataError {
    fn from(e: std::io::Error) -> Self {
        ExternalDataError::Io(e.to_string())
    }
}
