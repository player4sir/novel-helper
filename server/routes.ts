import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { aiService } from "./ai-service";
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

  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const project = await storage.updateProject(req.params.id, req.body);
      res.json(project);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      await storage.deleteProject(req.params.id);
      res.json({ success: true });
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
      const data = insertChapterSchema.parse(req.body);
      const chapter = await storage.createChapter(data);
      res.json(chapter);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/chapters/:id", async (req, res) => {
    try {
      const chapter = await storage.updateChapter(req.params.id, req.body);
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

  app.post("/api/statistics", async (req, res) => {
    try {
      const data = insertStatisticSchema.parse(req.body);
      const statistic = await storage.createStatistic(data);
      res.json(statistic);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
