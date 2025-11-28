// Volume and Chapter Outline Generation Service
// Implements the algorithm from design document with full refactored integration:
// - Multi-hypothesis generation for volumes
// - Beat-based chapter breakdown
// - Entity tracking and stakes progression
// - Semantic caching for cost optimization
// - Quality evaluation and auto-repair
// - Complete audit logging

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { promptPackingService, type PromptModule } from "./prompt-packing-service";
import { modelRoutingService } from "./model-routing-service";
import { semanticCacheService } from "./semantic-cache-service";
import { ruleCheckerService } from "./rule-checker-service";
import { qualityEvaluatorService } from "./quality-evaluator-service";
import { generationLogService } from "./generation-log-service";
import { costMonitorService } from "./cost-monitor-service";
import { promptTemplateService } from "./prompt-template-service";
import { autoRepairEngine } from "./auto-repair-engine";
import { contextSelectionService } from "./context-selection-service";
import {
  formatCharacterForOutline,
  formatCharacterForScene,
  buildRelationshipNetwork,
  formatCharacterGrowthContext,
  getRelevantWorldSettings,
} from "./content-generation-helpers";
import { genreConfigService } from "./genre-config-service";
import { extractJSON } from "./utils/json-extractor";
import crypto from "crypto";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface VolumeOutline {
  title: string;
  oneLiner: string; // 一句话定位
  beats: string[]; // 核心节拍
  orderIndex: number;
  themeTags?: string[]; // 主题标签
  conflictFocus?: string; // 冲突焦点
}

export interface ChapterOutline {
  title: string;
  oneLiner: string; // 一句话概括
  beats: string[]; // 章节节拍
  requiredEntities: string[]; // 必需角色
  stakesDelta: string; // 风险变化
  orderIndex: number;
  volumeIndex: number;
  focalEntities?: string[]; // 焦点角色（用于实体追踪）
  entryState?: string; // 入场状态
  exitState?: string; // 出场状态
}

export interface ScoredVolumeCandidate {
  outline: VolumeOutline;
  themeScore: number; // 主题覆盖度
  progressionScore: number; // 递进性
  writabilityScore: number; // 可写性
  totalScore: number;
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
// Volume and Chapter Generation Service
// ============================================================================

export class VolumeChapterGenerationService {
  private readonly TEMPLATE_VERSION = "2.0.0";
  private readonly MAX_VOLUME_CANDIDATES = 3;
  private readonly TOKEN_BUDGET = 3000;
  private readonly GENERATION_TIMEOUT = 120000; // 增加到120秒，章纲生成需要更长时间
  private readonly QUALITY_THRESHOLD = 70; // Minimum quality score for caching

  /**
   * Append additional volumes to existing project
   * Reads existing volumes for context continuity
   */
  async appendVolumes(
    projectId: string,
    additionalCount: number
  ): Promise<{
    volumes: VolumeOutline[];
    executionLogs: PromptExecutionLog[];
  }> {
    const executionLogs: PromptExecutionLog[] = [];

    try {
      // Validate input
      if (additionalCount < 1 || additionalCount > 20) {
        throw new Error("追加数量必须在1-20之间");
      }

      // Get existing volumes
      const existingVolumes = await storage.getVolumesByProject(projectId);

      // Check total volume count
      if (existingVolumes.length + additionalCount > 50) {
        throw new Error(`总卷数不能超过50个（当前${existingVolumes.length}个，追加${additionalCount}个）`);
      }
      const existingOutlines = await storage.getOutlinesByProject(projectId);
      const existingVolumeOutlines = existingOutlines
        .filter((o) => o.type === "volume")
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (existingVolumes.length === 0) {
        // No existing volumes, use regular generation
        return this.generateVolumes(projectId, additionalCount);
      }

      // Get project info
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error("项目不存在");
      }

      // Get main outline
      const mainOutline = existingOutlines.find((o) => o.type === "main");
      if (!mainOutline) {
        throw new Error("未找到项目总纲");
      }

      // Get characters
      const characters = await storage.getCharactersByProject(projectId);

      // Extract theme tags from main outline
      const themeTags = (mainOutline.plotNodes as any)?.themeTags || [];
      const coreConflicts = (mainOutline.plotNodes as any)?.coreConflicts || [];

      // Build rich context from existing volumes
      // Note: For volumes, we use all existing volumes as they're typically fewer
      // But format them intelligently
      const existingContext = existingVolumeOutlines
        .map((v, i) => {
          const plotNodes = v.plotNodes as any;
          const beats = plotNodes?.beats || [];
          const themeTags = plotNodes?.themeTags || [];
          const conflictFocus = plotNodes?.conflictFocus || "";

          let context = `第${i + 1}卷《${v.title}》`;

          // Add one-liner if available (most important summary)
          const volume = existingVolumes.find(vol => vol.title === v.title);
          if (volume?.description) {
            context += `\n  定位：${volume.description}`;
          }

          // Add key beats (up to 3)
          if (beats.length > 0) {
            context += `\n  节拍：${beats.slice(0, 3).join("；")}`;
          }

          // Add conflict focus
          if (conflictFocus) {
            context += `\n  冲突：${conflictFocus}`;
          }

          // Add theme tags
          if (themeTags.length > 0) {
            context += `\n  主题：${themeTags.slice(0, 3).join("、")}`;
          }

          return context;
        })
        .join("\n\n");

      console.log(`[Volume Append] Using ${existingVolumes.length} existing volumes as context`);

      const startIndex = existingVolumes.length;

      // Generate semantic summary using embedding (if available)
      let semanticSummary = "";
      try {
        const summaryText = existingVolumeOutlines
          .map(v => {
            const volume = existingVolumes.find(vol => vol.title === v.title);
            return `${v.title}：${volume?.description || ""}`;
          })
          .join("；");

        if (summaryText.length > 0) {
          // Use embedding to capture semantic essence
          const embedding = await aiService.getEmbedding(summaryText, project.userId || "");
          if (embedding) {
            semanticSummary = `\n\n# 语义摘要\n已有${existingVolumes.length}卷，涵盖主题：${themeTags.slice(0, 5).join("、")}`;
            console.log("[Volume Append] Generated semantic summary with embedding");
          }
        }
      } catch (embeddingError) {
        console.log("[Volume Append] Embedding not available, using text-only context");
      }

      // Step 1: Check semantic cache with content hash
      const contextHash = this.hashContent(existingContext);
      const cacheKey = {
        projectId,
        additionalCount,
        startIndex,
        contextHash, // Use hash instead of truncated content
      };
      let semanticSig: { signature: number[]; hash: string } | null = null;

      try {
        semanticSig = await semanticCacheService.calculateSignature(cacheKey, project.userId || "");
        const cached = await semanticCacheService.findSimilar(
          semanticSig.signature,
          "volume-append-v2"
        );

        if (cached) {
          const isValid = await semanticCacheService.quickVerify(cached.cached, cacheKey, project.userId || "");
          if (isValid) {
            console.log(`[Cache HIT] Using cached appended volumes`);
            await semanticCacheService.recordHit(cached.cached.executionId);
            return {
              volumes: cached.cached.result.volumes,
              executionLogs: [],
            };
          }
        }
      } catch (cacheError) {
        console.log("[Cache] Skipping cache check:", cacheError instanceof Error ? cacheError.message : cacheError);
      }

      // Step 2: Calculate routing signals
      const hasRichContext = themeTags.length >= 3 && characters.length >= 3;
      const signals = modelRoutingService.calculateProjectCreationSignals(
        hasRichContext,
        true,
        0.6
      );

      // Step 3: Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Volume Append] ${routing.reasoning}`);

      // Step 4: Build prompt with existing context (enhanced with semantic summary)
      const promptModules = await this.buildAppendVolumePromptModules(
        project,
        mainOutline.content || "",
        characters,
        themeTags,
        coreConflicts,
        existingContext + semanticSummary,
        startIndex,
        additionalCount
      );

      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(`[Prompt Packing] Volume append using ${packedPrompt.metadata.totalTokens} tokens`);

      // Step 5: Generate candidates
      const candidates = await this.generateVolumeCandidatesWithFallback(
        packedPrompt.promptText,
        routing.primaryModel,
        routing.fallbackModel,
        additionalCount,
        executionLogs,
        projectId
      );

      if (candidates.length === 0) {
        throw new Error("AI生成失败，未能生成有效的卷纲");
      }

      // Step 6: Score and merge
      const scoredCandidates = this.scoreVolumeCandidates(candidates, themeTags, coreConflicts);
      let finalVolumes = this.mergeVolumeCandidates(scoredCandidates, additionalCount);

      // Adjust orderIndex to continue from existing
      finalVolumes = finalVolumes.map((v, i) => ({
        ...v,
        orderIndex: startIndex + i,
      }));

      // Step 7: Validate quality
      const validation = await ruleCheckerService.validate(JSON.stringify(finalVolumes), {
        checkSemantics: false,
        checkWritability: false,
      });

      const qualityEvaluation = await qualityEvaluatorService.evaluateQuality(
        JSON.stringify(finalVolumes),
        {
          passed: validation.passed,
          score: validation.score,
          violations: validation.violations || [],
          executionTime: 0,
        },
        { targetWords: 500 }
      );

      console.log(`[Quality] Overall: ${qualityEvaluation.overall}`);

      // Step 8: Save logs
      const totalTokens = executionLogs.reduce((sum, log) => sum + log.tokensUsed, 0);
      for (const log of executionLogs) {
        const logCost = this.calculateCost(log.tokensUsed, log.modelId);

        await generationLogService.createLog({
          executionId: log.executionId,
          projectId,
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
          qualityScore: qualityEvaluation as any,
          ruleViolations: validation.violations || [],
          repairActions: undefined,
        });

        await costMonitorService.recordUsage(log.executionId, log.tokensUsed, log.modelId);
      }

      console.log(`[Cost] Total tokens: ${totalTokens}`);

      // Step 9: Cache result
      if (semanticSig && qualityEvaluation.overall >= this.QUALITY_THRESHOLD) {
        try {
          await semanticCacheService.cacheResult(
            this.generateExecutionId(),
            "volume-append-v2",
            semanticSig.signature,
            semanticSig.hash,
            this.hashContent(JSON.stringify(cacheKey)),
            { volumes: finalVolumes, executionLogs },
            cacheKey,
            qualityEvaluation.overall
          );
        } catch (cacheError) {
          console.log("[Cache] Failed to cache result:", cacheError instanceof Error ? cacheError.message : cacheError);
        }
      }

      return {
        volumes: finalVolumes,
        executionLogs,
      };
    } catch (error: any) {
      throw new Error(`追加卷纲失败: ${error.message}`);
    }
  }

