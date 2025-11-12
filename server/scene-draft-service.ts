// Scene Frame and Draft Generation Service
// Implements the incremental draft algorithm from design document:
// - SceneFrame decomposition
// - Incremental draft generation with context
// - Rule-based validation
// - Entity tracking and state management

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { promptPackingService, type PromptModule } from "./prompt-packing-service";
import { modelRoutingService } from "./model-routing-service";
import { semanticCacheService } from "./semantic-cache-service";
import { entityStateService } from "./entity-state-service";
import { fewShotExamplesService } from "./few-shot-examples-service";
import { styleGuidanceService } from "./style-guidance-service";
import crypto from "crypto";

// ============================================================================
// Types & Interfaces
// ============================================================================

// Use types from schema instead of redefining
import type { SceneFrame as DBSceneFrame, DraftChunk as DBDraftChunk } from "@shared/schema";
import { error } from "console";

export type SceneFrame = DBSceneFrame;
export type DraftChunk = DBDraftChunk;

export interface DraftContext {
  previousContent?: string; // 上文内容
  characters?: any; // 角色信息（可以是string或对象数组）
  worldSettings?: string; // 世界观
  outlineContext?: string; // 大纲上下文（已废弃，使用chapterOutline）
  sceneFrame?: SceneFrame; // 当前场景框架
  
  // Enhanced context fields
  projectSummary?: {
    coreConflicts: string;
    themeTags: string;
    toneProfile: string;
  } | null;
  chapterOutline?: {
    title: string;
    summary: string;
    beats: string[];
    requiredEntities: string[];
    focalEntities: string[];
    stakesDelta: string;
    entryState: string;
    exitState: string;
  };
  currentScene?: {
    index: number;
    total: number;
    beat: string;
    previousBeat: string | null;
    nextBeat: string | null;
  };
  adjacentSummaries?: {
    previous: string | null;
    next: string | null;
  };
  allCharacters?: string;
}

export interface RuleCheckResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationResult {
  draft: DraftChunk;
  ruleCheck: RuleCheckResult;
  executionLog: any;
  usedFallback: boolean;
}

// ============================================================================
// Scene and Draft Service
// ============================================================================

export class SceneDraftService {
  private readonly TEMPLATE_VERSION = "1.0.0";
  private readonly TOKEN_BUDGET = 4000;
  private readonly GENERATION_TIMEOUT = 90000; // 90 seconds for draft
  private readonly SCENE_TARGET_WORDS = 800; // Default target words per scene
  private readonly MIN_CHAPTER_WORDS = 3000; // Minimum words per chapter

  /**
   * Calculate target words for each scene based on chapter requirements
   */
  private calculateSceneTargetWords(totalScenes: number): number {
    // Ensure chapter has at least MIN_CHAPTER_WORDS
    const minWordsPerScene = Math.ceil(this.MIN_CHAPTER_WORDS / totalScenes);
    
    // Use the larger of default or calculated minimum
    const targetWords = Math.max(this.SCENE_TARGET_WORDS, minWordsPerScene);
    
    // Cap at 1500 words per scene to avoid overly long scenes
    const finalTarget = Math.min(targetWords, 1500);
    
    console.log(
      `[Scene Target] Total scenes: ${totalScenes}, Min per scene: ${minWordsPerScene}, Target: ${finalTarget} words`
    );
    
    return finalTarget;
  }

