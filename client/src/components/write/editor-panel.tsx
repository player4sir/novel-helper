import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { 
  Save, 
  BookOpen, 
  FileText, 
  TrendingUp, 
  Target, 
  Users, 
  Clock 
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
import { apiRequest } from "@/lib/queryClient";
import type { Project, Chapter, Outline, Character } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface EditorPanelProps {
  project: Project;
  chapter: Chapter | undefined;
}

export function EditorPanel({ project, chapter }: EditorPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [initialWordCount, setInitialWordCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch chapter outline
  const { data: outline } = useQuery<Outline>({
    queryKey: ["/api/outlines", project.id, chapter?.id],
    queryFn: async () => {
      if (!chapter?.id) return null;
      const res = await fetch(`/api/outlines?projectId=${project.id}`);
      if (!res.ok) return null;
      const outlines = await res.json();
      return outlines.find((o: Outline) => o.linkedChapterId === chapter.id);
    },
    enabled: !!chapter?.id,
  });

  // Fetch characters
  const { data: characters } = useQuery<Character[]>({
    queryKey: ["/api/characters", project.id],
    queryFn: async () => {
      const res = await fetch(`/api/characters?projectId=${project.id}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // 使用 ref 追踪上一个章节 ID
  const prevChapterIdRef = useRef<string | undefined>();

  useEffect(() => {
    if (chapter) {
      const chapterIdChanged = prevChapterIdRef.current !== chapter.id;
      
      // 在以下情况更新内容：
      // 1. 章节 ID 变化（切换章节）- 强制更新
      // 2. 没有未保存更改 - 允许自动刷新
      if (chapterIdChanged || !hasChanges) {
        setTitle(chapter.title);
        setContent(chapter.content);
        setInitialWordCount(chapter.content?.replace(/\s/g, "").length || 0);
        
        // 如果是切换章节，重置 hasChanges
        if (chapterIdChanged) {
          setHasChanges(false);
        }
      }
      
      prevChapterIdRef.current = chapter.id;
    }
  }, [chapter?.id, chapter?.content, chapter?.wordCount, hasChanges]);

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
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">角色信息</h4>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {characters.slice(0, 5).map((char) => (
                        <div key={char.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">{char.role}</Badge>
                            <span className="font-medium text-sm">{char.name}</span>
                          </div>
                          {char.personality && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {char.personality}
                            </p>
                          )}
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
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
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
    </div>
  );
}
