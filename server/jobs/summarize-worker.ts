import { Job } from 'bullmq';
import { createWorker, QUEUE_NAMES } from './queue';
import { summaryChainService } from '../summary-chain-service';

const worker = createWorker(QUEUE_NAMES.SUMMARY, async (job: Job) => {
    console.log(`[SummaryWorker] Processing job ${job.name} (${job.id})`);

    try {
        if (job.name === 'generate-summary') {
            const { chapterId } = job.data;
            const summary = await summaryChainService.generateChapterSummary(chapterId);
            return { success: true, summaryLength: summary.length };
        } else if (job.name === 'generate-volume-summary') {
            const { volumeId } = job.data;
            const summary = await summaryChainService.generateVolumeSummary(volumeId);
            return { success: true, summaryLength: summary.length };
        } else if (job.name === 'generate-project-summary') {
            const { projectId } = job.data;
            const summary = await summaryChainService.generateProjectSummary(projectId);
            return { success: true, summaryLength: summary.length };
        }

        throw new Error(`Unknown job name: ${job.name}`);
    } catch (error: any) {
        console.error(`[SummaryWorker] Failed job ${job.id}:`, error);
        throw error;
    }
});

worker.on('completed', (job) => {
    console.log(`[SummaryWorker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
    console.error(`[SummaryWorker] Job ${job?.id} failed with ${err.message}`);
});

export default worker;
