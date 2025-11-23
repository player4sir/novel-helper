// AI Performance Optimizer
// Optimizes AI call performance through parallelization and prompt optimization

import { aiService } from "./ai-service";
import type { ProjectMeta, ProjectSeed } from "./enhanced-project-creation-service";

interface AICallOptions {
  prompt: string;
  modelId: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

interface ParallelGenerationOptions {
  count: number;
  diversityFactor?: number;
  maxConcurrent?: number;
  onProgress?: (completed: number, total: number) => void;
}

/**
 * AIPerformanceOptimizer - Optimizes AI call performance
 */
export class AIPerformanceOptimizer {
  private readonly DEFAULT_MAX_CONCURRENT = 3;
  private readonly DEFAULT_DIVERSITY_FACTOR = 0.1;

  /**
   * Generate multiple candidates in parallel
   * Limits concurrency to avoid overwhelming the API
   */
  async generateCandidatesParallel(
    baseOptions: AICallOptions,
    options: ParallelGenerationOptions
  ): Promise<any[]> {
    const {
      count,
      diversityFactor = this.DEFAULT_DIVERSITY_FACTOR,
      maxConcurrent = this.DEFAULT_MAX_CONCURRENT,
      onProgress,
    } = options;

    console.log(`[AIOptimizer] Generating ${count} candidates with max ${maxConcurrent} concurrent calls`);

    const results: any[] = [];
    const errors: Error[] = [];
    let completed = 0;

    // Create batches for parallel execution
    const batches = this.createBatches(count, maxConcurrent);

    for (const batch of batches) {
      // Execute batch in parallel
      const batchPromises = batch.map(async (index) => {
        try {
          // Vary temperature for diversity
          const temperature = (baseOptions.temperature || 0.7) + index * diversityFactor;

          const result = await aiService.generate({
            prompt: baseOptions.prompt,
            modelId: baseOptions.modelId,
            provider: baseOptions.provider,
            baseUrl: baseOptions.baseUrl || "",
            apiKey: baseOptions.apiKey,
            parameters: {
              temperature: Math.min(temperature, 1.0), // Cap at 1.0
              maxTokens: baseOptions.maxTokens || 2000,
            },
            responseFormat: "json",
          });

          completed++;
          onProgress?.(completed, count);

          return { success: true, result, index };
        } catch (error: any) {
          completed++;
          onProgress?.(completed, count);

          console.error(`[AIOptimizer] Candidate ${index} failed:`, error.message);
          errors.push(error);
          return { success: false, error, index };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Collect successful results
      for (const item of batchResults) {
        if (item.success) {
          results.push(item.result);
        }
      }
    }

    console.log(`[AIOptimizer] Generated ${results.length}/${count} candidates successfully`);

    if (results.length === 0 && errors.length > 0) {
      throw new Error(`All candidate generation failed. Last error: ${errors[errors.length - 1].message}`);
    }

    return results;
  }

  /**
   * Optimize prompt length while preserving key information
   * Uses intelligent truncation and summarization
   */
  optimizePromptLength(prompt: string, maxLength: number = 4000): string {
    if (prompt.length <= maxLength) {
      return prompt;
    }

    console.log(`[AIOptimizer] Optimizing prompt from ${prompt.length} to ~${maxLength} chars`);

    // Split prompt into sections
    const sections = this.parsePromptSections(prompt);

    // Prioritize sections
    const prioritized = this.prioritizeSections(sections);

    // Build optimized prompt
    let optimized = "";
    let currentLength = 0;

    for (const section of prioritized) {
      const sectionLength = section.content.length;

      if (currentLength + sectionLength <= maxLength) {
        // Add full section
        optimized += section.content + "\n\n";
        currentLength += sectionLength + 2;
      } else {
        // Truncate section to fit
        const remaining = maxLength - currentLength;
        if (remaining > 100) {
          // Only add if we have meaningful space
          const truncated = this.truncateSection(section.content, remaining);
          optimized += truncated + "\n\n";
        }
        break;
      }
    }

    console.log(`[AIOptimizer] Optimized prompt length: ${optimized.length}`);

    return optimized.trim();
  }

  /**
   * Batch retry failed AI calls with exponential backoff
   */
  async retryFailedCalls(
    failedCalls: AICallOptions[],
    maxRetries: number = 3
  ): Promise<any[]> {
    const results: any[] = [];

    for (const call of failedCalls) {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Exponential backoff
          if (attempt > 0) {
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[AIOptimizer] Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await this.sleep(delay);
          }

          const result = await aiService.generate({
            prompt: call.prompt,
            modelId: call.modelId,
            provider: call.provider,
            baseUrl: call.baseUrl || "",
            apiKey: call.apiKey,
            parameters: {
              temperature: call.temperature || 0.7,
              maxTokens: call.maxTokens || 2000,
            },
            responseFormat: "json",
          });

          results.push(result);
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          console.error(`[AIOptimizer] Retry attempt ${attempt + 1} failed:`, error.message);
        }
      }

      if (lastError && results.length === 0) {
        throw lastError;
      }
    }

    return results;
  }

  /**
   * Estimate token count for prompt optimization
   */
  estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English/Chinese mixed text
    return Math.ceil(text.length / 4);
  }

