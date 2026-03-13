//! ASCOM Alpaca REST API client for telescope mount control
//!
//! Implements the Alpaca Telescope interface:
//! <https://ascom-standards.org/api/>

use std::sync::atomic::{AtomicU32, Ordering};

use reqwest::Client;
use serde::Deserialize;

use crate::mount::types::*;

static TRANSACTION_ID: AtomicU32 = AtomicU32::new(1);
const CLIENT_ID: u32 = 42;

fn next_transaction_id() -> u32 {
    TRANSACTION_ID.fetch_add(1, Ordering::Relaxed)
}

/// Standard Alpaca JSON response wrapper
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct AlpacaResponse<T> {
    #[allow(dead_code)]
    client_transaction_id: Option<u32>,
    #[allow(dead_code)]
    server_transaction_id: Option<u32>,
    error_number: i32,
    error_message: String,
    value: Option<T>,
}

impl<T> AlpacaResponse<T> {
    fn into_result(self) -> Result<T, MountError> {
        if self.error_number != 0 {
            return Err(MountError::AlpacaError {
                code: self.error_number,
                message: self.error_message,
            });
        }
        self.value.ok_or_else(|| MountError::AlpacaError {
            code: -1,
            message: "Missing value in response".to_string(),
        })
    }
}

/// Alpaca response for void (PUT) commands — value may be absent
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct AlpacaVoidResponse {
    error_number: i32,
    error_message: String,
}

