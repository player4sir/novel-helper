import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { EventEmitter } from 'events';

// Configuration
const USE_REDIS = process.env.USE_REDIS === 'true';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Queue names
export const QUEUE_NAMES = {
    SUMMARY: 'summary-generation',
    VECTORIZE: 'content-vectorization',
    RAG_INDEX: 'rag-indexing',
};

// Interface for our Queue (compatible with BullMQ Queue)
interface IQueue {
    add(name: string, data: any, opts?: any): Promise<Job>;
    close(): Promise<void>;
}

// Mock Queue for in-memory mode
class MockQueue extends EventEmitter implements IQueue {
    name: string;

    constructor(name: string) {
        super();
        this.name = name;
    }

    async add(name: string, data: any, opts?: any): Promise<Job> {
        const job = {
            id: Math.random().toString(36).substring(7),
            name,
            data,
            opts,
            timestamp: Date.now(),
            // Mock methods needed by Job
            updateProgress: async () => { },
            log: async () => { },
        } as unknown as Job;

        // Emit event for worker to pick up
        // Use setImmediate to simulate async and allow event loop to turn
        setImmediate(() => {
            mockJobEmitter.emit(this.name, job);
        });
        return job;
    }

    async close(): Promise<void> {
        // No-op for mock
    }
}

// Global emitter for mock jobs
const mockJobEmitter = new EventEmitter();

let connection: IORedis | null = null;
let summaryQueue: Queue | MockQueue;
let vectorizeQueue: Queue | MockQueue;

if (USE_REDIS) {
    // Redis Mode
    const redisConfig = {
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
    };

    try {
        connection = new IORedis(redisConfig);

        connection.on('error', (err) => {
            console.error('[BullMQ] Redis connection error:', err.message);
        });

        connection.on('connect', () => {
            console.log('[BullMQ] Redis connected');
        });

        summaryQueue = new Queue(QUEUE_NAMES.SUMMARY, { connection });
        vectorizeQueue = new Queue(QUEUE_NAMES.VECTORIZE, { connection });

        console.log('[BullMQ] Queues initialized (Redis Mode)');
    } catch (error) {
        console.error('[BullMQ] Failed to initialize Redis connection:', error);
        // Fallback to memory would happen here if we wanted automatic fallback, 
        // but explicit configuration is better.
        throw error;
    }
} else {
    // In-Memory Mode
    summaryQueue = new MockQueue(QUEUE_NAMES.SUMMARY);
    vectorizeQueue = new MockQueue(QUEUE_NAMES.VECTORIZE);
    console.log('[BullMQ] Queues initialized (In-Memory Mode)');
}

export { summaryQueue, vectorizeQueue, connection };

// Worker factory
export const createWorker = (queueName: string, processor: any) => {
    if (!USE_REDIS) {
        console.log(`[BullMQ] Creating MockWorker for ${queueName}`);

        // Return a mock worker that listens to the emitter
        const mockWorker = {
            on: (event: string, cb: Function) => {
                // We can implement simple event handling if needed
            },
            close: async () => {
                mockJobEmitter.removeAllListeners(queueName);
            }
        };

        // Set up the listener
        mockJobEmitter.on(queueName, async (job) => {
            try {
                console.log(`[MockWorker] Processing ${job.name} in ${queueName}`);
                await processor(job);
                console.log(`[MockWorker] Completed ${job.name}`);
            } catch (err) {
                console.error(`[MockWorker] Failed ${job.name}:`, err);
            }
        });

        return mockWorker as unknown as Worker;
    }

    // Redis Mode Worker
    return new Worker(queueName, processor, {
        connection: connection!,
        concurrency: 5,
        limiter: {
            max: 10,
            duration: 1000,
        },
    });
};
