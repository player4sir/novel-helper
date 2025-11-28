// Project Management Service
// 遵循构建创作小说应用方案.txt的设计原则：
// - 可回溯审计：所有操作记录 PromptExecution
// - 最小修复：删除前检查依赖，提供安全删除选项
// - 数据完整性：级联处理相关数据

import { storage } from "./storage";
import type { InsertProject, Project } from "@shared/schema";
import crypto from "crypto";

export interface UpdateProjectParams {
  title?: string;
  genre?: string;
  style?: string;
  targetWordCount?: number;
  status?: string;
  description?: string;
}

export interface ProjectDependencies {
  volumeCount: number;
  chapterCount: number;
  outlineCount: number;
  characterCount: number;
  worldSettingCount: number;
  totalWordCount: number;
  hasAIGeneratedContent: boolean;
}

export interface DeleteProjectResult {
  success: boolean;
  deletedItems: {
    volumes: number;
    chapters: number;
    outlines: number;
    characters: number;
    worldSettings: number;
    promptExecutions: number;
  };
  executionId: string;
}

export interface ArchiveProjectResult {
  project: Project;
  executionId: string;
}

export class ProjectManagementService {
  /**
   * 更新项目信息
   * 记录审计日志
   */
  async updateProject(
    projectId: string,
    updates: UpdateProjectParams
  ): Promise<{ project: Project; executionId: string }> {
    // 验证项目存在
    const existingProject = await storage.getProject(projectId);
    if (!existingProject) {
      throw new Error("项目不存在");
    }

    // 验证更新数据
    this.validateProjectUpdates(updates);

    // 执行更新
    const project = await storage.updateProject(projectId, updates);

    // 记录审计日志
    const executionId = this.generateExecutionId();
    await this.logProjectOperation(executionId, projectId, "update", {
      before: existingProject,
      after: project,
      updates,
    });

    return { project, executionId };
  }

  /**
   * 获取项目依赖信息
   * 用于删除前检查
   */
  async getProjectDependencies(projectId: string): Promise<ProjectDependencies> {
    const [volumes, chapters, outlines, characters, worldSettings, executions] =
      await Promise.all([
        storage.getVolumesByProject(projectId),
        storage.getChaptersByProject(projectId),
        storage.getOutlinesByProject(projectId),
        storage.getCharactersByProject(projectId),
        storage.getWorldSettingsByProject(projectId),
        storage.getPromptExecutionsByProject(projectId),
      ]);

    const totalWordCount = chapters.reduce(
      (sum, c) => sum + (c.wordCount || 0),
      0
    );

    const hasAIGeneratedContent = executions.length > 0;

    return {
      volumeCount: volumes.length,
      chapterCount: chapters.length,
      outlineCount: outlines.length,
      characterCount: characters.length,
      worldSettingCount: worldSettings.length,
      totalWordCount,
      hasAIGeneratedContent,
    };
  }

  /**
   * 归档项目（软删除）
   * 保留所有数据，仅更改状态
   */
  async archiveProject(projectId: string): Promise<ArchiveProjectResult> {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    if (project.status === "archived") {
      throw new Error("项目已归档");
    }

    // 更新状态为归档
    const archivedProject = await storage.updateProject(projectId, {
      status: "archived",
    });

    // 记录审计日志
    const executionId = this.generateExecutionId();
    await this.logProjectOperation(executionId, projectId, "archive", {
      previousStatus: project.status,
    });

    return { project: archivedProject, executionId };
  }

  /**
   * 恢复归档项目
   */
  async unarchiveProject(projectId: string): Promise<ArchiveProjectResult> {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    if (project.status !== "archived") {
      throw new Error("项目未归档");
    }

    // 恢复为活跃状态
    const restoredProject = await storage.updateProject(projectId, {
      status: "active",
    });

    // 记录审计日志
    const executionId = this.generateExecutionId();
    await this.logProjectOperation(executionId, projectId, "unarchive", {
      previousStatus: project.status,
    });

    return { project: restoredProject, executionId };
  }

