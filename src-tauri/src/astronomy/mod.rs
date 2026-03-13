//! Astronomy module
//! Provides high-performance astronomical calculations for the desktop application
//!
//! Submodules:
//! - `calculations`: Core astronomical calculations (coordinates, time, visibility, imaging)
//! - `events`: Astronomical events (moon phases, meteor showers, seasonal events)

pub mod calculations;
pub mod events;

// Re-export commonly used items
pub use calculations::{
    // Tauri commands
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
    horizontal_to_equatorial,
    parse_dec_dms,
    parse_ra_hms,
    EclipticCoords,
    // Coordinate types
    EquatorialCoords,
    // Result types
    FOVResult,
    GalacticCoords,
    GeoLocation,
    HorizontalCoords,
    MoonPhase,
    MoonPosition,
    MosaicCoverage,
    SunPosition,
    TwilightTimes,
    VisibilityInfo,
};

pub use events::{
    // Tauri commands
    get_astro_events,
    get_daily_astro_events,
    get_meteor_showers,
    get_moon_phases_for_month,
    get_seasonal_events,
    get_tonight_highlights,
    // Types
    AstroEvent,
    AstroEventType,
    MeteorShowerInfo,
    MoonPhaseEvent,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_root_reexports_bridge_calculations_and_events() {
        let coords = EquatorialCoords {
            ra: 83.6331,
            dec: 22.0145,
        };

        let formatted_dec = format_dec_dms(coords.dec);
        let parsed_dec = parse_dec_dms(formatted_dec).unwrap();
        assert!((parsed_dec - coords.dec).abs() < 1e-4);

        let phase = calculate_moon_phase(Some(1_704_067_200));
        assert!((0.0..=100.0).contains(&phase.illumination));

        let showers = get_meteor_showers(2026);
        assert!(showers.iter().any(|shower| shower.zhr > 0));

        let highlights = get_tonight_highlights(35.6895, 139.6917, Some(1_704_067_200));
        assert_eq!(highlights.len(), 3);
        assert!(highlights[0].starts_with("Moon: "));

        let serialized = serde_json::to_string(&AstroEventType::Supermoon).unwrap();
        assert_eq!(serialized, "\"supermoon\"");
    }
}
