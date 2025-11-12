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

interface GenerateVolumesDialogProps {
  projectId: string;
  children?: React.ReactNode;
}

export function GenerateVolumesDialog({ projectId, children }: GenerateVolumesDialogProps) {
  const [open, setOpen] = useState(false);
  const [volumeCount, setVolumeCount] = useState("3");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (targetVolumeCount: number) => {
      const res = await fetch("/api/volumes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, targetVolumeCount }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "生成失败");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/volumes", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/outlines", projectId] });
      toast({
        title: "生成成功",
        description: `已生成 ${data.volumes.length} 个卷纲`,
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
    const count = parseInt(volumeCount);
    if (isNaN(count) || count < 1 || count > 10) {
      toast({
        title: "参数错误",
        description: "卷数应在1-10之间",
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
          <Button>
            <Sparkles className="h-4 w-4 mr-2" />
            AI生成卷纲
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI生成卷纲</DialogTitle>
          <DialogDescription>
            根据项目总纲，AI将自动生成卷的大纲结构
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="volume-count">生成卷数</Label>
            <Input
              id="volume-count"
              type="number"
              min="1"
              max="10"
              value={volumeCount}
              onChange={(e) => setVolumeCount(e.target.value)}
              disabled={generateMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              建议3-5个卷，AI将根据总纲自动规划
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">AI将生成：</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 每卷的标题和一句话定位</li>
                  <li>• 核心节拍（3-5个关键情节点）</li>
                  <li>• 卷与卷之间的递进关系</li>
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
