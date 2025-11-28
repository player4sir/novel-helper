// Creation Orchestrator Service
// Coordinates the entire project creation workflow

import { sessionManager, type SessionId, type CreationStep } from "./session-manager";
import { enhancedProjectCreationService, type ProjectSeed, type ProjectMeta } from "./enhanced-project-creation-service";
import { characterGenerator } from "./character-generator";
import { relationshipInferrer } from "./relationship-inferrer";
import { worldGenerator, type WorldSetting } from "./world-generator";
import { historyService } from "./history-service";
import { feedbackLearningService } from "./feedback-learning-service";
import { errorRecoveryService, retryWithBackoff } from "./error-recovery-service";

import { qualityScorer } from "./quality-scorer";
import { innovationEvaluator } from "./innovation-evaluator";
import { aiService } from "./ai-service";
import { storage } from "./storage";
import { extractJSON } from "./utils/json-extractor";
import { db } from "./db";
import { projects, outlines } from "@shared/schema";
import type { Session } from "@shared/schema";
import { genreConfigService } from "./genre-config-service";

// Types
export interface CreationResult {
  projectId: string;
  projectMeta: ProjectMeta;
  executionLogs: any[];
  routingDecision: string;
  qualityScore?: any;
  innovationScore?: any;
}

export interface StepResult {
  step: CreationStep;
  data: any;
  candidates?: ProjectMeta[];
  selectedCandidate?: ProjectMeta;
  timestamp: Date;
}
export interface RegenerateOptions {
  temperature?: number;
  useAlternativeModel?: boolean;
}

/**
 * CreationOrchestrator - Coordinates project creation workflow
 */
export class CreationOrchestrator {
  /**
   * Start quick creation (one-shot)
   * Uses the existing enhanced project creation service
   */
  async startQuickCreation(
    seed: ProjectSeed,
    userId?: string,
    onProgress?: (step: string, status: string, message: string, progress: number, metadata?: any) => void,
    skipFinalize: boolean = false
  ): Promise<CreationResult | { sessionId: string; projectMeta: ProjectMeta }> {
    console.log("[Orchestrator] Starting quick creation (Unified 3-Phase Flow)");

    // 1. Create session (for persistence and state management)
    onProgress?.("init", "running", "初始化创建会话...", 5);
    const session = await sessionManager.createSession(seed, "quick", userId);
    const sessionId = session.id;
    console.log(`[Orchestrator] Created quick session ${sessionId}`);

    try {
      // Phase 1: Foundation & Directives
      console.log("[Orchestrator] Phase 1: Foundation & Directives");
      onProgress?.("basic", "running", "第一阶段：生成基础设定与指导原则...", 10);

      const basicResult = await this.executeBasicStep(seed, userId);
      await sessionManager.saveStepResult(sessionId, "basic", basicResult);

      onProgress?.("basic", "completed", "第一阶段：基础设定生成完成", 25);

      // Refresh session to get latest data
      let currentSession = await sessionManager.getSession(sessionId);
      if (!currentSession) throw new Error("Session lost");

      // Phase 2: Parallel Asset Expansion (Characters & World)
      console.log("[Orchestrator] Phase 2: Parallel Asset Expansion");
      onProgress?.("characters", "running", "第二阶段：正在并行生成角色与世界观...", 30);

      // Use Promise.allSettled for better fault tolerance
      const [charResult, worldResult] = await Promise.allSettled([
        this.executeCharactersStep(seed, currentSession),
        this.executeWorldStep(seed, currentSession)
      ]);

      // Process Character Result
      if (charResult.status === 'fulfilled') {
        await sessionManager.saveStepResult(sessionId, "characters", charResult.value);
        onProgress?.("characters", "completed", "角色生成完成", 55);
      } else {
        console.error("[Orchestrator] Character generation failed:", charResult.reason);
        onProgress?.("characters", "failed", "角色生成失败，将使用基础模板", 55);

        // Fallback: Create a default protagonist if generation failed
        // This ensures the project is not empty and can be recovered
        // Fallback: Create a default protagonist if generation failed
        // This ensures the project is not empty and can be recovered
        const session = await sessionManager.getSession(sessionId);
        const stepResults = session?.stepResults as Record<string, any> || {};
        const basicData = stepResults.basic?.data || {};

        const fallbackCharacter = {
          name: "主角",
          role: "主角" as const,
          personality: "待设定",
          appearance: "待设定",
          background: "自动生成的默认主角",
          abilities: "待设定",
          motivation: "待设定",
          innerConflict: "待设定",
          hiddenGoal: "待设定",
          growthPath: "待设定"
        };

        await sessionManager.saveStepResult(sessionId, "characters", {
          step: "characters",
          timestamp: new Date(),
          data: {
            characterCount: 1,
            relationshipCount: 0,
            firstCharacter: fallbackCharacter,
            characters: [fallbackCharacter],
            relationships: []
          }
        });

        console.log("[Orchestrator] Created fallback character to prevent empty project");
      }

      // Process World Result
      if (worldResult.status === 'fulfilled') {
        await sessionManager.saveStepResult(sessionId, "world", worldResult.value);
        onProgress?.("world", "completed", "世界观生成完成", 60);
      } else {
        console.error("[Orchestrator] World generation failed:", worldResult.reason);
        onProgress?.("world", "failed", "世界观生成失败，将使用基础模板", 60);
      }

      onProgress?.("world", "completed", "第二阶段：核心资产扩展完成", 70);

      // Refresh session again
      currentSession = await sessionManager.getSession(sessionId);
      if (!currentSession) throw new Error("Session lost");

      // Phase 3: Structure (Outline)
      console.log("[Orchestrator] Phase 3: Structure");
      onProgress?.("outline", "running", "第三阶段：正在生成故事大纲...", 75);

      const outlineResult = await this.executeOutlineStep(seed, currentSession);
      await sessionManager.saveStepResult(sessionId, "outline", outlineResult);

      onProgress?.("outline", "completed", "第三阶段：大纲生成完成", 90);

      // Refresh session one last time to get all data
      currentSession = await sessionManager.getSession(sessionId);
      if (!currentSession) throw new Error("Session lost");

      // Check if we should skip finalization (Review Mode)
      if (skipFinalize) {
        console.log("[Orchestrator] Skipping finalization for review");
        onProgress?.("review", "waiting", "等待用户审核...", 95);

        // Merge results to show to user
        const projectMeta = this.mergeStepResults(currentSession.stepResults as any);

        return {
          sessionId,
          projectMeta
        };
      }

      // Finalize
      console.log("[Orchestrator] Finalizing Quick Creation");
      onProgress?.("outline", "running", "正在创建项目...", 95);

      const result = await this.finalizeCreation(sessionId);

      onProgress?.("outline", "completed", "项目创建成功！", 100);

      return result;

    } catch (error) {
      console.error("[Orchestrator] Quick creation failed:", error);
      onProgress?.("error", "failed", `创建失败: ${(error as Error).message}`, 0);
      throw error;
    }
  }

