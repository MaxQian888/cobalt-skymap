# 安全开发指南

本文档为 SkyMap 开发者提供安全开发的最佳实践和指南。

## 安全架构概述

SkyMap 采用多层安全防护架构：

```
┌─────────────────────────────────────┐
│           前端 (TypeScript)          │
│    URL 验证 | 输入校验 | XSS 防护     │
├─────────────────────────────────────┤
│           Tauri IPC 层              │
│         命令权限 | 沙箱隔离           │
├─────────────────────────────────────┤
│           后端 (Rust)               │
│  速率限制 | 输入验证 | 路径安全       │
├─────────────────────────────────────┤
│           数据层                    │
│      JSON 存储 | 路径沙箱            │
├─────────────────────────────────────┤
│         密钥保险箱                   │
│      系统钥匙串 | OS Keyring         │
└─────────────────────────────────────┘
```

## 后端安全开发

### 1. 使用速率限制

所有频繁调用的命令都应该添加速率限制：

```rust
use crate::network::rate_limiter::{self, RateLimitConfig, RATE_LIMITER};

#[tauri::command]
pub async fn my_sensitive_command(params: MyParams) -> Result<MyResult, String> {
    // 检查速率限制
    let config = rate_limiter::get_command_rate_limit("my_sensitive_command");
    match RATE_LIMITER.check("my_sensitive_command", config) {
        rate_limiter::RateLimitResult::Allowed => {},
        rate_limiter::RateLimitResult::RateLimited { retry_after } => {
            return Err(format!("请求过于频繁，请 {} 秒后重试", retry_after));
        },
        rate_limiter::RateLimitResult::Banned { retry_after } => {
            return Err(format!("已被临时封禁，请 {} 秒后重试", retry_after));
        },
    }

    // 继续处理...
    Ok(result)
}
```

### 2. 验证输入大小

所有接受用户输入的命令都应验证大小：

```rust
use crate::network::security::{self, limits};

#[tauri::command]
pub async fn save_data(data: String) -> Result<(), String> {
    // 验证输入大小
    security::validate_size(&data, limits::MAX_JSON_SIZE)
        .map_err(|e| e.to_string())?;

    // 继续处理...
    Ok(())
}
```

### 3. 验证 URL

所有接受 URL 的命令都应验证 URL 安全性：

```rust
use crate::network::security;

#[tauri::command]
pub async fn fetch_resource(url: String) -> Result<Vec<u8>, String> {
    // 验证 URL
    let validated_url = security::validate_url(&url, false, None)
        .map_err(|e| e.to_string())?;

    // 使用验证后的 URL
    let response = reqwest::get(validated_url.as_str()).await
        .map_err(|e| e.to_string())?;

    Ok(response.bytes().await.map_err(|e| e.to_string())?.to_vec())
}
```

### 4. 路径安全

确保文件操作只在应用数据目录内进行：

```rust
use tauri::Manager;

fn get_safe_path(app: &AppHandle, filename: &str) -> Result<PathBuf, String> {
    // 获取应用数据目录
    let data_dir = app.path().app_data_dir()
        .map_err(|e| e.to_string())?;

    // 验证文件名不包含路径分隔符
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("无效的文件名".to_string());
    }

    Ok(data_dir.join(filename))
}
```

### 5. 密钥保险箱（Secret Vault）

对于 API 密钥等敏感凭证，使用系统钥匙串存储：

```rust
use crate::platform::secret_vault;

#[tauri::command]
pub async fn save_api_key(service: String, key: String) -> Result<(), String> {
    secret_vault::set_secret(&service, &key)
        .map_err(|e| format!("保存密钥失败: {}", e))
}

#[tauri::command]
pub async fn get_api_key(service: String) -> Result<Option<String>, String> {
    secret_vault::get_secret(&service)
        .map_err(|e| format!("读取密钥失败: {}", e))
}
```

前端调用：

```typescript
import { invoke } from '@tauri-apps/api/core';

// 保存 API 密钥
await invoke('save_api_key', { service: 'map-tile-provider', key: 'sk-xxx' });

// 读取 API 密钥
const key = await invoke<string>('get_api_key', { service: 'map-tile-provider' });
```

## 前端安全开发

### 1. URL 验证

在发送请求前验证 URL：

```typescript
import { validateUrl } from '@/lib/security/url-validator';

async function fetchData(url: string) {
  try {
    validateUrl(url, { allowHttp: false });
    // 继续请求...
  } catch (error) {
    console.error('URL 验证失败:', error);
    throw error;
  }
}
```

