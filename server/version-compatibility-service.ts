/**
 * Version Compatibility Service
 * Detects schema version and provides upgrade guidance
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

export interface SchemaVersion {
  version: string;
  appliedAt: Date;
  description: string;
}

export interface CompatibilityCheck {
  isCompatible: boolean;
  currentVersion: string;
  requiredVersion: string;
  missingTables: string[];
  missingColumns: { table: string; column: string }[];
  upgradeRequired: boolean;
  upgradeInstructions: string[];
}

export class VersionCompatibilityService {
  private readonly REQUIRED_VERSION = "0004";
  private readonly REQUIRED_TABLES = [
    "generation_logs",
    "cached_executions",
    "character_state_history",
    "prompt_template_versions",
  ];

  private readonly REQUIRED_COLUMNS = [
    { table: "draft_chunks", column: "prompt_template_id" },
    { table: "draft_chunks", column: "template_version" },
    { table: "draft_chunks", column: "model_used" },
    { table: "draft_chunks", column: "tokens_used" },
    { table: "draft_chunks", column: "cost" },
    { table: "draft_chunks", column: "quality_score" },
    { table: "characters", column: "arc_points" },
    { table: "characters", column: "current_emotion" },
    { table: "characters", column: "current_goal" },
    { table: "characters", column: "short_motivation" },
    { table: "characters", column: "state_updated_at" },
  ];

  /**
   * Check if the database schema is compatible with the current version
   */
  async checkCompatibility(): Promise<CompatibilityCheck> {
    const result: CompatibilityCheck = {
      isCompatible: true,
      currentVersion: "unknown",
      requiredVersion: this.REQUIRED_VERSION,
      missingTables: [],
      missingColumns: [],
      upgradeRequired: false,
      upgradeInstructions: [],
    };

    try {
      // Get current schema version
      const versionResult = await this.getCurrentVersion();
      result.currentVersion = versionResult || "0000";

      // Check for missing tables
      result.missingTables = await this.checkMissingTables();

      // Check for missing columns
      result.missingColumns = await this.checkMissingColumns();

      // Determine if upgrade is required
      result.upgradeRequired =
        result.missingTables.length > 0 || result.missingColumns.length > 0;

      result.isCompatible = !result.upgradeRequired;

      // Generate upgrade instructions
      if (result.upgradeRequired) {
        result.upgradeInstructions = this.generateUpgradeInstructions(result);
      }

      console.log(
        `[VersionCompatibility] Current: ${result.currentVersion}, Required: ${result.requiredVersion}, Compatible: ${result.isCompatible}`
      );
    } catch (error) {
      console.error("[VersionCompatibility] Error checking compatibility:", error);
      result.isCompatible = false;
      result.upgradeInstructions.push(
        "Error checking compatibility. Please check database connection."
      );
    }

    return result;
  }

  /**
   * Get current schema version from database
   */
  private async getCurrentVersion(): Promise<string | null> {
    try {
      // Check if schema_migrations table exists
      const tableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'schema_migrations'
        ) as exists
      `);

      if (!tableExists.rows[0]?.exists) {
        return null;
      }

      // Get latest migration version
      const result = await db.execute(sql`
        SELECT version, applied_at
        FROM schema_migrations
        ORDER BY applied_at DESC
        LIMIT 1
      `);

      const version = result.rows[0]?.version;
      return version ? String(version) : null;
    } catch (error) {
      console.error("[VersionCompatibility] Error getting version:", error);
      return null;
    }
  }

  /**
   * Check for missing tables
   */
  private async checkMissingTables(): Promise<string[]> {
    const missing: string[] = [];

    try {
      for (const tableName of this.REQUIRED_TABLES) {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = ${tableName}
          ) as exists
        `);

        if (!result.rows[0]?.exists) {
          missing.push(tableName);
        }
      }
    } catch (error) {
      console.error("[VersionCompatibility] Error checking tables:", error);
    }

    return missing;
  }

  /**
   * Check for missing columns
   */
  private async checkMissingColumns(): Promise<
    { table: string; column: string }[]
  > {
    const missing: { table: string; column: string }[] = [];

    try {
      for (const { table, column } of this.REQUIRED_COLUMNS) {
        const result = await db.execute(sql`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = ${table} AND column_name = ${column}
          ) as exists
        `);

        if (!result.rows[0]?.exists) {
          missing.push({ table, column });
        }
      }
    } catch (error) {
      console.error("[VersionCompatibility] Error checking columns:", error);
    }

    return missing;
  }

  /**
   * Generate upgrade instructions based on missing components
   */
  private generateUpgradeInstructions(
    check: CompatibilityCheck
  ): string[] {
    const instructions: string[] = [];

    instructions.push(
      "Your database schema needs to be upgraded to use the new features."
    );
    instructions.push("");

    if (check.missingTables.length > 0) {
      instructions.push("Missing tables:");
      check.missingTables.forEach((table) => {
        instructions.push(`  - ${table}`);
      });
      instructions.push("");
    }

    if (check.missingColumns.length > 0) {
      instructions.push("Missing columns:");
      const grouped = check.missingColumns.reduce(
        (acc, { table, column }) => {
          if (!acc[table]) acc[table] = [];
          acc[table].push(column);
          return acc;
        },
        {} as Record<string, string[]>
      );

      Object.entries(grouped).forEach(([table, columns]) => {
        instructions.push(`  ${table}:`);
        columns.forEach((col) => instructions.push(`    - ${col}`));
      });
      instructions.push("");
    }

    instructions.push("To upgrade:");
    instructions.push("1. Run: npm run migrate:up");
    instructions.push("2. Run: npm run migrate:data");
    instructions.push("");
    instructions.push(
      "Or manually run the migration scripts in the migrations/ directory."
    );

    return instructions;
  }

  /**
   * Check if a specific feature is available
   */
  async isFeatureAvailable(feature: string): Promise<boolean> {
    const featureRequirements: Record<string, string[]> = {
      "generation-logs": ["generation_logs"],
      "semantic-cache": ["cached_executions"],
      "character-state": ["character_state_history"],
      "prompt-templates": ["prompt_template_versions"],
      "quality-tracking": ["draft_chunks.quality_score"],
      "cost-monitoring": ["generation_logs", "draft_chunks.cost"],
    };

    const requirements = featureRequirements[feature];
    if (!requirements) {
      return false;
    }

    try {
      for (const req of requirements) {
        if (req.includes(".")) {
          // Column check
          const [table, column] = req.split(".");
          const result = await db.execute(sql`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = ${table} AND column_name = ${column}
            ) as exists
          `);

          if (!result.rows[0]?.exists) {
            return false;
          }
        } else {
          // Table check
          const result = await db.execute(sql`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_name = ${req}
            ) as exists
          `);

          if (!result.rows[0]?.exists) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error(
        `[VersionCompatibility] Error checking feature ${feature}:`,
        error
      );
      return false;
    }
  }

  /**
   * Get a user-friendly compatibility report
   */
  async getCompatibilityReport(): Promise<string> {
    const check = await this.checkCompatibility();

    let report = "=".repeat(60) + "\n";
    report += "Database Schema Compatibility Report\n";
    report += "=".repeat(60) + "\n\n";

    report += `Current Version: ${check.currentVersion}\n`;
    report += `Required Version: ${check.requiredVersion}\n`;
    report += `Status: ${check.isCompatible ? "✓ Compatible" : "✗ Upgrade Required"}\n\n`;

    if (!check.isCompatible) {
      report += "Issues Found:\n";
      report += "-".repeat(60) + "\n";

      if (check.missingTables.length > 0) {
        report += `Missing Tables (${check.missingTables.length}):\n`;
        check.missingTables.forEach((table) => {
          report += `  - ${table}\n`;
        });
        report += "\n";
      }

      if (check.missingColumns.length > 0) {
        report += `Missing Columns (${check.missingColumns.length}):\n`;
        const grouped = check.missingColumns.reduce(
          (acc, { table, column }) => {
            if (!acc[table]) acc[table] = [];
            acc[table].push(column);
            return acc;
          },
          {} as Record<string, string[]>
        );

        Object.entries(grouped).forEach(([table, columns]) => {
          report += `  ${table}:\n`;
          columns.forEach((col) => report += `    - ${col}\n`);
        });
        report += "\n";
      }

      report += "Upgrade Instructions:\n";
      report += "-".repeat(60) + "\n";
      check.upgradeInstructions.forEach((instruction) => {
        report += instruction + "\n";
      });
    } else {
      report += "All required tables and columns are present.\n";
      report += "Your database is ready to use all features.\n";
    }

    report += "\n" + "=".repeat(60) + "\n";

    return report;
  }
}

export const versionCompatibilityService = new VersionCompatibilityService();
