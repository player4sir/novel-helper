// Enhanced RAG Service - Dual-Stage Retrieval
// Implements semantic search with time-window filtering and weighted ranking

import { storage } from "./storage";
import { aiService } from "./ai-service";
import { db } from "./db";
import { chapters } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export interface RetrievedContext {
    sourceId: string;
    source: 'chapter' | 'summary';
    content: string;
    score: number;
    type: string;
    chapterRange: string;
    metadata: {
        chapterId: string;
        chapterTitle: string;
        orderIndex: number;
        similarity?: number;
        recencyScore?: number;
        roleWeight?: number;
    };
}

export interface RAGRetrievalParams {
    projectId: string;
    currentChapterId: string;
    query: string;
    topK?: number;
    timeWindow?: number; // ±N chapters
    useShortSummaries?: boolean;
}

export interface RAGRetrievalResult {
    contexts: RetrievedContext[];
    totalCandidates: number;
    promptText: string;
    metadata: {
        timeWindowUsed: number;
        retrievalMethod: 'dual-stage';
        timestamp: Date;
    };
}

export class EnhancedRAGService {
    private readonly DEFAULT_TOP_K = 5;
    private readonly DEFAULT_TIME_WINDOW = 6; // ±6 chapters

    // Weights for final ranking
    private readonly WEIGHTS = {
        semantic: 0.5,
        recency: 0.3,
        role: 0.2,
    };

    /**
     * Main retrieval method using dual-stage approach
     */
    async retrieveContext(params: RAGRetrievalParams): Promise<RAGRetrievalResult> {
        const topK = params.topK || this.DEFAULT_TOP_K;
        const timeWindow = params.timeWindow || this.DEFAULT_TIME_WINDOW;

        // Stage A: Time-window coarse filtering
        const timeWindowBounds = await this.getTimeWindow(
            params.projectId,
            params.currentChapterId,
            timeWindow
        );

        // BUGFIX: Exclude current chapter to prevent retrieving its old content
        // This prevents AI from "restoring" deleted content when user clears chapter and regenerates
        const candidateChapters = await db
            .select()
            .from(chapters)
            .where(
                and(
                    eq(chapters.projectId, params.projectId),
                    gte(chapters.orderIndex, timeWindowBounds.start),
                    lte(chapters.orderIndex, timeWindowBounds.end),
                    sql`${chapters.id} != ${params.currentChapterId}` // Exclude current chapter
                )
            )
            .orderBy(chapters.orderIndex);

        console.log(
            `[RAG Stage A] Found ${candidateChapters.length} candidate chapters in time window [${timeWindowBounds.start}, ${timeWindowBounds.end}]`
        );

        // Stage B: Semantic ranking with pgvector
        const queryEmbedding = await aiService.getEmbedding(params.query);
        if (!queryEmbedding) {
            console.warn('[RAG] Failed to generate query embedding, falling back to recency-only ranking');
            const recentContexts = this.buildRecentContexts(candidateChapters, topK);
            return this.buildResult(recentContexts, candidateChapters.length, timeWindow);
        }

        const scoredResults = await this.semanticRank(
            candidateChapters,
            queryEmbedding
        );

        // Apply weighted ranking (semantic + recency + role)
        const weightedResults = this.applyWeights(scoredResults, {
            currentOrderIndex: timeWindowBounds.current,
        });

        // Select top-K
        const topContexts = weightedResults.slice(0, topK);

        return this.buildResult(topContexts, candidateChapters.length, timeWindow);
    }

    /**
     * Get time window bounds for coarse filtering
     */
    private async getTimeWindow(
        projectId: string,
        currentChapterId: string,
        windowSize: number
    ): Promise<{ start: number; end: number; current: number }> {
        const currentChapter = await storage.getChapter(currentChapterId);
        if (!currentChapter) {
            throw new Error('Current chapter not found');
        }

        const currentIndex = currentChapter.orderIndex;

        return {
            start: Math.max(0, currentIndex - windowSize),
            end: currentIndex + windowSize,
            current: currentIndex,
        };
    }

