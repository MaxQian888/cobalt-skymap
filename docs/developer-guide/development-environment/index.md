# 开发环境概览

本文档介绍 SkyMap 的开发环境配置。

## 环境要求

### 基本要求

- **操作系统**: Windows 10+, macOS 10.15+, 或主流 Linux 发行版
- **内存**: 至少 8GB RAM（推荐 16GB）
- **磁盘空间**: 至少 2GB 可用空间
- **网络**: 稳定的互联网连接

### 必需软件

| 软件 | 版本 | 用途 |
|------|------|------|
| Node.js | 20.x+ | 前端运行时 |
| Rust | 1.75+ | 后端编译 |
| pnpm | 9.x+ | 包管理器 |
| Git | 最新 | 版本控制 |

### 可选软件

| 软件 | 用途 |
|------|------|
| VS Code | 代码编辑器 |
| Rust Analyzer | Rust 语言支持 |
| Prettier | 代码格式化 |
| ESLint | 代码检查 |

## 开发环境架构

```mermaid
graph LR
    A[代码编辑器] --> B[Node.js 环境]
    A --> C[Rust 环境]
    B --> D[Next.js 开发服务器]
    C --> E[Tauri 应用]
    D --> F[浏览器]
    E --> G[桌面窗口]
```

## 开发模式

### Web 开发模式

适合纯前端开发：

```bash
pnpm dev
```

**优势**:

- 快速热重载
- 无需编译 Rust
- 浏览器 DevTools

### 桌面开发模式

适合全栈开发：

```bash
pnpm tauri dev
```

**优势**:

- 完整功能测试
- Tauri API 可用
- 桌面集成测试
- 前后端热重载

## 工具链

### 前端工具链

```text
源代码 (TS/TSX)
    ↓
Next.js 编译
    ↓
React 组件
    ↓
浏览器渲染
```

### 后端工具链

```text
源代码 (Rust)
    ↓
Cargo 编译
    ↓
系统二进制
    ↓
桌面应用
```

## 配置文件

### 前端配置

- `package.json` - 依赖和脚本
- `tsconfig.json` - TypeScript 配置
- `next.config.ts` - Next.js 配置
- `tailwind.config.ts` - 样式配置
- `jest.config.ts` - 测试配置

### 后端配置

- `src-tauri/Cargo.toml` - Rust 依赖
- `src-tauri/tauri.conf.json` - Tauri 配置
- `src-tauri/build.rs` - 构建脚本

## 环境变量

### 开发环境变量

```bash
# .env.local
NEXT_PUBLIC_APP_NAME=SkyMap
NODE_ENV=development
```

### 生产环境变量

```bash
# .env.production
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=SkyMap
```

## IDE 集成

### VS Code 扩展

推荐扩展：

- **ESLint** - JavaScript/TypeScript 语法检查
- **Prettier** - 代码格式化
- **Rust Analyzer** - Rust 语言支持
- **Tailwind CSS IntelliSense** - CSS 类名提示
- **Error Lens** - 内联错误显示

### VS Code 设置

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## 调试工具

### 前端调试

- Chrome DevTools
- React DevTools
- Redux DevTools (Zustand)
- 使用 `createLogger('module-name')` 输出结构化日志

### 后端调试

- Rust Analyzer
- `println!` 或 `log::info!` 宏
- VS Code 调试器

## 版本管理

### Git 工作流

```bash
main - 稳定版本
  ↑
develop - 开发分支
  ↑
feature/* - 功能分支
```

### 分支命名

- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构

## 持续集成

### GitHub Actions

自动化流程：

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - run: pnpm test
      - run: cd src-tauri && cargo test security_tests
```

## 性能优化

### 开发性能

- 使用 `pnpm` 加速依赖安装
- 启用增量编译
- 使用 Source Maps

### 构建性能

- 启用 Rust 代码优化
- 使用 Next.js 静态导出
- 压缩资源文件

## 下一步

1. [环境搭建详细步骤](setup.md)
2. [项目结构](../project-structure/index.md)
3. [组件开发](../frontend-development/react-components.md)

## 相关文档

- [前置要求](prerequisites.md)
- [环境搭建](setup.md)
- [IDE 配置](ide-setup.md)
- [调试配置](debugging.md)

---

返回：[开发环境](index.md)
