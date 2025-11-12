// Volume and Chapter Outline Generation Service
// Implements the algorithm from design document:
// - Multi-hypothesis generation for volumes
// - Beat-based chapter breakdown
// - Entity tracking and stakes progression

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { promptPackingService, type PromptModule } from "./prompt-packing-service";
import { modelRoutingService } from "./model-routing-service";
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

export interface GenerationLog {
  executionId: string;
  templateId: string;
  promptHash: string;
  tokensUsed: number;
  timestamp: Date;
}

// ============================================================================
// Volume and Chapter Generation Service
// ============================================================================

export class VolumeChapterGenerationService {
  private readonly TEMPLATE_VERSION = "1.0.0";
  private readonly MAX_VOLUME_CANDIDATES = 3;
  private readonly TOKEN_BUDGET = 3000;
  private readonly GENERATION_TIMEOUT = 120000; // 增加到120秒，章纲生成需要更长时间

  /**
   * Generate volume outlines for a project
   * Implements multi-hypothesis generation and scoring
   */
  async generateVolumes(
    projectId: string,
    targetVolumeCount: number = 3
  ): Promise<{
    volumes: VolumeOutline[];
    executionLogs: GenerationLog[];
  }> {
    const executionLogs: GenerationLog[] = [];

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

      // Calculate routing signals based on complexity
      const hasRichContext = themeTags.length >= 3 && characters.length >= 3;
      const signals = modelRoutingService.calculateProjectCreationSignals(
        hasRichContext,
        true,
        0.6 // Higher complexity for volume generation
      );

      // Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Volume Generation] ${routing.reasoning}`);

      // Build prompt with enhanced context
      const promptModules = this.buildVolumePromptModules(
        project,
        mainOutline.content || "",
        characters.map((c) => ({ name: c.name, role: c.role })),
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

      // Generate multiple candidates with fallback
      const candidates = await this.generateVolumeCandidatesWithFallback(
        packedPrompt.promptText,
        routing.primaryModel,
        routing.fallbackModel,
        targetVolumeCount,
        executionLogs
      );

      if (candidates.length === 0) {
        throw new Error("AI生成失败，未能生成有效的卷纲");
      }

      // Score and select best with enhanced scoring
      const scoredCandidates = this.scoreVolumeCandidates(
        candidates,
        themeTags,
        coreConflicts
      );

      // Merge best candidates with deduplication
      const finalVolumes = this.mergeVolumeCandidates(
        scoredCandidates,
        targetVolumeCount
      );

      return {
        volumes: finalVolumes,
        executionLogs,
      };
    } catch (error: any) {
      throw new Error(`卷纲生成失败: ${error.message}`);
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
    executionLogs: GenerationLog[];
  }> {
    const executionLogs: GenerationLog[] = [];

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

      // Extract volume beats from plotNodes
      const volumeBeats = (volumeOutline.plotNodes as any)?.beats || [];
      if (volumeBeats.length === 0) {
        throw new Error("卷纲缺少节拍信息，无法生成章节");
      }

      // Get characters with role information
      const characters = await storage.getCharactersByProject(projectId);
      const characterMap = characters.map((c) => ({
        name: c.name,
        role: c.role,
        personality: c.personality || "",
      }));

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

      // Calculate routing signals
      const hasRichContext = volumeBeats.length >= 3 && characters.length >= 3;
      const signals = modelRoutingService.calculateProjectCreationSignals(
        hasRichContext,
        true,
        0.65 // Higher complexity for chapter generation
      );

      // Route to appropriate model
      const routing = await modelRoutingService.routeModel(signals);
      console.log(`[Chapter Generation] ${routing.reasoning}`);

      // Build prompt with enhanced context
      const promptModules = this.buildChapterPromptModules(
        targetVolume,
        volumeOutline.content || "",
        volumeBeats,
        characterMap,
        prevVolumeContext,
        targetChapterCount
      );

      const packedPrompt = await promptPackingService.packPrompt(
        promptModules,
        this.TOKEN_BUDGET
      );

      console.log(
        `[Prompt Packing] Chapter generation using ${packedPrompt.metadata.totalTokens} tokens`
      );

      // Generate chapters with fallback
      const chapters = await this.generateChapterOutlinesWithFallback(
        packedPrompt.promptText,
        routing.primaryModel,
        routing.fallbackModel,
        targetVolume.orderIndex,
        targetChapterCount,
        executionLogs
      );

      // Post-process: ensure entity tracking data
      const processedChapters = this.postProcessChapters(chapters, characterMap);

      return {
        chapters: processedChapters,
        executionLogs,
      };
    } catch (error: any) {
      throw new Error(`章纲生成失败: ${error.message}`);
    }
  }

