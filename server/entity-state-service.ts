// Entity State Management Service
// 实现角色状态追踪和动机漂移检测
// 遵循构建创作小说应用方案.txt的Entity数据模型

import { storage } from "./storage";
import type { Character } from "@shared/schema";

export interface EntityState {
  characterId: string;
  name: string;
  currentEmotion?: string;
  currentGoal?: string;
  arcPoints: string[];
  lastMentioned?: {
    volumeIndex: number;
    chapterIndex: number;
    sceneIndex: number;
  };
}

export interface MotivationDriftResult {
  drifted: boolean;
  confidence: number;
  evidence: string[];
}

export class EntityStateService {
  /**
   * 获取角色当前状态
   */
  async getEntityState(characterId: string): Promise<EntityState | null> {
    try {
      const character = await storage.getCharacter(characterId);
      if (!character) return null;

      return {
        characterId: character.id,
        name: character.name,
        currentEmotion: character.currentEmotion || undefined,
        currentGoal: character.currentGoal || undefined,
        arcPoints: (character.arcPoints as string[]) || [],
        lastMentioned: character.lastMentioned as any,
      };
    } catch (error) {
      console.error(`[Entity State] Failed to get state for ${characterId}:`, error);
      return null;
    }
  }

  /**
   * 更新角色状态
   */
  async updateEntityState(
    characterId: string,
    updates: {
      emotion?: string;
      goal?: string;
      arcPoint?: string;
    }
  ): Promise<void> {
    try {
      const character = await storage.getCharacter(characterId);
      if (!character) return;

      const updateData: any = {
        stateUpdatedAt: new Date(),
      };

      if (updates.emotion) {
        updateData.currentEmotion = updates.emotion;
      }

      if (updates.goal) {
        updateData.currentGoal = updates.goal;
      }

      if (updates.arcPoint) {
        const arcPoints = (character.arcPoints as string[]) || [];
        arcPoints.push(updates.arcPoint);
        updateData.arcPoints = arcPoints;
      }

      await storage.updateCharacter(characterId, updateData);

      console.log(`[Entity State] Updated state for ${character.name}`);
    } catch (error) {
      console.error(`[Entity State] Failed to update state:`, error);
    }
  }

  /**
   * 记录角色状态历史
   */
  async recordStateHistory(
    characterId: string,
    chapterId: string,
    sceneIndex: number,
    state: {
      emotion?: string;
      goal?: string;
      arcPoint?: string;
      notes?: string;
    }
  ): Promise<void> {
    try {
      await storage.createCharacterStateHistory({
        characterId,
        chapterId,
        sceneIndex,
        emotion: state.emotion || null,
        goal: state.goal || null,
        arcPoint: state.arcPoint || null,
        notes: state.notes || null,
      });

      console.log(`[Entity State] Recorded history for character ${characterId}`);
    } catch (error) {
      console.error(`[Entity State] Failed to record history:`, error);
    }
  }

  /**
   * 检测动机漂移
   * 支持基于规则和embedding的双重检测
   */
  async checkMotivationDrift(
    character: Character,
    content: string,
    useEmbedding: boolean = true,
    userId?: string
  ): Promise<MotivationDriftResult> {
    try {
      const motivation = character.shortMotivation || character.personality || "";
      if (!motivation) {
        return { drifted: false, confidence: 0, evidence: [] };
      }

      // 提取角色行为
      const actions = this.extractCharacterActions(content, character.name);
      if (actions.length === 0) {
        return { drifted: false, confidence: 0, evidence: [] };
      }

      // 1. 基于规则的检测
      const ruleBasedResult = await this.checkMotivationDriftByRules(
        motivation,
        actions
      );

      // 2. 如果启用embedding，使用语义检测
      if (useEmbedding) {
        try {
          const embeddingResult = await this.checkMotivationDriftByEmbedding(
            character.name,
            motivation,
            content,
            userId
          );

          // 综合两种方法的结果
          const drifted = ruleBasedResult.drifted || embeddingResult.drifted;
          const confidence = Math.max(
            ruleBasedResult.confidence,
            embeddingResult.confidence
          );
          const evidence = [
            ...ruleBasedResult.evidence,
            ...embeddingResult.evidence,
          ];

          return { drifted, confidence, evidence };
        } catch (error) {
          console.log(
            "[Entity State] Embedding drift check failed, using rule-based only"
          );
          return ruleBasedResult;
        }
      }

      return ruleBasedResult;
    } catch (error) {
      console.error(`[Entity State] Motivation drift check failed:`, error);
      return { drifted: false, confidence: 0, evidence: [] };
    }
  }

