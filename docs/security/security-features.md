# 安全特性

Cobalt Skymap 采用纵深防御策略，包含多层安全防护机制，旨在保护用户数据并防止恶意滥用。

## 1. 速率限制

后端实现了一个基于滑动窗口算法的速率限制器，防止命令滥用和拒绝服务（DoS）攻击。

### 限制级别

根据命令的敏感程度和预期使用频率，分为四个限制级别：

| 级别 | 请求/分钟 | 适用场景 | 超限封禁 |
|------|-----------|----------|----------|
| **保守级别** | 10 | 敏感操作（文件访问、数据导入导出） | 是（5 分钟） |
| **中等级别** | 100 | 常规操作（CRUD、缓存操作） | 否 |
| **宽松级别** | 1000 | 缓存预取、瓦片加载 | 否 |
| **只读级别** | 10000 | 读取查询（获取、列表、统计） | 否 |

### 受限命令列表

- **保守级别**: `open_path`, `reveal_in_file_manager`, `import_all_data`, `export_all_data`
- **中等级别**: `save_store_data`, `load_store_data`, `save_cached_tile`, `import_targets`
- **宽松级别**: `prefetch_url`, `load_cached_tile`
- **只读级别**: `list_stores`, `get_storage_stats`

### 自动惩罚机制

对于「保守级别」的命令，如果用户持续触发限制，系统会自动实施临时封禁（5 分钟）。

---

## 2. 输入验证

后端在处理数据前会执行严格的验证，防止各类攻击。

### 大小验证

防止内存和磁盘耗尽攻击：

| 输入类型 | 最大大小 | 验证位置 |
|----------|----------|----------|
| JSON 存储 | 10 MB | `data/storage.rs` |
| 星图瓦片 | 5 MB | `cache/offline.rs` |
| CSV 导入 | 50 MB + 100,000 行 | `data/target_io.rs` |
| URL 长度 | 2048 字符 | `network/security.rs` |

### URL 验证（SSRF 防护）

防止服务端请求伪造（SSRF）攻击：

| 规则 | 说明 |
|------|------|
| **禁止私有 IP** | 阻止 192.168.x.x, 10.x.x.x, 172.16-31.x.x, 169.254.x.x |
| **禁止本地回环** | 阻止 localhost, 127.x.x.x, ::1 |
| **HTTPS 强制** | 默认仅允许 HTTPS 协议 |
| **危险协议拦截** | 阻止 file://, data://, javascript://, ftp:// |
| **域名白名单** | 可选的域名白名单支持 |

---

## 3. 存储安全

### 路径沙箱

存储模块仅允许访问应用程序专用的数据目录，防止路径穿越攻击：
- 所有文件操作限制在应用数据目录内
- 路径验证阻止 `../` 等遍历尝试

### JSON 格式校验

所有写入的数据在保存前都会进行反序列化校验，确保数据完整性。

---

## 4. 密钥保险箱（Secret Vault）

Cobalt Skymap 提供通过系统钥匙串安全存储敏感凭证的能力，防止 API 密钥等敏感信息以明文形式保存在配置文件或本地存储中。

### 功能

- **安全存储** — API 密钥、地图服务 token、私有服务凭证等通过 OS 钥匙串加密保存
- **前端隔离** — 前端仅通过 Tauri IPC 调用 vault 接口，无法直接访问密钥明文
- **按服务隔离** — 不同服务的凭证独立存储，降低单点泄露风险

### 使用方式

```rust
// Rust 后端（src-tauri/src/platform/secret_vault.rs）
use tauri_plugin_keyring::Keyring;

// 存储密钥
keyring.set_password("service_name", "account_name", "secret_value")?;

// 读取密钥
let secret = keyring.get_password("service_name", "account_name")?;

// 删除密钥
keyring.delete_password("service_name", "account_name")?;
```

```typescript
// 前端封装（lib/tauri/secret-vault-api.ts）
import { invoke } from '@tauri-apps/api/core';

export async function setSecret(service: string, account: string, secret: string) {
  await invoke('set_secret', { service, account, secret });
}

export async function getSecret(service: string, account: string) {
  return await invoke<string | null>('get_secret', { service, account });
}

export async function deleteSecret(service: string, account: string) {
  await invoke('delete_secret', { service, account });
}
```

### 适用场景

- 地图瓦片服务 API key
- 天文数据服务 token
- 私有星表访问凭证
- 云同步服务密钥

---

## 5. 安全模块架构

