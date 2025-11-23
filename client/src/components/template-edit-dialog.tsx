import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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

interface TemplateEditDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<Template>) => void;
}

const GENRES = [
  "玄幻",
  "仙侠",
  "都市",
  "现实",
  "科幻",
  "历史",
  "军事",
  "游戏",
  "悬疑",
  "武侠",
  "其他",
];

const STYLES = [
  "轻松",
  "严肃",
  "幽默",
  "黑暗",
  "热血",
  "治愈",
  "悬疑",
  "浪漫",
];

export function TemplateEditDialog({
  template,
  open,
  onOpenChange,
  onSave,
}: TemplateEditDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    genre: "玄幻",
    style: "",
    characterStructure: "{}",
    worldFramework: "{}",
    conflictPatterns: "[]",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || "",
        genre: template.genre,
        style: template.style || "",
        characterStructure: JSON.stringify(template.characterStructure, null, 2),
        worldFramework: JSON.stringify(template.worldFramework, null, 2),
        conflictPatterns: JSON.stringify(template.conflictPatterns, null, 2),
      });
    } else {
      setFormData({
        name: "",
        description: "",
        genre: "玄幻",
        style: "",
        characterStructure: "{}",
        worldFramework: "{}",
        conflictPatterns: "[]",
      });
    }
    setErrors({});
  }, [template, open]);

  const validateJSON = (field: string, value: string): boolean => {
    try {
      JSON.parse(value);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
      return true;
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        [field]: "无效的JSON格式",
      }));
      return false;
    }
  };

  const handleSave = () => {
    // Validate all JSON fields
    const characterValid = validateJSON("characterStructure", formData.characterStructure);
    const worldValid = validateJSON("worldFramework", formData.worldFramework);
    const conflictsValid = validateJSON("conflictPatterns", formData.conflictPatterns);

    if (!formData.name.trim()) {
      setErrors((prev) => ({ ...prev, name: "模板名称不能为空" }));
      return;
    }

    if (!characterValid || !worldValid || !conflictsValid) {
      return;
    }

    const data: Partial<Template> = {
      name: formData.name,
      description: formData.description || null,
      genre: formData.genre,
      style: formData.style || null,
      characterStructure: JSON.parse(formData.characterStructure),
      worldFramework: JSON.parse(formData.worldFramework),
      conflictPatterns: JSON.parse(formData.conflictPatterns),
    };

    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {template ? "编辑模板" : "创建新模板"}
          </DialogTitle>
          <DialogDescription>
            {template
              ? "修改模板配置信息"
              : "创建一个新的项目创建模板"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">模板名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="输入模板名称"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="输入模板描述"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="genre">类型 *</Label>
                <Select
                  value={formData.genre}
                  onValueChange={(value) =>
                    setFormData({ ...formData, genre: value })
                  }
                >
                  <SelectTrigger id="genre">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GENRES.map((genre) => (
                      <SelectItem key={genre} value={genre}>
                        {genre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">风格</Label>
                <Select
                  value={formData.style}
                  onValueChange={(value) =>
                    setFormData({ ...formData, style: value })
                  }
                >
                  <SelectTrigger id="style">
                    <SelectValue placeholder="选择风格" />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {style}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Tabs defaultValue="characters" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="characters">角色结构</TabsTrigger>
                <TabsTrigger value="world">世界观</TabsTrigger>
                <TabsTrigger value="conflicts">冲突模式</TabsTrigger>
              </TabsList>

              <TabsContent value="characters" className="space-y-2">
                <Label htmlFor="characterStructure">
                  角色结构配置 (JSON格式)
                </Label>
                <Textarea
                  id="characterStructure"
                  value={formData.characterStructure}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      characterStructure: e.target.value,
                    });
                    validateJSON("characterStructure", e.target.value);
                  }}
                  placeholder='{"mainCharacterCount": 1, "supportingCharacterCount": 3}'
                  rows={10}
                  className="font-mono text-sm"
                />
                {errors.characterStructure && (
                  <p className="text-sm text-destructive">
                    {errors.characterStructure}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="world" className="space-y-2">
                <Label htmlFor="worldFramework">
                  世界观框架 (JSON格式)
                </Label>
                <Textarea
                  id="worldFramework"
                  value={formData.worldFramework}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      worldFramework: e.target.value,
                    });
                    validateJSON("worldFramework", e.target.value);
                  }}
                  placeholder='{"powerSystem": "修真", "worldType": "东方玄幻"}'
                  rows={10}
                  className="font-mono text-sm"
                />
                {errors.worldFramework && (
                  <p className="text-sm text-destructive">
                    {errors.worldFramework}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="conflicts" className="space-y-2">
                <Label htmlFor="conflictPatterns">
                  冲突模式 (JSON数组格式)
                </Label>
                <Textarea
                  id="conflictPatterns"
                  value={formData.conflictPatterns}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      conflictPatterns: e.target.value,
                    });
                    validateJSON("conflictPatterns", e.target.value);
                  }}
                  placeholder='["主角与反派的对抗", "内心的道德挣扎", "家族势力的冲突"]'
                  rows={10}
                  className="font-mono text-sm"
                />
                {errors.conflictPatterns && (
                  <p className="text-sm text-destructive">
                    {errors.conflictPatterns}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>
            {template ? "保存更改" : "创建模板"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
