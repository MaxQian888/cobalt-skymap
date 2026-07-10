# 后端架构

本文档详细介绍 Cobalt Skymap 的 Tauri/Rust 后端架构设计。

## 技术栈

### 核心框架

- **Tauri 2.9**：桌面应用框架
- **Rust**：系统编程语言
- **Tokio**：异步运行时

### 数据存储

- **JSON 文件存储**：本地持久化存储
- **Serde**：序列化/反序列化 (JSON)

## 目录结构

```
src-tauri/
├── src/
│   ├── main.rs              # 主入口
│   ├── lib.rs               # 库入口，模块导出和命令注册
│   │
│   ├── astronomy/           # 天文计算模块
│   │   ├── mod.rs           # 模块导出
│   │   ├── calculations.rs  # 坐标转换、可见性计算
│   │   └── events.rs        # 天文事件（月相、流星雨）
│   │
│   ├── data/                # 数据持久化模块
│   │   ├── mod.rs           # 模块导出
│   │   ├── storage.rs       # 通用 JSON 存储系统
│   │   ├── equipment.rs     # 设备管理（望远镜、相机等）
│   │   ├── locations.rs     # 观测位置管理
│   │   ├── targets.rs       # 目标列表管理
│   │   ├── target_io.rs     # 目标导入/导出
│   │   ├── markers.rs       # 天空标记持久化
│   │   └── observation_log.rs # 观测日志
│   │
│   ├── cache/               # 缓存模块
│   │   ├── mod.rs           # 模块导出
│   │   ├── offline.rs       # 离线瓦片缓存
│   │   └── unified.rs       # 统一网络资源缓存
│   │
│   ├── network/             # 网络通信模块
│   │   ├── mod.rs           # 模块导出
│   │   ├── http_client.rs   # HTTP 客户端（重试、进度）
│   │   ├── security.rs      # URL 验证和 SSRF 防护
│   │   └── rate_limiter.rs  # 请求速率限制
│   │
│   ├── platform/            # 桌面特定功能（仅桌面）
│   │   ├── mod.rs           # 模块导出
│   │   ├── app_settings.rs  # 应用设置和窗口状态
│   │   ├── app_control.rs   # 应用生命周期控制
│   │   ├── updater.rs       # 自动更新
│   │   └── plate_solver.rs  # 天文定位解算
│   │
│   └── utils.rs             # 工具函数
│
├── Cargo.toml               # Rust 依赖
└── tauri.conf.json          # Tauri 配置
```

## 命令注册

### lib.rs 结构

```rust
// src-tauri/src/lib.rs
pub mod astronomy;  // 天文计算和事件
pub mod data;       // 数据持久化
pub mod cache;      // 缓存系统
pub mod network;    // HTTP 客户端、安全、速率限制
pub mod utils;      // 工具函数

#[cfg(desktop)]
pub mod platform;   // 桌面特定功能

// 重新导出以保持向后兼容
use data::{ /* ... */ };
use astronomy::{ /* ... */ };
// ...

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // 所有模块的命令在此注册
            save_store_data,
            load_equipment,
            equatorial_to_horizontal,
            // ...
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 核心模块

### 模块组织概览

后端按功能域组织为五个主要模块：

| 模块 | 职责 | 文件 |
|------|------|------|
| `astronomy/` | 天文计算和事件 | `calculations.rs`, `events.rs` |
| `data/` | 数据持久化 | `storage.rs`, `equipment.rs`, `locations.rs`, `targets.rs`, `markers.rs`, `observation_log.rs`, `target_io.rs` |
| `cache/` | 缓存系统 | `offline.rs`, `unified.rs` |
| `network/` | 网络通信和安全 | `http_client.rs`, `security.rs`, `rate_limiter.rs` |
| `platform/` | 桌面特定功能 | `app_settings.rs`, `app_control.rs`, `updater.rs`, `plate_solver.rs` |

### 数据模块 (data/)

所有数据以 JSON 格式存储在应用程序数据目录中：

```rust
// src-tauri/src/data/storage.rs
use std::fs;
use serde_json;
use crate::network::security;

