# lib/ - 核心业务逻辑层

Cobalt Skymap 应用的核心业务逻辑库，包含天文计算、数据服务、状态管理和平台抽象。

## 模块架构

本目录采用模块化架构，提供清晰的顶层入口点和功能分离。

### 核心模块

- `core/` - 核心类型定义和常量
- `astronomy/` - 纯函数天文计算（坐标、时间、可见性）
- `services/` - 外部数据服务（天文事件、卫星、HiPS）

### 应用模块

- `stores/` - Zustand 状态管理入口
- `hooks/` - React Hooks 入口
- `translations/` - 天体名称翻译
- `catalogs/` - DSO 目录和搜索

### 基础设施模块

- `i18n/` - 国际化
- `storage/` - 存储抽象层
- `offline/` - 离线缓存
- `tauri/` - 桌面集成

### 使用示例

```typescript
// 状态管理
import { useStellariumStore, useSettingsStore } from '@/lib/stores';
import { useEquipmentStore, type CameraPreset } from '@/lib/stores';

// Hooks
import { useGeolocation, useObjectSearch } from '@/lib/hooks';
import { useTonightRecommendations } from '@/lib/hooks';

// 天文计算
import { raDecToAltAz, formatRA, formatDec } from '@/lib/astronomy';
import { calculateTwilightTimes, getMoonPhase } from '@/lib/astronomy';

// DSO 目录
import { useSkyAtlasStore, searchDeepSkyObjects } from '@/lib/catalogs';

// 翻译
import { translateCelestialName, type SkyCultureLanguage } from '@/lib/translations';

// 外部服务
import { fetchObjectInfo, predictPasses } from '@/lib/services';
```

## 目录结构

