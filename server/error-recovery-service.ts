// Error Recovery Service
// Handles error recovery, retry mechanisms, and state persistence

import { sessionManager } from "./session-manager";
import type { SessionId } from "./session-manager";

// Types
export type ErrorType =
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "INVALID_INPUT"
  | "PERMISSION_DENIED"
  | "CONFIG_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_ERROR"
  | "UNKNOWN";

export interface RetryStrategy {
  maxAttempts: number;
  initialDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

export interface ErrorNotification {
  level: "info" | "warning" | "error" | "critical";
  message: string;
  details?: string;
  recoveryOptions: RecoveryOption[];
  timestamp: Date;
}

export interface RecoveryOption {
  label: string;
  action: () => Promise<void>;
  recommended: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

// Default retry strategy
export const defaultRetryStrategy: RetryStrategy = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: ["TIMEOUT", "NETWORK_ERROR", "SERVICE_UNAVAILABLE"],
};

/**
 * ErrorRecoveryService - Handles error recovery and retry logic
 */
export class ErrorRecoveryService {
  /**
   * Retry a function with exponential backoff
   */
  async retryWithBackoff<T>(
    fn: () => Promise<T>,
    strategy: RetryStrategy = defaultRetryStrategy
  ): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 1; attempt <= strategy.maxAttempts; attempt++) {
      try {
        console.log(`[Retry] Attempt ${attempt}/${strategy.maxAttempts}`);
        const result = await fn();

        return {
          success: true,
          result,
          attempts: attempt,
          totalDelay,
        };
      } catch (error: any) {
        lastError = error;
        const errorType = this.classifyError(error);

        console.error(
          `[Retry] Attempt ${attempt} failed with error type: ${errorType}`,
          error.message
        );

        // Check if error is retryable
        if (!strategy.retryableErrors.includes(errorType)) {
          console.log(`[Retry] Error type ${errorType} is not retryable`);
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDelay,
          };
        }

        // Don't wait after the last attempt
        if (attempt < strategy.maxAttempts) {
          const delay = this.calculateBackoffDelay(
            attempt,
            strategy.initialDelay,
            strategy.maxDelay,
            strategy.backoffMultiplier
          );

          console.log(`[Retry] Waiting ${delay}ms before next attempt`);
          await this.sleep(delay);
          totalDelay += delay;
        }
      }
    }

    // All attempts failed
    return {
      success: false,
      error: lastError,
      attempts: strategy.maxAttempts,
      totalDelay,
    };
  }

  /**
   * Save state after failure
   */
  async saveFailureState(
    sessionId: SessionId,
    error: Error,
    context: any
  ): Promise<void> {
    console.log(`[ErrorRecovery] Saving failure state for session: ${sessionId}`);

    try {
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        console.error(`[ErrorRecovery] Session not found: ${sessionId}`);
        return;
      }

      // Update session with error information
      await sessionManager.updateSession(sessionId, {
        status: "paused",
        stepResults: {
          ...(session.stepResults as any),
          _lastError: {
            message: error.message,
            stack: error.stack,
            timestamp: new Date(),
            context,
          },
        },
      });

      console.log(`[ErrorRecovery] Failure state saved for session: ${sessionId}`);
    } catch (saveError) {
      console.error(`[ErrorRecovery] Error saving failure state:`, saveError);
    }
  }

  /**
   * Detect network interruption
   */
  async detectNetworkInterruption(): Promise<boolean> {
    try {
      // Try to make a simple request to check connectivity
      // In a real implementation, this would ping a health check endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        // This is a placeholder - in real implementation, use actual health check
        await new Promise((resolve) => setTimeout(resolve, 100));
        clearTimeout(timeoutId);
        return false; // Network is OK
      } catch (error) {
        clearTimeout(timeoutId);
        return true; // Network interrupted
      }
    } catch (error) {
      console.error(`[ErrorRecovery] Error detecting network:`, error);
      return true; // Assume interrupted on error
    }
  }

  /**
   * Cache content locally (offline cache)
   */
  async cacheContentLocally(
    sessionId: SessionId,
    content: any
  ): Promise<void> {
    console.log(`[ErrorRecovery] Caching content locally for session: ${sessionId}`);

    try {
      // In a browser environment, this would use localStorage or IndexedDB
      // In Node.js, we save to the session
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        console.error(`[ErrorRecovery] Session not found: ${sessionId}`);
        return;
      }

      await sessionManager.updateSession(sessionId, {
        stepResults: {
          ...(session.stepResults as any),
          _offlineCache: {
            content,
            cachedAt: new Date(),
          },
        },
      });

      console.log(`[ErrorRecovery] Content cached locally for session: ${sessionId}`);
    } catch (error) {
      console.error(`[ErrorRecovery] Error caching content:`, error);
    }
  }

  /**
   * Retrieve cached content
   */
  async retrieveCachedContent(sessionId: SessionId): Promise<any | null> {
    console.log(`[ErrorRecovery] Retrieving cached content for session: ${sessionId}`);

    try {
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        return null;
      }

      const stepResults = session.stepResults as any;
      const cache = stepResults?._offlineCache;

      if (cache && cache.content) {
        console.log(`[ErrorRecovery] Found cached content from: ${cache.cachedAt}`);
        return cache.content;
      }

      return null;
    } catch (error) {
      console.error(`[ErrorRecovery] Error retrieving cached content:`, error);
      return null;
    }
  }

  /**
   * Detect data inconsistency
   */
  async detectDataInconsistency(data: any): Promise<boolean> {
    console.log(`[ErrorRecovery] Checking data consistency`);

    try {
      // Basic consistency checks
      if (!data) {
        return true; // Inconsistent
      }

      // Check for required fields based on data type
      if (data.type === "project-meta") {
        const required = ["title", "premise", "mainEntities"];
        for (const field of required) {
          if (!data[field]) {
            console.warn(`[ErrorRecovery] Missing required field: ${field}`);
            return true;
          }
        }
      }

      // Check for circular references
      try {
        JSON.stringify(data);
      } catch (error) {
        console.warn(`[ErrorRecovery] Circular reference detected`);
        return true;
      }

      return false; // Consistent
    } catch (error) {
      console.error(`[ErrorRecovery] Error checking consistency:`, error);
      return true; // Assume inconsistent on error
    }
  }

  /**
   * Rollback to last consistent state
   */
  async rollbackToConsistentState(sessionId: SessionId): Promise<void> {
    console.log(`[ErrorRecovery] Rolling back to consistent state for session: ${sessionId}`);

    try {
      const session = await sessionManager.getSession(sessionId);
      if (!session) {
        console.error(`[ErrorRecovery] Session not found: ${sessionId}`);
        return;
      }

      const stepResults = session.stepResults as any;

      // Find the last consistent state
      const steps = ["basic", "characters", "world", "outline"];
      let lastConsistentStep = null;

      for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i];
        const stepData = stepResults[step];

        if (stepData && !(await this.detectDataInconsistency(stepData))) {
          lastConsistentStep = step;
          break;
        }
      }

      if (lastConsistentStep) {
        console.log(`[ErrorRecovery] Rolling back to step: ${lastConsistentStep}`);

        // Remove inconsistent steps
        const cleanedResults: any = {};
        for (const step of steps) {
          if (step === lastConsistentStep) {
            cleanedResults[step] = stepResults[step];
            break;
          }
          if (stepResults[step]) {
            cleanedResults[step] = stepResults[step];
          }
        }

        await sessionManager.updateSession(sessionId, {
          currentStep: lastConsistentStep as any,
          stepResults: cleanedResults,
          status: "active",
        });

        console.log(`[ErrorRecovery] Rollback completed to step: ${lastConsistentStep}`);
      } else {
        console.warn(`[ErrorRecovery] No consistent state found, resetting session`);
        await sessionManager.updateSession(sessionId, {
          currentStep: "basic",
          status: "active",
        });
      }
    } catch (error) {
      console.error(`[ErrorRecovery] Error during rollback:`, error);
      throw error;
    }
  }

  /**
   * Create error notification
   */
  createErrorNotification(
    error: Error,
    level: ErrorNotification["level"] = "error",
    recoveryOptions: RecoveryOption[] = []
  ): ErrorNotification {
    return {
      level,
      message: error.message,
      details: error.stack,
      recoveryOptions,
      timestamp: new Date(),
    };
  }

  /**
   * Get recovery options for an error
   */
  getRecoveryOptions(
    error: Error,
    sessionId?: SessionId
  ): RecoveryOption[] {
    const errorType = this.classifyError(error);
    const options: RecoveryOption[] = [];

    switch (errorType) {
      case "TIMEOUT":
      case "NETWORK_ERROR":
        options.push({
          label: "重试",
          action: async () => {
            console.log("User chose to retry");
          },
          recommended: true,
        });
        options.push({
          label: "稍后继续",
          action: async () => {
            if (sessionId) {
              await sessionManager.pauseSession(sessionId);
            }
          },
          recommended: false,
        });
        break;

      case "INVALID_INPUT":
        options.push({
          label: "修改输入",
          action: async () => {
            console.log("User chose to modify input");
          },
          recommended: true,
        });
        break;

      case "SERVICE_UNAVAILABLE":
        options.push({
          label: "等待后重试",
          action: async () => {
            await this.sleep(5000);
            console.log("Retrying after wait");
          },
          recommended: true,
        });
        break;

      default:
        options.push({
          label: "查看详情",
          action: async () => {
            console.log("User chose to view details");
          },
          recommended: false,
        });
        options.push({
          label: "联系支持",
          action: async () => {
            console.log("User chose to contact support");
          },
          recommended: false,
        });
    }

    return options;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Classify error type
   */
  private classifyError(error: any): ErrorType {
    const message = error.message?.toLowerCase() || "";

    if (message.includes("timeout") || message.includes("timed out")) {
      return "TIMEOUT";
    }

    if (
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("econnrefused") ||
      message.includes("fetch failed")
    ) {
      return "NETWORK_ERROR";
    }

    if (
      message.includes("service unavailable") ||
      message.includes("503") ||
      message.includes("temporarily unavailable")
    ) {
      return "SERVICE_UNAVAILABLE";
    }

    if (
      message.includes("invalid") ||
      message.includes("validation") ||
      message.includes("bad request") ||
      message.includes("400")
    ) {
      return "INVALID_INPUT";
    }

    if (
      message.includes("permission") ||
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("401") ||
      message.includes("403")
    ) {
      return "PERMISSION_DENIED";
    }

    if (message.includes("config") || message.includes("configuration")) {
      return "CONFIG_ERROR";
    }

    if (message.includes("parse") || message.includes("json")) {
      return "PARSE_ERROR";
    }

    return "UNKNOWN";
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(
    attempt: number,
    initialDelay: number,
    maxDelay: number,
    multiplier: number
  ): number {
    const delay = initialDelay * Math.pow(multiplier, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const errorRecoveryService = new ErrorRecoveryService();

// Export utility function for easy use
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  strategy?: RetryStrategy
): Promise<T> {
  const result = await errorRecoveryService.retryWithBackoff(fn, strategy);

  if (result.success && result.result !== undefined) {
    return result.result;
  }

  throw result.error || new Error("Retry failed");
}
