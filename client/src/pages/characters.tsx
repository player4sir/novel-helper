import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { insertCharacterSchema, type Project, type Character } from "@shared/schema";
import { z } from "zod";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SimplifiedCharacterCard } from "@/components/characters/SimplifiedCharacterCard";
import { CharacterDetailPanel } from "@/components/characters/CharacterDetailPanel";
import { GenerateCharactersDialog } from "@/components/characters/generate-characters-dialog";

const roleLabels = {
  protagonist: { label: "主角", variant: "default" as const },
  supporting: { label: "配角", variant: "secondary" as const },
  antagonist: { label: "反派", variant: "destructive" as const },
  group: { label: "群像", variant: "outline" as const },
};

const formSchema = insertCharacterSchema.extend({
  name: z.string().min(1, "请输入角色名称"),
  role: z.string().min(1, "请选择角色定位"),
  shortMotivation: z.string().optional(),
  growth: z.string().optional(),
  currentEmotion: z.string().optional(),
  currentGoal: z.string().optional(),
});

export default function Characters() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [arcPointDialogOpen, setArcPointDialogOpen] = useState(false);
  const [arcPointCharacterId, setArcPointCharacterId] = useState<string>("");
  const [newArcPoint, setNewArcPoint] = useState("");

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
      shortMotivation: "",
      growth: "",
      currentEmotion: "",
      currentGoal: "",
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
      shortMotivation: character.shortMotivation ?? "",
      growth: character.growth ?? "",
      currentEmotion: character.currentEmotion ?? "",
      currentGoal: character.currentGoal ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCharacter(null);
    form.reset();
  };

  const handleCardClick = (characterId: string) => {
    const character = characters?.find(c => c.id === characterId);
    if (character) {
      setSelectedCharacter(character);
      setDetailPanelOpen(true);
    }
  };

  const handlePanelClose = () => {
    setDetailPanelOpen(false);
    setSelectedCharacter(null);
  };

  const handlePanelDelete = (characterId: string) => {
    deleteCharacterMutation.mutate(characterId);
    handlePanelClose();
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

  const addArcPointMutation = useMutation({
    mutationFn: async ({ characterId, arcPoint }: { characterId: string; arcPoint: string }) => {
      return await apiRequest("POST", `/api/characters/${characterId}/arc-points`, { arcPoint });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", selectedProjectId] });
      setArcPointDialogOpen(false);
      setNewArcPoint("");
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createCharacterMutation.mutate(values);
  };

  const openArcPointDialog = (characterId: string) => {
    setArcPointCharacterId(characterId);
    setArcPointDialogOpen(true);
  };

  const handleAddArcPoint = () => {
    if (newArcPoint.trim() && arcPointCharacterId) {
      addArcPointMutation.mutate({
        characterId: arcPointCharacterId,
        arcPoint: newArcPoint.trim(),
      });
    }
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
        <div className="flex items-center gap-2">
          <GenerateCharactersDialog projectId={selectedProjectId}>
            <Button variant="outline" disabled={!selectedProjectId}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI生成
            </Button>
          </GenerateCharactersDialog>
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

                    <Separator className="my-4" />
                    <div className="space-y-1 mb-4">
                      <h3 className="text-sm font-semibold">角色状态追踪</h3>
                      <p className="text-xs text-muted-foreground">系统会自动追踪角色状态，也可手动设置初始值</p>
                    </div>

                    <FormField
                      control={form.control}
                      name="shortMotivation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>核心动机</FormLabel>
                          <FormControl>
                            <Textarea placeholder="角色的核心动机和驱动力..." rows={2} {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="growth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>成长路径</FormLabel>
                          <FormControl>
                            <Textarea placeholder="角色的成长规划和预期变化..." rows={2} {...field} value={field.value ?? ""} />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="currentEmotion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>当前情感</FormLabel>
                            <FormControl>
                              <Input placeholder="如：坚定、焦虑..." {...field} value={field.value ?? ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="currentGoal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>当前目标</FormLabel>
                            <FormControl>
                              <Input placeholder="角色当前的目标..." {...field} value={field.value ?? ""} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

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
      </div>

      <div className="w-64">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger data-testid="select-project-characters">
            <SelectValue placeholder="选择项目" />
          </SelectTrigger>
          <SelectContent>
            {projects?.map((project: Project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProjectId ? (
        <>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {characters.map((character: Character) => (
                    <SimplifiedCharacterCard
                      key={character.id}
                      character={character}
                      onCardClick={handleCardClick}
                      onEdit={openEditDialog}
                      onDelete={(id) => deleteCharacterMutation.mutate(id)}
                    />
                  ))}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedCharacters[roleKey as keyof typeof groupedCharacters].map((character: Character) => (
                      <SimplifiedCharacterCard
                        key={character.id}
                        character={character}
                        onCardClick={handleCardClick}
                        onEdit={openEditDialog}
                        onDelete={(id) => deleteCharacterMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Character Detail Panel */}
          <CharacterDetailPanel
            character={selectedCharacter}
            isOpen={detailPanelOpen}
            onClose={handlePanelClose}
            onEdit={openEditDialog}
            onDelete={handlePanelDelete}
            onAddArcPoint={openArcPointDialog}
          />
        </>
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

      {/* Arc Point Dialog */}
      <Dialog open={arcPointDialogOpen} onOpenChange={setArcPointDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加角色成长轨迹点</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                记录角色的重要成长时刻，如突破、决心、转变等
              </p>
              <Textarea
                placeholder="例如：突破：领悟了剑意的真谛"
                value={newArcPoint}
                onChange={(e) => setNewArcPoint(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setArcPointDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleAddArcPoint}
                disabled={!newArcPoint.trim() || addArcPointMutation.isPending}
              >
                {addArcPointMutation.isPending ? "添加中..." : "添加"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
