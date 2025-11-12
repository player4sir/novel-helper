# Zeabur 部署指南

## 准备工作

### 1. 注册 Zeabur 账号
访问 [https://zeabur.com](https://zeabur.com) 注册账号（支持 GitHub 登录）

### 2. 安装 Zeabur CLI（可选）
```bash
npm install -g zeabur
```

## 部署步骤

### 方式一：通过 Web 界面部署（推荐）

1. **登录 Zeabur 控制台**
   - 访问 https://dash.zeabur.com

2. **创建新项目**
   - 点击 "New Project"
   - 选择区域：Asia Pacific (Hong Kong) - 国内访问最快

3. **连接 Git 仓库**
   - 点击 "Add Service" → "Git"
   - 授权并选择你的 GitHub/GitLab 仓库
   - 或者选择 "Deploy from GitHub URL"

4. **配置环境变量**
   点击服务 → Settings → Environment Variables，添加：
   
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_qs2bkzfjT9Ag@ep-dark-waterfall-a1onhzvy-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   
   DEEPSEEK_API_KEY=你的密钥
   OPENAI_API_KEY=你的密钥
   ANTHROPIC_API_KEY=你的密钥
   ZHIPU_API_KEY=你的密钥
   QWEN_API_KEY=你的密钥
   MOONSHOT_API_KEY=你的密钥
   BAICHUAN_API_KEY=你的密钥
   SILICONFLOW_API_KEY=你的密钥
   
   SESSION_SECRET=生成一个随机字符串
   PORT=5000
   NODE_ENV=production
   ```

5. **部署**
   - Zeabur 会自动检测 Node.js 项目
   - 自动运行 `npm install` 和 `npm run build`
   - 部署完成后会分配一个域名：`https://your-app.zeabur.app`

### 方式二：通过 CLI 部署

```bash
# 登录
zeabur login

# 在项目根目录
zeabur deploy

# 按提示选择区域和配置
```

## 配置 Android 应用

部署成功后，你会得到一个 API 地址，例如：
```
https://novel-helper-xxx.zeabur.app
```

在 Android 应用中配置这个地址：

### 创建 `client/.env.production`
```env
VITE_API_URL=https://novel-helper-xxx.zeabur.app
```

## 验证部署

访问你的 Zeabur 域名：
```
https://your-app.zeabur.app
```

应该能看到你的应用界面。

## 自定义域名（可选）

1. 在 Zeabur 控制台 → Domains
2. 添加自定义域名
3. 配置 DNS CNAME 记录指向 Zeabur 提供的地址

## 监控和日志

- **查看日志**：Zeabur 控制台 → Logs
- **查看用量**：Zeabur 控制台 → Usage
- **重启服务**：Zeabur 控制台 → Restart

## 费用说明

- 免费额度：$5/月
- 按使用量计费（CPU + 内存 + 流量）
- 睡眠时不计费
- 对于小说创作工具，免费额度完全够用

## 常见问题

### 1. 构建失败
检查 `package.json` 中的 `build` 脚本是否正确

### 2. 启动失败
检查环境变量是否配置完整

### 3. 数据库连接失败
确认 `DATABASE_URL` 配置正确，包含 `?sslmode=require`

### 4. API 调用失败
检查 CORS 配置，确保允许移动端域名访问

## 下一步

部署成功后，继续配置 Android 应用：
1. 安装 Capacitor
2. 配置 API 地址
3. 构建 APK

参考 `ANDROID_SETUP.md`（即将创建）
