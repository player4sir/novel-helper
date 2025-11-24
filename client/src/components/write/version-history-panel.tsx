import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, RotateCcw, GitCommit, ChevronRight, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface VersionHistoryPanelProps {
    chapterId: string;
    projectId: string;
}

interface ChangeSet {
    id: string;
    baseVersion: number;
    targetVersion: number;
    operations: any[]; // Diff operations
    author: string;
    description: string;
    createdAt: string;
}

export function VersionHistoryPanel({ chapterId, projectId }: VersionHistoryPanelProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Fetch history
    const { data: history, isLoading } = useQuery<ChangeSet[]>({
        queryKey: ["/api/chapters", chapterId, "history"],
        queryFn: async () => {
            const res = await fetch(`/api/chapters/${chapterId}/history`);
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json();
        },
        enabled: !!chapterId,
    });

    // Restore mutation
    const restoreMutation = useMutation({
        mutationFn: async (changeSetId: string) => {
            await apiRequest("POST", `/api/chapters/${chapterId}/restore/${changeSetId}`, {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] }); // Refresh editor content
            queryClient.invalidateQueries({ queryKey: ["/api/chapters", chapterId, "history"] });
            toast({
                title: "恢复成功",
                description: "章节内容已恢复到选定版本",
            });
        },
        onError: (error: any) => {
            toast({
                title: "恢复失败",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const renderDiff = (operations: any[]) => {
        if (!operations || !Array.isArray(operations)) return null;

        return (
            <div className="text-xs font-mono bg-muted/50 p-2 rounded mt-2 max-h-40 overflow-y-auto">
                {operations.map((op, idx) => {
                    if (op.added) {
                        return <span key={idx} className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{op.value}</span>;
                    } else if (op.removed) {
                        return <span key={idx} className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 line-through">{op.value}</span>;
                    } else {
                        return <span key={idx} className="text-muted-foreground">{op.value}</span>;
                    }
                })}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-40">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!history || history.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                <History className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">暂无历史版本</p>
            </div>
        );
    }

    return (
        <Card className="w-full h-full border-0 shadow-none flex flex-col">
            <CardHeader className="px-4 py-3 border-b flex-shrink-0">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    版本历史
                </CardTitle>
                <CardDescription className="text-xs">
                    查看变更记录和回滚版本
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
                <ScrollArea className="h-full">
                    <div className="divide-y">
                        {history.map((changeSet) => (
                            <div key={changeSet.id} className="p-4 hover:bg-muted/20 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                    <div
                                        className="flex-1 cursor-pointer"
                                        onClick={() => toggleExpand(changeSet.id)}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-[10px] h-5 px-1">
                                                v{changeSet.targetVersion}
                                            </Badge>
                                            <span className="text-sm font-medium">
                                                {changeSet.description || "内容更新"}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <GitCommit className="h-3 w-3" />
                                            <span>{format(new Date(changeSet.createdAt), "MM-dd HH:mm", { locale: zhCN })}</span>
                                            <span>•</span>
                                            <span>{changeSet.author === "user" ? "用户" : "AI"}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => restoreMutation.mutate(changeSet.id)}
                                            disabled={restoreMutation.isPending}
                                            title="恢复到此版本"
                                        >
                                            {restoreMutation.isPending && restoreMutation.variables === changeSet.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RotateCcw className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => toggleExpand(changeSet.id)}
                                        >
                                            {expandedId === changeSet.id ? (
                                                <ChevronDown className="h-4 w-4" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {expandedId === changeSet.id && (
                                    <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">变更详情:</p>
                                        {renderDiff(changeSet.operations)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
