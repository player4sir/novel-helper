import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2 } from "lucide-react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface GenerateWorldSettingsDialogProps {
    projectId: string;
    category?: string; // If provided, pre-selects this category
    children?: React.ReactNode;
}

const categoryConfig = {
    power_system: "力量体系",
    geography: "地理设定",
    faction: "势力组织",
    rules: "世界规则",
    items: "重要物品",
};

export function GenerateWorldSettingsDialog({ projectId, category: initialCategory, children }: GenerateWorldSettingsDialogProps) {
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState("1");
    const [category, setCategory] = useState<string>(initialCategory || "power_system");
    const [description, setDescription] = useState("");
    const [modelId, setModelId] = useState<string>("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: models = [] } = useQuery({
        queryKey: ["/api/ai-models"],
        queryFn: async () => {
            const res = await fetch("/api/ai-models");
            if (!res.ok) throw new Error("Failed to fetch models");
            return res.json();
        },
    });

    const chatModels = models.filter((m: any) => m.modelType === "chat" && m.isActive);

    // Set default model when models are loaded
    if (!modelId && chatModels.length > 0) {
        const defaultModel = chatModels.find((m: any) => m.isDefaultChat) || chatModels[0];
        setModelId(defaultModel.modelId);
    }

    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/world-settings/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    category,
                    count: parseInt(count),
                    description,
                    modelId
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "生成失败");
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/world-settings", projectId] });
            toast({
                title: "生成成功",
                description: `已生成 ${data.length} 个设定`,
            });
            setOpen(false);
            setDescription("");
        },
        onError: (error: Error) => {
            toast({
                title: "生成失败",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        generateMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="outline">
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI生成设定
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>AI生成世界观设定</DialogTitle>
                    <DialogDescription>
                        根据项目背景，AI将自动生成符合类型的世界观设定
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>生成数量</Label>
                            <Input
                                type="number"
                                min="1"
                                max="5"
                                value={count}
                                onChange={(e) => setCount(e.target.value)}
                                disabled={generateMutation.isPending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>设定分类</Label>
                            <Select value={category} onValueChange={setCategory} disabled={generateMutation.isPending || !!initialCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(categoryConfig).map(([key, label]) => (
                                        <SelectItem key={key} value={key}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>AI模型</Label>
                        <Select value={modelId} onValueChange={setModelId} disabled={generateMutation.isPending}>
                            <SelectTrigger>
                                <SelectValue placeholder="选择AI模型" />
                            </SelectTrigger>
                            <SelectContent>
                                {chatModels.map((model: any) => (
                                    <SelectItem key={model.modelId} value={model.modelId}>
                                        {model.name} ({model.provider})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>额外要求（可选）</Label>
                        <Textarea
                            placeholder="例如：生成一个位于极寒之地的神秘宗门..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={generateMutation.isPending}
                            rows={3}
                        />
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex items-start gap-2">
                            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">AI将生成：</p>
                                <ul className="text-xs text-muted-foreground space-y-1">
                                    <li>• 详细的设定描述和参数</li>
                                    <li>• 符合世界观逻辑的细节</li>
                                    <li>• 结构化的数据格式</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={generateMutation.isPending}
                        >
                            取消
                        </Button>
                        <Button type="submit" disabled={generateMutation.isPending}>
                            {generateMutation.isPending && (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            )}
                            {generateMutation.isPending ? "生成中..." : "开始生成"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