#[tauri::command]
pub async fn save_store_data(
    app: AppHandle,
    store_name: String,
    data: String,
) -> Result<(), StorageError> {
    // 安全：验证数据大小
    security::validate_size(&data, security::limits::MAX_JSON_SIZE)?;

    let path = get_store_path(&app, &store_name)?;
    fs::write(&path, &data).map_err(|e| StorageError::Io(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub async fn load_store_data(
    app: AppHandle,
    store_name: String,
) -> Result<Option<String>, StorageError> {
    let path = get_store_path(&app, &store_name)?;
    if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| StorageError::Io(e.to_string()))?;
        Ok(Some(data))
    } else {
        Ok(None)
    }
}
```

### 网络模块 (network/)

#### 安全模块

```rust
// src-tauri/src/network/security.rs
pub mod limits {
    pub const MAX_JSON_SIZE: usize = 10 * 1024 * 1024;  // 10 MB
    pub const MAX_CSV_SIZE: usize = 50 * 1024 * 1024;   // 50 MB
    pub const MAX_TILE_SIZE: usize = 5 * 1024 * 1024;   // 5 MB
}

pub fn validate_size(data: &str, max_size: usize) -> Result<(), SecurityError> {
    if data.len() > max_size {
        Err(SecurityError::SizeExceeded(data.len(), max_size))
    } else {
        Ok(())
    }
}

pub fn validate_url(url: &str, allow_http: bool, allowlist: Option<&[&str]>)
    -> Result<url::Url, SecurityError> {
    // URL 验证逻辑：阻止私有 IP、localhost、危险协议
    // ...
}
```

#### 速率限制模块

```rust
// src-tauri/src/network/rate_limiter.rs
use std::collections::HashMap;
use std::sync::Mutex;

pub struct RateLimiter {
    requests: Mutex<HashMap<String, Vec<std::time::Instant>>>,
}

impl RateLimiter {
    pub fn check(&self, command: &str, config: RateLimitConfig) -> RateLimitResult {
        // 滑动窗口速率限制算法
        // ...
    }
}
```

### 天文计算模块 (astronomy/)

```rust
// src-tauri/src/astronomy/calculations.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct AltAz {
    pub alt: f64,
    pub az: f64,
}

#[tauri::command]
pub async fn equatorial_to_horizontal(
    ra: f64, dec: f64, lat: f64, lon: f64,
) -> Result<AltAz, String> {
    // 坐标转换计算
    let lst = calculate_lst(lon);
    let ha = lst - ra;

    let alt = (dec.sin() * lat.sin() + dec.cos() * lat.cos() * ha.cos()).asin();
    let az = (dec.sin() - alt.sin() * lat.sin()) / (alt.cos() * lat.cos());

    Ok(AltAz { alt: alt.to_degrees(), az: az.to_degrees() })
}
```

### 设备管理模块

```rust
// src-tauri/src/data/equipment.rs
#[derive(Serialize, Deserialize)]
pub struct Telescope {
    pub id: String,
    pub name: String,
    pub aperture: f64,
    pub focal_length: f64,
}

#[tauri::command]
pub async fn load_equipment(app: AppHandle) -> Result<Equipment, String> {
    let data = storage::load_store_data(app, "equipment".to_string()).await?;
    match data {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        None => Ok(Equipment::default()),
    }
}
```

## 错误处理

所有命令返回 `Result<T, String>`：

```rust
#[tauri::command]
pub async fn some_command() -> Result<Data, String> {
    let result = operation().map_err(|e| e.to_string())?;
    Ok(result)
}
```

## 安全考虑

Cobalt Skymap 后端实现了多层安全防护：

### 速率限制

- **滑动窗口算法**：防止 API 滥用
- **分级限制**：保守（10/分钟）、中等（100/分钟）、宽松（1000/分钟）、只读（10000/分钟）
- **自动封禁**：敏感操作超限后临时封禁

### 输入验证

- **大小限制**：JSON (10MB)、CSV (50MB)、瓦片 (5MB)
- **URL 验证**：阻止私有 IP、localhost、危险协议
- **路径安全**：防止路径遍历攻击

### 存储安全

- **路径沙箱**：仅允许访问应用数据目录
- **JSON 校验**：写入前验证数据格式

详细信息请参考[安全特性文档](../../security/security-features.md)。

## 相关文档

- [系统架构](overview.md)
- [前端架构](frontend-architecture.md)
- [Tauri Commands API](../apis/backend-apis/tauri-commands.md)

