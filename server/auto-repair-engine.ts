// Auto Repair Engine
// Automatically repairs content based on validation violations

export interface RepairAction {
    type: string;
    description: string;
    original: string;
    replacement: string;
}

export interface RepairResult {
    success: boolean;
    actions: RepairAction[];
    message?: string;
}

export interface Violation {
    type: string;
    message: string;
    severity?: string;
    autoFixable?: boolean;
    path?: string;
    [key: string]: any;
}

class AutoRepairEngine {
    /**
     * Attempt to repair content based on violations
     * @param content - The content to repair (JSON string)
     * @param violations - List of violations to fix
     * @returns Repair result with actions taken
     */
    async repair(content: string, violations: Violation[]): Promise<RepairResult> {
        try {
            let repairedContent = content;
            const actions: RepairAction[] = [];

            // Sort violations by severity (high priority first)
            const sortedViolations = [...violations].sort((a, b) => {
                const severityOrder: { [key: string]: number } = { high: 3, medium: 2, low: 1 };
                return (severityOrder[b.severity || 'low'] || 0) - (severityOrder[a.severity || 'low'] || 0);
            });

            for (const violation of sortedViolations) {
                if (!violation.autoFixable) continue;

                const repairAction = await this.repairViolation(repairedContent, violation);
                if (repairAction) {
                    repairedContent = repairAction.replacement;
                    actions.push(repairAction);
                }
            }

            return {
                success: actions.length > 0,
                actions,
                message: actions.length > 0
                    ? `Successfully applied ${actions.length} repair(s)`
                    : 'No repairs were applied',
            };
        } catch (error) {
            console.error('[AutoRepair] Error during repair:', error);
            return {
                success: false,
                actions: [],
                message: error instanceof Error ? error.message : 'Unknown error during repair',
            };
        }
    }

    /**
     * Repair a single violation
     */
    private async repairViolation(content: string, violation: Violation): Promise<RepairAction | null> {
        try {
            let parsed: any;
            try {
                parsed = JSON.parse(content);
            } catch {
                // Not JSON, return null
                return null;
            }

            let modified = false;
            const original = content;

            switch (violation.type) {
                case 'missing_field':
                    modified = this.fixMissingFields(parsed, violation);
                    break;

                case 'empty_array':
                    modified = this.fixEmptyArrays(parsed, violation);
                    break;

                case 'invalid_format':
                    modified = this.fixInvalidFormat(parsed, violation);
                    break;

                case 'coherence':
                    // Coherence issues are harder to auto-fix
                    console.log('[AutoRepair] Skipping coherence violation (manual review needed)');
                    break;

                default:
                    console.log(`[AutoRepair] Unknown violation type: ${violation.type}`);
            }

            if (modified) {
                const replacement = JSON.stringify(parsed, null, 2);
                return {
                    type: violation.type,
                    description: violation.message,
                    original,
                    replacement,
                };
            }

            return null;
        } catch (error) {
            console.error(`[AutoRepair] Failed to repair violation ${violation.type}:`, error);
            return null;
        }
    }

    /**
     * Fix missing required fields
     */
    private fixMissingFields(data: any, violation: Violation): boolean {
        if (!Array.isArray(data)) return false;

        let modified = false;
        for (const item of data) {
            // Add default values for common missing fields
            if (!item.title) {
                item.title = '未命名';
                modified = true;
            }

            if (!item.oneLiner) {
                item.oneLiner = item.title || '待完善';
                modified = true;
            }

            if (!item.beats || !Array.isArray(item.beats)) {
                item.beats = ['待完善'];
                modified = true;
            }

            if (!item.requiredEntities && violation.path?.includes('chapter')) {
                item.requiredEntities = [];
                modified = true;
            }

            if (!item.stakesDelta && violation.path?.includes('chapter')) {
                item.stakesDelta = '待完善';
                modified = true;
            }
        }

        return modified;
    }

    /**
     * Fix empty arrays
     */
    private fixEmptyArrays(data: any, violation: Violation): boolean {
        if (!Array.isArray(data)) return false;

        let modified = false;
        for (const item of data) {
            if (Array.isArray(item.beats) && item.beats.length === 0) {
                item.beats = ['待完善'];
                modified = true;
            }

            if (Array.isArray(item.requiredEntities) && item.requiredEntities.length === 0) {
                // Empty requiredEntities is actually okay, don't modify
            }

            if (Array.isArray(item.themeTags) && item.themeTags.length === 0) {
                // Empty themeTags is actually okay, don't modify
            }
        }

        return modified;
    }

    /**
     * Fix invalid format issues
     */
    private fixInvalidFormat(data: any, violation: Violation): boolean {
        if (!Array.isArray(data)) return false;

        let modified = false;
        for (const item of data) {
            // Ensure orderIndex is a number
            if (item.orderIndex !== undefined && typeof item.orderIndex !== 'number') {
                item.orderIndex = parseInt(item.orderIndex, 10) || 0;
                modified = true;
            }

            // Ensure volumeIndex is a number (for chapters)
            if (item.volumeIndex !== undefined && typeof item.volumeIndex !== 'number') {
                item.volumeIndex = parseInt(item.volumeIndex, 10) || 0;
                modified = true;
            }

            // Ensure arrays are actually arrays
            if (item.beats && !Array.isArray(item.beats)) {
                item.beats = [item.beats];
                modified = true;
            }

            if (item.requiredEntities && !Array.isArray(item.requiredEntities)) {
                item.requiredEntities = [item.requiredEntities];
                modified = true;
            }
        }

        return modified;
    }
}

// Export singleton instance
export const autoRepairEngine = new AutoRepairEngine();
