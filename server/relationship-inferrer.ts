// Relationship Inferrer Service
// Infers relationships between characters based on their profiles and story conflicts

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { extractJSON } from "./utils/json-extractor";
import { z } from "zod";
import type { Character, ProjectContext } from "./character-generator";
import { genreConfigService } from "./genre-config-service";

// Types
export type RelationType =
  | "ally"        // 盟友
  | "enemy"       // 敌对
  | "mentor"      // 师徒
  | "romantic"    // 爱慕
  | "family"      // 亲属
  | "rival"       // 竞争
  | "neutral";    // 中立

export interface Relationship {
  from: string;  // 角色名
  to: string;    // 角色名
  type: RelationType;
  description: string;
  strength: number;  // 关系强度 0-1
}

export interface RelationshipGraph {
  nodes: Character[];
  edges: Relationship[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Zod schema for validation
const RelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(["ally", "enemy", "mentor", "romantic", "family", "rival", "neutral"]),
  description: z.string().min(10),
  strength: z.number().min(0).max(1),
});

const RelationshipGraphSchema = z.object({
  relationships: z.array(RelationshipSchema),
});

/**
 * RelationshipInferrer - Infers relationships between characters
 */
export class RelationshipInferrer {
  /**
   * Infer relationships between characters
   */
  async inferRelationships(
    characters: Character[],
    conflicts: string[],
    context: ProjectContext
  ): Promise<RelationshipGraph> {
    console.log(`[RelationshipInferrer] Inferring relationships for ${characters.length} characters`);

    if (characters.length < 2) {
      console.log("[RelationshipInferrer] Not enough characters for relationships");
      return {
        nodes: characters,
        edges: [],
      };
    }

    // Build prompt
    const prompt = this.buildInferencePrompt(characters, conflicts, context);

    // Get AI model
    const models = await storage.getAIModels();
    const defaultModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    if (!defaultModel) {
      throw new Error("No default chat model configured");
    }

    // Generate relationships
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

    // Parse and validate
    // extractJSON handles <thinking> blocks automatically
    const rawJson = extractJSON(result.content);
    const parsed = RelationshipGraphSchema.safeParse(rawJson);

    if (!parsed.success) {
      console.error("[RelationshipInferrer] Validation error:", parsed.error);
      throw new Error(`Relationship inference validation failed: ${parsed.error.message}`);
    }

    const edges = parsed.data.relationships;

    // Validate character names exist
    const characterNames = new Set(characters.map(c => c.name));
    const validEdges = edges.filter(edge => {
      const fromExists = characterNames.has(edge.from);
      const toExists = characterNames.has(edge.to);

      if (!fromExists || !toExists) {
        console.warn(`[RelationshipInferrer] Invalid relationship: ${edge.from} -> ${edge.to}`);
        return false;
      }

      return true;
    });

    return {
      nodes: characters,
      edges: validEdges,
    };
  }

