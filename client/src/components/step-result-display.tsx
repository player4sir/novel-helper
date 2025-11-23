import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Edit, Check, X, ChevronDown, ChevronUp, Save, Globe, Map, Zap } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface StepResultDisplayProps {
  step: string;
  data: any;
  onEdit?: (editedData: any) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function StepResultDisplay({
  step,
  data,
  onEdit,
  onRegenerate,
  isRegenerating = false,
}: StepResultDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(data);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const handleSave = () => {
    onEdit?.(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData(data);
    setIsEditing(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-border/40">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight text-foreground/90">{getStepTitle(step)}</h3>
          <p className="text-sm text-muted-foreground">
            {getStepDescription(step)}
          </p>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              disabled={isRegenerating}
              className="h-9 px-4 hover:bg-primary/5 hover:text-primary transition-colors"
            >
              <Edit className="mr-2 h-3.5 w-3.5" />
              编辑内容
            </Button>
          )}
          {isEditing && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="h-9 px-4 text-muted-foreground hover:text-foreground">
                <X className="mr-2 h-3.5 w-3.5" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave} className="h-9 px-4 bg-primary hover:bg-primary/90 shadow-sm">
                <Save className="mr-2 h-3.5 w-3.5" />
                保存修改
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {step === "basic" && (
          <BasicInfoDisplay data={editedData} isEditing={isEditing} onChange={setEditedData} />
        )}
        {step === "characters" && (
          <CharactersDisplay
            data={editedData}
            isEditing={isEditing}
            onChange={setEditedData}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />
        )}
        {step === "world" && (
          <WorldDisplay
            data={editedData}
            isEditing={isEditing}
            onChange={setEditedData}
          />
        )}
        {step === "finalize" && (
          <div className="text-center py-8">
            <p className="text-lg font-medium">准备完成创建</p>
            <p className="text-sm text-muted-foreground mt-2">
              点击"完成创建"按钮将保存所有设定并创建项目
            </p>
          </div>
        )}
        {step === "outline" && (
          <OutlineDisplay
            data={editedData}
            isEditing={isEditing}
            onChange={setEditedData}
          />
        )}
      </div>
    </div>
  );
}

// Helper functions
function getStepTitle(step: string): string {
  const titles: Record<string, string> = {
    basic: "基础信息",
    characters: "角色设定",
    world: "世界观",
    outline: "故事大纲",
    finalize: "完成创建",
  };
  return titles[step] || step;
}

function getStepDescription(step: string): string {
  const descriptions: Record<string, string> = {
    basic: "项目核心概念与基调",
    characters: "主要角色及其关系网络",
    world: "世界规则与背景设定",
    outline: "故事结构与关键节点",
    finalize: "确认所有信息并生成项目",
  };
  return descriptions[step] || "";
}

function BasicInfoDisplay({ data, isEditing, onChange }: any) {
  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <label className="text-sm font-medium text-muted-foreground">标题</label>
        {isEditing ? (
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={data.title}
            onChange={(e) => onChange({ ...data, title: e.target.value })}
          />
        ) : (
          <div className="text-lg font-semibold">{data.title}</div>
        )}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-muted-foreground">简介</label>
        {isEditing ? (
          <Textarea
            value={data.premise}
            onChange={(e) => onChange({ ...data, premise: e.target.value })}
            rows={4}
          />
        ) : (
          <div className="text-base leading-relaxed">{data.premise}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted-foreground">类型</label>
          {isEditing ? (
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={data.genre}
              onChange={(e) => onChange({ ...data, genre: e.target.value })}
            />
          ) : (
            <div className="text-base">{data.genre}</div>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium text-muted-foreground">风格</label>
          {isEditing ? (
            <input
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={data.style}
              onChange={(e) => onChange({ ...data, style: e.target.value })}
            />
          ) : (
            <div className="text-base">{data.style}</div>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-muted-foreground">核心冲突 (逗号分隔)</label>
        {isEditing ? (
          <Textarea
            value={Array.isArray(data.coreConflicts) ? data.coreConflicts.join("，") : data.coreConflicts}
            onChange={(e) => onChange({ ...data, coreConflicts: e.target.value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) })}
            rows={2}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.coreConflicts?.map((conflict: string, i: number) => (
              <Badge key={i} variant="secondary" className="px-3 py-1 text-sm bg-secondary/50">
                {conflict}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-muted-foreground">主题标签 (逗号分隔)</label>
        {isEditing ? (
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={Array.isArray(data.themeTags) ? data.themeTags.join("，") : data.themeTags}
            onChange={(e) => onChange({ ...data, themeTags: e.target.value.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean) })}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.themeTags?.map((tag: string, i: number) => (
              <Badge key={i} variant="outline" className="text-sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CharactersDisplay({ data, isEditing, onChange, expandedSections, toggleSection }: any) {
  const characters = data.characters || [];

  const updateCharacter = (index: number, field: string, value: string) => {
    const newCharacters = [...characters];
    newCharacters[index] = { ...newCharacters[index], [field]: value };
    onChange({ ...data, characters: newCharacters });
  };

  return (
    <div className="space-y-4">
      {characters.map((char: any, index: number) => (
        <div key={index} className="border rounded-lg bg-card/50 overflow-hidden transition-all hover:shadow-sm">
          <div
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
            onClick={() => toggleSection(`char-${index}`)}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-2 h-8 rounded-full",
                char.role === "主角" ? "bg-primary" : char.role === "反派" ? "bg-destructive" : "bg-muted"
              )} />
              <div>
                <div className="font-semibold text-base">{char.name}</div>
                <div className="text-xs text-muted-foreground">{char.role} · {char.shortMotivation}</div>
              </div>
            </div>
            {expandedSections[`char-${index}`] ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <Collapsible open={expandedSections[`char-${index}`]}>
            <CollapsibleContent className="p-4 pt-0 space-y-4 border-t bg-muted/10">
              {isEditing ? (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">姓名</label>
                      <input
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={char.name}
                        onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">角色定位</label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        value={char.role}
                        onChange={(e) => updateCharacter(index, 'role', e.target.value)}
                      >
                        <option value="主角">主角</option>
                        <option value="配角">配角</option>
                        <option value="反派">反派</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">核心动机</label>
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={char.shortMotivation || char.motivation}
                      onChange={(e) => updateCharacter(index, 'shortMotivation', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">性格</label>
                      <Textarea
                        className="min-h-[80px]"
                        value={char.personality}
                        onChange={(e) => updateCharacter(index, 'personality', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">外貌</label>
                      <Textarea
                        className="min-h-[80px]"
                        value={char.appearance}
                        onChange={(e) => updateCharacter(index, 'appearance', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">背景</label>
                    <Textarea
                      value={char.background}
                      onChange={(e) => updateCharacter(index, 'background', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">能力</label>
                    <Textarea
                      value={char.abilities}
                      onChange={(e) => updateCharacter(index, 'abilities', e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">性格</label>
                      <p className="text-sm">{char.personality}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">外貌</label>
                      <p className="text-sm">{char.appearance}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">背景</label>
                    <p className="text-sm leading-relaxed">{char.background}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">能力</label>
                    <p className="text-sm">{char.abilities}</p>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      ))}
    </div>
  );
}

function WorldDisplay({ data, isEditing, onChange }: any) {
  const world = data.worldSetting || {};

  const updateWorld = (field: string, value: any) => {
    onChange({ ...data, worldSetting: { ...world, [field]: value } });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2 text-primary">
          <Globe className="h-4 w-4" /> 核心规则
        </h4>
        <div className="grid gap-3">
          {world.rules?.map((rule: any, i: number) => (
            <div key={i} className="p-3 rounded-md bg-muted/30 border text-sm">
              {isEditing ? (
                <Textarea
                  value={typeof rule === 'string' ? rule : rule.content}
                  onChange={(e) => {
                    const newRules = [...(world.rules || [])];
                    if (typeof rule === 'string') {
                      newRules[i] = e.target.value;
                    } else {
                      newRules[i] = { ...rule, content: e.target.value };
                    }
                    updateWorld('rules', newRules);
                  }}
                  className="min-h-[60px]"
                />
              ) : (
                typeof rule === 'string' ? rule : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{rule.content}</span>
                    </div>
                    {(rule.category || rule.priority) && (
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {rule.category && <span className="px-1.5 py-0.5 rounded bg-background/50 border">{rule.category}</span>}
                        {rule.priority && <span className="px-1.5 py-0.5 rounded bg-background/50 border">优先级: {rule.priority}</span>}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2 text-primary">
          <Map className="h-4 w-4" /> 地理环境
        </h4>
        <div className="grid gap-3">
          {world.locations?.map((loc: any, i: number) => (
            <div key={i} className="p-3 rounded-md border bg-card/50">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-medium"
                    value={loc.name}
                    onChange={(e) => {
                      const newLocs = [...(world.locations || [])];
                      newLocs[i] = { ...loc, name: e.target.value };
                      updateWorld('locations', newLocs);
                    }}
                  />
                  <Textarea
                    value={loc.description}
                    onChange={(e) => {
                      const newLocs = [...(world.locations || [])];
                      newLocs[i] = { ...loc, description: e.target.value };
                      updateWorld('locations', newLocs);
                    }}
                    className="min-h-[60px]"
                  />
                </div>
              ) : (
                <>
                  <div className="font-medium mb-1">{loc.name}</div>
                  <div className="text-sm text-muted-foreground">{loc.description}</div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2 text-primary">
          <Zap className="h-4 w-4" /> 力量体系
        </h4>
        {isEditing ? (
          <Textarea
            value={typeof world.powerSystem === 'string' ? world.powerSystem : (world.powerSystem?.description || JSON.stringify(world.powerSystem, null, 2))}
            onChange={(e) => updateWorld('powerSystem', e.target.value)}
            className="min-h-[100px]"
          />
        ) : (
          <div className="p-4 rounded-md border bg-muted/10 text-sm leading-relaxed">
            {typeof world.powerSystem === 'string' ? world.powerSystem : (
              <div className="space-y-2">
                <div className="font-medium">{world.powerSystem?.name}</div>
                <div>{world.powerSystem?.description}</div>
                {world.powerSystem?.levels && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <strong>等级：</strong> {Array.isArray(world.powerSystem.levels) ? world.powerSystem.levels.join(' > ') : world.powerSystem.levels}
                  </div>
                )}
                {world.powerSystem?.cultivation && (
                  <div className="text-xs text-muted-foreground">
                    <strong>修炼方式：</strong> {world.powerSystem.cultivation}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OutlineDisplay({ data, isEditing, onChange }: any) {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h4 className="text-lg font-semibold tracking-tight">总体大纲</h4>
        {isEditing ? (
          <Textarea
            value={data.overallOutline}
            onChange={(e) => onChange({ ...data, overallOutline: e.target.value })}
            className="min-h-[150px]"
          />
        ) : (
          <div className="p-4 rounded-lg border bg-muted/10 text-base leading-relaxed whitespace-pre-wrap">
            {data.overallOutline}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-lg font-semibold tracking-tight">关键节点</h4>
        <div className="relative border-l-2 border-primary/20 ml-3 space-y-8 py-2">
          <div className="relative pl-8">
            <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
            <h5 className="font-medium text-primary mb-1">开篇</h5>
            {isEditing ? (
              <Textarea
                value={data.opening}
                onChange={(e) => onChange({ ...data, opening: e.target.value })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{data.opening}</p>
            )}
          </div>

          {data.plotPoints?.map((point: any, i: number) => (
            <div key={i} className="relative pl-8">
              <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-muted-foreground/30 bg-background" />
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm font-medium"
                    value={point.title || `节点 ${i + 1}`}
                    onChange={(e) => {
                      const newPoints = [...(data.plotPoints || [])];
                      newPoints[i] = { ...point, title: e.target.value };
                      onChange({ ...data, plotPoints: newPoints });
                    }}
                  />
                  <Textarea
                    value={point.description}
                    onChange={(e) => {
                      const newPoints = [...(data.plotPoints || [])];
                      newPoints[i] = { ...point, description: e.target.value };
                      onChange({ ...data, plotPoints: newPoints });
                    }}
                  />
                </div>
              ) : (
                <>
                  <h5 className="font-medium mb-1">{point.title || `节点 ${i + 1}`}</h5>
                  <p className="text-sm text-muted-foreground">{point.description}</p>
                </>
              )}
            </div>
          ))}

          <div className="relative pl-8">
            <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
            <h5 className="font-medium text-primary mb-1">高潮</h5>
            {isEditing ? (
              <Textarea
                value={data.climax}
                onChange={(e) => onChange({ ...data, climax: e.target.value })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{data.climax}</p>
            )}
          </div>

          <div className="relative pl-8">
            <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-primary bg-background" />
            <h5 className="font-medium text-primary mb-1">结局</h5>
            {isEditing ? (
              <Textarea
                value={data.ending}
                onChange={(e) => onChange({ ...data, ending: e.target.value })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{data.ending}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
