// Prompt Packing Service - Dynamic Token Budget Management
// Implements the PromptPacking algorithm from the design document

import crypto from "crypto";

export interface PromptModule {
  id: string;
  priority: "must-have" | "important" | "optional";
  content: string;
  estimatedTokens: number;
  compressible: boolean;
}

export interface PackedPrompt {
  promptText: string;
  metadata: {
    modules: Array<{
      id: string;
      status: "included" | "compressed" | "omitted";
      compressionType?: "summary" | "state-vector" | "content-hash";
      sourceHash?: string;
      originalTokens?: number;
      finalTokens?: number;
    }>;
    totalTokens: number;
    budgetUsed: number;
  };
  semanticSignature: string;
}

export class PromptPackingService {
  private readonly CHARS_PER_TOKEN = 3.5; // Approximate for Chinese text
  private readonly COMPRESSION_RATIO = 0.3; // Compress to 30% of original

  /**
   * Pack prompt modules within token budget
   * Implements the pack_prompt algorithm from design document
   */
  async packPrompt(
    modules: PromptModule[],
    maxBudget: number
  ): Promise<PackedPrompt> {
    // Sort by priority
    const sortedModules = this.sortByPriority(modules);
    
    let currentTokens = 0;
    const includedModules: string[] = [];
    const metadata: PackedPrompt["metadata"]["modules"] = [];

    for (const module of sortedModules) {
      const moduleTokens = this.estimateTokens(module.content);
      
      // Try to include as-is
      if (currentTokens + moduleTokens <= maxBudget) {
        includedModules.push(module.content);
        metadata.push({
          id: module.id,
          status: "included",
          originalTokens: moduleTokens,
          finalTokens: moduleTokens,
        });
        currentTokens += moduleTokens;
        continue;
      }

      // Try to compress if compressible
      if (module.compressible && module.priority !== "must-have") {
        const remainingBudget = maxBudget - currentTokens;
        const compressed = this.compressBestFit(module.content, remainingBudget);
        const compressedTokens = this.estimateTokens(compressed.content);

        if (compressedTokens <= remainingBudget && compressedTokens > 0) {
          includedModules.push(compressed.content);
          metadata.push({
            id: module.id,
            status: "compressed",
            compressionType: compressed.type,
            sourceHash: this.hashContent(module.content),
            originalTokens: moduleTokens,
            finalTokens: compressedTokens,
          });
          currentTokens += compressedTokens;
          continue;
        }
      }

      // Must omit if can't fit
      if (module.priority === "must-have") {
        // For must-have modules, force compression even if quality suffers
        const compressed = this.compressBestFit(
          module.content,
          Math.floor(maxBudget * 0.2) // Use up to 20% of budget
        );
        includedModules.push(compressed.content);
        metadata.push({
          id: module.id,
          status: "compressed",
          compressionType: compressed.type,
          sourceHash: this.hashContent(module.content),
          originalTokens: moduleTokens,
          finalTokens: this.estimateTokens(compressed.content),
        });
        currentTokens += this.estimateTokens(compressed.content);
      } else {
        // Omit optional/important modules if no space
        metadata.push({
          id: module.id,
          status: "omitted",
          sourceHash: this.hashContent(module.content),
          originalTokens: moduleTokens,
        });
      }
    }

    const promptText = includedModules.join("\n\n");
    const semanticSignature = this.generateSemanticSignature(promptText);

    return {
      promptText,
      metadata: {
        modules: metadata,
        totalTokens: currentTokens,
        budgetUsed: currentTokens / maxBudget,
      },
      semanticSignature,
    };
  }

  /**
   * Compress content to fit within budget
   */
  private compressBestFit(
    content: string,
    targetTokens: number
  ): { content: string; type: "summary" | "state-vector" | "content-hash" } {
    const currentTokens = this.estimateTokens(content);

    // If content is very small, use content-hash
    if (targetTokens < 10) {
      return {
        content: `[内容摘要: ${this.hashContent(content).substring(0, 16)}...]`,
        type: "content-hash",
      };
    }

    // If need moderate compression, use summary
    if (targetTokens >= currentTokens * this.COMPRESSION_RATIO) {
      const targetChars = Math.floor(targetTokens * this.CHARS_PER_TOKEN);
      const summary = this.extractSummary(content, targetChars);
      return {
        content: summary,
        type: "summary",
      };
    }

    // If need heavy compression, use state-vector (key points only)
    const stateVector = this.extractStateVector(content);
    return {
      content: stateVector,
      type: "state-vector",
    };
  }

  /**
   * Extract summary from content
   */
  private extractSummary(content: string, targetChars: number): string {
    // Simple extraction: take first sentences up to target
    const sentences = content.match(/[^。！？]+[。！？]/g) || [content];
    let summary = "";
    
    for (const sentence of sentences) {
      if ((summary + sentence).length <= targetChars) {
        summary += sentence;
      } else {
        break;
      }
    }

    return summary || sentences[0].substring(0, targetChars) + "...";
  }

  /**
   * Extract state vector (key points only)
   */
  private extractStateVector(content: string): string {
    // Extract key information: names, numbers, key phrases
    const lines = content.split("\n").filter((l) => l.trim());
    const keyPoints: string[] = [];

    for (const line of lines) {
      // Extract lines with key markers
      if (
        line.includes("：") ||
        line.includes(":") ||
        /^\d+\./.test(line) ||
        line.startsWith("- ") ||
        line.startsWith("• ")
      ) {
        keyPoints.push(line.trim());
      }
    }

    return keyPoints.length > 0
      ? keyPoints.slice(0, 5).join("\n")
      : content.substring(0, 100) + "...";
  }

  /**
   * Sort modules by priority
   */
  private sortByPriority(modules: PromptModule[]): PromptModule[] {
    const priorityOrder = { "must-have": 0, important: 1, optional: 2 };
    return [...modules].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );
  }

  /**
   * Estimate token count from text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN);
  }

  /**
   * Generate semantic signature for caching
   */
  private generateSemanticSignature(text: string): string {
    // For now, use hash. In production, would use embedding vector
    return this.hashContent(text).substring(0, 32);
  }

  /**
   * Hash content
   */
  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}

export const promptPackingService = new PromptPackingService();
