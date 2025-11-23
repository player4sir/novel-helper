import { storage } from "./storage";
import { sceneDraftServiceOptimized as sceneDraftService } from "./scene-draft-service-optimized";
import { contextSelectionService } from "./context-selection-service";
import { asyncTaskQueue } from "./async-task-queue";
import { modelRoutingService } from "./model-routing-service";
import { worldSettingSelectionService } from "./world-setting-selection-service";
import { type Chapter, type SceneFrame, styleProfiles } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface GenerationEvent {
    type: "connected" | "progress" | "scenes_decomposed" | "scene_start" | "scene_content_chunk" | "scene_completed" | "scene_failed" | "completed" | "error";
    data?: any;
    error?: string;
}

export interface GenerationStats {
    scenes: number;
    drafts: number;
    ruleChecksPassed: number;
    totalWarnings: number;
}

export class ContentGenerationService {
    /**
     * Generate chapter content stream
     * Decomposes chapter into scenes and generates content for each scene
     */
    async *generateChapterStream(
        projectId: string,
        chapterId: string,
        styleProfileId?: string
    ): AsyncGenerator<GenerationEvent, void, unknown> {
        try {
            // 1. Validation & Setup
            const models = await storage.getAIModels();
            const defaultChatModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);

            if (!defaultChatModel) {
                yield {
                    type: "error",
                    error: "未配置默认对话模型。请先在AI模型配置页面添加并设置默认的对话模型（Chat）。"
                };
                return;
            }

            const chapter = await storage.getChapter(chapterId);
            if (!chapter) {
                yield { type: "error", error: "Chapter not found" };
                return;
            }

            yield {
                type: "progress",
                data: { step: "decompose", message: "分解场景框架...", progress: 5 }
            };

            // 2. Decompose into scenes
            const scenes = await sceneDraftService.decomposeChapterIntoScenes(
                projectId,
                chapterId
            );

            yield {
                type: "scenes_decomposed",
                data: {
                    totalScenes: scenes.length,
                    scenes: scenes.map(s => ({
                        id: s.id,
                        index: s.index,
                        purpose: s.purpose,
                        focalEntities: s.focalEntities
                    })),
                    progress: 10
                }
            };

            // 3. Gather Context
            const contextData = await this.gatherContext(projectId, chapterId);
            const { characters, worldSettings, outlines, mainOutline, project } = contextData;

            const chapterOutline = outlines.find(
                (o) => o.type === "chapter" && o.linkedChapterId === chapterId
            );
            const chapterPlotNodes = (chapterOutline?.plotNodes as any) || {};

            // Fetch style profile if provided
            let styleProfile = null;
            if (styleProfileId) {
                const [profile] = await db.select().from(styleProfiles).where(eq(styleProfiles.id, styleProfileId));
                styleProfile = profile;
            }

            // 4. Generate Scenes
            let generatedContent = "";
            let successfulScenes = 0;
            let ruleChecksPassed = 0;
            let totalWarnings = 0;

            // Clear component cache for this chapter before starting
            sceneDraftService.clearChapterCache(chapterId);

            for (let i = 0; i < scenes.length; i++) {
                const scene = scenes[i];
                const progressBase = 10 + Math.floor((i / scenes.length) * 85);

                yield {
                    type: "scene_start",
                    data: {
                        sceneIndex: i,
                        totalScenes: scenes.length,
                        scenePurpose: scene.purpose,
                        progress: progressBase,
                        message: `正在生成第 ${i + 1}/${scenes.length} 个场景...`
                    }
                };

                try {
                    // Select relevant context chapters
                    const contextSelection = await contextSelectionService.selectRecentChaptersForAppend(
                        await storage.getChaptersByProject(projectId),
                        outlines,
                        scene.purpose
                    );

                    // Select relevant world settings
                    const worldSettingSelection = await worldSettingSelectionService.selectRelevantSettings(
                        worldSettings,
                        `${scene.purpose}\n${contextSelection.contextText}`,
                        { tokenBudget: 1500 }
                    );

                    // Get actual content of the previous chapter for Scene 0
                    let previousChapterContent = "";
                    if (i === 0) {
                        const allChapters = await storage.getChaptersByProject(projectId);
                        // Sort by orderIndex
                        const sortedChapters = allChapters.sort((a, b) => a.orderIndex - b.orderIndex);
                        const currentChapter = sortedChapters.find(c => c.id === chapterId);
                        if (currentChapter) {
                            const currentIndex = sortedChapters.indexOf(currentChapter);
                            if (currentIndex > 0) {
                                const prevChapter = sortedChapters[currentIndex - 1];
                                if (prevChapter.content) {
                                    previousChapterContent = prevChapter.content.slice(-1500); // Last 1500 chars
                                }
                            }
                        }
                    }

                    // Build draft context
                    const draftContext = {
                        previousContent: i === 0
                            ? previousChapterContent // Use actual text from previous chapter
                            : generatedContent.slice(-2000), // Use recently generated content
                        storyContext: contextSelection.contextText, // Pass semantic context separately
                        characters: this.filterRelevantCharacters(characters, chapterOutline, scene),
                        worldSettings: worldSettingSelection.contextText,
                        sceneFrame: scene,
                        projectSummary: mainOutline ? {
                            coreConflicts: (mainOutline.plotNodes as any)?.coreConflicts?.join("、") || "",
                            themeTags: (mainOutline.plotNodes as any)?.themeTags?.join("、") || "",
                            toneProfile: (mainOutline.plotNodes as any)?.toneProfile || project?.style || "",
                        } : null,
                        chapterOutline: chapterOutline ? {
                            title: chapterOutline.title,
                            summary: (chapterOutline.plotNodes as any)?.oneLiner || "",
                            beats: (chapterOutline.plotNodes as any)?.beats || [],
                            requiredEntities: (chapterOutline.plotNodes as any)?.requiredEntities || [],
                            focalEntities: (chapterOutline.plotNodes as any)?.focalEntities || [],
                            stakesDelta: (chapterOutline.plotNodes as any)?.stakesDelta || "",
                            entryState: (chapterOutline.plotNodes as any)?.entryState || "",
                            exitState: (chapterOutline.plotNodes as any)?.exitState || "",
                        } : undefined,
                        currentScene: {
                            index: i,
                            total: scenes.length,
                            beat: scene.purpose,
                            previousBeat: i > 0 ? scenes[i - 1].purpose : null,
                            nextBeat: i < scenes.length - 1 ? scenes[i + 1].purpose : null,
                        },
                        styleProfile: styleProfile ? {
                            name: styleProfile.name,
                            traits: styleProfile.traits
                        } : undefined
                    };

                    // Generate draft
                    // Generate draft (Streamed)
                    const stream = sceneDraftService.generateSceneDraftStream(
                        projectId,
                        scene,
                        draftContext
                    );

                    let result: any = null;
                    let sceneContent = "";

                    for await (const chunk of stream) {
                        if (typeof chunk === 'string') {
                            sceneContent += chunk;
                            yield {
                                type: "scene_content_chunk",
                                data: {
                                    sceneIndex: i,
                                    chunk: chunk,
                                    currentLength: sceneContent.length
                                }
                            };
                        } else {
                            result = chunk;
                        }
                    }

                    if (!result) {
                        throw new Error("Failed to get generation result");
                    }

                    generatedContent += result.draft.content + "\n\n";
                    successfulScenes++;
                    if (result.basicCheck.passed) ruleChecksPassed++;
                    totalWarnings += (result.basicCheck.warnings?.length || 0);

                    yield {
                        type: "scene_completed",
                        data: {
                            sceneIndex: i,
                            draftId: result.draft.id,
                            wordCount: result.draft.wordCount,
                            progress: 10 + Math.floor(((i + 1) / scenes.length) * 85)
                        }
                    };

                } catch (error: any) {
                    console.error(`Scene ${i} generation failed:`, error);
                    yield {
                        type: "scene_failed",
                        data: {
                            sceneIndex: i,
                            error: error.message,
                            progress: progressBase
                        }
                    };
                    // Continue to next scene even if one fails
                }
            }

            // 5. Finalize
            // Update chapter content
            if (generatedContent) {
                await storage.updateChapter(chapterId, {
                    content: generatedContent,
                    wordCount: generatedContent.length,
                    status: "draft"
                });

                // Trigger async tasks
                asyncTaskQueue.enqueue({
                    type: "vectorize_chapter",
                    data: { chapterId, projectId },
                    priority: "medium"
                });
            }

            yield {
                type: "completed",
                data: {
                    success: true,
                    projectId,
                    chapterId,
                    totalScenes: scenes.length,
                    successfulScenes,
                    wordCount: generatedContent.length,
                    ruleChecksPassed,
                    totalWarnings
                }
            };

        } catch (error: any) {
            console.error("Chapter generation error:", error);
            yield { type: "error", error: error.message || "生成失败" };
        }
    }

    /**
     * Helper to gather all necessary context data
     */
    private async gatherContext(projectId: string, chapterId: string) {
        const [characters, worldSettings, outlines, project] = await Promise.all([
            storage.getCharactersByProject(projectId),
            storage.getWorldSettingsByProject(projectId),
            storage.getOutlinesByProject(projectId),
            storage.getProject(projectId)
        ]);

        const mainOutline = outlines.find((o) => o.type === "main");

        return {
            characters,
            worldSettings,
            outlines,
            mainOutline,
            project
        };
    }
    /**
     * Filter characters to include only those relevant for the current context
     */
    private filterRelevantCharacters(
        allCharacters: any[],
        chapterOutline: any,
        sceneFrame: any
    ): any[] {
        if (!allCharacters || allCharacters.length === 0) return [];

        const MAX_CHARACTERS = 7;
        const selectedIds = new Set<string>();
        const selectedCharacters: any[] = [];

        // Helper to add character if not already added
        const addCharacter = (char: any, reason: string) => {
            if (!char || selectedIds.has(char.id)) return;
            selectedIds.add(char.id);
            selectedCharacters.push({ ...char, _selectionReason: reason });
        };

        // 1. Add characters from scene focal entities (Highest priority)
        if (sceneFrame.focalEntities && sceneFrame.focalEntities.length > 0) {
            for (const name of sceneFrame.focalEntities) {
                const char = allCharacters.find(c => c.name === name);
                if (char) addCharacter(char, "scene_focal");
            }
        }

        // 2. Add characters from chapter required entities
        if (chapterOutline?.plotNodes?.requiredEntities) {
            for (const name of chapterOutline.plotNodes.requiredEntities) {
                const char = allCharacters.find(c => c.name === name);
                if (char) addCharacter(char, "chapter_required");
            }
        }

        // 3. Add protagonist(s) if not already included and we have space
        if (selectedCharacters.length < MAX_CHARACTERS) {
            const protagonists = allCharacters.filter(c => c.role === 'protagonist');
            for (const char of protagonists) {
                if (selectedCharacters.length >= MAX_CHARACTERS) break;
                addCharacter(char, "protagonist");
            }
        }

        // 4. Fill remaining space with key supporting characters (if any)
        // Sort by mention count or importance if available, otherwise just role
        if (selectedCharacters.length < MAX_CHARACTERS) {
            const supporting = allCharacters
                .filter(c => c.role === 'supporting' && !selectedIds.has(c.id))
                // Simple sort by name for stability, ideally would be importance
                .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0));

            for (const char of supporting) {
                if (selectedCharacters.length >= MAX_CHARACTERS) break;
                addCharacter(char, "supporting_fill");
            }
        }

        // If we still have very few characters (e.g. < 2) and have more available, add them regardless of role
        if (selectedCharacters.length < 2 && allCharacters.length > selectedCharacters.length) {
            const others = allCharacters
                .filter(c => !selectedIds.has(c.id))
                .sort((a, b) => (b.mentionCount || 0) - (a.mentionCount || 0));

            for (const char of others) {
                if (selectedCharacters.length >= 3) break; // Just add a couple more
                addCharacter(char, "fallback_fill");
            }
        }

        console.log(`[Context] Filtered characters for scene ${sceneFrame.index}: ${selectedCharacters.map(c => c.name).join(', ')}`);
        return selectedCharacters;
    }
}

export const contentGenerationService = new ContentGenerationService();
