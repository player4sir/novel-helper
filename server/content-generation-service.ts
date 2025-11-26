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
    type: "connected" | "progress" | "scenes_decomposed" | "scene_start" | "thinking_start" | "thinking_end" | "scene_content_chunk" | "scene_completed" | "scene_failed" | "completed" | "error";
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
                            : this.getSmartContextWindow(generatedContent, 2000), // Use smart window
                        storyContext: contextSelection.contextText, // Pass semantic context separately
                        characters: this.filterRelevantCharacters(characters, chapterOutline, scene),
                        globalMemory: worldSettingSelection.globalSettings?.map(s => `${s.title}: ${s.content}`).join("\n") || "",
                        worldSettings: worldSettingSelection.contextText,
                        sceneFrame: scene,
                        genre: contextData.genre,
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

                    let buffer = "";
                    let isBuffering = true;
                    const BUFFER_LIMIT = 2000; // Safety limit to prevent hanging

                    // Emit thinking start event
                    yield {
                        type: "thinking_start",
                        data: {
                            sceneIndex: i,
                            message: "AI正在深度思考剧情走向..."
                        }
                    };

                    for await (const chunk of stream) {
                        if (typeof chunk === 'string') {
                            if (isBuffering) {
                                buffer += chunk;

                                // Check for end of thinking block
                                const thinkingEndIndex = buffer.indexOf('</thinking>');
                                if (thinkingEndIndex !== -1) {
                                    // Found it! Strip it and everything before it
                                    let cleanPart = buffer.slice(thinkingEndIndex + 11); // length of </thinking> is 11

                                    // Also clean scene markers from this initial part
                                    cleanPart = this.cleanSceneMarkers(cleanPart);

                                    if (cleanPart) {
                                        sceneContent += cleanPart;
                                        yield {
                                            type: "scene_content_chunk",
                                            data: {
                                                sceneIndex: i,
                                                chunk: cleanPart,
                                                currentLength: sceneContent.length
                                            }
                                        };
                                    }
                                    buffer = "";
                                    isBuffering = false;
                                } else if (buffer.length > BUFFER_LIMIT) {
                                    // Too long, give up buffering to prevent hanging
                                    // Try to clean what we have
                                    let cleanPart = this.cleanSceneMarkers(buffer);

                                    // Emit thinking end (timeout)
                                    yield {
                                        type: "thinking_end",
                                        data: { sceneIndex: i }
                                    };

                                    if (cleanPart) {
                                        sceneContent += cleanPart;
                                        yield {
                                            type: "scene_content_chunk",
                                            data: {
                                                sceneIndex: i,
                                                chunk: cleanPart,
                                                currentLength: sceneContent.length
                                            }
                                        };
                                    }
                                    buffer = "";
                                    isBuffering = false;
                                }
                                // Else: continue buffering
                            } else {
                                // Not buffering, pass through
                                // Simple cleanup for chunks to catch stray markers
                                let cleanChunk = chunk;
                                cleanChunk = cleanChunk.replace(/【场景\s*\d+\/\d+[^】]*】/g, '');
                                cleanChunk = cleanChunk.replace(/\*\*\*/g, '');

                                if (cleanChunk) {
                                    sceneContent += cleanChunk;
                                    yield {
                                        type: "scene_content_chunk",
                                        data: {
                                            sceneIndex: i,
                                            chunk: cleanChunk,
                                            currentLength: sceneContent.length
                                        }
                                    };
                                }
                            }
                        } else {
                            result = chunk;
                        }
                    }

                    // Flush any remaining buffer if we finished without finding </thinking>
                    if (isBuffering) {
                        // Emit thinking end if we were still buffering
                        yield {
                            type: "thinking_end",
                            data: { sceneIndex: i }
                        };

                        if (buffer.length > 0) {
                            let cleanPart = this.cleanSceneMarkers(buffer);
                            if (cleanPart) {
                                sceneContent += cleanPart;
                                yield {
                                    type: "scene_content_chunk",
                                    data: {
                                        sceneIndex: i,
                                        chunk: cleanPart,
                                        currentLength: sceneContent.length
                                    }
                                };
                            }
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
                // Clean scene markers (fallback mechanism)
                generatedContent = this.cleanSceneMarkers(generatedContent);

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
            project,
            genre: project?.genre || '奇幻',
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

        const MAX_CHARACTERS = 5; // Reduced from 7 to keep focus
        const selectedIds = new Set<string>();
        const selectedCharacters: any[] = [];

        const addCharacter = (char: any, reason: string) => {
            if (!char || selectedIds.has(char.id)) return;
            selectedIds.add(char.id);
            selectedCharacters.push({ ...char, _selectionReason: reason });
        };

        // 1. [Highest Priority] Scene focal entities
        if (sceneFrame.focalEntities && sceneFrame.focalEntities.length > 0) {
            for (const name of sceneFrame.focalEntities) {
                const char = allCharacters.find(c => c.name === name);
                if (char) addCharacter(char, "scene_focal");
            }
        }

        // 2. [Fallback] Only check chapter required entities if we have NO characters yet
        // And limit to top 2 to avoid flooding
        if (selectedCharacters.length === 0 && chapterOutline?.plotNodes?.requiredEntities) {
            const topRequired = chapterOutline.plotNodes.requiredEntities.slice(0, 2);
            for (const name of topRequired) {
                const char = allCharacters.find(c => c.name === name);
                if (char) addCharacter(char, "chapter_required_fallback");
            }
        }

        // 3. [Low Priority] Protagonist: Only add if we have very few characters (< 2)
        if (selectedCharacters.length < 2) {
            const protagonists = allCharacters.filter(c => c.role === 'protagonist');
            for (const char of protagonists) {
                if (selectedCharacters.length >= MAX_CHARACTERS) break;
                addCharacter(char, "protagonist");
            }
        }

        // 4. [No Auto-Fill] Removed automatic filling of supporting characters
        // to prevent "all characters appearing in first chapter" issue

        console.log(`[Context] Filtered characters for scene ${sceneFrame.index}: ${selectedCharacters.map(c => c.name).join(', ')} (${selectedCharacters.length} total)`);
        return selectedCharacters;
    }

    /**
     * Clean scene markers and AI thinking blocks from generated content
     */
    private cleanSceneMarkers(content: string): string {
        if (!content) return "";

        let cleaned = content;

        // 1. Remove <thinking> blocks (CoT)
        cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');

        // 2. Remove 【场景 X/X: ...】 markers
        cleaned = cleaned.replace(/【场景\s*\d+\/\d+[^】]*】\s*/g, '');

        // 3. Remove standalone separator lines (like ***)
        cleaned = cleaned.replace(/^\s*\*{3,}\s*$/gm, '');

        // 4. Remove other potential scene marker formats
        cleaned = cleaned.replace(/\n\s*场景\s*\d+[：:][^\n]*\n/g, '\n');

        return cleaned.trim();
    }

    /**
     * Get smart context window that respects paragraph boundaries
     */
    private getSmartContextWindow(content: string, maxChars: number): string {
        if (!content || content.length <= maxChars) {
            return content;
        }

        // Take a slightly larger chunk first to find a good break point
        const rawChunk = content.slice(-(maxChars + 200));

        // Find the first paragraph break (\n\n)
        const firstBreak = rawChunk.indexOf('\n\n');

        if (firstBreak !== -1 && firstBreak < 200) {
            // Found a clean paragraph break near the start of our chunk
            return rawChunk.slice(firstBreak + 2).trim();
        }

        // Fallback: Find the first sentence end (.!?)
        const firstSentenceEnd = rawChunk.search(/[。！？\n]/);
        if (firstSentenceEnd !== -1 && firstSentenceEnd < 200) {
            return rawChunk.slice(firstSentenceEnd + 1).trim();
        }

        // Hard fallback
        return content.slice(-maxChars);
    }
}

export const contentGenerationService = new ContentGenerationService();