  /**
   * 基于规则的动机漂移检测
   */
  private async checkMotivationDriftByRules(
    motivation: string,
    actions: string[]
  ): Promise<MotivationDriftResult> {
    // 提取关键词
    const motivationKeywords = this.extractKeywords(motivation);
    const actionKeywords = this.extractKeywords(actions.join(" "));

    // 计算重叠度
    const overlap = motivationKeywords.filter((k) =>
      actionKeywords.some((a) => a.includes(k) || k.includes(a))
    ).length;

    const overlapRatio = overlap / Math.max(motivationKeywords.length, 1);

    // 降低阈值到15%，减少误报 - 只有在严重不符时才报告
    // 同时要求confidence > 0.7才认为是真正的漂移
    const drifted = overlapRatio < 0.15;
    const confidence = drifted ? Math.min(1 - overlapRatio, 0.85) : 0;

    const evidence: string[] = [];
    if (drifted && confidence > 0.7) {
      evidence.push(`[规则检测] 角色动机关键词：${motivationKeywords.join("、")}`);
      evidence.push(`[规则检测] 实际行为关键词：${actionKeywords.join("、")}`);
      evidence.push(`[规则检测] 重叠度：${(overlapRatio * 100).toFixed(1)}%`);
    }

    return { drifted: drifted && confidence > 0.7, confidence, evidence };
  }

  /**
   * 基于embedding的动机漂移检测
   */
  private async checkMotivationDriftByEmbedding(
    characterName: string,
    motivation: string,
    content: string,
    userId?: string
  ): Promise<MotivationDriftResult> {
    // 导入aiService
    const { aiService } = await import("./ai-service");

    // 提取角色相关内容
    const characterContent = this.extractCharacterContent(content, characterName);
    if (!characterContent) {
      return { drifted: false, confidence: 0, evidence: [] };
    }

    // 获取动机和行为的embedding
    const motivationEmbedding = await aiService.getEmbedding(
      `角色动机：${motivation}`,
      userId
    );
    const behaviorEmbedding = await aiService.getEmbedding(
      `角色行为：${characterContent}`,
      userId
    );

    if (!motivationEmbedding || !behaviorEmbedding) {
      throw new Error("Failed to get embeddings");
    }

    // 计算余弦相似度
    const similarity = this.cosineSimilarity(
      motivationEmbedding,
      behaviorEmbedding
    );

    // 降低阈值到0.4，只在严重不符时报告
    // 相似度低于0.4才认为存在漂移
    const drifted = similarity < 0.4;
    const confidence = drifted ? Math.min(1 - similarity, 0.9) : 0;

    const evidence: string[] = [];
    // 只有在confidence > 0.7时才记录证据
    if (drifted && confidence > 0.7) {
      evidence.push(
        `[语义检测] 动机与行为相似度：${(similarity * 100).toFixed(1)}%`
      );
      evidence.push(`[语义检测] 角色行为片段：${characterContent.substring(0, 100)}...`);
    }

    return { drifted: drifted && confidence > 0.7, confidence, evidence };
  }

  /**
   * 提取角色相关内容
   */
  private extractCharacterContent(content: string, characterName: string): string {
    const sentences = content.split(/[。！？]/);
    const relevantSentences = sentences.filter((s) => s.includes(characterName));
    return relevantSentences.join("。");
  }

  /**
   * 计算余弦相似度
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  /**
   * 提取角色行为
   */
  private extractCharacterActions(content: string, characterName: string): string[] {
    const actions: string[] = [];
    const sentences = content.split(/[。！？]/);

    for (const sentence of sentences) {
      if (sentence.includes(characterName)) {
        // 提取动词短语
        const verbs = sentence.match(/[\u4e00-\u9fa5]{1,4}(了|着|过|地)/g);
        if (verbs) {
          actions.push(...verbs);
        }
      }
    }

    return actions;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    // 移除常用词
    const commonWords = [
      "的", "了", "在", "是", "和", "与", "等", "着", "中", "到",
      "从", "对", "为", "以", "将", "被", "有", "个", "人", "这",
      "那", "他", "她", "我", "你", "们", "也", "都", "就", "要",
    ];

    const words = text
      .split(/[，。、：；！？\s]/)
      .filter(w => w.length >= 2 && !commonWords.includes(w));

    // 去重并返回前10个
    return Array.from(new Set(words)).slice(0, 10);
  }

