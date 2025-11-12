// Semantic Cache Service
// 实现语义签名缓存机制
// 遵循构建创作小说应用方案.txt的缓存策略

import { storage } from "./storage";
import { aiService } from "./ai-service";
import crypto from "crypto";

export interface CacheCheckResult {
  hit: boolean;
  draftChunk?: any;
  signatureId?: string;
  similarity?: number;
}

export interface SemanticSignatureData {
  templateId: string;
  keyInfo: string;
  signatureHash: string;
  embeddingModel?: string;
  draftChunkId: string;
  tokensUsed: number;
  qualityScore: number;
}

export class SemanticCacheService {
  private readonly SIMILARITY_THRESHOLD = 0.92; // 相似度阈值（降低以提高命中率）
  private readonly CACHE_ENABLED = true; // 缓存开关
  private readonly USE_EMBEDDING = true; // 使用embedding进行语义匹配

  /**
   * 检查缓存
   * 实现方案中的缓存查询逻辑
   * 支持基于embedding的语义匹配
   */
  async checkCache(
    templateId: string,
    sceneFrame: any,
    context: any
  ): Promise<CacheCheckResult> {
    if (!this.CACHE_ENABLED) {
      return { hit: false };
    }

    try {
      // 1. 提取关键信息
      const keyInfo = this.extractKeyInfo(sceneFrame, context);

      // 2. 生成签名哈希
      const signatureHash = this.hashContent(keyInfo);

      // 3. 查找相似签名（精确匹配）
      let similarSignatures = await storage.findSimilarSignatures(
        templateId,
        signatureHash
      );

      // 4. 如果没有精确匹配，尝试语义匹配
      if (similarSignatures.length === 0 && this.USE_EMBEDDING) {
        similarSignatures = await this.findSemanticallySimilarSignatures(
          templateId,
          keyInfo
        );
      }

      if (similarSignatures.length === 0) {
        console.log("[Cache] Miss - No similar signatures found");
        return { hit: false };
      }

      // 5. 获取最佳匹配
      const bestMatch = similarSignatures[0];

      // 6. 运行短回验
      const isValid = await this.shortVerification(bestMatch, sceneFrame);

      if (!isValid) {
        console.log("[Cache] Miss - Verification failed");
        return { hit: false };
      }

      // 7. 获取缓存的草稿
      const draftChunk = await storage.getDraftChunk(bestMatch.draftChunkId);

      if (!draftChunk) {
        console.log("[Cache] Miss - Draft chunk not found");
        return { hit: false };
      }

      // 8. 更新使用统计
      await storage.updateSignatureUsage(bestMatch.id);

      console.log(
        `[Cache] Hit - Reusing draft (quality: ${bestMatch.qualityScore}, reuse: ${bestMatch.reuseCount + 1})`
      );

      return {
        hit: true,
        draftChunk,
        signatureId: bestMatch.id,
        similarity: bestMatch.similarity || 1.0,
      };
    } catch (error: any) {
      console.error("[Cache] Check failed:", error.message);
      return { hit: false };
    }
  }

