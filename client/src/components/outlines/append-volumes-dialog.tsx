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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AppendVolumesDialogProps {
  projectId: string;
  currentVolumeCount: number;
  children?: React.ReactNode;
}

export function AppendVolumesDialog({
  projectId,
  currentVolumeCount,
  children,
}: AppendVolumesDialogProps) {
  const [open, setOpen] = useState(false);
  const [additionalCount, setAdditionalCount] = useState(2);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const appendMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/volumes/append", {
        projectId,
        additionalCount,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/volumes", projectId] });
      // Invalidate all outline queries to ensure consistency
      queryClient.invalidateQueries({ 
        queryKey: ["/api/outlines"],
        refetchType: "all" 
      });
      toast({
        title: "追加成功",
        description: `已追加 ${additionalCount} 个卷纲`,
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "追加失败",
        description: error.message || "生成卷纲时出错",
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
            追加卷纲
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>追加卷纲</DialogTitle>
          <DialogDescription>
            在已有 {currentVolumeCount} 个卷的基础上继续生成更多卷纲
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="additional-count">追加数量</Label>
            <Input
              id="additional-count"
              type="number"
              min={1}
              max={20}
              value={additionalCount}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                setAdditionalCount(Math.min(Math.max(value, 1), 20));
              }}
            />
            <p className="text-xs text-muted-foreground">
              将生成第 {currentVolumeCount + 1} 到第 {currentVolumeCount + additionalCount} 卷
            </p>
            <p className="text-xs text-amber-600">
              建议每次追加2-5个卷，总卷数不超过50个
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
