import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AppendChaptersDialogProps {
  projectId: string;
  volumeId: string;
  volumeTitle: string;
  currentChapterCount: number;
  children?: React.ReactNode;
}

export function AppendChaptersDialog({
  projectId,
  volumeId,
  volumeTitle,
  currentChapterCount,
  children,
}: AppendChaptersDialogProps) {
  const [open, setOpen] = useState(false);
  const [additionalCount, setAdditionalCount] = useState(5);
  const [instruction, setInstruction] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const appendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/chapters/append", {
        projectId,
        volumeId,
        additionalCount,
        instruction,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
      // Invalidate all outline queries to ensure consistency
      queryClient.invalidateQueries({
        queryKey: ["/api/outlines"],
        refetchType: "all"
      });
      toast({
        title: "追加成功",
        description: `已为《${volumeTitle}》追加 ${additionalCount} 个章节`,
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "追加失败",
        description: error.message || "生成章节时出错",
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            追加章节
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>追加章节</DialogTitle>
          <DialogDescription>
            为《{volumeTitle}》在已有 {currentChapterCount} 章的基础上继续生成更多章节
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="additional-count">追加数量</Label>
            <Input
              id="additional-count"
              type="number"
              min={1}
              max={30}
              value={additionalCount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setAdditionalCount(Math.min(Math.max(value, 1), 30));
              }}
            />
            <p className="text-xs text-muted-foreground">
              将生成第 {currentChapterCount + 1} 到第 {currentChapterCount + additionalCount} 章
            </p>
            <p className="text-xs text-amber-600">
              建议每次追加5-10章，单卷章节数不超过100章
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="instruction">生成指导（可选）</Label>
            <Textarea
              id="instruction"
              placeholder="例如：主角遭遇强敌，或者揭示一个重要秘密..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="h-24 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              如果不填写，AI将根据现有剧情自动推演
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button
            onClick={() => appendMutation.mutate()}
            disabled={appendMutation.isPending}
          >
            {appendMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            开始追加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