  /**
   * 获取角色的弧光点
   */
  async getArcPoints(characterId: string): Promise<string[]> {
    try {
      const character = await storage.getCharacter(characterId);
      if (!character) return [];

      return (character.arcPoints as string[]) || [];
    } catch (error) {
      console.error(`[Entity State] Failed to get arc points:`, error);
      return [];
    }
  }

  /**
   * 添加弧光点
   */
  async addArcPoint(characterId: string, arcPoint: string): Promise<void> {
    try {
      const character = await storage.getCharacter(characterId);
      if (!character) return;

      const arcPoints = (character.arcPoints as string[]) || [];
      arcPoints.push(arcPoint);

      await storage.updateCharacter(characterId, {
        arcPoints: arcPoints as any,
        stateUpdatedAt: new Date(),
      });

      console.log(`[Entity State] Added arc point for ${character.name}: ${arcPoint}`);
    } catch (error) {
      console.error(`[Entity State] Failed to add arc point:`, error);
    }
  }

  /**
   * 构建实体状态提示词模块
   * 提供详细的角色状态信息用于AI生成
   */
  async buildEntityStatesPrompt(
    projectId: string,
    entityNames: string[]
  ): Promise<string> {
    try {
      const characters = await storage.getCharactersByProject(projectId);
      const relevantChars = characters.filter((c) => entityNames.includes(c.name));

      if (relevantChars.length === 0) {
        return "# 角色当前状态\n暂无角色状态信息";
      }

      const stateDescriptions = await Promise.all(
        relevantChars.map(async (char) => {
          const arcPoints = (char.arcPoints as string[]) || [];
          const lastMentioned = char.lastMentioned as any;

          // 获取最近的状态历史
          const recentHistory = await this.getRecentStateHistory(char.id, 3);

          let historyText = "";
          if (recentHistory.length > 0) {
            historyText = `\n  - 状态变化：\n${recentHistory
              .map(
                (h) =>
                  `    * ${h.emotion ? `情感→${h.emotion}` : ""}${h.goal ? ` 目标→${h.goal}` : ""}${h.arcPoint ? ` 弧光点→${h.arcPoint}` : ""}`
              )
              .join("\n")}`;
          }

          return `【${char.name}】
  - 角色定位：${char.role}（${char.personality || "性格未知"}）
  - 当前情感：${char.currentEmotion || "未设定"}
  - 当前目标：${char.currentGoal || "未设定"}
  - 核心动机：${char.shortMotivation || char.personality || "未知"}
  - 弧光点：${arcPoints.length > 0 ? arcPoints.slice(-3).join("、") : "暂无"}
  - 最近出现：${lastMentioned ? `第${lastMentioned.chapterIndex + 1}章第${lastMentioned.sceneIndex + 1}场景` : "首次出现"}${historyText}
  
  写作提示：展现角色的${char.currentEmotion || "情感"}和${char.currentGoal || "目标"}，保持动机一致性。${arcPoints.length > 0 ? `注意角色成长轨迹：${arcPoints.slice(-1)[0]}` : ""}`;
        })
      );

      return `# 角色当前状态\n\n${stateDescriptions.join("\n\n")}`;
    } catch (error) {
      console.error(`[Entity State] Failed to build prompt:`, error);
      return "# 角色当前状态\n获取状态信息失败";
    }
  }

  /**
   * 获取最近的状态历史
   */
  private async getRecentStateHistory(
    characterId: string,
    limit: number = 3
  ): Promise<any[]> {
    try {
      const history = await storage.getCharacterStateHistory(characterId, limit);
      return history;
    } catch (error) {
      console.error("[Entity State] Failed to get recent history:", error);
      return [];
    }
  }

