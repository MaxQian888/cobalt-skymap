# 文档-实现对齐矩阵

本文档用于维护“文档描述 ⇄ 实现入口 ⇄ 验证证据”的追溯关系，避免文档与代码长期漂移。

## 1. 过时标识盘点（任务 1.1）

在本次对齐前，仓库文档中存在以下高频过时标识：

- 产品名占位：`SkyMap {legacy-test-name}`
- 仓库名占位：`{legacy-repo-name}`
- 组织/用户名占位：`{legacy-username-placeholder}`（含大小写变体）

典型出现位置（盘点样例）：

- `docs/mkdocs.yml`（站点名、repo_url、社交链接）
- `docs/deployment/index.md`（克隆命令、部署路径、更新地址）
- `docs/developer-guide/index.md`（克隆命令、Issue/Discussions 链接）
- `docs/user-guide/index.md`（社区支持链接）
- `docs/reference/faq.md`（Issue 与 Discussions 链接）

## 2. 核心能力映射（任务 1.2）

| 能力域 | 文档锚点 | 实现入口（真相源） |
| --- | --- | --- |
| Starmap 启动引导与降级恢复 | `docs/developer-guide/core-modules/starmap-core.md` | `lib/stores/starmap-bootstrap-store.ts`、`lib/hooks/stellarium/use-stellarium-loader.ts` |
| 缓存策略与诊断（unified/offline） | `docs/user-guide/offline/index.md` | `lib/cache/integration-policy.ts`、`src-tauri/src/cache/offline.rs`、`src-tauri/src/cache/unified.rs` |
| 在线解板与赤道仪控制链路 | `docs/developer-guide/apis/backend-apis/tauri-commands.md` | `src-tauri/src/platform/plate_solver/online.rs`、`src-tauri/src/mount/commands.rs` |
| Daily Knowledge 多源与回退 | `docs/developer-guide/daily-knowledge-data-guidelines.md` | `lib/services/daily-knowledge/service.ts`、`components/starmap/knowledge/daily-knowledge-dialog.tsx` |
| 文档维护总则（本文件） | `docs/reference/documentation-implementation-alignment.md` | `openspec/changes/improve-existing-project-documentation-alignment/*` |

## 3. 最小验证入口（任务 1.3）

| 能力域 | 最小验证命令 / 证据入口 |
| --- | --- |
| Starmap 启动引导与降级恢复 | `pnpm test -- --runInBand tests/e2e/starmap/error-recovery.spec.ts` |
| 缓存策略与诊断 | `pnpm test -- --runInBand lib/cache/__tests__/integration-policy.test.ts` |
| Daily Knowledge 多源与回退 | `pnpm test -- --runInBand tests/e2e/starmap/daily-knowledge.spec.ts` |
| 在线解板与 mount 控制 | `pnpm test -- --runInBand lib/stores/__tests__/plate-solver-store.test.ts components/starmap/mount/__tests__/mount-connection-dialog.test.tsx` |

## 4. 维护准则（任务 3.5）

- 任何涉及能力行为变更的 PR，必须同步更新对应文档锚点与本矩阵。
- 文档新增“能力说明”时，必须至少引用一个实现入口文件。
- 文档新增“可用性/回退/降级”描述时，必须补充对应验证入口。
- 发布前执行关键关键词扫描，确保无占位标识残留：
  - `SkyMap {legacy-test-name}`
  - `{legacy-repo-name}`
  - `{legacy-username-placeholder}`
