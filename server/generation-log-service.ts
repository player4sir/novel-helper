// Generation Log Service
// Complete audit trail for all AI generations

import { storage } from "./storage";
import type { InsertGenerationLog, GenerationLog } from "@shared/schema";
import type { RuleViolation } from "./rule-checker-service";

// Simplified types (quality evaluator and auto-repair removed)
export interface QualityScore {
  overall: number;
  dimensions: Record<string, number>;
  suggestions?: string[];
}

export interface RepairAction {
  type: string;
  description: string;
  original?: string;
  replacement?: string;
}

export interface LogStats {
  totalGenerations: number;
  totalTokens: number;
  totalCost: number;
  averageQuality: number;
  cacheHitRate: number;
  modelDistribution: Record<string, number>;
  templateDistribution: Record<string, number>;
  qualityDistribution: {
    excellent: number; // >= 90
    good: number; // 70-89
    fair: number; // 50-69
    poor: number; // < 50
  };
}

export interface GenerationLogFilters {
  projectId?: string;
  chapterId?: string;
  sceneId?: string;
  templateId?: string;
  dateRange?: [Date, Date];
  minQuality?: number;
  cachePath?: "exact" | "semantic" | "template" | null;
}

export class GenerationLogService {
  /**
   * Create a new generation log entry
   */
  async createLog(log: {
    executionId: string;
    projectId?: string;
    chapterId?: string;
    sceneId?: string;
    templateId: string;
    templateVersion: string;
    promptSignature: string;
    promptMetadata: any;
    modelId: string;
    modelVersion: string;
    params: any;
    routeDecision: any;
    cachePath?: "exact" | "semantic" | "template";
    responseHash: string;
    responseSummary?: string;
    tokensUsed: number;
    cost?: number;
    qualityScore?: QualityScore;
    ruleViolations?: RuleViolation[];
    repairActions?: RepairAction[];
  }): Promise<void> {
    try {
      const logEntry: InsertGenerationLog = {
        executionId: log.executionId,
        projectId: log.projectId || null,
        chapterId: log.chapterId || null,
        sceneId: log.sceneId || null,
        templateId: log.templateId,
        templateVersion: log.templateVersion,
        promptSignature: log.promptSignature,
        promptMetadata: log.promptMetadata,
        modelId: log.modelId,
        modelVersion: log.modelVersion,
        params: log.params,
        routeDecision: log.routeDecision,
        cachePath: log.cachePath || null,
        responseHash: log.responseHash,
        responseSummary: log.responseSummary || null,
        tokensUsed: log.tokensUsed,
        cost: log.cost || null,
        qualityScore: log.qualityScore ? (log.qualityScore as any) : null,
        ruleViolations: log.ruleViolations ? (log.ruleViolations as any) : null,
        repairActions: log.repairActions ? (log.repairActions as any) : null,
      };

      await storage.createGenerationLog(logEntry);

      console.log(
        `[GenerationLog] Created log: ${log.executionId} ` +
          `(template: ${log.templateId}, model: ${log.modelId}, ` +
          `tokens: ${log.tokensUsed}, quality: ${log.qualityScore?.overall || "N/A"})`
      );
    } catch (error) {
      console.error("[GenerationLog] Failed to create log:", error);
      // Don't throw - logging failure shouldn't break generation
    }
  }

  /**
   * Query generation logs with filters
   */
  async queryLogs(filters: GenerationLogFilters): Promise<GenerationLog[]> {
    try {
      const logs = await storage.queryGenerationLogs(filters);

      console.log(
        `[GenerationLog] Query returned ${logs.length} logs ` +
          `(filters: ${JSON.stringify(filters)})`
      );

      return logs;
    } catch (error) {
      console.error("[GenerationLog] Query failed:", error);
      return [];
    }
  }

  /**
   * Get a specific execution by ID
   */
  async getExecution(executionId: string): Promise<GenerationLog | null> {
    try {
      const log = await storage.getGenerationLogByExecutionId(executionId);

      if (log) {
        console.log(`[GenerationLog] Found execution: ${executionId}`);
      } else {
        console.log(`[GenerationLog] Execution not found: ${executionId}`);
      }

      return log;
    } catch (error) {
      console.error("[GenerationLog] Failed to get execution:", error);
      return null;
    }
  }

