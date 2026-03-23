# GitHub Release 自动更新设计

## 背景与现状

- 项目已经具备一条“看起来完整、实际上未打通”的自动更新链路：
  - 前端已有更新设置、更新弹窗、下载进度和跳过版本状态。
  - Rust 后端已有 `check_for_update`、`download_update`、`install_update`、`download_and_install_update` 命令。
  - Zustand 已有 `useUpdaterStore` 保存更新状态。
- 当前真正阻断自动更新落地的点有四个：
  1. `src-tauri/src/lib.rs` 中没有注册 `tauri_plugin_updater`。
  2. `src-tauri/tauri.conf.json` 没有配置 updater endpoint / pubkey。
  3. `bundle.createUpdaterArtifacts` 仍为 `false`，发布产物不会生成 updater 所需工件。
  4. GitHub Actions 目前只上传安装包到 draft release，没有上传 `latest.json`、签名文件和 updater payload。
- 另外，前端还有一个会影响错误呈现的实现缺口：
  - `lib/tauri/updater-api.ts` 会把安装失败包装成 `{ status: 'error' }` 返回；
  - `lib/tauri/updater-hooks.ts` 的 `installUpdate` / `downloadAndInstall` 却只捕获异常，不消费返回的错误状态；
  - 结果是安装失败时，UI 可能不会正确进入错误态。

## 设计目标

- 支持桌面端从 GitHub Release 检测新版本。
- 检测到新版本后，在应用内展示版本号、发布日期、更新说明。
- 优先走应用内下载与安装，不把“跳转 Releases 页面”作为主流程。
- 保持现有更新设置、更新弹窗和 Zustand store 的主体结构不变。
- 让发布流水线稳定产出 Tauri updater 所需的 GitHub Release 附件。
- 在网络、配置、签名或平台产物缺失时，给出明确错误并允许用户打开 Releases 页面手动更新。

## 非目标

- 不为 Web 版本增加自动更新。
- 不新增独立的 GitHub API 检测服务层。
- 不引入 prerelease / nightly / 多渠道更新策略。
- 不解决证书申请、Apple notarization、Windows 代码签名采购等组织流程问题。
- 不重做整个更新 UI，只增强现有 `UpdateDialog` 与 `UpdateSettings`。

## 方案评估

### 方案 A：只检测 GitHub 最新 Release，然后跳转浏览器下载

优点：

- 实现最简单。
- 不需要 updater 签名链路。

缺点：

- 不能复用现有 Rust updater 命令的主体能力。
- 用户体验退化为“只是提醒”，不是真自动更新。
- 现有下载进度、重启安装、跳过版本等逻辑价值大幅下降。

### 方案 B：Tauri 原生 updater + GitHub Releases 托管静态 `latest.json`（采用）

优点：

- 与现有前端/后端更新代码最契合。
- 版本比较、平台匹配、下载和安装都交给 Tauri 官方 updater 处理。
- 安全边界清晰，可使用签名校验。
- GitHub Releases 继续作为唯一发布源，运维成本低。

缺点：

- 需要补齐公私钥、updater artifacts、`latest.json` 和 CI 流程。
- 发布规范需要更严格，不能只上传普通安装包。

### 方案 C：GitHub API 检测 + Tauri updater 安装

优点：

- 可直接读取 GitHub Release 的 metadata。
- 检测逻辑可定制性更高。

缺点：

- 检测源和安装源分裂，容易出现状态漂移。
- 复杂度高于当前需求，不符合 YAGNI。

## 选型结论

本次采用方案 B：

- GitHub Releases 作为唯一发布源。
- 客户端只读取 GitHub Release 上的静态 updater 清单 `latest.json`。
- 应用内更新逻辑继续通过 `tauri_plugin_updater` 完成，不新增第二套 Release API 解析逻辑。
- GitHub Releases 页面仅作为错误态 fallback。

## 架构设计

### 1. 运行时架构

运行时链路保持三层：

- 前端 UI：`components/starmap/management/updater/*`
- 前端编排层：`lib/tauri/updater-hooks.ts`
- 桌面后端：`src-tauri/src/platform/updater.rs` + `tauri_plugin_updater`

