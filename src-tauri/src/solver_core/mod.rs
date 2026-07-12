//! Platform-agnostic plate-solver core.
//!
//! Compiles on desktop AND mobile. Contains the ASTAP argument builder,
//! INI/WCS/stdout result parsers, workspace helpers, database catalog +
//! download, and all shared types. Desktop-only concerns (solver detection
//! on well-known install paths, solve-field/astrometry.net, config
//! persistence) stay in `platform::plate_solver`, which re-uses this core.
//!
//! Do NOT add desktop-only dependencies (updater, app_settings, tray, ...)
//! here — this module must keep building for `aarch64-linux-android`.

pub mod astap;
pub mod fits;
pub mod types;
pub mod workspace;
