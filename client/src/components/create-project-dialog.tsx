import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CreateProjectDialogProps {
  children?: React.ReactNode;
  onSuccess?: (projectId: string) => void;
}

export function CreateProjectDialog({ children, onSuccess }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"manual" | "ai">("ai");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Manual creation form
  const [manualForm, setManualForm] = useState({
    title: "",
    genre: "",
    style: "",
    targetWordCount: "",
    description: "",
  });

  // AI creation form
  const [aiForm, setAiForm] = useState({
    titleSeed: "",
    premise: "",
    genre: "",
    style: "",
    targetWordCount: "",
  });

  const createManualMutation = useMutation({
    mutationFn: async (data: typeof manualForm) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "创建失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "创建成功",
        description: "项目已创建，开始您的创作之旅吧！",
      });
      setOpen(false);
      resetForms();
      onSuccess?.(data.id);
    },
    onError: (error: Error) => {
      toast({
        title: "创建失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createAIMutation = useMutation({
    mutationFn: async (data: typeof aiForm) => {
      const res = await fetch("/api/projects/create-from-seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "AI生成失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "AI创建成功",
        description: `项目《${data.projectMeta.title}》已创建！AI已为您生成完整的项目设定。`,
      });
      setOpen(false);
      resetForms();
      onSuccess?.(data.projectId);
    },
    onError: (error: Error) => {
      toast({
        title: "AI创建失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForms = () => {
    setManualForm({
      title: "",
      genre: "",
      style: "",
      targetWordCount: "",
      description: "",
    });
    setAiForm({
      titleSeed: "",
      premise: "",
      genre: "",
      style: "",
      targetWordCount: "",
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.title.trim()) {
      toast({
        title: "请输入标题",
        variant: "destructive",
      });
      return;
    }
    createManualMutation.mutate(manualForm);
  };

  const handleAISubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiForm.titleSeed.trim()) {
      toast({
        title: "请输入创意种子",
        description: "至少需要一个标题或核心创意",
        variant: "destructive",
      });
      return;
    }
    createAIMutation.mutate(aiForm);
  };

  const isLoading = createManualMutation.isPending || createAIMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button>
            <BookOpen className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建小说项目</DialogTitle>
          <DialogDescription>
            选择手动创建或使用AI智能生成项目设定
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "manual" | "ai")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai">
              <Sparkles className="h-4 w-4 mr-2" />
              AI智能生成
            </TabsTrigger>
            <TabsTrigger value="manual">
              <BookOpen className="h-4 w-4 mr-2" />
              手动创建
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="space-y-4 mt-4">
            <form onSubmit={handleAISubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ai-title-seed">
                  创意种子 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ai-title-seed"
                  placeholder="例如：一个程序员穿越到修仙世界"
                  value={aiForm.titleSeed}
                  onChange={(e) =>
                    setAiForm({ ...aiForm, titleSeed: e.target.value })
                  }
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  输入一个核心创意或标题，AI将为您生成完整的项目设定
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ai-premise">补充说明（可选）</Label>
                <Textarea
                  id="ai-premise"
                  placeholder="补充更多创意细节，帮助AI更好地理解您的想法..."
                  value={aiForm.premise}
                  onChange={(e) =>
                    setAiForm({ ...aiForm, premise: e.target.value })
                  }
                  disabled={isLoading}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ai-genre">类型（可选）</Label>
                  <Select
                    value={aiForm.genre}
                    onValueChange={(value) =>
                      setAiForm({ ...aiForm, genre: value })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="ai-genre">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="玄幻">玄幻</SelectItem>
                      <SelectItem value="仙侠">仙侠</SelectItem>
                      <SelectItem value="都市">都市</SelectItem>
                      <SelectItem value="科幻">科幻</SelectItem>
                      <SelectItem value="历史">历史</SelectItem>
                      <SelectItem value="武侠">武侠</SelectItem>
                      <SelectItem value="言情">言情</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-target">目标字数（可选）</Label>
                  <Input
                    id="ai-target"
                    type="number"
                    placeholder="例如：1000000"
                    value={aiForm.targetWordCount}
                    onChange={(e) =>
                      setAiForm({ ...aiForm, targetWordCount: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">AI将为您生成：</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• 完整的小说标题和核心设定</li>
                      <li>• 主题标签和基调风格</li>
                      <li>• 核心冲突和情节线索</li>
                      <li>• 主要角色设定（3-5个）</li>
                      <li>• 世界观规则和关键词</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {createAIMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {createAIMutation.isPending ? "AI生成中..." : "开始生成"}
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 mt-4">
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manual-title">
                  项目标题 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="manual-title"
                  placeholder="输入小说标题"
                  value={manualForm.title}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, title: e.target.value })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manual-genre">类型</Label>
                  <Select
                    value={manualForm.genre}
                    onValueChange={(value) =>
                      setManualForm({ ...manualForm, genre: value })
                    }
                    disabled={isLoading}
                  >
                    <SelectTrigger id="manual-genre">
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="玄幻">玄幻</SelectItem>
                      <SelectItem value="仙侠">仙侠</SelectItem>
                      <SelectItem value="都市">都市</SelectItem>
                      <SelectItem value="科幻">科幻</SelectItem>
                      <SelectItem value="历史">历史</SelectItem>
                      <SelectItem value="武侠">武侠</SelectItem>
                      <SelectItem value="言情">言情</SelectItem>
                      <SelectItem value="其他">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manual-style">风格</Label>
                  <Input
                    id="manual-style"
                    placeholder="例如：轻松幽默"
                    value={manualForm.style}
                    onChange={(e) =>
                      setManualForm({ ...manualForm, style: e.target.value })
                    }
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-target">目标字数</Label>
                <Input
                  id="manual-target"
                  type="number"
                  placeholder="例如：1000000"
                  value={manualForm.targetWordCount}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      targetWordCount: e.target.value,
                    })
                  }
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-description">简介</Label>
                <Textarea
                  id="manual-description"
                  placeholder="输入小说简介..."
                  value={manualForm.description}
                  onChange={(e) =>
                    setManualForm({
                      ...manualForm,
                      description: e.target.value,
                    })
                  }
                  disabled={isLoading}
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {createManualMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  创建项目
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
