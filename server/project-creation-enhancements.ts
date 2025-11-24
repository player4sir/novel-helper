// Project Creation Enhancements
// 增强项目创建功能：补充角色信息、完善世界观系统、优化大纲结构

import type { ProjectMeta, EntitySummary } from "./enhanced-project-creation-service";
import { storage } from "./storage";

/**
 * 从角色描述中提取性别
 */
export function extractGender(appearance: string = "", personality: string = ""): string | undefined {
  const text = `${appearance} ${personality}`.toLowerCase();

  // 男性关键词
  const maleKeywords = ["他", "男", "少年", "青年", "大叔", "老者", "公子", "少侠", "师兄", "剑客"];
  // 女性关键词
  const femaleKeywords = ["她", "女", "少女", "姑娘", "女子", "佳人", "美人", "师姐", "师妹", "仙子"];

  const maleCount = maleKeywords.filter(k => text.includes(k)).length;
  const femaleCount = femaleKeywords.filter(k => text.includes(k)).length;

  if (maleCount > femaleCount) return "男";
  if (femaleCount > maleCount) return "女";

  return undefined; // 无法判断
}

/**
 * 从背景和外貌中提取年龄
 */
export function extractAge(background: string = "", appearance: string = ""): string | undefined {
  const text = `${background} ${appearance}`;

  // 尝试提取数字年龄
  const ageMatch = text.match(/(\d+)[岁年]/);
  if (ageMatch) {
    return ageMatch[1];
  }

  // 根据描述推断年龄段
  if (text.includes("少年") || text.includes("少女")) return "15-18";
  if (text.includes("青年") || text.includes("年轻")) return "20-30";
  if (text.includes("中年")) return "35-50";
  if (text.includes("老者") || text.includes("老人")) return "60+";
  if (text.includes("孩童") || text.includes("儿童")) return "8-12";

  return undefined;
}

/**
 * 分析角色关系网络
 * 返回符合前端期望的格式
 */
export function extractRelationships(
  allEntities: EntitySummary[],
  currentEntity: EntitySummary
): Record<string, any> {
  const relationships: Record<string, any> = {};

  for (const other of allEntities) {
    if (other.name === currentEntity.name) continue;

    let relationType = "";
    let relationCategory = "其他";

    // 基于角色定位推断基础关系
    if (currentEntity.role === "主角") {
      if (other.role === "反派") {
        relationType = "敌对";
        relationCategory = "敌对";
      } else if (other.role === "配角") {
        relationType = "盟友";
        relationCategory = "友好";
      }
    } else if (currentEntity.role === "反派") {
      if (other.role === "主角") {
        relationType = "敌对";
        relationCategory = "敌对";
      } else if (other.role === "反派") {
        relationType = "竞争";
        relationCategory = "中立";
      }
    } else if (currentEntity.role === "配角") {
      if (other.role === "主角") {
        relationType = "追随";
        relationCategory = "友好";
      }
    }

    // 从背景和动机中寻找关系线索
    const currentText = `${currentEntity.background || ""} ${currentEntity.shortMotivation}`.toLowerCase();
    const otherName = other.name.toLowerCase();

    if (currentText.includes(otherName)) {
      if (currentText.includes("师父") || currentText.includes("老师")) {
        relationType = "师徒";
        relationCategory = "师徒";
      } else if (currentText.includes("朋友") || currentText.includes("兄弟")) {
        relationType = "友谊";
        relationCategory = "友好";
      } else if (currentText.includes("仇人") || currentText.includes("敌人")) {
        relationType = "仇恨";
        relationCategory = "敌对";
      } else if (currentText.includes("爱") || currentText.includes("喜欢")) {
        relationType = "爱慕";
        relationCategory = "亲密";
      }
    }

    // 如果找到了关系，添加到结果中（使用角色名作为key）
    if (relationType) {
      relationships[other.name] = {
        name: other.name,
        relation: relationType,
        type: relationCategory,
        description: `基于角色定位和背景自动推断的关系`,
      };
    }
  }

  return relationships;
}

