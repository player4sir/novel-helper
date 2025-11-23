import { aiService } from "./ai-service";
import { storage } from "./storage";

export class StyleExtractionService {
    async extractStyle(text: string): Promise<any> {
        const prompt = `
    Analyze the following text and extract its stylistic characteristics.
    Focus on capturing the unique "voice" and "feel" of the writing.
    
    Return the result strictly as a JSON object with the following keys:
    - rhythm: (string) Description of sentence rhythm, length variation, and flow (e.g., "Fast-paced with short, punchy sentences", "Lyrical and flowing with complex clauses").
    - vocabulary: (string) Description of vocabulary choice (e.g., "Simple and direct", "Flowery and archaic", "Technical and precise", "Colloquial and gritty").
    - sentenceStructure: (string) Description of sentence structure complexity and patterns (e.g., "Predominantly simple sentences", "Frequent use of compound-complex sentences", "Heavy use of fragments for effect").
    - rhetoricalDevices: (string[]) List of specific rhetorical devices used (e.g., "Metaphor", "Simile", "Alliteration", "Irony", "Parallelism").
    - tone: (string) Description of the narrative tone and emotional atmosphere (e.g., "Dark and brooding", "Lighthearted and humorous", "Objective and detached", "Melancholic").
    
    Text to analyze:
    "${text.slice(0, 2000)}"
    `;

        // Get a capable chat model
        const models = await storage.getAIModels();
        const chatModel = models.find(m => m.modelType === "chat" && m.isActive && m.isDefaultChat)
            || models.find(m => m.modelType === "chat" && m.isActive);

        if (!chatModel) {
            throw new Error("No active chat model found for style extraction");
        }

        const response = await aiService.generate({
            prompt,
            modelId: chatModel.modelId,
            provider: chatModel.provider,
            baseUrl: chatModel.baseUrl || "",
            apiKey: chatModel.apiKey || undefined,
            parameters: {
                temperature: 0.3,
                maxTokens: 1000,
            },
            responseFormat: "json"
        });

        try {
            // clean up response if it contains markdown code blocks
            const jsonStr = response.content.replace(/```json\n?|\n?```/g, "").trim();
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse style extraction response", e);
            throw new Error("Failed to extract style");
        }
    }
}

export const styleExtractionService = new StyleExtractionService();
