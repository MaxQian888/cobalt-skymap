# SkyMap

一款基于 **Next.js 16**、**React 19** 和 **Tauri 2.9** 构建的现代化桌面星图与天文观测规划软件。它深度集成了 Stellarium Web Engine，提供实时星空可视化、完备的观测规划工具集，以及专业的天文计算能力。

[English Documentation](./README.md) | [更新日志](./CHANGELOG.md)

## 功能特性

### 星空可视化

- **Stellarium Web Engine** — 实时交互式星空渲染，精准呈现恒星位置、星座与深空天体
- **Aladin Lite 双引擎** — 在 Stellarium 与 Aladin Lite 之间自由切换，支持多波段巡天与 FITS 图像叠加
- **AR 模式** — 将天球实时叠加到相机画面上，带来沉浸式观星体验
- **天空标记与书签** — 自定义标记并保存常用视角，一键快速定位
- **卫星追踪** — 实时追踪人造卫星与空间碎片

### 观测规划

- **观测计划** — 通过高度图、可见性窗口与最佳观测时机推荐，科学规划每次出摊
- **目标推荐** — 针对摄影、目视及混合观测模式，提供带置信度评分的自适应目标推荐
- **梅西耶马拉松** — 专为梅西耶马拉松活动设计的完整工作流与执行辅助
- **观测日志** — 结构化记录与回顾每次观测 session
- **赤道仪安全模拟** — 在实际指向目标前，模拟 GEM 赤道仪运行轨迹，预先排查子午线翻转、时角限制与立柱碰撞风险

### 设备与工具

- **设备管理** — 配置望远镜、相机与目镜，实时计算并叠加视场范围
- **在线解板（Plate Solving）** — 将拍摄图像与星表匹配，快速获取精确指向
- **赤道仪控制** — 支持 ALPACA 协议的赤道仪控制，提供实时状态轮询与 slew 指令
- **曝光计算器** — 根据天光质量与器材参数，给出合理的曝光时间建议
- **目镜模拟** — 模拟不同目镜或相机传感器下的实际视场效果

### 天文计算引擎

- **统一计算引擎** — Rust 后端优先，搭配纯 JS 回退引擎，确保桌面端与 Web 端结果完全一致
- **天文计算器** — 九大独立标签页：今夜可见、位置、升落 transit、星历、年历、天象、坐标转换、时间、太阳系
- **坐标转换管线** — 统一的 ICRF/CIRS/OBSERVED 参考架转换，附带 UTC/UT1/TT 元数据传递
- **离线精度保障** — 内置 EOP 基线数据，联网时后台增量更新，无网也能保持高精度
- **每日天文知识** — 精选天文科普内容与近期天象，在启动时呈现

### 界面与无障碍

- **现代化界面** — Tailwind CSS v4 搭配 Geist 字体，支持深色模式与完整的主题工作台自定义
- **无障碍组件** — 基于 Radix UI 的 shadcn/ui 组件，全面支持键盘导航
- **夜视模式** — 红光滤镜，保护暗适应能力
- **多语言** — 通过 next-intl 提供简体中文与英文界面
- **响应式布局** — 针对桌面端优化，同时对平板触控做了精细适配
- **自动更新** — 桌面端内置更新机制，保持软件始终最新

### 安全防护

- **速率限制** — 滑动窗口算法，防止接口滥用
- **输入校验** — 对 JSON、CSV 与瓦片数据设置严格大小限制
- **SSRF 防护** — URL 校验拦截私有 IP 与危险协议
- **路径沙箱** — 文件存储操作防目录遍历
- **密钥保险箱（Secret Vault）** — 通过系统钥匙串安全存储 API 密钥等敏感凭证

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | Next.js 16 (App Router), React 19, TypeScript |
| **样式** | Tailwind CSS v4, shadcn/ui, Geist |
| **状态管理** | Zustand |
| **桌面端** | Tauri 2.9 (Rust) |
| **天文引擎** | Stellarium Web Engine, Aladin Lite, 自定义计算库 |
| **国际化** | next-intl |
| **存储** | JSON 文件存储（后端），localStorage（Web 回退） |
| **安全** | 速率限制、URL 校验、大小限制、密钥保险箱 |

## 前置要求

开始之前，请确保已安装以下依赖：

### Web 开发

- **Node.js** 20.x 或更高版本
- **pnpm** 9.x 或更高版本（推荐）

### 桌面端开发

- **Rust** 1.75 或更高版本
- **系统依赖**：
  - **Windows**：WebView2、Visual Studio C++ Build Tools
  - **macOS**：Xcode Command Line Tools
  - **Linux**：libwebkit2gtk-4.1、build-essential、curl、wget 等

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

## 开发

### Web 开发

```bash
pnpm dev
```

