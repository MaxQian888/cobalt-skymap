# SkyMap

一个现代化的桌面星图和天文观测规划应用程序，基于 **Next.js 16**、**React 19** 和 **Tauri 2.9** 构建。它集成了 Stellarium Web 引擎，用于星空可视化、观测规划和天文计算。

[English Documentation](./README.md) | [更新日志](./CHANGELOG.md)

## 特性

- **星图可视化** - 集成 Stellarium Web 引擎，实现实时星空渲染
- **观测规划** - 用于规划天文观测和追踪目标的工具
- **设备管理** - 管理望远镜、相机和目镜，支持视野计算
- **天文计算** - 9 个计算器标签页（今夜可见、位置、升落、星历、年历、天象、坐标、时间、太阳系）
- **统一引擎** - `lib/astronomy/engine` 采用 Tauri 优先 + `astronomy-engine` 回退，保证 Web/桌面一致
- **坐标/时制契约** - 统一 ICRF/CIRS/OBSERVED 管线，并附带 UTC/UT1/TT 元数据
- **智能推荐模式** - 支持摄影/目视/混合三种目标评分模式与置信度
- **离线精度回退** - 内置 EOP 基线数据，联网时后台增量更新
- **原生桌面** - 基于 Tauri 2.9 构建，具有高性能和系统集成
- **现代 UI** - Tailwind CSS v4，配合 Geist 字体和暗色模式支持
- **shadcn/ui** - 基于 Radix UI 的高质量无障碍组件
- **Zustand** - 轻量且强大的状态管理
- **多语言支持** - 通过 next-intl 提供多语言支持（英文/中文）
- **安全防护** - 速率限制、输入验证、SSRF 防护

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16 (App Router), React 19, TypeScript |
| **样式** | Tailwind CSS v4, shadcn/ui |
| **状态管理** | Zustand |
| **桌面端** | Tauri 2.9 (Rust) |
| **天文学** | Stellarium Web Engine, 自定义天文计算库 |
| **国际化** | next-intl |
| **存储** | JSON 文件存储 |
| **安全** | 速率限制、URL 验证、大小限制 |

## 前置要求

在开始之前，请确保已安装以下内容：

### Web 开发

- **Node.js** 20.x 或更高版本
- **pnpm** 9.x 或更高版本（推荐）

### 桌面端开发

- **Rust** 1.75 或更高版本
- **系统依赖**:
  - **Windows**: WebView2, Visual Studio C++ Build Tools
  - **macOS**: Xcode 命令行工具
  - **Linux**: libwebkit2gtk-4.1, build-essential, curl, wget 等

## 安装

1. **克隆仓库**

   ```bash
   git clone https://github.com/ElementAstro/cobalt-skymap.git
   cd cobalt-skymap
   ```

2. **安装依赖**

   ```bash
   pnpm install
   ```

## 快速上手与运行

### 启动 Web 开发

```bash
pnpm dev
```

