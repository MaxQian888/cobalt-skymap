# 桌面应用构建指南

本文档介绍如何构建 SkyMap 桌面应用。

## 构建前准备

### 环境要求

确保已安装：
- Node.js 20+
- pnpm
- Rust 工具链
- 平台特定依赖（见 [前置要求](../../developer-guide/development-environment/prerequisites.md)）

### 安装依赖

```bash
pnpm install
```

## 开发构建

### 启动开发服务器

```bash
pnpm tauri dev
```

这将：
1. 启动 Next.js 开发服务器
2. 编译 Rust 后端
3. 启动 Tauri 窗口

### 热重载

- **前端更改**：自动热重载
- **Rust 更改**：需要重新编译（约 10-30 秒）

## 生产构建

### 构建命令

```bash
pnpm tauri build
```

### 构建输出

构建产物位于 `src-tauri/target/release/bundle/`：

| 平台 | 输出格式 |
|-----|---------|
| Windows | `.msi`, `.exe` |
| macOS | `.app`, `.dmg` |
| Linux | `.deb`, `.AppImage` |

## 构建配置

### tauri.conf.json

主要配置项：

```json
{
  "build": {
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "frontendDist": "../out"
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "com.skymap.test",
    "icon": ["icons/icon.ico", "icons/icon.png"]
  }
}
```

### 应用信息

在 `tauri.conf.json` 中配置：

```json
{
  "productName": "SkyMap",
  "version": "1.0.0",
  "identifier": "com.skymap.test"
}
```

## 优化构建

### 减小包体积

1. **Release 模式优化**（Cargo.toml）：
   ```toml
   [profile.release]
   lto = true
   opt-level = "s"
   strip = true
   ```

2. **前端优化**：
   - 启用 Tree Shaking
   - 压缩静态资源
   - 移除未使用的依赖

### 加快构建速度

1. 使用增量编译
2. 配置 Rust 缓存
3. 并行构建前后端

## CI/CD 构建

### GitHub Actions 示例

```yaml
name: Build
on: [push, pull_request]

jobs:
  build:
    strategy:
      matrix:
        platform: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: pnpm tauri build
```

## 常见问题

### 构建失败：找不到 WebView2

Windows 上安装 WebView2 运行时或 SDK。

### 构建失败：Rust 编译错误

```bash
cargo clean
pnpm tauri build
```

### 包体积过大

检查并移除未使用的依赖，启用 LTO 优化。

## 平台特定指南

- [Windows 打包](windows.md)
- [macOS 打包](macos.md)

## 相关文档

- [部署概览](../index.md)
- [前置要求](../../developer-guide/development-environment/prerequisites.md)

