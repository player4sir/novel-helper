import { db } from "./db";
import { summaries, chapters, volumes, projects } from "@shared/schema";
import { aiService } from "./ai-service";
import { eq, and, desc } from "drizzle-orm";
import { summaryQueue, vectorizeQueue } from "./jobs/queue";

export class SummaryChainService {

    /**
     * Generate a summary for a specific chapter
     */
    async generateChapterSummary(chapterId: string): Promise<string> {
        const chapter = await db.query.chapters.findFirst({
            where: eq(chapters.id, chapterId),
        });

        if (!chapter || !chapter.content) {
            throw new Error("Chapter not found or empty");
        }

        // Generate summary using AI
        const prompt = `
    请为以下小说章节生成一个精炼的摘要（200字以内）。
    
    章节标题：${chapter.title}
    章节内容：
    ${chapter.content.slice(0, 5000)}... (截断)
    
    要求：
    1. 概括核心情节
    2. 提及关键人物的行动
    3. 标记重要的伏笔或转折
    `;

        const summaryText = await aiService.generateSimple(prompt);

        // Save to database
        await this.saveSummary({
            projectId: chapter.projectId,
            targetId: chapterId,
            targetType: 'chapter',
            content: summaryText,
            level: 0
        });

        return summaryText;
    }

    /**
     * Save or update a summary record
     */
    private async saveSummary(params: {
        projectId: string;
        targetId: string;
        targetType: 'chapter' | 'volume' | 'project';
        content: string;
        level: number;
    }) {
        let summaryId: string;
        const existing = await db.query.summaries.findFirst({
            where: and(
                eq(summaries.targetId, params.targetId),
                eq(summaries.targetType, params.targetType)
            ),
        });

        if (existing) {
            await db.update(summaries)
                .set({
                    content: params.content,
                    version: existing.version + 1,
                    updatedAt: new Date(),
                    isStale: false,
                })
                .where(eq(summaries.id, existing.id));
            summaryId = existing.id;
        } else {
            const [inserted] = await db.insert(summaries).values({
                projectId: params.projectId,
                targetId: params.targetId,
                targetType: params.targetType,
                level: params.level,
                content: params.content,
                version: 1,
            }).returning();
            summaryId = inserted.id;
        }

        // Trigger vectorization
        try {
            await vectorizeQueue.add('vectorize-summary', {
                type: 'summary',
                id: summaryId
            });
            console.log(`[SummaryChain] Enqueued vectorization for summary ${summaryId}`);
        } catch (error) {
            console.error(`[SummaryChain] Failed to enqueue vectorization:`, error);
        }

        // Trigger next level update
        if (params.targetType === 'chapter') {
            const chapter = await db.query.chapters.findFirst({
                where: eq(chapters.id, params.targetId),
                columns: { volumeId: true }
            });
            if (chapter?.volumeId) {
                await summaryQueue.add('generate-volume-summary', { volumeId: chapter.volumeId });
                console.log(`[SummaryChain] Triggered volume summary update for ${chapter.volumeId}`);
            }
        } else if (params.targetType === 'volume') {
            const volume = await db.query.volumes.findFirst({
                where: eq(volumes.id, params.targetId),
                columns: { projectId: true }
            });
            if (volume?.projectId) {
                await summaryQueue.add('generate-project-summary', { projectId: volume.projectId });
                console.log(`[SummaryChain] Triggered project summary update for ${volume.projectId}`);
            }
        }
    }

    /**
     * Retrieve the summary chain for a chapter (Chapter -> Volume -> Project)
     */
    async getSummaryChain(chapterId: string) {
        const chapter = await db.query.chapters.findFirst({
            where: eq(chapters.id, chapterId),
            with: {
                volume: true,
                project: true
            }
        });

        if (!chapter) return null;

        const chain = {
            chapter: await this.getSummary(chapterId, 'chapter'),
            volume: chapter.volumeId ? await this.getSummary(chapter.volumeId, 'volume') : null,
            project: await this.getSummary(chapter.projectId, 'project'),
        };

        return chain;
    }

    private async getSummary(targetId: string, type: 'chapter' | 'volume' | 'project') {
        return db.query.summaries.findFirst({
            where: and(
                eq(summaries.targetId, targetId),
                eq(summaries.targetType, type)
            ),
            orderBy: [desc(summaries.version)]
        });
    }

    /**
     * Recursively update summary chain
     */
    /**
     * Generate a summary for a specific volume
     */
    async generateVolumeSummary(volumeId: string): Promise<string> {
        const volume = await db.query.volumes.findFirst({
            where: eq(volumes.id, volumeId),
        });
        if (!volume) throw new Error("Volume not found");

        // Get all chapters
        const volumeChapters = await db.query.chapters.findMany({
            where: eq(chapters.volumeId, volumeId),
            orderBy: [chapters.orderIndex]
        });

        // Get summaries for chapters
        const chapterSummaries = await Promise.all(volumeChapters.map(async c => {
            const s = await this.getSummary(c.id, 'chapter');
            return s ? `章节：${c.title}\n摘要：${s.content}` : null;
        }));

        const validSummaries = chapterSummaries.filter(s => s !== null).join("\n\n");

        if (!validSummaries) return "";

        const prompt = `
请根据以下章节摘要，生成本卷的总体摘要（300-500字）。

卷名：${volume.title}
章节摘要：
${validSummaries}

要求：
1. 梳理本卷的主要故事线
2. 总结角色的成长与变化
3. 提炼核心冲突的解决或升级
`;
        const summaryText = await aiService.generateSimple(prompt);

        await this.saveSummary({
            projectId: volume.projectId,
            targetId: volumeId,
            targetType: 'volume',
            content: summaryText,
            level: 1
        });

        return summaryText;
    }

    /**
     * Generate a summary for the entire project
     */
    async generateProjectSummary(projectId: string): Promise<string> {
        const project = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
        });
        if (!project) throw new Error("Project not found");

        // Get all volumes
        const projectVolumes = await db.query.volumes.findMany({
            where: eq(volumes.projectId, projectId),
            orderBy: [volumes.orderIndex]
        });

        // Get summaries for volumes
        const volumeSummaries = await Promise.all(projectVolumes.map(async v => {
            const s = await this.getSummary(v.id, 'volume');
            return s ? `卷：${v.title}\n摘要：${s.content}` : null;
        }));

        const validSummaries = volumeSummaries.filter(s => s !== null).join("\n\n");

        if (!validSummaries) return "";

        const prompt = `
请根据以下各卷摘要，生成全书的总体摘要（500-800字）。

书名：${project.title}
各卷摘要：
${validSummaries}

要求：
1. 宏观概括全书故事走向
2. 分析世界观的展开
3. 总结核心主题的表达
`;
        const summaryText = await aiService.generateSimple(prompt);

        await this.saveSummary({
            projectId: projectId,
            targetId: projectId,
            targetType: 'project',
            content: summaryText,
            level: 2
        });

        return summaryText;
    }
}

export const summaryChainService = new SummaryChainService();
