// Context Selection Service
// Intelligently select relevant context using embedding-based semantic matching
// For incremental volume/chapter generation

import { aiService } from "./ai-service";
import type { Chapter, Outline } from "@shared/schema";

export interface ContextChapter {
  chapter: Chapter;
  outline?: Outline;
  relevanceScore: number;
  reason: string;
}

export interface ContextSelectionOptions {
  maxCount: number;
  tokenBudget: number;
  prioritizeRecent: boolean;
  includeKeyBeats: boolean;
  useEmbedding: boolean;
}

export interface ContextSelectionResult {
  selectedChapters: ContextChapter[];
  contextText: string;
  totalTokens: number;
  selectionMethod: "embedding" | "heuristic" | "recent";
}

export class ContextSelectionService {
  private readonly TOKENS_PER_CHAR = 0.4; // Approximate
  private readonly MIN_RELEVANCE_SCORE = 0.6;

  /**
   * Intelligently select relevant chapters for context
   * Uses embedding-based semantic matching when available
   */
  async selectRelevantChapters(
    allChapters: Chapter[],
    allOutlines: Outline[],
    targetContext: string, // What we're trying to generate
    options: ContextSelectionOptions
  ): Promise<ContextSelectionResult> {
    if (allChapters.length === 0) {
      return {
        selectedChapters: [],
        contextText: "",
        totalTokens: 0,
        selectionMethod: "recent",
      };
    }

    // Try embedding-based selection first
    if (options.useEmbedding) {
      try {
        const embeddingResult = await this.selectByEmbedding(
          allChapters,
          allOutlines,
          targetContext,
          options
        );

        if (embeddingResult.selectedChapters.length > 0) {
          console.log(
            `[Context Selection] Selected ${embeddingResult.selectedChapters.length} chapters using embedding ` +
            `(avg relevance: ${this.calculateAverageRelevance(embeddingResult.selectedChapters).toFixed(2)})`
          );
          return embeddingResult;
        }
      } catch (error) {
        console.log("[Context Selection] Embedding selection failed, falling back to heuristic");
      }
    }

    // Fallback to heuristic selection
    return this.selectByHeuristic(allChapters, allOutlines, options);
  }

  /**
   * Select chapters using embedding-based semantic similarity
   */
  private async selectByEmbedding(
    allChapters: Chapter[],
    allOutlines: Outline[],
    targetContext: string,
    options: ContextSelectionOptions
  ): Promise<ContextSelectionResult> {
    // Get target embedding
    const targetEmbedding = await aiService.getEmbedding(targetContext);
    if (!targetEmbedding) {
      throw new Error("Failed to get target embedding");
    }

    // Calculate relevance scores for all chapters
    const scoredChapters: ContextChapter[] = [];

    for (const chapter of allChapters) {
      const outline = allOutlines.find((o) => o.linkedChapterId === chapter.id);

      let chapterEmbedding: number[] | null = null;

      // 1. Try to use pre-calculated vector from database (FAST)
      if (chapter.contentVector) {
        chapterEmbedding = chapter.contentVector;
      }
      // 2. Fallback: Generate on-the-fly (SLOW)
      else {
        // Only generate if we really have to (e.g. very recent chapter not yet vectorized)
        // And only if it has content
        const chapterText = this.buildChapterText(chapter, outline);
        if (chapterText.length > 50) { // Skip empty/short chapters
          try {
            chapterEmbedding = await aiService.getEmbedding(chapterText);
          } catch (e) {
            console.warn(`[Context Selection] Failed to generate embedding for chapter ${chapter.id}:`, e);
          }
        }
      }

      if (!chapterEmbedding) {
        continue;
      }

      // Calculate semantic similarity
      const similarity = this.cosineSimilarity(targetEmbedding, chapterEmbedding);

      // Boost score for recent chapters if prioritized
      let relevanceScore = similarity;
      if (options.prioritizeRecent) {
        const recencyBoost = this.calculateRecencyBoost(
          chapter.orderIndex,
          allChapters.length
        );
        relevanceScore = similarity * 0.7 + recencyBoost * 0.3;
      }

      // Boost score for chapters with key beats
      if (options.includeKeyBeats && outline) {
        const plotNodes = outline.plotNodes as any;
        if (plotNodes?.beats && plotNodes.beats.length > 0) {
          relevanceScore *= 1.1; // 10% boost
        }
      }

      scoredChapters.push({
        chapter,
        outline,
        relevanceScore,
        reason: `Semantic similarity: ${similarity.toFixed(2)}`,
      });
    }

    // Sort by relevance score
    scoredChapters.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Filter by minimum relevance
    const relevantChapters = scoredChapters.filter(
      (c) => c.relevanceScore >= this.MIN_RELEVANCE_SCORE
    );

    // Select top chapters within token budget
    const selected = this.selectWithinBudget(
      relevantChapters,
      options.maxCount,
      options.tokenBudget
    );

    // Sort selected chapters by orderIndex (ascending) to maintain chronological order
    selected.sort((a, b) => a.chapter.orderIndex - b.chapter.orderIndex);

    // Build context text
    const contextText = this.buildContextText(selected);
    const totalTokens = this.estimateTokens(contextText);

    return {
      selectedChapters: selected,
      contextText,
      totalTokens,
      selectionMethod: "embedding",
    };
  }