  /**
   * 批量检测多个角色的动机漂移
   */
  async checkMultipleCharactersDrift(
    projectId: string,
    content: string,
    characterNames: string[],
    userId?: string
  ): Promise<Map<string, MotivationDriftResult>> {
    const results = new Map<string, MotivationDriftResult>();

    try {
      const characters = await storage.getCharactersByProject(projectId);
      const relevantChars = characters.filter((c) =>
        characterNames.includes(c.name)
      );

      for (const char of relevantChars) {
        const result = await this.checkMotivationDrift(char, content, true, userId);
        results.set(char.name, result);
      }
    } catch (error) {
      console.error("[Entity State] Batch drift check failed:", error);
    }

    return results;
  }

  /**
   * 自动更新角色状态（基于内容分析）
   */
  async autoUpdateEntityState(
    characterId: string,
    chapterId: string,
    sceneIndex: number,
    content: string,
    userId?: string
  ): Promise<void> {
    try {
      const character = await storage.getCharacter(characterId);
      if (!character) return;

      // 提取角色相关内容
      const characterContent = this.extractCharacterContent(
        content,
        character.name
      );
      if (!characterContent) return;

      // 尝试使用AI增强提取（如果内容足够长）
      let emotion: string | undefined;
      let goal: string | undefined;
      let arcPoint: string | undefined;

      if (characterContent.length > 100) {
        try {
          // 使用AI提取（更准确）
          const aiExtracted = await this.extractStateWithAI(
            character.name,
            characterContent,
            userId
          );
          emotion = aiExtracted.emotion;
          goal = aiExtracted.goal;
          arcPoint = aiExtracted.arcPoint;

          console.log(
            `[Entity State] AI extraction for ${character.name}: ` +
            `emotion=${emotion || 'none'}, goal=${goal || 'none'}, arcPoint=${arcPoint || 'none'}`
          );
        } catch (aiError) {
          console.log(
            `[Entity State] AI extraction failed for ${character.name}, using rule-based`
          );
          // Fallback to rule-based
          emotion = this.detectEmotion(characterContent);
          goal = this.detectGoal(characterContent);
          arcPoint = this.detectArcPoint(characterContent, character.name);
        }
      } else {
        // 内容太短，使用规则检测
        emotion = this.detectEmotion(characterContent);
        goal = this.detectGoal(characterContent);
        arcPoint = this.detectArcPoint(characterContent, character.name);
      }

      // 更新状态
      if (emotion || goal || arcPoint) {
        await this.updateEntityState(characterId, { emotion, goal, arcPoint });

        // 记录历史
        await this.recordStateHistory(characterId, chapterId, sceneIndex, {
          emotion,
          goal,
          arcPoint,
          notes: `自动检测：${characterContent.substring(0, 50)}...`,
        });

        console.log(
          `[Entity State] Auto-updated state for ${character.name}: ` +
          `emotion=${emotion}, goal=${goal}, arcPoint=${arcPoint ? arcPoint.substring(0, 30) : 'none'}`
        );
      }
    } catch (error) {
      console.error("[Entity State] Auto-update failed:", error);
    }
  }

