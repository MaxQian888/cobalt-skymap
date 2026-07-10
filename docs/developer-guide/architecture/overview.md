# 系统架构

本文档从宏观角度介绍 Cobalt Skymap 的整体系统架构设计。

## 架构概览

Cobalt Skymap 采用前后端分离的架构，通过 Tauri 框架将 Web 技术栈与原生桌面能力结合。

## 整体架构图

```mermaid
graph TB
    subgraph 用户界面层
        A1[React Components<br/>组件层]
        A2[UI Components<br/>UI组件库]
        A3[Business Logic<br/>业务逻辑]
        A4[State Management<br/>状态管理]
    end

    subgraph API层
        B1[Frontend APIs<br/>前端API]
        B2[Tauri IPC<br/>进程间通信]
        B3[Backend APIs<br/>后端API]
    end

    subgraph 安全层
        S1[Rate Limiter<br/>速率限制]
        S2[Validator<br/>输入验证]
        S3[SSRF Protection<br/>SSRF防护]
    end

    subgraph 网络层
        N1[HTTP Client<br/>HTTP客户端]
    end

    subgraph 后端服务层
        C1[platform<br/>桌面平台服务]
        C2[cache<br/>缓存系统]
        C3[astronomy<br/>天文计算]
        C4[data<br/>数据存储]
    end

    subgraph 数据层
        D1[(JSON Stores)]
        D2[Tile Cache<br/>瓦片缓存]
        D3[Unified Cache<br/>统一缓存]
        D4[Star Catalog Data]
    end

    A1 --> A2
    A1 --> A3
    A3 --> A4
    A3 --> B1
    B1 --> B2
    B2 --> B3
    B3 --> S1
    B3 --> S2
    B3 --> S3
    S1 --> N1
    S2 --> N1
    S3 --> N1
    N1 --> C1
    N1 --> C2
    N1 --> C3
    N1 --> C4
    C4 --> D1
    C2 --> D2
    C2 --> D3
    C3 --> D4
```

## 前端架构

### 技术栈

- **框架**: Next.js 16 (App Router)
- **UI库**: React 19
- **样式**: Tailwind CSS v4
- **组件**: shadcn/ui + Radix UI
- **状态**: Zustand
- **国际化**: next-intl

### 前端分层结构

```mermaid
graph TD
    subgraph 展示层
        P1[Pages<br/>页面]
        P2[Components<br/>组件]
        P3[UI Library<br/>UI库]
    end

    subgraph 业务逻辑层
        L1[Services<br/>服务]
        L2[Hooks<br/>钩子]
        L3[Utils<br/>工具]
    end

    subgraph 状态管理层
        S1[StellariumStore<br/>星图状态]
        S2[EquipmentStore<br/>设备状态]
        S3[TargetStore<br/>目标状态]
    end

    subgraph 数据访问层
        D1[Astronomy<br/>天文计算]
        D2[Catalogs<br/>星表数据]
        D3[Tauri API<br/>后端API]
    end

    P1 --> P2
    P2 --> P3
    P2 --> L1
    L1 --> L2
    L1 --> L3
    L1 --> S1
    L1 --> S2
    L1 --> S3
    L2 --> D1
    L2 --> D2
    L2 --> D3
```

### 前端核心模块

#### 1. 星图渲染模块

**位置**: `components/starmap/core/`

**职责**:
- Canvas/WebGL 星图渲染
- 天体位置计算与投影
- 交互事件处理
- 性能优化

**关键组件**:
- `StellariumCanvas` - 主渲染组件
- `StellariumView` - 视图控制
- `StellariumMount` - 赤道仪模拟
- `ZoomControls` - 缩放控制

#### 2. 业务逻辑模块

**位置**: `lib/services/`

**职责**:
- 封装业务逻辑
- 协调多个组件
- 处理数据转换

**关键服务**:
- `hips-service` - HiPS图像服务
- `object-info-service` - 天体信息查询
- `astro-events-service` - 天文事件计算
- `satellite-service` - 卫星跟踪

