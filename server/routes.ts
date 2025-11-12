import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { aiService } from "./ai-service";
import { enhancedProjectCreationService } from "./enhanced-project-creation-service";
import { volumeChapterGenerationService } from "./volume-chapter-generation-service";
import { sceneDraftService } from "./scene-draft-service";
import { chapterCreationService } from "./chapter-creation-service";
import { projectManagementService } from "./project-management-service";
import { eq, and, sql } from "drizzle-orm";
import {
  insertProjectSchema,
  insertVolumeSchema,
  insertChapterSchema,
  insertOutlineSchema,
  insertCharacterSchema,
  insertWorldSettingSchema,
  insertAIModelSchema,
  insertPromptTemplateSchema,
  insertPlotCardSchema,
  insertGenerationHistorySchema,
  insertStatisticSchema,
  statistics,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(data);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI-driven project creation from seed
  // Implements full algorithm: PromptPacking + ModelRouting + VectorScoring + CandidateMerging
  app.post("/api/projects/create-from-seed", async (req, res) => {
    try {
      const { titleSeed, premise, genre, style, targetWordCount } = req.body;

      if (!titleSeed || titleSeed.trim().length === 0) {
        return res.status(400).json({ error: "标题或创意种子不能为空" });
      }

      const result = await enhancedProjectCreationService.createProjectFromSeed({
        titleSeed: titleSeed.trim(),
        premise: premise?.trim(),
        genre: genre?.trim(),
        style: style?.trim(),
        targetWordCount: targetWordCount ? parseInt(targetWordCount) : undefined,
      });

      res.json({
        success: true,
        projectId: result.projectId,
        projectMeta: result.projectMeta,
        executionLogs: result.executionLogs,
        routingDecision: result.routingDecision,
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const result = await projectManagementService.updateProject(
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { force } = req.query;
      const result = await projectManagementService.deleteProject(
        req.params.id,
        { force: force === "true" }
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get project dependencies (for delete confirmation)
  app.get("/api/projects/:id/dependencies", async (req, res) => {
    try {
      const dependencies = await projectManagementService.getProjectDependencies(
        req.params.id
      );
      res.json(dependencies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Archive project
  app.post("/api/projects/:id/archive", async (req, res) => {
    try {
      const result = await projectManagementService.archiveProject(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Unarchive project
  app.post("/api/projects/:id/unarchive", async (req, res) => {
    try {
      const result = await projectManagementService.unarchiveProject(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Duplicate project
  app.post("/api/projects/:id/duplicate", async (req, res) => {
    try {
      const { newTitle } = req.body;
      const result = await projectManagementService.duplicateProject(
        req.params.id,
        newTitle
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get project statistics
  app.get("/api/projects/:id/statistics", async (req, res) => {
    try {
      const statistics = await projectManagementService.getProjectStatistics(
        req.params.id
      );
      res.json(statistics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Volumes
  app.get("/api/volumes", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const volumes = await storage.getVolumesByProject(projectId);
      res.json(volumes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/volumes", async (req, res) => {
    try {
      const data = insertVolumeSchema.parse(req.body);
      const volume = await storage.createVolume(data);
      res.json(volume);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI-driven volume generation
  app.post("/api/volumes/generate", async (req, res) => {
    try {
      const { projectId, targetVolumeCount } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const result = await volumeChapterGenerationService.generateVolumes(
        projectId,
        targetVolumeCount || 3
      );

      // Save volumes to database with enhanced metadata
      const savedVolumes = [];
      for (const volumeOutline of result.volumes) {
        const volume = await storage.createVolume({
          projectId,
          title: volumeOutline.title,
          orderIndex: volumeOutline.orderIndex,
          description: volumeOutline.oneLiner,
        });

        // Create volume outline with enhanced plotNodes
        await storage.createOutline({
          projectId,
          parentId: null,
          type: "volume",
          title: volumeOutline.title,
          content: `# ${volumeOutline.title}\n\n## 定位\n${volumeOutline.oneLiner}\n\n## 核心节拍\n${volumeOutline.beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}${volumeOutline.conflictFocus ? `\n\n## 冲突焦点\n${volumeOutline.conflictFocus}` : ""}${volumeOutline.themeTags && volumeOutline.themeTags.length > 0 ? `\n\n## 主题标签\n${volumeOutline.themeTags.join("、")}` : ""}`,
          orderIndex: volumeOutline.orderIndex,
          plotNodes: {
            beats: volumeOutline.beats,
            themeTags: volumeOutline.themeTags || [],
            conflictFocus: volumeOutline.conflictFocus || "",
          },
          linkedVolumeId: volume.id,
        });

        savedVolumes.push(volume);
      }

      res.json({
        success: true,
        volumes: savedVolumes,
        executionLogs: result.executionLogs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.delete("/api/volumes/:id", async (req, res) => {
    try {
      await storage.deleteVolume(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chapters
  app.get("/api/chapters", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const chapters = await storage.getChaptersByProject(projectId);
      res.json(chapters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chapters/:projectId", async (req, res) => {
    try {
      const chapters = await storage.getChaptersByProject(req.params.projectId);
      res.json(chapters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chapter/:id", async (req, res) => {
    try {
      const chapter = await storage.getChapter(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chapters", async (req, res) => {
    try {
      const { projectId, volumeId, title, content, status } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const result = await chapterCreationService.createChapter({
        projectId,
        volumeId: volumeId || null,
        title,
        content,
        status,
      });

      res.json(result.chapter);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI-driven chapter generation
  app.post("/api/chapters/generate", async (req, res) => {
    try {
      const { projectId, volumeId, targetChapterCount } = req.body;

      if (!projectId || !volumeId) {
        return res.status(400).json({ error: "projectId and volumeId are required" });
      }

      // Ensure volumeId is a valid volume record
      let actualVolumeId = volumeId;
      const volumes = await storage.getVolumesByProject(projectId);
      const existingVolume = volumes.find((v) => v.id === volumeId);
      
      if (!existingVolume) {
        // volumeId might be an outline ID, try to find or create corresponding volume
        const outlines = await storage.getOutlinesByProject(projectId);
        const volumeOutline = outlines.find((o) => o.id === volumeId && o.type === "volume");
        
        if (volumeOutline) {
          // Check if volume already exists via linkedVolumeId
          if (volumeOutline.linkedVolumeId) {
            actualVolumeId = volumeOutline.linkedVolumeId;
          } else {
            // Create corresponding volume record
            const newVolume = await storage.createVolume({
              projectId,
              title: volumeOutline.title,
              orderIndex: volumeOutline.orderIndex,
              description: volumeOutline.content?.substring(0, 200) || "",
            });
            actualVolumeId = newVolume.id;
            
            // Update outline to link to volume
            await storage.updateOutline(volumeOutline.id, {
              linkedVolumeId: newVolume.id,
            });
          }
        } else {
          return res.status(404).json({ error: "Volume not found" });
        }
      }

      const result = await volumeChapterGenerationService.generateChapters(
        projectId,
        actualVolumeId,
        targetChapterCount || 10
      );

      // Prepare chapter data for batch creation
      const chapterDataArray = result.chapters.map((chapterOutline) => ({
        title: chapterOutline.title,
        content: "",
        orderIndex: chapterOutline.orderIndex,
        notes: `一句话概括: ${chapterOutline.oneLiner}\n\n必需角色: ${chapterOutline.requiredEntities.join("、")}\n\n焦点角色: ${chapterOutline.focalEntities?.join("、") || ""}\n\n风险变化: ${chapterOutline.stakesDelta}\n\n入场状态: ${chapterOutline.entryState || ""}\n\n出场状态: ${chapterOutline.exitState || ""}`,
        hook: chapterOutline.beats[chapterOutline.beats.length - 1] || "",
        status: "draft" as const,
      }));

      // Create chapters in batch
      const savedChapters = await chapterCreationService.createChaptersBatch(
        projectId,
        actualVolumeId,
        chapterDataArray
      );

      // Create chapter outlines with enhanced plotNodes for entity tracking
      for (let i = 0; i < savedChapters.length; i++) {
        const chapter = savedChapters[i];
        const chapterOutline = result.chapters[i];

        await storage.createOutline({
          projectId,
          parentId: null,
          type: "chapter",
          title: chapterOutline.title,
          content: `# ${chapterOutline.title}\n\n## 概括\n${chapterOutline.oneLiner}\n\n## 节拍\n${chapterOutline.beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\n## 必需角色\n${chapterOutline.requiredEntities.join("、")}\n\n## 焦点角色\n${chapterOutline.focalEntities?.join("、") || ""}\n\n## 风险变化\n${chapterOutline.stakesDelta}\n\n## 入场状态\n${chapterOutline.entryState || ""}\n\n## 出场状态\n${chapterOutline.exitState || ""}`,
          orderIndex: chapterOutline.orderIndex,
          plotNodes: {
            beats: chapterOutline.beats,
            requiredEntities: chapterOutline.requiredEntities,
            focalEntities: chapterOutline.focalEntities || [],
            stakesDelta: chapterOutline.stakesDelta,
            entryState: chapterOutline.entryState || "",
            exitState: chapterOutline.exitState || "",
          },
          linkedChapterId: chapter.id,
        });
      }

      res.json({
        success: true,
        chapters: savedChapters,
        executionLogs: result.executionLogs,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Helper: Extract previous context intelligently
  const extractPreviousContext = (content: string, maxChars: number): string => {
    if (!content || content.length === 0) return "";
    
    // If content is short enough, return all
    if (content.length <= maxChars) return content;
    
    // Find the last complete sentence within maxChars
    const truncated = content.slice(-maxChars);
    const sentenceEnd = truncated.search(/[。！？\n]/);
    
    if (sentenceEnd > 0) {
      // Start from the first complete sentence
      return truncated.slice(sentenceEnd + 1).trim();
    }
    
    // Fallback: return last maxChars
    return truncated;
  };

  // Generate chapter content using AI
  app.post("/api/chapters/:id/generate-content", async (req, res) => {
    try {
      const chapterId = req.params.id;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Check AI models configuration
      const models = await storage.getAIModels();
      const defaultChatModel = models.find(m => m.modelType === "chat" && m.isDefaultChat && m.isActive);
      const defaultEmbeddingModel = models.find(m => m.modelType === "embedding" && m.isDefaultEmbedding && m.isActive);

      if (!defaultChatModel) {
        return res.status(400).json({ 
          error: "未配置默认对话模型。请先在AI模型配置页面添加并设置默认的对话模型（Chat）。" 
        });
      }

      if (!defaultEmbeddingModel) {
        console.warn("[Chapter Generation] No default embedding model configured. Few-shot and semantic cache will use fallback mode.");
      }

      // Get chapter
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      // Decompose into scenes (or get existing)
      const scenes = await sceneDraftService.decomposeChapterIntoScenes(
        projectId,
        chapterId
      );

      // Get context with enhanced information
      const characters = await storage.getCharactersByProject(projectId);
      const worldSettings = await storage.getWorldSettingsByProject(projectId);
      const outlines = await storage.getOutlinesByProject(projectId);
      const chapterOutline = outlines.find(
        (o) => o.type === "chapter" && o.linkedChapterId === chapterId
      );
      const mainOutline = outlines.find((o) => o.type === "main");
      const project = await storage.getProject(projectId);

      // Extract chapter plot nodes
      const chapterPlotNodes = (chapterOutline?.plotNodes as any) || {};
      const beats = chapterPlotNodes.beats || [];
      const requiredEntities = chapterPlotNodes.requiredEntities || [];
      const focalEntities = chapterPlotNodes.focalEntities || requiredEntities.slice(0, 2);

      // Build enhanced context
      const context = {
        // Project-level information
        projectSummary: mainOutline ? {
          coreConflicts: ((mainOutline.plotNodes as any)?.coreConflicts || []).join("\n"),
          themeTags: ((mainOutline.plotNodes as any)?.themeTags || []).join("、"),
          toneProfile: project?.style || "",
        } : null,

        // Enhanced character information (only focal characters)
        characters: characters
          .filter((c) => focalEntities.includes(c.name))
          .map((c) => ({
            name: c.name,
            role: c.role,
            personality: c.personality || "",
            background: c.background || "",
            abilities: c.abilities || "",
            motivation: (c as any).shortMotivation || "",
            currentGoal: (c as any).currentGoal || "",
            currentEmotion: (c as any).currentEmotion || "",
            relationships: c.relationships || {},
          })),

        // All characters (for reference)
        allCharacters: characters
          .map((c) => `${c.name}（${c.role}）`)
          .join("、"),

        // World settings (simplified)
        worldSettings: worldSettings.slice(0, 2).map((w) => w.content).join("\n\n"),

        // Structured chapter outline
        chapterOutline: {
          title: chapterOutline?.title || "",
          summary: chapterPlotNodes.oneLiner || "",
          beats: beats,
          requiredEntities: requiredEntities,
          focalEntities: focalEntities,
          stakesDelta: chapterPlotNodes.stakesDelta || "",
          entryState: chapterPlotNodes.entryState || "",
          exitState: chapterPlotNodes.exitState || "",
        },
      };

      // Generate drafts for each scene
      const drafts = [];
      let previousContent = "";
      const executionLogs = [];
      const adjacentSummaries: string[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];

        // Build scene-specific context
        const sceneContext = {
          ...context,
          
          // Current scene information
          currentScene: {
            index: i,
            total: scenes.length,
            beat: beats[i] || scene.purpose,
            previousBeat: i > 0 ? beats[i - 1] : null,
            nextBeat: i < beats.length - 1 ? beats[i + 1] : null,
          },

          // Previous content (smart extraction)
          previousContent: extractPreviousContext(previousContent, 800),

          // Adjacent summaries
          adjacentSummaries: {
            previous: i > 0 ? adjacentSummaries[i - 1] : null,
            next: i < scenes.length - 1 ? scenes[i + 1].purpose : null,
          },

          sceneFrame: scene,
        };

        const result = await sceneDraftService.generateSceneDraft(
          projectId,
          scene,
          sceneContext
        );

        drafts.push(result.draft);
        executionLogs.push(result.executionLog);
        adjacentSummaries.push(result.draft.localSummary || "");
        previousContent += result.draft.content + "\n\n";

        // Save execution log
        await storage.createPromptExecution({
          id: result.executionLog.executionId,
          projectId,
          templateId: result.executionLog.templateId,
          templateVersion: result.executionLog.templateVersion,
          promptHash: result.executionLog.promptHash,
          promptMetadata: result.executionLog.promptMetadata,
          modelId: result.executionLog.modelId,
          modelVersion: result.executionLog.modelVersion,
          params: result.executionLog.params,
          responseHash: result.executionLog.responseHash,
          responseSummary: result.executionLog.responseSummary,
          tokensUsed: result.executionLog.tokensUsed,
          timestamp: result.executionLog.timestamp,
          signature: null,
        });

        console.log(
          `[Chapter Generation] Scene ${i + 1}/${scenes.length}: ${result.draft.wordCount} words, rules=${result.ruleCheck.passed ? "✓" : "✗"}`
        );
      }

      // Combine all drafts
      const fullContent = drafts.map((d) => d.content).join("\n\n");
      const totalWordCount = fullContent.length;

      // Update chapter
      await storage.updateChapter(chapterId, {
        content: fullContent,
        wordCount: totalWordCount,
        status: "writing",
      });

      // Record today's statistics
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if today's stat exists
        const existingStats = await db
          .select()
          .from(statistics)
          .where(
            and(
              eq(statistics.projectId, projectId),
              sql`DATE(${statistics.date}) = DATE(${today})`
            )
          );

        if (existingStats.length > 0) {
          // Update existing stat
          await db
            .update(statistics)
            .set({
              wordsWritten: sql`${statistics.wordsWritten} + ${totalWordCount}`,
              aiGenerations: sql`${statistics.aiGenerations} + 1`,
            })
            .where(eq(statistics.id, existingStats[0].id));
        } else {
          // Create new stat
          await storage.createStatistic({
            projectId,
            date: today,
            wordsWritten: totalWordCount,
            chaptersCompleted: 0,
            aiGenerations: 1,
            writingTimeMinutes: 0,
          });
        }
      } catch (statError) {
        console.error("[Statistics] Error recording stats:", statError);
        // Don't fail the request if stats recording fails
      }

      // Calculate statistics
      const ruleChecksPassed = drafts.filter((d) => d.ruleCheckPassed).length;
      const totalWarnings = drafts.reduce(
        (sum, d) => sum + (d.ruleCheckWarnings as any[])?.length || 0,
        0
      );

      res.json({
        success: true,
        wordCount: totalWordCount, // 前端期望的字段
        chapter: {
          id: chapterId,
          content: fullContent,
          wordCount: totalWordCount,
        },
        scenes: scenes.length,
        drafts: drafts.length,
        ruleChecksPassed,
        totalWarnings,
        executionLogs,
      });
    } catch (error: any) {
      console.error("[Chapter Generation] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  app.patch("/api/chapters/:id", async (req, res) => {
    try {
      // Get old chapter for word count comparison
      const oldChapter = await storage.getChapter(req.params.id);
      const chapter = await storage.updateChapter(req.params.id, req.body);
      
      // If word count changed, update today's statistics
      if (oldChapter && req.body.wordCount !== undefined && req.body.wordCount !== oldChapter.wordCount) {
        const wordsDiff = (req.body.wordCount || 0) - (oldChapter.wordCount || 0);
        
        if (wordsDiff > 0) {
          try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const existingStats = await db
              .select()
              .from(statistics)
              .where(
                and(
                  eq(statistics.projectId, chapter.projectId),
                  sql`DATE(${statistics.date}) = DATE(${today})`
                )
              );

            if (existingStats.length > 0) {
              await db
                .update(statistics)
                .set({
                  wordsWritten: sql`${statistics.wordsWritten} + ${wordsDiff}`,
                })
                .where(eq(statistics.id, existingStats[0].id));
            } else {
              await storage.createStatistic({
                projectId: chapter.projectId,
                date: today,
                wordsWritten: wordsDiff,
                chaptersCompleted: 0,
                aiGenerations: 0,
                writingTimeMinutes: 0,
              });
            }
          } catch (statError) {
            console.error("[Statistics] Error updating stats:", statError);
          }
        }
      }
      
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/chapters/:id", async (req, res) => {
    try {
      await storage.deleteChapter(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder chapters
  app.post("/api/chapters/reorder", async (req, res) => {
    try {
      const { projectId, chapterIds, volumeId } = req.body;

      if (!projectId || !Array.isArray(chapterIds)) {
        return res.status(400).json({ error: "projectId and chapterIds array are required" });
      }

      await chapterCreationService.reorderChapters(projectId, chapterIds, volumeId || null);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Move chapter to different volume
  app.post("/api/chapters/:id/move", async (req, res) => {
    try {
      const { targetVolumeId } = req.body;
      const chapter = await chapterCreationService.moveChapterToVolume(
        req.params.id,
        targetVolumeId || null
      );
      res.json(chapter);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Outlines
  app.get("/api/outlines", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const outlines = await storage.getOutlinesByProject(projectId);
      res.json(outlines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/outlines/:projectId", async (req, res) => {
    try {
      const outlines = await storage.getOutlinesByProject(req.params.projectId);
      res.json(outlines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/outlines", async (req, res) => {
    try {
      const data = insertOutlineSchema.parse(req.body);
      const outline = await storage.createOutline(data);
      res.json(outline);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/outlines/:id", async (req, res) => {
    try {
      const outline = await storage.updateOutline(req.params.id, req.body);
      res.json(outline);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/outlines/:id", async (req, res) => {
    try {
      await storage.deleteOutline(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Characters
  app.get("/api/characters", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const characters = await storage.getCharactersByProject(projectId);
      res.json(characters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/characters/:projectId", async (req, res) => {
    try {
      const characters = await storage.getCharactersByProject(req.params.projectId);
      res.json(characters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/characters", async (req, res) => {
    try {
      const data = insertCharacterSchema.parse(req.body);
      const character = await storage.createCharacter(data);
      res.json(character);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/characters/:id", async (req, res) => {
    try {
      const character = await storage.updateCharacter(req.params.id, req.body);
      res.json(character);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/characters/:id", async (req, res) => {
    try {
      await storage.deleteCharacter(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // World Settings
  app.get("/api/world-settings/:projectId", async (req, res) => {
    try {
      const settings = await storage.getWorldSettingsByProject(req.params.projectId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/world-settings", async (req, res) => {
    try {
      const data = insertWorldSettingSchema.parse(req.body);
      const setting = await storage.createWorldSetting(data);
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/world-settings/:id", async (req, res) => {
    try {
      const setting = await storage.updateWorldSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/world-settings/:id", async (req, res) => {
    try {
      await storage.deleteWorldSetting(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Models
  app.get("/api/ai-models", async (req, res) => {
    try {
      const models = await storage.getAIModels();
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-models", async (req, res) => {
    try {
      const data = insertAIModelSchema.parse(req.body);
      const model = await storage.createAIModel(data);
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/ai-models/:id", async (req, res) => {
    try {
      const model = await storage.updateAIModel(req.params.id, req.body);
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ai-models/:id", async (req, res) => {
    try {
      await storage.deleteAIModel(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-models/:id/set-default", async (req, res) => {
    try {
      await storage.setDefaultAIModel(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-models/test", async (req, res) => {
    try {
      const { provider, modelType, modelId, baseUrl, apiKey } = req.body;

      if (!provider || !modelType || !modelId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await aiService.testConnection({
        provider,
        modelType,
        modelId,
        baseUrl: baseUrl || "",
        apiKey: apiKey || undefined,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Prompt Templates
  app.get("/api/prompt-templates", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const templates = await storage.getPromptTemplates(projectId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prompt-templates/:projectId", async (req, res) => {
    try {
      const templates = await storage.getPromptTemplates(req.params.projectId);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prompt-templates", async (req, res) => {
    try {
      const data = insertPromptTemplateSchema.parse(req.body);
      const template = await storage.createPromptTemplate(data);
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/prompt-templates/:id", async (req, res) => {
    try {
      const template = await storage.updatePromptTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/prompt-templates/:id", async (req, res) => {
    try {
      await storage.deletePromptTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Plot Cards
  app.get("/api/plot-cards/:projectId", async (req, res) => {
    try {
      const cards = await storage.getPlotCards(req.params.projectId);
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/plot-cards", async (req, res) => {
    try {
      const data = insertPlotCardSchema.parse(req.body);
      const card = await storage.createPlotCard(data);
      res.json(card);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/plot-cards/:id", async (req, res) => {
    try {
      const card = await storage.updatePlotCard(req.params.id, req.body);
      res.json(card);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/plot-cards/:id", async (req, res) => {
    try {
      await storage.deletePlotCard(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Generation
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { prompt, modelId, parameters } = req.body;

      if (!modelId) {
        return res.status(400).json({ error: "modelId is required" });
      }

      const model = await storage.getAIModel(modelId);
      if (!model) {
        return res.status(404).json({ error: "AI model not found" });
      }

      if (!model.isActive) {
        return res.status(400).json({ error: "AI model is not active" });
      }

      const result = await aiService.generate({
        prompt,
        modelId: model.modelId,
        provider: model.provider,
        baseUrl: model.baseUrl || "",
        apiKey: model.apiKey || undefined,
        parameters: {
          temperature: parameters?.temperature || 0.7,
          maxTokens: parameters?.maxTokens || 2000,
        },
      });

      res.json({ content: result.content, tokensUsed: result.tokensUsed });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generation History
  app.get("/api/generation-history/:projectId", async (req, res) => {
    try {
      const { chapterId } = req.query;
      const history = await storage.getGenerationHistory(
        req.params.projectId,
        chapterId as string | undefined
      );
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generation-history", async (req, res) => {
    try {
      const data = insertGenerationHistorySchema.parse(req.body);
      const history = await storage.createGenerationHistory(data);
      res.json(history);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Statistics
  app.get("/api/statistics", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const statistics = await storage.getStatisticsByProject(projectId);
      res.json(statistics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/statistics/:projectId", async (req, res) => {
    try {
      const statistics = await storage.getStatisticsByProject(req.params.projectId);
      res.json(statistics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get today's statistics across all projects
  app.get("/api/statistics/today/summary", async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const allStats = await db
        .select()
        .from(statistics)
        .where(sql`DATE(${statistics.date}) = DATE(${today})`);
      
      const todayWords = allStats.reduce((sum: number, stat) => sum + (stat.wordsWritten || 0), 0);
      const todayChapters = allStats.reduce((sum: number, stat) => sum + (stat.chaptersCompleted || 0), 0);
      
      res.json({
        wordsWritten: todayWords,
        chaptersCompleted: todayChapters,
        date: today,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/statistics", async (req, res) => {
    try {
      const data = insertStatisticSchema.parse(req.body);
      const statistic = await storage.createStatistic(data);
      res.json(statistic);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Scene Frames
  app.get("/api/scene-frames/:chapterId", async (req, res) => {
    try {
      const scenes = await storage.getSceneFramesByChapter(req.params.chapterId);
      res.json(scenes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Draft Chunks
  app.get("/api/draft-chunks/:sceneId", async (req, res) => {
    try {
      const chunks = await storage.getDraftChunksByScene(req.params.sceneId);
      res.json(chunks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chapter Polish
  app.post("/api/chapters/:id/polish", async (req, res) => {
    try {
      const chapterId = req.params.id;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Get chapter
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      if (!chapter.content || chapter.content.length < 100) {
        return res.status(400).json({ error: "章节内容过短，无法润色" });
      }

      // TODO: Implement polish service
      res.status(501).json({ error: "Polish功能正在开发中" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Coherence Check
  app.post("/api/chapters/:id/check-coherence", async (req, res) => {
    try {
      const chapterId = req.params.id;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      // Get chapter
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      // TODO: Implement coherence check service
      res.status(501).json({ error: "连贯性检测功能正在开发中" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get coherence issues
  app.get("/api/coherence-issues/:projectId", async (req, res) => {
    try {
      const issues = await storage.getCoherenceIssuesByProject(req.params.projectId);
      res.json(issues);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cache management
  app.get("/api/cache/stats", async (req, res) => {
    try {
      const { semanticCacheService } = await import("./semantic-cache-service");
      const stats = await semanticCacheService.getCacheStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cache/cleanup", async (req, res) => {
    try {
      const { semanticCacheService } = await import("./semantic-cache-service");
      const { daysOld } = req.body;
      const deleted = await semanticCacheService.cleanupCache(daysOld || 30);
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Few-shot examples management
  app.get("/api/few-shot-examples", async (req, res) => {
    try {
      const { fewShotExamplesService } = await import("./few-shot-examples-service");
      const examples = fewShotExamplesService.getAllExamples();
      res.json(examples);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/few-shot-examples", async (req, res) => {
    try {
      const { fewShotExamplesService } = await import("./few-shot-examples-service");
      const { category, sceneType, purpose, example, quality, tags } = req.body;

      if (!category || !sceneType || !purpose || !example) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      fewShotExamplesService.addExample({
        category,
        sceneType,
        purpose,
        example,
        quality: quality || 80,
        tags: tags || [],
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Cache Statistics API
  app.get("/api/cache/stats", async (req, res) => {
    try {
      const { semanticCacheService } = await import("./semantic-cache-service");
      const stats = await semanticCacheService.getCacheStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Few-shot Examples API
  app.get("/api/few-shot/examples", async (req, res) => {
    try {
      const { fewShotExamplesService } = await import("./few-shot-examples-service");
      const examples = fewShotExamplesService.getAllExamples();
      res.json(examples);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Entity State API
  app.get("/api/characters/:id/state", async (req, res) => {
    try {
      const { entityStateService } = await import("./entity-state-service");
      const state = await entityStateService.getEntityState(req.params.id);
      if (!state) {
        return res.status(404).json({ error: "Character not found" });
      }
      res.json(state);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/characters/:id/arc-points", async (req, res) => {
    try {
      const { entityStateService } = await import("./entity-state-service");
      const arcPoints = await entityStateService.getArcPoints(req.params.id);
      res.json(arcPoints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
