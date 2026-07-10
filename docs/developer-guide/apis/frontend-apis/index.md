# 前端 API 概览

Cobalt Skymap 前端 API 分为两大体系：Zustand Stores 与 React Hooks。

## Zustand Stores

应用使用 Zustand 进行状态管理，共 26+ 个独立 store，覆盖从天文引擎到 UI 面板的全部状态。

### 核心 Stores

| Store | 路径 | 说明 |
|-------|------|------|
| `stellarium-store` | `lib/stores/stellarium-store.ts` | Stellarium 引擎设置与状态 |
| `settings-store` | `lib/stores/settings-store.ts` | 应用偏好设置 |
| `equipment-store` | `lib/stores/equipment-store.ts` | 望远镜、相机、目镜配置 |
| `theme-store` | `lib/stores/theme-store.ts` | 主题与外观 |

### 数据 Stores

| Store | 路径 | 说明 |
|-------|------|------|
| `target-list-store` | `lib/stores/target-list-store.ts` | 观测目标列表 |
| `marker-store` | `lib/stores/marker-store.ts` | 天空标记 |
| `bookmarks-store` | `lib/stores/bookmarks-store.ts` | 视图书签 |
| `favorites-store` | `lib/stores/favorites-store.ts` | 收藏天体 |
| `satellite-store` | `lib/stores/satellite-store.ts` | 卫星追踪 |

### 规划 Stores

| Store | 路径 | 说明 |
|-------|------|------|
| `session-plan-store` | `lib/stores/session-plan-store.ts` | 观测 session 计划 |
| `planning-ui-store` | `lib/stores/planning-ui-store.ts` | 规划面板 UI 状态 |
| `observation-log-store` | `lib/stores/observation-log-store.ts` | 观测日志 |

### 赤道仪 Stores

| Store | 路径 | 说明 |
|-------|------|------|
| `mount-store` | `lib/stores/mount-store.ts` | ALPACA 赤道仪连接与状态 |
| `framing-store` | `lib/stores/framing-store.ts` | 相机 framing |

### 其他 Stores

| Store | 路径 | 说明 |
|-------|------|------|
| `daily-knowledge-store` | `lib/stores/daily-knowledge-store.ts` | 每日天文知识 |
| `aladin-store` | `lib/stores/aladin-store.ts` | Aladin Lite 状态 |
| `updater-store` | `lib/stores/updater-store.ts` | 自动更新状态 |
| `log-store` | `lib/stores/log-store.ts` | 应用日志 |
| `onboarding-store` | `lib/stores/onboarding-store.ts` | 首次引导 |

## React Hooks

Cobalt Skymap 提供 37+ 个自定义 React Hooks，按功能域组织。

### 设备与环境

- `useGeolocation` — 地理定位与回退
- `useDeviceOrientation` — 设备方向传感器
- `useSystemStats` — FPS、内存、在线状态

### 搜索与天体

- `useObjectSearch` — 天体搜索功能
- `useCelestialName` — 天体名称解析
- `useObjectActions` — 共享 slew/添加到列表操作
- `useObjectAstroData` — 天体天文数据

### 规划

- `useTonightRecommendations` — 今夜目标推荐
- `useTargetPlanner` — 目标调度规划
- `useObservingConditions` — 观测条件评估

### 赤道仪

- `useMountPolling` — 赤道仪状态轮询
- `useMountOverlay` — 赤道仪控制面板

### Aladin / Stellarium

- `useAladinLoader` — Aladin Lite 加载
- `useAladinCatalogs` — Aladin 星表管理
- `useStellariumSelection` — Stellarium 天体选择
- `useStellariumFovOverlay` — FOV 叠加同步

### 通用

- `useKeyboardShortcuts` — 键盘快捷键处理
- `useAnimationFrame` — 动画循环管理
- `useIsClient` — 客户端渲染守卫
- `usePrefersReducedMotion` — 减少动画偏好

## 使用示例

### Store 使用

```typescript
import { useSettingsStore } from '@/lib/stores/settings-store';

function MyComponent() {
  const theme = useSettingsStore(state => state.theme);
  const setTheme = useSettingsStore(state => state.setTheme);

  return <button onClick={() => setTheme('dark')}>Dark</button>;
}
```

### Hook 使用

```typescript
import { useTonightRecommendations } from '@/lib/hooks/use-tonight-recommendations';

function RecommendationsPanel() {
  const { recommendations, isLoading } = useTonightRecommendations();

  if (isLoading) return <Spinner />;
  return <List items={recommendations} />;
}
```

## 相关文档

- **[Stores API](stores.md)** — 各 Store 详细 API
- **[Hooks API](hooks.md)** — 各 Hook 详细 API
- **[后端 API](../backend-apis/index.md)** — Tauri 命令
