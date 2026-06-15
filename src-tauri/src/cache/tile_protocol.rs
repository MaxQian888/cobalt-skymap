//! HiPS tile cache protocol
//!
//! Registers a custom `hipscache://` URI scheme that serves sky-survey tiles
//! from the offline tile cache (`offline.rs`), fetching and storing on demand.
//!
//! Aladin Lite builds HiPS tile URLs internally by appending
//! `Norder{order}/Dir{dir}/Npix{npix}.{ext}` to a base survey URL. We therefore
//! only rewrite the *base* URL to `http://hipscache.localhost/h/{surveyId}` and
//! let Aladin append the HiPS path. The handler parses the full path, maps tile
//! requests onto the existing `(survey_id, zoom=order, x=npix, y=0)` cache key,
//! and proxies non-tile requests (properties / Allsky / Moc) upstream.
//!
//! This makes Aladin's tile traffic flow through the Rust cache for true
//! offline support, reusing `http_client` (SSRF + proxy + retries) for fetches.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;

use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::cache::offline::{load_cached_tile, save_cached_tile};
use crate::network::http_client::{http_request, RequestConfig};

/// Custom URI scheme name. On Windows (WebView2) requests arrive as
/// `http://hipscache.localhost/...`; on other platforms as `hipscache://...`.
pub const TILE_SCHEME: &str = "hipscache";

/// Survey id -> upstream HiPS base URL (trailing slash trimmed).
static SURVEY_SOURCES: Lazy<RwLock<HashMap<String, String>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

/// When true, the handler never touches the network: cache hit or 404.
/// Avoids long upstream timeouts while the machine is offline.
static OFFLINE_TILE_MODE: AtomicBool = AtomicBool::new(false);

/// Register the id -> upstream-base map. Called by the frontend on boot from
/// `SKY_SURVEYS` so Rust can resolve the upstream URL on a cache miss without
/// duplicating the survey list.
#[tauri::command]
pub fn set_tile_survey_sources(sources: HashMap<String, String>) {
    if let Ok(mut map) = SURVEY_SOURCES.write() {
        *map = sources
            .into_iter()
            .map(|(k, v)| (k, v.trim_end_matches('/').to_string()))
            .collect();
    }
}

/// Toggle offline mode for the tile protocol (cache-only when true).
#[tauri::command]
pub fn set_offline_tile_mode(enabled: bool) {
    OFFLINE_TILE_MODE.store(enabled, Ordering::Relaxed);
}

