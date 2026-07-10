# 存储 API

本文档介绍 Cobalt Skymap 后端的数据存储 API。

## 概览

存储模块提供本地数据持久化功能，所有数据以 JSON 格式存储在应用程序数据目录中（`skymap/stores/*.json`）。

## 存储结构

### 主要存储 (Stores)

| 存储名称 | 用途 |
| --- | --- |
| `starmap-settings` | 应用程序通用设置 |
| `starmap-equipment` | 设备配置信息 |
| `starmap-target-list` | 观测目标列表 |
| `starmap-markers` | 用户自定义标记 |
| `skymap-offline` | 离线地图区域配置 |
| `skymap-locale` | 语言与国际化偏好 |

## Store 命令

### save_store_data

保存数据到指定存储。后端会自动执行数据大小验证（最大 10MB）和 JSON 格式校验。

```typescript
await invoke('save_store_data', {
  storeName: 'starmap-settings',
  data: JSON.stringify(settingsObject)
});
```

**参数**：

- `storeName: string` - 存储名称
- `data: string` - JSON 字符串数据

**返回**：`Result<(), StorageError>`

### load_store_data

从存储加载数据。

```typescript
const data = await invoke<string | null>('load_store_data', {
  storeName: 'starmap-settings'
});
const settings = data ? JSON.parse(data) : defaultSettings;
```

**参数**：

- `storeName: string` - 存储名称

**返回**：`Result<Option<String>, StorageError>`

### delete_store_data

删除指定存储的文件。

```typescript
await invoke('delete_store_data', {
  storeName: 'temporary-data'
});
```

**参数**：

- `storeName: string` - 存储名称

**返回**：`Result<boolean, StorageError>`

### get_storage_stats

获取存储统计信息，包括总大小、存储文件数量和每个文件的详细信息。

```typescript
interface StorageStats {
  total_size: number;
  store_count: number;
  stores: StoreInfo[];
  directory: string;
}

interface StoreInfo {
  name: string;
  size: number;
  modified: string | null; // ISO Date string
}

const stats = await invoke<StorageStats>('get_storage_stats');
```

**返回**：`Result<StorageStats, StorageError>`

## 统一缓存命令 (Unified Cache)

统一缓存系统用于临时存储 API 响应或计算结果，支持 TTL 过期。

### get_unified_cache_entry

从缓存获取数据。

```typescript
const cached = await invoke<string | null>('get_unified_cache_entry', {
  key: 'object-info-M31'
});
```

### put_unified_cache_entry

存储数据到缓存。

```typescript
await invoke('put_unified_cache_entry', {
  key: 'object-info-M31',
  value: JSON.stringify(objectInfo),
  ttlSeconds: 3600  // 1小时过期
});
```

### cleanup_unified_cache

手动清理所有已过期的缓存条目。

```typescript
const removedCount = await invoke<number>('cleanup_unified_cache');
```

## 安全性

存储模块包含以下安全防护：
1. **大小限制**：单个存储文件最大限制为 10MB。
2. **速率限制**：保存与加载操作受速率限制器保护。
3. **路径验证**：仅允许访问预定义的存储目录。

## 错误处理

所有存储命令返回结构化的 `StorageError`。

```typescript
try {
  await invoke('save_store_data', { storeName, data });
} catch (error) {
  // error 为字符串形式的错误描述
  console.error('存储操作失败:', error);
}
```

## 相关文档

- [Tauri 命令大全](tauri-commands.md)
- [前端状态管理 (Zustand)](../frontend-apis/stores.md)
- [数据模块架构](../../data-management/data-module.md) - 数据模块组织结构
