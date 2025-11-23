// History Service
// Manages creation history and version tracking

import { db } from "./db";
import { creationHistory, sessions, type CreationHistory } from "@shared/schema";
import { eq, desc, and, lt } from "drizzle-orm";
import type { ProjectMeta } from "./enhanced-project-creation-service";

// Types
export interface HistoryEntry {
  id: string;
  sessionId: string;
  candidate: ProjectMeta;
  qualityScore: QualityScore;
  innovationScore: InnovationScore;
  timestamp: Date;
  metadata: HistoryMetadata;
}

export interface QualityScore {
  overall: number;
  completeness: number;
  consistency: number;
  richness: number;
  writability: number;
  semanticQuality: number;
}

export interface InnovationScore {
  overall: number;
  worldUniqueness: number;
  characterComplexity: number;
  conflictOriginality: number;
  cliches: Cliche[];
  suggestions: string[];
}

export interface Cliche {
  type: string;
  description: string;
  location: string;
}

export interface HistoryMetadata {
  modelUsed: string;
  tokensUsed: number;
  generationTime: number;
  step?: string;
  userAction?: string;
}

export interface AICallLog {
  timestamp: Date;
  modelUsed: string;
  operation: string; // e.g., "generate_characters", "generate_world", "merge_candidates"
  promptTemplate?: string;
  parameters: Record<string, any>;
  tokensUsed?: number;
  generationTime: number; // in milliseconds
  success: boolean;
  error?: string;
  retryCount?: number;
  result?: any;
}

export interface CreationSummary {
  sessionId: string;
  candidates: HistoryEntry[];
  aiCallLogs: AICallLog[];
  statistics: SessionStats;
  totalAICalls: number;
  totalTokensUsed: number;
  totalGenerationTime: number;
}

/**
 * HistoryService - Manages creation history and version tracking
 */
export class HistoryService {
  /**
   * Record a candidate to history
   */
  async recordCandidate(
    sessionId: string,
    candidate: ProjectMeta,
    scores: { quality: QualityScore; innovation: InnovationScore },
    metadata: HistoryMetadata
  ): Promise<HistoryEntry> {
    console.log(`[HistoryService] Recording candidate for session: ${sessionId}`);

    try {
      const [entry] = await db
        .insert(creationHistory)
        .values({
          sessionId,
          candidate: candidate as any,
          qualityScore: scores.quality as any,
          innovationScore: scores.innovation as any,
          metadata: metadata as any,
        })
        .returning();

      console.log(`[HistoryService] Candidate recorded with id: ${entry.id}`);

      return this.mapToHistoryEntry(entry);
    } catch (error) {
      console.error(`[HistoryService] Error recording candidate:`, error);
      throw error;
    }
  }

  /**
   * Get history for a specific session
   */
  async getSessionHistory(sessionId: string): Promise<HistoryEntry[]> {
    console.log(`[HistoryService] Getting history for session: ${sessionId}`);

    try {
      const entries = await db
        .select()
        .from(creationHistory)
        .where(eq(creationHistory.sessionId, sessionId))
        .orderBy(desc(creationHistory.timestamp));

      return entries.map(entry => this.mapToHistoryEntry(entry));
    } catch (error) {
      console.error(`[HistoryService] Error getting session history:`, error);
      return [];
    }
  }

  /**
   * Get history for a user across all sessions
   */
  async getUserHistory(userId: string, limit: number = 50): Promise<HistoryEntry[]> {
    console.log(`[HistoryService] Getting history for user: ${userId} (limit: ${limit})`);

    try {
      const entries = await db
        .select({
          id: creationHistory.id,
          sessionId: creationHistory.sessionId,
          candidate: creationHistory.candidate,
          qualityScore: creationHistory.qualityScore,
          innovationScore: creationHistory.innovationScore,
          timestamp: creationHistory.timestamp,
          metadata: creationHistory.metadata,
        })
        .from(creationHistory)
        .innerJoin(sessions, eq(creationHistory.sessionId, sessions.id))
        .where(eq(sessions.userId, userId))
        .orderBy(desc(creationHistory.timestamp))
        .limit(limit);

      return entries.map(entry => this.mapToHistoryEntry(entry as any));
    } catch (error) {
      console.error(`[HistoryService] Error getting user history:`, error);
      return [];
    }
  }