fn resolve_upstream_base(survey_id: &str) -> Option<String> {
    SURVEY_SOURCES.read().ok()?.get(survey_id).cloned()
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct TileCoords {
    pub order: u8,
    pub npix: u64,
    pub ext: String,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub enum HipsResource {
    /// A HEALPix tile: `Norder{order}/Dir{dir}/Npix{npix}.{ext}`.
    Tile(TileCoords),
    /// Anything else (properties, Allsky.*, Moc.fits, metadata, ...).
    Other,
}

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct ParsedRequest {
    pub survey_id: String,
    pub hips_path: String,
    pub resource: HipsResource,
}

/// Survey ids are sanitized to URL-safe tokens on the frontend (e.g.
/// `P/DSS2/color` -> `P_DSS2_color`), so a valid id contains no path
/// separators and cannot be used for traversal.
pub fn is_valid_survey_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id != "."
        && id != ".."
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
}

pub fn is_allowed_ext(ext: &str) -> bool {
    matches!(ext, "jpg" | "jpeg" | "png" | "webp" | "fits")
}

/// Classify the HiPS-relative path. Only the canonical
/// `Norder{N}/Dir{D}/Npix{P}.{ext}` shape is treated as a cacheable tile.
pub fn classify_hips_path(path: &str) -> HipsResource {
    let segs: Vec<&str> = path.split('/').collect();
    if segs.len() != 3 {
        return HipsResource::Other;
    }
    let order = match segs[0].strip_prefix("Norder").and_then(|s| s.parse::<u8>().ok()) {
        Some(o) => o,
        None => return HipsResource::Other,
    };
    // Dir is a CDS server-side sharding bucket; it must be well-formed but is
    // not part of the cache key (recomputed from npix on the upstream URL).
    if segs[1]
        .strip_prefix("Dir")
        .and_then(|s| s.parse::<u64>().ok())
        .is_none()
    {
        return HipsResource::Other;
    }
    let npix_file = match segs[2].strip_prefix("Npix") {
        Some(s) => s,
        None => return HipsResource::Other,
    };
    let mut dot = npix_file.splitn(2, '.');
    let npix = match dot.next().and_then(|s| s.parse::<u64>().ok()) {
        Some(n) => n,
        None => return HipsResource::Other,
    };
    let ext = dot.next().unwrap_or("jpg").to_ascii_lowercase();
    if !is_allowed_ext(&ext) {
        return HipsResource::Other;
    }
    HipsResource::Tile(TileCoords { order, npix, ext })
}

/// Parse a request path of the form `/h/{surveyId}/{...hipsPath}`.
pub fn parse_request_path(path: &str) -> Option<ParsedRequest> {
    let rest = path.strip_prefix("/h/")?;
    let mut parts = rest.splitn(2, '/');
    let survey_id = parts.next()?.to_string();
    // Aladin appends the HiPS path to the base; since the base already ends with
    // a slash this yields a leading slash (`/h/dss//Norder...`). Trim it so the
    // tile path classifies correctly instead of falling through to a proxy.
    let hips_path = parts
        .next()
        .unwrap_or("")
        .trim_start_matches('/')
        .to_string();
    if !is_valid_survey_id(&survey_id) {
        return None;
    }
    if hips_path.is_empty() || hips_path.contains("..") {
        return None;
    }
    let resource = classify_hips_path(&hips_path);
    Some(ParsedRequest {
        survey_id,
        hips_path,
        resource,
    })
}

pub fn build_upstream_url(base: &str, hips_path: &str) -> String {
    format!("{}/{}", base.trim_end_matches('/'), hips_path)
}

fn content_type_for(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".fits") {
        "application/fits"
    } else if lower.ends_with(".json") {
        "application/json"
    } else {
        // HiPS `properties` and similar metadata files are plain text.
        "text/plain"
    }
}

async fn fetch_upstream(app: AppHandle, url: &str) -> Option<(u16, Vec<u8>)> {
    let config = RequestConfig {
        method: "GET".to_string(),
        url: url.to_string(),
        timeout_seconds: 20,
        max_retries: 1,
        ..Default::default()
    };
    match http_request(app, config).await {
        Ok(resp) => Some((resp.status, resp.body)),
        Err(error) => {
            log::warn!("tile protocol: upstream fetch failed for {url}: {error}");
            None
        }
    }
}