  /**
   * Compress prompt by removing redundant information
   */
  compressPrompt(prompt: string): string {
    let compressed = prompt;

    // Remove excessive whitespace
    compressed = compressed.replace(/\n{3,}/g, "\n\n");
    compressed = compressed.replace(/[ \t]{2,}/g, " ");

    // Remove redundant phrases
    const redundantPhrases = [
      /请注意[：:]/g,
      /需要注意的是[：:]/g,
      /特别说明[：:]/g,
    ];

    for (const pattern of redundantPhrases) {
      compressed = compressed.replace(pattern, "");
    }

    return compressed.trim();
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Create batches for parallel execution
   */
  private createBatches(total: number, batchSize: number): number[][] {
    const batches: number[][] = [];
    for (let i = 0; i < total; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, total); j++) {
        batch.push(j);
      }
      batches.push(batch);
    }
    return batches;
  }

  /**
   * Parse prompt into sections
   */
  private parsePromptSections(prompt: string): Array<{ type: string; content: string; priority: number }> {
    const sections: Array<{ type: string; content: string; priority: number }> = [];

    // Split by common section markers
    const parts = prompt.split(/\n(?=#|##|###|\*\*)/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Determine section type and priority
      let type = "general";
      let priority = 5;

      if (trimmed.startsWith("# ") || trimmed.startsWith("## ")) {
        type = "header";
        priority = 10;
      } else if (trimmed.includes("要求") || trimmed.includes("规则")) {
        type = "requirements";
        priority = 9;
      } else if (trimmed.includes("示例") || trimmed.includes("例子")) {
        type = "examples";
        priority = 3;
      } else if (trimmed.includes("背景") || trimmed.includes("上下文")) {
        type = "context";
        priority = 7;
      }

      sections.push({ type, content: trimmed, priority });
    }

    return sections;
  }

  /**
   * Prioritize sections by importance
   */
  private prioritizeSections(
    sections: Array<{ type: string; content: string; priority: number }>
  ): Array<{ type: string; content: string; priority: number }> {
    return sections.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Truncate section intelligently
   */
  private truncateSection(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Try to truncate at sentence boundary
    const truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf("。");
    const lastNewline = truncated.lastIndexOf("\n");

    const cutPoint = Math.max(lastPeriod, lastNewline);

    if (cutPoint > maxLength * 0.7) {
      // Good cut point found
      return truncated.substring(0, cutPoint + 1) + "...";
    }

    // No good cut point, just truncate
    return truncated + "...";
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const aiPerformanceOptimizer = new AIPerformanceOptimizer();