在 [http://localhost:1420](http://localhost:1420) 启动 Next.js 开发服务器。

### 启动 桌面端开发

```bash
pnpm tauri dev
```

启动 Tauri 桌面应用，支持前端和 Rust 代码的热重载。

## 生产构建

### 构建 Web 应用（静态导出）

```bash
pnpm build
```

输出到 `out/` 目录。

### 构建 桌面应用

```bash
pnpm tauri build
```

在 `src-tauri/target/release/bundle/` 中生成安装程序。

## 项目结构

```
skymap/
├── app/                    # Next.js App Router（页面和布局）
├── components/             # React 组件
│   ├── starmap/           # 星图 UI 组件
│   │   ├── canvas/        # Stellarium Web Engine 画布封装
│   │   ├── view/          # 主视图组件
│   │   ├── search/        # 天体搜索、高级搜索
│   │   ├── settings/      # 设置面板和对话框
│   │   ├── controls/      # 缩放、导航、书签
│   │   ├── time/          # 时间控制和时钟显示
│   │   ├── overlays/      # 视野模拟器、卫星追踪器、天空标记
│   │   ├── planning/      # 高度图、曝光计算器、观测计划
│   │   ├── objects/       # 天体信息面板、详情抽屉
│   │   ├── management/    # 设备、位置、缓存管理器
│   │   ├── knowledge/     # 每日天文知识
│   │   ├── mount/         # 望远镜赤道仪控制
│   │   ├── onboarding/    # 欢迎向导和新手引导
│   │   └── map/           # 基于 Leaflet 的位置选择器
│   ├── common/            # 共享组件（主题、语言、日志查看器）
│   ├── icons/             # 品牌图标、SkyMap 标志
│   └── ui/                # shadcn/ui 组件
├── lib/                    # 核心逻辑
│   ├── astronomy/         # 天文计算
│   │   ├── coordinates/   # 坐标转换
│   │   ├── time/          # 儒略日、恒星时
│   │   ├── celestial/     # 太阳、月球计算
│   │   ├── visibility/    # 目标可见性
│   │   ├── twilight/      # 曙暮光时间
│   │   ├── imaging/       # 曝光计算
│   │   ├── engine/        # 统一 Tauri/回退天文引擎
│   │   ├── horizon/       # 自定义地平线轮廓
│   │   └── object-resolver/ # 天体名称解析
│   ├── stores/            # Zustand 状态管理（26+ stores）
│   ├── tauri/             # Tauri API 封装
│   ├── services/          # 外部 API 服务
│   ├── hooks/             # 自定义 React Hooks（37+ hooks）
│   ├── catalogs/          # 天文星表数据
│   ├── logger/            # 结构化日志系统
│   ├── storage/           # 存储抽象层
│   ├── cache/             # 缓存压缩、配置、迁移
│   └── ...                # core, constants, data, feedback, aladin 等
├── src-tauri/             # Rust 后端
│   └── src/
│       ├── astronomy/     # 坐标变换、天文事件
│       ├── data/          # JSON 存储、设备、位置、目标
│       ├── cache/         # 离线瓦片缓存、统一缓存
│       ├── network/       # HTTP 客户端、安全、速率限制
│       ├── platform/      # 应用设置、更新器、解板
│       └── mount/         # ALPACA 赤道仪客户端、模拟器
├── public/                 # 静态资源（包含 Stellarium 引擎）
├── i18n/                   # 国际化配置
│   └── messages/          # 翻译文件（en.json, zh.json）
└── docs/                   # 文档（MkDocs）
```

## 测试

### 单元/集成测试（Jest）

```bash
pnpm test              # 运行所有测试
pnpm test:watch        # 监听模式
pnpm test:coverage     # 生成覆盖率报告
```

### 端到端测试（Playwright）

```bash
pnpm exec playwright test
```

### 代码检查

```bash
pnpm lint              # ESLint（前端）
cargo clippy           # Clippy（Rust）
```

### 安全测试

```bash
cd src-tauri
cargo test security_tests
```

## 安全特性

SkyMap 包含多层安全防护：

- **速率限制** - 滑动窗口算法防止 API 滥用
- **输入验证** - JSON、CSV 和瓦片数据的大小限制
- **SSRF 防护** - URL 验证阻止私有 IP 和危险协议
- **存储安全** - 路径沙箱防止路径穿越攻击

详见[安全文档](./docs/security/security-features.md)。

## 文档导览

完整文档位于 `docs/` 目录：

- **[快速开始](docs/getting-started/index.md)** - 快速上手指南
- **[用户手册](docs/user-guide/index.md)** - 功能详细说明
- **[开发者指南](docs/developer-guide/index.md)** - 开发文档
- **[API 参考](docs/developer-guide/apis/index.md)** - API 文档
- **[部署指南](docs/deployment/index.md)** - 构建与部署说明

## 许可证

MIT License

