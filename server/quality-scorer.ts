// Quality Scorer Service
// Multi-dimensional quality assessment for project metadata

import { aiService } from "./ai-service";
import { storage } from "./storage";
import type { Character, ProjectContext } from "./character-generator";
import type { WorldSetting } from "./world-generator";
import { innovationEvaluator } from "./innovation-evaluator";

// Types
export interface QualityScore {
  overall: number;  // 总分 0-100
  dimensions: {
    completeness: number;
    consistency: number;
    richness: number;
    writability: number;
    semanticQuality: number;
    innovation: number;
  };
  issues: QualityIssue[];
  suggestions: string[];
}

export interface QualityIssue {
  dimension: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion?: string;
}

export interface ProjectMeta {
  title: string;
  premise: string;
  themeTags?: string[];
  toneProfile?: string;
  coreConflicts?: string[];
  mainEntities?: Character[];
  worldRules?: string[];
  worldSettings?: WorldSetting;
  keywords?: string[];
}

/**
 * QualityScorer - Multi-dimensional quality assessment
 */
export class QualityScorer {
  /**
   * Score candidate with all dimensions
   */
  async scoreCandidate(
    candidate: ProjectMeta,
    context: ProjectContext
  ): Promise<QualityScore> {
    console.log("[QualityScorer] Scoring candidate");

    // Score each dimension
    const completeness = this.scoreCompleteness(candidate);
    const consistency = this.scoreConsistency(candidate);
    const richness = this.scoreRichness(candidate);
    const writability = this.scoreWritability(candidate);
    const semanticQuality = await this.scoreSemanticQuality(candidate);
    
    // Get innovation score
    const innovationScore = innovationEvaluator.evaluateInnovation(candidate);
    const innovation = innovationScore.overall;

    // Calculate overall score (weighted average)
    const overall = (
      completeness * 0.20 +
      consistency * 0.15 +
      richness * 0.15 +
      writability * 0.15 +
      semanticQuality * 0.20 +
      innovation * 0.15
    );

    // Identify issues
    const issues = this.identifyIssues({
      completeness,
      consistency,
      richness,
      writability,
      semanticQuality,
      innovation,
    }, candidate);

    // Generate suggestions
    const suggestions = this.generateSuggestions(issues, candidate);

    return {
      overall,
      dimensions: {
        completeness,
        consistency,
        richness,
        writability,
        semanticQuality,
        innovation,
      },
      issues,
      suggestions,
    };
  }

  /**
   * Score completeness (0-100)
   */
  scoreCompleteness(meta: ProjectMeta): number {
    let score = 0;

    // Required fields (40 points)
    score += meta.title && meta.title.length > 0 ? 10 : 0;
    score += meta.premise && meta.premise.length >= 50 ? 10 : 0;
    score += meta.themeTags && meta.themeTags.length >= 3 ? 10 : 0;
    score += meta.coreConflicts && meta.coreConflicts.length >= 2 ? 10 : 0;

    // Characters (30 points)
    if (meta.mainEntities && meta.mainEntities.length > 0) {
      score += Math.min(15, meta.mainEntities.length * 5);
      
      // Check protagonist (支持中英文)
      const hasProtagonist = meta.mainEntities.some(e => e.role === "主角" || e.role === "protagonist");
      score += hasProtagonist ? 15 : 0;
    }

    // World setting (20 points)
    if (meta.worldSettings) {
      score += 10;
      if (meta.worldSettings.rules && meta.worldSettings.rules.length >= 2) {
        score += 10;
      }
    } else if (meta.worldRules && meta.worldRules.length >= 2) {
      score += 15;
    }

    // Optional but valuable (10 points)
    score += meta.toneProfile && meta.toneProfile.length > 0 ? 5 : 0;
    score += meta.keywords && meta.keywords.length >= 5 ? 5 : 0;

    return Math.min(100, score);
  }

  /**
   * Score consistency (0-100)
   */
  scoreConsistency(meta: ProjectMeta): number {
    let score = 100; // Start with perfect score, deduct for issues

    // Check for duplicate entity names
    if (meta.mainEntities && meta.mainEntities.length > 0) {
      const names = meta.mainEntities.map(e => e.name);
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        score -= 20; // Duplicate names
      }
    }

    // Check premise length
    if (meta.premise && meta.premise.length < 50) {
      score -= 15; // Too short
    }

    // Check for empty or very short fields
    if (meta.mainEntities) {
      const emptyMotivations = meta.mainEntities.filter(
        e => !e.motivation || e.motivation.length < 10
      );
      score -= emptyMotivations.length * 10;
    }

