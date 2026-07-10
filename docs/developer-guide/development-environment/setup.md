# 开发环境搭建

本文档详细介绍如何搭建 Cobalt Skymap 的开发环境。

## 前置要求

### 必需软件

#### 1. Node.js 和包管理器

- **Node.js**: 20.x 或更高
- **pnpm**: 8.x 或更高（推荐）或 npm

**安装 Node.js**:

```bash
# Windows: 下载安装包
# https://nodejs.org/

# macOS (使用 Homebrew)
brew install node

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应该显示 v20.x.x
npm --version   # 应该显示 10.x.x
```

**安装 pnpm**:

```bash
npm install -g pnpm

# 验证安装
pnpm --version
```

#### 2. Rust 工具链

- **Rust**: 1.70 或更高
- **Cargo**: Rust 包管理器

**安装 Rust**:

```bash
# Windows, macOS, Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 配置环境
source $HOME/.cargo/env

# 验证安装
rustc --version  # 应该显示 1.70 或更高
cargo --version
```

#### 3. Git

```bash
# Windows: 下载 Git for Windows
# https://git-scm.com/

# macOS
brew install git

# Linux
sudo apt-get install git

# 验证安装
git --version
```

### 可选软件

#### Visual Studio Code

推荐的代码编辑器：

```bash
# 下载安装
# https://code.visualstudio.com/
```

**推荐扩展**:

- ESLint
- Prettier
- Rust Analyzer
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)

#### Postman 或 Insomnia

API 测试工具（可选）。

## 克隆项目

```bash
# 克隆仓库
git clone https://github.com/ElementAstro/cobalt-skymap.git
cd cobalt-skymap

# 或使用 SSH
git clone git@github.com:ElementAstro/cobalt-skymap.git
```

## 安装依赖

### 前端依赖

```bash
# 在项目根目录
pnpm install

# 或使用 npm
npm install
```

**依赖安装时间**: 约2-5分钟

### Rust 依赖

Rust 依赖会在首次构建时自动下载。

## 开发工具配置

### VS Code 配置

创建 `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  },
  "files.associations": {
    "*.tsx": "typescriptreact"
  }
}
```

### Git 配置

```bash
# 设置用户名
git config user.name "Your Name"

# 设置邮箱
git config user.email "your.email@example.com"

# 设置默认分支
git config init.defaultBranch main
```

## 环境变量

### 创建 .env.local

```bash
# 在项目根目录创建
cp .env.example .env.local
```

**示例 .env.local**:

```env
# 应用配置
NEXT_PUBLIC_APP_NAME=Cobalt Skymap
NEXT_PUBLIC_APP_VERSION=0.1.0

# API 配置（如果需要）
NEXT_PUBLIC_API_URL=http://localhost:1420

# 开发模式
NODE_ENV=development
```

## 开发模式启动

### Web 开发模式

```bash
# 启动 Next.js 开发服务器
pnpm dev

# 访问 http://localhost:1420
```

**特性**:
- 热重载
- 快速刷新
- Source maps
- 错误报告

### 桌面应用开发模式

```bash
# 启动 Tauri 开发模式
pnpm tauri dev

# 或使用 npm
npm run tauri dev
```

**特性**:
- 同时启动前端和后端
- 前端热重载
- Rust 代码热重载（有限）
- 开发工具

## IDE 配置

### WebStorm / IntelliJ IDEA

1. **打开项目**: File > Open > 选择项目目录
2. **配置 Node.js**: Settings > Languages & Frameworks > Node.js
3. **配置 TypeScript**: Settings > Languages & Frameworks > TypeScript
4. **启用 Prettier**: Settings > Languages & Frameworks > JavaScript > Prettier

### Rust Analyzer

**VS Code**:

```bash
# 安装 Rust Analyzer
code --install-extension rust-lang.rust-analyzer
```

**配置** (.vscode/settings.json):

```json
{
  "rust-analyzer.checkOnSave.command": "clippy",
  "rust-analyzer.cargo.features": "all",
  "rust-analyzer.cargo.loadOutDirsFromCheck": true
}
```

## 调试配置

### 前端调试

#### Chrome DevTools

1. 启动开发服务器
2. 打开浏览器
3. 按 F12 打开 DevTools
4. 使用 Sources 标签调试

