import { createHash } from 'crypto';
import type { PromptTemplate as DBPromptTemplate, Character } from '@shared/schema';

// PromptTemplate interface matching design document
export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  templateText: string;
  components: string[]; // Stable fields for signature
  exampleInputs?: any;
  exampleOutputs?: any;
}

// Context for prompt assembly
export interface PromptContext {
  projectId: string;
  chapterId: string;
  chapterIndex: number;
  beats: string[];
  characters: Character[];
  estimatedWords: number;
  styleGuidelines?: string;
  previousSummary?: string;
  storyContext?: string; // Added story context
  worldSettings?: string; // Added world settings
}

// Assembled prompt with signature
export interface AssembledPrompt {
  text: string;
  signature: string;
  metadata: {
    templateId: string;
    templateVersion: string;
    components: string[];
  };
}

// Storage interface for database operations
interface IStorage {
  getPromptTemplate(id: string): Promise<DBPromptTemplate | undefined>;
}

/**
 * PromptTemplateService - Load, cache, and assemble prompt templates
 * 
 * Implements the PromptTemplate system from the design document with:
 * - Database-backed template loading
 * - In-memory caching for performance
 * - Signature generation for exact cache matching
 * - Component-based prompt assembly
 */
export class PromptTemplateService {
  private templateCache: Map<string, PromptTemplate> = new Map();
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Load template from database
   * @param templateId - Template identifier (e.g., 'pt_chapter_draft_v1')
   * @returns Promise<PromptTemplate>
   */
  async loadTemplate(templateId: string): Promise<PromptTemplate> {
    try {
      const dbTemplate = await this.storage.getPromptTemplate(templateId);

      if (!dbTemplate) {
        console.warn(`[PromptTemplate] Template not found in database: ${templateId}, using fallback`);
        return this.getFallbackTemplate(templateId);
      }

      // Convert database template to service template format
      const template: PromptTemplate = {
        id: dbTemplate.id,
        name: dbTemplate.name,
        version: '1.0', // Fixed version for now (schema doesn't have version field)
        templateText: dbTemplate.template,
        components: Array.isArray(dbTemplate.variables) ? dbTemplate.variables : [],
        exampleInputs: undefined,
        exampleOutputs: undefined,
      };

      console.log(`[PromptTemplate] Loaded template ${templateId} v${template.version} from database`);
      return template;
    } catch (error) {
      console.warn(`[PromptTemplate] Load failed for ${templateId}, using fallback`, error);
      return this.getFallbackTemplate(templateId);
    }
  }

  /**
   * Get template with in-memory caching
   * @param templateId - Template identifier
   * @returns Promise<PromptTemplate>
   */
  async getTemplate(templateId: string): Promise<PromptTemplate> {
    // Check cache first
    if (this.templateCache.has(templateId)) {
      return this.templateCache.get(templateId)!;
    }

    // Load from database
    const template = await this.loadTemplate(templateId);

    // Cache for future use
    this.templateCache.set(templateId, template);

    return template;
  }

