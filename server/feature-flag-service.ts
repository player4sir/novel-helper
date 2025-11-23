/**
 * Feature Flag Service
 * Supports gradual feature rollout and rollback mechanisms
 */

import { versionCompatibilityService } from "./version-compatibility-service";

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description: string;
  requiresSchemaVersion?: string;
  dependsOn?: string[];
}

export interface FeatureFlagConfig {
  [key: string]: boolean;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private overrides: Map<string, boolean> = new Map();

  constructor() {
    this.initializeFlags();
  }

  /**
   * Initialize default feature flags
   */
  private initializeFlags() {
    // Core refactored features
    this.registerFlag({
      name: "generation-logs",
      enabled: true,
      description: "Complete audit trail for all AI generations",
      requiresSchemaVersion: "0004",
    });

    this.registerFlag({
      name: "enhanced-cache",
      enabled: true,
      description: "Three-tier semantic cache (exact, semantic, template)",
      requiresSchemaVersion: "0004",
      dependsOn: ["generation-logs"],
    });

    this.registerFlag({
      name: "cost-monitoring",
      enabled: true,
      description: "Real-time cost monitoring and optimization",
      requiresSchemaVersion: "0004",
      dependsOn: ["generation-logs"],
    });

    this.registerFlag({
      name: "quality-evaluation",
      enabled: true,
      description: "Multi-dimensional quality scoring",
      requiresSchemaVersion: "0004",
      dependsOn: ["generation-logs"],
    });

    this.registerFlag({
      name: "auto-repair",
      enabled: true,
      description: "Automatic content repair engine",
      requiresSchemaVersion: "0004",
      dependsOn: ["quality-evaluation"],
    });

    this.registerFlag({
      name: "model-routing",
      enabled: true,
      description: "Intelligent model routing based on task complexity",
      requiresSchemaVersion: "0004",
    });

    this.registerFlag({
      name: "character-state-tracking",
      enabled: true,
      description: "Enhanced character state tracking across chapters",
      requiresSchemaVersion: "0004",
    });

    this.registerFlag({
      name: "prompt-templates",
      enabled: true,
      description: "Versioned prompt template system",
      requiresSchemaVersion: "0004",
    });

    // Experimental features (disabled by default)
    this.registerFlag({
      name: "semantic-cache-probe",
      enabled: false,
      description: "Probe verification for semantic cache hits",
      requiresSchemaVersion: "0004",
      dependsOn: ["enhanced-cache"],
    });

    this.registerFlag({
      name: "dynamic-cost-optimization",
      enabled: false,
      description: "Automatic cache threshold and model adjustment",
      requiresSchemaVersion: "0004",
      dependsOn: ["cost-monitoring"],
    });

    this.registerFlag({
      name: "motivation-drift-detection",
      enabled: false,
      description: "Detect character motivation drift using embeddings",
      requiresSchemaVersion: "0004",
      dependsOn: ["character-state-tracking"],
    });
  }

  /**
   * Register a new feature flag
   */
  registerFlag(flag: FeatureFlag): void {
    this.flags.set(flag.name, flag);
  }

