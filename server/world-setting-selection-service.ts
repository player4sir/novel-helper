import { aiService } from "./ai-service";
import type { WorldSetting } from "@shared/schema";

export interface WorldSettingSelectionOptions {
    maxCount: number;
    tokenBudget: number;
    threshold: number;
}

export interface WorldSettingSelectionResult {
    selectedSettings: WorldSetting[];
    contextText: string;
    totalTokens: number;
}

export class WorldSettingSelectionService {
    private readonly TOKENS_PER_CHAR = 0.4; // Approximate

    /**
     * Select relevant world settings based on context
     */
    async selectRelevantSettings(
        allSettings: WorldSetting[],
        context: string,
        options: Partial<WorldSettingSelectionOptions> = {}
    ): Promise<WorldSettingSelectionResult> {
        const defaultOptions: WorldSettingSelectionOptions = {
            maxCount: 10,
            tokenBudget: 1000,
            threshold: 0.6,
            ...options,
        };

        if (allSettings.length === 0) {
            return {
                selectedSettings: [],
                contextText: "",
                totalTokens: 0,
            };
        }

        // If total settings are small enough, just return all of them
        const totalText = allSettings.map((s) => `${s.title}: ${s.content}`).join("\n");
        if (this.estimateTokens(totalText) <= defaultOptions.tokenBudget) {
            return {
                selectedSettings: allSettings,
                contextText: totalText,
                totalTokens: this.estimateTokens(totalText),
            };
        }

        try {
            // Get context embedding
            const contextEmbedding = await aiService.getEmbedding(context);
            if (!contextEmbedding) {
                throw new Error("Failed to get context embedding");
            }

            // Calculate relevance scores
            const scoredSettings = [];
            for (const setting of allSettings) {
                const settingText = `${setting.title}\n${setting.content}`;
                const settingEmbedding = await aiService.getEmbedding(settingText);

                if (settingEmbedding) {
                    const similarity = this.cosineSimilarity(contextEmbedding, settingEmbedding);
                    scoredSettings.push({ setting, score: similarity });
                }
            }

            // Sort by score
            scoredSettings.sort((a, b) => b.score - a.score);

            // Select top settings within budget
            const selected: WorldSetting[] = [];
            let currentTokens = 0;

            for (const item of scoredSettings) {
                if (item.score < defaultOptions.threshold) continue;
                if (selected.length >= defaultOptions.maxCount) break;

                const text = `${item.setting.title}: ${item.setting.content}`;
                const tokens = this.estimateTokens(text);

                if (currentTokens + tokens <= defaultOptions.tokenBudget) {
                    selected.push(item.setting);
                    currentTokens += tokens;
                }
            }

            const contextText = selected.map((s) => `${s.title}: ${s.content}`).join("\n");

            console.log(
                `[World Setting Selection] Selected ${selected.length}/${allSettings.length} settings ` +
                `(context length: ${context.length}, budget: ${defaultOptions.tokenBudget})`
            );

            return {
                selectedSettings: selected,
                contextText,
                totalTokens: currentTokens,
            };

        } catch (error) {
            console.warn("[World Setting Selection] Embedding selection failed, falling back to keyword matching", error);
            return this.selectByKeywords(allSettings, context, defaultOptions);
        }
    }

    /**
     * Fallback selection using keyword matching
     */
    private selectByKeywords(
        allSettings: WorldSetting[],
        context: string,
        options: WorldSettingSelectionOptions
    ): WorldSettingSelectionResult {
        const scoredSettings = allSettings.map((setting) => {
            let score = 0;
            const titleKeywords = this.extractKeywords(setting.title);

            // Check if title keywords appear in context
            for (const keyword of titleKeywords) {
                if (context.includes(keyword)) {
                    score += 2;
                }
            }

            // Check content overlap (simplified)
            if (context.includes(setting.title)) {
                score += 3;
            }

            return { setting, score };
        });

        scoredSettings.sort((a, b) => b.score - a.score);

        const selected: WorldSetting[] = [];
        let currentTokens = 0;

        for (const item of scoredSettings) {
            if (item.score === 0 && selected.length >= 3) continue; // Only include irrelevant ones if we have space
            if (selected.length >= options.maxCount) break;

            const text = `${item.setting.title}: ${item.setting.content}`;
            const tokens = this.estimateTokens(text);

            if (currentTokens + tokens <= options.tokenBudget) {
                selected.push(item.setting);
                currentTokens += tokens;
            }
        }

        const contextText = selected.map((s) => `${s.title}: ${s.content}`).join("\n");

        return {
            selectedSettings: selected,
            contextText,
            totalTokens: currentTokens,
        };
    }

    private extractKeywords(text: string): string[] {
        return text.split(/[\s,，.。、]/).filter(s => s.length > 1);
    }

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
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length * this.TOKENS_PER_CHAR);
    }
}

export const worldSettingSelectionService = new WorldSettingSelectionService();
