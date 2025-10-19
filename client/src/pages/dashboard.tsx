import { useQuery } from "@tanstack/react-query";
import { Plus, BookOpen, FileText, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Project } from "@shared/schema";

export default function Dashboard() {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjects = projects?.filter((p) => p.status === "active") || [];
  const totalWords = projects?.reduce((sum, p) => sum + (p.currentWordCount || 0), 0) || 0;

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
        <Link href="/write">
          <Button data-testid="button-create-project">
            <Plus className="h-4 w-4 mr-2" />
            新建项目
          </Button>
        </Link>
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
              0
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              字（今日新增）
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
            {projects.map((project) => (
              <Link key={project.id} href={`/write?project=${project.id}`}>
                <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-project-${project.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-1">
                        {project.title}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {project.genre}
                      </Badge>
                    </div>
                    <CardDescription className="line-clamp-2">
                      {project.description || "暂无简介"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">字数</span>
                      <span className="font-medium">
                        {project.currentWordCount?.toLocaleString() || 0}
                        {project.targetWordCount ? ` / ${project.targetWordCount.toLocaleString()}` : ''}
                      </span>
                    </div>
                    {project.targetWordCount && project.targetWordCount > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>进度</span>
                          <span>
                            {Math.round((project.currentWordCount / project.targetWordCount) * 100)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                (project.currentWordCount / project.targetWordCount) * 100,
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">暂无项目</h3>
              <p className="text-sm text-muted-foreground mb-6">
                创建您的第一个小说项目，开始AI辅助创作之旅
              </p>
              <Link href="/write">
                <Button data-testid="button-create-first-project">
                  <Plus className="h-4 w-4 mr-2" />
                  创建项目
                </Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