  /**
   * Check if a feature is enabled
   */
  async isEnabled(featureName: string): Promise<boolean> {
    // Check for override first
    if (this.overrides.has(featureName)) {
      return this.overrides.get(featureName)!;
    }

    const flag = this.flags.get(featureName);
    if (!flag) {
      console.warn(`[FeatureFlag] Unknown feature: ${featureName}`);
      return false;
    }

    // Check if feature is enabled
    if (!flag.enabled) {
      return false;
    }

    // Check schema version requirement
    if (flag.requiresSchemaVersion) {
      const isAvailable = await versionCompatibilityService.isFeatureAvailable(
        featureName
      );
      if (!isAvailable) {
        console.warn(
          `[FeatureFlag] Feature ${featureName} requires schema upgrade`
        );
        return false;
      }
    }

    // Check dependencies
    if (flag.dependsOn && flag.dependsOn.length > 0) {
      for (const dependency of flag.dependsOn) {
        const depEnabled = await this.isEnabled(dependency);
        if (!depEnabled) {
          console.warn(
            `[FeatureFlag] Feature ${featureName} depends on ${dependency} which is disabled`
          );
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Enable a feature (override)
   */
  enable(featureName: string): void {
    this.overrides.set(featureName, true);
    console.log(`[FeatureFlag] Enabled feature: ${featureName}`);
  }

  /**
   * Disable a feature (override)
   */
  disable(featureName: string): void {
    this.overrides.set(featureName, false);
    console.log(`[FeatureFlag] Disabled feature: ${featureName}`);
  }

  /**
   * Clear override for a feature
   */
  clearOverride(featureName: string): void {
    this.overrides.delete(featureName);
    console.log(`[FeatureFlag] Cleared override for: ${featureName}`);
  }

  /**
   * Get all feature flags with their status
   */
  async getAllFlags(): Promise<
    Array<FeatureFlag & { actuallyEnabled: boolean }>
  > {
    const result: Array<FeatureFlag & { actuallyEnabled: boolean }> = [];

    for (const [name, flag] of Array.from(this.flags.entries())) {
      const actuallyEnabled = await this.isEnabled(name);
      result.push({
        ...flag,
        actuallyEnabled,
      });
    }

    return result;
  }

  /**
   * Get feature flag configuration
   */
  async getConfig(): Promise<FeatureFlagConfig> {
    const config: FeatureFlagConfig = {};

    for (const [name] of Array.from(this.flags.entries())) {
      config[name] = await this.isEnabled(name);
    }

    return config;
  }

  /**
   * Set feature flag configuration
   */
  setConfig(config: FeatureFlagConfig): void {
    for (const [name, enabled] of Object.entries(config)) {
      if (this.flags.has(name)) {
        this.overrides.set(name, enabled);
      }
    }
  }

  /**
   * Reset all overrides
   */
  resetOverrides(): void {
    this.overrides.clear();
    console.log("[FeatureFlag] All overrides cleared");
  }

  /**
   * Get a user-friendly feature status report
   */
  async getStatusReport(): Promise<string> {
    const flags = await this.getAllFlags();

    let report = "=".repeat(60) + "\n";
    report += "Feature Flags Status Report\n";
    report += "=".repeat(60) + "\n\n";

    // Group by status
    const enabled = flags.filter((f) => f.actuallyEnabled);
    const disabled = flags.filter((f) => !f.actuallyEnabled);

    report += `Enabled Features (${enabled.length}):\n`;
    report += "-".repeat(60) + "\n";
    enabled.forEach((flag) => {
      report += `✓ ${flag.name}\n`;
      report += `  ${flag.description}\n`;
      if (this.overrides.has(flag.name)) {
        report += `  (Override: ${this.overrides.get(flag.name)})\n`;
      }
      report += "\n";
    });

    report += `\nDisabled Features (${disabled.length}):\n`;
    report += "-".repeat(60) + "\n";
    disabled.forEach((flag) => {
      report += `✗ ${flag.name}\n`;
      report += `  ${flag.description}\n`;
      if (flag.requiresSchemaVersion) {
        report += `  Requires schema version: ${flag.requiresSchemaVersion}\n`;
      }
      if (flag.dependsOn && flag.dependsOn.length > 0) {
        report += `  Depends on: ${flag.dependsOn.join(", ")}\n`;
      }
      if (this.overrides.has(flag.name)) {
        report += `  (Override: ${this.overrides.get(flag.name)})\n`;
      }
      report += "\n";
    });

    report += "=".repeat(60) + "\n";

    return report;
  }

  /**
   * Rollback helper - disable all new features
   */
  async rollbackToLegacy(): Promise<void> {
    console.log("[FeatureFlag] Rolling back to legacy mode...");

    const newFeatures = [
      "generation-logs",
      "enhanced-cache",
      "cost-monitoring",
      "quality-evaluation",
      "auto-repair",
      "model-routing",
      "character-state-tracking",
      "prompt-templates",
      "semantic-cache-probe",
      "dynamic-cost-optimization",
      "motivation-drift-detection",
    ];

    newFeatures.forEach((feature) => {
      this.disable(feature);
    });

    console.log("[FeatureFlag] Rollback complete. All new features disabled.");
  }

  /**
   * Enable all stable features
   */
  async enableStableFeatures(): Promise<void> {
    console.log("[FeatureFlag] Enabling all stable features...");

    const stableFeatures = [
      "generation-logs",
      "enhanced-cache",
      "cost-monitoring",
      "quality-evaluation",
      "auto-repair",
      "model-routing",
      "character-state-tracking",
      "prompt-templates",
    ];

    stableFeatures.forEach((feature) => {
      this.enable(feature);
    });

    console.log("[FeatureFlag] All stable features enabled.");
  }
}

export const featureFlagService = new FeatureFlagService();
