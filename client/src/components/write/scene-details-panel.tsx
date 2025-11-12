import { useQuery } from "@tanstack/react-query";
import { Layers, FileText, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GenerationQualityIndicator } from "./generation-quality-indicator";

interface SceneDetailsPanelProps {
  chapterId: string;
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
  createdAt: string;
}

export function SceneDetailsPanel({ chapterId }: SceneDetailsPanelProps) {
  const { data: scenes, isLoading: scenesLoading, refetch } = useQuery<SceneFrame[]>({
    queryKey: ["/api/scene-frames", chapterId],
    queryFn: async () => {
      const res = await fetch(`/api/scene-frames/${chapterId}`);
      if (!res.ok) throw new Error("Failed to fetch scenes");
      return res.json();
    },
    enabled: !!chapterId,
    // 启用自动重新获取，确保数据始终最新
    refetchOnWindowFocus: true,
    // 数据保持新鲜 30 秒
    staleTime: 30000,
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
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">场景结构</h3>
          <Badge variant="secondary" className="text-xs">
            {scenes.length} 个场景
          </Badge>
        </div>

        <Accordion type="single" collapsible className="space-y-2">
          {scenes.map((scene) => (
            <SceneItem key={scene.id} scene={scene} />
          ))}
        </Accordion>
      </div>
    </ScrollArea>
  );
}

function SceneItem({ scene }: { scene: SceneFrame }) {
  const { data: drafts, isLoading: draftsLoading } = useQuery<DraftChunk[]>({
    queryKey: ["/api/draft-chunks", scene.id],
    queryFn: async () => {
      const res = await fetch(`/api/draft-chunks/${scene.id}`);
      if (!res.ok) throw new Error("Failed to fetch drafts");
      return res.json();
    },
    // 启用自动重新获取
    refetchOnWindowFocus: true,
    // 数据保持新鲜 30 秒
    staleTime: 30000,
  });

  const latestDraft = drafts?.[0];
  const focalEntities = scene.focalEntities || [];

  return (
    <AccordionItem value={scene.id} className="border rounded-lg px-3">
      <AccordionTrigger className="hover:no-underline py-3">
        <div className="flex items-start gap-3 flex-1 text-left">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0 mt-0.5">
            {scene.index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-sm font-medium line-clamp-1">{scene.purpose}</p>
              {latestDraft?.ruleCheckPassed === true && (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
              {latestDraft?.ruleCheckPassed === false && (
                <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {focalEntities.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>{focalEntities.join("、")}</span>
                </div>
              )}
              {latestDraft && (
                <Badge variant="outline" className="text-xs h-5">
                  {latestDraft.wordCount || 0} 字
                </Badge>
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-3">
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
                <GenerationQualityIndicator
                  ruleCheckPassed={latestDraft.ruleCheckPassed || false}
                  warningCount={(latestDraft.ruleCheckWarnings as string[])?.length || 0}
                  errorCount={(latestDraft.ruleCheckErrors as string[])?.length || 0}
                />

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

          {!latestDraft && (
            <div className="text-xs text-muted-foreground text-center py-2">
              暂无草稿
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
