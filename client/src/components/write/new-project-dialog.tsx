import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema } from "@shared/schema";
import { AlertCircle } from "lucide-react";

const genres = [
  { value: "玄幻", label: "玄幻", desc: "修仙、异界、奇幻" },
  { value: "都市", label: "都市", desc: "现代都市、都市异能" },
  { value: "科幻", label: "科幻", desc: "未来世界、星际探索" },
  { value: "历史", label: "历史", desc: "架空历史、穿越" },
  { value: "言情", label: "言情", desc: "现代言情、古代言情" },
  { value: "武侠", label: "武侠", desc: "江湖武侠、仙侠" },
];

const milestones = [
  { words: 30000, label: "3万字 - 书荒期", color: "warning" },
  { words: 80000, label: "8万字 - 验证期", color: "info" },
  { words: 200000, label: "20万字 - 推荐期", color: "success" },
];

const formSchema = insertProjectSchema.extend({
  title: z.string().min(1, "请输入项目标题").max(100),
  genre: z.string().min(1, "请选择小说类型"),
  targetWordCount: z.coerce.number().min(0).default(200000),
  description: z.string().optional(),
  style: z.string().optional(),
});

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (projectId: string) => void;
}

export function NewProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: NewProjectDialogProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      genre: "",
      targetWordCount: 200000,
      currentWordCount: 0,
      status: "active",
      description: "",
      style: "",
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      return await apiRequest("POST", "/api/projects", values);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      form.reset();
      setError(null);
      onProjectCreated(data.id);
    },
    onError: (error: any) => {
      setError(error.message || "创建项目失败，请重试");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createProjectMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新项目</DialogTitle>
          <DialogDescription>
            配置您的小说项目信息，系统将为您提供个性化的创作建议
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目标题</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：修仙从养猪开始"
                      {...field}
                      data-testid="input-project-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="genre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>小说类型</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-genre">
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre.value} value={genre.value}>
                          <div>
                            <div className="font-medium">{genre.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {genre.desc}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="targetWordCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标字数</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="200000"
                      {...field}
                      data-testid="input-target-words"
                    />
                  </FormControl>
                  <FormDescription>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">
                        番茄小说关键节点：
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {milestones.map((milestone) => (
                          <Badge
                            key={milestone.words}
                            variant="secondary"
                            className="text-xs"
                          >
                            {milestone.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>项目简介（可选）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="简要描述您的小说故事梗概..."
                      className="resize-none"
                      rows={3}
                      {...field}
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>写作风格（可选）</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例：轻松搞笑、热血爽文、悬疑推理"
                      {...field}
                      data-testid="input-style"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createProjectMutation.isPending}
                data-testid="button-create"
              >
                {createProjectMutation.isPending ? "创建中..." : "创建项目"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
