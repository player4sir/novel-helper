import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, FileText, TrendingUp, MoreVertical, Pencil, Trash2, Copy, Archive, Calendar } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import type { Project } from "@shared/schema";
import { Progress } from "@/components/ui/progress";

interface TodayStats {
  wordsWritten: number;
  chaptersCompleted: number;
  date: string;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: todayStats } = useQuery<TodayStats>({
    queryKey: ["/api/statistics/today/summary"],
    refetchInterval: 60000, // 每分钟刷新一次
  });

  const activeProjects = projects?.filter((p: Project) => p.status === "active") || [];
  const totalWords = projects?.reduce((sum: number, p: Project) => sum + (p.currentWordCount || 0), 0) || 0;

  const handleProjectCreated = (projectId: string) => {
    setLocation(`/write?project=${projectId}`);
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            项目概览
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理您的小说创作项目
          </p>
        </div>
        <CreateProjectDialog onSuccess={handleProjectCreated}>
          <Button data-testid="button-create-project">
            <Plus className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        </CreateProjectDialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃项目</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-projects">
              {activeProjects.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {projects?.length || 0} 个项目总计
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总字数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-words">
              {totalWords.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              跨所有项目
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日进度</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-words">
              {todayStats?.wordsWritten?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              字（今日新增）
              {todayStats?.chaptersCompleted ? ` · ${todayStats.chaptersCompleted} 章` : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">我的项目</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project: Project) => {
              const progress = project.targetWordCount && project.targetWordCount > 0
                ? Math.min(((project.currentWordCount || 0) / project.targetWordCount) * 100, 100)
                : 0;
              
              return (
                <Card 
                  key={project.id}
                  className="group hover:shadow-md hover:border-primary/50 transition-all relative" 
                  data-testid={`card-project-${project.id}`}
                >
                  <div className="absolute top-4 right-4 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <EditProjectDialog project={project}>
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Pencil className="h-4 w-4 mr-2" />
                            编辑
                          </DropdownMenuItem>
                        </EditProjectDialog>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          复制
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          归档
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DeleteProjectDialog project={project}>
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={(e) => e.preventDefault()}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </DropdownMenuItem>
                        </DeleteProjectDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Link href={`/write?project=${project.id}`}>
                    <div className="cursor-pointer">
                      <CardHeader className="pb-4 pr-14">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <CardTitle className="text-xl font-semibold mb-1.5 group-hover:text-primary transition-colors truncate">
                            {project.title}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
                            <Badge variant="secondary" className="text-xs font-normal shrink-0">
                              {project.genre}
                            </Badge>
                            {project.style && (
                              <Badge variant="outline" className="text-xs font-normal shrink-0">
                                {project.style}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="pt-0 space-y-4">
                        {project.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed break-words">
                            {project.description}
                          </p>
                        )}

                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between gap-2 min-w-0">
                            <span className="text-2xl font-bold truncate">
                              {(project.currentWordCount || 0).toLocaleString()}
                            </span>
                            {project.targetWordCount && (
                              <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                                / {project.targetWordCount.toLocaleString()} 字
                              </span>
                            )}
                          </div>

                          {project.targetWordCount && project.targetWordCount > 0 && (
                            <div className="space-y-1">
                              <Progress value={progress} className="h-2" />
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>完成度</span>
                                <span className="font-medium">{Math.round(progress)}%</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t gap-2">
                          <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                            <Calendar className="h-3 w-3 shrink-0" />
                            <span className="truncate">{new Date(project.updatedAt).toLocaleDateString('zh-CN')}</span>
                          </div>
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs shrink-0">
                            {project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '已归档'}
                          </Badge>
                        </div>
                      </CardContent>
                    </div>
                  </Link>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无项目</h3>
              <p className="text-sm text-muted-foreground mb-6">
                创建您的第一个小说项目，开始AI辅助创作之旅
              </p>
              <CreateProjectDialog onSuccess={handleProjectCreated}>
                <Button data-testid="button-create-first-project">
                  <Plus className="h-4 w-4 mr-2" />
                  创建项目
                </Button>
              </CreateProjectDialog>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
