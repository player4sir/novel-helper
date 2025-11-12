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
import crypto from "crypto";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ProjectSeed {
  titleSeed: string;
  premise?: string;
  genre?: string;
  style?: string;
  targetWordCount?: number;
}

export interface ProjectMeta {
  title: string;
  premise: string;
  themeTags: string[];
  toneProfile: string;
  coreConflicts: string[];
  mainEntities: EntitySummary[];
  worldRules: string[];
  keywords: string[];
}

export interface EntitySummary {
  name: string;
  role: string;
  shortMotivation: string;
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

export class EnhancedProjectCreationService {
  private readonly TEMPLATE_VERSION = "2.0.0";
  private readonly MAX_CANDIDATES = 3;
  private readonly GENERATION_TIMEOUT = 60000;
  private readonly TOKEN_BUDGET = 4000; // Max tokens for prompt

  /**
   * Create project with full algorithm implementation
   */
  async createProjectFromSeed(seed: ProjectSeed): Promise<{
    projectId: string;
    projectMeta: ProjectMeta;
    executionLogs: PromptExecutionLog[];
    routingDecision: string;
  }> {
    const executionLogs: PromptExecutionLog[] = [];

    try {
      // Step 1: Calculate routing signals
      const seedComplexity = this.calculateSeedComplexity(seed);
      const signals = modelRoutingService.calculateProjectCreationSignals(
        !!seed.premise,
        !!seed.genre,
        seedComplexity
      );

      // Step 2: Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Model Routing] ${routing.reasoning}`);

      // Step 3: Build prompt with packing
      const promptModules = this.buildPromptModules(seed);
      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(
        `[Prompt Packing] Used ${packedPrompt.metadata.totalTokens} tokens (${(packedPrompt.metadata.budgetUsed * 100).toFixed(1)}% of budget)`
      );

      // Step 4: Generate multiple candidates
      const candidates = await this.generateCandidatesWithRouting(
        packedPrompt.promptText,
        routing.primaryModel,
        routing.fallbackModel,
        executionLogs
      );

      if (candidates.length === 0) {
        throw new Error("AI生成失败，未能生成有效的项目元数据");
      }

      // Step 5: Score candidates (rule-based + semantic)
      const scoredCandidates = await this.scoreCandidates(candidates);

      // Step 6: Merge best candidates
      const mergedMeta = this.mergeCandidates(scoredCandidates);

      // Step 7: Create project in database
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
      await this.createProjectEntities(project.id, mergedMeta);

      // Step 9: Save execution logs
      for (const log of executionLogs) {
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
      }

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
   * Build modular prompt components
   */
  private buildPromptModules(seed: ProjectSeed): PromptModule[] {
    const modules: PromptModule[] = [];

    // System role (must-have)
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: "你是一位资深的网络小说策划专家，擅长创作各类网络小说的核心设定和世界观架构。",
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

    // Task requirements (important)
    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请生成一个结构化的小说项目元数据，包含以下内容：

1. **标题** (title): 一个吸引人的小说标题
2. **核心设定** (premise): 200-300字的核心设定和故事梗概
3. **主题标签** (themeTags): 3-5个核心主题标签（如：成长、复仇、权谋、爱情等）
4. **基调风格** (toneProfile): 描述小说的整体基调（如：轻松幽默、热血激昂、黑暗压抑等）
5. **核心冲突** (coreConflicts): 3-5个主要冲突点
6. **主要角色** (mainEntities): 3-5个核心角色，每个包含：
   - name: 角色名字
   - role: 角色定位（protagonist/supporting/antagonist）
   - shortMotivation: 简短的动机描述
7. **世界规则** (worldRules): 2-4条核心世界观规则（如果是现实题材可以是社会规则）
8. **关键词** (keywords): 5-8个关键词，用于后续内容生成`,
      estimatedTokens: 200,
      compressible: true,
    });

    // Output format (important)
    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
请严格按照以下JSON格式输出（不要包含markdown代码块标记）：

{
  "title": "小说标题",
  "premise": "核心设定和故事梗概...",
  "themeTags": ["主题1", "主题2", "主题3"],
  "toneProfile": "基调风格描述",
  "coreConflicts": ["冲突1", "冲突2", "冲突3"],
  "mainEntities": [
    {
      "name": "角色名",
      "role": "protagonist",
      "shortMotivation": "动机描述"
    }
  ],
  "worldRules": ["规则1", "规则2"],
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`,
      estimatedTokens: 150,
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
- 世界观要自洽且有扩展性`,
      estimatedTokens: 80,
      compressible: true,
    });

    return modules;
  }

  /**
   * Generate candidates with routing strategy
   */
  private async generateCandidatesWithRouting(
    prompt: string,
    primaryModel: any,
    fallbackModel: any | undefined,
    executionLogs: PromptExecutionLog[]
  ): Promise<ProjectMeta[]> {
    const candidates: ProjectMeta[] = [];

    for (let i = 0; i < this.MAX_CANDIDATES; i++) {
      try {
        const executionId = this.generateExecutionId();
        const promptHash = this.hashContent(prompt);

        // Try primary model
        let result;
        let usedModel = primaryModel;

        try {
          result = await Promise.race([
            aiService.generate({
              prompt,
              modelId: primaryModel.modelId,
              provider: primaryModel.provider,
              baseUrl: primaryModel.baseUrl || "",
              apiKey: primaryModel.apiKey || undefined,
              parameters: {
                temperature: 0.7 + i * 0.1,
                maxTokens: 2000,
              },
            }),
            this.timeout(this.GENERATION_TIMEOUT),
          ]);
        } catch (primaryError: any) {
          // Fallback to big model if available
          if (fallbackModel) {
            console.log(
              `[Fallback] Primary model failed, trying fallback: ${fallbackModel.modelId}`
            );
            usedModel = fallbackModel;
            result = await Promise.race([
              aiService.generate({
                prompt,
                modelId: fallbackModel.modelId,
                provider: fallbackModel.provider,
                baseUrl: fallbackModel.baseUrl || "",
                apiKey: fallbackModel.apiKey || undefined,
                parameters: {
                  temperature: 0.7 + i * 0.1,
                  maxTokens: 2000,
                },
              }),
              this.timeout(this.GENERATION_TIMEOUT),
            ]);
          } else {
            throw primaryError;
          }
        }

        const responseHash = this.hashContent(result.content);
        const projectMeta = this.parseProjectMetaResponse(result.content);

        if (projectMeta) {
          candidates.push(projectMeta);
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
            temperature: 0.7 + i * 0.1,
            maxTokens: 2000,
          },
          responseHash,
          responseSummary: projectMeta?.title || "解析失败",
          tokensUsed: result.tokensUsed,
          timestamp: new Date(),
        });
      } catch (error: any) {
        console.error(`Candidate ${i + 1} generation failed:`, error.message);
      }
    }

    return candidates;
  }

  /**
   * Score candidates using rule-based + semantic scoring
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
      const ruleScore = this.calculateRuleScore(candidate);
      let semanticScore = 0;
      let embedding: number[] | undefined;

      // Calculate semantic score if embedding model available
      if (embeddingModel) {
        try {
          semanticScore = await this.calculateSemanticScore(
            candidate,
            embeddingModel
          );
        } catch (error) {
          console.warn("Semantic scoring failed, using rule score only");
          semanticScore = ruleScore; // Fallback to rule score
        }
      } else {
        semanticScore = ruleScore; // No embedding model, use rule score
      }

      // Combined score: 60% rule-based, 40% semantic
      const totalScore = ruleScore * 0.6 + semanticScore * 0.4;

      scored.push({
        candidate,
        ruleScore,
        semanticScore,
        totalScore,
        embedding,
      });
    }

    return scored.sort((a, b) => b.totalScore - a.totalScore);
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
   * Calculate semantic score using embedding model
   */
  private async calculateSemanticScore(
    meta: ProjectMeta,
    embeddingModel: any
  ): Promise<number> {
    try {
      // Generate text representation for embedding
      const textForEmbedding = `${meta.title} ${meta.premise} ${meta.themeTags.join(" ")} ${meta.toneProfile}`;

      // Get embedding (this will use the actual embedding model)
      const response = await fetch(`${embeddingModel.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${embeddingModel.apiKey || process.env[`${embeddingModel.provider.toUpperCase()}_API_KEY`]}`,
        },
        body: JSON.stringify({
          model: embeddingModel.modelId,
          input: textForEmbedding,
        }),
      });

      if (!response.ok) {
        throw new Error("Embedding generation failed");
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      // Calculate semantic quality metrics
      // 1. Diversity score (variance in embedding dimensions)
      const diversity = this.calculateVectorDiversity(embedding);

      // 2. Coherence score (based on embedding magnitude)
      const coherence = this.calculateVectorCoherence(embedding);

      // Combine metrics (0-100 scale)
      const semanticScore = (diversity * 0.5 + coherence * 0.5) * 100;

      return Math.min(semanticScore, 100);
    } catch (error) {
      console.warn("Semantic scoring failed, falling back to rule score:", error);
      return this.calculateRuleScore(meta);
    }
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
   * Merge best candidates to create optimal ProjectMeta
   */
  private mergeCandidates(scored: ScoredCandidate[]): ProjectMeta {
    if (scored.length === 1) {
      return scored[0].candidate;
    }

    // Take best candidate as base
    const base = scored[0].candidate;

    // Merge unique elements from other candidates
    const allThemeTags = new Set(base.themeTags);
    const allKeywords = new Set(base.keywords);
    const allConflicts = [...base.coreConflicts];
    const allWorldRules = [...base.worldRules];

    for (let i = 1; i < Math.min(scored.length, 3); i++) {
      const candidate = scored[i].candidate;

      // Merge theme tags (keep unique)
      candidate.themeTags.forEach((tag) => allThemeTags.add(tag));

      // Merge keywords (keep unique)
      candidate.keywords.forEach((kw) => allKeywords.add(kw));

      // Add unique conflicts
      candidate.coreConflicts.forEach((conflict) => {
        if (!allConflicts.some((c) => this.isSimilar(c, conflict))) {
          allConflicts.push(conflict);
        }
      });

      // Add unique world rules
      candidate.worldRules.forEach((rule) => {
        if (!allWorldRules.some((r) => this.isSimilar(r, rule))) {
          allWorldRules.push(rule);
        }
      });
    }

    return {
      ...base,
      themeTags: Array.from(allThemeTags).slice(0, 6),
      keywords: Array.from(allKeywords).slice(0, 10),
      coreConflicts: allConflicts.slice(0, 5),
      worldRules: allWorldRules.slice(0, 5),
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
   * Create project entities in database
   */
  private async createProjectEntities(
    projectId: string,
    meta: ProjectMeta
  ): Promise<void> {
    // Create main outline
    await storage.createOutline({
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

    // Create characters
    for (const entity of meta.mainEntities) {
      await storage.createCharacter({
        projectId,
        name: entity.name,
        role: entity.role,
        personality: entity.shortMotivation,
        background: "",
        appearance: "",
        abilities: "",
        relationships: {},
        growth: "",
        notes: "",
      });
    }

    // Create world settings
    if (meta.worldRules.length > 0) {
      await storage.createWorldSetting({
        projectId,
        category: "rules",
        title: "世界规则",
        content: meta.worldRules.join("\n\n"),
        tags: meta.keywords,
        details: {},
      });
    }
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
   * Parse AI response
   */
  private parseProjectMetaResponse(content: string): ProjectMeta | null {
    try {
      let jsonStr = content.trim();
      jsonStr = jsonStr
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "");
      jsonStr = jsonStr.trim();

      const data = JSON.parse(jsonStr);

      if (!data.title || !data.premise) {
        return null;
      }

      return {
        title: data.title,
        premise: data.premise,
        themeTags: Array.isArray(data.themeTags) ? data.themeTags : [],
        toneProfile: data.toneProfile || "",
        coreConflicts: Array.isArray(data.coreConflicts)
          ? data.coreConflicts
          : [],
        mainEntities: Array.isArray(data.mainEntities) ? data.mainEntities : [],
        worldRules: Array.isArray(data.worldRules) ? data.worldRules : [],
        keywords: Array.isArray(data.keywords) ? data.keywords : [],
      };
    } catch (error) {
      console.error("Failed to parse ProjectMeta:", error);
      return null;
    }
  }

  /**
   * Infer genre from meta
   */
  private inferGenre(meta: ProjectMeta): string {
    const keywords = [...meta.themeTags, ...meta.keywords]
      .join(" ")
      .toLowerCase();

    if (keywords.includes("修仙") || keywords.includes("仙侠")) return "仙侠";
    if (keywords.includes("玄幻") || keywords.includes("魔法")) return "玄幻";
    if (keywords.includes("都市") || keywords.includes("现代")) return "都市";
    if (keywords.includes("科幻") || keywords.includes("未来")) return "科幻";
    if (keywords.includes("历史") || keywords.includes("古代")) return "历史";
    if (keywords.includes("言情") || keywords.includes("爱情")) return "言情";
    if (keywords.includes("武侠") || keywords.includes("江湖")) return "武侠";

    return "其他";
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
${meta.keywords.join("、")}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error("操作超时")), ms);
    });
  }
}

export const enhancedProjectCreationService =
  new EnhancedProjectCreationService();
