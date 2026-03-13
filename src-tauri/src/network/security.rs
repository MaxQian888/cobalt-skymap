//! Security utilities and validation functions
//!
//! This module provides security controls including:
//! - URL validation to prevent SSRF attacks
//! - Input size limits
//! - Rate limiting utilities

use std::net::IpAddr;
use std::str::FromStr;
use url::Url;

#[derive(Debug, thiserror::Error)]
pub enum SecurityError {
    #[error("Invalid URL format: {0}")]
    InvalidUrl(String),
    #[error("URL scheme not allowed: {0}")]
    InvalidScheme(String),
    #[error("Blocked private IP address: {0}")]
    BlockedPrivateIp(String),
    #[error("Blocked localhost address")]
    BlockedLocalhost,
    #[error("Input size exceeds maximum allowed: {max} bytes")]
    InputTooLarge { max: usize },
    #[error("URL not in allowlist: {0}")]
    UrlNotAllowlisted(String),
}

impl serde::Serialize for SecurityError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::ser::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

/// Maximum allowed sizes for various inputs (in bytes)
#[allow(dead_code)]
pub mod limits {
    pub const MAX_JSON_SIZE: usize = 10 * 1024 * 1024; // 10 MB
    pub const MAX_CSV_SIZE: usize = 50 * 1024 * 1024; // 50 MB
    pub const MAX_TILE_SIZE: usize = 5 * 1024 * 1024; // 5 MB
    pub const MAX_CSV_ROWS: usize = 100_000;
    pub const MAX_URL_LENGTH: usize = 2048;
    pub const MAX_CACHE_ENTRIES: usize = 10_000;
    pub const MAX_CACHE_TOTAL_SIZE: usize = 1024 * 1024 * 1024; // 1 GB
}

/// Validate a URL to prevent SSRF attacks
pub fn validate_url(
    url_str: &str,
    allow_http: bool,
    allowlist: Option<&[&str]>,
) -> Result<Url, SecurityError> {
    if url_str.len() > limits::MAX_URL_LENGTH {
        return Err(SecurityError::InvalidUrl(format!(
            "URL exceeds maximum length of {} bytes",
            limits::MAX_URL_LENGTH
        )));
    }

    let url = Url::parse(url_str)
        .map_err(|e| SecurityError::InvalidUrl(format!("{}: {}", url_str, e)))?;

    match url.scheme() {
        "https" => {}
        "http" if allow_http => {}
        scheme => {
            return Err(SecurityError::InvalidScheme(format!(
                "Scheme '{}' is not allowed (only HTTPS{} is permitted)",
                scheme,
                if allow_http { "/HTTP" } else { "" }
            )))
        }
    }

    if let Some(host) = url.host_str() {
        let host_lower = host.to_lowercase();
        if host_lower == "localhost"
            || host_lower == "127.0.0.1"
            || host_lower.starts_with("127.")
            || host_lower == "::1"
            || host_lower == "[::1]"
            || host_lower.ends_with(".localhost")
        {
            return Err(SecurityError::BlockedLocalhost);
        }

        if let Ok(ip_addr) = IpAddr::from_str(host) {
            if is_private_ip(&ip_addr) {
                return Err(SecurityError::BlockedPrivateIp(format!(
                    "IP address {} is in a private range",
                    host
                )));
            }
        }

        if let Some(allowed) = allowlist {
            if !allowed.iter().any(|&domain| {
                host_lower == domain || host_lower.ends_with(&format!(".{}", domain))
            }) {
                return Err(SecurityError::UrlNotAllowlisted(host.to_string()));
            }
        }
    }

    Ok(url)
}

fn is_private_ip(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(ipv4) => {
            let octets = ipv4.octets();
            octets[0] == 10
                || (octets[0] == 172 && octets[1] >= 16 && octets[1] <= 31)
                || (octets[0] == 192 && octets[1] == 168)
                || (octets[0] == 169 && octets[1] == 254)
        }
        IpAddr::V6(ipv6) => {
            let segments = ipv6.segments();
            (segments[0] & 0xfe00) == 0xfc00 || (segments[0] & 0xffc0) == 0xfe80
        }
    }
}

/// Validate input size against a maximum
pub fn validate_size<T: AsRef<[u8]>>(data: T, max_size: usize) -> Result<(), SecurityError> {
    let size = data.as_ref().len();
    if size > max_size {
        Err(SecurityError::InputTooLarge { max: max_size })
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_url_https_allowed() {
        assert!(validate_url("https://example.com", false, None).is_ok());
    }

    #[test]
    fn test_validate_url_http_allowed_when_enabled() {
        assert!(validate_url("http://example.com", true, None).is_ok());
    }

    #[test]
    fn test_validate_url_http_blocked_by_default() {
        assert!(validate_url("http://example.com", false, None).is_err());
    }

    #[test]
    fn test_validate_url_blocks_localhost() {
        assert!(validate_url("https://localhost:8080", false, None).is_err());
        assert!(validate_url("https://127.0.0.1", false, None).is_err());
    }

    #[test]
    fn test_validate_url_blocks_private_ips() {
        assert!(validate_url("https://192.168.1.1", false, None).is_err());
        assert!(validate_url("https://10.0.0.1", false, None).is_err());
    }

    #[test]
    fn test_validate_url_blocks_private_ipv6() {
        let error = validate_url("https://[fd00::1]", false, None).unwrap_err();
        assert!(matches!(
            error,
            SecurityError::BlockedPrivateIp(message) if message.contains("fd00::1")
        ));
    }

    #[test]
    fn test_validate_url_allows_allowlisted_subdomains() {
        let allowlist = ["example.com"];
        assert!(validate_url("https://api.example.com", false, Some(&allowlist)).is_ok());
    }

    #[test]
    fn test_validate_url_rejects_domains_outside_allowlist() {
        let allowlist = ["example.com"];
        let error = validate_url("https://evil.example.net", false, Some(&allowlist)).unwrap_err();
        assert!(matches!(
            error,
            SecurityError::UrlNotAllowlisted(domain) if domain == "evil.example.net"
        ));
    }

    #[test]
    fn test_validate_url_rejects_oversized_urls_before_parsing() {
        let oversized_url = format!("https://example.com/{}", "a".repeat(limits::MAX_URL_LENGTH));
        let error = validate_url(&oversized_url, false, None).unwrap_err();
        assert!(matches!(
            error,
            SecurityError::InvalidUrl(message) if message.contains("maximum length")
        ));
    }

    #[test]
    fn test_validate_size() {
        assert!(validate_size("hello", 10).is_ok());
        assert!(validate_size("hello world", 5).is_err());
    }
}
