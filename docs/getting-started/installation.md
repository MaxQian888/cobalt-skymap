# 安装指南

本文档详细说明如何在不同操作系统上安装和配置 SkyMap。

## 系统要求

### Windows

- Windows 10 或更高版本（64 位）
- 至少 4GB 内存
- 500MB 可用磁盘空间

### macOS

- macOS 10.15 (Catalina) 或更高版本
- Intel 或 Apple Silicon 处理器
- 至少 4GB 内存
- 500MB 可用磁盘空间

### Linux

- 主流 Linux 发行版（Ubuntu 20.04+、Fedora 33+ 等）
- 至少 4GB 内存
- 500MB 可用磁盘空间

## 安装方式

### 方式一：下载预编译版本（推荐）

#### Windows

1. 访问 [Releases 页面](https://github.com/ElementAstro/cobalt-skymap/releases)
2. 下载 `.msi` 安装程序
3. 双击运行安装程序
4. 按照安装向导完成安装

#### macOS

1. 访问 [Releases 页面](https://github.com/ElementAstro/cobalt-skymap/releases)
2. 下载 `.dmg` 文件
3. 打开 DMG 文件
4. 将 SkyMap 拖拽到 Applications 文件夹

#### Linux

1. 访问 [Releases 页面](https://github.com/ElementAstro/cobalt-skymap/releases)
2. 下载 `.AppImage` 文件
3. 添加执行权限：

```bash
chmod +x SkyMap-*.AppImage
```

4. 运行：

```bash
./SkyMap-*.AppImage
```

### 方式二：从源代码构建

如果您想从源代码构建，请参考[构建指南](../deployment/desktop/building.md)。

## 自动更新

桌面版本支持从 GitHub Releases 检测正式发布的更新：

- 可在设置中手动点击「检查更新」
- 开启「自动更新」后，应用启动时会自动检查
- 只有已 publish 的 release 会被检测到，draft release 不会推送给客户端
- 如果自动更新不可用，应用会提供打开 GitHub Releases 页面手动下载的链接

## 初次运行

### 首次启动

首次启动 SkyMap 时，应用会引导您完成初始配置：

1. **设置观测位置**
   - 输入您的经纬度坐标
   - 或从预设城市列表中选择
   - 使用 Leaflet 地图选择器点击定位
   - 设置时区

2. **配置显示选项**
   - 选择默认星图 survey（DSS、SDSS 等）
   - 设置星等限制
   - 配置星座连线的显示
   - 选择界面语言（中文/英文）

3. **下载基础数据**
   - 应用会自动下载基础星表数据
   - 下载大小约 100MB
   - 下载完成后即可正常使用

### 验证安装

安装完成后，您应该能够：

1. 启动应用程序
2. 看到星图界面
3. 通过鼠标拖动旋转星图
4. 搜索并定位天体
5. 切换 Stellarium / Aladin Lite 双引擎

## 卸载

### Windows

1. 打开「控制面板」>「程序和功能」
2. 找到 SkyMap
3. 右键点击 >「卸载」

### macOS

1. 打开 Applications 文件夹
2. 将 SkyMap 拖到废纸篓
3. 清空废纸篓

### Linux

删除 AppImage 文件即可，如需清理配置数据：

```bash
rm -rf ~/.config/SkyMapTest
```

## 常见安装问题

### Windows: "Windows 保护了你的电脑"

这是 Windows SmartScreen 的警告。点击「更多信息」>「仍要运行」即可。

### macOS: "无法打开，因为无法验证开发者"

1. 打开「系统偏好设置」>「安全性与隐私」
2. 在「通用」选项卡中，点击「仍要打开」

### Linux: 缺少依赖

某些 Linux 发行版可能需要安装额外的依赖库：

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential

# Fedora
sudo dnf install webkit2gtk3-devel openssl-devel
```

详情请参考[故障排除](../reference/faq.md)。

## 下一步

安装完成后，请查看[首次运行配置](first-run.md)了解如何配置应用程序。

## 相关文档

- [开发环境搭建](../developer-guide/development-environment/setup.md)
- [构建指南](../deployment/desktop/building.md)
- [故障排除](../reference/faq.md)
