import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2, Check, Settings, Zap, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { type AIModel } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  getLocalAIModels,
  addLocalAIModel,
  deleteLocalAIModel,
  setActiveLocalModelId,
  getActiveLocalModelId,
  type LocalAIModel
} from "@/lib/ai-config";

const providers = [
  {
    value: "deepseek",
    label: "DeepSeek",
    defaultUrl: "https://api.deepseek.com/v1",
    defaultChatModel: "deepseek-chat",
    defaultEmbeddingModel: "deepseek-embedding"
  },
  {
    value: "openai",
    label: "OpenAI",
    defaultUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o",
    defaultEmbeddingModel: "text-embedding-3-large"
  },
  {
    value: "anthropic",
    label: "Anthropic",
    defaultUrl: "https://api.anthropic.com/v1",
    defaultChatModel: "claude-3-5-sonnet-20241022",
    defaultEmbeddingModel: ""
  },
  {
    value: "zhipu",
    label: "智谱AI",
    defaultUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultChatModel: "glm-4-plus",
    defaultEmbeddingModel: "embedding-3"
  },
  {
    value: "qwen",
    label: "通义千问",
    defaultUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultChatModel: "qwen-max",
    defaultEmbeddingModel: "text-embedding-v3"
  },
  {
    value: "moonshot",
    label: "月之暗面",
    defaultUrl: "https://api.moonshot.cn/v1",
    defaultChatModel: "moonshot-v1-8k",
    defaultEmbeddingModel: ""
  },
  {
    value: "baichuan",
    label: "百川智能",
    defaultUrl: "https://api.baichuan-ai.com/v1",
    defaultChatModel: "Baichuan4",
    defaultEmbeddingModel: "Baichuan-Text-Embedding"
  },
  {
    value: "siliconflow",
    label: "硅基流动",
    defaultUrl: "https://api.siliconflow.cn/v1",
    defaultChatModel: "deepseek-ai/DeepSeek-V3",
    defaultEmbeddingModel: "BAAI/bge-large-zh-v1.5"
  },
  {
    value: "custom",
    label: "自定义",
    defaultUrl: "",
    defaultChatModel: "",
    defaultEmbeddingModel: ""
  },
];

const formSchema = z.object({
  name: z.string().min(1, "请输入模型名称"),
  provider: z.string().min(1, "请选择提供商"),
  modelType: z.enum(["chat", "embedding"], { required_error: "请选择模型类型" }),
  modelId: z.string().min(1, "请输入模型ID"),
  apiKey: z.string().optional().nullable(),
  baseUrl: z.string().optional().nullable(),
  defaultParams: z.any().optional(),
  dimension: z.number().optional().nullable(),
  isActive: z.boolean().optional(),
  isDefaultChat: z.boolean().optional(),
  isDefaultEmbedding: z.boolean().optional(),
});

