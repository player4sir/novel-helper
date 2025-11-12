// Chapter Creation Service
// Handles proper chapter creation with validation, numbering, and transaction handling

import { storage } from "./storage";
import type { InsertChapter, Chapter } from "@shared/schema";

export interface CreateChapterParams {
  projectId: string;
  volumeId?: string | null;
  title?: string;
  content?: string;
  status?: string;
}

export interface CreateChapterResult {
  chapter: Chapter;
  chapterNumber: number;
  orderIndex: number;
}

export class ChapterCreationService {
  /**
   * Create a new chapter with proper validation and numbering
   */
  async createChapter(params: CreateChapterParams): Promise<CreateChapterResult> {
    const { projectId, volumeId, title, content, status } = params;

    // Validate project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    // Validate volume exists if volumeId provided
    if (volumeId) {
      const volumes = await storage.getVolumesByProject(projectId);
      const volume = volumes.find((v) => v.id === volumeId);
      if (!volume) {
        throw new Error("卷不存在");
      }
    }

    // Get all chapters for this project
    const allChapters = await storage.getChaptersByProject(projectId);

    // Calculate chapter number and orderIndex
    let chapterNumber: number;
    let orderIndex: number;

    if (volumeId) {
      // Volume-specific numbering
      const volumeChapters = allChapters.filter((c) => c.volumeId === volumeId);
      chapterNumber = volumeChapters.length + 1;

      // Calculate orderIndex: max orderIndex in volume + 1
      if (volumeChapters.length > 0) {
        const maxOrderInVolume = Math.max(...volumeChapters.map((c) => c.orderIndex));
        orderIndex = maxOrderInVolume + 1;
      } else {
        // First chapter in volume: use max orderIndex across all chapters + 1
        if (allChapters.length > 0) {
          const maxOrderGlobal = Math.max(...allChapters.map((c) => c.orderIndex));
          orderIndex = maxOrderGlobal + 1;
        } else {
          orderIndex = 0;
        }
      }
    } else {
      // Ungrouped chapter: use global numbering
      const ungroupedChapters = allChapters.filter((c) => !c.volumeId);
      chapterNumber = ungroupedChapters.length + 1;

      // Calculate orderIndex: max orderIndex across all chapters + 1
      if (allChapters.length > 0) {
        const maxOrderGlobal = Math.max(...allChapters.map((c) => c.orderIndex));
        orderIndex = maxOrderGlobal + 1;
      } else {
        orderIndex = 0;
      }
    }

    // Generate default title if not provided
    const chapterTitle = title || this.generateChapterTitle(chapterNumber);

    // Create chapter
    const chapterData: InsertChapter = {
      projectId,
      volumeId: volumeId || null,
      title: chapterTitle,
      content: content || "",
      orderIndex,
      wordCount: 0,
      status: status || "draft",
      notes: null,
      hook: null,
    };

    const chapter = await storage.createChapter(chapterData);

    return {
      chapter,
      chapterNumber,
      orderIndex,
    };
  }

  /**
   * Create multiple chapters in batch (for AI generation)
   */
  async createChaptersBatch(
    projectId: string,
    volumeId: string,
    chapterData: Array<{
      title: string;
      content?: string;
      orderIndex: number;
      notes?: string;
      hook?: string;
      status?: string;
    }>
  ): Promise<Chapter[]> {
    // Validate project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    // Validate volume exists
    const volumes = await storage.getVolumesByProject(projectId);
    const volume = volumes.find((v) => v.id === volumeId);
    if (!volume) {
      throw new Error("卷不存在");
    }

    // Get existing chapters to calculate proper orderIndex offset
    const allChapters = await storage.getChaptersByProject(projectId);
    const maxOrderIndex = allChapters.length > 0 
      ? Math.max(...allChapters.map((c) => c.orderIndex))
      : -1;

    // Create chapters sequentially to ensure proper ordering
    const createdChapters: Chapter[] = [];
    
    for (let i = 0; i < chapterData.length; i++) {
      const data = chapterData[i];
      
      const chapter = await storage.createChapter({
        projectId,
        volumeId,
        title: data.title,
        content: data.content || "",
        orderIndex: maxOrderIndex + 1 + i, // Ensure sequential ordering
        wordCount: data.content?.length || 0,
        status: data.status || "draft",
        notes: data.notes || null,
        hook: data.hook || null,
      });

      createdChapters.push(chapter);
    }

    return createdChapters;
  }

