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

interface AITestConnectionRequest {
  provider: string;
  modelType: string;
  modelId: string;
  baseUrl: string;
  apiKey?: string;
}

interface AITestConnectionResponse {
  success: boolean;
  message?: string;
  error?: string;
  latency?: number;
}

export class AIService {
  private getDefaultApiKey(provider: string): string | undefined {
    const keyMap: Record<string, string | undefined> = {
      deepseek: process.env.DEEPSEEK_API_KEY,
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      zhipu: process.env.ZHIPU_API_KEY,
      qwen: process.env.QWEN_API_KEY,
      moonshot: process.env.MOONSHOT_API_KEY,
      baichuan: process.env.BAICHUAN_API_KEY,
      siliconflow: process.env.SILICONFLOW_API_KEY,
    };
    return keyMap[provider];
  }

  async testConnection(request: AITestConnectionRequest): Promise<AITestConnectionResponse> {
    const { provider, modelType, modelId, baseUrl, apiKey } = request;
    const startTime = Date.now();

    // 验证必填参数
    if (!baseUrl) {
      return {
        success: false,
        error: "API 地址不能为空",
      };
    }

    let effectiveApiKey = apiKey || this.getDefaultApiKey(provider);
    if (!effectiveApiKey) {
      return {
        success: false,
        error: `未配置 ${provider} 的 API Key，请在模型配置或环境变量中设置`,
      };
    }

    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("请求超时（30秒）")), 30000);
      });

      const testPromise = (async () => {
        if (modelType === "chat") {
          if (provider === "anthropic") {
            await this.testAnthropicConnection(modelId, baseUrl, effectiveApiKey);
          } else {
            await this.testOpenAICompatibleConnection(modelId, baseUrl, effectiveApiKey);
          }
        } else if (modelType === "embedding") {
          await this.testEmbeddingConnection(modelId, baseUrl, effectiveApiKey, provider);
        } else {
          throw new Error(`不支持的模型类型: ${modelType}`);
        }
      })();

      await Promise.race([testPromise, timeoutPromise]);

      const latency = Date.now() - startTime;
      return {
        success: true,
        message: `连接成功 (${modelType === "chat" ? "对话模型" : "向量模型"})`,
        latency,
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      return {
        success: false,
        error: error.message || "未知错误",
        latency,
      };
    }
  }

  private async testOpenAICompatibleConnection(
    modelId: string,
    baseUrl: string,
    apiKey: string
  ): Promise<void> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      }
      throw new Error(`连接失败: ${errorMessage}`);
    }

    // 验证返回数据格式
    const data = await response.json();
    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error("返回数据格式错误");
    }
  }

  private async testAnthropicConnection(
    modelId: string,
    baseUrl: string,
    apiKey: string
  ): Promise<void> {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      }),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        const errorText = await response.text();
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      }
      throw new Error(`连接失败: ${errorMessage}`);
    }

    // 验证返回数据格式
    const data = await response.json();
    if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
      throw new Error("返回数据格式错误");
    }
  }

  private async testEmbeddingConnection(
    modelId: string,
    baseUrl: string,
    apiKey: string,
    provider: string
  ): Promise<void> {
    // 智谱AI 使用不同的 API 格式
    if (provider === "zhipu") {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          input: "测试文本",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`连接失败: ${response.status} - ${errorText}`);
      }
      return;
    }

    // OpenAI 兼容格式（DeepSeek, OpenAI, 硅基流动等）
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        input: "测试文本",
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`连接失败: ${response.status} - ${errorText}`);
    }

    // 验证返回数据格式
    const data = await response.json();
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error("返回数据格式错误");
    }

    if (!data.data[0].embedding || !Array.isArray(data.data[0].embedding)) {
      throw new Error("向量数据格式错误");
    }
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    const { prompt, modelId, provider, baseUrl, apiKey, parameters } = request;

    let effectiveApiKey = apiKey || this.getDefaultApiKey(provider);
    if (!effectiveApiKey) {
      throw new Error(`No API key available for provider: ${provider}`);
    }

    try {
      if (provider === "anthropic") {
        return await this.generateAnthropic(
          modelId,
          baseUrl,
          effectiveApiKey,
          prompt,
          parameters
        );
      } else {
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
  /**
   * Get embedding vector for text
   * Uses the default embedding model
   */
  async getEmbedding(text: string): Promise<number[] | null> {
    try {
      const { storage } = await import("./storage");
      
      // Get default embedding model
      const models = await storage.getAIModels();
      const embeddingModel = models.find(
        (m) => m.modelType === "embedding" && m.isDefaultEmbedding && m.isActive
      );

      if (!embeddingModel) {
        console.log("[AI Service] No default embedding model configured");
        return null;
      }

      const apiKey =
        embeddingModel.apiKey || this.getDefaultApiKey(embeddingModel.provider);
      if (!apiKey) {
        console.log(
          `[AI Service] No API key for embedding model ${embeddingModel.provider}`
        );
        return null;
      }

      // Call embedding API
      const baseUrl = embeddingModel.baseUrl || "";
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: embeddingModel.modelId,
          input: text,
          encoding_format: "float",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[AI Service] Embedding API error: ${response.status} - ${errorText}`
        );
        return null;
      }

      const data = await response.json();
      if (
        !data.data ||
        !Array.isArray(data.data) ||
        data.data.length === 0 ||
        !data.data[0].embedding
      ) {
        console.error("[AI Service] Invalid embedding response format");
        return null;
      }

      return data.data[0].embedding;
    } catch (error) {
      console.error("[AI Service] Get embedding failed:", error);
      return null;
    }
  }

  /**
   * Get default embedding model
   */
  async getDefaultEmbeddingModel(): Promise<any | null> {
    try {
      const { storage } = await import("./storage");
      const models = await storage.getAIModels();
      const embeddingModel = models.find(
        (m) => m.modelType === "embedding" && m.isDefaultEmbedding && m.isActive
      );
      return embeddingModel || null;
    } catch (error) {
      console.error("[AI Service] Get default embedding model failed:", error);
      return null;
    }
  }
}

export const aiService = new AIService();