  /**
   * Build prompt modules for volume generation with enhanced context
   */
  private buildVolumePromptModules(
    project: any,
    mainOutlineContent: string,
    characters: Array<{ name: string; role: string }>,
    themeTags: string[],
    coreConflicts: string[],
    targetCount: number
  ): PromptModule[] {
    const modules: PromptModule[] = [];

    // System role
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: "你是一位资深的网络小说大纲策划专家，擅长设计引人入胜的卷纲结构，精通情节递进和冲突设计。",
      estimatedTokens: 35,
      compressible: false,
    });

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
${characters.map((c) => `${c.name}（${c.role}）`).join("、")}`,
      estimatedTokens: 250,
      compressible: true,
    });

    // Task requirements with detailed specifications
    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请为这部小说设计 ${targetCount} 个卷的大纲。每个卷需要包含：

1. **title**: 卷标题（吸引人且符合内容，建议8-12字）
2. **oneLiner**: 一句话定位（20-30字概括本卷核心内容和主要冲突）
3. **beats**: 核心节拍（3-5个关键情节点，每个节拍要有明确的冲突或转折）
4. **themeTags**: 本卷主题标签（1-3个，从核心主题中选择或扩展）
5. **conflictFocus**: 冲突焦点（本卷的主要冲突类型）
6. **orderIndex**: 卷序号（从0开始）

设计原则：
- **递进性**: 卷与卷之间要有明确的递进关系，冲突逐步升级
- **主题覆盖**: 每卷要覆盖至少一个核心主题
- **节拍张力**: 每个节拍要有明确的目标、冲突和结果
- **角色成长**: 考虑主要角色在各卷中的成长轨迹
- **节奏控制**: 符合网络小说的节奏感，避免拖沓或过于仓促`,
      estimatedTokens: 200,
      compressible: true,
    });

    // Output format with enhanced fields
    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
