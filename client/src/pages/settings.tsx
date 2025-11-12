import { Settings as SettingsIcon, Database, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const { toast } = useToast();

  const cleanupCacheMutation = useMutation({
    mutationFn: async (daysOld: number) => {
      return await apiRequest("POST", "/api/cache/cleanup", { daysOld });
    },
    onSuccess: (data: any) => {
      toast({
        title: "缓存清理完成",
        description: `已删除 ${data.deleted} 条过期缓存记录`,
      });
    },
    onError: () => {
      toast({
        title: "清理失败",
        description: "缓存清理过程中出现错误",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">系统设置</h1>
        <p className="text-sm text-muted-foreground mt-1">
          管理系统配置和数据维护
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle>缓存管理</CardTitle>
            </div>
            <CardDescription>
              管理语义缓存和生成历史数据
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">清理过期缓存</h3>
                <p className="text-sm text-muted-foreground">
                  删除30天以上未使用的缓存记录
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Trash2 className="h-4 w-4 mr-2" />
                    清理缓存
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清理缓存？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将删除30天以上未使用的缓存记录。这不会影响您的项目数据，但可能会降低短期内的生成速度。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cleanupCacheMutation.mutate(30)}
                      disabled={cleanupCacheMutation.isPending}
                    >
                      {cleanupCacheMutation.isPending ? "清理中..." : "确认清理"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">清理所有缓存</h3>
                <p className="text-sm text-muted-foreground">
                  删除所有缓存记录（包括最近使用的）
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    <Trash2 className="h-4 w-4 mr-2" />
                    全部清理
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清理所有缓存？</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将删除所有缓存记录。这不会影响您的项目数据，但会显著降低后续生成速度，直到缓存重新积累。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => cleanupCacheMutation.mutate(0)}
                      disabled={cleanupCacheMutation.isPending}
                    >
                      {cleanupCacheMutation.isPending ? "清理中..." : "确认清理"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-primary" />
              <CardTitle>系统信息</CardTitle>
            </div>
            <CardDescription>
              查看系统版本和配置信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">应用版本</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">数据库</span>
              <span className="font-medium">PostgreSQL</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">环境</span>
              <span className="font-medium">Production</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
