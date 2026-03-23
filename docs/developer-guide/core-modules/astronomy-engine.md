# 天文计算引擎

本文档介绍 SkyMap 的天文计算模块。

## 概述

天文计算模块位于 `lib/astronomy/`，提供纯函数的天文计算能力，无副作用，便于测试和复用。

## 2026 架构更新（重要）

当前版本已引入“**高精度核心 + 实时轻量显示**”双层策略，并将坐标/时制计算统一到单一管线：

- `lib/astronomy/time-scales.ts`：UTC/UT1/TT 时间尺度上下文、EOP（ΔUT1）数据新鲜度、离线回退策略
- `lib/astronomy/frames.ts`：`ICRF` / `CIRS` / `OBSERVED` / `VIEW` 帧语义与归一化工具
- `lib/astronomy/pipeline.ts`：统一入口 `transformCoordinate()`，输出带元数据的坐标结果
- `lib/astronomy/engine/`：统一天文计算引擎（Tauri 优先 + `astronomy-engine` 回退）

### 坐标契约

- 经度采用 **东经为正**（East-positive）
- 方位角采用 **北=0°，东=90°**
- RA/Dec 结果必须附带：`frame`、`timeScale`、`qualityFlag`、`dataFreshness`、`epochJd`

### EOP 策略

- 默认策略：`auto_with_offline_fallback`
- 内置基线 EOP 数据始终可用（离线不失效）
- 网络可用时后台拉取更新；失败不阻塞功能
- 新鲜度分级：`fresh` / `stale` / `fallback`

## 模块结构

```
lib/astronomy/
├── index.ts                 # 模块入口
├── astro-utils.ts           # 通用天文工具
├── starmap-utils.ts         # 星图相关工具
├── time-scales.ts           # UTC/UT1/TT + EOP 管理
├── frames.ts                # 帧语义与元数据工具
├── pipeline.ts              # 统一坐标变换入口
├── engine/                  # 统一天文计算引擎
│   ├── index.ts             # getAstronomyEngine + 公开 API
│   ├── backend-tauri.ts     # 桌面 Tauri 后端
│   ├── backend-fallback.ts  # Web/离线回退后端
│   ├── cache.ts             # 结果缓存
│   └── types.ts             # 统一类型
├── coordinates/             # 坐标系统
│   ├── index.ts
│   ├── conversions.ts       # 坐标转换
│   ├── formats.ts           # 格式化
│   └── transforms.ts        # 坐标系变换
├── time/                    # 时间计算
│   ├── index.ts
│   ├── julian.ts            # 儒略日
│   ├── sidereal.ts          # 恒星时
│   └── formats.ts           # 时间格式化
├── celestial/               # 天体位置
│   ├── index.ts
│   ├── sun.ts               # 太阳位置
│   ├── moon.ts              # 月球位置和月相
│   └── separation.ts        # 角距离
├── twilight/                # 薄暮计算
│   ├── index.ts
│   └── calculator.ts        # 薄暮时间计算
├── visibility/              # 可见性计算
│   ├── index.ts
│   ├── altitude.ts          # 高度计算
│   ├── target.ts            # 目标可见性
│   └── circumpolar.ts       # 拱极判断
├── imaging/                 # 成像评估
│   ├── index.ts
│   ├── exposure.ts          # 曝光计算
│   ├── feasibility.ts       # 可行性评估
│   └── planning.ts          # 多目标规划
└── horizon/                 # 自定义地平线
    ├── index.ts
    └── custom-horizon.ts    # 地平线轮廓
```

## 曝光计算器双层模型（2026 更新）

`lib/astronomy/exposure-utils.ts` 现同时提供：

- **快速估算层**（兼容旧接口）  
  `calculateSNR()`、`calculateOptimalSubExposure()`、`estimateSessionTime()` 等函数保持不变。
- **专业计算层**（Smart Histogram 风格）  
  新增 `calculateSmartExposure(input)`，面向“读噪限制 + 天空背景 + 堆栈效率”联合优化。

