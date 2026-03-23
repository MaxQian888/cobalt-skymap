# 星图核心模块

本文档描述当前实现（Next.js 16 + Stellarium Web Engine JS/WASM + Tauri）。

## 模块结构

- `components/starmap/canvas/sky-map-canvas.tsx`
  - 引擎切换包装层（Stellarium / Aladin）
- `components/starmap/canvas/stellarium-canvas.tsx`
  - Stellarium 画布组件与 `ref` 能力暴露
- `lib/hooks/stellarium/*`
  - 引擎加载、缩放、设置同步、坐标换算、事件桥接、高级 API Hook
- `lib/stores/stellarium-store.ts`
  - Stellarium/Aladin 引擎实例、核心映射、视角辅助函数
- `lib/stores/settings-store.ts`
  - 用户设置持久化（含 Stellarium 显示配置）

## StellariumCanvas Ref API（当前实现）

`SkyMapCanvasRef` 基础能力：

- `zoomIn() / zoomOut()`
- `setFov(fov) / getFov()`
- `getClickCoordinates(clientX, clientY)`
- `reloadEngine()`
- `getEngineStatus()`

共享扩展能力（两个引擎均支持）：

- `exportImage()`：导出当前画布为 PNG data URL
- `gotoObject(name)`：导航到指定天体（Stellarium 用 `getObj` + `pointAndLock`，Aladin 用内置 `gotoObject`）

Stellarium 扩展能力（可选）：

- `getEngine()`：返回当前 `StellariumEngine | null`
- `onEngineEvent('click' | 'rectSelection', cb)`：事件订阅，返回解除函数
- `setEngineFont('regular' | 'bold', url)`：动态注入字体
- `runCalendar({ start, end })`：运行 calendar 事件计算

## Stellarium 加载状态机（当前实现）

`useStellariumLoader` 采用“单会话总超时 + 分阶段重试”机制，核心行为如下：

- 加载会话开始时仅初始化一次总超时窗口（`OVERALL_LOADING_TIMEOUT`，当前 45s）。
- 若 `canvas/container` 未就绪（为空或尺寸为 0），进入短间隔重试（`RETRY_DELAY_MS`）。
- 脚本加载和 WASM 初始化分别受阶段超时保护（`SCRIPT_LOAD_TIMEOUT` / `WASM_INIT_TIMEOUT`）。
- 阶段失败会按 `MAX_RETRY_COUNT` 重试，但同时受总超时窗口约束。
- 总超时到达后立即进入终态：显示 `overallTimeout`，停止 loading，不再继续重试。

实现要点：

- `onReady` 回调内部异常会被立即转换为失败（`reject`），避免“假挂起”直到 WASM 阶段超时。
- 对 `performance.renderQuality` 读取增加默认回退（`'high'`），避免异常持久化状态导致加载链路中断。
- 失败策略保持手动切换：不自动降级 Aladin，仅提供显式重试/手动引擎切换入口。

### 启动资源引导与降级恢复（实现参考）

- 启动会话与资源状态收敛：`lib/stores/starmap-bootstrap-store.ts`
- 引擎加载、阶段事件与降级终态：`lib/hooks/stellarium/use-stellarium-loader.ts`

维护建议：

- 若调整 bootstrap 资源分层或降级判定，需同步更新本节描述与 `docs/reference/documentation-implementation-alignment.md`。
- 若新增失败阶段或恢复策略，需补充对应测试/验证入口。

## 核心设置映射

`lib/stores/stellarium-store.ts` 中 `updateStellariumCore` 已拆分为原子能力函数：

- `applyCoreRendering`
- `applyConstellations`
- `applyGridLines`
- `applyLandscapeAndFog`
- `applySurvey`
- `applyLocalization`

所有字段写入采用“能力探测 + 安全赋值”策略：

- 目标路径存在才写入
- 不存在仅记录一次 `debug` 诊断
- 不抛异常，不中断其他字段应用

## 投影与坐标链路

- 共享投影工具：`lib/core/stellarium-projection.ts`
- 正向（RA/Dec -> 屏幕）用于覆盖层：`lib/hooks/use-coordinate-projection.ts`
- 反向（屏幕 -> RA/Dec）用于右键坐标：`lib/hooks/stellarium/use-click-coordinates.ts`

已覆盖投影值：`0,1,2,3,4,5,7,8,9,10`。

## 高级能力 Hook

- `useStellariumCalendar`
- `useStellariumFonts`
- `useStellariumLayerApi`
- `useStellariumValueWatch`

这些 Hook 封装 `calendar / setFont / createLayer-createObj-geojson / onValueChanged`。

## 双引擎边界

- Stellarium：完整能力优先实现。
- Aladin：保持最小共享交集，不强行模拟 Stellarium 专有行为。