### 2. 避免 XSS

永远不要使用 `dangerouslySetInnerHTML` 或 `innerHTML`：

```typescript
// ❌ 危险
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ 安全
<div>{userInput}</div>
```

### 3. 输入验证

在提交数据前验证用户输入：

```typescript
function validateInput(input: string, maxLength: number): boolean {
  if (!input || input.length > maxLength) {
    return false;
  }
  return true;
}
```

## 安全配置

### 速率限制配置

编辑 `src-tauri/src/network/rate_limiter.rs`：

```rust
pub fn get_command_rate_limit(command: &str) -> RateLimitConfig {
    match command {
        // 保守级别：敏感操作
        "open_path" | "import_all_data" | "export_all_data" => RateLimitConfig {
            max_requests: 10,
            window_seconds: 60,
            ban_on_exceed: true,
            ban_duration_seconds: Some(300),
        },
        // 中等级别：常规操作
        "save_store_data" | "load_store_data" => RateLimitConfig {
            max_requests: 100,
            window_seconds: 60,
            ban_on_exceed: false,
            ban_duration_seconds: None,
        },
        // 宽松级别：高频操作
        "prefetch_url" | "load_cached_tile" => RateLimitConfig {
            max_requests: 1000,
            window_seconds: 60,
            ban_on_exceed: false,
            ban_duration_seconds: None,
        },
        // 默认
        _ => RateLimitConfig::default(),
    }
}
```

### 大小限制配置

编辑 `src-tauri/src/network/security.rs`：

```rust
pub mod limits {
    pub const MAX_JSON_SIZE: usize = 10 * 1024 * 1024;  // 10 MB
    pub const MAX_CSV_SIZE: usize = 50 * 1024 * 1024;   // 50 MB
    pub const MAX_TILE_SIZE: usize = 5 * 1024 * 1024;   // 5 MB
    pub const MAX_CSV_ROWS: usize = 100_000;            // 10万行
    pub const MAX_URL_LENGTH: usize = 2048;             // 2048 字符
}
```

## 安全测试

### 运行安全测试

```bash
cd src-tauri
cargo test security_tests
```

### 测试覆盖内容

- URL 验证测试
- 大小限制测试
- 速率限制测试
- 路径沙箱测试
- 密钥保险箱测试
- 集成测试

### 添加新的安全测试

在 `src-tauri/src/network/security.rs` 或 `src-tauri/src/network/rate_limiter.rs` 的 `#[cfg(test)]` 模块中添加测试：

```rust
#[test]
fn test_my_security_feature() {
    // 测试代码
}
```

## 安全检查清单

### 新命令检查清单

- [ ] 是否需要速率限制？
- [ ] 是否接受用户输入？需要大小验证吗？
- [ ] 是否接受 URL？需要 URL 验证吗？
- [ ] 是否操作文件？路径安全吗？
- [ ] 是否处理敏感凭证？需要使用 Secret Vault 吗？
- [ ] 是否添加了相应的测试？

### 代码审查检查清单

- [ ] 没有使用 `dangerouslySetInnerHTML`
- [ ] 没有使用 `innerHTML`
- [ ] 所有用户输入都经过验证
- [ ] 所有 URL 都经过验证
- [ ] 敏感操作有速率限制
- [ ] 文件操作在沙箱内
- [ ] API 密钥不硬编码，使用 Secret Vault

## 常见安全问题

### 1. SSRF（服务端请求伪造）

**问题**：攻击者可以让服务器请求内部资源。

**解决方案**：使用 URL 验证阻止私有 IP 和 localhost。

### 2. DoS（拒绝服务）

**问题**：攻击者可以通过大量请求或超大数据耗尽资源。

**解决方案**：使用速率限制和大小验证。

### 3. 路径遍历

**问题**：攻击者可以访问应用目录外的文件。

**解决方案**：验证文件名，使用路径沙箱。

### 4. 密钥泄露

**问题**：API 密钥硬编码在源码或存储在明文配置中。

**解决方案**：使用 `platform/secret_vault.rs` 将密钥存储在系统钥匙串中。

## 参考资源

- [安全特性文档](../../security/security-features.md)
- [后端架构](../architecture/backend-architecture.md)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Tauri 安全指南](https://tauri.app/v1/guides/security/)
