import type { SceneFrame } from '@shared/schema';

// Validation requirements
export interface ValidationRequirements {
  minWords: number;
  maxWords: number;
  requiredCharacters: string[];
  sceneFrame: SceneFrame;
}

// Basic check result
export interface BasicCheckResult {
  passed: boolean;
  criticalErrors: string[]; // Only critical issues
  warnings: string[]; // Non-blocking warnings
}

/**
 * BasicValidator - Fast, critical-only validation
 * 
 * Implements simplified validation from the design document:
 * - Word count in range (minWords - maxWords)
 * - All required characters appear
 * - No meta-commentary (好的, 让我, etc.)
 * - Basic formatting (no empty paragraphs)
 * 
 * Completes in <2 seconds (vs 5s current)
 */
export class BasicValidator {
  /**
   * Validate content against requirements
   * @param content - Generated content to validate
   * @param requirements - ValidationRequirements
   * @returns BasicCheckResult
   */
  validate(content: string, requirements: ValidationRequirements): BasicCheckResult {
    const criticalErrors: string[] = [];
    const warnings: string[] = [];

    // 1. Word count check (critical)
    const wordCount = this.countWords(content);
    if (wordCount < requirements.minWords) {
      criticalErrors.push(`content_too_short: ${wordCount} words (min: ${requirements.minWords})`);
    } else if (wordCount > requirements.maxWords) {
      criticalErrors.push(`content_too_long: ${wordCount} words (max: ${requirements.maxWords})`);
    }

    // 2. Required character presence check (critical)
    const missingCharacters = this.checkRequiredCharacters(content, requirements.requiredCharacters);
    if (missingCharacters.length > 0) {
      criticalErrors.push(`missing_characters: ${missingCharacters.join(', ')}`);
    }

    // 3. Meta-commentary detection (critical)
    const metaCommentary = this.detectMetaCommentary(content);
    if (metaCommentary.length > 0) {
      criticalErrors.push(`meta_commentary_detected: ${metaCommentary.join('; ')}`);
    }

    // 4. Basic formatting check (warning only)
    const formattingIssues = this.checkBasicFormatting(content);
    if (formattingIssues.length > 0) {
      warnings.push(...formattingIssues);
    }

    // 5. Repetition check (critical)
    const repetitionIssues = this.checkRepetition(content, requirements.sceneFrame?.entryStateSummary || "");
    if (repetitionIssues.length > 0) {
      criticalErrors.push(...repetitionIssues);
    }

    return {
      passed: criticalErrors.length === 0,
      criticalErrors,
      warnings,
    };
  }

  /**
   * Count words in content (Chinese and English)
   * @param content - Text content
   * @returns number of words
   */
  private countWords(content: string): number {
    // Remove extra whitespace
    const cleaned = content.trim();
    
    // Count Chinese characters (each character is a word)
    const chineseChars = cleaned.match(/[\u4e00-\u9fa5]/g) || [];
    
    // Count English words (space-separated)
    const englishWords = cleaned
      .replace(/[\u4e00-\u9fa5]/g, ' ') // Remove Chinese chars
      .split(/\s+/)
      .filter(word => word.length > 0);
    
    return chineseChars.length + englishWords.length;
  }

  /**
   * Check if all required characters appear in content
   * @param content - Text content
   * @param requiredCharacters - Array of character names
   * @returns Array of missing character names
   */
  private checkRequiredCharacters(content: string, requiredCharacters: string[]): string[] {
    const missing: string[] = [];
    
    for (const character of requiredCharacters) {
      if (!content.includes(character)) {
        missing.push(character);
      }
    }
    
    return missing;
  }

  /**
   * Detect meta-commentary patterns
   * @param content - Text content
   * @returns Array of detected meta-commentary phrases
   */
  private detectMetaCommentary(content: string): string[] {
    const detected: string[] = [];
    
    // Common meta-commentary patterns in Chinese
    const patterns = [
      /好的[，,]\s*让我/,
      /让我来写/,
      /让我来描述/,
      /接下来[，,]\s*我将/,
      /我将会/,
      /我会在/,
      /在这个场景中[，,]\s*我/,
      /\[待确认\]/,
      /\[需要补充\]/,
      /\[作者注/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        detected.push(match[0]);
      }
    }

    return detected;
  }

  /**
   * Check basic formatting issues
   * @param content - Text content
   * @returns Array of formatting warnings
   */
  private checkBasicFormatting(content: string): string[] {
    const warnings: string[] = [];

    // Check for empty paragraphs (multiple consecutive newlines)
    const emptyParagraphs = content.match(/\n\s*\n\s*\n/g);
    if (emptyParagraphs && emptyParagraphs.length > 3) {
      warnings.push(`excessive_empty_paragraphs: ${emptyParagraphs.length} found`);
    }

    // Check for very short paragraphs (< 10 characters)
    const paragraphs = content.split(/\n+/).filter(p => p.trim().length > 0);
    const shortParagraphs = paragraphs.filter(p => p.trim().length < 10);
    if (shortParagraphs.length > paragraphs.length * 0.3) {
      warnings.push(`too_many_short_paragraphs: ${shortParagraphs.length}/${paragraphs.length}`);
    }

    // Check for missing punctuation at paragraph ends
    const paragraphsWithoutPunctuation = paragraphs.filter(p => {
      const trimmed = p.trim();
      const lastChar = trimmed[trimmed.length - 1];
      return lastChar && !/[。！？…"」』]/.test(lastChar);
    });
    if (paragraphsWithoutPunctuation.length > paragraphs.length * 0.2) {
      warnings.push(`missing_punctuation: ${paragraphsWithoutPunctuation.length}/${paragraphs.length} paragraphs`);
    }

    return warnings;
  }

  /**
   * Check for repetition against context
   * @param content - New content
   * @param context - Previous context
   */
  private checkRepetition(content: string, context: string): string[] {
    if (!context || context.length < 50) return [];

    const errors: string[] = [];
    const cleanContent = content.trim();
    const cleanContext = context.trim();

    // 1. Check if content starts with a large chunk of context (Copy-paste error)
    // Take last 100 chars of context
    const contextEnd = cleanContext.slice(-100);
    // Take first 100 chars of content
    const contentStart = cleanContent.slice(0, 100);

    // Calculate overlap
    if (contentStart.includes(contextEnd.slice(-50))) {
       errors.push("content_repeats_context_end");
    }

    // 2. Check for "Summary style" repetition at start
    // e.g. "Previous chapter mentioned..."
    const summaryPatterns = [
      /^上文提到/,
      /^之前说到/,
      /^回顾一下/,
      /^书接上回/,
    ];
    
    for (const pattern of summaryPatterns) {
      if (pattern.test(cleanContent)) {
        errors.push("content_starts_with_summary");
        break;
      }
    }

    return errors;
  }
}