  /**
   * Start stepwise creation
   * Creates a session and returns session ID
   */
  async startStepwiseCreation(seed: ProjectSeed, userId?: string): Promise<SessionId> {
    console.log("[Orchestrator] Starting stepwise creation");

    // Create session
    const session = await sessionManager.createSession(seed, "stepwise", userId);

    console.log(`[Orchestrator] Created session ${session.id}`);

    return session.id;
  }

  /**
   * Execute next step in the creation workflow
   */
  async executeNextStep(sessionId: SessionId, data?: any): Promise<StepResult> {
    console.log(`[Orchestrator] Executing next step for session ${sessionId}`);

    // Get session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== "active") {
      throw new Error(`Session ${sessionId} is not active (status: ${session.status})`);
    }

    const currentStep = session.currentStep as CreationStep;
    const seed = session.seed as ProjectSeed;
    const stepResults = session.stepResults as Record<CreationStep, StepResult>;

    // If data is provided, update the current step result first
    if (data && stepResults && stepResults[currentStep]) {
      console.log(`[Orchestrator] Updating current step ${currentStep} with user data`);

      // Update the data in the step result
      stepResults[currentStep].data = data;

      // Save the updated result
      await sessionManager.saveStepResult(sessionId, currentStep, stepResults[currentStep]);

      // Update local session object to reflect changes
      session.stepResults = stepResults;
    }

    // Determine next step
    // If current step has no result yet, execute current step
    // Otherwise, move to next step
    let targetStep: CreationStep;

    if (!stepResults || !stepResults[currentStep]) {
      // Current step not executed yet, execute it
      targetStep = currentStep;
      console.log(`[Orchestrator] Executing current step: ${targetStep}`);
    } else {
      // Current step already executed, move to next
      targetStep = this.getNextStep(currentStep);
      console.log(`[Orchestrator] Moving to next step: ${targetStep}`);
    }

    // Execute step based on type
    let stepResult: StepResult;

    switch (targetStep) {
      case "basic":
        stepResult = await this.executeBasicStep(seed, session.userId || undefined);
        break;
      case "characters":
        stepResult = await this.executeCharactersStep(seed, session);
        break;
      case "world":
        stepResult = await this.executeWorldStep(seed, session);
        break;
      case "outline":
        stepResult = await this.executeOutlineStep(seed, session);
        break;
      case "finalize":
        stepResult = await this.executeFinalizeStep(seed, session);
        break;
      default:
        throw new Error(`Unknown step: ${targetStep}`);
    }

    // Save step result
    await sessionManager.saveStepResult(sessionId, targetStep, stepResult);

    // Update session current step
    await sessionManager.updateSession(sessionId, {
      currentStep: targetStep,
    });

