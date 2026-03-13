//! Enhanced HTTP client module
//! Provides HTTP requests with retries, progress reporting, and cancellation

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::security::{self, SecurityError};

#[derive(Debug, thiserror::Error)]
pub enum HttpClientError {
    #[error("Request error: {0}")]
    Request(String),
    #[error("Security error: {0}")]
    Security(#[from] SecurityError),
    #[error("Timeout after {0} seconds")]
    Timeout(u64),
    #[error("Request cancelled")]
    Cancelled,
    #[error("Max retries exceeded: {0}")]
    MaxRetries(String),
    #[error("Invalid response: {0}")]
    InvalidResponse(String),
}

impl Serialize for HttpClientError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestConfig {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body: Option<Vec<u8>>,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u64,
    #[serde(default)]
    pub max_retries: u32,
    #[serde(default)]
    pub retry_delay_ms: u64,
    #[serde(default)]
    pub request_id: Option<String>,
    #[serde(default)]
    pub allow_http: bool,
    #[serde(default)]
    pub report_progress: bool,
}

fn default_timeout() -> u64 {
    30
}

impl Default for RequestConfig {
    fn default() -> Self {
        Self {
            method: "GET".to_string(),
            url: String::new(),
            headers: HashMap::new(),
            body: None,
            timeout_seconds: 30,
            max_retries: 3,
            retry_delay_ms: 1000,
            request_id: None,
            allow_http: false,
            report_progress: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub content_type: Option<String>,
    pub content_length: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgress {
    pub request_id: String,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: f64,
}

static ACTIVE_REQUESTS: Lazy<Arc<Mutex<HashMap<String, bool>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

fn is_cancelled(request_id: &Option<String>) -> bool {
    if let Some(id) = request_id {
        if let Ok(requests) = ACTIVE_REQUESTS.lock() {
            if let Some(&cancelled) = requests.get(id) {
                return cancelled;
            }
        }
    }
    false
}

fn register_request(request_id: &Option<String>) {
    if let Some(id) = request_id {
        if let Ok(mut requests) = ACTIVE_REQUESTS.lock() {
            requests.insert(id.clone(), false);
        }
    }
}

fn unregister_request(request_id: &Option<String>) {
    if let Some(id) = request_id {
        if let Ok(mut requests) = ACTIVE_REQUESTS.lock() {
            requests.remove(id);
        }
    }
}

#[tauri::command]
pub async fn http_request(
    app: AppHandle,
    config: RequestConfig,
) -> Result<HttpResponse, HttpClientError> {
    security::validate_url(&config.url, config.allow_http, None)?;
    register_request(&config.request_id);

    // Get global HTTP configuration
    let global_config = HTTP_CONFIG.lock().map(|c| c.clone()).unwrap_or_default();

    // Build client with global and request-specific configuration
    let mut client_builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(config.timeout_seconds))
        .connect_timeout(Duration::from_millis(global_config.connect_timeout_ms))
        .user_agent(&global_config.user_agent);

    // Apply compression setting
    if global_config.enable_compression {
        client_builder = client_builder.gzip(true).deflate(true);
    } else {
        client_builder = client_builder.no_gzip().no_deflate();
    }

    // Apply redirect settings
    if global_config.follow_redirects {
        client_builder = client_builder.redirect(reqwest::redirect::Policy::limited(
            global_config.max_redirects as usize,
        ));
    } else {
        client_builder = client_builder.redirect(reqwest::redirect::Policy::none());
    }

    // Apply proxy if configured
    if let Some(ref proxy_url) = global_config.proxy_url {
        if let Ok(proxy) = reqwest::Proxy::all(proxy_url) {
            client_builder = client_builder.proxy(proxy);
        }
    }

    let client = client_builder
        .build()
        .map_err(|e| HttpClientError::Request(e.to_string()))?;

    let mut last_error = None;
    for attempt in 0..=config.max_retries {
        if is_cancelled(&config.request_id) {
            unregister_request(&config.request_id);
            return Err(HttpClientError::Cancelled);
        }

        if attempt > 0 {
            let delay = config.retry_delay_ms * 2u64.pow(attempt - 1);
            tokio::time::sleep(Duration::from_millis(delay)).await;
        }

        let mut request = match config.method.to_uppercase().as_str() {
            "GET" => client.get(&config.url),
            "POST" => client.post(&config.url),
            "PUT" => client.put(&config.url),
            "DELETE" => client.delete(&config.url),
            "HEAD" => client.head(&config.url),
            _ => client.get(&config.url),
        };

        for (key, value) in &config.headers {
            request = request.header(key, value);
        }

        if let Some(body) = &config.body {
            request = request.body(body.clone());
        }

        match request.send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let content_type = response
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .map(String::from);
                let content_length = response.content_length();

                let mut headers = HashMap::new();
                for (key, value) in response.headers() {
                    if let Ok(v) = value.to_str() {
                        headers.insert(key.to_string(), v.to_string());
                    }
                }

                let body = if let (true, Some(total)) = (config.report_progress, content_length) {
                    // Validate response size before allocation
                    if total > global_config.max_response_size as u64 {
                        return Err(HttpClientError::InvalidResponse(format!(
                            "Response size {} exceeds maximum allowed {}",
                            total, global_config.max_response_size
                        )));
                    }
                    let mut downloaded = 0u64;
                    let mut body_bytes = Vec::with_capacity(total as usize);
                    let mut stream = response.bytes_stream();
                    let mut stream_error = None;

                    use futures_util::StreamExt;
                    while let Some(chunk) = stream.next().await {
                        if is_cancelled(&config.request_id) {
                            unregister_request(&config.request_id);
                            return Err(HttpClientError::Cancelled);
                        }

                        match chunk {
                            Ok(bytes) => {
                                downloaded += bytes.len() as u64;
                                body_bytes.extend_from_slice(&bytes);

                                if let Some(ref id) = config.request_id {
                                    let _ = app.emit(
                                        "download-progress",
                                        DownloadProgress {
                                            request_id: id.clone(),
                                            downloaded,
                                            total: Some(total),
                                            percent: (downloaded as f64 / total as f64) * 100.0,
                                        },
                                    );
                                }
                            }
                            Err(e) => {
                                stream_error = Some(HttpClientError::Request(e.to_string()));
                                break;
                            }
                        }
                    }

                    // If streaming failed, retry in outer loop
                    if let Some(err) = stream_error {
                        last_error = Some(err);
                        continue;
                    }
                    body_bytes
                } else {
                    response
                        .bytes()
                        .await
                        .map_err(|e| HttpClientError::Request(e.to_string()))?
                        .to_vec()
                };

                unregister_request(&config.request_id);
                return Ok(HttpResponse {
                    status,
                    headers,
                    body,
                    content_type,
                    content_length,
                });
            }
            Err(e) => {
                last_error = Some(if e.is_timeout() {
                    HttpClientError::Timeout(config.timeout_seconds)
                } else {
                    HttpClientError::Request(e.to_string())
                });
            }
        }
    }