### 新增核心类型

- `CameraNoiseProfile`：`readNoise` / `darkCurrent` / `fullWell` / `qe` / `bitDepth` / `ePerAdu`
- `SkyModelInput`：`bortle` / `sqm` / `filterBandwidthNm` / `skyFluxOverride`
- `SmartExposureInput`：`readNoiseLimitPercent` / `gainStrategy` / `minExposureSec` / `maxExposureSec`
- `SmartExposureResult`：推荐曝光、曝光区间、噪声构成、动态范围、约束命中与堆栈估计

### 关键公式（实现对应）

1. **读噪限制曝光（单帧）**

\[
t = \frac{RN^2}{SkyFlux \cdot ((1+r)^2 - 1)}
\]

- `RN`：读出噪声（e⁻）
- `SkyFlux`：天空背景信号率（e⁻/px/s）
- `r`：读噪容忍比例（默认 `0.05`，即 5%）

2. **单帧总噪声**

\[
\sigma = \sqrt{S + B + D + RN^2}
\]

- `S` 目标信号电子数，`B` 天空背景电子数，`D` 暗电流电子数

3. **堆栈提升**

- 总 SNR 随帧数按 `sqrt(N)` 增长
- 目标帧数估算使用：`N = ceil((target / perFrame)^2)`

4. **动态范围评分（相对）**

\[
DR \propto \frac{FullWell}{NoiseFloor}, \quad Stops = log_2(DR)
\]

### 默认值与边界

- `readNoiseLimitPercent` 默认 **5%**（主流 Smart Histogram 建议）
- 曝光限制默认：`minExposureSec=2`，`maxExposureSec=600`（无跟踪时受 500 规则上限约束）
- 带宽边界：`2 ~ 300nm`
- 所有新增输出通过 `ExposurePlan.advanced?` 传递，保持旧数据结构兼容。

### 兼容策略

- 旧调用方仍可只使用原始字段（`settings/totalExposure/...`）
- 新增高级结果仅在 `advanced` 可选字段中提供
- Tauri Rust 端通过 `Option<T> + #[serde(default)]` 保证历史 JSON 可反序列化。

## 坐标系统 (coordinates/)

### 坐标转换

```typescript
import {
  raDecToAltAz,
  raDecToAltAzAtTime,
  altAzToRaDec,
  altAzToRaDecAtTime,
  raDecToGalactic,
  galacticToRaDec,
  raDecToEcliptic,
  eclipticToRaDec,
} from '@/lib/astronomy';

// 赤道坐标转地平坐标
const { altitude, azimuth } = raDecToAltAzAtTime(
  ra,      // 赤经 (度)
  dec,     // 赤纬 (度)
  lat,     // 观测纬度
  lon,     // 观测经度
  date     // 观测时间
);

// 地平坐标转赤道坐标
const { ra, dec } = altAzToRaDecAtTime(altitude, azimuth, lat, lon, date);

// 赤道坐标转银道坐标
const { l, b } = raDecToGalactic(ra, dec);

// 赤道坐标转黄道坐标
const { longitude, latitude } = raDecToEcliptic(ra, dec, date);
```

## 统一引擎 API（新增）

```typescript
import {
  computeCoordinates,
  computeEphemeris,
  computeRiseTransitSet,
  searchPhenomena,
  computeAlmanac,
} from '@/lib/astronomy';

const coordinates = await computeCoordinates({
  coordinate: { ra: 10.684708, dec: 41.26875 },
  observer: { latitude: 39.9, longitude: 116.4 },
  date: new Date(),
});

const ephemeris = await computeEphemeris({
  body: 'Mars',
  observer: { latitude: 39.9, longitude: 116.4 },
  startDate: new Date(),
  stepHours: 1,
  steps: 24,
});
```

### 坐标格式化