#### 3. 状态管理模块

**位置**: `lib/stores/`

**职责**:
- 全局状态管理
- 跨组件通信
- 持久化状态

**关键Store**:
- `stellarium-store` - 星图状态
- `equipment-store` - 设备状态
- `target-list-store` - 目标列表
- `settings-store` - 应用设置

## 后端架构

### 技术栈

- **框架**: Tauri 2.9
- **语言**: Rust
- **存储**: JSON File Storage
- **序列化**: Serde
- **HTTP客户端**: reqwest 0.12
- **异步运行时**: tokio

### 后端模块结构

后端代码按功能域组织为以下模块：

| 模块 | 路径 | 职责 |
|------|------|------|
| `platform` | `src-tauri/src/platform/` | 桌面平台功能 (应用设置、控制、更新、板求解) |
| `cache` | `src-tauri/src/cache/` | 缓存系统 (瓦片缓存、统一缓存) |
| `astronomy` | `src-tauri/src/astronomy/` | 天文计算与事件 |
| `data` | `src-tauri/src/data/` | 数据存储 (设备、位置、目标、标记、日志) |
| `network` | `src-tauri/src/network/` | 网络与安全 (HTTP客户端、速率限制、验证) |
| `utils` | `src-tauri/src/utils.rs` | 通用工具函数 |

### 后端模块组织

```mermaid
graph TD
    subgraph 命令层
        M1[main.rs<br/>主入口]
        M2[lib.rs<br/>命令注册]
    end

    subgraph 安全层
        S1[network/security.rs<br/>安全验证]
        S2[network/rate_limiter.rs<br/>速率限制]
    end

    subgraph 网络层
        N1[network/http_client.rs<br/>HTTP客户端]
    end

    subgraph 业务模块层
        P1[platform/<br/>桌面平台]
        P2[cache/<br/>缓存系统]
        P3[astronomy/<br/>天文计算]
        P4[data/<br/>数据存储]
    end

    subgraph 数据访问层
        A1[JSON<br/>文件存储]
        A2[File System<br/>文件系统]
        A3[Network<br/>网络请求]
    end

    M1 --> M2
    M2 --> S1
    M2 --> S2
    S1 --> N1
    S2 --> N1
    N1 --> P1
    N1 --> P2
    N1 --> P3
    N1 --> P4
    P4 --> A1
    P2 --> A2
    P3 --> A3
```

### 后端核心模块

#### 1. platform 模块 (桌面平台)

**位置**: `src-tauri/src/platform/`

**职责**:
- 应用设置与窗口管理
- 应用控制 (重启、退出、刷新)
- 更新管理
- 板求解器集成

**关键文件**:
- `app_settings.rs` - 应用配置
- `app_control.rs` - 应用控制
- `updater.rs` - 自动更新
- `plate_solver.rs` - 天文板求解

#### 2. cache 模块 (缓存系统)

**位置**: `src-tauri/src/cache/`

**职责**:
- HiPS瓦片离线缓存
- 统一网络缓存
- 缓存策略管理
- 存储空间管理

**关键文件**:
- `offline.rs` - 瓦片缓存
- `unified.rs` - 统一缓存

**缓存层次**:

```mermaid
graph LR
    A[请求] --> B{内存缓存?}
    B -->|命中| C[返回数据]
    B -->|未命中| D{磁盘缓存?}
    D -->|命中| E[加载到内存]
    D -->|未命中| F[网络获取]
    F --> G[保存到磁盘]
    G --> E
    E --> C
```

#### 3. astronomy 模块 (天文计算)

**位置**: `src-tauri/src/astronomy/`

**职责**:
- 天体位置计算
- 坐标转换
- 升落时间计算
- 可见性判断
- 天文事件计算

**关键文件**:
- `calculations.rs` - 天文计算
- `events.rs` - 天文事件

#### 4. data 模块 (数据存储)