/**
 * 生成角色成长路径
 */
/**
 * 生成角色成长路径
 */
export function generateGrowthPath(
  entity: EntitySummary,
  conflicts: string[]
): string {
  const motivation = entity.shortMotivation || "";

  // 找到与角色相关的冲突
  const relevantConflicts = conflicts.filter(c =>
    c.includes(entity.name) ||
    conflicts.indexOf(c) === 0 // 主要冲突通常在前面
  );

  const mainConflict = relevantConflicts[0] || conflicts[0] || "核心冲突";

  let growthPath = `【初期】${motivation}\n`;

  // 随机选择模板以增加多样性
  const getRandom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  if (entity.role === "主角") {
    const midTemplates = [
      `【中期】面对${mainConflict}的挫折，开始质疑自己的初衷，最终重塑信念`,
      `【中期】在${mainConflict}中遭遇重大背叛，性格发生剧变，变得更加成熟冷酷`,
      `【中期】为了解决${mainConflict}，不得不做出违背原则的妥协，内心备受煎熬`,
      `【中期】在${mainConflict}的压力下，觉醒了潜藏的力量，但也引来了更大的危机`
    ];
    const endTemplates = [
      `【后期】最终超越了${mainConflict}的局限，达到了全新的境界，看淡了过往恩怨`,
      `【后期】虽然付出了巨大代价，但成功守护了心中的珍视之物，完成了自我救赎`,
      `【后期】看透了${mainConflict}的本质，选择了一条无人走过的道路，成为传说`,
      `【后期】在解决${mainConflict}的过程中，成为了新的规则制定者`
    ];
    growthPath += getRandom(midTemplates) + "\n";
    growthPath += getRandom(endTemplates);
  } else if (entity.role === "反派") {
    const midTemplates = [
      `【中期】与主角冲突升级，展现出令人窒息的压迫感和复杂的个人魅力`,
      `【中期】计划逐步推进，${mainConflict}全面爆发，将主角逼入绝境`,
      `【中期】过往的伤疤被揭开，展现出可恨之人的可怜之处`
    ];
    const endTemplates = [
      `【后期】在理念的碰撞中败给主角，但坚持自己的道直到最后一刻`,
      `【后期】为了更高的目标自我牺牲，或是被自己的执念吞噬`,
      `【后期】最终虽败，却给世界留下了不可磨灭的印记`
    ];
    growthPath += getRandom(midTemplates) + "\n";
    growthPath += getRandom(endTemplates);
  } else {
    const midTemplates = [
      `【中期】在${mainConflict}中发挥关键作用，成为主角不可或缺的助力`,
      `【中期】因理念不合与主角产生分歧，独自踏上寻找答案的旅程`,
      `【中期】遭遇变故，从旁观者被迫卷入${mainConflict}的漩涡中心`
    ];
    const endTemplates = [
      `【后期】完成自己的使命，找到了属于自己的归宿`,
      `【后期】为了守护主角或大义而牺牲，成为激励他人的精神图腾`,
      `【后期】见证了一切的结束，成为这段传奇的记录者`
    ];
    growthPath += getRandom(midTemplates) + "\n";
    growthPath += getRandom(endTemplates);
  }

  return growthPath;
}

/**
 * 生成初始角色弧光点
 */
export function generateInitialArcPoints(
  entity: EntitySummary,
  conflicts: string[]
): string[] {
  const arcPoints: string[] = [];

  // 起点：角色的初始状态
  arcPoints.push(`起点：${entity.shortMotivation}`);

  // 如果是主角，添加更多弧光点
  if (entity.role === "主角" && conflicts.length > 0) {
    arcPoints.push(`转折点：遭遇${conflicts[0]}`);
    if (conflicts.length > 1) {
      arcPoints.push(`高潮点：面对${conflicts[conflicts.length - 1]}`);
    }
  }

  return arcPoints;
}