  /**
   * 删除项目（硬删除）
   * 级联删除所有相关数据
   * 记录详细的删除日志
   */
  async deleteProject(
    projectId: string,
    options: { force?: boolean } = {}
  ): Promise<DeleteProjectResult> {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    // 获取依赖信息
    const dependencies = await this.getProjectDependencies(projectId);

    // 如果有内容且未强制删除，要求确认
    if (!options.force && dependencies.chapterCount > 0) {
      throw new Error(
        `项目包含 ${dependencies.chapterCount} 个章节，共 ${dependencies.totalWordCount} 字。请使用 force 选项确认删除。`
      );
    }

    // 记录删除前的状态（用于审计）
    const executionId = this.generateExecutionId();
    const deletionSnapshot = {
      project,
      dependencies,
      timestamp: new Date().toISOString(),
    };

    // 执行级联删除
    const deletedItems = {
      volumes: 0,
      chapters: 0,
      outlines: 0,
      characters: 0,
      worldSettings: 0,
      promptExecutions: 0,
    };

    try {
      // 删除卷（会级联删除章节）
      const volumes = await storage.getVolumesByProject(projectId);
      for (const volume of volumes) {
        await storage.deleteVolume(volume.id);
        deletedItems.volumes++;
      }

      // 删除章节（如果有未分组的）
      const chapters = await storage.getChaptersByProject(projectId);
      for (const chapter of chapters) {
        await storage.deleteChapter(chapter.id);
        deletedItems.chapters++;
      }

      // 删除大纲
      const outlines = await storage.getOutlinesByProject(projectId);
      for (const outline of outlines) {
        await storage.deleteOutline(outline.id);
        deletedItems.outlines++;
      }

      // 删除角色
      const characters = await storage.getCharactersByProject(projectId);
      for (const character of characters) {
        await storage.deleteCharacter(character.id);
        deletedItems.characters++;
      }

      // 删除世界设定
      const worldSettings = await storage.getWorldSettingsByProject(projectId);
      for (const setting of worldSettings) {
        await storage.deleteWorldSetting(setting.id);
        deletedItems.worldSettings++;
      }

      // 记录删除操作（在删除项目前）
      await this.logProjectOperation(executionId, projectId, "delete", {
        snapshot: deletionSnapshot,
        deletedItems,
      });

      // 最后删除项目本身
      await storage.deleteProject(projectId);

      return {
        success: true,
        deletedItems,
        executionId,
      };
    } catch (error: any) {
      // 记录删除失败
      await this.logProjectOperation(
        this.generateExecutionId(),
        projectId,
        "delete_failed",
        {
          error: error.message,
          partialDeletion: deletedItems,
        }
      );
      throw new Error(`删除项目失败: ${error.message}`);
    }
  }

