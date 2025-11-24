// Enhanced AI-Driven Novel Project Creation Service
// Implements the full algorithm from design document with improvements:
// 1. Vector-based scoring using embedding models
// 2. Candidate merging strategy
// 3. Prompt packing with token budget management
// 4. Automatic model routing

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { promptPackingService, type PromptModule } from "./prompt-packing-service";
import { modelRoutingService } from "./model-routing-service";
import { semanticCacheService } from "./semantic-cache-service";
import { ruleCheckerService } from "./rule-checker-service";
import { generationLogService } from "./generation-log-service";
import { costMonitorService } from "./cost-monitor-service";
import { configService } from "./config-service";
import { extractJSON } from "./utils/json-extractor";
import { detectCliches, hasUnusualWorldRules, hasComplexMotivations, hasOriginalConflicts } from "./utils/cliche-detector";
import { fewShotExamplesService } from "./few-shot-examples-service";
import { aiPerformanceOptimizer } from "./ai-performance-optimizer";
import { z } from "zod";
import crypto from "crypto";
import {
  extractGender,
  extractAge,
  extractRelationships,
  generateGrowthPath,
  generateInitialArcPoints,
  extractInitialEmotion,
  createEnhancedWorldSettings,
  createEnhancedOutlines,
} from "./project-creation-enhancements";
import { genreConfigService } from "./genre-config-service";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProjectSeed {
  titleSeed: string;
  premise?: string;
  genre?: string;
  style?: string;
  targetWordCount?: number;
  targetCharacterCount?: number;
}

export interface ProjectMeta {
  title: string;
  premise: string;
  genre?: string;
  style?: string;
  themeTags: string[];
  toneProfile: string;
  coreConflicts: string[];
  mainEntities: EntitySummary[];
  worldRules: string[];
  worldSettings?: any; // WorldSetting from world-generator
  worldMystery?: string; // [NEW] 世界谜团/隐藏真相
  keywords: string[];
  // Directives for parallel generation
  worldDirective?: string;
  characterDirective?: string;
  // Stepwise creation additions
  outline?: string;
  overallOutline?: string; // 总纲（别名）
  plotPoints?: any[];
  opening?: string;
  climax?: string;
  ending?: string;
  estimatedChapters?: number;
  relationships?: any[];
}

export interface EntitySummary {
  name: string;
  role: string;
  shortMotivation: string;
  personality?: string; // 性格特点
  appearance?: string; // 外貌特征
  background?: string; // 背景故事
  abilities?: string; // 能力特长
  // 扩展字段（来自Character接口）
  motivation?: string; // 核心动机
  innerConflict?: string; // 内心冲突
  hiddenGoal?: string; // 隐藏目标
  growthPath?: string; // 成长路径
  flaw?: string; // [NEW] 弱点/缺陷
  habit?: string; // [NEW] 习惯/怪癖
}

export interface ScoredCandidate {
  candidate: ProjectMeta;
  ruleScore: number;
  semanticScore: number;
  totalScore: number;
  embedding?: number[];
}

export interface PromptExecutionLog {
  executionId: string;
  templateId: string;
  templateVersion: string;
  promptHash: string;
  promptMetadata: any;
  modelId: string;
  modelVersion: string;
  params: Record<string, any>;
  responseHash: string;
  responseSummary: string;
  tokensUsed: number;
  timestamp: Date;
}

// ============================================================================
// Enhanced Project Creation Service
// ============================================================================

// Zod schema for ProjectMeta validation with defaults
const ProjectMetaSchema = z.object({
  title: z.string().min(1),
  premise: z.string().min(50),
  themeTags: z.array(z.string()).optional().default([]),
  toneProfile: z.string().optional().default(""),
  coreConflicts: z.array(z.string()).optional().default([]),
  mainEntities: z.array(z.object({
    name: z.string(),
    role: z.string(),
    shortMotivation: z.string(),
    personality: z.string().optional(),
    appearance: z.string().optional(),
    background: z.string().optional(),
    abilities: z.string().optional(),
    flaw: z.string().optional(),
    habit: z.string().optional(),
  })).optional().default([]),
  worldRules: z.array(z.string()).optional().default([]),
  keywords: z.array(z.string()).optional().default([]),
  worldMystery: z.string().optional(),
  worldDirective: z.string().optional(),
  characterDirective: z.string().optional(),
}).transform((data) => ({
  ...data,
  themeTags: data.themeTags || [],
  toneProfile: data.toneProfile || "",
  coreConflicts: data.coreConflicts || [],
  mainEntities: data.mainEntities || [],
  worldRules: data.worldRules || [],
  keywords: data.keywords || [],
}));

export class EnhancedProjectCreationService {
  private readonly TEMPLATE_VERSION = "2.0.0";
  private readonly MAX_CANDIDATES = 3;
  private readonly TOKEN_BUDGET = 4000; // Max tokens for prompt