数据流如下：

1. 用户点击“检查更新”，或开启 `check_updates` 后由启动/定时器触发检查。
2. `useUpdater` 调用 `check_for_update`。
3. Rust 侧通过 `tauri_plugin_updater` 拉取 `latest.json`，比较当前版本和目标平台。
4. 若有更新，则返回版本信息、发布日期、更新说明。
5. 用户点击“立即更新”后，Rust 下载 updater payload，发出 `update-progress` 事件。
6. 下载完成后安装，并重启应用。

### 2. 发布源架构

- GitHub Release 附件中必须包含：
  - 平台安装包（MSI / NSIS / DMG / AppImage / deb 等）
  - updater payload（由 Tauri 生成）
  - 与 updater payload 对应的 `.sig`
  - `latest.json`
- 客户端 endpoint 固定指向：
  - `https://github.com/ElementAstro/cobalt-skymap/releases/latest/download/latest.json`
- 这样可避免直接请求 GitHub Releases API，也避免自己解析 HTML 或分页接口。

### 3. 文档与版本源

- 版本号在发布前必须保持一致：
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`
  - Git tag（例如 `v0.2.0`）
- `latest.json` 中的更新说明优先来自 `CHANGELOG.md` 中对应版本条目，避免依赖 GitHub 在 release 创建后才生成的 notes。

## 详细设计

### 1. Tauri 运行时

- 在 `src-tauri/src/lib.rs` 中正式注册 `tauri_plugin_updater::Builder::new().build()`。
- 保留 `src-tauri/src/platform/updater.rs` 中现有命令接口，避免前端调用面变化。
- 为检查、下载和安装阶段增加一致的错误归一化逻辑，把底层含糊错误转成用户可理解的错误类别：
  - 更新服务未配置
  - 网络错误 / 连接超时
  - 当前平台缺少更新包
  - 签名校验失败
  - 下载或安装失败
- 这些错误仍可序列化为字符串返回前端，避免扩大 IPC 类型变更范围。

### 2. Tauri 配置

- 在 `src-tauri/tauri.conf.json` 中：
  - 将 `bundle.createUpdaterArtifacts` 改为 `true`
  - 增加 `plugins.updater.endpoints`
  - 增加 `plugins.updater.pubkey`
- `pubkey` 必须使用项目真实 updater 公钥，不能留占位字符串。
- 因为配置文件是 JSON，不适合放注释，所以需要在发布文档中明确说明公钥来源和维护方式。

### 3. 前端状态与 UI

- 保持 `useUpdater` 作为唯一更新编排层。
- 修复 `downloadAndInstall` / `installUpdate` 对错误状态返回值未消费的问题，确保安装失败能够进入 `error`。
- `UpdateDialog` 在错误态下区分两种场景：
  - 可重试的临时错误：显示“重试”
  - 不可自动恢复的配置/签名/平台错误：额外显示“打开 Releases 页面”
- fallback 行为复用已有 `openExternalUrl` 和 `EXTERNAL_LINKS.releases`，不重复造轮子。
- i18n 增加以下文案：
  - 打开 Releases
  - 手动下载安装
  - 更新服务不可用
  - 当前平台暂无自动更新包
  - 签名校验失败

### 4. 自动检查策略

- 继续沿用 `check_updates` 作为自动检查总开关。
- 继续使用现有 `useUpdater({ autoCheck: true })` 定时逻辑，不引入新的轮询器。
- 已跳过版本仍保留在 `useUpdaterStore` 中。
- 当检查到比 `skippedVersion` 更高的新版本时，重新提示更新。

### 5. Release Manifest 生成

- 为尽量少改现有 CI，保留 `.github/workflows/ci.yml` 作为主工作流。
- 新增一个小型脚本，负责从构建产物和 `CHANGELOG.md` 生成 `latest.json`。
- 脚本职责：
  - 扫描 release artifacts 目录
  - 识别各平台 updater payload 及其 `.sig`
  - 将 GitHub Release 下载 URL 拼装为 `latest.json` 里的 `url`
  - 从 `CHANGELOG.md` 中抽取当前版本的说明填入 `notes`
  - 输出符合 Tauri static JSON 规范的 `latest.json`
- 这样可以继续使用现有 `softprops/action-gh-release`，不需要重写整套发布工作流。

### 6. GitHub Actions 发布流

- `build-tauri` 作业在 tag 构建时需要注入：
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- 现有 artifact 上传步骤要补充：
  - updater payload
  - `.sig`
- `create-release` 作业在下载 artifacts 后：
  1. 运行 manifest 脚本生成 `artifacts/latest.json`
  2. 将 `latest.json`、payload、签名和安装包一起上传到 GitHub Release
- 发布策略保持：
  - Git tag 触发构建
  - 自动创建 draft release
  - 人工确认后 publish
- 客户端只检测已发布 release，因此 draft 阶段不会提前推送给用户。

## 错误处理与降级策略

### 错误分类

- **配置错误**：缺少 updater endpoint、公钥无效、manifest 缺失
- **网络错误**：超时、GitHub 不可达、临时 5xx
- **平台错误**：当前平台没有可用 payload
- **安全错误**：签名校验失败
- **安装错误**：下载损坏、安装阶段失败、重启前失败

### 前端处理

- 配置错误 / 平台错误 / 安全错误：
  - 展示明确文案
  - 展示“打开 Releases 页面”
- 网络错误：
  - 展示“重试”
  - 不误报“当前已是最新版本”
- 下载错误：
  - 清理 pending update
  - 允许重新检查

### 用户体验规则

- “无更新”与“检查失败”必须清晰区分。
- 不允许把“manifest 拉取失败”显示成“已是最新版本”。
- 签名失败时严禁自动安装，只允许手动跳转。

## 测试策略

### 前端测试

- `lib/tauri/__tests__/updater-hooks.test.ts`
  - 覆盖 `downloadAndInstallUpdate` 返回 error status 的场景
  - 覆盖跳过旧版本后发现更高版本重新提示
  - 覆盖配置错误 / 平台错误的状态分流
- `components/starmap/management/updater/__tests__/update-dialog.test.tsx`
  - 覆盖错误态下显示“打开 Releases 页面”
  - 覆盖点击 fallback 按钮调用 `openExternalUrl`

### Rust 测试

- 在 `src-tauri/src/platform/updater.rs` 增加 `#[cfg(test)]`：
  - 覆盖错误分类函数
  - 覆盖配置错误、签名错误、平台错误的消息归一化

