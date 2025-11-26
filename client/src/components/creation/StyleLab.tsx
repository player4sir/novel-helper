import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Wand2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/queryClient";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StyleProfile {
    id: string;
    name: string;
    description: string;
    traits: {
        rhythm: string;
        vocabulary: string;
        sentenceStructure: string;
        rhetoricalDevices: string[];
        tone: string;
    };
    sampleTextSnippet: string;
    createdAt: string;
}

interface StyleLabProps {
    projectId: string;
}

export function StyleLab({ projectId }: StyleLabProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [sampleText, setSampleText] = useState("");
    const [analysisResult, setAnalysisResult] = useState<StyleProfile["traits"] | null>(null);
    const [newStyleName, setNewStyleName] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: styles, isLoading } = useQuery<StyleProfile[]>({
        queryKey: ["/api/styles", projectId],
        queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/styles?projectId=${projectId}`);
            if (!res.ok) throw new Error("Failed to fetch styles");
            return res.json();
        }
    });

    const analyzeMutation = useMutation({
        mutationFn: async (text: string) => {
            const res = await fetch(`${API_BASE_URL}/api/styles/extract`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            if (!res.ok) throw new Error("Analysis failed");
            return res.json();
        },
        onSuccess: (data) => {
            setAnalysisResult(data);
            toast({ title: "风格分析完成", description: "请确认分析结果并保存" });
        },
        onError: () => {
            toast({ title: "分析失败", variant: "destructive" });
        }
    });

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`${API_BASE_URL}/api/styles`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error("Save failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
            setIsDialogOpen(false);
            setSampleText("");
            setAnalysisResult(null);
            setNewStyleName("");
            toast({ title: "风格已保存" });
        },
        onError: () => {
            toast({ title: "保存失败", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`${API_BASE_URL}/api/styles/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Delete failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/styles"] });
            toast({ title: "风格已删除" });
        }
    });

    const handleAnalyze = () => {
        if (!sampleText.trim() || sampleText.length < 100) {
            toast({ title: "文本太短", description: "请至少输入100字以上的样本文本", variant: "destructive" });
            return;
        }
        setIsAnalyzing(true);
        analyzeMutation.mutate(sampleText, {
            onSettled: () => setIsAnalyzing(false)
        });
    };

    const handleSave = () => {
        if (!newStyleName || !analysisResult) return;
        saveMutation.mutate({
            projectId,
            name: newStyleName,
            description: `基于"${sampleText.slice(0, 20)}..."的风格分析`,
            traits: analysisResult,
            sampleTextSnippet: sampleText.slice(0, 200),
        });
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-medium">风格实验室</h3>
                    <p className="text-xs text-muted-foreground">提取并应用名家写作风格</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="h-8">
                            <Plus className="h-4 w-4 mr-1" />
                            新建风格
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>新建风格配置</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>样本文本 (建议500字以上)</Label>
                                <Textarea
                                    placeholder="请粘贴一段您想模仿的小说片段..."
                                    className="h-40"
                                    value={sampleText}
                                    onChange={(e) => setSampleText(e.target.value)}
                                />
                            </div>

                            {!analysisResult ? (
                                <Button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || !sampleText}
                                    className="w-full"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            正在分析风格特征...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="h-4 w-4 mr-2" />
                                            开始分析
                                        </>
                                    )}
                                </Button>
                            ) : (
                                <div className="space-y-4 border rounded-md p-4 bg-muted/30">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-sm">分析结果</h4>
                                        <Button variant="ghost" size="sm" onClick={() => setAnalysisResult(null)}>重新分析</Button>
                                    </div>
                                    <div className="grid gap-3 text-sm">
                                        <div className="grid grid-cols-4 gap-2">
                                            <span className="text-muted-foreground">叙事节奏:</span>
                                            <span className="col-span-3">{analysisResult.rhythm}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <span className="text-muted-foreground">用词习惯:</span>
                                            <span className="col-span-3">{analysisResult.vocabulary}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <span className="text-muted-foreground">句式结构:</span>
                                            <span className="col-span-3">{analysisResult.sentenceStructure}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <span className="text-muted-foreground">整体基调:</span>
                                            <span className="col-span-3">{analysisResult.tone}</span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            <span className="text-muted-foreground">修辞手法:</span>
                                            <div className="col-span-3 flex flex-wrap gap-1">
                                                {Array.isArray(analysisResult.rhetoricalDevices)
                                                    ? analysisResult.rhetoricalDevices.map((d, i) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px]">{d}</Badge>
                                                    ))
                                                    : analysisResult.rhetoricalDevices
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t mt-4 space-y-2">
                                        <Label>风格名称</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                value={newStyleName}
                                                onChange={(e) => setNewStyleName(e.target.value)}
                                                placeholder="例如：赛博朋克风、金庸武侠风"
                                            />
                                            <Button onClick={handleSave} disabled={!newStyleName || saveMutation.isPending}>
                                                <Save className="h-4 w-4 mr-2" />
                                                保存
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <ScrollArea className="flex-1 -mx-4 px-4">
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : styles?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                            <p>暂无风格配置</p>
                            <p className="text-xs mt-1">点击右上角新建风格</p>
                        </div>
                    ) : (
                        styles?.map((style) => (
                            <Card key={style.id} className="group relative hover:shadow-md transition-all">
                                <CardHeader className="p-3 pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-sm font-medium">{style.name}</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                            onClick={() => deleteMutation.mutate(style.id)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 text-xs text-muted-foreground space-y-2">
                                    <p className="line-clamp-2 opacity-80">{style.traits.tone}，{style.traits.rhythm}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {style.traits.rhetoricalDevices.slice(0, 3).map((d, i) => (
                                            <Badge key={i} variant="outline" className="text-[10px] px-1 py-0 h-4 font-normal">
                                                {d}
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
