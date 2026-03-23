# 前置要求

本文档列出开发 SkyMap 所需的软件和工具。

## 必需软件

### Node.js

- **版本要求**：Node.js 20.x 或更高
- **下载地址**：https://nodejs.org/
- **验证安装**：
  ```bash
  node --version
  npm --version
  ```

### pnpm

推荐使用 pnpm 作为包管理器：

```bash
npm install -g pnpm
pnpm --version
```

### Rust

Tauri 后端需要 Rust 工具链：

- **版本要求**：Rust 1.70 或更高
- **安装方式**：
  ```bash
  # Windows (PowerShell)
  winget install Rustlang.Rustup
  
  # macOS / Linux
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **验证安装**：
  ```bash
  rustc --version
  cargo --version
  ```

## 平台特定要求

### Windows

- **Visual Studio Build Tools 2019+**
  - 包含 "C++ 桌面开发" 工作负载
  - 包含 Windows 10/11 SDK
- **WebView2 运行时**（Windows 10 1803+ 已内置）

### macOS

- **Xcode Command Line Tools**：
  ```bash
  xcode-select --install
  ```
- **最低版本**：macOS 10.15 (Catalina)

### Linux

根据发行版安装依赖：

**Ubuntu/Debian**：
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget \
  file libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

**Fedora**：
```bash
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget \
  file libappindicator-gtk3-devel librsvg2-devel
```

**Arch Linux**：
```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module librsvg
```

## 推荐工具

### IDE

- **VS Code** + 扩展：
  - Tauri
  - rust-analyzer
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense

### 浏览器

- Chrome 或 Edge（开发者工具调试）

### Git

- Git 2.x 或更高
- 推荐配置：
  ```bash
  git config --global core.autocrlf input
  git config --global init.defaultBranch main
  ```

## 验证环境

运行以下命令验证环境配置：

```bash
# 检查所有依赖
node --version      # >= 20.0.0
pnpm --version      # >= 8.0.0
rustc --version     # >= 1.70.0
cargo --version     # >= 1.70.0
```

## 常见问题

### Rust 编译错误

确保已安装正确的目标平台：
```bash
rustup target list --installed
```

### Node.js 版本过低

使用 nvm 管理多版本：
```bash
nvm install 20
nvm use 20
```

## 下一步

环境准备就绪后，请参阅 [环境搭建](setup.md) 完成项目配置。

