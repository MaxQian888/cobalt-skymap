use rand::distributions::{Alphanumeric, DistString};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use crate::data::StorageError;

const SECRET_BOOTSTRAP_SERVICE: &str = "com.skymap.desktop.secret-vault";
const SECRET_BOOTSTRAP_ACCOUNT: &str = "bootstrap";
const SECRET_CLIENT_NAME: &str = "skymap";
const SECRET_STORE_NAME: &str = "secrets";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecretVaultBootstrap {
    pub password: String,
    pub vault_path: String,
    pub client_name: String,
    pub store_name: String,
}

fn build_secret_vault_bootstrap(password: String, vault_path: PathBuf) -> SecretVaultBootstrap {
    SecretVaultBootstrap {
        password,
        vault_path: vault_path.to_string_lossy().to_string(),
        client_name: SECRET_CLIENT_NAME.to_string(),
        store_name: SECRET_STORE_NAME.to_string(),
    }
}

fn build_vault_path(app: &AppHandle) -> Result<PathBuf, StorageError> {
    let data_dir = super::path_config::resolve_data_dir(app)?;
    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)?;
    }
    Ok(data_dir.join("secret-vault.hold"))
}

fn get_bootstrap_entry() -> Result<keyring::Entry, StorageError> {
    keyring::Entry::new(SECRET_BOOTSTRAP_SERVICE, SECRET_BOOTSTRAP_ACCOUNT).map_err(|error| {
        StorageError::Other(format!("Failed to create bootstrap keyring entry: {error}"))
    })
}

fn load_or_create_password() -> Result<String, StorageError> {
    let entry = get_bootstrap_entry()?;

    match entry.get_password() {
        Ok(password) if !password.trim().is_empty() => Ok(password),
        Ok(_) | Err(keyring::Error::NoEntry) => {
            let password = Alphanumeric.sample_string(&mut rand::thread_rng(), 64);
            entry.set_password(&password).map_err(|error| {
                StorageError::Other(format!("Failed to save bootstrap password: {error}"))
            })?;
            Ok(password)
        }
        Err(error) => Err(StorageError::Other(format!(
            "Failed to load bootstrap password: {error}"
        ))),
    }
}

#[tauri::command]
pub async fn get_or_create_secret_vault_bootstrap(
    app: AppHandle,
) -> Result<SecretVaultBootstrap, StorageError> {
    let password = load_or_create_password()?;
    let vault_path = build_vault_path(&app)?;

    Ok(build_secret_vault_bootstrap(password, vault_path))
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

    struct SecretBootstrapTestEnv {
        app: App,
        base_dir: PathBuf,
    }

    impl SecretBootstrapTestEnv {
        fn new(prefix: &str) -> Self {
            let app = tauri::Builder::default()
                .build(tauri::generate_context!())
                .expect("test app should build");
            let base_dir = unique_temp_dir(prefix);
            block_on(path_config::reset_paths_to_default(app.handle().clone()))
                .expect("path config should reset before bootstrap tests");
            block_on(path_config::set_custom_data_dir(
                app.handle().clone(),
                base_dir.to_string_lossy().to_string(),
            ))
            .expect("bootstrap test directory should be writable");

            Self { app, base_dir }
        }

        fn handle(&self) -> AppHandle {
            self.app.handle().clone()
        }
    }

    impl Drop for SecretBootstrapTestEnv {
        fn drop(&mut self) {
            let _ = block_on(path_config::reset_paths_to_default(
                self.app.handle().clone(),
            ));
            let _ = fs::remove_dir_all(&self.base_dir);
        }
    }

    #[test]
    fn build_vault_path_uses_custom_data_dir_and_secret_filename() {
        let _guard = cache_test_lock();
        let env = SecretBootstrapTestEnv::new("secret-bootstrap-path");
        let vault_path = build_vault_path(&env.handle()).expect("vault path should resolve");

        assert_eq!(
            vault_path.file_name().and_then(|name| name.to_str()),
            Some("secret-vault.hold")
        );
        assert!(vault_path.parent().is_some_and(|parent| parent.exists()));
        assert!(vault_path.starts_with(&env.base_dir));
    }

    #[test]
    fn build_secret_vault_bootstrap_embeds_expected_constants() {
        let vault_path = PathBuf::from("D:/vaults/secret-vault.hold");
        let bootstrap =
            build_secret_vault_bootstrap("super-secret".to_string(), vault_path.clone());

        assert_eq!(bootstrap.password, "super-secret");
        assert_eq!(bootstrap.vault_path, vault_path.to_string_lossy());
        assert_eq!(bootstrap.client_name, SECRET_CLIENT_NAME);
        assert_eq!(bootstrap.store_name, SECRET_STORE_NAME);
    }

    #[test]
    fn secret_vault_bootstrap_serializes_camel_case_fields() {
        let bootstrap = build_secret_vault_bootstrap(
            "pw".to_string(),
            PathBuf::from("C:/data/secret-vault.hold"),
        );

        let json = serde_json::to_value(bootstrap).expect("bootstrap payload should serialize");
        assert_eq!(json["password"], "pw");
        assert_eq!(json["vaultPath"], "C:/data/secret-vault.hold");
        assert_eq!(json["clientName"], SECRET_CLIENT_NAME);
        assert_eq!(json["storeName"], SECRET_STORE_NAME);
    }
}
