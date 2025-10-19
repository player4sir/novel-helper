import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Wand2,
  MessageSquare,
  Zap,
  Settings,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import type { AIModel, PromptTemplate } from "@shared/schema";

interface AIAssistantPanelProps {
  projectId: string;
  chapterId: string | null;
}

export function AIAssistantPanel({
  projectId,
  chapterId,
}: AIAssistantPanelProps) {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [temperature, setTemperature] = useState([0.7]);
  const [maxTokens, setMaxTokens] = useState([2000]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");

  const { data: aiModels } = useQuery<AIModel[]>({
    queryKey: ["/api/ai-models"],
  });

  const { data: templates } = useQuery<PromptTemplate[]>({
    queryKey: ["/api/prompt-templates", projectId],
  });

  const generateMutation = useMutation({
    mutationFn: async (data: {
      prompt: string;
      modelId: string;
      parameters: { temperature: number; maxTokens: number };
    }) => {
      return await apiRequest("POST", "/api/ai/generate", data);
    },
    onSuccess: (data) => {
      setGeneratedContent(data.content);
    },
  });

  const continueTemplates = templates?.filter((t) => t.category === "continue") || [];
  const rewriteTemplates = templates?.filter((t) => t.category === "rewrite") || [];

  const activeModels = aiModels?.filter((m) => m.isActive) || [];
  const defaultModel = activeModels.find((m) => m.isDefault) || activeModels[0];

  if (!selectedModel && defaultModel) {
    setSelectedModel(defaultModel.id);
  }

  const handleQuickAction = async (action: string, templateId?: string) => {
    if (!chapterId) {
      return;
    }

    let prompt = "";
    
    switch (action) {
      case "continue":
        prompt = "根据上文内容，继续写作，保持风格一致，推进剧情发展。";
        break;
      case "dialogue":
        prompt = "生成符合人物性格的精彩对话，增强情节张力。";
        break;
      case "scene":
        prompt = "丰富场景描写，营造氛围，增强画面感。";
        break;
      case "hook":
        prompt = "在章节末尾设计一个吸引人的钩子，让读者想继续阅读。";
        break;
    }

    if (templateId) {
      const template = templates?.find((t) => t.id === templateId);
      if (template) {
        prompt = template.template;
      }
    }

    generateMutation.mutate({
      prompt: customPrompt || prompt,
      modelId: selectedModel,
      parameters: {
        temperature: temperature[0],
        maxTokens: maxTokens[0],
      },
    });
  };

  return (
    <div className="w-80 border-l border-border flex flex-col bg-card">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-sm">AI 创作助手</h3>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">AI 模型</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="mt-1.5" data-testid="select-ai-model">
                <SelectValue placeholder="选择模型" />
              </SelectTrigger>
              <SelectContent>
                {activeModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{model.name}</span>
                      {model.isDefault && (
                        <Badge variant="secondary" className="text-xs">
                          默认
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="quick" className="p-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">快捷操作</TabsTrigger>
            <TabsTrigger value="custom">自定义</TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="space-y-3 mt-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">常用功能</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleQuickAction("continue")}
                  disabled={!chapterId || generateMutation.isPending}
                  data-testid="button-ai-continue"
                >
                  <Wand2 className="h-3 w-3 mr-2" />
                  智能续写
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleQuickAction("dialogue")}
                  disabled={!chapterId || generateMutation.isPending}
                  data-testid="button-ai-dialogue"
                >
                  <MessageSquare className="h-3 w-3 mr-2" />
                  对话生成
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleQuickAction("scene")}
                  disabled={!chapterId || generateMutation.isPending}
                  data-testid="button-ai-scene"
                >
                  <Sparkles className="h-3 w-3 mr-2" />
                  场景描写
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => handleQuickAction("hook")}
                  disabled={!chapterId || generateMutation.isPending}
                  data-testid="button-ai-hook"
                >
                  <Zap className="h-3 w-3 mr-2" />
                  钩子生成
                </Button>
              </div>
            </div>

            {continueTemplates.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">续写模板</Label>
                  <div className="space-y-1">
                    {continueTemplates.slice(0, 3).map((template) => (
                      <Button
                        key={template.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => handleQuickAction("template", template.id)}
                        disabled={!chapterId || generateMutation.isPending}
                      >
                        {template.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {generatedContent && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">生成结果</Label>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => setGeneratedContent("")}
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-3 bg-muted rounded-md text-sm leading-relaxed max-h-60 overflow-y-auto">
                    {generatedContent}
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label className="text-xs">自定义提示词</Label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="输入您的创作需求..."
                rows={4}
                className="resize-none text-sm"
                data-testid="textarea-custom-prompt"
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">创意度</Label>
                  <span className="text-xs text-muted-foreground">
                    {temperature[0].toFixed(1)}
                  </span>
                </div>
                <Slider
                  value={temperature}
                  onValueChange={setTemperature}
                  min={0}
                  max={2}
                  step={0.1}
                  data-testid="slider-temperature"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">最大长度</Label>
                  <span className="text-xs text-muted-foreground">
                    {maxTokens[0]}
                  </span>
                </div>
                <Slider
                  value={maxTokens}
                  onValueChange={setMaxTokens}
                  min={500}
                  max={4000}
                  step={100}
                  data-testid="slider-max-tokens"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => handleQuickAction("custom")}
              disabled={!chapterId || !customPrompt || generateMutation.isPending}
              data-testid="button-generate-custom"
            >
              {generateMutation.isPending ? (
                <>生成中...</>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  生成内容
                </>
              )}
            </Button>

            {generatedContent && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">生成结果</Label>
                <div className="p-3 bg-muted rounded-md text-sm leading-relaxed max-h-60 overflow-y-auto">
                  {generatedContent}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