/// Outcome of serving a request: HTTP status, content type, body bytes.
pub type ServeResult = (u16, &'static str, Vec<u8>);

/// Whether a query string requests an explicit prefetch (bypasses offline gate
/// so region pre-download works even when offline mode is enabled).
fn is_prefetch(query: &str) -> bool {
    query.split('&').any(|kv| kv == "prefetch=1")
}

/// Serve a `hipscache` request. Cache-first for tiles; proxy for metadata.
pub async fn serve(app: AppHandle, path: &str, query: &str) -> ServeResult {
    let parsed = match parse_request_path(path) {
        Some(p) => p,
        None => return (400, "text/plain", b"bad request".to_vec()),
    };
    let base = match resolve_upstream_base(&parsed.survey_id) {
        Some(b) => b,
        None => return (404, "text/plain", Vec::new()),
    };
    let offline = OFFLINE_TILE_MODE.load(Ordering::Relaxed) && !is_prefetch(query);
    let content_type = content_type_for(&parsed.hips_path);

    match &parsed.resource {
        HipsResource::Tile(tile) => {
            if let Ok(Some(bytes)) =
                load_cached_tile(app.clone(), parsed.survey_id.clone(), tile.order, tile.npix, 0)
                    .await
            {
                return (200, content_type, bytes);
            }
            if offline {
                return (404, "text/plain", Vec::new());
            }
            let url = build_upstream_url(&base, &parsed.hips_path);
            match fetch_upstream(app.clone(), &url).await {
                Some((status, bytes)) if (200..300).contains(&status) && !bytes.is_empty() => {
                    // Best-effort cache write; a failure (e.g. size cap) is not
                    // fatal — still serve the freshly fetched bytes.
                    let _ = save_cached_tile(
                        app.clone(),
                        parsed.survey_id.clone(),
                        tile.order,
                        tile.npix,
                        0,
                        bytes.clone(),
                    )
                    .await;
                    (200, content_type, bytes)
                }
                _ => (404, "text/plain", Vec::new()),
            }
        }
        HipsResource::Other => {
            if offline {
                return (404, "text/plain", Vec::new());
            }
            let url = build_upstream_url(&base, &parsed.hips_path);
            match fetch_upstream(app.clone(), &url).await {
                Some((status, bytes)) => (status, content_type, bytes),
                None => (502, "text/plain", Vec::new()),
            }
        }
    }
}

// ===========================================================================
// Stellarium offline mirror
//
// Stellarium's WASM engine fetches HiPS tiles via Emscripten (not interceptable
// by the tile protocol). To support offline survey viewing we mirror a remote
// HiPS tree onto disk under the asset-protocol-scoped
// `$APPDATA/skymap/stellarium-override/{survey_id}/`, then point the engine at
// the local copy via `convertFileSrc`.
// ===========================================================================

#[derive(Debug, Serialize)]
pub struct PredownloadResult {
    pub survey_id: String,
    pub dir: String,
    pub downloaded: u64,
    pub failed: u64,
}

#[derive(Debug, Serialize)]
pub struct PredownloadedSurvey {
    pub survey_id: String,
    pub dir: String,
}

fn override_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("skymap")
        .join("stellarium-override"))
}

/// Build the whole-sky HiPS-relative tile paths for orders `0..=max_order`.
fn build_tile_list(max_order: u8, ext: &str) -> Vec<String> {
    let mut rels = Vec::new();
    for order in 0..=max_order {
        let nside: u64 = 1 << order;
        let npix = 12 * nside * nside;
        for p in 0..npix {
            let bucket = (p / 10000) * 10000;
            rels.push(format!("Norder{order}/Dir{bucket}/Npix{p}.{ext}"));
        }
    }
    rels
}

fn write_rel(base: &Path, rel: &str, bytes: &[u8]) -> std::io::Result<()> {
    if rel.contains("..") {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "path traversal",
        ));
    }
    let path = base.join(rel);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&path, bytes)
}

async fn fetch_ok(app: &AppHandle, url: &str) -> Option<Vec<u8>> {
    match fetch_upstream(app.clone(), url).await {
        Some((status, bytes)) if (200..300).contains(&status) && !bytes.is_empty() => Some(bytes),
        _ => None,
    }
}