impl AlpacaVoidResponse {
    fn into_result(self) -> Result<(), MountError> {
        if self.error_number != 0 {
            return Err(MountError::AlpacaError {
                code: self.error_number,
                message: self.error_message,
            });
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct ConfiguredDevice {
    device_name: String,
    device_type: String,
    device_number: u32,
    #[serde(rename = "UniqueID")]
    unique_id: Option<String>,
}

fn build_discovered_device_id(
    host: &str,
    port: u16,
    device_id: u32,
    unique_id: Option<&str>,
) -> String {
    let base = format!("alpaca://{}:{}/telescope/{}", host, port, device_id);
    match unique_id {
        Some(unique_id) if !unique_id.trim().is_empty() => {
            format!("{}?uid={}", base, unique_id.trim())
        }
        _ => base,
    }
}

fn parse_configured_telescope_devices(
    host: &str,
    port: u16,
    body: &str,
) -> Result<Vec<DiscoveredDevice>, MountError> {
    let devices: Vec<ConfiguredDevice> = serde_json::from_str(body).map_err(|e| {
        MountError::Other(format!("Invalid Alpaca configureddevices response: {}", e))
    })?;

    Ok(devices
        .into_iter()
        .filter(|device| device.device_type.eq_ignore_ascii_case("telescope"))
        .map(|device| {
            let unique_id = device.unique_id.clone();
            let normalized_type = device.device_type.to_ascii_lowercase();
            DiscoveredDevice {
                id: build_discovered_device_id(
                    host,
                    port,
                    device.device_number,
                    unique_id.as_deref(),
                ),
                protocol: MountProtocol::Alpaca,
                host: host.to_string(),
                port,
                device_id: device.device_number,
                name: device.device_name,
                device_type: normalized_type,
                source: "alpaca-discovery".to_string(),
                unique_id,
                manufacturer: None,
                model: None,
                description: Some(format!("Alpaca telescope @ {}:{}", host, port)),
                driver_info: None,
                driver_version: None,
            }
        })
        .collect())
}

/// ASCOM Alpaca telescope client
pub struct AlpacaClient {
    client: Client,
    base_url: String,
    host: String,
    port: u16,
    device_id: u32,
}

impl AlpacaClient {
    pub fn new(host: &str, port: u16, device_id: u32) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            client,
            base_url: format!("http://{}:{}/api/v1/telescope/{}", host, port, device_id),
            host: host.to_string(),
            port,
            device_id,
        }
    }

    // ========================================================================
    // GET helpers
    // ========================================================================

    async fn get_bool(&self, property: &str) -> Result<bool, MountError> {
        let url = format!(
            "{}/{}?ClientID={}&ClientTransactionID={}",
            self.base_url,
            property,
            CLIENT_ID,
            next_transaction_id()
        );
        let resp: AlpacaResponse<bool> = self.client.get(&url).send().await?.json().await?;
        resp.into_result()
    }

    async fn get_f64(&self, property: &str) -> Result<f64, MountError> {
        let url = format!(
            "{}/{}?ClientID={}&ClientTransactionID={}",
            self.base_url,
            property,
            CLIENT_ID,
            next_transaction_id()
        );
        let resp: AlpacaResponse<f64> = self.client.get(&url).send().await?.json().await?;
        resp.into_result()
    }

    async fn get_i32(&self, property: &str) -> Result<i32, MountError> {
        let url = format!(
            "{}/{}?ClientID={}&ClientTransactionID={}",
            self.base_url,
            property,
            CLIENT_ID,
            next_transaction_id()
        );
        let resp: AlpacaResponse<i32> = self.client.get(&url).send().await?.json().await?;
        resp.into_result()
    }

    async fn get_f64_device(&self, device_type: &str, property: &str) -> Result<f64, MountError> {
        let url = format!(
            "http://{}:{}/api/v1/{}/{}/{}?ClientID={}&ClientTransactionID={}",
            self.host,
            self.port,
            device_type,
            self.device_id,
            property,
            CLIENT_ID,
            next_transaction_id()
        );
        let resp: AlpacaResponse<f64> = self.client.get(&url).send().await?.json().await?;
        resp.into_result()
    }

    async fn get_bool_device(&self, device_type: &str, property: &str) -> Result<bool, MountError> {
        let url = format!(
            "http://{}:{}/api/v1/{}/{}/{}?ClientID={}&ClientTransactionID={}",
            self.host,
            self.port,
            device_type,
            self.device_id,
            property,
            CLIENT_ID,
            next_transaction_id()
        );
        let resp: AlpacaResponse<bool> = self.client.get(&url).send().await?.json().await?;
        resp.into_result()
    }

    #[allow(dead_code)]
    async fn get_string(&self, property: &str) -> Result<String, MountError> {
        let url = format!(
            "{}/{}?ClientID={}&ClientTransactionID={}",
            self.base_url,
            property,
            CLIENT_ID,
            next_transaction_id()
        );
        let resp: AlpacaResponse<String> = self.client.get(&url).send().await?.json().await?;
        resp.into_result()
    }

    // ========================================================================
    // PUT helpers
    // ========================================================================

    async fn put_void(&self, method: &str, params: &[(&str, String)]) -> Result<(), MountError> {
        let url = format!("{}/{}", self.base_url, method);
        let mut form: Vec<(&str, String)> = vec![
            ("ClientID", CLIENT_ID.to_string()),
            ("ClientTransactionID", next_transaction_id().to_string()),
        ];
        form.extend(params.iter().map(|(k, v)| (*k, v.clone())));
        let resp: AlpacaVoidResponse = self
            .client
            .put(&url)
            .form(&form)
            .send()
            .await?
            .json()
            .await?;
        resp.into_result()
    }

    // ========================================================================
    // Connection
    // ========================================================================

    pub async fn connect(&self) -> Result<(), MountError> {
        self.put_void("connected", &[("Connected", "true".to_string())])
            .await?;
        log::info!("Alpaca mount connected (device {})", self.device_id);
        Ok(())
    }

    pub async fn disconnect(&self) -> Result<(), MountError> {
        self.put_void("connected", &[("Connected", "false".to_string())])
            .await?;
        log::info!("Alpaca mount disconnected");
        Ok(())
    }

    pub async fn is_connected(&self) -> Result<bool, MountError> {
        self.get_bool("connected").await
    }

    // ========================================================================
    // Position
    // ========================================================================

    /// Right Ascension in hours (0..24)
    pub async fn get_ra_hours(&self) -> Result<f64, MountError> {
        self.get_f64("rightascension").await
    }

    /// Declination in degrees (-90..90)
    pub async fn get_dec(&self) -> Result<f64, MountError> {
        self.get_f64("declination").await
    }

    // ========================================================================
    // Status
    // ========================================================================

    pub async fn is_tracking(&self) -> Result<bool, MountError> {
        self.get_bool("tracking").await
    }

    pub async fn is_slewing(&self) -> Result<bool, MountError> {
        self.get_bool("slewing").await
    }

    pub async fn is_at_park(&self) -> Result<bool, MountError> {
        self.get_bool("atpark").await
    }

    pub async fn is_at_home(&self) -> Result<bool, MountError> {
        self.get_bool("athome").await
    }

    pub async fn get_side_of_pier(&self) -> Result<PierSide, MountError> {
        let val = self.get_i32("sideofpier").await?;
        Ok(match val {
            0 => PierSide::East,
            1 => PierSide::West,
            _ => PierSide::Unknown,
        })
    }

    pub async fn get_tracking_rate(&self) -> Result<TrackingRate, MountError> {
        let val = self.get_i32("trackingrate").await?;
        Ok(match val {
            0 => TrackingRate::Sidereal,
            1 => TrackingRate::Lunar,
            2 => TrackingRate::Solar,
            _ => TrackingRate::Sidereal,
        })
    }

    // ========================================================================
    // Capabilities
    // ========================================================================

    pub async fn get_capabilities(&self) -> Result<MountCapabilities, MountError> {
        let can_slew = self.get_bool("canslewasync").await.unwrap_or(false);
        let can_sync = self.get_bool("cansync").await.unwrap_or(false);
        let can_park = self.get_bool("canpark").await.unwrap_or(false);
        let can_unpark = self.get_bool("canunpark").await.unwrap_or(false);
        let can_set_tracking = self.get_bool("cansettracking").await.unwrap_or(false);
        let can_move_axis = self.get_bool("canmoveaxis").await.unwrap_or(false);
        let can_pulse_guide = self.get_bool("canpulseguide").await.unwrap_or(false);
        let alignment_mode = self.get_i32("alignmentmode").await.unwrap_or(1);
        let eq_system = self.get_i32("equatorialsystem").await.unwrap_or(1);

        Ok(MountCapabilities {
            can_slew,
            can_slew_async: can_slew,
            can_sync,
            can_park,
            can_unpark,
            can_set_tracking,
            can_move_axis,
            can_pulse_guide,
            alignment_mode: match alignment_mode {
                0 => "AltAz".to_string(),
                1 => "Polar".to_string(),
                2 => "GermanPolar".to_string(),
                _ => "Unknown".to_string(),
            },
            equatorial_system: match eq_system {
                0 => "Other".to_string(),
                1 => "Topocentric".to_string(),
                2 => "J2000".to_string(),
                3 => "J2050".to_string(),
                4 => "B1950".to_string(),
                _ => "Unknown".to_string(),
            },
        })
    }

    // ========================================================================
    // Commands
    // ========================================================================

    /// Async slew to RA (hours) and Dec (degrees)
    pub async fn slew_to_coordinates_async(
        &self,
        ra_hours: f64,
        dec: f64,
    ) -> Result<(), MountError> {
        self.put_void(
            "slewtocoordinatesasync",
            &[
                ("RightAscension", ra_hours.to_string()),
                ("Declination", dec.to_string()),
            ],
        )
        .await
    }

    /// Sync mount to RA (hours) and Dec (degrees)
    pub async fn sync_to_coordinates(&self, ra_hours: f64, dec: f64) -> Result<(), MountError> {
        self.put_void(
            "synctocoordinates",
            &[
                ("RightAscension", ra_hours.to_string()),
                ("Declination", dec.to_string()),
            ],
        )
        .await
    }

    pub async fn abort_slew(&self) -> Result<(), MountError> {
        self.put_void("abortslew", &[]).await
    }

    pub async fn park(&self) -> Result<(), MountError> {
        self.put_void("park", &[]).await
    }

    pub async fn unpark(&self) -> Result<(), MountError> {
        self.put_void("unpark", &[]).await
    }

    pub async fn set_tracking(&self, enabled: bool) -> Result<(), MountError> {
        self.put_void("tracking", &[("Tracking", enabled.to_string())])
            .await
    }

    pub async fn set_tracking_rate(&self, rate: TrackingRate) -> Result<(), MountError> {
        let val = match rate {
            TrackingRate::Sidereal => 0,
            TrackingRate::Lunar => 1,
            TrackingRate::Solar => 2,
            TrackingRate::Stopped => 0, // Stopped is handled via tracking=false
        };
        self.put_void("trackingrate", &[("TrackingRate", val.to_string())])
            .await
    }

    pub async fn get_observing_conditions(&self) -> Result<ObservingConditions, MountError> {
        let cloud_cover = self
            .get_f64_device("observingconditions", "cloudcover")
            .await
            .ok();
        let humidity = self
            .get_f64_device("observingconditions", "humidity")
            .await
            .ok();
        let wind_speed = self
            .get_f64_device("observingconditions", "windspeed")
            .await
            .ok();
        let dew_point = self
            .get_f64_device("observingconditions", "dewpoint")
            .await
            .ok();

        Ok(ObservingConditions {
            cloud_cover,
            humidity,
            wind_speed,
            dew_point,
        })
    }

    pub async fn get_safety_state(&self) -> Result<SafetyState, MountError> {
        let is_safe = self.get_bool_device("safetymonitor", "issafe").await?;
        Ok(SafetyState {
            is_safe,
            source: "alpaca".to_string(),
        })
    }

    /// Move axis at given rate (degrees/sec)
    pub async fn move_axis(&self, axis: MountAxis, rate: f64) -> Result<(), MountError> {
        let axis_num = match axis {
            MountAxis::Primary => 0,
            MountAxis::Secondary => 1,
        };
        self.put_void(
            "moveaxis",
            &[("Axis", axis_num.to_string()), ("Rate", rate.to_string())],
        )
        .await
    }

    /// Stop axis motion (move at rate 0)
    pub async fn stop_axis(&self, axis: MountAxis) -> Result<(), MountError> {
        self.move_axis(axis, 0.0).await
    }

    // ========================================================================
    // Aggregate state query
    // ========================================================================

    /// Fetch full mount state in one call (parallel HTTP requests via tokio::join!)
    pub async fn get_state(&self) -> Result<MountState, MountError> {
        let connected = self.is_connected().await.unwrap_or(false);
        if !connected {
            return Ok(MountState::default());
        }

        let (ra_hours, dec, tracking, tracking_rate, slewing, parked, at_home, pier_side) = tokio::join!(
            self.get_ra_hours(),
            self.get_dec(),
            self.is_tracking(),
            self.get_tracking_rate(),
            self.is_slewing(),
            self.is_at_park(),
            self.is_at_home(),
            self.get_side_of_pier(),
        );

        Ok(MountState {
            connected: true,
            ra: ra_hours.unwrap_or(0.0) * 15.0, // Convert hours to degrees
            dec: dec.unwrap_or(0.0),
            tracking: tracking.unwrap_or(false),
            tracking_rate: tracking_rate.unwrap_or(TrackingRate::Sidereal),
            slewing: slewing.unwrap_or(false),
            parked: parked.unwrap_or(false),
            at_home: at_home.unwrap_or(false),
            pier_side: pier_side.unwrap_or(PierSide::Unknown),
            slew_rate_index: 3,
        })
    }

    // ========================================================================
    // Discovery
    // ========================================================================

    /// Discover Alpaca devices on the network via UDP broadcast
    pub async fn discover(timeout_ms: u64) -> Result<Vec<DiscoveredDevice>, MountError> {
        use std::collections::HashSet;
        use tokio::net::UdpSocket;
        use tokio::time::{timeout, Duration};

        let socket = UdpSocket::bind("0.0.0.0:0")
            .await
            .map_err(|e| MountError::Other(format!("UDP bind failed: {}", e)))?;

        socket
            .set_broadcast(true)
            .map_err(|e| MountError::Other(format!("Set broadcast failed: {}", e)))?;

        // Alpaca discovery message
        let discovery_msg = b"alpacadiscovery1";
        socket
            .send_to(discovery_msg, "255.255.255.255:32227")
            .await
            .map_err(|e| MountError::Other(format!("UDP send failed: {}", e)))?;

        let client = Client::builder()
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|e| MountError::Other(format!("HTTP client init failed: {}", e)))?;

        let mut devices = Vec::new();
        let mut servers = HashSet::<(String, u16)>::new();
        let mut buf = [0u8; 1024];

        let deadline = Duration::from_millis(timeout_ms);
        loop {
            match timeout(deadline, socket.recv_from(&mut buf)).await {
                Ok(Ok((len, addr))) => {
                    if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                        // Parse Alpaca discovery response: {"AlpacaPort": 11111}
                        if let Ok(val) = serde_json::from_str::<serde_json::Value>(text) {
                            if let Some(port) = val.get("AlpacaPort").and_then(|v| v.as_u64()) {
                                servers.insert((addr.ip().to_string(), port as u16));
                            }
                        }
                    }
                }
                Ok(Err(_)) | Err(_) => break,
            }
        }