  /**
   * Reorder chapters within a volume or globally
   */
  async reorderChapters(
    projectId: string,
    chapterIds: string[],
    volumeId?: string | null
  ): Promise<void> {
    // Validate project exists
    const project = await storage.getProject(projectId);
    if (!project) {
      throw new Error("项目不存在");
    }

    // Get all chapters
    const allChapters = await storage.getChaptersByProject(projectId);

    // Filter chapters to reorder
    const chaptersToReorder = volumeId
      ? allChapters.filter((c) => c.volumeId === volumeId)
      : allChapters.filter((c) => !c.volumeId);

    // Validate all chapter IDs exist
    for (const chapterId of chapterIds) {
      if (!chaptersToReorder.find((c) => c.id === chapterId)) {
        throw new Error(`章节 ${chapterId} 不存在或不属于指定的卷`);
      }
    }

    // Calculate starting orderIndex
    const otherChapters = allChapters.filter(
      (c) => !chapterIds.includes(c.id)
    );
    const maxOtherOrder = otherChapters.length > 0
      ? Math.max(...otherChapters.map((c) => c.orderIndex))
      : -1;

    // Update orderIndex for each chapter
    for (let i = 0; i < chapterIds.length; i++) {
      const chapterId = chapterIds[i];
      await storage.updateChapter(chapterId, {
        orderIndex: maxOtherOrder + 1 + i,
      });
    }
  }

  /**
   * Move chapter to different volume
   */
  async moveChapterToVolume(
    chapterId: string,
    targetVolumeId: string | null
  ): Promise<Chapter> {
    // Get chapter
    const chapter = await storage.getChapter(chapterId);
    if (!chapter) {
      throw new Error("章节不存在");
    }

    // Validate target volume exists if provided
    if (targetVolumeId) {
      const volumes = await storage.getVolumesByProject(chapter.projectId);
      const targetVolume = volumes.find((v) => v.id === targetVolumeId);
      if (!targetVolume) {
        throw new Error("目标卷不存在");
      }
    }

    // Get all chapters to calculate new orderIndex
    const allChapters = await storage.getChaptersByProject(chapter.projectId);
    
    let newOrderIndex: number;
    if (targetVolumeId) {
      // Moving to a volume: place at end of volume
      const targetVolumeChapters = allChapters.filter(
        (c) => c.volumeId === targetVolumeId
      );
      if (targetVolumeChapters.length > 0) {
        newOrderIndex = Math.max(...targetVolumeChapters.map((c) => c.orderIndex)) + 1;
      } else {
        // First chapter in volume
        const maxOrderGlobal = Math.max(...allChapters.map((c) => c.orderIndex));
        newOrderIndex = maxOrderGlobal + 1;
      }
    } else {
      // Moving to ungrouped: place at end of ungrouped chapters
      const ungroupedChapters = allChapters.filter((c) => !c.volumeId);
      if (ungroupedChapters.length > 0) {
        newOrderIndex = Math.max(...ungroupedChapters.map((c) => c.orderIndex)) + 1;
      } else {
        const maxOrderGlobal = Math.max(...allChapters.map((c) => c.orderIndex));
        newOrderIndex = maxOrderGlobal + 1;
      }
    }

    // Update chapter
    return await storage.updateChapter(chapterId, {
      volumeId: targetVolumeId,
      orderIndex: newOrderIndex,
    });
  }

  /**
   * Generate chapter title with Chinese numbering
   */
  private generateChapterTitle(chapterNumber: number): string {
    const chineseNumbers = [
      "零", "一", "二", "三", "四", "五", "六", "七", "八", "九",
      "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九",
      "二十"
    ];

    if (chapterNumber <= 20) {
      return `第${chineseNumbers[chapterNumber]}章`;
    } else if (chapterNumber < 100) {
      const tens = Math.floor(chapterNumber / 10);
      const ones = chapterNumber % 10;
      if (ones === 0) {
        return `第${chineseNumbers[tens]}十章`;
      } else {
        return `第${chineseNumbers[tens]}十${chineseNumbers[ones]}章`;
      }
    } else {
      // For numbers >= 100, use Arabic numerals
      return `第${chapterNumber}章`;
    }
  }

  /**
   * Validate chapter data before creation
   */
  private validateChapterData(data: InsertChapter): void {
    if (!data.projectId) {
      throw new Error("projectId is required");
    }
    if (!data.title || data.title.trim().length === 0) {
      throw new Error("章节标题不能为空");
    }
    if (data.orderIndex !== undefined && data.orderIndex < 0) {
      throw new Error("orderIndex must be non-negative");
    }
  }
}

export const chapterCreationService = new ChapterCreationService();
