// Reference: javascript_database integration blueprint
import {
  projects,
  volumes,
  chapters,
  outlines,
  characters,
  worldSettings,
  aiModels,
  promptTemplates,
  plotCards,
  generationHistory,
  statistics,
  type Project,
  type InsertProject,
  type Volume,
  type InsertVolume,
  type Chapter,
  type InsertChapter,
  type Outline,
  type InsertOutline,
  type Character,
  type InsertCharacter,
  type WorldSetting,
  type InsertWorldSetting,
  type AIModel,
  type InsertAIModel,
  type PromptTemplate,
  type InsertPromptTemplate,
  type PlotCard,
  type InsertPlotCard,
  type GenerationHistory,
  type InsertGenerationHistory,
  type Statistic,
  type InsertStatistic,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull } from "drizzle-orm";

export interface IStorage {
  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Volumes
  getVolumesByProject(projectId: string): Promise<Volume[]>;
  createVolume(volume: InsertVolume): Promise<Volume>;
  deleteVolume(id: string): Promise<void>;

  // Chapters
  getChaptersByProject(projectId: string): Promise<Chapter[]>;
  getChapter(id: string): Promise<Chapter | undefined>;
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  updateChapter(id: string, updates: Partial<InsertChapter>): Promise<Chapter>;
  deleteChapter(id: string): Promise<void>;

  // Outlines
  getOutlinesByProject(projectId: string): Promise<Outline[]>;
  createOutline(outline: InsertOutline): Promise<Outline>;
  updateOutline(id: string, updates: Partial<InsertOutline>): Promise<Outline>;
  deleteOutline(id: string): Promise<void>;

  // Characters
  getCharactersByProject(projectId: string): Promise<Character[]>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  deleteCharacter(id: string): Promise<void>;

  // World Settings
  getWorldSettingsByProject(projectId: string): Promise<WorldSetting[]>;
  createWorldSetting(setting: InsertWorldSetting): Promise<WorldSetting>;
  deleteWorldSetting(id: string): Promise<void>;

  // AI Models
  getAIModels(): Promise<AIModel[]>;
  getAIModel(id: string): Promise<AIModel | undefined>;
  createAIModel(model: InsertAIModel): Promise<AIModel>;
  updateAIModel(id: string, updates: Partial<InsertAIModel>): Promise<AIModel>;
  deleteAIModel(id: string): Promise<void>;
  setDefaultAIModel(id: string): Promise<void>;

  // Prompt Templates
  getPromptTemplates(projectId?: string): Promise<PromptTemplate[]>;
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  deletePromptTemplate(id: string): Promise<void>;

  // Plot Cards
  getPlotCards(projectId?: string): Promise<PlotCard[]>;
  createPlotCard(card: InsertPlotCard): Promise<PlotCard>;
  deletePlotCard(id: string): Promise<void>;

  // Generation History
  getGenerationHistory(projectId: string, chapterId?: string): Promise<GenerationHistory[]>;
  createGenerationHistory(history: InsertGenerationHistory): Promise<GenerationHistory>;

  // Statistics
  getStatisticsByProject(projectId: string): Promise<Statistic[]>;
  createStatistic(statistic: InsertStatistic): Promise<Statistic>;
}

export class DatabaseStorage implements IStorage {
  // Projects
  async getProjects(): Promise<Project[]> {
    return await db.select().from(projects).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db
      .insert(projects)
      .values(insertProject)
      .returning();
    return project;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Volumes
  async getVolumesByProject(projectId: string): Promise<Volume[]> {
    return await db
      .select()
      .from(volumes)
      .where(eq(volumes.projectId, projectId))
      .orderBy(volumes.orderIndex);
  }

  async createVolume(insertVolume: InsertVolume): Promise<Volume> {
    const [volume] = await db
      .insert(volumes)
      .values(insertVolume)
      .returning();
    return volume;
  }

  async deleteVolume(id: string): Promise<void> {
    await db.delete(volumes).where(eq(volumes.id, id));
  }

  // Chapters
  async getChaptersByProject(projectId: string): Promise<Chapter[]> {
    return await db
      .select()
      .from(chapters)
      .where(eq(chapters.projectId, projectId))
      .orderBy(chapters.orderIndex);
  }

  async getChapter(id: string): Promise<Chapter | undefined> {
    const [chapter] = await db.select().from(chapters).where(eq(chapters.id, id));
    return chapter || undefined;
  }

  async createChapter(insertChapter: InsertChapter): Promise<Chapter> {
    const [chapter] = await db
      .insert(chapters)
      .values(insertChapter)
      .returning();
    return chapter;
  }

  async updateChapter(id: string, updates: Partial<InsertChapter>): Promise<Chapter> {
    const [chapter] = await db
      .update(chapters)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chapters.id, id))
      .returning();