/// Mirror a remote HiPS survey (whole-sky, orders `0..=max_order`, plus
/// `properties`/`Moc.fits`) into the local override directory.
#[tauri::command]
pub async fn predownload_hips_to_dir(
    app: AppHandle,
    survey_id: String,
    base_url: String,
    max_order: u8,
    ext: Option<String>,
) -> Result<PredownloadResult, String> {
    if !is_valid_survey_id(&survey_id) {
        return Err("invalid survey id".to_string());
    }
    let ext = ext.unwrap_or_else(|| "jpg".to_string());
    if !is_allowed_ext(&ext) {
        return Err("invalid tile extension".to_string());
    }
    let base = base_url.trim_end_matches('/').to_string();
    let target = override_base_dir(&app)?.join(&survey_id);
    std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;

    let mut downloaded = 0u64;
    let mut failed = 0u64;

    // Metadata files (best-effort).
    for meta in ["properties", "Moc.fits"] {
        if let Some(bytes) = fetch_ok(&app, &format!("{base}/{meta}")).await {
            match write_rel(&target, meta, &bytes) {
                Ok(()) => downloaded += 1,
                Err(_) => failed += 1,
            }
        }
    }

    // Tiles with bounded concurrency.
    use futures_util::stream::{self, StreamExt};
    let rels = build_tile_list(max_order, &ext);
    let outcomes: Vec<bool> = stream::iter(rels.into_iter())
        .map(|rel| {
            let app = app.clone();
            let base = base.clone();
            let target = target.clone();
            async move {
                let url = format!("{base}/{rel}");
                match fetch_ok(&app, &url).await {
                    Some(bytes) => write_rel(&target, &rel, &bytes).is_ok(),
                    None => false,
                }
            }
        })
        .buffer_unordered(6)
        .collect()
        .await;
    for ok in outcomes {
        if ok {
            downloaded += 1;
        } else {
            failed += 1;
        }
    }

    Ok(PredownloadResult {
        survey_id,
        dir: target.to_string_lossy().to_string(),
        downloaded,
        failed,
    })
}

/// List surveys that have a local mirror on disk.
#[tauri::command]
pub fn list_predownloaded_surveys(app: AppHandle) -> Result<Vec<PredownloadedSurvey>, String> {
    let base = override_base_dir(&app)?;
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    out.push(PredownloadedSurvey {
                        survey_id: name.to_string(),
                        dir: path.to_string_lossy().to_string(),
                    });
                }
            }
        }
    }
    Ok(out)
}

