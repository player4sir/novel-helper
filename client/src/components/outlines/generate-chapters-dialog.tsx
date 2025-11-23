import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

interface GenerateChaptersDialogProps {
  projectId: string;
  volumeId: string;
  volumeTitle: string;
  children?: React.ReactNode;
}

export function GenerateChaptersDialog({
  projectId,
  volumeId,
  volumeTitle,
  children,
}: GenerateChaptersDialogProps) {
  const [open, setOpen] = useState(false);
  const [chapterCount, setChapterCount] = useState("10");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (targetChapterCount: number) => {
      const res = await fetch("/api/chapters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, volumeId, targetChapterCount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "生成失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
      // Invalidate all outline queries to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: ["/api/outlines"],
        refetchType: "all" 
      });
      toast({
        title: "生成成功",
        description: `已为《${volumeTitle}》生成 ${data.chapters.length} 个章节`,
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "生成失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = parseInt(chapterCount);
    if (isNaN(count) || count < 1 || count > 50) {
      toast({
        title: "参数错误",
        description: "章节数应在1-50之间",
        variant: "destructive",
      });
      return;
    }
    generateMutation.mutate(count);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline">
            <Sparkles className="h-3 w-3 mr-1" />
            生成章节
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI生成章节大纲</DialogTitle>
          <DialogDescription>
            为《{volumeTitle}》生成章节大纲
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chapter-count">生成章节数</Label>
            <Input
              id="chapter-count"
              type="number"
              min="1"
              max="50"
              value={chapterCount}
              onChange={(e) => setChapterCount(e.target.value)}
              disabled={generateMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              建议10-15章，AI将根据卷纲自动规划
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">AI将生成：</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 每章的标题和一句话概括</li>
                  <li>• 章节节拍（2-4个关键场景）</li>
                  <li>• 必需角色和风险变化</li>
                  <li>• 章节钩子设计</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={generateMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={generateMutation.isPending}>
              {generateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {generateMutation.isPending ? "生成中..." : "开始生成"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
