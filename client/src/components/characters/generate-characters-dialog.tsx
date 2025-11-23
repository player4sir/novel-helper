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

interface GenerateCharactersDialogProps {
    projectId: string;
    children?: React.ReactNode;
}

export function GenerateCharactersDialog({ projectId, children }: GenerateCharactersDialogProps) {
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState("1");
    const [role, setRole] = useState<string>("配角");
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
            const res = await fetch("/api/characters/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    projectId,
                    count: parseInt(count),
                    role,
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
            queryClient.invalidateQueries({ queryKey: ["/api/characters", projectId] });
            toast({
                title: "生成成功",
                description: `已生成 ${data.length} 个角色`,
            });
            setOpen(false);
            setDescription(""); // Reset description
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
                        AI生成角色
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>AI生成角色</DialogTitle>
                    <DialogDescription>
                        根据项目背景和现有角色，AI将自动生成新的角色设定
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
                            <Label>角色定位</Label>
                            <Select value={role} onValueChange={setRole} disabled={generateMutation.isPending}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="主角">主角</SelectItem>
                                    <SelectItem value="配角">配角</SelectItem>
                                    <SelectItem value="反派">反派</SelectItem>
                                    <SelectItem value="群像">群像</SelectItem>
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
                            placeholder="例如：生成一个性格孤僻的剑客，或者是主角的童年好友..."
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
                                    <li>• 完整的性格、外貌、背景设定</li>
                                    <li>• 核心动机和内心冲突</li>
                                    <li>• 与现有角色的潜在关系</li>
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
