// World Generator Service
// Generates genre-specific world settings

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { extractJSON } from "./utils/json-extractor";
import { z } from "zod";
import { genreConfigService } from "./genre-config-service";
import type { ProjectContext } from "./character-generator";

// Types
export interface WorldSetting {
  genre: string;
  powerSystem?: PowerSystem;
  socialStructure?: SocialStructure;
  geography?: Geography;
  factions?: Faction[];
  rules: WorldRule[];
  items?: ImportantItem[];
}

export interface PowerSystem {
  name: string;
  description: string;
  levels: string[];
  cultivation?: string;
  limitations: string[];
}

export interface SocialStructure {
  hierarchy?: string[];
  classes?: SocialClass[];
  governance?: string;
}

export interface SocialClass {
  name: string;
  description: string;
  privileges: string[];
}

export interface Geography {
  regions?: Region[];
  climate?: string;
  specialLocations?: string[];
}

export interface Region {
  name: string;
  description: string;
  significance: string;
}

export interface Faction {
  name: string;
  type: string;
  description: string;
  goals: string[];
  influence: number; // 0-1
}

export interface WorldRule {
  category: string;
  content: string;
  priority: number;
}

export interface ImportantItem {
  name: string;
  type: string;
  description: string;
  significance: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
}

// Genre templates
interface WorldTemplate {
  genre: string;
  requiredElements: string[];
  optionalElements: string[];
  commonRules: string[];
  examplePowerSystems?: string[];
  exampleFactions?: string[];
}

// Zod schemas for validation
const PowerSystemSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(20),
  levels: z.array(z.string()).min(3),
  cultivation: z.string().optional(),
  limitations: z.array(z.string()).min(1),
});

const FactionSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(20),
  goals: z.array(z.string()).min(1),
  influence: z.number().min(0).max(1),
});

const WorldRuleSchema = z.object({
  category: z.string().min(1),
  content: z.string().min(10),
  priority: z.number().min(1).max(10),
});

const WorldSettingSchema = z.object({
  genre: z.string().min(1),
  powerSystem: PowerSystemSchema.optional(),
  socialStructure: z.object({
    hierarchy: z.array(z.string()).optional(),
    classes: z.array(z.object({
      name: z.string(),
      description: z.string(),
      privileges: z.array(z.string()),
    })).optional(),
    governance: z.string().optional(),
  }).optional(),
  geography: z.object({
    regions: z.array(z.object({
      name: z.string(),
      description: z.string(),
      significance: z.string(),
    })).optional(),
    climate: z.string().optional(),
    specialLocations: z.array(z.string()).optional(),
  }).optional(),
  factions: z.array(FactionSchema).optional(),
  rules: z.array(WorldRuleSchema).min(2),
  items: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string(),
    significance: z.string(),
  })).optional(),
});

/**
 * WorldGenerator - Generates genre-specific world settings
 */
