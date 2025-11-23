import { useState } from "react";
import { User, Brain, Zap, BookOpen, Heart, Target, Sparkles, History, Users, Clock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Character } from "@shared/schema";

interface CharacterDetailTabsProps {
  character: Character;
  stateHistory: any[];
  isLoadingHistory?: boolean;
  historyError?: Error | null;
}

type TimelineEvent = {
  type: 'appearance' | 'state' | 'arcpoint';
  time: Date | string;
  chapterIndex?: number;
  sceneIndex?: number;
  label?: string;
  emotion?: string;
  goal?: string;
  arcPoint?: string;
  notes?: string;
  index?: number;
};

export function CharacterDetailTabs({ character, stateHistory, isLoadingHistory, historyError }: CharacterDetailTabsProps) {
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  const arcPoints = character.arcPoints as unknown as string[] | null;
  const lastMentioned = character.lastMentioned as any;
  const firstAppearance = character.firstAppearance as any;
  const relationships = character.relationships as any;

  // 合并当前状态和历史记录创建时间线
  const timelineEvents: TimelineEvent[] = [];

  // 添加首次出场
  if (firstAppearance) {
    timelineEvents.push({
      type: 'appearance',
      time: character.createdAt,
      chapterIndex: firstAppearance.chapterIndex,
      sceneIndex: firstAppearance.sceneIndex,
      label: '首次出场',
    });
  }

  // 添加历史状态变化
  if (stateHistory && stateHistory.length > 0) {
    stateHistory.forEach(history => {
      timelineEvents.push({
        type: 'state',
        time: history.createdAt,
        chapterIndex: history.chapterIndex,
        sceneIndex: history.sceneIndex,
        emotion: history.emotion,
        goal: history.goal,
        arcPoint: history.arcPoint,
        notes: history.notes,
      });
    });
  }

  // 添加弧光点到时间线
  if (arcPoints && arcPoints.length > 0) {
    arcPoints.forEach((point: any, index: number) => {
      // Check if point is an object with timestamp
      if (typeof point === 'object' && point.timestamp) {
        timelineEvents.push({
          type: 'arcpoint',
          time: point.timestamp,
          chapterIndex: point.chapterIndex,
          label: point.content,
          index: index + 1,
          arcPoint: point.content
        });
      }
    });
  }

  // 按时间排序
  timelineEvents.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="timeline">时间线</TabsTrigger>
        <TabsTrigger value="relationships">关系</TabsTrigger>
        <TabsTrigger value="stats">统计</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-4 mt-4">
        {character.appearance && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>外貌特征</span>
            </div>
            <p className="text-sm leading-relaxed pl-6">{character.appearance}</p>
          </div>
        )}

        {character.personality && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-primary" />
              <span>性格特点</span>
            </div>
            <p className="text-sm leading-relaxed pl-6">{character.personality}</p>
          </div>
        )}

        {character.background && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span>背景故事</span>
            </div>
            <p className="text-sm leading-relaxed pl-6">{character.background}</p>
          </div>
        )}

        {character.abilities && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>能力/金手指</span>
            </div>
            <p className="text-sm leading-relaxed pl-6">{character.abilities}</p>
          </div>
        )}

        {character.shortMotivation && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>核心动机</span>
            </div>
            <p className="text-sm leading-relaxed pl-6">{character.shortMotivation}</p>
          </div>
        )}

        {character.growth && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-green-500" />
              <span>成长路径</span>
            </div>
            <p className="text-sm leading-relaxed pl-6">{character.growth}</p>
          </div>
        )}

        {character.notes && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span>备注</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6 whitespace-pre-wrap">{character.notes}</p>
          </div>
        )}

        {!character.appearance && !character.personality && !character.background &&
          !character.abilities && !character.notes && !character.shortMotivation && !character.growth && (
            <p className="text-sm text-muted-foreground text-center py-8">暂无详细信息</p>
          )}
      </TabsContent>

      {/* Timeline Tab */}
      <TabsContent value="timeline" className="space-y-4 mt-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <Clock className="h-4 w-4 text-primary" />
          <span>角色成长时间线</span>
        </div>

        {/* Current State */}
        {(character.currentEmotion || character.currentGoal) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-sm font-semibold">当前状态</span>
                {character.stateUpdatedAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(character.stateUpdatedAt).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </div>
              <div className="space-y-2 pl-4">
                {character.currentEmotion && (
                  <div className="flex items-center gap-2 text-sm">
                    <Heart className="h-3.5 w-3.5 text-pink-500" />
                    <span className="text-muted-foreground">情感:</span>
                    <Badge variant="secondary">{character.currentEmotion}</Badge>
                  </div>
                )}
                {character.currentGoal && (
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-3.5 w-3.5 text-blue-500" />
                    <span className="text-muted-foreground">目标:</span>
                    <Badge variant="secondary">{character.currentGoal}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline Events */}
        {isLoadingHistory ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50 animate-pulse" />
            <p className="text-sm text-muted-foreground">加载历史记录中...</p>
          </div>
        ) : historyError ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-destructive mx-auto mb-4 opacity-50" />
            <p className="text-sm text-destructive mb-2">加载历史记录失败</p>
            <p className="text-xs text-muted-foreground">{historyError.message}</p>
          </div>
        ) : timelineEvents.length > 0 ? (
          <div className="relative space-y-4 pl-6 border-l-2 border-muted">
            {timelineEvents.map((event, index) => (
              <div key={index} className="relative">
                <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary border-2 border-background"></div>

                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {event.type === 'appearance' && <History className="h-4 w-4 text-muted-foreground" />}
                        {event.type === 'state' && <Clock className="h-4 w-4 text-primary" />}
                        {event.type === 'arcpoint' && <Sparkles className="h-4 w-4 text-purple-500" />}
                        <span className="text-sm font-semibold">
                          {event.type === 'appearance' && '首次出场'}
                          {event.type === 'state' && '状态变化'}
                          {event.type === 'arcpoint' && `成长轨迹 #${event.index}`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.time).toLocaleDateString("zh-CN")}
                      </span>
                    </div>

                    {event.chapterIndex !== undefined && (
                      <p className="text-xs text-muted-foreground mb-2">
                        第{event.chapterIndex + 1}章
                        {event.sceneIndex !== undefined && ` - 场景${event.sceneIndex + 1}`}
                      </p>
                    )}

                    {event.type === 'state' && (
                      <div className="space-y-1.5 text-sm">
                        {event.emotion && (
                          <div className="flex items-start gap-2">
                            <Heart className="h-3.5 w-3.5 text-pink-500 mt-0.5 flex-shrink-0" />
                            <span className="flex-1">{event.emotion}</span>
                          </div>
                        )}
                        {event.goal && (
                          <div className="flex items-start gap-2">
                            <Target className="h-3.5 w-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span className="flex-1">{event.goal}</span>
                          </div>
                        )}
                        {event.arcPoint && (
                          <div className="flex items-start gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                            <span className="flex-1">{event.arcPoint}</span>
                          </div>
                        )}
                        {event.notes && (
                          <p className="text-xs text-muted-foreground italic mt-2 pl-5">{event.notes}</p>
                        )}
                      </div>
                    )}

                    {event.type === 'arcpoint' && event.label && (
                      <p className="text-sm">{event.label}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground">暂无时间线记录</p>
          </div>
        )}
      </TabsContent>


      {/* Relationships Tab */}
      <TabsContent value="relationships" className="space-y-4 mt-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" />
            <span>角色关系</span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className="h-7 px-2 text-xs"
            >
              列表视图
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'graph' ? 'default' : 'outline'}
              onClick={() => setViewMode('graph')}
              className="h-7 px-2 text-xs"
            >
              网络图
            </Button>
          </div>
        </div>

        {relationships && Object.keys(relationships).length > 0 ? (
          viewMode === 'list' ? (
            <div className="space-y-3">
              {Object.entries(relationships).map(([charId, relation]: [string, any]) => (
                <Card key={charId}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{relation.name || relation.target || '未知角色'}</p>
                          <p className="text-xs text-muted-foreground">{relation.relation || '关系未定义'}</p>
                        </div>
                      </div>
                      <Badge variant="outline">{relation.type || '其他'}</Badge>
                    </div>
                    {relation.description && (
                      <p className="text-xs text-muted-foreground mt-3 pl-13">{relation.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <RelationshipNetworkView
                  centerCharacter={character}
                  relationships={relationships}
                />
              </CardContent>
            </Card>
          )
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground mb-2">暂无角色关系</p>
            <p className="text-xs text-muted-foreground">可以在编辑角色时添加关系信息</p>
          </div>
        )}
      </TabsContent>


      {/* Stats Tab */}
      <TabsContent value="stats" className="space-y-4 mt-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-4">
          <BookOpen className="h-4 w-4 text-primary" />
          <span>出场统计</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">
                  {character.mentionCount || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">出场次数</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-500">
                  {arcPoints?.length || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">成长轨迹点</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {arcPoints && arcPoints.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-semibold">成长轨迹记录</span>
              </div>
              <div className="space-y-3 pl-2">
                {arcPoints.map((point: any, index: number) => {
                  const content = typeof point === 'string' ? point : point.content;
                  const timestamp = typeof point === 'object' && point.timestamp ? new Date(point.timestamp).toLocaleDateString("zh-CN") : null;

                  return (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="leading-relaxed">{content}</p>
                        {timestamp && (
                          <p className="text-xs text-muted-foreground mt-0.5">{timestamp}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {firstAppearance && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">首次出场</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                第{firstAppearance.chapterIndex + 1}章
                {firstAppearance.sceneIndex !== undefined && ` - 场景${firstAppearance.sceneIndex + 1}`}
              </p>
            </CardContent>
          </Card>
        )}

        {lastMentioned && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">最后出场</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                第{lastMentioned.chapterIndex + 1}章
                {lastMentioned.sceneIndex !== undefined && ` - 场景${lastMentioned.sceneIndex + 1}`}
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

// Simple inline network visualization component
function RelationshipNetworkView({ centerCharacter, relationships }: { centerCharacter: any; relationships: any }) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Parse relationships into array format
  const relationshipsArray = Array.isArray(relationships)
    ? relationships
    : Object.values(relationships || {});

  if (relationshipsArray.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">暂无关系数据</div>;
  }

  const width = 600;
  const height = 400;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 150;

  const getRelationshipColor = (type?: string) => {
    const colors: Record<string, string> = {
      '师徒': '#f59e0b',
      '朋友': '#10b981',
      '敌对': '#ef4444',
      '家人': '#8b5cf6',
      '爱人': '#ec4899',
      '合作': '#3b82f6',
    };
    return colors[type || ''] || '#6b7280';
  };

  return (
    <div className="space-y-4">
      <svg
        width={width}
        height={height}
        className="mx-auto border rounded-lg bg-muted/10"
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {/* Draw edges */}
        {relationshipsArray.map((rel: any, i: number) => {
          const angle = (i / relationshipsArray.length) * 2 * Math.PI;
          const targetX = centerX + Math.cos(angle) * radius;
          const targetY = centerY + Math.sin(angle) * radius;
          const color = getRelationshipColor(rel.type);

          return (
            <g key={i}>
              <line
                x1={centerX}
                y1={centerY}
                x2={targetX}
                y2={targetY}
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.6}
              />
              <text
                x={(centerX + targetX) / 2}
                y={(centerY + targetY) / 2}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontWeight="bold"
                className="pointer-events-none"
              >
                {rel.type || '其他'}
              </text>
            </g>
          );
        })}

        {/* Draw center node */}
        <g>
          <circle
            cx={centerX}
            cy={centerY}
            r={35}
            fill="#3b82f6"
            fillOpacity={0.9}
            stroke="white"
            strokeWidth={3}
          />
          <text
            x={centerX}
            y={centerY}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={12}
            fontWeight="bold"
            className="pointer-events-none select-none"
          >
            {centerCharacter.name.length > 4 ? centerCharacter.name.slice(0, 4) + '...' : centerCharacter.name}
          </text>
        </g>

        {/* Draw relationship nodes */}
        {relationshipsArray.map((rel: any, i: number) => {
          const angle = (i / relationshipsArray.length) * 2 * Math.PI;
          const nodeX = centerX + Math.cos(angle) * radius;
          const nodeY = centerY + Math.sin(angle) * radius;
          const targetName = rel.target || rel.name || `角色${i + 1}`;
          const isHovered = hoveredNode === targetName;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredNode(targetName)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer"
            >
              <circle
                cx={nodeX}
                cy={nodeY}
                r={isHovered ? 28 : 25}
                fill={getRelationshipColor(rel.type)}
                fillOpacity={isHovered ? 1 : 0.8}
                stroke="white"
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all"
              />
              <text
                x={nodeX}
                y={nodeY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={10}
                fontWeight={isHovered ? 'bold' : 'normal'}
                className="pointer-events-none select-none"
              >
                {targetName.length > 4 ? targetName.slice(0, 4) + '...' : targetName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Hovered node info */}
      {hoveredNode && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{hoveredNode}</span>
              {relationshipsArray.find((r: any) => (r.target || r.name) === hoveredNode)?.description && (
                <p className="text-xs text-muted-foreground">
                  {relationshipsArray.find((r: any) => (r.target || r.name) === hoveredNode)?.description}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {['师徒', '朋友', '敌对', '家人', '爱人', '合作'].map((type) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: getRelationshipColor(type) }}
            />
            <span>{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
