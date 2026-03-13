//! Astronomy calculations module
//! Provides high-performance astronomical calculations for the desktop application
//!
//! Submodules:
//! - `types`: Coordinate and result types
//! - `common`: Constants, regex patterns, and helper functions
//! - `time`: Julian Date, GMST, LST, hour angle
//! - `coordinates`: Coordinate conversions (equatorial, horizontal, galactic, ecliptic)
//! - `visibility`: Target visibility calculations
//! - `twilight`: Twilight and sunrise/sunset calculations
//! - `moon`: Moon phase and position
//! - `sun`: Sun position
//! - `imaging`: FOV and mosaic coverage
//! - `formatting`: RA/Dec formatting and parsing

pub mod common;
pub mod coordinates;
pub mod formatting;
pub mod imaging;
pub mod moon;
pub mod sun;
pub mod time;
pub mod twilight;
pub mod types;
pub mod visibility;

// Re-export all public types
pub use types::{
    EclipticCoords, EquatorialCoords, FOVResult, GalacticCoords, GeoLocation, HorizontalCoords,
    MoonPhase, MoonPosition, MosaicCoverage, SunPosition, TwilightTimes, VisibilityInfo,
};

// Re-export all Tauri commands
pub use coordinates::{
    angular_separation, ecliptic_to_equatorial, equatorial_to_ecliptic, equatorial_to_galactic,
    equatorial_to_horizontal, galactic_to_equatorial, horizontal_to_equatorial,
};
pub use formatting::{format_dec_dms, format_ra_hms, parse_dec_dms, parse_ra_hms};
pub use imaging::{calculate_fov, calculate_mosaic_coverage};
pub use moon::{calculate_moon_phase, calculate_moon_position};
pub use sun::calculate_sun_position;
pub use twilight::calculate_twilight;
pub use visibility::calculate_visibility;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reexports_expose_core_calculation_api() {
        let location = GeoLocation {
            latitude: 35.6895,
            longitude: 139.6917,
            altitude: 40.0,
        };
        assert_eq!(location.altitude, 40.0);

        let formatted_ra = format_ra_hms(83.6331);
        let parsed_ra = parse_ra_hms(formatted_ra).unwrap();
        assert!((parsed_ra - 83.6331).abs() < 1e-3);

        let separation = angular_separation(parsed_ra, 22.0145, parsed_ra, 22.0145);
        assert!(separation.abs() < 1e-9);

        let fov = calculate_fov(36.0, 24.0, 400.0, 4.3, 80.0);
        assert!(fov.width_deg > fov.height_deg);
        assert!((fov.f_ratio - 5.0).abs() < 1e-9);
    }
}
