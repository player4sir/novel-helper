// Semantic Cache Service with Verification
// Implements semantic signature-based caching with quick verification

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { storageCacheExtension } from "./storage-cache-extension";
import crypto from "crypto";

interface CachedExecution {
  executionId: string;
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
}

interface CacheSearchResult {
  cached: CachedExecution;
  similarity: number;
}

export class SemanticCacheService {
  private readonly SIMILARITY_THRESHOLD = 0.98; // 提高到 98% 避免误判
  private readonly CACHE_TTL_DAYS = 30;
  private readonly MIN_QUALITY_TO_CACHE = 70;

  /**
   * Find semantically similar cached execution
   */
  async findSimilar(
    semanticSignature: number[],
    templateId: string
  ): Promise<CacheSearchResult | null> {
    try {
      // Get all cached executions for this template
      const cached = await storageCacheExtension.getCachedExecutions(templateId);

      if (cached.length === 0) {
        return null;
      }

      // Calculate similarities (with dimension check)
      const similarities: CacheSearchResult[] = [];

      for (const c of cached) {
        try {
          // Check if dimensions match
          if (c.semanticSignature.length !== semanticSignature.length) {
            console.warn(
              `[Cache] Dimension mismatch: expected ${semanticSignature.length}, got ${c.semanticSignature.length}`
            );
            continue;
          }

          const similarity = this.cosineSimilarity(semanticSignature, c.semanticSignature);
          similarities.push({
            cached: c,
            similarity,
          });
        } catch (err) {
          console.warn(`[Cache] Failed to calculate similarity:`, err);
          continue;
        }
      }

      if (similarities.length === 0) {
        return null;
      }

      // Find best match
      let best = similarities[0];
      for (const s of similarities) {
        if (s.similarity > best.similarity) {
          best = s;
        }
      }

      if (best.similarity >= this.SIMILARITY_THRESHOLD) {
        console.log(
          `[Cache] Found similar execution (similarity: ${best.similarity.toFixed(3)})`
        );
        return best;
      }

      return null;
    } catch (error) {
      console.error("[Cache] Search failed:", error);
      return null;
    }
  }

  /**
   * Quick verification using small model (10-30 tokens)
   */
  async quickVerify(
    cached: CachedExecution,
    currentSeed: any,
    userId: string
  ): Promise<boolean> {
    try {
      // Check if cached result has the expected structure
      if (!cached.result || typeof cached.result !== 'object') {
        console.warn("[Cache] Invalid cached result structure, skipping verification");
        return true; // Trust cache if structure is unexpected
      }

      // Build verification prompt based on available data
      let prompt = "";

      // For project/volume generation cache
      if (cached.result.projectMeta) {
        const title = cached.result.projectMeta.title || "未知";
        const premise = cached.result.projectMeta.premise
          ? cached.result.projectMeta.premise.substring(0, 100)
          : "未知";

        prompt = `判断以下项目设定是否适合创意种子"${currentSeed.titleSeed || "未知"}"？

项目标题：${title}
核心设定：${premise}...

要求：
1. 主题是否匹配？
2. 风格是否一致？
3. 是否可以直接使用？

只回答：是 或 否`;
      }
      // For volume/chapter cache
      else if (cached.result.volumes || cached.result.chapters) {
        const itemType = cached.result.volumes ? "卷" : "章节";
        const items = cached.result.volumes || cached.result.chapters;
        const count = items?.length || 0;

        prompt = `判断以下${itemType}纲是否适合当前项目？

${itemType}数量：${count}个
项目ID：${currentSeed.projectId || "未知"}

要求：
1. 结构是否合理？
2. 是否可以直接使用？

只回答：是 或 否`;
      }
      // Generic fallback
      else {
        console.log("[Cache] Unknown cache structure, trusting cache");
        return true;
      }

      const models = await storage.getAIModels(userId);
      const smallModel = models.find(
        (m) => m.modelType === "chat" && m.isActive && !m.modelId.toLowerCase().includes("large")
      );

      if (!smallModel) {
        console.warn("[Cache] No small model available for verification");
        return true; // 降级：无验证模型时信任缓存
      }

      const result = await aiService.generate({
        prompt,
        modelId: smallModel.modelId,
        provider: smallModel.provider,
        baseUrl: smallModel.baseUrl || "",
        apiKey: smallModel.apiKey || undefined,
        parameters: {
          temperature: 0,
          maxTokens: 10,
        },
      });

      const answer = result.content.trim();
      const isValid = answer.includes("是") || answer.toLowerCase().includes("yes");

      console.log(`[Cache] Verification result: ${isValid ? "PASS" : "FAIL"}`);
      return isValid;
    } catch (error) {
      console.error("[Cache] Verification failed:", error);
      return true; // 降级：验证失败时信任缓存
    }
  }

