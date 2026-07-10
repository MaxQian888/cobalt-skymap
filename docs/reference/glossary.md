# 术语表

本术语表解释天文学和软件开发中的专业术语。

## 天文学术语

### A

**ALPACA** — 天文设备通用控制架构（Astronomy Common Application Protocol），一种跨平台的望远镜与天文设备控制协议，基于 HTTP/REST 通信。

**Altitude（高度角）** — 天体相对于地平圈的角距离，从地平圈（0°）到天顶（+90°）或天底（-90°）。

**Apparent Magnitude（视星等）** — 天体在地球上的观测亮度。数值越小，天体越亮。

**AR Mode（增强现实模式）** — 将星图实时叠加到设备摄像头画面上，辅助现场寻星的功能。

**Azimuth（方位角）** — 从正北沿地平圈向东测量的角度，范围 0°-360°。

### C

**Celestial Sphere（天球）** — 以观测者为球心的假想球体，所有天体都投影在这个球面上。

**Circumpolar（拱极星）** — 对于特定观测者纬度永不落下（或永不升起）的天体。

**Coordinate System（坐标系）** — 用于描述天体位置的数学系统。Cobalt Skymap 支持地平、赤道、银河、黄道四种坐标系。

### D

**Declination（赤纬）** — 天体距离天赤道的角距离，向北为正，向南为负，范围 -90° 到 +90°。

**Deep Sky Object（深空天体）** — 除太阳系天体和恒星外的天体，如星云、星团、星系等。

**DSS（Digitized Sky Survey）** — 数字化巡天，Cobalt Skymap 支持的星图 survey 之一。

### E

**Ecliptic（黄道）** — 太阳在天球上的视运动路径，也是地球公转轨道面与天球的交线。

**EOP（Earth Orientation Parameters）** — 地球定向参数，包括极移和 UT1-UTC 差值，用于高精度坐标转换。

**Equatorial Coordinate System（赤道坐标系）** — 以天赤道为基准的坐标系，使用赤经和赤纬表示天体位置，是星表的标准坐标系。

**Extinction（消光）** — 星光穿过地球大气时被吸收和散射的现象。

**Exposure（曝光）** — 相机传感器接收光子的过程，曝光时间直接影响图像信噪比。

### F

**FOV（Field of View，视场）** — 望远镜或相机一次能观测到的天空区域大小，通常以度或角分表示。

**FITS（Flexible Image Transport System）** — 天文学标准图像格式，包含图像数据和头信息。

**Frame（参考架）** — 描述天体位置的坐标框架。Cobalt Skymap 使用 ICRF（国际天球参考架）、CIRS（天球中间参考系）和 OBSERVED（观测参考架）三级管线。

### H

**Horizontal Coordinate System（地平坐标系）** — 以观测者地平圈为基准的坐标系，使用方位角和高度角表示天体位置。

**Hour Angle（时角）** — 天体相对于子午圈的角距离，用于赤道仪跟踪和子午线翻转判断。

**HiPS（Hierarchical Progressive Survey）** — 分层渐进式 survey，Aladin 使用的高清天文图像格式。

### I

**ICRS（International Celestial Reference System）** — 国际天球参考系，现代天文学的标准惯性参考系。

### J

**Julian Day（儒略日）** — 从公元前 4713 年 1 月 1 日正午开始连续计数的天数，常用于天文计算。

### L

**Local Sidereal Time（地方恒星时）** — 观测者所在位置的恒星时，等于春分点的地方时角。

### M

**Meridian（子午线）** — 通过天顶、天底和天极的大圆。天体经过子午线时达到最高点（上中天）。

**Meridian Flip（子午线翻转）** — GEM（德式赤道仪）在天体经过子午线时为避免望远镜撞到立柱而进行的 180° 旋转操作。

**Messier Marathon（梅西耶马拉松）** — 在一个夜晚内观测全部 110 个梅西耶天体的挑战活动。

**Magnitude（星等）** — 天体亮度的度量。星等每差 1，亮度相差约 2.512 倍。

### N

**Nebula（星云）** — 宇宙中的云状结构，可以是气体、尘埃或恒星系统。

**Night Vision Mode（夜视模式）** — 红光滤镜界面模式，用于保护观测者的暗适应能力。

### P

**Plate Solving（解板）** — 将天文照片与星表匹配，确定照片精确坐标和旋转角的过程。

### R

**Right Ascension（赤经）** — 沿天赤道从春分点向东测量的角度，通常用时、分、秒表示，范围 0h-24h。

**Refraction（大气折射）** — 光线从太空进入地球大气时发生的偏折现象，使天体看起来比实际位置更高。

### S

**Seeing（视宁度）** — 大气湍流引起的星像抖动和模糊程度，影响观测质量。以角秒为单位，数值越小越好。

**Sidereal Time（恒星时）** — 以地球相对于恒星的自转为基准的时间系统。

**Slew（快速指向）** — 赤道仪从一个目标快速移动到另一个目标的操作。

**Sky Quality（天光质量）** — 观测地点的暗空程度，常用 Bortle 等级（1-9）或 SQM（天空质量计）读数表示。

### T

**Transit（中天）** — 天体经过观测者子午线的时刻，此时天体达到一天中的最高点。

**Twilight（曙暮光）** — 日出前和日落后的天空变亮现象，分为民用（-6°）、航海（-12°）和天文（-18°）三级。

**TT（Terrestrial Time，地球时）** — 用于行星历表计算的均匀时间尺度。

### U

**Universal Time（世界时）** — 基于地球自转的时间系统，相当于格林尼治平太阳时。

**UTC（协调世界时）** — 使用跳秒保持与世界时接近的原子时间标准。

### Z

**Zenith（天顶）** — 观测者正上方的点，高度角为 +90°。

**Zenith Distance（天顶距）** — 天体距离天顶的角距离，等于 90° 减去高度角。

## 开发术语

### 前端

**Component（组件）** — React 中的可复用 UI 单元。

**Hook（钩子）** — React 特性，允许在函数组件中使用状态和其他 React 功能。Cobalt Skymap 拥有 37+ 自定义 hooks。

**Store（存储）** — Zustand 中的状态管理单元。Cobalt Skymap 拥有 26+ stores。

**shadcn/ui** — 基于 Radix UI 的高质量无障碍组件库，Cobalt Skymap 的 UI 基础。

### 后端

**IPC Command（IPC 命令）** — 前端通过 Tauri IPC 调用的后端 Rust 函数。

**Tauri** — 使用 Web 技术构建轻量级桌面应用的框架，Cobalt Skymap 的桌面运行时。

### 安全

**Rate Limiting（速率限制）** — 限制单位时间内请求次数的安全机制，防止 API 滥用和资源耗尽。

**SSRF（Server-Side Request Forgery，服务端请求伪造）** — 攻击者诱使服务器向内部资源发起请求的安全漏洞。Cobalt Skymap 通过 URL 验证防止此类攻击。

**Secret Vault（密钥保险箱）** — 通过系统钥匙串安全存储 API 密钥等敏感凭证的机制。

**URL Validation（URL 验证）** — 验证 URL 安全性的机制，阻止访问私有 IP、localhost 和危险协议。

---

返回：[参考资料](index.md)
