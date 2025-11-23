# Design Document

## Overview

本设计文档描述了小说项目创建功能的增强方案。当前系统已实现基于AI的项目创建，但存在流程僵化、质量不稳定、用户控制不足等问题。本设计通过引入渐进式创建流程、智能质量控制、用户反馈学习等机制，系统性地提升项目创建的灵活性、质量和用户体验。

核心设计理念：
- **用户主导**：用户在创建过程中拥有充分的控制权和可见性
- **智能辅助**：AI提供高质量的生成和建议，但不强制使用
- **持续优化**：系统学习用户偏好，逐步提升生成质量
- **容错健壮**：优雅处理错误，确保用户工作不丢失

## Architecture

系统采用分层架构，主要包括以下层次：

### 1. 表现层 (Presentation Layer)
- **创建向导组件** (CreationWizard): 管理分步创建流程的UI
- **快速创建对话框** (QuickCreateDialog): 一键式快速创建
- **模板管理界面** (TemplateManager): 模板的创建、查看、使用
- **历史查看器** (HistoryViewer): 查看和恢复创建历史
- **质量仪表板** (QualityDashboard): 展示质量评分和建议

### 2. 应用层 (Application Layer)
- **创建编排服务** (CreationOrchestrator): 协调整个创建流程
- **会话管理服务** (SessionManager): 管理创建会话的状态和持久化
- **模板服务** (TemplateService): 模板的CRUD和应用逻辑
- **历史服务** (HistoryService): 创建历史的记录和查询
- **反馈学习服务** (FeedbackLearningService): 收集和应用用户反馈

### 3. 领域层 (Domain Layer)
- **角色生成器** (CharacterGenerator): 生成深度角色设定
- **关系推断器** (RelationshipInferrer): 构建角色关系网络
- **世界观生成器** (WorldGenerator): 类型化世界观生成
- **创新性评估器** (InnovationEvaluator): 检测俗套和评估创新性
- **质量评分器** (QualityScorer): 多维度质量评估
- **候选合并器** (CandidateMerger): 智能合并候选方案

### 4. 基础设施层 (Infrastructure Layer)
- **AI服务** (AIService): 统一的AI模型调用接口
- **缓存服务** (CacheService): 语义缓存和结果缓存
- **存储服务** (StorageService): 数据持久化
- **重试机制** (RetryMechanism): 错误重试和恢复


## Components and Interfaces

### CreationOrchestrator

创建编排服务，协调整个项目创建流程。

```typescript
interface CreationOrchestrator {
  // 启动快速创建
  startQuickCreation(seed: ProjectSeed): Promise<CreationResult>;
  
  // 启动分步创建
  startStepwiseCreation(seed: ProjectSeed): Promise<SessionId>;
  
  // 执行下一步
  executeNextStep(sessionId: SessionId): Promise<StepResult>;
  
  // 重新生成当前步骤
  regenerateCurrentStep(sessionId: SessionId, options?: RegenerateOptions): Promise<StepResult>;
  
  // 保存并暂停
  pauseCreation(sessionId: SessionId): Promise<void>;
  
  // 恢复创建
  resumeCreation(sessionId: SessionId): Promise<StepResult>;
  
  // 完成创建
  finalizeCreation(sessionId: SessionId): Promise<CreationResult>;
}
```

### SessionManager

会话管理服务，负责创建会话的状态管理和持久化。

```typescript
interface SessionManager {
  // 创建新会话
  createSession(seed: ProjectSeed, mode: CreationMode): Promise<Session>;
  
  // 获取会话
  getSession(sessionId: SessionId): Promise<Session | null>;
  
  // 更新会话状态
  updateSession(sessionId: SessionId, updates: Partial<SessionState>): Promise<void>;
  
  // 保存步骤结果
  saveStepResult(sessionId: SessionId, step: CreationStep, result: StepResult): Promise<void>;
  
  // 获取未完成的会话
  getIncompleteSessions(userId?: string): Promise<Session[]>;
  
  // 删除会话
  deleteSession(sessionId: SessionId): Promise<void>;
}
```

### CharacterGenerator

角色生成器，生成具有深度的角色设定。

