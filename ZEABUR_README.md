# Zeabur 配置文件清单

本项目已配置 Zeabur 后端部署支持。

## 📁 配置文件

### 1. `zeabur.json`
Zeabur 的主配置文件，定义了：
- 项目名称：`novel-helper-backend`
- 构建命令：`npm run build`
- 启动命令：`npm run start`
- Node.js 版本：20
- Dockerfile 路径（可选）

### 2. `.env.zeabur`
环境变量模板文件，包含：
- `DATABASE_URL` - PostgreSQL 数据库连接字符串
- `OPENAI_API_KEY` - OpenAI API 密钥
- `ANTHROPIC_API_KEY` - Anthropic Claude API 密钥
- `SESSION_SECRET` - Session 加密密钥
- 其他可选配置

> ⚠️ **注意**：`.env.zeabur` 仅作为模板参考，实际环境变量需要在 Zeabur Dashboard 中配置。

### 3. `server/index.ts` - CORS 更新

已更新 CORS 配置，支持 Cloudflare Pages 域名：

```typescript
app.use(cors({
  origin: [
    /\.zeabur\.app$/,   // Zeabur 域名
    /\.pages\.dev$/,    // ✅ Cloudflare Pages
    /capacitor:\/\//,   // Capacitor 应用
    /http:\/\/localhost/, // 本地开发
  ],
  credentials: true,
}));
```

### 4. `DEPLOY_ZEABUR.md`
完整的部署指南文档，包含：
- 两种部署方式（GitHub / CLI）
- 环境变量配置
- 数据库迁移步骤
- 自定义域名设置
- 监控和日志查看
- 故障排查指南

## 🚀 快速开始

### 方式一：通过 GitHub 部署（推荐）

```bash
# 1. 推送代码到 GitHub
git push origin main

# 2. 在 Zeabur Dashboard
# - 创建项目
# - 连接 GitHub 仓库
# - 设置环境变量
# - 点击部署
```

### 方式二：通过 CLI 部署

```bash
# 1. 安装 Zeabur CLI
npm install -g @zeabur/cli

# 2. 登录并部署
zeabur login
zeabur deploy
```

## ⚙️ 必需环境变量

部署前，必须在 Zeabur Dashboard 设置以下环境变量：

```bash
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-secret-key
```

详细配置请参考 `.env.zeabur` 模板。

## 🔗 与 Cloudflare Pages 集成

### 1. 部署后获取 Zeabur 地址

```
https://your-app-name.zeabur.app
```

### 2. 在 Cloudflare Pages 设置

```bash
VITE_API_URL=https://your-app-name.zeabur.app
```

### 3. CORS 已自动配置

后端代码已包含 Cloudflare Pages 域名白名单，无需额外配置。

## 📚 相关文档

- [DEPLOY_ZEABUR.md](./DEPLOY_ZEABUR.md) - 详细部署指南
- [DEPLOY_CLOUDFLARE_PAGES.md](./DEPLOY_CLOUDFLARE_PAGES.md) - 前端部署
- [Zeabur 官方文档](https://zeabur.com/docs)
