# AI网络小说创作工作台

## 项目概述
专业的AI辅助网络小说创作平台，支持多AI模型、大纲管理、智能续写和番茄小说平台优化。

## 技术栈
- **Frontend**: React + TypeScript + Tailwind CSS + Shadcn UI
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **AI Models**: DeepSeek, OpenAI (GPT-5), Anthropic (Claude)

## 核心功能

### 1. 项目管理系统
- 创建和管理小说项目
- 设置类型、风格、目标字数
- 番茄小说模板和关键节点提醒（3万/8万/20万字）
- 项目进度追踪

### 2. 多AI模型配置
- 支持多个AI提供商（DeepSeek、OpenAI、Claude等）
- 自定义API配置
- 模型参数调整（温度、token限制）
- 使用统计追踪

### 3. 三栏式写作工作台
- 左侧：章节目录树
- 中间：富文本编辑器
- 右侧：AI助手面板
- 实时字数统计
- 自动保存（30秒）

### 4. 三级大纲编辑器
- 总纲-卷纲-章纲树形结构
- AI辅助生成大纲
- 情节节点标记（钩子、高潮、转折）
- 大纲与章节联动

### 5. 人物与世界观管理
- 人物档案（主角、配角、反派、群像）
- 详细设定（外貌、性格、背景、金手指）
- 世界观体系（力量等级、规则）
- 快速引用系统

### 6. AI续写与生成引擎
- 智能上下文提取
- 多参数控制（创意度、文风、节奏）
- 多方案生成
- 分段续写
- 钩子生成
- 情节卡片库

### 7. 提示词模板系统
- 分类模板库（续写/改写/对话/情节生成）
- 变量自动填充
- 自定义模板保存
- 番茄小说风格模板

### 8. 内容优化工具
- AI改写润色
- 扩写压缩
- 对话优化
- 场景描写增强
- 多版本对比

### 9. 章节管理与发布
- 按卷分组组织
- 版本历史
- 一键复制格式化
- 发布检查清单

### 10. 创作数据统计
- 字数曲线追踪
- 日均产出分析
- API使用统计
- 进度看板
- 番茄小说里程碑追踪

## 数据库结构

### 核心表
- `projects` - 小说项目
- `volumes` - 卷
- `chapters` - 章节
- `outlines` - 大纲（三级结构）
- `characters` - 人物设定
- `world_settings` - 世界观设定
- `ai_models` - AI模型配置
- `prompt_templates` - 提示词模板
- `plot_cards` - 情节卡片
- `generation_history` - AI生成历史
- `statistics` - 创作统计

## API端点

### Projects
- `GET /api/projects` - 获取所有项目
- `POST /api/projects` - 创建项目
- `PATCH /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目

### Chapters
- `GET /api/chapters/:projectId` - 获取项目章节
- `POST /api/chapters` - 创建章节
- `PATCH /api/chapters/:id` - 更新章节（自动更新总字数）
- `DELETE /api/chapters/:id` - 删除章节

### Outlines
- `GET /api/outlines/:projectId` - 获取项目大纲
- `POST /api/outlines` - 创建大纲节点
- `PATCH /api/outlines/:id` - 更新大纲
- `DELETE /api/outlines/:id` - 删除大纲

### Characters
- `GET /api/characters/:projectId` - 获取人物设定
- `POST /api/characters` - 创建人物
- `DELETE /api/characters/:id` - 删除人物

### AI Models
- `GET /api/ai-models` - 获取所有AI模型
- `POST /api/ai-models` - 添加AI模型
- `PATCH /api/ai-models/:id` - 更新模型配置
- `POST /api/ai-models/:id/set-default` - 设置默认模型
- `DELETE /api/ai-models/:id` - 删除模型

### AI Generation
- `POST /api/ai/generate` - AI内容生成
- `GET /api/generation-history/:projectId` - 获取生成历史

### Statistics
- `GET /api/statistics/:projectId` - 获取统计数据
- `POST /api/statistics` - 记录统计

## 设计系统

### 颜色主题
- Primary: 深紫蓝 (250 80% 60%)
- 背景：深炭灰 (222 20% 11%)
- 默认：深色模式优先
- 支持亮/暗模式切换

### 字体
- UI: Inter
- 编辑器内容: Noto Serif SC (优化中文阅读)
- 代码/统计: JetBrains Mono

### 布局
- 侧边栏宽度: 16rem
- 章节目录: 16rem
- AI面板: 20rem
- 编辑器: 自适应，最大4xl

## 环境变量
- `DATABASE_URL` - PostgreSQL连接字符串
- `DEEPSEEK_API_KEY` - DeepSeek API密钥（系统默认）
- `SESSION_SECRET` - 会话密钥

## 番茄小说特色功能
- **3万字节点** - 书荒期提醒
- **8万字节点** - 验证期提醒
- **20万字节点** - 推荐期提醒
- 自动字数追踪和里程碑提示
- 一键复制格式化内容

## 最近更新
- 2025-10-19: 完成核心数据模型设计
- 2025-10-19: 实现完整前端UI系统
- 2025-10-19: 实现后端API和数据库集成
- 2025-10-19: 集成DeepSeek AI模型支持

## 下一步计划
1. 测试完整用户流程
2. 优化AI生成质量
3. 添加更多提示词模板
4. 实现协作功能
5. 移动端适配