  /**
   * Select chapters using heuristic rules (fallback)
   */
  private selectByHeuristic(
    allChapters: Chapter[],
    allOutlines: Outline[],
    options: ContextSelectionOptions
  ): Promise<ContextSelectionResult> {
    const scoredChapters: ContextChapter[] = [];

    for (const chapter of allChapters) {
      const outline = allOutlines.find((o) => o.linkedChapterId === chapter.id);

      // Calculate heuristic score
      let score = 0;

      // Recency score (most important in heuristic mode)
      const recencyScore = this.calculateRecencyBoost(
        chapter.orderIndex,
        allChapters.length
      );
      score += recencyScore * 0.6;

      // Key beats score
      if (options.includeKeyBeats && outline) {
        const plotNodes = outline.plotNodes as any;
        if (plotNodes?.beats && plotNodes.beats.length > 0) {
          score += 0.2;
        }
      }

      // Exit state score (important for continuity)
      if (outline) {
        const plotNodes = outline.plotNodes as any;
        if (plotNodes?.exitState) {
          score += 0.2;
        }
      }

      scoredChapters.push({
        chapter,
        outline,
        relevanceScore: score,
        reason: "Heuristic: recency + key beats",
      });
    }

    // Sort by score
    scoredChapters.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Select within budget
    const selected = this.selectWithinBudget(
      scoredChapters,
      options.maxCount,
      options.tokenBudget
    );

    // Sort selected chapters by orderIndex (ascending) to maintain chronological order
    selected.sort((a, b) => a.chapter.orderIndex - b.chapter.orderIndex);

    // Build context text
    const contextText = this.buildContextText(selected);
    const totalTokens = this.estimateTokens(contextText);

    console.log(
      `[Context Selection] Selected ${selected.length} chapters using heuristic ` +
      `(avg score: ${this.calculateAverageRelevance(selected).toFixed(2)})`
    );

    return Promise.resolve({
      selectedChapters: selected,
      contextText,
      totalTokens,
      selectionMethod: "heuristic",
    });
  }

  /**
   * Select chapters within token budget
   */
  private selectWithinBudget(
    scoredChapters: ContextChapter[],
    maxCount: number,
    tokenBudget: number
  ): ContextChapter[] {
    const selected: ContextChapter[] = [];
    let currentTokens = 0;

    for (const contextChapter of scoredChapters) {
      if (selected.length >= maxCount) {
        break;
      }

      const chapterText = this.buildChapterText(
        contextChapter.chapter,
        contextChapter.outline
      );
      const chapterTokens = this.estimateTokens(chapterText);

      if (currentTokens + chapterTokens <= tokenBudget) {
        selected.push(contextChapter);
        currentTokens += chapterTokens;
      }
    }

    return selected;
  }

