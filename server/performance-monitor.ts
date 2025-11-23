// Performance statistics
export interface PerformanceStats {
  count: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
}

// Timing thresholds (in milliseconds)
interface TimingThresholds {
  context_build: number;
  prompt_assembly: number;
  ai_generation: number;
  validation: number;
  database_save: number;
  [key: string]: number;
}

/**
 * PerformanceMonitor - Timing instrumentation for performance tracking
 * 
 * Implements comprehensive timing metrics from the design document:
 * - Log timing for: context build, prompt assembly, AI call, rule check, database save
 * - Track cumulative time for each operation type across all scenes
 * - Identify operations taking >5% of total time
 * - Alert when any operation exceeds expected time
 */
export class PerformanceMonitor {
  private timings: Map<string, number[]> = new Map();
  private thresholds: TimingThresholds = {
    context_build: 5000,      // 5s
    prompt_assembly: 3000,    // 3s
    ai_generation: 100000,    // 100s
    validation: 2000,         // 2s
    database_save: 3000,      // 3s
  };

  /**
   * Start timer for an operation
   * Returns a stop function that records the duration
   * @param operation - Operation name
   * @returns Stop function
   */
  startTimer(operation: string): () => void {
    const start = Date.now();

    return () => {
      const duration = Date.now() - start;
      this.recordTiming(operation, duration);

      // Alert on slow operations
      if (this.isSlowOperation(operation, duration)) {
        console.warn(`[Performance] Slow operation: ${operation} took ${duration}ms (threshold: ${this.thresholds[operation] || 5000}ms)`);
      }
    };
  }

  /**
   * Record timing for an operation
   * @param operation - Operation name
   * @param duration - Duration in milliseconds
   */
  private recordTiming(operation: string, duration: number): void {
    if (!this.timings.has(operation)) {
      this.timings.set(operation, []);
    }
    this.timings.get(operation)!.push(duration);
  }

  /**
   * Check if operation is slow
   * @param operation - Operation name
   * @param duration - Duration in milliseconds
   * @returns boolean
   */
  private isSlowOperation(operation: string, duration: number): boolean {
    const threshold = this.thresholds[operation] || 5000;
    return duration > threshold;
  }

  /**
   * Get statistics for an operation
   * @param operation - Operation name
   * @returns PerformanceStats
   */
  getStats(operation: string): PerformanceStats {
    const timings = this.timings.get(operation) || [];

    if (timings.length === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...timings].sort((a, b) => a - b);

    return {
      count: timings.length,
      avg: this.average(timings),
      min: Math.min(...timings),
      max: Math.max(...timings),
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  /**
   * Get all statistics
   * @returns Map of operation names to stats
   */
  getAllStats(): Map<string, PerformanceStats> {
    const allStats = new Map<string, PerformanceStats>();

    for (const operation of Array.from(this.timings.keys())) {
      allStats.set(operation, this.getStats(operation));
    }

    return allStats;
  }

  /**
   * Get cumulative time for each operation type
   * @returns Map of operation names to total time
   */
  getCumulativeTime(): Map<string, number> {
    const cumulative = new Map<string, number>();

    for (const [operation, timings] of Array.from(this.timings.entries())) {
      const total = timings.reduce((sum: number, time: number) => sum + time, 0);
      cumulative.set(operation, total);
    }

    return cumulative;
  }

  /**
   * Identify operations taking >5% of total time
   * @returns Array of operation names
   */
  getSlowOperations(): string[] {
    const cumulative = this.getCumulativeTime();
    const totalTime = Array.from(cumulative.values()).reduce((sum: number, time: number) => sum + time, 0);

    if (totalTime === 0) {
      return [];
    }

    const slowOps: string[] = [];

    for (const [operation, time] of Array.from(cumulative.entries())) {
      const percentage = (time / totalTime) * 100;
      if (percentage > 5) {
        slowOps.push(`${operation} (${percentage.toFixed(1)}%)`);
      }
    }

    return slowOps;
  }

  /**
   * Set custom threshold for an operation
   * @param operation - Operation name
   * @param threshold - Threshold in milliseconds
   */
  setThreshold(operation: string, threshold: number): void {
    this.thresholds[operation] = threshold;
  }

  /**
   * Reset all timings
   */
  reset(): void {
    this.timings.clear();
  }

  /**
   * Calculate average
   * @param values - Array of numbers
   * @returns Average value
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentile
   * @param sortedValues - Sorted array of numbers
   * @param percentile - Percentile (0-100)
   * @returns Percentile value
   */
  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Generate performance report
   * @returns String report
   */
  generateReport(): string {
    const lines: string[] = [];
    lines.push('=== Performance Report ===');
    lines.push('');

    const allStats = this.getAllStats();
    const cumulative = this.getCumulativeTime();
    const totalTime = Array.from(cumulative.values()).reduce((sum: number, time: number) => sum + time, 0);

    for (const [operation, stats] of Array.from(allStats.entries())) {
      const total = cumulative.get(operation) || 0;
      const percentage = totalTime > 0 ? ((total / totalTime) * 100).toFixed(1) : '0.0';

      lines.push(`${operation}:`);
      lines.push(`  Count: ${stats.count}`);
      lines.push(`  Avg: ${stats.avg.toFixed(0)}ms`);
      lines.push(`  Min: ${stats.min}ms, Max: ${stats.max}ms`);
      lines.push(`  P50: ${stats.p50}ms, P95: ${stats.p95}ms, P99: ${stats.p99}ms`);
      lines.push(`  Total: ${total}ms (${percentage}% of total time)`);
      lines.push('');
    }

    lines.push(`Total Time: ${totalTime}ms`);
    lines.push('');

    const slowOps = this.getSlowOperations();
    if (slowOps.length > 0) {
      lines.push('Operations taking >5% of total time:');
      slowOps.forEach(op => lines.push(`  - ${op}`));
    }

    return lines.join('\n');
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();
