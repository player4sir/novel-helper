// Session Cleanup Job
// Periodically cleans up expired sessions

import { sessionManager } from "../session-manager";

/**
 * Clean up expired sessions
 * Should be run periodically (e.g., daily)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  console.log("[Session Cleanup] Starting cleanup of expired sessions...");

  try {
    const deletedCount = await sessionManager.cleanupExpiredSessions();
    console.log(`[Session Cleanup] Cleaned up ${deletedCount} expired sessions`);
  } catch (error) {
    console.error("[Session Cleanup] Error during cleanup:", error);
    throw error;
  }
}

/**
 * Start periodic session cleanup
 * Runs every 24 hours
 */
export function startSessionCleanupJob(): NodeJS.Timeout {
  console.log("[Session Cleanup] Starting periodic cleanup job (runs every 24 hours)");

  // Run immediately on start
  cleanupExpiredSessions().catch((error) => {
    console.error("[Session Cleanup] Initial cleanup failed:", error);
  });

  // Then run every 24 hours
  const interval = setInterval(() => {
    cleanupExpiredSessions().catch((error) => {
      console.error("[Session Cleanup] Scheduled cleanup failed:", error);
    });
  }, 24 * 60 * 60 * 1000); // 24 hours

  return interval;
}

/**
 * Stop periodic session cleanup
 */
export function stopSessionCleanupJob(interval: NodeJS.Timeout): void {
  console.log("[Session Cleanup] Stopping periodic cleanup job");
  clearInterval(interval);
}
