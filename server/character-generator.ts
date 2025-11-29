// Character Generator Service
// Generates characters with depth and complexity

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { extractJSON } from "./utils/json-extractor";
import { z } from "zod";
import { genreConfigService } from "./genre-config-service";

// Types
export type CharacterRole = "主角" | "配角" | "反派" | "群像";

export interface Character {
  name: string;
  role: CharacterRole;
  personality: string;
  appearance: string;
  background: string;
  abilities: string;
  motivation: string;
  innerConflict: string;  // 内心冲突
  hiddenGoal: string;     // 隐藏目标
  growthPath: string;     // 成长路径
  specificType?: string;  // 具体类型（如：落魄侦探）
}

export interface ProjectContext {
  title?: string;
  premise?: string;
  genre?: string;
  style?: string;
  themeTags?: string[];
  coreConflicts?: string[];
  worldRules?: string[];
  existingCharacters?: Character[];
  characterDirective?: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  modelId?: string;
}

// Zod schema for validation
const CharacterSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["主角", "配角", "反派", "群像"]),
  personality: z.string().min(10),
  appearance: z.string().min(10),
  background: z.string().min(20),
  abilities: z.string().min(10),
  motivation: z.string().min(10),
  innerConflict: z.string().min(10),
  hiddenGoal: z.string().min(10),
  growthPath: z.string().min(20),
  specificType: z.string().optional(),
});

/**
 * CharacterGenerator - Generates deep character profiles
 */
export class CharacterGenerator {
  /**
   * Generate multiple characters
   */
  async generateCharacters(
    context: ProjectContext,
    count: number,
    userId: string,
    options?: GenerationOptions
  ): Promise<Character[]> {
    console.log(`[CharacterGenerator] Generating ${count} characters`);

    const characters: Character[] = [];

    // Plan character roster based on directive
    const roster = await this.planCharacterRoster(context, count, userId, options);
    console.log(`[CharacterGenerator] Planned roster:`, roster);

    // Generate characters based on roster
    for (let i = 0; i < roster.length; i++) {
      const rosterItem = roster[i];

      // Update context with existing characters
      const updatedContext = {
        ...context,
        existingCharacters: characters,
      };

      let character: Character | null = null;

      // Retry up to 3 times if we get a duplicate name
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const candidate = await this.generateCharacter(
            updatedContext,
            rosterItem.role,
            userId,
            options,
            rosterItem // Pass the specific roster item details
          );

          // Check for duplicates
          const isDuplicate = characters.some(c => c.name === candidate.name) ||
            (context.existingCharacters && context.existingCharacters.some(c => c.name === candidate.name));

          if (!isDuplicate) {
            character = candidate;
            break;
          }

          console.warn(`[CharacterGenerator] Generated duplicate character name: ${candidate.name}. Retrying...`);
        } catch (e) {
          console.warn(`[CharacterGenerator] Error generating character attempt ${attempt}:`, e);
        }
      }

      // If we still don't have a valid character (or kept getting duplicates), try one last time and force rename if needed
      if (!character) {
        try {
          character = await this.generateCharacter(
            updatedContext,
            rosterItem.role,
            userId,
            options,
            rosterItem
          );
          // Force rename if duplicate
          if (characters.some(c => c.name === character!.name)) {
            character.name = `${character.name} (新)`;
          }
        } catch (e) {
          console.error("[CharacterGenerator] Failed to generate character after retries", e);
          continue; // Skip this character slot
        }
      }

