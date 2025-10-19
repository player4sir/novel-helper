import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import type { Project, Chapter } from "@shared/schema";
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

  useEffect(() => {
    if (chapter) {
      setTitle(chapter.title);
      setContent(chapter.content);
      setHasChanges(false);
    }
  }, [chapter?.id]);

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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  return (
    <div className="flex-1 flex flex-col bg-background">
      <div className="p-6 border-b border-border">
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="text-xl font-semibold border-0 px-0 focus-visible:ring-0 focus-visible:ring-offset-0 font-serif"
          placeholder="章节标题"
          data-testid="input-chapter-title"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium">{wordCount}</span> 字
            {hasChanges && (
              <span className="ml-3 text-xs text-warning">· 未保存</span>
            )}
          </div>
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

      <div className="flex-1 overflow-y-auto p-6">
        <Textarea
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
