import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Layers,
  FileText,
  MoreVertical,
  Trash2,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Users,
  Sparkles
} from "lucide-react";
import { API_BASE_URL } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { generateChapterTitle } from "@/lib/number-utils";
import { AppendChaptersDialog } from "@/components/outlines/append-chapters-dialog";
import type { Chapter, Volume, Outline, SceneFrame, DraftChunk } from "@shared/schema";

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
  const [expandedVolumes, setExpandedVolumes] = useState<Set<string>>(new Set());

  // Fetch volumes
  const { data: volumes } = useQuery<Volume[]>({
    queryKey: ["/api/volumes", projectId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/volumes?projectId=${projectId}`);
      if (!res.ok) throw new Error("Failed to fetch volumes");
      return res.json();
    },
  });

  // Fetch outlines for chapter metadata
  const { data: outlines } = useQuery<Outline[]>({
    queryKey: ["/api/outlines", projectId],
  });

  const createChapterMutation = useMutation({
    mutationFn: async (volumeId?: string) => {
      // Calculate chapter number based on volume or global
      let chapterNumber: number;
      let maxOrderIndex = 0;

      if (volumeId) {
        // Volume-specific numbering: count chapters in this volume
        const volumeChapters = chapters.filter(c => c.volumeId === volumeId);
        chapterNumber = volumeChapters.length + 1;

        // Calculate orderIndex: max orderIndex in volume + 1
        if (volumeChapters.length > 0) {
          maxOrderIndex = Math.max(...volumeChapters.map(c => c.orderIndex));
        }
      } else {
        // Global numbering: count all chapters (for display purposes)
        chapterNumber = chapters.length + 1;

        // Calculate orderIndex: max orderIndex across all chapters + 1
        if (chapters.length > 0) {
          maxOrderIndex = Math.max(...chapters.map(c => c.orderIndex));
        }
      }

      return await apiRequest("POST", "/api/chapters", {
        projectId,
        volumeId: volumeId || null,
        title: generateChapterTitle(chapterNumber),
        content: "",
        orderIndex: maxOrderIndex + 1,
        wordCount: 0,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
      // Invalidate outlines as chapter creation now auto-generates outlines
      queryClient.invalidateQueries({
        queryKey: ["/api/outlines"],
        refetchType: "all"
      });
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      return await apiRequest("DELETE", `/api/chapters/${chapterId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
      // Invalidate all outline queries as chapter outlines may be affected
      queryClient.invalidateQueries({
        queryKey: ["/api/outlines"],
        refetchType: "all"
      });
    },
  });

  const toggleVolume = (volumeId: string) => {
    const newExpanded = new Set(expandedVolumes);
    if (newExpanded.has(volumeId)) {
      newExpanded.delete(volumeId);
    } else {
      newExpanded.add(volumeId);
    }
    setExpandedVolumes(newExpanded);
  };

  const sortedChapters = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedVolumes = volumes ? [...volumes].sort((a, b) => a.orderIndex - b.orderIndex) : [];

  // Group chapters by volume
  const chaptersWithoutVolume = sortedChapters.filter((c) => !c.volumeId);
  const chaptersByVolume = new Map<string, Chapter[]>();

  sortedVolumes.forEach((volume) => {
    const volumeChapters = sortedChapters.filter((c) => c.volumeId === volume.id);
    if (volumeChapters.length > 0) {
      chaptersByVolume.set(volume.id, volumeChapters);
    }
  });

  return (
    <div className="w-72 border-r border-border flex flex-col bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">章节目录</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => createChapterMutation.mutate(undefined)}
            disabled={createChapterMutation.isPending}
            data-testid="button-add-chapter"
            title="新增未分组章节"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-xs text-muted-foreground">
          {sortedVolumes.length > 0 && `${sortedVolumes.length} 卷 · `}
          {chapters.length} 章 · {chapters.reduce((sum, c) => sum + (c.wordCount || 0), 0).toLocaleString()} 字
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {sortedChapters.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                暂无章节
              </p>
              <Button
                size="sm"
                onClick={() => createChapterMutation.mutate(undefined)}
                data-testid="button-create-first-chapter"
              >
                <Plus className="h-3 w-3 mr-2" />
                创建章节
              </Button>
            </div>
          ) : (
            <>
              {/* 按卷分组显示 */}
              {sortedVolumes.map((volume) => {
                const volumeChapters = chaptersByVolume.get(volume.id) || [];
                if (volumeChapters.length === 0) return null;

                const isExpanded = expandedVolumes.has(volume.id);
                const volumeWordCount = volumeChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0);

                return (
                  <div key={volume.id} className="space-y-1">
                    <div className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors group">
                      <button
                        onClick={() => toggleVolume(volume.id)}
                        className="flex items-center gap-2 flex-1 min-w-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                        )}
                        <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-medium line-clamp-1">{volume.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {volumeChapters.length} 章 · {volumeWordCount.toLocaleString()} 字
                          </div>
                        </div>
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          createChapterMutation.mutate(volume.id);
                        }}
                        disabled={createChapterMutation.isPending}
                        title="在此卷中新增章节"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>

                      <AppendChaptersDialog
                        projectId={projectId}
                        volumeId={volume.id}
                        volumeTitle={volume.title}
                        currentChapterCount={volumeChapters.length}
                      >
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title="AI 批量追加章节"
                        >
                          <Sparkles className="h-3 w-3 text-purple-500" />
                        </Button>
                      </AppendChaptersDialog>
                    </div>

                    {isExpanded && (
                      <div className="ml-4 pl-2 border-l-2 border-muted space-y-1">
                        {volumeChapters.map((chapter) => (
                          <ChapterItem
                            key={chapter.id}
                            chapter={chapter}
                            outline={outlines?.find((o) => o.linkedChapterId === chapter.id)}
                            isSelected={selectedChapterId === chapter.id}
                            onSelect={() => onSelectChapter(chapter.id)}
                            onDelete={() => deleteChapterMutation.mutate(chapter.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 未分组的章节 */}
              {chaptersWithoutVolume.length > 0 && (
                <div className="space-y-1">
                  {sortedVolumes.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        未分组章节
                      </div>
                    </>
                  )}
                  {chaptersWithoutVolume.map((chapter) => (
                    <ChapterItem
                      key={chapter.id}
                      chapter={chapter}
                      outline={outlines?.find((o) => o.linkedChapterId === chapter.id)}
                      isSelected={selectedChapterId === chapter.id}
                      onSelect={() => onSelectChapter(chapter.id)}
                      onDelete={() => deleteChapterMutation.mutate(chapter.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// 章节项组件
function ChapterItem({
  chapter,
  outline,
  isSelected,
  onSelect,
  onDelete,
}: {
  chapter: Chapter;
  outline?: Outline;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  // Fetch scene frames
  const { data: scenes } = useQuery<SceneFrame[]>({
    queryKey: ["/api/scene-frames", chapter.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/scene-frames/${chapter.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch draft chunks for all scenes to get rule check status
  const { data: allDrafts } = useQuery<DraftChunk[]>({
    queryKey: ["/api/draft-chunks", chapter.id],
    queryFn: async () => {
      if (!scenes || scenes.length === 0) return [];

      // Fetch drafts for all scenes
      const draftPromises = scenes.map(async (scene) => {
        const res = await fetch(`${API_BASE_URL}/api/draft-chunks/${scene.id}`);
        if (!res.ok) return [];
        return res.json();
      });

      const draftsArrays = await Promise.all(draftPromises);
      return draftsArrays.flat();
    },
    enabled: !!scenes && scenes.length > 0,
  });

  const plotNodes = outline?.plotNodes as any;
  const beats = plotNodes?.beats || [];
  const requiredEntities = plotNodes?.requiredEntities || [];

  // Calculate rule check statistics
  const totalDrafts = allDrafts?.length || 0;
  const passedDrafts = allDrafts?.filter(d => d.ruleCheckPassed).length || 0;
  const failedDrafts = totalDrafts - passedDrafts;
  const totalWarnings = allDrafts?.reduce((sum, d) => {
    const warnings = d.ruleCheckWarnings as any;
    return sum + (Array.isArray(warnings) ? warnings.length : 0);
  }, 0) || 0;

  return (
    <div
      className={`group p-2.5 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-sidebar-accent" : "hover:bg-muted/50"
        }`}
      onClick={onSelect}
      data-testid={`chapter-item-${chapter.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="font-medium text-sm line-clamp-1">
              {chapter.title}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-muted-foreground">{chapter.wordCount || 0} 字</span>

            {scenes && scenes.length > 0 && (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {scenes.length} 场景
              </Badge>
            )}

            {beats.length > 0 && (
              <Badge variant="outline" className="text-xs h-4 px-1">
                {beats.length} 节拍
              </Badge>
            )}

            {/* Rule check status */}
            {totalDrafts > 0 && (
              <>
                {passedDrafts > 0 && (
                  <Badge variant="outline" className="text-xs h-4 px-1 text-green-600 border-green-600">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    {passedDrafts}
                  </Badge>
                )}
                {failedDrafts > 0 && (
                  <Badge variant="outline" className="text-xs h-4 px-1 text-red-600 border-red-600">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    {failedDrafts}
                  </Badge>
                )}
                {totalWarnings > 0 && (
                  <Badge variant="outline" className="text-xs h-4 px-1 text-yellow-600 border-yellow-600">
                    <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                    {totalWarnings}
                  </Badge>
                )}
              </>
            )}

            <Badge
              variant={statusLabels[chapter.status]?.variant || "secondary"}
              className="text-xs h-4 px-1.5"
            >
              {statusLabels[chapter.status]?.label || chapter.status}
            </Badge>
          </div>

          {outline?.content && (
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
              {outline.content.split('\n').find((line) => line.includes('概括'))?.replace(/##?\s*概括\s*/, '') || ''}
            </p>
          )}

          {requiredEntities.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Users className="h-3 w-3 text-muted-foreground shrink-0" />
              {requiredEntities.slice(0, 3).map((entity: string) => (
                <Badge key={entity} variant="secondary" className="text-xs h-4 px-1">
                  {entity}
                </Badge>
              ))}
              {requiredEntities.length > 3 && (
                <span className="text-xs text-muted-foreground">+{requiredEntities.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
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
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