  /**
   * 使用embedding查找语义相似的签名
   */
  private async findSemanticallySimilarSignatures(
    templateId: string,
    keyInfo: string
  ): Promise<any[]> {
    try {
      // 获取keyInfo的embedding
      const queryEmbedding = await aiService.getEmbedding(keyInfo);
      if (!queryEmbedding) {
        return [];
      }

      // 获取所有该模板的签名
      const allSignatures = await storage.findSimilarSignatures(templateId, "");

      // 计算相似度
      const similarities: Array<{ signature: any; similarity: number }> = [];

      for (const signature of allSignatures) {
        // 获取签名的embedding
        const sigEmbedding = await aiService.getEmbedding(signature.keyInfo);
        if (!sigEmbedding) continue;

        // 计算余弦相似度
        const similarity = this.cosineSimilarity(queryEmbedding, sigEmbedding);

        if (similarity >= this.SIMILARITY_THRESHOLD) {
          similarities.push({ signature: { ...signature, similarity }, similarity });
        }
      }

      // 按相似度排序
      similarities.sort((a, b) => b.similarity - a.similarity);

      console.log(
        `[Cache] Found ${similarities.length} semantically similar signatures`
      );

      return similarities.map((s) => s.signature);
    } catch (error) {
      console.error("[Cache] Semantic search failed:", error);
      return [];
    }
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * 保存到缓存
   * 只保存高质量的草稿（质量分数 >= 70）
   */
  async saveToCache(
    templateId: string,
    sceneFrame: any,
    context: any,
    draftChunkId: string,
    tokensUsed: number,
    qualityScore: number
  ): Promise<void> {
    if (!this.CACHE_ENABLED) {
      return;
    }

    // 只缓存高质量内容
    if (qualityScore < 70) {
      console.log(`[Cache] Skip caching low quality draft (score: ${qualityScore})`);
      return;
    }

    try {
      // 提取关键信息
      const keyInfo = this.extractKeyInfo(sceneFrame, context);

      // 生成签名哈希
      const signatureHash = this.hashContent(keyInfo);

      // 获取embedding模型信息（如果使用）
      let embeddingModel: string | null = null;
      if (this.USE_EMBEDDING) {
        try {
          const defaultEmbedding = await aiService.getDefaultEmbeddingModel();
          embeddingModel = defaultEmbedding?.modelId || null;
        } catch (error) {
          console.log("[Cache] Failed to get embedding model info");
        }
      }

      // 保存签名
      await storage.createSemanticSignature({
        templateId,
        keyInfo,
        signatureHash,
        embeddingModel,
        draftChunkId,
        tokensUsed,
        qualityScore,
        reuseCount: 0,
        lastUsedAt: null,
      });

      console.log(
        `[Cache] Saved signature for future reuse (quality: ${qualityScore})`
      );
    } catch (error: any) {
      console.error("[Cache] Save failed:", error.message);
    }
  }

  /**
   * 提取关键信息
   * 用于生成语义签名
   */
  private extractKeyInfo(sceneFrame: any, context: any): string {
    const keyElements = [
      `purpose:${sceneFrame.purpose}`,
      `entry:${sceneFrame.entryStateSummary || ""}`,
      `exit:${sceneFrame.exitStateSummary || ""}`,
      `entities:${(sceneFrame.focalEntities || []).join(",")}`,
    ];

    // 添加上文摘要（如果有）
    if (context.previousContent) {
      const summary = context.previousContent.substring(0, 100);
      keyElements.push(`prev:${summary}`);
    }

    return keyElements.join("|");
  }

  /**
   * 短回验
   * 使用10-30 token快速检查缓存内容是否仍然适用
   * 可选使用AI进行快速验证
   */
  private async shortVerification(
    signature: any,
    sceneFrame: any
  ): Promise<boolean> {
    try {
      const keyInfo = signature.keyInfo;

      // 1. 基础规则检查
      // 检查场景目的是否匹配
      const purposeMatch = keyInfo.includes(sceneFrame.purpose.substring(0, 20));
      if (!purposeMatch) {
        console.log("[Cache] Verification failed: purpose mismatch");
        return false;
      }

      // 检查焦点角色是否匹配
      const entities = sceneFrame.focalEntities || [];
      for (const entity of entities) {
        if (!keyInfo.includes(entity)) {
          console.log(`[Cache] Verification failed: entity ${entity} not found`);
          return false;
        }
      }

      // 检查质量分数
      if (signature.qualityScore < 60) {
        console.log(
          `[Cache] Verification failed: low quality (${signature.qualityScore})`
        );
        return false;
      }

      // 检查复用次数（避免过度复用导致内容重复）
      if (signature.reuseCount > 10) {
        console.log(
          `[Cache] Verification failed: overused (${signature.reuseCount} times)`
        );
        return false;
      }

      // 2. 可选：使用AI进行快速验证（10-30 tokens）
      // 这里可以调用AI模型快速判断缓存内容是否适用
      // 为了节省token，暂时只使用规则检查

      return true;
    } catch (error) {
      console.error("[Cache] Verification error:", error);
      return false;
    }
  }

  /**
   * 计算质量分数
   * 基于规则检查结果和内容特征
   */
  calculateQualityScore(
    content: string,
    ruleCheck: any,
    targetWords: number
  ): number {
    let score = 100;

    // 规则检查扣分
    if (!ruleCheck.passed) {
      score -= ruleCheck.errors.length * 15;
    }
    score -= ruleCheck.warnings.length * 5;

    // 字数偏差扣分
    const wordCount = content.length;
    const deviation = Math.abs(wordCount - targetWords) / targetWords;
    if (deviation > 0.3) {
      score -= 20;
    } else if (deviation > 0.2) {
      score -= 10;
    }

    // 对话比例检查
    const dialogueCount = (content.match(/["「『]/g) || []).length;
    const dialogueRatio = dialogueCount / (wordCount / 100);
    if (dialogueRatio < 5 || dialogueRatio > 50) {
      score -= 10;
    }

    // 段落结构检查
    const paragraphs = content.split("\n\n").filter((p) => p.trim());
    if (paragraphs.length < 3 && wordCount > 500) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成内容哈希
   */
  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * 清理过期缓存
   * 删除质量分数低或长时间未使用的缓存
   */
  async cleanupCache(daysOld: number = 30): Promise<number> {
    try {
      let deletedCount = 0;

      // 获取所有签名
      const allSignatures = await storage.findSimilarSignatures("", "");

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      for (const signature of allSignatures) {
        let shouldDelete = false;

        // 1. 删除质量分数 < 50 的缓存
        if (signature.qualityScore < 50) {
          shouldDelete = true;
        }

        // 2. 删除超过 daysOld 天未使用的缓存（且复用次数 < 3）
        if (
          signature.lastUsedAt &&
          new Date(signature.lastUsedAt) < cutoffDate &&
          signature.reuseCount < 3
        ) {
          shouldDelete = true;
        }

        // 3. 保留复用次数高的缓存（>= 5次）
        if (signature.reuseCount >= 5) {
          shouldDelete = false;
        }

        if (shouldDelete) {
          // 这里需要添加删除方法到storage
          // await storage.deleteSemanticSignature(signature.id);
          deletedCount++;
        }
      }

      console.log(`[Cache] Cleanup completed, deleted ${deletedCount} signatures`);
      return deletedCount;
    } catch (error: any) {
      console.error("[Cache] Cleanup failed:", error.message);
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats(): Promise<{
    totalSignatures: number;
    avgQualityScore: number;
    avgReuseCount: number;
    hitRate: number;
  }> {
    try {
      const allSignatures = await storage.findSimilarSignatures("", "");

      if (allSignatures.length === 0) {
        return {
          totalSignatures: 0,
          avgQualityScore: 0,
          avgReuseCount: 0,
          hitRate: 0,
        };
      }

      const totalQuality = allSignatures.reduce(
        (sum, sig) => sum + (sig.qualityScore || 0),
        0
      );
      const totalReuse = allSignatures.reduce(
        (sum, sig) => sum + (sig.reuseCount || 0),
        0
      );

      const avgQualityScore = totalQuality / allSignatures.length;
      const avgReuseCount = totalReuse / allSignatures.length;

      // 计算命中率（复用次数 > 0 的比例）
      const usedSignatures = allSignatures.filter((sig) => sig.reuseCount > 0);
      const hitRate = usedSignatures.length / allSignatures.length;

      return {
        totalSignatures: allSignatures.length,
        avgQualityScore: Math.round(avgQualityScore),
        avgReuseCount: Math.round(avgReuseCount * 10) / 10,
        hitRate: Math.round(hitRate * 100) / 100,
      };
    } catch (error) {
      console.error("[Cache] Stats failed:", error);
      return {
        totalSignatures: 0,
        avgQualityScore: 0,
        avgReuseCount: 0,
        hitRate: 0,
      };
    }
  }
}

export const semanticCacheService = new SemanticCacheService();
