import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Save,
  BookOpen,
  FileText,
  TrendingUp,
  Target,
  Users,
  Clock,
  Stethoscope
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SummaryPanel } from "./summary-panel";
import { VersionHistoryPanel } from "./version-history-panel";
import { QualityDashboard } from "../quality-dashboard";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Chapter, Outline, Character } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/queryClient";

interface EditorPanelProps {
  project: Project;
  chapter: Chapter | undefined;
  bottomActions?: React.ReactNode;
}

export interface EditorPanelHandle {
  getContent: () => string;
  getSelection: () => { start: number; end: number; text: string };
  insertContent: (text: string, range?: { start: number; end: number }) => void;
  appendContent: (text: string) => void;
}

export const EditorPanel = forwardRef<EditorPanelHandle, EditorPanelProps>(({ project, chapter, bottomActions }, ref) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [initialWordCount, setInitialWordCount] = useState(0);

  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isApplyingSuggestion, setIsApplyingSuggestion] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    getContent: () => content,
    getSelection: () => {
      if (!textareaRef.current) return { start: 0, end: 0, text: "" };
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      return {
        start: selectionStart,
        end: selectionEnd,
        text: value.substring(selectionStart, selectionEnd),
      };
    },
    insertContent: (text: string, range?: { start: number; end: number }) => {
      console.log("[EditorPanel] insertContent called with text length:", text.length, "range:", range);
      if (!textareaRef.current) {
        console.error("[EditorPanel] textareaRef is null!");
        return;
      }
      const textarea = textareaRef.current;
      const start = range ? range.start : textarea.selectionStart;
      const end = range ? range.end : textarea.selectionEnd;
      console.log("[EditorPanel] Insertion range:", start, "-", end);
      setContent((prevContent) => {
        console.log("[EditorPanel] Updating content. Prev length:", prevContent.length, "Insert text:", text);
        const newContent = prevContent.substring(0, start) + text + prevContent.substring(end);
        return newContent;
      });
      setHasChanges(true);

      // Restore focus and cursor
      setTimeout(() => {
        textarea.focus();
        // Set cursor to the START of the inserted text so user can read from beginning
        // Or select the inserted text? Let's just place cursor at start for now to avoid "jumping to bottom"
        textarea.setSelectionRange(start, start);

        // Optional: Scroll to the cursor position explicitly
        const lineHeight = 24; // Approximate line height
        const linesBefore = content.substring(0, start).split('\n').length;
        const scrollPos = (linesBefore - 2) * lineHeight; // Scroll a bit above
        if (scrollPos > 0) {
          // This is a rough estimate, browser usually handles scroll on focus/selection
          // But if we want to prevent "jumping to bottom", setting cursor at start is key.
        }
      }, 0);
    },
    appendContent: (text: string) => {
      setContent(prev => prev + text);
      setHasChanges(true);

      // Scroll to bottom
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        setTimeout(() => {
          textarea.scrollTop = textarea.scrollHeight;
        }, 0);
      }
    }
  }));

  // Fetch chapter outline
  const { data: outline } = useQuery<Outline>({
    queryKey: ["/api/outlines", project.id, chapter?.id],
    queryFn: async () => {
      if (!chapter?.id) return null;
      const res = await fetch(`${API_BASE_URL}/api/outlines?projectId=${project.id}`);
      if (!res.ok) return null;
      const outlines = await res.json();
      return outlines.find((o: Outline) => o.linkedChapterId === chapter.id);
    },
    enabled: !!chapter?.id,
  });

  // Fetch characters with auto-refresh
  const { data: characters } = useQuery<Character[]>({
    queryKey: ["/api/characters", project.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/characters?projectId=${project.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // 使用 ref 追踪上一个章节 ID 和更新时间
  const prevChapterIdRef = useRef<string | undefined>();
  const prevUpdatedAtRef = useRef<string | undefined>();

  useEffect(() => {
    if (chapter) {
      const chapterIdChanged = prevChapterIdRef.current !== chapter.id;
      // Check if the chapter has been updated on the server since we last saw it
      // We use string comparison for dates which works for ISO strings
      const serverUpdated = chapter.updatedAt &&
        (!prevUpdatedAtRef.current || new Date(chapter.updatedAt).toISOString() > prevUpdatedAtRef.current);

      // 在以下情况更新内容：
      // 1. 章节 ID 变化（切换章节）- 强制更新
      // 2. 服务器端有更新且没有未保存的本地更改 - 允许自动刷新
      // 注意：保存操作后 setHasChanges(false) 会触发此 effect，但此时 chapter.updatedAt 可能还是旧的
      // 所以我们需要确保只有当服务器时间确实更新了，或者切换了章节时才覆盖本地内容
      if (chapterIdChanged || (serverUpdated && !hasChanges)) {
        setTitle(chapter.title);
        setContent(chapter.content);
        setInitialWordCount(chapter.content?.replace(/\s/g, "").length || 0);

        // 如果是切换章节，重置 hasChanges
        if (chapterIdChanged) {
          setHasChanges(false);
        }

        // Update our tracking refs
        prevUpdatedAtRef.current = chapter.updatedAt ? new Date(chapter.updatedAt).toISOString() : undefined;
      }

      prevChapterIdRef.current = chapter.id;
    }
  }, [chapter?.id, chapter?.content, chapter?.wordCount, chapter?.updatedAt, hasChanges]);

  const updateChapterMutation = useMutation({
    mutationFn: async () => {
      if (!chapter) return;

      const wordCount = content.replace(/\s/g, "").length;

      return await apiRequest("PATCH", `/api/chapters/${chapter.id}`, {
        title,
        content,
        wordCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", project.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setHasChanges(false);
      setLastSavedAt(new Date());
      toast({
        title: "保存成功",
        description: "章节内容已保存",
      });
    },
  });

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    updateChapterMutation.mutate();
  };

  const handleDiagnose = async () => {
    if (!chapter) return;
    setIsDiagnosing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/editor/diagnose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          chapterId: chapter.id,
          chapterContent: content,
          cursorPosition: textareaRef.current?.selectionStart || 0,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setDiagnosisResult(data);
      toast({
        title: "诊断完成",
        description: "已生成章节质量分析报告",
      });
    } catch (error: any) {
      toast({
        title: "诊断失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleApplySuggestion = async (issue: any) => {
    if (!chapter) return;
    setIsApplyingSuggestion(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/editor/fix-issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          chapterId: chapter.id,
          chapterContent: content,
          issue: issue.description,
          suggestion: issue.suggestion,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      // Update content with the rewritten version
      setContent(data.result);
      setHasChanges(true);

      toast({
        title: "优化完成",
        description: "已根据建议重写章节内容",
      });
    } catch (error: any) {
      toast({
        title: "优化失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApplyingSuggestion(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasChanges && chapter) {
        updateChapterMutation.mutate();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [hasChanges, chapter?.id, content, title]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (chapter) {
          handleSave();
        }
      }
    };

    const handleInsertAIContent = (e: CustomEvent) => {
      const { content: aiContent } = e.detail;
      if (textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + '\n\n' + aiContent + '\n\n' + content.substring(end);
        setContent(newContent);
        setHasChanges(true);

        // Set cursor position after inserted content
        setTimeout(() => {
          textarea.focus();
          const newPosition = start + aiContent.length + 4; // +4 for the newlines
          textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener('insertAIContent', handleInsertAIContent as EventListener);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener('insertAIContent', handleInsertAIContent as EventListener);
    };
  }, [chapter, title, content]);

  if (!chapter) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-md">
          <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-6" />
          <h3 className="text-lg font-semibold mb-2">选择章节开始创作</h3>
          <p className="text-sm text-muted-foreground">
            从左侧章节目录选择章节，或创建新章节开始写作
          </p>
        </div>
      </div>
    );
  }

  const wordCount = content.replace(/\s/g, "").length;
  const todayWords = Math.max(0, wordCount - initialWordCount);
  const targetWords = project.targetWordCount || 50000;
  const currentProgress = project.currentWordCount || 0;
  const progressPercent = Math.min(Math.round((currentProgress / targetWords) * 100), 100);

  // Extract plot nodes from outline
  const plotNodes = outline?.plotNodes as any;
  const beats = plotNodes?.beats || [];
  const requiredEntities = plotNodes?.requiredEntities || [];
  const entryState = plotNodes?.entryState;
  const exitState = plotNodes?.exitState;

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between gap-4 mb-3">
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-xl font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-serif flex-1"
            placeholder="章节标题"
            data-testid="input-chapter-title"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Writing statistics */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="font-medium">{wordCount.toLocaleString()}</span> 字
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>今日 +{todayWords.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>{progressPercent}%</span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-4" />

          {/* Quick reference buttons */}
          <div className="flex items-center gap-2">
            {outline && beats.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <BookOpen className="h-3 w-3 mr-1" />
                    大纲
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">章节大纲</h4>

                    {beats.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">节拍</p>
                        {beats.map((beat: string, i: number) => (
                          <div key={i} className="flex gap-2 text-xs">
                            <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                            <span>{beat}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {requiredEntities.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">必需角色</p>
                        <div className="flex flex-wrap gap-1">
                          {requiredEntities.map((entity: string) => (
                            <Badge key={entity} variant="secondary" className="text-xs">
                              {entity}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {entryState && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">入场状态</p>
                        <p className="text-xs">{entryState}</p>
                      </div>
                    )}

                    {exitState && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">出场状态</p>
                        <p className="text-xs">{exitState}</p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {characters && characters.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    角色
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96" align="end">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">角色信息</h4>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {characters.slice(0, 5).map((char) => (
                        <div key={char.id} className="space-y-2 pb-3 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{char.role}</Badge>
                            <span className="font-medium text-sm">{char.name}</span>
                          </div>
                          {char.personality && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {char.personality}
                            </p>
                          )}
                          {(char.currentEmotion || char.currentGoal || char.shortMotivation) && (
                            <div className="space-y-1 mt-2 pt-2 border-t">
                              <p className="text-xs font-semibold text-muted-foreground">当前状态</p>
                              {char.shortMotivation && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">动机：</span>
                                  {char.shortMotivation}
                                </p>
                              )}
                              {char.currentEmotion && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">情感：</span>
                                  {char.currentEmotion}
                                </p>
                              )}
                              {char.currentGoal && (
                                <p className="text-xs">
                                  <span className="text-muted-foreground">目标：</span>
                                  {char.currentGoal}
                                </p>
                              )}
                            </div>
                          )}
                          {char.mentionCount && (
                            <p className="text-xs text-muted-foreground">
                              已出场 {char.mentionCount} 次
                            </p>
                          )}
                          {(() => {
                            const arcPoints = char.arcPoints as unknown as string[] | null;
                            return arcPoints && Array.isArray(arcPoints) && arcPoints.length > 0 && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs font-semibold text-muted-foreground mb-1">
                                  成长轨迹
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {arcPoints.slice(-3).map((point, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {point}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}

            <Separator orientation="vertical" className="h-4" />

            {lastSavedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{lastSavedAt.toLocaleTimeString()}</span>
              </div>
            )}

            {hasChanges && (
              <span className="text-xs text-warning">未保存</span>
            )}

            <Button
              size="sm"
              variant={hasChanges ? "default" : "outline"}
              onClick={handleSave}
              disabled={updateChapterMutation.isPending}
              data-testid="button-save-editor"
            >
              <Save className="h-3 w-3 mr-2" />
              {updateChapterMutation.isPending ? "保存中..." : "保存"}
            </Button>

            <Separator orientation="vertical" className="h-4" />

            {/* P1 Features: Summary & History */}
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="智能摘要">
                  <FileText className="h-3 w-3" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] p-0">
                <SummaryPanel
                  projectId={project.id}
                  chapterId={chapter.id}
                  volumeId={chapter.volumeId || undefined}
                />
              </SheetContent>
            </Sheet>

            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="版本历史">
                  <Clock className="h-3 w-3" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[540px] p-0">
                <VersionHistoryPanel
                  chapterId={chapter.id}
                  projectId={project.id}
                />
              </SheetContent>
            </Sheet>

            {/* Narrative Doctor */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  title="叙事医生"
                  onClick={handleDiagnose}
                >
                  <Stethoscope className={`h-3 w-3 ${isDiagnosing ? 'animate-pulse text-blue-500' : ''}`} />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[400px] sm:w-[600px] overflow-y-auto">
                <SheetHeader className="px-6 pt-6 pb-4">
                  <SheetTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    叙事医生诊断报告
                  </SheetTitle>
                </SheetHeader>
                <div className="px-6 pb-6">
                  {isDiagnosing ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Stethoscope className="h-12 w-12 animate-pulse text-primary" />
                      <p className="text-muted-foreground">正在分析章节内容...</p>
                    </div>
                  ) : diagnosisResult ? (
                    <QualityDashboard
                      qualityScore={diagnosisResult.qualityScore}
                      innovationScore={diagnosisResult.innovationScore}
                      issues={diagnosisResult.issues}
                      onApplySuggestion={handleApplySuggestion}
                      isApplying={isApplyingSuggestion}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      点击上方按钮开始诊断
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-20">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          className="min-h-full border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none text-base leading-loose font-serif p-0"
          placeholder="在这里开始写作...

使用右侧AI助手可以：
• 智能续写章节内容
• 生成对话和场景描写
• 优化文本质量
• 生成章节钩子"
          data-testid="textarea-chapter-content"
        />
      </div>

      {bottomActions && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="pointer-events-auto shadow-lg rounded-full bg-background border border-border p-1">
            {bottomActions}
          </div>
        </div>
      )}
    </div>
  );
});

EditorPanel.displayName = "EditorPanel";
