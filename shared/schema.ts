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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  provider: text("provider").notNull(), // openai, anthropic, deepseek, custom
  modelId: text("model_id").notNull(), // gpt-5, claude-sonnet-4, deepseek-chat等
  apiKey: text("api_key"), // 可选，用户可以自定义
  baseUrl: text("base_url"), // 自定义API地址
  defaultParams: jsonb("default_params"), // {temperature, max_tokens, top_p等}
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false),
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
