//! Application updater module

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::{Update, UpdaterExt};
use time::OffsetDateTime;

use once_cell::sync::Lazy;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub date: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", content = "data")]
pub enum UpdateStatus {
    #[serde(rename = "idle")]
    Idle,
    #[serde(rename = "checking")]
    Checking,
    #[serde(rename = "available")]
    Available(UpdateInfo),
    #[serde(rename = "not_available")]
    NotAvailable,
    #[serde(rename = "downloading")]
    Downloading(UpdateProgress),
    #[serde(rename = "ready")]
    Ready(UpdateInfo),
    #[serde(rename = "error")]
    Error(String),
}

#[derive(Debug, thiserror::Error)]
pub enum UpdaterError {
    #[allow(dead_code)]
    #[error("Updater not available")]
    NotAvailable,
    #[error("No update pending")]
    NoPendingUpdate,
    #[error("Update check failed: {0}")]
    CheckFailed(String),
    #[error("Download failed: {0}")]
    DownloadFailed(String),
    #[error("Install failed: {0}")]
    InstallFailed(String),
}

impl Serialize for UpdaterError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

struct PendingUpdate {
    update: Update,
    bytes: Option<Vec<u8>>,
}

static PENDING_UPDATE: Lazy<Mutex<Option<PendingUpdate>>> = Lazy::new(|| Mutex::new(None));

fn normalize_updater_error(raw: &str, phase: &'static str) -> String {
    let lower = raw.to_lowercase();

    if lower.contains("signature") {
        return "Signature verification failed. Please download the release manually from GitHub Releases.".to_string();
    }

    if lower.contains("target")
        || lower.contains("platform")
        || lower.contains("arch")
        || lower.contains("os")
    {
        return "No update package is available for this platform yet.".to_string();
    }

    if lower.contains("endpoint")
        || lower.contains("pubkey")
        || lower.contains("manifest")
        || lower.contains("latest.json")
    {
        return "Update service is not configured for this build. Open GitHub Releases to install manually.".to_string();
    }

    if lower.contains("timeout")
        || lower.contains("dns")
        || lower.contains("connection")
        || lower.contains("network")
        || lower.contains("request")
    {
        return format!(
            "Unable to {} updates right now. Please try again later.",
            phase
        );
    }

    format!("Update {} failed: {}", phase, raw)
}

fn extract_update_info(update: &Update) -> UpdateInfo {
    UpdateInfo {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        date: update.date.map(format_datetime),
        body: update.body.clone(),
    }
}

#[tauri::command]
pub async fn check_for_update<R: Runtime>(app: AppHandle<R>) -> Result<UpdateStatus, UpdaterError> {
    let updater = app
        .updater_builder()
        .on_before_exit(|| {
            log::info!("Updater: application exiting for update installation...");
        })
        .build()
        .map_err(|e| UpdaterError::CheckFailed(normalize_updater_error(&e.to_string(), "check")))?;

    match updater.check().await {
        Ok(Some(update)) => {
            let info = extract_update_info(&update);
            if let Ok(mut pending) = PENDING_UPDATE.lock() {
                *pending = Some(PendingUpdate {
                    update,
                    bytes: None,
                });
            }
            Ok(UpdateStatus::Available(info))
        }
        Ok(None) => Ok(UpdateStatus::NotAvailable),
        Err(e) => Err(UpdaterError::CheckFailed(normalize_updater_error(
            &e.to_string(),
            "check",
        ))),
    }
}

