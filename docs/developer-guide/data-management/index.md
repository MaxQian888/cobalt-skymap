# 数据管理

本章节介绍 SkyMap 的数据管理系统，涵盖前后端数据流、持久化策略和存储架构。

## 概览

SkyMap 使用统一的 JSON 文件存储系统，所有用户数据存储在平台特定的应用数据目录中。数据模块位于 `src-tauri/src/data/`，提供设备管理、位置管理、目标列表、标记和观测日志等功能。前端通过 `TauriSyncProvider` 组件与 Rust 后端同步状态。

## 存储架构

```
前端 React 组件
    ↓
Zustand Store (lib/stores/)
    ↓
TauriSyncProvider (自动同步)
    ↓
TypeScript API (lib/tauri/*-api.ts)
    ↓
Tauri IPC (invoke)
    ↓
Rust Command (src-tauri/src/data/*.rs)
    ↓
JSON File Store (app_data_dir/skymap/stores/)
```

## 数据模块

| 模块 | Rust 文件 | TS API | Store | 说明 |
|------|-----------|--------|-------|------|
| 通用存储 | `data/storage.rs` | `storage-api.ts` | — | 底层 JSON 读写 |
| 设备管理 | `data/equipment.rs` | — | `equipment-store` | 望远镜、相机、目镜 |
| 位置管理 | `data/locations.rs` | — | — | 观测地点 |
| 目标列表 | `data/target_list.rs` | `target-list-api.ts` | `target-list-store` | 观测目标 |
| 目标导入导出 | `data/target_io.rs` | — | — | CSV/JSON 导入导出 |
| 标记管理 | `data/markers.rs` | `markers-api.ts` | `marker-store` | 天空标记 |
| 观测日志 | `data/observation_log.rs` | — | `observation-log-store` | 观测记录 |

## 已知的持久化 Store

以下 store 的数据通过 Rust 后端持久化到本地 JSON：

- `starmap-target-list` — 观测目标列表
- `starmap-markers` — 天空标记
- `starmap-settings` — 应用设置
- `starmap-equipment` — 设备配置
- `starmap-onboarding` — 首次引导状态
- `starmap-event-sources` — 天文事件源配置
- `starmap-feedback` — 用户反馈
- `starmap-daily-knowledge` — 每日天文知识
- `theme-customization` — 主题自定义
- `skymap-offline` — 离线缓存状态
- `skymap-locale` — 语言区域设置

## 安全与沙箱

所有文件操作通过路径沙箱限制在应用数据目录内：

- 文件名禁止包含 `..`、`/`、`\`
- 路径拼接前验证文件名合法性
- 读取/写入仅允许在 `app_data_dir/skymap/` 下

详见：[安全开发指南](../security/index.md)

## 文档

- **[数据模块架构](data-module.md)** — 数据模块的组织结构和组件

---

返回：[开发指南](../index.md)
