# Web 部署

Cobalt Skymap 支持作为静态 Web 应用部署，便于在浏览器中预览核心功能。

## 构建静态站点

```bash
pnpm build
```

输出到 `out/` 目录。Next.js 以静态导出模式运行，`output: "export"` 在 `next.config.ts` 中配置。

## 部署平台

### Vercel（推荐）

1. 推送代码到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. Vercel 自动检测 Next.js 并配置
4. 点击部署

### Netlify

1. 推送代码到 GitHub
2. 在 [Netlify](https://netlify.com) 导入项目
3. 配置构建设置：
   - 构建命令: `pnpm build`
   - 发布目录: `out`
4. 点击部署

### 自托管

#### Nginx 配置

```nginx
server {
    listen 80;
    server_name skymap.example.com;
    root /var/www/cobalt-skymap/out;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## 注意事项

Web 部署不包含以下桌面专属功能：

- Tauri IPC 调用（文件存储、系统通知等）
- 离线瓦片缓存
- ALPACA 赤道仪控制
- 系统钥匙串（Secret Vault）
- 自动更新

Web 版本使用 `astronomy-engine` 纯 JS 回退进行天文计算，结果与桌面版一致。

## 相关文档

- [部署概览](../index.md)
- [桌面部署](../desktop/index.md)