    // Check theme-conflict alignment
    if (meta.themeTags && meta.coreConflicts) {
      const hasAlignment = this.checkThemeConflictAlignment(
        meta.themeTags,
        meta.coreConflicts
      );
      if (!hasAlignment) {
        score -= 10;
      }
    }

    // Check world rules consistency
    if (meta.worldSettings && meta.worldSettings.rules) {
      const conflicts = this.detectRuleConflicts(meta.worldSettings.rules);
      score -= conflicts * 15;
    }

    return Math.max(0, score);
  }

  /**
   * Score richness (0-100)
   */
  scoreRichness(meta: ProjectMeta): number {
    let score = 0;

    // Keyword richness (20 points)
    if (meta.keywords) {
      score += Math.min(20, meta.keywords.length * 3);
    }

    // Theme richness (20 points)
    if (meta.themeTags) {
      score += Math.min(20, meta.themeTags.length * 5);
    }

    // Conflict richness (20 points)
    if (meta.coreConflicts) {
      score += Math.min(20, meta.coreConflicts.length * 7);
    }

    // Character richness (20 points)
    if (meta.mainEntities) {
      score += Math.min(20, meta.mainEntities.length * 5);
    }

    // World richness (20 points)
    if (meta.worldSettings) {
      let worldScore = 0;
      if (meta.worldSettings.powerSystem) worldScore += 5;
      if (meta.worldSettings.factions) worldScore += 5;
      if (meta.worldSettings.geography) worldScore += 5;
      if (meta.worldSettings.rules) worldScore += Math.min(5, meta.worldSettings.rules.length);
      score += worldScore;
    } else if (meta.worldRules) {
      score += Math.min(20, meta.worldRules.length * 5);
    }

    return Math.min(100, score);
  }

  /**
   * Score writability (0-100)
   */
  scoreWritability(meta: ProjectMeta): number {
    let score = 50; // Base score

    // Check for clear conflicts (20 points)
    if (meta.coreConflicts && meta.coreConflicts.length >= 2) {
      score += 10;
      
      // Check conflict depth
      const deepConflicts = meta.coreConflicts.filter(c => c.length > 30);
      score += Math.min(10, deepConflicts.length * 5);
    }

    // Check character depth (20 points)
    if (meta.mainEntities && meta.mainEntities.length > 0) {
      const avgMotivationLength = meta.mainEntities.reduce(
        (sum, e) => sum + (e.motivation?.length || 0),
        0
      ) / meta.mainEntities.length;
      
      if (avgMotivationLength >= 30) {
        score += 10;
      }

      // Check for inner conflicts
      const withInnerConflict = meta.mainEntities.filter(
        e => e.innerConflict && e.innerConflict.length > 20
      );
      score += Math.min(10, withInnerConflict.length * 5);
    }

    // Check world complexity (10 points)
    if (meta.worldSettings) {
      if (meta.worldSettings.powerSystem) score += 5;
      if (meta.worldSettings.factions && meta.worldSettings.factions.length >= 2) {
        score += 5;
      }
    }

    // Check premise quality (10 points)
    if (meta.premise) {
      if (meta.premise.length >= 100 && meta.premise.length <= 300) {
        score += 10;
      } else if (meta.premise.length >= 50) {
        score += 5;
      }
    }

    return Math.min(100, score);
  }

  /**
   * Score semantic quality (0-100)
   */
  async scoreSemanticQuality(
    meta: ProjectMeta,
    embedding?: number[]
  ): Promise<number> {
    let score = 50; // Base score

    // If no embedding provided, try to generate one
    if (!embedding) {
      try {
        const models = await storage.getAIModels();
        const embeddingModel = models.find(
          m => m.modelType === "embedding" && m.isActive && m.isDefaultEmbedding
        );

        if (embeddingModel) {
          const textForEmbedding = `${meta.title} ${meta.premise}`;
          const result = await aiService.getEmbedding(textForEmbedding);
          if (result) {
            embedding = result;
          }
        }
      } catch (error) {
        console.warn("[QualityScorer] Failed to generate embedding:", error);
      }
    }

    // If still no embedding, return base score
    if (!embedding) {
      return score;
    }

    // Check character-conflict alignment
    if (meta.mainEntities && meta.coreConflicts) {
      const alignment = this.checkCharacterConflictAlignment(
        meta.mainEntities,
        meta.coreConflicts
      );
      score += alignment ? 20 : 0;
    }

    // Check world-conflict consistency
    if (meta.worldSettings && meta.coreConflicts) {
      const consistency = this.checkWorldConflictConsistency(
        meta.worldSettings,
        meta.coreConflicts
      );
      score += consistency ? 15 : 0;
    }

    // Check theme coherence
    if (meta.themeTags && meta.premise) {
      const coherence = this.checkThemeCoherence(meta.themeTags, meta.premise);
      score += coherence ? 15 : 0;
    }

    return Math.min(100, score);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Check theme-conflict alignment
   */
  private checkThemeConflictAlignment(
    themes: string[],
    conflicts: string[]
  ): boolean {
    const themeKeywords = themes.join(" ").toLowerCase();
    const conflictText = conflicts.join(" ").toLowerCase();

    // Simple keyword matching
    const commonWords = ["成长", "复仇", "爱情", "权力", "正义", "自由"];
    
    for (const word of commonWords) {
      if (themeKeywords.includes(word) && conflictText.includes(word)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detect rule conflicts
   */
  private detectRuleConflicts(rules: Array<{ content: string }>): number {
    let conflicts = 0;

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i].content.toLowerCase();
        const rule2 = rules[j].content.toLowerCase();

        // Simple conflict detection
        if (
          (rule1.includes("可以") && rule2.includes("不能")) ||
          (rule1.includes("允许") && rule2.includes("禁止"))
        ) {
          conflicts++;
        }
      }
    }

    return conflicts;
  }

  /**
   * Check character-conflict alignment
   */
  private checkCharacterConflictAlignment(
    characters: Character[],
    conflicts: string[]
  ): boolean {
    const conflictText = conflicts.join(" ").toLowerCase();

    // Check if character motivations align with conflicts
    for (const char of characters) {
      if (char.motivation) {
        const motivation = char.motivation.toLowerCase();
        
        // Check for keyword overlap
        const keywords = motivation.split(/\s+/).filter(w => w.length > 2);
        for (const keyword of keywords) {
          if (conflictText.includes(keyword)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check world-conflict consistency
   */
  private checkWorldConflictConsistency(
    world: WorldSetting,
    conflicts: string[]
  ): boolean {
    const conflictText = conflicts.join(" ").toLowerCase();

    // Check if world rules relate to conflicts
    if (world.rules) {
      for (const rule of world.rules) {
        const ruleContent = rule.content.toLowerCase();
        const keywords = ruleContent.split(/\s+/).filter(w => w.length > 2);
        
        for (const keyword of keywords) {
          if (conflictText.includes(keyword)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check theme coherence
   */
  private checkThemeCoherence(themes: string[], premise: string): boolean {
    const premiseLower = premise.toLowerCase();

    // Check if themes are reflected in premise
    for (const theme of themes) {
      if (premiseLower.includes(theme.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Identify quality issues
   */
  private identifyIssues(
    dimensions: Record<string, number>,
    meta: ProjectMeta
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // Check each dimension
    if (dimensions.completeness < 60) {
      issues.push({
        dimension: "completeness",
        severity: dimensions.completeness < 40 ? "high" : "medium",
        description: "项目元数据不完整，缺少必要字段",
        suggestion: "补充缺失的角色、冲突或世界观设定",
      });
    }

    if (dimensions.consistency < 60) {
      issues.push({
        dimension: "consistency",
        severity: dimensions.consistency < 40 ? "high" : "medium",
        description: "内容存在不一致或矛盾",
        suggestion: "检查角色名称、世界规则和主题冲突的一致性",
      });
    }

    if (dimensions.richness < 50) {
      issues.push({
        dimension: "richness",
        severity: "medium",
        description: "内容深度不足，细节较少",
        suggestion: "增加更多关键词、主题标签和角色细节",
      });
    }

    if (dimensions.writability < 50) {
      issues.push({
        dimension: "writability",
        severity: "medium",
        description: "可写性较低，缺乏足够的故事张力",
        suggestion: "深化角色动机和冲突设计",
      });
    }

    if (dimensions.innovation < 50) {
      issues.push({
        dimension: "innovation",
        severity: "low",
        description: "创新性不足，存在俗套设定",
        suggestion: "参考创新性评估的建议进行优化",
      });
    }

    return issues;
  }

  /**
   * Generate suggestions based on issues
   */
  private generateSuggestions(
    issues: QualityIssue[],
    meta: ProjectMeta
  ): string[] {
    const suggestions: string[] = [];

    // Add suggestions from issues
    for (const issue of issues) {
      if (issue.suggestion) {
        suggestions.push(issue.suggestion);
      }
    }

    // Add specific suggestions based on content
    if (!meta.mainEntities || meta.mainEntities.length < 3) {
      suggestions.push("建议增加更多角色以丰富故事");
    }

    if (!meta.coreConflicts || meta.coreConflicts.length < 2) {
      suggestions.push("建议设计至少2个核心冲突");
    }

    if (!meta.worldSettings && (!meta.worldRules || meta.worldRules.length < 2)) {
      suggestions.push("建议完善世界观设定，增加世界规则");
    }

    return suggestions;
  }
}

// Export singleton instance
export const qualityScorer = new QualityScorer();
