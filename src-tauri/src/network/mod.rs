//! Network module
//! Provides HTTP client, security utilities, and rate limiting
//!
//! Submodules:
//! - `http_client`: Enhanced HTTP client with retries, progress, and cancellation
//! - `security`: URL validation and security utilities
//! - `rate_limiter`: Request rate limiting

pub mod http_client;
pub mod rate_limiter;
pub mod security;

// Re-export HTTP client types and commands
pub use http_client::{
    // Commands
    cancel_request,
    get_active_requests,
    get_http_config,
    http_batch_download,
    http_cancel_all_requests,
    http_cancel_request,
    http_check_url,
    http_download,
    http_get,
    http_head,
    http_post,
    http_request,
    set_http_config,
    // Types
    BatchDownloadResult,
    BatchItemResult,
    DownloadProgress,
    HttpClientConfig,
    HttpClientError,
    HttpResponse,
    RequestConfig,
};

// Re-export security types and functions
pub use security::{limits, validate_size, validate_url, SecurityError};

// Re-export rate limiter types
pub use rate_limiter::{
    get_command_rate_limit, GlobalRateLimiter, RateLimitConfig, RateLimitResult, RateLimitState,
    SlidingWindowLimiter,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_module_re_exports_core_types_and_helpers() {
        let request_config = RequestConfig::default();
        assert_eq!(request_config.method, "GET");

        let rate_limit = get_command_rate_limit("open_path");
        assert_eq!(rate_limit.max_requests, 10);

        assert_eq!(limits::MAX_URL_LENGTH, 2048);
    }
}