  /**
   * 使用AI提取角色状态（更准确）
   */
  private async extractStateWithAI(
    characterName: string,
    content: string,
    userId?: string
  ): Promise<{
    emotion?: string;
    goal?: string;
    arcPoint?: string;
  }> {
    const { aiService } = await import("./ai-service");

    const prompt = `分析以下内容中"${characterName}"的状态，提取：
1. 当前情绪（一个词，如：愤怒、喜悦、恐惧、坚定等）
2. 当前目标（一句话，如果有明确目标）
3. 成长时刻（如果有重要的觉悟、突破、转变等）

内容：
${content}

请以JSON格式返回：
{
  "emotion": "情绪词或null",
  "goal": "目标描述或null",
  "arcPoint": "成长时刻描述或null"
}

注意：
- 如果没有明确信息，返回null
- emotion只返回一个词
- goal要简洁（10-20字）
- arcPoint要包含类型（如"觉悟："、"突破："等）`;

    try {
      // 获取默认模型配置
      const models = await storage.getAIModels(userId || "");
      const defaultModel = models.find(m => m.isDefaultChat && m.isActive);

      if (!defaultModel) {
        throw new Error("No default chat model configured");
      }

      const result = await aiService.generate({
        prompt,
        modelId: defaultModel.modelId,
        provider: defaultModel.provider,
        baseUrl: defaultModel.baseUrl || "",
        apiKey: defaultModel.apiKey || undefined,
        parameters: {
          temperature: 0.3, // 低温度，更准确
          maxTokens: 200,
        },
      });

      // 解析JSON
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          emotion: parsed.emotion || undefined,
          goal: parsed.goal || undefined,
          arcPoint: parsed.arcPoint || undefined,
        };
      }
    } catch (error) {
      console.error("[Entity State] AI extraction parse failed:", error);
    }

    return {};
  }

  /**
   * 检测情感（增强规则）
   */
  private detectEmotion(content: string): string | undefined {
    const emotionKeywords = {
      愤怒: ["愤怒", "生气", "暴怒", "怒火", "气得", "恼怒", "发怒", "火冒三丈"],
      悲伤: ["悲伤", "难过", "伤心", "哭泣", "流泪", "痛苦", "悲痛", "心碎"],
      喜悦: ["高兴", "开心", "喜悦", "欢喜", "笑", "兴奋", "愉快", "欣喜"],
      恐惧: ["害怕", "恐惧", "惊恐", "畏惧", "颤抖", "胆怯", "惊慌", "恐慌"],
      惊讶: ["惊讶", "震惊", "诧异", "惊愕", "愣住", "呆住", "目瞪口呆"],
      焦虑: ["焦虑", "担心", "忧虑", "不安", "紧张", "着急", "烦躁"],
      坚定: ["坚定", "决心", "果断", "毅然", "坚决", "毫不犹豫", "义无反顾"],
      冷静: ["冷静", "镇定", "沉着", "从容", "淡定"],
      紧张: ["紧张", "忐忑", "心跳加速", "手心出汗"],
    };

    // 计算每种情感的匹配度
    let maxScore = 0;
    let detectedEmotion: string | undefined;

    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      const score = keywords.filter((k) => content.includes(k)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedEmotion = emotion;
      }
    }

    return maxScore > 0 ? detectedEmotion : undefined;
  }

  /**
   * 检测目标（增强规则）
   */
  private detectGoal(content: string): string | undefined {
    // 更全面的目标模式
    const goalPatterns = [
      /["""]([^"""]*?要[^"""]*?)["""]/,  // 对话中的目标
      /要(.*?)[。！？]/,
      /必须(.*?)[。！？]/,
      /决定(.*?)[。！？]/,
      /打算(.*?)[。！？]/,
      /准备(.*?)[。！？]/,
      /计划(.*?)[。！？]/,
      /想要(.*?)[。！？]/,
      /希望(.*?)[。！？]/,
      /目标是(.*?)[。！？]/,
    ];

    for (const pattern of goalPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const goal = match[1].trim();
        // 过滤掉过短或无意义的目标
        if (goal.length > 3 && goal.length < 50) {
          return goal;
        }
      }
    }

    return undefined;
  }

  /**
   * 检测弧光点（重要成长时刻）
   */
  private detectArcPoint(content: string, characterName: string): string | undefined {
    const arcPointKeywords = {
      突破: ["突破", "顿悟", "领悟", "觉醒"],
      决心: ["发誓", "立誓", "决心", "下定决心"],
      转变: ["改变", "转变", "不再", "从此"],
      牺牲: ["牺牲", "放弃", "舍弃"],
      胜利: ["战胜", "击败", "成功", "胜利"],
      失败: ["失败", "落败", "失去"],
      觉悟: ["明白", "理解", "意识到", "终于"],
      成长: ["成长", "蜕变", "进化", "升华"],
    };

    for (const [type, keywords] of Object.entries(arcPointKeywords)) {
      if (keywords.some((k) => content.includes(k) && content.includes(characterName))) {
        // 提取关键句子
        const sentences = content.split(/[。！？]/);
        for (const sentence of sentences) {
          if (sentence.includes(characterName) && keywords.some(k => sentence.includes(k))) {
            return `${type}：${sentence.trim().substring(0, 30)}`;
          }
        }
      }
    }

    return undefined;
  }
}

export const entityStateService = new EntityStateService();
