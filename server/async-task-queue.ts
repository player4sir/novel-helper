// Async task types
export type AsyncTaskType = 'entity_tracking' | 'generation_log' | 'cache_update' | 'vectorize_chapter';

// Task priority levels
export type TaskPriority = 'low' | 'medium' | 'high';

// Async task interface
export interface AsyncTask {
  type: AsyncTaskType;
  data: any;
  priority: TaskPriority;
}

/**
 * AsyncTaskQueue - Background task queue for non-blocking operations
 */
export class AsyncTaskQueue {
  private queue: AsyncTask[] = [];
  private processing: boolean = false;
  private maxRetries: number = 3;

  /**
   * Add task to queue (non-blocking)
   */
  enqueue(task: AsyncTask): void {
    this.queue.push(task);
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process queue in background
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      this.queue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      const task = this.queue.shift()!;
      try {
        await this.executeTask(task);
      } catch (error) {
        console.error(`[Async Task] Failed: ${task.type}`, error);
        if (task.priority === 'high') {
          this.retryTask(task);
        }
      }
    }
    this.processing = false;
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: AsyncTask): Promise<void> {
    const startTime = Date.now();
    switch (task.type) {
      case 'entity_tracking':
        await this.updateEntityTracking(task.data);
        break;
      case 'generation_log':
        await this.writeGenerationLog(task.data);
        break;
      case 'cache_update':
        await this.updateCache(task.data);
        break;
      case 'vectorize_chapter':
        await this.vectorizeChapter(task.data);
        break;
      default:
        console.warn(`[Async Task] Unknown task type: ${task.type}`);
    }
    const duration = Date.now() - startTime;
    console.log(`[Async Task] Completed ${task.type} in ${duration}ms`);
  }

  private retryTask(task: AsyncTask, attempt: number = 1): void {
    if (attempt >= this.maxRetries) {
      console.error(`[Async Task] Max retries reached for ${task.type}`);
      return;
    }
    const delay = 1000 * Math.pow(2, attempt);
    console.log(`[Async Task] Retrying ${task.type} in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
    setTimeout(() => {
      this.enqueue(task);
    }, delay);
  }

  private async updateEntityTracking(data: any): Promise<void> {
    console.log('[Async Task] Entity tracking update:', {
      projectId: data.projectId,
      sceneId: data.sceneFrame?.id,
      mentions: data.mentions?.length || 0,
    });
  }

  private async writeGenerationLog(data: any): Promise<void> {
    console.log('[Async Task] Generation log write:', {
      executionId: data.executionId,
      templateId: data.templateId,
      tokensUsed: data.tokensUsed,
    });
  }

  private async updateCache(data: any): Promise<void> {
    console.log('[Async Task] Cache update:', {
      signature: data.signature?.substring(0, 8) + '...',
      templateId: data.templateId,
    });
  }

  private async vectorizeChapter(data: any): Promise<void> {
    console.log('[Async Task] Vectorizing chapter:', data.chapterId);
    try {
      const { vectorizeQueue } = await import("./jobs/queue");
      await vectorizeQueue.add("vectorize-chapter", {
        type: 'chapter',
        id: data.chapterId,
        projectId: data.projectId
      });
    } catch (error) {
      console.error("[Async Task] Failed to add to vectorize queue:", error);
    }
  }

  getStatus(): { queueLength: number; processing: boolean } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    };
  }

  clear(): void {
    this.queue = [];
  }
}

export const asyncTaskQueue = new AsyncTaskQueue();
