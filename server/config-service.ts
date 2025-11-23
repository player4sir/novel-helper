// Configuration Service - Dynamic configuration management
// Supports model-specific timeouts, environment-specific settings, and hot reload

import { storage } from "./storage";
import type { AIModel } from "@shared/schema";

interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

interface ConfigCache {
  value: any;
  timestamp: number;
  ttl: number;
}

export class ConfigService {
  private cache: Map<string, ConfigCache> = new Map();
  private readonly DEFAULT_CACHE_TTL = 60000; // 1 minute in milliseconds
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || "production";
    console.log(`[ConfigService] Initialized for environment: ${this.environment}`);
  }

  /**
   * Get model-specific timeout
   * Returns model's configured timeout or falls back to task-specific default
   */
  async getModelTimeout(modelId: string, taskType: string): Promise<number> {
    const cacheKey = `model_timeout:${modelId}`;
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // Try to get model-specific timeout
      const models = await storage.getAIModels();
      const model = models.find((m) => m.id === modelId || m.modelId === modelId);

      if (model?.timeout) {
        this.setCache(cacheKey, model.timeout, this.DEFAULT_CACHE_TTL);
        return model.timeout;
      }

      // Fall back to task-specific default
      const defaultTimeout = await this.getDefaultTimeout(taskType);
      return defaultTimeout;
    } catch (error) {
      console.error(`[ConfigService] Error getting model timeout:`, error);
      // Return safe default
      return await this.getDefaultTimeout(taskType);
    }
  }

  /**
   * Get default timeout for task type
   */
  async getDefaultTimeout(taskType: string): Promise<number> {
    const cacheKey = `default_timeout:${taskType}`;
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const configKey = `timeout.${taskType}.default`;
      const config = await this.getConfigWithDefault(configKey, {
        development: 30000,
        production: 60000,
      });

      const timeout = this.getEnvironmentValue(config);
      this.setCache(cacheKey, timeout, this.DEFAULT_CACHE_TTL);
      return timeout;
    } catch (error) {
      console.error(`[ConfigService] Error getting default timeout:`, error);
      // Safe default: 60 seconds
      return 60000;
    }
  }

  /**
   * Get retry configuration for current environment
   */
  async getRetryConfig(environment?: string): Promise<RetryConfig> {
    const env = environment || this.environment;
    const cacheKey = `retry_config:${env}`;
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const maxRetries = await this.getConfigWithDefault("retry.max_attempts", {
        development: 2,
        production: 5,
      });

      const initialDelay = await this.getConfigWithDefault("retry.initial_delay", {
        development: 1000,
        production: 1000,
      });

      const maxDelay = await this.getConfigWithDefault("retry.max_delay", {
        development: 10000,
        production: 30000,
      });

      const backoffMultiplier = await this.getConfigWithDefault(
        "retry.backoff_multiplier",
        {
          development: 2,
          production: 2,
        }
      );

      const config: RetryConfig = {
        maxRetries: this.getEnvironmentValue(maxRetries, env),
        initialDelay: this.getEnvironmentValue(initialDelay, env),
        maxDelay: this.getEnvironmentValue(maxDelay, env),
        backoffMultiplier: this.getEnvironmentValue(backoffMultiplier, env),
      };

      this.setCache(cacheKey, config, this.DEFAULT_CACHE_TTL);
      return config;
    } catch (error) {
      console.error(`[ConfigService] Error getting retry config:`, error);
      // Safe defaults
      return {
        maxRetries: env === "development" ? 2 : 5,
        initialDelay: 1000,
        maxDelay: env === "development" ? 10000 : 30000,
        backoffMultiplier: 2,
      };
    }
  }

  /**
   * Get configuration value with fallback to default
   */
  async getConfigWithDefault<T>(key: string, defaultValue: T): Promise<T> {
    const cacheKey = `config:${key}`;
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const result = await storage.getSystemConfig(key);

      if (result) {
        this.setCache(cacheKey, result.value, this.DEFAULT_CACHE_TTL);
        return result.value as T;
      }

      // Log warning for missing config
      console.warn(
        `[ConfigService] Configuration key "${key}" not found, using default value`
      );
      return defaultValue;
    } catch (error) {
      console.error(`[ConfigService] Error getting config "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Get parser configuration
   */
  async getParserConfig(): Promise<{
    maxRecoveryAttempts: number;
    enableCommentRemoval: boolean;
    enableMarkdownExtraction: boolean;
    enableErrorFixing: boolean;
  }> {
    const cacheKey = "parser_config";
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const maxRecoveryAttempts = await this.getConfigWithDefault(
        "parser.max_recovery_attempts",
        3
      );
      const enableCommentRemoval = await this.getConfigWithDefault(
        "parser.enable_comment_removal",
        true
      );
      const enableMarkdownExtraction = await this.getConfigWithDefault(
        "parser.enable_markdown_extraction",
        true
      );
      const enableErrorFixing = await this.getConfigWithDefault(
        "parser.enable_error_fixing",
        true
      );

      const config = {
        maxRecoveryAttempts,
        enableCommentRemoval,
        enableMarkdownExtraction,
        enableErrorFixing,
      };

      this.setCache(cacheKey, config, this.DEFAULT_CACHE_TTL);
      return config;
    } catch (error) {
      console.error(`[ConfigService] Error getting parser config:`, error);
      return {
        maxRecoveryAttempts: 3,
        enableCommentRemoval: true,
        enableMarkdownExtraction: true,
        enableErrorFixing: true,
      };
    }
  }

  /**
   * Get quality mode configuration
   */
  async getQualityModeConfig(mode: "fast" | "quality"): Promise<{
    skipSemanticValidation: boolean;
    skipWritabilityCheck: boolean;
  }> {
    const cacheKey = `quality_mode:${mode}`;
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      if (mode === "fast") {
        const skipSemanticValidation = await this.getConfigWithDefault(
          "quality_mode.fast.skip_semantic_validation",
          true
        );
        const skipWritabilityCheck = await this.getConfigWithDefault(
          "quality_mode.fast.skip_writability_check",
          true
        );

        const config = { skipSemanticValidation, skipWritabilityCheck };
        this.setCache(cacheKey, config, this.DEFAULT_CACHE_TTL);
        return config;
      } else {
        // Quality mode: enable all checks
        const config = {
          skipSemanticValidation: false,
          skipWritabilityCheck: false,
        };
        this.setCache(cacheKey, config, this.DEFAULT_CACHE_TTL);
        return config;
      }
    } catch (error) {
      console.error(`[ConfigService] Error getting quality mode config:`, error);
      return {
        skipSemanticValidation: mode === "fast",
        skipWritabilityCheck: mode === "fast",
      };
    }
  }

  /**
   * Reload configuration (clear cache)
   * This allows configuration changes to take effect without restart
   */
  async reloadConfig(): Promise<void> {
    console.log("[ConfigService] Reloading configuration...");
    this.cache.clear();
    console.log("[ConfigService] Configuration cache cleared");
  }

  /**
   * Get cache TTL configuration
   */
  async getCacheTTL(cacheType: string): Promise<number> {
    try {
      const config = await this.getConfigWithDefault(`cache.ttl.${cacheType}`, {
        development: 60,
        production: 300,
      });
      return this.getEnvironmentValue(config) * 1000; // Convert to milliseconds
    } catch (error) {
      console.error(`[ConfigService] Error getting cache TTL:`, error);
      return this.DEFAULT_CACHE_TTL;
    }
  }

  /**
   * Get logging configuration
   */
  async getLoggingConfig(): Promise<{
    level: string;
    includeRawResponse: boolean;
    maxResponseLength: number;
  }> {
    const cacheKey = "logging_config";
    const cached = this.getCached(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const level = await this.getConfigWithDefault("logging.level", {
        development: "debug",
        production: "info",
      });
      const includeRawResponse = await this.getConfigWithDefault(
        "logging.include_raw_response",
        {
          development: true,
          production: false,
        }
      );
      const maxResponseLength = await this.getConfigWithDefault(
        "logging.max_response_length",
        {
          development: 10000,
          production: 1000,
        }
      );

      const config = {
        level: this.getEnvironmentValue(level),
        includeRawResponse: this.getEnvironmentValue(includeRawResponse),
        maxResponseLength: this.getEnvironmentValue(maxResponseLength),
      };

      this.setCache(cacheKey, config, this.DEFAULT_CACHE_TTL);
      return config;
    } catch (error) {
      console.error(`[ConfigService] Error getting logging config:`, error);
      return {
        level: this.environment === "development" ? "debug" : "info",
        includeRawResponse: this.environment === "development",
        maxResponseLength: this.environment === "development" ? 10000 : 1000,
      };
    }
  }

  /**
   * Extract environment-specific value from config object
   */
  private getEnvironmentValue(config: any, environment?: string): any {
    const env = environment || this.environment;

    // If config is not an object, return as-is
    if (typeof config !== "object" || config === null) {
      return config;
    }

    // If config has environment-specific values
    if (env in config) {
      return config[env];
    }

    // If config has 'all' environment
    if ("all" in config) {
      return config.all;
    }

    // Return the config object itself
    return config;
  }

  /**
   * Get cached value if not expired
   */
  private getCached(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Set cache value with TTL
   */
  private setCache(key: string, value: any, ttl: number): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get current environment
   */
  getEnvironment(): string {
    return this.environment;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.environment === "development";
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.environment === "production";
  }
}

// Export singleton instance
export const configService = new ConfigService();
