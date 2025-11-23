// Candidate Merger Service
// Intelligently merges multiple candidate project metadata

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { extractJSON } from "./utils/json-extractor";
import type { ProjectContext } from "./character-generator";
import type { QualityScore } from "./quality-scorer";
import type { InnovationScore } from "./innovation-evaluator";

// Types
export type MergeStrategy = "llm" | "heuristic" | "hybrid";

export interface ScoredCandidate {
  candidate: ProjectMeta;
  qualityScore: QualityScore;
  innovationScore: InnovationScore;
  totalScore: number;
}

export interface ProjectMeta {
  title: string;
  premise: string;
  themeTags?: string[];
  toneProfile?: string;
  coreConflicts?: string[];
  mainEntities?: any[];
  worldRules?: string[];
  keywords?: string[];
}

/**
 * CandidateMerger - Intelligently merges candidate solutions
 */
export class CandidateMerger {
  /**
   * Merge candidates using specified strategy
   */
  async mergeCandidates(
    candidates: ScoredCandidate[],
    strategy: MergeStrategy,
    context: ProjectContext
  ): Promise<ProjectMeta> {
    console.log(`[CandidateMerger] Merging ${candidates.length} candidates using ${strategy} strategy`);

    if (candidates.length === 0) {
      throw new Error("No candidates to merge");
    }

    if (candidates.length === 1) {
      return candidates[0].candidate;
    }

    // Sort by total score
    const sorted = [...candidates].sort((a, b) => b.totalScore - a.totalScore);

    switch (strategy) {
      case "llm":
        return await this.llmMerge(sorted, context);
      case "heuristic":
        return this.heuristicMerge(sorted);
      case "hybrid":
        // Try LLM first, fallback to heuristic
        try {
          return await this.llmMerge(sorted, context);
        } catch (error) {
          console.warn("[CandidateMerger] LLM merge failed, falling back to heuristic");
          return this.heuristicMerge(sorted);
        }
      default:
        throw new Error(`Unknown merge strategy: ${strategy}`);
    }
  }

  /**
   * LLM-based intelligent merge
   */
  async llmMerge(
    candidates: ScoredCandidate[],
    context: ProjectContext
  ): Promise<ProjectMeta> {
    console.log("[CandidateMerger] Performing LLM merge");

    // Build merge prompt
    const prompt = this.buildMergePrompt(candidates, context);

    // Get AI model
    const models = await storage.getAIModels();
    const defaultModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    if (!defaultModel) {
      throw new Error("No default chat model configured");
    }

    // Generate merged result
    const result = await aiService.generate({
      prompt,
      modelId: defaultModel.modelId,
      provider: defaultModel.provider,
      baseUrl: defaultModel.baseUrl || "",
      apiKey: defaultModel.apiKey || undefined,
      parameters: {
        temperature: 0.7,
        maxTokens: 2000,
      },
      responseFormat: "json",
    });

    // Parse result
    const merged = extractJSON(result.content);

    return merged as ProjectMeta;
  }