**位置**: `src-tauri/src/data/`

**职责**:
- JSON 文件存储管理
- CRUD操作
- 数据持久化

**关键文件**:
- `storage.rs` - 通用存储
- `equipment.rs` - 设备管理
- `locations.rs` - 位置管理
- `targets.rs` - 目标列表
- `markers.rs` - 自定义标记
- `observation_log.rs` - 观测日志
- `target_io.rs` - 导入导出

**详见**: [数据模块架构](../data-management/data-module.md)

#### 5. network 模块 (网络与安全)

**位置**: `src-tauri/src/network/`

**职责**:
- HTTP 请求处理
- 速率限制 (滑动窗口算法)
- URL 验证 (SSRF 防护)
- 输入大小限制

**关键文件**:
- `http_client.rs` - HTTP 客户端
- `security.rs` - 安全验证
- `rate_limiter.rs` - 速率限制

## 前后端通信

### Tauri IPC机制

```mermaid
sequenceDiagram
    participant F as 前端React
    participant I as Tauri IPC
    participant S as 安全层
    participant N as 网络层
    participant B as Rust后端
    participant D as 数据层

    F->>I: invoke('command_name', params)
    I->>S: 验证请求
    S->>S: 速率限制检查
    S->>S: SSRF防护
    S->>N: HTTP请求(如需)
    N->>B: 调用Rust模块
    B->>D: 执行操作
    D-->>B: 返回结果
    B-->>I: 序列化结果
    I-->>F: 返回JSON
    F->>F: 更新状态/UI
```

### API调用示例

**前端调用**:

```typescript
import { invoke } from '@tauri-apps/api/core';

// 调用后端命令
const result = await invoke('get_object_info', {
  objectId: 'M31'
});
```

**后端定义**:

```rust
#[tauri::command]
async fn get_object_info(object_id: String) -> Result<ObjectInfo, String> {
    // 实现逻辑
    Ok(object_info)
}
```

## 数据流设计

### 典型数据流

#### 场景1: 星图渲染

```mermaid
sequenceDiagram
    participant U as 用户
    participant C as 组件
    participant S as Store
    participant R as 渲染器

    U->>C: 拖动星图
    C->>S: 更新视角状态
    S->>S: 触发重渲染
    S->>R: 请求重绘
    R->>R: 计算天体位置
    R->>R: Canvas绘制
    R-->>U: 显示结果
```

#### 场景2: 搜索天体

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant T as Tauri
    participant S as 安全层
    participant N as 网络层
    participant B as 后端
    participant D as 数据库

    U->>F: 输入"M31"
    F->>F: 本地索引搜索
    alt 本地找到
        F->>U: 显示结果
    else 本地未找到
        F->>T: invoke('search_object')
        T->>S: 验证请求
        S->>S: 速率限制检查
        S->>N: 通过安全检查
        N->>B: 执行搜索
        B->>D: 查询数据库
        D-->>B: 返回结果
        B-->>T: 返回数据
        T-->>F: JSON结果
        F->>U: 显示结果
    end
```

#### 场景3: 观测规划

```mermaid
sequenceDiagram
    participant U as 用户
    participant F as 前端
    participant A as 天文计算
    participant T as Tauri
    participant S as 存储

    U->>F: 选择天体
    F->>A: 计算可见性
    A->>A: 计算升落时间
    A->>A: 检查曙暮光
    A-->>F: 返回可见时段
    F->>U: 显示预测
    U->>F: 添加到列表
    F->>T: invoke('save_target')
    T->>S: 保存到数据库
    S-->>F: 确认保存
    F->>U: 更新列表显示
```

## 安全层架构

### 安全防护机制

Cobalt Skymap 在后端实现了多层安全防护，所有网络请求和用户输入都经过严格的验证和限制。

### 安全组件

```mermaid
graph TD
    A[前端请求] --> B{速率限制检查}
    B -->|超过限制| C[拒绝请求]
    B -->|通过| D{输入验证}
    D -->|格式无效| C
    D -->|大小超限| C
    D -->|通过| E{URL安全检查}
    E -->|私有IP| C
    E -->|危险协议| C
    E -->|通过| F[执行请求]
