// Model Routing Service - Automatic Model Selection
// Implements the model routing algorithm from the design document

import { storage } from "./storage";
import type { AIModel } from "@shared/schema";

// Intent classification for different generation tasks
export enum Intent {
  FINAL_PROSE = 'final_prose',       // Final polished content
  LOGIC_DECISION = 'logic_decision',  // Plot/logic decisions
  DRAFT = 'draft',                    // Draft/outline generation
  GHOST_TEXT = 'ghost_text',          // Ghost text suggestions
  COMPLIANCE = 'compliance',          // Compliance checking
  EMBEDDING = 'embedding',            // Vector embedding
  SUMMARIZE = 'summarize',            // Summarization
  POLISH = 'polish',                  // Text polishing
  EXPAND = 'expand',                  // Content expansion
  DIAGNOSE = 'diagnose',              // Narrative diagnosis
}

// Model tier classification
export enum ModelTier {
  QUALITY = 'tier-a',      // High quality (GPT-4, Claude Opus)
  COST = 'tier-b',         // Cost-effective (GPT-3.5, Claude Haiku)
  SPECIALIZED = 'tier-c',   // Specialized tasks (embedding, compliance)
}

export interface ModelRoutingSignals {
  draftConfidence: number; // 0-1, higher = more confident
  conflictDensity: number; // conflicts per 1k tokens
  templateComplexity: number; // 0-1, higher = more complex
  budgetFactor: number; // 0-1, higher = more budget available
}

export interface ModelRoutingDecision {
  strategy: "small" | "small-with-fallback" | "big";
  primaryModel: string; // Model ID instead of full object
  fallbackModel?: string;
  reasoning: string;
  confidence: number;
  routingScore: number;
  topFeatures?: string[];
  tier?: ModelTier;
  intent?: Intent;
}

export class ModelRoutingService {
  // Thresholds from design document
  private readonly MID_THRESHOLD = 0.35;
  private readonly HIGH_THRESHOLD = 0.65;

  // Weights from design document
  private readonly WEIGHTS = {
    confidence: 0.45,
    conflict: 0.30,
    complexity: 0.15,
    budget: -0.10, // Negative because higher budget = prefer cheaper model
  };

  // Intent to Tier mapping
  private readonly INTENT_TO_TIER: Record<Intent, ModelTier> = {
    [Intent.FINAL_PROSE]: ModelTier.QUALITY,
    [Intent.LOGIC_DECISION]: ModelTier.QUALITY,
    [Intent.POLISH]: ModelTier.QUALITY,
    [Intent.DIAGNOSE]: ModelTier.QUALITY, // Diagnosis needs high reasoning
    [Intent.DRAFT]: ModelTier.COST,
    [Intent.GHOST_TEXT]: ModelTier.COST,
    [Intent.SUMMARIZE]: ModelTier.COST,
    [Intent.EXPAND]: ModelTier.COST,
    [Intent.COMPLIANCE]: ModelTier.SPECIALIZED,
    [Intent.EMBEDDING]: ModelTier.SPECIALIZED,
  };

  /**
   * Calculate routing score
   * Formula: score = 0.45*(1-confidence) + 0.30*conflict + 0.15*complexity - 0.10*budget
   */
  calculateScore(signals: ModelRoutingSignals): number {
    return (
      this.WEIGHTS.confidence * (1 - signals.draftConfidence) +
      this.WEIGHTS.conflict * signals.conflictDensity +
      this.WEIGHTS.complexity * signals.templateComplexity +
      this.WEIGHTS.budget * signals.budgetFactor
    );
  }

