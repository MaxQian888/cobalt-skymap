use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTemplateEntry {
    pub id: String,
    pub name: String,
    pub draft: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub(crate) struct SessionTemplateData {
    pub(crate) templates: Vec<SessionTemplateEntry>,
}

#[derive(Debug, Error)]
pub(crate) enum SessionIoCoreError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),
}

pub(crate) fn load_templates_from_path(
    path: &Path,
) -> Result<SessionTemplateData, SessionIoCoreError> {
    if !path.exists() {
        return Ok(SessionTemplateData::default());
    }

    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

pub(crate) fn save_templates_to_path(
    path: &Path,
    data: &SessionTemplateData,
) -> Result<(), SessionIoCoreError> {
    let serialized = serde_json::to_string_pretty(data)?;
    fs::write(path, serialized)?;
    Ok(())
}

pub(crate) fn extension_for_format(format: &str) -> &'static str {
    match format {
        "markdown" => "md",
        "json" => "json",
        "nina-xml" => "xml",
        "csv" => "csv",
        "sgp-csv" => "csv",
        _ => "txt",
    }
}

pub(crate) fn write_session_plan_to_path(
    target_path: &Path,
    content: &str,
) -> Result<String, SessionIoCoreError> {
    fs::write(target_path, content)?;
    Ok(target_path.to_string_lossy().to_string())
}

pub(crate) fn read_session_plan_from_path(
    source_path: &Path,
) -> Result<String, SessionIoCoreError> {
    Ok(fs::read_to_string(source_path)?)
}

pub(crate) fn upsert_template_entry(
    data: &mut SessionTemplateData,
    name: String,
    draft: serde_json::Value,
    now: DateTime<Utc>,
) -> SessionTemplateEntry {
    if let Some(existing) = data
        .templates
        .iter_mut()
        .find(|template| template.name == name)
    {
        existing.draft = draft;
        existing.updated_at = now;
        return existing.clone();
    }

    let entry = SessionTemplateEntry {
        id: format!(
            "template-{}-{}",
            now.timestamp_millis(),
            data.templates.len() + 1
        ),
        name,
        draft,
        created_at: now,
        updated_at: now,
    };
    data.templates.push(entry.clone());
    entry
}
