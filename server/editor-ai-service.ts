// Editor AI Service - Production Implementation
// Handles AI-powered editor commands like polish, expand, summarize, etc.

import { storage } from "./storage";
import { aiService } from "./ai-service";
import { enhancedRAGService } from "./enhanced-rag-service";
import { modelRoutingService, Intent } from "./model-routing-service";
import { styleProfiles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { genreConfigService } from "./genre-config-service";
import { extractJSON } from "./utils/json-extractor";

export interface EditorAIRequest {
    instruction: string;      // User command/instruction
    selectedText: string;     // Selected text in editor
    cursorPosition: number;   // Cursor position in content
    chapterContent: string;   // Full chapter content (optional if preceding/following provided)
    precedingText?: string;   // Text before cursor
    followingText?: string;   // Text after cursor
    chapterId: string;
    projectId: string;
    styleProfileId?: string;
}

export interface EditorAIResponse {
    result: string;
    metadata: {
        intent: Intent;
        modelId: string;
        tokensUsed: number;
        retrievedContexts?: number;
        processingTime: number;
    };
}

export interface DiagnosisResponse {
    qualityScore: {
        completeness: number;
        consistency: number;
        richness: number;
        writability: number;
        semanticQuality: number;
        totalScore: number;
    };
    innovationScore: {
        worldUniqueness: number;
        characterComplexity: number;
        conflictOriginality: number;
        overallInnovation: number;
        cliches: Array<{
            type: string;
            description: string;
            suggestion: string;
        }>;
    };
    issues: Array<{
        dimension: string;
        severity: "high" | "medium" | "low";
        description: string;
        suggestion: string;
    }>;
}

export class EditorAIService {
    private readonly CONTEXT_WINDOW = 500; // Characters before/after cursor

    /**
     * Main entry point for processing editor AI instructions
     */
    async processInstruction(req: EditorAIRequest): Promise<EditorAIResponse> {
        const startTime = Date.now();

        // 1. Parse instruction to determine intent
        const intent = this.parseInstruction(req.instruction);
        console.log(`[EditorAI] Processing instruction: "${req.instruction}" -> Intent: ${intent}`);

        // 2. Build context from editor state
        const context = await this.gatherRichContext(req);

        // 3. Retrieve relevant RAG contexts (if needed for complex tasks)
        let retrievedContexts = 0;
        let ragPrompt = '';

        if (this.shouldUseRAG(intent)) {
            const ragResult = await enhancedRAGService.retrieveContext({
                projectId: req.projectId,
                currentChapterId: req.chapterId,
                query: req.selectedText || context.precedingText.slice(-200),
                topK: 3,
            });

            retrievedContexts = ragResult.contexts.length;
            ragPrompt = ragResult.promptText;
            console.log(`[EditorAI] Retrieved ${retrievedContexts} RAG contexts`);
        }

        // 4. Build prompt based on intent
        const prompt = this.buildPrompt({
            intent,
            instruction: req.instruction,
            selectedText: req.selectedText,
            context,
            ragPrompt,
        });

        // 5. Route to appropriate model
        const routing = await modelRoutingService.routeByIntent({
            intent,
            projectId: req.projectId,
        });

        console.log(`[EditorAI] Routed to model: ${routing.primaryModel} (${routing.tier})`);

        // 6. Get the actual AI model object
        const aiModel = await storage.getAIModel(routing.primaryModel);
        if (!aiModel) {
            throw new Error(`Model ${routing.primaryModel} not found`);
        }

        // 7. Generate response
        const result = await aiService.generate({
            prompt,
            modelId: aiModel.modelId,
            provider: aiModel.provider,
            baseUrl: aiModel.baseUrl || '',
            apiKey: aiModel.apiKey || undefined,
            parameters: {
                temperature: this.getTemperatureForIntent(intent),
                maxTokens: this.getMaxTokensForIntent(intent),
            },
        });

        const processingTime = Date.now() - startTime;
        console.log(`[EditorAI] Completed in ${processingTime}ms, tokens: ${result.tokensUsed}`);

        // Extract content if thinking block is present (for non-JSON responses)
        // For JSON responses, extractJSON handles it. For text, we might need to strip it manually if not using extractJSON.
        // But processInstruction usually returns text.
        let finalContent = result.content;
        if (finalContent.includes("</thinking>")) {
            finalContent = finalContent.split("</thinking>")[1].trim();
        }

        return {
            result: finalContent,
            metadata: {
                intent,
                modelId: aiModel.modelId,
                tokensUsed: result.tokensUsed,
                retrievedContexts,
                processingTime,
            },
        };
    }

    /**
     * Parse user instruction to determine intent
     */
    private parseInstruction(instruction: string): Intent {
        const lower = instruction.toLowerCase().trim();

        // Polish/refine
        if (lower.includes('润色') || lower.includes('polish') || lower.includes('优化')) {
            return Intent.POLISH;
        }

        // Expand/elaborate
        if (lower.includes('扩写') || lower.includes('expand') || lower.includes('详细')) {
            return Intent.EXPAND;
        }

        // Summarize
        if (lower.includes('总结') || lower.includes('summarize') || lower.includes('摘要')) {
            return Intent.SUMMARIZE;
        }

        // Ghost text / continuation
        if (lower.includes('续写') || lower.includes('continue') || lower.includes('ghost')) {
            return Intent.GHOST_TEXT;
        }

        // Rewrite
        if (lower.includes('改写') || lower.includes('rewrite') || lower.includes('换个写法')) {
            return Intent.DRAFT;
        }

        // Dialogue generation
        if (lower.includes('对话') || lower.includes('dialogue') || lower.includes('dialog')) {
            return Intent.DRAFT;
        }

        // Scene description
        if (lower.includes('场景') || lower.includes('描写') || lower.includes('scene')) {
            return Intent.DRAFT;
        }

        // Default to draft
        return Intent.DRAFT;
    }

    /**
     * Gather rich context including editor state, characters, and world settings
     */
    private async gatherRichContext(req: EditorAIRequest): Promise<{
        precedingText: string;
        followingText: string;
        characters: string;
        worldSettings: string;
        chapterContext: string;
        genre: string;
        projectTitle: string;
    }> {
        // 1. Basic editor context
        let precedingText = "";
        let followingText = "";

        if (req.precedingText !== undefined && req.followingText !== undefined) {
            // Use provided sliced context (Level 1 Working Memory)
            precedingText = req.precedingText;
            followingText = req.followingText;
        } else {
            // Fallback to slicing full content
            const start = Math.max(0, req.cursorPosition - this.CONTEXT_WINDOW);
            const end = Math.min(
                req.chapterContent.length,
                req.cursorPosition + this.CONTEXT_WINDOW
            );
            precedingText = req.chapterContent.slice(start, req.cursorPosition);
            followingText = req.chapterContent.slice(req.cursorPosition, end);
        }

        // 2. Fetch project entities (Parallel)
        const [project, characters, worldSettings, outlines] = await Promise.all([
            storage.getProject(req.projectId),
            storage.getCharactersByProject(req.projectId),
            storage.getWorldSettingsByProject(req.projectId),
            storage.getOutlinesByProject(req.projectId)
        ]);

        if (!project) {
            throw new Error("Project not found");
        }

        // 3. Format Characters
        const characterContext = characters.map(c =>
            `【${c.name}】(${c.role}): ${c.personality || ''} ${c.shortMotivation ? `[动机:${c.shortMotivation}]` : ''}`
        ).join('\n');

        // 4. Format World Settings (Summary)
        const worldContext = worldSettings.map(w =>
            `[${w.title}]: ${w.content.slice(0, 100)}...`
        ).join('\n');

        // 5. Chapter Context
        const chapterOutline = outlines.find(o => o.linkedChapterId === req.chapterId);
        const chapterContextStr = chapterOutline ?
            `章节: ${chapterOutline.title}\n概要: ${(chapterOutline.plotNodes as any)?.oneLiner || ''}` : '';

        return {
            precedingText,
            followingText,
            characters: characterContext,
            worldSettings: worldContext,
            chapterContext: chapterContextStr,
            genre: project.genre || "通用",
            projectTitle: project.title
        };
    }

    /**
     * Determine if RAG should be used for this intent
     */
    private shouldUseRAG(intent: Intent): boolean {
        // Use RAG for complex creative tasks
        return [
            Intent.FINAL_PROSE,
            Intent.LOGIC_DECISION,
            Intent.EXPAND,
        ].includes(intent);
    }

    /**
     * Build prompt based on intent and context
     */
    private buildPrompt(params: {
        intent: Intent;
        instruction: string;
        selectedText: string;
        context: {
            precedingText: string;
            followingText: string;
            characters: string;
            worldSettings: string;
            chapterContext: string;
            ragPrompt?: string;
            genre: string;
        };
        ragPrompt: string;
        styleInstructions?: string;
    }): string {
        const { intent, instruction, selectedText, context, ragPrompt, styleInstructions } = params;

        const genreInstructions = genreConfigService.getGenreSpecificInstructions(context.genre);
        const genreDescription = genreConfigService.getGenreDescription(context.genre);

        let prompt = '';

        // Add system-level instructions based on intent
        switch (intent) {
            case Intent.POLISH:
                prompt = `# Role
你是一位资深的小说编辑，擅长${genreDescription}的文笔润色。

# 任务：润色文本
请对以下文本进行润色，要求：
- **提升文采**：使用更丰富的词汇和修辞（如比喻、拟人）。
- **优化节奏**：调整长短句搭配，使阅读更流畅。
- **增强画面感**：将抽象描述转化为具体的感官描写。
- **类型契合**：确保文风符合${context.genre}类型的特点。
- 保持原意和核心情节不变。

${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}

# 思考过程 (CRITICAL)
在润色之前，请先进行深度思考，包裹在 <thinking> 标签中：
1. **问题诊断**: 分析原文存在的文笔问题（如：词汇贫乏、节奏拖沓、缺乏画面感）。
2. **风格定位**: 确定适合${context.genre}的修辞策略。
3. **润色方案**: 构思如何增强关键句子的表现力。

## 待润色文本
${selectedText}

# 输出
请先输出 <thinking>...</thinking>，然后输出润色后的文本。`;
                break;

            case Intent.EXPAND:
                prompt = `# Role
你是一位资深的小说家，擅长创作${genreDescription}。

# 任务：扩写内容
请基于以下文本进行扩写，要求：
- **感官沉浸**：必须包含至少3种感官细节（视觉、听觉、嗅觉/触觉）。
- **心理深度**：通过微表情和潜台词体现角色的内心活动。
- **世界观融合**：自然地提及环境细节或世界观设定（如：${context.worldSettings ? "参考世界观设定" : "力量体系、地理环境"}）。
- **字数扩展**：扩展至原文的2-3倍。
- 保持原有情节走向。

${styleInstructions ? `## 风格要求\n${styleInstructions}\n` : ''}
${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}

## 世界观设定
${context.worldSettings}

## 角色信息
${context.characters}

## 上下文

### 前文（参考）
${context.precedingText}

### 待扩写文本
${selectedText}

### 后文（参考）
${context.followingText}

# 思考过程 (CRITICAL)
在扩写之前，请先进行深度思考，包裹在 <thinking> 标签中：
1. **场景构建**: 构思场景的感官细节（光影、声音、气味）。
2. **角色状态**: 分析角色此刻的心理活动和潜台词。
3. **情节张力**: 思考如何通过细节描写增强情节的张力。

# 输出
请先输出 <thinking>...</thinking>，然后输出扩写后的文本。`;
                break;

            case Intent.SUMMARIZE:
                prompt = `# 任务：总结前文

请用200字以内总结以下内容的核心要点：

${selectedText || context.precedingText}

要求：
- 提炼关键事件
- 突出角色状态变化
- 保留重要伏笔`;
                break;

            case Intent.GHOST_TEXT:
                prompt = `# Role
你是一位资深的小说家，擅长创作${genreDescription}。

# 任务：智能续写

请基于前文自然地续写内容（200-300字），要求：
- **无缝衔接**：语气、用词和节奏与前文保持高度一致。
- **推进剧情**：引入新的变数或深化当前的冲突，不要原地踏步。
- **避免陈词滥调**：不要使用"心中一动"、"不由得"等常见AI惯用语。
- **类型契合**：符合${context.genre}的叙事风格。

${genreInstructions ? `## 类型特定要求\n${genreInstructions}\n` : ''}

## 前文
${context.precedingText}

# 思考过程 (CRITICAL)
在续写之前，请先进行深度思考，包裹在 <thinking> 标签中：
1. **前文分析**: 分析前文的节奏、情绪和未解决的悬念。
2. **情节推演**: 构思接下来的3个可能发展方向，选择最精彩的一个。
3. **伏笔埋设**: 思考是否需要埋下新的伏笔。

# 输出
请先输出 <thinking>...</thinking>，然后输出续写内容。`;
                break;

            default:
                // Generic prompt for other intents
                prompt = `# 任务
${instruction}

## 上下文

### 前文
${context.precedingText}

### 当前内容
${selectedText}

### 后文
${context.followingText}

## 要求
- 保持风格一致
- 确保逻辑连贯
- 仅返回生成内容，无需解释`;
        }

        // Append RAG contexts if available
        if (ragPrompt) {
            prompt += `\n\n${ragPrompt}`;
        }

        return prompt;
    }

    /**
     * Get temperature parameter based on intent
     */
    private getTemperatureForIntent(intent: Intent): number {
        switch (intent) {
            case Intent.POLISH:
            case Intent.SUMMARIZE:
                return 0.3; // Low temperature for consistency
            case Intent.GHOST_TEXT:
            case Intent.EXPAND:
                return 0.7; // Higher temperature for creativity
            case Intent.FINAL_PROSE:
                return 0.5; // Balanced
            default:
                return 0.6;
        }
    }

    /**
     * Stream version of processInstruction
     */
    async *processInstructionStream(req: EditorAIRequest): AsyncGenerator<{ type: string; data: any }, void, unknown> {
        const startTime = Date.now();

        // 1. Parse instruction to determine intent
        const intent = this.parseInstruction(req.instruction);
        console.log(`[EditorAI] Processing instruction (stream): "${req.instruction}" -> Intent: ${intent}`);

        // 2. Build context from editor state
        const context = await this.gatherRichContext(req);

        // 3. Retrieve relevant RAG contexts
        let retrievedContexts = 0;
        let ragPrompt = '';

        if (this.shouldUseRAG(intent)) {
            const ragResult = await enhancedRAGService.retrieveContext({
                projectId: req.projectId,
                currentChapterId: req.chapterId,
                query: req.selectedText || context.precedingText.slice(-200),
                topK: 3,
            });

            retrievedContexts = ragResult.contexts.length;
            ragPrompt = ragResult.promptText;
            console.log(`[EditorAI] Retrieved ${retrievedContexts} RAG contexts`);
        }

        // 4. Build prompt based on intent
        const prompt = this.buildPrompt({
            intent,
            instruction: req.instruction,
            selectedText: req.selectedText,
            context,
            ragPrompt,
        });

        // 5. Route to appropriate model
        const routing = await modelRoutingService.routeByIntent({
            intent,
            projectId: req.projectId,
        });

        console.log(`[EditorAI] Routed to model: ${routing.primaryModel} (${routing.tier})`);

        // 6. Get the actual AI model object
        const aiModel = await storage.getAIModel(routing.primaryModel);
        if (!aiModel) {
            throw new Error(`Model ${routing.primaryModel} not found`);
        }

        // Yield metadata first
        yield {
            type: 'metadata',
            data: {
                intent,
                modelId: aiModel.modelId,
                retrievedContexts,
            }
        };

        // 7. Generate stream
        try {
            const stream = aiService.generateStream({
                prompt,
                modelId: aiModel.modelId,
                provider: aiModel.provider,
                baseUrl: aiModel.baseUrl || '',
                apiKey: aiModel.apiKey || undefined,
                parameters: {
                    temperature: this.getTemperatureForIntent(intent),
                    maxTokens: this.getMaxTokensForIntent(intent),
                },
            });

            let fullContent = "";
            for await (const chunk of stream) {
                fullContent += chunk;
                yield { type: 'content', data: chunk };
            }

            const processingTime = Date.now() - startTime;
            console.log(`[EditorAI] Stream completed in ${processingTime}ms`);

            console.log("[EditorAI] Yielding complete event");
            yield {
                type: 'complete',
                data: {
                    processingTime,
                    fullContentLength: fullContent.length
                }
            };

        } catch (error: any) {
            console.error("[EditorAI] Stream error:", error);
            throw error;
        }
    }

    /**
     * Diagnose chapter quality
     */
    async diagnoseChapter(req: EditorAIRequest): Promise<DiagnosisResponse> {
        const startTime = Date.now();

        // 1. Gather context
        const context = await this.gatherRichContext(req);

        // 2. Build Diagnosis Prompt
        const prompt = this.buildDiagnosisPrompt(context);

        // 3. Route to Quality Model
        const routing = await modelRoutingService.routeByIntent({
            intent: Intent.DIAGNOSE,
            projectId: req.projectId,
        });

        // 4. Get AI Model
        const aiModel = await storage.getAIModel(routing.primaryModel);
        if (!aiModel) {
            throw new Error(`Model ${routing.primaryModel} not found`);
        }

        // 5. Generate Analysis
        const result = await aiService.generate({
            prompt,
            modelId: aiModel.modelId,
            provider: aiModel.provider,
            baseUrl: aiModel.baseUrl || '',
            apiKey: aiModel.apiKey || undefined,
            parameters: {
                temperature: 0.2, // Low temperature for consistent analysis
                maxTokens: 2000,
            },
        });

        // 6. Parse Result
        try {
            // Use robust JSON extraction
            const diagnosis = extractJSON(result.content) as DiagnosisResponse;

            console.log(`[EditorAI] Diagnosis completed in ${Date.now() - startTime}ms`);
            return diagnosis;
        } catch (error) {
            console.error("[EditorAI] Failed to parse diagnosis result:", error);
            console.error("[EditorAI] Raw AI response:", result.content);
            throw new Error(`Failed to parse AI diagnosis result: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private buildDiagnosisPrompt(context: {
        precedingText: string;
        followingText: string;
        characters: string;
        worldSettings: string;
        chapterContext: string;
        genre: string;
        projectTitle: string;
    }): string {
        const genreInstructions = genreConfigService.getGenreSpecificInstructions(context.genre);
        const genreDescription = genreConfigService.getGenreDescription(context.genre);

        return `# Role
你是一位资深的${genreDescription}小说编辑和文学评论家。你的任务是分析提供的章节内容，并提供结构化的质量评估。

# Context
## Project Info
Title: ${context.projectTitle}
Genre: ${context.genre}

## World Settings
${context.worldSettings}

## Characters
${context.characters}

## Chapter Content
${context.precedingText}
${context.followingText}

${genreInstructions ? `# 类型特定标准\n${genreInstructions}\n` : ''}

# 思考过程 (CRITICAL)
在生成最终 JSON 之前，你**必须**先进行深度思考，包裹在 <thinking> 标签中。
请按以下步骤进行分析：
1. **类型符合度**: 检查内容是否符合${context.genre}类型的核心爽点和读者期待。
2. **节奏分析**: 分析情节推进的速度是否合适，是否存在注水或跳跃。
3. **角色塑造**: 评估角色的行为是否符合人设，对话是否自然。
4. **创新性**: 识别是否存在陈词滥调，以及有哪些亮点。
5. **问题诊断**: 找出最严重的3个问题，并构思具体的修改建议。

# Task
Analyze the chapter content based on the following dimensions:
1. **Quality Score**: Completeness, Consistency, Richness, Writability, Semantic Quality.
2. **Innovation Score**: World Uniqueness, Character Complexity, Conflict Originality.
3. **Issues**: Identify specific problems with severity (high/medium/low) and suggestions.

# Output Format
**重要：请先输出 <thinking>...</thinking> 思考块，然后换行输出有效的JSON格式。**
**JSON内容必须使用纯正中文，字段名使用英文。**

You must return a JSON object matching this exact structure:
{
  "qualityScore": {
    "completeness": 0-100,
    "consistency": 0-100,
    "richness": 0-100,
    "writability": 0-100,
    "semanticQuality": 0-100,
    "totalScore": 0-100
  },
  "innovationScore": {
    "worldUniqueness": 0-100,
    "characterComplexity": 0-100,
    "conflictOriginality": 0-100,
    "overallInnovation": 0-100,
    "cliches": [
      { "type": "string", "description": "string", "suggestion": "string" }
    ]
  },
  "issues": [
    {
      "dimension": "string",
      "severity": "high"|"medium"|"low",
      "description": "string",
      "suggestion": "string"
    }
  ]
}

Ensure the analysis is critical, objective, and helpful for a professional writer.`;
    }

    /**
     * Get max tokens based on intent
     */
    private getMaxTokensForIntent(intent: Intent): number {
        switch (intent) {
            case Intent.SUMMARIZE:
                return 500;
            case Intent.POLISH:
                return 4000; // Increased to support full chapter rewrites
            case Intent.GHOST_TEXT:
                return 800;
            case Intent.EXPAND:
                return 2000;
            default:
                return 1500;
        }
    }
    /**
     * Fix a specific quality issue by rewriting the content
     */
    async fixIssue(req: EditorAIRequest & { issue: string; suggestion: string }): Promise<EditorAIResponse> {
        const startTime = Date.now();

        // Safety check: Prevent truncation data loss
        if (req.chapterContent.length > 3000) {
            throw new Error("Chapter content is too long for auto-optimization (max 3000 chars). Please optimize manually or split the chapter.");
        }

        // 1. Gather context
        const context = await this.gatherRichContext(req);

        // 2. Build Fix Prompt
        const prompt = this.buildFixPrompt({
            ...context,
            issue: req.issue,
            suggestion: req.suggestion,
            content: req.chapterContent
        });

        // 3. Route to Model (Use POLISH intent for rewriting)
        const routing = await modelRoutingService.routeByIntent({
            intent: Intent.POLISH,
            projectId: req.projectId,
        });

        // 4. Get AI Model
        const aiModel = await storage.getAIModel(routing.primaryModel);
        if (!aiModel) {
            throw new Error(`Model ${routing.primaryModel} not found`);
        }

        // 5. Generate Rewrite
        const result = await aiService.generate({
            prompt,
            modelId: aiModel.modelId,
            provider: aiModel.provider,
            baseUrl: aiModel.baseUrl || '',
            apiKey: aiModel.apiKey || undefined,
            parameters: {
                temperature: 0.5, // Balanced creativity for rewriting
                maxTokens: 3000, // Allow enough tokens for full rewrite
            },
        });

        const processingTime = Date.now() - startTime;
        console.log(`[EditorAI] Fix issue completed in ${processingTime}ms`);

        // Extract content if thinking block is present
        let finalContent = result.content;
        if (finalContent.includes("</thinking>")) {
            finalContent = finalContent.split("</thinking>")[1].trim();
        }

        return {
            result: finalContent,
            metadata: {
                intent: Intent.POLISH,
                modelId: aiModel.modelId,
                tokensUsed: result.tokensUsed,
                processingTime,
            },
        };
    }

    private buildFixPrompt(context: {
        precedingText: string;
        followingText: string;
        characters: string;
        worldSettings: string;
        chapterContext: string;
        issue: string;
        suggestion: string;
        content: string;
        genre: string;
    }): string {
        const genreInstructions = genreConfigService.getGenreSpecificInstructions(context.genre);

        return `# Role
You are a professional novel editor. Your task is to rewrite the provided chapter content to fix a specific quality issue.

# Context
## Genre
${context.genre}

## World Settings
${context.worldSettings}

## Characters
${context.characters}

## Issue to Fix
**Problem:** ${context.issue}
**Suggestion:** ${context.suggestion}

## Original Content
${context.content}

${genreInstructions ? `# 类型特定要求\n${genreInstructions}\n` : ''}

# 思考过程 (CRITICAL)
在重写之前，请先进行深度思考，包裹在 <thinking> 标签中：
1. **问题分析**: 确认原问题在文本中的具体表现。
2. **修改策略**: 构思如何根据建议进行修改，同时保持上下文连贯。
3. **类型检查**: 确保修改后的内容符合${context.genre}的风格。

# Task
Rewrite the "Original Content" to address the issue above.
- Follow the suggestion closely.
- Maintain the original plot points and character voices unless the suggestion explicitly asks to change them.
- Ensure the style is consistent with the original text.
- Return ONLY the rewritten content. Do not include explanations or markdown formatting like \`\`\`.
- Please output <thinking>...</thinking> first, then the rewritten content.`;
    }
}

export const editorAIService = new EditorAIService();
