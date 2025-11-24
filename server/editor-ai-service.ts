// Editor AI Service - Production Implementation
// Handles AI-powered editor commands like polish, expand, summarize, etc.

import { storage } from "./storage";
import { aiService } from "./ai-service";
import { enhancedRAGService } from "./enhanced-rag-service";
import { modelRoutingService, Intent } from "./model-routing-service";
import { styleProfiles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface EditorAIRequest {
    instruction: string;      // User command/instruction
    selectedText: string;     // Selected text in editor
    cursorPosition: number;   // Cursor position in content
    chapterContent: string;   // Full chapter content
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

        return {
            result: result.content,
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
    }> {
        // 1. Basic editor context
        const start = Math.max(0, req.cursorPosition - this.CONTEXT_WINDOW);
        const end = Math.min(
            req.chapterContent.length,
            req.cursorPosition + this.CONTEXT_WINDOW
        );

        const precedingText = req.chapterContent.slice(start, req.cursorPosition);
        const followingText = req.chapterContent.slice(req.cursorPosition, end);

        // 2. Fetch project entities (Parallel)
        const [characters, worldSettings, outlines] = await Promise.all([
            storage.getCharactersByProject(req.projectId),
            storage.getWorldSettingsByProject(req.projectId),
            storage.getOutlinesByProject(req.projectId)
        ]);

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
        const chapterContext = chapterOutline ?
            `章节: ${chapterOutline.title}\n概要: ${(chapterOutline.plotNodes as any)?.oneLiner || ''}` : '';

        return {
            precedingText,
            followingText,
            characters: characterContext,
            worldSettings: worldContext,
            chapterContext
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
        };
        ragPrompt: string;
        styleInstructions?: string;
    }): string {
        const { intent, instruction, selectedText, context, ragPrompt, styleInstructions } = params;

        let prompt = '';

        // Add system-level instructions based on intent
        switch (intent) {
            case Intent.POLISH:
                prompt = `# 任务：润色文本

请对以下文本进行润色，要求：
- **提升文采**：使用更丰富的词汇和修辞（如比喻、拟人）。
- **优化节奏**：调整长短句搭配，使阅读更流畅。
- **增强画面感**：将抽象描述转化为具体的感官描写。
- 保持原意和核心情节不变。

## 待润色文本
${selectedText}`;
                break;

            case Intent.EXPAND:
                prompt = `# 任务：扩写内容

请基于以下文本进行扩写，要求：
- **感官沉浸**：必须包含至少3种感官细节（视觉、听觉、嗅觉/触觉）。
- **心理深度**：通过微表情和潜台词体现角色的内心活动。
- **世界观融合**：自然地提及环境细节或世界观设定（如：${context.worldSettings ? "参考世界观设定" : "力量体系、地理环境"}）。
- **字数扩展**：扩展至原文的2-3倍。
- 保持原有情节走向。

${styleInstructions ? `## 风格要求\n${styleInstructions}\n` : ''}
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
${context.followingText}`;
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
                prompt = `# 任务：智能续写

请基于前文自然地续写内容（200-300字），要求：
- **无缝衔接**：语气、用词和节奏与前文保持高度一致。
- **推进剧情**：引入新的变数或深化当前的冲突，不要原地踏步。
- **避免陈词滥调**：不要使用"心中一动"、"不由得"等常见AI惯用语。
- 仅返回续写内容，无需解释。

## 前文
${context.precedingText}`;
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
 * Get max tokens based on intent
 */
    private getMaxTokensForIntent(intent: Intent): number {
        switch (intent) {
            case Intent.SUMMARIZE:
                return 500;
            case Intent.POLISH:
                return 1000;
            case Intent.GHOST_TEXT:
                return 800;
            case Intent.EXPAND:
                return 2000;
            default:
                return 1500;
        }
    }
}

export const editorAIService = new EditorAIService();
