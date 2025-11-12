import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

interface GenerateContentButtonProps {
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  onSuccess?: () => void;
}

export function GenerateContentButton({
  projectId,
  chapterId,
  chapterTitle,
  onSuccess,
}: GenerateContentButtonProps) {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentScene, setCurrentScene] = useState(0);
  const [totalScenes, setTotalScenes] = useState(0);
  const [generationStats, setGenerationStats] = useState<{
    scenes: number;
    drafts: number;
    ruleChecksPassed: number;
    totalWarnings: number;
  } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async () => {
      setProgress(5);
      setCurrentScene(0);
      setTotalScenes(0);
      setGenerationStats(null);

      const res = await fetch(`/api/chapters/${chapterId}/generate-content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "生成失败");
      }
      
      const data = await res.json();
      
      // Update progress based on actual completion
      setProgress(100);
      setTotalScenes(data.scenes || 0);
      setCurrentScene(data.scenes || 0);
      setGenerationStats({
        scenes: data.scenes || 0,
        drafts: data.drafts || 0,
        ruleChecksPassed: data.ruleChecksPassed || 0,
        totalWarnings: data.totalWarnings || 0,
      });
      
      return data;
    },
    onSuccess: async (data) => {
      // 失效所有相关查询以确保数据同步
      await Promise.all([
        // 失效章节列表（更新字数统计）
        queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] }),
        // 失效项目列表（更新总字数）
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] }),
        // 失效场景框架（显示新生成的场景）
        queryClient.invalidateQueries({ queryKey: ["/api/scene-frames", chapterId] }),
        // 失效今日统计
        queryClient.invalidateQueries({ queryKey: ["/api/statistics/today/summary"] }),
      ]);

      // 同时预取草稿数据，提升场景面板加载速度
      const scenes = await queryClient.fetchQuery({
        queryKey: ["/api/scene-frames", chapterId],
        queryFn: async () => {
          const res = await fetch(`/api/scene-frames/${chapterId}`);
          if (!res.ok) throw new Error("Failed to fetch scenes");
          return res.json();
        },
      });

      // 预取每个场景的草稿
      if (scenes && scenes.length > 0) {
        await Promise.all(
          scenes.map((scene: any) =>
            queryClient.prefetchQuery({
              queryKey: ["/api/draft-chunks", scene.id],
              queryFn: async () => {
                const res = await fetch(`/api/draft-chunks/${scene.id}`);
                if (!res.ok) throw new Error("Failed to fetch drafts");
                return res.json();
              },
            })
          )
        );
      }
      
      const stats = generationStats;
      const qualityInfo = stats 
        ? ` (${stats.ruleChecksPassed}/${stats.scenes} 场景通过检查${stats.totalWarnings > 0 ? `，${stats.totalWarnings} 个警告` : ""})`
        : "";
      
      toast({
        title: "生成成功",
        description: `《${chapterTitle}》已生成 ${data.wordCount} 字内容${qualityInfo}`,
      });
      
      setTimeout(() => {
        setOpen(false);
        setProgress(0);
        setCurrentScene(0);
        setTotalScenes(0);
        setGenerationStats(null);
        onSuccess?.();
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: "生成失败",
        description: error.message,
        variant: "destructive",
      });
      setProgress(0);
      setCurrentScene(0);
      setTotalScenes(0);
      setGenerationStats(null);
    },
  });

  const handleGenerate = () => {
    setOpen(true);
    generateMutation.mutate();
  };

  return (
    <>
      <Button
        onClick={handleGenerate}
        disabled={generateMutation.isPending}
        variant="default"
      >
        {generateMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            生成中...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            AI生成内容
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>AI生成章节内容</DialogTitle>
            <DialogDescription>
              正在为《{chapterTitle}》生成内容...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">生成进度</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              {totalScenes > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>场景进度</span>
                  <span>{currentScene} / {totalScenes}</span>
                </div>
              )}
            </div>

            {generateMutation.isPending && (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">AI正在创作中</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 分析章节大纲和节拍</li>
                    <li>• 分解场景框架（SceneFrame）</li>
                    <li>• 逐场景生成内容（约800字/场景）</li>
                    <li>• 规则检查和实体追踪</li>
                    <li>• 保存草稿和执行日志</li>
                  </ul>
                </div>
              </div>
            )}

            {generateMutation.isSuccess && generationStats && (
              <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    生成完成
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">场景数</span>
                      <span className="font-medium">{generationStats.scenes}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">草稿数</span>
                      <span className="font-medium">{generationStats.drafts}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">通过检查</span>
                      <span className="font-medium text-green-600">
                        {generationStats.ruleChecksPassed}/{generationStats.scenes}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">警告</span>
                      <span className={`font-medium ${generationStats.totalWarnings > 0 ? "text-orange-600" : "text-muted-foreground"}`}>
                        {generationStats.totalWarnings}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    内容已保存，您可以继续编辑和润色
                  </p>
                </div>
              </div>
            )}

            {generateMutation.isError && (
              <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">
                    生成失败
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {generateMutation.error?.message}
                  </p>
                </div>
              </div>
            )}
          </div>

          {!generateMutation.isPending && (
            <div className="flex justify-end">
              <Button onClick={() => setOpen(false)}>关闭</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
