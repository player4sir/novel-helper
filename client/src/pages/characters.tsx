import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Trash2, User } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { insertCharacterSchema, type Project, type Character } from "@shared/schema";
import { z } from "zod";

const roleLabels = {
  protagonist: { label: "主角", variant: "default" },
  supporting: { label: "配角", variant: "secondary" },
  antagonist: { label: "反派", variant: "destructive" },
  group: { label: "群像", variant: "outline" },
};

const formSchema = insertCharacterSchema.extend({
  name: z.string().min(1, "请输入角色名称"),
  role: z.string().min(1, "请选择角色定位"),
});

export default function Characters() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const createCharacterMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      return await apiRequest("POST", "/api/characters", {
        projectId: selectedProjectId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters", selectedProjectId] });
      form.reset();
      setDialogOpen(false);
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!selectedProjectId} data-testid="button-add-character">
              <Plus className="h-4 w-4 mr-2" />
              添加角色
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加角色</DialogTitle>
            </DialogHeader>
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
                          <Input placeholder="男/女" {...field} />
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
                          <Input placeholder="25岁" {...field} />
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
                        <Textarea placeholder="描述角色的外貌特征..." rows={2} {...field} />
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
                        <Textarea placeholder="描述角色的性格..." rows={2} {...field} />
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
                        <Textarea placeholder="角色的背景和经历..." rows={3} {...field} />
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
                        <Textarea placeholder="角色的特殊能力..." rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createCharacterMutation.isPending}>
                    {createCharacterMutation.isPending ? "添加中..." : "添加角色"}
                  </Button>
                </div>
              </form>
            </Form>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Object.entries(roleLabels).map(([roleKey, { label, variant }]) => (
            <Card key={roleKey}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {label} ({groupedCharacters[roleKey as keyof typeof groupedCharacters].length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groupedCharacters[roleKey as keyof typeof groupedCharacters].length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    暂无{label}角色
                  </div>
                ) : (
                  <div className="space-y-3">
                    {groupedCharacters[roleKey as keyof typeof groupedCharacters].map((character) => (
                      <div
                        key={character.id}
                        className="p-3 rounded-md border border-border hover-elevate group"
                        data-testid={`character-card-${character.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{character.name}</span>
                              {character.gender && (
                                <Badge variant="secondary" className="text-xs">
                                  {character.gender}
                                </Badge>
                              )}
                              {character.age && (
                                <Badge variant="outline" className="text-xs">
                                  {character.age}
                                </Badge>
                              )}
                            </div>
                            {character.personality && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                {character.personality}
                              </p>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100"
                            onClick={() => deleteCharacterMutation.mutate(character.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
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
