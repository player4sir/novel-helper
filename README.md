# 📚 AI 小说创作助手

> 基于 AI 的智能小说创作平台，支持项目管理、大纲生成、智能续写、角色追踪等全流程创作功能

[![Build Docker Image](https://github.com/player4sir/novel-helper/actions/workflows/docker-build.yml/badge.svg)](https://github.com/player4sir/novel-helper/actions/workflows/docker-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 核心功能

### 🎯 智能项目管理
- **AI 生成项目元数据**：自动生成小说标题、简介、风格定位
- **多候选评分系统**：生成多个候选方案，智能评分选择最佳
- **完整项目结构**：支持卷-章节三级结构管理

### 📝 AI 辅助创作
- **智能大纲生成**：
  - 自动生成卷纲（3-5 个卷）
  - 自动生成章纲（10-15 章/卷）
  - 基于主题覆盖度和节奏控制的智能评分
- **场景级内容生成**：
  - 自动分解章节为多个场景
  - 增量式草稿生成
  - 实时规则检查（字数、对话比例、元评论检测）
- **智能续写与改写**：
  - 上下文感知的内容生成
  - 风格一致性保持
  - 多版本对比

### 👥 角色与世界观管理
- **角色状态追踪**：
  - 自动追踪角色出场位置
  - 情感状态分析
  - 角色弧光点记录
- **世界观设定**：
  - 核心规则管理
  - 关键词提取
  - 设定一致性检查

### 🤖 多模型支持
- **支持的 AI 服务商**：
  - DeepSeek（深度求索）
  - OpenAI（GPT 系列）
  - Anthropic（Claude 系列）
  - 智谱 AI（GLM 系列）
  - 通义千问（Qwen 系列）
  - 月之暗面（Moonshot）
  - 百川智能（Baichuan）
  - 硅基流动（SiliconFlow）
  - 自定义服务商
- **智能模型路由**：根据任务类型自动选择最佳模型
- **回退机制**：主模型失败自动切换备用模型

### 📊 创作数据统计
- 字数曲线追踪
- 日均产出分析
- API 使用统计
- 番茄小说里程碑追踪（5万、10万、20万字节点）

## 🚀 快速开始

### 环境要求
- Node.js 20+
- PostgreSQL 数据库（推荐使用 Neon）
- 至少一个 AI 模型的 API Key

### 本地开发

1. **克隆项目**
```bash
git clone https://github.com/player4sir/novel-helper.git
cd novel-helper
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**

创建 `.env` 文件：
```env
# 数据库配置
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require

# AI 模型 API Keys（至少配置一个）
DEEPSEEK_API_KEY=your_deepseek_api_key
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
ZHIPU_API_KEY=your_zhipu_api_key
QWEN_API_KEY=your_qwen_api_key
MOONSHOT_API_KEY=your_moonshot_api_key
BAICHUAN_API_KEY=your_baichuan_api_key
SILICONFLOW_API_KEY=your_siliconflow_api_key

# 会话密钥（生成一个随机字符串）
SESSION_SECRET=your_random_session_secret_here

# 服务器端口
PORT=5000
```

4. **初始化数据库**
```bash
npm run db:push
```

5. **启动开发服务器**
```bash
npm run dev
```

访问 `http://localhost:5000` 开始使用！

## 🐳 Docker 部署

### 使用预构建镜像

```bash
docker pull ghcr.io/player4sir/novel-helper:latest

docker run -d \
  -p 5000:5000 \
  -e DATABASE_URL="your_database_url" \
  -e DEEPSEEK_API_KEY="your_api_key" \
  -e SESSION_SECRET="your_secret" \
  --name novel-helper \
  ghcr.io/player4sir/novel-helper:latest
```

### 本地构建

```bash
docker build -t novel-helper .
docker run -d -p 5000:5000 --env-file .env novel-helper
```

## ☁️ 云端部署

### ClawCloud Run（推荐）

1. 访问 [ClawCloud Run Console](https://console.run.claw.cloud/)
2. 创建新应用 → 选择 "Deploy from Docker"
3. 配置镜像：`ghcr.io/player4sir/novel-helper:latest`
4. 设置环境变量（参考上面的 `.env` 配置）
5. 配置资源：
   - CPU: 0.5 vCPU
   - 内存: 1GB
   - 端口: 5000
6. 启用公网访问
7. 点击部署

**免费额度**：
- CPU: 4 vCPU
- 内存: 8GB
- 存储: 10GB
- 网络: 10GB

## 📱 移动端支持

项目支持通过 Capacitor 打包为 Android/iOS 应用：

1. 部署后端到云端（获得 API 地址）
2. 配置前端 API 地址
3. 使用 Capacitor 构建移动应用

详见 [移动端部署文档](docs/mobile-deployment.md)（待补充）

## 🏗️ 技术栈

### 前端
- **框架**：React 18 + TypeScript
- **构建工具**：Vite
- **UI 组件**：Radix UI + Tailwind CSS
- **状态管理**：React Query
- **路由**：Wouter
- **图表**：Recharts
- **动画**：Framer Motion

### 后端
- **运行时**：Node.js 20
- **框架**：Express
- **数据库**：PostgreSQL (Neon)
- **ORM**：Drizzle ORM
- **认证**：Passport.js
- **会话**：Express Session

### AI 集成
- **对话模型**：支持多家 AI 服务商
- **向量模型**：用于语义搜索和相似度计算
- **Prompt 管理**：模块化 Prompt 打包系统

### 桌面端
- **框架**：Electron
- **打包**：Electron Builder

## 📂 项目结构

```
novel-helper/
├── client/              # 前端代码
│   ├── src/
│   │   ├── components/  # React 组件
│   │   ├── pages/       # 页面组件
│   │   └── lib/         # 工具函数
├── server/              # 后端代码
│   ├── index.ts         # 服务器入口
│   ├── routes.ts        # API 路由
│   ├── storage.ts       # 数据库操作
│   ├── ai-service.ts    # AI 服务集成
│   ├── scene-draft-service.ts           # 场景生成服务
│   ├── volume-chapter-generation-service.ts  # 大纲生成服务
│   ├── enhanced-project-creation-service.ts  # 项目创建服务
│   └── ...
├── shared/              # 共享代码
│   └── schema.ts        # 数据库 Schema
├── migrations/          # 数据库迁移
├── electron/            # Electron 配置
├── Dockerfile           # Docker 配置
└── .github/workflows/   # GitHub Actions
```

## 🔧 核心算法

### 1. Prompt Packing（提示词打包）
- 模块化管理 Prompt 组件
- 优先级控制（must-have, important, nice-to-have）
- Token 预算管理
- 动态内容截取

### 2. 多候选评分系统
- 并发生成多个候选（不同 temperature）
- 基于向量相似度的主题覆盖度评分
- 节奏控制评分
- 自动选择最佳候选

### 3. 场景级生成
- 自动分解章节为场景
- 增量式草稿生成
- 实时规则检查：
  - 字数控制（800-2000 字）
  - 对话比例（5%-50%）
  - 元评论检测
  - 段落结构检查

### 4. 实体追踪
- 自动提取角色提及
- 更新角色出场位置
- 生成场景摘要
- 情感状态分析

## 📊 数据库设计

### 核心表
- `projects` - 小说项目
- `volumes` - 卷
- `chapters` - 章节
- `scene_frames` - 场景框架
- `draft_chunks` - 场景草稿
- `characters` - 角色设定
- `world_settings` - 世界观设定
- `ai_models` - AI 模型配置
- `generation_history` - 生成历史
- `statistics` - 创作统计

详见 [数据库设计文档](shared/schema.ts)

## 🛣️ Roadmap

- [x] 基础项目管理
- [x] AI 大纲生成
- [x] 场景级内容生成
- [x] 角色状态追踪
- [x] 多模型支持
- [x] Docker 部署
- [ ] 移动端应用
- [ ] 语义缓存优化
- [ ] 连贯性检测
- [ ] 章节润色功能
- [ ] 协作功能
- [ ] 版本控制

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- 感谢所有 AI 服务提供商
- 感谢开源社区的优秀项目

---

**Made with ❤️ by Novel Writer Team**
