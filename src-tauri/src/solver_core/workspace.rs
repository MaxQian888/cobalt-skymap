//! Local-solve workspace management and result formatting helpers.
//! Platform-agnostic (used by the desktop solvers and the mobile ASTAP path).

use super::types::{LocalSolveWorkspace, PlateSolverError};

pub fn create_local_solve_workspace(prefix: &str) -> Result<LocalSolveWorkspace, PlateSolverError> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();

    let root_dir = std::env::temp_dir().join(format!(
        "skymap-{}-{}-{}",
        prefix,
        std::process::id(),
        timestamp
    ));
    std::fs::create_dir_all(&root_dir)?;

    Ok(LocalSolveWorkspace {
        output_base: root_dir.join("result"),
        wcs_file: root_dir.join("result.wcs"),
        root_dir,
    })
}

pub fn cleanup_local_solve_workspace(workspace: &LocalSolveWorkspace) {
    let _ = std::fs::remove_dir_all(&workspace.root_dir);
}

pub fn excerpt_output(bytes: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(bytes).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text.chars().take(400).collect())
    }
}

pub fn format_ra_hms(ra_deg: f64) -> String {
    let ra_hours = ra_deg / 15.0;
    let h = ra_hours.floor() as i32;
    let m_frac = (ra_hours - h as f64) * 60.0;
    let m = m_frac.floor() as i32;
    let s = (m_frac - m as f64) * 60.0;
    format!("{:02}h {:02}m {:05.2}s", h, m, s)
}

pub fn format_dec_dms(dec_deg: f64) -> String {
    let sign = if dec_deg >= 0.0 { "+" } else { "-" };
    let dec = dec_deg.abs();
    let d = dec.floor() as i32;
    let m_frac = (dec - d as f64) * 60.0;
    let m = m_frac.floor() as i32;
    let s = (m_frac - m as f64) * 60.0;
    format!("{}{}° {:02}' {:05.2}\"", sign, d, m, s)
}
