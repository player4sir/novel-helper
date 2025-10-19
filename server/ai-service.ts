// AI Service for handling multiple providers (OpenAI compatible)
// Reference: javascript_openai and javascript_anthropic blueprints

interface AIGenerateRequest {
  prompt: string;
  modelId: string;
  provider: string;
  baseUrl: string;
  apiKey?: string;
  parameters: {
    temperature: number;
    maxTokens: number;
  };
}

interface AIGenerateResponse {
  content: string;
  tokensUsed: number;
}

export class AIService {
  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const { prompt, modelId, provider, baseUrl, apiKey, parameters } = request;

    // Select appropriate API key based on provider
    let effectiveApiKey = apiKey;
    if (!effectiveApiKey) {
      if (provider === "deepseek") {
        effectiveApiKey = process.env.DEEPSEEK_API_KEY;
      } else if (provider === "openai") {
        effectiveApiKey = process.env.OPENAI_API_KEY;
      } else if (provider === "anthropic") {
        effectiveApiKey = process.env.ANTHROPIC_API_KEY;
      }
    }

    if (!effectiveApiKey) {
      throw new Error(`No API key available for provider: ${provider}`);
    }

    try {
      // Different providers use different API formats
      if (provider === "anthropic") {
        return await this.generateAnthropic(
          modelId,
          baseUrl,
          effectiveApiKey,
          prompt,
          parameters
        );
      } else {
        // OpenAI, DeepSeek, and other OpenAI-compatible providers
        return await this.generateOpenAICompatible(
          modelId,
          baseUrl,
          effectiveApiKey,
          prompt,
          parameters
        );
      }
    } catch (error: any) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  private async generateOpenAICompatible(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    prompt: string,
    parameters: { temperature: number; maxTokens: number }
  ): Promise<AIGenerateResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: parameters.temperature,
        max_tokens: parameters.maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0]?.message?.content || "",
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  private async generateAnthropic(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    prompt: string,
    parameters: { temperature: number; maxTokens: number }
  ): Promise<AIGenerateResponse> {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: parameters.maxTokens,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: parameters.temperature,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return {
      content: data.content[0]?.text || "",
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
    };
  }

  buildContextualPrompt(
    basePrompt: string,
    context?: {
      previousContent?: string;
      characters?: string;
      worldSettings?: string;
      outlineContext?: string;
    }
  ): string {
    let fullPrompt = "";

    if (context?.worldSettings) {
      fullPrompt += `# 世界观设定\n${context.worldSettings}\n\n`;
    }

    if (context?.characters) {
      fullPrompt += `# 人物设定\n${context.characters}\n\n`;
    }

    if (context?.outlineContext) {
      fullPrompt += `# 大纲参考\n${context.outlineContext}\n\n`;
    }

    if (context?.previousContent) {
      fullPrompt += `# 上文内容\n${context.previousContent}\n\n`;
    }

    fullPrompt += `# 创作要求\n${basePrompt}`;

    return fullPrompt;
  }
}

export const aiService = new AIService();