#### VS Code 调试

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Next.js: debug server-side",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev"],
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    },
    {
      "type": "chrome",
      "request": "launch",
      "name": "Next.js: debug client-side",
      "url": "http://localhost:1420",
      "webRoot": "${workspaceFolder}"
    }
  ]
}
```

### 后端调试

#### VS Code 调试 Rust

添加到 `.vscode/launch.json`:

```json
{
  "type": "lldb",
  "request": "launch",
  "name": "Debug Tauri",
  "cargo": {
    "args": ["build", "--manifest-path=src-tauri/Cargo.toml"],
    "filter": {
      "name": "cobalt-skymap",
      "kind": "bin"
    }
  },
  "cwd": "${workspaceFolder}",
  "preLaunchTask": "tauri: dev"
}
```

#### println! 调试

```rust
// 简单调试
println!("Debug: value = {}", value);

// 格式化输出
println!("Debug: position = ({}, {})", x, y);

// 使用 debug
println!("{:?}", complex_struct);
```

## 测试环境

### 运行测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 生成覆盖率报告
pnpm test:coverage

# 运行特定测试
pnpm test -- DataManager
```

### Rust 测试

```bash
# 在 src-tauri 目录
cargo test

# 运行特定测试
cargo test test_name

# 显示输出
cargo test -- --nocapture
```

## 构建配置

### 开发构建

```bash
# 前端开发构建
pnpm build

# 桌面应用开发构建
pnpm tauri build --debug
```

### 生产构建

```bash
# 前端生产构建
pnpm build

# 桌面应用生产构建
pnpm tauri build
```

## 常见问题

### 问题 1: pnpm install 失败

**解决方案**:

```bash
# 清理缓存
pnpm store prune

# 删除 node_modules
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install
```

### 问题 2: Rust 编译错误

**解决方案**:

```bash
# 更新 Rust
rustup update

# 清理构建缓存
cd src-tauri
cargo clean

# 重新构建
cargo build
```

### 问题 3: 端口被占用

**解决方案**:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### 问题 4: Tauri CLI 找不到

**解决方案**:

```bash
# 重新安装
pnpm remove -D @tauri-apps/cli
pnpm add -D @tauri-apps/cli
```

### 问题 5: TypeScript 类型错误

**解决方案**:

```bash
# 重新构建类型
rm -rf .next
pnpm build
```

## 性能优化

### 加速安装

```bash
# 使用国内镜像（中国）
pnpm config set registry https://registry.npmmirror.com

# 使用淘宝镜像
npm config set registry https://registry.npm.taobao.org
```

### 加速 Rust 构建

在 `~/.cargo/config` 中添加：

```toml
[source.crates-io]
replace-with = 'ustc'

[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
```

## 开发工作流

### 典型开发流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装依赖（如果 package.json 变化）
pnpm install

# 3. 创建功能分支
git checkout -b feature/my-feature

# 4. 启动开发服务器
pnpm tauri dev

# 5. 修改代码
# ...编辑文件...

# 6. 运行测试
pnpm test

# 7. 构建测试
pnpm build

# 8. 提交代码
git add .
git commit -m "feat: add my feature"

# 9. 推送分支
git push origin feature/my-feature

# 10. 创建 Pull Request
# 在 GitHub 上操作
```

### 推荐的 VS Code 工作区布局

```json
// .vscode/settings.json
{
  "explorer.fileNesting.enabled": true,
  "explorer.fileNesting.patterns": {
    "*.tsx": "${capture}.test.tsx, ${capture}.stories.tsx",
    "*.ts": "${capture}.test.ts",
    "package.json": "pnpm-lock.yaml, package-lock.json, yarn.lock"
  }
}
```

## 环境验证

### 验证脚本

创建验证脚本 `scripts/verify-env.sh`:

```bash
#!/bin/bash

echo "验证开发环境..."

# Node.js
if command -v node &> /dev/null; then
    echo "✓ Node.js: $(node --version)"
else
    echo "✗ Node.js 未安装"
fi

# Rust
if command -v rustc &> /dev/null; then
    echo "✓ Rust: $(rustc --version)"
else
    echo "✗ Rust 未安装"
fi

# pnpm
if command -v pnpm &> /dev/null; then
    echo "✓ pnpm: $(pnpm --version)"
else
    echo "✗ pnpm 未安装"
fi

echo "验证完成"
```

## 下一步

环境配置完成后：

1. 阅读[架构设计](../architecture/index.md)
2. 了解[项目结构](../project-structure/index.md)
3. 学习[API 参考](../apis/index.md)
4. 开始[组件开发](../frontend-development/react-components.md)

## 需要帮助？

- 查看[故障排除](../../../reference/troubleshooting.md)
- 阅读[常见问题](../../../reference/faq.md)
- 提交 [GitHub Issue](https://github.com/ElementAstro/cobalt-skymap/issues)

---

返回：[开发环境](index.md)

