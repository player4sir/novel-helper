# Zeabur 后端部署指南

本指南说明如何将 Node.js 后端部署到 Zeabur 平台。

## 前置条件

- Zeabur 账号（支持 GitHub 登录）
- GitHub 仓库（推荐）
- Neon PostgreSQL 数据库（或其他 PostgreSQL 数据库）

---

## 方式一：通过 GitHub 自动部署（推荐）

### 1. 准备 GitHub 仓库

确保代码已推送到 GitHub：

```bash
git add .
git commit -m "Add Zeabur deployment config"
git push origin main
```

### 2. 在 Zeabur 创建项目

1. 登录 [Zeabur Dashboard](https://zeabur.com)
2. 点击 **创建项目** (Create Project)
3. 选择 **从 GitHub 导入** (Import from GitHub)
4. 授权 Zeabur 访问你的 GitHub 仓库
5. 选择 `novel-helper` 仓库

### 3. 配置服务

Zeabur 会自动检测到 Node.js 项目，并使用以下配置：

| 配置项 | 值 |
|--------|-----|
| 构建命令 | `npm run build` |
| 启动命令 | `npm run start` |
| Node.js 版本 | 20 |
| 端口 | 5000 (自动检测) |

> ✅ Zeabur 会自动读取 `zeabur.json` 配置文件

### 4. 配置环境变量

在服务设置页面添加以下环境变量：

#### 必需变量

```bash
# 数据库连接
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# AI 服务密钥
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx

# 应用配置
NODE_ENV=production
PORT=5000
SESSION_SECRET=your-super-secret-session-key
```

#### 获取 DATABASE_URL

**如果使用 Neon：**
1. 登录 [Neon Console](https://console.neon.tech)
2. 选择数据库项目
3. 复制 Connection String（选择 Pooled connection）

**如果在 Zeabur 创建 PostgreSQL：**
1. 在同一项目中点击 **添加服务** > **PostgreSQL**
2. Zeabur 会自动生成 `DATABASE_URL` 环境变量

#### 可选变量

```bash
# 支付配置（如需要）
ALIPAY_APP_ID=xxx
ALIPAY_PRIVATE_KEY=xxx
WECHAT_PAY_MERCHANT_ID=xxx

# 日志级别
LOG_LEVEL=info
```

### 5. 部署

1. 点击 **部署** (Deploy)
2. Zeabur 会自动：
   - 安装依赖 (`npm install`)
   - 构建项目 (`npm run build`)
   - 启动服务 (`npm run start`)

### 6. 获取后端地址

部署成功后，Zeabur 会分配一个域名：

```
https://your-app-name.zeabur.app
```

**记录这个地址**，后续需要配置到 Cloudflare Pages 的 `VITE_API_URL` 环境变量。

---

## 方式二：通过 Zeabur CLI 部署

### 1. 安装 Zeabur CLI

```bash
npm install -g @zeabur/cli
```

### 2. 登录

```bash
zeabur login
```

### 3. 初始化项目

```bash
zeabur init
```

### 4. 部署

```bash
zeabur deploy
```

---

## 数据库迁移

### 首次部署时运行迁移

部署成功后，需要运行数据库迁移：

#### 方法 1：使用 Zeabur 终端（推荐）

1. 在 Zeabur Dashboard 进入服务页面
2. 点击 **Terminal** 标签
3. 运行迁移命令：

```bash
npm run db:push
npm run migrate:001
npm run migrate:004
npm run migrate:005
npm run migrate:006
```

#### 方法 2：本地连接远程数据库

```bash
# 设置远程数据库 URL
export DATABASE_URL="postgresql://user:password@host:5432/database"

# 运行迁移
npm run db:push
npm run migrate:001
npm run migrate:004
npm run migrate:005
npm run migrate:006
```

---

## 自定义域名（可选）

### 1. 添加自定义域名

在 Zeabur 服务设置中：

1. 进入 **域名** (Domains) 标签
2. 点击 **添加域名** (Add Domain)
3. 输入你的域名（如 `api.yourdomain.com`）

### 2. 配置 DNS

在你的域名提供商处添加 CNAME 记录：

```
api.yourdomain.com  →  your-app-name.zeabur.app
```

### 3. 启用 HTTPS

Zeabur 会自动为自定义域名申请 SSL 证书。

---

## 监控和日志

### 查看日志

1. 进入 Zeabur 服务页面
2. 点击 **日志** (Logs) 标签
3. 实时查看应用日志

### 查看监控指标

Zeabur 提供以下监控数据：
- CPU 使用率
- 内存使用率
- 网络流量
- 请求响应时间

---

## 自动化部署

### GitHub Push 自动部署

连接 GitHub 后，每次 push 到 main 分支会自动触发部署。

### 禁用自动部署

如果需要手动控制部署：
1. 进入服务设置
2. 关闭 **自动部署** (Auto Deploy) 开关

---

## 环境变量管理最佳实践

### 1. 使用 .env.zeabur 作为模板

项目中的 `.env.zeabur` 文件包含所有环境变量的说明，可以参考填写。

### 2. 密钥管理

⚠️ **不要将真实的 API Key 提交到 Git！**

建议workflow：
1. 在 `.env.zeabur` 中使用占位符
2. 在 Zeabur Dashboard 设置真实值

### 3. 环境变量分组

Zeabur 支持多环境配置：
- **生产环境** (Production)
- **预览环境** (Preview) - 用于测试

---

## 连接 Cloudflare Pages 前端

### 1. 获取 Zeabur 后端地址

复制 Zeabur 分配的域名（如 `https://novel-helper.zeabur.app`）

### 2. 在 Cloudflare Pages 设置环境变量

进入 Cloudflare Pages 项目设置：

```bash
VITE_API_URL=https://novel-helper.zeabur.app
```

### 3. 验证 CORS 配置

后端代码已更新 CORS 配置，允许 Cloudflare Pages 域名：

```typescript
// server/index.ts
app.use(cors({
  origin: [
    /\.zeabur\.app$/,
    /\.pages\.dev$/,  // ✅ Cloudflare Pages
    // ...
  ],
  credentials: true,
}));
```

### 4. 测试连接

1. 访问前端 Cloudflare Pages 地址
2. 打开浏览器开发者工具 > Network
3. 登录或调用 API，查看请求是否成功

---

## 扩容和性能优化

### 自动扩容

Zeabur 支持自动扩容：
- 根据 CPU/内存使用率自动调整资源
- 无需手动配置

### 性能优化建议

1. **启用数据库连接池**（已在代码中实现）
2. **使用 CDN** - 静态资源通过 Cloudflare Pages 分发
3. **缓存优化** - 项目已集成语义缓存

---

## 故障排查

### 部署失败

**检查日志**：
```bash
# 在 Zeabur Terminal 查看
npm run start
```

**常见问题**：
1. 依赖安装失败 → 检查 `package.json`
2. 构建失败 → 检查 TypeScript 错误
3. 数据库连接失败 → 检查 `DATABASE_URL`

### API 请求失败

**检查 CORS**：
- 确认前端域名在 CORS 白名单中
- 查看浏览器控制台错误信息

**检查环境变量**：
- 确认 `VITE_API_URL` 指向正确的 Zeabur 地址

### 数据库连接问题

**验证连接字符串**：
```bash
# 在 Zeabur Terminal 测试
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT 1').then(() => console.log('✓ Connected')).catch(e => console.error('✗ Error:', e.message));"
```

---

## 成本估算

Zeabur 定价（参考）：
- **免费额度**：适合个人项目
- **付费计划**：按使用量计费
  - CPU: ~$0.02/小时
  - 内存: ~$0.005/GB/小时
  - 流量: 前 10GB 免费

**建议**：
- 开发/测试：使用免费额度
- 生产环境：预估每月 $10-30

---

## 下一步

✅ **完成后端部署后：**

1. 记录 Zeabur 后端地址
2. 在 Cloudflare Pages 配置 `VITE_API_URL`
3. 测试前后端连接
4. （可选）配置自定义域名

📚 **相关文档**：
- [DEPLOY_CLOUDFLARE_PAGES.md](./DEPLOY_CLOUDFLARE_PAGES.md) - 前端部署指南
- [Zeabur 官方文档](https://zeabur.com/docs)