/**
 * 从动机中提取初始情感
 */
export function extractInitialEmotion(motivation: string = ""): string | undefined {
  const text = motivation.toLowerCase();

  if (text.includes("复仇") || text.includes("仇恨")) return "愤怒";
  if (text.includes("寻找") || text.includes("失去")) return "悲伤";
  if (text.includes("保护") || text.includes("守护")) return "坚定";
  if (text.includes("证明") || text.includes("超越")) return "不甘";
  if (text.includes("探索") || text.includes("发现")) return "好奇";
  if (text.includes("逃离") || text.includes("摆脱")) return "恐惧";

  return "平静"; // 默认情感
}

/**
 * 分析世界规则类型
 */
export function categorizeWorldRules(worldRules: string[]): {
  rules: string[];
  powerSystem: string[];
  factions: string[];
  geography: string[];
  items: string[];
} {
  const result = {
    rules: [] as string[],
    powerSystem: [] as string[],
    factions: [] as string[],
    geography: [] as string[],
    items: [] as string[],
  };

  for (const rule of worldRules) {
    const lowerRule = rule.toLowerCase();

    // 力量体系关键词
    if (
      lowerRule.includes("修炼") ||
      lowerRule.includes("境界") ||
      lowerRule.includes("力量") ||
      lowerRule.includes("等级") ||
      lowerRule.includes("能力") ||
      lowerRule.includes("功法") ||
      lowerRule.includes("灵力") ||
      lowerRule.includes("真气")
    ) {
      result.powerSystem.push(rule);
      continue;
    }

    // 势力关键词
    if (
      lowerRule.includes("门派") ||
      lowerRule.includes("家族") ||
      lowerRule.includes("势力") ||
      lowerRule.includes("组织") ||
      lowerRule.includes("阵营") ||
      lowerRule.includes("宗门") ||
      lowerRule.includes("帮派")
    ) {
      result.factions.push(rule);
      continue;
    }

    // 地理关键词
    if (
      lowerRule.includes("大陆") ||
      lowerRule.includes("世界") ||
      lowerRule.includes("地域") ||
      lowerRule.includes("区域") ||
      lowerRule.includes("城市") ||
      lowerRule.includes("秘境")
    ) {
      result.geography.push(rule);
      continue;
    }

    // 物品关键词
    if (
      lowerRule.includes("宝物") ||
      lowerRule.includes("法宝") ||
      lowerRule.includes("神器") ||
      lowerRule.includes("丹药") ||
      lowerRule.includes("装备")
    ) {
      result.items.push(rule);
      continue;
    }

    // 默认归类为规则
    result.rules.push(rule);
  }

  return result;
}

/**
 * 创建增强的世界设定
 */
