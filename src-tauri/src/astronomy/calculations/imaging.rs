//! Imaging calculations
//! Field of view and mosaic coverage calculations

use super::common::RAD_TO_DEG;
use super::types::{FOVResult, MosaicCoverage};

// ============================================================================
// Imaging Calculations
// ============================================================================

/// Calculate field of view
#[tauri::command]
pub fn calculate_fov(
    sensor_width: f64,  // mm
    sensor_height: f64, // mm
    focal_length: f64,  // mm
    pixel_size: f64,    // μm
    aperture: f64,      // mm
) -> FOVResult {
    let width_rad = 2.0 * (sensor_width / (2.0 * focal_length)).atan();
    let height_rad = 2.0 * (sensor_height / (2.0 * focal_length)).atan();

    let width_deg = width_rad * RAD_TO_DEG;
    let height_deg = height_rad * RAD_TO_DEG;

    // Image scale in arcsec/pixel
    let image_scale = (206.265 * pixel_size) / focal_length;

    let f_ratio = if aperture > 0.0 {
        focal_length / aperture
    } else {
        0.0
    };

    FOVResult {
        width_deg,
        height_deg,
        width_arcmin: width_deg * 60.0,
        height_arcmin: height_deg * 60.0,
        image_scale,
        f_ratio,
    }
}

/// Calculate mosaic coverage
#[tauri::command]
pub fn calculate_mosaic_coverage(
    sensor_width: f64,
    sensor_height: f64,
    focal_length: f64,
    rows: u32,
    cols: u32,
    overlap_percent: f64,
) -> MosaicCoverage {
    let fov = calculate_fov(sensor_width, sensor_height, focal_length, 1.0, 1.0);

    let overlap_factor = 1.0 - overlap_percent / 100.0;

    let total_width =
        fov.width_deg * cols as f64 * overlap_factor + fov.width_deg * (1.0 - overlap_factor);
    let total_height =
        fov.height_deg * rows as f64 * overlap_factor + fov.height_deg * (1.0 - overlap_factor);

    MosaicCoverage {
        total_width_deg: total_width,
        total_height_deg: total_height,
        total_panels: rows * cols,
        panel_width_deg: fov.width_deg,
        panel_height_deg: fov.height_deg,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 1e-6;

    fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
        (a - b).abs() < eps
    }

    #[test]
    fn test_calculate_fov_basic() {
        // Typical DSLR with 50mm lens
        let fov = calculate_fov(36.0, 24.0, 50.0, 5.0, 50.0);

        // FOV should be roughly 39° x 27° for full frame + 50mm
        assert!(
            fov.width_deg > 30.0 && fov.width_deg < 50.0,
            "Width FOV unexpected: {}",
            fov.width_deg
        );
        assert!(
            fov.height_deg > 20.0 && fov.height_deg < 35.0,
            "Height FOV unexpected: {}",
            fov.height_deg
        );
        assert!(
            approx_eq(fov.f_ratio, 1.0, EPSILON),
            "F-ratio should be 1.0"
        );
    }

    #[test]
    fn test_calculate_fov_image_scale() {
        // Image scale = 206.265 * pixel_size / focal_length
        let fov = calculate_fov(10.0, 10.0, 1000.0, 5.0, 100.0);
        let expected_scale = 206.265 * 5.0 / 1000.0; // ~1.03 arcsec/pixel
        assert!(
            approx_eq(fov.image_scale, expected_scale, 0.01),
            "Image scale mismatch: {} vs {}",
            fov.image_scale,
            expected_scale
        );
    }

    #[test]
    fn test_calculate_fov_zero_aperture() {
        let fov = calculate_fov(36.0, 24.0, 50.0, 5.0, 0.0);
        assert!(
            approx_eq(fov.f_ratio, 0.0, EPSILON),
            "F-ratio should be 0 with zero aperture"
        );
    }

    #[test]
    fn test_mosaic_coverage_single_panel() {
        let mosaic = calculate_mosaic_coverage(36.0, 24.0, 50.0, 1, 1, 20.0);
        assert_eq!(mosaic.total_panels, 1);
        // Single panel = full FOV regardless of overlap
        let single_fov = calculate_fov(36.0, 24.0, 50.0, 1.0, 1.0);
        assert!(approx_eq(
            mosaic.total_width_deg,
            single_fov.width_deg,
            0.01
        ));
    }

    #[test]
    fn test_mosaic_coverage_multiple_panels() {
        let mosaic = calculate_mosaic_coverage(36.0, 24.0, 100.0, 2, 3, 20.0);
        assert_eq!(mosaic.total_panels, 6);
        assert!(mosaic.total_width_deg > mosaic.panel_width_deg);
        assert!(mosaic.total_height_deg > mosaic.panel_height_deg);
    }
}
