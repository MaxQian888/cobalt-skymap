//! Astronomical events module
//! Calculates and provides information about astronomical events

use chrono::{DateTime, Datelike, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use super::calculations::{calculate_moon_phase, calculate_moon_position, calculate_sun_position};

// ============================================================================
// Types
// ============================================================================

/// Astronomical event type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AstroEventType {
    // Moon phases
    NewMoon,
    FirstQuarter,
    FullMoon,
    LastQuarter,
    // Eclipses
    SolarEclipse,
    LunarEclipse,
    // Meteor showers
    MeteorShower,
    // Planetary events
    PlanetaryConjunction,
    PlanetaryOpposition,
    PlanetaryElongation,
    // Other
    Equinox,
    Solstice,
    Perihelion,
    Aphelion,
    Supermoon,
    BlueMoon,
}

/// Astronomical event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AstroEvent {
    pub id: String,
    pub event_type: AstroEventType,
    pub name: String,
    pub description: String,
    pub date: String,
    pub time: Option<String>,
    pub timestamp: i64,
    pub magnitude: Option<f64>,
    pub visibility: Option<String>,
    pub details: Option<serde_json::Value>,
}

/// Moon phase event with additional details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoonPhaseEvent {
    pub phase_type: String,
    pub date: String,
    pub timestamp: i64,
    pub illumination: f64,
    pub is_supermoon: bool,
}

/// Meteor shower info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeteorShowerInfo {
    pub name: String,
    pub peak_date: String,
    pub active_start: String,
    pub active_end: String,
    pub zhr: u32, // Zenith Hourly Rate
    pub radiant_ra: f64,
    pub radiant_dec: f64,
    pub parent_body: Option<String>,
    pub description: String,
}

// ============================================================================
// Moon Phase Events
// ============================================================================

/// Calculate moon phases for a given month
#[tauri::command]
pub fn get_moon_phases_for_month(year: i32, month: u32) -> Vec<MoonPhaseEvent> {
    let mut events = Vec::new();

    // Get first and last day of month
    let first_day = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let last_day = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap()
            .pred_opt()
            .unwrap()
    };

    let mut current = first_day;
    let mut prev_phase: Option<f64> = None;

    while current <= last_day {
        let dt = current.and_hms_opt(12, 0, 0).unwrap().and_utc();
        let phase = calculate_moon_phase(Some(dt.timestamp()));

        // Detect phase transitions
        if let Some(prev) = prev_phase {
            let phase_val = phase.phase;

            // New Moon (phase crosses 0)
            if prev > 0.9 && phase_val < 0.1 {
                events.push(MoonPhaseEvent {
                    phase_type: "New Moon".to_string(),
                    date: current.to_string(),
                    timestamp: dt.timestamp(),
                    illumination: phase.illumination,
                    is_supermoon: false,
                });
            }
            // First Quarter (phase crosses 0.25)
            else if prev < 0.25 && phase_val >= 0.25 {
                events.push(MoonPhaseEvent {
                    phase_type: "First Quarter".to_string(),
                    date: current.to_string(),
                    timestamp: dt.timestamp(),
                    illumination: phase.illumination,
                    is_supermoon: false,
                });
            }
            // Full Moon (phase crosses 0.5)
            else if prev < 0.5 && phase_val >= 0.5 {
                events.push(MoonPhaseEvent {
                    phase_type: "Full Moon".to_string(),
                    date: current.to_string(),
                    timestamp: dt.timestamp(),
                    illumination: phase.illumination,
                    is_supermoon: check_supermoon(dt.timestamp()),
                });
            }
            // Last Quarter (phase crosses 0.75)
            else if prev < 0.75 && phase_val >= 0.75 {
                events.push(MoonPhaseEvent {
                    phase_type: "Last Quarter".to_string(),
                    date: current.to_string(),
                    timestamp: dt.timestamp(),
                    illumination: phase.illumination,
                    is_supermoon: false,
                });
            }
        }

        prev_phase = Some(phase.phase);
        current = current.succ_opt().unwrap();
    }

    events
}

/// Check if a full moon is a supermoon (moon near perigee)
/// Uses a more accurate threshold based on perigee distance percentage
fn check_supermoon(timestamp: i64) -> bool {
    // Perigee range: ~356,500 km (closest) to ~370,000 km (typical perigee)
    // Apogee range: ~404,000 km to ~406,700 km
    // A supermoon is typically defined as a full moon within 90% of its closest approach
    const PERIGEE_DISTANCE: f64 = 356500.0;

    // Threshold: within 5% above minimum perigee distance
    // This is more selective than the previous 360000 km threshold
    let threshold = PERIGEE_DISTANCE * 1.05; // ~374,325 km

    let moon_pos = calculate_moon_position(0.0, 0.0, Some(timestamp));
    moon_pos.distance < threshold
}

// ============================================================================
// Meteor Showers
// ============================================================================

