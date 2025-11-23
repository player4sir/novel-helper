// Innovation Evaluator Service
// Detects clichés and evaluates innovation in story concepts

import type { Character, ProjectContext } from "./character-generator";
import type { WorldSetting } from "./world-generator";

// Types
export interface InnovationScore {
  overall: number;  // 总分 0-100
  worldInnovation: number;
  characterInnovation: number;
  conflictInnovation: number;
  cliches: ClicheDetection[];
  suggestions: InnovationSuggestion[];
}

export interface ClicheDetection {
  type: string;
  location: string;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface InnovationSuggestion {
  target: string;  // 针对的内容
  suggestion: string;
  reasoning: string;
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

// Cliché pattern definition
interface ClichePattern {
  type: string;
  keywords: string[];
  severity: "low" | "medium" | "high";
  description: string;
  category: "character" | "world" | "conflict" | "plot";
}

/**
 * InnovationEvaluator - Evaluates innovation and detects clichés
 */
export class InnovationEvaluator {
  private clichePatterns: ClichePattern[] = [];

  constructor() {
    this.initializeClichePatterns();
  }

  /**
   * Evaluate overall innovation
   */
  evaluateInnovation(meta: ProjectMeta): InnovationScore {
    console.log("[InnovationEvaluator] Evaluating innovation");

    // Detect clichés
    const allContent = this.extractAllContent(meta);
    const cliches = this.detectCliches(allContent);

    // Evaluate dimensions
    const worldInnovation = meta.worldSettings 
      ? this.evaluateWorldUniqueness(meta.worldSettings)
      : 50;

    const characterInnovation = meta.mainEntities && meta.mainEntities.length > 0
      ? this.evaluateCharactersInnovation(meta.mainEntities)
      : 50;

    const conflictInnovation = meta.coreConflicts && meta.coreConflicts.length > 0
      ? this.evaluateConflictInnovation(meta.coreConflicts)
      : 50;

    // Calculate overall score
    // Penalize for clichés
    const clichePenalty = cliches.reduce((sum, c) => {
      return sum + (c.severity === "high" ? 15 : c.severity === "medium" ? 10 : 5);
    }, 0);

    const baseScore = (worldInnovation + characterInnovation + conflictInnovation) / 3;
    const overall = Math.max(0, Math.min(100, baseScore - clichePenalty));

    return {
      overall,
      worldInnovation,
      characterInnovation,
      conflictInnovation,
      cliches,
      suggestions: [], // Will be filled by generateInnovationSuggestions
    };
  }

  /**
   * Detect clichés in content
   */
  detectCliches(content: string): ClicheDetection[] {
    const detections: ClicheDetection[] = [];
    const lowerContent = content.toLowerCase();

    for (const pattern of this.clichePatterns) {
      // Check if any keyword matches
      const matchedKeywords = pattern.keywords.filter(keyword => 
        lowerContent.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        detections.push({
          type: pattern.type,
          location: pattern.category,
          severity: pattern.severity,
          description: pattern.description,
        });
      }
    }

    return detections;
  }

  /**
   * Generate innovation suggestions
   */
  async generateInnovationSuggestions(
    cliches: ClicheDetection[],
    context: ProjectContext
  ): Promise<InnovationSuggestion[]> {
    const suggestions: InnovationSuggestion[] = [];

    // Group clichés by type
    const clichesByType = new Map<string, ClicheDetection[]>();
    for (const cliche of cliches) {
      if (!clichesByType.has(cliche.type)) {
        clichesByType.set(cliche.type, []);
      }
      clichesByType.get(cliche.type)!.push(cliche);
    }

    // Generate suggestions for each type
    const entries = Array.from(clichesByType.entries());
    for (const [type, typeCliches] of entries) {
      const typeSuggestions = this.generateSuggestionsForType(type, typeCliches, context);
      suggestions.push(...typeSuggestions);
    }

    return suggestions;
  }

  /**
   * Evaluate world uniqueness
   */
  evaluateWorldUniqueness(world: WorldSetting): number {
    let score = 50; // Base score

    // Check for unique power system
    if (world.powerSystem) {
      const powerSystem = world.powerSystem;
      
      // Check if power system name is generic
      const genericNames = ["修真", "修仙", "武道", "魔法", "灵力"];
      const isGenericName = genericNames.some(name => 
        powerSystem.name.includes(name)
      );
      
      if (!isGenericName) {
        score += 10;
      }

      // Check for unique limitations
      if (powerSystem.limitations && powerSystem.limitations.length >= 2) {
        score += 10;
      }

      // Check for unique cultivation method
      if (powerSystem.cultivation && powerSystem.cultivation.length > 20) {
        const genericMethods = ["吸收灵气", "打坐修炼", "炼化真元"];
        const isGeneric = genericMethods.some(method => 
          powerSystem.cultivation!.includes(method)
        );
        if (!isGeneric) {
          score += 10;
        }
      }
    }

    // Check for unique world rules
    if (world.rules && world.rules.length > 0) {
      const uniqueRules = world.rules.filter(rule => {
        const commonRules = [
          "强者为尊",
          "实力至上",
          "弱肉强食",
          "修炼需要资源",
        ];
        return !commonRules.some(common => rule.content.includes(common));
      });

      score += Math.min(20, uniqueRules.length * 5);
    }

    // Check for unique factions
    if (world.factions && world.factions.length > 0) {
      const genericFactionTypes = ["正道", "魔道", "散修", "家族"];
      const uniqueFactions = world.factions.filter(faction => 
        !genericFactionTypes.some(generic => faction.type.includes(generic))
      );

      score += Math.min(10, uniqueFactions.length * 3);
    }

    return Math.min(100, score);
  }

  /**
   * Evaluate character complexity
   */
  evaluateCharacterComplexity(character: Character): number {
    let score = 50; // Base score

    // Check for inner conflict
    if (character.innerConflict && character.innerConflict.length > 20) {
      score += 15;
      
      // Check if it's not a generic conflict
      const genericConflicts = ["复仇", "正义", "善恶", "选择"];
      const isGeneric = genericConflicts.some(generic => 
        character.innerConflict.includes(generic)
      );
      if (!isGeneric) {
        score += 10;
      }
    }

    // Check for hidden goal
    if (character.hiddenGoal && character.hiddenGoal.length > 20) {
      score += 10;
    }

    // Check for growth path
    if (character.growthPath && character.growthPath.length > 50) {
      score += 10;
    }

    // Check motivation complexity
    if (character.motivation && character.motivation.length > 30) {
      const genericMotivations = ["变强", "复仇", "保护", "称霸"];
      const isGeneric = genericMotivations.some(generic => 
        character.motivation.includes(generic)
      );
      if (!isGeneric) {
        score += 15;
      }
    }

    return Math.min(100, score);
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize cliché patterns
   */
  private initializeClichePatterns(): void {
    // Character clichés
    this.clichePatterns.push(
      {
        type: "废材逆袭",
        keywords: ["废材", "废柴", "无法修炼", "被退婚", "逆袭"],
        severity: "high",
        description: "主角从废材变强的俗套设定",
        category: "character",
      },
      {
        type: "家族被灭",
        keywords: ["家族被灭", "灭门", "家破人亡", "血海深仇"],
        severity: "high",
        description: "家族被灭门的复仇动机",
        category: "character",
      },
      {
        type: "天赋异禀",
        keywords: ["天赋异禀", "天生神力", "万中无一", "绝世天才"],
        severity: "medium",
        description: "主角天赋超群的设定",
        category: "character",
      },
      {
        type: "穿越重生",
        keywords: ["穿越", "重生", "回到过去", "前世记忆"],
        severity: "medium",
        description: "穿越或重生的设定",
        category: "character",
      },
      {
        type: "神秘老爷爷",
        keywords: ["神秘老人", "戒指老爷爷", "传承", "上古强者"],
        severity: "high",
        description: "神秘老人传授功法的设定",
        category: "character",
      }
    );

    // World clichés
    this.clichePatterns.push(
      {
        type: "标准修仙体系",
        keywords: ["炼气", "筑基", "金丹", "元婴", "化神", "渡劫"],
        severity: "medium",
        description: "使用标准修仙境界体系",
        category: "world",
      },
      {
        type: "强者为尊",
        keywords: ["强者为尊", "实力至上", "弱肉强食", "拳头大就是道理"],
        severity: "low",
        description: "简单的强者为尊世界观",
        category: "world",
      },
      {
        type: "灵气复苏",
        keywords: ["灵气复苏", "末法时代", "灵气枯竭", "天地大变"],
        severity: "medium",
        description: "灵气复苏的世界设定",
        category: "world",
      }
    );

    // Conflict clichés
    this.clichePatterns.push(
      {
        type: "打脸升级",
        keywords: ["打脸", "装逼", "啪啪打脸", "狠狠打脸"],
        severity: "high",
        description: "打脸爽文套路",
        category: "conflict",
      },
      {
        type: "正邪对立",
        keywords: ["正邪大战", "正道魔道", "正邪不两立", "邪不压正"],
        severity: "low",
        description: "简单的正邪对立",
        category: "conflict",
      },
      {
        type: "争夺宝物",
        keywords: ["争夺宝物", "天材地宝", "神器出世", "宝物现世"],
        severity: "low",
        description: "围绕宝物的争夺",
        category: "conflict",
      }
    );

    // Plot clichés
    this.clichePatterns.push(
      {
        type: "奇遇连连",
        keywords: ["奇遇", "机缘", "掉下悬崖", "山洞秘籍"],
        severity: "medium",
        description: "主角不断获得奇遇",
        category: "plot",
      },
      {
        type: "美女倒贴",
        keywords: ["美女倒贴", "红颜知己", "佳人相伴", "美女如云"],
        severity: "medium",
        description: "美女主动追求主角",
        category: "plot",
      }
    );
  }

  /**
   * Extract all content from meta
   */
  private extractAllContent(meta: ProjectMeta): string {
    const parts: string[] = [
      meta.title,
      meta.premise,
      ...(meta.themeTags || []),
      meta.toneProfile || "",
      ...(meta.coreConflicts || []),
      ...(meta.worldRules || []),
      ...(meta.keywords || []),
    ];

    if (meta.mainEntities) {
      for (const entity of meta.mainEntities) {
        parts.push(
          entity.name,
          entity.role,
          entity.motivation,
          entity.personality || "",
          entity.background || "",
        );
      }
    }

    if (meta.worldSettings) {
      const world = meta.worldSettings;
      parts.push(world.genre);
      
      if (world.powerSystem) {
        parts.push(
          world.powerSystem.name,
          world.powerSystem.description,
          ...world.powerSystem.levels,
          ...(world.powerSystem.limitations || []),
        );
      }

      if (world.rules) {
        parts.push(...world.rules.map(r => r.content));
      }
    }

    return parts.join(" ");
  }

  /**
   * Evaluate characters innovation
   */
  private evaluateCharactersInnovation(characters: Character[]): number {
    if (characters.length === 0) return 50;

    const scores = characters.map(char => this.evaluateCharacterComplexity(char));
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  /**
   * Evaluate conflict innovation
   */
  private evaluateConflictInnovation(conflicts: string[]): number {
    let score = 50;

    // Check for generic conflicts
    const genericConflicts = [
      "正邪对立",
      "争夺宝物",
      "家族恩怨",
      "门派之争",
      "称霸武林",
    ];

    const uniqueConflicts = conflicts.filter(conflict => 
      !genericConflicts.some(generic => conflict.includes(generic))
    );

    score += Math.min(30, uniqueConflicts.length * 10);

    // Check for conflict complexity
    const complexConflicts = conflicts.filter(conflict => conflict.length > 30);
    score += Math.min(20, complexConflicts.length * 7);

    return Math.min(100, score);
  }

  /**
   * Generate suggestions for a specific cliché type
   */
  private generateSuggestionsForType(
    type: string,
    cliches: ClicheDetection[],
    context: ProjectContext
  ): InnovationSuggestion[] {
    const suggestions: InnovationSuggestion[] = [];

    // Predefined suggestions for common clichés
    const suggestionMap: Record<string, InnovationSuggestion[]> = {
      "废材逆袭": [
        {
          target: "角色设定",
          suggestion: "让主角有独特的能力或视角，而非简单的从弱变强",
          reasoning: "独特能力比单纯的实力提升更有吸引力",
        },
        {
          target: "成长路径",
          suggestion: "设计主角在某方面很强但在其他方面有明显短板",
          reasoning: "有缺陷的角色更真实，成长空间也更大",
        },
        {
          target: "动机设定",
          suggestion: "给主角一个超越变强的深层动机，如保护某种理念或寻找真相",
          reasoning: "复杂的动机让角色更有深度",
        },
      ],
      "家族被灭": [
        {
          target: "动机设定",
          suggestion: "让主角的目标不是简单的复仇，而是阻止类似悲剧再次发生",
          reasoning: "从复仇到救赎的转变更有深度",
        },
        {
          target: "冲突设计",
          suggestion: "设计一个道德困境：复仇对象可能有不得已的苦衷",
          reasoning: "灰色地带的冲突比黑白分明更有张力",
        },
        {
          target: "情节发展",
          suggestion: "让主角发现真相比想象的复杂，仇人可能只是棋子",
          reasoning: "层层揭秘的真相更吸引读者",
        },
      ],
      "标准修仙体系": [
        {
          target: "力量体系",
          suggestion: "创造一个基于情感、记忆或其他非传统元素的力量体系",
          reasoning: "独特的力量来源让世界观更有特色",
        },
        {
          target: "修炼方式",
          suggestion: "设计修炼需要付出代价或有副作用，而非单纯提升",
          reasoning: "有代价的力量更有戏剧性",
        },
        {
          target: "境界设定",
          suggestion: "用非线性的成长方式，如不同流派有不同发展路径",
          reasoning: "多样化的成长路径增加世界观深度",
        },
      ],
      "打脸升级": [
        {
          target: "冲突设计",
          suggestion: "用智慧和策略解决问题，而非单纯的实力碾压",
          reasoning: "智斗比武斗更考验作者功力",
        },
        {
          target: "角色关系",
          suggestion: "让对手有合理动机和立场，而非单纯的反派",
          reasoning: "有深度的对手让冲突更有意义",
        },
        {
          target: "情节节奏",
          suggestion: "用长期布局和伏笔代替即时的打脸爽感",
          reasoning: "长线铺垫的回报更有满足感",
        },
      ],
    };

    // Get suggestions for this type
    const typeSuggestions = suggestionMap[type] || [];
    
    // Return at least 3 suggestions
    if (typeSuggestions.length >= 3) {
      suggestions.push(...typeSuggestions.slice(0, 3));
    } else {
      // Add generic suggestions if not enough specific ones
      suggestions.push(...typeSuggestions);
      
      while (suggestions.length < 3) {
        suggestions.push({
          target: "整体创新",
          suggestion: "尝试颠覆读者对这类设定的预期",
          reasoning: "出人意料的转折能提升作品吸引力",
        });
      }
    }

    return suggestions;
  }
}

// Export singleton instance
export const innovationEvaluator = new InnovationEvaluator();
