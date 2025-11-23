import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Lightbulb, Trash2, Edit, Zap, TrendingUp, RotateCcw, AlertTriangle, Sparkles, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertPlotCardSchema, type Project, type PlotCard } from "@shared/schema";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const plotTypeConfig = {
  逆袭: { icon: TrendingUp, color: "text-green-500" },
  打脸: { icon: Zap, color: "text-red-500" },
  反转: { icon: RotateCcw, color: "text-blue-500" },
  危机: { icon: AlertTriangle, color: "text-orange-500" },
  高潮: { icon: Sparkles, color: "text-purple-500" },
  铺垫: { icon: Layers, color: "text-gray-500" },
};

const formSchema = insertPlotCardSchema.extend({
  title: z.string().min(1, "请输入标题"),
  content: z.string().min(1, "请输入内容"),
  type: z.string().min(1, "请选择类型"),
});

export default function PlotCards() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PlotCard | null>(null);
  const [activeType, setActiveType] = useState<string>("all");
  const [showGlobalOnly, setShowGlobalOnly] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: plotCards } = useQuery<PlotCard[]>({
    queryKey: ["/api/plot-cards", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const response = await fetch(`/api/plot-cards/${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch plot cards");
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      type: "逆袭",
      tags: [],
      isGlobal: false,
    },
  });

  const openEditDialog = (card: PlotCard) => {
    setEditingCard(card);
    form.reset({
      title: card.title,
      content: card.content,
      type: card.type,
      tags: card.tags || [],
      isGlobal: card.isGlobal ?? false,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCard(null);
    form.reset();
  };

  const createCardMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (editingCard) {
        return await apiRequest("PATCH", `/api/plot-cards/${editingCard.id}`, data);
      }
      return await apiRequest("POST", "/api/plot-cards", {
        projectId: selectedProjectId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plot-cards", selectedProjectId] });
      closeDialog();
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/plot-cards/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plot-cards", selectedProjectId] });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCardMutation.mutate(values);
  };

  const filteredCards = plotCards?.filter((card) => {
    const typeMatch = activeType === "all" || card.type === activeType;
    const globalMatch = !showGlobalOnly || card.isGlobal;
    return typeMatch && globalMatch;
  }) || [];

  const cardsByType = Object.keys(plotTypeConfig).reduce((acc, type) => {
    acc[type] = plotCards?.filter((c) => c.type === type) || [];
    return acc;
  }, {} as Record<string, PlotCard[]>);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">情节卡片库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理可复用的情节模块，快速构建精彩桥段
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => open ? setDialogOpen(true) : closeDialog()}>
          <DialogTrigger asChild>
            <Button disabled={!selectedProjectId}>
              <Plus className="h-4 w-4 mr-2" />
              添加卡片
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingCard ? "编辑情节卡片" : "添加情节卡片"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>标题</FormLabel>
                          <FormControl>
                            <Input placeholder="如：主角被羞辱后爆发" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>类型</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.keys(plotTypeConfig).map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="tags"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>标签</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="使用逗号分隔多个标签，如：爽文,复仇"
                            value={field.value?.join(",") || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val ? val.split(",").map(t => t.trim()).filter(Boolean) : []);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>情节内容</FormLabel>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-primary"
                            onClick={async () => {
                              const title = form.getValues("title");
                              const type = form.getValues("type");
                              const tags = form.getValues("tags");

                              if (!title) {
                                toast({
                                  title: "请先输入标题",
                                  variant: "destructive",
                                });
                                return;
                              }

                              try {
                                const res = await apiRequest("POST", "/api/plot-cards/generate", {
                                  title,
                                  type,
                                  tags,
                                  projectId: selectedProjectId
                                });
                                const data = await res.json();
                                form.setValue("content", data.content);
                              } catch (error) {
                                toast({
                                  title: "生成失败",
                                  description: "AI生成情节失败，请稍后重试",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI生成
                          </Button>
                        </div>
                        <FormControl>
                          <Textarea
                            placeholder="详细描述情节发展..."
                            rows={10}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isGlobal"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>全局卡片</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            可在所有项目中使用
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value ?? false}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={closeDialog}>
                      取消
                    </Button>
                    <Button type="submit" disabled={createCardMutation.isPending}>
                      {createCardMutation.isPending ? "保存中..." : editingCard ? "保存修改" : "添加卡片"}
                    </Button>
                  </div>
                </form>
              </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-64">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="选择项目" />
            </SelectTrigger>
            <SelectContent>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="global-filter"
            checked={showGlobalOnly}
            onCheckedChange={setShowGlobalOnly}
          />
          <label htmlFor="global-filter" className="text-sm text-muted-foreground cursor-pointer">
            仅显示全局卡片
          </label>
        </div>
      </div>

      {selectedProjectId ? (
        <Tabs value={activeType} onValueChange={setActiveType}>
          <TabsList>
            <TabsTrigger value="all">
              全部 ({plotCards?.length || 0})
            </TabsTrigger>
            {Object.keys(plotTypeConfig).map((type) => (
              <TabsTrigger key={type} value={type}>
                {type} ({cardsByType[type].length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeType} className="mt-6">
            {filteredCards.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无情节卡片</h3>
                  <p className="text-sm text-muted-foreground">
                    点击"添加卡片"开始构建情节库
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCards.map((card) => {
                  const config = plotTypeConfig[card.type as keyof typeof plotTypeConfig];
                  const Icon = config?.icon || Lightbulb;
                  return (
                    <Card key={card.id} className="group hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Icon className={`h-5 w-5 ${config?.color || "text-muted-foreground"}`} />
                            <CardTitle className="text-base line-clamp-1">{card.title}</CardTitle>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(card)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteCardMutation.mutate(card.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {card.type}
                          </Badge>
                          {card.isGlobal && (
                            <Badge variant="outline" className="text-xs">
                              全局
                            </Badge>
                          )}
                          {card.usageCount && card.usageCount > 0 && (
                            <Badge variant="outline" className="text-xs">
                              已用 {card.usageCount} 次
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-4">
                          {card.content}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以管理情节卡片
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
