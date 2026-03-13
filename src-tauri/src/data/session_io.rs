//! Session planner import/export and template persistence

use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
#[cfg(not(desktop))]
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

pub use super::session_io_core::SessionTemplateEntry;
use super::session_io_core::{
    extension_for_format, load_templates_from_path, read_session_plan_from_path,
    save_templates_to_path, upsert_template_entry, write_session_plan_to_path, SessionIoCoreError,
    SessionTemplateData,
};
use super::storage::StorageError;

fn get_session_data_dir(app: &AppHandle) -> Result<PathBuf, StorageError> {
    #[cfg(desktop)]
    let base_dir = crate::platform::path_config::resolve_data_dir(app)?;

    #[cfg(not(desktop))]
    let base_dir = {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|_| StorageError::AppDataDirNotFound)?;
        let d = app_data_dir.join("skymap");
        if !d.exists() {
            fs::create_dir_all(&d)?;
        }
        d
    };

    let session_dir = base_dir.join("session");
    if !session_dir.exists() {
        fs::create_dir_all(&session_dir)?;
    }
    Ok(session_dir)
}

fn get_templates_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    Ok(get_session_data_dir(app)?.join("templates.json"))
}

fn core_error_to_storage(error: SessionIoCoreError) -> StorageError {
    match error {
        SessionIoCoreError::Io(error) => StorageError::Io(error),
        SessionIoCoreError::Json(error) => StorageError::Json(error),
    }
}

fn load_templates_internal(app: &AppHandle) -> Result<SessionTemplateData, StorageError> {
    let path = get_templates_path(app)?;
    load_templates_from_path(&path).map_err(core_error_to_storage)
}

fn save_templates_internal(
    app: &AppHandle,
    data: &SessionTemplateData,
) -> Result<(), StorageError> {
    let path = get_templates_path(app)?;
    save_templates_to_path(&path, data).map_err(core_error_to_storage)
}

#[tauri::command]
pub async fn export_session_plan(
    app: AppHandle,
    content: String,
    format: String,
    path: Option<String>,
) -> Result<String, StorageError> {
    let target_path = if let Some(path) = path {
        PathBuf::from(path)
    } else {
        let ext = extension_for_format(&format);
        let file_path = app
            .dialog()
            .file()
            .set_title("Export Session Plan")
            .add_filter("Session Plan", &[ext])
            .set_file_name(&format!("session-plan.{}", ext))
            .blocking_save_file();

        match file_path {
            Some(path) => path
                .into_path()
                .map_err(|_| StorageError::AppDataDirNotFound)?,
            None => {
                return Err(StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "Export cancelled",
                )));
            }
        }
    };

    write_session_plan_to_path(&target_path, &content).map_err(core_error_to_storage)
}

#[tauri::command]
pub async fn import_session_plan(
    app: AppHandle,
    path: Option<String>,
) -> Result<String, StorageError> {
    let source_path = if let Some(path) = path {
        PathBuf::from(path)
    } else {
        let file_path = app
            .dialog()
            .file()
            .set_title("Import Session Plan")
            .add_filter("Session Plan", &["txt", "md", "json", "xml", "csv"])
            .blocking_pick_file();

        match file_path {
            Some(path) => path
                .into_path()
                .map_err(|_| StorageError::AppDataDirNotFound)?,
            None => {
                return Err(StorageError::Io(std::io::Error::new(
                    std::io::ErrorKind::Interrupted,
                    "Import cancelled",
                )));
            }
        }
    };

    read_session_plan_from_path(&source_path).map_err(core_error_to_storage)
}

#[tauri::command]
pub async fn save_session_template(
    app: AppHandle,
    name: String,
    draft: String,
) -> Result<SessionTemplateEntry, StorageError> {
    let now = Utc::now();
    let draft_json: serde_json::Value = serde_json::from_str(&draft)?;
    let mut data = load_templates_internal(&app)?;
    let entry = upsert_template_entry(&mut data, name, draft_json, now);
    save_templates_internal(&app, &data)?;
    Ok(entry)
}

#[tauri::command]
pub async fn load_session_templates(
    app: AppHandle,
) -> Result<Vec<SessionTemplateEntry>, StorageError> {
    let data = load_templates_internal(&app)?;
    Ok(data.templates)
}