    unregister_request(&config.request_id);
    Err(HttpClientError::MaxRetries(
        last_error.map(|e| e.to_string()).unwrap_or_default(),
    ))
}

#[tauri::command]
pub async fn http_download(
    app: AppHandle,
    url: String,
    request_id: String,
    allow_http: bool,
) -> Result<HttpResponse, HttpClientError> {
    http_request(
        app,
        RequestConfig {
            method: "GET".to_string(),
            url,
            request_id: Some(request_id),
            allow_http,
            report_progress: true,
            ..Default::default()
        },
    )
    .await
}

#[tauri::command]
pub fn cancel_request(request_id: String) -> bool {
    if let Ok(mut requests) = ACTIVE_REQUESTS.lock() {
        if let std::collections::hash_map::Entry::Occupied(mut e) = requests.entry(request_id) {
            e.insert(true);
            return true;
        }
    }
    false
}

#[tauri::command]
pub fn get_active_requests() -> Vec<String> {
    ACTIVE_REQUESTS
        .lock()
        .map(|r| r.keys().cloned().collect())
        .unwrap_or_default()
}

// ============================================================================
// HTTP Client Configuration
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpClientConfig {
    pub connect_timeout_ms: u64,
    pub read_timeout_ms: u64,
    pub request_timeout_ms: u64,
    pub max_retries: u32,
    pub retry_base_delay_ms: u64,
    pub retry_max_delay_ms: u64,
    pub user_agent: String,
    pub proxy_url: Option<String>,
    pub max_response_size: usize,
    pub enable_compression: bool,
    pub follow_redirects: bool,
    pub max_redirects: u32,
}

impl Default for HttpClientConfig {
    fn default() -> Self {
        Self {
            connect_timeout_ms: 10000,
            read_timeout_ms: 30000,
            request_timeout_ms: 60000,
            max_retries: 3,
            retry_base_delay_ms: 1000,
            retry_max_delay_ms: 30000,
            user_agent: format!("SkyMap/{}", env!("CARGO_PKG_VERSION")),
            proxy_url: None,
            max_response_size: 100 * 1024 * 1024, // 100MB
            enable_compression: true,
            follow_redirects: true,
            max_redirects: 10,
        }
    }
}

static HTTP_CONFIG: Lazy<Arc<Mutex<HttpClientConfig>>> =
    Lazy::new(|| Arc::new(Mutex::new(HttpClientConfig::default())));

/// Build a reqwest client with global configuration applied
fn build_configured_client(timeout_secs: u64) -> Result<reqwest::Client, HttpClientError> {
    let global_config = HTTP_CONFIG.lock().map(|c| c.clone()).unwrap_or_default();

    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_millis(global_config.connect_timeout_ms))
        .user_agent(&global_config.user_agent);