  /**
   * Decompose chapter into scene frames and persist to database
   */
  async decomposeChapterIntoScenes(
    projectId: string,
    chapterId: string
  ): Promise<SceneFrame[]> {
    try {
      // Check if scenes already exist
      const existingScenes = await storage.getSceneFramesByChapter(chapterId);
      if (existingScenes.length > 0) {
        console.log(`[Scene Decomposition] Using existing ${existingScenes.length} scenes`);
        return existingScenes;
      }

      // Get chapter info
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        throw new Error("章节不存在");
      }

      // Get chapter outline
      const outlines = await storage.getOutlinesByProject(projectId);
      const chapterOutline = outlines.find(
        (o) => o.type === "chapter" && o.linkedChapterId === chapterId
      );

      if (!chapterOutline || !chapterOutline.plotNodes) {
        throw new Error("未找到章节大纲");
      }

      const plotNodes = chapterOutline.plotNodes as any;
      const beats = plotNodes.beats || [];
      const requiredEntities = plotNodes.requiredEntities || [];
      const focalEntities = plotNodes.focalEntities || requiredEntities.slice(0, 2);
      const entryState = plotNodes.entryState || "章节开始";
      const exitState = plotNodes.exitState || "章节结束";

      if (beats.length === 0) {
        throw new Error("章节大纲缺少节拍信息");
      }

      // Create scene frames based on beats
      const scenes: SceneFrame[] = [];
      
      for (let i = 0; i < beats.length; i++) {
        const beat = beats[i];
        
        // Determine entry and exit states for each scene
        let sceneEntryState: string;
        let sceneExitState: string;
        
        if (i === 0) {
          sceneEntryState = entryState;
        } else {
          sceneEntryState = `承接场景${i}：${beats[i - 1].substring(0, 30)}`;
        }
        
        if (i === beats.length - 1) {
          sceneExitState = exitState;
        } else {
          sceneExitState = `引出场景${i + 2}：${beats[i + 1].substring(0, 30)}`;
        }

        // Distribute focal entities across scenes
        const sceneFocalEntities = this.distributeFocalEntities(
          focalEntities,
          i,
          beats.length
        );

        const sceneFrame = await storage.createSceneFrame({
          chapterId,
          index: i,
          purpose: beat,
          entryStateSummary: sceneEntryState,
          exitStateSummary: sceneExitState,
          focalEntities: sceneFocalEntities,
          tokensEstimate: Math.ceil(this.SCENE_TARGET_WORDS / 3.5),
        });

        scenes.push(sceneFrame);
      }

      console.log(`[Scene Decomposition] Created ${scenes.length} scene frames`);
      return scenes;
    } catch (error: any) {
      throw new Error(`场景分解失败: ${error.message}`);
    }
  }

  /**
   * Distribute focal entities across scenes
   */
  private distributeFocalEntities(
    allEntities: string[],
    sceneIndex: number,
    totalScenes: number
  ): string[] {
    if (allEntities.length === 0) return [];
    if (allEntities.length <= 2) return allEntities;

    // Rotate entities across scenes to ensure variety
    const startIndex = (sceneIndex * 2) % allEntities.length;
    const entities = [
      allEntities[startIndex],
      allEntities[(startIndex + 1) % allEntities.length],
    ];

    return Array.from(new Set(entities)); // Remove duplicates
  }

  /**
   * Generate draft for a scene
   * Implements incremental draft algorithm with rule checking and caching
   */
  async generateSceneDraft(
    projectId: string,
    sceneFrame: SceneFrame,
    context: DraftContext,
    targetWords?: number // Optional override for target words
  ): Promise<GenerationResult> {
    // Calculate target words based on total scenes if not provided
    const contextData = context as any;
    const totalScenes = contextData.currentScene?.total || 1;
    const sceneTargetWords = targetWords || this.calculateSceneTargetWords(totalScenes);
    try {
      // Step 1: Check cache first
      const cacheResult = await semanticCacheService.checkCache(
        "scene-draft-generation",
        sceneFrame,
        context
      );

      if (cacheResult.hit && cacheResult.draftChunk) {
        console.log("[Draft] Using cached content");
        
        // Return cached draft with execution log
        const executionId = this.generateExecutionId();
        return {
          draft: cacheResult.draftChunk,
          ruleCheck: {
            passed: cacheResult.draftChunk.ruleCheckPassed || false,
            errors: (cacheResult.draftChunk.ruleCheckErrors as string[]) || [],
            warnings: (cacheResult.draftChunk.ruleCheckWarnings as string[]) || [],
          },
          executionLog: {
            executionId,
            templateId: "scene-draft-generation-cached",
            templateVersion: this.TEMPLATE_VERSION,
            promptHash: "cached",
            promptMetadata: {
              cached: true,
              signatureId: cacheResult.signatureId,
            },
            modelId: "cache",
            modelVersion: "1.0",
            params: {},
            responseHash: this.hashContent(cacheResult.draftChunk.content),
            responseSummary: cacheResult.draftChunk.localSummary || "",
            tokensUsed: 0, // No tokens used for cache hit
            timestamp: new Date(),
          },
          usedFallback: false,
        };
      }

      // Step 2: Calculate routing signals
      const signals = {
        draftConfidence: 0.6, // Medium confidence for draft
        conflictDensity: 0.2,
        templateComplexity: 0.5,
        budgetFactor: 0.6,
      };

      // Step 3: Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);

      // Build contextual prompt (now async)
      const promptModules = await this.buildDraftPromptModules(
        projectId,
        sceneFrame,
        context,
        sceneTargetWords
      );
      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(
        `[Draft Generation] Scene ${sceneFrame.index}, Budget: ${packedPrompt.metadata.totalTokens}/${this.TOKEN_BUDGET}`
      );

      // Generate draft
      let result;
      let usedModel = routing.primaryModel;
      let usedFallback = false;

      try {
        result = await Promise.race([
          aiService.generate({
            prompt: packedPrompt.promptText,
            modelId: routing.primaryModel.modelId,
            provider: routing.primaryModel.provider,
            baseUrl: routing.primaryModel.baseUrl || "",
            apiKey: routing.primaryModel.apiKey || undefined,
            parameters: {
              temperature: 0.7, // 降低temperature提升稳定性和质量
              maxTokens: Math.ceil(sceneTargetWords / 0.3), // 动态调整maxTokens（约3倍字数）
            },
          }),
          this.timeout(this.GENERATION_TIMEOUT),
        ]);
      } catch (primaryError: any) {
        // Fallback to big model if available
        if (routing.fallbackModel) {
          console.log(`[Fallback] Using fallback model: ${routing.fallbackModel.modelId}`);
          usedModel = routing.fallbackModel;
          usedFallback = true;

          result = await Promise.race([
            aiService.generate({
              prompt: packedPrompt.promptText,
              modelId: routing.fallbackModel.modelId,
              provider: routing.fallbackModel.provider,
              baseUrl: routing.fallbackModel.baseUrl || "",
              apiKey: routing.fallbackModel.apiKey || undefined,
              parameters: {
                temperature: 0.7,
                maxTokens: Math.ceil(sceneTargetWords / 0.3),
              },
            }),
            this.timeout(this.GENERATION_TIMEOUT),
          ]);
        } else {
          throw primaryError;
        }
      }

      // Run rule checks
      let ruleCheck = this.runRuleChecks(result.content, sceneFrame, context, sceneTargetWords);

      // If rule check fails and we haven't used fallback, try fallback
      if (!ruleCheck.passed && !usedFallback && routing.fallbackModel) {
        console.log(`[Rule Check Failed] Retrying with fallback model`);
        
        result = await aiService.generate({
          prompt: packedPrompt.promptText + `\n\n注意：请确保内容符合以下要求：\n${ruleCheck.errors.join("\n")}`,
          modelId: routing.fallbackModel.modelId,
          provider: routing.fallbackModel.provider,
          baseUrl: routing.fallbackModel.baseUrl || "",
          apiKey: routing.fallbackModel.apiKey || undefined,
          parameters: {
            temperature: 0.7,
            maxTokens: Math.ceil(sceneTargetWords / 0.3), // Adjust maxTokens based on target words
          },
        });

        usedFallback = true;
        ruleCheck = this.runRuleChecks(result.content, sceneFrame, context, sceneTargetWords);
      }

      // Extract mentions
      const mentions = this.extractMentions(result.content, context);
      const localSummary = this.generateLocalSummary(result.content);
      const executionId = this.generateExecutionId();

      // Persist draft chunk to database
      const draftChunk = await storage.createDraftChunk({
        sceneId: sceneFrame.id,
        content: result.content,
        mentions,
        localSummary,
        createdFromExecId: executionId,
        wordCount: result.content.length,
        ruleCheckPassed: ruleCheck.passed,
        ruleCheckErrors: ruleCheck.errors,
        ruleCheckWarnings: ruleCheck.warnings,
      });

      // Calculate quality score and save to cache
      const qualityScore = semanticCacheService.calculateQualityScore(
        result.content,
        ruleCheck,
        sceneTargetWords
      );

      // Save to cache for future reuse (async, don't wait)
      semanticCacheService
        .saveToCache(
          "scene-draft-generation",
          sceneFrame,
          context,
          draftChunk.id,
          result.tokensUsed,
          qualityScore
        )
        .catch((err) => console.error("[Cache] Save failed:", err));

      // Update entity tracking for mentioned characters
      await this.updateEntityTracking(
        projectId,
        sceneFrame,
        mentions,
        result.content
      );

      // Check for motivation drift (async, don't block)
      this.checkMotivationDrift(projectId, sceneFrame, result.content).catch((err) =>
        console.error("[Motivation Drift] Check failed:", err)
      );

      // Create execution log
      const executionLog = {
        executionId,
        templateId: "scene-draft-generation",
        templateVersion: this.TEMPLATE_VERSION,
        promptHash: this.hashContent(packedPrompt.promptText),
        promptMetadata: {
          sceneIndex: sceneFrame.index,
          usedModel: usedModel.modelId,
          usedFallback,
          budgetUsed: packedPrompt.metadata.budgetUsed,
        },
        modelId: usedModel.modelId,
        modelVersion: usedModel.provider,
        params: {
          temperature: 0.7,
          maxTokens: 3000,
        },
        responseHash: this.hashContent(result.content),
        responseSummary: localSummary,
        tokensUsed: result.tokensUsed,
        timestamp: new Date(),
      };

      return {
        draft: draftChunk,
        ruleCheck,
        executionLog,
        usedFallback,
      };
    } catch (error: any) {
      throw new Error(`场景草稿生成失败: ${error.message}`);
    }
  }

  /**
   * Build draft prompt modules with context
   * Now async to support few-shot and entity-state services
   */
  private async buildDraftPromptModules(
    projectId: string,
    sceneFrame: SceneFrame,
    context: DraftContext,
    targetWords: number
  ): Promise<PromptModule[]> {
    const modules: PromptModule[] = [];

    // Extract context data
    const contextData = context as any;
    const projectSummary = contextData.projectSummary;
    const chapterOutline = contextData.chapterOutline;
    const currentScene = contextData.currentScene;
    const characters = contextData.characters || [];
    const adjacentSummaries = contextData.adjacentSummaries || {};

    // System role
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: "你是一位资深的网络小说作家，擅长创作引人入胜的场景和对话。你的文笔流畅，善于刻画人物心理和环境氛围。",
      estimatedTokens: 40,
      compressible: false,
    });

    // Style guidance (must-have - 风格指导是核心)
    if (projectSummary && projectSummary.toneProfile) {
      const styleGuidanceContent = styleGuidanceService.buildStyleGuidancePrompt(
        projectSummary.toneProfile
      );
      
      modules.push({
        id: "style-guidance",
        priority: "must-have",
        content: styleGuidanceContent,
        estimatedTokens: 400, // 风格指导内容较多，但非常重要
        compressible: false, // 不可压缩，确保风格指导完整传达
      });
    }

    // Project summary (must-have for context)
    if (projectSummary) {
      modules.push({
        id: "project-summary",
        priority: "must-have",
        content: `# 作品背景
主题：${projectSummary.themeTags || "未指定"}
核心冲突：
${projectSummary.coreConflicts || "未指定"}`,
        estimatedTokens: 80,
        compressible: false,
      });
    }

    // Chapter outline (must-have - critical for following plot)
    if (chapterOutline) {
      const beatContext = currentScene ? `
当前节拍：${currentScene.beat}
${currentScene.previousBeat ? `上一节拍：${currentScene.previousBeat}` : ""}
${currentScene.nextBeat ? `下一节拍：${currentScene.nextBeat}` : ""}` : "";

      modules.push({
        id: "chapter-outline",
        priority: "must-have",
        content: `# 章节大纲
章节标题：${chapterOutline.title}
章节概括：${chapterOutline.summary}

## 章节节拍
${chapterOutline.beats.map((b: string, i: number) => `${i + 1}. ${b}`).join("\n")}

## 当前场景位置
${beatContext}

## 章节目标
必需角色：${chapterOutline.requiredEntities.join("、")}
风险变化：${chapterOutline.stakesDelta}
入场状态：${chapterOutline.entryState}
出场状态：${chapterOutline.exitState}`,
        estimatedTokens: 250,
        compressible: false,
      });
    }

    // Enhanced character information (important)
    if (characters.length > 0) {
      const charContent = characters.map((c: any) => {
        const parts = [`【${c.name}】（${c.role}）`];
        if (c.personality) parts.push(`性格：${c.personality}`);
        if (c.motivation) parts.push(`核心动机：${c.motivation}`);
        if (c.currentGoal) parts.push(`当前目标：${c.currentGoal}`);
        if (c.currentEmotion) parts.push(`当前情绪：${c.currentEmotion}`);
        if (c.abilities) parts.push(`能力特长：${c.abilities}`);
        if (c.background) parts.push(`背景：${c.background.substring(0, 100)}`);
        return parts.join("\n");
      }).join("\n\n");

      modules.push({
        id: "characters",
        priority: "important",
        content: `# 焦点角色信息\n${charContent}`,
        estimatedTokens: 200,
        compressible: true,
      });
    }

    // Previous content (important for continuity)
    if (context.previousContent) {
      modules.push({
        id: "previous-content",
        priority: "important",
        content: `# 上文内容
${adjacentSummaries.previous ? `上一场景摘要：${adjacentSummaries.previous}\n\n` : ""}最近内容：
${context.previousContent}`,
        estimatedTokens: 300,
        compressible: true,
      });
    }

    // World settings (optional - can be omitted if token budget is tight)
    if (context.worldSettings) {
      modules.push({
        id: "world-settings",
        priority: "optional",
        content: `# 世界观设定\n${context.worldSettings}`,
        estimatedTokens: 150,
        compressible: true,
      });
    }

    // Scene frame with enhanced guidance (must-have)
    const focalEntities = sceneFrame.focalEntities || [];
    const focalChars = characters.filter((c: any) => focalEntities.includes(c.name));
    
    modules.push({
      id: "scene-frame",
      priority: "must-have",
      content: `# 当前场景任务
场景序号：第${sceneFrame.index + 1}个场景（共${currentScene?.total || "?"}个）
场景目的：${sceneFrame.purpose}

## 写作目标
${this.buildWritingGoal(sceneFrame, focalChars, chapterOutline)}

## 场景状态
入场：${sceneFrame.entryStateSummary || "场景开始"}
出场：${sceneFrame.exitStateSummary || "场景结束"}
${adjacentSummaries.next ? `\n引出下一场景：${adjacentSummaries.next}` : ""}`,
      estimatedTokens: 150,
      compressible: false,
    });

    // Simplified constraints with guidance (must-have)
    modules.push({
      id: "writing-guidance",
      priority: "must-have",
      content: `# 写作要求

## 核心约束
1. 字数：${targetWords}字左右（±20%）${targetWords > 1000 ? `\n   注意：本场景需要较多字数，请充分展开情节，增加细节描写和对话` : ""}
2. 角色：${focalEntities.join("、")}必须出现并推动情节
3. 目的：完成"${sceneFrame.purpose}"

## 写作指导
【场景展开】
- 开场：从"${sceneFrame.entryStateSummary}"开始，用具体的动作或对话切入
- 发展：围绕场景目的展开，展现角色的动机和冲突
- 结尾：达到"${sceneFrame.exitStateSummary}"，为下一场景埋下伏笔

【角色刻画】
${focalChars.map((c: any) => `- ${c.name}：${c.motivation ? `动机是"${c.motivation}"，` : ""}${c.currentGoal ? `当前目标是"${c.currentGoal}"，` : ""}通过对话和动作展现其${c.personality || "性格特点"}`).join("\n")}

【禁止事项】
- 不要写"好的"、"让我"等元评论
- 不要使用"他想"、"他觉得"等心理描写
- 不要在开头或结尾加说明性文字

【质量要求】
- 对话要符合人物性格，推进情节
- 描写要具体生动，避免空洞形容词
- 节奏要紧凑，每句话都有作用
- 结尾要有钩子或悬念`,
      estimatedTokens: 300,
      compressible: false,
    });



    // Entity states (optional - only if not already in characters module)
    if (sceneFrame.focalEntities && sceneFrame.focalEntities.length > 0 && characters.length === 0) {
      try {
        const entityStatesContent = await entityStateService.buildEntityStatesPrompt(
          projectId,
          sceneFrame.focalEntities
        );

        modules.push({
          id: "entity-states",
          priority: "optional",
          content: entityStatesContent,
          estimatedTokens: 150,
          compressible: true,
        });
      } catch (error) {
        console.log("[Scene Draft] Entity states not available, skipping");
      }
    }

    // Few-shot example (optional) - 高质量示例（使用fewShotExamplesService）
    try {
      const sceneType = this.inferSceneType(sceneFrame.purpose);
      const fewShotContent = await fewShotExamplesService.buildFewShotModule(
        sceneType,
        sceneFrame.purpose,
        true // 使用embedding进行语义匹配
      );

      if (fewShotContent) {
        // 添加风格提示
        const styleHint = projectSummary?.toneProfile 
          ? styleGuidanceService.getStyleFewShotHint(projectSummary.toneProfile)
          : "";
        
        const contentWithStyleHint = styleHint 
          ? `${fewShotContent}\n\n${styleHint}`
          : fewShotContent;

        modules.push({
          id: "few-shot-example",
          priority: "optional",
          content: contentWithStyleHint,
          estimatedTokens: 420,
          compressible: true,
        });
      }
    } catch (error) {
      console.log("[Scene Draft] Failed to get few-shot example, skipping");
    }

    // Output format (must-have) - 简化的输出要求
    modules.push({
      id: "output-format",
      priority: "must-have",
      content: `# 输出格式
直接输出场景内容，不要包含任何说明性文字或开场白。

内容结构：
- 开场：从"${sceneFrame.entryStateSummary}"自然切入
- 发展：围绕"${sceneFrame.purpose}"展开
- 结尾：达到"${sceneFrame.exitStateSummary}"并埋下伏笔

立即开始写作，保持沉浸式叙事。`,
      estimatedTokens: 100,
      compressible: false,
    });

    return modules;
  }

  /**
   * Build specific writing goal from scene frame and character info
   */
  private buildWritingGoal(
    sceneFrame: SceneFrame,
    focalChars: any[],
    chapterOutline: any
  ): string {
    const purpose = sceneFrame.purpose;
    const goals: string[] = [];

    // Analyze purpose to extract writing goals
    if (purpose.includes("对峙") || purpose.includes("对抗") || purpose.includes("冲突")) {
      goals.push("营造紧张对峙的氛围");
      goals.push("展现双方的力量对比");
    }
    
    if (purpose.includes("对话") || purpose.includes("交谈") || purpose.includes("商议")) {
      goals.push("通过对话推进情节");
      goals.push("展现角色的立场和动机");
    }
    
    if (purpose.includes("战斗") || purpose.includes("打斗") || purpose.includes("交手")) {
      goals.push("描写紧张刺激的战斗场面");
      goals.push("展现角色的能力和战斗风格");
    }
    
    if (purpose.includes("发现") || purpose.includes("揭露") || purpose.includes("得知")) {
      goals.push("揭示关键信息");
      goals.push("展现角色的反应和情绪变化");
    }
    
    if (purpose.includes("决定") || purpose.includes("选择") || purpose.includes("抉择")) {
      goals.push("展现角色的内心挣扎");
      goals.push("推动情节走向关键转折");
    }

    // Add character-specific goals
    if (focalChars.length > 0) {
      const charNames = focalChars.map((c: any) => c.name).join("和");
      goals.push(`展现${charNames}的性格特点和动机`);
    }

    // Add chapter-level goal
    if (chapterOutline?.stakesDelta) {
      goals.push(`推进"${chapterOutline.stakesDelta}"`);
    }

    // Default goal if none matched
    if (goals.length === 0) {
      goals.push("完成场景目的，推进情节发展");
      goals.push("展现角色的行动和反应");
    }

    return goals.map((g, i) => `${i + 1}. ${g}`).join("\n");
  }

  /**
   * Infer scene type from purpose
   */
  private inferSceneType(purpose: string): string {
    const keywords = {
      对话: ["对话", "交谈", "说", "问", "答", "谈话", "商议"],
      动作: ["战斗", "打斗", "追逐", "逃跑", "攻击", "防御", "施展"],
      描写: ["环境", "景色", "氛围", "场景", "描述"],
      心理: ["思考", "回忆", "犹豫", "决定", "内心", "情感"],
    };

    for (const [type, words] of Object.entries(keywords)) {
      if (words.some((word) => purpose.includes(word))) {
        return type;
      }
    }

    return "综合";
  }

  /**
   * Build entity states module (for future enhancement)
   * This will be fully implemented when character state tracking is added
   */
  private async buildEntityStatesModule(
    entityNames: string[],
    charactersContext: string
  ): Promise<string> {
    // TODO: Fetch actual character states from database
    // For now, extract from context
    return entityNames.map(name => {
      const charMatch = charactersContext.match(new RegExp(`${name}[^\\n]*`, 'g'));
      return `【${name}】- ${charMatch ? charMatch[0] : "未知"}`;
    }).join("\n");
  }

  /**
   * Run rule-based checks on generated content
   * Enhanced with naming consistency and timeline checks
   */
  private runRuleChecks(
    content: string,
    sceneFrame: SceneFrame,
    context: DraftContext,
    targetWords: number
  ): RuleCheckResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check 1: Content length
    const wordCount = content.length;
    if (wordCount < targetWords * 0.5) {
      errors.push(`内容过短（${wordCount}字），目标${targetWords}字`);
    } else if (wordCount < targetWords * 0.7) {
      warnings.push(`内容偏短（${wordCount}字），建议${targetWords}字`);
    } else if (wordCount > targetWords * 1.5) {
      warnings.push(`内容过长（${wordCount}字），建议${targetWords}字`);
    }

    // Check 2: Required entities mentioned
    const focalEntities = sceneFrame.focalEntities || [];
    for (const entity of focalEntities) {
      if (!content.includes(entity)) {
        errors.push(`缺少焦点角色：${entity}`);
      }
    }

    // Check 3: No meta-commentary
    const metaPatterns = [
      /^(好的|明白|我来|让我|下面|接下来|根据)/,
      /^(这是|这段|本场景|本章)/,
      /(以上|以下)是/,
      /让我们/,
      /现在让我/,
    ];

    for (const pattern of metaPatterns) {
      if (pattern.test(content)) {
        errors.push("内容包含元评论或说明性文字，应直接开始故事");
        break;
      }
    }

    // Check 4: Reasonable dialogue ratio
    const dialogueCount = (content.match(/["「『]/g) || []).length;
    const dialogueRatio = dialogueCount / (wordCount / 100);
    if (dialogueRatio > 50) {
      warnings.push("对话过多，建议增加叙述和描写");
    } else if (dialogueRatio < 5 && wordCount > 500) {
      warnings.push("对话过少，建议增加人物对话");
    }

    // Check 5: Paragraph structure
    const paragraphs = content.split("\n\n").filter((p) => p.trim());
    if (paragraphs.length < 3 && wordCount > 500) {
      warnings.push("段落过少，建议分段以提高可读性");
    }

    // Check 6: Naming consistency (enhanced)
    const namingIssues = this.checkNamingConsistency(content, focalEntities);
    warnings.push(...namingIssues);

    // Check 7: Timeline consistency (enhanced)
    if (context.previousContent) {
      const timelineIssues = this.checkTimelineConsistency(
        content,
        context.previousContent
      );
      warnings.push(...timelineIssues);
    }

    // Check 8: State transition (enhanced)
    const stateIssues = this.checkStateTransition(content, sceneFrame);
    warnings.push(...stateIssues);

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check naming consistency for characters
   */
  private checkNamingConsistency(
    content: string,
    characterNames: string[]
  ): string[] {
    const warnings: string[] = [];

    for (const name of characterNames) {
      // Check for common naming variations
      const variations = [
        name,
        name.substring(0, 1), // 姓氏
        name.substring(1), // 名字
      ];

      const mentions = variations.filter((v) => content.includes(v));

      // If multiple variations found, warn about consistency
      if (mentions.length > 2) {
        warnings.push(
          `角色"${name}"的称呼不一致，建议统一使用全名或固定称呼`
        );
      }
    }

    return warnings;
  }

  /**
   * Check timeline consistency with previous content
   */
  private checkTimelineConsistency(
    currentContent: string,
    previousContent: string
  ): string[] {
    const warnings: string[] = [];

    // Extract time markers
    const timeMarkers = [
      "刚才",
      "之前",
      "现在",
      "此时",
      "此刻",
      "随后",
      "接着",
      "然后",
      "突然",
      "瞬间",
      "片刻",
      "良久",
    ];

    const currentMarkers = timeMarkers.filter((m) => currentContent.includes(m));
    const previousMarkers = timeMarkers.filter((m) =>
      previousContent.includes(m)
    );

    // Check for conflicting time references
    if (
      currentMarkers.includes("刚才") &&
      !previousMarkers.some((m) => ["现在", "此时", "此刻"].includes(m))
    ) {
      warnings.push("时间线可能不连贯：使用了'刚才'但上文没有明确的时间点");
    }

    // Check for sudden time jumps without transition
    if (
      currentContent.includes("第二天") ||
      currentContent.includes("次日") ||
      currentContent.includes("数日后")
    ) {
      if (!currentContent.substring(0, 100).match(/第二天|次日|数日后/)) {
        warnings.push("时间跳跃应在场景开头明确说明");
      }
    }

    return warnings;
  }

  /**
   * Check if state transition is properly handled
   */
  private checkStateTransition(
    content: string,
    sceneFrame: SceneFrame
  ): string[] {
    const warnings: string[] = [];

    const entryState = sceneFrame.entryStateSummary || "";
    const exitState = sceneFrame.exitStateSummary || "";

    // Extract key elements from states
    const entryKeywords = this.extractKeywords(entryState);
    const exitKeywords = this.extractKeywords(exitState);

    // Check if entry state is reflected in content
    let entryReflected = false;
    for (const keyword of entryKeywords) {
      if (content.substring(0, 200).includes(keyword)) {
        entryReflected = true;
        break;
      }
    }

    if (!entryReflected && entryKeywords.length > 0) {
      warnings.push(`场景开头未体现入场状态：${entryState}`);
    }

    // Check if exit state is reflected in content
    let exitReflected = false;
    for (const keyword of exitKeywords) {
      if (content.substring(content.length - 200).includes(keyword)) {
        exitReflected = true;
        break;
      }
    }

    if (!exitReflected && exitKeywords.length > 0) {
      warnings.push(`场景结尾未体现出场状态：${exitState}`);
    }

    return warnings;
  }

  /**
   * Extract keywords from state description
   */
  private extractKeywords(state: string): string[] {
    // Remove common words and extract meaningful keywords
    const commonWords = [
      "的",
      "了",
      "在",
      "是",
      "和",
      "与",
      "等",
      "着",
      "中",
      "到",
      "从",
      "对",
      "为",
      "以",
      "将",
      "被",
    ];

    const words = state
      .split(/[，。、：；！？\s]/)
      .filter((w) => w.length >= 2 && !commonWords.includes(w));

    return words.slice(0, 3); // Return top 3 keywords
  }

  /**
   * Update entity tracking for mentioned characters
   */
  private async updateEntityTracking(
    projectId: string,
    sceneFrame: SceneFrame,
    mentions: string[],
    content: string
  ): Promise<void> {
    try {
      // Get all characters for the project
      const characters = await storage.getCharactersByProject(projectId);

      // Get chapter info to determine volume index
      const chapter = await storage.getChapter(sceneFrame.chapterId);
      if (!chapter) return;

      const volumes = await storage.getVolumesByProject(projectId);
      const volume = volumes.find((v) => v.id === chapter.volumeId);
      const volumeIndex = volume?.orderIndex || 0;

      for (const mentionedName of mentions) {
        const character = characters.find((c) => c.name === mentionedName);
        if (!character) continue;

        // Find position of first mention in content
        const position = content.indexOf(mentionedName);

        // Update last mentioned
        const lastMentioned = {
          volumeIndex,
          chapterIndex: chapter.orderIndex,
          sceneIndex: sceneFrame.index,
          position,
        };

        // Update mention count
        const newMentionCount = (character.mentionCount || 0) + 1;

        // Set first appearance if not set
        const firstAppearance = character.firstAppearance || lastMentioned;

        await storage.updateCharacterTracking(character.id, {
          lastMentioned,
          mentionCount: newMentionCount,
          firstAppearance,
        });

        console.log(
          `[Entity Tracking] Updated ${mentionedName}: mentions=${newMentionCount}, last=V${volumeIndex}C${chapter.orderIndex}S${sceneFrame.index}`
        );
      }
    } catch (error: any) {
      console.error(`[Entity Tracking] Failed to update: ${error.message}`);
      // Don't throw - entity tracking failure shouldn't block draft generation
    }
  }

  /**
   * Extract character mentions from content
   */
  private extractMentions(content: string, context: DraftContext): string[] {
    const mentions: string[] = [];
    
    // Extract character names from context
    const contextData = context as any;
    
    // Try to get character names from enhanced context
    if (Array.isArray(contextData.characters)) {
      // New format: array of character objects
      for (const char of contextData.characters) {
        if (char.name && content.includes(char.name)) {
          mentions.push(char.name);
        }
      }
    } else if (typeof contextData.characters === 'string') {
      // Old format: string with character info
      const nameMatches = contextData.characters.match(/(?:^|\n)([^：\n]+)(?:：|\()/gm);
      if (nameMatches) {
        for (const match of nameMatches) {
          const name = match.replace(/^[\n\s]+/, "").replace(/[：\(].*$/, "").trim();
          if (name && content.includes(name)) {
            mentions.push(name);
          }
        }
      }
    }
    
    // Also check allCharacters field
    if (contextData.allCharacters && typeof contextData.allCharacters === 'string') {
      const allCharNames = contextData.allCharacters.split("、");
      for (const name of allCharNames) {
        const cleanName = name.replace(/（.*?）/g, "").trim();
        if (cleanName && content.includes(cleanName) && !mentions.includes(cleanName)) {
          mentions.push(cleanName);
        }
      }
    }

    return Array.from(new Set(mentions)); // Remove duplicates
  }

  /**
   * Generate local summary of content
   */
  private generateLocalSummary(content: string): string {
    // Simple extraction: first sentence or first 50 characters
    const firstSentence = content.match(/^[^。！？]+[。！？]/);
    if (firstSentence) {
      return firstSentence[0];
    }
    return content.substring(0, 50) + "...";
  }

  private generateId(): string {
    return `draft_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
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

  /**
   * Check for motivation drift in generated content
   * Creates coherence issues if drift is detected
   */
  private async checkMotivationDrift(
    projectId: string,
    sceneFrame: SceneFrame,
    content: string
  ): Promise<void> {
    try {
      const focalEntities = sceneFrame.focalEntities || [];
      if (focalEntities.length === 0) return;

      // Get characters
      const characters = await storage.getCharactersByProject(projectId);
      const relevantChars = characters.filter((c) =>
        focalEntities.includes(c.name)
      );

      // Check each character for motivation drift
      for (const char of relevantChars) {
        const driftResult = await entityStateService.checkMotivationDrift(
          char,
          content,
          true // Use embedding
        );

        if (driftResult.drifted && driftResult.confidence > 0.6) {
          // Create coherence issue
          await storage.createCoherenceIssue({
            projectId,
            chapterId: null, // Will be set when chapter is known
            type: "motivation_drift",
            severity: driftResult.confidence > 0.8 ? "high" : "medium",
            affectedScenes: [sceneFrame.id],
            evidenceSnippets: driftResult.evidence,
            status: "open",
          });

          console.log(
            `[Motivation Drift] Detected for ${char.name} (confidence: ${(driftResult.confidence * 100).toFixed(1)}%)`
          );
        }
      }
    } catch (error) {
      console.error("[Motivation Drift] Check failed:", error);
    }
  }
}

export const sceneDraftService = new SceneDraftService();
