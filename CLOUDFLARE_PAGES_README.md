# Cloudflare Pages 配置文件清单

本项目已配置 Cloudflare Pages 部署支持。

## 📁 配置文件

### 1. `wrangler.toml`
Cloudflare Pages 的主配置文件，定义了：
- 项目名称：`novel-helper`
- 构建命令：`npm run build`  
- 输出目录：`dist/public`
- Node.js 版本：20

### 2. `.env.pages`
环境变量模板文件，包含：
- `VITE_API_URL` - 后端 API 地址（需要设置为你的 Zeabur 地址）

> ⚠️ **注意**：`.env.pages` 仅作为模板参考，实际环境变量需要在 Cloudflare Pages Dashboard 中配置。

### 3. `package.json` - 新增脚本

```json
{
  "scripts": {
    "pages:build": "vite build",
    "pages:deploy": "npm run pages:build && wrangler pages deploy dist/public",
    "pages:dev": "wrangler pages dev dist/public"
  }
}
```

### 4. `DEPLOY_CLOUDFLARE_PAGES.md`
完整的部署指南文档，包含：
- 三种部署方式（CLI / GitHub / 手动）
- 环境变量配置
- 自定义域名设置
- 常见问题解答

## 🚀 快速开始

### 方式一：使用 Wrangler CLI（推荐）

```bash
# 1. 安装 Wrangler（如果还没有）
npm install -g wrangler

# 2. 登录 Cloudflare
wrangler login

# 3. 构建并部署
npm run pages:deploy
```

### 方式二：通过 GitHub 自动部署

1. 推送代码到 GitHub
2. 在 [Cloudflare Dashboard](https://dash.cloudflare.com) 连接仓库
3. 配置构建设置（见 `DEPLOY_CLOUDFLARE_PAGES.md`）
4. 每次 push 自动部署

## ⚙️ 环境变量配置

部署后，必须在 Cloudflare Pages Dashboard 设置以下环境变量：

```
VITE_API_URL=https://your-zeabur-backend.zeabur.app
```

**设置路径**：
Pages 项目 → Settings → Environment variables → Add variable

## 📚 相关文档

- [DEPLOY_CLOUDFLARE_PAGES.md](./DEPLOY_CLOUDFLARE_PAGES.md) - 详细部署指南
- [DEPLOY_ZEABUR.md](./DEPLOY_ZEABUR.md) - Zeabur 后端部署（待创建）

## 🔗 相关链接

- [Cloudflare Pages 官方文档](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
