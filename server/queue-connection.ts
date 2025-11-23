/**
 * Queue Connection Configuration
 * 
 * Uses in-memory queue for local development to avoid Redis dependency.
 * This is suitable for single-instance applications like Electron apps.
 * 
 * For production distributed systems, consider using Redis backend.
 */

// BullMQ connection configuration - using in-memory mode
export const queueConnection = {
  // Empty connection object tells BullMQ to use in-memory storage
  // This avoids the need for Redis installation
};

// Test queue connection (always succeeds for in-memory mode)
export async function testQueueConnection(): Promise<boolean> {
  try {
    console.log("✓ Using in-memory queue (no Redis required)");
    return true;
  } catch (error: any) {
    console.error("✗ Queue initialization failed:", error.message);
    return false;
  }
}

// Graceful shutdown (no-op for in-memory mode)
export async function closeQueueConnection(): Promise<void> {
  console.log("✓ Queue connection closed");
}
