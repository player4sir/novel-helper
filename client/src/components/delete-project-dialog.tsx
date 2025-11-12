import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface ProjectDependencies {
  volumeCount: number;
  chapterCount: number;
  outlineCount: number;
  characterCount: number;
  worldSettingCount: number;
  totalWordCount: number;
  hasAIGeneratedContent: boolean;
}

interface DeleteProjectDialogProps {
  project: Project;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function DeleteProjectDialog({
  project,
  children,
  onSuccess,
}: DeleteProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dependencies when dialog opens
  const { data: dependencies, isLoading: loadingDeps } =
    useQuery<ProjectDependencies>({
      queryKey: ["/api/projects", project.id, "dependencies"],
      queryFn: async () => {
        const res = await fetch(`/api/projects/${project.id}/dependencies`);
        if (!res.ok) throw new Error("Failed to fetch dependencies");
        return res.json();
      },
      enabled: open,
    });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(
        "DELETE",
        `/api/projects/${project.id}?force=true`,
        {}
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "删除成功",
        description: "项目及所有相关数据已删除",
      });
      setOpen(false);
      setConfirmed(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (!confirmed) {
      toast({
        title: "请确认删除",
        description: "请勾选确认框以继续删除",
        variant: "destructive",
      });
      return;
    }
    deleteMutation.mutate();
  };

  const hasContent =
    dependencies &&
    (dependencies.chapterCount > 0 || dependencies.totalWordCount > 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        if (!newOpen) {
          setConfirmed(false);
        }
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button variant="destructive" size="sm">
            <Trash2 className="h-4 w-4 mr-2" />
            删除
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle className="text-xl">删除项目</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            此操作无法撤销，将永久删除项目及所有相关数据
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="destructive" className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              警告：删除项目《{project.title}》将同时删除所有相关内容
            </AlertDescription>
          </Alert>

          {loadingDeps ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dependencies ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">将被删除的内容：</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-lg">•</span>
                  <span>{dependencies.volumeCount} 个卷</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">•</span>
                  <span>{dependencies.chapterCount} 个章节</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">•</span>
                  <span>{dependencies.totalWordCount.toLocaleString()} 字内容</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">•</span>
                  <span>{dependencies.outlineCount} 个大纲</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">•</span>
                  <span>{dependencies.characterCount} 个角色</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lg">•</span>
                  <span>{dependencies.worldSettingCount} 个世界设定</span>
                </li>
                {dependencies.hasAIGeneratedContent && (
                  <li className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                    <span className="text-lg">•</span>
                    <span>AI生成历史记录</span>
                  </li>
                )}
              </ul>
            </div>
          ) : null}

          {hasContent && (
            <div className="flex items-start space-x-3 p-4 bg-muted/50 rounded-lg border border-border">
              <Checkbox
                id="confirm-delete"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked as boolean)}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="confirm-delete"
                  className="text-sm font-semibold leading-tight cursor-pointer"
                >
                  我确认要删除此项目
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  我理解此操作无法撤销，所有数据将永久丢失
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={deleteMutation.isPending}
            className="flex-1 sm:flex-1"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending || (hasContent && !confirmed)}
            className="flex-1 sm:flex-1"
          >
            {deleteMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {deleteMutation.isPending ? "删除中..." : "确认删除"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