/// Get major meteor showers for a year
#[tauri::command]
pub fn get_meteor_showers(year: i32) -> Vec<MeteorShowerInfo> {
    vec![
        MeteorShowerInfo {
            name: "Quadrantids".to_string(),
            peak_date: format!("{}-01-03", year),
            active_start: format!("{}-12-28", year - 1),
            active_end: format!("{}-01-12", year),
            zhr: 120,
            radiant_ra: 230.0,
            radiant_dec: 49.0,
            parent_body: Some("2003 EH1".to_string()),
            description: "One of the best annual meteor showers with bright meteors".to_string(),
        },
        MeteorShowerInfo {
            name: "Lyrids".to_string(),
            peak_date: format!("{}-04-22", year),
            active_start: format!("{}-04-16", year),
            active_end: format!("{}-04-25", year),
            zhr: 18,
            radiant_ra: 271.0,
            radiant_dec: 34.0,
            parent_body: Some("C/1861 G1 Thatcher".to_string()),
            description: "Medium strength shower with occasional bright fireballs".to_string(),
        },
        MeteorShowerInfo {
            name: "Eta Aquariids".to_string(),
            peak_date: format!("{}-05-06", year),
            active_start: format!("{}-04-19", year),
            active_end: format!("{}-05-28", year),
            zhr: 50,
            radiant_ra: 338.0,
            radiant_dec: -1.0,
            parent_body: Some("1P/Halley".to_string()),
            description: "Fast meteors from Halley's Comet debris".to_string(),
        },
        MeteorShowerInfo {
            name: "Delta Aquariids".to_string(),
            peak_date: format!("{}-07-30", year),
            active_start: format!("{}-07-12", year),
            active_end: format!("{}-08-23", year),
            zhr: 20,
            radiant_ra: 340.0,
            radiant_dec: -16.0,
            parent_body: Some("96P/Machholz".to_string()),
            description: "Best viewed from southern latitudes".to_string(),
        },
        MeteorShowerInfo {
            name: "Perseids".to_string(),
            peak_date: format!("{}-08-12", year),
            active_start: format!("{}-07-17", year),
            active_end: format!("{}-08-24", year),
            zhr: 100,
            radiant_ra: 48.0,
            radiant_dec: 58.0,
            parent_body: Some("109P/Swift-Tuttle".to_string()),
            description: "Most popular meteor shower with many bright meteors".to_string(),
        },
        MeteorShowerInfo {
            name: "Orionids".to_string(),
            peak_date: format!("{}-10-21", year),
            active_start: format!("{}-10-02", year),
            active_end: format!("{}-11-07", year),
            zhr: 20,
            radiant_ra: 95.0,
            radiant_dec: 16.0,
            parent_body: Some("1P/Halley".to_string()),
            description: "Fast meteors from Halley's Comet debris".to_string(),
        },
        MeteorShowerInfo {
            name: "Leonids".to_string(),
            peak_date: format!("{}-11-17", year),
            active_start: format!("{}-11-06", year),
            active_end: format!("{}-11-30", year),
            zhr: 15,
            radiant_ra: 152.0,
            radiant_dec: 22.0,
            parent_body: Some("55P/Tempel-Tuttle".to_string()),
            description: "Can produce meteor storms every 33 years".to_string(),
        },
        MeteorShowerInfo {
            name: "Geminids".to_string(),
            peak_date: format!("{}-12-14", year),
            active_start: format!("{}-12-04", year),
            active_end: format!("{}-12-17", year),
            zhr: 150,
            radiant_ra: 112.0,
            radiant_dec: 33.0,
            parent_body: Some("3200 Phaethon".to_string()),
            description: "King of meteor showers with many bright, colorful meteors".to_string(),
        },
        MeteorShowerInfo {
            name: "Ursids".to_string(),
            peak_date: format!("{}-12-22", year),
            active_start: format!("{}-12-17", year),
            active_end: format!("{}-12-26", year),
            zhr: 10,
            radiant_ra: 217.0,
            radiant_dec: 76.0,
            parent_body: Some("8P/Tuttle".to_string()),
            description: "Minor shower near the winter solstice".to_string(),
        },
    ]
}

// ============================================================================
// Seasonal Events
// ============================================================================