  /**
   * Create project with full algorithm implementation
   */
  async createProjectFromSeed(
    seed: ProjectSeed,
    onProgress?: (step: string, status: string, message: string, progress: number, metadata?: any) => void
  ): Promise<{
    projectId: string;
    projectMeta: ProjectMeta;
    executionLogs: PromptExecutionLog[];
    routingDecision: string;
  }> {
    const executionLogs: PromptExecutionLog[] = [];

    try {
      // Step 0: Check cache first (skip if no embedding model)
      onProgress?.("routing", "running", "检查缓存...", 3);

      let semanticSig: { signature: number[]; hash: string } | null = null;
      let cacheAvailable = false;

      try {
        // Check if embedding model is available
        const models = await storage.getAIModels();
        const embeddingModel = models.find(
          (m) => m.modelType === "embedding" && m.isActive && m.isDefaultEmbedding
        );

        if (!embeddingModel) {
          console.log("[Cache] No embedding model configured, skipping cache check");
        } else {
          cacheAvailable = true;
          semanticSig = await semanticCacheService.calculateSignature(seed);
          const cached = await semanticCacheService.findSimilar(
            semanticSig.signature,
            "project-meta-generation-v2"
          );

          if (cached) {
            onProgress?.("routing", "running", "验证缓存...", 5);
            const isValid = await semanticCacheService.quickVerify(cached.cached, seed);

            if (isValid) {
              console.log(`[Cache HIT] Using cached result (similarity: ${cached.similarity.toFixed(3)})`);
              await semanticCacheService.recordHit(cached.cached.executionId);
              onProgress?.("save", "completed", "使用缓存结果", 100, {
                cacheHit: true,
                similarity: cached.similarity,
                quality: cached.cached.metadata.quality,
              });

              return {
                projectId: cached.cached.result.projectId,
                projectMeta: cached.cached.result.projectMeta,
                executionLogs: [],
                routingDecision: "Cache Hit",
              };
            } else {
              console.log("[Cache MISS] Verification failed, generating new");
            }
          }
        }
      } catch (cacheError) {
        console.log("[Cache] Cache check failed:", cacheError instanceof Error ? cacheError.message : cacheError);
        // Continue without cache
        cacheAvailable = false;
      }

      // Step 1: Calculate routing signals
      onProgress?.("routing", "running", "计算路由信号...", 8);
      const seedComplexity = this.calculateSeedComplexity(seed);
      const signals = modelRoutingService.calculateProjectCreationSignals(
        !!seed.premise,
        !!seed.genre,
        seedComplexity
      );

      // Step 2: Route to appropriate model
      onProgress?.("routing", "running", "选择最佳模型...", 12);
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Model Routing] ${routing.reasoning}`);
      onProgress?.("routing", "completed", `已选择: ${routing.primaryModel}`, 15);

      // Fetch actual model objects
      const allModels = await storage.getAIModels();
      const primaryModelObj = allModels.find(m => m.id === routing.primaryModel || m.modelId === routing.primaryModel);
      const fallbackModelObj = routing.fallbackModel ? allModels.find(m => m.id === routing.fallbackModel || m.modelId === routing.fallbackModel) : undefined;

      if (!primaryModelObj) {
        throw new Error(`Selected primary model ${routing.primaryModel} not found`);
      }

      // Step 3: Build prompt with packing
      onProgress?.("prompt", "running", "构建提示词模块...", 20);
      const promptModules = this.buildPromptModules(seed);
      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(
        `[Prompt Packing] Used ${packedPrompt.metadata.totalTokens} tokens (${(packedPrompt.metadata.budgetUsed * 100).toFixed(1)}% of budget)`
      );
      onProgress?.("prompt", "completed", `已打包 ${packedPrompt.metadata.totalTokens} tokens`, 30);

      // Step 4: Generate multiple candidates
      onProgress?.("generate", "running", "AI生成候选方案 (1/3)...", 35);
      const candidates = await this.generateCandidatesWithRouting(
        packedPrompt.promptText,
        seed,
        primaryModelObj,
        fallbackModelObj,
        executionLogs,
        (index, total) => {
          const progress = 35 + (index / total) * 30;
          onProgress?.("generate", "running", `AI生成候选方案 (${index}/${total})...`, progress);
        }
      );

      if (candidates.length === 0) {
        throw new Error("AI生成失败，未能生成有效的项目元数据");
      }
      onProgress?.("generate", "completed", `已生成 ${candidates.length} 个候选方案`, 65);

      // Step 5: Score candidates (rule-based + semantic)
      onProgress?.("score", "running", "评分候选方案...", 70);
      const scoredCandidates = await this.scoreCandidates(candidates);
      onProgress?.("score", "running", "合并最佳方案...", 75);

      // Step 6: Merge best candidates
      const mergedMeta = await this.mergeCandidatesIntelligently(scoredCandidates, seed);
      onProgress?.("score", "running", "验证质量...", 75);

      // Step 6.5: Validate merged result with enhanced quality evaluation
      const validation = await ruleCheckerService.validate(mergedMeta, {
        checkSemantics: false, // Skip slow semantic check in creation flow
        checkWritability: false,
      });

      // Quality evaluation removed for speed - use validation score directly
      const qualityEvaluation = {
        overall: validation.score,
        dimensions: {},
        suggestions: [],
      };

      console.log(`[Validation] Score: ${validation.score}, Passed: ${validation.passed}`);
      console.log(`[Validation] ${validation.summary}`);

      if (!validation.passed) {
        console.warn("[Validation] Quality issues detected:", validation.violations);
        // Continue anyway but log warnings
      }

      onProgress?.("score", "completed", `已完成方案合并 (分数: ${qualityEvaluation.overall})`, 80, {
        quality: qualityEvaluation.overall,
        dimensions: qualityEvaluation.dimensions,
      });

      // Step 7: Create project in database
      onProgress?.("save", "running", "保存项目信息...", 85);
      const project = await storage.createProject({
        title: mergedMeta.title,
        genre: seed.genre || this.inferGenre(mergedMeta),
        style: seed.style || mergedMeta.toneProfile,
        targetWordCount: seed.targetWordCount || 0,
        currentWordCount: 0,
        status: "active",
        description: mergedMeta.premise,
      });

      // Step 8: Create related entities
      onProgress?.("save", "running", "创建角色和世界观...", 90);
      await this.createProjectEntities(project.id, mergedMeta);

      // Step 9: Save execution logs and record to generation log service
      onProgress?.("save", "running", "保存执行日志...", 95);

      // Calculate total tokens and cost
      const totalTokens = executionLogs.reduce((sum, log) => sum + log.tokensUsed, 0);
      const totalCost = this.calculateTotalCost(executionLogs);

      for (const log of executionLogs) {
        // Save to prompt_executions table (legacy)
        await storage.createPromptExecution({
          id: log.executionId,
          projectId: project.id,
          templateId: log.templateId,
          templateVersion: log.templateVersion,
          promptHash: log.promptHash,
          promptMetadata: log.promptMetadata,
          modelId: log.modelId,
          modelVersion: log.modelVersion,
          params: log.params,
          responseHash: log.responseHash,
          responseSummary: log.responseSummary,
          tokensUsed: log.tokensUsed,
          timestamp: log.timestamp,
          signature: null,
        });

        // Record to generation_logs table (new)
        const logCost = this.calculateCost(log.tokensUsed, log.modelId);
        await generationLogService.createLog({
          executionId: log.executionId,
          projectId: project.id,
          chapterId: undefined,
          sceneId: undefined,
          templateId: log.templateId,
          templateVersion: log.templateVersion,
          promptSignature: log.promptHash,
          promptMetadata: log.promptMetadata,
          modelId: log.modelId,
          modelVersion: log.modelVersion,
          params: log.params,
          routeDecision: routing,
          cachePath: undefined,
          responseHash: log.responseHash,
          responseSummary: log.responseSummary,
          tokensUsed: log.tokensUsed,
          cost: logCost,
          qualityScore: qualityEvaluation,
          ruleViolations: validation.violations || [],
          repairActions: undefined,
        });

        // Record cost monitoring
        await costMonitorService.recordUsage(
          log.executionId,
          log.tokensUsed,
          log.modelId
        );
      }

      console.log(`[Cost] Total tokens: ${totalTokens}, Total cost: ¥${(totalCost / 100).toFixed(4)}`);

      onProgress?.("save", "running", "缓存结果...", 98);

      // Step 10: Cache the result for future use (only if cache is available)
      if (cacheAvailable && semanticSig) {
        try {
          const finalValidation = await ruleCheckerService.validate(mergedMeta, {
            checkSemantics: false,
            checkWritability: false,
          });

          await semanticCacheService.cacheResult(
            this.generateExecutionId(),
            "project-meta-generation-v2",
            semanticSig.signature,
            semanticSig.hash,
            this.hashContent(JSON.stringify(seed)),
            {
              projectId: project.id,
              projectMeta: mergedMeta,
              executionLogs,
              routingDecision: routing.reasoning,
            },
            seed,
            finalValidation.score
          );
          console.log("[Cache] Successfully cached result");
        } catch (cacheError) {
          console.log("[Cache] Failed to cache result:", cacheError instanceof Error ? cacheError.message : cacheError);
          // Continue anyway - caching is not critical
        }
      } else {
        console.log("[Cache] Skipping cache save (cache not available or no signature)");
      }

      onProgress?.("save", "completed", "项目创建完成！", 100);

      return {
        projectId: project.id,
        projectMeta: mergedMeta,
        executionLogs,
        routingDecision: routing.reasoning,
      };
    } catch (error: any) {
      throw new Error(`项目创建失败: ${error.message}`);
    }
  }

  /**
   * Generate basic project info (Phase 1 of Unified Flow)
   */
  async generateBasicInfo(
    seed: ProjectSeed,
    options?: { modelId?: string; temperature?: number }
  ): Promise<Partial<ProjectMeta>> {
    const prompt = `你是一位资深的小说策划专家。请基于以下创意种子，生成完整的基础项目信息和创作指导原则。

# 用户输入
标题/创意：${seed.titleSeed}
${seed.premise ? `简介：${seed.premise}` : ""}
类型：${seed.genre || "未指定（请根据创意推断）"}
风格：${seed.style || "未指定（请根据创意推断）"}

# 任务
请生成以下内容：
1. 优化后的标题
2. 完善的故事简介（100-200字）
3. 3-5个主题标签
4. 2-3个核心冲突
5. 基调描述
6. 5-10个关键词
7. **世界观指导原则**：简述世界的核心规则、力量体系基调和氛围（50-100字）。
8. **角色设计指导原则**：简述主要角色的总体风格、关系网络基调和所需的典型原型（50-100字）。

# 输出格式
请严格按照以下JSON格式输出：

{
  "title": "优化后的标题",
  "premise": "完善的故事简介",
  "genre": "${seed.genre || "AI推断的类型"}",
  "style": "${seed.style || "AI推断的风格"}",
  "themeTags": ["主题1", "主题2"],
  "coreConflicts": ["冲突1", "冲突2"],
  "toneProfile": "基调描述",
  "keywords": ["关键词1", "关键词2"],
  "worldDirective": "世界观指导原则...",
  "characterDirective": "角色设计指导原则..."
}

**重要**：
1. 所有内容使用中文
2. 指导原则将用于后续并行生成角色和世界观，必须清晰明确`;

    // Get model
    let modelId = options?.modelId;
    let provider = "openai"; // default
    let baseUrl = "";
    let apiKey = "";

    if (!modelId) {
      const models = await storage.getAIModels();
      const defaultModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);
      if (defaultModel) {
        modelId = defaultModel.modelId;
        provider = defaultModel.provider;
        baseUrl = defaultModel.baseUrl || "";
        apiKey = defaultModel.apiKey || "";
      } else {
        throw new Error("No default chat model configured");
      }
    } else {
      // Look up provider for provided modelId
      const models = await storage.getAIModels();
      const model = models.find(m => m.modelId === modelId);
      if (model) {
        provider = model.provider;
        baseUrl = model.baseUrl || "";
        apiKey = model.apiKey || "";
      }
    }

    const result = await aiService.generate({
      prompt,
      modelId: modelId!,
      provider,
      baseUrl,
      apiKey,
      parameters: {
        temperature: options?.temperature || 0.7,
        maxTokens: 1500,
      },
      responseFormat: "json",
    });

    return extractJSON(result.content);
  }

  /**
   * Build modular prompt components
   */
  /**
   * Build modular prompt components
   */
  private buildPromptModules(seed: ProjectSeed): PromptModule[] {
    const modules: PromptModule[] = [];

    // System role (must-have)
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: "你是一位资深的网络小说策划专家，擅长创作各类网络小说的核心设定和世界观架构。请确保所有输出内容使用纯正的中文，不要使用英文词汇或拼音。",
      estimatedTokens: 30,
      compressible: false,
    });

    // Seed input (must-have)
    modules.push({
      id: "seed-input",
      priority: "must-have",
      content: `# 创意种子\n标题/概念: ${seed.titleSeed}\n${seed.premise ? `简介: ${seed.premise}\n` : ""}${seed.genre ? `类型: ${seed.genre}\n` : ""}${seed.style ? `风格: ${seed.style}` : ""}`,
      estimatedTokens: 50,
      compressible: false,
    });

    // Innovation Guidelines (New - Content P0)
    modules.push({
      id: "innovation-guidelines",
      priority: "important",
      content: `# 创意激发
**目标**: 创作一个令人耳目一新的故事，打破常规，探索未知的可能性。

## 推荐尝试的方向
- **反套路设定**: 思考传统套路的对立面。例如，如果传统是"逆天改命"，那么"顺应天命但寻找自由"会是怎样的？
- **深度动机**: 赋予角色复杂的内心驱动力。不仅仅是仇恨或贪婪，还可以是信仰、救赎、对真理的渴望或扭曲的爱。
- **独特世界观**: 创造一个有独特规则的世界。请描述世界的**感官细节**（气味、声音、光影），而不仅仅是规则。
- **核心冲突**: 聚焦于**两难困境**（Dilemma），即角色必须在两个同样重要或同样糟糕的选项中做选择，而不仅仅是简单的打斗。

## 避免单一化
不要让故事流于表面。如果主角要复仇，请探讨复仇带来的空虚；如果主角要变强，请展示变强背后的代价。`,
      estimatedTokens: 250,
      compressible: false,
    });

    // Task requirements (important)
    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请生成一个结构化的小说项目元数据，包含以下内容：