    /**
     * Semantic ranking using vector similarity
     */
    private async semanticRank(
        candidates: any[],
        queryEmbedding: number[]
    ): Promise<RetrievedContext[]> {
        const contexts: RetrievedContext[] = [];

        for (const candidate of candidates) {
            if (!candidate.contentVector) {
                console.warn(`[RAG] Chapter ${candidate.id} has no embedding, skipping`);
                continue;
            }

            // Calculate cosine similarity
            const similarity = this.cosineSimilarity(
                queryEmbedding,
                candidate.contentVector as number[]
            );

            contexts.push({
                sourceId: candidate.id,
                source: 'chapter',
                content: this.extractRelevantContent(candidate.content, 800),
                score: similarity,
                type: 'chapter',
                chapterRange: `第${candidate.orderIndex + 1}章`,
                metadata: {
                    chapterId: candidate.id,
                    chapterTitle: candidate.title,
                    orderIndex: candidate.orderIndex,
                    similarity,
                },
            });
        }

        return contexts.sort((a, b) => b.score - a.score);
    }

    /**
     * Apply weighted ranking combining semantic, recency, and role
     */
    private applyWeights(
        contexts: RetrievedContext[],
        options: { currentOrderIndex: number }
    ): RetrievedContext[] {
        const maxDistance = Math.max(
            ...contexts.map(c => Math.abs(c.metadata.orderIndex - options.currentOrderIndex))
        );

        return contexts.map(ctx => {
            // Recency score (closer chapters get higher scores)
            const distance = Math.abs(ctx.metadata.orderIndex - options.currentOrderIndex);
            const recencyScore = 1 - (distance / (maxDistance || 1));

            // Role weight (boost if chapter has focal entities, assuming they are important)
            // In a full implementation, we would check if these entities are protagonists
            let roleWeight = 1.0;
            if (ctx.metadata.similarity && ctx.metadata.similarity > 0.8) {
                // High semantic similarity implies the character/topic is relevant
                roleWeight = 1.2;
            }

            // Combined score
            const finalScore =
                this.WEIGHTS.semantic * (ctx.metadata.similarity || 0) +
                this.WEIGHTS.recency * recencyScore +
                this.WEIGHTS.role * roleWeight;

            return {
                ...ctx,
                score: finalScore,
                metadata: {
                    ...ctx.metadata,
                    recencyScore,
                    roleWeight,
                },
            };
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * Build fallback contexts based on recency only
     */
    private buildRecentContexts(
        candidates: any[],
        topK: number
    ): RetrievedContext[] {
        return candidates.slice(-topK).reverse().map(ch => ({
            sourceId: ch.id,
            source: 'chapter' as const,
            content: this.extractRelevantContent(ch.content, 800),
            score: 0.5, // Default score
            type: 'chapter',
            chapterRange: `第${ch.orderIndex + 1}章`,
            metadata: {
                chapterId: ch.id,
                chapterTitle: ch.title,
                orderIndex: ch.orderIndex,
            },
        }));
    }

    /**
     * Build structured prompt with retrieved contexts
     */
    buildContextPrompt(contexts: RetrievedContext[]): string {
        if (contexts.length === 0) {
            return '';
        }

        const fragments = contexts.map((ctx, index) => `
【参考片段 #${index + 1}】
来源: ${ctx.chapterRange} - ${ctx.metadata.chapterTitle}
相关度: ${(ctx.score * 100).toFixed(1)}%
类型: ${ctx.type}
---
${ctx.content}
---
    `.trim()).join('\n\n');

        return `
# 参考上下文

以下片段来自相关章节，仅供参考，不作为绝对事实依据。
请根据当前情节需要选择性使用，保持故事连贯性。

${fragments}

# 注意事项
- 优先保持情节连贯性和角色一致性
- 避免与已有设定产生冲突
- 必要时可以创新，但需符合整体风格
- 不要生硬照搬参考内容
`;
    }

    /**
     * Build final result
     */
    private buildResult(
        contexts: RetrievedContext[],
        totalCandidates: number,
        timeWindow: number
    ): RAGRetrievalResult {
        return {
            contexts,
            totalCandidates,
            promptText: this.buildContextPrompt(contexts),
            metadata: {
                timeWindowUsed: timeWindow,
                retrievalMethod: 'dual-stage',
                timestamp: new Date(),
            },
        };
    }

    /**
     * Extract relevant portion of content (avoid sending entire chapter)
     */
    private extractRelevantContent(content: string, maxChars: number): string {
        if (!content || content.length <= maxChars) {
            return content;
        }

        // Extract from middle for better context
        const start = Math.max(0, Math.floor((content.length - maxChars) / 2));
        const excerpt = content.slice(start, start + maxChars);

        return `...${excerpt}...`;
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error('Vector dimensions must match');
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) {
            return 0;
        }

        return dotProduct / denominator;
    }
}

export const enhancedRAGService = new EnhancedRAGService();
