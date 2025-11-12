import { CheckCircle2, AlertTriangle, Zap, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface GenerationQualityIndicatorProps {
  ruleCheckPassed: boolean;
  warningCount: number;
  errorCount: number;
  fromCache?: boolean;
  qualityScore?: number;
}

export function GenerationQualityIndicator({
  ruleCheckPassed,
  warningCount,
  errorCount,
  fromCache,
  qualityScore,
}: GenerationQualityIndicatorProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* 缓存标识 */}
      {fromCache && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400">
                <Database className="h-3 w-3 mr-1" />
                缓存复用
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">从缓存中复用，节省了API调用</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 规则检查状态 */}
      {ruleCheckPassed ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                通过检查
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">内容通过所有规则检查</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {errorCount} 个错误
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">内容存在质量问题，建议重新生成</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 警告数量 */}
      {warningCount > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {warningCount} 个警告
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">内容可以改进，但不影响使用</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 质量分数 */}
      {qualityScore !== undefined && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  qualityScore >= 80 
                    ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                    : qualityScore >= 60
                    ? "bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400"
                    : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                }`}
              >
                <Zap className="h-3 w-3 mr-1" />
                质量 {qualityScore}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                综合质量评分（0-100）
                <br />
                {qualityScore >= 80 && "优秀：可直接使用"}
                {qualityScore >= 60 && qualityScore < 80 && "良好：建议微调"}
                {qualityScore < 60 && "较差：建议重新生成"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