    if (updates.wordCount !== undefined) {
      const chapterData = await this.getChapter(id);
      if (chapterData) {
        const allChapters = await this.getChaptersByProject(chapterData.projectId);
        const totalWords = allChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);
        await this.updateProject(chapterData.projectId, {
          currentWordCount: totalWords,
        });
      }
    }

    return chapter;
  }

  async deleteChapter(id: string): Promise<void> {
    await db.delete(chapters).where(eq(chapters.id, id));
  }

  // Outlines
  async getOutlinesByProject(projectId: string): Promise<Outline[]> {
    return await db
      .select()
      .from(outlines)
      .where(eq(outlines.projectId, projectId))
      .orderBy(outlines.orderIndex);
  }

  async createOutline(insertOutline: InsertOutline): Promise<Outline> {
    const [outline] = await db
      .insert(outlines)
      .values(insertOutline)
      .returning();
    return outline;
  }

  async updateOutline(id: string, updates: Partial<InsertOutline>): Promise<Outline> {
    const [outline] = await db
      .update(outlines)
      .set(updates)
      .where(eq(outlines.id, id))
      .returning();
    return outline;
  }

  async deleteOutline(id: string): Promise<void> {
    await db.delete(outlines).where(eq(outlines.id, id));
  }

  // Characters
  async getCharactersByProject(projectId: string): Promise<Character[]> {
    return await db
      .select()
      .from(characters)
      .where(eq(characters.projectId, projectId));
  }

  async createCharacter(insertCharacter: InsertCharacter): Promise<Character> {
    const [character] = await db
      .insert(characters)
      .values(insertCharacter)
      .returning();
    return character;
  }

  async deleteCharacter(id: string): Promise<void> {
    await db.delete(characters).where(eq(characters.id, id));
  }

  // World Settings
  async getWorldSettingsByProject(projectId: string): Promise<WorldSetting[]> {
    return await db
      .select()
      .from(worldSettings)
      .where(eq(worldSettings.projectId, projectId));
  }

  async createWorldSetting(insertSetting: InsertWorldSetting): Promise<WorldSetting> {
    const [setting] = await db
      .insert(worldSettings)
      .values(insertSetting)
      .returning();
    return setting;
  }

  async deleteWorldSetting(id: string): Promise<void> {
    await db.delete(worldSettings).where(eq(worldSettings.id, id));
  }

  // AI Models
  async getAIModels(): Promise<AIModel[]> {
    return await db.select().from(aiModels).orderBy(desc(aiModels.createdAt));
  }

  async getAIModel(id: string): Promise<AIModel | undefined> {
    const [model] = await db.select().from(aiModels).where(eq(aiModels.id, id));
    return model || undefined;
  }

  async createAIModel(insertModel: InsertAIModel): Promise<AIModel> {
    if (insertModel.isDefault) {
      await db
        .update(aiModels)
        .set({ isDefault: false })
        .where(eq(aiModels.isDefault, true));
    }

    const [model] = await db
      .insert(aiModels)
      .values(insertModel)
      .returning();
    return model;
  }

  async updateAIModel(id: string, updates: Partial<InsertAIModel>): Promise<AIModel> {
    const [model] = await db
      .update(aiModels)
      .set(updates)
      .where(eq(aiModels.id, id))
      .returning();
    return model;
  }

  async deleteAIModel(id: string): Promise<void> {
    await db.delete(aiModels).where(eq(aiModels.id, id));
  }

  async setDefaultAIModel(id: string): Promise<void> {
    await db
      .update(aiModels)
      .set({ isDefault: false })
      .where(eq(aiModels.isDefault, true));

    await db
      .update(aiModels)
      .set({ isDefault: true })
      .where(eq(aiModels.id, id));
  }

  // Prompt Templates
  async getPromptTemplates(projectId?: string): Promise<PromptTemplate[]> {
    if (projectId) {
      return await db
        .select()
        .from(promptTemplates)
        .where(
          and(
            eq(promptTemplates.isGlobal, false),
            eq(promptTemplates.projectId, projectId)
          )
        );
    }
    return await db
      .select()
      .from(promptTemplates)
      .where(eq(promptTemplates.isGlobal, true));
  }

  async createPromptTemplate(insertTemplate: InsertPromptTemplate): Promise<PromptTemplate> {
    const [template] = await db
      .insert(promptTemplates)
      .values(insertTemplate)
      .returning();
    return template;
  }

  async deletePromptTemplate(id: string): Promise<void> {
    await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
  }

  // Plot Cards
  async getPlotCards(projectId?: string): Promise<PlotCard[]> {
    if (projectId) {
      return await db
        .select()
        .from(plotCards)
        .where(
          and(
            eq(plotCards.isGlobal, false),
            eq(plotCards.projectId, projectId)
          )
        );
    }
    return await db
      .select()
      .from(plotCards)
      .where(eq(plotCards.isGlobal, true));
  }

  async createPlotCard(insertCard: InsertPlotCard): Promise<PlotCard> {
    const [card] = await db
      .insert(plotCards)
      .values(insertCard)
      .returning();
    return card;
  }

  async deletePlotCard(id: string): Promise<void> {
    await db.delete(plotCards).where(eq(plotCards.id, id));
  }

  // Generation History
  async getGenerationHistory(
    projectId: string,
    chapterId?: string
  ): Promise<GenerationHistory[]> {
    if (chapterId) {
      return await db
        .select()
        .from(generationHistory)
        .where(
          and(
            eq(generationHistory.projectId, projectId),
            eq(generationHistory.chapterId, chapterId)
          )
        )
        .orderBy(desc(generationHistory.createdAt));
    }
    return await db
      .select()
      .from(generationHistory)
      .where(eq(generationHistory.projectId, projectId))
      .orderBy(desc(generationHistory.createdAt));
  }

  async createGenerationHistory(insertHistory: InsertGenerationHistory): Promise<GenerationHistory> {
    const [history] = await db
      .insert(generationHistory)
      .values(insertHistory)
      .returning();
    return history;
  }

  // Statistics
  async getStatisticsByProject(projectId: string): Promise<Statistic[]> {
    return await db
      .select()
      .from(statistics)
      .where(eq(statistics.projectId, projectId))
      .orderBy(statistics.date);
  }

  async createStatistic(insertStatistic: InsertStatistic): Promise<Statistic> {
    const [statistic] = await db
      .insert(statistics)
      .values(insertStatistic)
      .returning();
    return statistic;
  }
}

export const storage = new DatabaseStorage();
