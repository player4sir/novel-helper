import { db } from "./db";
import { autoCreationJobs, chapters, outlines, projects } from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { contentGenerationService } from "./content-generation-service";


interface AutoCreationConfig {
    batchSize: number;
    qualityThreshold: number;
    maxErrors: number;
    styleProfileId?: string;
}

export class AutoCreationService {
    private activeJobs: Map<string, NodeJS.Timeout> = new Map();

    async startJob(projectId: string, config: AutoCreationConfig) {
        // Check if there's already an active job
        const [existingJob] = await db
            .select()
            .from(autoCreationJobs)
            .where(and(eq(autoCreationJobs.projectId, projectId), eq(autoCreationJobs.status, "active")))
            .limit(1);

        if (existingJob) {
            return existingJob;
        }

        // Create new job
        const [job] = await db
            .insert(autoCreationJobs)
            .values({
                projectId,
                status: "active",
                config,
                stats: { chaptersGenerated: 0, errors: 0 },
            })
            .returning();

        // Start processing
        this.scheduleNext(job.id, projectId);

        return job;
    }

    async pauseJob(projectId: string) {
        const [job] = await db
            .update(autoCreationJobs)
            .set({ status: "paused" })
            .where(and(eq(autoCreationJobs.projectId, projectId), eq(autoCreationJobs.status, "active")))
            .returning();

        if (job) {
            const timeout = this.activeJobs.get(job.id);
            if (timeout) {
                clearTimeout(timeout);
                this.activeJobs.delete(job.id);
            }
        }

        return job;
    }

    async getJobStatus(projectId: string) {
        const [job] = await db
            .select()
            .from(autoCreationJobs)
            .where(eq(autoCreationJobs.projectId, projectId))
            .orderBy(asc(autoCreationJobs.createdAt)) // Get latest? Actually we might want desc
            .limit(1);

        // Better to get the latest one
        const allJobs = await db
            .select()
            .from(autoCreationJobs)
            .where(eq(autoCreationJobs.projectId, projectId));

        return allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    }

    private scheduleNext(jobId: string, projectId: string) {
        const timeout = setTimeout(() => this.processNextChapter(jobId, projectId), 1000);
        this.activeJobs.set(jobId, timeout);
    }

    private async processNextChapter(jobId: string, projectId: string) {
        try {
            // 1. Fetch job state
            const [job] = await db
                .select()
                .from(autoCreationJobs)
                .where(eq(autoCreationJobs.id, jobId))
                .limit(1);

            if (!job || job.status !== "active") {
                this.activeJobs.delete(jobId);
                return;
            }

            const config = job.config as AutoCreationConfig;
            const stats = job.stats as { chaptersGenerated: number; errors: number };

            // 2. Check limits
            if (stats.chaptersGenerated >= config.batchSize) {
                await this.completeJob(jobId, "completed");
                return;
            }

            if (stats.errors >= config.maxErrors) {
                await this.completeJob(jobId, "error");
                return;
            }

            // 3. Find next chapter
            const allChapters = await db
                .select()
                .from(chapters)
                .where(eq(chapters.projectId, projectId))
                .orderBy(asc(chapters.orderIndex));

            const nextChapter = allChapters.find((c) => c.status === "draft" && (!c.content || c.content.length < 100));

            if (!nextChapter) {
                // No more draft chapters
                await this.completeJob(jobId, "completed");
                return;
            }

            // 5. Update stats
            const newStats = {
                ...stats,
                chaptersGenerated: stats.chaptersGenerated + 1,
            };

            // Update job status
            await db
                .update(autoCreationJobs)
                .set({ stats: newStats, currentChapterId: nextChapter.id })
                .where(eq(autoCreationJobs.id, jobId));

            // 4. Generate Content
            const generator = contentGenerationService.generateChapterStream(projectId, nextChapter.id, config.styleProfileId);

            try {
                for await (const event of generator) {
                    // Update progress
                    if (event.type === 'progress') {
                        // Optional: update job progress if we had a field for it
                    }
                }
            } catch (error: any) {
                console.error("Auto creation error:", error);

                // Update error stats
                const [currentJob] = await db
                    .select()
                    .from(autoCreationJobs)
                    .where(eq(autoCreationJobs.id, jobId))
                    .limit(1);

                if (currentJob) {
                    const currentStats = currentJob.stats as { chaptersGenerated: number; errors: number };
                    await db
                        .update(autoCreationJobs)
                        .set({
                            stats: { ...currentStats, errors: currentStats.errors + 1 },
                            lastError: error.message,
                        })
                        .where(eq(autoCreationJobs.id, jobId));
                }
            }

            // 6. Schedule next
            this.scheduleNext(jobId, projectId);

        } catch (error) {
            console.error("Fatal auto creation error:", error);
            await this.completeJob(jobId, "error");
        }
    }

    private async completeJob(jobId: string, status: "completed" | "error") {
        await db
            .update(autoCreationJobs)
            .set({ status })
            .where(eq(autoCreationJobs.id, jobId));
        this.activeJobs.delete(jobId);
    }
}

export const autoCreationService = new AutoCreationService();