export class WorldGenerator {
  private templates: Map<string, WorldTemplate> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * Generate world setting based on genre
   */
  async generateWorld(
    genre: string,
    context: ProjectContext,
    options?: GenerationOptions
  ): Promise<WorldSetting> {
    console.log(`[WorldGenerator] Generating world for genre: ${genre}`);

    // Get template for genre
    const template = this.getGenreTemplate(genre);

    // Build prompt
    const prompt = this.buildWorldPrompt(genre, context, template);

    // Get AI model
    const models = await storage.getAIModels();
    const defaultModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    if (!defaultModel) {
      throw new Error("No default chat model configured");
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[WorldGenerator] Retry attempt ${attempt}/${maxRetries} for ${genre} world`);
        }

        // Generate world setting
        const result = await aiService.generate({
          prompt,
          modelId: options?.modelId || defaultModel.modelId,
          provider: defaultModel.provider,
          baseUrl: defaultModel.baseUrl || "",
          apiKey: defaultModel.apiKey || undefined,
          parameters: {
            temperature: options?.temperature || 0.8,
            maxTokens: options?.maxTokens || 4000, // Increased from 2000
          },
          responseFormat: "json",
        });

        // Parse and validate
        let rawJson: any;
        try {
          rawJson = extractJSON(result.content);
        } catch (parseError: any) {
          console.error("[WorldGenerator] JSON parse error:", parseError.message);
          // Try to fix common issues
          try {
            let fixed = result.content.replace(/,(\s*[}\]])/g, '$1');
            fixed = fixed.replace(/(\w+):/g, '"$1":');
            rawJson = extractJSON(fixed);
          } catch (fixError) {
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
        }

        const parsed = WorldSettingSchema.safeParse(rawJson);

        if (!parsed.success) {
          console.error("[WorldGenerator] Validation error:", parsed.error);
          throw new Error(`World generation validation failed: ${parsed.error.message}`);
        }

        return parsed.data;

      } catch (error: any) {
        console.error(`[WorldGenerator] Error in attempt ${attempt}:`, error.message);
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error("Failed to generate world setting after multiple retries");
  }

  /**
   * Get genre template
   */
  getGenreTemplate(genre: string): WorldTemplate {
    // Normalize genre name
    const normalizedGenre = genre.trim();

    console.log(`[WorldGenerator] Looking for template: "${normalizedGenre}"`);
    console.log(`[WorldGenerator] Available templates:`, Array.from(this.templates.keys()));

    // 1. Try exact match (case-sensitive for Chinese)
    if (this.templates.has(normalizedGenre)) {
      console.log(`[WorldGenerator] Found exact match for: ${normalizedGenre}`);
      return this.templates.get(normalizedGenre)!;
    }

    // 2. Try lowercase match for English
    const lowerGenre = normalizedGenre.toLowerCase();
    if (this.templates.has(lowerGenre)) {
      console.log(`[WorldGenerator] Found lowercase match: ${lowerGenre}`);
      return this.templates.get(lowerGenre)!;
    }

    // 3. Try partial match (more robust)
    const entries = Array.from(this.templates.entries());
    for (const [key, template] of entries) {
      // Skip generic/common templates for partial matching to avoid false positives
      if (["generic", "common", "general", "通用", "其他", "综合"].includes(key)) continue;

      if (normalizedGenre.includes(key) || key.includes(normalizedGenre)) {
        console.log(`[WorldGenerator] Found partial match: ${key} for genre: ${genre}`);
        return template;
      }
    }

    // 4. Keyword mapping fallback
    const keywordMap: Record<string, string> = {
      "剑": "仙侠", "道": "仙侠", "修真": "仙侠",
      "魔法": "奇幻", "龙": "奇幻", "异界": "奇幻",
      "星际": "科幻", "未来": "科幻", "机甲": "科幻", "赛博": "科幻",
      "历史": "现实", "古代": "现实", "穿越": "现实", // 穿越 usually implies historical setting initially
      "校园": "都市", "职场": "都市", "恋爱": "都市",
      "惊悚": "恐怖", "灵异": "恐怖", "鬼怪": "恐怖",
      "推理": "悬疑", "侦探": "悬疑", "悬疑": "悬疑",
    };

    for (const [keyword, targetGenre] of Object.entries(keywordMap)) {
      if (normalizedGenre.includes(keyword)) {
        console.log(`[WorldGenerator] Found keyword match: "${keyword}" -> ${targetGenre}`);
        return this.templates.get(targetGenre) || this.templates.get("generic")!;
      }
    }

    // 5. Return a "Dynamic" template instead of just generic
    // This allows the AI to be creative based on the genre name itself
    console.log(`[WorldGenerator] No specific template found for genre: "${genre}", using dynamic generation`);

    return {
      genre: genre, // Use the actual genre name
      requiredElements: ["rules"], // Minimal requirements
      optionalElements: ["powerSystem", "socialStructure", "factions", "geography", "items"], // Allow everything
      commonRules: [
        "世界观需要符合该类型的核心特征",
        "规则应该服务于故事发展",
      ],
    };
  }

  /**
   * Validate world setting
   */
  validateWorld(world: WorldSetting): ValidationResult {
    console.log("[WorldGenerator] Validating world setting");

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!world.genre) {
      errors.push("世界观缺少类型定义");
    }

    if (!world.rules || world.rules.length < 2) {
      errors.push("世界规则至少需要2条");
    }

    // Check for rule conflicts
    const ruleContents = world.rules.map(r => r.content.toLowerCase());
    for (let i = 0; i < ruleContents.length; i++) {
      for (let j = i + 1; j < ruleContents.length; j++) {
        if (this.detectRuleConflict(world.rules[i], world.rules[j])) {
          warnings.push(`规则冲突: "${world.rules[i].content}" 与 "${world.rules[j].content}"`);
        }
      }
    }

    // Genre-specific validation
    const template = this.getGenreTemplate(world.genre);

    if (template.requiredElements.includes("powerSystem") && !world.powerSystem) {
      warnings.push(`${world.genre}类型通常需要力量体系设定`);
    }

    if (template.requiredElements.includes("factions") && (!world.factions || world.factions.length === 0)) {
      warnings.push(`${world.genre}类型通常需要势力设定`);
    }

    // Check power system if exists
    if (world.powerSystem) {
      if (world.powerSystem.levels.length < 3) {
        warnings.push("力量体系等级过少，建议至少3个等级");
      }

      if (world.powerSystem.limitations.length === 0) {
        warnings.push("力量体系缺少限制条件，可能导致力量膨胀");
      }
    }

    // Check factions if exist
    if (world.factions && world.factions.length > 0) {
      const totalInfluence = world.factions.reduce((sum, f) => sum + f.influence, 0);
      if (totalInfluence > 1.5) {
        warnings.push("势力总影响力过高，可能导致世界观不平衡");
      }

      // Check for duplicate faction names
      const factionNames = world.factions.map(f => f.name);
      const uniqueNames = new Set(factionNames);
      if (factionNames.length !== uniqueNames.size) {
        errors.push("存在重复的势力名称");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Initialize genre templates
   */
  private initializeTemplates(): void {
    // 玄幻/仙侠
    this.templates.set("玄幻", {
      genre: "玄幻",
      requiredElements: ["powerSystem", "factions"],
      optionalElements: ["geography", "items"],
      commonRules: [
        "修炼需要消耗灵气或特殊资源",
        "境界突破存在瓶颈和风险",
        "强者为尊，实力决定地位",
      ],
      examplePowerSystems: ["修真体系", "武道体系", "魔法体系"],
      exampleFactions: ["正道门派", "魔道宗门", "散修联盟", "古老家族"],
    });

    this.templates.set("仙侠", {
      genre: "仙侠",
      requiredElements: ["powerSystem", "factions"],
      optionalElements: ["geography", "items"],
      commonRules: [
        "修仙需要天赋和机缘",
        "天劫是修炼者的重大考验",
        "仙凡有别，飞升是终极目标",
      ],
      examplePowerSystems: ["修仙境界", "剑道体系", "丹道体系"],
      exampleFactions: ["仙门", "魔宗", "妖族", "散仙"],
    });

    // 都市/现实
    this.templates.set("都市", {
      genre: "都市",
      requiredElements: ["socialStructure"],
      optionalElements: ["factions", "items"],
      commonRules: [
        "遵循现代社会法律和道德",
        "财富和权力影响社会地位",
        "人际关系网络很重要",
      ],
      exampleFactions: ["商业集团", "政府机构", "地下势力", "社会组织"],
    });

    this.templates.set("现实", {
      genre: "现实",
      requiredElements: ["socialStructure"],
      optionalElements: ["geography"],
      commonRules: [
        "符合现实世界的物理规律",
        "社会关系和人性是核心",
        "没有超自然力量",
      ],
    });

    // 科幻
    this.templates.set("科幻", {
      genre: "科幻",
      requiredElements: ["powerSystem", "socialStructure", "factions"],
      optionalElements: ["geography", "items"],
      commonRules: [
        "科技发展改变社会结构",
        "存在未知的宇宙威胁",
        "人工智能和生物技术的伦理问题",
      ],
      examplePowerSystems: ["基因改造", "机械增强", "精神力", "纳米技术"],
      exampleFactions: ["星际联邦", "企业财团", "反抗军", "外星文明"],
    });

    // 奇幻
    this.templates.set("奇幻", {
      genre: "奇幻",
      requiredElements: ["powerSystem", "factions", "geography"],
      optionalElements: ["items"],
      commonRules: [
        "魔法需要天赋或学习",
        "不同种族有不同能力",
        "古老的预言和传说影响世界",
      ],
      examplePowerSystems: ["魔法体系", "神术", "龙语", "元素掌控"],
      exampleFactions: ["人类王国", "精灵族", "矮人族", "兽人部落", "魔法学院"],
    });

    // 恐怖/惊悚
    this.templates.set("恐怖", {
      genre: "恐怖",
      requiredElements: ["rules", "items"],
      optionalElements: ["geography", "factions", "socialStructure"],
      commonRules: [
        "未知是最大的恐惧来源",
        "规则往往是致命的，且难以捉摸",
        "主角通常处于弱势，需要求生",
      ],
      examplePowerSystems: ["灵异能力", "诅咒道具", "驱魔术"],
      exampleFactions: ["驱魔人协会", "神秘教团", "幸存者组织"],
    });

    this.templates.set("悬疑", {
      genre: "悬疑",
      requiredElements: ["socialStructure", "factions"],
      optionalElements: ["items", "geography"],
      commonRules: [
        "真相往往隐藏在细节之中",
        "每个人都有秘密",
        "逻辑和推理是解决问题的关键",
      ],
      exampleFactions: ["侦探社", "警察局", "犯罪组织"],
    });

    // Generic fallback
    const genericTemplate = {
      genre: "通用",
      requiredElements: [],
      optionalElements: ["powerSystem", "socialStructure", "factions", "geography"],
      commonRules: [
        "世界观需要内部一致性",
        "规则应该服务于故事",
      ],
    };

    this.templates.set("generic", genericTemplate);
    this.templates.set("common", genericTemplate);
    this.templates.set("general", genericTemplate);

    // Add all Chinese genre mappings
    const chineseGenres = ["通用", "其他", "综合"];
    chineseGenres.forEach(g => this.templates.set(g, genericTemplate));
  }

  /**
   * Build world generation prompt
   */
  private buildWorldPrompt(genre: string, context: ProjectContext, template: WorldTemplate): string {
    const genreInstructions = genreConfigService.getGenreSpecificInstructions(genre);
    const genreDescription = genreConfigService.getGenreDescription(genre);

    return `你是一位资深的小说世界观设计专家，擅长创作${genreDescription}。请为以下${genre}类型小说设计一个完整的世界观设定。

# 项目背景
${context.title ? `标题：${context.title}` : ""}
${context.premise ? `简介：${context.premise}` : ""}
${context.genre ? `类型：${context.genre}` : ""}
${context.themeTags && context.themeTags.length > 0 ? `主题：${context.themeTags.join("、")}` : ""}
${context.worldRules && context.worldRules.length > 0 ? `世界规则：\n${context.worldRules.join("\n")}` : ""}
${(context as any).worldDirective ? `\n# 世界观指导原则\n${(context as any).worldDirective}\n` : ""}

# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤推演：
1. **类型适配**: 思考${genre}类型的核心世界观要素（如${template.requiredElements.join("、")}）。
2. **规则构建**: 设计 3 条核心规则，确保它们能产生有趣的冲突。
3. **势力平衡**: 构思主要势力，确保它们之间存在动态平衡或对抗。
4. **逻辑自洽**: 检查力量体系和世界规则是否矛盾。

# 类型特点
${template.commonRules.length > 0 ? `常见规则：\n${template.commonRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : ""}

${genreInstructions ? `# 类型特定要求\n${genreInstructions}\n` : ""}

# 设计要求
请设计一个符合${genre}类型特点的世界观，包含以下内容：

${template.requiredElements.includes("powerSystem") ? `
## 力量体系（必需）
- 体系名称和描述
- 至少5个等级层次
- 修炼/提升方式
- 明确的限制条件（至少2条）
` : ""}

${template.requiredElements.includes("socialStructure") ? `
## 社会结构（必需）
- 社会阶层划分
- 各阶层的特权和限制
- 治理方式
` : ""}

${template.requiredElements.includes("factions") ? `
## 势力设定（必需）
- 至少3个主要势力
- 每个势力的类型、目标和影响力
- 势力间的关系
` : ""}

## 世界规则（必需）
- 至少3条核心世界规则
- 规则要有优先级（1-10）
- 规则要自洽且不矛盾

${template.optionalElements.includes("geography") ? `
## 地理设定（可选）
- 主要区域和特殊地点
- 气候特征
` : ""}

${template.optionalElements.includes("items") ? `
## 重要物品（可选）
- 关键道具或宝物
- 物品的意义和作用
` : ""}

# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON格式。**
**JSON内容必须使用纯正中文，字段名使用英文。**

请严格按照以下JSON格式输出：

{
  "genre": "${genre}",
  ${template.requiredElements.includes("powerSystem") ? `"powerSystem": {
    "name": "力量体系名称",
    "description": "体系描述（50-100字）",
    "levels": ["等级1", "等级2", "等级3", "等级4", "等级5"],
    "cultivation": "修炼方式描述（可选）",
    "limitations": ["限制1", "限制2"]
  },` : ""}
  ${template.requiredElements.includes("socialStructure") ? `"socialStructure": {
    "hierarchy": ["阶层1", "阶层2", "阶层3"],
    "classes": [
      {
        "name": "阶层名称",
        "description": "阶层描述",
        "privileges": ["特权1", "特权2"]
      }
    ],
    "governance": "治理方式描述"
  },` : ""}
  ${template.optionalElements.includes("geography") ? `"geography": {
    "regions": [
      {
        "name": "区域名称",
        "description": "区域描述",
        "significance": "重要性"
      }
    ],
    "climate": "气候描述",
    "specialLocations": ["特殊地点1", "特殊地点2"]
  },` : ""}
  ${template.requiredElements.includes("factions") ? `"factions": [
    {
      "name": "势力名称",
      "type": "势力类型",
      "description": "势力描述（50-100字）",
      "goals": ["目标1", "目标2"],
      "influence": 0.8
    }
  ],` : ""}
  "rules": [
    {
      "category": "规则类别",
      "content": "规则内容（20-50字）",
      "priority": 9
    }
  ]${template.optionalElements.includes("items") ? `,
  "items": [
    {
      "name": "物品名称",
      "type": "物品类型",
      "description": "物品描述",
      "significance": "重要性"
    }
  ]` : ""}
}

**重要**：
1. 所有内容必须使用纯正的中文
2. 力量体系要有明确的限制，避免无限膨胀
3. 世界规则要自洽，不能互相矛盾
4. 势力影响力总和不要超过1.5
5. 避免常见俗套设定，要有创新性
6. 规则优先级：1-10，数字越大越重要
7. **注意：如果字符串内部包含双引号，必须使用反斜杠转义（例如：\\"价值\\"）**`;
  }

  /**
   * Generate specific world setting items (incremental generation)
   */
  async generateWorldSettingItem(
    category: string,
    count: number,
    context: ProjectContext,
    options?: GenerationOptions
  ): Promise<any[]> {
    console.log(`[WorldGenerator] Generating ${count} items for category: ${category}`);

    // Build prompt
    const prompt = this.buildItemPrompt(category, count, context);

    // Get AI model
    const models = await storage.getAIModels();
    let selectedModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    // If modelId is provided in options, try to find that specific model
    if (options?.modelId) {
      const specificModel = models.find(m => m.modelId === options.modelId);
      if (specificModel) {
        selectedModel = specificModel;
      }
    }

    if (!selectedModel) {
      throw new Error("No suitable chat model configured");
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[WorldGenerator] Retry attempt ${attempt}/${maxRetries} for ${category} items`);
        }

        const result = await aiService.generate({
          prompt,
          modelId: selectedModel.modelId,
          provider: selectedModel.provider,
          baseUrl: selectedModel.baseUrl || "",
          apiKey: selectedModel.apiKey || undefined,
          parameters: {
            temperature: options?.temperature || 0.8,
            maxTokens: options?.maxTokens || 2000,
          },
          responseFormat: "json",
        });

        let rawJson: any;
        try {
          rawJson = extractJSON(result.content);
        } catch (parseError: any) {
          console.error("[WorldGenerator] JSON parse error:", parseError.message);
          try {
            let fixed = result.content.replace(/,(\s*[}\]])/g, '$1');
            fixed = fixed.replace(/(\w+):/g, '"$1":');
            rawJson = extractJSON(fixed);
          } catch (fixError) {
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
        }

