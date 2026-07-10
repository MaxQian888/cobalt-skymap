# macOS 打包指南

本文档介绍如何为 macOS 平台构建和打包 Cobalt Skymap。

## 环境要求

### 系统要求

- **macOS 10.15 (Catalina)** 或更高版本
- **Xcode Command Line Tools**

### 安装开发工具

```bash
xcode-select --install
```

## 构建步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建应用

```bash
pnpm tauri build
```

### 3. 查看输出

构建产物位于：

```
src-tauri/target/release/bundle/
├── macos/
│   └── Cobalt Skymap.app
└── dmg/
    └── Cobalt Skymap_1.0.0_x64.dmg
```

## 应用签名

### 获取开发者证书

1. 加入 Apple Developer Program
2. 在 Xcode 中创建签名证书
3. 导出证书到钥匙串

### 配置签名

在 `tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
      "entitlements": "./entitlements.plist"
    }
  }
}
```

### 使用环境变量

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name"
pnpm tauri build
```

## 公证 (Notarization)

### 为什么需要公证

macOS 10.15+ 要求分发的应用必须经过 Apple 公证。

### 配置公证

1. 创建 App-Specific Password
2. 配置环境变量：

```bash
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAM_ID"
```

3. 构建时自动公证：

```bash
pnpm tauri build
```

## 通用二进制 (Universal Binary)

### 支持 Intel 和 Apple Silicon

构建通用二进制：

```bash
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
pnpm tauri build --target universal-apple-darwin
```

## DMG 配置

### 自定义 DMG 外观

在 `tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "macOS": {
      "dmg": {
        "appPositionX": 180,
        "appPositionY": 170,
        "applicationFolderPositionX": 480,
        "applicationFolderPositionY": 170,
        "windowWidth": 660,
        "windowHeight": 400
      }
    }
  }
}
```

## 权限配置

### entitlements.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <false/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

## 常见问题

### 应用无法打开

"无法打开，因为无法验证开发者"：

- 确保应用已签名和公证
- 或右键点击应用，选择"打开"

### 签名失败

检查证书是否有效：

```bash
security find-identity -v -p codesigning
```

### 公证失败

查看公证日志：

```bash
xcrun notarytool log <submission-id> --apple-id your@email.com
```

## Mac App Store

### 准备工作

1. 创建 App Store Connect 记录
2. 配置 Sandbox 权限
3. 准备应用截图和描述

### 构建 App Store 版本

```bash
pnpm tauri build --bundles app
```

## 分发渠道

### 直接下载

- 上传 DMG 到 GitHub Releases
- 提供 SHA256 校验和
- 提供安装说明

### Homebrew Cask

创建 Cask 公式提交到 Homebrew。

## 相关文档

- [构建指南](building.md)
- [Windows 打包](windows.md)
- [部署概览](../index.md)

