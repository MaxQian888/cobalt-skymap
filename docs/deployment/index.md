# 部署指南

本指南介绍如何构建和部署 Cobalt Skymap 应用程序。

## 部署选项

Cobalt Skymap 支持多种部署方式：

### 桌面应用部署

- **Windows**: MSI 安装包
- **macOS**: DMG 安装包
- **Linux**: AppImage、deb、rpm 包

### Web 应用部署

- **静态托管**: Vercel、Netlify
- **自托管**: Nginx、Apache

## 桌面应用部署

### 前置要求

- Rust 工具链（1.75+）
- Node.js（20+）
- pnpm（9+）
- 操作系统特定工具

### Windows

#### 构建环境

1. 安装 [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. 安装 Rust
3. 安装 Node.js 和 pnpm

#### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/ElementAstro/cobalt-skymap.git
cd cobalt-skymap

# 安装依赖
pnpm install

# 构建（默认）
pnpm tauri build

# 或使用预配置构建脚本
pnpm build:desktop

# Windows 专属构建
pnpm build:desktop:windows
```

#### 输出位置

- MSI 安装包: `src-tauri/target/release/bundle/msi/`
- 可执行文件: `src-tauri/target/release/`

### macOS

#### 构建环境

1. 安装 Xcode Command Line Tools
2. 安装 Rust
3. 安装 Node.js 和 pnpm

#### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/ElementAstro/cobalt-skymap.git
cd cobalt-skymap

# 安装依赖
pnpm install

# 构建
pnpm tauri build
```

#### 输出位置

- DMG 安装包: `src-tauri/target/release/bundle/dmg/`
- 应用程序: `src-tauri/target/release/bundle/macos/`

### Linux

#### 构建环境

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev

# Fedora
sudo dnf install webkit2gtk3-devel \
    openssl-devel \
    curl \
    wget \
    file \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

#### 构建步骤

```bash
# 克隆仓库
git clone https://github.com/ElementAstro/cobalt-skymap.git
cd cobalt-skymap

# 安装依赖
pnpm install

# 构建
pnpm tauri build
```

#### 输出位置

- AppImage: `src-tauri/target/release/bundle/appimage/`
- deb 包: `src-tauri/target/release/bundle/deb/`
- rpm 包: `src-tauri/target/release/bundle/rpm/`

## Web 应用部署

### 构建静态站点

```bash
# 构建 Next.js 应用
pnpm build

# 输出在 out/ 目录
```

### Vercel 部署（推荐）

1. 推送代码到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. Vercel 自动检测 Next.js 并配置
4. 点击部署

### Netlify 部署

1. 推送代码到 GitHub
2. 在 [Netlify](https://netlify.com) 导入项目
3. 配置构建设置：
   - 构建命令: `pnpm build`
   - 发布目录: `out`
4. 点击部署

### 静态托管部署

#### Nginx 配置

```nginx
server {
    listen 80;
    server_name skymap.example.com;
    root /var/www/cobalt-skymap/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Apache 配置

```apache
<VirtualHost *:80>
    ServerName skymap.example.com
    DocumentRoot /var/www/cobalt-skymap/out

    <Directory /var/www/cobalt-skymap/out>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

## 代码签名

### Windows 代码签名

使用 [SignTool](https://docs.microsoft.com/en-us/windows/win32/seccrypto/signtool) 对应用进行签名：

```bash
signtool sign /f certificate.pfx /p password /t timestamp_url cobalt-skymap.msi
```

### macOS 代码签名

```bash
# 安装证书
# 导入开发者证书到钥匙串

# 签名应用
codesign --sign "Developer ID Application: Your Name" \
    --force --deep \
    src-tauri/target/release/bundle/macos/Cobalt Skymap.app

# 公证应用（需要 Apple Developer 账号）
xcrun notarytool submit Cobalt Skymap.dmg \
    --apple-id "your@email.com" \
    --password "app-specific-password" \
    --team-id "team-id" \
    --wait
```

## 分发策略

### 版本管理

使用语义化版本：

- **MAJOR.MINOR.PATCH**
- 例如: 0.1.0, 0.2.0, 0.2.1

### 发布流程

1. 更新版本号
2. 更新 CHANGELOG
3. 创建 Git 标签
4. 构建所有平台的安装包
5. 上传到 GitHub Releases
6. 发布公告

### 自动化构建

使用 GitHub Actions 自动构建：

```yaml
name: Build Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [windows-latest, macos-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: pnpm tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.os }}-bundle
          path: |
            src-tauri/target/release/bundle/
```

## 性能优化

### 减小安装包大小

1. 启用压缩
2. 移除不必要的依赖
3. 使用 LTO（Link Time Optimization）
4. 精简资源文件

### 启动优化

1. 延迟加载非关键模块
2. 优化初始化顺序
3. 预加载常用数据

## 更新机制

### 内置更新

Cobalt Skymap 桌面端内置自动更新机制：

- 自动检查更新
- 下载更新包
- 自动安装

### GitHub Releases 自动更新

桌面端自动更新使用 GitHub Releases 作为唯一发布源，并依赖以下文件：

- `latest.json`
- 平台对应的 updater 归档
- 与归档匹配的 `.sig` 签名文件

当前 updater endpoint：

```text
https://github.com/ElementAstro/cobalt-skymap/releases/latest/download/latest.json
```

发布时，GitHub Actions 会为 tag 构建动态注入一份临时 Tauri 配置，包含：

- `bundle.createUpdaterArtifacts: true`
- `plugins.updater.pubkey`
- `plugins.updater.endpoints`

要使自动更新生效，还需要：

1. 在 GitHub Secrets 中设置 `TAURI_UPDATER_PUBLIC_KEY`
2. 在 GitHub Secrets 中设置 `TAURI_SIGNING_PRIVATE_KEY`
3. 在 GitHub Secrets 中设置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
4. 在发布前维护 `CHANGELOG.md` 中对应版本的条目
5. 将生成的 draft release 人工检查后再 publish

## 故障排除

### 常见构建问题

#### Rust 编译失败

```bash
# 清理缓存
cd src-tauri
cargo clean

# 更新 Rust
rustup update
```

#### 前端构建失败

```bash
# 清理 Next.js 缓存
rm -rf .next out

# 重新安装依赖
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Tauri CLI 错误

```bash
# 重新安装 Tauri CLI
pnpm remove -D @tauri-apps/cli
pnpm add -D @tauri-apps/cli
```

## 相关文档

- [构建指南](desktop/building.md)
- [开发环境](../developer-guide/development-environment/setup.md)
- [项目结构](../developer-guide/project-structure/index.md)
