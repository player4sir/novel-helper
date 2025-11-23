// Enhanced Parser - Robust JSON parsing from AI responses
// Handles markdown, comments, noise, and common errors

import { z } from "zod";
import { configService } from "./config-service";

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: ParseError;
}

export interface ParseError {
  type: "syntax" | "validation" | "extraction";
  message: string;
  position?: number;
  rawContent: string;
  suggestions: string[];
}

export class EnhancedParser {
  /**
   * Parse AI response to typed object with automatic recovery
   */
  async parseWithRecovery<T>(
    content: string,
    schema: z.ZodSchema<T>
  ): Promise<ParseResult<T>> {
    const config = await configService.getParserConfig();

    // Step 1: Extract JSON from content
    let jsonStr = content.trim();

    if (config.enableMarkdownExtraction) {
      jsonStr = this.extractFromMarkdown(jsonStr);
    }

    if (config.enableCommentRemoval) {
      jsonStr = this.removeComments(jsonStr);
    }

    // Extract JSON from noise
    jsonStr = this.extractJSON(jsonStr);

    // Step 2: Try to fix common errors
    if (config.enableErrorFixing) {
      for (let attempt = 0; attempt < config.maxRecoveryAttempts; attempt++) {
        try {
          const parsed = JSON.parse(jsonStr);
          // Validate against schema
          const validated = schema.parse(parsed);
          return { success: true, data: validated };
        } catch (error) {
          if (attempt < config.maxRecoveryAttempts - 1) {
            jsonStr = this.fixCommonErrors(jsonStr);
          }
        }
      }
    }

    // Step 3: Final attempt without fixing
    try {
      const parsed = JSON.parse(jsonStr);
      const validated = schema.parse(parsed);
      return { success: true, data: validated };
    } catch (error: any) {
      return {
        success: false,
        error: {
          type: error.name === "ZodError" ? "validation" : "syntax",
          message: error.message,
          position: this.findErrorPosition(jsonStr, error),
          rawContent: content.substring(0, 500),
          suggestions: this.generateSuggestions(error, jsonStr),
        },
      };
    }
  }

  /**
   * Extract JSON from markdown code blocks
   */
  private extractFromMarkdown(content: string): string {
    // Remove ```json ... ``` or ``` ... ```
    const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }
    return content;
  }

  /**
   * Remove comments from JSON string
   */
  private removeComments(jsonStr: string): string {
    // Remove single-line comments
    jsonStr = jsonStr.replace(/\/\/.*$/gm, "");
    // Remove multi-line comments
    jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, "");
    return jsonStr;
  }

  /**
   * Extract JSON from surrounding text
   */
  extractJSON(content: string): string {
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return content.substring(firstBrace, lastBrace + 1);
    }

    // Try array format
    const firstBracket = content.indexOf("[");
    const lastBracket = content.lastIndexOf("]");

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return content.substring(firstBracket, lastBracket + 1);
    }

    return content;
  }

  /**
   * Fix common JSON syntax errors
   */
  fixCommonErrors(jsonStr: string): string {
    // Fix trailing commas in objects
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");

    // Fix missing commas between array elements
    jsonStr = jsonStr.replace(/"\s*\n\s*"/g, '",\n"');

    // Fix missing commas between object properties
    jsonStr = jsonStr.replace(/"\s*\n\s*"/g, '",\n"');

    // Fix unquoted keys (simple cases)
    jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix single quotes to double quotes
    jsonStr = jsonStr.replace(/'/g, '"');

    return jsonStr;
  }

  /**
   * Find error position in JSON string
   */
  private findErrorPosition(jsonStr: string, error: any): number | undefined {
    if (error.message && typeof error.message === "string") {
      const posMatch = error.message.match(/position (\d+)/);
      if (posMatch) {
        return parseInt(posMatch[1]);
      }
    }
    return undefined;
  }

  /**
   * Generate helpful suggestions based on error
   */
  private generateSuggestions(error: any, jsonStr: string): string[] {
    const suggestions: string[] = [];

    if (error.message?.includes("Unexpected token")) {
      suggestions.push("检查JSON语法，可能有多余的逗号或括号不匹配");
    }

    if (error.message?.includes("Unexpected end")) {
      suggestions.push("JSON可能不完整，检查是否缺少结束括号");
    }

    if (error.name === "ZodError") {
      suggestions.push("JSON格式正确但字段验证失败，检查必需字段是否存在");
    }

    if (jsonStr.includes("'")) {
      suggestions.push("JSON中不应使用单引号，请使用双引号");
    }

    return suggestions;
  }
}

// Export singleton instance
export const enhancedParser = new EnhancedParser();