  /**
   * Route to appropriate model based on signals
   * Implements the routing algorithm from design document
   */
  async routeModel(signals: ModelRoutingSignals): Promise<ModelRoutingDecision> {
    // Calculate routing score
    const score = this.calculateScore(signals);

    // Identify top contributing features
    const features = this.identifyTopFeatures(signals);

    // Get available models
    const models = await storage.getAIModels();
    const chatModels = models.filter(
      (m) => m.modelType === "chat" && m.isActive
    );

    if (chatModels.length === 0) {
      throw new Error("没有可用的对话模型");
    }

    // Categorize models by capability (heuristic based on provider/name)
    const bigModels = this.categorizeBigModels(chatModels);
    const smallModels = this.categorizeSmallModels(chatModels);

    // Route based on score
    if (score <= this.MID_THRESHOLD) {
      // Low complexity - use small model
      const primaryModel = this.selectBestModel(smallModels, chatModels);
      return {
        strategy: "small",
        primaryModel: primaryModel.id,
        reasoning: `评分 ${score.toFixed(2)} ≤ ${this.MID_THRESHOLD}，任务简单，使用小模型节省成本`,
        confidence: 1 - score / this.MID_THRESHOLD,
        routingScore: score,
        topFeatures: features,
      };
    } else if (score <= this.HIGH_THRESHOLD) {
      // Medium complexity - use small with fallback
      const primaryModel = this.selectBestModel(smallModels, chatModels);
      const fallbackModel = this.selectBestModel(bigModels, chatModels);
      return {
        strategy: "small-with-fallback",
        primaryModel: primaryModel.id,
        fallbackModel: fallbackModel.id,
        reasoning: `评分 ${score.toFixed(2)} 在中等范围，先尝试小模型，失败则升级到大模型`,
        confidence: 0.5,
        routingScore: score,
        topFeatures: features,
      };
    } else {
      // High complexity - use big model
      const primaryModel = this.selectBestModel(bigModels, chatModels);
      return {
        strategy: "big",
        primaryModel: primaryModel.id,
        reasoning: `评分 ${score.toFixed(2)} > ${this.HIGH_THRESHOLD}，任务复杂，直接使用大模型保证质量`,
        confidence: (score - this.HIGH_THRESHOLD) / (1 - this.HIGH_THRESHOLD),
        routingScore: score,
        topFeatures: features,
      };
    }
  }

  /**
   * Route model based on intent (new method for P0 implementation)
   */
  async routeByIntent(params: {
    intent: Intent;
    projectId: string;
    complexity?: number;
  }): Promise<ModelRoutingDecision> {
    // Determine tier based on intent
    const tier = this.INTENT_TO_TIER[params.intent];

    // Get all active chat models
    const models = await storage.getAIModels();
    const chatModels = models.filter(
      (m) => m.modelType === "chat" && m.isActive
    );

    if (chatModels.length === 0) {
      throw new Error("没有可用的对话模型");
    }

    // Get models for the determined tier
    let primaryModel: AIModel;
    let fallbackModel: AIModel | undefined;

    if (tier === ModelTier.QUALITY) {
      const bigModels = this.categorizeBigModels(chatModels);
      primaryModel = this.selectBestModel(bigModels, chatModels);
      fallbackModel = bigModels.length > 1 ? bigModels[1] : undefined;
    } else if (tier === ModelTier.COST) {
      const smallModels = this.categorizeSmallModels(chatModels);
      primaryModel = this.selectBestModel(smallModels, chatModels);
      const bigModels = this.categorizeBigModels(chatModels);
      fallbackModel = this.selectBestModel(bigModels, chatModels);
    } else {
      // SPECIALIZED - for now use small models
      const smallModels = this.categorizeSmallModels(chatModels);
      primaryModel = this.selectBestModel(smallModels, chatModels);
    }

    return {
      strategy: tier === ModelTier.QUALITY ? "big" : "small-with-fallback",
      primaryModel: primaryModel.id,
      fallbackModel: fallbackModel?.id,
      reasoning: `Intent: ${params.intent}, Tier: ${tier}`,
      confidence: 0.8,
      routingScore: params.complexity || 0.5,
      tier,
      intent: params.intent,
    };
  }

  /**
   * Record routing decision to generation log
   */
  async recordDecision(
    executionId: string,
    decision: ModelRoutingDecision
  ): Promise<void> {
    try {
      // This will be stored in generation_logs table
      // For now, just log it
      console.log(
        `[Routing] Recorded decision for ${executionId}: ${decision.strategy} (score: ${decision.routingScore.toFixed(3)})`
      );
    } catch (error) {
      console.error("[Routing] Failed to record decision:", error);
    }
  }

