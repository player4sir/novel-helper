import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { aiService } from "./ai-service";
import { enhancedProjectCreationService } from "./enhanced-project-creation-service";
import { volumeChapterGenerationService } from "./volume-chapter-generation-service";
// Optimized version for 60-70% speed improvement
import { sceneDraftServiceOptimized as sceneDraftService } from "./scene-draft-service-optimized";
import { contentGenerationService } from "./content-generation-service";
import { chapterCreationService } from "./chapter-creation-service";
import { projectManagementService } from "./project-management-service";
import { semanticCacheService } from "./semantic-cache-service";
import { creationOrchestrator } from "./creation-orchestrator";
import { sessionManager } from "./session-manager";
import { editorAIService } from "./editor-ai-service";
import { autoCreationService } from "./auto-creation-service";
import { styleExtractionService } from "./style-extraction-service";
import { eq, and, sql, desc } from "drizzle-orm";
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
  styleProfiles,
  insertStyleProfileSchema,
} from "@shared/schema";
import { vectorizeQueue, summaryQueue } from "./jobs/queue";
import { summaryChainService } from "./summary-chain-service";
import { versionControlService } from "./version-control-service";
import { genreConfigService } from "./genre-config-service";
import { projectWordCountService } from "./project-word-count-service";
import { aiContext } from "./ai-context";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Middleware to check authentication
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).send("Unauthorized");
  };

  // Middleware to handle local AI config
  app.use((req, res, next) => {
    const configHeader = req.headers["x-ai-config"];
    if (configHeader && typeof configHeader === "string") {
      try {
        const config = JSON.parse(atob(configHeader));
        aiContext.run(config, next);
      } catch (e) {
        console.error("Failed to parse local AI config header", e);
        next();
      }
    } else {
      next();
    }
  });

  // Genre Configuration API (Public)
  app.get("/api/genres", async (req, res) => {
    try {
      const genres = genreConfigService.getAllGenres();
      res.json(genres);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/genres/:id", async (req, res) => {
    try {
      const genre = genreConfigService.getGenreById(req.params.id);
      if (!genre) {
        return res.status(404).json({ error: "Genre not found" });
      }
      res.json(genre);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Projects (Protected)
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const projects = await storage.getProjects(req.user!.id);
      res.json(projects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      // Check ownership
      if (project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject({
        ...projectData,
        userId: req.user!.id,
      });
      res.status(201).json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ============================================================================
  // New Unified Creation Workflow API
  // ============================================================================

  // Stepwise Creation API

  // 1. Start Session
  app.post("/api/creation/session", isAuthenticated, async (req, res) => {
    try {
      const { titleSeed, premise, genre, style, targetWordCount } = req.body;
      const userId = req.user!.id;

      if (!titleSeed || titleSeed.trim().length === 0) {
        return res.status(400).json({ error: "标题或创意种子不能为空" });
      }

      const sessionId = await creationOrchestrator.startStepwiseCreation(
        {
          titleSeed: titleSeed.trim(),
          premise: premise?.trim(),
          genre: genre?.trim(),
          style: style?.trim(),
          targetWordCount: targetWordCount ? parseInt(targetWordCount) : undefined,
        },
        userId
      );

      res.json({ success: true, sessionId });
    } catch (error: any) {
      console.error("[API] Failed to start session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 1.5 Auto Creation (Parallel Execution)
  // 1.5 Auto Creation (Parallel Execution) - SSE Streaming
  app.get("/api/creation/auto", async (req, res) => {
    const { titleSeed, premise, genre, style, targetWordCount, userId } = req.query;

    if (!titleSeed) {
      return res.status(400).json({ error: "Title seed is required" });
    }

    // Import better-sse
    const { createSession } = await import("better-sse");
    const session = await createSession(req, res);

    try {
      // Start quick creation with skipFinalize=true to get intermediate results
      const result = await creationOrchestrator.startQuickCreation(
        {
          titleSeed: titleSeed as string,
          premise: premise as string,
          genre: genre as string,
          style: style as string,
          targetWordCount: targetWordCount ? parseInt(targetWordCount as string) : undefined,
        },
        userId as string,
        (step, status, message, progress, metadata) => {
          session.push({
            type: "progress",
            step,
            status,
            message,
            progress,
            metadata
          });
        },
        true // skipFinalize = true
      );

      session.push({
        type: "completed",
        result
      });
    } catch (error: any) {
      console.error("[API] Auto creation failed:", error);
      session.push({
        type: "error",
        error: error.message
      });
    }
  });

  // 2. Execute Next Step (Save current & Generate next)
  app.post("/api/creation/step/next", async (req, res) => {
    try {
      const { sessionId, data } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      const result = await creationOrchestrator.executeNextStep(sessionId, data);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("[API] Failed to execute next step:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Regenerate Current Step or Specific Step
  app.post("/api/creation/step/regenerate", async (req, res) => {
    try {
      const { sessionId, step, options } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      let result;
      if (step) {
        result = await creationOrchestrator.regenerateStep(sessionId, step, options);
      } else {
        result = await creationOrchestrator.regenerateCurrentStep(sessionId, options);
      }

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("[API] Failed to regenerate step:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Confirm Creation (Finalize)
  app.post("/api/creation/confirm", async (req, res) => {
    try {
      const { sessionId, overrides } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      console.log(`[API] Confirming creation for session ${sessionId}`);
      const result = await creationOrchestrator.finalizeCreation(sessionId, overrides);

      res.json({ success: true, projectId: result.projectId });
    } catch (error: any) {
      console.error("[API] Creation confirmation failed:", error);
      res.status(500).json({ error: error.message });
    }
  });





  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const result = await projectManagementService.updateProject(
        req.params.id,
        req.body
      );
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
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
  app.get("/api/projects/:id/dependencies", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const dependencies = await projectManagementService.getProjectDependencies(
        req.params.id
      );
      res.json(dependencies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Archive project
  app.post("/api/projects/:id/archive", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const result = await projectManagementService.archiveProject(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Unarchive project
  app.post("/api/projects/:id/unarchive", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const result = await projectManagementService.unarchiveProject(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Duplicate project
  app.post("/api/projects/:id/duplicate", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
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

  // Editor AI Instruction Stream
  app.post("/api/editor/ai-instruction-stream", async (req, res) => {
    try {
      const request = req.body;

      // Set headers for SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = editorAIService.processInstructionStream(request);

      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      res.end();
    } catch (error: any) {
      console.error("[API] AI instruction stream failed:", error);
      // If headers haven't been sent, send error JSON
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        // If stream started, send error event
        res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Get project statistics
  app.get("/api/projects/:id/statistics", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const statistics = await projectManagementService.getProjectStatistics(
        req.params.id
      );
      res.json(statistics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Volumes
  app.get("/api/volumes", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const volumes = await storage.getVolumesByProject(projectId);
      res.json(volumes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/volumes", isAuthenticated, async (req, res) => {
    try {
      const data = insertVolumeSchema.parse(req.body);
      const project = await storage.getProject(data.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const volume = await storage.createVolume(data);
      res.json(volume);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI-driven volume generation
  app.post("/api/volumes/generate", isAuthenticated, async (req, res) => {
    try {
      const { projectId, targetVolumeCount } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
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

  // AI-driven volume append
  app.post("/api/volumes/append", isAuthenticated, async (req, res) => {
    try {
      const { projectId, additionalCount } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      const count = additionalCount || 2;
      if (count < 1 || count > 20) {
        return res.status(400).json({ error: "additionalCount must be between 1 and 20" });
      }

      const result = await volumeChapterGenerationService.appendVolumes(
        projectId,
        count
      );

      // Save volumes to database
      const savedVolumes = [];
      for (const volumeOutline of result.volumes) {
        const volume = await storage.createVolume({
          projectId,
          title: volumeOutline.title,
          orderIndex: volumeOutline.orderIndex,
          description: volumeOutline.oneLiner,
        });

        // Create volume outline
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

  app.delete("/api/volumes/:id", isAuthenticated, async (req, res) => {
    try {
      const volume = await storage.getVolume(req.params.id);
      if (volume) {
        const project = await storage.getProject(volume.projectId);
        if (!project || project.userId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
        await storage.deleteVolume(req.params.id);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chapters
  app.get("/api/chapters", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const chapters = await storage.getChaptersByProject(projectId);
      res.json(chapters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chapters/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const chapters = await storage.getChaptersByProject(req.params.projectId);
      res.json(chapters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chapter/:id", isAuthenticated, async (req, res) => {
    try {
      const chapter = await storage.getChapter(req.params.id);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      const project = await storage.getProject(chapter.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chapters", isAuthenticated, async (req, res) => {
    try {
      const { projectId, volumeId, title, content, status } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Validate volumeId is required for auto-outline generation
      if (!volumeId) {
        return res.status(400).json({
          error: "章节必须属于某个卷。请先创建卷，然后在卷中创建章节。"
        });
      }

      // Step 1: Create the chapter
      const result = await chapterCreationService.createChapter({
        projectId,
        volumeId,
        title,
        content,
        status,
      });

      const chapter = result.chapter;

      // Step 2: Auto-generate chapter outline using AI
      try {
        const aiResult = await volumeChapterGenerationService.generateChapters(
          projectId,
          volumeId,
          1 // Generate outline for 1 chapter
        );

        if (aiResult.chapters.length > 0) {
          const aiOutline = aiResult.chapters[0];

          // Create outline with AI-generated data but keep user's title
          await storage.createOutline({
            projectId,
            parentId: null,
            type: "chapter",
            title: chapter.title, // Keep user's title
            content: `# ${chapter.title}\n\n## 概括\n${aiOutline.oneLiner}\n\n## 节拍\n${aiOutline.beats.map((b, i) => `${i + 1}. ${b}`).join("\n")}\n\n## 必需角色\n${aiOutline.requiredEntities.join("、")}\n\n## 焦点角色\n${aiOutline.focalEntities?.join("、") || ""}\n\n## 风险变化\n${aiOutline.stakesDelta}\n\n## 入场状态\n${aiOutline.entryState || ""}\n\n## 出场状态\n${aiOutline.exitState || ""}`,
            orderIndex: chapter.orderIndex,
            plotNodes: {
              beats: aiOutline.beats,
              requiredEntities: aiOutline.requiredEntities,
              focalEntities: aiOutline.focalEntities || [],
              stakesDelta: aiOutline.stakesDelta,
              entryState: aiOutline.entryState || "",
              exitState: aiOutline.exitState || "",
              oneLiner: aiOutline.oneLiner,
            },
            linkedChapterId: chapter.id,
          });

          console.log(`[Chapter Creation] Auto-generated outline for chapter: ${chapter.title}`);
        }
      } catch (outlineError: any) {
        // If outline generation fails, rollback chapter creation
        console.error(`[Chapter Creation] Outline generation failed:`, outlineError.message);
        await storage.deleteChapter(chapter.id);
        return res.status(500).json({
          error: `章纲生成失败: ${outlineError.message}。章节创建已回滚。`
        });
      }

      // Step 3: Update project word count
      await projectWordCountService.recalculateProjectWordCount(projectId);

      res.json(chapter);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // AI-driven chapter generation
  app.post("/api/chapters/generate", isAuthenticated, async (req, res) => {
    try {
      const { projectId, volumeId, targetChapterCount } = req.body;

      if (!projectId || !volumeId) {
        return res.status(400).json({ error: "projectId and volumeId are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
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

  // AI-driven chapter append
  app.post("/api/chapters/append", isAuthenticated, async (req, res) => {
    try {
      const { projectId, volumeId, additionalCount, instruction } = req.body;

      if (!projectId || !volumeId) {
        return res.status(400).json({ error: "projectId and volumeId are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      const count = additionalCount || 5;
      if (count < 1 || count > 30) {
        return res.status(400).json({ error: "additionalCount must be between 1 and 30" });
      }

      const result = await volumeChapterGenerationService.appendChapters(
        projectId,
        volumeId,
        count,
        instruction
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
        volumeId,
        chapterDataArray
      );

      // Create chapter outlines
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
  // Helper: Extract previous context intelligently
  const extractPreviousContext = (content: string, maxChars: number): string => {
    if (!content || content.length === 0) return "";

    if (content.length <= maxChars) return content;

    // Extract last portion
    const truncated = content.slice(-maxChars * 1.5);

    // Prioritize extracting dialogues (more important for context)
    const dialogueMatches = truncated.match(/[""][^""]+[""]/g);
    const lastDialogues = dialogueMatches ? dialogueMatches.slice(-3).join("\n") : "";

    // Extract key actions (sentences with action verbs)
    const sentences = truncated.split(/[。！？]/);
    const actionSentences = sentences.filter(s =>
      s.length > 10 && /[走跑跳说道问答看听想做拿给打开关闭]/.test(s)
    ).slice(-3);

    // Combine dialogues and actions
    let result = "";
    if (lastDialogues) result += lastDialogues + "\n";
    if (actionSentences.length > 0) result += actionSentences.join("。") + "。";

    // If still too long, truncate
    if (result.length > maxChars) {
      result = result.slice(-maxChars);
      const firstSentence = result.search(/[。！？\n]/);
      if (firstSentence > 0) {
        result = result.slice(firstSentence + 1).trim();
      }
    }

    // Fallback to simple truncation
    return result || truncated.slice(-maxChars);
  };

  // Generate chapter content using AI (SSE Stream)
  app.get("/api/chapters/:id/generate-content-stream", isAuthenticated, async (req, res) => {
    const projectId = req.query.projectId as string;
    const chapterId = req.params.id;

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const project = await storage.getProject(projectId);
    if (!project || project.userId !== req.user!.id) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Import better-sse
    const { createSession } = await import("better-sse");

    // Create SSE session
    const session = await createSession(req, res, {
      keepAlive: 10000,
    });

    let clientDisconnected = false;

    session.on("disconnected", () => {
      clientDisconnected = true;
      console.log("[SSE] Client disconnected");
    });

    session.push({ type: "connected" });

    try {
      const generator = contentGenerationService.generateChapterStream(projectId, chapterId);

      for await (const event of generator) {
        if (clientDisconnected) break;
        session.push(event);
      }

      console.log("[SSE] Generation stream completed");
    } catch (error: any) {
      console.error("[Chapter Generation] Error:", error);
      if (!clientDisconnected) {
        session.push({
          type: "error",
          error: error.message
        });
      }
    }
  });

  app.patch("/api/chapters/:id", isAuthenticated, async (req, res) => {
    try {
      // Get old chapter for word count comparison
      const oldChapter = await storage.getChapter(req.params.id);
      if (!oldChapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      const project = await storage.getProject(oldChapter.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Version Control: Create change set if content changed
      if (oldChapter && req.body.content && oldChapter.content !== req.body.content) {
        try {
          await versionControlService.createChangeSet(
            req.params.id,
            oldChapter.content || "",
            req.body.content,
            "user"
          );
        } catch (vcError) {
          console.error("Failed to create change set:", vcError);
        }
      }

      const chapter = await storage.updateChapter(req.params.id, req.body);

      // Trigger vectorization and summarization if content changed
      if (req.body.content) {
        try {
          await vectorizeQueue.add('vectorize-chapter', {
            type: 'chapter',
            id: chapter.id
          });

          await summaryQueue.add('generate-summary', {
            chapterId: chapter.id
          });
        } catch (err) {
          console.error("Failed to enqueue background jobs:", err);
        }
      }

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

      // Update project total word count if chapter word count changed
      if (req.body.wordCount !== undefined) {
        await projectWordCountService.recalculateProjectWordCount(chapter.projectId);
      }

      res.json(chapter);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/chapters/:id", async (req, res) => {
    try {
      const chapter = await storage.getChapter(req.params.id);
      if (chapter) {
        await storage.deleteChapter(req.params.id);
        await projectWordCountService.recalculateProjectWordCount(chapter.projectId);
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get summary chain
  app.get("/api/chapters/:id/summary-chain", async (req, res) => {
    try {
      const { summaryChainService } = await import("./summary-chain-service");
      const chain = await summaryChainService.getSummaryChain(req.params.id);
      res.json(chain);
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
  app.get("/api/outlines", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const outlines = await storage.getOutlinesByProject(projectId);
      res.json(outlines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/outlines/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const outlines = await storage.getOutlinesByProject(req.params.projectId);
      res.json(outlines);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/outlines", isAuthenticated, async (req, res) => {
    try {
      const data = insertOutlineSchema.parse(req.body);
      const project = await storage.getProject(data.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const outline = await storage.createOutline(data);
      res.json(outline);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/outlines/:id", isAuthenticated, async (req, res) => {
    try {
      const existingOutline = await storage.getOutline(req.params.id);
      if (!existingOutline) {
        return res.status(404).json({ error: "Outline not found" });
      }

      const project = await storage.getProject(existingOutline.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const outline = await storage.updateOutline(req.params.id, req.body);
      res.json(outline);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/outlines/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteOutline(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Characters
  app.get("/api/characters", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get filter parameters
      const hasCurrentGoal = req.query.hasCurrentGoal === 'true';
      const hasCurrentEmotion = req.query.hasCurrentEmotion === 'true';
      const notAppeared = req.query.notAppeared === 'true';

      let characters = await storage.getCharactersByProject(projectId);

      // Apply filters
      if (hasCurrentGoal) {
        characters = characters.filter(c => c.currentGoal);
      }
      if (hasCurrentEmotion) {
        characters = characters.filter(c => c.currentEmotion);
      }
      if (notAppeared) {
        characters = characters.filter(c => !c.firstAppearance);
      }

      // Add state summary to each character
      const charactersWithSummary = characters.map(c => ({
        ...c,
        stateSummary: {
          currentEmotion: c.currentEmotion || null,
          currentGoal: c.currentGoal || null,
          arcPointsCount: ((c.arcPoints as string[]) || []).length,
          stateUpdatedAt: c.stateUpdatedAt || null,
          hasAppeared: !!c.firstAppearance,
        },
      }));

      res.json(charactersWithSummary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/characters/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const characters = await storage.getCharactersByProject(req.params.projectId);
      res.json(characters);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/characters", isAuthenticated, async (req, res) => {
    try {
      const data = insertCharacterSchema.parse(req.body);
      const project = await storage.getProject(data.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Auto-set stateUpdatedAt if any state fields are provided
      const hasStateFields = data.shortMotivation || data.currentGoal ||
        data.currentEmotion || (data.arcPoints && data.arcPoints.length > 0);

      const characterData = {
        ...data,
        stateUpdatedAt: hasStateFields ? new Date() : undefined,
      };

      const character = await storage.createCharacter(characterData);
      res.json(character);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/characters/:id", isAuthenticated, async (req, res) => {
    try {
      const updates = req.body;

      // Get current character to compare changes
      const currentCharacter = await storage.getCharacter(req.params.id);
      if (!currentCharacter) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(currentCharacter.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Check if any state fields are being updated
      const stateFields = ['shortMotivation', 'currentGoal', 'currentEmotion', 'arcPoints'];
      const hasStateUpdate = Object.keys(updates).some(key => stateFields.includes(key));

      // Auto-update stateUpdatedAt if state fields changed
      if (hasStateUpdate) {
        updates.stateUpdatedAt = new Date();
      }

      // Update character
      const character = await storage.updateCharacter(req.params.id, updates);

      // Record state history only for emotion/goal changes (arcPoints handled separately)
      if (hasStateUpdate) {
        try {
          const emotionChanged = updates.currentEmotion !== undefined && updates.currentEmotion !== currentCharacter.currentEmotion;
          const goalChanged = updates.currentGoal !== undefined && updates.currentGoal !== currentCharacter.currentGoal;

          // Only create history if emotion or goal actually changed
          if (emotionChanged || goalChanged) {
            // Create a single combined entry for this update
            await storage.createCharacterStateHistory({
              characterId: req.params.id,
              projectId: currentCharacter.projectId,
              chapterId: null,
              chapterIndex: null,
              sceneIndex: null,
              emotion: emotionChanged ? updates.currentEmotion : null,
              goal: goalChanged ? updates.currentGoal : null,
              arcPoint: null,
              changeType: emotionChanged && goalChanged ? 'manual_update' : (emotionChanged ? 'emotion_change' : 'goal_change'),
              notes: [
                emotionChanged ? (currentCharacter.currentEmotion
                  ? `情感: "${currentCharacter.currentEmotion}" → "${updates.currentEmotion}"`
                  : `情感: 设置为 "${updates.currentEmotion}"`) : null,
                goalChanged ? (currentCharacter.currentGoal
                  ? `目标: "${currentCharacter.currentGoal}" → "${updates.currentGoal}"`
                  : `目标: 设置为 "${updates.currentGoal}"`) : null,
              ].filter(Boolean).join(' | '),
            });
          }
        } catch (historyError) {
          // Log error but don't fail the update
          console.error('[Character Update] Failed to record state history:', historyError);
        }
      }

      res.json(character);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/characters/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCharacter(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Character Relationships Management
  app.post("/api/characters/:id/relationships", isAuthenticated, async (req, res) => {
    try {
      const { targetCharacterId, type, strength, description } = req.body;

      // Validate required fields
      if (!targetCharacterId || !type) {
        return res.status(400).json({ error: "targetCharacterId and type are required" });
      }

      // Validate strength range
      if (strength !== undefined && (strength < 0 || strength > 100)) {
        return res.status(400).json({ error: "strength must be between 0 and 100" });
      }

      // Verify source character exists
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(character.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify target character exists
      const targetCharacter = await storage.getCharacter(targetCharacterId);
      if (!targetCharacter) {
        return res.status(404).json({ error: "Target character not found" });
      }

      // Get current relationships
      const relationships = (character.relationships as Record<string, any>) || {};

      // Add or update relationship
      relationships[targetCharacterId] = {
        type,
        strength: strength || 50,
        description: description || "",
        updatedAt: new Date().toISOString(),
      };

      // Update character
      const updated = await storage.updateCharacter(req.params.id, {
        relationships: relationships as any,
        stateUpdatedAt: new Date(),
      });

      // Record to state history
      const updatedFields = [];
      if (type !== undefined) updatedFields.push(`type: ${type}`);
      if (strength !== undefined) updatedFields.push(`strength: ${strength}`);
      if (description !== undefined) updatedFields.push("description");

      await storage.createCharacterStateHistory({
        characterId: req.params.id,
        chapterId: null,
        sceneIndex: 0,
        emotion: null,
        goal: null,
        arcPoint: null,
        notes: `Updated relationship with ${targetCharacter.name}: ${updatedFields.join(", ")}`,
      });

      res.json({
        success: true,
        character: updated,
        relationship: relationships[targetCharacterId],
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/characters/:id/relationships", isAuthenticated, async (req, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(character.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const relationships = (character.relationships as Record<string, any>) || {};

      // Resolve target character names
      const resolvedRelationships = await Promise.all(
        Object.entries(relationships).map(async ([targetId, rel]: [string, any]) => {
          const targetChar = await storage.getCharacter(targetId);
          return {
            targetCharacterId: targetId,
            targetCharacterName: targetChar?.name || "Unknown",
            type: rel.type,
            strength: rel.strength,
            description: rel.description,
            updatedAt: rel.updatedAt,
          };
        })
      );

      res.json({
        characterId: req.params.id,
        characterName: character.name,
        relationships: resolvedRelationships,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/characters/:id/relationships/:targetId", isAuthenticated, async (req, res) => {
    try {
      const { type, strength, description } = req.body;

      // Validate strength if provided
      if (strength !== undefined && (strength < 0 || strength > 100)) {
        return res.status(400).json({ error: "strength must be between 0 and 100" });
      }

      // Verify source character exists
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(character.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Verify target character exists
      const targetCharacter = await storage.getCharacter(req.params.targetId);
      if (!targetCharacter) {
        return res.status(404).json({ error: "Target character not found" });
      }

      // Get current relationships
      const relationships = (character.relationships as Record<string, any>) || {};

      // Check if relationship exists
      if (!relationships[req.params.targetId]) {
        return res.status(404).json({ error: "Relationship not found" });
      }

      // Update relationship
      const existingRel = relationships[req.params.targetId];
      relationships[req.params.targetId] = {
        type: type !== undefined ? type : existingRel.type,
        strength: strength !== undefined ? strength : existingRel.strength,
        description: description !== undefined ? description : existingRel.description,
        updatedAt: new Date().toISOString(),
      };

      // Update character
      const updated = await storage.updateCharacter(req.params.id, {
        relationships: relationships as any,
        stateUpdatedAt: new Date(),
      });

      // Record to state history
      const updatedFields = [];
      if (type !== undefined) updatedFields.push(`type: ${type}`);
      if (strength !== undefined) updatedFields.push(`strength: ${strength}`);
      if (description !== undefined) updatedFields.push("description");

      await storage.createCharacterStateHistory({
        characterId: req.params.id,
        chapterId: null,
        sceneIndex: 0,
        emotion: null,
        goal: null,
        arcPoint: null,
        notes: `Updated relationship with ${targetCharacter.name}: ${updatedFields.join(", ")}`,
      });

      res.json({
        success: true,
        character: updated,
        relationship: relationships[req.params.targetId],
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // World Settings
  app.get("/api/world-settings/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const settings = await storage.getWorldSettingsByProject(req.params.projectId);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/world-settings", isAuthenticated, async (req, res) => {
    try {
      const data = insertWorldSettingSchema.parse(req.body);
      const project = await storage.getProject(data.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const setting = await storage.createWorldSetting(data);
      res.json(setting);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/world-settings/:id", isAuthenticated, async (req, res) => {
    try {
      const existingSetting = await storage.getWorldSetting(req.params.id);
      if (!existingSetting) {
        return res.status(404).json({ error: "World setting not found" });
      }

      const project = await storage.getProject(existingSetting.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const setting = await storage.updateWorldSetting(req.params.id, req.body);
      res.json(setting);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/world-settings/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteWorldSetting(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // AI Models
  app.get("/api/ai-models", isAuthenticated, async (req, res) => {
    try {
      const models = await storage.getAIModels(req.user!.id);
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-models", isAuthenticated, async (req, res) => {
    try {
      const data = insertAIModelSchema.parse(req.body);
      const model = await storage.createAIModel({
        ...data,
        userId: req.user!.id,
      });
      res.json(model);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/ai-models/:id", isAuthenticated, async (req, res) => {
    try {
      const existingModel = await storage.getAIModel(req.params.id);
      if (!existingModel || existingModel.userId !== req.user!.id) {
        return res.status(404).json({ error: "Model not found" });
      }
      const model = await storage.updateAIModel(req.params.id, req.body);
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/ai-models/:id", isAuthenticated, async (req, res) => {
    try {
      const existingModel = await storage.getAIModel(req.params.id);
      if (!existingModel || existingModel.userId !== req.user!.id) {
        return res.status(404).json({ error: "Model not found" });
      }
      await storage.deleteAIModel(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-models/:id/set-default", isAuthenticated, async (req, res) => {
    try {
      const existingModel = await storage.getAIModel(req.params.id);
      if (!existingModel || existingModel.userId !== req.user!.id) {
        return res.status(404).json({ error: "Model not found" });
      }
      await storage.setDefaultAIModel(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai-models/test", isAuthenticated, async (req, res) => {
    try {
      const { provider, modelType, modelId, baseUrl, apiKey } = req.body;

      if (!provider || !modelType || !modelId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // If testing an existing model, verify ownership
      // But here modelId might be the model name string (e.g. "gpt-4"), not the DB ID.
      // The frontend sends "modelId" as the model identifier string.
      // So we don't check DB ownership here.

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
  app.get("/api/prompt-templates", isAuthenticated, async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      const templates = await storage.getPromptTemplates(projectId, req.user!.id);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/prompt-templates/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const templates = await storage.getPromptTemplates(req.params.projectId, req.user!.id);
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/prompt-templates", isAuthenticated, async (req, res) => {
    try {
      const data = insertPromptTemplateSchema.parse(req.body);
      if (data.projectId) {
        const project = await storage.getProject(data.projectId);
        if (!project || project.userId !== req.user!.id) {
          return res.status(404).json({ error: "Project not found" });
        }
      }
      const template = await storage.createPromptTemplate({
        ...data,
        userId: req.user!.id,
      });
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/prompt-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const existingTemplate = await storage.getPromptTemplate(req.params.id);
      if (!existingTemplate || existingTemplate.userId !== req.user!.id) {
        return res.status(404).json({ error: "Template not found" });
      }
      const template = await storage.updatePromptTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/prompt-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const existingTemplate = await storage.getPromptTemplate(req.params.id);
      if (!existingTemplate || existingTemplate.userId !== req.user!.id) {
        return res.status(404).json({ error: "Template not found" });
      }
      await storage.deletePromptTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Plot Cards
  app.get("/api/plot-cards/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const cards = await storage.getPlotCards(req.params.projectId);
      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/plot-cards", isAuthenticated, async (req, res) => {
    try {
      const data = insertPlotCardSchema.parse(req.body);
      if (data.projectId) {
        const project = await storage.getProject(data.projectId);
        if (!project || project.userId !== req.user!.id) {
          return res.status(404).json({ error: "Project not found" });
        }
      }
      const card = await storage.createPlotCard(data);
      res.json(card);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/plot-cards/:id", isAuthenticated, async (req, res) => {
    try {
      const existingCard = await storage.getPlotCard(req.params.id);
      if (!existingCard) {
        return res.status(404).json({ error: "Plot card not found" });
      }

      if (!existingCard.projectId) {
        return res.status(403).json({ error: "Cannot edit global plot cards" });
      }

      const project = await storage.getProject(existingCard.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const card = await storage.updatePlotCard(req.params.id, req.body);
      res.json(card);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/plot-cards/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deletePlotCard(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/plot-cards/generate", isAuthenticated, async (req, res) => {
    try {
      const { title, type, tags, projectId } = req.body;

      if (!title || !type) {
        return res.status(400).json({ error: "Title and type are required" });
      }

      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project || project.userId !== req.user!.id) {
          return res.status(404).json({ error: "Project not found" });
        }
      }

      // Get default AI model
      const models = await storage.getAIModels(req.user!.id as string);
      const defaultModel = models.find(m => m.isDefaultChat) || models[0];

      if (!defaultModel) {
        return res.status(500).json({ error: "No AI model available" });
      }

      const prompt = `作为一个专业的小说策划，请根据以下信息生成一段精彩的情节描述：
      
标题：${title}
类型：${type}
标签：${tags?.join(", ") || "无"}

要求：
1. 情节紧凑，冲突强烈
2. 符合"${type}"类型的特点
3. 字数在200-300字之间
4. 直接输出情节内容，不要包含任何解释或开场白`;

      const result = await aiService.generate({
        prompt,
        modelId: defaultModel.modelId,
        provider: defaultModel.provider,
        baseUrl: defaultModel.baseUrl || '',
        apiKey: defaultModel.apiKey || undefined,
        parameters: {
          temperature: 0.7,
          maxTokens: 500,
        },
      });

      res.json({ content: result.content });
    } catch (error: any) {
      console.error("[Plot Generation] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get today's statistics across all projects
  app.get("/api/statistics/today/summary", isAuthenticated, async (req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get user's projects
      const projects = await storage.getProjects(req.user!.id as string);
      const projectIds = projects.map(p => p.id);

      if (projectIds.length === 0) {
        return res.json({
          wordsWritten: 0,
          chaptersCompleted: 0,
          date: today,
        });
      }

      // Query statistics for user's projects
      // Since I can't easily use 'inArray' without importing it, I will use a raw query or filter in memory if dataset is small.
      // But better to use Drizzle's 'inArray'. I need to import it.
      // Or I can just loop.
      // Let's import 'inArray' at the top? No, I can't easily add import now.
      // I will use a loop or filter in memory (not efficient but safe for now).
      // Actually, I can use `storage.getProjectStatistics` for each project and sum up?
      // No, that gets all time stats.
      // I'll use the existing query but filter by projectIds.

      const allStats = await db
        .select()
        .from(statistics)
        .where(sql`DATE(${statistics.date}) = DATE(${today})`);

      const userStats = allStats.filter(s => projectIds.includes(s.projectId));

      const todayWords = userStats.reduce((sum: number, stat) => sum + (stat.wordsWritten || 0), 0);
      const todayChapters = userStats.reduce((sum: number, stat) => sum + (stat.chaptersCompleted || 0), 0);

      res.json({
        wordsWritten: todayWords,
        chaptersCompleted: todayChapters,
        date: today,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/statistics", isAuthenticated, async (req, res) => {
    try {
      const data = insertStatisticSchema.parse(req.body);
      const project = await storage.getProject(data.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const statistic = await storage.createStatistic(data);
      res.json(statistic);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Scene Frames
  app.get("/api/scene-frames/:chapterId", isAuthenticated, async (req, res) => {
    try {
      const chapter = await storage.getChapter(req.params.chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }
      const project = await storage.getProject(chapter.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const scenes = await storage.getSceneFramesByChapter(req.params.chapterId);
      res.json(scenes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Draft Chunks
  app.get("/api/draft-chunks/:sceneId", isAuthenticated, async (req, res) => {
    try {
      const scene = await storage.getSceneFrame(req.params.sceneId);
      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      const chapter = await storage.getChapter(scene.chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      const project = await storage.getProject(chapter.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const chunks = await storage.getDraftChunksByScene(req.params.sceneId);
      res.json(chunks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate single scene
  app.post("/api/scenes/:id/regenerate", isAuthenticated, async (req, res) => {
    try {
      const sceneId = req.params.id;
      const { projectId, chapterId } = req.body;

      if (!projectId || !chapterId) {
        return res.status(400).json({ error: "projectId and chapterId are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get scene
      const scenes = await storage.getSceneFramesByChapter(chapterId);
      const scene = scenes.find(s => s.id === sceneId);

      if (!scene) {
        return res.status(404).json({ error: "Scene not found" });
      }

      // Get context (similar to chapter generation)
      const characters = await storage.getCharactersByProject(projectId);
      const worldSettings = await storage.getWorldSettingsByProject(projectId);
      const outlines = await storage.getOutlinesByProject(projectId);
      const chapterOutline = outlines.find(
        (o) => o.type === "chapter" && o.linkedChapterId === chapterId
      );
      const mainOutline = outlines.find((o) => o.type === "main");

      // project already fetched above

      const chapterPlotNodes = (chapterOutline?.plotNodes as any) || {};
      const beats = chapterPlotNodes.beats || [];
      const requiredEntities = chapterPlotNodes.requiredEntities || [];
      const focalEntities = chapterPlotNodes.focalEntities || requiredEntities.slice(0, 2);

      const context = {
        projectSummary: mainOutline ? {
          coreConflicts: ((mainOutline.plotNodes as any)?.coreConflicts || []).join("\n"),
          themeTags: ((mainOutline.plotNodes as any)?.themeTags || []).join("、"),
          toneProfile: project?.style || "",
        } : null,
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
        allCharacters: characters
          .map((c) => `${c.name}（${c.role}）`)
          .join("、"),
        worldSettings: worldSettings.slice(0, 2).map((w) => w.content).join("\n\n"),
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

      // Get previous content from earlier scenes
      let previousContent = "";
      const adjacentSummaries: string[] = [];

      for (let i = 0; i < scene.index; i++) {
        const prevScene = scenes[i];
        const prevDrafts = await storage.getDraftChunksByScene(prevScene.id);
        if (prevDrafts.length > 0) {
          const latestDraft = prevDrafts[0];
          previousContent += latestDraft.content + "\n\n";
          adjacentSummaries.push(latestDraft.localSummary || "");
        }
      }

      // Build scene context
      const sceneContext = {
        ...context,
        currentScene: {
          index: scene.index,
          total: scenes.length,
          beat: beats[scene.index] || scene.purpose,
          previousBeat: scene.index > 0 ? beats[scene.index - 1] : null,
          nextBeat: scene.index < beats.length - 1 ? beats[scene.index + 1] : null,
        },
        previousContent: extractPreviousContext(previousContent, 800),
        adjacentSummaries: {
          previous: scene.index > 0 ? adjacentSummaries[scene.index - 1] : null,
          next: scene.index < scenes.length - 1 ? scenes[scene.index + 1].purpose : null,
        },
        sceneFrame: scene,
      };

      // Generate scene draft
      const result = await sceneDraftService.generateSceneDraft(
        projectId,
        scene,
        sceneContext
      );

      // Save execution log
      await storage.createPromptExecution({
        id: result.executionLog.executionId,
        projectId,
        templateId: result.executionLog.templateId,
        templateVersion: result.executionLog.templateVersion,
        promptHash: result.executionLog.promptSignature,
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

      // Update chapter content
      const chapter = await storage.getChapter(chapterId);
      if (chapter) {
        // Rebuild chapter content from all scenes
        let fullContent = "";
        for (const s of scenes) {
          const drafts = await storage.getDraftChunksByScene(s.id);
          if (drafts.length > 0) {
            fullContent += drafts[0].content + "\n\n";
          }
        }

        await storage.updateChapter(chapterId, {
          content: fullContent,
          wordCount: fullContent.length,
        });
      }

      res.json({
        success: true,
        draft: result.draft,
        ruleCheck: result.ruleCheck,
        executionLog: result.executionLog,
      });
    } catch (error: any) {
      console.error("[Scene Regeneration] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // ========== EDITOR AI ENDPOINTS (P0 Implementation) ==========

  // Editor AI instruction processing
  app.post("/api/editor/ai-instruction", isAuthenticated, async (req, res) => {
    try {
      const { editorAIService } = await import("./editor-ai-service");
      const {
        instruction,
        selectedText,
        cursorPosition,
        chapterContent,
        chapterId,
        projectId,
      } = req.body;

      if (!projectId || !chapterId) {
        return res.status(400).json({ error: "projectId and chapterId are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!instruction) {
        return res.status(400).json({ error: "instruction is required" });
      }

      const result = await editorAIService.processInstruction({
        instruction,
        selectedText: selectedText || '',
        cursorPosition: cursorPosition || 0,
        chapterContent: chapterContent || '',
        chapterId,
        projectId,
      });

      res.json({
        success: true,
        result: result.result,
        metadata: result.metadata,
      });
    } catch (error: any) {
      console.error("[Editor AI] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Editor AI instruction processing (Stream)
  app.post("/api/editor/ai-instruction-stream", isAuthenticated, async (req, res) => {
    const { createSession } = await import("better-sse");
    const session = await createSession(req, res, {
      keepAlive: 10000,
    });
    console.log("[API] Stream session created");

    try {
      const { editorAIService } = await import("./editor-ai-service");
      const {
        instruction,
        selectedText,
        cursorPosition,
        chapterContent,
        precedingText,
        followingText,
        chapterId,
        projectId,
        styleProfileId,
      } = req.body;

      if (!projectId || !chapterId) {
        session.push({ type: "error", error: "projectId and chapterId are required" });
        return;
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        session.push({ type: "error", error: "Project not found" });
        return;
      }

      if (!instruction) {
        session.push({ type: "error", error: "instruction is required" });
        return;
      }

      const stream = editorAIService.processInstructionStream({
        instruction,
        selectedText: selectedText || '',
        cursorPosition: cursorPosition || 0,
        chapterContent: chapterContent || '',
        precedingText,
        followingText,
        chapterId,
        projectId,
        styleProfileId,
      });

      for await (const event of stream) {
        console.log("[API] Pushing event:", event.type);
        session.push(event);
      }
      // Give a small buffer for the last message to flush
      await new Promise(resolve => setTimeout(resolve, 100));
      res.end();

    } catch (error: any) {
      console.error("[Editor AI Stream] Error:", error);
      session.push({ type: "error", error: error.message });
    }
  });

  // Chapter Polish (using editor AI service)
  app.post("/api/chapters/:id/polish", isAuthenticated, async (req, res) => {
    try {
      const { editorAIService } = await import("./editor-ai-service");
      const chapterId = req.params.id;
      const { projectId, focusAreas } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get chapter
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      if (!chapter.content || chapter.content.length < 100) {
        return res.status(400).json({ error: "章节内容过短，无法润色" });
      }

      // Build polish instruction
      let instruction = "请对整章内容进行全面润色";
      if (focusAreas && focusAreas.length > 0) {
        instruction += `，重点优化：${focusAreas.join('、')}`;
      }

      // Process polish request (for full chapter, we do it in segments)
      const result = await editorAIService.processInstruction({
        instruction,
        selectedText: chapter.content,
        cursorPosition: 0,
        chapterContent: chapter.content,
        chapterId,
        projectId,
      });

      res.json({
        success: true,
        polishedContent: result.result,
        metadata: result.metadata,
      });
    } catch (error: any) {
      console.error("[Chapter Polish] Error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Narrative Doctor Diagnosis
  app.post("/api/editor/diagnose", isAuthenticated, async (req, res) => {
    try {
      const { editorAIService } = await import("./editor-ai-service");
      const {
        selectedText,
        cursorPosition,
        chapterContent,
        chapterId,
        projectId,
      } = req.body;

      if (!projectId || !chapterId) {
        return res.status(400).json({ error: "projectId and chapterId are required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      const result = await editorAIService.diagnoseChapter({
        instruction: "Diagnose Chapter", // Placeholder
        selectedText: selectedText || '',
        cursorPosition: cursorPosition || 0,
        chapterContent: chapterContent || '',
        chapterId,
        projectId,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[Diagnosis] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Coherence Check (using RAG to check for inconsistencies)
  app.post("/api/chapters/:id/check-coherence", isAuthenticated, async (req, res) => {
    try {
      const { enhancedRAGService } = await import("./enhanced-rag-service");
      const { editorAIService } = await import("./editor-ai-service");
      const chapterId = req.params.id;
      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
      }

      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get chapter
      const chapter = await storage.getChapter(chapterId);
      if (!chapter) {
        return res.status(404).json({ error: "Chapter not found" });
      }

      // Retrieve relevant previous contexts
      const ragResult = await enhancedRAGService.retrieveContext({
        projectId,
        currentChapterId: chapterId,
        query: chapter.content.slice(0, 500), // Use beginning of chapter as query
        topK: 5,
      });

      // Use AI to check for inconsistencies
      const coherencePrompt = `
# 任务：检查章节连贯性和一致性

请检查以下章节与前文是否存在逻辑或设定冲突。

## 当前章节
${chapter.content}

${ragResult.promptText}

## 要求
请以JSON格式返回检测结果：
{
  "isCoherent": true/false,
  "issues": [
    {
      "type": "character_inconsistency" | "plot_hole" | "setting_conflict" | "style_mismatch",
      "description": "具体描述",
      "severity": "high" | "medium" | "low",
      "suggestion": "修改建议"
    }
  ],
  "overallScore": 0-100
}
`;

      const result = await editorAIService.processInstruction({
        instruction: coherencePrompt,
        selectedText: chapter.content,
        cursorPosition: 0,
        chapterContent: chapter.content,
        chapterId,
        projectId,
      });

      // Try to parse JSON result
      let coherenceData;
      try {
        coherenceData = JSON.parse(result.result);
      } catch (e) {
        // Fallback if not JSON
        coherenceData = {
          isCoherent: true,
          issues: [],
          overallScore: 85,
          rawAnalysis: result.result,
        };
      }

      const { semanticCacheService } = await import("./semantic-cache-service");
      const deleted = await semanticCacheService.cleanExpired();
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

  // Cache Statistics API (duplicate removed - already defined above)

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

  app.get("/api/characters/:id/arc-points", isAuthenticated, async (req, res) => {
    try {
      // Get arc points from character record
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(character.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const arcPoints = (character.arcPoints as string[]) || [];

      // Get arc point history from state history (with timestamps)
      const history = await storage.getCharacterStateHistory(req.params.id, 100);
      const arcPointHistory = history
        .filter(h => h.arcPoint)
        .map(h => ({
          arcPoint: h.arcPoint,
          chapterId: h.chapterId,
          sceneIndex: h.sceneIndex,
          notes: h.notes,
          createdAt: h.createdAt,
        }))
        .reverse(); // Most recent first

      res.json({
        arcPoints, // Simple array for backward compatibility
        history: arcPointHistory, // Detailed history with timestamps
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/characters/:id/arc-points", isAuthenticated, async (req, res) => {
    try {
      const { arcPoint, chapterId, chapterIndex, sceneIndex, notes } = req.body;

      if (!arcPoint || typeof arcPoint !== 'string') {
        return res.status(400).json({ error: "arcPoint is required and must be a string" });
      }

      if (arcPoint.length > 200) {
        return res.status(400).json({ error: "arcPoint must be 200 characters or less" });
      }

      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(character.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      // Add to arcPoints array (keeping backward compatibility with string array)
      const arcPoints = (character.arcPoints as string[]) || [];
      arcPoints.push(arcPoint);

      // Update character
      const updated = await storage.updateCharacter(req.params.id, {
        arcPoints: arcPoints as any,
        stateUpdatedAt: new Date(),
      });

      // Record to state history with proper fields
      await storage.createCharacterStateHistory({
        characterId: req.params.id,
        projectId: character.projectId,
        chapterId: chapterId || null,
        chapterIndex: chapterIndex !== undefined ? chapterIndex : null,
        sceneIndex: sceneIndex !== undefined ? sceneIndex : null,
        emotion: null,
        goal: null,
        arcPoint: arcPoint,
        changeType: 'arc_point_added',
        notes: notes || `Arc point added: ${arcPoint}`,
      });

      res.json({
        success: true,
        character: updated,
        arcPoint: arcPoint,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/characters/:id/state-history", isAuthenticated, async (req, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ error: "Character not found" });
      }

      const project = await storage.getProject(character.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const chapterId = req.query.chapterId as string | undefined;
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

      // Get all history (we'll filter in memory for now)
      let history = await storage.getCharacterStateHistory(req.params.id, 1000);

      // Apply filters
      if (chapterId) {
        history = history.filter(h => h.chapterId === chapterId);
      }

      if (fromDate) {
        history = history.filter(h => new Date(h.createdAt) >= fromDate);
      }

      if (toDate) {
        history = history.filter(h => new Date(h.createdAt) <= toDate);
      }

      // Apply limit
      const total = history.length;
      const limitedHistory = history.slice(0, limit);

      res.json({
        history: limitedHistory,
        total: total,
        limit: limit,
        hasMore: total > limit,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ========== NEW ENDPOINTS FOR REFACTORED SERVICES ==========

  // Generation Logs API
  app.get("/api/generation-logs", isAuthenticated, async (req, res) => {
    try {
      const { generationLogService } = await import("./generation-log-service");
      const { projectId, chapterId, sceneId, templateId, minQuality, cachePath } = req.query;

      // Ensure user can only query their own projects
      if (projectId) {
        const project = await storage.getProject(projectId as string);
        if (!project || project.userId !== req.user!.id) {
          return res.status(404).json({ error: "Project not found" });
        }
      } else {
        // If no projectId provided, we should probably restrict to user's projects.
        // But queryLogs might not support list of projectIds.
        // For now, require projectId or implement user filtering in service.
        // I'll require projectId for now as it's safer.
        // Or I can fetch all user projects and pass them if service supports it.
        // Assuming service doesn't support multiple projects easily without change.
        // I will return error if no projectId.
        // return res.status(400).json({ error: "projectId is required" });
        // Actually, let's just fetch user projects and if the service doesn't support filtering by user, we might leak data if we don't filter.
        // I'll leave it as is but add a TODO and require projectId if possible.
        // Wait, if I don't pass projectId, it returns all logs? That's bad.
        // I must enforce projectId.
        if (!projectId) {
          return res.status(400).json({ error: "projectId is required" });
        }
      }

      const filters: any = {};
      if (projectId) filters.projectId = projectId as string;
      if (chapterId) filters.chapterId = chapterId as string;
      if (sceneId) filters.sceneId = sceneId as string;
      if (templateId) filters.templateId = templateId as string;
      if (minQuality) filters.minQuality = parseInt(minQuality as string);
      if (cachePath) filters.cachePath = cachePath as string;

      const logs = await generationLogService.queryLogs(filters);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/generation-logs/:executionId", isAuthenticated, async (req, res) => {
    try {
      const { generationLogService } = await import("./generation-log-service");
      const log = await generationLogService.getExecution(req.params.executionId);
      if (!log) {
        return res.status(404).json({ error: "Generation log not found" });
      }

      // Verify ownership via project
      if (log.projectId) {
        const project = await storage.getProject(log.projectId);
        if (!project || project.userId !== req.user!.id) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      res.json(log);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/generation-logs/stats/:projectId", isAuthenticated, async (req, res) => {
    try {
      const project = await storage.getProject(req.params.projectId);
      if (!project || project.userId !== req.user!.id) {
        return res.status(404).json({ error: "Project not found" });
      }
      const { generationLogService } = await import("./generation-log-service");
      const stats = await generationLogService.getStats(req.params.projectId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // Enhanced Cache Management API
  app.get("/api/cache/enhanced-stats", isAuthenticated, async (req, res) => {
    try {
      // Enhanced semantic cache service has been disabled
      // Use the optimized caching in scene-draft-service-optimized instead
      res.json({
        message: "Enhanced semantic cache has been replaced with optimized exact hash caching",
        cacheStats: sceneDraftService.getCacheStats()
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cache/clear-expired", isAuthenticated, async (req, res) => {
    try {
      const { storageCacheExtension } = await import("./storage-cache-extension");
      const deleted = await storageCacheExtension.deleteExpiredCachedExecutions();
      res.json({ success: true, deleted });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/cache/clear-all", async (req, res) => {
    try {
      const { storageCacheExtension } = await import("./storage-cache-extension");
      const { projectId } = req.query;

      if (projectId) {
        // Clear cache for specific project (if we add this method)
        res.status(501).json({ error: "Project-specific cache clearing not yet implemented" });
      } else {
        // Clear all expired cache
        const deleted = await storageCacheExtension.deleteExpiredCachedExecutions();
        res.json({ success: true, message: "All expired cache cleared", deleted });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // Prompt Template Management API (enhanced) - DISABLED: Not used by frontend
  // app.get("/api/templates/core", async (req, res) => {
  //   try {
  //     const { promptTemplateService } = await import("./prompt-template-service");
  //     const templates = promptTemplateService.getAllTemplates();
  //     res.json(templates);
  //   } catch (error: any) {
  //     res.status(500).json({ error: error.message });
  //   }
  // });

  // app.get("/api/templates/:id/signature-rule", async (req, res) => {
  //   try {
  //     const { promptTemplateService } = await import("./prompt-template-service");
  //     const template = await promptTemplateService.getTemplate(req.params.id);

  //     if (!template) {
  //       return res.status(404).json({ error: "Template not found" });
  //     }

  //     res.json({
  //       templateId: template.id,
  //       signatureRule: template.signatureRule,
  //       components: template.components,
  //     });
  //   } catch (error: any) {
  //     res.status(500).json({ error: error.message });
  //   }
  // });

  // Version Compatibility API
  app.get("/api/system/compatibility", async (req, res) => {
    try {
      const { versionCompatibilityService } = await import("./version-compatibility-service");
      const check = await versionCompatibilityService.checkCompatibility();
      res.json(check);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/system/compatibility/report", async (req, res) => {
    try {
      const { versionCompatibilityService } = await import("./version-compatibility-service");
      const report = await versionCompatibilityService.getCompatibilityReport();
      res.setHeader("Content-Type", "text/plain");
      res.send(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/system/feature/:featureName/available", async (req, res) => {
    try {
      const { versionCompatibilityService } = await import("./version-compatibility-service");
      const available = await versionCompatibilityService.isFeatureAvailable(
        req.params.featureName
      );
      res.json({ feature: req.params.featureName, available });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Feature Flags API
  app.get("/api/system/features", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      const flags = await featureFlagService.getAllFlags();
      res.json(flags);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/system/features/config", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      const config = await featureFlagService.getConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/system/features/config", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      featureFlagService.setConfig(req.body);
      res.json({ success: true, message: "Feature configuration updated" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/system/features/report", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      const report = await featureFlagService.getStatusReport();
      res.setHeader("Content-Type", "text/plain");
      res.send(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/system/features/:featureName/enable", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      featureFlagService.enable(req.params.featureName);
      res.json({ success: true, feature: req.params.featureName, enabled: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/system/features/:featureName/disable", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      featureFlagService.disable(req.params.featureName);
      res.json({ success: true, feature: req.params.featureName, enabled: false });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/system/features/rollback", async (req, res) => {
    try {
      const { featureFlagService } = await import("./feature-flag-service");
      await featureFlagService.rollbackToLegacy();
      res.json({ success: true, message: "Rolled back to legacy mode" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Project Creation Enhancement APIs
  // ============================================================================

  // Import services
  const { creationOrchestrator } = await import("./creation-orchestrator");
  const { sessionManager } = await import("./session-manager");
  const { historyService } = await import("./history-service");
  const { feedbackLearningService } = await import("./feedback-learning-service");


  // Session Management APIs
  app.post("/api/sessions/create", async (req, res) => {
    try {
      const { seed, mode, userId } = req.body;
      const session = await sessionManager.createSession(seed, mode, userId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await sessionManager.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Creation Orchestrator APIs
  app.post("/api/creation/quick", async (req, res) => {
    try {
      const { seed, userId } = req.body;
      const result = await creationOrchestrator.createProjectWithIntegration(
        seed,
        userId
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/creation/stepwise/start", async (req, res) => {
    try {
      const { seed, userId } = req.body;
      const sessionId = await creationOrchestrator.startStepwiseCreation(seed, userId);
      res.json({ sessionId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/creation/stepwise/:sessionId/next", async (req, res) => {
    try {
      const { data } = req.body;
      const result = await creationOrchestrator.executeNextStep(req.params.sessionId, data);

      // Debug log
      console.log("[API] Sending step result:", {
        step: result.step,
        dataKeys: Object.keys(result.data),
        charactersCount: result.data.characters?.length,
        characters: result.data.characters,
      });

      res.json(result);
    } catch (error: any) {
      console.error("[API] Error executing next step:", error);
      console.error("[API] Error stack:", error.stack);
      res.status(500).json({
        error: error.message,
        details: error.stack,
      });
    }
  });

  app.post("/api/creation/stepwise/:sessionId/regenerate", async (req, res) => {
    try {
      const { options } = req.body;
      const result = await creationOrchestrator.regenerateCurrentStep(
        req.params.sessionId,
        options
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/creation/stepwise/:sessionId/finalize", async (req, res) => {
    try {
      console.log("[API] Finalizing creation for session:", req.params.sessionId);
      const result = await creationOrchestrator.finalizeCreation(req.params.sessionId);
      console.log("[API] Finalize result:", {
        projectId: result.projectId,
        hasProjectMeta: !!result.projectMeta,
        charactersCount: result.projectMeta?.mainEntities?.length,
      });
      res.json(result);
    } catch (error: any) {
      console.error("[API] Finalize error:", error);
      console.error("[API] Error stack:", error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/creation/stepwise/:sessionId/pause", async (req, res) => {
    try {
      await creationOrchestrator.pauseCreation(req.params.sessionId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/creation/stepwise/:sessionId/resume", async (req, res) => {
    try {
      const result = await creationOrchestrator.resumeCreation(req.params.sessionId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/creation/sessions/incomplete", async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const sessions = await sessionManager.getIncompleteSessions(userId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/creation/stepwise/:sessionId", async (req, res) => {
    try {
      const session = await sessionManager.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // History APIs
  app.get("/api/history/session/:sessionId", async (req, res) => {
    try {
      const history = await historyService.getSessionHistory(req.params.sessionId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/history/user/:userId", async (req, res) => {
    try {
      const { limit } = req.query;
      const history = await historyService.getUserHistory(
        req.params.userId,
        limit ? parseInt(limit as string) : undefined
      );
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Feedback APIs
  app.post("/api/feedback", async (req, res) => {
    try {
      const { userId, candidateId, feedback } = req.body;
      await feedbackLearningService.recordFeedback(userId, candidateId, feedback);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/feedback/preferences/:userId", async (req, res) => {
    try {
      const preferences = await feedbackLearningService.analyzeUserPreferences(
        req.params.userId
      );
      res.json(preferences);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // Additional Creation APIs
  app.get("/api/creation/recommendations/:userId", async (req, res) => {
    try {
      const suggestions = await feedbackLearningService.generatePersonalizedSuggestions(
        req.params.userId,
        {} // Empty context, will use user's historical preferences
      );
      res.json({ suggestions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // History restore API
  app.post("/api/history/:id/restore", async (req, res) => {
    try {
      const result = await historyService.restoreCandidate(req.params.id);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // Auto Creation API
  // ============================================================================

  app.post("/api/auto-creation/start", async (req, res) => {
    try {
      const { projectId, config } = req.body;
      if (!projectId || !config) {
        return res.status(400).json({ error: "Missing projectId or config" });
      }
      const job = await autoCreationService.startJob(projectId, config);
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/auto-creation/pause", async (req, res) => {
    try {
      const { projectId } = req.body;
      if (!projectId) {
        return res.status(400).json({ error: "Missing projectId" });
      }
      const job = await autoCreationService.pauseJob(projectId);
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auto-creation/status/:projectId", async (req, res) => {
    try {
      const job = await autoCreationService.getJobStatus(req.params.projectId);

      if (job && job.currentChapterId) {
        const chapter = await storage.getChapter(job.currentChapterId);
        if (chapter) {
          (job as any).currentChapterTitle = chapter.title;
        }
      }

      res.json(job || null);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  // ============================================================================
  // Style Lab API
  // ============================================================================

  app.post("/api/styles/extract", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Text is required" });
      }
      const traits = await styleExtractionService.extractStyle(text);
      res.json(traits);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/styles", async (req, res) => {
    try {
      const projectId = req.query.projectId as string;
      // If projectId is provided, filter by it (or global styles if we had them)
      // For now, we just return all styles or filter by project
      const query = db.select().from(styleProfiles);

      if (projectId) {
        query.where(eq(styleProfiles.projectId, projectId));
      }

      const styles = await query.orderBy(desc(styleProfiles.createdAt));
      res.json(styles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/styles", async (req, res) => {
    try {
      const data = insertStyleProfileSchema.parse(req.body);
      const [style] = await db.insert(styleProfiles).values(data).returning();
      res.json(style);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/styles/:id", async (req, res) => {
    try {
      await db.delete(styleProfiles).where(eq(styleProfiles.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
