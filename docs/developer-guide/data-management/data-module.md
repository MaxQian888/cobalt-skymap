# Data Module Architecture

本文档介绍 Cobalt Skymap 后端的数据管理模块架构。

## 模块概览

`src-tauri/src/data/` 模块提供统一的 JSON 文件存储系统，管理所有应用数据的持久化。

**位置**: `src-tauri/src/data/`

## 模块组织

```
src-tauri/src/data/
├── mod.rs                # 模块导出和公共接口
├── storage.rs            # 通用 JSON 存储系统
├── equipment.rs          # 设备管理（望远镜、相机、目镜、滤镜）
├── locations.rs          # 观测位置管理
├── targets.rs            # 目标列表管理
├── target_io.rs          # 目标导入/导出 (CSV, JSON)
├── markers.rs            # 天空标记持久化
└── observation_log.rs    # 观测日志
```

## 核心组件

### storage.rs - 通用存储层

提供所有数据类型的基础存储操作：

- `save_store_data` / `load_store_data` - 基础 CRUD
- `delete_store_data` - 删除存储
- `list_stores` - 列出所有存储
- `export_all_data` / `import_all_data` - 批量导入导出
- `get_storage_stats` - 存储统计信息
- `get_data_directory` - 获取存储目录路径

### equipment.rs - 设备数据管理

管理观测设备配置：

- 望远镜 (Telescope) - 口径、焦距、类型
- 相机 (Camera) - 传感器尺寸、像素大小
- 目镜 (Eyepiece) - 焦距、视场
- 滤镜 (Filter) - 类型、波段
- 巴洛/减焦镜 (Barlow/Reducer)

**存储文件**: `starmap-equipment.json`

### locations.rs - 位置数据管理

管理观测站点信息：

- 地理坐标 (纬度/经度/海拔)
- 时区设置
- 当前位置标记

**存储文件**: `starmap-locations.json`

### targets.rs - 目标列表管理

管理观测目标列表：

- 目标 CRUD 操作
- 批量操作 (添加/删除/更新状态/设置优先级)
- 标签管理
- 搜索和统计
- 归档功能

**存储文件**: `starmap-target-list.json`

### markers.rs - 标记数据管理

管理天空标记数据：

- 自定义标记 (RA/Dec 位置)
- 标记分组
- 可见性控制

**存储文件**: `starmap-markers.json`

### observation_log.rs - 观测日志

管理观测记录和会话：

- 观测会话 (时间、地点、条件)
- 观测记录 (天体、备注、评分)
- 统计信息

**存储文件**: `starmap-observation-log.json`

### target_io.rs - 导入导出

目标列表的导入导出功能：

- 导出格式: CSV, JSON
- 导入支持: 解析外部目标列表

## 存储位置

数据存储在平台特定的应用数据目录：

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\skymap\stores\` |
| macOS | `~/Library/Application Support/skymap/stores/` |
| Linux | `~/.local/share/skymap/stores/` |

每个存储是一个独立的 JSON 文件：`<store-name>.json`

## 数据类型导出

`mod.rs` 重新导出所有公共类型和命令：

```rust
// 存储错误类型
pub use storage::StorageError;

// 存储命令
pub use storage::{save_store_data, load_store_data, ...};

// 设备类型和命令
pub use equipment::{Telescope, Camera, add_telescope, ...};

// 位置类型和命令
pub use locations::{Location, add_location, ...};

// 目标类型和命令
pub use targets::{Target, add_target, ...};

// 标记类型和命令
pub use markers::{Marker, add_marker, ...};

// 观测日志类型和命令
pub use observation_log::{Session, Observation, ...};

// 导入导出
pub use target_io::{export_targets, import_targets};
```

## 安全特性

- **大小限制**: 单个 JSON 文件最大 10MB
- **路径沙箱**: 仅允许访问预定义的存储目录
- **JSON 校验**: 写入前验证数据格式
- **速率限制**: 所有操作受速率限制器保护

## 相关文档

- [Tauri Commands API](../apis/backend-apis/tauri-commands.md) - 完整命令列表
- [后端架构](../architecture/backend-architecture.md) - 整体后端架构
- [数据流设计](../architecture/data-flow.md) - 前后端数据流
