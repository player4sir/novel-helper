import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderOpen, FileText, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import type { Chapter } from "@shared/schema";

interface ChapterSidebarProps {
  projectId: string;
  chapters: Chapter[];
  selectedChapterId: string | null;
  onSelectChapter: (chapterId: string) => void;
}

const statusLabels: Record<string, { label: string; variant: any }> = {
  draft: { label: "草稿", variant: "secondary" },
  writing: { label: "创作中", variant: "default" },
  polishing: { label: "润色中", variant: "outline" },
  completed: { label: "已完成", variant: "success" },
  published: { label: "已发布", variant: "success" },
};

export function ChapterSidebar({
  projectId,
  chapters,
  selectedChapterId,
  onSelectChapter,
}: ChapterSidebarProps) {
  const queryClient = useQueryClient();

  const createChapterMutation = useMutation({
    mutationFn: async () => {
      const nextOrder = chapters.length;
      return await apiRequest("POST", "/api/chapters", {
        projectId,
        title: `第${nextOrder + 1}章 未命名`,
        content: "",
        orderIndex: nextOrder,
        wordCount: 0,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      return await apiRequest("DELETE", `/api/chapters/${chapterId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
    },
  });

  const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="w-64 border-r border-border flex flex-col bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">章节目录</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => createChapterMutation.mutate()}
            disabled={createChapterMutation.isPending}
            data-testid="button-add-chapter"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          共 {chapters.length} 章 · {chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0).toLocaleString()} 字
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedChapters.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                暂无章节
              </p>
              <Button
                size="sm"
                onClick={() => createChapterMutation.mutate()}
                data-testid="button-create-first-chapter"
              >
                <Plus className="h-3 w-3 mr-2" />
                创建章节
              </Button>
            </div>
          ) : (
            sortedChapters.map((chapter) => (
              <div
                key={chapter.id}
                className={`group p-3 rounded-md cursor-pointer hover-elevate ${
                  selectedChapterId === chapter.id
                    ? "bg-sidebar-accent"
                    : ""
                }`}
                onClick={() => onSelectChapter(chapter.id)}
                data-testid={`chapter-item-${chapter.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-1 mb-1">
                      {chapter.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{chapter.wordCount || 0} 字</span>
                      <Badge
                        variant={statusLabels[chapter.status]?.variant || "secondary"}
                        className="text-xs py-0 px-1.5 h-5"
                      >
                        {statusLabels[chapter.status]?.label || chapter.status}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChapterMutation.mutate(chapter.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
