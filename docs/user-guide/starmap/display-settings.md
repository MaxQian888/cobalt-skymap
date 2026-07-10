# 显示设置

本文档说明当前 Cobalt Skymap 星图界面的真实可用显示项（Stellarium 模式）。

## 入口

- 进入星图页后，打开设置面板。
- 在 `Display` 页签中调整相关选项。

## Stellarium 显示项

### 星座与标注

- 星座连线 `constellationsLinesVisible`
- 星座名称 `constellationLabelsVisible`
- 星座边界 `constellationBoundariesVisible`
- 星座艺术图 `constellationArtVisible`
- 恒星名称 `starLabelsVisible`
- 行星名称 `planetLabelsVisible`

### 网格与参考线

- 地平网格 `azimuthalLinesVisible`
- 赤道网格 `equatorialLinesVisible`
- JNow 赤道网格 `equatorialJnowLinesVisible`
- 子午线 `meridianLinesVisible`
- 黄道线 `eclipticLinesVisible`
- 地平线 `horizonLinesVisible`
- 银道线 `galacticLinesVisible`

### 天空与图层

- 大气 `atmosphereVisible`
- 地景 `landscapesVisible`
- 雾 `fogVisible`
- 深空天体 `dsosVisible`
- 银河 `milkyWayVisible`
- HiPS 巡天启用 `surveyEnabled`
- HiPS 巡天选择 `surveyId/surveyUrl`

### 渲染参数

- 光污染等级 `bortleIndex`
- 恒星线性尺寸 `starLinearScale`
- 恒星相对对比 `starRelativeScale`
- 星等上限 `displayLimitMag`
- 曝光倍率 `exposureScale`
- ToneMapper 参数 `tonemapperP`

### 投影与视图

- 投影类型 `projectionType`
- 视图 Y 偏移 `viewYOffset`
- 安装坐标系 `mountFrame`
- 垂直翻转 `flipViewVertical`
- 水平翻转 `flipViewHorizontal`
- 夜视模式 `nightMode`

### 本地化

- 天体名称语言 `skyCultureLanguage`

## 与 Aladin 的关系

- Aladin 仅实现最小共享交集（网格、十字准星、图像调节等）。
- Stellarium 专有项（如 `mountFrame`、`tonemapperP`、`equatorialJnow`）不强制映射到 Aladin。

## 持久化与迁移

- 设置存储键：`starmap-settings`
- 当前版本：`v10`
- 迁移策略：保留旧配置，仅为新增字段补默认值，不重置用户历史设置。
