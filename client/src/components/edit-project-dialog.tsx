import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";
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
import { apiRequest } from "@/lib/queryClient";
import type { Project } from "@shared/schema";

interface EditProjectDialogProps {
  project: Project;
  children?: React.ReactNode;
  onSuccess?: () => void;
}

export function EditProjectDialog({
  project,
  children,
  onSuccess,
}: EditProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: project.title,
    genre: project.genre,
    style: project.style || "",
    targetWordCount: project.targetWordCount?.toString() || "",
    description: project.description || "",
    status: project.status,
  });

  // Reset form when project changes
  useEffect(() => {
    setForm({
      title: project.title,
      genre: project.genre,
      style: project.style || "",
      targetWordCount: project.targetWordCount?.toString() || "",
      description: project.description || "",
      status: project.status,
    });
  }, [project]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      return await apiRequest("PATCH", `/api/projects/${project.id}`, {
        ...data,
        targetWordCount: data.targetWordCount
          ? parseInt(data.targetWordCount)
          : 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", project.id],
      });
      toast({
        title: "更新成功",
        description: "项目信息已更新",
      });
      setOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "更新失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({
        title: "请输入标题",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            编辑
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑项目</DialogTitle>
          <DialogDescription>修改项目的基本信息</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">
              项目标题 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              placeholder="输入小说标题"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-genre">类型</Label>
              <Select
                value={form.genre}
                onValueChange={(value) => setForm({ ...form, genre: value })}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger id="edit-genre">
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
              <Label htmlFor="edit-style">风格</Label>
              <Input
                id="edit-style"
                placeholder="例如：轻松幽默"
                value={form.style}
                onChange={(e) => setForm({ ...form, style: e.target.value })}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-target">目标字数</Label>
              <Input
                id="edit-target"
                type="number"
                placeholder="例如：1000000"
                value={form.targetWordCount}
                onChange={(e) =>
                  setForm({ ...form, targetWordCount: e.target.value })
                }
                disabled={updateMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">状态</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value })}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="选择状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">活跃</SelectItem>
                  <SelectItem value="completed">已完成</SelectItem>
                  <SelectItem value="archived">已归档</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">简介</Label>
            <Textarea
              id="edit-description"
              placeholder="输入小说简介..."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              disabled={updateMutation.isPending}
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={updateMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              保存更改
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