  /**
   * Build text representation of a chapter for embedding
   */
  private buildChapterText(chapter: Chapter, outline?: Outline): string {
    let text = chapter.title;

    if (outline) {
      const plotNodes = outline.plotNodes as any;

      // Add one-liner (most important)
      if (plotNodes?.oneLiner) {
        text += `\n${plotNodes.oneLiner}`;
      }

      // Add key beats
      if (plotNodes?.beats && plotNodes.beats.length > 0) {
        text += `\n节拍：${plotNodes.beats.slice(0, 3).join("；")}`;
      }

      // Add stakes delta
      if (plotNodes?.stakesDelta) {
        text += `\n影响：${plotNodes.stakesDelta}`;
      }

      // Add exit state
      if (plotNodes?.exitState) {
        text += `\n结束状态：${plotNodes.exitState}`;
      }
    } else if (chapter.content) {
      // Fallback to content summary
      text += `\n${chapter.content.substring(0, 200)}`;
    }

    return text;
  }

  /**
   * Build formatted context text from selected chapters
   */
  private buildContextText(selectedChapters: ContextChapter[]): string {
    return selectedChapters
      .map((contextChapter) => {
        const { chapter, outline } = contextChapter;
        let context = `${chapter.title}`;

        if (outline) {
          const plotNodes = outline.plotNodes as any;

          if (plotNodes?.oneLiner) {
            context += `\n  概括：${plotNodes.oneLiner}`;
          }

          if (plotNodes?.beats && plotNodes.beats.length > 0) {
            context += `\n  节拍：${plotNodes.beats.slice(0, 2).join("；")}`;
          }

          if (plotNodes?.stakesDelta) {
            context += `\n  影响：${plotNodes.stakesDelta}`;
          }

          if (plotNodes?.exitState) {
            context += `\n  结束状态：${plotNodes.exitState}`;
          }
        } else if (chapter.content) {
          context += `\n  内容：${chapter.content.substring(0, 150)}`;
        }

        return context;
      })
      .join("\n\n");
  }

  /**
   * Calculate recency boost (0-1)
   * More recent chapters get higher scores
   */
  private calculateRecencyBoost(chapterIndex: number, totalChapters: number): number {
    if (totalChapters <= 1) return 1;

    // Linear decay: most recent = 1.0, oldest = 0.3
    const position = chapterIndex / (totalChapters - 1);
    return 0.3 + position * 0.7;
  }

  /**
   * Calculate cosine similarity between two vectors
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
   * Estimate token count from text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length * this.TOKENS_PER_CHAR);
  }

  /**
   * Calculate average relevance score
   */
  private calculateAverageRelevance(chapters: ContextChapter[]): number {
    if (chapters.length === 0) return 0;
    const sum = chapters.reduce((acc, c) => acc + c.relevanceScore, 0);
    return sum / chapters.length;
  }

  /**
   * Select key chapters for volume context
   * Focuses on chapters with major plot developments
   */
  async selectKeyChaptersForVolume(
    allChapters: Chapter[],
    allOutlines: Outline[],
    volumeTheme: string,
    options: Partial<ContextSelectionOptions> = {}
  ): Promise<ContextSelectionResult> {
    const defaultOptions: ContextSelectionOptions = {
      maxCount: 5,
      tokenBudget: 1000,
      prioritizeRecent: true,
      includeKeyBeats: true,
      useEmbedding: true,
      ...options,
    };

    return this.selectRelevantChapters(
      allChapters,
      allOutlines,
      `卷主题：${volumeTheme}，需要选择关键章节作为上下文`,
      defaultOptions
    );
  }

  /**
   * Select recent chapters for chapter append
   * Focuses on narrative continuity
   */
  async selectRecentChaptersForAppend(
    allChapters: Chapter[],
    allOutlines: Outline[],
    nextChapterPurpose: string,
    options: Partial<ContextSelectionOptions> = {}
  ): Promise<ContextSelectionResult> {
    const defaultOptions: ContextSelectionOptions = {
      maxCount: 5,
      tokenBudget: 1200,
      prioritizeRecent: true,
      includeKeyBeats: false,
      useEmbedding: true,
      ...options,
    };

    return this.selectRelevantChapters(
      allChapters,
      allOutlines,
      `下一章目的：${nextChapterPurpose}，需要选择相关章节保持叙事连贯`,
      defaultOptions
    );
  }
}

export const contextSelectionService = new ContextSelectionService();
