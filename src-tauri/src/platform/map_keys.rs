//! Secure map API key storage.
//! Stores key metadata on disk and key secrets in OS secure credential storage.

use chrono::Utc;
use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::data::StorageError;

const KEYRING_SERVICE: &str = "com.skymap.desktop.mapkeys";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapApiKeyQuota {
    pub daily: Option<u64>,
    pub monthly: Option<u64>,
    pub used: Option<u64>,
    pub reset_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapApiKeyRestrictions {
    pub domains: Option<Vec<String>>,
    pub ips: Option<Vec<String>>,
    pub regions: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapApiKeyMeta {
    pub id: String,
    pub provider: String,
    pub label: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
    pub quota: Option<MapApiKeyQuota>,
    pub restrictions: Option<MapApiKeyRestrictions>,
    pub created_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MapApiKeyRecord {
    #[serde(flatten)]
    pub meta: MapApiKeyMeta,
    pub api_key: String,
}

fn get_meta_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let dir = super::path_config::resolve_data_dir(app)?;
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir.join("map_keys_meta.json"))
}

fn load_meta(app: &AppHandle) -> Result<Vec<MapApiKeyMeta>, StorageError> {
    let path = get_meta_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

fn save_meta(app: &AppHandle, metas: &[MapApiKeyMeta]) -> Result<(), StorageError> {
    let path = get_meta_path(app)?;
    let content = serde_json::to_string_pretty(metas)?;
    fs::write(path, content)?;
    Ok(())
}

fn entry_for_key(key_id: &str) -> Result<Entry, StorageError> {
    Entry::new(KEYRING_SERVICE, key_id)
        .map_err(|e| StorageError::Other(format!("Failed to create keyring entry: {e}")))
}

fn apply_provider_priority_rules(metas: &mut [MapApiKeyMeta], key_meta: &MapApiKeyMeta) {
    if key_meta.is_active.unwrap_or(false) {
        for meta in metas.iter_mut() {
            if meta.provider == key_meta.provider && meta.id != key_meta.id {
                meta.is_active = Some(false);
            }
        }
    }

    if key_meta.is_default.unwrap_or(false) {
        for meta in metas.iter_mut() {
            if meta.provider == key_meta.provider && meta.id != key_meta.id {
                meta.is_default = Some(false);
            }
        }
    }
}

fn ensure_provider_has_default_and_active(metas: &mut [MapApiKeyMeta], provider: &str) {
    let same_provider: Vec<usize> = metas
        .iter()
        .enumerate()
        .filter_map(|(idx, meta)| (meta.provider == provider).then_some(idx))
        .collect();

    if same_provider.is_empty() {
        return;
    }

    let has_active = same_provider
        .iter()
        .any(|idx| metas[*idx].is_active.unwrap_or(false));
    let has_default = same_provider
        .iter()
        .any(|idx| metas[*idx].is_default.unwrap_or(false));

    if !has_default {
        metas[same_provider[0]].is_default = Some(true);
    }
    if !has_active {
        metas[same_provider[0]].is_active = Some(true);
    }
}

fn activate_provider_key(
    metas: &mut [MapApiKeyMeta],
    provider: &str,
    key_id: &str,
    activated_at: String,
) -> bool {
    let found = metas
        .iter()
        .any(|meta| meta.provider == provider && meta.id == key_id);

    if !found {
        return false;
    }

    for meta in metas.iter_mut() {
        if meta.provider == provider {
            meta.is_active = Some(meta.id == key_id);
            if meta.id == key_id {
                meta.last_used = Some(activated_at.clone());
            }
        }
    }

    true
}

#[tauri::command]
pub async fn save_map_api_key(app: AppHandle, key: MapApiKeyRecord) -> Result<(), StorageError> {
    let entry = entry_for_key(&key.meta.id)?;
    entry
        .set_password(&key.api_key)
        .map_err(|e| StorageError::Other(format!("Failed to save key to secure storage: {e}")))?;

    let mut metas = load_meta(&app)?;
    if let Some(existing) = metas.iter_mut().find(|m| m.id == key.meta.id) {
        *existing = key.meta.clone();
    } else {
        metas.push(key.meta.clone());
    }

    apply_provider_priority_rules(&mut metas, &key.meta);

    save_meta(&app, &metas)
}

#[tauri::command]
pub async fn list_map_api_keys_meta(app: AppHandle) -> Result<Vec<MapApiKeyMeta>, StorageError> {
    load_meta(&app)
}

#[tauri::command]
pub async fn get_map_api_key(key_id: String) -> Result<Option<String>, StorageError> {
    let entry = entry_for_key(&key_id)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(StorageError::Other(format!(
            "Failed to read key from secure storage: {e}"
        ))),
    }
}

#[tauri::command]
pub async fn delete_map_api_key(app: AppHandle, key_id: String) -> Result<(), StorageError> {
    let entry = entry_for_key(&key_id)?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => {}
        Err(e) => {
            return Err(StorageError::Other(format!(
                "Failed to delete key from secure storage: {e}"
            )))
        }
    }

    let mut metas = load_meta(&app)?;
    let removed = metas.iter().find(|m| m.id == key_id).cloned();
    metas.retain(|m| m.id != key_id);

    if let Some(removed_meta) = removed {
        ensure_provider_has_default_and_active(&mut metas, &removed_meta.provider);
    }

    save_meta(&app, &metas)
}

