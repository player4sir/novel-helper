import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Wand2,
  MessageSquare,
  Zap,
  RefreshCw,
  Copy,
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  Loader2,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEditorAI } from "@/hooks/use-editor-ai";
import type { AIModel, PromptTemplate } from "@shared/schema";
import type { EditorPanelHandle } from "./editor-panel";

interface AIAssistantPanelProps {
  projectId: string;
  chapterId: string | null;
  editorRef: React.RefObject<EditorPanelHandle>;
}



export function AIAssistantPanel({
  projectId,
  chapterId,
  editorRef,
}: AIAssistantPanelProps) {
  const { toast } = useToast();
  const { processInstructionStream, isProcessing } = useEditorAI();

  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedStyle, setSelectedStyle] = useState<string>("none");
  const [generatedContent, setGeneratedContent] = useState("");
  const [autoApply, setAutoApply] = useState(false);
  const [lastSelection, setLastSelection] = useState<{ start: number; end: number } | null>(null);

  const { data: aiModels } = useQuery<AIModel[]>({
    queryKey: ["/api/ai-models"],
  });

  const { data: styles } = useQuery<any[]>({
    queryKey: ["/api/styles", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/styles`);
      if (!response.ok) {
        throw new Error("Failed to fetch styles");
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  const { data: templates } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/templates", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/templates`);
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
    enabled: !!projectId,
  });

  const activeModels = aiModels?.filter((model) => model.isActive) || [];
  const continueTemplates = templates?.filter((t) => t.category === "continue") || [];

  useEffect(() => {
    if (activeModels.length > 0 && !selectedModel) {
      setSelectedModel(activeModels[0].id);
    }
  }, [activeModels, selectedModel]);

  const handleAIRequestWithAutoApply = async (prompt: string) => {
    if (!editorRef.current || !chapterId || !selectedModel) return;

    const selection = editorRef.current.getSelection();
    setLastSelection(selection);

    const context = editorRef.current.getContent();
    const selectedText = selection ? selection.text : "";

    const fullPrompt = selectedText ? `${prompt}\n\n选中的内容：\n${selectedText}` : prompt;

    // Slice context for performance (Level 1 Working Memory optimization)
    const cursor = selection ? selection.end : context.length;
    const CONTEXT_WINDOW = 2000;
    const start = Math.max(0, cursor - CONTEXT_WINDOW);
    const end = Math.min(context.length, cursor + CONTEXT_WINDOW);

    const precedingText = context.slice(start, cursor);
    const followingText = context.slice(cursor, end);

    await processInstructionStream(
      {
        projectId,
        chapterId,
        instruction: fullPrompt,
        // chapterContent: context, // Optimization: Don't send full content
        precedingText,
        followingText,
        selectedText,
        cursorPosition: selection ? selection.end : 0,
        styleProfileId: selectedStyle === "none" ? undefined : selectedStyle,
      },
      {
        onChunk: (chunk) => {
          setGeneratedContent((prev) => prev + chunk);
        },
        onMetadata: (metadata) => {
          console.log("AI Metadata:", metadata);
        },
        onError: (error: any) => {
          console.error("AI processing failed:", error);
          toast({
            title: "AI处理失败",
            description: error.message || "Unknown error",
            variant: "destructive"
          });
        },
      }
    );
  };

  const handleQuickAction = async (action: string, templateId?: string) => {
    let prompt = "";

    switch (action) {
      case "continue":
        prompt = "根据上文内容，继续写作，保持风格一致，推进剧情发展。";
        break;
      case "dialogue":
        prompt = "生成符合人物性格的精彩对话，增强情节张力。";
        break;
      case "scene":
        prompt = "丰富场景描写，营造氛围，增强画面感。";
        break;
      case "hook":
        prompt = "在章节末尾设计一个吸引人的钩子，让读者想继续阅读。";
        break;
      case "polish":
        prompt = "润色这段文字，使其更加通顺、优美，保持原意不变。";
        break;
    }

    if (templateId) {
      const template = templates?.find((t) => t.id === templateId);
      if (template) {
        prompt = template.template;
      }
    }

    await handleAIRequestWithAutoApply(prompt);
  };

  const handleInsertContent = () => {
    if (!editorRef.current || !generatedContent) return;

    editorRef.current.insertContent(generatedContent, lastSelection || undefined);
    toast({
      title: "已插入",
      description: "内容已插入到编辑器",
    });
  };

  return (
    <div className="h-full flex flex-col bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">AI 助手</span>
          </div>
          <Badge variant={isProcessing ? "secondary" : "outline"} className="text-[10px] h-5">
            {isProcessing ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                生成中
              </span>
            ) : (
              "就绪"
            )}
          </Badge>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex gap-2">
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectTrigger className="h-8 text-xs w-[100px] bg-background/50">
                <SelectValue placeholder="风格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">默认风格</SelectItem>
                {styles?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 text-xs flex-1 bg-background/50">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {activeModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-[10px] text-muted-foreground cursor-pointer" htmlFor="auto-apply">
              直接插入
            </Label>
            <Switch
              id="auto-apply"
              checked={autoApply}
              onCheckedChange={setAutoApply}
              className="scale-75 data-[state=checked]:bg-primary"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start h-8 text-xs font-normal bg-background/50 hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleQuickAction("continue")}
              disabled={!chapterId || isProcessing}
              data-testid="button-ai-continue"
            >
              <Wand2 className="h-3.5 w-3.5 mr-2 text-blue-500" />
              智能续写
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start h-8 text-xs font-normal bg-background/50 hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleQuickAction("dialogue")}
              disabled={!chapterId || isProcessing}
              data-testid="button-ai-dialogue"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-2 text-green-500" />
              对话生成
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start h-8 text-xs font-normal bg-background/50 hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleQuickAction("scene")}
              disabled={!chapterId || isProcessing}
              data-testid="button-ai-scene"
            >
              <Sparkles className="h-3.5 w-3.5 mr-2 text-purple-500" />
              场景描写
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start h-8 text-xs font-normal bg-background/50 hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleQuickAction("hook")}
              disabled={!chapterId || isProcessing}
              data-testid="button-ai-hook"
            >
              <Zap className="h-3.5 w-3.5 mr-2 text-yellow-500" />
              钩子生成
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start h-8 text-xs font-normal col-span-2 bg-background/50 hover:bg-accent hover:text-accent-foreground"
              onClick={() => handleQuickAction("polish")}
              disabled={!chapterId || isProcessing}
              data-testid="button-ai-polish"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2 text-orange-500" />
              润色优化选中内容
            </Button>
          </div>

          {continueTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Separator className="flex-1" />
                <span className="text-[10px] text-muted-foreground font-medium">模板</span>
                <Separator className="flex-1" />
              </div>
              <div className="grid grid-cols-1 gap-1">
                {continueTemplates.slice(0, 3).map((template) => (
                  <Button
                    key={template.id}
                    variant="ghost"
                    size="sm"
                    className="justify-start h-7 text-xs font-normal text-muted-foreground hover:text-foreground"
                    onClick={() => handleQuickAction("template", template.id)}
                    disabled={!chapterId || isProcessing}
                  >
                    <FileText className="h-3 w-3 mr-2 opacity-70" />
                    {template.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {(generatedContent || isProcessing) && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      生成中...
                    </>
                  ) : (
                    "生成结果"
                  )}
                </Label>
                <div className="flex items-center gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedContent);
                      toast({ title: "已复制", description: "内容已复制到剪贴板" });
                    }}
                    disabled={!generatedContent}
                    title="复制"
                  >
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={handleInsertContent}
                    disabled={!generatedContent}
                    title="插入编辑器"
                  >
                    <ArrowDownToLine className="h-3 w-3 text-muted-foreground" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-muted"
                    onClick={() => setGeneratedContent("")}
                    disabled={isProcessing}
                    title="清空"
                  >
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="relative group">
                <div className={`
                      p-3 rounded-md text-sm leading-relaxed min-h-[100px] max-h-[400px] overflow-y-auto whitespace-pre-wrap
                      ${isProcessing ? 'bg-muted/50 animate-pulse' : 'bg-muted/30 border border-border/50 shadow-sm'}
                    `}>
                  {generatedContent || (isProcessing ? "AI 正在思考..." : <span className="text-muted-foreground italic text-xs">暂无生成内容</span>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