### Release Manifest 测试

- 为 manifest 脚本增加单元测试，覆盖：
  - 平台 payload 匹配
  - `.sig` 绑定
  - GitHub 下载 URL 拼接
  - `CHANGELOG.md` 版本段提取
  - 缺失 changelog 条目时失败

## 风险与准备项

- 项目必须先生成一对 updater signing key：
  - 私钥进入 GitHub Actions secrets
  - 公钥写入 `tauri.conf.json`
- 如果某平台缺少签名或 updater payload，该平台自动更新应降级为手动下载，而不是让所有平台一起失效。
- `CHANGELOG.md` 需要在每次发版前维护对应版本条目，否则 `latest.json` 无法稳定提供 notes。
- 当前仓库的版本信息和元数据仍带有模板残留（例如 `package.json.name`、`Cargo.toml.description`），发布前应一并校正。

## 验收标准

- 桌面端点击“检查更新”时，能够从 GitHub Release 检测到新版本。
- 更新弹窗能展示版本号、发布日期和更新说明。
- 用户可以在应用内下载并安装更新，安装后自动重启。
- 当出现配置错误、签名错误、平台缺失或网络问题时，能看到明确错误，并可打开 `GitHub Releases` 页面手动更新。
- GitHub Actions 在 tag 构建后，能够把安装包、updater payload、签名文件和 `latest.json` 一起上传到 draft release。
- 发布后的正式 Release 可被客户端稳定检测到，draft release 不会被客户端提前发现。