1. **标题**: 一个吸引人的小说标题
2. **核心设定**: 200-300字的核心设定和故事梗概
3. **主题标签**: 3-5个核心主题标签（如：成长、复仇、权谋、爱情等）
4. **基调风格**: 描述小说的整体基调（如：轻松幽默、热血激昂、黑暗压抑等）
5. **核心冲突**: 3-5个主要冲突点（侧重于两难选择和价值观冲突）
6. **主要角色**: 3-5个核心角色，每个包含：
   - name: 角色名字
   - role: 角色定位（主角/配角/反派）
   - shortMotivation: 简短的动机描述（20-50字）
   - personality: 性格特点（30-80字）
   - appearance: 外貌特征（30-80字）
   - background: 背景故事（50-150字）
   - abilities: 能力特长（30-80字，如果是现实题材可以是技能或优势）
   - flaw: **致命弱点**（Fatal Flaw）或性格缺陷（如：傲慢、贪财、恐惧某物）
   - habit: 独特的习惯或怪癖（增加记忆点，如：紧张时咬手指、喜欢收集旧物）
   - innerConflict: **内在冲突**（Inner Conflict），角色内心的矛盾点
   - falseBelief: **虚假信念**（Lie），角色误以为真但实际阻碍其成长的信念
7. **世界规则**: 2-4条核心世界观规则（如果是现实题材可以是社会规则）
8. **世界谜团**: 一个关于这个世界的隐藏真相或未解之谜（增加深度）
9. **关键词**: 5-8个关键词，用于后续内容生成