```typescript
import {
  formatRA,
  formatDec,
  parseRA,
  parseDec,
  formatAltAz,
} from '@/lib/astronomy';

// 格式化赤经 (HMS)
formatRA(83.633);  // "05h 34m 32.0s"

// 格式化赤纬 (DMS)
formatDec(22.014); // "+22° 00' 50.4\""

// 解析赤经字符串
parseRA("05h 34m 32s");  // 83.633

// 解析赤纬字符串
parseDec("+22° 00' 50\""); // 22.014
```

## 时间计算 (time/)

### 儒略日

```typescript
import {
  dateToJD,
  jdToDate,
  getMJD,
  getJD2000,
} from '@/lib/astronomy';

// Date 转儒略日
const jd = dateToJD(new Date());

// 儒略日转 Date
const date = jdToDate(2460000.5);

// 修正儒略日 (MJD)
const mjd = getMJD(new Date());

// J2000.0 纪元儒略日
const jd2000 = getJD2000(); // 2451545.0
```

### 恒星时

```typescript
import {
  getGMST,
  getLMST,
  getApparentSiderealTime,
} from '@/lib/astronomy';

// 格林尼治平恒星时
const gmst = getGMST(date); // 小时

// 地方平恒星时
const lmst = getLMST(date, longitude); // 小时

// 视恒星时（考虑章动）
const ast = getApparentSiderealTime(date);
```

## 天体位置 (celestial/)

### 太阳位置

```typescript
import {
  getSunPosition,
  getSunRiseSet,
  getSolarNoon,
} from '@/lib/astronomy';

// 太阳位置
const { ra, dec, distance } = getSunPosition(date);

// 日出日落
const { rise, set } = getSunRiseSet(date, lat, lon);

// 正午时刻
const noon = getSolarNoon(date, lon);
```

### 月球位置和月相

```typescript
import {
  getMoonPosition,
  getMoonPhase,
  getMoonIllumination,
  getMoonRiseSet,
  getNextMoonPhases,
} from '@/lib/astronomy';

// 月球位置
const { ra, dec, distance, parallax } = getMoonPosition(date);

// 月相 (0-1)
const phase = getMoonPhase(date);
// 0 = 新月, 0.25 = 上弦, 0.5 = 满月, 0.75 = 下弦

// 月球亮度百分比
const illumination = getMoonIllumination(date); // 0-100%

// 月出月落
const { rise, set } = getMoonRiseSet(date, lat, lon);

// 未来月相
const phases = getNextMoonPhases(date, count);
// [{ date, phase: 'new'|'first'|'full'|'last' }, ...]
```

### 角距离

```typescript
import { angularSeparation } from '@/lib/astronomy';

// 计算两点角距离
const sep = angularSeparation(ra1, dec1, ra2, dec2);
// 返回角距离（度）
```

## 薄暮计算 (twilight/)

```typescript
import {
  calculateTwilightTimes,
  getTwilightType,
  isAstronomicalNight,
} from '@/lib/astronomy';

// 计算薄暮时间
const twilight = calculateTwilightTimes(date, lat, lon);

interface TwilightTimes {
  civilDawn: Date;        // 民用晨光始
  nauticalDawn: Date;     // 航海晨光始
  astronomicalDawn: Date; // 天文晨光始
  sunrise: Date;          // 日出
  sunset: Date;           // 日落
  civilDusk: Date;        // 民用昏影终
  nauticalDusk: Date;     // 航海昏影终
  astronomicalDusk: Date; // 天文昏影终
}

// 当前薄暮类型
const type = getTwilightType(date, lat, lon);
// 'day' | 'civil' | 'nautical' | 'astronomical' | 'night'

// 是否为天文夜间
const isNight = isAstronomicalNight(date, lat, lon);
```

## 可见性计算 (visibility/)

### 高度计算