    return stepResult;
  }

  /**
   * Regenerate a specific step
   */
  async regenerateStep(
    sessionId: SessionId,
    step: CreationStep,
    options?: RegenerateOptions
  ): Promise<StepResult> {
    console.log(`[Orchestrator] Regenerating step ${step} for session ${sessionId}`);

    // Get session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const seed = session.seed as ProjectSeed;

    // Add randomness to ensure different results
    const enhancedOptions = {
      ...options,
      temperature: options?.temperature || Math.random() * 0.3 + 0.7, // 0.7-1.0
      randomSeed: Date.now(), // Use timestamp as random seed
    };

    console.log(`[Orchestrator] Regenerating step ${step} with options:`, enhancedOptions);

    // Execute step again with different parameters
    let stepResult: StepResult;

    switch (step) {
      case "basic":
        stepResult = await this.executeBasicStep(seed, session.userId || undefined, enhancedOptions);
        break;
      case "characters":
        stepResult = await this.executeCharactersStep(seed, session, enhancedOptions);
        break;
      case "world":
        stepResult = await this.executeWorldStep(seed, session, enhancedOptions);
        break;
      case "outline":
        stepResult = await this.executeOutlineStep(seed, session, enhancedOptions);
        break;
      case "finalize":
        stepResult = await this.executeFinalizeStep(seed, session, enhancedOptions);
        break;
      default:
        throw new Error(`Unknown step: ${step}`);
    }

    // Save regenerated result
    await sessionManager.saveStepResult(sessionId, step, stepResult);

    // Update session current step to the regenerated step? 
    // Maybe not, we just want to update the data. 
    // But if we regenerate "basic", subsequent steps might need to be invalidated or re-run?
    // For now, let's assume the user just wants to update that specific section's data.
    // However, for consistency, we might want to update the session's step results.
    // The saveStepResult above does that.

    return stepResult;
  }

  /**
   * Regenerate current step with different parameters
   */
  async regenerateCurrentStep(
    sessionId: SessionId,
    options?: RegenerateOptions
  ): Promise<StepResult> {
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return this.regenerateStep(sessionId, session.currentStep as CreationStep, options);
  }

  /**
   * Pause creation
   */
  async pauseCreation(sessionId: SessionId): Promise<void> {
    console.log(`[Orchestrator] Pausing creation for session ${sessionId}`);
    await sessionManager.pauseSession(sessionId);
  }

  /**
   * Resume creation
   */
  async resumeCreation(sessionId: SessionId): Promise<StepResult> {
    console.log(`[Orchestrator] Resuming creation for session ${sessionId}`);

    // Resume session
    await sessionManager.resumeSession(sessionId);

    // Get current step result
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const stepResults = session.stepResults as Record<CreationStep, StepResult>;
    const currentStep = session.currentStep as CreationStep;

    return stepResults[currentStep] || {
      step: currentStep,
      data: {},
      timestamp: new Date(),
    };
  }

  /**
   * Finalize creation and create project
   */
  async finalizeCreation(
    sessionId: SessionId,
    overrides?: Partial<ProjectMeta>
  ): Promise<CreationResult> {
    console.log(`[Orchestrator] Finalizing creation for session ${sessionId}`);

    // Get session
    const session = await sessionManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const seed = session.seed as ProjectSeed;
    const stepResults = session.stepResults as Record<CreationStep, StepResult>;

    // Merge all step results into final ProjectMeta
    let finalMeta = this.mergeStepResults(stepResults);

    // Apply overrides if provided
    if (overrides) {
      console.log("[Orchestrator] Applying user overrides to project meta");
      finalMeta = {
        ...finalMeta,
        ...overrides,
        // Deep merge specific sections if needed
        mainEntities: overrides.mainEntities || finalMeta.mainEntities,
        worldSettings: overrides.worldSettings || finalMeta.worldSettings,
        // Outline fields
        outline: overrides.outline || finalMeta.outline,
        plotPoints: overrides.plotPoints || finalMeta.plotPoints,
        opening: overrides.opening || finalMeta.opening,
        climax: overrides.climax || finalMeta.climax,
        ending: overrides.ending || finalMeta.ending,
      };
    }

    console.log("[Orchestrator] Merged meta:", JSON.stringify({
      title: finalMeta.title,
      charactersCount: finalMeta.mainEntities?.length,
      worldSettingsExists: !!finalMeta.worldSettings,
      outlineExists: !!finalMeta.outline,
      plotPointsCount: finalMeta.plotPoints?.length,
    }, null, 2));

    console.log("[Orchestrator] Creating project from merged meta");

    // Score the final meta for quality control
    const qualityScore = await qualityScorer.scoreCandidate(finalMeta as any, seed as any, session.userId || "");
    const innovationScore = innovationEvaluator.evaluateInnovation(finalMeta as any);

    console.log("[Orchestrator] Quality score:", qualityScore.overall);
    console.log("[Orchestrator] Innovation score:", innovationScore.overall);

    // Check if quality is acceptable (threshold: 60)
    if (qualityScore.overall < 60) {
      console.warn("[Orchestrator] Quality score below threshold, but proceeding with user's work");
      // Note: We don't auto-regenerate here because user has invested time in stepwise creation
      // Instead, we'll include quality issues in the result
    }

    // Create the actual project using the merged meta
    const project = await this.createProjectFromMergedMeta(finalMeta, seed, session.userId || "");

    // Record to history
    await historyService.recordCandidate(
      sessionId,
      finalMeta,
      {
        quality: qualityScore as any,
        innovation: innovationScore as any,
      },
      {
        modelUsed: "stepwise-creation",
        tokensUsed: 0, // Will be calculated from logs
        generationTime: 0,
      }
    );

    // Mark session as completed
    await sessionManager.completeSession(sessionId);

    return {
      projectId: project.id,
      projectMeta: finalMeta,
      qualityScore,
      innovationScore,
      executionLogs: [],
      routingDecision: "stepwise-creation",
    };
  }

  /**
   * Create project from merged meta (stepwise creation result)
   */
  private async createProjectFromMergedMeta(
    meta: ProjectMeta,
    seed: ProjectSeed,
    userId: string
  ): Promise<any> {
    console.log("[Orchestrator] ========== Creating project from merged meta ==========");
    console.log("[Orchestrator] Meta summary:", {
      title: meta.title,
      charactersCount: meta.mainEntities?.length || 0,
      hasWorldSettings: !!meta.worldSettings,
      hasOutline: !!(meta.outline || (meta as any).overallOutline),
    });

    // Create project in database
    const [project] = await db.insert(projects).values({
      userId: userId,
      title: meta.title,
      description: meta.premise,
      genre: meta.genre || "通用",
      style: meta.style || "标准",
      targetWordCount: seed.targetWordCount || 100000,
      status: "planning",
    }).returning();

    console.log("[Orchestrator] ✓ Project created:", project.id);
    console.log("[Orchestrator] Starting to create related entities...");

    // 1. 创建角色（使用现有的角色系统）
    const nameToCharIdMap = new Map<string, string>();

    if (meta.mainEntities && meta.mainEntities.length > 0) {
      console.log(`[Orchestrator] Creating ${meta.mainEntities.length} characters`);

      // First pass: Create characters without relationships
      for (const entity of meta.mainEntities) {
        const entityAny = entity as any;
        console.log(`[Orchestrator] Creating character: ${entity.name} (${entity.role})`);

        // Map Chinese role to English enum
        let role = "supporting";
        const roleMap: Record<string, string> = {
          "主角": "protagonist",
          "配角": "supporting",
          "反派": "antagonist",
          "群像": "group"
        };

        if (entity.role && roleMap[entity.role]) {
          role = roleMap[entity.role];
        } else if (entity.role && ["protagonist", "supporting", "antagonist", "group"].includes(entity.role)) {
          role = entity.role;
        }

        const characterData = {
          projectId: project.id,
          name: entity.name,
          role: role,
          personality: entity.personality || "",
          background: entity.background || "",
          appearance: entity.appearance || "",
          abilities: entity.abilities || "",
          relationships: [], // Initialize empty, will update later
          notes: entityAny.innerConflict
            ? `分步创建生成\n\n内心冲突：${entityAny.innerConflict}\n隐藏目标：${entityAny.hiddenGoal || '未设置'}`
            : "分步创建生成",
          arcPoints: entityAny.arcPoints || [],
          currentEmotion: entityAny.currentEmotion || entityAny.initialEmotion,
          currentGoal: entityAny.currentGoal || entityAny.hiddenGoal || "",
          shortMotivation: entityAny.motivation || entity.motivation || "",
          growth: entityAny.growthPath || entityAny.growth || "",
          stateUpdatedAt: new Date(),
        };

        const createdChar = await storage.createCharacter(characterData);
        nameToCharIdMap.set(entity.name, createdChar.id);
        console.log(`[Orchestrator] ✓ Character created: ${entity.name} (${createdChar.id})`);
      }

      // Second pass: Process and update relationships
      if (meta.relationships && meta.relationships.length > 0) {
        console.log(`[Orchestrator] Processing ${meta.relationships.length} relationships`);

        // Group relationships by source character
        const relationshipsBySource = new Map<string, any[]>();

        for (const rel of meta.relationships) {
          const sourceId = nameToCharIdMap.get(rel.source);
          const targetId = nameToCharIdMap.get(rel.target);

          if (sourceId && targetId) {
            if (!relationshipsBySource.has(sourceId)) {
              relationshipsBySource.set(sourceId, []);
            }

            relationshipsBySource.get(sourceId)?.push({
              targetId: targetId,
              targetName: rel.target,
              type: rel.relation,
              description: rel.description
            });
          }
        }

        // Update characters with relationships
        for (const [charId, rels] of Array.from(relationshipsBySource)) {
          await storage.updateCharacter(charId, {
            relationships: rels
          });
          console.log(`[Orchestrator] Updated relationships for character ${charId}`);
        }
      }

      console.log(`[Orchestrator] ✓ All characters and relationships processed`);
    } else {
      console.log("[Orchestrator] ⚠ No characters to create");
    }

    // 2. 创建世界观设定（使用现有的世界观系统）
    if (meta.worldSettings) {
      console.log("[Orchestrator] Creating world settings");
      const worldSetting = meta.worldSettings;

      // 创建力量体系
      if (worldSetting.powerSystem) {
        await storage.createWorldSetting({
          projectId: project.id,
          category: "power_system",
          title: worldSetting.powerSystem.name || "力量体系",
          content: worldSetting.powerSystem.description || "",
          tags: meta.keywords || [],
          details: {
            levels: worldSetting.powerSystem.levels || [],
            cultivation: worldSetting.powerSystem.cultivation || "",
            limitations: worldSetting.powerSystem.limitations || [],
          },
        });
      }

      // 创建地理设定
      if (worldSetting.geography) {
        await storage.createWorldSetting({
          projectId: project.id,
          category: "geography",
          title: "地理设定",
          content: worldSetting.geography.climate || "",
          tags: meta.keywords || [],
          details: {
            regions: worldSetting.geography.regions || [],
            specialLocations: worldSetting.geography.specialLocations || [],
          },
        });
      }

      // 创建社会结构
      if (worldSetting.socialStructure) {
        await storage.createWorldSetting({
          projectId: project.id,
          category: "social",
          title: "社会结构",
          content: worldSetting.socialStructure.governance || "",
          tags: meta.keywords || [],
          details: {
            hierarchy: worldSetting.socialStructure.hierarchy || [],
            classes: worldSetting.socialStructure.classes || [],
          },
        });
      }

      // 创建势力
      if (worldSetting.factions && worldSetting.factions.length > 0) {
        for (const faction of worldSetting.factions) {
          await storage.createWorldSetting({
            projectId: project.id,
            category: "faction",
            title: faction.name,
            content: faction.description || "",
            tags: meta.keywords || [],
            details: {
              type: faction.type,
              goals: faction.goals || [],
              influence: faction.influence,
            },
          });
        }
      }

      // 创建规则
      if (worldSetting.rules && worldSetting.rules.length > 0) {
        for (const rule of worldSetting.rules) {
          await storage.createWorldSetting({
            projectId: project.id,
            category: "rules",
            title: rule.category || "世界规则",
            content: rule.content,
            tags: meta.keywords || [],
            details: {
              priority: rule.priority,
            },
          });
        }
      }

      // 创建物品
      if (worldSetting.items && worldSetting.items.length > 0) {
        for (const item of worldSetting.items) {
          await storage.createWorldSetting({
            projectId: project.id,
            category: "items",
            title: item.name,
            content: item.description || "",
            tags: meta.keywords || [],
            details: {
              type: item.type,
              significance: item.significance,
            },
          });
        }
      }
    }

    // 3. 创建大纲（使用现有的大纲系统）
    console.log("[Orchestrator] Creating outlines");

    // 构建总纲内容
    const metaAny = meta as any;
    let mainOutlineContent = meta.outline || metaAny.overallOutline || "";

    // 如果没有总纲内容，从各部分组合
    if (!mainOutlineContent && (meta.opening || meta.climax || meta.ending)) {
      const parts = [];
      if (meta.opening) parts.push(`【开篇】\n${meta.opening}`);
      if (meta.plotPoints && meta.plotPoints.length > 0) {
        parts.push(`【主要情节】\n${meta.plotPoints.map((p: any, i: number) => `${i + 1}. ${p.title || '情节点'}: ${p.description || ''}`).join('\n')}`);
      }
      if (meta.climax) parts.push(`【高潮】\n${meta.climax}`);
      if (meta.ending) parts.push(`【结局】\n${meta.ending}`);
      mainOutlineContent = parts.join('\n\n');
    }

    // 主大纲
    await db.insert(outlines).values({
      projectId: project.id,
      type: "main",
      title: "总纲",
      content: mainOutlineContent || "待完善",
      plotNodes: {
        themeTags: meta.themeTags || [],
        toneProfile: meta.toneProfile || "",
        coreConflicts: meta.coreConflicts || [],
        keywords: meta.keywords || [],
        opening: meta.opening || "",
        climax: meta.climax || "",
        ending: meta.ending || "",
        plotPoints: meta.plotPoints || [],
        estimatedChapters: meta.estimatedChapters || 50,
      },
    });

    console.log("[Orchestrator] ========== All data created successfully ==========");
    console.log("[Orchestrator] Project ID:", project.id);
    console.log("[Orchestrator] You can now view this project in the UI");

    return project;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get next step in the workflow
   */
  private getNextStep(currentStep: CreationStep): CreationStep {
    const stepOrder: CreationStep[] = ["basic", "characters", "world", "outline", "finalize"];
    const currentIndex = stepOrder.indexOf(currentStep);

    // If current step not found or already at finalize, stay at finalize
    if (currentIndex === -1) {
      return "basic"; // Start from beginning if invalid
    }

    if (currentIndex === stepOrder.length - 1) {
      return "finalize"; // Already at last step
    }

    return stepOrder[currentIndex + 1];
  }

  /**
   * Execute basic step (generate basic project info)
   */
  private async executeBasicStep(seed: ProjectSeed, userId?: string, options?: any): Promise<StepResult> {
    console.log("[Orchestrator] Executing basic step (Phase 1)");

    // Use EnhancedProjectCreationService to generate basic info + directives
    const enhancedData = await enhancedProjectCreationService.generateBasicInfo(seed, userId || "", {
      modelId: options?.modelId,
      temperature: options?.temperature
    });

    console.log("[Orchestrator] Basic step enhanced with AI");

    return {
      step: "basic",
      data: {
        title: enhancedData.title || seed.titleSeed,
        premise: enhancedData.premise || seed.premise,
        genre: enhancedData.genre || seed.genre || "通用",
        style: enhancedData.style || seed.style || "标准",
        themeTags: enhancedData.themeTags || [],
        coreConflicts: enhancedData.coreConflicts || [],
        toneProfile: enhancedData.toneProfile || "",
        keywords: enhancedData.keywords || [],
        // Include Directives
        worldDirective: enhancedData.worldDirective,
        characterDirective: enhancedData.characterDirective,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Execute characters step (generate characters)
   */
  private async executeCharactersStep(
    seed: ProjectSeed,
    session: Session,
    options?: any
  ): Promise<StepResult> {
    console.log("[Orchestrator] Executing characters step");

    try {
      // Get basic info from previous step
      const stepResults = session.stepResults as Record<CreationStep, StepResult>;
      const basicData = stepResults.basic?.data || {};

      // Build context
      const context = {
        title: basicData.title || seed.titleSeed,
        premise: basicData.premise || seed.premise,
        genre: basicData.genre || seed.genre,
        style: basicData.style || seed.style,
        themeTags: basicData.themeTags || [],
        coreConflicts: basicData.coreConflicts || [],
        characterDirective: basicData.characterDirective, // Pass directive
      };

      console.log("[Orchestrator] Character generation context:", context);

      // Generate characters (dynamic count based on complexity, default 4-6)
      // If options.characterCount is not provided, we default to a slightly larger number to ensure enough roles
      const characterCount = seed.targetCharacterCount || options?.characterCount || 5;
      const characters = await characterGenerator.generateCharacters(
        context,
        characterCount,
        session.userId || "",
        {
          temperature: options?.temperature,
          modelId: options?.modelId,
        }
      );

      console.log(`[Orchestrator] Generated ${characters.length} characters`);

      // Infer relationships between characters
      const relationshipGraph = await relationshipInferrer.inferRelationships(
        characters,
        context.coreConflicts || [],
        context,
        session.userId || ""
      );

      console.log(`[Orchestrator] Inferred ${relationshipGraph.edges.length} relationships`);

      // Validate relationships
      const validation = relationshipInferrer.validateRelationships(relationshipGraph);

      if (!validation.isValid) {
        console.warn("[Orchestrator] Relationship validation errors:", validation.errors);
      }

      if (validation.warnings.length > 0) {
        console.warn("[Orchestrator] Relationship validation warnings:", validation.warnings);
      }

      // Optimize relationships
      const optimizedGraph = relationshipInferrer.optimizeRelationships(relationshipGraph);

      const result: StepResult = {
        step: "characters" as CreationStep,
        data: {
          characters: optimizedGraph.nodes,
          relationships: optimizedGraph.edges,
          validation: {
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
          },
        },
        timestamp: new Date(),
      };

      console.log("[Orchestrator] Characters step result:", {
        characterCount: optimizedGraph.nodes.length,
        relationshipCount: optimizedGraph.edges.length,
        firstCharacter: optimizedGraph.nodes[0],
      });

      return result;
    } catch (error: any) {
      console.error("[Orchestrator] Error in characters step:", error);
      console.error("[Orchestrator] Error stack:", error.stack);
      throw error;
    }
  }

  /**
   * Execute world step (generate world settings)
   */
  private async executeWorldStep(
    seed: ProjectSeed,
    session: Session,
    options?: any
  ): Promise<StepResult> {
    console.log("[Orchestrator] Executing world step");

    // Get basic info and characters from previous steps
    const stepResults = session.stepResults as Record<CreationStep, StepResult>;
    const basicData = stepResults.basic?.data || {};
    const charactersData = stepResults.characters?.data || {};

    // Build context
    const context = {
      title: basicData.title || seed.titleSeed,
      premise: basicData.premise || seed.premise,
      genre: basicData.genre || seed.genre || "通用",
      style: basicData.style || seed.style,
      themeTags: basicData.themeTags || [],
      coreConflicts: basicData.coreConflicts || [],
      worldDirective: basicData.worldDirective, // Pass directive
      existingCharacters: charactersData.characters || [],
    };

    // Generate world setting
    const worldSetting = await worldGenerator.generateWorld(
      context.genre,
      context,
      session.userId || "",
      {
        temperature: options?.temperature,
        modelId: options?.modelId,
      }
    );

    console.log(`[Orchestrator] Generated world setting for ${worldSetting.genre}`);
    console.log("[Orchestrator] World setting details:", {
      genre: worldSetting.genre,
      hasPowerSystem: !!worldSetting.powerSystem,
      rulesCount: worldSetting.rules?.length || 0,
      factionsCount: worldSetting.factions?.length || 0,
      worldSetting: worldSetting,
    });

    // Validate world setting
    const validation = worldGenerator.validateWorld(worldSetting);

    if (!validation.isValid) {
      console.warn("[Orchestrator] World validation errors:", validation.errors);
    }

    if (validation.warnings.length > 0) {
      console.warn("[Orchestrator] World validation warnings:", validation.warnings);
    }

    const result: StepResult = {
      step: "world" as CreationStep,
      data: {
        worldSetting,
        validation: {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
        },
      },
      timestamp: new Date(),
    };

    console.log("[Orchestrator] World step result:", {
      step: result.step,
      dataKeys: Object.keys(result.data),
      worldSettingKeys: Object.keys(result.data.worldSetting || {}),
    });

    return result;
  }

  /**
   * Execute outline step (generate outline)
   */
  private async executeOutlineStep(
    seed: ProjectSeed,
    session: Session,
    options?: any
  ): Promise<StepResult> {
    console.log("[Orchestrator] Executing outline step");

    // Get all previous step results
    const stepResults = session.stepResults as Record<CreationStep, StepResult>;
    const basicData = stepResults.basic?.data || {};
    const charactersData = stepResults.characters?.data || {};
    const worldData = stepResults.world?.data || {};

    // Get AI model
    const models = await storage.getAIModels(session.userId || "system");
    let selectedModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    // If options.modelId is provided, try to find that specific model
    if (options?.modelId) {
      const specificModel = models.find(m => m.modelId === options.modelId);
      if (specificModel) {
        selectedModel = specificModel;
      }
    }

    if (!selectedModel) {
      throw new Error("No suitable chat model configured");
    }

    // Build comprehensive context
    const characters = charactersData.characters || [];
    const worldSetting = worldData.worldSetting;
    const genre = basicData.genre || seed.genre || "通用";
    const genreInstructions = genreConfigService.getGenreSpecificInstructions(genre);
    const genreDescription = genreConfigService.getGenreDescription(genre);

    // Build prompt for outline generation
    const prompt = `你是一位资深的小说大纲设计专家，擅长创作${genreDescription}。请基于以下完整的项目信息，生成详细的故事大纲。

# 基础信息
标题：${basicData.title || seed.titleSeed}
简介：${basicData.premise || seed.premise || ""}
类型：${genre}
风格：${basicData.style || seed.style || "标准"}
主题：${basicData.themeTags?.join("、") || ""}
核心冲突：
${basicData.coreConflicts?.map((c: string, i: number) => `${i + 1}. ${c}`).join("\n") || ""}

# 角色信息
${characters.map((c: any, i: number) => `
${i + 1}. ${c.name}（${c.role}）
 - 动机：${c.motivation}
 - 内心冲突：${c.innerConflict}
 - 成长路径：${c.growthPath}
`).join("\n")}

# 世界观设定
${worldSetting ? `
类型：${worldSetting.genre}
${worldSetting.powerSystem ? `力量体系：${worldSetting.powerSystem.name}` : ""}
${worldSetting.factions ? `主要势力：${worldSetting.factions.map((f: any) => f.name).join("、")}` : ""}
核心规则：
${worldSetting.rules?.map((r: any, i: number) => `${i + 1}. ${r.content}`).join("\n") || ""}
` : ""}

# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤推演：
1. **结构规划**: 根据${genre}类型的节奏特点，规划起承转合的比例。
2. **冲突编织**: 将核心冲突（${basicData.coreConflicts?.[0] || "主要冲突"}）拆解为具体的事件链。
3. **角色弧光**: 确保主要情节点能推动主角（${characters[0]?.name || "主角"}）的内心成长。
4. **高潮设计**: 设计一个既符合逻辑又意料之外的高潮场景。

# 任务
请生成一个完整的故事大纲，包括：
1. 总纲（整体故事走向，300-500字）
2. 开篇设定（如何开始，100-200字）
3. 主要情节线（5-8个关键情节点，覆盖起承转合）
4. 高潮设计（故事高潮如何展开，200-300字）
5. 结局方向（故事如何收尾，100-200字）
6. 预估章节数（根据故事体量合理评估）

${genreInstructions ? `# 类型特定要求\n${genreInstructions}\n` : ""}

# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON格式。**
**JSON内容必须使用纯正中文，字段名使用英文。**

请严格按照以下JSON格式输出：

{
"overallOutline": "总纲描述（300-500字）",
"opening": "开篇设定（100-200字）",
"plotPoints": [
  {
    "sequence": 1,
    "title": "情节点标题",
    "description": "情节点描述（100-200字）",
    "involvedCharacters": ["角色名1", "角色名2"]
  }
],
"climax": "高潮设计（200-300字）",
"ending": "结局方向（100-200字）",
"estimatedChapters": 50
}

**重要**：
1. 所有内容使用中文
2. 情节点要与角色成长路径和核心冲突紧密结合
3. 确保故事有清晰的起承转合（开端、发展、高潮、结局）
4. 高潮要有足够的张力和冲突
5. 结局要呼应开篇和主题
6. **involvedCharacters字段必须是字符串数组**`;

    // Generate outline with retry
    const maxRetries = 3;
    let lastError: Error | null = null;
    let outlineData: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Orchestrator] Retry attempt ${attempt}/${maxRetries} for outline generation`);
        }

        const result = await aiService.generate({
          prompt,
          modelId: selectedModel.modelId,
          provider: selectedModel.provider,
          baseUrl: selectedModel.baseUrl || "",
          apiKey: selectedModel.apiKey || undefined,
          parameters: {
            temperature: options?.temperature || 0.7,
            maxTokens: options?.maxTokens || 4000,
          },
          responseFormat: "json",
        });

        // Parse result
        try {
          outlineData = extractJSON(result.content);
          break; // Success
        } catch (parseError: any) {
          console.error("[Orchestrator] Outline JSON parse error:", parseError.message);
          // Try to fix common issues
          try {
            let fixed = result.content.replace(/,(\s*[}\]])/g, '$1');
            fixed = fixed.replace(/(\w+):/g, '"$1":');
            outlineData = extractJSON(fixed);
            break; // Success after fix
          } catch (fixError) {
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
        }
      } catch (error: any) {
        console.error(`[Orchestrator] Error in outline attempt ${attempt}:`, error.message);
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!outlineData) {
      throw lastError || new Error("Failed to generate outline after multiple retries");
    }

    console.log("[Orchestrator] Outline generated successfully");

    return {
      step: "outline",
      data: {
        overallOutline: outlineData.overallOutline || "",
        opening: outlineData.opening || "",
        plotPoints: outlineData.plotPoints || [],
        climax: outlineData.climax || "",
        ending: outlineData.ending || "",
        estimatedChapters: outlineData.estimatedChapters || 50,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Execute finalize step (prepare for project creation)
   */
  private async executeFinalizeStep(
    seed: ProjectSeed,
    session: Session,
    options?: any
  ): Promise<StepResult> {
    console.log("[Orchestrator] Executing finalize step");

    return {
      step: "finalize",
      data: {
        ready: true,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Merge step results into final ProjectMeta
   */
  private mergeStepResults(stepResults: Record<CreationStep, StepResult>): ProjectMeta {
    console.log("[Orchestrator] Merging step results into final ProjectMeta");
    console.log("[Orchestrator] Available steps:", Object.keys(stepResults).filter(k => stepResults[k as CreationStep]));

    const basicData = stepResults.basic?.data || {};
    const charactersData = stepResults.characters?.data || {};
    const worldData = stepResults.world?.data || {};
    const outlineData = stepResults.outline?.data || {};

    console.log("[Orchestrator] Characters data keys:", Object.keys(charactersData));
    console.log("[Orchestrator] Characters array:", charactersData.characters?.length || 0);
    console.log("[Orchestrator] World data keys:", Object.keys(worldData));
    console.log("[Orchestrator] Outline data keys:", Object.keys(outlineData));

    // Extract world rules from world setting
    const worldSetting = worldData.worldSetting;
    const worldRules: any[] = [];

    if (worldSetting && worldSetting.rules) {
      for (const rule of worldSetting.rules) {
        worldRules.push({
          category: rule.category,
          content: rule.content,
          priority: rule.priority,
        });
      }
    }

    // 转换角色数据：Character -> EntitySummary
    const characters = charactersData.characters || [];
    const uniqueNames = new Set<string>();
    const mainEntities: any[] = [];

    for (const char of characters) {
      let name = char.name;

      // Deduplication check
      if (uniqueNames.has(name)) {
        console.warn(`[Orchestrator] Found duplicate character name in merge: ${name}`);
        let counter = 2;
        while (uniqueNames.has(`${name} (${counter})`)) {
          counter++;
        }
        name = `${name} (${counter})`;
      }
      uniqueNames.add(name);

      mainEntities.push({
        name: name, // Use potentially renamed name
        role: char.role,
        shortMotivation: char.motivation || char.shortMotivation || "",
        personality: char.personality || "",
        appearance: char.appearance || "",
        background: char.background || "",
        abilities: char.abilities || "",
        // 保留扩展字段
        motivation: char.motivation,
        innerConflict: char.innerConflict,
        hiddenGoal: char.hiddenGoal,
        growthPath: char.growthPath,
      });
    }

    // Build comprehensive ProjectMeta
    const projectMeta: ProjectMeta = {
      // Basic information
      title: basicData.title || "Untitled",
      premise: basicData.premise || "",
      genre: basicData.genre || "",
      style: basicData.style || "",

      // Enhanced basic data
      themeTags: basicData.themeTags || [],
      toneProfile: basicData.toneProfile || "",
      coreConflicts: basicData.coreConflicts || [],
      keywords: basicData.keywords || [],

      // Characters (已转换)
      mainEntities: mainEntities,

      // World setting
      worldRules: worldRules,
      worldSettings: worldSetting,

      // Outline (store as metadata)
      outline: outlineData.overallOutline || "",
      plotPoints: outlineData.plotPoints || [],
      opening: outlineData.opening || "",
      climax: outlineData.climax || "",
      ending: outlineData.ending || "",
      estimatedChapters: outlineData.estimatedChapters || 50,

      // Relationships (if available)
      relationships: charactersData.relationships || [],
    };

    console.log("[Orchestrator] Merged ProjectMeta:", {
      title: projectMeta.title,
      charactersCount: projectMeta.mainEntities?.length || 0,
      worldRulesCount: projectMeta.worldRules?.length || 0,
      hasOutline: !!projectMeta.outline,
      plotPointsCount: projectMeta.plotPoints?.length || 0,
    });

    return projectMeta;
  }

  /**
   * Create project with full service integration
   * Includes history tracking, quality scoring, and error recovery
   */
  async createProjectWithIntegration(
    seed: ProjectSeed,
    userId?: string,
    onProgress?: (step: string, progress: number, message: string) => void
  ): Promise<CreationResult> {
    console.log("[Orchestrator] Creating project with full integration");

    let sessionId: SessionId | undefined;

    try {
      // Create session for tracking
      const session = await sessionManager.createSession(seed, "quick", userId);
      sessionId = session.id;

      onProgress?.("init", 5, "初始化创建流程");

      // Get personalized parameters if user exists
      let personalizedParams;
      if (userId) {
        onProgress?.("personalize", 10, "获取个性化参数");
        personalizedParams = await feedbackLearningService.getPersonalizedParameters(userId);
        console.log("[Orchestrator] Using personalized parameters:", personalizedParams);
      }

      // Create project with retry mechanism
      onProgress?.("generate", 20, "生成项目内容");
      const result = await retryWithBackoff(async () => {
        return await enhancedProjectCreationService.createProjectFromSeed(
          seed,
          userId || "system",
          (step, status, message, progress) => {
            onProgress?.(step, 20 + progress * 0.6, message);
          }
        );
      });

      onProgress?.("evaluate", 85, "评估质量和创新性");

      // Score quality and innovation
      const qualityScore = await qualityScorer.scoreCandidate(result.projectMeta as any, seed as any, userId || "system");
      const innovationScore = innovationEvaluator.evaluateInnovation(result.projectMeta as any);

      console.log("[Orchestrator] Quality score:", qualityScore.overall);
      console.log("[Orchestrator] Innovation score:", innovationScore.overall);

      // Quality control: Check if score is below threshold
      const QUALITY_THRESHOLD = 60;
      const INNOVATION_THRESHOLD = 40;

      if (qualityScore.overall < QUALITY_THRESHOLD || innovationScore.overall < INNOVATION_THRESHOLD) {
        console.warn("[Orchestrator] Quality/Innovation below threshold");
        console.warn("[Orchestrator] Quality issues:", qualityScore.issues);
        console.warn("[Orchestrator] Innovation cliches:", innovationScore.cliches);

        // For quick creation, we could auto-regenerate, but that might waste tokens
        // Instead, we'll include the issues in the result and let user decide
        // In a production system, you might want to:
        // 1. Auto-regenerate once with adjusted parameters
        // 2. Prompt user to adjust input
        // 3. Use candidate merger to combine multiple attempts
      }

      // Record to history
      onProgress?.("history", 90, "记录创建历史");
      await historyService.recordCandidate(
        sessionId,
        result.projectMeta,
        {
          quality: qualityScore as any,
          innovation: innovationScore as any,
        },
        {
          modelUsed: "default",
          tokensUsed: result.executionLogs.reduce((sum, log) => sum + log.tokensUsed, 0),
          generationTime: 0,
        }
      );

      // Record AI call logs
      for (const log of result.executionLogs) {
        await historyService.recordAICall(sessionId, {
          timestamp: log.timestamp,
          modelUsed: log.modelId,
          operation: log.templateId,
          parameters: log.params,
          tokensUsed: log.tokensUsed,
          generationTime: 0,
          success: true,
        });
      }

      // Complete session
      await sessionManager.completeSession(sessionId);

      onProgress?.("complete", 100, "创建完成");

      return {
        ...result,
        qualityScore,
        innovationScore,
      } as any;
    } catch (error: any) {
      console.error("[Orchestrator] Error creating project:", error);

      // Save failure state
      if (sessionId) {
        await errorRecoveryService.saveFailureState(sessionId, error, { seed });
      }

      throw error;
    }
  }





  /**
   * Recover from failed creation
   */
  async recoverFailedCreation(sessionId: SessionId): Promise<void> {
    console.log(`[Orchestrator] Recovering failed creation: ${sessionId} `);

    try {
      // Check for data inconsistency
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId} `);
      }

      const isInconsistent = await errorRecoveryService.detectDataInconsistency(
        session.stepResults
      );

      if (isInconsistent) {
        console.log("[Orchestrator] Data inconsistency detected, rolling back");
        await errorRecoveryService.rollbackToConsistentState(sessionId);
      }

      // Resume session
      await sessionManager.resumeSession(sessionId);

      console.log("[Orchestrator] Recovery completed");
    } catch (error) {
      console.error("[Orchestrator] Error recovering creation:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const creationOrchestrator = new CreationOrchestrator();