```
lib/
├── README.md                       # 本文档
├── utils.ts                        # 通用工具函数 (Tailwind CSS)
│
├── core/                           # 核心类型和常量
│   ├── index.ts                    # 模块入口
│   ├── types/                      # 类型定义
│   │   ├── index.ts
│   │   ├── stellarium.ts           # Stellarium 引擎类型
│   │   ├── search.ts               # 搜索相关类型
│   │   ├── equipment.ts            # 设备相关类型
│   │   └── astronomy.ts            # 天文相关类型
│   └── constants/                  # 常量定义
│       ├── index.ts
│       └── sky-surveys.ts          # 天空巡天配置
│
├── astronomy/                      # 天文计算模块
│   ├── index.ts                    # 模块入口
│   ├── coordinates/                # 坐标系统
│   │   ├── index.ts
│   │   ├── conversions.ts          # 坐标转换
│   │   ├── formats.ts              # 格式化
│   │   └── transforms.ts           # 坐标系变换
│   ├── time/                       # 时间计算
│   │   ├── index.ts
│   │   ├── julian.ts               # 儒略日
│   │   ├── sidereal.ts             # 恒星时
│   │   └── formats.ts              # 时间格式化
│   ├── celestial/                  # 天体位置
│   │   ├── index.ts
│   │   ├── sun.ts                  # 太阳位置
│   │   ├── moon.ts                 # 月球位置和月相
│   │   └── separation.ts           # 角距离
│   ├── twilight/                   # 薄暮计算
│   │   ├── index.ts
│   │   └── calculator.ts           # 薄暮时间计算器
│   ├── visibility/                 # 可见性计算
│   │   ├── index.ts
│   │   ├── altitude.ts             # 高度计算
│   │   ├── target.ts               # 目标可见性
│   │   └── circumpolar.ts          # 拱极判断
│   ├── imaging/                    # 成像评估
│   │   ├── index.ts
│   │   ├── exposure.ts             # 曝光计算
│   │   ├── feasibility.ts          # 可行性评估
│   │   └── planning.ts             # 多目标规划
│   └── __tests__/                  # 测试
│
├── services/                       # 数据服务
│   ├── index.ts                    # 模块入口
│   ├── astro-events/               # 天文事件
│   │   ├── index.ts
│   │   ├── types.ts                # 事件类型
│   │   ├── lunar.ts                # 月相事件
│   │   ├── meteor.ts               # 流星雨
│   │   ├── eclipse.ts              # 日月食
│   │   ├── comet.ts                # 彗星
│   │   └── aggregator.ts           # 事件聚合
│   ├── satellite/                  # 卫星服务
│   │   ├── index.ts
│   │   ├── types.ts                # 卫星类型
│   │   ├── propagator.ts           # SGP4/SDP4 轨道计算
│   │   ├── data-sources.ts         # TLE 数据源
│   │   └── passes.ts               # 过境预测
│   ├── hips/                       # HiPS 巡天服务
│   │   ├── index.ts
│   │   ├── types.ts                # HiPS 类型
│   │   └── service.ts              # HiPS 服务类
│   ├── object-info/                # 天体信息服务
│   │   ├── index.ts
│   │   ├── types.ts                # 信息类型
│   │   ├── config.ts               # 数据源配置
│   │   ├── service.ts              # 信息获取服务
│   │   ├── icons.ts                # 图标服务
│   │   └── store.ts                # 配置状态管理
│   └── __tests__/                  # 测试
│
├── catalogs/                       # 天体目录系统
│   ├── index.ts                    # 模块入口
│   ├── types.ts                    # 目录类型定义
│   ├── data/                       # 目录数据
│   │   ├── index.ts
│   │   ├── messier.ts              # 梅西耶目录
│   │   ├── ngc-ic.ts               # NGC/IC 目录
│   │   └── helpers.ts              # 数据辅助函数
│   ├── nighttime/                  # 夜间计算
│   │   ├── index.ts
│   │   └── calculator.ts           # 夜间数据计算器
│   ├── dso/                        # DSO 计算
│   │   ├── index.ts
│   │   ├── altitude.ts             # 高度数据
│   │   ├── scoring.ts              # 评分系统
│   │   └── enrichment.ts           # 数据增强
│   ├── search/                     # 搜索引擎
│   │   ├── index.ts
│   │   ├── engine.ts               # 搜索引擎
│   │   ├── filters.ts              # 筛选器
│   │   └── presets.ts              # 预设筛选
│   ├── store.ts                    # 目录状态管理
│   └── __tests__/                  # 测试
│
├── stores/                         # Zustand 状态管理
│   ├── index.ts                    # 模块入口
│   ├── stellarium-store.ts         # Stellarium 引擎状态
│   ├── settings-store.ts           # 应用设置
│   ├── equipment-store.ts          # 设备配置
│   ├── target-list-store.ts        # 目标列表
│   ├── marker-store.ts             # 天空标记
│   ├── satellite-store.ts          # 卫星追踪
│   ├── framing-store.ts            # 取景框
│   ├── mount-store.ts              # 赤道仪
│   └── __tests__/                  # 测试
│
├── hooks/                          # React Hooks
│   ├── index.ts                    # 模块入口
│   ├── use-geolocation.ts          # 地理位置
│   ├── use-orientation.ts          # 设备方向
│   ├── use-object-search.ts        # 天体搜索
│   ├── use-tonight-recommendations.ts  # 今晚推荐
│   ├── use-target-planner.ts       # 目标规划
│   ├── use-celestial-name.ts       # 天体名称翻译
│   └── __tests__/                  # 测试
│
├── translations/                   # 天体名称翻译
│   ├── index.ts                    # 模块入口
│   ├── types.ts                    # 翻译类型
│   ├── constellations.ts           # 星座翻译
│   ├── stars.ts                    # 恒星翻译
│   ├── dso-types.ts                # DSO 类型翻译
│   ├── stellarium-integration.ts   # Stellarium 集成
│   └── __tests__/                  # 测试
│
├── i18n/                           # 国际化
│   ├── index.ts                    # 模块入口
│   ├── locale-store.ts             # 语言偏好存储
│   └── __tests__/                  # 测试
│
├── storage/                        # 存储抽象层
│   ├── index.ts                    # 统一存储 API
│   ├── types.ts                    # 存储类型
│   ├── platform.ts                 # 平台检测
│   ├── adapters/                   # 存储适配器
│   │   ├── index.ts
│   │   ├── web-storage.ts          # Web localStorage
│   │   └── tauri-storage.ts        # Tauri 文件系统
│   └── zustand-storage.ts          # Zustand 持久化
│
├── offline/                        # 离线缓存
│   ├── index.ts                    # 模块入口
│   ├── types.ts                    # 缓存类型
│   ├── cache-manager.ts            # 缓存管理器
│   ├── store.ts                    # 离线状态
│   └── __tests__/                  # 测试
│
├── tauri/                          # Tauri 桌面集成
│   ├── index.ts                    # 模块入口
│   ├── types.ts                    # Rust 后端类型
│   ├── api.ts                      # Tauri 命令封装
│   └── hooks.ts                    # Tauri React Hooks
│
└── starmap/                        # 星图集成层 (向后兼容)
    └── index.ts                    # 统一重导出
```