```typescript
import {
  getAltitudeAtTime,
  getAltitudeOverTime,
  getMaxAltitude,
  getMinAltitude,
  getTimeAtAltitude,
} from '@/lib/astronomy';

// 指定时间的高度角
const alt = getAltitudeAtTime(ra, dec, lat, lon, date);

// 获取高度曲线数据（用于绘制高度图表）
const altitudeData = getAltitudeOverTime(ra, dec, lat, lon, 24, 30);
// 返回 Array<{ hour: number; altitude: number; azimuth: number }>

// 最高高度（在中天时）
const maxAlt = getMaxAltitude(dec, lat);

// 最低高度（拱极星的下中天）
const minAlt = getMinAltitude(dec, lat);

// 到达指定高度的时间
const riseTime = getTimeAtAltitude(ra, dec, lat, lon, 30, true, startDate);  // 上升
const setTime = getTimeAtAltitude(ra, dec, lat, lon, 30, false, startDate);  // 下降
```

### 目标可见性

```typescript
import {
  calculateTargetVisibility,
  getTransitTime,
} from '@/lib/astronomy';

// 完整可见性信息
const visibility = calculateTargetVisibility(
  ra, dec, lat, lon,
  30,        // 最低成像高度（默认30°）
  new Date() // 计算日期
);

interface TargetVisibility {
  riseTime: Date | null;          // 升起时间
  setTime: Date | null;           // 落下时间
  transitTime: Date;              // 中天时间
  transitAltitude: number;        // 中天高度
  isCurrentlyVisible: boolean;    // 当前是否可见
  isCircumpolar: boolean;         // 是否拱极
  neverRises: boolean;            // 是否永不升起
  imagingWindowStart: Date | null; // 成像窗口开始
  imagingWindowEnd: Date | null;   // 成像窗口结束
  imagingHours: number;           // 成像可用时长
  darkImagingStart: Date | null;  // 暗夜成像开始（天文昏影后）
  darkImagingEnd: Date | null;    // 暗夜成像结束（天文晨光前）
  darkImagingHours: number;       // 暗夜成像时长
}

// 中天时间
const { transitLST, hoursUntilTransit } = getTransitTime(ra, lon);
```

### 拱极判断

```typescript
import {
  isCircumpolar,
  neverRises,
  isAlwaysAbove,
  canReachAltitude,
  getVisibilityClass,
  getHoursAboveHorizon,
  getHoursAboveAltitude,
} from '@/lib/astronomy';

// 是否拱极（永不落下）
const circumpolar = isCircumpolar(dec, lat);

// 是否永不升起
const invisible = neverRises(dec, lat);

// 是否始终高于指定高度
const alwaysHigh = isAlwaysAbove(dec, lat, 30);

// 是否能够达到指定高度
const canReach = canReachAltitude(dec, lat, 60);

// 可见性分类
const visClass = getVisibilityClass(dec, lat);
// 返回 'circumpolar' | 'visible' | 'never_rises'

// 每天在地平线以上的时长
const hoursAbove = getHoursAboveHorizon(dec, lat); // 0-24 小时

// 每天高于某高度的时长
const imagingHours = getHoursAboveAltitude(dec, lat, 30); // 0-24 小时
```

### 可见性分析示例

```typescript
import {
  calculateTargetVisibility,
  getAltitudeOverTime,
  getVisibilityClass,
} from '@/lib/astronomy';

function analyzeTarget(target, location, date) {
  const { ra, dec } = target;
  const { lat, lon } = location;

  // 1. 基本可见性分类
  const visClass = getVisibilityClass(dec, lat);
  if (visClass === 'never_rises') {
    return { visible: false, reason: '该目标在当前纬度永远不可见' };
  }

  // 2. 详细可见性计算
  const visibility = calculateTargetVisibility(ra, dec, lat, lon, 30, date);

  // 3. 高度曲线（用于图表）
  const altitudeCurve = getAltitudeOverTime(ra, dec, lat, lon, 12, 15);

  // 4. 观测建议
  const recommendations = [];
  if (visibility.isCircumpolar) {
    recommendations.push('拱极目标，全夜可观测');
  }
  if (visibility.darkImagingHours > 4) {
    recommendations.push(`暗夜成像时间充足：${visibility.darkImagingHours.toFixed(1)} 小时`);
  }
  if (visibility.transitAltitude < 45) {
    recommendations.push('最大高度较低，注意大气消光影响');
  }

  return {
    visible: true,
    visibility,
    altitudeCurve,
    recommendations,
  };
}
```