  /**
   * Assemble prompt from template and context
   * @param template - PromptTemplate
   * @param context - PromptContext with all necessary data
   * @returns AssembledPrompt with text and signature
   */
  /**
   * Assemble prompt from template and context
   * @param template - PromptTemplate
   * @param context - PromptContext with all necessary data
   * @returns AssembledPrompt with text and signature
   */
  assemblePrompt(template: PromptTemplate, context: PromptContext): AssembledPrompt {
    // Replace placeholders in template text
    let promptText = template.templateText;

    // Calculate word ranges
    const minWords = Math.floor(context.estimatedWords * 0.85);
    const maxWords = Math.floor(context.estimatedWords * 1.15);

    // Build character info string with rich details
    const characterInfo = context.characters
      .map(c => {
        let info = `【${c.name}】（${c.role}）`;
        if (c.personality) info += `\n  - 性格：${c.personality}`;
        if (c.appearance) info += `\n  - 外貌：${c.appearance}`;
        if (c.background) info += `\n  - 背景：${c.background}`;
        if (c.abilities) info += `\n  - 能力：${c.abilities}`;
        if (c.shortMotivation) info += `\n  - 动机：${c.shortMotivation}`;
        if (c.currentGoal) info += `\n  - 当前目标：${c.currentGoal}`;
        if (c.currentEmotion) info += `\n  - 当前情绪：${c.currentEmotion}`;
        return info;
      })
      .join('\n\n');

    // Determine genre and descriptions
    // @ts-ignore - genre might be passed in context but not in interface yet
    const genre = context.genre || '奇幻';
    const genreDescription = this.getGenreDescription(genre);
    const genreInstructions = this.getGenreSpecificInstructions(genre);

    // Replace common placeholders
    const replacements: Record<string, string> = {
      '{project_id}': context.projectId,
      '{chapter_id}': context.chapterId,
      '{chapter_index}': String(context.chapterIndex),
      // @ts-ignore
      '{scene_index}': String((context.sceneIndex || 0) + 1),
      // @ts-ignore
      '{total_scenes}': String(context.totalScenes || 1),
      '{beats}': context.beats.join('\n'), // Keep for backward compatibility
      '{scene_purpose}': context.beats.join('\n'), // New semantic name
      '{estimated_words}': String(context.estimatedWords),
      '{min_words}': String(minWords),
      '{max_words}': String(maxWords),
      '{style_guidelines}': context.styleGuidelines || '标准网络小说风格',
      '{style_guidance}': context.styleGuidelines ? `叙事风格：${context.styleGuidelines}` : '',
      '{style_enforcement}': this.generateStyleEnforcement(context.styleGuidelines || ''),
      '{prev_compact_summary}': context.previousSummary || '（本章开始）',
      '{previous_content}': context.previousSummary || '（本章开始）', // New semantic name
      '{required_characters_brief}': context.characters.map(c => `${c.name} (${c.role})`).join('、'), // Keep for backward compatibility
      '{available_characters_brief}': context.characters.map(c => `${c.name} (${c.role})`).join('、'), // New semantic name
      '{character_info}': characterInfo,
      '{project_summary}': '', // Removed placeholder
      '{chapter_outline}': '', // Removed placeholder
      '{world_settings}': context.worldSettings || '（暂无特殊世界观设定）',
      '{story_context}': context.storyContext || '',
      '{genre}': genre,
      '{genre_description}': genreDescription,
      '{genre_specific_instructions}': genreInstructions,
    };

    // Apply replacements
    for (const [placeholder, value] of Object.entries(replacements)) {
      promptText = promptText.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    // Generate signature
    const signature = this.generateSignature(template, context);

    return {
      text: promptText,
      signature,
      metadata: {
        templateId: template.id,
        templateVersion: template.version,
        components: template.components,
      },
    };
  }

  /**
   * Generate deterministic signature for caching
   * Uses SHA256 hash of stable components
   * @param template - PromptTemplate
   * @param context - PromptContext
   * @returns string - SHA256 hash
   */
  generateSignature(template: PromptTemplate, context: PromptContext): string {
    const components = template.components || [];
    const parts: string[] = [];

    for (const component of components) {
      switch (component) {
        case 'project_id':
          parts.push(context.projectId);
          break;
        case 'chapter_id':
          parts.push(context.chapterId);
          break;
        case 'chapter_index':
          parts.push(String(context.chapterIndex));
          break;
        case 'beats_sha':
        case 'beats_hash':
          const beatsHash = this.sha256(context.beats.join('||'));
          parts.push(beatsHash);
          break;
        case 'required_character_ids_sorted':
          const charIds = context.characters
            .map(c => c.id)
            .sort()
            .join('|');
          parts.push(charIds);
          break;
        case 'estimated_words':
          parts.push(String(context.estimatedWords));
          break;
        case 'style_signature':
          parts.push(context.styleGuidelines || '');
          break;
        case 'template_id':
          parts.push(template.id);
          break;
        case 'template_version':
          parts.push(template.version);
          break;
        case 'world_settings_hash':
          parts.push(this.sha256(context.worldSettings || ''));
          break;
        case 'story_context_hash':
          parts.push(this.sha256(context.storyContext || ''));
          break;
      }
    }

    // Concatenate with separator
    const joined = parts.join('||');

    // Generate SHA256 hash
    return this.sha256(joined);
  }

  /**
   * Generate SHA256 hash
   * @param input - String to hash
   * @returns string - Hex-encoded hash
   */
  private sha256(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Get fallback template when database load fails
   * @param templateId - Template identifier
   * @returns PromptTemplate with hardcoded content
   */
  private getFallbackTemplate(templateId: string): PromptTemplate {
    console.warn(`[PromptTemplate] Using fallback template for ${templateId}`);

    // Improved v3.0 template with Algorithmic CoT and 3-layer architecture
    const v2Text = `系统：你是顶级网文大神助手，擅长创作{genre_description}。

═══════════════════════════════════════════
## 【系统元信息】（内部规划，不要在正文中体现）
═══════════════════════════════════════════

- 场景编号：第 {scene_index}/{total_scenes} 场景
- 场景创作目标：{scene_purpose}
  ↑ 注意：这是为你提供的创作方向指引，不要在正文中标注场景编号或创作目标
  
- 预期字数范围：{min_words} - {max_words} 字

═══════════════════════════════════════════
## 【创作参考信息】（用于指导创作，选择性使用）
═══════════════════════════════════════════

**世界观设定**：
{world_settings}

**本场景可用角色**（根据剧情需要选择性登场）:
{available_characters_brief}

**角色详细信息**（仅当角色需要登场时参考）:
{character_info}

**风格要求**：{style_guidelines}

═══════════════════════════════════════════
## 【故事衔接信息】（必须紧密衔接）
═══════════════════════════════════════════

**故事背景**（已发生的关键事件）:
"""
{story_context}
"""

**上文结尾**（已经写完的内容，请直接从此处继续）:
"""
{previous_content}
"""

═══════════════════════════════════════════
## 创作指令（CRITICAL）
═══════════════════════════════════════════

0. **深度思维链规划（Deep CoT）**：
   在正式写作前，你**必须**先输出一个 \`<thinking>\` 标签块，进行以下推演：
   - **场景类型分析**：本场景属于什么类型？（战斗/情感/悬疑/日常/过渡）
   - **写作策略制定**：基于场景类型，决定使用什么句式节奏？（如：战斗用短句，情感用心理描写）
   - **情感基调设定**：本场景的核心情绪是什么？（压抑/热血/温馨/诡异）
   - **感官钩子设计**：设计至少3个具体的感官细节（视觉/听觉/嗅觉/触觉）。
   - **节拍细化**：将"场景创作目标"拆解为具体的起承转合步骤。

   *格式示例*：
   \`<thinking>
   类型：高强度战斗
   策略：多用动词，少用形容词，短句为主，强调速度感。
   基调：紧迫、生死一线
   钩子：生锈铁剑的腥味、汗水滴入眼睛的刺痛、骨头断裂的脆响
   规划：
   1. 李凡遭遇偷袭，侧身闪避。
   2. 反击受阻，陷入下风。
   3. 发现破绽，一击必杀。
   </thinking>\`

{genre_specific_instructions}

1.  **拒绝人物小传式出场（NO INFO DUMPING）**：
    *   **严禁**在角色刚出场时一次性抛出大段外貌、性格、背景介绍。
    *   **必须**通过动作、对话、神态细节来侧面展现角色特征。

2.  **角色声纹锁（CHARACTER VOICE）**：
    *   写出TA看到的、听到的、想到的，而不是作者看到的。

7.  **风格强化**：
    *   **严格执行风格**：{style_enforcement}
    *   **风格关键词**：{style_guidelines}

8.  **负面约束**：
    *   **严禁输出场景标记**：不要在正文中添加【场景X/X】、***等任何形式的场景分隔符或元数据标记。
    *   **场景信息内部使用**：上述场景规划信息（如"场景目标"）仅用于指导创作方向，不要在正文中显式标注。
    *   不要出现"书接上回"、"待续"等标记。
    *   不要在开头总结前情。
    *   遇到未设定细节（如路人名、招式名），请自动生成符合世界观的名称。

输出要求：
- **必须先输出 <thinking>...</thinking> 规划块**。
- 然后换行输出正文。
- 正文不要包含任何前言后语。
- **正文应如同完整小说章节**，多个场景间自然过渡，读者无需看到场景分界。
- 确保字数在{min_words}到{max_words}之间。`;

    return {
      id: templateId,
      name: 'Fallback Template v3.0 (Algorithmic CoT)',
      version: '3.0',
      templateText: v2Text,
      components: [
        'project_id',
        'chapter_id',
        'chapter_index',
        'beats_hash',
        'required_character_ids_sorted',
        'estimated_words',
        'style_signature',
        'template_id',
        'template_version',
        'world_settings_hash',
        'story_context_hash',
      ],
    };
  }

  /**
   * Get all templates (for backward compatibility with routes.ts)
   * Note: This is a placeholder - actual implementation would need storage access
   */
  getAllTemplates(): PromptTemplate[] {
    console.warn('[PromptTemplate] getAllTemplates called but not fully implemented');
    return [];
  }

  /**
   * Get template synchronously from cache (for backward compatibility with routes.ts)
   * Returns undefined if not in cache
   */
  getTemplateSync(templateId: string): PromptTemplate | undefined {
    return this.templateCache.get(templateId);
  }

  /**
   * Generate specific enforcement instructions based on style tags
   */
  private generateStyleEnforcement(style: string): string {
    if (!style) return "保持通顺流畅的叙事风格。";

    let enforcement = "";
    const lowerStyle = style.toLowerCase();

    if (lowerStyle.includes("荒诞") || lowerStyle.includes("absurd")) {
      enforcement += "强调逻辑的错位与夸张，用一本正经的语气描述离奇荒谬的事物。";
    }
    if (lowerStyle.includes("搞笑") || lowerStyle.includes("幽默") || lowerStyle.includes("funny")) {
      enforcement += "多用反转、吐槽和滑稽的比喻，在紧张中穿插笑点。";
    }
    if (lowerStyle.includes("恐怖") || lowerStyle.includes("惊悚") || lowerStyle.includes("horror")) {
      enforcement += "注重环境氛围的压抑感，多描写未知的恐惧和感官的不适（粘稠、阴冷、异响）。";
    }
    if (lowerStyle.includes("黑暗") || lowerStyle.includes("dark")) {
      enforcement += "突出人性的自私与残酷，环境描写偏向阴暗、破败。";
    }
    if (lowerStyle.includes("爽文") || lowerStyle.includes("cool")) {
      enforcement += "极力铺垫情绪，突出主角的装逼打脸和绝对优势，节奏要快。";
    }

    return enforcement || "请严格遵循设定的风格基调进行创作。";
  }

  /**
   * Generate genre-specific description for system prompt
   */
  private getGenreDescription(genre: string): string {
    const genreMap: Record<string, string> = {
      '玄幻': '高沉浸感、节奏紧凑、想象瑰丽的玄幻小说',
      '都市': '节奏明快、贴近现实、代入感强的都市小说',
      '仙侠': '气势恢宏、意境深远、充满东方韵味的仙侠小说',
      '科幻': '逻辑严谨、设定硬核、充满科技感的科幻小说',
      '悬疑': '逻辑缜密、线索清晰、悬念迭起的悬疑推理小说',
      '历史': '历史厚重、考据严谨、笔触典雅的历史小说',
      '言情': '情感细腻、心理描写深入、浪漫动人的言情小说',
      '奇幻': '世界观宏大、魔法体系完整、冒险刺激的奇幻小说',
      '武侠': '江湖气息浓郁、武功描写精彩、侠义精神的武侠小说',
      '灵异': '氛围诡谲、悬念丛生、恐怖感强的灵异小说',
      '游戏': '游戏设定完整、升级体系清晰、爽快刺激的游戏小说',
      '同人': '还原度高、人设贴合、剧情创新的同人小说',
    };

    return genreMap[genre] || `充满想象力、引人入胜的${genre}小说`;
  }

  /**
   * Generate genre-specific instructions
   */
  private getGenreSpecificInstructions(genre: string): string {
    const instructionsMap: Record<string, string> = {
      '科幻': `
- **硬科幻约束**：确保技术设定符合科学逻辑，避免"玄学化"的科技描写。
- **世界观一致性**：科技水平、社会结构需前后一致，不要出现修仙、灵力等玄幻元素。`,

      '悬疑': `
- **线索布置**：每个场景至少埋设1-2个推理线索，关键信息需自然展现。
- **逻辑自洽**：案件推理过程必须符合逻辑，避免强行逆转或神秘主义解释。`,

      '言情': `
- **情感细腻**：注重人物内心活动和情感变化，多用心理描写和细节暗示。
- **互动自然**：角色间的互动要有张力和化学反应，避免直白的"我喜欢你"式告白。`,

      '历史': `
- **语言考究**：使用符合时代特色的语言风格，避免现代网络用语。
- **历史细节**：服饰、礼仪、称谓需符合史实，重大历史事件需尊重基本史实。`,
    };

    return instructionsMap[genre] || '';
  }
}

// Export singleton instance for backward compatibility
import { storage } from './storage';
export const promptTemplateService = new PromptTemplateService(storage);
