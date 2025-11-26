import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, FileText, CheckCircle2, AlertTriangle, Users, Loader2, XCircle, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/queryClient";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GenerationQualityIndicator } from "./generation-quality-indicator";

interface SceneDetailsPanelProps {
  chapterId: string;
  projectId: string;
}

interface SceneFrame {
  id: string;
  chapterId: string;
  index: number;
  purpose: string;
  entryStateSummary: string | null;
  exitStateSummary: string | null;
  focalEntities: string[] | null;
  tokensEstimate: number | null;
  createdAt: string;
}

interface DraftChunk {
  id: string;
  sceneId: string;
  content: string;
  mentions: string[] | null;
  localSummary: string | null;
  wordCount: number | null;
  ruleCheckPassed: boolean | null;
  ruleCheckErrors: any;
  ruleCheckWarnings: any;
  qualityScore: number | null;
  createdAt: string;
}

interface SceneGenerationStatus {
  sceneId: string;
  status: "idle" | "generating" | "completed" | "failed";
  progress?: number;
  error?: string;
}

export function SceneDetailsPanel({ chapterId, projectId }: SceneDetailsPanelProps) {
  const { data: scenes, isLoading: scenesLoading } = useQuery<SceneFrame[]>({
    queryKey: ["/api/scene-frames", chapterId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/scene-frames/${chapterId}`);
      if (!res.ok) throw new Error("Failed to fetch scenes");
      return res.json();
    },
    enabled: !!chapterId,
    refetchOnWindowFocus: true,
    staleTime: 60000, // 60秒
  });

  if (scenesLoading) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        加载场景信息...
      </div>
    );
  }

  if (!scenes || scenes.length === 0) {
    return (
      <div className="p-4 text-center">
        <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          暂无场景信息
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          使用 AI 生成内容后将显示场景详情
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-medium text-muted-foreground">场景列表</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 h-5">
            {scenes.length} 个场景
          </Badge>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {scenes.map((scene) => (
            <SceneItem key={scene.id} scene={scene} projectId={projectId} chapterId={chapterId} />
          ))}
        </Accordion>
      </div>
    </ScrollArea>
  );
}

function SceneItem({ scene, projectId, chapterId }: { scene: SceneFrame; projectId: string; chapterId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: drafts, isLoading: draftsLoading } = useQuery<DraftChunk[]>({
    queryKey: ["/api/draft-chunks", scene.id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/draft-chunks/${scene.id}`);
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 30000, // 30秒
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/scenes/${scene.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, chapterId }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "重新生成失败");
      }

      return res.json();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/draft-chunks", scene.id] }),
        queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] }),
      ]);

      toast({
        title: "重新生成成功",
        description: `场景 ${scene.index + 1} 已重新生成`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "重新生成失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const latestDraft = drafts?.[0];
  const focalEntities = scene.focalEntities || [];

  // 判断场景生成状态
  const isGenerating = draftsLoading && !latestDraft;
  const hasDraft = !!latestDraft;
  const previousQualityScore = drafts?.[1]?.qualityScore;

  return (
    <AccordionItem value={scene.id} className="border rounded-md px-0 bg-card/50">
      <AccordionTrigger className="hover:no-underline py-2 px-3 data-[state=open]:bg-muted/50 rounded-t-md transition-colors">
        <div className="flex items-start gap-3 flex-1 text-left">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium shrink-0 mt-0.5">
            {scene.index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-medium line-clamp-1">{scene.purpose}</p>
              {isGenerating && (
                <Badge variant="outline" className="text-[10px] px-1 h-4 animate-pulse border-primary/50 text-primary">
                  <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin" />
                  生成中
                </Badge>
              )}
              {!isGenerating && latestDraft?.ruleCheckPassed === true && (
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
              )}
              {!isGenerating && latestDraft?.ruleCheckPassed === false && (
                <AlertTriangle className="h-3 w-3 text-orange-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {focalEntities.length > 0 && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />
                  <span className="truncate max-w-[120px]">{focalEntities.join("、")}</span>
                </div>
              )}
              {latestDraft && (
                <Badge variant="secondary" className="text-[10px] px-1 h-4 font-normal text-muted-foreground bg-muted">
                  {latestDraft.wordCount || 0} 字
                </Badge>
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3 px-3 border-t border-border/50">
        <div className="space-y-3 pt-2">
          {scene.entryStateSummary && (
            <div className="text-xs">
              <span className="text-muted-foreground">入场：</span>
              <span className="ml-1">{scene.entryStateSummary}</span>
            </div>
          )}
          {scene.exitStateSummary && (
            <div className="text-xs">
              <span className="text-muted-foreground">出场：</span>
              <span className="ml-1">{scene.exitStateSummary}</span>
            </div>
          )}

          {latestDraft && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">最新草稿</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => regenerateMutation.mutate()}
                      disabled={regenerateMutation.isPending}
                    >
                      {regenerateMutation.isPending ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          生成中
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          重新生成
                        </>
                      )}
                    </Button>
                    {latestDraft.ruleCheckPassed ? (
                      <Badge variant="outline" className="text-xs h-5 bg-green-50 text-green-700 border-green-200">
                        ✓ 通过检查
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs h-5 bg-orange-50 text-orange-700 border-orange-200">
                        ⚠ 有警告
                      </Badge>
                    )}
                  </div>
                </div>

                {latestDraft.localSummary && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                    {latestDraft.localSummary}
                  </p>
                )}

                {latestDraft.mentions && latestDraft.mentions.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">提及角色：</span>
                    <span className="ml-1">{latestDraft.mentions.join("、")}</span>
                  </div>
                )}

                {/* 质量指标 */}
                <div className="space-y-2">
                  <GenerationQualityIndicator
                    ruleCheckPassed={latestDraft.ruleCheckPassed || false}
                    warningCount={(latestDraft.ruleCheckWarnings as string[])?.length || 0}
                    errorCount={(latestDraft.ruleCheckErrors as string[])?.length || 0}
                    qualityScore={latestDraft.qualityScore || undefined}
                  />

                  {/* 质量趋势 */}
                  {latestDraft.qualityScore && previousQualityScore && (
                    <div className="text-xs text-muted-foreground">
                      质量变化：
                      {latestDraft.qualityScore > previousQualityScore ? (
                        <span className="text-green-600 ml-1">
                          ↑ +{latestDraft.qualityScore - previousQualityScore}
                        </span>
                      ) : latestDraft.qualityScore < previousQualityScore ? (
                        <span className="text-red-600 ml-1">
                          ↓ {latestDraft.qualityScore - previousQualityScore}
                        </span>
                      ) : (
                        <span className="ml-1">→ 持平</span>
                      )}
                    </div>
                  )}
                </div>

                {!latestDraft.ruleCheckPassed && latestDraft.ruleCheckWarnings && (
                  <div className="text-xs space-y-1">
                    <span className="text-orange-600 font-medium">警告：</span>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                      {(latestDraft.ruleCheckWarnings as string[]).map((warning, i) => (
                        <li key={i}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {!latestDraft && !isGenerating && (
            <div className="text-xs text-muted-foreground text-center py-2">
              暂无草稿
            </div>
          )}

          {isGenerating && (
            <div className="text-xs text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">正在生成场景内容...</p>
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