  /**
   * Restore a candidate from history
   */
  async restoreCandidate(entryId: string): Promise<ProjectMeta> {
    console.log(`[HistoryService] Restoring candidate: ${entryId}`);

    try {
      const [entry] = await db
        .select({ candidate: creationHistory.candidate })
        .from(creationHistory)
        .where(eq(creationHistory.id, entryId))
        .limit(1);

      if (!entry) {
        throw new Error(`History entry not found: ${entryId}`);
      }

      console.log(`[HistoryService] Candidate restored: ${entryId}`);
      return entry.candidate as ProjectMeta;
    } catch (error) {
      console.error(`[HistoryService] Error restoring candidate:`, error);
      throw error;
    }
  }

  /**
   * Clean up old history entries
   */
  async cleanupHistory(retentionDays: number = 30): Promise<number> {
    console.log(`[HistoryService] Cleaning up history older than ${retentionDays} days`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await db
        .delete(creationHistory)
        .where(lt(creationHistory.timestamp, cutoffDate));

      const deletedCount = result.rowCount || 0;
      console.log(`[HistoryService] Cleaned up ${deletedCount} history entries`);
      return deletedCount;
    } catch (error) {
      console.error(`[HistoryService] Error cleaning up history:`, error);
      return 0;
    }
  }

  /**
   * Get history statistics for a session
   */
  async getSessionStats(sessionId: string): Promise<SessionStats> {
    console.log(`[HistoryService] Getting stats for session: ${sessionId}`);

    try {
      const entries = await db
        .select()
        .from(creationHistory)
        .where(eq(creationHistory.sessionId, sessionId));

      if (entries.length === 0) {
        return {
          totalCandidates: 0,
          avgQuality: 0,
          avgInnovation: 0,
          firstGeneration: null,
          lastGeneration: null,
        };
      }

      // Calculate statistics
      const totalCandidates = entries.length;
      const qualityScores = entries.map(e => (e.qualityScore as any).overall || 0);
      const innovationScores = entries.map(e => (e.innovationScore as any).overall || 0);
      const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / totalCandidates;
      const avgInnovation = innovationScores.reduce((a, b) => a + b, 0) / totalCandidates;
      const timestamps = entries.map(e => e.timestamp!.getTime());
      const firstGeneration = new Date(Math.min(...timestamps));
      const lastGeneration = new Date(Math.max(...timestamps));

      return {
        totalCandidates,
        avgQuality,
        avgInnovation,
        firstGeneration,
        lastGeneration,
      };
    } catch (error) {
      console.error(`[HistoryService] Error getting session stats:`, error);
      return {
        totalCandidates: 0,
        avgQuality: 0,
        avgInnovation: 0,
        firstGeneration: null,
        lastGeneration: null,
      };
    }
  }

  /**
   * Compare two history entries
   */
  async compareEntries(entryId1: string, entryId2: string): Promise<HistoryComparison> {
    console.log(`[HistoryService] Comparing entries: ${entryId1} vs ${entryId2}`);

    try {
      const [entry1, entry2] = await Promise.all([
        this.getEntryById(entryId1),
        this.getEntryById(entryId2),
      ]);

      if (!entry1 || !entry2) {
        throw new Error("One or both entries not found");
      }

      return {
        entry1,
        entry2,
        qualityDiff: {
          overall: entry2.qualityScore.overall - entry1.qualityScore.overall,
          completeness: entry2.qualityScore.completeness - entry1.qualityScore.completeness,
          consistency: entry2.qualityScore.consistency - entry1.qualityScore.consistency,
          richness: entry2.qualityScore.richness - entry1.qualityScore.richness,
          writability: entry2.qualityScore.writability - entry1.qualityScore.writability,
          semanticQuality: entry2.qualityScore.semanticQuality - entry1.qualityScore.semanticQuality,
        },
        innovationDiff: {
          overall: entry2.innovationScore.overall - entry1.innovationScore.overall,
          worldUniqueness: entry2.innovationScore.worldUniqueness - entry1.innovationScore.worldUniqueness,
          characterComplexity: entry2.innovationScore.characterComplexity - entry1.innovationScore.characterComplexity,
          conflictOriginality: entry2.innovationScore.conflictOriginality - entry1.innovationScore.conflictOriginality,
        },
      };
    } catch (error) {
      console.error(`[HistoryService] Error comparing entries:`, error);
      throw error;
    }
  }

