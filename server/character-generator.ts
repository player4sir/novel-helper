// Character Generator Service
// Generates characters with depth and complexity

import { aiService } from "./ai-service";
import { storage } from "./storage";
import { extractJSON } from "./utils/json-extractor";
import { z } from "zod";

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
    options?: GenerationOptions
  ): Promise<Character[]> {
    console.log(`[CharacterGenerator] Generating ${count} characters`);

    const characters: Character[] = [];

    // Ensure at least one protagonist
    if (count > 0) {
      const protagonist = await this.generateCharacter(context, "主角", options);
      characters.push(protagonist);
    }

    // Generate remaining characters
    for (let i = 1; i < count; i++) {
      // Alternate between supporting and antagonist
      const role: CharacterRole = i % 3 === 0 ? "反派" : "配角";

      // Update context with existing characters
      const updatedContext = {
        ...context,
        existingCharacters: characters,
      };

      const character = await this.generateCharacter(updatedContext, role, options);
      characters.push(character);
    }

    return characters;
  }

  /**
   * Generate single character
   */
  async generateCharacter(
    context: ProjectContext,
    role: CharacterRole,
    options?: GenerationOptions
  ): Promise<Character> {
    console.log(`[CharacterGenerator] Generating ${role} character`);

    // Build prompt
    const prompt = this.buildCharacterPrompt(context, role);

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

        return parsed.data;

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
    context: ProjectContext
  ): Promise<Character> {
    console.log(`[CharacterGenerator] Enriching character: ${character.name}`);

    // Build enrichment prompt
    const prompt = this.buildEnrichmentPrompt(character, context);

    // Get AI model
    const models = await storage.getAIModels();
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
  private buildCharacterPrompt(context: ProjectContext, role: CharacterRole): string {
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
- 有自己独立的动机和目标
- 与主角有互补或冲突的性格特点
- 有自己的成长空间
- 不是工具人，有真实的情感和欲望`,

      "反派": `
作为反派，这个角色必须：
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

    return `你是一位资深的小说角色设计专家。请为以下小说创作一个${role}角色。

# 项目背景
${context.title ? `标题：${context.title}` : ""}
${context.premise ? `简介：${context.premise}` : ""}
${context.genre ? `类型：${context.genre}` : ""}
${context.style ? `风格：${context.style}` : ""}
${context.themeTags && context.themeTags.length > 0 ? `主题：${context.themeTags.join("、")}` : ""}
${context.coreConflicts && context.coreConflicts.length > 0 ? `核心冲突：\n${context.coreConflicts.map((c, i) => `${i + 1}. ${c}`).join("\n")}` : ""}
${context.characterDirective ? `\n# 角色设计指导原则\n${context.characterDirective}\n` : ""}

${context.existingCharacters && context.existingCharacters.length > 0 ? `
# 已有角色
${context.existingCharacters.map(c => `- ${c.name}（${c.role}）：${c.motivation}`).join("\n")}

请确保新角色与已有角色形成互补或冲突关系。
` : ""}

# 角色要求
${roleGuidance[role]}

# 输出格式
**重要：必须输出纯JSON，不要有任何其他文字！**

请严格按照以下JSON格式输出（所有内容使用中文）：

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
3. 不要有注释
4. 不要有尾随逗号
5. 确保JSON格式完全正确
6. **注意：如果字符串内部包含双引号，必须使用反斜杠转义（例如：\\"价值\\"）**

**重要**：
1. 所有内容必须使用纯正的中文
2. 避免俗套设定（如：废材逆袭、家族被灭、天赋异禀等）
3. 角色要有真实感和复杂性
4. 内心冲突和隐藏目标要与核心动机形成张力`;
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