/// Register the `hipscache` async URI scheme on the Tauri builder.
///
/// Uses the concrete default runtime because the underlying cache/HTTP commands
/// (`load_cached_tile`, `http_request`, ...) are defined over `AppHandle`.
pub fn register(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.register_asynchronous_uri_scheme_protocol(TILE_SCHEME, move |ctx, request, responder| {
        let app = ctx.app_handle().clone();
        let uri = request.uri();
        let path = uri.path().to_string();
        let query = uri.query().unwrap_or("").to_string();
        tauri::async_runtime::spawn(async move {
            let (status, content_type, body) = serve(app, &path, &query).await;
            let response = tauri::http::Response::builder()
                .status(status)
                .header("Content-Type", content_type)
                .header("Access-Control-Allow-Origin", "*")
                .body(body)
                .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()));
            responder.respond(response);
        });
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_survey_ids() {
        assert!(is_valid_survey_id("P_DSS2_color"));
        assert!(is_valid_survey_id("dss"));
        assert!(is_valid_survey_id("CDS-P-2MASS-J"));
        assert!(!is_valid_survey_id(""));
        assert!(!is_valid_survey_id(".."));
        assert!(!is_valid_survey_id("a/b")); // no separators
        assert!(!is_valid_survey_id("a b")); // no spaces
    }

    #[test]
    fn allowed_extensions() {
        for ext in ["jpg", "jpeg", "png", "webp", "fits"] {
            assert!(is_allowed_ext(ext));
        }
        assert!(!is_allowed_ext("svg"));
        assert!(!is_allowed_ext("exe"));
    }

    #[test]
    fn classifies_tile_path() {
        assert_eq!(
            classify_hips_path("Norder3/Dir0/Npix12.jpg"),
            HipsResource::Tile(TileCoords {
                order: 3,
                npix: 12,
                ext: "jpg".to_string()
            })
        );
        assert_eq!(
            classify_hips_path("Norder9/Dir30000/Npix34567.png"),
            HipsResource::Tile(TileCoords {
                order: 9,
                npix: 34567,
                ext: "png".to_string()
            })
        );
    }

    #[test]
    fn classifies_non_tile_paths_as_other() {
        assert_eq!(classify_hips_path("properties"), HipsResource::Other);
        assert_eq!(classify_hips_path("Norder3/Allsky.jpg"), HipsResource::Other);
        assert_eq!(classify_hips_path("Moc.fits"), HipsResource::Other);
        assert_eq!(
            classify_hips_path("Norder3/Dir0/Npix12.svg"),
            HipsResource::Other
        );
        assert_eq!(
            classify_hips_path("Norder3/DirX/Npix12.jpg"),
            HipsResource::Other
        );
    }

    #[test]
    fn parses_tile_request() {
        let parsed = parse_request_path("/h/dss/Norder3/Dir0/Npix12.jpg").unwrap();
        assert_eq!(parsed.survey_id, "dss");
        assert_eq!(parsed.hips_path, "Norder3/Dir0/Npix12.jpg");
        assert_eq!(
            parsed.resource,
            HipsResource::Tile(TileCoords {
                order: 3,
                npix: 12,
                ext: "jpg".to_string()
            })
        );
    }

    #[test]
    fn tolerates_double_slash_from_trailing_base() {
        // base ending in '/' + Aladin's own '/' -> `/h/dss//Norder...`
        let parsed = parse_request_path("/h/dss//Norder3/Dir0/Npix12.jpg").unwrap();
        assert_eq!(parsed.survey_id, "dss");
        assert_eq!(parsed.hips_path, "Norder3/Dir0/Npix12.jpg");
        assert_eq!(
            parsed.resource,
            HipsResource::Tile(TileCoords {
                order: 3,
                npix: 12,
                ext: "jpg".to_string()
            })
        );
    }

    #[test]
    fn parses_metadata_request() {
        let parsed = parse_request_path("/h/P_DSS2_color/properties").unwrap();
        assert_eq!(parsed.survey_id, "P_DSS2_color");
        assert_eq!(parsed.resource, HipsResource::Other);
    }

    #[test]
    fn rejects_malformed_requests() {
        assert!(parse_request_path("/tile/dss/Norder3").is_none()); // wrong prefix
        assert!(parse_request_path("/h/dss").is_none()); // no hips path
        assert!(parse_request_path("/h/dss/").is_none()); // empty hips path
        assert!(parse_request_path("/h/../etc/passwd").is_none()); // traversal id
        assert!(parse_request_path("/h/dss/../../secret").is_none()); // traversal path
    }

    #[test]
    fn builds_upstream_url() {
        assert_eq!(
            build_upstream_url("https://alasky.cds.unistra.fr/DSS/DSSColor", "Norder3/Dir0/Npix12.jpg"),
            "https://alasky.cds.unistra.fr/DSS/DSSColor/Norder3/Dir0/Npix12.jpg"
        );
        // Trailing slash on the base is normalized.
        assert_eq!(
            build_upstream_url("https://host/survey/", "properties"),
            "https://host/survey/properties"
        );
    }

    #[test]
    fn builds_whole_sky_tile_list() {
        let rels = build_tile_list(1, "jpg");
        // order 0 = 12 tiles, order 1 = 48 tiles.
        assert_eq!(rels.len(), 12 + 48);
        assert!(rels.contains(&"Norder0/Dir0/Npix0.jpg".to_string()));
        assert!(rels.contains(&"Norder1/Dir0/Npix47.jpg".to_string()));
    }

    #[test]
    fn content_types() {
        assert_eq!(content_type_for("Norder3/Dir0/Npix12.jpg"), "image/jpeg");
        assert_eq!(content_type_for("Norder3/Dir0/Npix12.png"), "image/png");
        assert_eq!(content_type_for("Moc.fits"), "application/fits");
        assert_eq!(content_type_for("properties"), "text/plain");
    }
}