        // Validate result is array
        if (!Array.isArray(rawJson)) {
          // If it returned a single object, wrap it
          if (typeof rawJson === 'object' && rawJson !== null) {
            rawJson = [rawJson];
          } else {
            throw new Error("AI response is not an array or object");
          }
        }

        return rawJson;

      } catch (error: any) {
        console.error(`[WorldGenerator] Error in attempt ${attempt}:`, error.message);
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error("Failed to generate world setting items after multiple retries");
  }

  /**
   * Build prompt for specific setting items
   */
  private buildItemPrompt(
    category: string,
    count: number,
    context: ProjectContext
  ): string {
    const categoryPrompts: Record<string, string> = {
      "power_system": `
请设计${count}个力量体系相关的设定（如：特殊功法、修炼资源、境界突破法等）。
输出格式：
[
  {
    "title": "设定名称",
    "content": "详细描述（50-100字）",
    "details": {
      "type": "类型（功法/资源/秘术）",
      "requirements": ["修炼条件1", "修炼条件2"],
      "effects": ["效果1", "效果2"]
    }
  }
]`,
      "geography": `
请设计${count}个地理地点（如：城市、秘境、禁地、特殊地形）。
输出格式：
[
  {
    "title": "地点名称",
    "content": "详细描述（包括地理环境、气候、资源等，50-150字）",
    "details": {
      "type": "地点类型",
      "dangerLevel": "危险等级（低/中/高/极高）",
      "resources": ["特产1", "特产2"],
      "inhabitants": ["居住生物/种族"]
    }
  }
]`,
      "faction": `
请设计${count}个势力组织（如：宗门、家族、公会、神秘组织）。
输出格式：
[
  {
    "title": "势力名称",
    "content": "详细描述（包括历史、宗旨、行事风格等，50-150字）",
    "details": {
      "type": "势力类型",
      "scale": "规模（小型/中型/大型/巨型）",
      "leader": "领袖称号/名字",
      "specialty": "擅长领域"
    }
  }
]`,
      "rules": `
请设计${count}条世界规则（如：自然法则、社会铁律、禁忌）。
输出格式：
[
  {
    "title": "规则名称",
    "content": "规则具体内容和后果（30-80字）",
    "details": {
      "type": "规则类型",
      "scope": "适用范围",
      "priority": 1-10
    }
  }
]`,
      "items": `
请设计${count}个重要物品（如：法宝、神器、关键道具）。
输出格式：
[
  {
    "title": "物品名称",
    "content": "外观和功能描述（50-100字）",
    "details": {
      "type": "物品类型",
      "grade": "品阶/等级",
      "origin": "来源/出处",
      "usage": "使用方法"
    }
  }
]`
    };

    const specificPrompt = categoryPrompts[category] || `
请设计${count}个"${category}"类别的世界观设定。
输出格式：
[
  {
    "title": "设定名称",
    "content": "详细描述",
    "details": {}
  }
]`;

    return `你是一位资深的小说世界观设计专家。请为以下小说补充世界观设定。

# 项目背景
${context.title ? `标题：${context.title}` : ""}
${context.premise ? `简介：${context.premise}` : ""}
${context.genre ? `类型：${context.genre}` : ""}
${context.style ? `风格：${context.style}` : ""}

# 任务要求
${specificPrompt}

**重要**：
1. 设定必须符合项目背景和类型特点
2. 设定要新颖有趣，避免俗套
3. 必须输出纯JSON数组
4. 所有内容使用中文`;
  }

  /**
   * Detect rule conflicts
   */
  private detectRuleConflict(rule1: WorldRule, rule2: WorldRule): boolean {
    const content1 = rule1.content.toLowerCase();
    const content2 = rule2.content.toLowerCase();

    // Simple conflict detection based on keywords
    const conflictPairs = [
      ["可以", "不能"],
      ["允许", "禁止"],
      ["必须", "不得"],
      ["存在", "不存在"],
      ["有", "没有"],
    ];

    for (const [word1, word2] of conflictPairs) {
      if (
        (content1.includes(word1) && content2.includes(word2)) ||
        (content1.includes(word2) && content2.includes(word1))
      ) {
        // Check if they're talking about the same thing
        const words1 = content1.split(/\s+/);
        const words2 = content2.split(/\s+/);
        const commonWords = words1.filter(w => words2.includes(w) && w.length > 1);

        if (commonWords.length > 2) {
          return true;
        }
      }
    }

    return false;
  }
}

// Export singleton instance
export const worldGenerator = new WorldGenerator();