    if global_config.enable_compression {
        builder = builder.gzip(true).deflate(true);
    } else {
        builder = builder.no_gzip().no_deflate();
    }

    if global_config.follow_redirects {
        builder = builder.redirect(reqwest::redirect::Policy::limited(
            global_config.max_redirects as usize,
        ));
    } else {
        builder = builder.redirect(reqwest::redirect::Policy::none());
    }

    if let Some(ref proxy_url) = global_config.proxy_url {
        if let Ok(proxy) = reqwest::Proxy::all(proxy_url) {
            builder = builder.proxy(proxy);
        }
    }

    builder
        .build()
        .map_err(|e| HttpClientError::Request(e.to_string()))
}

#[tauri::command]
pub fn get_http_config() -> HttpClientConfig {
    HTTP_CONFIG.lock().map(|c| c.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn set_http_config(config: HttpClientConfig) {
    if let Ok(mut cfg) = HTTP_CONFIG.lock() {
        *cfg = config;
    }
}

// ============================================================================
// Convenience HTTP Methods
// ============================================================================

#[tauri::command]
pub async fn http_get(
    app: AppHandle,
    url: String,
    headers: Option<HashMap<String, String>>,
    allow_http: Option<bool>,
) -> Result<HttpResponse, HttpClientError> {
    http_request(
        app,
        RequestConfig {
            method: "GET".to_string(),
            url,
            headers: headers.unwrap_or_default(),
            allow_http: allow_http.unwrap_or(false),
            ..Default::default()
        },
    )
    .await
}

#[tauri::command]
pub async fn http_post(
    app: AppHandle,
    url: String,
    body: Vec<u8>,
    content_type: Option<String>,
    headers: Option<HashMap<String, String>>,
    allow_http: Option<bool>,
) -> Result<HttpResponse, HttpClientError> {
    let mut hdrs = headers.unwrap_or_default();
    if let Some(ct) = content_type {
        hdrs.insert("Content-Type".to_string(), ct);
    }
    http_request(
        app,
        RequestConfig {
            method: "POST".to_string(),
            url,
            headers: hdrs,
            body: Some(body),
            allow_http: allow_http.unwrap_or(false),
            ..Default::default()
        },
    )
    .await
}

#[tauri::command]
pub async fn http_head(
    url: String,
    allow_http: Option<bool>,
) -> Result<HashMap<String, String>, HttpClientError> {
    security::validate_url(&url, allow_http.unwrap_or(false), None)?;

    let client = build_configured_client(30)?;

    let response = client
        .head(&url)
        .send()
        .await
        .map_err(|e| HttpClientError::Request(e.to_string()))?;

    let mut headers = HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(v) = value.to_str() {
            headers.insert(key.to_string(), v.to_string());
        }
    }
    Ok(headers)
}

#[tauri::command]
pub async fn http_check_url(
    url: String,
    allow_http: Option<bool>,
) -> Result<bool, HttpClientError> {
    security::validate_url(&url, allow_http.unwrap_or(false), None)?;

    let client = build_configured_client(10)?;

    match client.head(&url).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn http_cancel_request(request_id: String) -> bool {
    cancel_request(request_id)
}

#[tauri::command]
pub fn http_cancel_all_requests() {
    if let Ok(mut requests) = ACTIVE_REQUESTS.lock() {
        for (_, cancelled) in requests.iter_mut() {
            *cancelled = true;
        }
    }
}

// ============================================================================
// Batch Download
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchDownloadResult {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub results: Vec<BatchItemResult>,
    pub total_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItemResult {
    pub url: String,
    pub success: bool,
    pub status: Option<u16>,
    pub size: Option<usize>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn http_batch_download(
    app: AppHandle,
    urls: Vec<String>,
    concurrency: Option<usize>,
    allow_http: Option<bool>,
) -> Result<BatchDownloadResult, HttpClientError> {
    use futures_util::stream::{self, StreamExt};

    let start = std::time::Instant::now();
    let concurrency = concurrency.unwrap_or(4).min(10);
    let allow_http = allow_http.unwrap_or(false);

    let results: Vec<BatchItemResult> = stream::iter(urls.clone())
        .map(|url| {
            let app_clone = app.clone();
            async move {
                match http_request(
                    app_clone,
                    RequestConfig {
                        method: "GET".to_string(),
                        url: url.clone(),
                        allow_http,
                        ..Default::default()
                    },
                )
                .await
                {
                    Ok(response) => BatchItemResult {
                        url,
                        success: response.status >= 200 && response.status < 300,
                        status: Some(response.status),
                        size: Some(response.body.len()),
                        error: None,
                    },
                    Err(e) => BatchItemResult {
                        url,
                        success: false,
                        status: None,
                        size: None,
                        error: Some(e.to_string()),
                    },
                }
            }
        })
        .buffer_unordered(concurrency)
        .collect()
        .await;

    let success = results.iter().filter(|r| r.success).count();
    let failed = results.len() - success;

    Ok(BatchDownloadResult {
        total: results.len(),
        success,
        failed,
        results,
        total_time_ms: start.elapsed().as_millis() as u64,
    })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, MutexGuard};

    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    struct HttpTestContext {
        _guard: MutexGuard<'static, ()>,
        original_config: HttpClientConfig,
    }

    impl HttpTestContext {
        fn new() -> Self {
            let guard = TEST_MUTEX.lock().unwrap();
            let original_config = get_http_config();
            clear_active_requests();

            Self {
                _guard: guard,
                original_config,
            }
        }
    }

    impl Drop for HttpTestContext {
        fn drop(&mut self) {
            set_http_config(self.original_config.clone());
            clear_active_requests();
        }
    }

    fn clear_active_requests() {
        ACTIVE_REQUESTS.lock().unwrap().clear();
    }

    // ------------------------------------------------------------------------
    // RequestConfig Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_request_config_default() {
        let config = RequestConfig::default();
        assert_eq!(config.method, "GET");
        assert!(config.url.is_empty());
        assert!(config.headers.is_empty());
        assert!(config.body.is_none());
        assert_eq!(config.timeout_seconds, 30);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.retry_delay_ms, 1000);
        assert!(!config.allow_http);
        assert!(!config.report_progress);
    }

    #[test]
    fn test_request_config_serialization() {
        let config = RequestConfig {
            method: "POST".to_string(),
            url: "https://example.com".to_string(),
            headers: HashMap::from([("Content-Type".to_string(), "application/json".to_string())]),
            body: Some(vec![1, 2, 3]),
            timeout_seconds: 60,
            max_retries: 5,
            retry_delay_ms: 2000,
            request_id: Some("test-123".to_string()),
            allow_http: true,
            report_progress: true,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("POST"));
        assert!(json.contains("example.com"));
        assert!(json.contains("Content-Type"));
    }

    #[test]
    fn test_request_config_deserialization() {
        let json = r#"{
            "method": "GET",
            "url": "https://test.com",
            "timeout_seconds": 45
        }"#;

        let config: RequestConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.method, "GET");
        assert_eq!(config.url, "https://test.com");
        assert_eq!(config.timeout_seconds, 45);
        // Defaults should be applied
        assert!(config.headers.is_empty());
    }

    // ------------------------------------------------------------------------
    // HttpResponse Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_http_response_structure() {
        let response = HttpResponse {
            status: 200,
            headers: HashMap::from([("content-type".to_string(), "text/plain".to_string())]),
            body: vec![72, 101, 108, 108, 111], // "Hello"
            content_type: Some("text/plain".to_string()),
            content_length: Some(5),
        };

        assert_eq!(response.status, 200);
        assert_eq!(response.body.len(), 5);
        assert!(response.content_type.is_some());
    }

    #[test]
    fn test_http_response_serialization() {
        let response = HttpResponse {
            status: 404,
            headers: HashMap::new(),
            body: vec![],
            content_type: None,
            content_length: None,
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("404"));
    }

    // ------------------------------------------------------------------------
    // DownloadProgress Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_download_progress_structure() {
        let progress = DownloadProgress {
            request_id: "test-123".to_string(),
            downloaded: 1024,
            total: Some(2048),
            percent: 50.0,
        };

        assert_eq!(progress.request_id, "test-123");
        assert_eq!(progress.downloaded, 1024);
        assert_eq!(progress.percent, 50.0);
    }

    #[test]
    fn test_download_progress_serialization() {
        let progress = DownloadProgress {
            request_id: "req-1".to_string(),
            downloaded: 500,
            total: Some(1000),
            percent: 50.0,
        };

        let json = serde_json::to_string(&progress).unwrap();
        assert!(json.contains("req-1"));
        assert!(json.contains("50"));
    }

    // ------------------------------------------------------------------------
    // HttpClientConfig Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_http_client_config_default() {
        let config = HttpClientConfig::default();
        assert_eq!(config.connect_timeout_ms, 10000);
        assert_eq!(config.read_timeout_ms, 30000);
        assert_eq!(config.request_timeout_ms, 60000);
        assert_eq!(config.max_retries, 3);
        assert!(config.enable_compression);
        assert!(config.follow_redirects);
        assert_eq!(config.max_redirects, 10);
        assert!(config.user_agent.contains("SkyMap"));
    }

    #[test]
    fn test_http_client_config_serialization() {
        let config = HttpClientConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("connect_timeout_ms"));
        assert!(json.contains("user_agent"));
    }

    // ------------------------------------------------------------------------
    // BatchDownloadResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_batch_download_result_structure() {
        let result = BatchDownloadResult {
            total: 10,
            success: 8,
            failed: 2,
            results: vec![],
            total_time_ms: 5000,
        };

        assert_eq!(result.total, 10);
        assert_eq!(result.success, 8);
        assert_eq!(result.failed, 2);
    }

    #[test]
    fn test_batch_download_result_serialization() {
        let result = BatchDownloadResult {
            total: 5,
            success: 4,
            failed: 1,
            results: vec![BatchItemResult {
                url: "https://example.com/1".to_string(),
                success: true,
                status: Some(200),
                size: Some(1024),
                error: None,
            }],
            total_time_ms: 1000,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("total"));
        assert!(json.contains("success"));
        assert!(json.contains("example.com"));
    }

    // ------------------------------------------------------------------------
    // BatchItemResult Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_batch_item_result_success() {
        let result = BatchItemResult {
            url: "https://example.com".to_string(),
            success: true,
            status: Some(200),
            size: Some(1024),
            error: None,
        };

        assert!(result.success);
        assert!(result.error.is_none());
    }

    #[test]
    fn test_batch_item_result_failure() {
        let result = BatchItemResult {
            url: "https://example.com".to_string(),
            success: false,
            status: None,
            size: None,
            error: Some("Connection refused".to_string()),
        };

        assert!(!result.success);
        assert!(result.error.is_some());
    }

    // ------------------------------------------------------------------------
    // HttpClientError Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_http_client_error_display() {
        let err = HttpClientError::Timeout(30);
        assert_eq!(format!("{}", err), "Timeout after 30 seconds");

        let err = HttpClientError::Cancelled;
        assert_eq!(format!("{}", err), "Request cancelled");

        let err = HttpClientError::Request("Network error".to_string());
        assert!(format!("{}", err).contains("Network error"));
    }

    #[test]
    fn test_http_client_error_serialization() {
        let err = HttpClientError::Timeout(60);
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("Timeout"));
        assert!(json.contains("60"));
    }

    #[test]
    fn test_http_client_error_max_retries() {
        let err = HttpClientError::MaxRetries("All retries failed".to_string());
        let display = format!("{}", err);
        assert!(display.contains("Max retries exceeded"));
    }

    #[test]
    fn test_http_client_error_invalid_response() {
        let err = HttpClientError::InvalidResponse("Bad JSON".to_string());
        let display = format!("{}", err);
        assert!(display.contains("Invalid response"));
    }

    // ------------------------------------------------------------------------
    // Request Management Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_cancel_request_nonexistent() {
        let _ctx = HttpTestContext::new();

        // Cancelling a nonexistent request should return false
        let result = cancel_request("nonexistent-request-id".to_string());
        assert!(!result);
    }

    #[test]
    fn test_get_active_requests_empty() {
        let _ctx = HttpTestContext::new();

        assert!(get_active_requests().is_empty());
    }

    #[test]
    fn test_cancel_request_marks_registered_request_cancelled() {
        let _ctx = HttpTestContext::new();
        let request_id = Some("cancel-me".to_string());

        register_request(&request_id);

        assert!(cancel_request("cancel-me".to_string()));
        assert!(is_cancelled(&request_id));
    }

    #[test]
    fn test_get_active_requests_returns_registered_request_ids() {
        let _ctx = HttpTestContext::new();
        let first = Some("req-1".to_string());
        let second = Some("req-2".to_string());

        register_request(&first);
        register_request(&second);

        let active = get_active_requests();
        assert_eq!(active.len(), 2);
        assert!(active.contains(&"req-1".to_string()));
        assert!(active.contains(&"req-2".to_string()));
    }

    #[test]
    fn test_http_cancel_all_requests_marks_registered_requests_as_cancelled() {
        let _ctx = HttpTestContext::new();
        let first = Some("req-1".to_string());
        let second = Some("req-2".to_string());

        register_request(&first);
        register_request(&second);

        http_cancel_all_requests();

        assert!(is_cancelled(&first));
        assert!(is_cancelled(&second));
    }

    #[test]
    fn test_http_cancel_request_wrapper_delegates_to_cancel_request() {
        let _ctx = HttpTestContext::new();
        let request_id = Some("wrapped-cancel".to_string());

        register_request(&request_id);

        assert!(http_cancel_request("wrapped-cancel".to_string()));
        assert!(is_cancelled(&request_id));
    }

    #[test]
    fn test_get_http_config() {
        let _ctx = HttpTestContext::new();
        let config = get_http_config();
        // Should return default config or whatever is set
        assert!(config.connect_timeout_ms > 0);
        assert!(!config.user_agent.is_empty());
    }

    #[test]
    fn test_set_http_config() {
        let _ctx = HttpTestContext::new();

        let new_config = HttpClientConfig {
            connect_timeout_ms: 5000,
            ..HttpClientConfig::default()
        };

        set_http_config(new_config);

        let updated = get_http_config();
        assert_eq!(updated.connect_timeout_ms, 5000);
    }

    #[test]
    fn test_build_configured_client_ignores_invalid_proxy_url() {
        let _ctx = HttpTestContext::new();
        set_http_config(HttpClientConfig {
            proxy_url: Some("not a valid proxy url".to_string()),
            ..HttpClientConfig::default()
        });

        assert!(build_configured_client(5).is_ok());
    }

    // ------------------------------------------------------------------------
    // Helper Function Tests
    // ------------------------------------------------------------------------

    #[test]
    fn test_default_timeout() {
        assert_eq!(default_timeout(), 30);
    }

    #[test]
    fn test_is_cancelled_none_request_id() {
        // When request_id is None, should return false
        assert!(!is_cancelled(&None));
    }

    #[test]
    fn test_register_unregister_request() {
        let _ctx = HttpTestContext::new();
        let request_id = Some("test-reg-123".to_string());

        // Register
        register_request(&request_id);

        // Should not be cancelled after registration
        assert!(!is_cancelled(&request_id));

        // Unregister
        unregister_request(&request_id);

        // After unregister, is_cancelled returns false (not found = not cancelled)
        assert!(!is_cancelled(&request_id));
    }

    // ------------------------------------------------------------------------
    // Edge Cases
    // ------------------------------------------------------------------------

    #[test]
    fn test_request_config_with_empty_headers() {
        let config = RequestConfig {
            method: "GET".to_string(),
            url: "https://example.com".to_string(),
            headers: HashMap::new(),
            ..Default::default()
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("headers"));
    }

    #[test]
    fn test_http_response_empty_body() {
        let response = HttpResponse {
            status: 204, // No Content
            headers: HashMap::new(),
            body: vec![],
            content_type: None,
            content_length: Some(0),
        };

        assert!(response.body.is_empty());
        assert_eq!(response.status, 204);
    }

    #[test]
    fn test_download_progress_no_total() {
        let progress = DownloadProgress {
            request_id: "unknown-size".to_string(),
            downloaded: 1000,
            total: None,
            percent: 0.0,
        };

        assert!(progress.total.is_none());
        assert_eq!(progress.percent, 0.0);
    }

    #[test]
    fn test_http_client_error_wraps_security_errors() {
        let error = HttpClientError::from(SecurityError::BlockedLocalhost);

        assert!(matches!(
            error,
            HttpClientError::Security(SecurityError::BlockedLocalhost)
        ));
    }
}