```typescript
interface CharacterGenerator {
  // 生成角色集合
  generateCharacters(
    context: ProjectContext,
    count: number,
    options?: GenerationOptions
  ): Promise<Character[]>;
  
  // 生成单个角色
  generateCharacter(
    context: ProjectContext,
    role: CharacterRole,
    options?: GenerationOptions
  ): Promise<Character>;
  
  // 补充角色细节
  enrichCharacter(character: Character, context: ProjectContext): Promise<Character>;
}

interface Character {
  name: string;
  role: 'protagonist' | 'supporting' | 'antagonist';
  personality: string;
  appearance: string;
  background: string;
  abilities: string;
  motivation: string;
  innerConflict: string;  // 内心冲突
  hiddenGoal: string;     // 隐藏目标
  growthPath: string;     // 成长路径
}
```


### RelationshipInferrer

关系推断器，基于角色设定和故事冲突构建关系网络。

```typescript
interface RelationshipInferrer {
  // 推断角色关系
  inferRelationships(
    characters: Character[],
    conflicts: string[],
    context: ProjectContext
  ): Promise<RelationshipGraph>;
  
  // 验证关系一致性
  validateRelationships(graph: RelationshipGraph): ValidationResult;
  
  // 优化关系网络
  optimizeRelationships(graph: RelationshipGraph): RelationshipGraph;
}

interface RelationshipGraph {
  nodes: Character[];
  edges: Relationship[];
}

interface Relationship {
  from: string;  // 角色名
  to: string;    // 角色名
  type: RelationType;
  description: string;
  strength: number;  // 关系强度 0-1
}

type RelationType = 
  | 'ally'        // 盟友
  | 'enemy'       // 敌对
  | 'mentor'      // 师徒
  | 'romantic'    // 爱慕
  | 'family'      // 亲属
  | 'rival'       // 竞争
  | 'neutral';    // 中立
```

### WorldGenerator

世界观生成器，根据类型生成对应的世界观框架。

```typescript
interface WorldGenerator {
  // 生成世界观
  generateWorld(
    genre: string,
    context: ProjectContext,
    options?: GenerationOptions
  ): Promise<WorldSetting>;
  
  // 获取类型模板
  getGenreTemplate(genre: string): WorldTemplate;
  
  // 验证世界观一致性
  validateWorld(world: WorldSetting): ValidationResult;
}

interface WorldSetting {
  genre: string;
  powerSystem?: PowerSystem;      // 力量体系
  socialStructure?: SocialStructure;  // 社会结构
  geography?: Geography;          // 地理设定
  factions?: Faction[];           // 势力
  rules: WorldRule[];             // 世界规则
  items?: ImportantItem[];        // 重要物品
}

interface PowerSystem {
  name: string;
  description: string;
  levels: string[];
  cultivation?: string;  // 修炼方式
  limitations: string[]; // 限制条件
}
```

### InnovationEvaluator

创新性评估器，检测俗套并提供创新建议。

```typescript
interface InnovationEvaluator {
  // 评估项目创新性
  evaluateInnovation(meta: ProjectMeta): InnovationScore;
  
  // 检测陈词滥调
  detectCliches(content: string): ClicheDetection[];
  
  // 生成创新建议
  generateInnovationSuggestions(
    cliches: ClicheDetection[],
    context: ProjectContext
  ): Promise<InnovationSuggestion[]>;
  
  // 评估世界观独特性
  evaluateWorldUniqueness(world: WorldSetting): number;
  
  // 评估角色复杂度
  evaluateCharacterComplexity(character: Character): number;
}

interface InnovationScore {
  overall: number;  // 总分 0-100
  worldInnovation: number;
  characterInnovation: number;
  conflictInnovation: number;
  cliches: ClicheDetection[];
  suggestions: InnovationSuggestion[];
}

interface ClicheDetection {
  type: string;
  location: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface InnovationSuggestion {
  target: string;  // 针对的内容
  suggestion: string;
  reasoning: string;
}
```


### QualityScorer

质量评分器，对生成内容进行多维度评估。

```typescript
interface QualityScorer {
  // 评估候选方案
  scoreCandidate(candidate: ProjectMeta, context: ProjectContext): QualityScore;
  
  // 评估完整性
  scoreCompleteness(meta: ProjectMeta): number;
  
  // 评估一致性
  scoreConsistency(meta: ProjectMeta): number;
  
  // 评估丰富度
  scoreRichness(meta: ProjectMeta): number;
  
  // 评估可写性
  scoreWritability(meta: ProjectMeta): number;
  
  // 评估语义质量
  scoreSemanticQuality(meta: ProjectMeta, embedding?: number[]): Promise<number>;
}

interface QualityScore {
  overall: number;  // 总分 0-100
  dimensions: {
    completeness: number;
    consistency: number;
    richness: number;
    writability: number;
    semanticQuality: number;
    innovation: number;
  };
  issues: QualityIssue[];
  suggestions: string[];
}

interface QualityIssue {
  dimension: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
}
```