  /**
   * Get statistics for a project
   */
  async getStats(projectId: string): Promise<LogStats> {
    try {
      const logs = await this.queryLogs({ projectId });

      if (logs.length === 0) {
        return this.getEmptyStats();
      }

      // Calculate statistics
      const totalGenerations = logs.length;
      const totalTokens = logs.reduce((sum, log) => sum + log.tokensUsed, 0);
      const totalCost = logs.reduce(
        (sum, log) => sum + (log.cost || 0),
        0
      );

      // Calculate average quality
      const qualityScores = logs
        .map((log) => {
          if (log.qualityScore && typeof log.qualityScore === "object") {
            return (log.qualityScore as any).overall;
          }
          return null;
        })
        .filter((score): score is number => score !== null);

      const averageQuality =
        qualityScores.length > 0
          ? qualityScores.reduce((sum, score) => sum + score, 0) /
            qualityScores.length
          : 0;

      // Calculate cache hit rate
      const cacheHits = logs.filter((log) => log.cachePath !== null).length;
      const cacheHitRate = totalGenerations > 0 ? cacheHits / totalGenerations : 0;

      // Model distribution
      const modelDistribution: Record<string, number> = {};
      logs.forEach((log) => {
        modelDistribution[log.modelId] =
          (modelDistribution[log.modelId] || 0) + 1;
      });

      // Template distribution
      const templateDistribution: Record<string, number> = {};
      logs.forEach((log) => {
        templateDistribution[log.templateId] =
          (templateDistribution[log.templateId] || 0) + 1;
      });

      // Quality distribution
      const qualityDistribution = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };

      qualityScores.forEach((score) => {
        if (score >= 90) qualityDistribution.excellent++;
        else if (score >= 70) qualityDistribution.good++;
        else if (score >= 50) qualityDistribution.fair++;
        else qualityDistribution.poor++;
      });

      console.log(
        `[GenerationLog] Stats for project ${projectId}: ` +
          `${totalGenerations} generations, ${totalTokens} tokens, ` +
          `avg quality: ${averageQuality.toFixed(1)}, ` +
          `cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`
      );

      return {
        totalGenerations,
        totalTokens,
        totalCost,
        averageQuality,
        cacheHitRate,
        modelDistribution,
        templateDistribution,
        qualityDistribution,
      };
    } catch (error) {
      console.error("[GenerationLog] Failed to get stats:", error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get statistics for a specific time range
   */
  async getStatsForDateRange(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LogStats> {
    const logs = await this.queryLogs({
      projectId,
      dateRange: [startDate, endDate],
    });

    return this.calculateStatsFromLogs(logs);
  }

  /**
   * Get statistics by template
   */
  async getStatsByTemplate(
    projectId: string,
    templateId: string
  ): Promise<LogStats> {
    const logs = await this.queryLogs({ projectId, templateId });
    return this.calculateStatsFromLogs(logs);
  }

  /**
   * Get statistics by chapter
   */
  async getStatsByChapter(chapterId: string): Promise<LogStats> {
    const logs = await this.queryLogs({ chapterId });
    return this.calculateStatsFromLogs(logs);
  }

  /**
   * Get recent generations
   */
  async getRecentGenerations(
    projectId: string,
    limit: number = 10
  ): Promise<GenerationLog[]> {
    const logs = await this.queryLogs({ projectId });

    // Sort by timestamp descending and limit
    return logs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get failed generations (low quality or errors)
   */
  async getFailedGenerations(
    projectId: string,
    qualityThreshold: number = 50
  ): Promise<GenerationLog[]> {
    const logs = await this.queryLogs({ projectId });

    return logs.filter((log) => {
      if (log.qualityScore && typeof log.qualityScore === "object") {
        const quality = (log.qualityScore as any).overall;
        return quality < qualityThreshold;
      }
      return false;
    });
  }

  /**
   * Get cache performance metrics
   */
  async getCachePerformance(projectId: string): Promise<{
    exactHits: number;
    semanticHits: number;
    templateHits: number;
    misses: number;
    hitRate: number;
  }> {
    const logs = await this.queryLogs({ projectId });

    const exactHits = logs.filter((log) => log.cachePath === "exact").length;
    const semanticHits = logs.filter((log) => log.cachePath === "semantic").length;
    const templateHits = logs.filter((log) => log.cachePath === "template").length;
    const misses = logs.filter((log) => log.cachePath === null).length;

    const total = logs.length;
    const hitRate = total > 0 ? (exactHits + semanticHits + templateHits) / total : 0;

    return {
      exactHits,
      semanticHits,
      templateHits,
      misses,
      hitRate,
    };
  }

  /**
   * Calculate statistics from a list of logs
   */
  private calculateStatsFromLogs(logs: GenerationLog[]): LogStats {
    if (logs.length === 0) {
      return this.getEmptyStats();
    }

    const totalGenerations = logs.length;
    const totalTokens = logs.reduce((sum, log) => sum + log.tokensUsed, 0);
    const totalCost = logs.reduce((sum, log) => sum + (log.cost || 0), 0);

    const qualityScores = logs
      .map((log) => {
        if (log.qualityScore && typeof log.qualityScore === "object") {
          return (log.qualityScore as any).overall;
        }
        return null;
      })
      .filter((score): score is number => score !== null);

    const averageQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((sum, score) => sum + score, 0) /
          qualityScores.length
        : 0;

    const cacheHits = logs.filter((log) => log.cachePath !== null).length;
    const cacheHitRate = totalGenerations > 0 ? cacheHits / totalGenerations : 0;

    const modelDistribution: Record<string, number> = {};
    logs.forEach((log) => {
      modelDistribution[log.modelId] = (modelDistribution[log.modelId] || 0) + 1;
    });

    const templateDistribution: Record<string, number> = {};
    logs.forEach((log) => {
      templateDistribution[log.templateId] =
        (templateDistribution[log.templateId] || 0) + 1;
    });

    const qualityDistribution = {
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
    };

    qualityScores.forEach((score) => {
      if (score >= 90) qualityDistribution.excellent++;
      else if (score >= 70) qualityDistribution.good++;
      else if (score >= 50) qualityDistribution.fair++;
      else qualityDistribution.poor++;
    });

    return {
      totalGenerations,
      totalTokens,
      totalCost,
      averageQuality,
      cacheHitRate,
      modelDistribution,
      templateDistribution,
      qualityDistribution,
    };
  }

  /**
   * Get empty stats structure
   */
  private getEmptyStats(): LogStats {
    return {
      totalGenerations: 0,
      totalTokens: 0,
      totalCost: 0,
      averageQuality: 0,
      cacheHitRate: 0,
      modelDistribution: {},
      templateDistribution: {},
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      },
    };
  }
}

export const generationLogService = new GenerationLogService();