  /**
   * Heuristic-based merge (fallback)
   */
  heuristicMerge(candidates: ScoredCandidate[]): ProjectMeta {
    console.log("[CandidateMerger] Performing heuristic merge");

    // Take best candidate as base
    const best = candidates[0].candidate;

    // Merge fields from other candidates
    const merged: ProjectMeta = {
      title: this.selectBestTitle(candidates),
      premise: this.selectBestPremise(candidates),
      themeTags: this.mergeThemeTags(candidates),
      toneProfile: this.selectBestToneProfile(candidates),
      coreConflicts: this.mergeCoreConflicts(candidates),
      mainEntities: this.mergeMainEntities(candidates),
      worldRules: this.mergeWorldRules(candidates),
      keywords: this.mergeKeywords(candidates),
    };

    return merged;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build LLM merge prompt
   */
  private buildMergePrompt(
    candidates: ScoredCandidate[],
    context: ProjectContext
  ): string {
    const candidateDescriptions = candidates.map((c, i) => {
      return `
## 候选方案 ${i + 1} (评分: ${c.totalScore.toFixed(1)})

**标题**: ${c.candidate.title}

**简介**: ${c.candidate.premise}

**主题标签**: ${c.candidate.themeTags?.join("、") || "无"}

**基调**: ${c.candidate.toneProfile || "无"}

**核心冲突**: 
${c.candidate.coreConflicts?.map((conf, idx) => `${idx + 1}. ${conf}`).join("\n") || "无"}

**角色数量**: ${c.candidate.mainEntities?.length || 0}

**世界规则数量**: ${c.candidate.worldRules?.length || 0}

**质量评分**: 
- 完整性: ${c.qualityScore.dimensions.completeness.toFixed(1)}
- 一致性: ${c.qualityScore.dimensions.consistency.toFixed(1)}
- 丰富度: ${c.qualityScore.dimensions.richness.toFixed(1)}

**创新性评分**: ${c.innovationScore.overall.toFixed(1)}
`;
    }).join("\n---\n");

    return `你是一位资深的小说策划专家。请智能合并以下候选方案，综合各方案的优点，生成一个最优的项目元数据。

# 原始需求
${context.title ? `标题种子：${context.title}` : ""}
${context.premise ? `简介：${context.premise}` : ""}
${context.genre ? `类型：${context.genre}` : ""}

# 候选方案
${candidateDescriptions}

# 合并要求

1. **综合优点**：从各候选方案中选择最好的元素
2. **保持一致性**：确保合并后的内容逻辑自洽
3. **优先高分**：优先采用评分高的方案的核心设定
4. **创新优先**：在质量相近时，选择更有创新性的设定
5. **完整性**：确保所有必需字段都有内容

# 输出格式

请严格按照以下JSON格式输出（所有内容使用中文）：

{
  "title": "合并后的标题（选择最吸引人的）",
  "premise": "合并后的简介（200-300字，综合各方案优点）",
  "themeTags": ["主题1", "主题2", "主题3"],
  "toneProfile": "基调描述",
  "coreConflicts": ["冲突1", "冲突2", "冲突3"],
  "mainEntities": [
    {
      "name": "角色名",
      "role": "角色定位",
      "motivation": "动机",
      "personality": "性格",
      "background": "背景"
    }
  ],
  "worldRules": ["规则1", "规则2"],
  "keywords": ["关键词1", "关键词2", "关键词3"]
}

**重要**：
- 选择最有吸引力的标题
- 简介要综合各方案的精华
- 冲突要选择最有张力的
- 角色要选择设定最完整的
- 确保内容的一致性和创新性`;
  }

  /**
   * Select best title
   */
  private selectBestTitle(candidates: ScoredCandidate[]): string {
    // Prefer title from highest scored candidate
    return candidates[0].candidate.title;
  }

  /**
   * Select best premise
   */
  private selectBestPremise(candidates: ScoredCandidate[]): string {
    // Select longest premise from top candidates
    const topCandidates = candidates.slice(0, 3);
    const sorted = topCandidates.sort((a, b) => 
      (b.candidate.premise?.length || 0) - (a.candidate.premise?.length || 0)
    );
    return sorted[0].candidate.premise;
  }

  /**
   * Merge theme tags
   */
  private mergeThemeTags(candidates: ScoredCandidate[]): string[] {
    const allTags = new Set<string>();
    
    for (const candidate of candidates) {
      if (candidate.candidate.themeTags) {
        for (const tag of candidate.candidate.themeTags) {
          allTags.add(tag);
        }
      }
    }

    // Return top 5 most common tags
    return Array.from(allTags).slice(0, 5);
  }

  /**
   * Select best tone profile
   */
  private selectBestToneProfile(candidates: ScoredCandidate[]): string {
    // Prefer from highest scored candidate
    for (const candidate of candidates) {
      if (candidate.candidate.toneProfile) {
        return candidate.candidate.toneProfile;
      }
    }
    return "";
  }

  /**
   * Merge core conflicts
   */
  private mergeCoreConflicts(candidates: ScoredCandidate[]): string[] {
    const conflicts: Array<{ text: string; score: number }> = [];

    for (const candidate of candidates) {
      if (candidate.candidate.coreConflicts) {
        for (const conflict of candidate.candidate.coreConflicts) {
          conflicts.push({
            text: conflict,
            score: candidate.totalScore,
          });
        }
      }
    }

    // Sort by score and remove duplicates
    const sorted = conflicts.sort((a, b) => b.score - a.score);
    const unique = new Set<string>();
    const result: string[] = [];

    for (const conflict of sorted) {
      if (!unique.has(conflict.text) && result.length < 5) {
        unique.add(conflict.text);
        result.push(conflict.text);
      }
    }

    return result;
  }

  /**
   * Merge main entities
   */
  private mergeMainEntities(candidates: ScoredCandidate[]): any[] {
    // Take entities from best candidate
    const best = candidates[0].candidate;
    return best.mainEntities || [];
  }

  /**
   * Merge world rules
   */
  private mergeWorldRules(candidates: ScoredCandidate[]): string[] {
    const rules: Array<{ text: string; score: number }> = [];

    for (const candidate of candidates) {
      if (candidate.candidate.worldRules) {
        for (const rule of candidate.candidate.worldRules) {
          rules.push({
            text: rule,
            score: candidate.totalScore,
          });
        }
      }
    }

    // Sort by score and remove duplicates
    const sorted = rules.sort((a, b) => b.score - a.score);
    const unique = new Set<string>();
    const result: string[] = [];

    for (const rule of sorted) {
      if (!unique.has(rule.text) && result.length < 5) {
        unique.add(rule.text);
        result.push(rule.text);
      }
    }

    return result;
  }

  /**
   * Merge keywords
   */
  private mergeKeywords(candidates: ScoredCandidate[]): string[] {
    const allKeywords = new Set<string>();
    
    for (const candidate of candidates) {
      if (candidate.candidate.keywords) {
        for (const keyword of candidate.candidate.keywords) {
          allKeywords.add(keyword);
        }
      }
    }

    // Return top 8 keywords
    return Array.from(allKeywords).slice(0, 8);
  }
}

// Export singleton instance
export const candidateMerger = new CandidateMerger();
