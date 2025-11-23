import { createWorker, QUEUE_NAMES } from './queue';
import { db } from '../db';
import { chapters, summaries } from '@shared/schema';
import { aiService } from '../ai-service';
import { eq } from 'drizzle-orm';
import { Job } from 'bullmq';

const worker = createWorker(QUEUE_NAMES.VECTORIZE, async (job: Job) => {
    console.log(`[VectorizeWorker] Processing job ${job.id} type=${job.data.type} id=${job.data.id}`);

    try {
        const { type, id } = job.data;
        let content = '';

        if (type === 'chapter') {
            const chapter = await db.query.chapters.findFirst({
                where: eq(chapters.id, id),
            });
            if (!chapter || !chapter.content) {
                console.log(`[VectorizeWorker] Chapter ${id} not found or empty`);
                return;
            }
            content = chapter.content;
        } else if (type === 'summary') {
            const summary = await db.query.summaries.findFirst({
                where: eq(summaries.id, id),
            });
            if (!summary || !summary.content) {
                console.log(`[VectorizeWorker] Summary ${id} not found or empty`);
                return;
            }
            content = summary.content;
        } else {
            throw new Error(`Unknown vectorization target type: ${type}`);
        }

        // Generate embedding
        const embedding = await aiService.getEmbedding(content);
        if (!embedding) {
            throw new Error('Failed to generate embedding');
        }

        // Save embedding
        if (type === 'chapter') {
            await db.update(chapters)
                .set({ contentVector: embedding })
                .where(eq(chapters.id, id));
        } else if (type === 'summary') {
            await db.update(summaries)
                .set({ contentVector: embedding })
                .where(eq(summaries.id, id));
        }

        console.log(`[VectorizeWorker] Completed job ${job.id}`);
        return { success: true };
    } catch (error: any) {
        console.error(`[VectorizeWorker] Failed job ${job.id}:`, error);
        throw error;
    }
});

export default worker;