  /**
   * Validate relationships for consistency
   */
  validateRelationships(graph: RelationshipGraph): ValidationResult {
    console.log("[RelationshipInferrer] Validating relationship graph");

    const errors: string[] = [];
    const warnings: string[] = [];

    const characterNames = new Set(graph.nodes.map(c => c.name));

    // Check for invalid character references
    for (const edge of graph.edges) {
      if (!characterNames.has(edge.from)) {
        errors.push(`关系中引用了不存在的角色: ${edge.from}`);
      }
      if (!characterNames.has(edge.to)) {
        errors.push(`关系中引用了不存在的角色: ${edge.to}`);
      }
    }

    // Check for self-relationships
    for (const edge of graph.edges) {
      if (edge.from === edge.to) {
        errors.push(`角色不能与自己建立关系: ${edge.from}`);
      }
    }

    // Check for contradictory relationships
    const relationshipMap = new Map<string, Relationship[]>();

    for (const edge of graph.edges) {
      const key = `${edge.from}-${edge.to}`;
      if (!relationshipMap.has(key)) {
        relationshipMap.set(key, []);
      }
      relationshipMap.get(key)!.push(edge);
    }

    relationshipMap.forEach((relationships, key) => {
      if (relationships.length > 1) {
        warnings.push(`角色对 ${key} 存在多个关系定义`);
      }

      // Check for contradictory types
      const types = relationships.map((r: Relationship) => r.type);
      if (types.includes("ally") && types.includes("enemy")) {
        errors.push(`角色对 ${key} 同时是盟友和敌人，存在矛盾`);
      }
      if (types.includes("romantic") && types.includes("family")) {
        warnings.push(`角色对 ${key} 同时是爱慕和亲属关系，请确认是否合理`);
      }
    });

    // Check for isolated characters
    const connectedCharacters = new Set<string>();
    for (const edge of graph.edges) {
      connectedCharacters.add(edge.from);
      connectedCharacters.add(edge.to);
    }

    for (const character of graph.nodes) {
      if (!connectedCharacters.has(character.name)) {
        warnings.push(`角色 ${character.name} 没有与其他角色建立关系`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Optimize relationship network
   */
  optimizeRelationships(graph: RelationshipGraph): RelationshipGraph {
    console.log("[RelationshipInferrer] Optimizing relationship graph");

    // Remove duplicate relationships (keep the one with higher strength)
    const relationshipMap = new Map<string, Relationship>();

    for (const edge of graph.edges) {
      const key = `${edge.from}-${edge.to}`;
      const existing = relationshipMap.get(key);

      if (!existing || edge.strength > existing.strength) {
        relationshipMap.set(key, edge);
      }
    }

    // Convert back to array
    const optimizedEdges = Array.from(relationshipMap.values());

    // Ensure protagonist has connections (支持中英文)
    const protagonist = graph.nodes.find(c => c.role === "主角");
    if (protagonist) {
      const protagonistConnections = optimizedEdges.filter(
        e => e.from === protagonist.name || e.to === protagonist.name
      );

      if (protagonistConnections.length === 0 && graph.nodes.length > 1) {
        console.warn("[RelationshipInferrer] Protagonist has no connections, adding default");

        // Add a connection to the first non-protagonist character
        const otherCharacter = graph.nodes.find(c => c.name !== protagonist.name);
        if (otherCharacter) {
          optimizedEdges.push({
            from: protagonist.name,
            to: otherCharacter.name,
            type: "ally",
            description: "默认关系",
            strength: 0.5,
          });
        }
      }
    }

    return {
      nodes: graph.nodes,
      edges: optimizedEdges,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build relationship inference prompt
   */
  private buildInferencePrompt(
    characters: Character[],
    conflicts: string[],
    context: ProjectContext
  ): string {
    const genre = context.genre || "通用";
    const genreInstructions = genreConfigService.getGenreSpecificInstructions(genre);
    const genreDescription = genreConfigService.getGenreDescription(genre);

    return `你是一位资深的小说情节设计专家，擅长构建${genreDescription}中错综复杂的人物关系。请基于以下角色设定和故事冲突，推断角色之间的关系网络。

# 项目背景
${context.title ? `标题：${context.title}` : ""}
${context.premise ? `简介：${context.premise}` : ""}
类型：${genre}

# 核心冲突
${conflicts.length > 0 ? conflicts.map((c, i) => `${i + 1}. ${c}`).join("\n") : "暂无明确冲突"}

# 角色列表
${characters.map((c, i) => `
${i + 1}. ${c.name}（${this.getRoleLabel(c.role)}）
   - 性格：${c.personality}
   - 动机：${c.motivation}
   - 内心冲突：${c.innerConflict}
   - 隐藏目标：${c.hiddenGoal}
`).join("\n")}

${genreInstructions ? `# 类型特定要求\n${genreInstructions}\n` : ''}

# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤进行推演：
1. **阵营划分**: 根据角色的动机和立场，将角色划分为不同的利益集团。
2. **冲突模拟**: 想象当核心冲突爆发时，哪些角色会站在对立面，哪些会结盟。
3. **情感纽带**: 分析角色之间是否存在隐藏的情感纠葛（如：恩情、仇恨、嫉妒）。
4. **类型适配**: 确保关系类型符合${genre}的特点（例如：仙侠中的"道侣"、权谋中的"政敌"）。

# 任务
请分析这些角色之间可能存在的关系，考虑以下因素：
1. 角色的定位（主角、配角、反派）
2. 角色的动机是否冲突或互补
3. 角色的背景是否有联系
4. 故事冲突如何影响角色关系
5. 角色的内心冲突和隐藏目标如何影响关系

# 关系类型说明
- ally（盟友）：共同目标，互相支持
- enemy（敌对）：目标对立，互相阻碍
- mentor（师徒）：传授与学习的关系
- romantic（爱慕）：爱情或暧昧关系
- family（亲属）：血缘或类似家人的关系
- rival（竞争）：竞争关系，但不一定敌对
- neutral（中立）：关系较弱或暂时中立

# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON格式。**
**JSON内容必须使用纯正中文，字段名使用英文。**

请严格按照以下JSON格式输出：

{
  "relationships": [
    {
      "from": "角色A的名字",
      "to": "角色B的名字",
      "type": "关系类型（从上述7种中选择）",
      "description": "关系描述（20-50字，说明为什么是这种关系）",
      "strength": 0.8
    }
  ]
}

**重要**：
1. 关系强度（strength）范围是0-1，表示关系的紧密程度
2. 主角应该与大部分角色有关系
3. 反派通常与主角是enemy或rival关系
4. 避免所有角色都是盟友，要有冲突和张力
5. 关系要符合角色的动机和性格
6. 每对角色之间最多定义一个关系（选择最主要的）
7. 关系描述要具体，不要泛泛而谈
8. **注意：如果字符串内部包含双引号，必须使用反斜杠转义（例如：\\"价值\\"）**`;
  }

  /**
   * Get role label in Chinese
   */
  private getRoleLabel(role: string): string {
    // 如果已经是中文，直接返回
    if (role === "主角" || role === "配角" || role === "反派") {
      return role;
    }
    // 英文转中文
    const labels: Record<string, string> = {
      protagonist: "主角",
      supporting: "配角",
      antagonist: "反派",
    };
    return labels[role] || role;
  }
}

// Export singleton instance
export const relationshipInferrer = new RelationshipInferrer();
