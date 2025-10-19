import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, BookOpen, Zap, Calendar } from "lucide-react";
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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { Project, Statistic } from "@shared/schema";

const milestones = [
  { words: 30000, label: "3万字 - 书荒期", color: "#f59e0b" },
  { words: 80000, label: "8万字 - 验证期", color: "#3b82f6" },
  { words: 200000, label: "20万字 - 推荐期", color: "#10b981" },
];

export default function Statistics() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: statistics } = useQuery<Statistic[]>({
    queryKey: ["/api/statistics", selectedProjectId],
    enabled: !!selectedProjectId,
  });

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);

  const totalWordsWritten = statistics?.reduce((sum, s) => sum + (s.wordsWritten || 0), 0) || 0;
  const totalChapters = statistics?.reduce((sum, s) => sum + (s.chaptersCompleted || 0), 0) || 0;
  const totalAIGenerations = statistics?.reduce((sum, s) => sum + (s.aiGenerations || 0), 0) || 0;
  const avgDailyWords = statistics && statistics.length > 0
    ? Math.round(totalWordsWritten / statistics.length)
    : 0;

  const chartData = statistics?.map((stat) => ({
    date: new Date(stat.date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }),
    words: stat.wordsWritten,
    chapters: stat.chaptersCompleted,
  })) || [];

  const nextMilestone = selectedProject
    ? milestones.find((m) => m.words > (selectedProject.currentWordCount || 0))
    : null;

  const progress = selectedProject && nextMilestone
    ? Math.round(((selectedProject.currentWordCount || 0) / nextMilestone.words) * 100)
    : 0;

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">数据统计</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看创作数据和进度分析
          </p>
        </div>
      </div>

      <div className="w-64">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger data-testid="select-project-statistics">
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

      {selectedProject ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总字数</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-words-stat">
                  {selectedProject.currentWordCount?.toLocaleString() || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  目标：{selectedProject.targetWordCount?.toLocaleString() || 0} 字
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">日均产出</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {avgDailyWords.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  字/天
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">完成章节</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalChapters}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  章节
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI生成次数</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalAIGenerations}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  次调用
                </p>
              </CardContent>
            </Card>
          </div>

          {nextMilestone && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">番茄小说里程碑</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{nextMilestone.label}</p>
                    <p className="text-xs text-muted-foreground">
                      还需 {(nextMilestone.words - (selectedProject.currentWordCount || 0)).toLocaleString()} 字
                    </p>
                  </div>
                  <Badge style={{ backgroundColor: nextMilestone.color }} className="text-white">
                    {progress}%
                  </Badge>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: nextMilestone.color,
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  {milestones.map((milestone) => {
                    const reached = (selectedProject.currentWordCount || 0) >= milestone.words;
                    return (
                      <Badge
                        key={milestone.words}
                        variant={reached ? "default" : "outline"}
                        className="text-xs"
                        style={reached ? { backgroundColor: milestone.color } : {}}
                      >
                        {milestone.words / 10000}万字
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">每日字数统计</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="words"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      name="字数"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以查看统计数据
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