### 后端安全模块

```
src-tauri/src/network/
├── security.rs         # 核心安全工具（URL 验证、大小验证）
└── rate_limiter.rs     # 速率限制器实现（含测试套件）

src-tauri/src/platform/
└── secret_vault.rs     # 密钥保险箱（系统钥匙串封装）
```

### 前端安全模块

```
lib/security/
└── url-validator.ts    # TypeScript URL 验证工具
```

---

## 6. 安全防护效果

### 已缓解的攻击场景

| 攻击场景 | 防护状态 | 残余风险 |
|----------|----------|----------|
| **SSRF 攻击** | 已阻止 | 无 |
| **资源耗尽（DoS）** | 已缓解 | 低 |
| **API 滥用** | 已缓解 | 中 |
| **大型文件攻击** | 已阻止 | 无 |
| **密钥泄露** | 已缓解 | 低（依赖 OS 钥匙串安全） |

### 攻击难度变化

| 攻击类型 | 修复前 | 修复后 |
|----------|--------|--------|
| SSRF via URL 注入 | 简单 | 不可能 |
| 超大 JSON 反序列化 | 简单 | 已阻止 |
| 缓存泛洪 | 简单 | 中等 |
| 大量 CSV 导入 | 简单 | 已阻止 |
| API 滥用 | 简单 | 中等 |
| 本地密钥窃取 | 简单 | 困难（需攻破 OS 钥匙串） |

---

## 7. 运行安全测试

项目配置了完整的安全测试套件，验证各安全机制的正确性：

```bash
# 运行所有安全测试
cd src-tauri
cargo test network::security::tests
cargo test network::rate_limiter::tests
cargo test platform::secret_vault::tests

# 运行特定测试
cargo test test_validate_url_blocks_localhost
cargo test test_validate_size
cargo test test_rate_limit_within_window
cargo test test_secret_vault_roundtrip

# 查看测试输出
cargo test network:: -- --nocapture
```

### 测试覆盖范围

- URL 验证（localhost、私有 IP、危险协议、白名单）
- 大小限制（JSON、CSV、瓦片）
- 速率限制（窗口过期、封禁行为、命令级限制）
- 密钥保险箱（存储、读取、删除、隔离）
- 集成测试（纵深防御）

---

## 8. 安全配置指南

### 调整大小限制

编辑 `src-tauri/src/network/security.rs`：

```rust
pub mod limits {
    pub const MAX_JSON_SIZE: usize = 10 * 1024 * 1024; // 10 MB
    pub const MAX_CSV_SIZE: usize = 50 * 1024 * 1024;  // 50 MB
    pub const MAX_TILE_SIZE: usize = 5 * 1024 * 1024;  // 5 MB
    pub const MAX_CSV_ROWS: usize = 100_000;           // 10 万行
}
```

### 配置速率限制

编辑 `src-tauri/src/network/rate_limiter.rs` 中的 `get_command_rate_limit()` 函数。

### 配置 URL 白名单

```rust
// 后端
let allowlist = vec!["api.trusted.com", "cdn.trusted.com"];
let validated_url = validate_url(&url, false, Some(&allowlist))?;

// 前端
validateUrl(url, {
    allowHttp: false,
    allowlist: ['api.trusted.com', 'cdn.trusted.com']
});
```

---

## 9. 性能影响

安全措施的性能开销极低：

| 检查类型 | 开销 | 影响评估 |
|----------|------|----------|
| URL 验证 | ~0.1 ms | 可忽略（相比网络延迟） |
| 大小验证 | ~0.001 ms | O(1) 操作 |
| 速率限制检查 | ~0.05 ms | 可忽略 |
| 密钥保险箱 | ~5-20 ms | 低频操作，可忽略 |

**总开销：** 每个受保护操作 < 1 ms（不含密钥保险箱）

---

## 10. 未来改进计划

### 计划中的安全增强

1. **认证与授权层**
   - 实现用户认证
   - 为所有 Tauri 命令添加权限检查
   - 基于角色的访问控制

2. **数据加密**
   - 加密静态敏感数据
   - 完善密钥管理

3. **审计日志**
   - 记录所有安全相关操作
   - 实现防篡改日志
   - 可疑活动告警

4. **CSP 实现**
   - 实现严格的内容安全策略
   - 添加 CSP 报告模式用于测试

---

## 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Tauri 安全指南](https://tauri.app/v1/guides/security/)
- [SSRF 预防速查表](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
