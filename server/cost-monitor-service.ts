// Cost Monitor Service
// Real-time cost monitoring and dynamic optimization

import { generationLogService } from "./generation-log-service";
import { storage } from "./storage";

export interface CostStats {
  totalTokens: number;
  totalCost: number;
  costPerProject: Record<string, number>;
  costPerChapter: Record<string, number>;
  cacheHitRate: number;
  costSavings: number;
  modelUsageDistribution: Record<string, number>;
  averageCostPerGeneration: number;
  costPer1kWords: number;
}

export interface CostAlert {
  type: "budget_exceeded" | "high_cost_rate" | "cache_miss_rate";
  severity: "warning" | "critical";
  message: string;
  threshold: number;
  current: number;
}

export interface ModelAdjustment {
  currentModel: string;
  suggestedModel: string;
  reason: string;
  estimatedSavings: number;
}

export interface BudgetConfig {
  projectId: string;
  dailyBudget?: number;
  monthlyBudget?: number;
  costPerGenerationLimit?: number;
  cacheHitRateThreshold?: number;
}

export class CostMonitorService {
  private budgetConfigs: Map<string, BudgetConfig> = new Map();
  private readonly DEFAULT_CACHE_HIT_THRESHOLD = 0.2; // 20%
  private readonly DEFAULT_COST_PER_GEN_LIMIT = 0.1; // $0.10
  private readonly COST_PER_1K_TOKENS = 0.002; // Approximate cost

  /**
   * Record token usage and cost for an execution
   * This is typically called automatically by generation services
   */
  async recordUsage(
    executionId: string,
    tokensUsed: number,
    modelId: string
  ): Promise<void> {
    try {
      // Cost is already recorded in generation log
      // This method is for additional tracking if needed
      console.log(
        `[CostMonitor] Recorded usage: ${tokensUsed} tokens for ${modelId}`
      );
    } catch (error) {
      console.error("[CostMonitor] Failed to record usage:", error);
    }
  }

