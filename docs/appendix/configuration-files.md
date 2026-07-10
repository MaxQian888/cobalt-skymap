# 配置文件说明

本文档说明 Cobalt Skymap 使用的配置文件格式和位置。

## 配置文件位置

### Windows

```
C:\Users\<用户名>\AppData\Roaming\Cobalt SkymapTest\
├── config.json           # 主配置文件
├── equipment.json        # 设备配置
├── locations.json        # 位置数据
└── targets.json          # 目标列表
```

### macOS

```
~/Library/Application Support/Cobalt SkymapTest/
├── config.json
├── equipment.json
├── locations.json
└── targets.json
```

### Linux

```
~/.config/Cobalt SkymapTest/
├── config.json
├── equipment.json
├── locations.json
└── targets.json
```

## 主配置文件 (config.json)

```json
{
  "version": "1.0.0",
  "settings": {
    "location": {
      "latitude": 39.9042,
      "longitude": 116.4074,
      "altitude": 50,
      "timezone": "Asia/Shanghai",
      "name": "北京"
    },
    "display": {
      "theme": "dark",
      "magnitudeLimit": 6.0,
      "starSize": 1.0,
      "constellationLines": true,
      "constellationBoundaries": false,
      "constellationLabels": true,
      "coordinateGrid": "equatorial",
      "landscape": true
    },
    "time": {
      "mode": "realtime",
      "timezone": "local",
      "autoAdvance": false,
      "advanceSpeed": 1
    },
    "language": "zh-CN",
    "units": {
      "angle": "degrees",
      "distance": "lightYears",
      "temperature": "celsius"
    }
  }
}
```

### 配置项说明

#### location (位置设置)

- `latitude`: 纬度（-90 到 +90）
- `longitude`: 经度（-180 到 +180）
- `altitude`: 海拔高度（米）
- `timezone`: 时区标识符
- `name`: 位置名称

#### display (显示设置)

- `theme`: 主题（"light", "dark", "auto"）
- `magnitudeLimit`: 星等限制（0 到 15）
- `starSize`: 恒星显示大小倍数
- `constellationLines`: 是否显示星座连线
- `constellationBoundaries`: 是否显示星座边界
- `constellationLabels`: 是否显示星座标签
- `coordinateGrid`: 坐标网格类型
- `landscape`: 是否显示地平线

#### time (时间设置)

- `mode`: 时间模式（"realtime", "manual", "simulation"）
- `timezone`: 时区
- `autoAdvance`: 是否自动前进时间
- `advanceSpeed`: 前进速度倍数

## 设备配置文件 (equipment.json)

```json
{
  "telescopes": [
    {
      "id": "tele-001",
      "name": "Celestron 8SE",
      "type": "schmidt-cassegrain",
      "aperture": 203,
      "focalLength": 2032,
      "isDefault": true
    }
  ],
  "cameras": [
    {
      "id": "cam-001",
      "name": "ZWO ASI294MC",
      "sensorWidth": 23.2,
      "sensorHeight": 15.4,
      "pixelWidth": 4.63,
      "pixelHeight": 4.63,
      "maxGain": 450,
      "isDefault": true
    }
  ],
  "profiles": [
    {
      "id": "prof-001",
      "name": "默认配置",
      "telescopeId": "tele-001",
      "cameraId": "cam-001",
      "filters": []
    }
  ]
}
```

## 位置配置文件 (locations.json)

```json
{
  "current": "loc-001",
  "locations": [
    {
      "id": "loc-001",
      "name": "北京",
      "latitude": 39.9042,
      "longitude": 116.4074,
      "altitude": 50,
      "timezone": "Asia/Shanghai",
      "lightPollution": "Bortle 8"
    }
  ]
}
```

## 目标列表文件 (targets.json)

```json
{
  "lists": [
    {
      "id": "list-001",
      "name": "今晚目标",
      "created": "2024-12-25T10:00:00Z",
      "targets": [
        {
          "id": "tgt-001",
          "objectId": "M31",
          "name": "仙女座星系",
          "priority": "high",
          "status": "pending",
          "notes": "最佳观测时间：23:00-01:00"
        }
      ]
    }
  ]
}
```

## 缓存配置

缓存数据保存在：

### Windows

```
C:\Users\<用户名>\AppData\Local\Cobalt SkymapTest\cache\
```

### macOS

```
~/Library/Caches/Cobalt SkymapTest/
```

### Linux

```
~/.cache/Cobalt SkymapTest/
```

## 日志文件位置

### Windows

```
C:\Users\<用户名>\AppData\Roaming\Cobalt SkymapTest\logs\
```

### macOS

```
~/Library/Logs/Cobalt SkymapTest/
```

### Linux

```
~/.local/state/Cobalt SkymapTest/logs/
```

## 配置文件备份

### 自动备份

应用自动备份配置文件：

- 备份频率：每周
- 保留数量：5个
- 备份位置：配置文件同目录的 `backups/` 文件夹

### 手动备份

```bash
# Windows
copy C:\Users\<用户名>\AppData\Roaming\Cobalt SkymapTest D:\Backup

# macOS/Linux
cp -r ~/Library/Application\ Support/Cobalt SkymapTest ~/Backup
```

### 导入配置

1. 打开设置 > 数据管理
2. 点击"导入配置"
3. 选择备份文件
4. 确认导入

## 配置文件验证

### 语法检查

配置文件使用JSON格式，确保：

1. JSON语法正确
2. 所有引号匹配
3. 逗号位置正确
4. 无多余逗号

### 在线验证

使用在线JSON验证工具：
- https://jsonlint.com/
- https://www.json.cn/

## 配置文件版本

配置文件包含版本号：

```json
{
  "version": "1.0.0",
  "minVersion": "1.0.0"
}
```

版本不兼容时，应用会自动迁移。

## 故障排除

### 配置文件损坏

如果配置文件损坏：

1. 关闭应用
2. 删除或重命名配置文件
3. 重启应用（将创建默认配置）
4. 重新配置应用

### 配置不生效

1. 检查JSON语法
2. 确认配置项名称正确
3. 重启应用
4. 查看日志文件

---

返回：[附录](index.md)

