import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, FileText, Book, Library } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SummaryPanelProps {
    projectId: string;
    chapterId?: string;
    volumeId?: string;
}

interface Summary {
    id: string;
    content: string;
    level: number; // 0=Chapter, 1=Volume, 2=Project
    version: number;
    updatedAt: string;
    isStale: boolean;
}

export function SummaryPanel({ projectId, chapterId, volumeId }: SummaryPanelProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<string>("chapter");

    // Fetch summaries
    const { data: summaries, isLoading } = useQuery<Summary[]>({
        queryKey: ["/api/summaries", projectId, chapterId],
        queryFn: async () => {
            const params = new URLSearchParams({ projectId });
            if (chapterId) params.append("chapterId", chapterId);
            const res = await fetch(`/api/summaries?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to fetch summaries");
            return res.json();
        },
        enabled: !!projectId,
    });

    // Regenerate mutation
    const regenerateMutation = useMutation({
        mutationFn: async (type: "chapter" | "volume" | "project") => {
            let endpoint = "";
            let body = {};

            if (type === "chapter" && chapterId) {
                endpoint = `/api/chapters/${chapterId}/summarize`;
            } else if (type === "volume" && volumeId) {
                endpoint = `/api/volumes/${volumeId}/summarize`;
            } else if (type === "project") {
                endpoint = `/api/projects/${projectId}/summarize`;
            } else {
                throw new Error("Missing ID for regeneration");
            }

            await apiRequest("POST", endpoint, body);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/summaries"] });
            toast({
                title: "生成任务已提交",
                description: "AI 正在后台生成摘要，请稍候...",
            });
        },
        onError: (error: any) => {
            toast({
                title: "生成失败",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const getSummaryByLevel = (level: number) => {
        return summaries?.find((s) => s.level === level);
    };

    const renderSummaryContent = (level: number, type: "chapter" | "volume" | "project") => {
        const summary = getSummaryByLevel(level);
        const isGenerating = regenerateMutation.isPending;

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            );
        }

        if (!summary) {
            return (
                <div className="flex flex-col items-center justify-center h-40 text-center p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">暂无摘要</p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => regenerateMutation.mutate(type)}
                        disabled={isGenerating}
                    >
                        {isGenerating ? (
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="h-3 w-3 mr-2" />
                        )}
                        生成摘要
                    </Button>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                        版本: v{summary.version} • {new Date(summary.updatedAt).toLocaleString()}
                        {summary.isStale && <span className="ml-2 text-yellow-500">(可能已过时)</span>}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2"
                        onClick={() => regenerateMutation.mutate(type)}
                        disabled={isGenerating}
                    >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isGenerating ? "animate-spin" : ""}`} />
                        重新生成
                    </Button>
                </div>
                <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/30">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                        {summary.content}
                    </div>
                </ScrollArea>
            </div>
        );
    };

    return (
        <Card className="w-full h-full border-0 shadow-none">
            <CardHeader className="px-4 py-3 border-b">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    智能摘要
                </CardTitle>
                <CardDescription className="text-xs">
                    AI 自动生成的层级摘要
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-9">
                        <TabsTrigger
                            value="chapter"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs"
                        >
                            章节
                        </TabsTrigger>
                        <TabsTrigger
                            value="volume"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs"
                        >
                            卷
                        </TabsTrigger>
                        <TabsTrigger
                            value="project"
                            className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs"
                        >
                            全书
                        </TabsTrigger>
                    </TabsList>

                    <div className="p-4">
                        <TabsContent value="chapter" className="mt-0">
                            {chapterId ? (
                                renderSummaryContent(0, "chapter")
                            ) : (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    请先选择一个章节
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="volume" className="mt-0">
                            {volumeId ? (
                                renderSummaryContent(1, "volume")
                            ) : (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    当前章节未关联卷
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="project" className="mt-0">
                            {renderSummaryContent(2, "project")}
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}