  /**
   * Get comprehensive cost statistics
   */
  async getCostStats(
    projectId?: string,
    dateRange?: [Date, Date]
  ): Promise<CostStats> {
    try {
      const filters: any = {};
      if (projectId) filters.projectId = projectId;
      if (dateRange) filters.dateRange = dateRange;

      const logs = await generationLogService.queryLogs(filters);

      if (logs.length === 0) {
        return this.getEmptyCostStats();
      }

      // Calculate total tokens and cost
      const totalTokens = logs.reduce((sum, log) => sum + log.tokensUsed, 0);
      const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);

      // Cost per project
      const costPerProject: Record<string, number> = {};
      logs.forEach((log) => {
        if (log.projectId) {
          costPerProject[log.projectId] =
            (costPerProject[log.projectId] || 0) + (log.cost || 0);
        }
      });

      // Cost per chapter
      const costPerChapter: Record<string, number> = {};
      logs.forEach((log) => {
        if (log.chapterId) {
          costPerChapter[log.chapterId] =
            (costPerChapter[log.chapterId] || 0) + (log.cost || 0);
        }
      });

      // Cache hit rate
      const cacheHits = logs.filter((log) => log.cachePath !== null).length;
      const cacheHitRate = logs.length > 0 ? cacheHits / logs.length : 0;

      // Calculate cost savings from cache
      const cacheMisses = logs.length - cacheHits;
      const avgCostPerGeneration = totalCost / Math.max(logs.length, 1);
      const costSavings = cacheHits * avgCostPerGeneration;

      // Model usage distribution
      const modelUsageDistribution: Record<string, number> = {};
      logs.forEach((log) => {
        modelUsageDistribution[log.modelId] =
          (modelUsageDistribution[log.modelId] || 0) + 1;
      });

      // Calculate cost per 1k words
      const totalWords = await this.calculateTotalWords(logs);
      const costPer1kWords =
        totalWords > 0 ? (totalCost / totalWords) * 1000 : 0;

      console.log(
        `[CostMonitor] Stats: ${logs.length} generations, ` +
          `${totalTokens} tokens, $${totalCost.toFixed(4)}, ` +
          `cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%, ` +
          `savings: $${costSavings.toFixed(4)}`
      );

      return {
        totalTokens,
        totalCost,
        costPerProject,
        costPerChapter,
        cacheHitRate,
        costSavings,
        modelUsageDistribution,
        averageCostPerGeneration: avgCostPerGeneration,
        costPer1kWords,
      };
    } catch (error) {
      console.error("[CostMonitor] Failed to get cost stats:", error);
      return this.getEmptyCostStats();
    }
  }

  /**
   * Check for budget alerts
   */
  async checkAlerts(projectId: string): Promise<CostAlert[]> {
    const alerts: CostAlert[] = [];

    try {
      const config = this.budgetConfigs.get(projectId) || {
        projectId,
        cacheHitRateThreshold: this.DEFAULT_CACHE_HIT_THRESHOLD,
        costPerGenerationLimit: this.DEFAULT_COST_PER_GEN_LIMIT,
      };

      // Get today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const dailyStats = await this.getCostStats(projectId, [today, tomorrow]);

      // Check daily budget
      if (config.dailyBudget && dailyStats.totalCost > config.dailyBudget) {
        alerts.push({
          type: "budget_exceeded",
          severity: "critical",
          message: `Daily budget exceeded: $${dailyStats.totalCost.toFixed(4)} / $${config.dailyBudget.toFixed(2)}`,
          threshold: config.dailyBudget,
          current: dailyStats.totalCost,
        });
      } else if (
        config.dailyBudget &&
        dailyStats.totalCost > config.dailyBudget * 0.8
      ) {
        alerts.push({
          type: "budget_exceeded",
          severity: "warning",
          message: `Approaching daily budget limit: $${dailyStats.totalCost.toFixed(4)} / $${config.dailyBudget.toFixed(2)}`,
          threshold: config.dailyBudget,
          current: dailyStats.totalCost,
        });
      }

      // Check cost per generation
      if (
        config.costPerGenerationLimit &&
        dailyStats.averageCostPerGeneration > config.costPerGenerationLimit
      ) {
        alerts.push({
          type: "high_cost_rate",
          severity: "warning",
          message: `High cost per generation: $${dailyStats.averageCostPerGeneration.toFixed(4)} (limit: $${config.costPerGenerationLimit.toFixed(4)})`,
          threshold: config.costPerGenerationLimit,
          current: dailyStats.averageCostPerGeneration,
        });
      }

      // Check cache hit rate
      if (
        config.cacheHitRateThreshold &&
        dailyStats.cacheHitRate < config.cacheHitRateThreshold
      ) {
        alerts.push({
          type: "cache_miss_rate",
          severity: "warning",
          message: `Low cache hit rate: ${(dailyStats.cacheHitRate * 100).toFixed(1)}% (threshold: ${(config.cacheHitRateThreshold * 100).toFixed(1)}%)`,
          threshold: config.cacheHitRateThreshold,
          current: dailyStats.cacheHitRate,
        });
      }

      if (alerts.length > 0) {
        console.log(`[CostMonitor] ${alerts.length} alerts for project ${projectId}`);
      }
    } catch (error) {
      console.error("[CostMonitor] Failed to check alerts:", error);
    }

    return alerts;
  }

  /**
   * Calculate cost per 1k words
   */
  async getCostPer1kWords(projectId: string): Promise<number> {
    const stats = await this.getCostStats(projectId);
    return stats.costPer1kWords;
  }

  /**
   * Optimize cache thresholds based on performance data
   */
  async optimizeCacheThresholds(): Promise<void> {
    try {
      // Get all projects
      const projects = await storage.getProjects();

      for (const project of projects) {
        const stats = await this.getCostStats(project.id);

        // If cache hit rate is low, suggest lowering quality threshold
        if (stats.cacheHitRate < 0.15) {
          console.log(
            `[CostMonitor] Project ${project.id}: Low cache hit rate (${(stats.cacheHitRate * 100).toFixed(1)}%). ` +
              `Consider lowering quality threshold from 70 to 65.`
          );
        }

        // If cache hit rate is very high, suggest raising quality threshold
        if (stats.cacheHitRate > 0.5) {
          console.log(
            `[CostMonitor] Project ${project.id}: High cache hit rate (${(stats.cacheHitRate * 100).toFixed(1)}%). ` +
              `Consider raising quality threshold from 70 to 75 for better quality.`
          );
        }
      }
    } catch (error) {
      console.error("[CostMonitor] Failed to optimize cache thresholds:", error);
    }
  }

  /**
   * Suggest model adjustments to reduce costs
   */
  async suggestModelAdjustments(
    projectId: string
  ): Promise<ModelAdjustment[]> {
    const adjustments: ModelAdjustment[] = [];

    try {
      const stats = await this.getCostStats(projectId);
      const models = await storage.getAIModels();

      // Analyze model usage and costs
      for (const [modelId, usageCount] of Object.entries(
        stats.modelUsageDistribution
      )) {
        const model = models.find((m) => m.modelId === modelId);
        if (!model) continue;

        // If using expensive models frequently, suggest cheaper alternatives
        if (
          usageCount > 10 &&
          stats.averageCostPerGeneration > this.DEFAULT_COST_PER_GEN_LIMIT
        ) {
          // Find cheaper alternative
          const cheaperModel = models.find(
            (m) =>
              m.modelType === model.modelType &&
              m.isActive &&
              m.modelId !== modelId &&
              this.isModelCheaper(m.modelId, modelId)
          );

          if (cheaperModel) {
            const estimatedSavings =
              (usageCount * stats.averageCostPerGeneration * 0.3); // Assume 30% savings

            adjustments.push({
              currentModel: modelId,
              suggestedModel: cheaperModel.modelId,
              reason: `High usage (${usageCount} times) with high cost. Switching could reduce costs.`,
              estimatedSavings,
            });
          }
        }
      }

      if (adjustments.length > 0) {
        console.log(
          `[CostMonitor] ${adjustments.length} model adjustment suggestions for project ${projectId}`
        );
      }
    } catch (error) {
      console.error("[CostMonitor] Failed to suggest model adjustments:", error);
    }

    return adjustments;
  }

  /**
   * Set budget configuration for a project
   */
  setBudgetConfig(config: BudgetConfig): void {
    this.budgetConfigs.set(config.projectId, config);
    console.log(`[CostMonitor] Budget config set for project ${config.projectId}`);
  }

  /**
   * Get budget configuration for a project
   */
  getBudgetConfig(projectId: string): BudgetConfig | undefined {
    return this.budgetConfigs.get(projectId);
  }

  /**
   * Get cost breakdown by scene
   */
  async getCostByScene(chapterId: string): Promise<Record<string, number>> {
    const logs = await generationLogService.queryLogs({ chapterId });

    const costByScene: Record<string, number> = {};
    logs.forEach((log) => {
      if (log.sceneId) {
        costByScene[log.sceneId] =
          (costByScene[log.sceneId] || 0) + (log.cost || 0);
      }
    });

    return costByScene;
  }

  /**
   * Get monthly cost trend
   */
  async getMonthlyCostTrend(
    projectId: string,
    months: number = 3
  ): Promise<Array<{ month: string; cost: number; tokens: number }>> {
    const trend: Array<{ month: string; cost: number; tokens: number }> = [];

    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const stats = await this.getCostStats(projectId, [startDate, endDate]);

      trend.push({
        month: startDate.toISOString().substring(0, 7), // YYYY-MM
        cost: stats.totalCost,
        tokens: stats.totalTokens,
      });
    }

    return trend;
  }

  /**
   * Calculate total words from logs
   */
  private async calculateTotalWords(logs: any[]): Promise<number> {
    let totalWords = 0;

    for (const log of logs) {
      if (log.sceneId) {
        try {
          const chunks = await storage.getDraftChunksByScene(log.sceneId);
          totalWords += chunks.reduce(
            (sum, chunk) => sum + (chunk.wordCount || 0),
            0
          );
        } catch (error) {
          // Estimate from tokens if word count not available
          totalWords += Math.floor(log.tokensUsed * 0.75);
        }
      } else {
        // Estimate from tokens
        totalWords += Math.floor(log.tokensUsed * 0.75);
      }
    }

    return totalWords;
  }

  /**
   * Check if one model is cheaper than another
   */
  private isModelCheaper(modelA: string, modelB: string): boolean {
    // Simple heuristic based on model names
    // In production, this should use actual pricing data
    const cheapModels = ["gpt-3.5", "deepseek", "qwen", "glm-3"];
    const expensiveModels = ["gpt-4", "claude-3", "gemini-pro"];

    const aIsCheap = cheapModels.some((m) => modelA.includes(m));
    const bIsExpensive = expensiveModels.some((m) => modelB.includes(m));

    return aIsCheap && bIsExpensive;
  }

  /**
   * Get empty cost stats structure
   */
  private getEmptyCostStats(): CostStats {
    return {
      totalTokens: 0,
      totalCost: 0,
      costPerProject: {},
      costPerChapter: {},
      cacheHitRate: 0,
      costSavings: 0,
      modelUsageDistribution: {},
      averageCostPerGeneration: 0,
      costPer1kWords: 0,
    };
  }
}

export const costMonitorService = new CostMonitorService();
