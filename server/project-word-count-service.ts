
import { db } from "./db";
import { projects, chapters, statistics } from "@shared/schema";
import { eq, sql, and } from "drizzle-orm";
import { storage } from "./storage";

export class ProjectWordCountService {
    /**
     * Recalculate and update the total word count for a project
     * This should be called whenever a chapter's word count changes
     */
    async recalculateProjectWordCount(projectId: string): Promise<number> {
        try {
            // 1. Calculate total word count from all chapters
            const result = await db
                .select({
                    totalWords: sql<number>`sum(${chapters.wordCount})`
                })
                .from(chapters)
                .where(eq(chapters.projectId, projectId));

            const totalWords = Number(result[0]?.totalWords || 0);

            // 2. Update project record
            await db
                .update(projects)
                .set({
                    currentWordCount: totalWords,
                    updatedAt: new Date()
                })
                .where(eq(projects.id, projectId));

            console.log(`[WordCount] Updated project ${projectId} word count to ${totalWords}`);
            return totalWords;
        } catch (error) {
            console.error(`[WordCount] Failed to recalculate for project ${projectId}:`, error);
            throw error;
        }
    }

    /**
     * Initialize word count for a new project (usually 0, but good to be explicit)
     */
    async initProjectWordCount(projectId: string): Promise<void> {
        await db
            .update(projects)
            .set({ currentWordCount: 0 })
            .where(eq(projects.id, projectId));
    }
}

export const projectWordCountService = new ProjectWordCountService();
