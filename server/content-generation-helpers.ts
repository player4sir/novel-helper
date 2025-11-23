// Content Generation Helper Functions
// 用于格式化角色和世界观信息，提供给AI生成更丰富的上下文

import type { Character, WorldSetting } from "@shared/schema";
import { storage } from "./storage";

/**
 * 格式化角色信息用于大纲生成（卷纲/章纲）
 */
export function formatCharacterForOutline(character: Character): string {
  const parts = [`【${character.name}】（${character.role}）`];

  // 添加基础信息
  const basicInfo = [];
  if (character.gender) basicInfo.push(character.gender);
  if (character.age) basicInfo.push(character.age + "岁");
  if (basicInfo.length > 0) {
    parts.push(basicInfo.join("，"));
  }

  // 添加核心动机（最重要）
  if (character.shortMotivation) {
    parts.push(`\n  动机：${character.shortMotivation}`);
  }

  // 添加性格
  if (character.personality) {
    const personality = character.personality.length > 50
      ? character.personality.substring(0, 50) + "..."
      : character.personality;
    parts.push(`\n  性格：${personality}`);
  }

  // 添加关键关系（最多2个）
  if (character.relationships && typeof character.relationships === 'object') {
    const relations = Object.entries(character.relationships)
      .slice(0, 2)
      .map(([_, rel]: [string, any]) => {
        if (typeof rel === 'object' && rel.name && rel.relation) {
          return `${rel.name}（${rel.relation}）`;
        }
        return null;
      })
      .filter((r): r is string => r !== null)
      .join("、");

    if (relations) {
      parts.push(`\n  关系：${relations}`);
    }
  }

  return parts.join("");
}

/**
 * 格式化角色信息用于场景生成（更详细）
 */
export function formatCharacterForScene(character: Character): string {
  const parts = [`【${character.name}】（${character.role}）`];

  // 基础信息
  const basicInfo = [];
  if (character.gender) basicInfo.push(character.gender);
  if (character.age) basicInfo.push(character.age + "岁");
  if (basicInfo.length > 0) {
    parts.push(basicInfo.join("，"));
  }

  // 当前状态（对场景生成很重要）
  const currentState = [];
  if (character.currentEmotion) {
    currentState.push(`情感：${character.currentEmotion}`);
  }
  if (character.currentGoal) {
    const goal = character.currentGoal.length > 30
      ? character.currentGoal.substring(0, 30) + "..."
      : character.currentGoal;
    currentState.push(`目标：${goal}`);
  }
  if (currentState.length > 0) {
    parts.push(`\n  当前状态：${currentState.join("，")}`);
  }

  // 核心动机
  if (character.shortMotivation) {
    parts.push(`\n  核心动机：${character.shortMotivation}`);
  }

  // 性格特点
  if (character.personality) {
    const personality = character.personality.length > 50
      ? character.personality.substring(0, 50) + "..."
      : character.personality;
    parts.push(`\n  性格：${personality}`);
  }

  // 能力特长
  if (character.abilities) {
    const abilities = character.abilities.length > 50
      ? character.abilities.substring(0, 50) + "..."
      : character.abilities;
    parts.push(`\n  能力：${abilities}`);
  }

  // 关键关系
  if (character.relationships && typeof character.relationships === 'object') {
    const relations = Object.entries(character.relationships)
      .map(([_, rel]: [string, any]) => {
        if (typeof rel === 'object' && rel.name && rel.relation) {
          return `${rel.name}（${rel.relation}）`;
        }
        return null;
      })
      .filter((r): r is string => r !== null)
      .join("、");

    if (relations) {
      parts.push(`\n  关系：${relations}`);
    }
  }

  return parts.join("");
}

/**
 * 格式化角色成长信息用于卷纲生成
 */
/**
 * 格式化角色成长信息用于卷纲生成
 * @param characters 角色列表
 * @param stage 成长阶段 (early/middle/late) - 可选，用于重点突出特定阶段
 */
