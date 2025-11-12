# ✅ Zeabur 部署检查清单

## 准备工作

### 1. 代码准备
- [x] 已添加 CORS 支持（移动端访问必需）
- [x] 已配置环境变量端口支持
- [x] 已创建 `zbpack.json` 构建配置
- [x] 已创建 `.zeabur/config.json` 项目配置
- [ ] 提交所有代码到 Git 仓库

### 2. 环境变量准备
复制以下内容，准备在 Zeabur 控制台粘贴：

```env
DATABASE_URL=postgresql://neondb_owner:npg_qs2bkzfjT9Ag@ep-dark-waterfall-a1onhzvy-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

DEEPSEEK_API_KEY=你的密钥
OPENAI_API_KEY=你的密钥
ANTHROPIC_API_KEY=你的密钥
ZHIPU_API_KEY=你的密钥
QWEN_API_KEY=你的密钥
MOONSHOT_API_KEY=你的密钥
BAICHUAN_API_KEY=你的密钥
SILICONFLOW_API_KEY=你的密钥

SESSION_SECRET=请生成一个随机字符串（至少32位）
NODE_ENV=production
PORT=5000
```

**生成随机 SESSION_SECRET**：
```bash
# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

## 部署步骤

### 方式一：Web 界面部署（推荐新手）

#### Step 1: 注册登录
1. 访问 https://zeabur.com
2. 点击右上角 "Sign In"
3. 使用 GitHub 账号登录（推荐）

#### Step 2: 创建项目
1. 点击 "Create Project"
2. 输入项目名称：`novel-helper`
3. 选择区域：**Asia Pacific (Hong Kong)** - 国内访问最快

#### Step 3: 添加服务
1. 点击 "Add Service"
2. 选择 "Git" 
3. 如果是第一次，需要授权 GitHub
4. 选择你的仓库：`novel-helper`
5. 选择分支：`main` 或 `master`

#### Step 4: 配置环境变量
1. 点击刚创建的服务
2. 点击 "Variables" 标签
3. 点击 "Add Variable"
4. 逐个添加上面准备的环境变量
   - 或者点击 "Bulk Edit" 批量粘贴

#### Step 5: 等待部署
- Zeabur 会自动检测 Node.js 项目
- 自动运行 `npm install`
- 自动运行 `npm run build`
- 自动运行 `npm run start`
- 部署时间约 2-5 分钟

#### Step 6: 获取域名
1. 部署成功后，点击 "Domains" 标签
2. 点击 "Generate Domain"
3. 会得到一个域名：`https://novel-helper-xxx.zeabur.app`
4. **记录这个域名**，后面配置 Android 应用需要用

### 方式二：CLI 部署（推荐熟练用户）

```bash
# 1. 安装 CLI
npm install -g zeabur

# 2. 登录
zeabur login

# 3. 初始化项目（如果是第一次）
zeabur init

# 4. 部署
zeabur deploy

# 5. 设置环境变量
zeabur env set DATABASE_URL="你的数据库URL"
zeabur env set DEEPSEEK_API_KEY="你的密钥"
# ... 其他环境变量

# 6. 查看日志
zeabur logs
```

## 验证部署

### 1. 检查服务状态
访问 Zeabur 控制台，确认：
- ✅ 服务状态：Running
- ✅ 构建日志：无错误
- ✅ 运行日志：显示 "serving on port 5000"

### 2. 测试 API
```bash
# 替换为你的域名
curl https://novel-helper-xxx.zeabur.app/api/projects
```

应该返回项目列表（可能是空数组）

### 3. 访问 Web 界面
在浏览器打开：`https://novel-helper-xxx.zeabur.app`

应该能看到你的应用界面

## 常见问题排查

### 问题 1: 构建失败
**症状**：部署卡在 "Building" 状态

**解决**：
1. 查看构建日志（Logs 标签）
2. 检查 `package.json` 中的 `build` 脚本
3. 确认所有依赖都在 `dependencies` 中（不是 `devDependencies`）

### 问题 2: 启动失败
**症状**：构建成功但服务无法启动

**解决**：
1. 查看运行日志
2. 检查环境变量是否配置完整
3. 特别检查 `DATABASE_URL` 是否正确

### 问题 3: 数据库连接失败
**症状**：日志显示 "connection refused" 或 "SSL error"

**解决**：
1. 确认 `DATABASE_URL` 包含 `?sslmode=require`
2. 检查 Neon 数据库是否正常运行
3. 尝试在本地测试数据库连接

### 问题 4: API 404 错误
**症状**：访问 `/api/projects` 返回 404

**解决**：
1. 检查路由注册是否正确
2. 查看服务器日志
3. 确认 `NODE_ENV=production`

### 问题 5: CORS 错误
**症状**：移动端无法访问 API

**解决**：
1. 已添加 CORS 配置，应该不会有问题
2. 如果还有问题，检查请求头
3. 查看浏览器控制台错误信息

## 监控和维护

### 查看日志
Zeabur 控制台 → 服务 → Logs

### 查看用量
Zeabur 控制台 → Project → Usage

### 重启服务
Zeabur 控制台 → 服务 → Restart

### 更新代码
推送到 Git 仓库后，Zeabur 会自动重新部署

## 费用监控

- 免费额度：$5/月
- 查看当前用量：Zeabur 控制台 → Billing
- 建议设置用量提醒

## 下一步

部署成功后：
1. ✅ 记录你的 API 域名
2. ✅ 测试所有 API 端点
3. ➡️ 继续配置 Android 应用（Capacitor）

---

## 快速命令参考

```bash
# 查看服务状态
zeabur status

# 查看日志
zeabur logs

# 重启服务
zeabur restart

# 查看环境变量
zeabur env list

# 设置环境变量
zeabur env set KEY=VALUE

# 删除环境变量
zeabur env unset KEY
```

## 需要帮助？

- Zeabur 文档：https://zeabur.com/docs
- Zeabur Discord：https://discord.gg/zeabur
- 或者问我！😊
