// Rule Checker Service
// Fast deterministic checks + semantic validation using small models

import { aiService } from "./ai-service";
import { storage } from "./storage";

export interface RuleViolation {
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
  autoFixable: boolean; // NEW: Whether this violation can be auto-fixed
  location?: {
    start: number;
    end: number;
  };
}

export interface SemanticIssue {
  type: "motivation_drift" | "contradiction" | "lost_foreshadowing" | "inconsistency";
  severity: "high" | "medium" | "low";
  description: string;
  evidence: string[];
  confidence: number;
}

export interface RuleCheckResult {
  passed: boolean;
  score: number;
  violations: RuleViolation[];
  executionTime: number; // NEW: Execution time in ms
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  violations: RuleViolation[];
  semanticIssues: SemanticIssue[];
  summary: string;
}

export class RuleCheckerService {
  // ============================================================================
  // Fast Deterministic Checks
  // ============================================================================

  /**
   * Check ProjectMeta completeness and quality
   */
  checkProjectMeta(meta: any): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // 1. Required fields
    if (!meta.title || meta.title.trim().length === 0) {
      violations.push({
        rule: "required_title",
        severity: "error",
        message: "标题不能为空",
        autoFixable: false,
      });
    }

    if (!meta.premise || meta.premise.length < 100) {
      violations.push({
        rule: "premise_length",
        severity: "error",
        message: "核心设定至少需要100字",
        suggestion: "补充更多背景和故事梗概",
        autoFixable: false,
      });
    }

    // 2. Completeness
    if (!meta.themeTags || meta.themeTags.length === 0) {
      violations.push({
        rule: "missing_theme_tags",
        severity: "warning",
        message: "缺少主题标签",
        suggestion: "添加3-5个主题标签",
        autoFixable: false,
      });
    }

    if (!meta.coreConflicts || meta.coreConflicts.length < 2) {
      violations.push({
        rule: "insufficient_conflicts",
        severity: "warning",
        message: "核心冲突不足",
        suggestion: "至少需要2-3个核心冲突点",
        autoFixable: false,
      });
    }

    if (!meta.mainEntities || meta.mainEntities.length < 2) {
      violations.push({
        rule: "insufficient_entities",
        severity: "warning",
        message: "主要角色不足",
        suggestion: "至少需要2-3个核心角色",
        autoFixable: false,
      });
    }

    // 3. Quality checks
    if (meta.title && meta.title.length > 50) {
      violations.push({
        rule: "title_too_long",
        severity: "warning",
        message: "标题过长（超过50字）",
        suggestion: "简化标题，保持在20字以内",
        autoFixable: false,
      });
    }

    if (meta.premise && meta.premise.length > 500) {
      violations.push({
        rule: "premise_too_long",
        severity: "info",
        message: "核心设定过长（超过500字）",
        suggestion: "精简到200-300字",
        autoFixable: false,
      });
    }

    // 4. Entity validation
    if (meta.mainEntities) {
      const hasProtagonist = meta.mainEntities.some(
        (e: any) => e.role === "主角" || e.role === "protagonist"
      );
      if (!hasProtagonist) {
        violations.push({
          rule: "missing_protagonist",
          severity: "error",
          message: "缺少主角",
          suggestion: "至少需要一个主角",
          autoFixable: false,
        });
      }

      // Check for duplicate names
      const names = meta.mainEntities.map((e: any) => e.name);
      const duplicates = names.filter(
        (name: string, index: number) => names.indexOf(name) !== index
      );
      if (duplicates.length > 0) {
        violations.push({
          rule: "duplicate_entity_names",
          severity: "error",
          message: `角色名重复：${duplicates.join(", ")}`,
          suggestion: "确保每个角色名唯一",
          autoFixable: false,
        });
      }
    }

    // 5. Keyword validation
    if (meta.keywords && meta.keywords.length < 3) {
      violations.push({
        rule: "insufficient_keywords",
        severity: "info",
        message: "关键词不足",
        suggestion: "添加5-8个关键词以提升生成质量",
        autoFixable: false,
      });
    }

