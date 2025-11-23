import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean, vector } from "drizzle-orm/pg-core";
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
  contentVector: vector("content_vector", { dimensions: 1536 }), // 章节内容向量
  version: integer("version").notNull().default(1),
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
  // Enhanced metadata fields
  promptTemplateId: varchar("prompt_template_id"),
  templateVersion: text("template_version"),
  modelUsed: text("model_used"),
  tokensUsed: integer("tokens_used"),
  cost: integer("cost"), // in cents
  qualityScore: integer("quality_score"), // 0-100
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
  // Enhanced fields for data-driven routing and configuration
  capabilities: jsonb("capabilities").default(sql`'[]'`), // e.g., ["creative_writing", "complex_reasoning"]
  timeout: integer("timeout"), // Model-specific timeout in milliseconds
  pricing: jsonb("pricing"), // {inputCostPer1M, outputCostPer1M, currency, effectiveDate}
  configVersion: integer("config_version").default(1), // Configuration version tracking
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

// Generation Logs table - comprehensive generation tracking
export const generationLogs = pgTable("generation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: varchar("execution_id").notNull().unique(),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  sceneId: varchar("scene_id").references(() => sceneFrames.id, { onDelete: "cascade" }),
  templateId: varchar("template_id").notNull(),
  templateVersion: text("template_version").notNull(),
  promptSignature: text("prompt_signature").notNull(),
  promptMetadata: jsonb("prompt_metadata").notNull(),
  modelId: text("model_id").notNull(),
  modelVersion: text("model_version").notNull(),
  params: jsonb("params").notNull(),
  routeDecision: jsonb("route_decision").notNull(),
  cachePath: text("cache_path"), // exact, semantic, template
  responseHash: text("response_hash").notNull(),
  responseSummary: text("response_summary"),
  tokensUsed: integer("tokens_used").notNull(),
  cost: integer("cost"), // in cents
  qualityScore: jsonb("quality_score"),
  ruleViolations: jsonb("rule_violations"),
  repairActions: jsonb("repair_actions"),
  // Enhanced fields for retry tracking and error details
  retryCount: integer("retry_count").default(0),
  totalDuration: integer("total_duration"), // in milliseconds
  errorType: varchar("error_type", { length: 50 }), // network, api, parse, validation, timeout, unknown
  rawResponse: text("raw_response"), // Store raw AI response for debugging
  parseErrors: jsonb("parse_errors"), // {type, message, position, suggestions}
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Cached Executions table - three-tier semantic cache
export const cachedExecutions = pgTable("cached_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: varchar("execution_id").notNull(),
  templateId: varchar("template_id").notNull(),
  semanticSignature: text("semantic_signature").notNull(), // JSON array of embedding vector
  semanticHash: text("semantic_hash").notNull(),
  promptHash: text("prompt_hash").notNull(),
  result: jsonb("result").notNull(),
  metadata: jsonb("metadata").notNull(),
  hitCount: integer("hit_count").default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Character State History table - track character state changes
export const characterStateHistory = pgTable("character_state_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
  chapterIndex: integer("chapter_index"),
  sceneIndex: integer("scene_index"),
  emotion: text("emotion"),
  goal: text("goal"),
  arcPoint: text("arc_point"),
  notes: text("notes"),
  changeType: text("change_type").notNull(), // 'emotion_change', 'goal_change', 'arc_point_added', 'manual_update'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Prompt Template Versions table - versioned prompt templates
export const promptTemplateVersions = pgTable("prompt_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: text("template_id").notNull(),
  version: text("version").notNull(),
  templateText: text("template_text").notNull(),
  components: jsonb("components").notNull(),
  exampleInputs: jsonb("example_inputs"),
  expectedOutputs: jsonb("expected_outputs"),
  signatureRule: text("signature_rule").notNull(),
  performanceMetrics: jsonb("performance_metrics"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Generation Jobs table - async chapter generation queue
export const generationJobs = pgTable("generation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  userId: varchar("user_id"), // For future multi-user support
  status: text("status").notNull().default("queued"), // queued, processing, completed, failed, cancelled
  progress: integer("progress").notNull().default(0), // 0-100
  currentScene: integer("current_scene").default(0),
  totalScenes: integer("total_scenes").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  estimatedTimeRemaining: integer("estimated_time_remaining"), // in seconds
});

// Notifications table - user notifications for async operations
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(), // For future multi-user support
  type: text("type").notNull(), // generation_started, scene_completed, generation_completed, generation_failed, progress_update
  chapterId: varchar("chapter_id").references(() => chapters.id, { onDelete: "cascade" }),
  jobId: varchar("job_id").references(() => generationJobs.id, { onDelete: "cascade" }),
  data: jsonb("data"), // Notification payload
  priority: text("priority").notNull().default("medium"), // high, medium, low
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Summaries table - hierarchical summaries for long-term memory
export const summaries = pgTable("summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  targetId: varchar("target_id").notNull(), // chapterId, volumeId, or projectId
  targetType: text("target_type").notNull(), // chapter, volume, project
  level: integer("level").notNull().default(0), // 0=chapter, 1=volume, 2=project
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  isStale: boolean("is_stale").default(false),
  contentVector: vector("content_vector", { dimensions: 1536 }), // 摘要内容向量
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Change Sets table - version control for chapters
export const changeSets = pgTable("change_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chapterId: varchar("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
  baseVersion: integer("base_version").notNull(),
  targetVersion: integer("target_version").notNull(),
  operations: jsonb("operations").notNull(), // JSON Patch operations
  author: varchar("author"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// Project Creation Enhancement Tables
// ============================================================================

// Sessions table - stores project creation session state
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"), // For future multi-user support
  mode: text("mode").notNull(), // 'quick' | 'stepwise'
  seed: jsonb("seed").notNull(), // ProjectSeed data
  currentStep: text("current_step").notNull(), // 'basic' | 'characters' | 'world' | 'outline' | 'finalize'
  stepResults: jsonb("step_results").notNull().default(sql`'{}'`), // Map<CreationStep, StepResult>
  status: text("status").notNull().default("active"), // 'active' | 'paused' | 'completed' | 'expired'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Auto-expire after 7 days
});

// Session Steps table - stores individual step results
export const sessionSteps = pgTable("session_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  step: text("step").notNull(), // 'basic' | 'characters' | 'world' | 'outline' | 'finalize'
  data: jsonb("data").notNull(), // Step-specific data
  candidates: jsonb("candidates"), // Array of ProjectMeta candidates
  selectedCandidate: jsonb("selected_candidate"), // Selected ProjectMeta
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});



// Creation History table - stores all candidate generations
export const creationHistory = pgTable("creation_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  candidate: jsonb("candidate").notNull(), // ProjectMeta
  qualityScore: jsonb("quality_score").notNull(), // QualityScore
  innovationScore: jsonb("innovation_score").notNull(), // InnovationScore
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: jsonb("metadata").notNull(), // { modelUsed, tokensUsed, generationTime }
});

// Auto Creation Jobs table - track automated writing sessions
export const autoCreationJobs = pgTable("auto_creation_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // active, paused, completed, error
  config: jsonb("config").notNull(), // { batchSize, qualityThreshold, etc. }
  currentChapterId: varchar("current_chapter_id"),
  stats: jsonb("stats").default(sql`'{"chaptersGenerated": 0, "errors": 0}'`),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Feedback table - stores user feedback on generated content
export const userFeedback = pgTable("user_feedback", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  candidateId: varchar("candidate_id").notNull(), // Reference to creation_history.id
  rating: integer("rating").notNull(), // 1-5
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`), // ['excellent', 'good', 'poor', etc.]
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User Preferences table - stores analyzed user preferences
export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  favoriteGenres: text("favorite_genres").array().notNull().default(sql`ARRAY[]::text[]`),
  favoriteStyles: text("favorite_styles").array().notNull().default(sql`ARRAY[]::text[]`),
  characterPreferences: jsonb("character_preferences").notNull().default(sql`'{}'`),
  worldPreferences: jsonb("world_preferences").notNull().default(sql`'{}'`),
  innovationTolerance: integer("innovation_tolerance").notNull().default(50), // 0-100
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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
  generationLogs: many(generationLogs),
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

export const charactersRelations = relations(characters, ({ one, many }) => ({
  project: one(projects, {
    fields: [characters.projectId],
    references: [projects.id],
  }),
  stateHistory: many(characterStateHistory),
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

export const generationLogsRelations = relations(generationLogs, ({ one }) => ({
  project: one(projects, {
    fields: [generationLogs.projectId],
    references: [projects.id],
  }),
  chapter: one(chapters, {
    fields: [generationLogs.chapterId],
    references: [chapters.id],
  }),
  scene: one(sceneFrames, {
    fields: [generationLogs.sceneId],
    references: [sceneFrames.id],
  }),
}));

export const characterStateHistoryRelations = relations(characterStateHistory, ({ one }) => ({
  character: one(characters, {
    fields: [characterStateHistory.characterId],
    references: [characters.id],
  }),
  project: one(projects, {
    fields: [characterStateHistory.projectId],
    references: [projects.id],
  }),
  chapter: one(chapters, {
    fields: [characterStateHistory.chapterId],
    references: [chapters.id],
  }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one, many }) => ({
  project: one(projects, {
    fields: [generationJobs.projectId],
    references: [projects.id],
  }),
  chapter: one(chapters, {
    fields: [generationJobs.chapterId],
    references: [chapters.id],
  }),
  notifications: many(notifications),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  chapter: one(chapters, {
    fields: [notifications.chapterId],
    references: [chapters.id],
  }),
  job: one(generationJobs, {
    fields: [notifications.jobId],
    references: [generationJobs.id],
  }),
}));

export const summariesRelations = relations(summaries, ({ one }) => ({
  project: one(projects, {
    fields: [summaries.projectId],
    references: [projects.id],
  }),
}));

export const changeSetsRelations = relations(changeSets, ({ one }) => ({
  chapter: one(chapters, {
    fields: [changeSets.chapterId],
    references: [chapters.id],
  }),
}));

// System Configuration table - environment-specific configuration
export const systemConfig = pgTable("system_config", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: jsonb("value").notNull(),
  environment: varchar("environment", { length: 50 }).notNull().default("production"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by", { length: 255 }),
});

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

export const insertCharacterSchema = createInsertSchema(characters)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    // Enhanced validation for new state tracking fields
    shortMotivation: z.string().max(200).nullable().optional(),
    currentGoal: z.string().max(200).nullable().optional(),
    currentEmotion: z.string().max(50).nullable().optional(),
    arcPoints: z.array(
      z.union([
        z.string(),
        z.object({
          content: z.string(),
          timestamp: z.string().or(z.date()).optional(),
          chapterIndex: z.number().optional()
        })
      ])
    ).nullable().optional(),
  });

export const insertWorldSettingSchema = createInsertSchema(worldSettings).omit({
  id: true,
  createdAt: true,
});

export const insertAIModelSchema = createInsertSchema(aiModels)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    // Enhanced validation for new fields
    capabilities: z.array(z.string()).nullable().optional(),
    timeout: z.number().int().positive().nullable().optional(),
    pricing: z.object({
      inputCostPer1M: z.number().nonnegative(),
      outputCostPer1M: z.number().nonnegative(),
      currency: z.string(),
      effectiveDate: z.string().datetime(),
    }).nullable().optional(),
    configVersion: z.number().int().positive().optional(),
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

export const insertGenerationLogSchema = createInsertSchema(generationLogs)
  .omit({
    id: true,
    timestamp: true,
  })
  .extend({
    // Enhanced validation for new fields
    retryCount: z.number().int().nonnegative().optional(),
    totalDuration: z.number().int().positive().nullable().optional(),
    errorType: z.enum(['network', 'api', 'parse', 'validation', 'timeout', 'unknown']).nullable().optional(),
    rawResponse: z.string().nullable().optional(),
    parseErrors: z.object({
      type: z.enum(['syntax', 'validation', 'extraction']),
      message: z.string(),
      position: z.number().int().nonnegative().optional(),
      rawContent: z.string(),
      suggestions: z.array(z.string()),
    }).nullable().optional(),
  });

export const insertCachedExecutionSchema = createInsertSchema(cachedExecutions).omit({
  id: true,
  createdAt: true,
});

export const insertAutoCreationJobSchema = createInsertSchema(autoCreationJobs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const insertCharacterStateHistorySchema = createInsertSchema(characterStateHistory).omit({
  id: true,
  createdAt: true,
});

export const insertPromptTemplateVersionSchema = createInsertSchema(promptTemplateVersions).omit({
  id: true,
  createdAt: true,
});

export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertSummarySchema = createInsertSchema(summaries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChangeSetSchema = createInsertSchema(changeSets).omit({
  id: true,
  createdAt: true,
});

// Project Creation Enhancement Insert Schemas
export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionStepSchema = createInsertSchema(sessionSteps).omit({
  id: true,
  timestamp: true,
});



export const insertCreationHistorySchema = createInsertSchema(creationHistory).omit({
  id: true,
  timestamp: true,
});

export const insertUserFeedbackSchema = createInsertSchema(userFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  updatedAt: true,
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

export type InsertPromptTemplateVersion = z.infer<typeof insertPromptTemplateVersionSchema>;
export type PromptTemplateVersion = typeof promptTemplateVersions.$inferSelect;

export type InsertGenerationLog = z.infer<typeof insertGenerationLogSchema>;
export type GenerationLog = typeof generationLogs.$inferSelect;

export type InsertCachedExecution = z.infer<typeof insertCachedExecutionSchema>;
export type CachedExecution = typeof cachedExecutions.$inferSelect;

export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobs.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertSummary = z.infer<typeof insertSummarySchema>;
export type Summary = typeof summaries.$inferSelect;
export type InsertUserFeedback = z.infer<typeof insertUserFeedbackSchema>;
export type UserFeedback = typeof userFeedback.$inferSelect;

export type InsertChangeSet = z.infer<typeof insertChangeSetSchema>;
export type ChangeSet = typeof changeSets.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

export const insertSystemConfigSchema = createInsertSchema(systemConfig);
export type InsertSystemConfig = z.infer<typeof insertSystemConfigSchema>;
export type SystemConfig = typeof systemConfig.$inferSelect;

export type Session = typeof sessions.$inferSelect;
export type SessionStep = typeof sessionSteps.$inferSelect;

export type InsertAutoCreationJob = z.infer<typeof insertAutoCreationJobSchema>;
export type AutoCreationJob = typeof autoCreationJobs.$inferSelect;
// Style Profiles table - stores extracted writing styles
export const styleProfiles = pgTable("style_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id, { onDelete: "cascade" }), // Optional, can be global or project-specific
  name: text("name").notNull(),
  description: text("description"),
  traits: jsonb("traits").notNull(), // { rhythm, vocabulary, sentenceStructure, rhetoricalDevices, tone }
  sampleTextSnippet: text("sample_text_snippet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertStyleProfileSchema = createInsertSchema(styleProfiles);
export type InsertStyleProfile = z.infer<typeof insertStyleProfileSchema>;
export type StyleProfile = typeof styleProfiles.$inferSelect;