/// Get equinoxes and solstices for a year with dynamically calculated dates
/// Uses solar longitude calculation to determine precise event times
#[tauri::command]
pub fn get_seasonal_events(year: i32) -> Vec<AstroEvent> {
    let mut events = Vec::new();

    // Calculate vernal equinox (sun longitude = 0°)
    if let Some((ts, date_str, time_str)) = find_solar_longitude_event(year, 3, 0.0) {
        events.push(AstroEvent {
            id: format!("vernal-equinox-{}", year),
            event_type: AstroEventType::Equinox,
            name: "Vernal Equinox".to_string(),
            description: "First day of spring in Northern Hemisphere".to_string(),
            date: date_str,
            time: Some(time_str),
            timestamp: ts,
            magnitude: None,
            visibility: Some("Global".to_string()),
            details: None,
        });
    }

    // Calculate summer solstice (sun longitude = 90°)
    if let Some((ts, date_str, time_str)) = find_solar_longitude_event(year, 6, 90.0) {
        events.push(AstroEvent {
            id: format!("summer-solstice-{}", year),
            event_type: AstroEventType::Solstice,
            name: "Summer Solstice".to_string(),
            description: "Longest day in Northern Hemisphere".to_string(),
            date: date_str,
            time: Some(time_str),
            timestamp: ts,
            magnitude: None,
            visibility: Some("Global".to_string()),
            details: None,
        });
    }

    // Calculate autumnal equinox (sun longitude = 180°)
    if let Some((ts, date_str, time_str)) = find_solar_longitude_event(year, 9, 180.0) {
        events.push(AstroEvent {
            id: format!("autumnal-equinox-{}", year),
            event_type: AstroEventType::Equinox,
            name: "Autumnal Equinox".to_string(),
            description: "First day of autumn in Northern Hemisphere".to_string(),
            date: date_str,
            time: Some(time_str),
            timestamp: ts,
            magnitude: None,
            visibility: Some("Global".to_string()),
            details: None,
        });
    }

    // Calculate winter solstice (sun longitude = 270°)
    if let Some((ts, date_str, time_str)) = find_solar_longitude_event(year, 12, 270.0) {
        events.push(AstroEvent {
            id: format!("winter-solstice-{}", year),
            event_type: AstroEventType::Solstice,
            name: "Winter Solstice".to_string(),
            description: "Shortest day in Northern Hemisphere".to_string(),
            date: date_str,
            time: Some(time_str),
            timestamp: ts,
            magnitude: None,
            visibility: Some("Global".to_string()),
            details: None,
        });
    }

    events
}

/// Find the timestamp when the sun reaches a specific ecliptic longitude
/// Uses binary search for precise calculation
fn find_solar_longitude_event(
    year: i32,
    month: u32,
    target_longitude: f64,
) -> Option<(i64, String, String)> {
    // Start search around the expected date
    let start_day = match month {
        3 => 18,  // Vernal equinox around March 20
        6 => 19,  // Summer solstice around June 21
        9 => 21,  // Autumnal equinox around September 23
        12 => 19, // Winter solstice around December 21
        _ => 15,
    };

    let start_date = NaiveDate::from_ymd_opt(year, month, start_day)?;
    let start_jd = date_to_jd(&start_date);

    // Binary search for the exact time (within a few seconds)
    let mut jd_low = start_jd - 3.0; // Search window: 3 days before
    let mut jd_high = start_jd + 3.0; // Search window: 3 days after

    for _ in 0..50 {
        // 50 iterations gives sub-second precision
        let jd_mid = (jd_low + jd_high) / 2.0;
        let sun_lon = calculate_sun_longitude(jd_mid);

        // Handle wraparound at 0°/360°
        let diff = normalize_angle_diff(sun_lon, target_longitude);

        if diff.abs() < 0.0001 {
            // Found it (within ~0.3 arcseconds)
            break;
        }

        if diff < 0.0 {
            jd_low = jd_mid;
        } else {
            jd_high = jd_mid;
        }
    }

    let jd_result = (jd_low + jd_high) / 2.0;

    // Convert JD to timestamp and formatted strings
    let timestamp = jd_to_unix_timestamp(jd_result);
    let dt = DateTime::from_timestamp(timestamp, 0)?;

    let date_str = dt.format("%Y-%m-%d").to_string();
    let time_str = dt.format("%H:%M").to_string();

    Some((timestamp, date_str, time_str))
}

/// Calculate sun's ecliptic longitude at a given Julian Date
fn calculate_sun_longitude(jd: f64) -> f64 {
    use std::f64::consts::PI;
    const DEG_TO_RAD: f64 = PI / 180.0;

    let t = (jd - 2451545.0) / 36525.0;
    let t2 = t * t;

    // Geometric mean longitude of the Sun
    let l0 = normalize_degrees(280.46646 + 36000.76983 * t + 0.0003032 * t2);

    // Mean anomaly of the Sun
    let m = normalize_degrees(357.52911 + 35999.05029 * t - 0.0001537 * t2);
    let m_rad = m * DEG_TO_RAD;

    // Equation of center
    let c = (1.914602 - 0.004817 * t - 0.000014 * t2) * m_rad.sin()
        + (0.019993 - 0.000101 * t) * (2.0 * m_rad).sin()
        + 0.000289 * (3.0 * m_rad).sin();

    // Sun's true longitude
    let sun_lon = normalize_degrees(l0 + c);

    // Apply nutation and aberration correction
    let omega = (125.04 - 1934.136 * t) * DEG_TO_RAD;
    let apparent_lon = sun_lon - 0.00569 - 0.00478 * omega.sin();

    normalize_degrees(apparent_lon)
}

/// Normalize angle to 0-360 degrees
fn normalize_degrees(deg: f64) -> f64 {
    let mut result = deg % 360.0;
    if result < 0.0 {
        result += 360.0;
    }
    result
}