## 成像评估 (imaging/)

### 曝光计算

```typescript
import {
  calculateExposure,
  calculateTotalIntegration,
  calculateSubframeCount,
  getImageScale,
  checkSampling,
  calculateFOV,
  formatExposureTime,
  getBortleExposureMultiplier,
} from '@/lib/astronomy';

// 计算推荐曝光时间
const exposure = calculateExposure({
  bortle: 6,          // 波特尔暗空等级 1-9
  focalLength: 800,   // 焦距 mm
  aperture: 200,      // 口径 mm
  pixelSize: 3.76,    // 像素尺寸 μm（可选）
  tracking: 'guided', // 'none' | 'basic' | 'guided'
});

interface ExposureResult {
  maxUntracked: number;      // 无跟踪最大曝光（秒）
  recommendedSingle: number; // 推荐单张曝光（秒）
  minForSignal: number;      // 最小信号曝光（秒）
}

// 计算总积分时间
const integration = calculateTotalIntegration({
  bortle: 6,
  targetType: 'galaxy', // 'galaxy' | 'nebula' | 'cluster' | 'planetary'
  isNarrowband: false,  // 窄带成像
});

interface IntegrationResult {
  minimum: number;    // 最少分钟
  recommended: number; // 推荐分钟
  ideal: number;       // 理想分钟
}

// 计算所需张数
const frameCount = calculateSubframeCount(180, 120); // 总分钟, 单张秒数

// 计算像素比例 (arcsec/pixel)
const imageScale = getImageScale(800, 3.76); // 焦距mm, 像素μm

// 检查采样是否合适
const sampling = checkSampling(imageScale, 2.5); // 像素比例, 视宁度
// 返回 'undersampled' | 'optimal' | 'oversampled'

// 计算视场 (度)
const fovX = calculateFOV(23.5, 800); // 传感器宽度mm, 焦距mm
const fovY = calculateFOV(15.6, 800); // 传感器高度mm, 焦距mm

// 格式化曝光时间
formatExposureTime(0.5);    // "500ms"
formatExposureTime(30);     // "30s"
formatExposureTime(180);    // "3m 0s"
formatExposureTime(7200);   // "2h 0m"
```

### 可行性评估

```typescript
import {
  calculateImagingFeasibility,
  shouldImage,
  rankTargets,
} from '@/lib/astronomy';

// 完整可行性评估
const feasibility = calculateImagingFeasibility(
  ra, dec,          // 目标坐标
  latitude, longitude, // 观测位置
  30,               // 最低成像高度
  new Date()        // 评估日期
);

interface ImagingFeasibility {
  score: number;         // 总分 0-100
  moonScore: number;     // 月亮评分
  altitudeScore: number; // 高度评分
  durationScore: number; // 时长评分
  twilightScore: number; // 薄暮评分
  recommendation: 'excellent' | 'good' | 'fair' | 'poor' | 'not_recommended';
  warnings: string[];    // 警告信息
  tips: string[];        // 建议提示
}

// 评分标准
// - excellent: score >= 80
// - good:      score >= 60
// - fair:      score >= 40
// - poor:      score >= 20
// - not_recommended: score < 20

// 简单判断是否适合成像
const canImage = shouldImage(ra, dec, lat, lon, 40); // 最低分数阈值

// 多目标排名
const rankings = rankTargets(
  [
    { id: 'M31', ra: 10.68, dec: 41.27 },
    { id: 'M42', ra: 83.82, dec: -5.39 },
    { id: 'M101', ra: 210.8, dec: 54.35 },
  ],
  latitude, longitude, new Date()
);
// 返回按分数排序的数组
```

### 成像规划示例