      characters.push(character);
    }

    return characters;
  }

  /**
   * Plan character roster
   */
  async planCharacterRoster(
    context: ProjectContext,
    count: number,
    userId: string,
    options?: GenerationOptions
  ): Promise<{ role: CharacterRole; description: string; specificType?: string }[]> {
    console.log(`[CharacterGenerator] Planning roster for ${count} characters`);

    // If no directive, fallback to simple distribution
    if (!context.characterDirective) {
      const roster: { role: CharacterRole; description: string }[] = [];
      // Always 1 protagonist
      roster.push({ role: "主角", description: "核心主角" });

      for (let i = 1; i < count; i++) {
        const role: CharacterRole = i % 3 === 0 ? "反派" : "配角";
        roster.push({ role, description: role === "反派" ? "主要反派" : "重要配角" });
      }
      return roster;
    }

    // Use AI to plan roster based on directive
    const prompt = `你是一位资深的小说策划专家。请根据以下"角色设计指导原则"，规划一份包含 ${count} 个角色的角色表。

# 项目背景
${context.title ? `标题：${context.title}` : ""}
${context.genre ? `类型：${context.genre}` : ""}
${context.style ? `风格：${context.style}` : ""}
${context.characterDirective ? `\n# 角色设计指导原则 (CRITICAL)\n${context.characterDirective}` : ""}

# 任务
请规划 ${count} 个角色的具体身份和定位。
1. 必须包含至少 1 个主角。
2. 必须严格遵循"角色设计指导原则"中提到的具体角色身份（如：经纪人、富二代、导师等）。
3. 如果指导原则中提到的角色少于 ${count} 个，请根据类型风格补充合理的角色。
4. 角色定位要具体，不要只写"配角"，要写"配角：精明的节目制作人"。

# 输出格式
请输出一个JSON数组：
[
  {
    "role": "主角/配角/反派/群像",
    "specificType": "具体身份（如：落魄侦探）",
    "description": "简要定位描述（20字以内）"
  }
]`;

    // Get AI model
    const models = await storage.getAIModels(userId);
    const defaultModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    if (!defaultModel) return this.fallbackRoster(count);

    try {
      const result = await aiService.generate({
        prompt,
        modelId: defaultModel.modelId,
        provider: defaultModel.provider,
        baseUrl: defaultModel.baseUrl || "",
        apiKey: defaultModel.apiKey || undefined,
        parameters: { temperature: 0.7, maxTokens: 2000 },
        responseFormat: "json",
      });

      const rawJson = extractJSON(result.content);
      const roster = z.array(z.object({
        role: z.enum(["主角", "配角", "反派", "群像"]),
        specificType: z.string().optional(),
        description: z.string()
      })).parse(rawJson);

      // Ensure count matches (truncate or pad)
      if (roster.length > count) {
        return roster.slice(0, count);
      }

      while (roster.length < count) {
        roster.push({ role: "配角", description: "补充配角" });
      }

      return roster;

    } catch (e) {
      console.error("[CharacterGenerator] Roster planning failed, using fallback", e);
      return this.fallbackRoster(count);
    }
  }

  private fallbackRoster(count: number) {
    const roster: { role: CharacterRole; description: string }[] = [];
    roster.push({ role: "主角", description: "核心主角" });
    for (let i = 1; i < count; i++) {
      const role: CharacterRole = i % 3 === 0 ? "反派" : "配角";
      roster.push({ role, description: role === "反派" ? "主要反派" : "重要配角" });
    }
    return roster;
  }

  /**
   * Generate single character
   */
  async generateCharacter(
    context: ProjectContext,
    role: CharacterRole,
    userId: string,
    options?: GenerationOptions,
    rosterItem?: { role: CharacterRole; description: string; specificType?: string }
  ): Promise<Character> {
    console.log(`[CharacterGenerator] Generating ${role} character${rosterItem?.specificType ? `: ${rosterItem.specificType}` : ""}`);

    // Build prompt
    const prompt = this.buildCharacterPrompt(context, role, rosterItem);

    // Get AI model
    const models = await storage.getAIModels(userId);
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
          console.log(`[CharacterGenerator] Retry attempt ${attempt}/${maxRetries} for ${role} character`);
        }

        // Generate character
        const result = await aiService.generate({
          prompt,
          modelId: selectedModel.modelId,
          provider: selectedModel.provider,
          baseUrl: selectedModel.baseUrl || "",
          apiKey: selectedModel.apiKey || undefined,
          parameters: {
            temperature: options?.temperature || 0.8,
            maxTokens: options?.maxTokens || 4000, // Increased from 1500 to prevent truncation
          },
          responseFormat: "json",
        });

        // Parse and validate with retry
        let rawJson: any;
        try {
          rawJson = extractJSON(result.content);
        } catch (parseError: any) {
          console.error("[CharacterGenerator] JSON parse error:", parseError.message);
          console.error("[CharacterGenerator] Raw content:", result.content.substring(0, 500) + "...");

          // Try to fix common issues
          try {
            // Remove trailing commas
            let fixed = result.content.replace(/,(\s*[}\]])/g, '$1');
            // Fix unquoted keys (simple cases)
            fixed = fixed.replace(/(\w+):/g, '"$1":');
            rawJson = extractJSON(fixed);
            console.log("[CharacterGenerator] Successfully fixed JSON");
          } catch (fixError) {
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
        }

        const parsed = CharacterSchema.safeParse(rawJson);

        if (!parsed.success) {
          console.error("[CharacterGenerator] Validation error:", parsed.error);
          console.error("[CharacterGenerator] Raw JSON:", JSON.stringify(rawJson, null, 2));
          throw new Error(`Character generation validation failed: ${parsed.error.message}`);
        }

        // Inject specificType from roster if available
        const characterData = parsed.data;
        if (rosterItem?.specificType) {
          characterData.specificType = rosterItem.specificType;
        }

        return characterData;

      } catch (error: any) {
        console.error(`[CharacterGenerator] Error in attempt ${attempt}:`, error.message);
        lastError = error;
        // If it's the last attempt, don't wait, just let the loop finish and throw
        if (attempt < maxRetries) {
          // Simple backoff or just continue
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    throw lastError || new Error("Failed to generate character after multiple retries");
  }

  /**
   * Enrich character with more details
   */
  async enrichCharacter(
    character: Character,
    context: ProjectContext,
    userId: string
  ): Promise<Character> {
    console.log(`[CharacterGenerator] Enriching character: ${character.name}`);

    // Build enrichment prompt
    const prompt = this.buildEnrichmentPrompt(character, context);

    // Get AI model
    const models = await storage.getAIModels(userId);
    const defaultModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

    if (!defaultModel) {
      throw new Error("No default chat model configured");
    }

    const maxRetries = 3;
    let lastError: Error | null = null;
    let enrichedData: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[CharacterGenerator] Retry attempt ${attempt}/${maxRetries} for enriching ${character.name}`);
        }

        // Generate enriched details
        const result = await aiService.generate({
          prompt,
          modelId: defaultModel.modelId,
          provider: defaultModel.provider,
          baseUrl: defaultModel.baseUrl || "",
          apiKey: defaultModel.apiKey || undefined,
          parameters: {
            temperature: 0.7,
            maxTokens: 4000, // Increased from 1000
          },
          responseFormat: "json",
        });

        // Parse enriched data
        try {
          enrichedData = extractJSON(result.content);
          break; // Success
        } catch (parseError: any) {
          console.error("[CharacterGenerator] Enrichment JSON parse error:", parseError.message);
          // Try to fix common issues
          try {
            let fixed = result.content.replace(/,(\s*[}\]])/g, '$1');
            fixed = fixed.replace(/(\w+):/g, '"$1":');
            enrichedData = extractJSON(fixed);
            break; // Success after fix
          } catch (fixError) {
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
          }
        }
      } catch (error: any) {
        console.error(`[CharacterGenerator] Enrichment error in attempt ${attempt}:`, error.message);
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!enrichedData) {
      throw lastError || new Error("Failed to enrich character after multiple retries");
    }

    // Merge with existing character
    return {
      ...character,
      personality: enrichedData.personality || character.personality,
      appearance: enrichedData.appearance || character.appearance,
      background: enrichedData.background || character.background,
      abilities: enrichedData.abilities || character.abilities,
      innerConflict: enrichedData.innerConflict || character.innerConflict,
      hiddenGoal: enrichedData.hiddenGoal || character.hiddenGoal,
      growthPath: enrichedData.growthPath || character.growthPath,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build character generation prompt
   */
  private buildCharacterPrompt(
    context: ProjectContext,
    role: CharacterRole,
    rosterItem?: { role: CharacterRole; description: string; specificType?: string }
  ): string {
    const roleGuidance = {
      "主角": `
作为主角，这个角色必须：
- 有明确的成长路径和转变弧线
- 有深刻的内心冲突，不是简单的善恶对立
- 有隐藏的目标或秘密，增加角色深度
- 性格要有缺陷和优点，真实可信
- 动机要复杂，不能过于单纯`,

      "配角": `
作为配角，这个角色必须：
- **CRITICAL**: 必须严格符合指定的身份类型：${rosterItem?.specificType || "未指定"}。
- 有自己独立的动机和目标
- 与主角有互补或冲突的性格特点
- 有自己的成长空间
- 不是工具人，有真实的情感和欲望`,

      "反派": `
作为反派，这个角色必须：
- **CRITICAL**: 必须严格符合指定的身份类型：${rosterItem?.specificType || "未指定"}。
- 有合理的动机，不是单纯的邪恶
- 有自己的信念和价值观
- 与主角形成镜像或对比
- 有人性化的一面，不是脸谱化反派
- 内心冲突可以是理想与现实的矛盾`,

      "群像": `
作为群像角色，这个角色必须：
- 具有鲜明的个人特色和记忆点
- 在特定场景或事件中发挥关键作用
- 与主角或其他主要角色有有趣的互动
- 展现世界观的某一方面或特定群体的特征`
    };

    const genre = context.genre || "未指定";
    const genreInstructions = genreConfigService.getGenreSpecificInstructions(genre);
    const genreDescription = genreConfigService.getGenreDescription(genre);
    const specificTypeInstruction = rosterItem?.specificType
      ? `\n**核心指令**：请务必生成一个"${rosterItem.specificType}"类型的角色。\n`
      : "";

    return `你是一位资深的小说角色设计专家，擅长创作${genreDescription}。请为以下小说创作一个${role}角色。
${specificTypeInstruction}

# 创意增强指令 (CREATIVITY BOOSTER)
- **拒绝套路**：除非特别指定，否则不要生成"高冷总裁"、"废柴逆袭"、"全家被灭"等陈旧人设。
- **反差萌**：尝试赋予角色与其外表或职业不符的性格特征（例如：胆小的杀手、热爱诗歌的屠夫）。
- **具体化**：性格描写要"Show, Don't Tell"，不要只说"善良"，要描述"看到路边野猫会忍不住买火腿肠"。
- **风格化**：角色的语言和行为必须符合"${context.style || '标准'}"的风格要求。

# 项目背景
${context.title ? `标题：${context.title}` : ""}
${context.premise ? `简介：${context.premise}` : ""}
${context.genre ? `类型：${context.genre}` : ""}
${context.style ? `风格：${context.style}` : ""}
${context.themeTags && context.themeTags.length > 0 ? `主题：${context.themeTags.join("、")}` : ""}
${context.coreConflicts && context.coreConflicts.length > 0 ? `核心冲突：\n${context.coreConflicts.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}
${context.characterDirective ? `\n# 角色设计指导原则 (CRITICAL)\n${context.characterDirective}\n\n请务必分析上述指导原则，提取其中提到的具体角色身份（例如：经纪人、富二代、导师等），并检查已有角色列表，优先生成尚未出现的关键角色。` : ""}

${context.existingCharacters && context.existingCharacters.length > 0 ? `
# 已有角色
${context.existingCharacters.map(c => `- ${c.name}（${c.role}）：${c.motivation}`).join("\n")}

请确保新角色与已有角色形成互补或冲突关系。
请检查已有角色是否已经覆盖了"角色设计指导原则"中的关键角色。如果尚未覆盖，请务必生成缺失的关键角色。

**CRITICAL NEGATIVE CONSTRAINT**:
You must generate a completely **NEW** name.
**DO NOT** use any of the following names: [${context.existingCharacters.map(c => c.name).join(", ")}]
If you generate a name that is already in the list above, it will be considered a failure.
` : ""}

# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤推演：
1. **需求分析**: 仔细阅读"角色设计指导原则"，列出所有提到的具体角色身份。
2. **缺口检查**: 对比"已有角色"列表，找出尚未生成的关键角色身份。
3. **角色定位**: 如果有尚未生成的关键角色，直接选择其中一个作为本次生成的角色身份；如果没有，则根据故事逻辑创造一个合理的${role}。
4. **类型适配**: 思考${genre}类型中该角色的典型特征，以及如何做出新意。
5. **关系构建**: 分析该角色在现有角色关系网中的位置，如何制造冲突或互补。
6. **深度挖掘**: 设计一个核心的"内在冲突"（Inner Conflict）和"虚假信念"（False Belief）。
7. **名字构思**: 构思 3 个符合背景的名字，选出最贴切的一个。

# 角色要求
${roleGuidance[role]}

${genreInstructions ? `# 类型特定要求\n${genreInstructions}\n` : ""}

# 输出格式
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON格式。**
**JSON内容必须使用纯正中文，字段名使用英文。**

请严格按照以下JSON格式输出：

{
  "name": "角色名字",
  "role": "${role}",
  "personality": "性格特点（30-80字）",
  "appearance": "外貌特征（30-80字）",
  "background": "背景故事（50-150字）",
  "abilities": "能力特长（30-80字）",
  "motivation": "核心动机（20-50字）",
  "innerConflict": "内心冲突（20-50字）",
  "hiddenGoal": "隐藏目标（20-50字）",
  "growthPath": "成长路径（50-100字）"
}

**注意**：
1. role字段必须是"${role}"
2. 所有字符串值用双引号包裹
3. 确保JSON格式完全正确
4. **注意：如果字符串内部包含双引号，必须使用反斜杠转义（例如：\\"价值\\"）**

**重要**：
1. 所有内容必须使用纯正的中文
2. 避免俗套设定（如：废材逆袭、家族被灭、天赋异禀等）
3. 角色要有真实感和复杂性
4. 内心冲突和隐藏目标要与核心动机形成张力
5. **再次强调：名字必须唯一，不能与已有角色重复**`;
  }

  /**
   * Build character enrichment prompt
   */
  private buildEnrichmentPrompt(character: Character, context: ProjectContext): string {
    return `你是一位资深的小说角色设计专家。请为以下角色补充更深入的细节。

# 现有角色信息
姓名：${character.name}
定位：${character.role}
性格：${character.personality}
外貌：${character.appearance}
背景：${character.background}
能力：${character.abilities}
动机：${character.motivation}
内心冲突：${character.innerConflict}
隐藏目标：${character.hiddenGoal}
成长路径：${character.growthPath}

# 项目背景
${context.premise || ""}

# 任务
请深化和丰富这个角色的设定，特别是：
1. 让性格描写更具体，加入行为习惯和口头禅
2. 让背景故事更有深度，加入关键转折点
3. 让内心冲突更尖锐，形成真实的心理张力
4. 让成长路径更清晰，描述具体的转变阶段

# 输出格式
请严格按照以下JSON格式输出（所有内容使用中文）。
**注意：如果字符串内部包含双引号，必须使用反斜杠转义（例如：\\"价值\\"）**

{
  "personality": "增强后的性格描写（50-100字）",
  "appearance": "增强后的外貌描写（50-100字）",
  "background": "增强后的背景故事（100-200字）",
  "abilities": "增强后的能力描写（50-100字）",
  "innerConflict": "增强后的内心冲突（30-80字）",
  "hiddenGoal": "增强后的隐藏目标（30-80字）",
  "growthPath": "增强后的成长路径（80-150字）"
}`;
  }
}

// Export singleton instance
export const characterGenerator = new CharacterGenerator();
