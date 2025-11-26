import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Loader2, Settings2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AutoWriterControlProps {
    projectId: string;
}

interface AutoCreationJob {
    id: string;
    status: "active" | "paused" | "completed" | "error";
    config: {
        batchSize: number;
        qualityThreshold: number;
        maxErrors: number;
    };
    stats: {
        chaptersGenerated: number;
        errors: number;
    };
    currentChapterId?: string;
    currentChapterTitle?: string;
    lastError?: string;
}

export function AutoWriterControl({ projectId }: AutoWriterControlProps) {
    const [job, setJob] = useState<AutoCreationJob | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [config, setConfig] = useState({
        batchSize: 5,
        qualityThreshold: 70,
        maxErrors: 3,
        styleProfileId: undefined as string | undefined,
    });
    const { toast } = useToast();

    const { data: styles } = useQuery<any[]>({
        queryKey: ["/api/styles", projectId],
        queryFn: async () => {
            const res = await fetch(`/api/styles?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to fetch styles");
            return res.json();
        }
    });

    const queryClient = useQueryClient();

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/auto-creation/status/${projectId}`);
            if (res.ok) {
                const data = await res.json();
                setJob(data);

                // If job is active and has a current chapter, invalidate that chapter to refresh editor
                if (data && data.status === "active" && data.currentChapterId) {
                    queryClient.invalidateQueries({ queryKey: ["chapter", data.currentChapterId] });
                    queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] });
                }
            }
        } catch (error) {
            console.error("Failed to fetch auto-creation status", error);
        }
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [projectId]);

    const handleStart = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/auto-creation/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId, config }),
            });

            if (!res.ok) throw new Error("Failed to start");

            await fetchStatus();
            toast({ title: "自动创作已启动", description: "系统将按顺序生成章节内容" });
        } catch (error) {
            toast({ title: "启动失败", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePause = async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/auto-creation/pause", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ projectId }),
            });

            if (!res.ok) throw new Error("Failed to pause");

            await fetchStatus();
            toast({ title: "自动创作已暂停" });
        } catch (error) {
            toast({ title: "暂停失败", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const isActive = job?.status === "active";
    const isError = job?.status === "error";

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-md ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            <Loader2 className={`h-4 w-4 ${isActive ? "animate-spin" : ""}`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">自动创作</span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                                {isActive && job?.currentChapterTitle
                                    ? `正在生成: ${job.currentChapterTitle}`
                                    : isActive
                                        ? "正在运行中..."
                                        : "准备就绪"}
                            </span>
                        </div>
                    </div>
                    {job?.status && (
                        <Badge variant={isActive ? "default" : "secondary"} className={cn("text-[10px] px-1.5 h-5 font-normal", isError && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
                            {isActive ? "运行中" : job.status === "paused" ? "已暂停" : job.status === "error" ? "出错" : "已完成"}
                        </Badge>
                    )}
                </div>
            </div>

            <div className="p-3 space-y-4">
                <Card className="border-none shadow-sm bg-muted/30">
                    <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground">生成进度</span>
                            <span className="text-xs font-medium">
                                {job ? `${job.stats.chaptersGenerated} / ${job.config.batchSize} 章` : "- / -"}
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-500"
                                style={{ width: job ? `${(job.stats.chaptersGenerated / job.config.batchSize) * 100}%` : "0%" }}
                            />
                        </div>
                        {job?.lastError && (
                            <div className="mt-2 text-[10px] text-red-500 bg-red-50 p-1.5 rounded border border-red-100 break-all">
                                错误: {job.lastError}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-2">
                    {isActive ? (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handlePause}
                            disabled={isLoading}
                            className="w-full"
                        >
                            <Pause className="h-3.5 w-3.5 mr-1.5" />
                            暂停
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            onClick={handleStart}
                            disabled={isLoading}
                            className="w-full"
                            variant={isError ? "destructive" : "default"}
                        >
                            {isError ? <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
                            {isError ? "重试" : "开始"}
                        </Button>
                    )}

                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isActive} className="w-full">
                                <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                                设置
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>自动创作设置</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label>生成章节数量 (Batch Size)</Label>
                                    <Input
                                        type="number"
                                        value={config.batchSize}
                                        onChange={(e) => setConfig({ ...config, batchSize: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Input
                                        type="number"
                                        value={config.maxErrors}
                                        onChange={(e) => setConfig({ ...config, maxErrors: parseInt(e.target.value) || 1 })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>写作风格 (Style)</Label>
                                    <Select
                                        value={config.styleProfileId || "none"}
                                        onValueChange={(value) => setConfig({ ...config, styleProfileId: value === "none" ? undefined : value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择风格..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">不指定 (默认)</SelectItem>
                                            {styles?.map((style) => (
                                                <SelectItem key={style.id} value={style.id}>
                                                    {style.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="text-[10px] text-muted-foreground bg-muted/20 p-2 rounded border border-border/50">
                    <p className="mb-1 font-medium">说明：</p>
                    <ul className="list-disc list-inside space-y-0.5 opacity-80">
                        <li>系统将自动查找"草稿"状态的章节</li>
                        <li>按顺序生成内容直到达到设定数量</li>
                        <li>生成过程中可随时暂停</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