**重要**: 所有内容必须使用纯正的中文，避免英文或拼音混杂。`,
      estimatedTokens: 250,
      compressible: true,
    });

    // Output format (important)
    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
**重要：必须输出有效的JSON格式，所有内容使用中文，字段名使用英文。**

严格按照以下JSON结构输出：

{
  "title": "小说标题",
  "premise": "核心设定和故事梗概（200-300字，纯中文）",
  "themeTags": ["主题1", "主题2", "主题3"],
  "toneProfile": "基调风格描述（纯中文）",
  "coreConflicts": ["冲突1", "冲突2", "冲突3"],
  "worldDirective": "世界观指导原则（50-100字）：简述世界的核心规则、力量体系基调和氛围，作为后续生成详细世界设定的纲领。",
  "characterDirective": "角色设计指导原则（50-100字）：简述主要角色的总体风格、关系网络基调和所需的典型原型，作为后续生成详细角色的纲领。",
  "mainEntities": [
    {
      "name": "角色名（中文）",
      "role": "主角",
      "shortMotivation": "动机描述（20-50字，纯中文）",
      "personality": "性格特点（30-80字，纯中文）",
      "appearance": "外貌特征（30-80字，纯中文）",
      "background": "背景故事（50-150字，纯中文）",
      "abilities": "能力特长（30-80字，纯中文）",
      "flaw": "弱点/缺陷（纯中文）",
      "habit": "习惯/怪癖（纯中文）",
      "innerConflict": "内在冲突（纯中文）",
      "falseBelief": "虚假信念（纯中文）"
    }
  ],
  "worldRules": ["规则1（纯中文）", "规则2（纯中文）"],
  "worldMystery": "世界谜团（纯中文）：关于这个世界的隐藏真相或未解之谜",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

**role 字段只能是以下值之一**: "主角"、"配角"、"反派"

注意：
- 所有字符串值必须用双引号包裹
- 所有内容必须是纯中文，不得包含英文词汇或拼音
- 数组元素之间用逗号分隔`,
      estimatedTokens: 250,
      compressible: true,
    });

    // Quality guidelines (optional)
    modules.push({
      id: "quality-guidelines",
      priority: "optional",
      content: `# 质量要求
- 确保输出是有效的JSON格式
- 内容要有创意且符合网络小说的特点
- 角色设定要有深度和吸引力
- 冲突设计要有张力和可持续性
- 世界观要自洽且有扩展性
- **特别注意**: 角色必须有内心矛盾(innerConflict)和隐藏动机(secretMotivation)`,
      estimatedTokens: 100,
      compressible: true,
    });

    return modules;
  }

  /**
   * Generate candidates with routing strategy (OPTIMIZED with parallel execution)
   */
  private async generateCandidatesWithRouting(
    prompt: string,
    seed: ProjectSeed,
    primaryModel: any,
    fallbackModel: any | undefined,
    executionLogs: PromptExecutionLog[],
    onProgress?: (current: number, total: number) => void
  ): Promise<ProjectMeta[]> {
    const candidates: ProjectMeta[] = [];

    // Optimize prompt length before generation
    const optimizedPrompt = aiPerformanceOptimizer.optimizePromptLength(prompt, 4000);
    const compressedPrompt = aiPerformanceOptimizer.compressPrompt(optimizedPrompt);

    console.log(`[Performance] Prompt optimized: ${prompt.length} -> ${compressedPrompt.length} chars`);

    // Generate candidates in parallel batches
    const maxConcurrent = 3; // Limit concurrent API calls
    const batchSize = maxConcurrent;
    const batches = Math.ceil(this.MAX_CANDIDATES / batchSize);

    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, this.MAX_CANDIDATES);
      const batchPromises: Promise<void>[] = [];

      for (let i = batchStart; i < batchEnd; i++) {
        const candidatePromise = (async () => {
          try {
            const executionId = this.generateExecutionId();

            // Inject Few-Shot Guidance for diversity
            const fewShotGuidance = await this.buildFewShotGuidance(seed, i);
            const enhancedPrompt = `${compressedPrompt}\n\n${fewShotGuidance}`;

            const promptHash = this.hashContent(enhancedPrompt);

            // Try primary model
            let result: any = null;
            let usedModel = primaryModel;

            // Use model's default parameters or override with task-specific values
            const temperature = 0.7 + i * 0.1; // Vary temperature for diversity
            const maxTokens = 2000;

            // Get dynamic timeout from config
            const timeout = await configService.getModelTimeout(
              primaryModel.id,
              "project_creation"
            );

            try {
              result = await Promise.race([
                aiService.generate({
                  prompt: enhancedPrompt,
                  modelId: primaryModel.modelId,
                  provider: primaryModel.provider,
                  baseUrl: primaryModel.baseUrl || "",
                  apiKey: primaryModel.apiKey || undefined,
                  parameters: {
                    temperature,
                    maxTokens,
                  },
                  responseFormat: "json",
                }),
                this.timeout(timeout),
              ]);
            } catch (primaryError: any) {
              // Fallback to big model if available
              if (fallbackModel) {
                console.log(
                  `[Fallback] Primary model failed, trying fallback: ${fallbackModel.modelId}`
                );
                usedModel = fallbackModel;

                // Get fallback model timeout
                const fallbackTimeout = await configService.getModelTimeout(
                  fallbackModel.id,
                  "project_creation"
                );

                result = await Promise.race([
                  aiService.generate({
                    prompt: enhancedPrompt,
                    modelId: fallbackModel.modelId,
                    provider: fallbackModel.provider,
                    baseUrl: fallbackModel.baseUrl || "",
                    apiKey: fallbackModel.apiKey || undefined,
                    parameters: {
                      temperature,
                      maxTokens,
                    },
                    responseFormat: "json",
                  }),
                  this.timeout(fallbackTimeout),
                ]);
              } else {
                throw primaryError;
              }
            }

            if (!result) {
              throw new Error("Failed to get result from AI service");
            }

            const responseHash = this.hashContent(result.content);

            // Use robust JSON extractor
            let projectMeta: ProjectMeta | null = null;
            try {
              const rawJson = extractJSON(result.content);
              // Validate with Zod
              const parsed = ProjectMetaSchema.safeParse(rawJson);

              if (parsed.success) {
                projectMeta = parsed.data;
                candidates.push(projectMeta);
              } else {
                console.error(`[Validation Error] ${parsed.error.message}`);
              }
            } catch (e: any) {
              console.error(`[Parse Error] ${e.message}`);
              console.log("Raw content:", result.content.substring(0, 200) + "...");
            }

            // Log execution
            executionLogs.push({
              executionId,
              templateId: "project-meta-generation-v2",
              templateVersion: this.TEMPLATE_VERSION,
              promptHash,
              promptMetadata: {
                usedModel: usedModel.modelId,
                candidateIndex: i,
              },
              modelId: usedModel.modelId,
              modelVersion: usedModel.provider,
              params: {
                temperature,
                maxTokens,
              },
              responseHash,
              responseSummary: projectMeta?.title || "解析失败",
              tokensUsed: result.tokensUsed,
              timestamp: new Date(),
            });

            onProgress?.(i + 1, this.MAX_CANDIDATES);
          } catch (error: any) {
            console.error(`Candidate ${i + 1} generation failed:`, error.message);
            onProgress?.(i + 1, this.MAX_CANDIDATES);
          }
        })();

        batchPromises.push(candidatePromise);
      }

      // Wait for batch to complete before starting next batch
      await Promise.all(batchPromises);
    }

    console.log(`[Performance] Generated ${candidates.length}/${this.MAX_CANDIDATES} candidates in parallel`);

    return candidates;
  }

  /**
   * Score candidates using advanced multi-dimensional scoring
   */
  private async scoreCandidates(
    candidates: ProjectMeta[]
  ): Promise<ScoredCandidate[]> {
    const scored: ScoredCandidate[] = [];

    // Get embedding model for semantic scoring
    const models = await storage.getAIModels();
    const embeddingModel = models.find(
      (m) => m.modelType === "embedding" && m.isActive && m.isDefaultEmbedding
    );

    for (const candidate of candidates) {
      // Get embedding first (needed for semantic scoring)
      let embedding: number[] | undefined;
      if (embeddingModel) {
        try {
          const textForEmbedding = `${candidate.title} ${candidate.premise} ${candidate.themeTags.join(" ")}`;
          const result = await aiService.getEmbedding(textForEmbedding);
          if (result) {
            embedding = result;
          }
        } catch (error) {
          console.warn("Embedding generation failed:", error);
        }
      }

      // === Enhanced Quality Scoring System ===

      // 1. Completeness (15%) - Basic requirement check
      const completenessScore = this.scoreCompleteness(candidate);

      // 2. Quality (20%) - Content quality metrics
      const qualityScore = this.scoreQuality(candidate);

      // 3. Richness (15%) - Depth and detail
      const richnessScore = this.scoreRichness(candidate);

      // 4. Consistency (15%) - Internal logic
      const consistencyScore = this.scoreConsistency(candidate);

      // 5. Writability (15%) - Sustainable development potential
      const writabilityScore = this.scoreWritability(candidate);

      // 6. Semantic Quality (10%) - NEW: Logical coherence
      const semanticScore = await this.scoreSemanticQuality(candidate, embedding);

      // 7. Originality (10%) - NEW: Cliché detection and creativity
      const originalityScore = this.scoreOriginality(candidate);

      // Calculate weighted total score
      const totalScore =
        completenessScore * 0.15 +
        qualityScore * 0.20 +
        richnessScore * 0.15 +
        consistencyScore * 0.15 +
        writabilityScore * 0.15 +
        semanticScore * 0.10 +
        originalityScore * 0.10;

      // Log detailed scores for debugging
      console.log(`[Scoring] "${candidate.title.substring(0, 30)}..." - Total: ${totalScore.toFixed(1)}`, {
        completeness: completenessScore.toFixed(1),
        quality: qualityScore.toFixed(1),
        richness: richnessScore.toFixed(1),
        consistency: consistencyScore.toFixed(1),
        writability: writabilityScore.toFixed(1),
        semantic: semanticScore.toFixed(1),
        originality: originalityScore.toFixed(1),
      });

      scored.push({
        candidate,
        ruleScore: totalScore,
        semanticScore, // Now using actual semantic score
        totalScore,
        embedding,
      });
    }

    return scored.sort((a, b) => b.totalScore - a.totalScore);
  }

  /**
   * Score completeness (0-100)
   */
  private scoreCompleteness(meta: ProjectMeta): number {
    let score = 0;

    // Required fields (40 points)
    score += meta.themeTags && meta.themeTags.length > 0 ? 10 : 0;
    score += meta.coreConflicts && meta.coreConflicts.length >= 3 ? 10 : meta.coreConflicts?.length * 3 || 0;
    score += meta.mainEntities && meta.mainEntities.length >= 3 ? 10 : meta.mainEntities?.length * 3 || 0;
    score += meta.worldRules && meta.worldRules.length > 0 ? 10 : 0;

    // Optional but important (30 points)
    score += meta.toneProfile && meta.toneProfile.length > 0 ? 15 : 0;
    score += meta.keywords && meta.keywords.length >= 5 ? 15 : (meta.keywords?.length || 0) * 3;

    // Protagonist check (30 points) - 支持中英文
    const hasProtagonist = meta.mainEntities?.some((e) => e.role === "主角" || e.role === "protagonist");
    score += hasProtagonist ? 30 : 0;

    return Math.min(score, 100);
  }

  /**
   * Score quality (0-100)
   */
  private scoreQuality(meta: ProjectMeta): number {
    let score = 0;

    // Premise quality (40 points)
    const premiseLength = meta.premise?.length || 0;
    if (premiseLength >= 200 && premiseLength <= 400) {
      score += 40;
    } else if (premiseLength >= 100) {
      score += 20;
    }

    // Title quality (20 points)
    const titleLength = meta.title?.length || 0;
    if (titleLength >= 4 && titleLength <= 20) {
      score += 20;
    } else if (titleLength > 0) {
      score += 10;
    }

    // Entity motivation quality (20 points)
    const avgMotivationLength =
      meta.mainEntities?.reduce((sum, e) => sum + (e.shortMotivation?.length || 0), 0) /
      (meta.mainEntities?.length || 1);
    if (avgMotivationLength >= 20) {
      score += 20;
    } else {
      score += avgMotivationLength;
    }

    // Conflict quality (20 points)
    const avgConflictLength =
      meta.coreConflicts?.reduce((sum, c) => sum + c.length, 0) /
      (meta.coreConflicts?.length || 1);
    if (avgConflictLength >= 15) {
      score += 20;
    } else {
      score += avgConflictLength;
    }

    return Math.min(score, 100);
  }

  /**
   * Score richness (0-100)
   */
  private scoreRichness(meta: ProjectMeta): number {
    let score = 0;

    // Keyword richness (30 points)
    score += Math.min((meta.keywords?.length || 0) * 5, 30);

    // Theme tag richness (30 points)
    score += Math.min((meta.themeTags?.length || 0) * 7, 30);

    // World rules richness (20 points)
    score += Math.min((meta.worldRules?.length || 0) * 7, 20);

    // Entity diversity (20 points)
    const roles = new Set(meta.mainEntities?.map((e) => e.role) || []);
    score += roles.size * 7;

    return Math.min(score, 100);
  }

  /**
   * Score consistency (0-100) - rule-based heuristics
   */
  private scoreConsistency(meta: ProjectMeta): number {
    let score = 100;

    // Check for duplicate entity names
    const entityNames = meta.mainEntities?.map((e) => e.name) || [];
    const uniqueNames = new Set(entityNames);
    if (entityNames.length !== uniqueNames.size) {
      score -= 30; // Duplicate names
    }

    // Check for empty or very short fields
    if (meta.premise && meta.premise.length < 50) {
      score -= 20;
    }

    if (meta.mainEntities) {
      const emptyMotivations = meta.mainEntities.filter(
        (e) => !e.shortMotivation || e.shortMotivation.length < 5
      );
      score -= emptyMotivations.length * 10;
    }

    // Check for missing protagonist - 支持中英文
    const hasProtagonist = meta.mainEntities?.some((e) => e.role === "主角" || e.role === "protagonist");
    if (!hasProtagonist) {
      score -= 25;
    }

    return Math.max(score, 0);
  }

  /**
   * Score writability (0-100) - heuristic estimation
   */
  private scoreWritability(meta: ProjectMeta): number {
    let score = 0;

    // Conflict sustainability (40 points)
    const conflictCount = meta.coreConflicts?.length || 0;
    if (conflictCount >= 3) {
      score += 40;
    } else {
      score += conflictCount * 13;
    }

    // Character depth (30 points)
    const entityCount = meta.mainEntities?.length || 0;
    if (entityCount >= 3) {
      score += 30;
    } else {
      score += entityCount * 10;
    }

    // World complexity (30 points)
    const worldRuleCount = meta.worldRules?.length || 0;
    const keywordCount = meta.keywords?.length || 0;
    const complexityScore = worldRuleCount * 5 + keywordCount * 2;
    score += Math.min(complexityScore, 30);

    return Math.min(score, 100);
  }

  /**
   * Score originality (0-100) - detects clichés and rewards creativity
   */
  private scoreOriginality(meta: ProjectMeta): number {
    // Detect clichés using the detector
    const clicheResult = detectCliches(meta);

    let score = clicheResult.score; // Base score from cliché detection (0-100)

    // Reward creative elements
    if (hasUnusualWorldRules(meta.worldRules)) {
      score = Math.min(score + 10, 100);
    }

    if (hasComplexMotivations(meta.mainEntities)) {
      score = Math.min(score + 10, 100);
    }

    if (hasOriginalConflicts(meta.coreConflicts)) {
      score = Math.min(score + 10, 100);
    }

    // Log detected clichés for debugging
    if (clicheResult.detected.length > 0) {
      console.log(`[Originality] Detected ${clicheResult.detected.length} clichés:`,
        clicheResult.detected.map(c => c.name).join(', ')
      );
      if (clicheResult.suggestions.length > 0) {
        console.log(`[Originality] Suggestions:`, clicheResult.suggestions);
      }
    }

    return Math.min(score, 100);
  }

  /**
   * Score semantic quality (0-100) - checks logical coherence and depth
   */
  private async scoreSemanticQuality(
    meta: ProjectMeta,
    embedding?: number[]
  ): Promise<number> {
    let score = 50; // Base score

    // 1. Semantic Coherence via Embedding (30 points)
    if (embedding && embedding.length > 0) {
      // Calculate embedding quality metrics
      const coherence = this.calculateVectorCoherence(embedding);
      const diversity = this.calculateVectorDiversity(embedding);

      // Balance between coherence (consistency) and diversity (richness)
      // Ideal: high coherence (0.7-1.0), moderate diversity (0.3-0.6)
      let embeddingScore = 0;

      if (coherence >= 0.7 && coherence <= 1.0) {
        embeddingScore += 15;
      } else if (coherence >= 0.5) {
        embeddingScore += 10;
      }

      if (diversity >= 0.3 && diversity <= 0.6) {
        embeddingScore += 15;
      } else if (diversity >= 0.2) {
        embeddingScore += 8;
      }

      score += embeddingScore;
    }

    // 2. Character-Conflict Alignment (25 points)
    // Check if character motivations align with conflicts
    const motivationConflictAlignment = this.checkMotivationConflictAlignment(meta);
    score += motivationConflictAlignment * 25;

    // 3. Worldview-Conflict Consistency (25 points)
    // Check if conflicts make sense within world rules
    const worldConflictConsistency = this.checkWorldConflictConsistency(meta);
    score += worldConflictConsistency * 25;

    return Math.min(score, 100);
  }

  /**
   * Check if character motivations align with core conflicts
   */
  private checkMotivationConflictAlignment(meta: ProjectMeta): number {
    if (!meta.mainEntities || meta.mainEntities.length === 0) return 0;
    if (!meta.coreConflicts || meta.coreConflicts.length === 0) return 0;

    const allConflicts = meta.coreConflicts.join(' ').toLowerCase();
    const allMotivations = meta.mainEntities
      .map(e => e.shortMotivation.toLowerCase())
      .join(' ');

    // Simple keyword overlap check
    // Extract meaningful words (>2 chars) from conflicts
    const conflictWords = allConflicts
      .split(/[\s,，。；;、]+/)
      .filter(w => w.length > 2);

    const motivationWords = allMotivations
      .split(/[\s,，。；;、]+/)
      .filter(w => w.length > 2);

    // Count overlapping keywords
    const overlap = conflictWords.filter(w =>
      motivationWords.some(m => m.includes(w) || w.includes(m))
    ).length;

    // Alignment score: overlap / total conflict words
    const alignmentRatio = conflictWords.length > 0
      ? overlap / conflictWords.length
      : 0;

    return Math.min(alignmentRatio, 1.0);
  }

  /**
   * Check if world rules support the conflicts
   */
  private checkWorldConflictConsistency(meta: ProjectMeta): number {
    if (!meta.worldRules || meta.worldRules.length === 0) return 0.5; // Neutral if no world rules
    if (!meta.coreConflicts || meta.coreConflicts.length === 0) return 0;

    const allRules = meta.worldRules.join(' ').toLowerCase();
    const allConflicts = meta.coreConflicts.join(' ').toLowerCase();

    // Check for thematic consistency keywords
    const powerThemes = ['力量', '实力', '修炼', '功法', '境界', '等级'];
    const socialThemes = ['地位', '身份', '阶级', '家族', '门派', '势力'];
    const moralThemes = ['正义', '邪恶', '善恶', '道德', '信念', '理想'];

    let consistency = 0;
    let checks = 0;

    // Check power system consistency
    if (powerThemes.some(t => allRules.includes(t))) {
      checks++;
      if (powerThemes.some(t => allConflicts.includes(t))) {
        consistency += 1;
      }
    }

    // Check social structure consistency
    if (socialThemes.some(t => allRules.includes(t))) {
      checks++;
      if (socialThemes.some(t => allConflicts.includes(t))) {
        consistency += 1;
      }
    }

    // Check moral framework consistency
    if (moralThemes.some(t => allRules.includes(t))) {
      checks++;
      if (moralThemes.some(t => allConflicts.includes(t))) {
        consistency += 1;
      }
    }

    return checks > 0 ? consistency / checks : 0.5;
  }


  /**
   * Calculate rule-based score
   */
  private calculateRuleScore(meta: ProjectMeta): number {
    let score = 0;

    // Completeness (40%)
    score += meta.themeTags.length > 0 ? 10 : 0;
    score += meta.coreConflicts.length >= 3 ? 10 : meta.coreConflicts.length * 3;
    score += meta.mainEntities.length >= 3 ? 10 : meta.mainEntities.length * 3;
    score += meta.worldRules.length > 0 ? 10 : 0;

    // Quality (30%)
    score += meta.premise.length >= 200 ? 15 : (meta.premise.length / 200) * 15;
    score += meta.toneProfile.length > 0 ? 15 : 0;

    // Richness (30%)
    score += Math.min(meta.keywords.length * 3, 15);
    score += Math.min(meta.themeTags.length * 3, 15);

    return score;
  }



  /**
   * Calculate diversity from embedding vector
   */
  private calculateVectorDiversity(embedding: number[]): number {
    if (!embedding || embedding.length === 0) return 0;

    const mean = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
    const variance =
      embedding.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      embedding.length;

    // Normalize to 0-1 range (typical variance is 0-0.1 for embeddings)
    return Math.min(variance * 10, 1);
  }

  /**
   * Calculate coherence from embedding vector
   */
  private calculateVectorCoherence(embedding: number[]): number {
    if (!embedding || embedding.length === 0) return 0;

    // Calculate L2 norm (magnitude)
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );

    // Normalize to 0-1 range (typical magnitude is 0-1 for normalized embeddings)
    return Math.min(magnitude, 1);
  }

  /**
   * Merge best candidates intelligently using LLM to create optimal ProjectMeta
   */
  /**
   * Merge best candidates intelligently using LLM to create optimal ProjectMeta
   */
  private async mergeCandidatesIntelligently(scored: ScoredCandidate[], seed: ProjectSeed): Promise<ProjectMeta> {
    if (scored.length === 1) {
      return scored[0].candidate;
    }

    const topCandidates = scored.slice(0, Math.min(3, scored.length));

    // If we don't have enough candidates or if we want to save costs/time, 
    // we could fallback to heuristic merging. But for "Intelligent" strategy, we use LLM.

    const candidatesJson = topCandidates.map((c, index) => ({
      id: index + 1,
      score: c.totalScore,
      title: c.candidate.title,
      premise: c.candidate.premise,
      coreConflicts: c.candidate.coreConflicts,
      mainEntities: c.candidate.mainEntities.map(e => `${e.name} (${e.role}): ${e.shortMotivation}`),
      worldRules: c.candidate.worldRules,
      themeTags: c.candidate.themeTags
    }));

    const prompt = `
你是一位资深的网络小说编辑和创意总监。
你的任务是从提供的候选方案中综合出最佳的项目大纲。

用户需求（种子）：
标题：${seed.titleSeed}
简介：${seed.premise || "无"}
类型：${seed.genre || "无"}
风格：${seed.style || "无"}

候选方案（按质量排序）：
${JSON.stringify(candidatesJson, null, 2)}

指导说明：
1. 分析候选方案，从每个方案中识别最具创新性、连贯性和吸引力的元素。
2. 综合出一个全新的、更优秀的项目元数据，结合这些优势。
3. 确保"premise"（核心设定）详细、逻辑严密、情感共鸣强。
4. 选择最具冲突性和趣味性的"coreConflicts"（核心冲突）。
5. 创建一个多样化的"mainEntities"（主要角色）阵容，具有深刻的动机，避免重复但可以合并相似角色以提升深度。
6. 定义支持冲突的"worldRules"（世界规则）。
7. 所有内容必须使用纯正的中文，不要使用英文词汇或拼音。

输出格式：
仅返回一个有效的JSON对象，匹配以下结构（字段名使用英文，内容使用中文）：
{
  "title": "最终标题（中文）",
  "premise": "详细的核心设定（中文，200-300字）",
  "toneProfile": "基调风格（中文）",
  "themeTags": ["主题标签1", "主题标签2"],
  "coreConflicts": ["核心冲突1", "核心冲突2"],
  "mainEntities": [
    { 
      "name": "角色名（中文）", 
      "role": "主角",
      "shortMotivation": "动机描述（中文）",
      "personality": "性格特点（中文）",
      "appearance": "外貌特征（中文）",
      "background": "背景故事（中文）",
      "abilities": "能力特长（中文）"
    }
  ],
  "worldRules": ["世界规则1（中文）", "世界规则2（中文）"],
  "keywords": ["关键词1", "关键词2"]
}

注意：role字段只能是"主角"、"配角"或"反派"之一。
`;

    try {
      // Route to a high-quality model
      // We simulate signals that would trigger a "Quality" tier or "Big" strategy
      const signals = {
        draftConfidence: 0.2, // Low confidence -> needs smarter model
        conflictDensity: 0.8, // High conflict -> complex
        templateComplexity: 0.9, // High complexity
        budgetFactor: 0.5
      };

      const decision = await modelRoutingService.routeModel(signals);

      // Get actual model object from database
      const allModels = await storage.getAIModels();
      const selectedModel = allModels.find(m =>
        m.id === decision.primaryModel || m.modelId === decision.primaryModel
      );

      if (!selectedModel) {
        console.warn("[Merge] Selected model not found in database, falling back to heuristic merge");
        return this.mergeCandidates(scored);
      }

      // Use the selected model to generate
      const response = await aiService.generate({
        prompt,
        modelId: selectedModel.modelId,
        provider: selectedModel.provider,
        baseUrl: selectedModel.baseUrl || '',
        apiKey: selectedModel.apiKey || undefined,
        parameters: {
          temperature: 0.7,
          maxTokens: 2000
        },
        responseFormat: 'json'
      });

      const mergedMeta = extractJSON(response.content);

      // Basic validation/fallback if LLM returns incomplete data
      if (!mergedMeta.title || !mergedMeta.premise) {
        console.warn("[Merge] LLM returned incomplete meta, falling back to heuristic merge");
        return this.mergeCandidates(scored);
      }

      return mergedMeta;

    } catch (error) {
      console.error("[Merge] LLM merge failed:", error);
      return this.mergeCandidates(scored);
    }
  }

  /**
   * Legacy heuristic merge (fallback)
   */
  private mergeCandidates(scored: ScoredCandidate[]): ProjectMeta {
    if (scored.length === 1) {
      return scored[0].candidate;
    }

    const top3 = scored.slice(0, Math.min(3, scored.length));

    // Strategy: Intelligent field-by-field selection

    // 1. Title: Choose the most attractive one (from highest scored)
    const title = top3[0].candidate.title;

    // 2. Premise: Choose the longest and most detailed one
    const premise = top3
      .map((s) => s.candidate.premise)
      .reduce((best, current) => (current.length > best.length ? current : best));

    // 3. Tone Profile: Choose from highest scored
    const toneProfile = top3[0].candidate.toneProfile;

    // 4. Theme Tags: Merge unique tags from all candidates
    const allThemeTags = new Set<string>();
    top3.forEach((s) => {
      s.candidate.themeTags.forEach((tag) => allThemeTags.add(tag));
    });
    const themeTags = Array.from(allThemeTags).slice(0, 6);

    // 5. Core Conflicts: Merge unique conflicts, prioritize from higher scored
    const allConflicts: string[] = [];
    top3.forEach((s) => {
      s.candidate.coreConflicts.forEach((conflict) => {
        if (!allConflicts.some((c) => this.isSimilar(c, conflict))) {
          allConflicts.push(conflict);
        }
      });
    });
    const coreConflicts = allConflicts.slice(0, 5);

    // 6. Main Entities: Merge unique entities, avoid duplicates
    const entityMap = new Map<string, EntitySummary>();
    top3.forEach((s) => {
      s.candidate.mainEntities.forEach((entity) => {
        const key = entity.name.toLowerCase();
        if (!entityMap.has(key)) {
          entityMap.set(key, entity);
        } else {
          // If duplicate, choose the one with longer motivation
          const existing = entityMap.get(key)!;
          if (entity.shortMotivation.length > existing.shortMotivation.length) {
            entityMap.set(key, entity);
          }
        }
      });
    });
    const mainEntities = Array.from(entityMap.values()).slice(0, 5);

    // Ensure at least one protagonist - 支持中英文
    const hasProtagonist = mainEntities.some((e) => e.role === "主角" || e.role === "protagonist");
    if (!hasProtagonist && mainEntities.length > 0) {
      mainEntities[0].role = "主角";
    }

    // 7. World Rules: Merge unique rules
    const allWorldRules: string[] = [];
    top3.forEach((s) => {
      s.candidate.worldRules.forEach((rule) => {
        if (!allWorldRules.some((r) => this.isSimilar(r, rule))) {
          allWorldRules.push(rule);
        }
      });
    });
    const worldRules = allWorldRules.slice(0, 5);

    // 8. Keywords: Merge unique keywords
    const allKeywords = new Set<string>();
    top3.forEach((s) => {
      s.candidate.keywords.forEach((kw) => allKeywords.add(kw));
    });
    const keywords = Array.from(allKeywords).slice(0, 10);

    return {
      title,
      premise,
      themeTags,
      toneProfile,
      coreConflicts,
      mainEntities,
      worldRules,
      keywords,
    };
  }

  /**
   * Check if two strings are similar (simple heuristic)
   */
  private isSimilar(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    return normalize(a) === normalize(b);
  }

  /**
   * Create project entities in database (Enhanced)
   */
  private async createProjectEntities(
    projectId: string,
    meta: ProjectMeta
  ): Promise<void> {
    // Create main outline
    const mainOutline = await storage.createOutline({
      projectId,
      parentId: null,
      type: "main",
      title: "总纲",
      content: this.formatProjectMetaAsOutline(meta),
      orderIndex: 0,
      plotNodes: {
        themeTags: meta.themeTags,
        coreConflicts: meta.coreConflicts,
        worldRules: meta.worldRules,
      },
    });

    // Create enhanced characters with full information from AI
    for (const entity of meta.mainEntities) {
      await storage.createCharacter({
        projectId,
        name: entity.name,
        role: entity.role,
        gender: extractGender(entity.appearance, entity.personality), // 智能提取性别
        age: extractAge(entity.background, entity.appearance), // 智能提取年龄
        personality: entity.personality || "",
        shortMotivation: entity.shortMotivation || "",
        background: entity.background || "",
        appearance: entity.appearance || "",
        abilities: entity.abilities || "",
        relationships: extractRelationships(meta.mainEntities, entity), // 智能分析关系
        growth: generateGrowthPath(entity, meta.coreConflicts), // 生成成长路径
        notes: `创建于项目初始化（AI生成）\n弱点：${entity.flaw || "无"}\n习惯：${entity.habit || "无"}`,
        arcPoints: generateInitialArcPoints(entity, meta.coreConflicts), // 初始弧光点
        currentEmotion: extractInitialEmotion(entity.shortMotivation), // 初始情感
        currentGoal: entity.shortMotivation, // 初始目标即为核心动机
        stateUpdatedAt: new Date(),
      });
    }

    // Create enhanced world settings (智能分类)
    await createEnhancedWorldSettings(projectId, meta);

    // [NEW] Create World Mystery Setting
    if (meta.worldMystery) {
      await storage.createWorldSetting({
        projectId,
        category: "secret",
        title: "世界谜团",
        content: meta.worldMystery,
        tags: ["隐藏真相", "伏笔"],
        details: { source: "AI生成", importance: "high" },
      });
    }

    // Create enhanced outline structure (层级化大纲)
    await createEnhancedOutlines(projectId, mainOutline.id, meta);
  }

  /**
   * Calculate seed complexity
   */
  private calculateSeedComplexity(seed: ProjectSeed): number {
    let complexity = 0.3; // Base complexity

    if (seed.premise && seed.premise.length > 100) complexity += 0.2;
    if (seed.genre) complexity += 0.1;
    if (seed.style) complexity += 0.1;
    if (seed.titleSeed.length > 50) complexity += 0.1;

    return Math.min(complexity, 1.0);
  }



  /**
   * Infer genre from meta using configurable genre service
   */
  private inferGenre(meta: ProjectMeta): string {
    // 使用配置化的类型推断服务
    const keywords = [...meta.themeTags, ...meta.keywords];
    return genreConfigService.inferGenre(keywords);
  }

  /**
   * Format meta as outline
   */
  private formatProjectMetaAsOutline(meta: ProjectMeta): string {
    return `# ${meta.title}

## 核心设定
${meta.premise}

## 主题标签
${meta.themeTags.join("、")}

## 基调风格
${meta.toneProfile}

## 核心冲突
${meta.coreConflicts.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## 主要角色
${meta.mainEntities.map((e) => `- **${e.name}** (${e.role}): ${e.shortMotivation}`).join("\n")}

## 世界规则
${meta.worldRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

## 关键词
${meta.keywords.join("、")} `;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${crypto.randomBytes(8).toString("hex")} `;
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("操作超时")), ms);
    });
  }

  /**
   * Build few-shot guidance based on seed and candidate index
   */
  private async buildFewShotGuidance(seed: ProjectSeed, index: number): Promise<string> {
    // Get all examples and filter for project-meta
    const allExamples = fewShotExamplesService.getAllExamples();
    const metaExamples = allExamples.filter(e => e.category === "project-meta");

    if (metaExamples.length === 0) return "";

    // Select a relevant example based on genre or random
    let selectedExample = metaExamples[0];
    const genre = seed.genre || "";

    // Simple genre matching
    if (genreConfigService.matchesGenre(genre, "玄幻") || genreConfigService.matchesGenre(genre, "仙侠")) {
      const match = metaExamples.find(e => e.tags.includes("玄幻") || e.tags.includes("仙侠"));
      if (match) selectedExample = match;
    } else if (genreConfigService.matchesGenre(genre, "悬疑") || genreConfigService.matchesGenre(genre, "惊悚")) {
      const match = metaExamples.find(e => e.tags.includes("悬疑"));
      if (match) selectedExample = match;
    } else if (genreConfigService.matchesGenre(genre, "都市") || genreConfigService.matchesGenre(genre, "言情")) {
      const match = metaExamples.find(e => e.tags.includes("都市"));
      if (match) selectedExample = match;
    } else {
      // Randomly select one for diversity if no genre match
      selectedExample = metaExamples[index % metaExamples.length];
    }

    return `
# 创意参考示例
以下是一个高分的小说项目设定示例，请参考其**创意深度**、**世界观的独特性**以及**角色动机的复杂性**。
注意：不要照搬内容，而是学习其如何构建非套路的故事。

---
${selectedExample.example}
---
`;
  }

  /**
   * Calculate cost based on tokens and model
   * Returns cost in cents
   */
  private calculateCost(tokensUsed: number, modelId: string): number {
    // Cost per 1M tokens (in cents)
    const costPer1MTokens: Record<string, number> = {
      "deepseek-chat": 14, // $0.14 per 1M tokens
      "deepseek-coder": 14,
      "gpt-4": 3000, // $30 per 1M tokens
      "gpt-4-turbo": 1000, // $10 per 1M tokens
      "gpt-3.5-turbo": 50, // $0.50 per 1M tokens
      "claude-3-opus": 1500,
      "claude-3-sonnet": 300,
      "claude-3-haiku": 25,
    };

    // Find matching cost rate
    let costRate = 100; // Default: $1 per 1M tokens
    for (const [model, rate] of Object.entries(costPer1MTokens)) {
      if (modelId.includes(model)) {
        costRate = rate;
        break;
      }
    }

    // Calculate cost in cents
    const cost = Math.ceil((tokensUsed / 1000000) * costRate);
    return cost;
  }

  /**
   * Calculate total cost from execution logs
   */
  private calculateTotalCost(logs: PromptExecutionLog[]): number {
    return logs.reduce((sum, log) => {
      return sum + this.calculateCost(log.tokensUsed, log.modelId);
    }, 0);
  }
}

export const enhancedProjectCreationService =
  new EnhancedProjectCreationService();
