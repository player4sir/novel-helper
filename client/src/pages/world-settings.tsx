import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Globe, Trash2, Edit, Swords, Map, Building2, Scroll, Package, Sparkles } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { insertWorldSettingSchema } from "@shared/schema";
import type { WorldSetting, Project } from "@shared/schema";
import { apiRequest, API_BASE_URL } from "@/lib/queryClient";
import { GenerateWorldSettingsDialog } from "@/components/world/generate-world-settings-dialog";

const categoryConfig = {
  power_system: { label: "力量体系", icon: Swords, color: "text-red-500" },
  geography: { label: "地理", icon: Map, color: "text-green-500" },
  faction: { label: "势力", icon: Building2, color: "text-blue-500" },
  rules: { label: "规则", icon: Scroll, color: "text-purple-500" },
  items: { label: "物品", icon: Package, color: "text-yellow-500" },
};

const formSchema = insertWorldSettingSchema.extend({
  title: z.string().min(1, "请输入标题"),
  content: z.string().min(1, "请输入内容"),
  category: z.string().min(1, "请选择分类"),
});

export default function WorldSettings() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<WorldSetting | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: worldSettings } = useQuery<WorldSetting[]>({
    queryKey: ["/api/world-settings", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const response = await fetch(`${API_BASE_URL}/api/world-settings/${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch world settings");
      return response.json();
    },
    enabled: !!selectedProjectId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: "",
      title: "",
      content: "",
      category: "power_system",
      tags: [],
    },
  });

  const openEditDialog = (setting: WorldSetting) => {
    setEditingSetting(setting);
    form.reset({
      projectId: setting.projectId,
      title: setting.title,
      content: setting.content,
      category: setting.category,
      tags: setting.tags || [],
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSetting(null);
    form.reset();
  };

  const createSettingMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (editingSetting) {
        return await apiRequest("PATCH", `/api/world-settings/${editingSetting.id}`, data);
      }
      return await apiRequest("POST", "/api/world-settings", {
        ...data,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/world-settings", selectedProjectId] });
      closeDialog();
    },
  });

  const deleteSettingMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/world-settings/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/world-settings", selectedProjectId] });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createSettingMutation.mutate(values);
  };

  const filteredSettings = worldSettings?.filter(
    (s) => activeCategory === "all" || s.category === activeCategory
  ) || [];

  const settingsByCategory = Object.keys(categoryConfig).reduce((acc, cat) => {
    acc[cat] = worldSettings?.filter((s) => s.category === cat) || [];
    return acc;
  }, {} as Record<string, WorldSetting[]>);

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">世界观设定</h1>
          <p className="text-sm text-muted-foreground mt-1">
            构建小说的世界体系、力量规则和背景设定
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateWorldSettingsDialog
            projectId={selectedProjectId}
            category={activeCategory !== "all" ? activeCategory : undefined}
          >
            <Button variant="outline" disabled={!selectedProjectId}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI生成
            </Button>
          </GenerateWorldSettingsDialog>
          <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
            <DialogTrigger asChild>
              <Button disabled={!selectedProjectId}>
                <Plus className="h-4 w-4 mr-2" />
                添加设定
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingSetting ? "编辑设定" : "添加设定"}</DialogTitle>
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
                              <Input placeholder="如：修炼境界体系" {...field} />
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
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>详细内容</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="详细描述世界观设定..."
                              rows={12}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-3 pt-4">
                      <Button type="button" variant="outline" onClick={closeDialog}>
                        取消
                      </Button>
                      <Button type="submit" disabled={createSettingMutation.isPending}>
                        {createSettingMutation.isPending ? "保存中..." : editingSetting ? "保存修改" : "添加设定"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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

      {selectedProjectId ? (
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList>
            <TabsTrigger value="all">
              全部 ({worldSettings?.length || 0})
            </TabsTrigger>
            {Object.entries(categoryConfig).map(([key, { label }]) => (
              <TabsTrigger key={key} value={key}>
                {label} ({settingsByCategory[key].length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeCategory} className="mt-6">
            {filteredSettings.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无设定</h3>
                  <p className="text-sm text-muted-foreground">
                    点击"添加设定"开始构建世界观
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSettings.map((setting) => {
                  const config = categoryConfig[setting.category as keyof typeof categoryConfig];
                  const Icon = config?.icon || Globe;
                  return (
                    <Card key={setting.id} className="group hover:border-primary/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Icon className={`h-5 w-5 ${config?.color || "text-muted-foreground"}`} />
                            <CardTitle className="text-base">{setting.title}</CardTitle>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => openEditDialog(setting)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteSettingMutation.mutate(setting.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <Badge variant="secondary" className="w-fit text-xs">
                          {config?.label || setting.category}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-4">
                          {setting.content}
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
            <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以管理世界观设定
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