        for (host, port) in servers {
            let url = format!("http://{}:{}/management/v1/configureddevices", host, port);
            match client.get(&url).send().await {
                Ok(response) => match response.text().await {
                    Ok(body) => match parse_configured_telescope_devices(&host, port, &body) {
                        Ok(mut discovered) => devices.append(&mut discovered),
                        Err(error) => log::warn!(
                            "Failed to parse Alpaca configureddevices for {}:{}: {}",
                            host,
                            port,
                            error
                        ),
                    },
                    Err(error) => log::warn!(
                        "Failed to read Alpaca configureddevices response for {}:{}: {}",
                        host,
                        port,
                        error
                    ),
                },
                Err(error) => log::warn!(
                    "Failed to query Alpaca configureddevices for {}:{}: {}",
                    host,
                    port,
                    error
                ),
            }
        }

        log::info!("Alpaca discovery found {} devices", devices.len());
        Ok(devices)
    }
}

#[cfg(test)]
mod tests {
    use super::{build_discovered_device_id, parse_configured_telescope_devices};

    #[test]
    fn discovered_device_id_uses_unique_id_only_when_present() {
        let with_uid = build_discovered_device_id("10.0.0.5", 11111, 2, Some(" mount-uid-2 "));
        let without_uid = build_discovered_device_id("10.0.0.5", 11111, 2, Some("   "));

        assert_eq!(
            with_uid,
            "alpaca://10.0.0.5:11111/telescope/2?uid=mount-uid-2"
        );
        assert_eq!(without_uid, "alpaca://10.0.0.5:11111/telescope/2");
    }