  /**
   * Get routing statistics
   */
  async getRoutingStats(): Promise<{
    totalDecisions: number;
    strategyBreakdown: Record<string, number>;
    avgScore: number;
    avgConfidence: number;
  }> {
    // This would query generation_logs table
    // For now, return placeholder
    return {
      totalDecisions: 0,
      strategyBreakdown: {
        small: 0,
        "small-with-fallback": 0,
        big: 0,
      },
      avgScore: 0,
      avgConfidence: 0,
    };
  }

  /**
   * Identify top contributing features to routing score
   */
  private identifyTopFeatures(signals: ModelRoutingSignals): string[] {
    const contributions = [
      {
        name: "低置信度",
        value: this.WEIGHTS.confidence * (1 - signals.draftConfidence),
      },
      {
        name: "冲突密度",
        value: this.WEIGHTS.conflict * signals.conflictDensity,
      },
      {
        name: "模板复杂度",
        value: this.WEIGHTS.complexity * signals.templateComplexity,
      },
      {
        name: "预算因素",
        value: Math.abs(this.WEIGHTS.budget * signals.budgetFactor),
      },
    ];

    return contributions
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((c) => c.name);
  }

  /**
   * Calculate signals for project creation task
   */
  calculateProjectCreationSignals(
    hasPremise: boolean,
    hasGenre: boolean,
    seedComplexity: number // 0-1
  ): ModelRoutingSignals {
    // Project creation is relatively straightforward
    const baseConfidence = 0.6;
    const confidenceBoost = (hasPremise ? 0.1 : 0) + (hasGenre ? 0.1 : 0);

    return {
      draftConfidence: Math.min(baseConfidence + confidenceBoost, 0.9),
      conflictDensity: 0.1, // Low conflict for initial generation
      templateComplexity: seedComplexity,
      budgetFactor: 0.7, // Moderate budget for project creation
    };
  }

  /**
   * Categorize big models (high capability)
   */
  private categorizeBigModels(models: AIModel[]): AIModel[] {
    return models.filter((m) => {
      const id = m.modelId.toLowerCase();
      const provider = m.provider.toLowerCase();

      // GPT-4 series
      if (id.includes("gpt-4") || id.includes("gpt-5")) return true;

      // Claude 3 Opus/Sonnet
      if (id.includes("claude-3-opus") || id.includes("claude-3-sonnet"))
        return true;

      // DeepSeek V3
      if (provider === "deepseek" && id.includes("v3")) return true;

      // GLM-4 Plus
      if (id.includes("glm-4-plus") || id.includes("glm-4-0520")) return true;

      return false;
    });
  }

  /**
   * Categorize small models (efficient)
   */
  private categorizeSmallModels(models: AIModel[]): AIModel[] {
    return models.filter((m) => {
      const id = m.modelId.toLowerCase();
      const provider = m.provider.toLowerCase();

      // GPT-3.5 series
      if (id.includes("gpt-3.5")) return true;

      // Claude 3 Haiku
      if (id.includes("claude-3-haiku")) return true;

      // DeepSeek Chat (non-V3)
      if (provider === "deepseek" && !id.includes("v3")) return true;

      // GLM-4 Flash
      if (id.includes("glm-4-flash") || id.includes("glm-4-air")) return true;

      // Qwen series
      if (provider === "qwen") return true;

      return false;
    });
  }

  /**
   * Select best model from list
   */
  private selectBestModel(
    preferredModels: AIModel[],
    allModels: AIModel[]
  ): AIModel {
    // Prefer default model if in preferred list
    const defaultModel = preferredModels.find((m) => m.isDefaultChat);
    if (defaultModel) return defaultModel;

    // Otherwise use first preferred model
    if (preferredModels.length > 0) return preferredModels[0];

    // Fallback to any default model
    const anyDefault = allModels.find((m) => m.isDefaultChat);
    if (anyDefault) return anyDefault;

    // Last resort: first available model
    return allModels[0];
  }
}

export const modelRoutingService = new ModelRoutingService();