### CandidateMerger

候选合并器，智能合并多个候选方案。

```typescript
interface CandidateMerger {
  // 合并候选方案
  mergeCandidates(
    candidates: ScoredCandidate[],
    strategy: MergeStrategy,
    context: ProjectContext
  ): Promise<ProjectMeta>;
  
  // LLM智能合并
  llmMerge(candidates: ScoredCandidate[], context: ProjectContext): Promise<ProjectMeta>;
  
  // 启发式合并（备用）
  heuristicMerge(candidates: ScoredCandidate[]): ProjectMeta;
}

type MergeStrategy = 'llm' | 'heuristic' | 'hybrid';

interface ScoredCandidate {
  candidate: ProjectMeta;
  qualityScore: QualityScore;
  innovationScore: InnovationScore;
  totalScore: number;
}
```

### TemplateService

模板服务，管理项目创建模板。

```typescript
interface TemplateService {
  // 创建模板
  createTemplate(project: Project, name: string, description?: string): Promise<Template>;
  
  // 获取模板列表
  getTemplates(filters?: TemplateFilters): Promise<Template[]>;
  
  // 获取模板详情
  getTemplate(templateId: string): Promise<Template | null>;
  
  // 应用模板
  applyTemplate(templateId: string, seed: ProjectSeed): Promise<ProjectMeta>;
  
  // 更新模板
  updateTemplate(templateId: string, updates: Partial<Template>): Promise<Template>;
  
  // 删除模板
  deleteTemplate(templateId: string): Promise<void>;
  
  // 记录模板使用
  recordTemplateUsage(templateId: string): Promise<void>;
}

interface Template {
  id: string;
  name: string;
  description?: string;
  genre: string;
  style: string;
  characterStructure: CharacterStructure;
  worldFramework: WorldFramework;
  conflictPatterns: string[];
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CharacterStructure {
  protagonistCount: number;
  supportingCount: number;
  antagonistCount: number;
  relationshipPatterns: string[];
}

interface WorldFramework {
  hasPowerSystem: boolean;
  hasFactions: boolean;
  hasGeography: boolean;
  ruleCategories: string[];
}
```


### HistoryService

历史服务，记录和管理创建历史。

```typescript
interface HistoryService {
  // 记录候选方案
  recordCandidate(
    sessionId: SessionId,
    candidate: ProjectMeta,
    scores: { quality: QualityScore; innovation: InnovationScore }
  ): Promise<HistoryEntry>;
  
  // 获取会话历史
  getSessionHistory(sessionId: SessionId): Promise<HistoryEntry[]>;
  
  // 获取用户历史
  getUserHistory(userId: string, limit?: number): Promise<HistoryEntry[]>;
  
  // 恢复历史候选
  restoreCandidate(entryId: string): Promise<ProjectMeta>;
  
  // 清理过期历史
  cleanupHistory(retentionDays: number): Promise<number>;
}

interface HistoryEntry {
  id: string;
  sessionId: SessionId;
  candidate: ProjectMeta;
  qualityScore: QualityScore;
  innovationScore: InnovationScore;
  timestamp: Date;
  metadata: {
    modelUsed: string;
    tokensUsed: number;
    generationTime: number;
  };
}
```

### FeedbackLearningService

反馈学习服务，收集用户反馈并优化生成。

```typescript
interface FeedbackLearningService {
  // 记录用户反馈
  recordFeedback(
    userId: string,
    candidateId: string,
    feedback: UserFeedback
  ): Promise<void>;
  
  // 分析用户偏好
  analyzeUserPreferences(userId: string): Promise<UserPreferences>;
  
  // 获取个性化参数
  getPersonalizedParameters(userId: string): Promise<GenerationParameters>;
  
  // 推荐模板
  recommendTemplates(userId: string, limit?: number): Promise<Template[]>;
  
  // 生成个性化建议
  generatePersonalizedSuggestions(
    userId: string,
    context: ProjectContext
  ): Promise<string[]>;
}

interface UserFeedback {
  rating: number;  // 1-5
  tags: string[];  // 'excellent', 'good', 'poor', etc.
  comments?: string;
}

interface UserPreferences {
  favoriteGenres: string[];
  favoriteStyles: string[];
  characterPreferences: {
    preferredRoles: string[];
    preferredComplexity: 'simple' | 'moderate' | 'complex';
  };
  worldPreferences: {
    preferredElements: string[];
    preferredComplexity: 'simple' | 'moderate' | 'complex';
  };
  innovationTolerance: number;  // 0-1, 对创新的接受度
}

interface GenerationParameters {
  temperature: number;
  characterDepth: number;
  worldComplexity: number;
  innovationBias: number;
  styleHints: string[];
}
```