```

### 1. 速率限制 (Rate Limiting)

**算法**: 滑动窗口 (Sliding Window)

**限制**:
- 全局: 100 请求/60秒
- 每个命令可配置独立限制

**实现**: `src-tauri/src/network/rate_limiter.rs`

### 2. 输入验证

**限制**:
- `MAX_JSON_SIZE`: 10 MB
- `MAX_CSV_SIZE`: 50 MB
- `MAX_TILE_SIZE`: 5 MB
- `MAX_URL_LENGTH`: 2048 字节

**实现**: `src-tauri/src/network/security.rs`

### 3. SSRF 防护

**阻止的地址**:
- 私有 IP (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- Localhost 变体
- 危险协议 (javascript:, data:, file: 等)

**允许的协议**:
- `https://` (默认)
- `http://` (可配置)

### 4. 存储安全

**路径沙箱**:
- 所有文件操作限制在应用数据目录
- 路径遍历防护
- 文件大小限制

## 状态管理

### Zustand Store架构

```mermaid
graph TD
    A[Root Store] --> B[StellariumStore<br/>星图状态]
    A --> C[EquipmentStore<br/>设备状态]
    A --> D[TargetListStore<br/>目标列表]
    A --> E[SettingsStore<br/>设置]

    B --> B1[视角]
    B --> B2[时间]
    B --> B3[图层]

    C --> C1[望远镜]
    C --> C2[相机]
    C --> C3[配置]

    D --> D1[目标]
    D --> D2[状态]
    D --> D3[优先级]
```

### 状态同步策略

1. **单向数据流**: 用户操作 → 状态更新 → UI渲染
2. **乐观更新**: 前端先更新，后端异步确认
3. **最终一致性**: 允许短暂的UI与数据不一致
4. **错误回滚**: 后端失败时恢复前端状态

## 架构优势

### 1. 模块化设计

- 前后端清晰分离
- 功能模块独立
- 便于并行开发

### 2. 性能优化

- 前端虚拟化渲染
- 后端异步处理
- 多层缓存策略

### 3. 可维护性

- TypeScript类型安全
- Rust内存安全
- 清晰的模块边界

### 4. 可扩展性

- 插件化架构
- 服务层抽象
- 易于添加新功能

## 技术决策理由

### 为什么选择 Next.js?

- 优秀的开发体验
- App Router支持
- 服务端渲染能力（预留）
- 丰富的生态系统

### 为什么选择 Tauri?

- 更小的安装包
- 更好的性能
- Rust的安全性和性能
- 原生API访问

### 为什么选择 Zustand?

- 轻量级
- 简单的API
- 无需Provider包裹
- 良好的TypeScript支持

### 为什么选择 JSON 存储?

- 零配置
- 轻量级
- 易于调试和人工检查数据
- 适合桌面应用配置与轻量级数据存储
- 跨平台
- 适合桌面应用

## 性能考虑

### 前端性能

- **虚拟化**: 长列表虚拟化
- **懒加载**: 组件和路由懒加载
- **memoization**: React.memo、useMemo
- **Web Workers**: 耗时计算移到Worker

### 后端性能

- **异步处理**: tokio异步运行时
- **缓存策略**: 多级缓存
- **批量操作**: 减少IO次数
- **索引优化**: 数据库索引

## 未来架构演进

### 短期计划

- [ ] 增加后台任务队列
- [ ] 实现插件系统
- [ ] 优化缓存策略

### 长期计划

- [ ] 支持云同步
- [ ] 多设备协作
- [ ] AI辅助观测规划

## 相关文档

- [前端架构详解](frontend-architecture.md)
- [后端架构详解](backend-architecture.md)
- [数据流设计](data-flow.md)
- [状态管理](../project-structure/index.md)