  /**
   * Get a single history entry by ID
   */
  async getEntryById(entryId: string): Promise<HistoryEntry | null> {
    try {
      const [entry] = await db
        .select()
        .from(creationHistory)
        .where(eq(creationHistory.id, entryId))
        .limit(1);

      if (!entry) {
        return null;
      }

      return this.mapToHistoryEntry(entry);
    } catch (error) {
      console.error(`[HistoryService] Error getting entry:`, error);
      return null;
    }
  }

  /**
   * Delete a specific history entry
   */
  async deleteEntry(entryId: string): Promise<boolean> {
    console.log(`[HistoryService] Deleting entry: ${entryId}`);

    try {
      const result = await db
        .delete(creationHistory)
        .where(eq(creationHistory.id, entryId));

      const deleted = (result.rowCount || 0) > 0;
      if (deleted) {
        console.log(`[HistoryService] Entry deleted: ${entryId}`);
      }
      return deleted;
    } catch (error) {
      console.error(`[HistoryService] Error deleting entry:`, error);
      return false;
    }
  }

  /**
   * Record AI call log
   * Records detailed information about AI API calls during project creation
   */
  async recordAICall(
    sessionId: string,
    aiCallLog: AICallLog
  ): Promise<void> {
    console.log(`[HistoryService] Recording AI call for session: ${sessionId}`);

    try {
      // Store AI call log in metadata of a history entry
      // We create a special entry type for AI call logs
      await db.insert(creationHistory).values({
        sessionId,
        candidate: { _type: "ai_call_log" } as any, // Special marker
        qualityScore: {} as any,
        innovationScore: {} as any,
        metadata: {
          ...aiCallLog,
          _isAICallLog: true,
        } as any,
      });

      console.log(`[HistoryService] AI call logged for session: ${sessionId}`);
    } catch (error) {
      console.error(`[HistoryService] Error recording AI call:`, error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Get AI call logs for a session
   */
  async getAICallLogs(sessionId: string): Promise<AICallLog[]> {
    console.log(`[HistoryService] Getting AI call logs for session: ${sessionId}`);

    try {
      const entries = await db
        .select()
        .from(creationHistory)
        .where(eq(creationHistory.sessionId, sessionId));

      // Filter for AI call log entries
      const logs = entries
        .filter(entry => {
          const metadata = entry.metadata as any;
          return metadata && metadata._isAICallLog === true;
        })
        .map(entry => {
          const metadata = entry.metadata as any;
          const { _isAICallLog, ...logData } = metadata;
          return logData as AICallLog;
        });

      return logs;
    } catch (error) {
      console.error(`[HistoryService] Error getting AI call logs:`, error);
      return [];
    }
  }

  /**
   * Get creation summary for a session
   * Returns a complete log of all AI calls and candidates generated
   */
  async getCreationSummary(sessionId: string): Promise<CreationSummary> {
    console.log(`[HistoryService] Getting creation summary for session: ${sessionId}`);

    try {
      const [candidates, aiLogs, stats] = await Promise.all([
        this.getSessionHistory(sessionId),
        this.getAICallLogs(sessionId),
        this.getSessionStats(sessionId),
      ]);

      return {
        sessionId,
        candidates,
        aiCallLogs: aiLogs,
        statistics: stats,
        totalAICalls: aiLogs.length,
        totalTokensUsed: aiLogs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0),
        totalGenerationTime: aiLogs.reduce((sum, log) => sum + (log.generationTime || 0), 0),
      };
    } catch (error) {
      console.error(`[HistoryService] Error getting creation summary:`, error);
      throw error;
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Map database entry to HistoryEntry
   */
  private mapToHistoryEntry(entry: CreationHistory): HistoryEntry {
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      candidate: entry.candidate as ProjectMeta,
      qualityScore: entry.qualityScore as QualityScore,
      innovationScore: entry.innovationScore as InnovationScore,
      timestamp: entry.timestamp!,
      metadata: entry.metadata as HistoryMetadata,
    };
  }
}

// Additional types
export interface SessionStats {
  totalCandidates: number;
  avgQuality: number;
  avgInnovation: number;
  firstGeneration: Date | null;
  lastGeneration: Date | null;
}

export interface HistoryComparison {
  entry1: HistoryEntry;
  entry2: HistoryEntry;
  qualityDiff: {
    overall: number;
    completeness: number;
    consistency: number;
    richness: number;
    writability: number;
    semanticQuality: number;
  };
  innovationDiff: {
    overall: number;
    worldUniqueness: number;
    characterComplexity: number;
    conflictOriginality: number;
  };
}

// Export singleton instance
export const historyService = new HistoryService();
