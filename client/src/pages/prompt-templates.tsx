import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, Trash2, Edit, Copy } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { insertPromptTemplateSchema } from "@shared/schema";
import type { PromptTemplate, Project } from "@shared/schema";
import { apiRequest, API_BASE_URL } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const categoryConfig = {
  continue: { label: "续写", color: "bg-blue-500" },
  rewrite: { label: "改写", color: "bg-green-500" },
  dialogue: { label: "对话", color: "bg-purple-500" },
  plot: { label: "情节", color: "bg-orange-500" },
  outline: { label: "大纲", color: "bg-pink-500" },
};

const formSchema = insertPromptTemplateSchema.extend({
  name: z.string().min(1, "请输入模板名称"),
  template: z.string().min(1, "请输入模板内容"),
  category: z.string().min(1, "请选择分类"),
});

export default function PromptTemplates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showGlobalOnly, setShowGlobalOnly] = useState(false);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: templates } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const response = await fetch(`${API_BASE_URL}/api/prompt-templates/${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      template: "",
      category: "continue",
      description: "",
      variables: [],
      isGlobal: false,
    },
  });

  const openEditDialog = (template: PromptTemplate) => {
    setEditingTemplate(template);
    form.reset({
      name: template.name,
      template: template.template,
      category: template.category,
      description: template.description ?? "",
      variables: template.variables || [],
      isGlobal: template.isGlobal ?? false,
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTemplate(null);
    form.reset();
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (editingTemplate) {
        return await apiRequest("PATCH", `/api/prompt-templates/${editingTemplate.id}`, data);
      }
      return await apiRequest("POST", "/api/prompt-templates", {
        projectId: selectedProjectId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates", selectedProjectId] });
      closeDialog();
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/prompt-templates/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prompt-templates", selectedProjectId] });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createTemplateMutation.mutate(values);
  };

  const copyTemplate = (template: string) => {
    navigator.clipboard.writeText(template);
    toast({
      title: "已复制",
      description: "模板内容已复制到剪贴板",
    });
  };

  const filteredTemplates = templates?.filter((t) => {
    const categoryMatch = activeCategory === "all" || t.category === activeCategory;
    const globalMatch = !showGlobalOnly || t.isGlobal;
    return categoryMatch && globalMatch;
  }) || [];

  const templatesByCategory = Object.keys(categoryConfig).reduce((acc, cat) => {
    acc[cat] = templates?.filter((t) => t.category === cat) || [];
    return acc;
  }, {} as Record<string, PromptTemplate[]>);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">提示词模板</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理AI生成的提示词模板，提升创作效率
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button disabled={!selectedProjectId}>
              <Plus className="h-4 w-4 mr-2" />
              添加模板
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingTemplate ? "编辑模板" : "添加模板"}</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[calc(90vh-8rem)] pr-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>模板名称</FormLabel>
                          <FormControl>
                            <Input placeholder="如：玄幻续写模板" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>分类</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(categoryConfig).map(([key, { label }]) => (
                                <SelectItem key={key} value={key}>
                                  {label}
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>描述</FormLabel>
                        <FormControl>
                          <Input placeholder="简要描述模板用途" {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="template"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>模板内容</FormLabel>
                        <FormDescription>
                          使用 {"{变量名}"} 定义变量，如 {"{角色名}"} {"{场景描述}"}
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            placeholder="输入提示词模板..."
                            rows={12}
                            className="font-mono text-sm"
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
                          <FormLabel>全局模板</FormLabel>
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
                    <Button type="submit" disabled={createTemplateMutation.isPending}>
                      {createTemplateMutation.isPending ? "保存中..." : editingTemplate ? "保存修改" : "添加模板"}
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
            仅显示全局模板
          </label>
        </div>
      </div>

      {selectedProjectId ? (
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList>
            <TabsTrigger value="all">
              全部 ({templates?.length || 0})
            </TabsTrigger>
            {Object.entries(categoryConfig).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key}>
                {label} ({templatesByCategory[key].length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-6">
            {filteredTemplates.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无模板</h3>
                  <p className="text-sm text-muted-foreground">
                    点击"添加模板"开始创建提示词模板
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredTemplates.map((template) => {
                  const config = categoryConfig[template.category as keyof typeof categoryConfig];
                  return (
                    <Card key={template.id} className="group hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-5 w-5 text-primary" />
                              <CardTitle className="text-lg">{template.name}</CardTitle>
                              <Badge className={config?.color}>
                                {config?.label || template.category}
                              </Badge>
                              {template.isGlobal && (
                                <Badge variant="outline">全局</Badge>
                              )}
                              {template.usageCount && template.usageCount > 0 && (
                                <Badge variant="secondary">
                                  已用 {template.usageCount} 次
                                </Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground">
                                {template.description}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => copyTemplate(template.template)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(template)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="rounded-md bg-muted p-4">
                          <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                            {template.template}
                          </pre>
                        </div>
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
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以管理提示词模板
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