```typescript
import {
  calculateExposure,
  calculateTotalIntegration,
  calculateImagingFeasibility,
  calculateTargetVisibility,
} from '@/lib/astronomy';

function planImagingSession(target, equipment, location, date) {
  const { ra, dec, magnitude, type } = target;
  const { focalLength, aperture, pixelSize, tracking } = equipment;
  const { lat, lon, bortle } = location;

  // 1. 检查可行性
  const feasibility = calculateImagingFeasibility(ra, dec, lat, lon, 30, date);
  if (feasibility.recommendation === 'not_recommended') {
    return { success: false, reason: feasibility.warnings.join('; ') };
  }

  // 2. 计算可见性窗口
  const visibility = calculateTargetVisibility(ra, dec, lat, lon, 30, date);

  // 3. 计算曝光参数
  const exposure = calculateExposure({
    bortle, focalLength, aperture, pixelSize, tracking,
  });

  // 4. 计算总积分时间
  const integration = calculateTotalIntegration({
    bortle,
    targetType: type,
    isNarrowband: false,
  });

  // 5. 检查是否有足够时间
  const availableMinutes = visibility.darkImagingHours * 60;
  const canComplete = availableMinutes >= integration.minimum;

  // 6. 计算所需张数
  const frameCount = calculateSubframeCount(
    Math.min(availableMinutes, integration.recommended),
    exposure.recommendedSingle
  );

  return {
    success: canComplete,
    feasibility,
    visibility,
    exposure: {
      single: exposure.recommendedSingle,
      total: Math.min(availableMinutes, integration.recommended),
      frames: frameCount,
    },
    schedule: {
      start: visibility.darkImagingStart,
      end: visibility.darkImagingEnd,
      bestTime: visibility.transitTime,
    },
    tips: feasibility.tips,
    warnings: feasibility.warnings,
  };
}
```

## 自定义地平线 (horizon/)

```typescript
import {
  loadHorizonProfile,
  getHorizonAltitude,
  isAboveHorizon,
} from '@/lib/astronomy';

// 加载地平线轮廓
const horizon = loadHorizonProfile(profileData);
// profileData: Array<{ azimuth: number, altitude: number }>

// 获取指定方位的地平线高度
const horizonAlt = getHorizonAltitude(horizon, azimuth);

// 判断目标是否在地平线之上
const above = isAboveHorizon(horizon, alt, az);
```

## 使用示例

### 完整观测规划流程

```typescript
import {
  calculateTwilightTimes,
  calculateVisibility,
  getMoonPhase,
  assessImagingFeasibility,
} from '@/lib/astronomy';

async function planObservation(target, location, date) {
  // 1. 获取薄暮时间
  const twilight = calculateTwilightTimes(date, location.lat, location.lon);

  // 2. 计算目标可见性
  const visibility = calculateVisibility(
    target.ra,
    target.dec,
    location.lat,
    location.lon,
    date
  );

  // 3. 检查月相
  const moonPhase = getMoonPhase(date);
  const moonIllumination = getMoonIllumination(date);

  // 4. 评估成像可行性
  const assessment = assessImagingFeasibility({
    target,
    equipment: myEquipment,
    conditions: {
      moonPhase,
      skyQuality: 'suburban',
    },
  });

  return {
    twilight,
    visibility,
    moonPhase,
    moonIllumination,
    assessment,
  };
}
```

## 测试

天文计算模块有完整的单元测试覆盖：

```bash
# 运行天文计算测试
pnpm test lib/astronomy

# 运行特定子模块测试
pnpm test lib/astronomy/coordinates
pnpm test lib/astronomy/visibility
```

## 精度说明

- **坐标转换**: 精度约 1 角秒
- **时间计算**: 精度约 1 秒
- **太阳/月球位置**: 精度约 1 角分
- **升落时间**: 精度约 1 分钟

## 相关文档

- [星图核心](starmap-core.md) - 星图渲染核心
- [Tauri 天文 API](../apis/backend-apis/tauri-commands.md#天文计算-api) - 后端天文计算

---

返回：[核心模块](index.md)

