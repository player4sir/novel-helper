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
  promptExecutions,
  sceneFrames,
  draftChunks,
  chapterPolishHistory,
  coherenceIssues,
  docDeltas,
  characterStateHistory,
  semanticSignatures,
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
  type PromptExecution,
  type InsertPromptExecution,
  type SceneFrame,
  type InsertSceneFrame,
  type DraftChunk,
  type InsertDraftChunk,
  type ChapterPolishHistory,
  type InsertChapterPolishHistory,
  type CoherenceIssue,
  type InsertCoherenceIssue,
  type DocDelta,
  type InsertDocDelta,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, isNull, sql } from "drizzle-orm";

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
  updateWorldSetting(id: string, updates: Partial<InsertWorldSetting>): Promise<WorldSetting>;
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
  updatePromptTemplate(id: string, updates: Partial<InsertPromptTemplate>): Promise<PromptTemplate>;
  deletePromptTemplate(id: string): Promise<void>;

  // Plot Cards
  getPlotCards(projectId?: string): Promise<PlotCard[]>;
  createPlotCard(card: InsertPlotCard): Promise<PlotCard>;
  updatePlotCard(id: string, updates: Partial<InsertPlotCard>): Promise<PlotCard>;
  deletePlotCard(id: string): Promise<void>;

  // Generation History
  getGenerationHistory(projectId: string, chapterId?: string): Promise<GenerationHistory[]>;
  createGenerationHistory(history: InsertGenerationHistory): Promise<GenerationHistory>;

  // Statistics
  getStatisticsByProject(projectId: string): Promise<Statistic[]>;
  createStatistic(statistic: InsertStatistic): Promise<Statistic>;

  // Prompt Executions
  getPromptExecutionsByProject(projectId: string): Promise<PromptExecution[]>;
  createPromptExecution(execution: InsertPromptExecution): Promise<PromptExecution>;

  // Scene Frames
  getSceneFramesByChapter(chapterId: string): Promise<SceneFrame[]>;
  getSceneFrame(id: string): Promise<SceneFrame | undefined>;
  createSceneFrame(frame: InsertSceneFrame): Promise<SceneFrame>;
  deleteSceneFramesByChapter(chapterId: string): Promise<void>;

  // Draft Chunks
  getDraftChunksByScene(sceneId: string): Promise<DraftChunk[]>;
  getDraftChunk(id: string): Promise<DraftChunk | undefined>;
  createDraftChunk(chunk: InsertDraftChunk): Promise<DraftChunk>;
  deleteDraftChunksByScene(sceneId: string): Promise<void>;

  // Chapter Polish History
  getPolishHistoryByChapter(chapterId: string): Promise<ChapterPolishHistory[]>;
  createPolishHistory(history: InsertChapterPolishHistory): Promise<ChapterPolishHistory>;

  // Coherence Issues
  getCoherenceIssuesByProject(projectId: string): Promise<CoherenceIssue[]>;
  getCoherenceIssuesByChapter(chapterId: string): Promise<CoherenceIssue[]>;
  createCoherenceIssue(issue: InsertCoherenceIssue): Promise<CoherenceIssue>;
  updateCoherenceIssue(id: string, updates: Partial<InsertCoherenceIssue>): Promise<CoherenceIssue>;

  // Document Deltas
  getDocDeltasByChapter(chapterId: string): Promise<DocDelta[]>;
  createDocDelta(delta: InsertDocDelta): Promise<DocDelta>;

  // Character State History
  getCharacterStateHistory(characterId: string): Promise<any[]>;
  createCharacterStateHistory(history: any): Promise<any>;

  // Semantic Signatures
  findSimilarSignatures(templateId: string, signatureHash: string): Promise<any[]>;
  createSemanticSignature(signature: any): Promise<any>;
  updateSignatureUsage(signatureId: string): Promise<void>;

  // Character Entity Tracking
  getCharacter(id: string): Promise<Character | undefined>;
  updateCharacter(id: string, updates: any): Promise<Character>;
  updateCharacterTracking(
    id: string,
    updates: {
      lastMentioned?: any;
      mentionCount?: number;
      firstAppearance?: any;
    }
  ): Promise<Character>;
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

  async updateWorldSetting(id: string, updates: Partial<InsertWorldSetting>): Promise<WorldSetting> {
    const [setting] = await db
      .update(worldSettings)
      .set(updates)
      .where(eq(worldSettings.id, id))
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
    // 如果设置为默认，先清除同类型的其他默认模型
    if (insertModel.isDefaultChat) {
      await db
        .update(aiModels)
        .set({ isDefaultChat: false })
        .where(and(eq(aiModels.modelType, "chat"), eq(aiModels.isDefaultChat, true)));
    }
    if (insertModel.isDefaultEmbedding) {
      await db
        .update(aiModels)
        .set({ isDefaultEmbedding: false })
        .where(and(eq(aiModels.modelType, "embedding"), eq(aiModels.isDefaultEmbedding, true)));
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
    // 获取模型信息以确定类型
    const [model] = await db.select().from(aiModels).where(eq(aiModels.id, id));
    if (!model) {
      throw new Error("Model not found");
    }

    // 根据模型类型清除对应的默认标记
    if (model.modelType === "chat") {
      await db
        .update(aiModels)
        .set({ isDefaultChat: false })
        .where(and(eq(aiModels.modelType, "chat"), eq(aiModels.isDefaultChat, true)));

      await db
        .update(aiModels)
        .set({ isDefaultChat: true })
        .where(eq(aiModels.id, id));
    } else if (model.modelType === "embedding") {
      await db
        .update(aiModels)
        .set({ isDefaultEmbedding: false })
        .where(and(eq(aiModels.modelType, "embedding"), eq(aiModels.isDefaultEmbedding, true)));

      await db
        .update(aiModels)
        .set({ isDefaultEmbedding: true })
        .where(eq(aiModels.id, id));
    }
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

  async updatePromptTemplate(id: string, updates: Partial<InsertPromptTemplate>): Promise<PromptTemplate> {
    const [template] = await db
      .update(promptTemplates)
      .set(updates)
      .where(eq(promptTemplates.id, id))
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

  async updatePlotCard(id: string, updates: Partial<InsertPlotCard>): Promise<PlotCard> {
    const [card] = await db
      .update(plotCards)
      .set(updates)
      .where(eq(plotCards.id, id))
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

  // Prompt Executions
  async getPromptExecutionsByProject(projectId: string): Promise<PromptExecution[]> {
    return await db
      .select()
      .from(promptExecutions)
      .where(eq(promptExecutions.projectId, projectId))
      .orderBy(desc(promptExecutions.timestamp));
  }

  async createPromptExecution(insertExecution: InsertPromptExecution): Promise<PromptExecution> {
    const [execution] = await db
      .insert(promptExecutions)
      .values(insertExecution)
      .returning();
    return execution;
  }

  // Scene Frames
  async getSceneFramesByChapter(chapterId: string): Promise<SceneFrame[]> {
    return await db
      .select()
      .from(sceneFrames)
      .where(eq(sceneFrames.chapterId, chapterId))
      .orderBy(sceneFrames.index);
  }

  async getSceneFrame(id: string): Promise<SceneFrame | undefined> {
    const [frame] = await db.select().from(sceneFrames).where(eq(sceneFrames.id, id));
    return frame || undefined;
  }

  async createSceneFrame(frame: InsertSceneFrame): Promise<SceneFrame> {
    const [created] = await db.insert(sceneFrames).values(frame).returning();
    return created;
  }

  async deleteSceneFramesByChapter(chapterId: string): Promise<void> {
    await db.delete(sceneFrames).where(eq(sceneFrames.chapterId, chapterId));
  }

  // Draft Chunks
  async getDraftChunksByScene(sceneId: string): Promise<DraftChunk[]> {
    return await db
      .select()
      .from(draftChunks)
      .where(eq(draftChunks.sceneId, sceneId))
      .orderBy(desc(draftChunks.createdAt));
  }

  async getDraftChunk(id: string): Promise<DraftChunk | undefined> {
    const [chunk] = await db.select().from(draftChunks).where(eq(draftChunks.id, id));
    return chunk || undefined;
  }

  async createDraftChunk(chunk: InsertDraftChunk): Promise<DraftChunk> {
    const [created] = await db.insert(draftChunks).values(chunk).returning();
    return created;
  }

  async deleteDraftChunksByScene(sceneId: string): Promise<void> {
    await db.delete(draftChunks).where(eq(draftChunks.sceneId, sceneId));
  }

  // Chapter Polish History
  async getPolishHistoryByChapter(chapterId: string): Promise<ChapterPolishHistory[]> {
    return await db
      .select()
      .from(chapterPolishHistory)
      .where(eq(chapterPolishHistory.chapterId, chapterId))
      .orderBy(desc(chapterPolishHistory.createdAt));
  }

  async createPolishHistory(history: InsertChapterPolishHistory): Promise<ChapterPolishHistory> {
    const [created] = await db.insert(chapterPolishHistory).values(history).returning();
    return created;
  }

  // Coherence Issues
  async getCoherenceIssuesByProject(projectId: string): Promise<CoherenceIssue[]> {
    return await db
      .select()
      .from(coherenceIssues)
      .where(eq(coherenceIssues.projectId, projectId))
      .orderBy(desc(coherenceIssues.createdAt));
  }

  async getCoherenceIssuesByChapter(chapterId: string): Promise<CoherenceIssue[]> {
    return await db
      .select()
      .from(coherenceIssues)
      .where(eq(coherenceIssues.chapterId, chapterId))
      .orderBy(desc(coherenceIssues.createdAt));
  }

  async createCoherenceIssue(issue: InsertCoherenceIssue): Promise<CoherenceIssue> {
    const [created] = await db.insert(coherenceIssues).values(issue).returning();
    return created;
  }

  async updateCoherenceIssue(
    id: string,
    updates: Partial<InsertCoherenceIssue>
  ): Promise<CoherenceIssue> {
    const [updated] = await db
      .update(coherenceIssues)
      .set(updates)
      .where(eq(coherenceIssues.id, id))
      .returning();
    return updated;
  }

  // Document Deltas
  async getDocDeltasByChapter(chapterId: string): Promise<DocDelta[]> {
    return await db
      .select()
      .from(docDeltas)
      .where(eq(docDeltas.chapterId, chapterId))
      .orderBy(desc(docDeltas.createdAt));
  }

  async createDocDelta(delta: InsertDocDelta): Promise<DocDelta> {
    const [created] = await db.insert(docDeltas).values(delta).returning();
    return created;
  }

  // Character State History
  async getCharacterStateHistory(characterId: string): Promise<any[]> {
    return await db
      .select()
      .from(characterStateHistory)
      .where(eq(characterStateHistory.characterId, characterId))
      .orderBy(desc(characterStateHistory.createdAt));
  }

  async createCharacterStateHistory(history: any): Promise<any> {
    const [created] = await db
      .insert(characterStateHistory)
      .values(history)
      .returning();
    return created;
  }

  // Semantic Signatures
  async findSimilarSignatures(
    templateId: string,
    signatureHash: string
  ): Promise<any[]> {
    return await db
      .select()
      .from(semanticSignatures)
      .where(
        and(
          eq(semanticSignatures.templateId, templateId),
          eq(semanticSignatures.signatureHash, signatureHash)
        )
      )
      .orderBy(desc(semanticSignatures.qualityScore))
      .limit(5);
  }

  async createSemanticSignature(signature: any): Promise<any> {
    const [created] = await db
      .insert(semanticSignatures)
      .values(signature)
      .returning();
    return created;
  }

  async updateSignatureUsage(signatureId: string): Promise<void> {
    await db
      .update(semanticSignatures)
      .set({
        reuseCount: sql`${semanticSignatures.reuseCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(semanticSignatures.id, signatureId));
  }

  // Character Entity Tracking
  async getCharacter(id: string): Promise<Character | undefined> {
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, id));
    return character || undefined;
  }

  async updateCharacter(id: string, updates: any): Promise<Character> {
    const [updated] = await db
      .update(characters)
      .set(updates)
      .where(eq(characters.id, id))
      .returning();
    return updated;
  }

  async updateCharacterTracking(
    id: string,
    updates: {
      lastMentioned?: any;
      mentionCount?: number;
      firstAppearance?: any;
    }
  ): Promise<Character> {
    const [updated] = await db
      .update(characters)
      .set(updates)
      .where(eq(characters.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