  /**
   * Calculate semantic signature from seed
   */
  async calculateSignature(seed: any, userId: string): Promise<{
    signature: number[];
    hash: string;
  }> {
    try {
      // Build text representation
      const text = this.buildTextForEmbedding(seed);

      if (!text || text.trim() === "") {
        console.warn("[Cache] Empty text for embedding, seed:", JSON.stringify(seed));
        throw new Error("Cannot generate embedding for empty text");
      }

      // Get embedding
      const embedding = await aiService.getEmbedding(text, userId);

      if (!embedding) {
        throw new Error("Failed to generate embedding");
      }

      // Normalize to unit vector
      const normalized = this.normalizeVector(embedding);

      // Calculate hash
      const hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(normalized))
        .digest("hex");

      return {
        signature: normalized,
        hash,
      };
    } catch (error) {
      console.error("[Cache] Signature calculation failed:", error);
      throw error;
    }
  }

  /**
   * Cache execution result
   */
  async cacheResult(
    executionId: string,
    templateId: string,
    semanticSignature: number[],
    semanticHash: string,
    promptHash: string,
    result: any,
    seed: any,
    quality: number
  ): Promise<void> {
    try {
      // Only cache high-quality results
      if (quality < this.MIN_QUALITY_TO_CACHE) {
        console.log(
          `[Cache] Quality too low (${quality}), not caching`
        );
        return;
      }

      await storageCacheExtension.createCachedExecution({
        executionId,
        templateId,
        semanticSignature,
        semanticHash,
        promptHash,
        result,
        metadata: {
          seed,
          quality,
          timestamp: new Date(),
          hitCount: 0,
        },
        expiresAt: new Date(Date.now() + this.CACHE_TTL_DAYS * 24 * 60 * 60 * 1000),
      });

      console.log(`[Cache] Cached execution ${executionId} (quality: ${quality})`);
    } catch (error) {
      console.error("[Cache] Failed to cache result:", error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Update cache hit count
   */
  async recordHit(executionId: string): Promise<void> {
    try {
      await storageCacheExtension.incrementCacheHitCount(executionId);
    } catch (error) {
      console.error("[Cache] Failed to record hit:", error);
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpired(): Promise<number> {
    try {
      const deleted = await storageCacheExtension.deleteExpiredCachedExecutions();
      console.log(`[Cache] Cleaned ${deleted} expired entries`);
      return deleted;
    } catch (error) {
      console.error("[Cache] Cleanup failed:", error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    avgQuality: number;
    hitRate: number;
  }> {
    try {
      return await storageCacheExtension.getCacheStats();
    } catch (error) {
      console.error("[Cache] Failed to get stats:", error);
      return {
        totalEntries: 0,
        totalHits: 0,
        avgQuality: 0,
        hitRate: 0,
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private buildTextForEmbedding(seed: any): string {
    console.log("[Cache] Building text for embedding, seed keys:", Object.keys(seed));
    const parts: string[] = [];

    // Handle scene draft generation seed structure
    if (seed.sceneFrame) {
      // 关键：添加章节 ID 和场景索引，确保不同场景不会被误判为相似
      parts.push(`chapter:${seed.sceneFrame.chapterId}`);
      parts.push(`scene:${seed.sceneFrame.index}`);
      parts.push(`id:${seed.sceneFrame.id}`); // 场景唯一 ID

      parts.push(seed.sceneFrame.purpose || "");
      parts.push(seed.sceneFrame.entryStateSummary || "");
      parts.push(seed.sceneFrame.exitStateSummary || "");
      if (seed.sceneFrame.focalEntities) {
        parts.push(seed.sceneFrame.focalEntities.join(" "));
      }

      // Add context information
      if (seed.context) {
        if (seed.context.projectSummary) {
          parts.push(seed.context.projectSummary.coreConflicts || "");
          parts.push(seed.context.projectSummary.themeTags || "");
        }
        if (seed.context.characters) {
          const charNames = Array.isArray(seed.context.characters)
            ? seed.context.characters.map((c: any) => c.name || "").join(" ")
            : "";
          if (charNames) parts.push(charNames);
        }
        // 添加上文内容的摘要，确保连续性
        if (seed.context.previousContent) {
          const preview = seed.context.previousContent.substring(0, 200);
          parts.push(`previous:${preview}`);
        }
      }
    }
    // Handle project/volume generation seed structure (legacy)
    else if (seed.titleSeed) {
      parts.push(seed.titleSeed);
      if (seed.premise) parts.push(seed.premise);
      if (seed.genre) parts.push(seed.genre);
      if (seed.style) parts.push(seed.style);
    }
    // Handle volume generation structure (new)
    else if (seed.themeTags || seed.coreConflicts) {
      if (seed.themeTags) parts.push(seed.themeTags.join(" "));
      if (seed.coreConflicts) parts.push(seed.coreConflicts.join(" "));
      if (seed.projectId) parts.push(seed.projectId);
    }
    // Handle chapter generation structure (new)
    else if (seed.volumeBeats) {
      if (seed.volumeBeats) parts.push(seed.volumeBeats.join(" "));
      if (seed.volumeId) parts.push(seed.volumeId);
      if (seed.projectId) parts.push(seed.projectId);
    }
    // Handle append chapters structure
    else if (seed.contextHash && seed.volumeId) {
      parts.push(`append_chapters:${seed.volumeId}`);
      if (seed.contextHash) parts.push(seed.contextHash);
      if (seed.additionalCount) parts.push(`count:${seed.additionalCount}`);
      if (seed.startIndex) parts.push(`start:${seed.startIndex}`);
      if (seed.projectId) parts.push(seed.projectId);
    }

    return parts.filter(p => p).join(" | ");
  }

  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );

    if (magnitude === 0) return vector;

    return vector.map((val) => val / magnitude);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have same length");
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Check cache for scene draft generation (wrapper for scene-draft-service)
   * This method provides backward compatibility with the old interface
   */
  async checkCache(
    templateId: string,
    sceneFrame: any,
    context: any,
    userId: string
  ): Promise<{
    hit: boolean;
    draftChunk?: any;
    executionId?: string;
  }> {
    try {
      // Create a seed from sceneFrame and context
      const seed = {
        sceneFrame,
        context: {
          previousContent: context.previousContent?.substring(0, 500),
          characters: context.characters,
          projectSummary: context.projectSummary,
        },
      };

      // Calculate semantic signature
      const { signature, hash } = await this.calculateSignature(seed, userId);

      // Try to find similar cached execution
      const similar = await this.findSimilar(signature, templateId);

      if (!similar) {
        return { hit: false };
      }

      // 严格验证：确保是同一个场景（通过 ID 和索引）
      const cachedSeed = similar.cached.metadata?.seed;
      if (cachedSeed?.sceneFrame) {
        // 检查场景 ID 是否完全匹配
        if (cachedSeed.sceneFrame.id !== sceneFrame.id) {
          console.log(
            `[Cache] Scene ID mismatch (cached: ${cachedSeed.sceneFrame.id}, current: ${sceneFrame.id}), cache miss`
          );
          return { hit: false };
        }

        // 检查章节 ID 是否匹配
        if (cachedSeed.sceneFrame.chapterId !== sceneFrame.chapterId) {
          console.log(
            `[Cache] Chapter ID mismatch, cache miss`
          );
          return { hit: false };
        }

        // 检查场景索引是否匹配
        if (cachedSeed.sceneFrame.index !== sceneFrame.index) {
          console.log(
            `[Cache] Scene index mismatch (cached: ${cachedSeed.sceneFrame.index}, current: ${sceneFrame.index}), cache miss`
          );
          return { hit: false };
        }
      }

      // Verify the cached result is still valid
      const isValid = await this.quickVerify(similar.cached, seed, userId);

      if (!isValid) {
        console.log("[Cache] Verification failed, cache miss");
        return { hit: false };
      }

      // Record cache hit
      await this.recordHit(similar.cached.executionId);

      // Validate cached result structure
      const cachedResult = similar.cached.result;
      if (!cachedResult || typeof cachedResult !== 'object') {
        console.warn("[Cache] Invalid cached result structure, cache miss");
        return { hit: false };
      }

      // Ensure the cached result has required fields
      if (!cachedResult.content) {
        console.warn("[Cache] Cached result missing content field, cache miss");
        return { hit: false };
      }

      // Return the cached draft chunk
      return {
        hit: true,
        draftChunk: cachedResult,
        executionId: similar.cached.executionId,
      };
    } catch (error) {
      console.error("[Cache] Check failed:", error);
      return { hit: false };
    }
  }

  /**
   * Calculate quality score for caching decision
   */
  calculateQualityScore(
    content: string,
    ruleCheck: { passed: boolean; errors: string[]; warnings: string[] },
    context: any,
    targetWords: number
  ): number {
    let score = 100;

    // Deduct for rule violations
    score -= ruleCheck.errors.length * 20;
    score -= ruleCheck.warnings.length * 5;

    // Deduct for word count deviation
    const wordCount = content.length;
    const deviation = Math.abs(wordCount - targetWords) / targetWords;
    if (deviation > 0.3) {
      score -= 20;
    } else if (deviation > 0.2) {
      score -= 10;
    }

    // Bonus for passing all checks
    if (ruleCheck.passed) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Save to cache with quality filtering
   */
  async saveToCache(
    templateId: string,
    seed: any,
    result: any,
    draftChunkId: string,
    tokensUsed: number,
    qualityScore: number,
    userId: string
  ): Promise<void> {
    try {
      // Only cache high-quality results
      if (qualityScore < this.MIN_QUALITY_TO_CACHE) {
        console.log(
          `[Cache] Quality too low (${qualityScore}), not caching`
        );
        return;
      }

      // Calculate semantic signature
      const { signature, hash } = await this.calculateSignature(seed, userId);

      // Generate execution ID
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Generate prompt hash
      const promptHash = crypto
        .createHash("sha256")
        .update(JSON.stringify(seed))
        .digest("hex");

      // Cache the result
      await this.cacheResult(
        executionId,
        templateId,
        signature,
        hash,
        promptHash,
        result,
        seed,
        qualityScore
      );

      console.log(
        `[Cache] Saved with quality ${qualityScore} (execution: ${executionId})`
      );
    } catch (error) {
      console.error("[Cache] Save failed:", error);
      throw error;
    }
  }
}

export const semanticCacheService = new SemanticCacheService();
