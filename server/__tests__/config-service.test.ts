// ConfigService Tests
// Basic tests to verify configuration loading and caching

import { configService } from "../config-service";

describe("ConfigService", () => {
  beforeEach(async () => {
    // Clear cache before each test
    await configService.reloadConfig();
  });

  describe("Environment Detection", () => {
    it("should detect current environment", () => {
      const env = configService.getEnvironment();
      expect(env).toBeDefined();
      expect(typeof env).toBe("string");
    });

    it("should provide environment check methods", () => {
      expect(typeof configService.isDevelopment()).toBe("boolean");
      expect(typeof configService.isProduction()).toBe("boolean");
    });
  });

  describe("Timeout Configuration", () => {
    it("should return default timeout for task type", async () => {
      const timeout = await configService.getDefaultTimeout("project_creation");
      expect(timeout).toBeGreaterThan(0);
      expect(typeof timeout).toBe("number");
    });

    it("should return safe default for unknown task type", async () => {
      const timeout = await configService.getDefaultTimeout("unknown_task");
      expect(timeout).toBe(60000); // Safe default
    });

    it("should cache timeout values", async () => {
      const timeout1 = await configService.getDefaultTimeout("project_creation");
      const timeout2 = await configService.getDefaultTimeout("project_creation");
      expect(timeout1).toBe(timeout2);
    });
  });

  describe("Retry Configuration", () => {
    it("should return retry config for current environment", async () => {
      const config = await configService.getRetryConfig();
      expect(config).toHaveProperty("maxRetries");
      expect(config).toHaveProperty("initialDelay");
      expect(config).toHaveProperty("maxDelay");
      expect(config).toHaveProperty("backoffMultiplier");
      expect(config.maxRetries).toBeGreaterThan(0);
    });

    it("should return different configs for different environments", async () => {
      const devConfig = await configService.getRetryConfig("development");
      const prodConfig = await configService.getRetryConfig("production");
      
      // Production should have more retries
      expect(prodConfig.maxRetries).toBeGreaterThanOrEqual(devConfig.maxRetries);
    });
  });

  describe("Parser Configuration", () => {
    it("should return parser config with all flags", async () => {
      const config = await configService.getParserConfig();
      expect(config).toHaveProperty("maxRecoveryAttempts");
      expect(config).toHaveProperty("enableCommentRemoval");
      expect(config).toHaveProperty("enableMarkdownExtraction");
      expect(config).toHaveProperty("enableErrorFixing");
    });

    it("should return boolean flags", async () => {
      const config = await configService.getParserConfig();
      expect(typeof config.enableCommentRemoval).toBe("boolean");
      expect(typeof config.enableMarkdownExtraction).toBe("boolean");
      expect(typeof config.enableErrorFixing).toBe("boolean");
    });
  });

  describe("Quality Mode Configuration", () => {
    it("should return fast mode config", async () => {
      const config = await configService.getQualityModeConfig("fast");
      expect(config).toHaveProperty("skipSemanticValidation");
      expect(config).toHaveProperty("skipWritabilityCheck");
      expect(config.skipSemanticValidation).toBe(true);
      expect(config.skipWritabilityCheck).toBe(true);
    });

    it("should return quality mode config", async () => {
      const config = await configService.getQualityModeConfig("quality");
      expect(config.skipSemanticValidation).toBe(false);
      expect(config.skipWritabilityCheck).toBe(false);
    });
  });

  describe("Logging Configuration", () => {
    it("should return logging config", async () => {
      const config = await configService.getLoggingConfig();
      expect(config).toHaveProperty("level");
      expect(config).toHaveProperty("includeRawResponse");
      expect(config).toHaveProperty("maxResponseLength");
    });

    it("should return environment-specific logging config", async () => {
      const config = await configService.getLoggingConfig();
      expect(["debug", "info", "warn", "error"]).toContain(config.level);
      expect(typeof config.includeRawResponse).toBe("boolean");
      expect(config.maxResponseLength).toBeGreaterThan(0);
    });
  });

  describe("Cache Management", () => {
    it("should cache configuration values", async () => {
      const config1 = await configService.getParserConfig();
      const config2 = await configService.getParserConfig();
      expect(config1).toEqual(config2);
    });

    it("should clear cache on reload", async () => {
      await configService.getParserConfig();
      await configService.reloadConfig();
      // After reload, should fetch fresh config
      const config = await configService.getParserConfig();
      expect(config).toBeDefined();
    });
  });

  describe("Config with Default", () => {
    it("should return default value for missing config", async () => {
      const value = await configService.getConfigWithDefault(
        "nonexistent.key",
        "default_value"
      );
      expect(value).toBe("default_value");
    });

    it("should handle object default values", async () => {
      const defaultObj = { dev: 100, prod: 200 };
      const value = await configService.getConfigWithDefault(
        "nonexistent.key",
        defaultObj
      );
      expect(value).toEqual(defaultObj);
    });
  });
});