export async function createEnhancedWorldSettings(
  projectId: string,
  meta: ProjectMeta
): Promise<void> {
  const categorized = categorizeWorldRules(meta.worldRules);
  const keywords = meta.keywords;

  // 1. 创建规则类设定
  if (categorized.rules.length > 0) {
    await storage.createWorldSetting({
      projectId,
      category: "rules",
      title: "世界规则",
      content: categorized.rules.join("\n\n"),
      tags: keywords,
      details: {
        ruleCount: categorized.rules.length,
        source: "AI生成"
      },
    });
  }

  // 2. 创建力量体系设定
  if (categorized.powerSystem.length > 0) {
    await storage.createWorldSetting({
      projectId,
      category: "power_system",
      title: "力量体系",
      content: categorized.powerSystem.join("\n\n"),
      tags: keywords,
      details: {
        systemCount: categorized.powerSystem.length,
        needsExpansion: true,
        source: "AI生成"
      },
    });
  }

  // 3. 创建势力设定
  if (categorized.factions.length > 0) {
    await storage.createWorldSetting({
      projectId,
      category: "faction",
      title: "势力分布",
      content: categorized.factions.join("\n\n"),
      tags: keywords,
      details: {
        factionCount: categorized.factions.length,
        source: "AI生成"
      },
    });
  }

  // 4. 创建地理设定
  if (categorized.geography.length > 0) {
    await storage.createWorldSetting({
      projectId,
      category: "geography",
      title: "地理设定",
      content: categorized.geography.join("\n\n"),
      tags: keywords,
      details: {
        locationCount: categorized.geography.length,
        source: "AI生成"
      },
    });
  }

  // 5. 创建物品设定
  if (categorized.items.length > 0) {
    await storage.createWorldSetting({
      projectId,
      category: "items",
      title: "重要物品",
      content: categorized.items.join("\n\n"),
      tags: keywords,
      details: {
        itemCount: categorized.items.length,
        source: "AI生成"
      },
    });
  }

  // 6. 如果没有任何分类，创建通用世界观
  if (
    categorized.rules.length === 0 &&
    categorized.powerSystem.length === 0 &&
    categorized.factions.length === 0 &&
    categorized.geography.length === 0 &&
    categorized.items.length === 0 &&
    meta.worldRules.length > 0
  ) {
    await storage.createWorldSetting({
      projectId,
      category: "rules",
      title: "世界设定",
      content: meta.worldRules.join("\n\n"),
      tags: keywords,
      details: { source: "AI生成" },
    });
  }
}

/**
 * 创建增强的大纲结构
 */
export async function createEnhancedOutlines(
  projectId: string,
  mainOutlineId: string,
  meta: ProjectMeta
): Promise<void> {
  let orderIndex = 1;

  // 1. 创建角色大纲
  if (meta.mainEntities.length > 0) {
    const characterContent = meta.mainEntities
      .map((entity, i) => {
        return `## ${i + 1}. ${entity.name}（${entity.role}）

**动机**: ${entity.shortMotivation}

**性格**: ${entity.personality || "待完善"}

**外貌**: ${entity.appearance || "待完善"}

**背景**: ${entity.background || "待完善"}

**能力**: ${entity.abilities || "待完善"}
`;
      })
      .join("\n\n");

    await storage.createOutline({
      projectId,
      parentId: mainOutlineId,
      type: "character",
      title: "角色大纲",
      content: characterContent,
      orderIndex: orderIndex++,
      plotNodes: {
        characters: meta.mainEntities.map(e => ({
          name: e.name,
          role: e.role,
          motivation: e.shortMotivation,
        })),
      },
    });
  }

  // 2. 创建世界观大纲
  if (meta.worldRules.length > 0) {
    const worldContent = `# 世界观设定

${meta.worldRules.map((rule, i) => `${i + 1}. ${rule}`).join("\n\n")}

## 关键词
${meta.keywords.join("、")}
`;

    await storage.createOutline({
      projectId,
      parentId: mainOutlineId,
      type: "world",
      title: "世界观大纲",
      content: worldContent,
      orderIndex: orderIndex++,
      plotNodes: {
        worldRules: meta.worldRules,
        keywords: meta.keywords,
      },
    });
  }

  // 3. 创建情节大纲
  if (meta.coreConflicts.length > 0) {
    const plotContent = `# 核心冲突

${meta.coreConflicts.map((conflict, i) => `## 冲突${i + 1}
${conflict}

**涉及角色**: ${meta.mainEntities.filter(e => conflict.includes(e.name)).map(e => e.name).join("、") || "待确定"}

**预期发展**: 待规划
`).join("\n\n")}

## 主题标签
${meta.themeTags.join("、")}

## 基调风格
${meta.toneProfile}
`;

    await storage.createOutline({
      projectId,
      parentId: mainOutlineId,
      type: "plot",
      title: "情节大纲",
      content: plotContent,
      orderIndex: orderIndex++,
      plotNodes: {
        conflicts: meta.coreConflicts,
        themeTags: meta.themeTags,
        toneProfile: meta.toneProfile,
      },
    });
  }
}