## Data Models

### Session

创建会话，记录用户的创建过程。

```typescript
interface Session {
  id: SessionId;
  userId?: string;
  mode: CreationMode;
  seed: ProjectSeed;
  currentStep: CreationStep;
  stepResults: Map<CreationStep, StepResult>;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

type CreationMode = 'quick' | 'stepwise';
type CreationStep = 'basic' | 'characters' | 'world' | 'outline' | 'finalize';
type SessionStatus = 'active' | 'paused' | 'completed' | 'expired';

interface StepResult {
  step: CreationStep;
  data: any;
  candidates?: ProjectMeta[];
  selectedCandidate?: ProjectMeta;
  timestamp: Date;
}
```

### ProjectMeta

项目元数据，AI生成的核心内容。

```typescript
interface ProjectMeta {
  title: string;
  premise: string;
  genre: string;
  style: string;
  themeTags: string[];
  toneProfile: string;
  coreConflicts: string[];
  mainEntities: Character[];
  worldRules: WorldRule[];
  worldSettings: WorldSetting;
  keywords: string[];
}

interface WorldRule {
  category: string;
  content: string;
  priority: number;
}
```

### CreationResult

创建结果，包含最终的项目和元数据。

```typescript
interface CreationResult {
  projectId: string;
  project: Project;
  meta: ProjectMeta;
  qualityScore: QualityScore;
  innovationScore: InnovationScore;
  executionLogs: ExecutionLog[];
  sessionId: SessionId;
}

interface ExecutionLog {
  executionId: string;
  templateId: string;
  modelId: string;
  tokensUsed: number;
  timestamp: Date;
  result: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 创建模式选择可见性
*For any* 用户启动项目创建的操作，系统应该显示"快速创建"和"分步创建"两种模式选项
**Validates: Requirements 1.1**

### Property 2: 分步创建流程顺序性
*For any* 分步创建会话，系统应该按照"基础信息→角色生成→世界观生成→大纲生成"的固定顺序引导用户
**Validates: Requirements 1.2**

### Property 3: 步骤完成后的交互性
*For any* 完成的创建步骤，系统应该展示生成结果并提供编辑和重新生成选项
**Validates: Requirements 1.3**

### Property 4: 重新生成的随机性
*For any* 重新生成操作，系统应该使用不同的随机种子，导致生成结果的差异
**Validates: Requirements 1.4**

### Property 5: 会话持久化
*For any* 用户在创建过程中关闭页面的操作，系统应该将当前进度保存到Session中
**Validates: Requirements 1.5**

### Property 6: 会话恢复一致性
*For any* 未完成的创建会话，重新打开后应该恢复到保存时的步骤和数据状态（round-trip property）
**Validates: Requirements 1.6**

### Property 7: 角色生成完整性
*For any* 生成的角色，应该包含性格、外貌、背景、能力、动机、内心冲突和隐藏目标所有必需字段
**Validates: Requirements 2.1**

### Property 8: 关系网络生成
*For any* 包含多个角色的项目，系统应该生成角色间的关系网络
**Validates: Requirements 2.2**

### Property 9: 主角特殊要求
*For any* 生成的主角，应该具有明确的成长路径字段和至少一个内心冲突
**Validates: Requirements 2.4**

### Property 10: 类型到模板映射
*For any* 项目类型，系统应该选择对应的世界观模板
**Validates: Requirements 3.1**

### Property 11: 世界规则冲突检测
*For any* 检测到冲突的世界规则集合，系统应该标记冲突并提供修正建议
**Validates: Requirements 3.6**

### Property 12: 创新性评分完整性
*For any* 项目元数据，创新性评估应该返回一个0-100的分数和检测到的俗套列表
**Validates: Requirements 4.1**

### Property 13: 俗套标注详细性
*For any* 检测到的陈词滥调，系统应该标注俗套类型和出现位置
**Validates: Requirements 4.2**

### Property 14: 创新建议数量
*For any* 检测到的俗套设定，系统应该提供至少3个创新性替代建议
**Validates: Requirements 4.3**

### Property 15: 世界观创新性评估
*For any* 世界观设定，系统应该返回独特性评估结果
**Validates: Requirements 4.4**

### Property 16: 角色创新性评估
*For any* 角色设定，系统应该返回复杂度和非典型性评估结果
**Validates: Requirements 4.5**

### Property 17: 冲突创新性评估
*For any* 冲突设定，系统应该返回是否超越常见模式的评估结果
**Validates: Requirements 4.6**

### Property 18: 模板提取完整性
*For any* 保存为模板的项目，模板应该包含类型、风格、角色结构和世界观框架字段
**Validates: Requirements 5.2**

### Property 19: 模板应用一致性
*For any* 使用模板创建的项目，应该使用模板的配置参数但生成不同的具体内容
**Validates: Requirements 5.4**

### Property 20: 模板删除隔离性
*For any* 删除的模板，使用该模板创建的项目应该不受影响继续存在
**Validates: Requirements 5.6**

### Property 21: 质量评分维度完整性
*For any* 候选方案，质量评分应该包含完整性、一致性、丰富度、可写性、语义质量和创新性所有维度
**Validates: Requirements 6.2**

### Property 22: LLM合并策略
*For any* 候选方案合并操作，系统应该调用LLM进行智能合并而非仅使用启发式规则
**Validates: Requirements 6.3**

### Property 23: 最终验证执行
*For any* 生成的最终元数据，系统应该执行规则验证和语义一致性检查步骤
**Validates: Requirements 6.4**

### Property 24: 低质量触发重生成
*For any* 质量评分低于阈值的候选方案，系统应该自动触发重新生成或提示用户调整
**Validates: Requirements 6.5**

### Property 25: 优化建议生成
*For any* 用户请求优化的项目，系统应该基于质量评估生成具体的改进建议
**Validates: Requirements 6.6**

### Property 26: 候选方案历史记录
*For any* 生成的候选方案，应该能在创建历史中找到对应的记录
**Validates: Requirements 7.1**

### Property 27: 历史恢复一致性
*For any* 从历史恢复的候选方案，应该与原始候选方案的内容一致
**Validates: Requirements 7.3**

### Property 28: 创建日志完整性
*For any* 完成的项目创建，应该保存包含所有AI调用记录的完整日志
**Validates: Requirements 7.4**

### Property 29: 导出包含历史
*For any* 导出的项目，应该包含创建历史和版本信息字段
**Validates: Requirements 7.5**

### Property 30: 历史清理保留策略
*For any* 历史数据清理操作，应该保留最近30天的创建历史
**Validates: Requirements 7.6**

### Property 31: AI调用重试机制
*For any* AI调用失败，系统应该自动重试最多3次并使用指数退避策略
**Validates: Requirements 8.1**

### Property 32: 失败后状态保存
*For any* 重试仍然失败的创建操作，系统应该保存当前状态
**Validates: Requirements 8.2**

### Property 33: 网络中断缓存
*For any* 网络连接中断的情况，系统应该将已生成的内容保存到本地缓存
**Validates: Requirements 8.3**

### Property 34: 数据不一致回滚
*For any* 检测到的数据不一致状态，系统应该回滚到最后一个一致状态
**Validates: Requirements 8.5**

### Property 35: 反馈记录持久化
*For any* 用户对内容的评分操作，系统应该记录评分和对应的生成参数
**Validates: Requirements 9.1**

### Property 36: 偏好模式识别
*For any* 用户多次使用的风格或类型，系统应该识别出用户的偏好模式
**Validates: Requirements 9.2**

### Property 37: 偏好影响生成参数
*For any* 新内容生成操作，生成参数应该受到用户历史偏好的影响
**Validates: Requirements 9.3**

### Property 38: 正向反馈强化
*For any* 标记为"优秀"的候选方案，后续生成应该倾向于相似的特征
**Validates: Requirements 9.4**

### Property 39: 负向反馈规避
*For any* 标记为"不满意"的候选方案，后续生成应该避免相似的模式
**Validates: Requirements 9.5**

### Property 40: 个性化推荐相关性
*For any* 个性化推荐结果，应该与用户的历史行为和偏好相关
**Validates: Requirements 9.6**


## Error Handling

### 错误分类

系统将错误分为以下几类，并采用不同的处理策略：

#### 1. 可重试错误 (Retriable Errors)
- **AI服务超时**: 使用指数退避重试，最多3次
- **网络连接失败**: 立即重试1次，然后使用指数退避
- **临时服务不可用**: 等待后重试

#### 2. 不可重试错误 (Non-Retriable Errors)
- **无效输入**: 立即返回错误，提示用户修正
- **权限不足**: 返回错误，引导用户登录或升级
- **配置错误**: 返回错误，提示管理员检查配置

#### 3. 部分失败 (Partial Failures)
- **部分候选生成失败**: 使用成功的候选继续
- **部分质量检查失败**: 标记问题但不阻止流程
- **可选步骤失败**: 跳过该步骤，记录警告

### 重试策略

```typescript
interface RetryStrategy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  initialDelay: 1000,  // 1秒
  maxDelay: 10000,     // 10秒
  backoffMultiplier: 2,
  retryableErrors: ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE']
};
```

### 状态恢复

系统在以下时机保存状态，确保可恢复：

1. **每个步骤完成后**: 保存步骤结果到Session
2. **AI调用前**: 保存当前状态
3. **用户主动保存**: 响应用户的保存操作
4. **定时自动保存**: 每30秒自动保存一次

### 错误通知

```typescript
interface ErrorNotification {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: string;
  recoveryOptions: RecoveryOption[];
  timestamp: Date;
}

