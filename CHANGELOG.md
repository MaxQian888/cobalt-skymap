# Changelog

本文件记录 SkyMap 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 文档与工程治理

- 对齐项目文档与当前实现：统一仓库标识、站点元信息与链接基线。
- 新增文档-实现-验证追溯矩阵：`docs/reference/documentation-implementation-alignment.md`。
- 在核心文档补充以下实现参考：
  - starmap 启动引导与降级恢复（bootstrap/loaders）
  - unified/offline cache 与诊断策略
  - 在线解板与赤道仪控制链路
  - Daily Knowledge 多源与回退链路

### 说明

- 本节反映当前主分支已合入但尚未打版本标签的变更。
- 下方“版本规划”仅代表计划，不表示功能已交付。

## [0.1.0] - 2025-01-04

### 新增功能

#### 核心功能
- **星图可视化** - 集成 Stellarium Web Engine，实现实时星空渲染
- **观测规划** - 天体可见性预测、高度图、最佳观测时间推荐
- **设备管理** - 望远镜、相机、目镜配置与视野计算
- **目标列表** - 观测目标管理、CSV 导入导出
- **天文事件** - 日月食、行星合、流星雨预报
- **离线功能** - 星图瓦片本地缓存、离线模式支持

#### 天文计算
- 坐标系转换（赤道、地平、银道坐标）
- 儒略日和恒星时计算
- 太阳、月球位置计算
- 曙暮光时间计算（民用、航海、天文）
- 天体可见性分析
- 拱极星判断
- 曝光时间建议

#### 用户界面
- 夜视模式（红光滤镜）
- 多语言支持（中文/英文）
- 深色模式
- 响应式布局
- 启动引导向导

#### 安全功能
- **速率限制** - 滑动窗口算法，防止 API 滥用
- **输入验证** - JSON/CSV/瓦片大小限制
- **SSRF 防护** - URL 验证，阻止私有 IP 和危险协议
- **存储安全** - 路径沙箱，防止路径穿越攻击

### 技术栈

- **前端**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **桌面**: Tauri 2.9 (Rust)
- **UI 组件**: shadcn/ui, Radix UI
- **状态管理**: Zustand
- **国际化**: next-intl
- **存储**: JSON File Storage

### 后端模块

- `astronomy.rs` - 天文计算
- `equipment.rs` - 设备管理
- `locations.rs` - 位置管理
- `target_list.rs` - 目标列表
- `markers.rs` - 天空标记
- `observation_log.rs` - 观测日志
- `offline_cache.rs` - 离线缓存
- `unified_cache.rs` - 统一缓存
- `astro_events.rs` - 天文事件
- `security.rs` - 安全模块
- `rate_limiter.rs` - 速率限制
- `storage.rs` - 存储系统
- `updater.rs` - 自动更新
- `http_client.rs` - HTTP 客户端

### 前端模块

- `lib/astronomy/` - 天文计算库
- `lib/stores/` - Zustand 状态管理
- `lib/tauri/` - Tauri API 封装
- `components/starmap/` - 星图 UI 组件

---

## 版本规划（计划中，非已交付）

### [0.2.0] - 计划中
- 望远镜控制（ASCOM/INDI 协议）
- 高级摄影规划工具
- 数据云同步

### [0.3.0] - 计划中
- 图像处理和叠加
- 观测日志增强
- 社区分享功能