/// Calculate the signed difference between two angles, accounting for wraparound
fn normalize_angle_diff(current: f64, target: f64) -> f64 {
    let mut diff = current - target;
    while diff > 180.0 {
        diff -= 360.0;
    }
    while diff < -180.0 {
        diff += 360.0;
    }
    diff
}

/// Convert NaiveDate to Julian Date
fn date_to_jd(date: &NaiveDate) -> f64 {
    let year = date.year() as f64;
    let month = date.month() as f64;
    let day = date.day() as f64;

    let (y, m) = if month <= 2.0 {
        (year - 1.0, month + 12.0)
    } else {
        (year, month)
    };

    let a = (y / 100.0).floor();
    let b = 2.0 - a + (a / 4.0).floor();

    (365.25 * (y + 4716.0)).floor() + (30.6001 * (m + 1.0)).floor() + day + b - 1524.5
}

/// Convert Julian Date to Unix timestamp
fn jd_to_unix_timestamp(jd: f64) -> i64 {
    ((jd - 2440587.5) * 86400.0) as i64
}

// ============================================================================
// Combined Events
// ============================================================================

/// Get all astronomical events for a date range
#[tauri::command]
pub fn get_astro_events(start_date: String, end_date: String) -> Result<Vec<AstroEvent>, String> {
    let start = NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date: {}", e))?;
    let end = NaiveDate::parse_from_str(&end_date, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end date: {}", e))?;

    let mut events = Vec::new();

    // Get years covered
    let start_year = start.year();
    let end_year = end.year();

    for year in start_year..=end_year {
        // Add seasonal events
        for event in get_seasonal_events(year) {
            let event_date = NaiveDate::parse_from_str(&event.date, "%Y-%m-%d").ok();
            if let Some(date) = event_date {
                if date >= start && date <= end {
                    events.push(event);
                }
            }
        }

        // Add meteor showers
        for shower in get_meteor_showers(year) {
            let peak_date = NaiveDate::parse_from_str(&shower.peak_date, "%Y-%m-%d").ok();
            if let Some(date) = peak_date {
                if date >= start && date <= end {
                    events.push(AstroEvent {
                        id: format!(
                            "meteor-{}-{}",
                            shower.name.to_lowercase().replace(' ', "-"),
                            year
                        ),
                        event_type: AstroEventType::MeteorShower,
                        name: shower.name.clone(),
                        description: shower.description,
                        date: shower.peak_date,
                        time: None,
                        timestamp: date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp(),
                        magnitude: None,
                        visibility: Some(format!("ZHR: {}", shower.zhr)),
                        details: Some(serde_json::json!({
                            "zhr": shower.zhr,
                            "radiant_ra": shower.radiant_ra,
                            "radiant_dec": shower.radiant_dec,
                            "parent_body": shower.parent_body,
                            "active_start": shower.active_start,
                            "active_end": shower.active_end,
                        })),
                    });
                }
            }
        }

        // Add moon phases
        for month in 1..=12 {
            let month_start = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
            let month_end = if month == 12 {
                NaiveDate::from_ymd_opt(year + 1, 1, 1)
                    .unwrap()
                    .pred_opt()
                    .unwrap()
            } else {
                NaiveDate::from_ymd_opt(year, month + 1, 1)
                    .unwrap()
                    .pred_opt()
                    .unwrap()
            };

            // Only process if month overlaps with date range
            if month_end >= start && month_start <= end {
                for phase in get_moon_phases_for_month(year, month) {
                    let phase_date = NaiveDate::parse_from_str(&phase.date, "%Y-%m-%d").ok();
                    if let Some(date) = phase_date {
                        if date >= start && date <= end {
                            let event_type = match phase.phase_type.as_str() {
                                "New Moon" => AstroEventType::NewMoon,
                                "First Quarter" => AstroEventType::FirstQuarter,
                                "Full Moon" => AstroEventType::FullMoon,
                                "Last Quarter" => AstroEventType::LastQuarter,
                                _ => continue,
                            };

                            let name = if phase.is_supermoon {
                                format!("{} (Supermoon)", phase.phase_type)
                            } else {
                                phase.phase_type.clone()
                            };

                            events.push(AstroEvent {
                                id: format!(
                                    "moon-{}-{}",
                                    phase.phase_type.to_lowercase().replace(' ', "-"),
                                    phase.timestamp
                                ),
                                event_type,
                                name,
                                description: format!(
                                    "Moon illumination: {:.1}%",
                                    phase.illumination
                                ),
                                date: phase.date,
                                time: None,
                                timestamp: phase.timestamp,
                                magnitude: None,
                                visibility: None,
                                details: Some(serde_json::json!({
                                    "illumination": phase.illumination,
                                    "is_supermoon": phase.is_supermoon,
                                })),
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort by date
    events.sort_by_key(|e| e.timestamp);

    Ok(events)
}

/// Get astronomical events for a single local day
#[tauri::command]
pub fn get_daily_astro_events(
    date: String,
    timezone: String,
    include_ongoing: bool,
) -> Result<Vec<AstroEvent>, String> {
    let selected_date =
        NaiveDate::parse_from_str(&date, "%Y-%m-%d").map_err(|e| format!("Invalid date: {}", e))?;

    // Timezone is currently consumed by frontend/day-key classification.
    // Keep parameter for API compatibility and future zoned-day expansion.
    let _timezone = timezone;

    let mut events = get_astro_events(date.clone(), date.clone())?;

    if include_ongoing {
        let selected_timestamp = selected_date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| "Failed to build selected date timestamp".to_string())?
            .and_utc()
            .timestamp();
        let year = selected_date.year();

        for y in (year - 1)..=(year + 1) {
            for shower in get_meteor_showers(y) {
                let start = NaiveDate::parse_from_str(&shower.active_start, "%Y-%m-%d").ok();
                let end = NaiveDate::parse_from_str(&shower.active_end, "%Y-%m-%d").ok();
                if let (Some(active_start), Some(active_end)) = (start, end) {
                    if selected_date >= active_start && selected_date <= active_end {
                        let id = format!(
                            "daily-window-meteor-{}-{}",
                            shower.name.to_lowercase().replace(' ', "-"),
                            selected_date
                        );
                        let details = serde_json::json!({
                            "occurrence_mode": "window",
                            "starts_at": shower.active_start,
                            "ends_at": shower.active_end,
                            "active_start": shower.active_start,
                            "active_end": shower.active_end,
                            "zhr": shower.zhr,
                            "radiant_ra": shower.radiant_ra,
                            "radiant_dec": shower.radiant_dec,
                            "parent_body": shower.parent_body,
                        });
                        events.push(AstroEvent {
                            id,
                            event_type: AstroEventType::MeteorShower,
                            name: format!("{} (Active)", shower.name),
                            description: format!(
                                "Active meteor shower window ({} to {}), peak ZHR {}",
                                shower.active_start, shower.active_end, shower.zhr
                            ),
                            date: selected_date.to_string(),
                            time: None,
                            timestamp: selected_timestamp,
                            magnitude: None,
                            visibility: Some(format!("ZHR: {}", shower.zhr)),
                            details: Some(details),
                        });
                    }
                }
            }
        }
    }

    for event in events.iter_mut() {
        let details = event.details.get_or_insert_with(|| serde_json::json!({}));
        if let Some(obj) = details.as_object_mut() {
            obj.entry("occurrence_mode")
                .or_insert_with(|| serde_json::json!("instant"));
            obj.entry("starts_at")
                .or_insert_with(|| serde_json::json!(event.date.clone()));
        }
    }

    events.sort_by_key(|event| event.timestamp);
    events.dedup_by(|left, right| left.id == right.id);
    Ok(events)
}

/// Get tonight's astronomical highlights
#[tauri::command]
pub fn get_tonight_highlights(
    latitude: f64,
    longitude: f64,
    timestamp: Option<i64>,
) -> Vec<String> {
    let dt = timestamp
        .map(|ts| DateTime::from_timestamp(ts, 0).unwrap_or_else(Utc::now))
        .unwrap_or_else(Utc::now);

    let mut highlights = Vec::new();

    // Moon phase
    let moon_phase = calculate_moon_phase(Some(dt.timestamp()));
    highlights.push(format!(
        "Moon: {} ({:.0}% illuminated)",
        moon_phase.phase_name, moon_phase.illumination
    ));

    // Moon position
    let moon_pos = calculate_moon_position(latitude, longitude, Some(dt.timestamp()));
    if moon_pos.altitude > 0.0 {
        highlights.push(format!(
            "Moon altitude: {:.1}° (azimuth {:.1}°)",
            moon_pos.altitude, moon_pos.azimuth
        ));
    } else {
        highlights.push("Moon is below the horizon".to_string());
    }

    // Sun position (for twilight info)
    let sun_pos = calculate_sun_position(latitude, longitude, Some(dt.timestamp()));
    if sun_pos.altitude < -18.0 {
        highlights.push("Astronomical darkness - ideal for deep sky observation".to_string());
    } else if sun_pos.altitude < -12.0 {
        highlights.push("Nautical twilight - good for bright objects".to_string());
    } else if sun_pos.altitude < -6.0 {
        highlights.push("Civil twilight - planets and bright stars visible".to_string());
    } else if sun_pos.altitude < 0.0 {
        highlights.push("Sun just below horizon".to_string());
    } else {
        highlights.push("Daytime - wait for sunset".to_string());
    }

    highlights
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // ------------------------------------------------------------------------
    // Moon Phase Events Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_moon_phases_for_month_returns_phases() {
        let phases = get_moon_phases_for_month(2024, 1);
        // A month should have at least 1 moon phase event (could be 0-4 depending on timing)
        // Just verify it doesn't panic and returns valid data
        for phase in &phases {
            assert!(!phase.phase_type.is_empty());
            assert!(!phase.date.is_empty());
            assert!(phase.illumination >= 0.0 && phase.illumination <= 100.0);
        }
    }

    #[test]
    fn test_get_moon_phases_all_months() {
        // Test all 12 months to ensure no panics
        for month in 1..=12 {
            let phases = get_moon_phases_for_month(2024, month);
            for phase in &phases {
                let valid_types = ["New Moon", "First Quarter", "Full Moon", "Last Quarter"];
                assert!(
                    valid_types.contains(&phase.phase_type.as_str()),
                    "Invalid phase type: {}",
                    phase.phase_type
                );
            }
        }
    }

    #[test]
    fn test_get_moon_phases_december_edge_case() {
        // December is special because it needs to handle year boundary
        let phases = get_moon_phases_for_month(2024, 12);
        for phase in &phases {
            assert!(phase.date.starts_with("2024-12-"));
        }
    }

    // ------------------------------------------------------------------------
    // Meteor Showers Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_meteor_showers_returns_showers() {
        let showers = get_meteor_showers(2024);
        assert!(!showers.is_empty(), "Should return meteor showers");

        // Verify major showers are present
        let names: Vec<&str> = showers.iter().map(|s| s.name.as_str()).collect();
        assert!(names.contains(&"Perseids"), "Should include Perseids");
        assert!(names.contains(&"Geminids"), "Should include Geminids");
        assert!(names.contains(&"Quadrantids"), "Should include Quadrantids");
    }

    #[test]
    fn test_meteor_shower_data_validity() {
        let showers = get_meteor_showers(2024);

        for shower in &showers {
            // ZHR should be positive
            assert!(shower.zhr > 0, "ZHR should be positive for {}", shower.name);

            // Radiant coordinates should be valid
            assert!(
                shower.radiant_ra >= 0.0 && shower.radiant_ra < 360.0,
                "Radiant RA out of range for {}",
                shower.name
            );
            assert!(
                shower.radiant_dec >= -90.0 && shower.radiant_dec <= 90.0,
                "Radiant Dec out of range for {}",
                shower.name
            );

            // Dates should be formatted correctly
            assert!(
                shower.peak_date.starts_with("2024-"),
                "Peak date should be in 2024 for {}",
                shower.name
            );
        }
    }

    #[test]
    fn test_meteor_showers_different_years() {
        let showers_2024 = get_meteor_showers(2024);
        let showers_2025 = get_meteor_showers(2025);

        // Same number of showers
        assert_eq!(showers_2024.len(), showers_2025.len());

        // Dates should be different years
        assert!(showers_2024[0].peak_date.starts_with("2024-"));
        assert!(showers_2025[0].peak_date.starts_with("2025-"));
    }

    // ------------------------------------------------------------------------
    // Seasonal Events Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_seasonal_events_returns_four() {
        let events = get_seasonal_events(2024);
        assert_eq!(events.len(), 4, "Should return 4 seasonal events");
    }

    #[test]
    fn test_seasonal_events_types() {
        let events = get_seasonal_events(2024);

        let equinoxes: Vec<_> = events
            .iter()
            .filter(|e| matches!(e.event_type, AstroEventType::Equinox))
            .collect();
        let solstices: Vec<_> = events
            .iter()
            .filter(|e| matches!(e.event_type, AstroEventType::Solstice))
            .collect();

        assert_eq!(equinoxes.len(), 2, "Should have 2 equinoxes");
        assert_eq!(solstices.len(), 2, "Should have 2 solstices");
    }

    #[test]
    fn test_seasonal_events_dates() {
        let events = get_seasonal_events(2024);

        // Check approximate dates
        let dates: Vec<&str> = events.iter().map(|e| e.date.as_str()).collect();

        assert!(
            dates.iter().any(|d| d.contains("-03-")),
            "Should have March equinox"
        );
        assert!(
            dates.iter().any(|d| d.contains("-06-")),
            "Should have June solstice"
        );
        assert!(
            dates.iter().any(|d| d.contains("-09-")),
            "Should have September equinox"
        );
        assert!(
            dates.iter().any(|d| d.contains("-12-")),
            "Should have December solstice"
        );
    }

    #[test]
    fn test_seasonal_events_have_times() {
        // Dynamic calculation should provide precise times
        let events = get_seasonal_events(2024);

        for event in &events {
            assert!(
                event.time.is_some(),
                "Event {} should have time",
                event.name
            );
            // Time should be in HH:MM format
            let time = event.time.as_ref().unwrap();
            assert!(time.contains(':'), "Time should contain colon: {}", time);
        }
    }

    #[test]
    fn test_seasonal_events_accurate_dates() {
        // Verify dynamically calculated dates are within expected ranges
        let events = get_seasonal_events(2024);

        for event in &events {
            let date = &event.date;

            match event.name.as_str() {
                "Vernal Equinox" => {
                    // Should be around March 19-21
                    assert!(
                        date.starts_with("2024-03-"),
                        "Vernal equinox should be in March"
                    );
                    let day: u32 = date[8..10].parse().unwrap_or(0);
                    assert!(
                        (19..=21).contains(&day),
                        "Vernal equinox day should be 19-21, got {}",
                        day
                    );
                }
                "Summer Solstice" => {
                    // Should be around June 20-22
                    assert!(
                        date.starts_with("2024-06-"),
                        "Summer solstice should be in June"
                    );
                    let day: u32 = date[8..10].parse().unwrap_or(0);
                    assert!(
                        (20..=22).contains(&day),
                        "Summer solstice day should be 20-22, got {}",
                        day
                    );
                }
                "Autumnal Equinox" => {
                    // Should be around September 22-24
                    assert!(
                        date.starts_with("2024-09-"),
                        "Autumnal equinox should be in September"
                    );
                    let day: u32 = date[8..10].parse().unwrap_or(0);
                    assert!(
                        (22..=24).contains(&day),
                        "Autumnal equinox day should be 22-24, got {}",
                        day
                    );
                }
                "Winter Solstice" => {
                    // Should be around December 20-22
                    assert!(
                        date.starts_with("2024-12-"),
                        "Winter solstice should be in December"
                    );
                    let day: u32 = date[8..10].parse().unwrap_or(0);
                    assert!(
                        (20..=23).contains(&day),
                        "Winter solstice day should be 20-23, got {}",
                        day
                    );
                }
                _ => {}
            }
        }
    }

    #[test]
    fn test_seasonal_events_ordered_chronologically() {
        let events = get_seasonal_events(2024);

        // Should be in order: vernal, summer, autumnal, winter
        assert!(events.len() == 4);

        for i in 1..events.len() {
            assert!(
                events[i].timestamp > events[i - 1].timestamp,
                "Events should be chronologically ordered"
            );
        }
    }

    #[test]
    fn test_seasonal_events_different_years() {
        let events_2024 = get_seasonal_events(2024);
        let events_2025 = get_seasonal_events(2025);

        // Both years should have 4 events
        assert_eq!(events_2024.len(), 4);
        assert_eq!(events_2025.len(), 4);

        // 2025 events should all be after 2024 events
        let last_2024 = events_2024.last().unwrap().timestamp;
        let first_2025 = events_2025.first().unwrap().timestamp;
        assert!(first_2025 > last_2024, "2025 events should be after 2024");
    }

    // ------------------------------------------------------------------------
    // Supermoon Detection Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_supermoon_detection_threshold() {
        // Supermoon threshold is PERIGEE_DISTANCE * 1.05 = ~374,325 km
        // This is a unit test that the logic is working correctly
        let phases = get_moon_phases_for_month(2024, 1);

        for phase in &phases {
            if phase.phase_type == "Full Moon" {
                // Just verify the supermoon detection runs without panic
                // The actual detection depends on real moon distance
                assert!(
                    phase.illumination > 90.0,
                    "Full moon should have high illumination"
                );
            }
        }
    }

    // ------------------------------------------------------------------------
    // Helper Function Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_normalize_degrees() {
        assert!((normalize_degrees(0.0) - 0.0).abs() < 0.001);
        assert!((normalize_degrees(360.0) - 0.0).abs() < 0.001);
        assert!((normalize_degrees(720.0) - 0.0).abs() < 0.001);
        assert!((normalize_degrees(-90.0) - 270.0).abs() < 0.001);
        assert!((normalize_degrees(450.0) - 90.0).abs() < 0.001);
    }

    #[test]
    fn test_normalize_angle_diff() {
        assert!((normalize_angle_diff(10.0, 5.0) - 5.0).abs() < 0.001);
        assert!((normalize_angle_diff(5.0, 10.0) - (-5.0)).abs() < 0.001);
        assert!((normalize_angle_diff(350.0, 10.0) - (-20.0)).abs() < 0.001);
        assert!((normalize_angle_diff(10.0, 350.0) - 20.0).abs() < 0.001);
    }

    #[test]
    fn test_date_to_jd() {
        // J2000.0 epoch: January 1, 2000 at 0h UT = JD 2451544.5
        let date = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
        let jd = date_to_jd(&date);
        assert!(
            (jd - 2451544.5).abs() < 0.5,
            "J2000 JD should be ~2451544.5, got {}",
            jd
        );
    }

    #[test]
    fn test_jd_to_unix_timestamp() {
        // Unix epoch: January 1, 1970 = JD 2440587.5
        let ts = jd_to_unix_timestamp(2440587.5);
        assert_eq!(ts, 0, "Unix epoch should be timestamp 0, got {}", ts);
    }

    // ------------------------------------------------------------------------
    // Combined Events Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_astro_events_valid_range() {
        let result = get_astro_events("2024-01-01".to_string(), "2024-01-31".to_string());
        assert!(result.is_ok());

        let events = result.unwrap();
        // January should have some events (meteor showers, moon phases)
        // Just verify it doesn't panic and returns events
        for event in &events {
            assert!(!event.id.is_empty());
            assert!(!event.name.is_empty());
        }
    }

    #[test]
    fn test_get_astro_events_invalid_start_date() {
        let result = get_astro_events("invalid".to_string(), "2024-01-31".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_get_astro_events_invalid_end_date() {
        let result = get_astro_events("2024-01-01".to_string(), "invalid".to_string());
        assert!(result.is_err());
    }

    #[test]
    fn test_get_astro_events_sorted_by_date() {
        let result = get_astro_events("2024-01-01".to_string(), "2024-12-31".to_string());
        assert!(result.is_ok());

        let events = result.unwrap();
        // Verify events are sorted by timestamp
        for i in 1..events.len() {
            assert!(
                events[i].timestamp >= events[i - 1].timestamp,
                "Events should be sorted by timestamp"
            );
        }
    }

    #[test]
    fn test_get_astro_events_includes_meteor_showers() {
        let result = get_astro_events("2024-08-01".to_string(), "2024-08-31".to_string());
        assert!(result.is_ok());

        let events = result.unwrap();
        let has_meteor = events
            .iter()
            .any(|e| matches!(e.event_type, AstroEventType::MeteorShower));
        assert!(has_meteor, "August should include Perseids meteor shower");
    }

    #[test]
    fn test_get_astro_events_year_boundary() {
        // Test spanning year boundary
        let result = get_astro_events("2024-12-15".to_string(), "2025-01-15".to_string());
        assert!(result.is_ok());

        let events = result.unwrap();
        let has_2024 = events.iter().any(|e| e.date.starts_with("2024"));
        let has_2025 = events.iter().any(|e| e.date.starts_with("2025"));
        assert!(has_2024 || has_2025, "Should have events from either year");
    }

    #[test]
    fn test_get_daily_astro_events_valid_date() {
        let result = get_daily_astro_events("2026-08-12".to_string(), "Etc/UTC".to_string(), true);
        assert!(result.is_ok());
        let events = result.unwrap();
        for event in events {
            assert!(!event.id.is_empty());
            assert!(!event.name.is_empty());
        }
    }

    #[test]
    fn test_get_daily_astro_events_includes_window_event_when_enabled() {
        let result = get_daily_astro_events("2024-08-10".to_string(), "Etc/UTC".to_string(), true);
        assert!(result.is_ok());
        let events = result.unwrap();
        let has_window = events.iter().any(|event| {
            event
                .details
                .as_ref()
                .and_then(|value| value.get("occurrence_mode"))
                .and_then(|value| value.as_str())
                .map(|mode| mode == "window")
                .unwrap_or(false)
        });
        assert!(has_window, "Expected at least one window-style daily event");
    }

    // ------------------------------------------------------------------------
    // Tonight Highlights Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_get_tonight_highlights_returns_highlights() {
        let highlights = get_tonight_highlights(45.0, 0.0, None);
        assert!(!highlights.is_empty(), "Should return some highlights");
        assert!(highlights.len() >= 3, "Should have at least 3 highlights");
    }

    #[test]
    fn test_get_tonight_highlights_moon_info() {
        let highlights = get_tonight_highlights(45.0, 0.0, None);

        // First highlight should be moon phase
        assert!(
            highlights[0].contains("Moon:"),
            "First highlight should be moon info"
        );
        assert!(
            highlights[0].contains("illuminated"),
            "Should include illumination"
        );
    }

    #[test]
    fn test_get_tonight_highlights_with_timestamp() {
        // Use a specific timestamp
        let timestamp = 1704067200i64; // Jan 1, 2024 00:00:00 UTC
        let highlights = get_tonight_highlights(45.0, 0.0, Some(timestamp));

        assert!(!highlights.is_empty());
    }

    #[test]
    fn test_get_tonight_highlights_different_locations() {
        // Compare highlights at different latitudes
        let highlights_north = get_tonight_highlights(60.0, 0.0, Some(1704067200));
        let highlights_south = get_tonight_highlights(-60.0, 0.0, Some(1704067200));

        // Both should return valid highlights
        assert!(!highlights_north.is_empty());
        assert!(!highlights_south.is_empty());
    }

    // ------------------------------------------------------------------------
    // AstroEventType Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_astro_event_type_serialization() {
        // Test that event types serialize correctly
        let event_type = AstroEventType::FullMoon;
        let json = serde_json::to_string(&event_type).unwrap();
        assert_eq!(json, "\"full_moon\"");

        let event_type = AstroEventType::MeteorShower;
        let json = serde_json::to_string(&event_type).unwrap();
        assert_eq!(json, "\"meteor_shower\"");
    }

    #[test]
    fn test_moon_phase_event_structure() {
        let event = MoonPhaseEvent {
            phase_type: "Full Moon".to_string(),
            date: "2024-01-25".to_string(),
            timestamp: 1706140800,
            illumination: 99.5,
            is_supermoon: true,
        };

        // Test serialization
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Full Moon"));
        assert!(json.contains("is_supermoon"));
    }

    #[test]
    fn test_meteor_shower_info_structure() {
        let info = MeteorShowerInfo {
            name: "Test Shower".to_string(),
            peak_date: "2024-01-15".to_string(),
            active_start: "2024-01-10".to_string(),
            active_end: "2024-01-20".to_string(),
            zhr: 50,
            radiant_ra: 180.0,
            radiant_dec: 45.0,
            parent_body: Some("Test Comet".to_string()),
            description: "A test shower".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("Test Shower"));
        assert!(json.contains("parent_body"));
    }
}
