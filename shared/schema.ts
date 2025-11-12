import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Projects table - stores novel project information
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  genre: text("genre").notNull(), // 玄幻、都市、科幻、历史、言情等
  style: text("style"), // 写作风格
  targetWordCount: integer("target_word_count").default(0),
  currentWordCount: integer("current_word_count").default(0),
  status: text("status").notNull().default("active"), // active, completed, archived
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Volumes table - organize chapters into volumes (卷)
export const volumes = pgTable("volumes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chapters table - stores chapter content
export const chapters = pgTable("chapters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  volumeId: varchar("volume_id").references(() => volumes.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
  wordCount: integer("word_count").default(0),
  status: text("status").notNull().default("draft"), // draft, writing, polishing, completed, published
  notes: text("notes"),
  hook: text("hook"), // 章节钩子设计
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Outlines table - hierarchical outline structure (总纲-卷纲-章纲)
export const outlines = pgTable("outlines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id").references((): any => outlines.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // main(总纲), volume(卷纲), chapter(章纲)
  title: text("title").notNull(),
  content: text("content"),
  orderIndex: integer("order_index").notNull().default(0),
  plotNodes: jsonb("plot_nodes"), // 情节节点：钩子点、高潮点、转折点、伏笔点
  linkedVolumeId: varchar("linked_volume_id").references(() => volumes.id, { onDelete: "set null" }),
  linkedChapterId: varchar("linked_chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Characters table - character profiles and settings
export const characters = pgTable("characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").notNull(), // protagonist(主角), supporting(配角), antagonist(反派), group(群像)
  gender: text("gender"),
  age: text("age"),
  appearance: text("appearance"),
  personality: text("personality"),
  background: text("background"),
  abilities: text("abilities"), // 能力、金手指
  relationships: jsonb("relationships"), // 关系网络
  growth: text("growth"), // 成长轨迹
  notes: text("notes"),
  lastMentioned: jsonb("last_mentioned"), // {volumeIndex, chapterIndex, sceneIndex, position}
  mentionCount: integer("mention_count").default(0),
  firstAppearance: jsonb("first_appearance"), // {volumeIndex, chapterIndex, sceneIndex}
  // Enhanced entity state tracking
  arcPoints: jsonb("arc_points").default(sql`'[]'`), // 角色弧光点
  currentEmotion: text("current_emotion"), // 当前情感状态
  currentGoal: text("current_goal"), // 当前目标
  shortMotivation: text("short_motivation"), // 简短动机描述
  stateUpdatedAt: timestamp("state_updated_at"), // 状态更新时间
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Scene Frames table - scene decomposition for chapters
export const sceneFrames = pgTable("scene_frames", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  purpose: text("purpose").notNull(), // 场景目的
  entryStateSummary: text("entry_state_summary"),
  exitStateSummary: text("exit_state_summary"),
  focalEntities: text("focal_entities").array(), // 焦点角色
  tokensEstimate: integer("tokens_estimate"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Draft Chunks table - scene-level drafts
export const draftChunks = pgTable("draft_chunks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => sceneFrames.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mentions: text("mentions").array(), // 提及的角色
  localSummary: text("local_summary"),
  createdFromExecId: varchar("created_from_exec_id"),
  wordCount: integer("word_count"),
  ruleCheckPassed: boolean("rule_check_passed"),
  ruleCheckErrors: jsonb("rule_check_errors"),
  ruleCheckWarnings: jsonb("rule_check_warnings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Chapter Polish History table - track polish operations
export const chapterPolishHistory = pgTable("chapter_polish_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  originalContent: text("original_content").notNull(),
  polishedContent: text("polished_content").notNull(),
  changeLog: jsonb("change_log"),
  modelId: varchar("model_id"),
  tokensUsed: integer("tokens_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Coherence Issues table - track detected issues
export const coherenceIssues = pgTable("coherence_issues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // naming, timeline, contradiction, motivation_drift, etc.
  severity: text("severity").notNull(), // low, medium, high
  affectedScenes: text("affected_scenes").array(),
  evidenceSnippets: jsonb("evidence_snippets"),
  status: text("status").notNull().default("open"), // open, fixed, ignored
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Document Deltas table - version control
export const docDeltas = pgTable("doc_deltas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  baseVersionId: varchar("base_version_id"),
  patchOps: jsonb("patch_ops").notNull(), // JSON Patch operations
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by"),
});

// World settings table - world-building and power systems
export const worldSettings = pgTable("world_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // power_system(力量体系), geography(地理), faction(势力), rules(规则), items(物品)等
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").array(),
  details: jsonb("details"), // 详细设定（等级、境界、特性等）
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Models configuration table
export const aiModels = pgTable("ai_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // openai, anthropic, deepseek, zhipu, qwen, moonshot, baichuan, custom
  modelType: text("model_type").notNull(), // chat, embedding
  modelId: text("model_id").notNull(), // gpt-4, claude-3, deepseek-chat, glm-4等
  apiKey: text("api_key"), // 可选，用户可以自定义
  baseUrl: text("base_url"), // 自定义API地址
  defaultParams: jsonb("default_params"), // {temperature, max_tokens, top_p等}
  dimension: integer("dimension"), // 向量维度（仅embedding模型）
  isActive: boolean("is_active").default(true),
  isDefaultChat: boolean("is_default_chat").default(false), // 默认对话模型
  isDefaultEmbedding: boolean("is_default_embedding").default(false), // 默认向量模型
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prompt templates table
export const promptTemplates = pgTable("prompt_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(), // continue(续写), rewrite(改写), dialogue(对话), plot(情节), outline(大纲)
  template: text("template").notNull(),
  variables: text("variables").array(), // 模板变量列表
  description: text("description"),
  isGlobal: boolean("is_global").default(false), // 全局模板 vs 项目专属
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Plot cards library - reusable plot modules
export const plotCards = pgTable("plot_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull(), // 逆袭、打脸、反转、危机、高潮、铺垫
  content: text("content").notNull(),
  tags: text("tags").array(),
  isGlobal: boolean("is_global").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Generation history table - track AI generations for comparison
export const generationHistory = pgTable("generation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  modelId: varchar("model_id").references(() => aiModels.id, { onDelete: "set null" }),
  promptTemplate: text("prompt_template"),
  context: text("context"),
  generatedContent: text("generated_content").notNull(),
  parameters: jsonb("parameters"),
  wasAdopted: boolean("was_adopted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Writing statistics table
export const statistics = pgTable("statistics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  wordsWritten: integer("words_written").default(0),
  chaptersCompleted: integer("chapters_completed").default(0),
  aiGenerations: integer("ai_generations").default(0),
  writingTimeMinutes: integer("writing_time_minutes").default(0),
});

// Prompt execution logs table - for auditability and tracking
export const promptExecutions = pgTable("prompt_executions", {
  id: varchar("id").primaryKey(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull(),
  templateVersion: text("template_version").notNull(),
  promptHash: text("prompt_hash").notNull(),
  promptMetadata: jsonb("prompt_metadata").notNull(),
  modelId: text("model_id").notNull(),
  modelVersion: text("model_version").notNull(),
  params: jsonb("params").notNull(),
  responseHash: text("response_hash").notNull(),
  responseSummary: text("response_summary"),
  tokensUsed: integer("tokens_used").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  signature: text("signature"), // Optional cryptographic signature for legal evidence
});

// Relations
export const projectsRelations = relations(projects, ({ many }) => ({
  volumes: many(volumes),
  chapters: many(chapters),
  outlines: many(outlines),
  characters: many(characters),
  worldSettings: many(worldSettings),
  promptTemplates: many(promptTemplates),
  plotCards: many(plotCards),
  generationHistory: many(generationHistory),
  statistics: many(statistics),
  promptExecutions: many(promptExecutions),
}));

export const volumesRelations = relations(volumes, ({ one, many }) => ({
  project: one(projects, {
    fields: [volumes.projectId],
    references: [projects.id],
  }),
  chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  project: one(projects, {
    fields: [chapters.projectId],
    references: [projects.id],
  }),
  volume: one(volumes, {
    fields: [chapters.volumeId],
    references: [volumes.id],
  }),
  generationHistory: many(generationHistory),
}));

export const outlinesRelations = relations(outlines, ({ one, many }) => ({
  project: one(projects, {
    fields: [outlines.projectId],
    references: [projects.id],
  }),
  parent: one(outlines, {
    fields: [outlines.parentId],
    references: [outlines.id],
  }),
  children: many(outlines),
  linkedChapter: one(chapters, {
    fields: [outlines.linkedChapterId],
    references: [chapters.id],
  }),
}));

export const charactersRelations = relations(characters, ({ one }) => ({
  project: one(projects, {
    fields: [characters.projectId],
    references: [projects.id],
  }),
}));

export const sceneFramesRelations = relations(sceneFrames, ({ one, many }) => ({
  chapter: one(chapters, {
    fields: [sceneFrames.chapterId],
    references: [chapters.id],
  }),
  draftChunks: many(draftChunks),
}));

export const draftChunksRelations = relations(draftChunks, ({ one }) => ({
  sceneFrame: one(sceneFrames, {
    fields: [draftChunks.sceneId],
    references: [sceneFrames.id],
  }),
}));

export const chapterPolishHistoryRelations = relations(chapterPolishHistory, ({ one }) => ({
  chapter: one(chapters, {
    fields: [chapterPolishHistory.chapterId],
    references: [chapters.id],
  }),
}));

export const coherenceIssuesRelations = relations(coherenceIssues, ({ one }) => ({
  project: one(projects, {
    fields: [coherenceIssues.projectId],
    references: [projects.id],
  }),
  chapter: one(chapters, {
    fields: [coherenceIssues.chapterId],
    references: [chapters.id],
  }),
}));

export const docDeltasRelations = relations(docDeltas, ({ one }) => ({
  chapter: one(chapters, {
    fields: [docDeltas.chapterId],
    references: [chapters.id],
  }),
}));

export const worldSettingsRelations = relations(worldSettings, ({ one }) => ({
  project: one(projects, {
    fields: [worldSettings.projectId],
    references: [projects.id],
  }),
}));

export const promptTemplatesRelations = relations(promptTemplates, ({ one }) => ({
  project: one(projects, {
    fields: [promptTemplates.projectId],
    references: [projects.id],
  }),
}));

export const plotCardsRelations = relations(plotCards, ({ one }) => ({
  project: one(projects, {
    fields: [plotCards.projectId],
    references: [projects.id],
  }),
}));

export const generationHistoryRelations = relations(generationHistory, ({ one }) => ({
  project: one(projects, {
    fields: [generationHistory.projectId],
    references: [projects.id],
  }),
  chapter: one(chapters, {
    fields: [generationHistory.chapterId],
    references: [chapters.id],
  }),
  model: one(aiModels, {
    fields: [generationHistory.modelId],
    references: [aiModels.id],
  }),
}));

export const statisticsRelations = relations(statistics, ({ one }) => ({
  project: one(projects, {
    fields: [statistics.projectId],
    references: [projects.id],
  }),
}));

export const promptExecutionsRelations = relations(promptExecutions, ({ one }) => ({
  project: one(projects, {
    fields: [promptExecutions.projectId],
    references: [projects.id],
  }),
}));

// Insert schemas
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVolumeSchema = createInsertSchema(volumes).omit({
  id: true,
  createdAt: true,
});

export const insertChapterSchema = createInsertSchema(chapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOutlineSchema = createInsertSchema(outlines).omit({
  id: true,
  createdAt: true,
});

export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
  createdAt: true,
});

export const insertWorldSettingSchema = createInsertSchema(worldSettings).omit({
  id: true,
  createdAt: true,
});

export const insertAIModelSchema = createInsertSchema(aiModels).omit({
  id: true,
  createdAt: true,
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertPlotCardSchema = createInsertSchema(plotCards).omit({
  id: true,
  createdAt: true,
});

export const insertGenerationHistorySchema = createInsertSchema(generationHistory).omit({
  id: true,
  createdAt: true,
});

export const insertStatisticSchema = createInsertSchema(statistics).omit({
  id: true,
});

export const insertPromptExecutionSchema = createInsertSchema(promptExecutions);

export const insertSceneFrameSchema = createInsertSchema(sceneFrames).omit({
  id: true,
  createdAt: true,
});

export const insertDraftChunkSchema = createInsertSchema(draftChunks).omit({
  id: true,
  createdAt: true,
});

export const insertChapterPolishHistorySchema = createInsertSchema(chapterPolishHistory).omit({
  id: true,
  createdAt: true,
});

export const insertCoherenceIssueSchema = createInsertSchema(coherenceIssues).omit({
  id: true,
  createdAt: true,
});

export const insertDocDeltaSchema = createInsertSchema(docDeltas).omit({
  id: true,
  createdAt: true,
});

// Character State History table
export const characterStateHistory = pgTable("character_state_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  sceneIndex: integer("scene_index"),
  emotion: text("emotion"),
  goal: text("goal"),
  arcPoint: text("arc_point"), // 如果在此场景达成弧光点
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Semantic Signatures table - for caching mechanism
export const semanticSignatures = pgTable("semantic_signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: text("template_id").notNull(),
  keyInfo: text("key_info").notNull(),
  signatureHash: text("signature_hash").notNull(),
  embeddingModel: text("embedding_model"),
  draftChunkId: varchar("draft_chunk_id").references(() => draftChunks.id, { onDelete: "cascade" }),
  tokensUsed: integer("tokens_used"),
  qualityScore: integer("quality_score"), // 0-100
  reuseCount: integer("reuse_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

// Prompt Template Versions table
export const promptTemplateVersions = pgTable("prompt_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: text("template_id").notNull(),
  version: text("version").notNull(),
  modules: jsonb("modules").notNull(),
  performanceMetrics: jsonb("performance_metrics"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCharacterStateHistorySchema = createInsertSchema(characterStateHistory).omit({
  id: true,
  createdAt: true,
});

export const insertSemanticSignatureSchema = createInsertSchema(semanticSignatures).omit({
  id: true,
  createdAt: true,
});

export const insertPromptTemplateVersionSchema = createInsertSchema(promptTemplateVersions).omit({
  id: true,
  createdAt: true,
});

// Infer types
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertVolume = z.infer<typeof insertVolumeSchema>;
export type Volume = typeof volumes.$inferSelect;

export type InsertChapter = z.infer<typeof insertChapterSchema>;
export type Chapter = typeof chapters.$inferSelect;

export type InsertOutline = z.infer<typeof insertOutlineSchema>;
export type Outline = typeof outlines.$inferSelect;

export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type Character = typeof characters.$inferSelect;

export type InsertWorldSetting = z.infer<typeof insertWorldSettingSchema>;
export type WorldSetting = typeof worldSettings.$inferSelect;

export type InsertAIModel = z.infer<typeof insertAIModelSchema>;
export type AIModel = typeof aiModels.$inferSelect;

export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type PromptTemplate = typeof promptTemplates.$inferSelect;

export type InsertPlotCard = z.infer<typeof insertPlotCardSchema>;
export type PlotCard = typeof plotCards.$inferSelect;

export type InsertGenerationHistory = z.infer<typeof insertGenerationHistorySchema>;
export type GenerationHistory = typeof generationHistory.$inferSelect;

export type InsertStatistic = z.infer<typeof insertStatisticSchema>;
export type Statistic = typeof statistics.$inferSelect;

export type InsertPromptExecution = z.infer<typeof insertPromptExecutionSchema>;
export type PromptExecution = typeof promptExecutions.$inferSelect;

export type InsertSceneFrame = z.infer<typeof insertSceneFrameSchema>;
export type SceneFrame = typeof sceneFrames.$inferSelect;

export type InsertDraftChunk = z.infer<typeof insertDraftChunkSchema>;
export type DraftChunk = typeof draftChunks.$inferSelect;

export type InsertChapterPolishHistory = z.infer<typeof insertChapterPolishHistorySchema>;
export type ChapterPolishHistory = typeof chapterPolishHistory.$inferSelect;

export type InsertCoherenceIssue = z.infer<typeof insertCoherenceIssueSchema>;
export type CoherenceIssue = typeof coherenceIssues.$inferSelect;

export type InsertDocDelta = z.infer<typeof insertDocDeltaSchema>;
export type DocDelta = typeof docDeltas.$inferSelect;

export type InsertCharacterStateHistory = z.infer<typeof insertCharacterStateHistorySchema>;
export type CharacterStateHistory = typeof characterStateHistory.$inferSelect;

export type InsertSemanticSignature = z.infer<typeof insertSemanticSignatureSchema>;
export type SemanticSignature = typeof semanticSignatures.$inferSelect;

export type InsertPromptTemplateVersion = z.infer<typeof insertPromptTemplateVersionSchema>;
export type PromptTemplateVersion = typeof promptTemplateVersions.$inferSelect;