    return violations;
  }

  /**
   * Check draft content quality
   */
  checkDraftContent(content: string, constraints?: any): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // 1. Word count
    const wordCount = this.countWords(content);
    if (constraints?.minWords && wordCount < constraints.minWords) {
      violations.push({
        rule: "word_count_too_low",
        severity: "warning",
        message: `字数不足（${wordCount}/${constraints.minWords}）`,
        suggestion: "补充更多细节和描写",
        autoFixable: false,
      });
    }

    if (constraints?.maxWords && wordCount > constraints.maxWords) {
      violations.push({
        rule: "word_count_too_high",
        severity: "warning",
        message: `字数超标（${wordCount}/${constraints.maxWords}）`,
        suggestion: "精简内容，去除冗余",
        autoFixable: false,
      });
    }

    // 2. Dialogue ratio
    const dialogueRatio = this.calculateDialogueRatio(content);
    if (dialogueRatio < 0.05) {
      violations.push({
        rule: "dialogue_too_low",
        severity: "info",
        message: `对话比例过低（${(dialogueRatio * 100).toFixed(1)}%）`,
        suggestion: "增加角色对话，提升互动感",
        autoFixable: false,
      });
    }

    if (dialogueRatio > 0.7) {
      violations.push({
        rule: "dialogue_too_high",
        severity: "warning",
        message: `对话比例过高（${(dialogueRatio * 100).toFixed(1)}%）`,
        suggestion: "增加场景描写和心理活动",
        autoFixable: false,
      });
    }

    // 3. Meta-commentary detection
    const metaComments = this.detectMetaCommentary(content);
    if (metaComments.length > 0) {
      violations.push({
        rule: "meta_commentary",
        severity: "error",
        message: "检测到元评论（作者旁白）",
        suggestion: `移除以下内容：${metaComments.join("; ")}`,
        autoFixable: true,
      });
    }

    // 4. Paragraph structure
    const paragraphs = content.split("\n\n").filter((p) => p.trim().length > 0);
    if (paragraphs.length < 3) {
      violations.push({
        rule: "insufficient_paragraphs",
        severity: "warning",
        message: "段落过少，影响阅读体验",
        suggestion: "适当分段，每段3-5句话",
        autoFixable: false,
      });
    }

    const longParagraphs = paragraphs.filter((p) => p.length > 500);
    if (longParagraphs.length > 0) {
      violations.push({
        rule: "paragraph_too_long",
        severity: "info",
        message: `${longParagraphs.length}个段落过长`,
        suggestion: "将长段落拆分为多个短段",
        autoFixable: true,
      });
    }

    // 5. Repetition detection
    const repetitions = this.detectRepetition(content);
    if (repetitions.length > 0) {
      violations.push({
        rule: "repetitive_content",
        severity: "warning",
        message: "检测到重复内容",
        suggestion: `避免重复：${repetitions.slice(0, 3).join("; ")}`,
        autoFixable: true,
      });
    }

    return violations;
  }

  // ============================================================================
  // Enhanced Rule Checks (Task 5)
  // ============================================================================

  /**
   * Fast deterministic checks with auto-fixable marking (< 100ms target)
   */
  checkContent(content: string, constraints?: any): RuleCheckResult {
    const startTime = Date.now();
    const violations = this.checkDraftContent(content, constraints);

    // Mark auto-fixable violations
    violations.forEach(v => {
      v.autoFixable = this.markAutoFixable(v);
    });

    const executionTime = Date.now() - startTime;
    const errorCount = violations.filter(v => v.severity === "error").length;

    let score = 100;
    score -= errorCount * 20;
    score -= violations.filter(v => v.severity === "warning").length * 10;
    score = Math.max(0, score);

    return {
      passed: errorCount === 0,
      score,
      violations,
      executionTime
    };
  }

  /**
   * Mark whether a violation can be auto-fixed
   */
  markAutoFixable(violation: RuleViolation): boolean {
    const autoFixableRules = [
      "meta_commentary",           // Can remove meta comments
      "paragraph_too_long",        // Can split paragraphs
      "dialogue_too_low",          // Can suggest adding dialogue (but not auto-fix)
      "word_count_too_low",        // Cannot auto-fix (needs content generation)
      "word_count_too_high",       // Can trim content
      "repetitive_content",        // Can remove repetitions
      "naming_inconsistency",      // Can standardize names
      "timeline_inconsistency",    // Cannot auto-fix (needs context)
      "state_transition_missing",  // Cannot auto-fix (needs content generation)
    ];

    // Simple rules that can be auto-fixed
    const simpleAutoFix = [
      "meta_commentary",
      "paragraph_too_long",
      "repetitive_content",
      "naming_inconsistency"
    ];

    return simpleAutoFix.includes(violation.rule);
  }

  /**
   * Check naming consistency across content
   */
  checkNamingConsistency(
    content: string,
    characterNames: string[]
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];

    for (const name of characterNames) {
      // Check for common variations
      const variations = this.findNameVariations(content, name);

      if (variations.length > 1) {
        violations.push({
          rule: "naming_inconsistency",
          severity: "warning",
          message: `角色"${name}"存在多种称呼：${variations.join(", ")}`,
          suggestion: `统一使用"${name}"`,
          autoFixable: true,
        });
      }
    }

    return violations;
  }

  /**
   * Check timeline consistency
   */
  checkTimelineConsistency(
    currentContent: string,
    previousContent: string
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // Extract time markers from both contents
    const currentTimeMarkers = this.extractTimeMarkers(currentContent);
    const previousTimeMarkers = this.extractTimeMarkers(previousContent);

    // Check for time jumps or contradictions
    if (currentTimeMarkers.length > 0 && previousTimeMarkers.length > 0) {
      const lastPrevTime = previousTimeMarkers[previousTimeMarkers.length - 1];
      const firstCurrentTime = currentTimeMarkers[0];

      // Simple heuristic: check for obvious contradictions
      if (this.hasTimeContradiction(lastPrevTime, firstCurrentTime)) {
        violations.push({
          rule: "timeline_inconsistency",
          severity: "warning",
          message: `时间线可能存在矛盾：前文"${lastPrevTime}"，当前"${firstCurrentTime}"`,
          suggestion: "检查时间顺序是否合理",
          autoFixable: false,
        });
      }
    }

    return violations;
  }

  /**
   * Check state transition (entry/exit states)
   */
  checkStateTransition(
    content: string,
    sceneFrame: any
  ): RuleViolation[] {
    const violations: RuleViolation[] = [];

    // Check if entry state is reflected in content
    if (sceneFrame.entryStateSummary) {
      const entryKeywords = this.extractKeywords(sceneFrame.entryStateSummary);
      const hasEntryReflection = entryKeywords.some(kw =>
        content.includes(kw)
      );

      if (!hasEntryReflection) {
        violations.push({
          rule: "state_transition_missing",
          severity: "info",
          message: "入场状态未在内容中体现",
          suggestion: `确保体现：${sceneFrame.entryStateSummary}`,
          autoFixable: false,
        });
      }
    }

    // Check if exit state is reflected in content
    if (sceneFrame.exitStateSummary) {
      const exitKeywords = this.extractKeywords(sceneFrame.exitStateSummary);
      const hasExitReflection = exitKeywords.some(kw =>
        content.includes(kw)
      );

      if (!hasExitReflection) {
        violations.push({
          rule: "state_transition_missing",
          severity: "info",
          message: "出场状态未在内容中体现",
          suggestion: `确保体现：${sceneFrame.exitStateSummary}`,
          autoFixable: false,
        });
      }
    }

    return violations;
  }

  // ============================================================================
  // Semantic Validation (using small models)
  // ============================================================================

  /**
   * Check consistency using small model
   */
  async checkConsistency(meta: any, userId?: string): Promise<SemanticIssue[]> {
    const issues: SemanticIssue[] = [];

    try {
      const prompt = `分析以下小说设定的一致性问题：

标题：${meta.title}
类型：${meta.themeTags?.join(", ")}
基调：${meta.toneProfile}
核心设定：${meta.premise}
冲突：${meta.coreConflicts?.join("; ")}

检查：
1. 标题与设定是否匹配？
2. 基调与冲突是否协调？
3. 是否存在明显矛盾？

如果发现问题，输出JSON格式：
{
  "hasIssues": true,
  "issues": [
    {
      "type": "inconsistency",
      "description": "问题描述",
      "evidence": ["证据1", "证据2"],
      "severity": "high|medium|low",
      "confidence": 0.8
    }
  ]
}

如果没有问题，输出：{"hasIssues": false}`;

      const models = await storage.getAIModels(userId || "");
      const smallModel = models.find(
        (m) => m.modelType === "chat" && m.isActive
      );

      if (!smallModel) {
        console.warn("[RuleChecker] No model available for semantic check");
        return issues;
      }

      const result = await aiService.generate({
        prompt,
        modelId: smallModel.modelId,
        provider: smallModel.provider,
        baseUrl: smallModel.baseUrl || "",
        apiKey: smallModel.apiKey || undefined,
        parameters: {
          temperature: 0.3,
          maxTokens: 500,
        },
        responseFormat: "json",
      });

      const analysis = JSON.parse(result.content);
      if (analysis.hasIssues && analysis.issues) {
        issues.push(...analysis.issues);
      }
    } catch (error) {
      console.error("[RuleChecker] Consistency check failed:", error);
    }

    return issues;
  }

  /**
   * Check writability (can it be expanded into a novel?)
   */
  async checkWritability(meta: any, userId?: string): Promise<{
    score: number;
    issues: string[];
  }> {
    try {
      const prompt = `评估以下设定的可写性（0-100分）：

核心设定：${meta.premise}
冲突：${meta.coreConflicts?.join("; ")}
角色：${meta.mainEntities?.map((e: any) => e.name).join(", ")}

评估标准：
1. 是否有足够的展开空间？
2. 冲突是否可持续？
3. 角色是否有成长空间？
4. 是否适合长篇创作？

输出JSON格式：
{
  "score": 85,
  "issues": ["问题1", "问题2"]
}`;

      const models = await storage.getAIModels(userId || "");
      const smallModel = models.find(
        (m) => m.modelType === "chat" && m.isActive
      );

      if (!smallModel) {
        return { score: 70, issues: [] };
      }

      const result = await aiService.generate({
        prompt,
        modelId: smallModel.modelId,
        provider: smallModel.provider,
        baseUrl: smallModel.baseUrl || "",
        apiKey: smallModel.apiKey || undefined,
        parameters: {
          temperature: 0.3,
          maxTokens: 300,
        },
        responseFormat: "json",
      });

      return JSON.parse(result.content);
    } catch (error) {
      console.error("[RuleChecker] Writability check failed:", error);
      return { score: 70, issues: [] };
    }
  }

  /**
   * Comprehensive validation
   */
  async validate(
    meta: any,
    options: {
      checkSemantics?: boolean;
      checkWritability?: boolean;
      userId?: string;
    } = {}
  ): Promise<ValidationResult> {
    // Fast rule checks
    const violations = this.checkProjectMeta(meta);

    // Semantic checks (optional, slower)
    let semanticIssues: SemanticIssue[] = [];
    if (options.checkSemantics) {
      semanticIssues = await this.checkConsistency(meta, options.userId);
    }

    // Calculate score
    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter((v) => v.severity === "warning").length;
    const highIssueCount = semanticIssues.filter((i) => i.severity === "high").length;

    let score = 100;
    score -= errorCount * 20;
    score -= warningCount * 10;
    score -= highIssueCount * 15;
    score = Math.max(0, score);

    const passed = errorCount === 0 && highIssueCount === 0;

    // Generate summary
    const summary = this.generateSummary(violations, semanticIssues, score);

    return {
      passed,
      score,
      violations,
      semanticIssues,
      summary,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private countWords(text: string): number {
    // Count Chinese characters + English words
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  private calculateDialogueRatio(content: string): number {
    const dialogueMatches = content.match(/["「『](.*?)["」』]/g) || [];
    const dialogueLength = dialogueMatches.join("").length;
    return dialogueLength / content.length;
  }

  private detectMetaCommentary(content: string): string[] {
    const patterns = [
      /（.*?作者.*?）/g,
      /\[.*?注.*?\]/g,
      /【.*?说明.*?】/g,
      /这里.*?需要.*?补充/gi,
      /待.*?完善/gi,
    ];

    const found: string[] = [];
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        found.push(...matches);
      }
    }

    return found;
  }

  private detectRepetition(content: string): string[] {
    const sentences = content.split(/[。！？]/).filter((s) => s.trim().length > 5);
    const repetitions: string[] = [];

    for (let i = 0; i < sentences.length - 1; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const similarity = this.stringSimilarity(sentences[i], sentences[j]);
        if (similarity > 0.8) {
          repetitions.push(sentences[i].substring(0, 20) + "...");
          break;
        }
      }
    }

    return repetitions;
  }

  private stringSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  private generateSummary(
    violations: RuleViolation[],
    semanticIssues: SemanticIssue[],
    score: number
  ): string {
    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter((v) => v.severity === "warning").length;
    const highIssueCount = semanticIssues.filter((i) => i.severity === "high").length;

    if (score >= 90) {
      return "优秀：设定完整且质量高";
    } else if (score >= 70) {
      return `良好：${warningCount}个警告需要注意`;
    } else if (score >= 50) {
      return `及格：${errorCount}个错误，${warningCount}个警告`;
    } else {
      return `不及格：${errorCount}个严重错误，${highIssueCount}个语义问题`;
    }
  }

  // ============================================================================
  // Enhanced Helper Methods (Task 5)
  // ============================================================================

  /**
   * Find name variations in content
   */
  private findNameVariations(content: string, name: string): string[] {
    const variations = new Set<string>();
    variations.add(name);

    // Common Chinese name patterns
    const patterns = [
      name,                           // Full name
      name.slice(0, 1),              // Surname only
      name.slice(1),                 // Given name only
      `${name.slice(0, 1)}${name.slice(-1)}`, // Surname + last char
    ];

    // Also check for common titles
    const titles = ["先生", "小姐", "大人", "师兄", "师姐", "师弟", "师妹"];
    for (const title of titles) {
      patterns.push(`${name}${title}`);
      patterns.push(`${name.slice(0, 1)}${title}`);
    }

    for (const pattern of patterns) {
      if (content.includes(pattern) && pattern !== name) {
        variations.add(pattern);
      }
    }

    return Array.from(variations);
  }

  /**
   * Extract time markers from content
   */
  private extractTimeMarkers(content: string): string[] {
    const markers: string[] = [];

    // Common time patterns in Chinese
    const timePatterns = [
      /[一二三四五六七八九十百千]+[年月日天时]/g,
      /[0-9]+[年月日天时]/g,
      /清晨|早晨|上午|中午|下午|傍晚|晚上|深夜|午夜/g,
      /春天|夏天|秋天|冬天|春季|夏季|秋季|冬季/g,
      /昨天|今天|明天|前天|后天/g,
      /刚才|现在|稍后|之后|之前/g,
    ];

    for (const pattern of timePatterns) {
      const matches = content.match(pattern);
      if (matches) {
        markers.push(...matches);
      }
    }

    return markers;
  }

  /**
   * Check if there's a time contradiction
   */
  private hasTimeContradiction(prevTime: string, currentTime: string): boolean {
    // Simple heuristic checks
    const contradictions = [
      { prev: "晚上", curr: "早晨" },
      { prev: "深夜", curr: "中午" },
      { prev: "明天", curr: "昨天" },
      { prev: "之后", curr: "之前" },
    ];

    for (const { prev, curr } of contradictions) {
      if (prevTime.includes(prev) && currentTime.includes(curr)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: split by common delimiters
    const keywords = text
      .split(/[，。、；：！？\s]+/)
      .filter(w => w.length >= 2)
      .slice(0, 5); // Top 5 keywords

    return keywords;
  }
}

export const ruleCheckerService = new RuleCheckerService();