#[tauri::command]
pub async fn set_active_map_api_key(
    app: AppHandle,
    provider: String,
    key_id: String,
) -> Result<(), StorageError> {
    let mut metas = load_meta(&app)?;
    let found = activate_provider_key(&mut metas, &provider, &key_id, Utc::now().to_rfc3339());

    if !found {
        return Err(StorageError::Other(format!(
            "Key {key_id} not found for provider {provider}"
        )));
    }

    save_meta(&app, &metas)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf};
    use tauri::{async_runtime::block_on, App, AppHandle};

    use crate::{
        cache::test_support::{cache_test_lock, unique_temp_dir},
        platform::path_config,
    };

    struct MapKeysTestEnv {
        app: App,
        base_dir: PathBuf,
    }

    impl MapKeysTestEnv {
        fn new(prefix: &str) -> Self {
            let app = tauri::Builder::default()
                .build(tauri::generate_context!())
                .expect("test app should build");
            let base_dir = unique_temp_dir(prefix);
            block_on(path_config::reset_paths_to_default(app.handle().clone()))
                .expect("path config should reset before map key tests");
            block_on(path_config::set_custom_data_dir(
                app.handle().clone(),
                base_dir.to_string_lossy().to_string(),
            ))
            .expect("map key test directory should be writable");

            Self { app, base_dir }
        }

        fn handle(&self) -> AppHandle {
            self.app.handle().clone()
        }
    }

    impl Drop for MapKeysTestEnv {
        fn drop(&mut self) {
            let _ = block_on(path_config::reset_paths_to_default(
                self.app.handle().clone(),
            ));
            let _ = fs::remove_dir_all(&self.base_dir);
        }
    }

    fn sample_meta(id: &str, provider: &str) -> MapApiKeyMeta {
        MapApiKeyMeta {
            id: id.to_string(),
            provider: provider.to_string(),
            label: Some(format!("{provider}-{id}")),
            is_default: Some(false),
            is_active: Some(false),
            quota: Some(MapApiKeyQuota {
                daily: Some(1000),
                monthly: Some(10_000),
                used: Some(5),
                reset_date: Some("2026-03-14".to_string()),
            }),
            restrictions: Some(MapApiKeyRestrictions {
                domains: Some(vec!["localhost".to_string()]),
                ips: None,
                regions: Some(vec!["earth".to_string()]),
            }),
            created_at: "2026-03-13T00:00:00Z".to_string(),
            last_used: None,
        }
    }

    #[test]
    fn apply_provider_priority_rules_clears_conflicting_flags() {
        let mut selected = sample_meta("primary", "google");
        selected.is_active = Some(true);
        selected.is_default = Some(true);

        let mut metas = vec![
            {
                let mut meta = sample_meta("backup", "google");
                meta.is_active = Some(true);
                meta.is_default = Some(true);
                meta
            },
            selected.clone(),
            {
                let mut meta = sample_meta("mapbox-key", "mapbox");
                meta.is_active = Some(true);
                meta.is_default = Some(true);
                meta
            },
        ];

        apply_provider_priority_rules(&mut metas, &selected);

        assert_eq!(metas[0].is_active, Some(false));
        assert_eq!(metas[0].is_default, Some(false));
        assert_eq!(metas[1].is_active, Some(true));
        assert_eq!(metas[1].is_default, Some(true));
        assert_eq!(metas[2].is_active, Some(true));
        assert_eq!(metas[2].is_default, Some(true));
    }

    #[test]
    fn ensure_provider_has_default_and_active_promotes_first_remaining_key() {
        let mut metas = vec![
            sample_meta("first", "google"),
            sample_meta("second", "google"),
            {
                let mut meta = sample_meta("other", "mapbox");
                meta.is_active = Some(true);
                meta.is_default = Some(true);
                meta
            },
        ];

        ensure_provider_has_default_and_active(&mut metas, "google");

        assert_eq!(metas[0].is_default, Some(true));
        assert_eq!(metas[0].is_active, Some(true));
        assert_eq!(metas[1].is_default, Some(false));
        assert_eq!(metas[1].is_active, Some(false));
        assert_eq!(metas[2].is_default, Some(true));
        assert_eq!(metas[2].is_active, Some(true));
    }

    #[test]
    fn activate_provider_key_updates_last_used_and_scopes_to_provider() {
        let activated_at = "2026-03-13T08:00:00Z".to_string();
        let mut metas = vec![
            {
                let mut meta = sample_meta("first", "google");
                meta.is_active = Some(true);
                meta
            },
            sample_meta("second", "google"),
            {
                let mut meta = sample_meta("other", "mapbox");
                meta.is_active = Some(true);
                meta
            },
        ];

        let found = activate_provider_key(&mut metas, "google", "second", activated_at.clone());

        assert!(found);
        assert_eq!(metas[0].is_active, Some(false));
        assert_eq!(metas[1].is_active, Some(true));
        assert_eq!(metas[1].last_used.as_deref(), Some(activated_at.as_str()));
        assert_eq!(metas[2].is_active, Some(true));
    }

    #[test]
    fn activate_provider_key_returns_false_without_mutating_when_key_is_missing() {
        let mut metas = vec![
            {
                let mut meta = sample_meta("first", "google");
                meta.is_active = Some(true);
                meta
            },
            sample_meta("second", "google"),
        ];

        let found = activate_provider_key(
            &mut metas,
            "google",
            "missing",
            "2026-03-13T08:00:00Z".to_string(),
        );

        assert!(!found);
        assert_eq!(metas[0].is_active, Some(true));
        assert_eq!(metas[1].is_active, Some(false));
        assert!(metas.iter().all(|meta| meta.last_used.is_none()));
    }

    #[test]
    fn load_meta_returns_empty_when_metadata_file_is_missing() {
        let _guard = cache_test_lock();
        let env = MapKeysTestEnv::new("map-keys-missing-meta");

        let loaded = load_meta(&env.handle()).expect("missing meta file should read as empty");

        assert!(loaded.is_empty());
    }

    #[test]
    fn save_meta_round_trips_records_in_custom_data_dir() {
        let _guard = cache_test_lock();
        let env = MapKeysTestEnv::new("map-keys-roundtrip");
        let app = env.handle();
        let metas = vec![
            {
                let mut meta = sample_meta("primary", "google");
                meta.is_active = Some(true);
                meta.is_default = Some(true);
                meta
            },
            sample_meta("backup", "google"),
        ];

        save_meta(&app, &metas).expect("meta file should be saved");
        let meta_path = get_meta_path(&app).expect("meta path should resolve");
        let loaded = load_meta(&app).expect("meta file should load");

        assert_eq!(
            meta_path.file_name().and_then(|name| name.to_str()),
            Some("map_keys_meta.json")
        );
        assert!(meta_path.exists());
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].id, "primary");
        assert_eq!(loaded[0].provider, "google");
        assert_eq!(
            loaded[0].quota.as_ref().and_then(|quota| quota.daily),
            Some(1000)
        );
        assert_eq!(
            loaded[0]
                .restrictions
                .as_ref()
                .and_then(|restrictions| restrictions.domains.as_ref())
                .and_then(|domains| domains.first())
                .map(String::as_str),
            Some("localhost")
        );
    }
}
