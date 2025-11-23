# 项目创建增强组件文档

## 概述

本目录包含了项目创建增强功能的所有前端组件，这些组件协同工作，提供完整的智能项目创建体验。

## 核心组件

### 1. EnhancedCreationWizard (enhanced-creation-wizard.tsx)

**主创建向导组件**，支持两种创建模式：

- **快速创建模式**：一键式创建，AI自动生成所有内容
- **分步创建模式**：逐步生成，每步可查看、编辑和重新生成

**功能特性：**
- 模板选择和应用
- 个性化推荐
- 进度跟踪
- 集成质量评估和反馈收集

**使用示例：**
```tsx
<EnhancedCreationWizard
  open={isOpen}
  onOpenChange={setIsOpen}
  onSuccess={(projectId) => {
    console.log("Project created:", projectId);
  }}
  userId={currentUserId}
/>
```

### 2. StepResultDisplay (step-result-display.tsx)

**步骤结果展示组件**，用于显示每个创建步骤的生成结果。

**功能特性：**
- 支持多种步骤类型（基础信息、角色、世界观、大纲）
- 内联编辑功能
- 重新生成按钮
- 可折叠的详细信息展示

**使用示例：**
```tsx
<StepResultDisplay
  step="characters"
  data={characterData}
  onEdit={(editedData) => handleEdit(editedData)}
  onRegenerate={() => handleRegenerate()}
  isRegenerating={isLoading}
/>
```

### 3. QualityDashboard (quality-dashboard.tsx)

**质量仪表板组件**，展示生成内容的质量评估。

**功能特性：**
- 总体质量评分
- 多维度评分（完整性、一致性、丰富度、可写性、语义质量）
- 创新性评估（世界观独特性、角色复杂度、冲突原创性）
- 俗套检测和建议
- 改进建议（按优先级分类）

**使用示例：**
```tsx
<QualityDashboard
  qualityScore={{
    completeness: 85,
    consistency: 90,
    richness: 80,
    writability: 88,
    semanticQuality: 87,
    totalScore: 86,
  }}
  innovationScore={{
    worldUniqueness: 75,
    characterComplexity: 82,
    conflictOriginality: 78,
    overallInnovation: 78,
    cliches: [],
  }}
  issues={[]}
/>
```

### 4. FeedbackCollector (feedback-collector.tsx)

**反馈收集组件**，收集用户对生成内容的评价。

**功能特性：**
- 5星评分系统
- 情感选择（满意/不满意）
- 标签选择（8个正面标签 + 8个负面标签）
- 自由文本评论
- 自动提交到后端API

**使用示例：**
```tsx
<FeedbackCollector
  projectId={projectId}
  candidateId={candidateId}
  onSubmit={async (feedback) => {
    await submitFeedback(feedback);
  }}
/>
```

### 5. HistoryViewer (history-viewer.tsx)

**历史查看组件**，查看和管理创建历史。

**功能特性：**
- 会话历史和用户历史两个视图
- 历史详情查看
- 版本恢复功能
- 版本比较功能（最多2个）
- 时间戳和评分显示

**使用示例：**
```tsx
<HistoryViewer
  sessionId={currentSessionId}
  userId={currentUserId}
/>
```

### 6. ErrorNotification (error-notification.tsx)

**错误通知组件**，显示错误信息并提供恢复选项。

**功能特性：**
- 多种错误类型支持（网络、验证、超时、服务器、未知）
- 重试机制（带重试计数）
- 保存进度功能
- 自动恢复选项
- 详细错误信息查看
- 批量错误管理

**使用示例：**
```tsx
<ErrorNotification
  error={{
    type: "network",
    message: "网络连接失败",
    details: "无法连接到服务器",
    recoverable: true,
    canRetry: true,
    canSave: true,
    retryCount: 1,
    maxRetries: 3,
  }}
  onRetry={() => handleRetry()}
  onSave={() => handleSave()}
  onDismiss={() => handleDismiss()}
/>
```

**使用Hook管理多个错误：**
```tsx
const { errors, addError, removeError, clearAll } = useErrorNotifications();

// 添加错误
addError({
  type: "timeout",
  message: "请求超时",
  recoverable: true,
  canRetry: true,
  canSave: false,
});

// 显示错误
<ErrorNotificationContainer
  errors={errors}
  onRetry={(index) => handleRetry(index)}
  onDismiss={(index) => removeError(index)}
  onClearAll={clearAll}
/>
```



## 组件集成流程

### 完整的创建流程

```
1. 用户打开 EnhancedCreationWizard
   ↓
2. 选择创建模式（快速/分步）
   ↓
3. 填写基础信息
   ↓
4. [分步模式] 每个步骤：
   - 显示 StepResultDisplay
   - 可选显示 QualityDashboard
   - 可选显示 FeedbackCollector
   - 可以编辑或重新生成
   ↓
5. 完成创建
   ↓
6. [可选] 查看 HistoryViewer
```

### 错误处理流程

```
1. 操作失败
   ↓
2. 显示 ErrorNotification
   ↓
3. 用户选择：
   - 重试 → 重新执行操作
   - 保存 → 保存当前进度
   - 恢复 → 尝试自动恢复
   - 关闭 → 忽略错误
```

## API集成

所有组件都通过以下API端点与后端通信：

### 创建相关
- `POST /api/creation/quick` - 快速创建
- `POST /api/creation/stepwise/start` - 开始分步创建
- `POST /api/creation/stepwise/:sessionId/next` - 执行下一步
- `POST /api/creation/stepwise/:sessionId/regenerate` - 重新生成
- `POST /api/creation/from-template` - 从模板创建



### 历史相关
- `GET /api/history/session/:sessionId` - 获取会话历史
- `GET /api/history/user/:userId` - 获取用户历史
- `POST /api/history/:id/restore` - 恢复历史版本

### 反馈相关
- `POST /api/feedback` - 提交反馈
- `GET /api/creation/recommendations/:userId` - 获取个性化推荐

## 样式和主题

所有组件使用 shadcn/ui 组件库，支持：
- 深色/浅色主题切换
- 响应式设计
- 一致的视觉风格
- 可访问性支持

## 性能优化

- 使用 React Query 进行数据缓存和状态管理
- 懒加载大型组件
- 虚拟滚动处理长列表
- 防抖和节流优化用户输入

## 测试

建议的测试覆盖：
- 单元测试：每个组件的独立功能
- 集成测试：组件间的交互
- E2E测试：完整的创建流程

## 未来改进

1. **实时协作**：支持多用户同时编辑
2. **版本控制**：更强大的历史版本管理
3. **AI助手**：内联AI建议和优化
4. **导出功能**：导出为多种格式
5. **模板市场**：分享和下载社区模板

## 贡献指南

添加新组件时，请确保：
1. 遵循现有的代码风格
2. 使用 TypeScript 类型定义
3. 添加适当的错误处理
4. 提供使用示例
5. 更新本文档
