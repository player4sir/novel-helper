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

    // Replace common placeholders
    const replacements: Record<string, string> = {
      '{project_id}': context.projectId,
      '{chapter_id}': context.chapterId,
      '{chapter_index}': String(context.chapterIndex),
      '{beats}': context.beats.join('\n'),
      '{estimated_words}': String(context.estimatedWords),
      '{min_words}': String(minWords),
      '{max_words}': String(maxWords),
      '{style_guidelines}': context.styleGuidelines || '标准网络小说风格',
      '{style_guidance}': context.styleGuidelines ? `叙事风格：${context.styleGuidelines}` : '',
      '{style_enforcement}': this.generateStyleEnforcement(context.styleGuidelines || ''),
      '{prev_compact_summary}': context.previousSummary || '（本章开始）',
      '{required_characters_brief}': context.characters.map(c => `${c.name}: ${c.role}`).join(', '),
      '{character_info}': characterInfo,
      '{project_summary}': '（项目背景信息）',
      '{chapter_outline}': '（章节大纲）',
      '{world_settings}': context.worldSettings || '（暂无特殊世界观设定，请基于常规设定创作）',
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

    // Hardcoded fallback template
    const fallbackText = `系统：你是专业网文大神助手，擅长创作高沉浸感、节奏紧凑的玄幻/都市/仙侠小说。你的目标是根据大纲产出极具画面感、代入感的章节正文。

输入信息：
- 核心冲突：{project_summary}
- 本章大纲：{beats}
- 登场角色：{required_characters_brief}
- 角色详情：{character_info}
- 预估字数：{estimated_words}
- 风格要求：{style_guidelines}
- 世界观设定：
{world_settings}

- 故事背景（Story Context）：
"""
{story_context}
"""

- 上文结尾（Previous Content）：
"""
{prev_compact_summary}
"""

创作指令：
1.  **严禁重复（CRITICAL）**：上述“上文结尾”是**已经写完**的内容。**绝对不要**重复、改写或总结这段文字。请直接从“上文结尾”的最后一个标点符号之后继续写下去。
2.  **时间线推进**：必须紧接着上文的时间点继续推进剧情，**严禁时间回溯**。
3.  **沉浸式描写**：拒绝流水账。多用感官描写（视觉、听觉、触觉）构建场景。
4.  **深层视角**：紧贴POV角色（视点人物）的心理活动和感官体验，写出TA的所思所想，而非旁观者视角。
5.  **节奏把控**：
    *   动作戏/冲突：短句为主，动词精准，营造紧张感。
    *   文戏/情感：铺垫氛围，细腻刻画微表情和潜台词。
6.  **对话自然**：符合角色身份性格，避免“说明书式”对话。对话要有交锋、有潜台词。
7.  **风格强化（CRITICAL）**：
    *   **严格执行风格**：{style_enforcement}
    *   **风格关键词**：{style_guidelines}
    *   请确保每一段落的描写、对话和氛围都符合上述风格要求。
8.  **负面约束**：
    *   不要出现“书接上回”、“上文提到”等说书人语气的连接词。
    *   不要在开头总结前情。
    *   不要出现“待续”、“未完”等标记。

输出要求：
- 直接输出正文，不要包含“好的”、“以下是正文”等废话。
- 若大纲中有逻辑断层，请基于角色性格合理脑补衔接。
- 遇到未设定细节（如路人名、招式名），请自动生成符合世界观的名称。`;

    return {
      id: templateId,
      name: 'Fallback Template (High Quality)',
      version: '1.2',
      templateText: fallbackText,
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
}

// Export singleton instance for backward compatibility
import { storage } from './storage';
export const promptTemplateService = new PromptTemplateService(storage);