#[tauri::command]
pub async fn download_update<R: Runtime>(
    _app: AppHandle<R>,
    window: tauri::Window<R>,
) -> Result<UpdateStatus, UpdaterError> {
    let update = {
        let pending = PENDING_UPDATE
            .lock()
            .map_err(|_| UpdaterError::NoPendingUpdate)?;
        let p = pending.as_ref().ok_or(UpdaterError::NoPendingUpdate)?;
        p.update.clone()
    };

    let info = extract_update_info(&update);
    let window_clone = window.clone();
    let mut total_downloaded: u64 = 0;

    let bytes = update
        .download(
            |chunk_length, content_length| {
                total_downloaded += chunk_length as u64;
                let progress = UpdateProgress {
                    downloaded: total_downloaded,
                    total: content_length,
                    percent: content_length
                        .map(|l| (total_downloaded as f64 / l as f64) * 100.0)
                        .unwrap_or(0.0),
                };
                let _ = window_clone.emit("update-progress", UpdateStatus::Downloading(progress));
            },
            || log::info!("Download finished"),
        )
        .await
        .map_err(|e| {
            UpdaterError::DownloadFailed(normalize_updater_error(&e.to_string(), "download"))
        })?;

    if let Ok(mut pending) = PENDING_UPDATE.lock() {
        *pending = Some(PendingUpdate {
            update,
            bytes: Some(bytes),
        });
    }
    Ok(UpdateStatus::Ready(info))
}

#[tauri::command]
pub async fn install_update<R: Runtime>(app: AppHandle<R>) -> Result<(), UpdaterError> {
    let pending_data = {
        let mut pending = PENDING_UPDATE
            .lock()
            .map_err(|_| UpdaterError::NoPendingUpdate)?;
        pending.take().ok_or(UpdaterError::NoPendingUpdate)?
    };

    let bytes = pending_data.bytes.ok_or(UpdaterError::InstallFailed(
        "Update not downloaded yet. Call download_update first.".to_string(),
    ))?;

    pending_data.update.install(bytes).map_err(|e| {
        UpdaterError::InstallFailed(normalize_updater_error(&e.to_string(), "install"))
    })?;

    log::info!("Install completed, restarting...");
    app.restart();
}

#[tauri::command]
pub async fn download_and_install_update<R: Runtime>(
    app: AppHandle<R>,
    window: tauri::Window<R>,
) -> Result<(), UpdaterError> {
    let update = {
        let mut pending = PENDING_UPDATE
            .lock()
            .map_err(|_| UpdaterError::NoPendingUpdate)?;
        let p = pending.take().ok_or(UpdaterError::NoPendingUpdate)?;
        p.update
    };

    let window_clone = window.clone();
    let mut downloaded: u64 = 0;

    update
        .download_and_install(
            |chunk_length, content_length| {
                downloaded += chunk_length as u64;
                let progress = UpdateProgress {
                    downloaded,
                    total: content_length,
                    percent: content_length
                        .map(|l| (downloaded as f64 / l as f64) * 100.0)
                        .unwrap_or(0.0),
                };
                let _ = window_clone.emit("update-progress", UpdateStatus::Downloading(progress));
            },
            || log::info!("Download finished, installing..."),
        )
        .await
        .map_err(|e| {
            UpdaterError::InstallFailed(normalize_updater_error(&e.to_string(), "install"))
        })?;

    app.restart();
}

#[tauri::command]
pub fn get_current_version<R: Runtime>(app: AppHandle<R>) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub fn clear_pending_update() -> Result<(), UpdaterError> {
    if let Ok(mut pending) = PENDING_UPDATE.lock() {
        *pending = None;
    }
    Ok(())
}

#[tauri::command]
pub fn has_pending_update() -> bool {
    PENDING_UPDATE.lock().map(|p| p.is_some()).unwrap_or(false)
}

fn format_datetime(dt: OffsetDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        dt.year(),
        dt.month() as u8,
        dt.day(),
        dt.hour(),
        dt.minute(),
        dt.second()
    )
}

#[cfg(test)]
mod tests {
    use super::normalize_updater_error;

    #[test]
    fn classifies_missing_configuration_errors() {
        let error = normalize_updater_error("failed to build updater: missing endpoints", "check");
        assert!(error.contains("not configured"));
    }

    #[test]
    fn classifies_signature_failures_as_security_errors() {
        let error = normalize_updater_error("signature verification failed", "install");
        assert!(error.contains("Signature verification failed"));
    }

    #[test]
    fn classifies_missing_platform_payloads() {
        let error = normalize_updater_error("target not found in manifest", "check");
        assert!(error.contains("platform"));
    }
}
