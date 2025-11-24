// Optimized Scene Draft Service - Simplified for 60-70% speed improvement
// Removes non-essential operations and implements PromptTemplate system

import { storage } from "./storage";
import { aiService } from "./ai-service";
import { PromptTemplateService } from "./prompt-template-service";
import { BasicValidator, type ValidationRequirements, type BasicCheckResult } from "./basic-validator";
import { asyncTaskQueue } from "./async-task-queue";
import { perfMonitor } from "./performance-monitor";
import { formatCharacterForScene } from "./content-generation-helpers";
import type { SceneFrame, DraftChunk, Character } from "@shared/schema";
import { createHash } from "crypto";

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface DraftContext {
  previousContent?: string;
  storyContext?: string; // Added story context
  characters?: Character[] | any[]; // Allow both full Character type and partial character objects
  worldSettings?: string;
  globalMemory?: string; // Added global memory
  sceneFrame?: SceneFrame;
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
  styleProfile?: {
    name: string;
    traits: any;
  };
}

export interface TimingMetrics {
  contextBuild: number;
  promptAssembly: number;
  aiGeneration: number;
  validation: number;
  databaseSave: number;
  total: number;
}

export interface GenerationResult {
  draft: DraftChunk;
  basicCheck: BasicCheckResult;
  timing: TimingMetrics;
  // Backward compatibility fields (for routes.ts) - REQUIRED for compatibility
  ruleCheck: {
    passed: boolean;
    score: number;
    violations: Array<{
      rule: string;
      severity: string;
      message: string;
    }>;
  };
  executionLog: {
    executionId: string;
    templateId: string;
    templateVersion: string;
    promptSignature: string;
    promptMetadata: any;
    modelId: string;
    modelVersion: string;
    params: any;
    responseHash: string;
    responseSummary: string;
    tokensUsed: number;
    cost: number;
    qualityScore: any;
    ruleViolations: any[];
    timestamp: Date;
  };
}

// ============================================================================
// Optimized Scene Draft Service
// ============================================================================

export class SceneDraftServiceOptimized {
  private promptTemplateService: PromptTemplateService;
  private basicValidator: BasicValidator;
  private readonly SCENE_TARGET_WORDS = 2000; // Larger scenes (vs 800-1200)
  private defaultModelCache: { modelId: string; provider: string; baseUrl: string; apiKey?: string } | null = null;
  private modelCacheTime: number = 0;
  private readonly MODEL_CACHE_TTL = 60000; // Cache model config for 60 seconds
  // Use the existing template ID from database
  private readonly CHAPTER_DRAFT_TEMPLATE_ID = 'pt_chapter_draft_v1';

  // Chapter-level component cache (reused across scenes in same chapter)
  private chapterComponentCache: Map<string, {
    projectSummary: string;
    characterInfo: string;
    worldSettings: string;
    styleGuidance: string;
    chapterOutline: string;
  }> = new Map();

  // Exact hash-based prompt cache
  private promptCache: Map<string, {
    signature: string;
    templateId: string;
    templateVersion: string;
    draftChunk: DraftChunk;
    createdAt: Date;
    hitCount: number;
  }> = new Map();