请严格按照JSON数组格式输出（不要包含markdown代码块标记）：

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
   * Build prompt modules for chapter generation with enhanced context
   */
  private buildChapterPromptModules(
    volume: any,
    volumeOutlineContent: string,
    volumeBeats: string[],
    characters: Array<{ name: string; role: string; personality: string }>,
    prevVolumeContext: string,
    targetCount: number
  ): PromptModule[] {
    const modules: PromptModule[] = [];

    // System role
    modules.push({
      id: "system-role",
      priority: "must-have",
      content: "你是一位资深的网络小说章节策划专家，擅长设计紧凑有力的章节结构，精通节奏控制和钩子设计。",
      estimatedTokens: 35,
      compressible: false,
    });

    // Volume context with beats
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

${prevVolumeContext ? `\n# 上卷衔接\n${prevVolumeContext}\n` : ""}

# 可用角色
${characters.map((c) => `${c.name}（${c.role}${c.personality ? `，${c.personality.substring(0, 20)}` : ""}）`).join("\n")}`,
      estimatedTokens: 250,
      compressible: true,
    });

    // Task requirements with detailed specifications
    modules.push({
      id: "task-requirements",
      priority: "important",
      content: `# 任务要求
请基于卷的核心节拍，为本卷设计 ${targetCount} 个章节的大纲。每个章节需要包含：

1. **title**: 章节标题（吸引人，可以是悬念式或冲突式，建议6-12字）
2. **oneLiner**: 一句话概括（15-25字说明本章核心内容和主要冲突）
3. **beats**: 章节节拍（2-4个关键场景或情节点，每个要具体描述）
4. **requiredEntities**: 必需角色（本章必须出现的角色名字列表，1-3个）
5. **focalEntities**: 焦点角色（本章的主要视角角色，1-2个）
6. **stakesDelta**: 风险变化（本章对主线冲突的影响，如"冲突升级"、"关系破裂"等）
7. **entryState**: 入场状态（章节开始时的情境，简短描述）
8. **exitState**: 出场状态（章节结束时的情境，简短描述）
9. **orderIndex**: 章节序号（从0开始）

设计原则：
- **节拍分解**: 将卷的核心节拍合理分解到各章节中
- **钩子设计**: 每章开头要有吸引力，结尾要留悬念或冲突
- **节奏控制**: 紧凑有力，避免拖沓，每章推进主线
- **角色分配**: 合理安排角色出场，避免角色过多或过少
- **状态追踪**: 明确每章的入场和出场状态，确保连贯性
- **风险递进**: 章与章之间要有风险递进或情感深化`,
      estimatedTokens: 250,
      compressible: true,
    });

    // Output format with enhanced fields
    modules.push({
      id: "output-format",
      priority: "important",
      content: `# 输出格式
请严格按照JSON数组格式输出（不要包含markdown代码块标记）：

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
    executionLogs: GenerationLog[]
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
            }),
            this.timeout(this.GENERATION_TIMEOUT),
          ]);
        } catch (primaryError: any) {
          // Fallback to big model if available
          if (fallbackModel) {
            console.log(
              `[Fallback] Primary model failed for candidate ${i + 1}, trying fallback: ${fallbackModel.modelId}`
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

        executionLogs.push({
          executionId,
          templateId: "volume-generation-v2",
          promptHash,
          tokensUsed: result.tokensUsed,
          timestamp: new Date(),
        });
      } catch (error: any) {
        console.error(`Volume candidate ${i + 1} generation failed:`, error.message);
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
    executionLogs: GenerationLog[]
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
              maxTokens: 3000,
            },
          }),
          this.timeout(this.GENERATION_TIMEOUT),
        ]);
      } catch (primaryError: any) {
        // Fallback to big model if available
        if (fallbackModel) {
          console.log(
            `[Fallback] Primary model failed for chapter generation, trying fallback: ${fallbackModel.modelId}`
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
                maxTokens: 3000,
              },
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

      console.log(`[Chapter Generation] Successfully generated ${chapters.length} chapters for volume ${volumeIndex + 1}`);

      executionLogs.push({
        executionId,
        templateId: "chapter-generation-v2",
        promptHash,
        tokensUsed: result.tokensUsed,
        timestamp: new Date(),
      });

      return chapters;
    } catch (error: any) {
      throw new Error(`章节生成失败: ${error.message}`);
    }
  }

  /**
   * Post-process chapters to ensure entity tracking data
   */
  private postProcessChapters(
    chapters: ChapterOutline[],
    characters: Array<{ name: string; role: string; personality: string }>
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
        // Add protagonist as default
        const protagonist = characters.find((c) => c.role === "protagonist");
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
    const volumeText = `${volume.title} ${volume.oneLiner} ${volume.beats.join(" ")}`.toLowerCase();
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
      let jsonStr = content.trim();
      
      // Remove markdown code blocks
      jsonStr = jsonStr
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/, "");
      jsonStr = jsonStr.trim();

      // Try to extract JSON if wrapped in text
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) {
        console.error("Volume response is not an array");
        return [];
      }

      const volumes = data
        .filter((v) => {
          // Validate required fields
          if (!v.title || !v.oneLiner || !Array.isArray(v.beats)) {
            console.warn("Volume missing required fields:", v);
            return false;
          }
          return true;
        })
        .map((v, index) => ({
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
      let jsonStr = content.trim();
      
      // Remove markdown code blocks (支持多种格式)
      jsonStr = jsonStr
        .replace(/^```json\s*/i, "")
        .replace(/^```javascript\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/```\s*$/g, "")
        .trim();

      // Remove any leading/trailing text before/after JSON
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      } else {
        // Try to find JSON object array
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objMatch) {
          // Wrap single object in array
          jsonStr = `[${objMatch[0]}]`;
        }
      }

      // Clean up common JSON issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, "}") // Remove trailing commas in objects
        .replace(/,\s*\]/g, "]") // Remove trailing commas in arrays
        .trim();

      console.log("[Parse] Attempting to parse JSON, length:", jsonStr.length);

      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) {
        console.error("[Parse] Response is not an array, wrapping in array");
        return this.parseChapterResponse(`[${content}]`, volumeIndex);
      }

      const chapters = data
        .map((c, index) => {
          // Validate and provide defaults for required fields
          if (!c.title || typeof c.title !== 'string') {
            console.warn(`[Parse] Chapter ${index} missing title, using default`);
            c.title = `第${index + 1}章`;
          }
          
          if (!c.oneLiner || typeof c.oneLiner !== 'string') {
            console.warn(`[Parse] Chapter ${index} missing oneLiner, using default`);
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
        .filter((c) => {
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

export const volumeChapterGenerationService = new VolumeChapterGenerationService();
