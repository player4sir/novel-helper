import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  FileText, 
  Search, 
  Filter,
  Clock,
  Zap,
  Database,
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Project } from "@shared/schema";

interface GenerationLog {
  executionId: string;
  projectId: string;
  chapterId?: string;
  sceneId?: string;
  templateId: string;
  templateVersion: string;
  promptSignature: string;
  modelId: string;
  routeDecision: {
    strategy: string;
    reasoning: string;
    confidence: number;
    routingScore: number;
    topFeatures?: string[];
  };
  cachePath?: string;
  tokensUsed: number;
  cost: number;
  qualityScore: {
    overall: number;
    dimensions: {
      completeness: number;
      consistency: number;
      coherence: number;
      fluency: number;
    };
    suggestions: string[];
  };
  ruleViolations: Array<{
    rule: string;
    severity: string;
    message: string;
  }>;
  repairActions?: Array<{
    type: string;
    original: string;
    replacement: string;
  }>;
  timestamp: string;
}

export default function GenerationLogs() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<GenerationLog | null>(null);
  const [cachePathFilter, setCachePathFilter] = useState<string>("all");
  const [minQuality, setMinQuality] = useState<string>("all");

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: logs } = useQuery<GenerationLog[]>({
    queryKey: [
      "/api/generation-logs",
      { 
        projectId: selectedProjectId,
        cachePath: cachePathFilter !== "all" ? cachePathFilter : undefined,
        minQuality: minQuality !== "all" ? minQuality : undefined,
      },
    ],
    enabled: !!selectedProjectId,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStrategyBadge = (strategy: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      small: { color: "bg-green-50 text-green-700", label: "小模型" },
      "small-with-fallback": { color: "bg-yellow-50 text-yellow-700", label: "小+降级" },
      big: { color: "bg-blue-50 text-blue-700", label: "大模型" },
      cache: { color: "bg-purple-50 text-purple-700", label: "缓存" },
    };
    const variant = variants[strategy] || variants.small;
    return (
      <Badge variant="outline" className={variant.color}>
        {variant.label}
      </Badge>
    );
  };

  const getCacheTierBadge = (tier?: string) => {
    if (!tier) return null;
    const variants: Record<string, { color: string; label: string }> = {
      exact: { color: "bg-blue-50 text-blue-700", label: "精确" },
      semantic: { color: "bg-green-50 text-green-700", label: "语义" },
      template: { color: "bg-yellow-50 text-yellow-700", label: "模板" },
    };
    const variant = variants[tier] || variants.exact;
    return (
      <Badge variant="outline" className={variant.color}>
        <Database className="h-3 w-3 mr-1" />
        {variant.label}
      </Badge>
    );
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          优秀 {score}
        </Badge>
      );
    } else if (score >= 60) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
          <TrendingUp className="h-3 w-3 mr-1" />
          良好 {score}
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          较差 {score}
        </Badge>
      );
    }
  };

  return (
    <div className="p-6 max-w-screen-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">生成日志</h1>
          <p className="text-sm text-muted-foreground mt-1">
            查看AI生成的完整记录和审计信息
          </p>
        </div>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-4">
        <div className="w-64">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
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

        <div className="w-48">
          <Select value={cachePathFilter} onValueChange={setCachePathFilter}>
            <SelectTrigger>
              <SelectValue placeholder="缓存类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="exact">精确匹配</SelectItem>
              <SelectItem value="semantic">语义匹配</SelectItem>
              <SelectItem value="template">模板复用</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-48">
          <Select value={minQuality} onValueChange={setMinQuality}>
            <SelectTrigger>
              <SelectValue placeholder="最低质量" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="80">优秀 (≥80)</SelectItem>
              <SelectItem value="60">良好 (≥60)</SelectItem>
              <SelectItem value="0">较差 (&lt;60)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 日志列表 */}
      {selectedProjectId ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">生成记录</CardTitle>
            <CardDescription>
              共 {logs?.length || 0} 条记录
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>模板</TableHead>
                    <TableHead>策略</TableHead>
                    <TableHead>缓存</TableHead>
                    <TableHead>质量</TableHead>
                    <TableHead>成本</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => (
                    <TableRow key={log.executionId}>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(log.timestamp)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {log.templateId}
                      </TableCell>
                      <TableCell>
                        {getStrategyBadge(log.routeDecision.strategy)}
                      </TableCell>
                      <TableCell>
                        {getCacheTierBadge(log.cachePath)}
                      </TableCell>
                      <TableCell>
                        {getQualityBadge(log.qualityScore.overall)}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {log.tokensUsed.toLocaleString()}
                          <span className="text-muted-foreground ml-1">
                            ¥{(log.cost / 100).toFixed(3)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-12">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">选择项目</h3>
            <p className="text-sm text-muted-foreground">
              请先选择一个项目以查看生成日志
            </p>
          </div>
        </Card>
      )}

      {/* 详情对话框 */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>生成详情</DialogTitle>
            <DialogDescription>
              执行ID: {selectedLog?.executionId}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            {selectedLog && (
              <div className="space-y-4 pr-4">
                {/* 路由决策 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">路由决策</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">策略</span>
                      {getStrategyBadge(selectedLog.routeDecision.strategy)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">评分</span>
                      <span className="text-sm font-medium">
                        {selectedLog.routeDecision?.routingScore?.toFixed(3) ?? 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">置信度</span>
                      <span className="text-sm font-medium">
                        {selectedLog.routeDecision?.confidence ? (selectedLog.routeDecision.confidence * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground mb-1">决策原因</p>
                      <p className="text-sm">{selectedLog.routeDecision.reasoning}</p>
                    </div>
                    {selectedLog.routeDecision.topFeatures && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-1">主要因素</p>
                        <div className="flex gap-2">
                          {selectedLog.routeDecision.topFeatures.map((feature, idx) => (
                            <Badge key={idx} variant="outline">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 质量评分 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">质量评分</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">总分</span>
                      {getQualityBadge(selectedLog.qualityScore.overall)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div>
                        <span className="text-xs text-muted-foreground">完整性</span>
                        <div className="text-sm font-medium">
                          {selectedLog.qualityScore.dimensions.completeness}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">一致性</span>
                        <div className="text-sm font-medium">
                          {selectedLog.qualityScore.dimensions.consistency}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">连贯性</span>
                        <div className="text-sm font-medium">
                          {selectedLog.qualityScore.dimensions.coherence}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">流畅度</span>
                        <div className="text-sm font-medium">
                          {selectedLog.qualityScore.dimensions.fluency}
                        </div>
                      </div>
                    </div>
                    {selectedLog.qualityScore.suggestions.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-sm text-muted-foreground mb-1">改进建议</p>
                        <ul className="text-sm space-y-1">
                          {selectedLog.qualityScore.suggestions.map((suggestion, idx) => (
                            <li key={idx} className="text-muted-foreground">
                              • {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 规则违规 */}
                {selectedLog.ruleViolations.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">规则违规</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedLog.ruleViolations.map((violation, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-sm p-2 rounded bg-muted"
                          >
                            <AlertTriangle
                              className={`h-4 w-4 mt-0.5 ${
                                violation.severity === "error"
                                  ? "text-red-500"
                                  : "text-yellow-500"
                              }`}
                            />
                            <div>
                              <p className="font-medium">{violation.rule}</p>
                              <p className="text-muted-foreground">{violation.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 自动修复 */}
                {selectedLog.repairActions && selectedLog.repairActions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">自动修复</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedLog.repairActions.map((action, idx) => (
                          <div key={idx} className="space-y-1 p-2 rounded bg-muted">
                            <Badge variant="outline">{action.type}</Badge>
                            <div className="text-xs space-y-1">
                              <div>
                                <span className="text-muted-foreground">原文：</span>
                                <p className="text-red-600 line-through">
                                  {action.original}
                                </p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">修改：</span>
                                <p className="text-green-600">{action.replacement}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 技术信息 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">技术信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">模型</span>
                      <span className="font-mono">{selectedLog.modelId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">模板</span>
                      <span className="font-mono">{selectedLog.templateId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">版本</span>
                      <span className="font-mono">{selectedLog.templateVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tokens</span>
                      <span className="font-mono">
                        {selectedLog.tokensUsed.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">成本</span>
                      <span className="font-mono">
                        ¥{(selectedLog.cost / 100).toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">签名</span>
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {selectedLog.promptSignature}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
