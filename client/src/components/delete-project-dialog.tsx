import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, AlertTriangle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: DeleteProjectDialogProps) {
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
        title: "已删除",
        description: `项目《${project.title}》已删除`,
      });
      onOpenChange(false);
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
    deleteMutation.mutate();
  };

  const hasContent =
    dependencies &&
    (dependencies.chapterCount > 0 || dependencies.totalWordCount > 0);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">删除项目</AlertDialogTitle>
                <AlertDialogDescription className="mt-1.5 text-sm">
                  确定要删除《{project.title}》吗？
                </AlertDialogDescription>
              </div>
            </div>
          </div>
        </AlertDialogHeader>

        {loadingDeps ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : dependencies && hasContent ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive/90">
                  此操作将永久删除以下内容，且无法恢复
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              {dependencies.chapterCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {dependencies.chapterCount}
                  </span>
                  <span>个章节</span>
                </div>
              )}
              {dependencies.totalWordCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {dependencies.totalWordCount.toLocaleString()}
                  </span>
                  <span>字</span>
                </div>
              )}
              {dependencies.volumeCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {dependencies.volumeCount}
                  </span>
                  <span>个卷</span>
                </div>
              )}
              {dependencies.characterCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {dependencies.characterCount}
                  </span>
                  <span>个角色</span>
                </div>
              )}
              {dependencies.outlineCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {dependencies.outlineCount}
                  </span>
                  <span>个大纲</span>
                </div>
              )}
              {dependencies.worldSettingCount > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {dependencies.worldSettingCount}
                  </span>
                  <span>个设定</span>
                </div>
              )}
            </div>
          </div>
        ) : null}

        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                删除中
              </>
            ) : (
              "确认删除"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
