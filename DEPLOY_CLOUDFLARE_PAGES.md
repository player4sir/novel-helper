# Cloudflare Pages 部署指南

本指南说明如何将前端部署到 Cloudflare Pages。

## 前置条件

- Cloudflare 账号
- 已安装 Wrangler CLI: `npm install -g wrangler`
- 已完成 Cloudflare 登录: `wrangler login`

## 方式一：通过 Wrangler CLI 部署（推荐）

### 1. 构建前端

```bash
npm run pages:build
```

### 2. 部署到 Cloudflare Pages

首次部署：
```bash
wrangler pages deploy dist/public --project-name=novel-helper
```

后续部署：
```bash
npm run pages:deploy
```

### 3. 配置环境变量

在 Cloudflare Pages Dashboard 设置环境变量：

- 进入 [Cloudflare Dashboard](https://dash.cloudflare.com)
- 选择 Pages > novel-helper > Settings > Environment variables
- 添加以下变量：

```
VITE_API_URL=https://your-zeabur-backend.zeabur.app
```

### 4. 触发重新部署

环境变量修改后，需要重新部署：

```bash
npm run pages:deploy
```

---

## 方式二：通过 GitHub 自动部署

### 1. 推送代码到 GitHub

```bash
git add .
git commit -m "Add Cloudflare Pages config"
git push origin main
```

### 2. 在 Cloudflare Dashboard 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 选择 **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**
3. 选择你的 GitHub 仓库 `novel-helper`
4. 配置构建设置：

| 配置项 | 值 |
|--------|-----|
| Framework preset | None |
| Build command | `npm run pages:build` |
| Build output directory | `dist/public` |
| Root directory | `/` |
| Node.js version | `20` |

5. 点击 **Save and Deploy**

### 3. 配置环境变量

在部署完成后：

1. 进入项目 > **Settings** > **Environment variables**
2. 添加 **Production** 环境变量：

```
VITE_API_URL=https://your-zeabur-backend.zeabur.app
```

3. 点击 **Redeploy** 触发重新构建

### 4. 自动部署

之后每次 push 到 main 分支，Cloudflare Pages 会自动构建和部署。

---

## 方式三：手动上传（不推荐）

```bash
# 1. 构建
npm run pages:build

# 2. 在 Cloudflare Dashboard 手动上传 dist/public 文件夹
```

---

## 部署后验证

### 1. 访问默认域名

部署成功后，Cloudflare 会分配一个默认域名：

```
https://novel-helper.pages.dev
```

### 2. 检查 API 连接

打开浏览器开发者工具 > Network，确认 API 请求发送到正确的 Zeabur 后端地址。

### 3. 测试登录功能

确保跨域请求正常工作（需要后端配置 CORS，见下一步）。

---

## 下一步：配置后端 CORS

前端部署完成后，需要在 Zeabur 后端添加 Cloudflare Pages 域名到 CORS 白名单。

参考 `DEPLOY_ZEABUR.md` 中的 CORS 配置部分。

---

## 自定义域名（可选）

### 1. 添加自定义域名

在 Cloudflare Pages 项目中：

1. 进入 **Custom domains** > **Set up a custom domain**
2. 输入你的域名（如 `app.yourdomain.com`）
3. 按照提示添加 DNS 记录

### 2. 更新环境变量

如果使用自定义域名，可能需要更新前端环境变量中的 API 地址。

---

## 常见问题

### Q: 部署后页面空白？

**A**: 检查以下几点：
1. 构建输出目录是否正确（`dist/public`）
2. 环境变量 `VITE_API_URL` 是否设置
3. 浏览器控制台是否有错误

### Q: API 请求失败？

**A**: 
1. 检查 `VITE_API_URL` 是否正确
2. 检查后端 CORS 配置是否包含 Pages 域名
3. 确认 Zeabur 后端是否正常运行

### Q: 如何查看部署日志？

**A**: 
- CLI 部署：在终端查看实时日志
- GitHub 部署：在 Pages 项目 > **Deployments** 查看

### Q: 如何回滚到之前版本？

**A**: 
1. 进入 Pages 项目 > **Deployments**
2. 选择之前的成功部署
3. 点击 **Rollback to this deployment**

---

## 相关文档

- [Cloudflare Pages 官方文档](https://developers.cloudflare.com/pages/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [Zeabur 部署指南](./DEPLOY_ZEABUR.md)
