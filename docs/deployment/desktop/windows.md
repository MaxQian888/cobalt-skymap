# Windows 打包指南

本文档介绍如何为 Windows 平台构建和打包 Cobalt Skymap。

## 环境要求

### 必需组件

- **Windows 10/11**
- **Visual Studio Build Tools 2019+**
  - C++ 桌面开发工作负载
  - Windows 10/11 SDK
- **WebView2 运行时**

### 安装 Build Tools

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

或从 [Visual Studio 下载页面](https://visualstudio.microsoft.com/downloads/) 下载。

## 构建步骤

### 1. 安装依赖

```powershell
pnpm install
```

### 2. 构建应用

```powershell
pnpm tauri build
```

### 3. 查看输出

构建产物位于：
```
src-tauri/target/release/bundle/
├── msi/
│   └── Cobalt Skymap_1.0.0_x64_en-US.msi
└── nsis/
    └── Cobalt Skymap_1.0.0_x64-setup.exe
```

## 安装包类型

### MSI 安装包

- 适合企业部署
- 支持静默安装
- 支持组策略管理

```powershell
# 静默安装
msiexec /i "Cobalt Skymap_1.0.0_x64_en-US.msi" /quiet
```

### NSIS 安装包

- 更小的文件体积
- 更灵活的安装选项
- 用户友好的安装向导

## 代码签名

### 获取证书

1. 从受信任的 CA 购买代码签名证书
2. 或使用自签名证书（仅用于测试）

### 配置签名

在 `tauri.conf.json` 中配置：

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

### 使用环境变量

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = "your-private-key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password"
pnpm tauri build
```

## 自动更新

### GitHub Releases 更新源

Windows 自动更新依赖 GitHub Releases 中的以下文件：

- `latest.json`
- `Cobalt Skymap_*.zip`
- `Cobalt Skymap_*.zip.sig`

当前 updater endpoint：

```text
https://github.com/ElementAstro/cobalt-skymap/releases/latest/download/latest.json
```

发布时由 GitHub Actions 动态注入临时 Tauri 配置，而不是直接把公钥硬编码到仓库默认配置中。该临时配置会启用：

- `plugins.updater.pubkey`
- `plugins.updater.endpoints`
- `bundle.createUpdaterArtifacts`

### 生成更新签名

```powershell
pnpm tauri signer generate -w
```

将生成的密钥配置到 GitHub Secrets：

- `TAURI_UPDATER_PUBLIC_KEY`
- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

### 发布要求

1. 在 `CHANGELOG.md` 中添加目标版本条目
2. 确保版本号与 Git tag 一致
3. 推送 `vX.Y.Z` tag
4. 检查 draft release 中是否包含安装包、`.zip`、`.sig` 和 `latest.json`
5. 手动发布 draft release

只有正式发布后的 release 才会被应用内自动更新检测到。

## 便携版

创建无需安装的便携版：

1. 构建应用
2. 复制 `src-tauri/target/release/Cobalt Skymap.exe`
3. 创建 `portable` 标记文件
4. 打包为 ZIP

## 常见问题

### WebView2 未安装

将 WebView2 引导程序嵌入安装包：

```json
{
  "bundle": {
    "windows": {
      "webviewInstallMode": {
        "type": "embedBootstrapper"
      }
    }
  }
}
```

### 防病毒软件误报

- 使用有效的代码签名证书
- 提交到防病毒厂商白名单
- 使用 VirusTotal 检查

### 权限问题

如需管理员权限：

```json
{
  "bundle": {
    "windows": {
      "allowDowngrades": true
    }
  }
}
```

## 分发渠道

### Microsoft Store

1. 创建 MSIX 包
2. 注册开发者账户
3. 提交应用审核

### 直接下载

1. 上传到 GitHub Releases
2. 提供 MSI 和 EXE 两种格式
3. 同时提供 updater `.zip`、`.sig` 和 `latest.json`

## 相关文档

- [构建指南](building.md)
- [macOS 打包](macos.md)
- [部署概览](../index.md)

