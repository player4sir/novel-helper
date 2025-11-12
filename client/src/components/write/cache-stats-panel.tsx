import { useQuery } from "@tanstack/react-query";
import { Database, TrendingUp, Zap, Percent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CacheStats {
  totalSignatures: number;
  avgQualityScore: number;
  avgReuseCount: number;
  hitRate: number;
}

export function CacheStatsPanel() {
  const { data: stats } = useQuery<CacheStats>({
    queryKey: ["/api/cache/stats"],
    refetchInterval: 30000, // 每30秒刷新
  });

  if (!stats) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">缓存统计</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-xs">
          语义缓存性能指标
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-muted-foreground">缓存数量</span>
            </div>
            <div className="text-lg font-semibold">{stats.totalSignatures}</div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Percent className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">命中率</span>
            </div>
            <div className="text-lg font-semibold">
              {(stats.hitRate * 100).toFixed(1)}%
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">平均质量</span>
            </div>
            <div className="text-lg font-semibold">
              {stats.avgQualityScore.toFixed(0)}
              <span className="text-xs text-muted-foreground ml-1">分</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3 text-purple-500" />
              <span className="text-xs text-muted-foreground">平均复用</span>
            </div>
            <div className="text-lg font-semibold">
              {stats.avgReuseCount.toFixed(1)}
              <span className="text-xs text-muted-foreground ml-1">次</span>
            </div>
          </div>
        </div>

        {stats.hitRate > 0.2 && (
          <div className="pt-2 border-t">
            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
              <Zap className="h-3 w-3 mr-1" />
              缓存工作良好
            </Badge>
          </div>
        )}

        {stats.hitRate === 0 && stats.totalSignatures > 0 && (
          <div className="pt-2 border-t">
            <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400">
              正在积累缓存数据
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