  /**
   * Generate volume outlines for a project
   * Implements multi-hypothesis generation and scoring
   */
  async generateVolumes(
    projectId: string,
    targetVolumeCount: number = 3
  ): Promise<{
    volumes: VolumeOutline[];
    executionLogs: PromptExecutionLog[];
  }> {
    const executionLogs: PromptExecutionLog[] = [];

    try {
      // Get project info
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error("项目不存在");
      }

      // Get main outline
      const outlines = await storage.getOutlinesByProject(projectId);
      const mainOutline = outlines.find((o) => o.type === "main");
      if (!mainOutline) {
        throw new Error("未找到项目总纲");
      }

      // Get characters
      const characters = await storage.getCharactersByProject(projectId);

      // Extract theme tags from main outline
      const themeTags = (mainOutline.plotNodes as any)?.themeTags || [];
      const coreConflicts = (mainOutline.plotNodes as any)?.coreConflicts || [];

      // Step 1: Check semantic cache first
      const cacheKey = { projectId, targetVolumeCount, themeTags, coreConflicts };
      let semanticSig: { signature: number[]; hash: string } | null = null;

      try {
        semanticSig = await semanticCacheService.calculateSignature(cacheKey, project.userId || "");
        const cached = await semanticCacheService.findSimilar(
          semanticSig.signature,
          "volume-generation-v2"
        );

        if (cached) {
          const isValid = await semanticCacheService.quickVerify(cached.cached, cacheKey, project.userId || "");
          if (isValid) {
            console.log(`[Cache HIT] Using cached volumes (similarity: ${cached.similarity.toFixed(3)})`);
            await semanticCacheService.recordHit(cached.cached.executionId);
            return {
              volumes: cached.cached.result.volumes,
              executionLogs: [],
            };
          }
        }
      } catch (cacheError) {
        console.log("[Cache] Skipping cache check:", cacheError instanceof Error ? cacheError.message : cacheError);
      }

      // Step 2: Calculate routing signals based on complexity
      const hasRichContext = themeTags.length >= 3 && characters.length >= 3;
      const signals = modelRoutingService.calculateProjectCreationSignals(
        hasRichContext,
        true,
        0.6 // Higher complexity for volume generation
      );

      // Step 3: Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Volume Generation] ${routing.reasoning}`);

      // Step 4: Build prompt with enhanced context
      const promptModules = await this.buildVolumePromptModules(
        project,
        mainOutline.content || "",
        characters,
        themeTags,
        coreConflicts,
        targetVolumeCount
      );

      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(
        `[Prompt Packing] Volume generation using ${packedPrompt.metadata.totalTokens} tokens`
      );

      // Step 5: Generate multiple candidates with fallback
      // Ensure we have full model objects with API keys
      const models = await storage.getAIModels(project.userId || "");
      const primaryModelObj = models.find(m => m.id === routing.primaryModel);
      const fallbackModelObj = routing.fallbackModel ? models.find(m => m.id === routing.fallbackModel) : undefined;

      if (!primaryModelObj) {
        throw new Error(`Primary model not found: ${routing.primaryModel}`);
      }

      const candidates = await this.generateVolumeCandidatesWithFallback(
        packedPrompt.promptText,
        primaryModelObj,
        fallbackModelObj,
        targetVolumeCount,
        executionLogs,
        projectId
      );

      if (candidates.length === 0) {
        throw new Error("AI生成失败，未能生成有效的卷纲");
      }

      // Step 6: Score and select best with enhanced scoring
      const scoredCandidates = this.scoreVolumeCandidates(
        candidates,
        themeTags,
        coreConflicts
      );

      // Step 7: Merge best candidates with deduplication
      const finalVolumes = this.mergeVolumeCandidates(
        scoredCandidates,
        targetVolumeCount
      );

      // Step 8: Validate quality
      const validation = await ruleCheckerService.validate(
        JSON.stringify(finalVolumes),
        { checkSemantics: false, checkWritability: false }
      );

      const qualityEvaluation = await qualityEvaluatorService.evaluateQuality(
        JSON.stringify(finalVolumes),
        {
          passed: validation.passed,
          score: validation.score,
          violations: validation.violations || [],
          executionTime: 0,
        },
        { targetWords: 500 }
      );

      console.log(`[Quality] Overall: ${qualityEvaluation.overall}, Dimensions:`, qualityEvaluation.dimensions);

      // Step 9: Save generation logs
      const totalTokens = executionLogs.reduce((sum, log) => sum + log.tokensUsed, 0);
      for (const log of executionLogs) {
        const logCost = this.calculateCost(log.tokensUsed, log.modelId);

        await generationLogService.createLog({
          executionId: log.executionId,
          projectId,
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
          qualityScore: qualityEvaluation as any,
          ruleViolations: validation.violations || [],
          repairActions: undefined,
        });

        await costMonitorService.recordUsage(log.executionId, log.tokensUsed, log.modelId);
      }

      console.log(`[Cost] Total tokens: ${totalTokens}`);

      // Step 10: Cache result if quality is good
      if (semanticSig && qualityEvaluation.overall >= this.QUALITY_THRESHOLD) {
        try {
          await semanticCacheService.cacheResult(
            this.generateExecutionId(),
            "volume-generation-v2",
            semanticSig.signature,
            semanticSig.hash,
            this.hashContent(JSON.stringify(cacheKey)),
            { volumes: finalVolumes, executionLogs },
            cacheKey,
            qualityEvaluation.overall
          );
        } catch (cacheError) {
          console.log("[Cache] Failed to cache result:", cacheError instanceof Error ? cacheError.message : cacheError);
        }
      }

      return {
        volumes: finalVolumes,
        executionLogs,
      };
    } catch (error: any) {
      throw new Error(`卷纲生成失败: ${error.message}`);
    }
  }

  /**
   * Append additional chapters to existing volume
   * Reads existing chapters for context continuity
   */
  async appendChapters(
    projectId: string,
    volumeId: string,
    additionalCount: number,
    instruction?: string
  ): Promise<{
    chapters: ChapterOutline[];
    executionLogs: PromptExecutionLog[];
  }> {
    const executionLogs: PromptExecutionLog[] = [];

    try {
      // Validate input
      if (additionalCount < 1 || additionalCount > 30) {
        throw new Error("追加数量必须在1-30之间");
      }

      // Get existing chapters
      const existingChapters = await storage.getChaptersByProject(projectId);
      const volumeChapters = existingChapters
        .filter((c) => c.volumeId === volumeId)
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (volumeChapters.length === 0) {
        // No existing chapters, use regular generation
        return this.generateChapters(projectId, volumeId, additionalCount);
      }

      // Check total chapter count for this volume
      if (volumeChapters.length + additionalCount > 100) {
        throw new Error(`单卷章节数不能超过100个（当前${volumeChapters.length}个，追加${additionalCount}个）`);
      }

      // Get volume info
      const volumes = await storage.getVolumesByProject(projectId);
      const targetVolume = volumes.find((v) => v.id === volumeId);
      if (!targetVolume) {
        throw new Error("卷不存在");
      }

      // Get volume outline
      const outlines = await storage.getOutlinesByProject(projectId);
      const volumeOutline = outlines.find(
        (o) => o.type === "volume" && (o.linkedVolumeId === volumeId || o.title === targetVolume.title)
      );

      if (!volumeOutline) {
        throw new Error("未找到卷纲，请先生成卷纲");
      }

      const volumeBeats = (volumeOutline.plotNodes as any)?.beats || [];
      if (volumeBeats.length === 0) {
        throw new Error("卷纲缺少节拍信息，无法生成章节");
      }

      // Get characters
      const characters = await storage.getCharactersByProject(projectId);

      // Build rich context using intelligent selection
      const chapterOutlines = outlines.filter((o) => o.type === "chapter");

      // Use embedding-based intelligent context selection
      const contextSelection = await contextSelectionService.selectRecentChaptersForAppend(
        volumeChapters,
        chapterOutlines,
        `继续${targetVolume.title}的故事，保持叙事连贯性`,
        {
          maxCount: 5,
          tokenBudget: 1200,
          prioritizeRecent: true,
          includeKeyBeats: false,
          useEmbedding: true, // Enable embedding-based selection
        }
      );

      const existingContext = contextSelection.contextText;

      console.log(
        `[Chapter Append] Selected ${contextSelection.selectedChapters.length} chapters ` +
        `using ${contextSelection.selectionMethod} (${contextSelection.totalTokens} tokens)`
      );

      const startIndex = volumeChapters.length;

      // Generate semantic summary using embedding (if available)
      let semanticSummary = "";
      try {
        // Build semantic representation of selected chapters
        const selectedChapters = contextSelection.selectedChapters;
        const recentSummary = selectedChapters
          .map((contextChapter) => {
            const plotNodes = contextChapter.outline?.plotNodes as any;
            const oneLiner = plotNodes?.oneLiner || contextChapter.chapter.title;
            const exitState = plotNodes?.exitState || "";
            return `${oneLiner}${exitState ? `（${exitState}）` : ""}`;
          })
          .join("；");

        if (recentSummary.length > 0) {
          // Use embedding to capture narrative flow
          const embedding = await aiService.getEmbedding(recentSummary, targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
          if (embedding) {
            const lastSelected = selectedChapters[selectedChapters.length - 1];
            const lastExitState = (lastSelected.outline?.plotNodes as any)?.exitState || "章节结束";

            semanticSummary = `\n\n# 叙事连贯性\n已有${volumeChapters.length}章，当前状态：${lastExitState}`;
            console.log("[Chapter Append] Generated semantic summary with embedding");
          }
        }
      } catch (embeddingError) {
        console.log("[Chapter Append] Embedding not available, using text-only context");
      }

      // Step 1: Check semantic cache with content hash
      const contextHash = this.hashContent(existingContext);
      const cacheKey = {
        projectId,
        volumeId,
        additionalCount,
        startIndex,
        contextHash, // Use hash instead of truncated content
      };
      let semanticSig: { signature: number[]; hash: string } | null = null;

      try {
        semanticSig = await semanticCacheService.calculateSignature(cacheKey, targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
        const cached = await semanticCacheService.findSimilar(
          semanticSig.signature,
          "chapter-append-v2"
        );

        if (cached) {
          const isValid = await semanticCacheService.quickVerify(cached.cached, cacheKey, targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
          if (isValid) {
            console.log(`[Cache HIT] Using cached appended chapters`);
            await semanticCacheService.recordHit(cached.cached.executionId);
            return {
              chapters: cached.cached.result.chapters,
              executionLogs: [],
            };
          }
        }
      } catch (cacheError) {
        console.log("[Cache] Skipping cache check:", cacheError instanceof Error ? cacheError.message : cacheError);
      }

      // Step 2: Calculate routing signals
      const hasRichContext = volumeBeats.length >= 3 && characters.length >= 3;
      const signals = modelRoutingService.calculateProjectCreationSignals(
        hasRichContext,
        true,
        0.65
      );

      // Step 3: Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Chapter Append] ${routing.reasoning}`);

      // Calculate narrative progress
      const estimatedTotalChapters = 50; // Default assumption for a volume
      const progressRatio = Math.min((startIndex + 1) / estimatedTotalChapters, 1.0);
      let narrativeStage = "铺垫阶段 (Setup)";
      if (progressRatio > 0.25) narrativeStage = "发展阶段 (Development)";
      if (progressRatio > 0.75) narrativeStage = "高潮阶段 (Climax)";
      if (progressRatio > 0.90) narrativeStage = "收尾阶段 (Resolution)";

      // Step 4: Build prompt with existing context (enhanced with semantic summary)
      const promptModules = await this.buildAppendChapterPromptModules(
        projectId,
        targetVolume,
        volumeOutline.content || "",
        volumeBeats,
        characters,
        existingContext + semanticSummary,
        startIndex,
        additionalCount,
        instruction,
        progressRatio,
        narrativeStage
      );

      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(`[Prompt Packing] Chapter append using ${packedPrompt.metadata.totalTokens} tokens`);

      // Step 5: Generate chapters
      // Ensure we have full model objects with API keys
      const models = await storage.getAIModels(targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
      const primaryModelObj = models.find(m => m.id === routing.primaryModel);
      const fallbackModelObj = routing.fallbackModel ? models.find(m => m.id === routing.fallbackModel) : undefined;

      if (!primaryModelObj) {
        throw new Error(`Primary model not found: ${routing.primaryModel}`);
      }

      const chapters = await this.generateChapterOutlinesWithFallback(
        packedPrompt.promptText,
        primaryModelObj,
        fallbackModelObj,
        targetVolume.orderIndex,
        additionalCount,
        executionLogs,
        projectId
      );

      // Step 6: Post-process and adjust orderIndex
      let processedChapters = this.postProcessChapters(chapters, characters);
      processedChapters = processedChapters.map((c, i) => ({
        ...c,
        orderIndex: startIndex + i,
      }));

      // Step 7: Validate quality
      const validation = await ruleCheckerService.validate(JSON.stringify(processedChapters), {
        checkSemantics: false,
        checkWritability: false,
      });

      const qualityEvaluation = await qualityEvaluatorService.evaluateQuality(
        JSON.stringify(processedChapters),
        {
          passed: validation.passed,
          score: validation.score,
          violations: validation.violations || [],
          executionTime: 0,
        },
        { targetWords: 500 }
      );

      console.log(`[Quality] Overall: ${qualityEvaluation.overall}`);

      // Step 8: Auto-repair if needed
      let finalChapters = processedChapters;
      if (validation.violations && validation.violations.length > 0) {
        const autoFixableViolations = validation.violations.filter((v: any) => v.autoFixable);
        if (autoFixableViolations.length > 0) {
          console.log(`[Auto-Repair] Attempting to fix ${autoFixableViolations.length} violations`);
          try {
            const repairResult = await autoRepairEngine.repair(
              JSON.stringify(processedChapters),
              autoFixableViolations as any
            );
            if (repairResult.success) {
              finalChapters = JSON.parse(repairResult.actions[0]?.replacement || JSON.stringify(processedChapters));
              console.log(`[Auto-Repair] Successfully repaired content`);
            }
          } catch (repairError) {
            console.log("[Auto-Repair] Failed:", repairError instanceof Error ? repairError.message : repairError);
          }
        }
      }

      // Step 9: Save logs
      const totalTokens = executionLogs.reduce((sum, log) => sum + log.tokensUsed, 0);
      for (const log of executionLogs) {
        const logCost = this.calculateCost(log.tokensUsed, log.modelId);

        await generationLogService.createLog({
          executionId: log.executionId,
          projectId,
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
          qualityScore: qualityEvaluation as any,
          ruleViolations: validation.violations || [],
          repairActions: undefined,
        });

        await costMonitorService.recordUsage(log.executionId, log.tokensUsed, log.modelId);
      }

      console.log(`[Cost] Total tokens: ${totalTokens}`);

      // Step 10: Cache result
      if (semanticSig && qualityEvaluation.overall >= this.QUALITY_THRESHOLD) {
        try {
          await semanticCacheService.cacheResult(
            this.generateExecutionId(),
            "chapter-append-v2",
            semanticSig.signature,
            semanticSig.hash,
            this.hashContent(JSON.stringify(cacheKey)),
            { chapters: finalChapters, executionLogs },
            cacheKey,
            qualityEvaluation.overall
          );
        } catch (cacheError) {
          console.log("[Cache] Failed to cache result:", cacheError instanceof Error ? cacheError.message : cacheError);
        }
      }

      return {
        chapters: finalChapters,
        executionLogs,
      };
    } catch (error: any) {
      throw new Error(`追加章纲失败: ${error.message}`);
    }
  }

  /**
   * Generate chapter outlines for a volume
   * Implements beat-based breakdown with entity tracking
   */
  async generateChapters(
    projectId: string,
    volumeId: string,
    targetChapterCount: number = 10
  ): Promise<{
    chapters: ChapterOutline[];
    executionLogs: PromptExecutionLog[];
  }> {
    const executionLogs: PromptExecutionLog[] = [];

    try {
      // Get volume info
      const volumes = await storage.getVolumesByProject(projectId);
      const targetVolume = volumes.find((v) => v.id === volumeId);
      if (!targetVolume) {
        throw new Error("卷不存在");
      }

      // Get volume outline with beats
      const outlines = await storage.getOutlinesByProject(projectId);
      const volumeOutline = outlines.find(
        (o) => o.type === "volume" && (o.linkedVolumeId === volumeId || o.title === targetVolume.title)
      );

      if (!volumeOutline) {
        throw new Error("未找到卷纲，请先生成卷纲");
      }

      // Get main outline for tone profile
      const mainOutline = outlines.find(o => o.type === "main");

      // Extract volume beats from plotNodes
      const volumeBeats = (volumeOutline.plotNodes as any)?.beats || [];
      if (volumeBeats.length === 0) {
        throw new Error("卷纲缺少节拍信息，无法生成章节");
      }

      // Get characters with role information
      const characters = await storage.getCharactersByProject(projectId);

      // Get previous volume for context (if exists)
      const prevVolume = volumes.find((v) => v.orderIndex === targetVolume.orderIndex - 1);
      let prevVolumeContext = "";
      if (prevVolume) {
        const prevOutline = outlines.find(
          (o) => o.type === "volume" && (o.linkedVolumeId === prevVolume.id || o.title === prevVolume.title)
        );
        if (prevOutline) {
          prevVolumeContext = `上一卷《${prevVolume.title}》概要：${prevOutline.content?.substring(0, 200) || ""}`;
        }
      }

      // Step 1: Check semantic cache first
      const cacheKey = { projectId, volumeId, targetChapterCount, volumeBeats };
      let semanticSig: { signature: number[]; hash: string } | null = null;

      try {
        semanticSig = await semanticCacheService.calculateSignature(cacheKey, targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
        const cached = await semanticCacheService.findSimilar(
          semanticSig.signature,
          "chapter-generation-v2"
        );

        if (cached) {
          const isValid = await semanticCacheService.quickVerify(cached.cached, cacheKey, targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
          if (isValid) {
            console.log(`[Cache HIT] Using cached chapters (similarity: ${cached.similarity.toFixed(3)})`);
            await semanticCacheService.recordHit(cached.cached.executionId);
            return {
              chapters: cached.cached.result.chapters,
              executionLogs: [],
            };
          }
        }
      } catch (cacheError) {
        console.log("[Cache] Skipping cache check:", cacheError instanceof Error ? cacheError.message : cacheError);
      }

      // Step 2: Calculate routing signals
      const hasRichContext = volumeBeats.length >= 3 && characters.length >= 3;
      const signals = modelRoutingService.calculateProjectCreationSignals(
        hasRichContext,
        true,
        0.65 // Higher complexity for chapter generation
      );

      // Step 3: Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Chapter Generation] ${routing.reasoning}`);

      // Step 4: Build prompt with enhanced context
      const promptModules = await this.buildChapterPromptModules(
        projectId,
        targetVolume,
        volumeOutline.content || "",
        volumeBeats,
        characters,
        prevVolumeContext,
        targetChapterCount,
        mainOutline?.content || ""
      );

      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(
        `[Prompt Packing] Chapter generation using ${packedPrompt.metadata.totalTokens} tokens`
      );

      // Step 5: Generate chapters with fallback
      // Ensure we have full model objects with API keys
      const models = await storage.getAIModels(targetVolume.projectId ? (await storage.getProject(targetVolume.projectId))?.userId || "" : "");
      const primaryModelObj = models.find(m => m.id === routing.primaryModel);
      const fallbackModelObj = routing.fallbackModel ? models.find(m => m.id === routing.fallbackModel) : undefined;

      if (!primaryModelObj) {
        throw new Error(`Primary model not found: ${routing.primaryModel}`);
      }

      const chapters = await this.generateChapterOutlinesWithFallback(
        packedPrompt.promptText,
        primaryModelObj,
        fallbackModelObj,
        targetVolume.orderIndex,
        targetChapterCount,
        executionLogs,
        projectId
      );

      // Step 6: Post-process: ensure entity tracking data
      const processedChapters = this.postProcessChapters(chapters, characters);

      // Step 7: Validate quality
      const validation = await ruleCheckerService.validate(
        JSON.stringify(processedChapters),
        { checkSemantics: false, checkWritability: false }
      );

      const qualityEvaluation = await qualityEvaluatorService.evaluateQuality(
        JSON.stringify(processedChapters),
        {
          passed: validation.passed,
          score: validation.score,
          violations: validation.violations || [],
          executionTime: 0,
        },
        { targetWords: 500 }
      );

      console.log(`[Quality] Overall: ${qualityEvaluation.overall}, Dimensions:`, qualityEvaluation.dimensions);

      // Step 8: Auto-repair if needed
      let finalChapters = processedChapters;
      if (validation.violations && validation.violations.length > 0) {
        const autoFixableViolations = validation.violations.filter((v: any) => v.autoFixable);
        if (autoFixableViolations.length > 0) {
          console.log(`[Auto-Repair] Attempting to fix ${autoFixableViolations.length} violations`);
          try {
            const repairResult = await autoRepairEngine.repair(
              JSON.stringify(processedChapters),
              autoFixableViolations as any
            );
            if (repairResult.success) {
              finalChapters = JSON.parse(repairResult.actions[0]?.replacement || JSON.stringify(processedChapters));
              console.log(`[Auto-Repair] Successfully repaired content`);
            }
          } catch (repairError) {
            console.log("[Auto-Repair] Failed:", repairError instanceof Error ? repairError.message : repairError);
          }
        }
      }

      // Step 9: Save generation logs
      const totalTokens = executionLogs.reduce((sum, log) => sum + log.tokensUsed, 0);
      for (const log of executionLogs) {
        const logCost = this.calculateCost(log.tokensUsed, log.modelId);

        await generationLogService.createLog({
          executionId: log.executionId,
          projectId,
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
          qualityScore: qualityEvaluation as any,
          ruleViolations: validation.violations || [],
          repairActions: undefined,
        });

        await costMonitorService.recordUsage(log.executionId, log.tokensUsed, log.modelId);
      }

      console.log(`[Cost] Total tokens: ${totalTokens}`);

      // Step 10: Cache result if quality is good
      if (semanticSig && qualityEvaluation.overall >= this.QUALITY_THRESHOLD) {
        try {
          await semanticCacheService.cacheResult(
            this.generateExecutionId(),
            "chapter-generation-v2",
            semanticSig.signature,
            semanticSig.hash,
            this.hashContent(JSON.stringify(cacheKey)),
            { chapters: finalChapters, executionLogs },
            cacheKey,
            qualityEvaluation.overall
          );
        } catch (cacheError) {
          console.log("[Cache] Failed to cache result:", cacheError instanceof Error ? cacheError.message : cacheError);
        }
      }

      return {
        chapters: finalChapters,
        executionLogs,
      };
    } catch (error: any) {
      throw new Error(`章纲生成失败: ${error.message}`);
    }
  }

  /**
   * Build prompt modules for appending volumes with existing context
   */
  private async buildAppendVolumePromptModules(
    project: any,
    mainOutlineContent: string,
    characters: any[],
    themeTags: string[],
    coreConflicts: string[],
    existingContext: string,
    startIndex: number,
    targetCount: number
  ): Promise<PromptModule[]> {
    const modules: PromptModule[] = [];

    const genreInstructions = project.genre ? genreConfigService.getGenreSpecificInstructions(project.genre) : "";
    const genreDescription = project.genre ? genreConfigService.getGenreDescription(project.genre) : "";

    modules.push({
      id: "system-role",
      priority: "must-have",
      content: `你是一位资深的网络小说大纲策划专家，擅长设计引人入胜的卷纲结构，精通情节递进和冲突设计。
${genreDescription ? `你精通${genreDescription}的创作规律。` : ""}`,
      estimatedTokens: 60,
      compressible: false,
    });

    // Get world settings for volume context
    const worldContext = await getRelevantWorldSettings(project.id, "volume");

    modules.push({
      id: "project-context",
      priority: "must-have",
      content: `# 项目信息
标题: ${project.title}
类型: ${project.genre}
风格: ${project.style || "未指定"}

# 总纲
${mainOutlineContent}

# 核心主题
${themeTags.length > 0 ? themeTags.join("、") : "未指定"}

# 核心冲突
${coreConflicts.length > 0 ? coreConflicts.map((c, i) => `${i + 1}. ${c}`).join("\n") : "未指定"}

# 主要角色
${characters.map(c => formatCharacterForOutline(c)).join("\n\n")}

# 已有卷纲（用于保持连贯性）
${existingContext}`,
      estimatedTokens: 400,
      compressible: true,
    });

    // Add character relationships module
    modules.push({
      id: "character-relationships",
      priority: "important",
      content: `# 角色关系网络
${buildRelationshipNetwork(characters)}`,
      estimatedTokens: 100,
      compressible: true,
    });

    // Add character growth path module
    modules.push({
      id: "character-growth",
      priority: "optional",
      content: `# 角色成长规划
${formatCharacterGrowthContext(characters)}`,
      estimatedTokens: 150,
      compressible: true,
    });

    // Add world settings module
    modules.push({
      id: "world-context",
      priority: "important",
      content: `# 世界观设定
${worldContext}`,
      estimatedTokens: 200,
      compressible: true,
    });

    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请在已有 ${startIndex} 个卷的基础上，继续设计 ${targetCount} 个新卷的大纲。

**重要**：新卷要与已有卷保持连贯性，情节递进自然，冲突逐步升级。

每个卷需要包含：
1. **title**: 卷标题（吸引人且符合内容，建议8-12字）
2. **oneLiner**: 一句话定位（20-30字概括本卷核心内容和主要冲突）
3. **beats**: 核心节拍（3-5个关键情节点，每个节拍要有明确的冲突或转折）
4. **themeTags**: 本卷主题标签（1-3个，从核心主题中选择或扩展）
5. **conflictFocus**: 冲突焦点（本卷的主要冲突类型）
6. **orderIndex**: 卷序号（从${startIndex}开始）

${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}

设计原则：
- **连贯性**: 与前面的卷保持情节连贯，避免突兀
- **递进性**: 冲突和张力要比前面的卷更强
- **差异化**: 避免与已有卷重复，要有新的冲突和转折
- **角色成长**: 考虑角色在前面卷中的经历和成长`,
      estimatedTokens: 350,
      compressible: true,
    });

    // Thinking Process (Deep CoT)
    modules.push({
      id: "thinking-process",
      priority: "important",
      content: `# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤进行规划：
1. **回顾前文**: 分析已有卷的走向和未解决的伏笔。
2. **后续规划**: 规划接下来的 ${targetCount} 卷如何承接前文并推向高潮。
3. **类型适配**: 确保后续发展符合${project.genre || "该类型"}的读者期待。

请先输出 <thinking>...</thinking>，然后输出 JSON。`,
      estimatedTokens: 300,
      compressible: false,
    });

    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON数组。**

[
  {
    "title": "第${startIndex + 1}卷标题",
    "oneLiner": "一句话定位（20-30字）",
    "beats": ["节拍1：具体情节描述", "节拍2：具体情节描述", "节拍3：具体情节描述"],
    "themeTags": ["主题1", "主题2"],
    "conflictFocus": "本卷主要冲突类型",
    "orderIndex": ${startIndex}
  }
]

注意：orderIndex 从 ${startIndex} 开始递增`,
      estimatedTokens: 150,
      compressible: true,
    });

    modules.push({
      id: "quality-guidelines",
      priority: "optional",
      content: `# 质量要求
- 确保输出是有效的JSON格式
- 新卷要与已有卷保持风格一致
- 节拍描述要具体，避免抽象概括
- 冲突设计要有张力和可持续性`,
      estimatedTokens: 80,
      compressible: true,
    });

    return modules;
  }

  /**
   * Build prompt modules for volume generation with enhanced context
   */
  private async buildVolumePromptModules(
    project: any,
    mainOutlineContent: string,
    characters: any[],
    themeTags: string[],
    coreConflicts: string[],
    targetCount: number
  ): Promise<PromptModule[]> {
    const modules: PromptModule[] = [];

    // Extract tone profile and world directive from main outline content if possible
    // This is a simple heuristic extraction
    let toneProfile = project.style || "未指定";
    const toneMatch = mainOutlineContent.match(/## 基调风格\n([\s\S]*?)(?=\n##|$)/);
    if (toneMatch) {
      toneProfile = toneMatch[1].trim();
    }

    // System role
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: `你是一位资深的网络小说大纲策划专家，擅长设计引人入胜的卷纲结构，精通情节递进和冲突设计。
请确保设计符合项目的基调风格：${toneProfile}。
${project.genre ? `你精通${genreConfigService.getGenreDescription(project.genre)}的创作规律。` : ""}`,
      estimatedTokens: 60,
      compressible: false,
    });

    // Get world settings for volume context
    const worldContext = await getRelevantWorldSettings(project.id, "volume");

    // Project context with structured information
    modules.push({
      id: "project-context",
      priority: "must-have",
      content: `# 项目信息
标题: ${project.title}
类型: ${project.genre}
风格: ${project.style || "未指定"}
简介: ${project.description || ""}

# 总纲
${mainOutlineContent}

# 核心主题
${themeTags.length > 0 ? themeTags.join("、") : "未指定"}

# 核心冲突
${coreConflicts.length > 0 ? coreConflicts.map((c, i) => `${i + 1}. ${c}`).join("\n") : "未指定"}

# 主要角色
${characters.map(c => formatCharacterForOutline(c)).join("\n\n")}`,
      estimatedTokens: 400,
      compressible: true,
    });

    // Add character relationships module
    modules.push({
      id: "character-relationships",
      priority: "important",
      content: `# 角色关系网络
${buildRelationshipNetwork(characters)}`,
      estimatedTokens: 100,
      compressible: true,
    });

    // Add character growth path module
    modules.push({
      id: "character-growth",
      priority: "optional",
      content: `# 角色成长规划
${formatCharacterGrowthContext(characters, 'early')}`, // Volume generation focuses on macro structure, but early growth is relevant for initial volumes
      estimatedTokens: 150,
      compressible: true,
    });

    // Add world settings module
    modules.push({
      id: "world-context",
      priority: "important",
      content: `# 世界观设定
${worldContext}`,
      estimatedTokens: 200,
      compressible: true,
    });

    // Task requirements with detailed specifications
    const genreInstructions = project.genre ? genreConfigService.getGenreSpecificInstructions(project.genre) : "";

    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请为这部小说设计 ${targetCount} 个卷的大纲。每个卷需要包含：

1. **title**: 卷标题（吸引人且符合内容，建议8-12字）
2. **oneLiner**: 一句话定位（20-30字概括本卷核心内容和主要冲突）
3. **beats**: 核心节拍（3-5个关键情节点，每个节拍要有明确的冲突或转折）
4. **themeTags**: 本卷主题标签（1-3个，从核心主题中选择或扩展）
5. **conflictFocus**: 冲突焦点（本卷的主要冲突类型，请参考核心冲突列表）
6. **orderIndex**: 卷序号（从0开始）

${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}

设计原则：
- **基调一致**: 严格遵循"${toneProfile}"的基调风格
- **递进性**: 卷与卷之间要有明确的递进关系，冲突逐步升级
- **主题覆盖**: 每卷要覆盖至少一个核心主题
- **节拍张力**: 每个节拍要有明确的目标、冲突和结果
- **角色成长**: 结合角色成长规划，体现主角在各卷中的转变
- **节奏控制**: 符合网络小说的节奏感，避免拖沓或过于仓促`,
      estimatedTokens: 350,
      compressible: true,
    });

    // Thinking Process (Deep CoT)
    modules.push({
      id: "thinking-process",
      priority: "important",
      content: `# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤进行规划：
1. **宏观架构**: 规划整本书的起承转合，确定这 ${targetCount} 个卷在整体故事中的位置。
2. **冲突升级**: 设计每一卷的核心冲突，确保一卷比一卷更激烈。
3. **类型爽点**: 思考如何在每一卷中埋下符合${project.genre || "该类型"}的爽点和期待感。
4. **伏笔回收**: 规划伏笔的埋设和回收节奏。

请先输出 <thinking>...</thinking>，然后输出 JSON。`,
      estimatedTokens: 300,
      compressible: false,
    });

    // Output format with enhanced fields
    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON数组。**

[
  {
    "title": "第一卷标题",
    "oneLiner": "一句话定位（20-30字）",
    "beats": ["节拍1：具体情节描述", "节拍2：具体情节描述", "节拍3：具体情节描述"],
    "themeTags": ["主题1", "主题2"],
    "conflictFocus": "本卷主要冲突类型",
    "orderIndex": 0
  }
]

注意：
- beats 中每个节拍要具体描述情节，不要只写"开端"、"发展"等抽象词
- themeTags 要从核心主题中选择或合理扩展
- conflictFocus 要明确指出本卷的主要冲突（如：内心冲突、外部对抗、身份危机等）`,
      estimatedTokens: 150,
      compressible: true,
    });

    // Quality guidelines
    modules.push({
      id: "quality-guidelines",
      priority: "optional",
      content: `# 质量要求
- 确保输出是有效的JSON格式
- 卷标题要有吸引力，避免平淡无奇
- 节拍描述要具体，避免抽象概括
- 冲突设计要有张力和可持续性
- 考虑读者的阅读体验和期待`,
      estimatedTokens: 80,
      compressible: true,
    });

    return modules;
  }
  /**
   * Build prompt modules for appending chapters with existing context
   */
  private async buildAppendChapterPromptModules(
    projectId: string,
    volume: any,
    volumeOutlineContent: string,
    volumeBeats: string[],
    characters: any[],
    existingContext: string,
    startIndex: number,
    targetCount: number,
    instruction?: string,
    progressRatio: number = 0,
    narrativeStage: string = "发展阶段"
  ): Promise<PromptModule[]> {
    const modules: PromptModule[] = [];

    const project = await storage.getProject(projectId);
    const genre = project?.genre || "通用";
    const genreInstructions = genreConfigService.getGenreSpecificInstructions(genre);
    const genreDescription = genreConfigService.getGenreDescription(genre);

    modules.push({
      id: "system-role",
      priority: "must-have",
      content: `你是一位资深的网络小说章节策划专家，擅长设计紧凑有力的章节结构，精通节奏控制和钩子设计。
${genreDescription ? `你精通${genreDescription}的创作规律。` : ""}`,
      estimatedTokens: 60,
      compressible: false,
    });

    // Get world settings for chapter context
    const worldContext = await getRelevantWorldSettings(projectId, "chapter");

    modules.push({
      id: "volume-context",
      priority: "must-have",
      content: `# 卷信息
标题: ${volume.title}
简介: ${volume.description || ""}
序号: 第${volume.orderIndex + 1}卷

# 卷纲
${volumeOutlineContent}

# 卷核心节拍
${volumeBeats.map((b, i) => `${i + 1}. ${b}`).join("\n")}

# 已有章节（用于保持连贯性）
${existingContext}

# 可用角色（包含当前状态）
${characters.map(c => formatCharacterForScene(c)).join("\n\n")}`,
      estimatedTokens: 450,
      compressible: true,
    });

    // Add narrative progress module
    modules.push({
      id: "narrative-progress",
      priority: "must-have",
      content: `# 叙事进度指示
当前进度: 第 ${startIndex + 1} 章 / 预计 50 章 (${(progressRatio * 100).toFixed(1)}%)
当前阶段: ${narrativeStage}

**重要指令**：
请根据上述进度和阶段，判断当前应该推进到卷纲中的哪个节拍。
- 如果是铺垫阶段，重点在于展开世界观和引入冲突。
- 如果是发展阶段，重点在于冲突升级和人物关系深化。
- 如果是高潮阶段，重点在于核心冲突的爆发和解决。
- 如果是收尾阶段，重点在于余波处理和下一卷的伏笔。

请明确指出你当前正在处理卷纲中的哪一个或哪几个节拍。

${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}`,
      estimatedTokens: 200,
      compressible: false,
    });

    // Thinking Process (Deep CoT)
    modules.push({
      id: "thinking-process",
      priority: "important",
      content: `# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤进行规划：
1. **进度分析**: 确认当前章节在整卷中的位置，决定是该铺垫、发展还是高潮。
2. **承上启下**: 确保与上一章（${startIndex}章）的衔接自然。
3. **钩子设计**: 为新章节设计吸引人的钩子。

请先输出 <thinking>...</thinking>，然后输出 JSON。`,
      estimatedTokens: 300,
      compressible: false,
    });

    // Add user instruction if provided
    if (instruction && instruction.trim().length > 0) {
      modules.push({
        id: "user-instruction",
        priority: "must-have",
        content: `# 用户指导
请严格遵循以下指导意见进行创作：
${instruction}`,
        estimatedTokens: 100,
        compressible: false,
      });
    }

    // Add world settings module
    modules.push({
      id: "world-context",
      priority: "important",
      content: `# 世界观设定
${worldContext}`,
      estimatedTokens: 150,
      compressible: true,
    });

    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请在已有 ${startIndex} 个章节的基础上，继续设计 ${targetCount} 个新章节的大纲。

**重要**：
1. 新章节要与已有章节保持连贯性，情节自然衔接。
2. **严禁重复**：新生成的章节之间必须有明确的情节推进，不得重复使用相同的情节、冲突或标题。
3. **递进关系**：这 ${targetCount} 个章节应当构成一个连续的故事序列，每一章都要推动剧情向前发展。

每个章节需要包含：
1. **title**: 章节标题（吸引人，可以是悬念式或冲突式，建议6-12字，**不得与前文或同批次其他章节重复**）
2. **oneLiner**: 一句话概括（15-25字说明本章核心内容和主要冲突）
3. **beats**: 章节节拍（2-4个关键场景或情节点，每个要具体描述）
4. **requiredEntities**: 必需角色（本章必须出现的角色名字列表，1-3个）
5. **focalEntities**: 焦点角色（本章的主要视角角色，1-2个）
6. **stakesDelta**: 风险变化（本章对主线冲突的影响）
7. **entryState**: 入场状态（章节开始时的情境）
8. **exitState**: 出场状态（章节结束时的情境）
9. **orderIndex**: 章节序号（从${startIndex}开始）

设计原则：
- **连贯性**: 与前面的章节保持情节连贯
- **差异性**: 确保每章都有独特的核心事件，避免剧情原地踏步
- **节拍分解**: 合理分解卷的核心节拍
- **钩子设计**: 每章结尾要留悬念或冲突
- **状态追踪**: 明确每章的入场和出场状态`,
      estimatedTokens: 300,
      compressible: true,
    });


    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
请严格按照JSON数组格式输出（不要包含markdown代码块标记）：

[
  {
    "title": "第${startIndex + 1}章标题",
    "oneLiner": "一句话概括（15-25字）",
    "beats": ["场景1：具体描述", "场景2：具体描述"],
    "requiredEntities": ["角色A", "角色B"],
    "focalEntities": ["角色A"],
    "stakesDelta": "风险变化描述",
    "entryState": "入场状态简述",
    "exitState": "出场状态简述",
    "orderIndex": ${startIndex}
  }
]

注意：orderIndex 从 ${startIndex} 开始递增`,
      estimatedTokens: 180,
      compressible: true,
    });

    modules.push({
      id: "quality-guidelines",
      priority: "optional",
      content: `# 质量要求
  - 确保输出是有效的JSON格式
  - 新章节要与已有章节保持风格一致
  - 节拍描述要具体，避免抽象
    - 状态转换要自然，避免突兀`,
      estimatedTokens: 80,
      compressible: true,
    });

    return modules;
  }

  /**
   * Build prompt modules for chapter generation with enhanced context
   */
  /**
   * Build prompt modules for chapter generation with enhanced context
   */
  private async buildChapterPromptModules(
    projectId: string,
    volume: any,
    volumeOutlineContent: string,
    volumeBeats: string[],
    characters: any[],
    prevVolumeContext: string,
    targetCount: number,
    mainOutlineContent: string
  ): Promise<PromptModule[]> {
    const modules: PromptModule[] = [];

    // Extract tone profile from main outline content
    let toneProfile = "未指定";
    if (mainOutlineContent) {
      const toneMatch = mainOutlineContent.match(/## 基调风格\n([\s\S]*?)(?=\n##|$)/);
      if (toneMatch) {
        toneProfile = toneMatch[1].trim();
      }
    }

    // System role
    const project = await storage.getProject(projectId);
    const genre = project?.genre || "通用";
    const genreInstructions = genreConfigService.getGenreSpecificInstructions(genre);
    const genreDescription = genreConfigService.getGenreDescription(genre);

    modules.push({
      id: "system-role",
      priority: "must-have",
      content: `你是一位资深的网络小说章节策划专家，擅长设计紧凑有力的章节结构，精通节奏控制和钩子设计。
请确保设计符合项目的基调风格：${toneProfile}。
${genreDescription ? `你精通${genreDescription}的创作规律。` : ""}`,
      estimatedTokens: 60,
      compressible: false,
    });

    // Get world settings for chapter context
    const worldContext = await getRelevantWorldSettings(projectId, "chapter");

    // Volume context with beats
    modules.push({
      id: "volume-context",
      priority: "must-have",
      content: `# 卷信息
标题: ${volume.title}
简介: ${volume.description || ""}
序号: 第${volume.orderIndex + 1} 卷

# 卷纲
${volumeOutlineContent}

# 卷核心节拍
${volumeBeats.map((b, i) => `${i + 1}. ${b}`).join("\n")}

${prevVolumeContext ? `\n# 上卷衔接\n${prevVolumeContext}\n` : ""}

# 可用角色
${characters.map(c => formatCharacterForOutline(c)).join("\n\n")} `,
      estimatedTokens: 350,
      compressible: true,
    });

    // Add world settings module
    modules.push({
      id: "world-context",
      priority: "important",
      content: `# 世界观设定
${worldContext} `,
      estimatedTokens: 150,
      compressible: true,
    });

    // Task requirements with detailed specifications
    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请基于卷的核心节拍，为本卷设计 ${targetCount} 个章节的大纲。每个章节需要包含：

1. ** title **: 章节标题（吸引人，可以是悬念式或冲突式，建议6 - 12字）
2. ** oneLiner **: 一句话概括（15 - 25字说明本章核心内容和主要冲突）
3. ** beats **: 章节节拍（2 - 4个关键场景或情节点，每个要具体描述）
4. ** requiredEntities **: 必需角色（本章必须出现的角色名字列表，1 - 3个）
5. ** focalEntities **: 焦点角色（本章的主要视角角色，1 - 2个）
6. ** stakesDelta **: 风险变化（本章对主线冲突的影响，如"冲突升级"、"关系破裂"等）
7. ** entryState **: 入场状态（章节开始时的情境，简短描述）
8. ** exitState **: 出场状态（章节结束时的情境，简短描述）
9. ** orderIndex **: 章节序号（从0开始）

${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}

设计原则：
- ** 基调一致 **: 严格遵循"${toneProfile}"的基调风格
- ** 节拍分解 **: 将卷的核心节拍合理分解到各章节中
- ** 钩子设计 **: 每章开头要有吸引力，结尾要留悬念或冲突
- ** 节奏控制 **: 紧凑有力，避免拖沓，每章推进主线
- ** 角色分配 **: 合理安排角色出场，避免角色过多或过少
- ** 状态追踪 **: 明确每章的入场和出场状态，确保连贯性
- ** 风险递进 **: 章与章之间要有风险递进或情感深化`,
      estimatedTokens: 250,
      compressible: true,
    });

    // Thinking Process (Deep CoT)
    modules.push({
      id: "thinking-process",
      priority: "important",
      content: `# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤进行规划：
1. **节奏切分**: 分析卷核心节拍，将其合理切分到 ${targetCount} 个章节中。
2. **钩子设计**: 为每一章设计一个强有力的钩子（Hook）和悬念（Cliffhanger）。
3. **视角选择**: 确定每一章的最佳叙事视角（Focal Entity）。
4. **连贯性检查**: 确保上一章的出口状态（Exit State）与下一章的入口状态（Entry State）自然衔接。

请先输出 <thinking>...</thinking>，然后输出 JSON。`,
      estimatedTokens: 300,
      compressible: false,
    });

    // Output format with enhanced fields
    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON数组。**

[
  {
    "title": "第一章标题",
    "oneLiner": "一句话概括（15-25字）",
    "beats": ["场景1：具体描述", "场景2：具体描述"],
    "requiredEntities": ["角色A", "角色B"],
    "focalEntities": ["角色A"],
    "stakesDelta": "风险变化描述",
    "entryState": "入场状态简述",
    "exitState": "出场状态简述",
    "orderIndex": 0
  }
]

注意：
- beats 中每个场景要具体描述，不要只写"开端"、"发展"等抽象词
- requiredEntities 必须从可用角色列表中选择
- focalEntities 是 requiredEntities 的子集，表示主要视角
- stakesDelta 要明确说明本章对主线的影响
- entryState 和 exitState 要简洁明确，便于后续场景生成时使用`,
      estimatedTokens: 180,
      compressible: true,
    });

    // Quality guidelines
    modules.push({
      id: "quality-guidelines",
      priority: "optional",
      content: `# 质量要求
  - 确保输出是有效的JSON格式
  - 章节标题要有吸引力，避免平淡
    - 节拍描述要具体，避免抽象
      - 角色分配要合理，避免某些角色长期不出场
        - 状态转换要自然，避免突兀
          - 考虑读者的阅读节奏和期待`,
      estimatedTokens: 80,
      compressible: true,
    });

    return modules;
  }

  /**
   * Generate volume candidates with fallback support
   */
  private async generateVolumeCandidatesWithFallback(
    prompt: string,
    primaryModel: any,
    fallbackModel: any | undefined,
    targetCount: number,
    executionLogs: PromptExecutionLog[],
    projectId: string
  ): Promise<VolumeOutline[][]> {
    const candidates: VolumeOutline[][] = [];

    for (let i = 0; i < this.MAX_VOLUME_CANDIDATES; i++) {
      try {
        const executionId = this.generateExecutionId();
        const promptHash = this.hashContent(prompt);
        let usedModel = primaryModel;
        let result;

        // Try primary model first
        try {
          result = await Promise.race([
            aiService.generate({
              prompt,
              modelId: primaryModel.modelId,
              provider: primaryModel.provider,
              baseUrl: primaryModel.baseUrl || "",
              apiKey: primaryModel.apiKey || undefined,
              parameters: {
                temperature: 0.7 + i * 0.1, // Increase diversity across candidates
                maxTokens: 2500,
              },
              responseFormat: "json",
            }),
            this.timeout(this.GENERATION_TIMEOUT),
          ]);
        } catch (primaryError: any) {
          // Fallback to big model if available
          if (fallbackModel) {
            console.log(
              `[Fallback] Primary model failed for candidate ${i + 1}, trying fallback: ${fallbackModel.modelId} `
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
                  maxTokens: 2500,
                },
                responseFormat: "json",
              }),
              this.timeout(this.GENERATION_TIMEOUT),
            ]);
          } else {
            throw primaryError;
          }
        }

        const volumes = this.parseVolumeResponse(result.content, targetCount);
        if (volumes.length > 0) {
          candidates.push(volumes);
          console.log(`[Volume Generation] Candidate ${i + 1}: ${volumes.length} volumes generated`);
        }

        const responseHash = this.hashContent(result.content);
        executionLogs.push({
          executionId,
          templateId: "volume-generation-v2",
          templateVersion: this.TEMPLATE_VERSION,
          promptHash,
          promptMetadata: {
            projectId,
            usedModel: usedModel.modelId,
            candidateIndex: i,
            targetCount,
          },
          modelId: usedModel.modelId,
          modelVersion: usedModel.provider,
          params: {
            temperature: 0.7 + i * 0.1,
            maxTokens: 2500,
          },
          responseHash,
          responseSummary: volumes.length > 0 ? `${volumes.length} volumes` : "解析失败",
          tokensUsed: result.tokensUsed,
          timestamp: new Date(),
        });
      } catch (error: any) {
        console.error(`Volume candidate ${i + 1} generation failed: `, error.message);
        // Continue to next candidate instead of failing completely
      }
    }

    return candidates;
  }

  /**
   * Generate chapter outlines with fallback support
   */
  private async generateChapterOutlinesWithFallback(
    prompt: string,
    primaryModel: any,
    fallbackModel: any | undefined,
    volumeIndex: number,
    targetCount: number,
    executionLogs: PromptExecutionLog[],
    projectId: string
  ): Promise<ChapterOutline[]> {
    try {
      const executionId = this.generateExecutionId();
      const promptHash = this.hashContent(prompt);
      let usedModel = primaryModel;
      let result;

      // Try primary model first
      try {
        result = await Promise.race([
          aiService.generate({
            prompt,
            modelId: primaryModel.modelId,
            provider: primaryModel.provider,
            baseUrl: primaryModel.baseUrl || "",
            apiKey: primaryModel.apiKey || undefined,
            parameters: {
              temperature: 0.7,
              maxTokens: 4000,
            },
            responseFormat: "json",
          }),
          this.timeout(this.GENERATION_TIMEOUT),
        ]);
      } catch (primaryError: any) {
        // Fallback to big model if available
        if (fallbackModel) {
          console.log(
            `[Fallback] Primary model failed for chapter generation, trying fallback: ${fallbackModel.modelId} `
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
                temperature: 0.7,
                maxTokens: 4000,
              },
              responseFormat: "json",
            }),
            this.timeout(this.GENERATION_TIMEOUT),
          ]);
        } else {
          throw primaryError;
        }
      }

      console.log(`[Chapter Generation] Received response, length: ${result.content.length} chars`);

      const chapters = this.parseChapterResponse(result.content, volumeIndex);

      if (chapters.length === 0) {
        console.error("[Chapter Generation] Parse failed. Raw content preview:", result.content.substring(0, 500));
        throw new Error("AI返回的章节数据为空或格式错误。可能原因：1) AI模型返回格式不正确 2) 超时导致响应不完整 3) 提示词需要优化");
      }

      console.log(`[Chapter Generation] Successfully generated ${chapters.length} chapters for volume ${volumeIndex + 1} `);

      const responseHash = this.hashContent(result.content);
      executionLogs.push({
        executionId,
        templateId: "chapter-generation-v2",
        templateVersion: this.TEMPLATE_VERSION,
        promptHash,
        promptMetadata: {
          projectId,
          usedModel: usedModel.modelId,
          volumeIndex,
          targetCount,
        },
        modelId: usedModel.modelId,
        modelVersion: usedModel.provider,
        params: {
          temperature: 0.7,
          maxTokens: 3000,
        },
        responseHash,
        responseSummary: `${chapters.length} chapters`,
        tokensUsed: result.tokensUsed,
        timestamp: new Date(),
      });

      return chapters;
    } catch (error: any) {
      throw new Error(`章节生成失败: ${error.message} `);
    }
  }

  /**
   * Post-process chapters to ensure entity tracking data
   */
  private postProcessChapters(
    chapters: ChapterOutline[],
    characters: any[]
  ): ChapterOutline[] {
    return chapters.map((chapter) => {
      // Ensure focalEntities is subset of requiredEntities
      if (!chapter.focalEntities || chapter.focalEntities.length === 0) {
        // Default to first 1-2 required entities as focal
        chapter.focalEntities = chapter.requiredEntities.slice(0, 2);
      }

      // Validate entities exist in character list
      const validCharacterNames = new Set(characters.map((c) => c.name));
      chapter.requiredEntities = chapter.requiredEntities.filter((name) =>
        validCharacterNames.has(name)
      );
      chapter.focalEntities = chapter.focalEntities.filter((name) =>
        validCharacterNames.has(name)
      );

      // Ensure at least one required entity
      if (chapter.requiredEntities.length === 0 && characters.length > 0) {
        // Add protagonist as default (支持中英文)
        const protagonist = characters.find((c) => c.role === "主角" || c.role === "protagonist");
        if (protagonist) {
          chapter.requiredEntities = [protagonist.name];
          chapter.focalEntities = [protagonist.name];
        }
      }

      // Ensure entry/exit states exist
      if (!chapter.entryState) {
        chapter.entryState = "章节开始";
      }
      if (!chapter.exitState) {
        chapter.exitState = "章节结束";
      }

      // Ensure stakesDelta exists
      if (!chapter.stakesDelta) {
        chapter.stakesDelta = "情节推进";
      }

      return chapter;
    });
  }

  /**
   * Score volume candidates with enhanced metrics
   */
  private scoreVolumeCandidates(
    candidates: VolumeOutline[][],
    themeTags: string[],
    coreConflicts: string[]
  ): ScoredVolumeCandidate[][] {
    return candidates.map((volumeSet) => {
      return volumeSet.map((volume) => {
        const themeScore = this.calculateThemeScore(volume, themeTags);
        const progressionScore = this.calculateProgressionScore(volume, volumeSet);
        const writabilityScore = this.calculateWritabilityScore(volume);

        // Weighted scoring as per design document: 40% theme + 35% progression + 25% writability
        const totalScore = themeScore * 0.4 + progressionScore * 0.35 + writabilityScore * 0.25;

        return {
          outline: volume,
          themeScore,
          progressionScore,
          writabilityScore,
          totalScore,
        };
      });
    });
  }

  /**
   * Calculate theme coverage score with enhanced logic
   */
  private calculateThemeScore(volume: VolumeOutline, themeTags: string[]): number {
    let score = 0;

    // Check if volume covers main themes (40 points)
    const volumeText = `${volume.title} ${volume.oneLiner} ${volume.beats.join(" ")} `.toLowerCase();
    const volumeThemeTags = volume.themeTags || [];

    // Direct theme tag matching (higher weight)
    for (const theme of themeTags) {
      if (volumeThemeTags.some((vt) => this.isSimilar(vt, theme))) {
        score += 15;
      } else if (volumeText.includes(theme.toLowerCase())) {
        score += 10;
      }
    }

    // Check beat quality and specificity (30 points)
    const beatQuality = this.assessBeatQuality(volume.beats);
    score += beatQuality * 30;

    // Check conflict focus clarity (30 points)
    if (volume.conflictFocus && volume.conflictFocus.length > 5) {
      score += 30;
    } else if (volume.conflictFocus) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate progression score with enhanced logic
   */
  private calculateProgressionScore(volume: VolumeOutline, allVolumes: VolumeOutline[]): number {
    let score = 40; // Base score

    // Check if there's clear progression from previous volume (35 points)
    if (volume.orderIndex > 0) {
      const prevVolume = allVolumes[volume.orderIndex - 1];
      if (prevVolume) {
        // Check beat differentiation (avoid repetition)
        const overlap = volume.beats.filter((b) =>
          prevVolume.beats.some((pb) => this.calculateSimilarity(b, pb) > 0.7)
        ).length;
        const differentiation = (volume.beats.length - overlap) / volume.beats.length;
        score += differentiation * 25;

        // Check conflict escalation
        if (volume.conflictFocus && prevVolume.conflictFocus) {
          if (volume.conflictFocus !== prevVolume.conflictFocus) {
            score += 10; // Different conflict type indicates progression
          }
        }
      }
    } else {
      // First volume should have strong opening
      if (volume.beats.length >= 3 && volume.oneLiner.length >= 20) {
        score += 25;
      }
    }

    // Check if volume has clear arc (25 points)
    if (volume.beats.length >= 3 && volume.beats.length <= 5) {
      score += 25;
    } else if (volume.beats.length > 0) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Assess beat quality (0-1 score)
   */
  private assessBeatQuality(beats: string[]): number {
    if (beats.length === 0) return 0;

    let qualityScore = 0;
    const totalBeats = beats.length;

    for (const beat of beats) {
      // Check beat length (should be descriptive, not too short)
      if (beat.length >= 15 && beat.length <= 100) {
        qualityScore += 0.3;
      } else if (beat.length > 5) {
        qualityScore += 0.1;
      }

      // Check if beat contains specific content (not abstract)
      const abstractWords = ["开端", "发展", "高潮", "结局", "转折"];
      const isAbstract = abstractWords.some((word) => beat === word || beat.includes(`${word}：`));
      if (!isAbstract) {
        qualityScore += 0.4;
      }

      // Check if beat has conflict indicators
      const conflictIndicators = ["冲突", "对抗", "危机", "挑战", "困境", "矛盾", "对决"];
      if (conflictIndicators.some((word) => beat.includes(word))) {
        qualityScore += 0.3;
      }
    }

    return Math.min(qualityScore / totalBeats, 1);
  }

  /**
   * Calculate text similarity (0-1 score)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[，。、：；！？]/g, "");
    const s1 = normalize(text1);
    const s2 = normalize(text2);

    if (s1 === s2) return 1;

    // Simple character overlap ratio
    const chars1 = new Set(s1.split(""));
    const chars2 = new Set(s2.split(""));
    const chars1Array = Array.from(chars1);
    const intersection = new Set(chars1Array.filter((c) => chars2.has(c)));
    const union = new Set([...chars1Array, ...Array.from(chars2)]);

    return intersection.size / union.size;
  }

  /**
   * Calculate writability score
   */
  private calculateWritabilityScore(volume: VolumeOutline): number {
    let score = 0;

    // Check one-liner quality
    if (volume.oneLiner.length >= 20 && volume.oneLiner.length <= 50) {
      score += 30;
    }

    // Check beats count
    if (volume.beats.length >= 3 && volume.beats.length <= 5) {
      score += 40;
    }

    // Check title quality
    if (volume.title.length >= 4 && volume.title.length <= 15) {
      score += 30;
    }

    return score;
  }

  /**
   * Merge volume candidates with intelligent deduplication
   */
  private mergeVolumeCandidates(
    scoredCandidates: ScoredVolumeCandidate[][],
    targetCount: number
  ): VolumeOutline[] {
    if (scoredCandidates.length === 0) {
      return [];
    }

    // Select best candidate set as base
    const bestSet = scoredCandidates.reduce((best, current) => {
      const bestAvg = best.reduce((sum, v) => sum + v.totalScore, 0) / best.length;
      const currentAvg = current.reduce((sum, v) => sum + v.totalScore, 0) / current.length;
      return currentAvg > bestAvg ? current : best;
    });

    const baseVolumes = bestSet.map((scored) => scored.outline);

    // If only one candidate set, return it directly
    if (scoredCandidates.length === 1) {
      return baseVolumes.slice(0, targetCount);
    }

    // Merge unique elements from other high-scoring candidates
    const mergedVolumes = baseVolumes.map((baseVolume, index) => {
      const enhanced = { ...baseVolume };

      // Collect alternative beats from other candidates
      const alternativeBeats: string[] = [];
      const alternativeThemes: string[] = [...(baseVolume.themeTags || [])];

      for (const candidateSet of scoredCandidates.slice(1, 3)) {
        // Check top 2 alternatives
        if (candidateSet[index]) {
          const altVolume = candidateSet[index].outline;

          // Merge unique beats
          for (const beat of altVolume.beats) {
            const isDuplicate = enhanced.beats.some(
              (b) => this.calculateSimilarity(b, beat) > 0.7
            );
            if (!isDuplicate && alternativeBeats.length < 2) {
              alternativeBeats.push(beat);
            }
          }

          // Merge unique theme tags
          if (altVolume.themeTags) {
            for (const theme of altVolume.themeTags) {
              if (!alternativeThemes.includes(theme) && alternativeThemes.length < 5) {
                alternativeThemes.push(theme);
              }
            }
          }

          // Use better conflict focus if available
          if (
            altVolume.conflictFocus &&
            (!enhanced.conflictFocus || altVolume.conflictFocus.length > enhanced.conflictFocus.length)
          ) {
            enhanced.conflictFocus = altVolume.conflictFocus;
          }
        }
      }

      // Add best alternative beats (limit to avoid overload)
      if (alternativeBeats.length > 0 && enhanced.beats.length < 5) {
        enhanced.beats = [...enhanced.beats, ...alternativeBeats].slice(0, 5);
      }

      enhanced.themeTags = alternativeThemes;

      return enhanced;
    });

    return mergedVolumes.slice(0, targetCount);
  }

  /**
   * Parse volume response with enhanced validation
   */
  private parseVolumeResponse(content: string, targetCount: number): VolumeOutline[] {
    try {
      // Use robust JSON extraction
      const data = extractJSON(content);

      if (!Array.isArray(data)) {
        console.error("Volume response is not an array");
        return [];
      }

      const volumes = data
        .filter((v: any) => {
          // Validate required fields
          if (!v.title || !v.oneLiner || !Array.isArray(v.beats)) {
            console.warn("Volume missing required fields:", v);
            return false;
          }
          return true;
        })
        .map((v: any, index: number) => ({
          title: v.title,
          oneLiner: v.oneLiner,
          beats: v.beats,
          orderIndex: v.orderIndex !== undefined ? v.orderIndex : index,
          themeTags: Array.isArray(v.themeTags) ? v.themeTags : [],
          conflictFocus: v.conflictFocus || "",
        }))
        .slice(0, targetCount);

      console.log(`[Parse] Successfully parsed ${volumes.length} volumes`);
      return volumes;
    } catch (error) {
      console.error("Failed to parse volume response:", error);
      console.error("Content:", content.substring(0, 500));
      return [];
    }
  }

  /**
   * Parse chapter response with enhanced validation
   */
  private parseChapterResponse(content: string, volumeIndex: number): ChapterOutline[] {
    try {
      // Use robust JSON extraction
      const data = extractJSON(content);

      if (!Array.isArray(data)) {
        console.error("[Parse] Response is not an array");
        return [];
      }

      const chapters = data
        .map((c: any, index: number) => {
          // Validate and provide defaults for required fields
          if (!c.title || typeof c.title !== 'string') {
            console.warn(`[Parse] Chapter ${index} missing title, using default `);
            c.title = `第${index + 1} 章`;
          }

          if (!c.oneLiner || typeof c.oneLiner !== 'string') {
            console.warn(`[Parse] Chapter ${index} missing oneLiner, using default `);
            c.oneLiner = "章节概要";
          }

          if (!Array.isArray(c.beats)) {
            console.warn(`[Parse] Chapter ${index} beats not array, converting`);
            c.beats = c.beats ? [String(c.beats)] : ["场景1"];
          }

          if (!Array.isArray(c.requiredEntities)) {
            console.warn(`[Parse] Chapter ${index} requiredEntities not array, converting`);
            c.requiredEntities = c.requiredEntities ? [String(c.requiredEntities)] : [];
          }

          return {
            title: String(c.title).trim(),
            oneLiner: String(c.oneLiner).trim(),
            beats: c.beats.map((b: any) => String(b).trim()).filter((b: string) => b.length > 0),
            requiredEntities: c.requiredEntities.map((e: any) => String(e).trim()).filter((e: string) => e.length > 0),
            focalEntities: Array.isArray(c.focalEntities)
              ? c.focalEntities.map((e: any) => String(e).trim()).filter((e: string) => e.length > 0)
              : [],
            stakesDelta: c.stakesDelta ? String(c.stakesDelta).trim() : "情节推进",
            entryState: c.entryState ? String(c.entryState).trim() : "场景开始",
            exitState: c.exitState ? String(c.exitState).trim() : "场景结束",
            orderIndex: typeof c.orderIndex === 'number' ? c.orderIndex : index,
            volumeIndex,
          };
        })
        .filter((c: any) => {
          // Final validation: must have title and at least one beat
          if (!c.title || c.beats.length === 0) {
            console.warn("[Parse] Filtering out invalid chapter:", c.title);
            return false;
          }
          return true;
        });

      console.log(`[Parse] Successfully parsed ${chapters.length} chapters from ${data.length} items`);
      return chapters;
    } catch (error) {
      console.error("Failed to parse chapter response:", error);
      console.error("Content:", content.substring(0, 500));
      return [];
    }
  }

  private isSimilar(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
    return normalize(a) === normalize(b);
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
   * Calculate cost based on tokens and model
   */
  private calculateCost(tokensUsed: number, modelId: string): number {
    // Cost in cents (¥0.01)
    // Adjust rates based on actual model pricing
    const rates: Record<string, number> = {
      "deepseek-chat": 0.14, // ¥0.14 per 1k tokens
      "deepseek-coder": 0.14,
      "gpt-4": 3.0,
      "gpt-3.5-turbo": 0.2,
      "claude-3": 1.5,
    };

    const rate = rates[modelId] || 0.2; // Default rate
    // Round to integer cents to match database schema
    return Math.round((tokensUsed / 1000) * rate);
  }
}

export const volumeChapterGenerationService = new VolumeChapterGenerationService();