interface ModelParams {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export default function AIModels() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "embedding" | "local">("chat");
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);
  const [storageType, setStorageType] = useState<"server" | "local">("server");
  const [localModels, setLocalModels] = useState<LocalAIModel[]>([]);
  const [activeLocalModelId, setActiveLocalModelIdState] = useState<string | null>(null);

  useEffect(() => {
    refreshLocalModels();
  }, []);

  const refreshLocalModels = () => {
    setLocalModels(getLocalAIModels());
    setActiveLocalModelIdState(getActiveLocalModelId());
  };

  const getModelParams = (params: unknown): ModelParams => {
    if (!params || typeof params !== 'object') {
      return { temperature: 0.7, max_tokens: 4000, top_p: 0.9 };
    }
    const p = params as Record<string, any>;
    return {
      temperature: p.temperature ?? 0.7,
      max_tokens: p.max_tokens ?? 4000,
      top_p: p.top_p ?? 0.9,
    };
  };

  const { data: models, isLoading: modelsLoading } = useQuery<AIModel[]>({
    queryKey: ["/api/ai-models"],
  });

  const chatModels = models?.filter(m => m.modelType === "chat") || [];
  const embeddingModels = models?.filter(m => m.modelType === "embedding") || [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      provider: "deepseek",
      modelType: "chat",
      modelId: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "",
      isActive: true,
      isDefaultChat: false,
      isDefaultEmbedding: false,
      defaultParams: { temperature: 0.7, max_tokens: 4000, top_p: 0.9 },
      dimension: null,
    },
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (editingModel) {
        return await apiRequest("PATCH", `/api/ai-models/${editingModel.id}`, data);
      }
      return await apiRequest("POST", "/api/ai-models", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
      form.reset();
      setDialogOpen(false);
      setEditingModel(null);
      toast({
        title: editingModel ? "模型已更新" : "模型已添加",
        description: "AI 模型配置已保存",
      });
    },
    onError: (error: any) => {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      setDeletingModelId(id);
      return await apiRequest("DELETE", `/api/ai-models/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
      toast({
        title: "模型已删除",
        description: "AI 模型配置已移除",
      });
      setDeletingModelId(null);
    },
    onError: (error: any) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
      setDeletingModelId(null);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      setTogglingModelId(id);
      return await apiRequest("PATCH", `/api/ai-models/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
      setTogglingModelId(null);
    },
    onError: (error: any) => {
      toast({
        title: "操作失败",
        description: error.message,
        variant: "destructive",
      });
      setTogglingModelId(null);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/ai-models/${id}/set-default`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
      toast({
        title: "默认模型已设置",
      });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (model: AIModel | LocalAIModel) => {
      setTestingModelId(model.id);
      const response = await apiRequest("POST", "/api/ai-models/test", {
        provider: model.provider,
        modelType: model.modelType,
        modelId: model.modelId,
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({
          title: "连接成功",
          description: data.message ? `${data.message} - 延迟: ${data.latency}ms` : `延迟: ${data.latency}ms`,
        });
      } else {
        toast({
          title: "连接失败",
          description: data.error || "未知错误",
          variant: "destructive",
        });
      }
      setTestingModelId(null);
    },
    onError: (error: any) => {
      toast({
        title: "测试失败",
        description: error.message || "网络错误",
        variant: "destructive",
      });
      setTestingModelId(null);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (storageType === "local") {
      const newModel: LocalAIModel = {
        id: editingModel?.id || crypto.randomUUID(),
        ...values,
        apiKey: values.apiKey || undefined,
        baseUrl: values.baseUrl || undefined,
        dimension: values.dimension || undefined,
      };
      addLocalAIModel(newModel);
      refreshLocalModels();
      setDialogOpen(false);
      setEditingModel(null);
      toast({
        title: editingModel ? "本地模型已更新" : "本地模型已添加",
        description: "配置已保存到浏览器本地存储",
      });
    } else {
      createModelMutation.mutate(values);
    }
  };

  const handleProviderChange = (provider: string) => {
    const providerConfig = providers.find((p) => p.value === provider);
    if (providerConfig) {
      form.setValue("baseUrl", providerConfig.defaultUrl);
      const modelType = form.getValues("modelType");
      const defaultModel = modelType === "chat" ? providerConfig.defaultChatModel : providerConfig.defaultEmbeddingModel;
      if (defaultModel) {
        form.setValue("modelId", defaultModel);
      }
    }
  };

  const handleModelTypeChange = (modelType: "chat" | "embedding") => {
    const provider = form.getValues("provider");
    const providerConfig = providers.find((p) => p.value === provider);
    if (providerConfig) {
      const defaultModel = modelType === "chat" ? providerConfig.defaultChatModel : providerConfig.defaultEmbeddingModel;
      if (defaultModel) {
        form.setValue("modelId", defaultModel);
      }
    }
  };

  const handleEdit = (model: AIModel | LocalAIModel) => {
    // Check if it's a local model by checking for 'createdAt' property which exists on AIModel but not LocalAIModel
    // Or we can just check if it exists in localModels
    const isLocal = !('createdAt' in model);
    setStorageType(isLocal ? "local" : "server");

    // Cast to AIModel for compatibility with setEditingModel, 
    // but we know it might be LocalAIModel. 
    // The id field is compatible.
    setEditingModel(model as AIModel);

    const params = getModelParams(model.defaultParams);
    form.reset({
      name: model.name,
      provider: model.provider,
      modelType: model.modelType as "chat" | "embedding",
      modelId: model.modelId,
      baseUrl: model.baseUrl || "",
      apiKey: model.apiKey || "",
      isActive: model.isActive ?? true,
      isDefaultChat: model.isDefaultChat ?? false,
      isDefaultEmbedding: model.isDefaultEmbedding ?? false,
      defaultParams: params,
      dimension: model.dimension,
    });
    setDialogOpen(true);
  };

  const renderModelCard = (model: AIModel | LocalAIModel) => {
    const params = getModelParams(model.defaultParams);
    const providerLabel = providers.find(p => p.value === model.provider)?.label || model.provider;
    const isDefault = model.modelType === "chat" ? model.isDefaultChat : model.isDefaultEmbedding;
    const isDeleting = deletingModelId === model.id;
    const isToggling = togglingModelId === model.id;
    const isTesting = testingModelId === model.id;

    // Local model specific logic
    const isLocal = !('createdAt' in model);
    const isActiveLocal = isLocal && activeLocalModelId === model.id;

    return (
      <Card key={model.id} className={`group hover:shadow-md transition-shadow ${!model.isActive ? "opacity-60" : ""} ${isDeleting ? "opacity-50 pointer-events-none" : ""} ${isActiveLocal ? "border-primary ring-1 ring-primary" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-md ${model.modelType === "chat" ? "bg-primary/10" : "bg-purple-500/10"}`}>
                  <Sparkles className={`h-3.5 w-3.5 ${model.modelType === "chat" ? "text-primary" : "text-purple-500"}`} />
                </div>
                <CardTitle className="text-base font-semibold truncate">{model.name}</CardTitle>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-normal">
                  {providerLabel}
                </Badge>
                <Badge variant={model.modelType === "chat" ? "default" : "secondary"} className="text-xs">
                  {model.modelType === "chat" ? "对话" : "向量"}
                </Badge>
                {isDefault && !isLocal && (
                  <Badge variant="default" className="text-xs bg-green-500 hover:bg-green-600">
                    <Check className="h-3 w-3 mr-1" />
                    默认
                  </Badge>
                )}
                {isLocal && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
                    本地
                  </Badge>
                )}
                {isActiveLocal && (
                  <Badge variant="default" className="text-xs bg-primary hover:bg-primary/90">
                    当前启用
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-primary/10"
                onClick={() => handleEdit(model)}
                disabled={isDeleting || isTesting}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (isLocal) {
                    if (confirm("确定要删除这个本地配置吗？")) {
                      deleteLocalAIModel(model.id);
                      refreshLocalModels();
                      toast({ title: "已删除", description: "本地模型配置已移除" });
                    }
                  } else {
                    deleteModelMutation.mutate(model.id);
                  }
                }}
                disabled={isDeleting || isTesting}
              >
                {isDeleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          <div className="text-xs text-muted-foreground font-mono truncate bg-muted/50 px-2 py-1.5 rounded">
            {model.modelId}
          </div>

          {model.modelType === "chat" && model.defaultParams ? (
            <div className="grid grid-cols-3 gap-2 p-2 bg-muted/30 rounded-md">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-0.5">Temp</div>
                <div className="text-sm font-medium">{params.temperature}</div>
              </div>
              <div className="text-center border-x border-border/50">
                <div className="text-xs text-muted-foreground mb-0.5">Tokens</div>
                <div className="text-sm font-medium">{params.max_tokens}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-0.5">Top-P</div>
                <div className="text-sm font-medium">{params.top_p}</div>
              </div>
            </div>
          ) : null}

          {model.dimension && (
            <div className="flex items-center gap-2 text-xs p-2 bg-purple-500/5 rounded-md border border-purple-500/20">
              <Settings className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-muted-foreground">向量维度:</span>
              <span className="font-medium">{model.dimension}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">状态</span>
            <div className="flex items-center gap-2">
              {isToggling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              <Switch
                checked={model.isActive ?? true}
                onCheckedChange={(checked) => {
                  if (isLocal) {
                    const updated = { ...model, isActive: checked } as LocalAIModel;
                    addLocalAIModel(updated);
                    refreshLocalModels();
                  } else {
                    toggleActiveMutation.mutate({ id: model.id, isActive: checked });
                  }
                }}
                disabled={isToggling || isDeleting}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            {!isDefault && !isLocal && model.isActive && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={() => setDefaultMutation.mutate(model.id)}
                disabled={setDefaultMutation.isPending || isDeleting || isTesting}
              >
                {setDefaultMutation.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1.5" />
                )}
                设为默认
              </Button>
            )}

            {isLocal && (
              <Button
                size="sm"
                variant={isActiveLocal ? "default" : "outline"}
                className="flex-1 h-8 text-xs"
                onClick={() => {
                  if (isActiveLocal) {
                    setActiveLocalModelId(null);
                    setActiveLocalModelIdState(null);
                    toast({ title: "已取消激活", description: "恢复使用服务器端默认配置" });
                  } else {
                    setActiveLocalModelId(model.id);
                    setActiveLocalModelIdState(model.id);
                    toast({ title: "已激活本地配置", description: "后续请求将优先使用此模型配置" });
                  }
                }}
              >
                <Check className={`h-3 w-3 mr-1.5 ${isActiveLocal ? "text-white" : ""}`} />
                {isActiveLocal ? "已激活" : "使用此配置"}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className={`h-8 text-xs ${(!isDefault && !isLocal && model.isActive) || isLocal ? "flex-1" : "w-full"}`}
              onClick={() => testConnectionMutation.mutate(model)}
              disabled={isTesting || isDeleting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  测试中
                </>
              ) : (
                <>
                  <Zap className="h-3 w-3 mr-1.5" />
                  测试连接
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI 模型配置</h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置对话模型和向量模型，支持主流国内外服务商
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingModel(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              添加模型
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingModel ? "编辑模型" : "添加 AI 模型"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="bg-muted/50 p-3 rounded-md mb-4">
                  <Label className="mb-2 block">存储位置</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="storage-server"
                        name="storageType"
                        checked={storageType === "server"}
                        onChange={() => setStorageType("server")}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="storage-server" className="cursor-pointer">服务器 (推荐)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="storage-local"
                        name="storageType"
                        checked={storageType === "local"}
                        onChange={() => setStorageType("local")}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="storage-local" className="cursor-pointer">本地浏览器 (隐私)</Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {storageType === "server"
                      ? "配置将保存在服务器数据库中，可跨设备同步。"
                      : "配置仅保存在当前浏览器中，API Key 不会上云，更安全但无法跨设备。"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>提供商</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            handleProviderChange(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {providers.map((provider) => (
                              <SelectItem key={provider.value} value={provider.value}>
                                {provider.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modelType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>模型类型</FormLabel>
                        <Select
                          onValueChange={(value: "chat" | "embedding") => {
                            field.onChange(value);
                            handleModelTypeChange(value);
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="chat">对话模型</SelectItem>
                            <SelectItem value="embedding">向量模型</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模型名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例：DeepSeek Chat" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模型 ID</FormLabel>
                      <FormControl>
                        <Input placeholder="deepseek-chat" {...field} />
                      </FormControl>
                      <FormDescription>
                        实际调用的模型标识符
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="baseUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API 地址</FormLabel>
                      <FormControl>
                        <Input placeholder="https://api.deepseek.com/v1" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key（可选）</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="留空则使用环境变量配置"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        自定义 API Key，留空则使用 .env 中的配置
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("modelType") === "embedding" && (
                  <FormField
                    control={form.control}
                    name="dimension"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>向量维度</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1536"
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormDescription>
                          向量模型的输出维度
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch("modelType") === "chat" && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="text-sm font-medium">模型参数</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="defaultParams.temperature"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Temperature</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="2"
                                placeholder="0.7"
                                {...field}
                                value={field.value ?? 0.7}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.7)}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              0-2，控制随机性
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="defaultParams.max_tokens"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Tokens</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="4000"
                                {...field}
                                value={field.value ?? 4000}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 4000)}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              最大输出长度
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="defaultParams.top_p"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Top P</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="1"
                                placeholder="0.9"
                                {...field}
                                value={field.value ?? 0.9}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.9)}
                              />
                            </FormControl>
                            <FormDescription className="text-xs">
                              0-1，核采样
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="!mt-0">启用模型</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value ?? true}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch("modelType") === "chat" && (
                    <FormField
                      control={form.control}
                      name="isDefaultChat"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel className="!mt-0">设为默认对话模型</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch("modelType") === "embedding" && (
                    <FormField
                      control={form.control}
                      name="isDefaultEmbedding"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between">
                          <FormLabel className="!mt-0">设为默认向量模型</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value ?? false}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => {
                    setDialogOpen(false);
                    setEditingModel(null);
                    form.reset();
                  }}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createModelMutation.isPending}>
                    {createModelMutation.isPending ? "保存中..." : editingModel ? "更新模型" : "添加模型"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "chat" | "embedding" | "local")}>
        <TabsList>
          <TabsTrigger value="chat">
            对话模型 ({chatModels.length})
          </TabsTrigger>
          <TabsTrigger value="embedding">
            向量模型 ({embeddingModels.length})
          </TabsTrigger>
          <TabsTrigger value="local">
            本地模型 ({localModels.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          {modelsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : chatModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chatModels.map(renderModelCard)}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无对话模型</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  添加您的第一个对话模型配置
                </p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加模型
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="embedding" className="mt-6">
          {modelsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : embeddingModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {embeddingModels.map(renderModelCard)}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无向量模型</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  添加您的第一个向量模型配置
                </p>
                <Button onClick={() => {
                  form.setValue("modelType", "embedding");
                  setDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加模型
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="local" className="mt-6">
          {localModels.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localModels.map(renderModelCard)}
            </div>
          ) : (
            <Card className="p-12">
              <div className="text-center">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无本地模型</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  本地模型配置仅保存在您的浏览器中，不会上传到服务器。
                </p>
                <Button onClick={() => {
                  setStorageType("local");
                  setDialogOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加本地模型
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