    #[test]
    fn parses_management_configured_devices_into_telescope_entries() {
        let body = r#"[
            {
                "DeviceName": "EQ6-R Pro",
                "DeviceType": "Telescope",
                "DeviceNumber": 2,
                "UniqueID": "mount-uid-2"
            },
            {
                "DeviceName": "Main Camera",
                "DeviceType": "Camera",
                "DeviceNumber": 1,
                "UniqueID": "camera-uid-1"
            }
        ]"#;

        let devices = parse_configured_telescope_devices("10.0.0.5", 11111, body)
            .expect("configureddevices response should parse");

        assert_eq!(devices.len(), 1);
        assert_eq!(
            devices[0].id,
            "alpaca://10.0.0.5:11111/telescope/2?uid=mount-uid-2"
        );
        assert_eq!(devices[0].host, "10.0.0.5");
        assert_eq!(devices[0].port, 11111);
        assert_eq!(devices[0].device_id, 2);
        assert_eq!(devices[0].name, "EQ6-R Pro");
        assert_eq!(devices[0].device_type, "telescope");
        assert_eq!(devices[0].source, "alpaca-discovery");
        assert_eq!(devices[0].unique_id.as_deref(), Some("mount-uid-2"));
    }

    #[test]
    fn invalid_configured_devices_payload_returns_descriptive_error() {
        let error = parse_configured_telescope_devices("10.0.0.5", 11111, "{not-json")
            .expect_err("invalid payload should fail to parse");

        assert!(matches!(error, crate::mount::types::MountError::Other(_)));
        assert!(
            error
                .to_string()
                .contains("Invalid Alpaca configureddevices response"),
            "error should mention configureddevices parsing failure"
        );
    }
}