## 模块说明

### core/ - 核心类型和常量
所有模块共享的类型定义和常量，避免循环依赖。

### astronomy/ - 天文计算
纯函数的天文计算库，无副作用，可独立测试。包含：
- 坐标转换和变换
- 时间计算（儒略日、恒星时）
- 天体位置计算（太阳、月球）
- 薄暮和可见性计算
- 成像评估和规划

### services/ - 数据服务
外部 API 集成和数据获取服务：
- 天文事件（月相、流星雨、日食等）
- 卫星追踪（TLE 数据、轨道计算）
- HiPS 巡天服务
- 天体信息服务

### catalogs/ - 天体目录
DSO 目录系统，移植自 N.I.N.A.：
- 目录数据（Messier、NGC、IC）
- 搜索引擎和筛选器
- DSO 计算和评分

### stores/ - 状态管理
Zustand 状态管理，所有应用状态的单一来源。

### hooks/ - React Hooks
可复用的 React Hooks，封装业务逻辑。

### translations/ - 翻译
天体名称的多语言翻译（拉丁/英/中）。

### i18n/ - 国际化
应用界面国际化，配合 next-intl 使用。

### storage/ - 存储抽象
统一的存储接口，支持 Web 和 Tauri 平台。

### offline/ - 离线缓存
Stellarium 资源和 HiPS 瓦片的离线缓存。

### tauri/ - 桌面集成
Tauri 桌面应用的 Rust 后端集成。

### starmap/ - 向后兼容
保留原有导出路径，确保现有代码兼容。

## 导入约定

```typescript
// 推荐：使用模块入口导入
import { raDecToAltAz, getMoonPhase } from '@/lib/astronomy';
import { useStellariumStore, useSettingsStore } from '@/lib/stores';
import { hipsService, fetchSatelliteTLE } from '@/lib/services';

// 向后兼容：原有路径仍可用
import { useStellariumStore } from '@/lib/starmap';
```

## 依赖关系

```
core/ ─────────────────────────────────────────────────┐
   │                                                    │
   ▼                                                    │
astronomy/ ──────────────────────────────────────────┐  │
   │                                                 │  │
   ▼                                                 │  │
services/ ◄──────────────────────────────────────────┤  │
   │                                                 │  │
   ▼                                                 │  │
catalogs/ ◄──────────────────────────────────────────┤  │
   │                                                 │  │
   ▼                                                 │  │
stores/ ◄────────────────────────────────────────────┤  │
   │                                                 │  │
   ▼                                                 │  │
hooks/ ◄─────────────────────────────────────────────┘  │
   │                                                    │
   ▼                                                    │
translations/ ◄────────────────────────────────────────┘
   │
   ▼
storage/ ◄─────── i18n/, offline/, tauri/
```

## 测试

每个模块包含 `__tests__/` 目录，测试文件命名为 `*.test.ts`。

```bash
pnpm test                    # 运行所有测试
pnpm test lib/astronomy      # 运行特定模块测试
```
