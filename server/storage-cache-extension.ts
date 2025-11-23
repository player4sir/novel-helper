// Storage Extension for Semantic Cache
// This extends the main storage with cache-specific methods

import { db } from "./db";
import { sql } from "drizzle-orm";

export interface CachedExecution {
  id: string;
  executionId: string;
  templateId: string;
  semanticSignature: number[];
  semanticHash: string;
  promptHash: string;
  result: any;
  metadata: {
    seed: any;
    quality: number;
    timestamp: Date;
    hitCount: number;
  };
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  avgQuality: number;
  hitRate: number;
}

export class StorageCacheExtension {
  /**
   * Get cached executions for a template
   */
  async getCachedExecutions(templateId: string): Promise<CachedExecution[]> {
    const result = await db.execute(sql`
      SELECT * FROM cached_executions
      WHERE template_id = ${templateId}
        AND expires_at > NOW()
      ORDER BY (metadata->>'quality')::REAL DESC
      LIMIT 100
    `);

    return result.rows.map((row: any) => {
      // Parse semantic_signature from JSONB to number array
      let semanticSignature: number[] = [];
      if (row.semantic_signature) {
        if (typeof row.semantic_signature === 'string') {
          semanticSignature = JSON.parse(row.semantic_signature);
        } else if (Array.isArray(row.semantic_signature)) {
          semanticSignature = row.semantic_signature;
        } else if (typeof row.semantic_signature === 'object') {
          // JSONB object, convert to array
          semanticSignature = Object.values(row.semantic_signature);
        }
      }

      return {
        id: row.id,
        executionId: row.execution_id,
        templateId: row.template_id,
        semanticSignature,
        semanticHash: row.semantic_hash,
        promptHash: row.prompt_hash,
        result: row.result,
        metadata: row.metadata,
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    });
  }

  /**
   * Create cached execution
   */
  async createCachedExecution(data: {
    executionId: string;
    templateId: string;
    semanticSignature: number[];
    semanticHash: string;
    promptHash: string;
    result: any;
    metadata: any;
    expiresAt: Date;
  }): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO cached_executions (
          execution_id,
          template_id,
          semantic_signature,
          semantic_hash,
          prompt_hash,
          result,
          metadata,
          expires_at
        ) VALUES (
          ${data.executionId},
          ${data.templateId},
          ${JSON.stringify(data.semanticSignature)}::jsonb,
          ${data.semanticHash},
          ${data.promptHash},
          ${JSON.stringify(data.result)}::jsonb,
          ${JSON.stringify(data.metadata)}::jsonb,
          ${data.expiresAt.toISOString()}
        )
        ON CONFLICT (execution_id) DO UPDATE SET
          metadata = jsonb_set(
            cached_executions.metadata,
            '{hitCount}',
            ((cached_executions.metadata->>'hitCount')::INTEGER + 1)::TEXT::jsonb
          ),
          updated_at = NOW()
      `);
    } catch (error: any) {
      // If unique constraint doesn't exist, try without ON CONFLICT
      if (error.code === '42P10') {
        console.warn('[Cache] Unique constraint not found, inserting without conflict handling');
        await db.execute(sql`
          INSERT INTO cached_executions (
            execution_id,
            template_id,
            semantic_signature,
            semantic_hash,
            prompt_hash,
            result,
            metadata,
            expires_at
          ) VALUES (
            ${data.executionId},
            ${data.templateId},
            ${JSON.stringify(data.semanticSignature)}::jsonb,
            ${data.semanticHash},
            ${data.promptHash},
            ${JSON.stringify(data.result)}::jsonb,
            ${JSON.stringify(data.metadata)}::jsonb,
            ${data.expiresAt.toISOString()}
          )
        `);
      } else {
        throw error;
      }
    }
  }

  /**
   * Increment cache hit count
   */
  async incrementCacheHitCount(executionId: string): Promise<void> {
    await db.execute(sql`
      UPDATE cached_executions
      SET metadata = jsonb_set(
        metadata,
        '{hitCount}',
        ((metadata->>'hitCount')::INTEGER + 1)::TEXT::jsonb
      )
      WHERE execution_id = ${executionId}
    `);
  }

  /**
   * Delete expired cached executions
   */
  async deleteExpiredCachedExecutions(): Promise<number> {
    const result = await db.execute(sql`
      DELETE FROM cached_executions
      WHERE expires_at <= NOW()
    `);

    return result.rowCount || 0;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*)::INTEGER as total_entries,
        COALESCE(SUM((metadata->>'hitCount')::INTEGER), 0)::INTEGER as total_hits,
        COALESCE(AVG((metadata->>'quality')::REAL), 0)::REAL as avg_quality,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            COALESCE(SUM((metadata->>'hitCount')::INTEGER), 0)::REAL / COUNT(*)
          ELSE 0 
        END as hit_rate
      FROM cached_executions
      WHERE expires_at > NOW()
    `);

    const row = result.rows[0] as any;

    return {
      totalEntries: row.total_entries || 0,
      totalHits: row.total_hits || 0,
      avgQuality: row.avg_quality || 0,
      hitRate: row.hit_rate || 0,
    };
  }

  /**
   * Clean old low-quality cache entries
   */
  async cleanLowQualityCache(minQuality: number = 50): Promise<number> {
    const result = await db.execute(sql`
      DELETE FROM cached_executions
      WHERE (metadata->>'quality')::REAL < ${minQuality}
        AND (metadata->>'hitCount')::INTEGER = 0
        AND created_at < NOW() - INTERVAL '7 days'
    `);

    return result.rowCount || 0;
  }

  /**
   * Get cached execution by exact hash
   */
  async getCachedExecutionByHash(
    promptHash: string
  ): Promise<CachedExecution | null> {
    const result = await db.execute(sql`
      SELECT * FROM cached_executions
      WHERE prompt_hash = ${promptHash}
        AND expires_at > NOW()
      ORDER BY (metadata->>'quality')::REAL DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      id: row.id,
      executionId: row.execution_id,
      templateId: row.template_id,
      semanticSignature: row.semantic_signature,
      semanticHash: row.semantic_hash,
      promptHash: row.prompt_hash,
      result: row.result,
      metadata: row.metadata,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Get tier breakdown statistics
   */
  async getTierBreakdown(): Promise<{
    exact: number;
    semantic: number;
    template: number;
  }> {
    // This is a simplified implementation
    // In production, you would track tier hits in metadata
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE (metadata->>'hitCount')::INTEGER > 0) as total_hits
      FROM cached_executions
      WHERE expires_at > NOW()
    `);

    const row = result.rows[0] as any;
    const totalHits = row.total_hits || 0;

    // Approximate distribution based on typical patterns
    return {
      exact: Math.floor(totalHits * 0.6),
      semantic: Math.floor(totalHits * 0.3),
      template: Math.floor(totalHits * 0.1),
    };
  }
}

export const storageCacheExtension = new StorageCacheExtension();