  private readonly CACHE_TTL_DAYS = parseInt(process.env.PROMPT_CACHE_TTL_DAYS || '7');
  private readonly MAX_CACHE_ENTRIES = parseInt(process.env.MAX_CACHE_ENTRIES || '1000');
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.promptTemplateService = new PromptTemplateService(storage);
    this.basicValidator = new BasicValidator();
  }



  /**
   * Get default model from database configuration (with caching)
   * Falls back to environment variable only if no database config exists
   */
  private async getDefaultModel(): Promise<{ modelId: string; provider: string; baseUrl: string; apiKey?: string }> {
    // Check cache first
    const now = Date.now();
    if (this.defaultModelCache && (now - this.modelCacheTime) < this.MODEL_CACHE_TTL) {
      return this.defaultModelCache;
    }

    try {
      // Get models from database
      const models = await storage.getAIModels();
      const defaultChatModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

      if (defaultChatModel) {
        this.defaultModelCache = {
          modelId: defaultChatModel.modelId,
          provider: defaultChatModel.provider,
          baseUrl: defaultChatModel.baseUrl || "",
          apiKey: defaultChatModel.apiKey || undefined,
        };
        this.modelCacheTime = now;
        console.log(`[Model Config] Using database default: ${defaultChatModel.modelId}`);
        return this.defaultModelCache;
      }

      // Fallback to environment variable
      const envModel = process.env.DEFAULT_GENERATION_MODEL || "deepseek-chat";
      console.warn(`[Model Config] No database default found, using environment variable: ${envModel}`);

      this.defaultModelCache = {
        modelId: envModel,
        provider: "deepseek",
        baseUrl: "",
      };
      this.modelCacheTime = now;
      return this.defaultModelCache;
    } catch (error) {
      console.error(`[Model Config] Failed to load model configuration:`, error);

      // Final fallback
      const fallbackModel = {
        modelId: "deepseek-chat",
        provider: "deepseek",
        baseUrl: "",
      };

      this.defaultModelCache = fallbackModel;
      this.modelCacheTime = now;
      return fallbackModel;
    }
  }

  /**
   * Decompose chapter into 2-3 larger scenes (optimized)
   */
  async decomposeChapterIntoScenes(
    projectId: string,
    chapterId: string
  ): Promise<SceneFrame[]> {
    const totalTimer = perfMonitor.startTimer('total_decomposition');

    try {
      // Check if scenes already exist
      const existingScenes = await storage.getSceneFramesByChapter(chapterId);
      if (existingScenes.length > 0) {
        console.log(`[Scene Decomposition] Using existing ${existingScenes.length} scenes`);
        totalTimer();
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

      if (beats.length === 0) {
        throw new Error("章节大纲缺少节拍信息");
      }

      // Analyze beat complexity and group into 2-3 scenes
      const sceneGroups = this.optimizeSceneDecomposition(beats);

      console.log(
        `[Scene Decomposition] Grouped ${beats.length} beats into ${sceneGroups.length} scenes (optimized)`
      );

      // Create scene frames
      const scenes: SceneFrame[] = [];
      const requiredEntities = plotNodes.requiredEntities || [];
      const focalEntities = plotNodes.focalEntities || requiredEntities.slice(0, 2);

      for (let i = 0; i < sceneGroups.length; i++) {
        const sceneGroup = sceneGroups[i];

        const scenePurpose = sceneGroup.supportingBeats.length > 0
          ? `主要：${sceneGroup.primaryBeat}；同时：${sceneGroup.supportingBeats.join("、")}`
          : sceneGroup.primaryBeat;

        const sceneFrame = await storage.createSceneFrame({
          chapterId,
          index: i,
          purpose: scenePurpose,
          entryStateSummary: i === 0 ? plotNodes.entryState : `承接场景${i}`,
          exitStateSummary: i === sceneGroups.length - 1 ? plotNodes.exitState : `引出场景${i + 2}`,
          focalEntities: this.distributeFocalEntities(focalEntities, i, sceneGroups.length),
          tokensEstimate: Math.ceil(this.calculateSceneWords(sceneGroup.beats, sceneGroup.avgComplexity) / 3.5),
        });

        scenes.push(sceneFrame);
      }

      totalTimer();
      return scenes;
    } catch (error: any) {
      totalTimer();
      throw new Error(`场景分解失败: ${error.message}`);
    }
  }

  /**
   * Optimized scene decomposition: Dynamic grouping based on complexity
   */
  private optimizeSceneDecomposition(beats: string[]): Array<{
    beats: string[];
    primaryBeat: string;
    supportingBeats: string[];
    avgComplexity: number;
  }> {
    // Analyze beat complexity
    const complexityScores = beats.map(beat => this.analyzeBeatComplexity(beat));

    const groups: Array<{
      beats: string[];
      primaryBeat: string;
      supportingBeats: string[];
      avgComplexity: number;
    }> = [];

    let currentGroupBeats: string[] = [];
    let currentGroupComplexity = 0;

    // Dynamic grouping thresholds
    // Lower thresholds to encourage splitting into 2-3 scenes
    const MAX_COMPLEXITY_PER_SCENE = 3; // e.g., 1 high complexity (3) or 3 low (1)
    const MAX_BEATS_PER_SCENE = 2; // Max 2 beats per scene to ensure detail

    for (let i = 0; i < beats.length; i++) {
      const beat = beats[i];
      const score = complexityScores[i];

      // Check if adding this beat would exceed thresholds
      // But always ensure at least one beat per scene
      if (currentGroupBeats.length > 0 &&
        (currentGroupComplexity + score > MAX_COMPLEXITY_PER_SCENE ||
          currentGroupBeats.length >= MAX_BEATS_PER_SCENE)) {

        // Finalize current group
        const avg = currentGroupComplexity / currentGroupBeats.length;
        groups.push({
          beats: [...currentGroupBeats],
          primaryBeat: currentGroupBeats[0],
          supportingBeats: currentGroupBeats.slice(1),
          avgComplexity: avg
        });

        // Start new group
        currentGroupBeats = [beat];
        currentGroupComplexity = score;
      } else {
        // Add to current group
        currentGroupBeats.push(beat);
        currentGroupComplexity += score;
      }
    }

    // Add remaining beats
    if (currentGroupBeats.length > 0) {
      const avg = currentGroupComplexity / currentGroupBeats.length;
      groups.push({
        beats: [...currentGroupBeats],
        primaryBeat: currentGroupBeats[0],
        supportingBeats: currentGroupBeats.slice(1),
        avgComplexity: avg
      });
    }

    console.log(
      `[Scene Grouping] Grouped ${beats.length} beats into ${groups.length} scenes (dynamic)`
    );

    return groups;
  }

  /**
   * Analyze beat complexity (1-3 scale)
   */
  private analyzeBeatComplexity(beat: string): number {
    const lower = beat.toLowerCase();
    let score = 2; // default: medium

    // High complexity indicators
    if (lower.includes('战斗') || lower.includes('冲突') ||
      lower.includes('对抗') || lower.includes('交手')) {
      score = 3;
    }
    // Low complexity indicators
    else if (lower.includes('对话') || lower.includes('交谈') ||
      lower.includes('过渡') || lower.includes('准备')) {
      score = 1;
    }

    return score;
  }

  /**
   * Calculate scene word target based on beats and complexity
   */
  private calculateSceneWords(beats: string[], avgComplexity: number): number {
    const baseWords = beats.length * 800; // Reduced base words per beat (was 1000)
    const complexityMultiplier = avgComplexity / 2;
    const targetWords = Math.floor(baseWords * complexityMultiplier);

    // Clamp to reasonable range (was 1500-5000)
    return Math.max(1000, Math.min(3000, targetWords));
  }

  /**
   * Distribute focal entities across scenes
   */
  private distributeFocalEntities(
    allEntities: string[],
    sceneIndex: number,
    _totalScenes: number
  ): string[] {
    if (allEntities.length === 0) return [];
    if (allEntities.length <= 2) return allEntities;

    const startIndex = (sceneIndex * 2) % allEntities.length;
    return [
      allEntities[startIndex],
      allEntities[(startIndex + 1) % allEntities.length],
    ];
  }

  /**
   * Generate scene draft (optimized flow)
   */
  async generateSceneDraft(
    projectId: string,
    sceneFrame: SceneFrame,
    context: DraftContext
  ): Promise<GenerationResult> {
    let finalResult: GenerationResult | null = null;
    for await (const chunk of this.generateSceneDraftStream(projectId, sceneFrame, context)) {
      if (typeof chunk !== 'string') {
        finalResult = chunk;
      }
    }
    if (!finalResult) {
      throw new Error("Failed to generate scene draft");
    }
    return finalResult;
  }

  /**
   * Generate scene draft with streaming support
   */
  async *generateSceneDraftStream(
    projectId: string,
    sceneFrame: SceneFrame,
    context: DraftContext
  ): AsyncGenerator<string | GenerationResult, void, unknown> {
    const totalTimer = perfMonitor.startTimer('total_generation');
    const timings: Partial<TimingMetrics> = {};

    try {
      // Step 1: Build context (5s)
      const contextTimer = perfMonitor.startTimer('context_build');
      const promptContext = this.buildPromptContext(projectId, sceneFrame, context);
      timings.contextBuild = Date.now();
      contextTimer();

      // Step 2: Assemble prompt using PromptTemplate (2-3s)
      const promptTimer = perfMonitor.startTimer('prompt_assembly');
      const template = await this.promptTemplateService.getTemplate(this.CHAPTER_DRAFT_TEMPLATE_ID);
      const assembledPrompt = this.promptTemplateService.assemblePrompt(template, promptContext);
      timings.promptAssembly = Date.now() - timings.contextBuild;
      promptTimer();

      // Step 3: Check exact cache (<100ms)
      const cachedResult = this.checkCache(assembledPrompt.signature);
      if (cachedResult) {
        console.log(`[Cache HIT] Signature: ${assembledPrompt.signature.substring(0, 8)}...`);

        yield cachedResult.draftChunk.content;

        timings.aiGeneration = 0;
        timings.validation = 0;
        timings.databaseSave = 0;
        timings.total = Date.now() - timings.contextBuild;
        totalTimer();

        const basicCheck = {
          passed: cachedResult.draftChunk.ruleCheckPassed || false,
          criticalErrors: (cachedResult.draftChunk.ruleCheckErrors as string[]) || [],
          warnings: (cachedResult.draftChunk.ruleCheckWarnings as string[]) || [],
        };

        const ruleCheck = {
          passed: basicCheck.passed,
          score: basicCheck.passed ? 80 : 60,
          violations: [
            ...basicCheck.criticalErrors.map(msg => ({
              rule: 'cached_error',
              severity: 'error',
              message: msg,
            })),
            ...basicCheck.warnings.map(msg => ({
              rule: 'cached_warning',
              severity: 'warning',
              message: msg,
            })),
          ],
        };

        const executionLog = {
          executionId: cachedResult.draftChunk.createdFromExecId || '',
          templateId: template.id,
          templateVersion: template.version,
          promptSignature: assembledPrompt.signature,
          promptMetadata: { cached: true },
          modelId: 'cache',
          modelVersion: '1.0',
          params: {},
          responseHash: '',
          responseSummary: cachedResult.draftChunk.localSummary || '',
          tokensUsed: 0,
          cost: 0,
          qualityScore: {
            overall: cachedResult.draftChunk.qualityScore || 75,
            dimensions: {},
          },
          ruleViolations: ruleCheck.violations,
          timestamp: new Date(),
        };

        yield {
          draft: cachedResult.draftChunk,
          basicCheck,
          timing: timings as TimingMetrics,
          ruleCheck,
          executionLog,
        };
        return;
      }

      console.log(`[Cache MISS] Signature: ${assembledPrompt.signature.substring(0, 8)}...`);
      this.cacheMisses++;

      // Step 4: Generate with AI (Streamed)
      const aiTimer = perfMonitor.startTimer('ai_generation');
      const targetWords = this.calculateSceneWords(
        [sceneFrame.purpose],
        2 // default medium complexity
      );

      const modelConfig = await this.getDefaultModel();

      let generatedContent = "";
      const stream = aiService.generateStream({
        prompt: assembledPrompt.text,
        modelId: modelConfig.modelId,
        provider: modelConfig.provider,
        baseUrl: modelConfig.baseUrl,
        apiKey: modelConfig.apiKey,
        parameters: {
          temperature: 0.7,
          maxTokens: Math.ceil(targetWords / 0.35),
        },
      });

      for await (const chunk of stream) {
        generatedContent += chunk;
        yield chunk;
      }

      timings.aiGeneration = Date.now() - timings.contextBuild - timings.promptAssembly;
      aiTimer();

      // Step 5: Basic validation (1s)
      const validationTimer = perfMonitor.startTimer('validation');
      const validationReqs: ValidationRequirements = {
        minWords: Math.floor(targetWords * 0.85),
        maxWords: Math.floor(targetWords * 1.15),
        requiredCharacters: sceneFrame.focalEntities || [],
        sceneFrame,
      };
      const basicCheck = this.basicValidator.validate(generatedContent, validationReqs);
      timings.validation = Date.now() - timings.contextBuild - timings.promptAssembly - timings.aiGeneration;
      validationTimer();

      // Step 6: Save to database (1s)
      const saveTimer = perfMonitor.startTimer('database_save');
      const estimatedTokens = Math.ceil(generatedContent.length * 1.5);

      const draftChunk = await storage.createDraftChunk({
        sceneId: sceneFrame.id,
        content: generatedContent,
        mentions: this.extractMentions(generatedContent, context),
        localSummary: this.generateLocalSummary(generatedContent),
        createdFromExecId: this.generateExecutionId(),
        wordCount: this.countWords(generatedContent),
        ruleCheckPassed: basicCheck.passed,
        ruleCheckErrors: basicCheck.criticalErrors,
        ruleCheckWarnings: basicCheck.warnings,
        promptTemplateId: template.id,
        templateVersion: template.version,
        modelUsed: modelConfig.modelId,
        tokensUsed: estimatedTokens,
        qualityScore: basicCheck.passed ? 75 : 60,
      });
      timings.databaseSave = Date.now() - timings.contextBuild - timings.promptAssembly - timings.aiGeneration - timings.validation;
      saveTimer();

      // Step 7: Queue async operations
      asyncTaskQueue.enqueue({
        type: 'entity_tracking',
        data: { projectId, sceneFrame, mentions: draftChunk.mentions, content: generatedContent },
        priority: 'medium',
      });

      asyncTaskQueue.enqueue({
        type: 'generation_log',
        data: {
          executionId: draftChunk.createdFromExecId,
          templateId: template.id,
          promptSignature: assembledPrompt.signature,
          tokensUsed: estimatedTokens,
        },
        priority: 'low',
      });

      this.saveToCache(
        assembledPrompt.signature,
        template.id,
        template.version,
        draftChunk
      );

      asyncTaskQueue.enqueue({
        type: 'cache_update',
        data: { signature: assembledPrompt.signature, draft: draftChunk, templateId: template.id },
        priority: 'low',
      });

      timings.total = Date.now() - timings.contextBuild;
      totalTimer();

      console.log(`[Draft Generation] Scene ${sceneFrame.index} completed in ${timings.total}ms`);

      const ruleCheck = {
        passed: basicCheck.passed,
        score: basicCheck.passed ? 80 : 60,
        violations: [
          ...basicCheck.criticalErrors.map(msg => ({
            rule: 'critical_error',
            severity: 'error',
            message: msg,
          })),
          ...basicCheck.warnings.map(msg => ({
            rule: 'warning',
            severity: 'warning',
            message: msg,
          })),
        ],
      };

      const executionLog = {
        executionId: draftChunk.createdFromExecId || '',
        templateId: template.id,
        templateVersion: template.version,
        promptSignature: assembledPrompt.signature,
        promptMetadata: { sceneIndex: sceneFrame.index },
        modelId: modelConfig.modelId,
        modelVersion: modelConfig.provider,
        params: { temperature: 0.7, maxTokens: Math.ceil(targetWords / 0.35) },
        responseHash: this.hashContent(generatedContent),
        responseSummary: draftChunk.localSummary || '',
        tokensUsed: estimatedTokens,
        cost: this.calculateCost(estimatedTokens, modelConfig.modelId),
        qualityScore: {
          overall: basicCheck.passed ? 75 : 60,
          dimensions: {},
        },
        ruleViolations: ruleCheck.violations,
        timestamp: new Date(),
      };

      yield {
        draft: draftChunk,
        basicCheck,
        timing: timings as TimingMetrics,
        ruleCheck,
        executionLog,
      };

    } catch (error: any) {
      totalTimer();
      throw new Error(`场景草稿生成失败: ${error.message}`);
    }
  }

  /**
   * Build prompt context from scene data with component caching
   */
  private buildPromptContext(
    projectId: string,
    sceneFrame: SceneFrame,
    context: DraftContext
  ): any {
    const chapterId = sceneFrame.chapterId;

    // Get or build chapter-level components (cached)
    if (!this.chapterComponentCache.has(chapterId)) {
      const components = this.buildChapterComponents(context);
      this.chapterComponentCache.set(chapterId, components);
      console.log(`[Prompt Assembly] Built and cached chapter components for ${chapterId}`);
    } else {
      console.log(`[Prompt Assembly] Using cached chapter components for ${chapterId}`);
    }

    return {
      projectId,
      chapterId: sceneFrame.chapterId,
      chapterIndex: context.currentScene?.index || 0,
      beats: [sceneFrame.purpose],
      characters: context.characters || [],
      estimatedWords: this.SCENE_TARGET_WORDS,
      styleGuidelines: context.projectSummary?.toneProfile || '',
      previousSummary: context.previousContent || '', // Use full content passed from service
      storyContext: context.storyContext || '', // Pass story context
      worldSettings: (context.globalMemory ? `【全局关键规则】\n${context.globalMemory}\n\n` : '') + (this.chapterComponentCache.get(chapterId)?.worldSettings || context.worldSettings || ''),
      negativeConstraints: `
- **禁止AI惯用语**：严禁使用"心中一动"、"不由得"、"嘴角勾起"、"眼神一凝"、"倒吸一口凉气"等陈词滥调。
- **避免重复句式**：不要连续使用"当...时"或"随着..."开头的句子。
- **拒绝空洞形容**：不要只说"恐怖的气息"，要描写具体的冷汗、颤抖或压抑感。`,
      sensoryInstructions: `
- **感官锚点**：本场景必须包含至少3处具体的感官描写（视觉之外的听觉、嗅觉、触觉或味觉）。
- **环境互动**：角色必须与环境发生互动（如触碰物体、受天气影响等），而不仅仅是站在背景中对话。`,
    };
  }

  /**
   * Build chapter-level components (cached for all scenes in chapter)
   */
  private buildChapterComponents(context: DraftContext): {
    projectSummary: string;
    characterInfo: string;
    worldSettings: string;
    styleGuidance: string;
    chapterOutline: string;
  } {
    const projectSummary = context.projectSummary
      ? `主题：${context.projectSummary.themeTags || "未指定"}\n核心冲突：${context.projectSummary.coreConflicts || "未指定"}`
      : '';

    const characterInfo = (context.characters || [])
      .map(c => formatCharacterForScene(c))
      .join('\n\n');

    const worldSettings = context.worldSettings || '';

    const styleGuidance = context.styleProfile
      ? `风格名称：${context.styleProfile.name}
叙事节奏：${context.styleProfile.traits.rhythm}
用词习惯：${context.styleProfile.traits.vocabulary}
句式结构：${context.styleProfile.traits.sentenceStructure}
修辞手法：${Array.isArray(context.styleProfile.traits.rhetoricalDevices) ? context.styleProfile.traits.rhetoricalDevices.join("、") : context.styleProfile.traits.rhetoricalDevices}
整体基调：${context.styleProfile.traits.tone}`
      : (context.projectSummary?.toneProfile
        ? `叙事风格：${context.projectSummary.toneProfile}`
        : '');

    const chapterOutline = context.chapterOutline
      ? `章节：${context.chapterOutline.title}\n概要：${context.chapterOutline.summary}\n节拍：${context.chapterOutline.beats.join('、')}`
      : '';

    return {
      projectSummary,
      characterInfo,
      worldSettings,
      styleGuidance,
      chapterOutline,
    };
  }

  /**
   * Clear chapter component cache (call when chapter generation completes)
   */
  clearChapterCache(chapterId: string): void {
    this.chapterComponentCache.delete(chapterId);
    console.log(`[Prompt Assembly] Cleared cache for chapter ${chapterId}`);
  }

  /**
   * Check exact hash cache (fast: <1ms)
   */
  private checkCache(signature: string): {
    signature: string;
    templateId: string;
    templateVersion: string;
    draftChunk: DraftChunk;
    createdAt: Date;
    hitCount: number;
  } | null {
    const entry = this.promptCache.get(signature);

    if (entry) {
      // Check if cache entry is still valid
      const age = Date.now() - entry.createdAt.getTime();
      const maxAge = this.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

      if (age > maxAge) {
        // Cache expired
        this.promptCache.delete(signature);
        this.cacheMisses++;
        return null;
      }

      // Cache hit
      entry.hitCount++;
      this.cacheHits++;
      return entry;
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Save to cache (async, non-blocking)
   */
  private saveToCache(
    signature: string,
    templateId: string,
    templateVersion: string,
    draftChunk: DraftChunk
  ): void {
    // Check cache size limit
    if (this.promptCache.size >= this.MAX_CACHE_ENTRIES) {
      // Remove oldest entry
      const entries = Array.from(this.promptCache.entries());
      entries.sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
      const oldestKey = entries[0][0];
      this.promptCache.delete(oldestKey);
      console.log(`[Cache] Removed oldest entry to maintain size limit (${this.MAX_CACHE_ENTRIES})`);
    }

    this.promptCache.set(signature, {
      signature,
      templateId,
      templateVersion,
      draftChunk,
      createdAt: new Date(),
      hitCount: 0,
    });

    console.log(`[Cache] Saved entry with signature ${signature.substring(0, 8)}... (${this.promptCache.size}/${this.MAX_CACHE_ENTRIES})`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? this.cacheHits / total : 0,
      size: this.promptCache.size,
    };
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const maxAge = this.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let cleared = 0;

    for (const [signature, entry] of Array.from(this.promptCache.entries())) {
      const age = now - entry.createdAt.getTime();
      if (age > maxAge) {
        this.promptCache.delete(signature);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[Cache] Cleared ${cleared} expired entries`);
    }
  }

  /**
   * Extract character mentions from content
   */
  private extractMentions(content: string, context: DraftContext): string[] {
    const characters = context.characters || [];
    const mentions: string[] = [];

    for (const char of characters) {
      if (content.includes(char.name)) {
        mentions.push(char.name);
      }
    }

    return mentions;
  }

  /**
   * Generate local summary of content
   */
  private generateLocalSummary(content: string): string {
    // Simple summary: first 200 characters
    return content.substring(0, 200) + (content.length > 200 ? '...' : '');
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Count words (Chinese + English)
   */
  private countWords(content: string): number {
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = content
      .replace(/[\u4e00-\u9fa5]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0).length;

    return chineseChars + englishWords;
  }

  /**
   * Calculate cost based on tokens and model (in cents)
   */
  private calculateCost(tokensUsed: number, modelId: string): number {
    const costPer1MTokens: Record<string, number> = {
      "deepseek-chat": 14,
      "deepseek-coder": 14,
      "gpt-4": 3000,
      "gpt-4-turbo": 1000,
      "gpt-3.5-turbo": 50,
      "claude-3-opus": 1500,
      "claude-3-sonnet": 300,
      "claude-3-haiku": 25,
    };

    let costRate = 100; // Default: $1 per 1M tokens
    for (const [model, rate] of Object.entries(costPer1MTokens)) {
      if (modelId.includes(model)) {
        costRate = rate;
        break;
      }
    }

    return Math.ceil((tokensUsed / 1000000) * costRate);
  }

  /**
   * Generate SHA256 hash of content
   */
  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

// Export singleton instance
export const sceneDraftServiceOptimized = new SceneDraftServiceOptimized();
