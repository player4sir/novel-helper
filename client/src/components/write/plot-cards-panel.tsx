import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Lightbulb,
    Plus,
    Copy,
    TrendingUp,
    Zap,
    RotateCcw,
    AlertTriangle,
    Sparkles,
    Layers
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/queryClient";
import type { PlotCard } from "@shared/schema";
import { useState } from "react";

interface PlotCardsPanelProps {
    projectId: string | null;
    onInsert: (content: string) => void;
}

const plotTypeConfig = {
    逆袭: { icon: TrendingUp, color: "text-green-500" },
    打脸: { icon: Zap, color: "text-red-500" },
    反转: { icon: RotateCcw, color: "text-blue-500" },
    危机: { icon: AlertTriangle, color: "text-orange-500" },
    高潮: { icon: Sparkles, color: "text-purple-500" },
    铺垫: { icon: Layers, color: "text-gray-500" },
};

export function PlotCardsPanel({ projectId, onInsert }: PlotCardsPanelProps) {
    const { toast } = useToast();
    const [activeType, setActiveType] = useState<string>("all");

    const { data: plotCards } = useQuery<PlotCard[]>({
        queryKey: ["/api/plot-cards", projectId],
        queryFn: async () => {
            if (!projectId) return [];
            const response = await fetch(`${API_BASE_URL}/api/plot-cards/${projectId}`);
            if (!response.ok) throw new Error("Failed to fetch plot cards");
            return response.json();
        },
        enabled: !!projectId,
    });

    const filteredCards = plotCards?.filter((card) => {
        return activeType === "all" || card.type === activeType;
    }) || [];

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        toast({
            title: "已复制",
            description: "情节内容已复制到剪贴板",
        });
    };

    if (!projectId) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
                <Lightbulb className="h-12 w-12 mb-4 opacity-20" />
                <p>请先选择项目</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b bg-muted/20">
                <Tabs value={activeType} onValueChange={setActiveType} className="w-full">
                    <ScrollArea className="w-full whitespace-nowrap">
                        <TabsList className="w-full justify-start h-8 bg-transparent p-0 gap-1">
                            <TabsTrigger
                                value="all"
                                className="h-7 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border border-transparent data-[state=inactive]:border-border data-[state=inactive]:bg-background"
                            >
                                全部
                            </TabsTrigger>
                            {Object.keys(plotTypeConfig).map((type) => (
                                <TabsTrigger
                                    key={type}
                                    value={type}
                                    className="h-7 px-3 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full border border-transparent data-[state=inactive]:border-border data-[state=inactive]:bg-background"
                                >
                                    {type}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </ScrollArea>
                </Tabs>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                    {filteredCards.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <p className="text-sm">暂无该类型的情节卡片</p>
                            <p className="text-xs mt-1 opacity-70">请在"设定管理-情节卡片"中添加</p>
                        </div>
                    ) : (
                        filteredCards.map((card) => {
                            const config = plotTypeConfig[card.type as keyof typeof plotTypeConfig];
                            const Icon = config?.icon || Lightbulb;

                            return (
                                <Card key={card.id} className="group hover:border-primary/50 transition-all hover:shadow-sm">
                                    <CardHeader className="p-3 pb-2 space-y-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className={`p-1 rounded-md bg-muted ${config?.color || "text-muted-foreground"}`}>
                                                    <Icon className="h-3.5 w-3.5" />
                                                </div>
                                                <CardTitle className="text-sm font-medium truncate">
                                                    {card.title}
                                                </CardTitle>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-5 font-normal">
                                                {card.type}
                                            </Badge>
                                        </div>
                                        {card.tags && card.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {card.tags.map((tag, i) => (
                                                    <span key={i} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-sm">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </CardHeader>
                                    <CardContent className="p-3 pt-1">
                                        <p className="text-xs text-muted-foreground line-clamp-3 mb-3 leading-relaxed">
                                            {card.content}
                                        </p>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="h-7 flex-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                                                onClick={() => onInsert(card.content)}
                                            >
                                                <Plus className="h-3 w-3 mr-1" />
                                                插入
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 w-7 px-0"
                                                onClick={() => handleCopy(card.content)}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
