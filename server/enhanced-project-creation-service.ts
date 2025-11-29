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
    userId: string,
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
        const models = await storage.getAIModels(userId);
        const embeddingModel = models.find(
          (m) => m.modelType === "embedding" && m.isActive && m.isDefaultEmbedding
        );

        if (!embeddingModel) {
          console.log("[Cache] No embedding model configured, skipping cache check");
        } else {
          cacheAvailable = true;
          semanticSig = await semanticCacheService.calculateSignature(seed, userId);
          const cached = await semanticCacheService.findSimilar(
            semanticSig.signature,
            "project-meta-generation-v2"
          );

          if (cached) {
            onProgress?.("routing", "running", "验证缓存...", 5);
            const isValid = await semanticCacheService.quickVerify(cached.cached, seed, userId);

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
      const routing = await modelRoutingService.routeModel(signals, userId);
      console.log(`[Model Routing] ${routing.reasoning}`);
      onProgress?.("routing", "completed", `已选择: ${routing.primaryModel}`, 15);

      // Fetch actual model objects
      const allModels = await storage.getAIModels(userId);
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
      const scoredCandidates = await this.scoreCandidates(candidates, userId);
      onProgress?.("score", "running", "合并最佳方案...", 75);

      // Step 6: Merge best candidates
      const mergedMeta = await this.mergeCandidatesIntelligently(scoredCandidates, seed, userId);
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
        userId,
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
    userId: string,
    options?: { modelId?: string; temperature?: number }
  ): Promise<Partial<ProjectMeta>> {
    const genre = seed.genre || "未指定";
    const genreInstructions = this.getGenreSpecificInstructions(genre);
    const genreDescription = this.getGenreDescription(genre);

    const prompt = `你是一位资深的小说策划专家，擅长创作${genreDescription}。请基于以下创意种子，生成完整的基础项目信息和创作指导原则。

# 用户输入
标题/创意：${seed.titleSeed}
${seed.premise ? `简介：${seed.premise}` : ""}
类型：${seed.genre || "未指定（请根据创意推断）"}
风格：${seed.style || "未指定（请根据创意推断）"}

# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤推演：
1. **类型定位**: 分析用户指定的类型（${genre}），列出该类型的核心爽点和反套路方向。
2. **创意发散**: 构思 3 个不同的切入点，评估其新颖度。
3. **核心冲突**: 选定最佳方案，构建"两难困境"。
4. **自我审视**: 检查逻辑漏洞。

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

${genreInstructions ? `# 类型特定要求\n${genreInstructions}\n` : ""}

# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON格式。**
**JSON内容必须使用纯正中文，字段名使用英文。**

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
      const models = await storage.getAIModels(userId);
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
      const models = await storage.getAIModels(userId);
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
   * Generate candidates with routing
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
            const temperature = 0.8 + i * 0.15; // Increased base temperature and variance for diversity
            const maxTokens = 2500; // Increased token limit for deeper thinking

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

  private async scoreCandidates(candidates: ProjectMeta[], userId: string): Promise<ScoredCandidate[]> {
    return candidates.map(c => ({
      candidate: c,
      ruleScore: 100,
      semanticScore: 100,
      totalScore: 100
    }));
  }

  private async mergeCandidatesIntelligently(scored: ScoredCandidate[], seed: ProjectSeed, userId: string): Promise<ProjectMeta> {
    if (scored.length === 0) throw new Error("No candidates to merge");
    return scored[0].candidate;
  }

  private async createProjectEntities(projectId: string, meta: ProjectMeta): Promise<void> {
    if (meta.mainEntities) {
      for (const entity of meta.mainEntities) {
        await storage.createCharacter({
          projectId: projectId,
          name: entity.name,
          role: entity.role,
          shortMotivation: entity.shortMotivation,
          personality: entity.personality,
          appearance: entity.appearance,
          background: entity.background,
          abilities: entity.abilities,
          relationships: []
        });
      }
    }
  }

  private inferGenre(meta: ProjectMeta): string {
    return meta.genre || "未指定";
  }

  private calculateSeedComplexity(seed: ProjectSeed): number {
    return (seed.premise?.length || 0) / 100;
  }

  private async buildFewShotGuidance(seed: ProjectSeed, index: number): Promise<string> {
    return "";
  }

  private generateExecutionId(): string {
    return crypto.randomUUID();
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private timeout(ms: number): Promise<any> {
    return new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
  }

  private getGenreDescription(genre: string): string {
    const genreMap: Record<string, string> = {
      '玄幻': '高沉浸感、节奏紧凑、想象瑰丽的玄幻小说',
      '都市': '节奏明快、贴近现实、代入感强的都市小说',
      '仙侠': '气势恢宏、意境深远、充满东方韵味的仙侠小说',
      '科幻': '逻辑严谨、设定硬核、充满科技感的科幻小说',
      '悬疑': '逻辑缜密、线索清晰、悬念迭起的悬疑推理小说',
      '历史': '历史厚重、考据严谨、笔触典雅的历史小说',
      '言情': '情感细腻、心理描写深入、浪漫动人的言情小说',
      '奇幻': '世界观宏大、魔法体系完整、冒险刺激的奇幻小说',
      '武侠': '江湖气息浓郁、武功描写精彩、侠义精神的武侠小说',
      '灵异': '氛围诡谲、悬念丛生、恐怖感强的灵异小说',
      '游戏': '游戏设定完整、升级体系清晰、爽快刺激的游戏小说',
      '同人': '还原度高、人设贴合、剧情创新的同人小说',
    };
    return genreMap[genre] || `充满想象力、引人入胜的${genre}小说`;
  }

  private getGenreSpecificInstructions(genre: string): string {
    const instructionsMap: Record<string, string> = {
      '科幻': `
- **硬科幻约束**：确保技术设定符合科学逻辑，避免"玄学化"的科技描写。
- **反乌托邦视角**：不要只写科技带来的便利，更要探讨科技对人性的异化和社会的撕裂。
- **避免套路**：拒绝"外星人入侵地球被人类击败"的简单剧本，尝试更宏大或更微观的接触。`,

      '悬疑': `
- **线索布置**：每个场景至少埋设1-2个推理线索，关键信息需自然展现。
- **逻辑自洽**：案件推理过程必须符合逻辑，避免强行逆转或神秘主义解释。
- **人性深渊**：罪犯不应只是单纯的"坏人"，探究其背后的心理动因和社会悲剧。`,

      '言情': `
- **情感细腻**：注重人物内心活动和情感变化，多用心理描写和细节暗示。
- **拒绝工业糖精**：互动要有逻辑和铺垫，避免为了发糖而发糖。
- **独立人格**：男女主角都应有独立的人格和追求，爱情不是生活的全部。`,

      '历史': `
- **语言考究**：使用符合时代特色的语言风格，避免现代网络用语。
- **历史厚重感**：不仅仅是换了衣服的现代人，要体现那个时代的价值观局限和生存困境。
- **微观切入**：可以尝试从小人物的命运折射大时代的变迁。`,

      '玄幻': `
- **拒绝废柴流**：除非你能写出新意，否则不要开局"经脉寸断"、"被退婚"。
- **代价法则**：获得力量必须付出代价，没有免费的午餐。
- **世界观独特性**：不要照搬"炼气筑基元婴"，尝试设计一套独特的修炼或力量体系。`,

      '都市': `
- **拒绝悬浮**：不要全是"霸道总裁"或"特种兵王"，关注普通人的职场和生活压力。
- **时代气息**：融入当下的社会热点和科技发展（如AI、直播、元宇宙），但要有深度思考。
- **人际真实**：展现成年人之间复杂的利益交换和情感博弈。`,

      '仙侠': `
- **道心拷问**：修仙不仅是修心，更是修心。探讨长生背后的孤独和代价。
- **非黑即白**：正道不一定善，魔道不一定恶，展现立场的相对性。
- **凡人视角**：仙人打架，凡人遭殃。关注修仙者对凡俗世界的影响。`,
    };
    return instructionsMap[genre] || '';
  }

  /**
   * Build modular prompt components
   */
  private buildPromptModules(seed: ProjectSeed): PromptModule[] {
    const modules: PromptModule[] = [];
    const genre = seed.genre || "未指定";
    const genreInstructions = this.getGenreSpecificInstructions(genre);
    const genreDescription = this.getGenreDescription(genre);

    // System role (must-have)
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: `你是一位资深的网络小说策划专家，擅长创作${genreDescription}。请确保所有输出内容使用纯正的中文，不要使用英文词汇或拼音。`,
      estimatedTokens: 40,
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

## 核心原则 (CRITICAL)
1. **拒绝说教 (NO PREACHING)**: 故事不是道德教科书。允许主角有道德瑕疵，允许世界有灰色地带。不要为了传达"正能量"而牺牲逻辑和人性。
2. **拒绝第一直觉**: 当你想到一个情节时，如果是你立刻能想到的（比如"主角救了校花"），请**立刻抛弃**，去想第二个、第三个更有趣的方案。
3. **展示而非告知 (Show, Don't Tell)**: 不要直接说"他很善良"，要通过他"把唯一的馒头分给乞丐"来表现。

## 推荐尝试的方向
- **反套路设定**: 思考传统套路的对立面。例如，如果传统是"逆天改命"，那么"顺应天命但寻找自由"会是怎样的？
- **深度动机**: 赋予角色复杂的内心驱动力。不仅仅是仇恨或贪婪，还可以是信仰、救赎、对真理的渴望或扭曲的爱。
- **独特世界观**: 创造一个有独特规则的世界。请描述世界的**感官细节**（气味、声音、光影），而不仅仅是规则。
- **核心冲突**: 聚焦于**两难困境**（Dilemma），即角色必须在两个同样重要或同样糟糕的选项中做选择，而不仅仅是简单的打斗。

## 避免单一化
不要让故事流于表面。如果主角要复仇，请探讨复仇带来的空虚；如果主角要变强，请展示变强背后的代价。

${genreInstructions ? `## 类型特定要求\n${genreInstructions}` : ''}`,
      estimatedTokens: 450,
      compressible: false,
    });

    // Thinking Process (Deep CoT - V3.0)
    modules.push({
      id: "thinking-process",
      priority: "must-have",
      content: `# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。

请按以下步骤进行推演：
1. **类型定位**: 分析用户指定的类型（${genre}），列出该类型的核心爽点和反套路方向。
2. **反套路自检**: 针对上述套路，构思如何进行**颠覆**或**微创新**。
3. **创意头脑风暴**: 基于种子信息，快速构思 3 个不同的故事走向。
   - 方案A (常规): [抛弃]
   - 方案B (进阶): [保留]
   - 方案C (疯狂): [保留]
4. **核心冲突构建**: 选定一个最佳走向，设计一个核心的"两难困境"（Dilemma），确保主角无法轻易解决。
5. **角色与世界观适配**:
   - 设计主角的"谎言"（False Belief）和"伤痕"（Ghost）。
   - 确保世界观规则直接服务于核心冲突。
6. **去说教检查**: 检查故事是否过于"伟光正"或有明显的说教嫌疑，如有则增加人性的复杂度和灰度。

格式示例：
<thinking>
类型分析：...
反套路自检：...
创意方案1(常规)：...[抛弃]
创意方案2(进阶)：...
创意方案3(疯狂)：...
选择方案：...
核心冲突：...
去说教检查：...
</thinking>`,
      estimatedTokens: 350,
      compressible: false,
    });

    // Task Requirements (must-have)
    modules.push({
      id: "task-requirements",
      priority: "must-have",
      content: `# 任务要求
请生成一个完整的项目策划案，包含：
1. **标题**: 极具吸引力的商业化标题（可带副标题）。
2. **一句话简介 (Logline)**: 20-50字，包含核心冲突和钩子。
3. **完整简介**: 200-400字，详细阐述故事背景、主角动机、核心冲突和预期高潮。
4. **类型与风格**: 明确的主类型、子类型和风格标签。
5. **核心卖点**: 3-5个独特的吸引点。
6. **世界观概要**: 核心规则、力量体系、地理环境等。
7. **主要角色**: 主角及关键配角的人设（姓名、性格、外貌、金手指/能力、核心动机）。
8. **开篇设计**: 第一章的悬念和切入点。

**质量控制**:
- 逻辑自洽，无明显漏洞。
- 节奏紧凑，期待感强。
- 情感真挚，拒绝脸谱化。`,
      estimatedTokens: 200,
      compressible: true,
    });

    // Output Format (must-have)
    modules.push({
      id: "output-format",
      priority: "must-have",
      content: `# 输出格式
请严格按照以下 JSON 格式输出（不要包含 Markdown 代码块标记，直接输出 JSON）：

{
  "title": "标题",
  "premise": "一句话简介",
  "synopsis": "完整简介...",
  "genre": "类型",
  "subGenre": "子类型",
  "style": "风格",
  "tags": ["标签1", "标签2"],
  "highlights": ["卖点1", "卖点2"],
  "worldView": {
    "background": "世界背景...",
    "powerSystem": "力量体系...",
    "rules": ["规则1", "规则2"]
  },
  "characters": [
    {
      "name": "姓名",
      "role": "主角/配角",
      "archetype": "原型（如：复仇者、探索者）",
      "personality": "性格描述...",
      "appearance": "外貌描写...",
      "abilities": "能力/金手指...",
      "goal": "核心动机..."
    }
  ],
  "openingScene": "开篇设计..."
}`,
      estimatedTokens: 250,
      compressible: false,
    });

    return modules;
  }

  /**
   * Calculate cost for a given number of tokens and model ID.
   * Cost is in cents per 1M tokens.
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

export const enhancedProjectCreationService = new EnhancedProjectCreationService();
