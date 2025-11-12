// Model Routing Service - Automatic Model Selection
// Implements the model routing algorithm from the design document

import { storage } from "./storage";
import type { AIModel } from "@shared/schema";

export interface ModelRoutingSignals {
  draftConfidence: number; // 0-1, higher = more confident
  conflictDensity: number; // conflicts per 1k tokens
  templateComplexity: number; // 0-1, higher = more complex
  budgetFactor: number; // 0-1, higher = more budget available
}

export interface ModelRoutingDecision {
  strategy: "small" | "small-with-fallback" | "big";
  primaryModel: AIModel;
  fallbackModel?: AIModel;
  reasoning: string;
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

  /**
   * Route to appropriate model based on signals
   * Implements the routing algorithm from design document:
   * score = 0.45*(1-confidence) + 0.30*conflict + 0.15*complexity - 0.10*budget
   */
  async routeModel(signals: ModelRoutingSignals): Promise<ModelRoutingDecision> {
    // Calculate routing score
    const score =
      this.WEIGHTS.confidence * (1 - signals.draftConfidence) +
      this.WEIGHTS.conflict * signals.conflictDensity +
      this.WEIGHTS.complexity * signals.templateComplexity +
      this.WEIGHTS.budget * signals.budgetFactor;

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
        primaryModel,
        reasoning: `评分 ${score.toFixed(2)} ≤ ${this.MID_THRESHOLD}，任务简单，使用小模型节省成本`,
      };
    } else if (score <= this.HIGH_THRESHOLD) {
      // Medium complexity - use small with fallback
      const primaryModel = this.selectBestModel(smallModels, chatModels);
      const fallbackModel = this.selectBestModel(bigModels, chatModels);
      return {
        strategy: "small-with-fallback",
        primaryModel,
        fallbackModel,
        reasoning: `评分 ${score.toFixed(2)} 在中等范围，先尝试小模型，失败则升级到大模型`,
      };
    } else {
      // High complexity - use big model
      const primaryModel = this.selectBestModel(bigModels, chatModels);
      return {
        strategy: "big",
        primaryModel,
        reasoning: `评分 ${score.toFixed(2)} > ${this.HIGH_THRESHOLD}，任务复杂，直接使用大模型保证质量`,
      };
    }
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
