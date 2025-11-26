import { EventEmitter } from 'events';

// Queue names
export const QUEUE_NAMES = {
    SUMMARY: 'summary-generation',
    VECTORIZE: 'content-vectorization',
    RAG_INDEX: 'rag-indexing',
};

// Mock Job Interface
interface Job {
    id: string;
    name: string;
    data: any;
    opts?: any;
    timestamp: number;
    updateProgress: (progress: number | object) => Promise<void>;
    log: (row: string) => Promise<void>;
}

// Interface for our Queue
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
            updateProgress: async () => { },
            log: async () => { },
        } as Job;

        // Emit event for worker to pick up
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

const summaryQueue = new MockQueue(QUEUE_NAMES.SUMMARY);
const vectorizeQueue = new MockQueue(QUEUE_NAMES.VECTORIZE);

console.log('[Queue] Queues initialized (In-Memory Mode)');

export { summaryQueue, vectorizeQueue };

// Worker factory
export const createWorker = (queueName: string, processor: any) => {
    console.log(`[Queue] Creating Worker for ${queueName}`);

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
            console.log(`[Worker] Processing ${job.name} in ${queueName}`);
            await processor(job);
            console.log(`[Worker] Completed ${job.name}`);
        } catch (err) {
            console.error(`[Worker] Failed ${job.name}:`, err);
        }
    });

    return mockWorker;
};
