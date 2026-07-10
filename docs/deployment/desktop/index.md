# 桌面应用部署

本章节介绍如何构建和部署 Cobalt Skymap 桌面应用。

## 概览

Cobalt Skymap 使用 Tauri 2.9 框架构建跨平台桌面应用，支持 Windows、macOS 和 Linux。

## 支持平台

| 平台 | 最低版本 | 架构 |
|-----|---------|------|
| Windows | Windows 10 1803+ | x64, arm64 |
| macOS | macOS 10.15+ | x64, arm64 (Apple Silicon) |
| Linux | 各主流发行版 | x64 |

## 构建输出

| 平台 | 安装包格式 |
|-----|-----------|
| Windows | `.msi`, `.exe` (NSIS) |
| macOS | `.app`, `.dmg` |
| Linux | `.deb`, `.AppImage`, `.rpm` |

## 章节内容

### [构建指南](building.md)

- 环境准备
- 开发构建
- 生产构建
- 构建配置
- CI/CD 集成

### [Windows 打包](windows.md)

- Windows 环境要求
- MSI 和 NSIS 安装包
- 代码签名
- 自动更新配置

### [macOS 打包](macos.md)

- macOS 环境要求
- 应用签名和公证
- 通用二进制 (Universal Binary)
- DMG 配置

## 快速开始

### 开发模式

```bash
pnpm tauri dev
```

### 生产构建

```bash
# 默认构建
pnpm tauri build

# 预配置桌面构建
pnpm build:desktop

# Windows 专属构建
pnpm build:desktop:windows
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 相关文档

- [部署概览](../index.md)
- [Web 部署](../web/index.md)
- [前置要求](../../developer-guide/development-environment/prerequisites.md)
