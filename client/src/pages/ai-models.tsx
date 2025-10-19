import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Sparkles, Trash2, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertAIModelSchema, type AIModel } from "@shared/schema";
import { z } from "zod";

const providers = [
  { value: "deepseek", label: "DeepSeek", defaultModel: "deepseek-chat", defaultUrl: "https://api.deepseek.com" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-5", defaultUrl: "https://api.openai.com/v1" },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4-20250514", defaultUrl: "https://api.anthropic.com/v1" },
  { value: "custom", label: "自定义", defaultModel: "", defaultUrl: "" },
];

const formSchema = insertAIModelSchema.extend({
  name: z.string().min(1, "请输入模型名称"),
  provider: z.string().min(1, "请选择提供商"),
  modelId: z.string().min(1, "请输入模型ID"),
});

export default function AIModels() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: models } = useQuery<AIModel[]>({
    queryKey: ["/api/ai-models"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      provider: "deepseek",
      modelId: "deepseek-chat",
      baseUrl: "https://api.deepseek.com",
      isActive: true,
      isDefault: false,
    },
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest("POST", "/api/ai-models", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
      form.reset();
      setDialogOpen(false);
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/ai-models/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/ai-models/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/ai-models/${id}/set-default`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-models"] });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createModelMutation.mutate(values);
  };

  const handleProviderChange = (provider: string) => {
    const providerConfig = providers.find((p) => p.value === provider);
    if (providerConfig) {
      form.setValue("modelId", providerConfig.defaultModel);
      form.setValue("baseUrl", providerConfig.defaultUrl);
    }
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">AI模型配置</h1>
          <p className="text-sm text-muted-foreground mt-1">
            配置和管理AI创作模型
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-model">
              <Plus className="h-4 w-4 mr-2" />
              添加模型
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>添加AI模型</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                          <SelectTrigger data-testid="select-provider">
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>模型名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例：DeepSeek Chat" {...field} data-testid="input-model-name" />
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
                      <FormLabel>模型ID</FormLabel>
                      <FormControl>
                        <Input placeholder="deepseek-chat" {...field} data-testid="input-model-id" />
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
                      <FormLabel>API地址</FormLabel>
                      <FormControl>
                        <Input placeholder="https://api.deepseek.com" {...field} data-testid="input-base-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-is-active"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">启用模型</FormLabel>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isDefault"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-is-default"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">设为默认</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createModelMutation.isPending}>
                    {createModelMutation.isPending ? "添加中..." : "添加模型"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {models && models.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => (
            <Card key={model.id} className={!model.isActive ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <CardTitle className="text-base">{model.name}</CardTitle>
                      {model.isDefault && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          默认
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-xs">
                      {model.provider} · {model.modelId}
                    </CardDescription>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => deleteModelMutation.mutate(model.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">状态</span>
                  <Switch
                    checked={model.isActive}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({ id: model.id, isActive: checked })
                    }
                  />
                </div>

                {!model.isDefault && model.isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => setDefaultMutation.mutate(model.id)}
                  >
                    设为默认模型
                  </Button>
                )}

                {model.baseUrl && (
                  <div className="text-xs text-muted-foreground truncate">
                    {model.baseUrl}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">暂无AI模型</h3>
            <p className="text-sm text-muted-foreground mb-6">
              添加您的第一个AI模型配置
            </p>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-add-first-model">
              <Plus className="h-4 w-4 mr-2" />
              添加模型
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