在 [http://localhost:1420](http://localhost:1420) 启动 Next.js 开发服务器。

### 桌面端开发

```bash
pnpm tauri dev
```

启动 Tauri 桌面应用，前端与 Rust 后端均支持热重载。

## 生产构建

### Web 应用（静态导出）

```bash
pnpm build
```

输出至 `out/` 目录。

### 桌面应用

```bash
# 默认构建
pnpm tauri build

# 预配置桌面构建（含依赖信息生成）
pnpm build:desktop

# Windows 专属构建
pnpm build:desktop:windows
```

安装包生成于 `src-tauri/target/release/bundle/`。

## 项目结构

```
skymap/
├── app/                    # Next.js App Router（页面与布局）
├── components/             # React 组件
│   ├── starmap/           # 星图 UI 组件
│   │   ├── canvas/        # Stellarium Web Engine 画布封装
│   │   ├── view/          # 主视图组件
│   │   ├── search/        # 天体搜索、高级搜索、星表查询
│   │   ├── settings/      # 设置面板、对话框与主题工作台
│   │   ├── controls/      # 缩放、导航历史、书签
│   │   ├── time/          # 时间控制与时钟显示
│   │   ├── overlays/      # 视场模拟器、卫星追踪器、天空标记
│   │   ├── planning/      # 高度图、曝光计算器、观测计划、赤道仪安全模拟
│   │   ├── objects/       # 天体信息面板、详情抽屉、图像画廊
│   │   ├── management/    # 设备、位置、缓存与数据管理器
│   │   ├── knowledge/     # 每日天文知识与启动对话框
│   │   ├── mount/         # 赤道仪控制界面
│   │   ├── onboarding/    # 欢迎向导与交互式新手引导
│   │   ├── plate-solving/ # 图像捕获与在线解板
│   │   └── map/           # 基于 Leaflet 的位置选择器
│   ├── common/            # 共享组件（主题、语言、日志查看器）
│   ├── icons/             # 品牌图标与 SkyMap 标志
│   └── ui/                # shadcn/ui 组件
├── lib/                    # 核心逻辑
│   ├── astronomy/         # 天文计算
│   │   ├── coordinates/   # 坐标转换（赤道、地平、银道）
│   │   ├── time/          # 儒略日、恒星时、时制契约
│   │   ├── celestial/     # 太阳、月球与行星计算
│   │   ├── visibility/    # 目标可见性与拱极分析
│   │   ├── twilight/      # 曙暮光时间（民用、航海、天文）
│   │   ├── imaging/       # 曝光与成像可行性计算
│   │   ├── engine/        # 统一 Tauri 优先 / 回退天文引擎
│   │   ├── horizon/       # 自定义地平线轮廓
│   │   └── object-resolver/ # 天体名称解析（星表、小天体、坐标）
│   ├── stores/            # Zustand 状态管理（26+ stores）
│   ├── tauri/             # Tauri API 封装（天文、赤道仪、缓存、更新器等）
│   ├── services/          # 外部 API 服务（搜索、地图瓦片、每日知识）
│   ├── hooks/             # 自定义 React Hooks（37+）
│   ├── catalogs/          # 天文星表数据
│   ├── logger/            # 结构化日志系统
│   ├── storage/           # 存储抽象层（Tauri / Web 适配器）
│   ├── cache/             # 缓存压缩、配置与迁移
│   └── ...                # core、constants、data、feedback、aladin、plate-solving、security
├── src-tauri/             # Rust 后端
│   └── src/
│       ├── astronomy/     # 坐标变换、星历与天文事件
│       ├── data/          # 设备、位置、目标、标记的 JSON 存储
│       ├── cache/         # 离线瓦片缓存与统一网络缓存
│       ├── network/       # HTTP 客户端、安全与速率限制
│       ├── platform/      # 应用设置、自动更新、解板
│       └── mount/         # ALPACA 赤道仪客户端、模拟器与指令处理器
├── public/                 # 静态资源（含 Stellarium 引擎）
├── i18n/                   # 国际化配置
│   └── messages/          # 翻译文件（en.json、zh.json）
└── docs/                   # MkDocs 文档
```

## 测试

### 单元与集成测试（Jest）

```bash
pnpm test              # 运行所有测试
pnpm test:watch        # 监听模式
pnpm test:coverage     # 生成覆盖率报告
pnpm test -- path/to/file   # 运行单个测试文件
```

覆盖率门槛：分支 50%、函数 35%、行 60%、语句 60%。

### 端到端测试（Playwright）

```bash
pnpm test:e2e                  # 运行全部 E2E 测试
pnpm test:e2e:smoke            # 仅运行冒烟测试（Chromium）
pnpm test:e2e:regression       # 回归测试（Chromium、桌面端）
pnpm exec playwright test      # 直接调用
```

### 代码检查与类型校验

```bash
pnpm lint                        # ESLint（前端）
pnpm exec tsc --noEmit          # TypeScript 类型检查
cargo clippy                     # Clippy（Rust）
```

### 安全测试

```bash
cd src-tauri
cargo test security_tests
```

## 安全特性

SkyMap 采用纵深防御策略，内置多层安全机制：

- **速率限制** — 滑动窗口算法，防止接口滥用
- **输入校验** — 对 JSON、CSV 与瓦片数据设置大小限制
- **SSRF 防护** — URL 校验拦截私有 IP 与危险协议
- **存储安全** — 路径沙箱机制，防止目录遍历攻击
- **密钥保险箱** — API 密钥与敏感凭证通过系统钥匙串加密存储

详见[安全文档](./docs/security/security-features.md)。

## 文档导航

完整文档位于 `docs/` 目录：

- **[快速开始](docs/getting-started/index.md)** — 快速上手指南
- **[用户手册](docs/user-guide/index.md)** — 功能详细说明
- **[开发者指南](docs/developer-guide/index.md)** — 开发文档
- **[API 参考](docs/developer-guide/apis/index.md)** — API 文档
- **[部署指南](docs/deployment/index.md)** — 构建与部署说明

## 许可证

MIT License