interface RecoveryOption {
  label: string;
  action: () => Promise<void>;
  recommended: boolean;
}
```

## Testing Strategy

### 单元测试 (Unit Tests)

单元测试覆盖各个组件的核心逻辑：

#### CharacterGenerator
- 测试生成的角色包含所有必需字段
- 测试不同角色类型的生成
- 测试角色细节补充功能

#### RelationshipInferrer
- 测试关系推断的基本逻辑
- 测试关系验证功能
- 测试关系网络优化

#### InnovationEvaluator
- 测试已知俗套的检测
- 测试创新性评分计算
- 测试建议生成功能

#### QualityScorer
- 测试各个维度的评分逻辑
- 测试综合评分计算
- 测试质量问题识别

#### SessionManager
- 测试会话创建和更新
- 测试会话持久化
- 测试会话过期清理

### 属性测试 (Property-Based Tests)

属性测试验证系统在各种输入下的正确性。使用 **fast-check** 作为属性测试库，每个测试运行至少100次迭代。

#### 测试配置
```typescript
import fc from 'fast-check';

const testConfig = {
  numRuns: 100,  // 最少运行100次
  timeout: 5000,  // 单次测试超时5秒
};
```

#### 关键属性测试

**会话持久化与恢复** (Property 5 & 6)
```typescript
// Feature: project-creation-enhancement, Property 6: 会话恢复一致性
// Validates: Requirements 1.6
it('should restore session to saved state', async () => {
  await fc.assert(
    fc.asyncProperty(
      sessionArbitrary(),
      async (session) => {
        // 保存会话
        await sessionManager.updateSession(session.id, session.state);
        
        // 模拟页面关闭和重新打开
        const restored = await sessionManager.getSession(session.id);
        
        // 验证恢复的状态与保存的状态一致
        expect(restored).toEqual(session);
      }
    ),
    testConfig
  );
});
```

**角色生成完整性** (Property 7)
```typescript
// Feature: project-creation-enhancement, Property 7: 角色生成完整性
// Validates: Requirements 2.1
it('should generate characters with all required fields', async () => {
  await fc.assert(
    fc.asyncProperty(
      projectContextArbitrary(),
      characterRoleArbitrary(),
      async (context, role) => {
        const character = await characterGenerator.generateCharacter(context, role);
        
        // 验证所有必需字段存在
        expect(character.name).toBeDefined();
        expect(character.personality).toBeDefined();
        expect(character.appearance).toBeDefined();
        expect(character.background).toBeDefined();
        expect(character.abilities).toBeDefined();
        expect(character.motivation).toBeDefined();
        expect(character.innerConflict).toBeDefined();
        expect(character.hiddenGoal).toBeDefined();
        expect(character.growthPath).toBeDefined();
      }
    ),
    testConfig
  );
});
```

**模板应用一致性** (Property 19)
```typescript
// Feature: project-creation-enhancement, Property 19: 模板应用一致性
// Validates: Requirements 5.4
it('should use template config but generate different content', async () => {
  await fc.assert(
    fc.asyncProperty(
      templateArbitrary(),
      seedArbitrary(),
      async (template, seed) => {
        const meta1 = await templateService.applyTemplate(template.id, seed);
        const meta2 = await templateService.applyTemplate(template.id, seed);
        
        // 验证使用了相同的配置
        expect(meta1.genre).toBe(template.genre);
        expect(meta2.genre).toBe(template.genre);
        
        // 验证生成了不同的内容
        expect(meta1.title).not.toBe(meta2.title);
        expect(meta1.premise).not.toBe(meta2.premise);
      }
    ),
    testConfig
  );
});
```

**重试机制** (Property 31)
```typescript
// Feature: project-creation-enhancement, Property 31: AI调用重试机制
// Validates: Requirements 8.1
it('should retry failed AI calls with exponential backoff', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 3 }),
      async (failCount) => {
        let attempts = 0;
        const delays: number[] = [];
        
        const mockAI = {
          generate: async () => {
            attempts++;
            const delay = Date.now();
            if (attempts <= failCount) {
              throw new Error('TIMEOUT');
            }
            delays.push(Date.now() - delay);
            return { content: 'success' };
          }
        };
        
        await retryWithBackoff(mockAI.generate, defaultRetryStrategy);
        
        // 验证重试次数
        expect(attempts).toBe(failCount + 1);
        
        // 验证指数退避
        for (let i = 1; i < delays.length; i++) {
          expect(delays[i]).toBeGreaterThan(delays[i - 1]);
        }
      }
    ),
    testConfig
  );
});
```

**偏好学习** (Property 36 & 37)
```typescript
// Feature: project-creation-enhancement, Property 37: 偏好影响生成参数
// Validates: Requirements 9.3
it('should adjust generation parameters based on user preferences', async () => {
  await fc.assert(
    fc.asyncProperty(
      userIdArbitrary(),
      fc.array(feedbackArbitrary(), { minLength: 5, maxLength: 20 }),
      async (userId, feedbacks) => {
        // 记录多次反馈
        for (const feedback of feedbacks) {
          await feedbackLearningService.recordFeedback(userId, feedback.candidateId, feedback);
        }
        
        // 获取个性化参数
        const params = await feedbackLearningService.getPersonalizedParameters(userId);
        
        // 验证参数受到反馈影响
        const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length;
        
        if (avgRating >= 4) {
          // 高评分应该保持当前风格
          expect(params.innovationBias).toBeLessThan(0.5);
        } else {
          // 低评分应该尝试更多创新
          expect(params.innovationBias).toBeGreaterThan(0.5);
        }
      }
    ),
    testConfig
  );
});
```

### 集成测试 (Integration Tests)

集成测试验证组件间的协作：

- **完整创建流程**: 测试从种子到项目的完整流程
- **分步创建流程**: 测试分步创建的每个阶段
- **模板创建和应用**: 测试模板的完整生命周期
- **错误恢复流程**: 测试各种错误场景的恢复

### 测试数据生成器 (Arbitraries)

```typescript
// 会话生成器
const sessionArbitrary = () => fc.record({
  id: fc.uuid(),
  mode: fc.constantFrom('quick', 'stepwise'),
  seed: seedArbitrary(),
  currentStep: fc.constantFrom('basic', 'characters', 'world', 'outline'),
  status: fc.constantFrom('active', 'paused'),
});

// 项目种子生成器
const seedArbitrary = () => fc.record({
  titleSeed: fc.string({ minLength: 5, maxLength: 50 }),
  premise: fc.option(fc.string({ minLength: 50, maxLength: 500 })),
  genre: fc.option(fc.constantFrom('玄幻', '都市', '科幻', '仙侠')),
  style: fc.option(fc.string({ minLength: 5, maxLength: 30 })),
});

// 角色类型生成器
const characterRoleArbitrary = () => 
  fc.constantFrom('protagonist', 'supporting', 'antagonist');

// 反馈生成器
const feedbackArbitrary = () => fc.record({
  candidateId: fc.uuid(),
  rating: fc.integer({ min: 1, max: 5 }),
  tags: fc.array(fc.constantFrom('excellent', 'good', 'average', 'poor'), { maxLength: 3 }),
  comments: fc.option(fc.string({ maxLength: 200 })),
});
```
