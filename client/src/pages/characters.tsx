import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Trash2, User, Edit, ChevronDown, ChevronUp, Sparkles, Heart, Target, Brain, Zap, BookOpen, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertCharacterSchema, type Project, type Character } from "@shared/schema";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const roleLabels = {
  protagonist: { label: "主角", variant: "default" as const, color: "bg-blue-500", icon: Sparkles },
  supporting: { label: "配角", variant: "secondary" as const, color: "bg-green-500", icon: Users },
  antagonist: { label: "反派", variant: "destructive" as const, color: "bg-red-500", icon: Zap },
  group: { label: "群像", variant: "outline" as const, color: "bg-purple-500", icon: BookOpen },
};

const formSchema = insertCharacterSchema.extend({
  name: z.string().min(1, "请输入角色名称"),
  role: z.string().min(1, "请选择角色定位"),
});

export default function Characters() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: characters } = useQuery<Character[]>({
    queryKey: ["/api/characters", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: "",
      name: "",
      role: "supporting",
      gender: "",
      age: "",
      appearance: "",
      personality: "",
      background: "",
      abilities: "",
      notes: "",
    },
  });

  const openEditDialog = (character: Character) => {
    setEditingCharacter(character);
    form.reset({
      projectId: character.projectId,
      name: character.name,
      role: character.role,
      gender: character.gender ?? "",
      age: character.age ?? "",
      appearance: character.appearance ?? "",
      personality: character.personality ?? "",
      background: character.background ?? "",
      abilities: character.abilities ?? "",
      notes: character.notes ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCharacter(null);
    form.reset();
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const createCharacterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (editingCharacter) {
        return await apiRequest("PATCH", `/api/characters/${editingCharacter.id}`, data);
      }
      return await apiRequest("POST", "/api/characters", {
        ...data,
        projectId: selectedProjectId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", selectedProjectId] });
      closeDialog();
    },
  });

  const deleteCharacterMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/characters/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", selectedProjectId] });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCharacterMutation.mutate(values);
  };

  const groupedCharacters = {
    protagonist: characters?.filter((c) => c.role === "protagonist") || [],
    supporting: characters?.filter((c) => c.role === "supporting") || [],
    antagonist: characters?.filter((c) => c.role === "antagonist") || [],
    group: characters?.filter((c) => c.role === "group") || [],
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">人物设定</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理小说中的角色信息和关系
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button disabled={!selectedProjectId} data-testid="button-add-character">
              <Plus className="h-4 w-4 mr-2" />
              添加角色
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingCharacter ? "编辑角色" : "添加角色"}</DialogTitle>
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
                        <FormLabel>角色名称</FormLabel>
                        <FormControl>
                          <Input placeholder="张三" {...field} data-testid="input-character-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>角色定位</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-character-role">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([key, { label }]) => (
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>性别</FormLabel>
                        <FormControl>
                          <Input placeholder="男/女" {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>年龄</FormLabel>
                        <FormControl>
                          <Input placeholder="25岁" {...field} value={field.value ?? ""} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="appearance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>外貌特征</FormLabel>
                      <FormControl>
                        <Textarea placeholder="描述角色的外貌特征..." rows={2} {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="personality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>性格特点</FormLabel>
                      <FormControl>
                        <Textarea placeholder="描述角色的性格..." rows={2} {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="background"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>背景故事</FormLabel>
                      <FormControl>
                        <Textarea placeholder="角色的背景和经历..." rows={3} {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="abilities"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>能力/金手指</FormLabel>
                      <FormControl>
                        <Textarea placeholder="角色的特殊能力..." rows={2} {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备注</FormLabel>
                      <FormControl>
                        <Textarea placeholder="其他备注信息..." rows={2} {...field} value={field.value ?? ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createCharacterMutation.isPending}>
                    {createCharacterMutation.isPending ? "保存中..." : editingCharacter ? "保存修改" : "添加角色"}
                  </Button>
                </div>
              </form>
            </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="w-64">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger data-testid="select-project-characters">
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
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">
              全部 ({characters?.length || 0})
            </TabsTrigger>
            {Object.entries(roleLabels).map(([roleKey, { label }]) => (
              <TabsTrigger key={roleKey} value={roleKey}>
                {label} ({groupedCharacters[roleKey as keyof typeof groupedCharacters].length})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            {!characters || characters.length === 0 ? (
              <Card className="p-12">
                <div className="text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">暂无角色</h3>
                  <p className="text-sm text-muted-foreground">
                    点击"添加角色"开始创建人物设定
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {characters.map((character) => {
                  const roleConfig = roleLabels[character.role as keyof typeof roleLabels];
                  const RoleIcon = roleConfig?.icon || User;
                  const isExpanded = expandedCards.has(character.id);
                  
                  return (
                    <Card key={character.id} className="group hover:shadow-lg transition-all duration-200" data-testid={`character-card-${character.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className={`p-2 rounded-lg ${roleConfig?.color} bg-opacity-10`}>
                              <RoleIcon className={`h-5 w-5 ${roleConfig?.color.replace('bg-', 'text-')}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-lg mb-1 flex items-center gap-2">
                                {character.name}
                                <Badge variant={roleConfig?.variant || "outline"} className="text-xs">
                                  {roleConfig?.label}
                                </Badge>
                              </CardTitle>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {character.gender && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {character.gender}
                                  </span>
                                )}
                                {character.age && (
                                  <span className="flex items-center gap-1">
                                    <History className="h-3 w-3" />
                                    {character.age}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(character)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteCharacterMutation.mutate(character.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {character.personality && (
                          <div className="flex gap-2">
                            <Brain className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-muted-foreground mb-1">性格特点</p>
                              <p className="text-sm line-clamp-2">{character.personality}</p>
                            </div>
                          </div>
                        )}

                        {character.abilities && (
                          <div className="flex gap-2">
                            <Zap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-muted-foreground mb-1">能力/金手指</p>
                              <p className="text-sm line-clamp-2">{character.abilities}</p>
                            </div>
                          </div>
                        )}

                        {(character.appearance || character.background || character.notes) && (
                          <>
                            <Separator />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full justify-between h-8 text-xs"
                              onClick={() => toggleCardExpansion(character.id)}
                            >
                              <span>{isExpanded ? "收起详情" : "查看更多"}</span>
                              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </Button>

                            {isExpanded && (
                              <div className="space-y-3 pt-2">
                                {character.appearance && (
                                  <div className="flex gap-2">
                                    <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">外貌特征</p>
                                      <p className="text-sm">{character.appearance}</p>
                                    </div>
                                  </div>
                                )}
                                {character.background && (
                                  <div className="flex gap-2">
                                    <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">背景故事</p>
                                      <p className="text-sm">{character.background}</p>
                                    </div>
                                  </div>
                                )}
                                {character.notes && (
                                  <div className="flex gap-2">
                                    <Target className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">备注</p>
                                      <p className="text-sm text-muted-foreground">{character.notes}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {Object.entries(roleLabels).map(([roleKey, { label }]) => (
            <TabsContent key={roleKey} value={roleKey} className="mt-0">
              {groupedCharacters[roleKey as keyof typeof groupedCharacters].length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">暂无{label}角色</h3>
                    <p className="text-sm text-muted-foreground">
                      点击"添加角色"开始创建{label}设定
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {groupedCharacters[roleKey as keyof typeof groupedCharacters].map((character) => {
                    const roleConfig = roleLabels[character.role as keyof typeof roleLabels];
                    const RoleIcon = roleConfig?.icon || User;
                    const isExpanded = expandedCards.has(character.id);
                    
                    return (
                      <Card key={character.id} className="group hover:shadow-lg transition-all duration-200" data-testid={`character-card-${character.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${roleConfig?.color} bg-opacity-10`}>
                                <RoleIcon className={`h-5 w-5 ${roleConfig?.color.replace('bg-', 'text-')}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-lg mb-1 flex items-center gap-2">
                                  {character.name}
                                  <Badge variant={roleConfig?.variant || "outline"} className="text-xs">
                                    {roleConfig?.label}
                                  </Badge>
                                </CardTitle>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {character.gender && (
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      {character.gender}
                                    </span>
                                  )}
                                  {character.age && (
                                    <span className="flex items-center gap-1">
                                      <History className="h-3 w-3" />
                                      {character.age}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(character)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteCharacterMutation.mutate(character.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {character.personality && (
                            <div className="flex gap-2">
                              <Brain className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground mb-1">性格特点</p>
                                <p className="text-sm line-clamp-2">{character.personality}</p>
                              </div>
                            </div>
                          )}

                          {character.abilities && (
                            <div className="flex gap-2">
                              <Zap className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground mb-1">能力/金手指</p>
                                <p className="text-sm line-clamp-2">{character.abilities}</p>
                              </div>
                            </div>
                          )}

                          {(character.appearance || character.background || character.notes) && (
                            <>
                              <Separator />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-between h-8 text-xs"
                                onClick={() => toggleCardExpansion(character.id)}
                              >
                                <span>{isExpanded ? "收起详情" : "查看更多"}</span>
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </Button>

                              {isExpanded && (
                                <div className="space-y-3 pt-2">
                                  {character.appearance && (
                                    <div className="flex gap-2">
                                      <User className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">外貌特征</p>
                                        <p className="text-sm">{character.appearance}</p>
                                      </div>
                                    </div>
                                  )}
                                  {character.background && (
                                    <div className="flex gap-2">
                                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">背景故事</p>
                                        <p className="text-sm">{character.background}</p>
                                      </div>
                                    </div>
                                  )}
                                  {character.notes && (
                                    <div className="flex gap-2">
                                      <Target className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">备注</p>
                                        <p className="text-sm text-muted-foreground">{character.notes}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以管理角色
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