  /**
   * 复制项目
   * 创建项目的完整副本（不包括AI生成历史）
   */
  async duplicateProject(
    projectId: string,
    newTitle?: string,
    options?: {
      preserveCharacterState?: boolean;
    }
  ): Promise<{ project: Project; executionId: string }> {
    const sourceProject = await storage.getProject(projectId);
    if (!sourceProject) {
      throw new Error("源项目不存在");
    }

    // 创建新项目
    const projectData: InsertProject & { userId: string } = {
      title: newTitle || `${sourceProject.title} (副本)`,
      genre: sourceProject.genre,
      style: sourceProject.style,
      targetWordCount: sourceProject.targetWordCount,
      currentWordCount: 0, // 重置字数
      status: "active",
      description: sourceProject.description,
      userId: sourceProject.userId!,
    };

    const newProject = await storage.createProject(projectData);

    // 复制大纲
    const outlines = await storage.getOutlinesByProject(projectId);
    for (const outline of outlines) {
      await storage.createOutline({
        projectId: newProject.id,
        parentId: outline.parentId,
        type: outline.type,
        title: outline.title,
        content: outline.content,
        orderIndex: outline.orderIndex,
        plotNodes: outline.plotNodes as any,
        linkedVolumeId: null,
        linkedChapterId: null,
      });
    }

    // 复制角色
    const characters = await storage.getCharactersByProject(projectId);
    for (const character of characters) {
      const characterData: any = {
        projectId: newProject.id,
        name: character.name,
        role: character.role,
        gender: character.gender,
        age: character.age,
        appearance: character.appearance,
        personality: character.personality,
        background: character.background,
        abilities: character.abilities,
        growth: character.growth,
        notes: character.notes,
      };

      // Handle state fields based on preserveCharacterState option
      if (options?.preserveCharacterState) {
        // Preserve all state fields
        characterData.shortMotivation = character.shortMotivation;
        characterData.currentEmotion = character.currentEmotion;
        characterData.currentGoal = character.currentGoal;
        characterData.arcPoints = character.arcPoints;
        characterData.relationships = character.relationships as any;
      } else {
        // Reset state fields but keep shortMotivation (core motivation)
        characterData.shortMotivation = character.shortMotivation;
        characterData.currentEmotion = null;
        characterData.currentGoal = null;
        characterData.arcPoints = [];
        characterData.relationships = {};
      }

      // Always reset position tracking fields
      characterData.lastMentioned = null;
      characterData.mentionCount = 0;
      characterData.firstAppearance = null;
      characterData.stateUpdatedAt = new Date();

      await storage.createCharacter(characterData);
    }

    // 复制世界设定
    const worldSettings = await storage.getWorldSettingsByProject(projectId);
    for (const setting of worldSettings) {
      await storage.createWorldSetting({
        projectId: newProject.id,
        category: setting.category,
        title: setting.title,
        content: setting.content,
        tags: setting.tags,
        details: setting.details as any,
      });
    }

    // 记录审计日志
    const executionId = this.generateExecutionId();
    await this.logProjectOperation(executionId, newProject.id, "duplicate", {
      sourceProjectId: projectId,
      sourceProjectTitle: sourceProject.title,
      preserveCharacterState: options?.preserveCharacterState || false,
    });

    return { project: newProject, executionId };
  }

  /**
   * 获取项目统计信息
   */
  async getProjectStatistics(projectId: string): Promise<{
    project: Project;
    dependencies: ProjectDependencies;
    recentActivity: {
      lastModified: Date;
      recentChapters: number;
      recentAIGenerations: number;
    };
  }> {
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    const dependencies = await this.getProjectDependencies(projectId);

    // 获取最近活动
    const chapters = await storage.getChaptersByProject(projectId);
    const recentChapters = chapters.filter((c) => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return c.updatedAt && new Date(c.updatedAt) > dayAgo;
    }).length;

    const executions = await storage.getPromptExecutionsByProject(projectId);
    const recentAIGenerations = executions.filter((e) => {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      return new Date(e.timestamp) > dayAgo;
    }).length;

    return {
      project,
      dependencies,
      recentActivity: {
        lastModified: project.updatedAt,
        recentChapters,
        recentAIGenerations,
      },
    };
  }

  /**
   * 验证项目更新数据
   */
  private validateProjectUpdates(updates: UpdateProjectParams): void {
    if (updates.title !== undefined && updates.title.trim().length === 0) {
      throw new Error("项目标题不能为空");
    }

    if (
      updates.targetWordCount !== undefined &&
      updates.targetWordCount < 0
    ) {
      throw new Error("目标字数不能为负数");
    }

    if (updates.status !== undefined) {
      const validStatuses = ["active", "completed", "archived"];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(
          `无效的状态值。有效值: ${validStatuses.join(", ")}`
        );
      }
    }
  }

  /**
   * 记录项目操作日志
   * 用于审计和回溯
   */
  private async logProjectOperation(
    executionId: string,
    projectId: string,
    operation: string,
    metadata: any
  ): Promise<void> {
    const promptHash = this.hashContent(
      JSON.stringify({ operation, metadata })
    );

    await storage.createPromptExecution({
      id: executionId,
      projectId,
      templateId: `project-management-${operation}`,
      templateVersion: "1.0.0",
      promptHash,
      promptMetadata: {
        operation,
        ...metadata,
      } as any,
      modelId: "system",
      modelVersion: "1.0.0",
      params: {},
      responseHash: promptHash,
      responseSummary: `Project ${operation} operation`,
      tokensUsed: 0,
      timestamp: new Date(),
      signature: null,
    });
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  private hashContent(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}

export const projectManagementService = new ProjectManagementService();
