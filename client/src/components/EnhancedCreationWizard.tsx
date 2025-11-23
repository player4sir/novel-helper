import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Wand2, Save, Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { StepResultDisplay } from "./step-result-display";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface EnhancedCreationWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: (projectId: string) => void;
}

type CreationStep = "input" | "generating" | "review";

// Removed fake logs


export function EnhancedCreationWizard({ open, onOpenChange, onSuccess }: EnhancedCreationWizardProps) {
    const { toast } = useToast();
    const [currentStep, setCurrentStep] = useState<CreationStep>("input");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressMessage, setProgressMessage] = useState("准备开始...");
    const [progressValue, setProgressValue] = useState(0);

    const [inputData, setInputData] = useState({
        titleSeed: "",
        premise: "",
        genre: "",
        style: "",
        targetWordCount: "200000"
    });

    const [stepResults, setStepResults] = useState<Record<string, any>>({});

    const { data: genres } = useQuery<any[]>({
        queryKey: ["/api/genres"],
    });

    // Removed fake interval effect

    const handleStartAuto = async () => {
        // P0-1: 防止重复提交
        if (isGenerating) {
            toast({
                title: "正在生成中...",
                description: "请稍候，不要重复提交",
                variant: "default"
            });
            return;
        }

        // P0-2: 增强输入验证
        const titleSeed = inputData.titleSeed.trim();

        if (!titleSeed) {
            toast({ title: "请输入标题或创意种子", variant: "destructive" });
            return;
        }

        if (titleSeed.length < 5) {
            toast({
                title: "创意种子太短",
                description: "请至少输入 5 个字符，越详细越好",
                variant: "destructive"
            });
            return;
        }

        // 推荐填写类型
        if (!inputData.genre) {
            toast({
                title: "建议选择类型",
                description: "选择类型可以帮助 AI 更好地理解您的创意",
                variant: "default"
            });
        }

        setIsGenerating(true);
        setCurrentStep("generating");
        setProgressMessage("正在连接服务器...");
        setProgressValue(0);

        try {
            // Build query string
            const params = new URLSearchParams({
                ...inputData,
                titleSeed
            });

            if (inputData.targetWordCount) {
                params.set("targetWordCount", inputData.targetWordCount);
            }

            const eventSource = new EventSource(`/api/creation/auto?${params.toString()}`);

            eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "progress") {
                        setProgressMessage(data.message);
                        setProgressValue(data.progress);
                    } else if (data.type === "completed") {
                        const { result } = data;
                        setSessionId(result.sessionId);
                        const meta = result.projectMeta;

                        setStepResults({
                            basic: {
                                title: meta.title,
                                premise: meta.premise,
                                genre: meta.genre,
                                style: meta.style,
                                themeTags: meta.themeTags,
                                coreConflicts: meta.coreConflicts,
                                keywords: meta.keywords
                            },
                            characters: {
                                characters: meta.mainEntities?.map((c: any) => ({
                                    ...c,
                                    motivation: c.shortMotivation
                                })),
                                relationships: meta.relationships
                            },
                            world: {
                                worldSetting: meta.worldSettings
                            },
                            outline: {
                                overallOutline: meta.outline,
                                opening: meta.opening,
                                climax: meta.climax,
                                ending: meta.ending,
                                plotPoints: meta.plotPoints,
                                estimatedChapters: meta.estimatedChapters
                            }
                        });

                        setCurrentStep("review");
                        toast({ title: "生成完成", description: "请审阅并确认项目内容" });
                        setIsGenerating(false);
                        eventSource.close();
                    } else if (data.type === "error") {
                        throw new Error(data.error);
                    }
                } catch (err) {
                    console.error("Error parsing SSE data:", err);
                }
            };

            eventSource.onerror = (err) => {
                console.error("SSE Error:", err);
                eventSource.close();
                setIsGenerating(false);
                toast({
                    title: "连接中断",
                    description: "与服务器的连接意外中断",
                    variant: "destructive"
                });
                setCurrentStep("input");
            };

        } catch (error: any) {
            console.error("Auto creation error:", error);
            setIsGenerating(false);
            setCurrentStep("input");

            toast({
                title: "创建失败",
                description: error.message || "未知错误",
                variant: "destructive"
            });
        }
    };

    const handleFinalize = async () => {
        if (!sessionId) return;
        setIsGenerating(true);
        try {
            const res = await fetch("/api/creation/confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    overrides: stepResults
                }),
            });

            if (!res.ok) throw new Error("Failed to create project");
            const data = await res.json();

            if (data.success) {
                toast({ title: "项目创建成功", description: "正在跳转..." });
                onSuccess(data.projectId);
            }
        } catch (error: any) {
            toast({ title: "创建失败", description: error.message, variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    };

    const variants = {
        enter: { opacity: 0, x: 20 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="flex flex-col h-full bg-background/95 backdrop-blur-sm">
            <div className="border-b bg-muted/20 px-6 py-3 flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-base tracking-tight">AI 创作向导</h2>
                        <p className="text-xs text-muted-foreground">智能构建小说世界</p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-3 py-1 rounded-full">
                    <span className={cn(currentStep === "input" && "text-primary font-medium")}>1. 创意</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className={cn(currentStep === "generating" && "text-primary font-medium")}>2. 生成</span>
                    <ArrowRight className="h-3 w-3" />
                    <span className={cn(currentStep === "review" && "text-primary font-medium")}>3. 审阅</span>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden relative">
                <AnimatePresence mode="wait">
                    {currentStep === "input" && (
                        <motion.div
                            key="input"
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.3 }}
                            className="h-full"
                        >
                            <ScrollArea className="h-full">
                                <div className="max-w-2xl mx-auto p-6 space-y-5">
                                    <div className="text-center space-y-2 mb-4">
                                        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                                            开启您的创作之旅
                                        </h1>
                                        <p className="text-muted-foreground text-xs max-w-md mx-auto">
                                            输入核心创意，AI 将为您构建完整的世界观、角色与大纲
                                        </p>
                                    </div>

                                    <div className="grid gap-4 p-5 rounded-xl border bg-card shadow-sm">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">标题 / 创意种子 <span className="text-red-500">*</span></Label>
                                            <Input
                                                placeholder="例如：赛博朋克侦探故事..."
                                                value={inputData.titleSeed}
                                                onChange={(e) => setInputData(prev => ({ ...prev, titleSeed: e.target.value }))}
                                                className="h-10"
                                                autoFocus
                                            />
                                            <p className="text-xs text-muted-foreground">越详细的描述，生成的设定越精准（至少 5 个字符）</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">类型</Label>
                                                <Select
                                                    value={inputData.genre}
                                                    onValueChange={(val) => setInputData(prev => ({ ...prev, genre: val }))}
                                                >
                                                    <SelectTrigger className="h-9">
                                                        <SelectValue placeholder="选择类型" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {genres?.map((g: any) => (
                                                            <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">风格</Label>
                                                <Input
                                                    placeholder="轻松/暗黑/硬核"
                                                    value={inputData.style}
                                                    onChange={(e) => setInputData(prev => ({ ...prev, style: e.target.value }))}
                                                    className="h-9"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">目标篇幅</Label>
                                            <Select
                                                value={inputData.targetWordCount}
                                                onValueChange={(val) => setInputData(prev => ({ ...prev, targetWordCount: val }))}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="选择篇幅" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="10000">短篇 (1万字)</SelectItem>
                                                    <SelectItem value="50000">中篇 (5万字)</SelectItem>
                                                    <SelectItem value="200000">长篇 (20万字)</SelectItem>
                                                    <SelectItem value="1000000">超长篇 (100万字+)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">补充说明</Label>
                                            <Textarea
                                                placeholder="任何额外的要求或设定..."
                                                value={inputData.premise}
                                                onChange={(e) => setInputData(prev => ({ ...prev, premise: e.target.value }))}
                                                rows={3}
                                                className="resize-none text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-center pt-3 pb-6">
                                        <Button
                                            size="default"
                                            className="w-full max-w-xs h-10 shadow-lg hover:shadow-xl transition-all rounded-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                                            onClick={handleStartAuto}
                                            disabled={isGenerating}
                                        >
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            {isGenerating ? "生成中..." : "一键生成项目"}
                                        </Button>
                                    </div>
                                </div>
                            </ScrollArea>
                        </motion.div>
                    )}

                    {currentStep === "generating" && (
                        <motion.div
                            key="generating"
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            className="h-full flex flex-col items-center justify-center p-8 space-y-6"
                        >
                            <div className="relative w-28 h-28">
                                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                                <div className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <div className="absolute inset-4 border-4 border-purple-500/30 border-b-purple-500 rounded-full animate-spin-reverse" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                                </div>
                            </div>

                            <div className="text-center space-y-3 max-w-sm">
                                <h3 className="text-xl font-bold">AI 正在构建世界...</h3>
                                <div className="h-14 flex items-center justify-center">
                                    <AnimatePresence mode="wait">
                                        <motion.p
                                            key={progressMessage}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="text-muted-foreground text-sm"
                                        >
                                            {progressMessage}
                                        </motion.p>
                                    </AnimatePresence>
                                </div>
                                <div className="w-full bg-muted/30 h-1.5 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary"
                                        initial={{ width: "0%" }}
                                        animate={{ width: `${progressValue}%` }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground pt-2">
                                    正在并行生成角色、世界观与大纲，这可能需要 10-20 秒
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {currentStep === "review" && (
                        <motion.div
                            key="review"
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            className="h-full flex flex-col"
                        >
                            <div className="px-6 py-3 border-b flex items-center justify-between bg-card shadow-sm">
                                <div>
                                    <h2 className="text-lg font-bold">项目审阅</h2>
                                    <p className="text-xs text-muted-foreground">请检查并完善内容</p>
                                </div>
                                <Button
                                    onClick={handleFinalize}
                                    size="default"
                                    className="bg-green-600 hover:bg-green-700 h-9 shadow-md"
                                    disabled={isGenerating}
                                >
                                    {isGenerating ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Save className="mr-2 h-4 w-4" />
                                    )}
                                    确认创建
                                </Button>
                            </div>

                            <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
                                <div className="px-6 pt-2 border-b bg-muted/5">
                                    <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto mb-1.5 h-9">
                                        <TabsTrigger value="basic" className="text-xs">基础</TabsTrigger>
                                        <TabsTrigger value="characters" className="text-xs">角色</TabsTrigger>
                                        <TabsTrigger value="world" className="text-xs">世界观</TabsTrigger>
                                        <TabsTrigger value="outline" className="text-xs">大纲</TabsTrigger>
                                    </TabsList>
                                </div>

                                <ScrollArea className="flex-1 bg-muted/10">
                                    <div className="max-w-4xl mx-auto p-6">
                                        {["basic", "characters", "world", "outline"].map((step) => (
                                            <TabsContent key={step} value={step} className="mt-0">
                                                <StepResultDisplay
                                                    step={step}
                                                    data={stepResults[step] || {}}
                                                    onEdit={(newData) => setStepResults(prev => ({ ...prev, [step]: newData }))}
                                                />
                                            </TabsContent>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </Tabs>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
