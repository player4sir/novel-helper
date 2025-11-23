import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Eye, Edit, Trash2, TrendingUp } from "lucide-react";
import { TemplateDetailsDialog } from "@/components/template-details-dialog";
import { TemplateEditDialog } from "@/components/template-edit-dialog";
import { useToast } from "@/hooks/use-toast";

interface Template {
  id: number;
  name: string;
  description: string | null;
  genre: string;
  style: string | null;
  characterStructure: any;
  worldFramework: any;
  conflictPatterns: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export function TemplateManagement() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/templates");
      if (!response.ok) throw new Error("Failed to load templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      toast({
        title: "加载失败",
        description: "无法加载模板列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (template: Template) => {
    setSelectedTemplate(template);
    setDetailsOpen(true);
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setEditOpen(true);
  };

  const handleDelete = async (templateId: number) => {
    if (!confirm("确定要删除这个模板吗？")) return;

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
      
      toast({
        title: "删除成功",
        description: "模板已删除",
      });
      loadTemplates();
    } catch (error) {
      toast({
        title: "删除失败",
        description: "无法删除模板",
        variant: "destructive",
      });
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setEditOpen(true);
  };

  const handleSaveTemplate = async (templateData: Partial<Template>) => {
    try {
      const url = editingTemplate 
        ? `/api/templates/${editingTemplate.id}`
        : "/api/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) throw new Error("Failed to save template");

      toast({
        title: editingTemplate ? "更新成功" : "创建成功",
        description: editingTemplate ? "模板已更新" : "新模板已创建",
      });
      
      setEditOpen(false);
      loadTemplates();
    } catch (error) {
      toast({
        title: "保存失败",
        description: "无法保存模板",
        variant: "destructive",
      });
    }
  };

  const groupedTemplates = templates.reduce((acc, template) => {
    const genre = template.genre || "其他";
    if (!acc[genre]) acc[genre] = [];
    acc[genre].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  const sortedByUsage = [...templates].sort((a, b) => b.usageCount - a.usageCount);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">模板管理</h1>
          <p className="text-muted-foreground mt-1">
            管理和使用项目创建模板
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="mr-2 h-4 w-4" />
          创建模板
        </Button>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">全部模板</TabsTrigger>
          <TabsTrigger value="popular">热门模板</TabsTrigger>
          {Object.keys(groupedTemplates).map((genre) => (
            <TabsTrigger key={genre} value={genre}>
              {genre}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onView={handleViewDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
          {templates.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              暂无模板，点击"创建模板"开始
            </div>
          )}
        </TabsContent>

        <TabsContent value="popular" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedByUsage.slice(0, 6).map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onView={handleViewDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
                showUsage
              />
            ))}
          </div>
        </TabsContent>

        {Object.entries(groupedTemplates).map(([genre, genreTemplates]) => (
          <TabsContent key={genre} value={genre} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {genreTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onView={handleViewDetails}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {selectedTemplate && (
        <TemplateDetailsDialog
          template={selectedTemplate}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}

      <TemplateEditDialog
        template={editingTemplate}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={handleSaveTemplate}
      />
    </div>
  );
}

interface TemplateCardProps {
  template: Template;
  onView: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (id: number) => void;
  showUsage?: boolean;
}

function TemplateCard({ template, onView, onEdit, onDelete, showUsage }: TemplateCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {template.description || "无描述"}
            </CardDescription>
          </div>
          {showUsage && (
            <Badge variant="secondary" className="ml-2">
              <TrendingUp className="mr-1 h-3 w-3" />
              {template.usageCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Badge>{template.genre}</Badge>
            {template.style && <Badge variant="outline">{template.style}</Badge>}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onView(template)}
            >
              <Eye className="mr-1 h-4 w-4" />
              查看
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(template)}
            >
              <Edit className="mr-1 h-4 w-4" />
              编辑
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(template.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
