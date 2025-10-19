import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileText, ChevronRight, ChevronDown, Trash2, Edit } from "lucide-react";
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
import { apiRequest } from "@/lib/queryClient";
import type { Project, Outline } from "@shared/schema";

const outlineTypes = {
  main: { label: "总纲", color: "primary" },
  volume: { label: "卷纲", color: "secondary" },
  chapter: { label: "章纲", color: "outline" },
};

export default function Outlines() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: outlines } = useQuery<Outline[]>({
    queryKey: ["/api/outlines", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const createOutlineMutation = useMutation({
    mutationFn: async (data: { type: string; title: string; parentId?: string }) => {
      return await apiRequest("POST", "/api/outlines", {
        projectId: selectedProjectId,
        ...data,
        content: "",
        orderIndex: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlines", selectedProjectId] });
    },
  });

  const deleteOutlineMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/outlines/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlines", selectedProjectId] });
    },
  });

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const renderOutlineNode = (outline: Outline, level: number = 0) => {
    const children = outlines?.filter((o) => o.parentId === outline.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(outline.id);

    return (
      <div key={outline.id} className="space-y-1">
        <div
          className={`flex items-center gap-2 p-3 rounded-md hover-elevate cursor-pointer ${
            level > 0 ? "ml-6" : ""
          }`}
          style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
          data-testid={`outline-node-${outline.id}`}
        >
          {hasChildren ? (
            <button onClick={() => toggleNode(outline.id)} className="shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-4" />
          )}

          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm line-clamp-1">
                {outline.title}
              </span>
              <Badge
                variant={outlineTypes[outline.type as keyof typeof outlineTypes]?.color as any}
                className="text-xs shrink-0"
              >
                {outlineTypes[outline.type as keyof typeof outlineTypes]?.label}
              </Badge>
            </div>
            {outline.content && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                {outline.content}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                deleteOutlineMutation.mutate(outline.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {isExpanded && children.map((child) => renderOutlineNode(child, level + 1))}
      </div>
    );
  };

  const rootOutlines = outlines?.filter((o) => !o.parentId) || [];

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">大纲管理</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理小说的总纲、卷纲和章纲
          </p>
        </div>
        <Button
          onClick={() =>
            createOutlineMutation.mutate({
              type: "main",
              title: "新建大纲",
            })
          }
          disabled={!selectedProjectId}
          data-testid="button-create-outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          新建大纲
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-64">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger data-testid="select-project-outlines">
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
      </div>

      {selectedProjectId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">大纲结构</CardTitle>
          </CardHeader>
          <CardContent>
            {rootOutlines.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">暂无大纲</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  创建第一个大纲，开始规划您的故事结构
                </p>
                <Button
                  onClick={() =>
                    createOutlineMutation.mutate({
                      type: "main",
                      title: "总纲",
                    })
                  }
                  data-testid="button-create-first-outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  创建总纲
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {rootOutlines.map((outline) => renderOutlineNode(outline, 0))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以查看和管理大纲
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