export function formatCharacterGrowthContext(
  characters: Character[],
  stage?: 'early' | 'middle' | 'late'
): string {
  const growthInfo = characters
    .filter(c => c.growth && c.growth.length > 0)
    .map(c => {
      let growthContent = c.growth;

      // 如果指定了阶段，尝试提取相关部分（简单的文本匹配）
      if (stage) {
        const stageKeywords = {
          early: ['初期', '前期', '起点', '开始'],
          middle: ['中期', '中段', '转折', '发展'],
          late: ['后期', '末期', '高潮', '结局', '结束']
        };

        const keywords = stageKeywords[stage];
        const lines = (c.growth || "").split('\n');
        const relevantLines = lines.filter(line =>
          keywords.some(k => line.includes(k))
        );

        if (relevantLines.length > 0) {
          growthContent = relevantLines.join('\n');
        }
      }

      return `【${c.name}】成长路径：\n${growthContent}`;
    })
    .join("\n\n");

  return growthInfo || "角色成长路径待规划";
}

/**
 * 构建角色关系网络描述
 */
export function buildRelationshipNetwork(characters: Character[]): string {
  const relationships: string[] = [];

  for (const character of characters) {
    if (!character.relationships || typeof character.relationships !== 'object') {
      continue;
    }

    const charRelations = Object.entries(character.relationships)
      .map(([_, rel]: [string, any]) => {
        if (typeof rel === 'object' && rel.name && rel.relation) {
          return `- ${character.name} ←→ ${rel.name}：${rel.relation}关系`;
        }
        return null;
      })
      .filter((r): r is string => r !== null);

    relationships.push(...charRelations);
  }

  // 去重（因为关系是双向的）
  const uniqueRelations = Array.from(new Set(relationships));

  return uniqueRelations.length > 0
    ? uniqueRelations.join("\n")
    : "角色关系待建立";
}

/**
 * 获取相关的世界观信息
 * 根据上下文智能选择相关的世界观分类
 */
export async function getRelevantWorldSettings(
  projectId: string,
  context: "volume" | "chapter" | "scene"
): Promise<string> {
  try {
    const worldSettings = await storage.getWorldSettingsByProject(projectId);

    if (!worldSettings || worldSettings.length === 0) {
      return "世界观设定待完善";
    }

    // 根据上下文选择相关的世界观
    let relevantCategories: string[] = [];

    if (context === "volume") {
      // 卷纲需要宏观的世界观
      relevantCategories = ["rules", "power_system", "faction", "geography"];
    } else if (context === "chapter") {
      // 章纲需要具体的设定
      relevantCategories = ["power_system", "faction", "items"];
    } else {
      // 场景需要细节
      relevantCategories = ["power_system", "items"];
    }

    const relevant = worldSettings.filter(ws =>
      relevantCategories.includes(ws.category)
    );

    if (relevant.length === 0) {
      // 如果没有相关分类，返回所有设定的摘要
      return worldSettings
        .slice(0, 3) // 最多3个
        .map(ws => `【${ws.title}】${ws.content.substring(0, 100)}...`)
        .join("\n\n");
    }

    return relevant
      .map(ws => {
        const categoryLabel = getCategoryLabel(ws.category);
        const content = ws.content.length > 200
          ? ws.content.substring(0, 200) + "..."
          : ws.content;
        return `【${ws.title}】（${categoryLabel}）\n${content}`;
      })
      .join("\n\n");
  } catch (error) {
    console.error("[World Settings] Failed to get relevant settings:", error);
    return "世界观设定待完善";
  }
}

/**
 * 获取世界观分类的中文标签
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    power_system: "力量体系",
    geography: "地理",
    faction: "势力",
    rules: "规则",
    items: "物品",
  };
  return labels[category] || category;
}

/**
 * 格式化简化的角色列表（用于向后兼容）
 */
export function formatSimpleCharacterList(characters: Character[]): string {
  return characters
    .map(c => `${c.name}（${c.role}）`)
    .join("、");
}

/**
 * 检查角色信息是否完整
 */
export function isCharacterInfoComplete(character: Character): boolean {
  return !!(
    character.name &&
    character.role &&
    character.shortMotivation &&
    character.personality
  );
}

/**
 * 获取角色的关键信息摘要（用于日志）
 */
export function getCharacterSummary(character: Character): string {
  const parts = [character.name, character.role];
  if (character.shortMotivation) {
    parts.push(character.shortMotivation.substring(0, 20) + "...");
  }
  return parts.join(" - ");
}
