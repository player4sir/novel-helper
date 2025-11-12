import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  BookOpen, 
  Layers, 
  FileEdit,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { generateChapterTitle } from "@/lib/number-utils";
import { GenerateVolumesDialog } from "@/components/outlines/generate-volumes-dialog";
import { GenerateChaptersDialog } from "@/components/outlines/generate-chapters-dialog";
import type { Project, Outline, Volume, Chapter } from "@shared/schema";

const outlineTypes = {
  main: { label: "总纲", color: "primary" },
  volume: { label: "卷纲", color: "secondary" },
  chapter: { label: "章纲", color: "outline" },
};

export default function Outlines() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: outlines } = useQuery<Outline[]>({
    queryKey: ["/api/outlines", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const { data: volumes } = useQuery<Volume[]>({
    queryKey: ["/api/volumes", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const response = await fetch(`/api/volumes?projectId=${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch volumes");
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  const { data: chapters } = useQuery<Chapter[]>({
    queryKey: ["/api/chapters", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const createOutlineMutation = useMutation({
    mutationFn: async (data: { type: string; title: string; parentId?: string }) => {
      return await apiRequest("POST", "/api/outlines", {
        projectId: selectedProjectId,
        ...data,
        content: "",
        orderIndex: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlines", selectedProjectId] });
    },
  });

  const deleteOutlineMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/outlines/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlines", selectedProjectId] });
    },
  });

  const createChapterMutation = useMutation({
    mutationFn: async (volumeId: string) => {
      const volumeChapters = chapters?.filter(c => c.volumeId === volumeId) || [];
      const chapterNumber = volumeChapters.length + 1;
      
      // Calculate orderIndex: max orderIndex in volume + 1
      let maxOrderIndex = 0;
      if (volumeChapters.length > 0) {
        maxOrderIndex = Math.max(...volumeChapters.map(c => c.orderIndex));
      }
      
      return await apiRequest("POST", "/api/chapters", {
        projectId: selectedProjectId,
        volumeId,
        title: generateChapterTitle(chapterNumber),
        content: "",
        orderIndex: maxOrderIndex + 1,
        wordCount: 0,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", selectedProjectId] });
    },
  });

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  // 获取总纲
  const mainOutline = outlines?.find((o) => o.type === "main");
  
  // 获取卷纲（按orderIndex排序）
  const volumeOutlines = outlines?.filter((o) => o.type === "volume").sort((a, b) => a.orderIndex - b.orderIndex) || [];
  
  // 获取章纲（按orderIndex排序）
  const chapterOutlines = outlines?.filter((o) => o.type === "chapter").sort((a, b) => a.orderIndex - b.orderIndex) || [];

  // 渲染总纲节点
  const renderMainOutline = () => {
    if (!mainOutline) return null;
    const isExpanded = expandedNodes.has(mainOutline.id);

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors group">
          <button
            onClick={() => toggleNode(mainOutline.id)}
            className="shrink-0 hover:bg-primary/20 rounded p-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{mainOutline.title}</span>
              <Badge variant="default" className="text-xs">总纲</Badge>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              deleteOutlineMutation.mutate(mainOutline.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        
        {isExpanded && mainOutline.content && (
          <div className="ml-6 pl-4 border-l-2 border-primary/20">
            <div className="text-sm text-muted-foreground whitespace-pre-wrap p-3 bg-muted/30 rounded-md">
              {mainOutline.content}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 渲染卷纲节点
  const renderVolumeOutline = (volumeOutline: Outline, index: number) => {
    // 优先使用linkedVolumeId，如果不存在则通过title匹配，最后fallback到outline.id
    const volumeId = volumeOutline.linkedVolumeId || 
                     volumes?.find((v) => v.title === volumeOutline.title)?.id ||
                     volumeOutline.id;
    
    // 获取该卷的章节（通过volumeId或通过章节大纲的parentId）
    const volumeChapters = volumeId 
      ? chapters?.filter((c) => c.volumeId === volumeId).sort((a, b) => a.orderIndex - b.orderIndex) || []
      : [];
    
    const isExpanded = expandedNodes.has(volumeOutline.id);
    
    // 提取元数据
    const plotNodes = volumeOutline.plotNodes as any;
    const themeTags = plotNodes?.themeTags || [];
    const conflictFocus = plotNodes?.conflictFocus || "";
    const beats = plotNodes?.beats || [];

    return (
      <div key={volumeOutline.id} className="space-y-2">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-950/30 transition-colors group">
          <button
            onClick={() => toggleNode(volumeOutline.id)}
            className="shrink-0 hover:bg-blue-200 dark:hover:bg-blue-900 rounded p-1"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <div 
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => toggleNode(volumeOutline.id)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{volumeOutline.title}</span>
              <Badge variant="secondary" className="text-xs">
                {volumeChapters.length} 章
              </Badge>
              {beats.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {beats.length} 节拍
                </Badge>
              )}
              {themeTags.length > 0 && themeTags.slice(0, 2).map((tag: string) => (
                <Badge key={tag} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30">
                  {tag}
                </Badge>
              ))}
            </div>
            {volumeOutline.content && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {volumeOutline.content.split('\n')[0]}
              </p>
            )}
            {conflictFocus && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                冲突：{conflictFocus}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={(e) => {
                e.stopPropagation();
                createChapterMutation.mutate(volumeId || volumeOutline.id);
              }}
              disabled={createChapterMutation.isPending}
              title="手动新增章节"
            >
              <Plus className="h-3 w-3 mr-1" />
              新增章节
            </Button>
            <GenerateChaptersDialog
              projectId={selectedProjectId}
              volumeId={volumeId || volumeOutline.id}
              volumeTitle={volumeOutline.title}
            >
              <Button size="sm" variant="outline" className="text-xs h-7">
                <Sparkles className="h-3 w-3 mr-1" />
                AI生成
              </Button>
            </GenerateChaptersDialog>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                deleteOutlineMutation.mutate(volumeOutline.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-6 pl-4 border-l-2 border-blue-200 dark:border-blue-900 space-y-2">
            {/* 显示卷的详细信息 */}
            {(beats.length > 0 || themeTags.length > 2) && (
              <div className="p-3 bg-muted/30 rounded-md text-xs space-y-2">
                {beats.length > 0 && (
                  <div>
                    <span className="font-medium text-muted-foreground">核心节拍：</span>
                    <ul className="mt-1 space-y-1 list-disc list-inside">
                      {beats.map((beat: string, i: number) => (
                        <li key={i} className="text-muted-foreground">{beat}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {themeTags.length > 2 && (
                  <div>
                    <span className="font-medium text-muted-foreground">主题标签：</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {themeTags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {volumeChapters.length > 0 ? (
              <div className="space-y-1">
                {volumeChapters.map((chapter) => {
                  const chapterOutline = chapterOutlines.find(
                    (o) => o.linkedChapterId === chapter.id
                  );
                  return renderChapterItem(chapter, chapterOutline);
                })}
              </div>
            ) : (
              <div className="p-4 bg-muted/30 rounded-lg border border-dashed text-center">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-3">
                  该卷暂无章节，使用AI快速生成
                </p>
                <GenerateChaptersDialog
                  projectId={selectedProjectId}
                  volumeId={volumeId}
                  volumeTitle={volumeOutline.title}
                >
                  <Button size="sm" variant="outline">
                    <Plus className="h-3 w-3 mr-1" />
                    生成章节
                  </Button>
                </GenerateChaptersDialog>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染章节节点
  const renderChapterItem = (chapter: Chapter, chapterOutline?: Outline) => {
    return (
      <ChapterItem 
        key={chapter.id} 
        chapter={chapter} 
        chapterOutline={chapterOutline}
        onDelete={(id) => deleteOutlineMutation.mutate(id)}
      />
    );
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">大纲管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理小说的总纲、卷纲和章纲
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedProjectId && (
            <GenerateVolumesDialog projectId={selectedProjectId} />
          )}
          <Button
            onClick={() =>
              createOutlineMutation.mutate({
                type: "main",
                title: "新建大纲",
              })
            }
            disabled={!selectedProjectId}
            variant="outline"
            data-testid="button-create-outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            新建大纲
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-64">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger data-testid="select-project-outlines">
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProjectId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">大纲结构</CardTitle>
            <CardDescription className="text-xs">
              树形展示总纲、卷纲和章纲的层级关系
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!mainOutline && volumeOutlines.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无大纲</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  创建总纲或使用AI生成卷纲开始规划故事结构
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() =>
                      createOutlineMutation.mutate({
                        type: "main",
                        title: "总纲",
                      })
                    }
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建总纲
                  </Button>
                  <GenerateVolumesDialog projectId={selectedProjectId}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      AI生成卷纲
                    </Button>
                  </GenerateVolumesDialog>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* 总纲 */}
                {mainOutline && renderMainOutline()}
                
                {/* 卷纲列表 */}
                {volumeOutlines.map((volumeOutline, index) =>
                  renderVolumeOutline(volumeOutline, index)
                )}
                
                {/* 空状态提示 */}
                {!mainOutline && volumeOutlines.length > 0 && (
                  <div className="p-3 bg-muted/30 rounded-lg border border-dashed">
                    <p className="text-xs text-muted-foreground text-center">
                      建议创建总纲以完善项目结构
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 ml-2 underline"
                        onClick={() =>
                          createOutlineMutation.mutate({
                            type: "main",
                            title: "总纲",
                          })
                        }
                      >
                        立即创建
                      </Button>
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以查看和管理大纲
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// 章节项组件
function ChapterItem({ 
  chapter, 
  chapterOutline,
  onDelete 
}: { 
  chapter: Chapter; 
  chapterOutline?: Outline;
  onDelete: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // 提取章节元数据
  const plotNodes = chapterOutline?.plotNodes as any;
  const requiredEntities = plotNodes?.requiredEntities || [];
  const focalEntities = plotNodes?.focalEntities || [];
  const stakesDelta = plotNodes?.stakesDelta || "";
  const beats = plotNodes?.beats || [];

    return (
      <div key={chapter.id} className="space-y-1">
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-background border hover:bg-muted/50 transition-colors group">
          {chapterOutline && (beats.length > 0 || requiredEntities.length > 0) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="shrink-0 hover:bg-muted rounded p-0.5"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">{chapter.title}</span>
              <span className="text-xs text-muted-foreground">
                {chapter.wordCount || 0} 字
              </span>
              {beats.length > 0 && (
                <Badge variant="outline" className="text-xs h-4">
                  {beats.length} 场景
                </Badge>
              )}
              {focalEntities.length > 0 && focalEntities.slice(0, 2).map((entity: string) => (
                <Badge key={entity} variant="secondary" className="text-xs h-4">
                  {entity}
                </Badge>
              ))}
            </div>
            {chapterOutline?.content && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {chapterOutline.content.split('\n')[0]}
              </p>
            )}
            {stakesDelta && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                {stakesDelta}
              </p>
            )}
          </div>
          {chapterOutline && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chapterOutline.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* 展开显示章节详细信息 */}
        {isExpanded && chapterOutline && (
          <div className="ml-8 p-2 bg-muted/20 rounded-md text-xs space-y-1.5">
            {beats.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">场景节拍：</span>
                <ul className="mt-0.5 space-y-0.5 list-disc list-inside">
                  {beats.map((beat: string, i: number) => (
                    <li key={i} className="text-muted-foreground">{beat}</li>
                  ))}
                </ul>
              </div>
            )}
            {requiredEntities.length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground">必需角色：</span>
                <span className="ml-1 text-muted-foreground">{requiredEntities.join("、")}</span>
              </div>
            )}
            {plotNodes?.entryState && (
              <div>
                <span className="font-medium text-muted-foreground">入场状态：</span>
                <span className="ml-1 text-muted-foreground">{plotNodes.entryState}</span>
              </div>
            )}
            {plotNodes?.exitState && (
              <div>
                <span className="font-medium text-muted-foreground">出场状态：</span>
                <span className="ml-1 text-muted-foreground">{plotNodes.exitState}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

