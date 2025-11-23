import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface CreationStep {
  id: string;
  label: string;
  status: "pending" | "running" | "completed" | "error";
  message?: string;
  progress?: number;
  metadata?: {
    cacheHit?: boolean;
    quality?: number;
    similarity?: number;
    dimensions?: {
      completeness?: number;
      consistency?: number;
      coherence?: number;
      fluency?: number;
    };
    tokensUsed?: number;
    cost?: number;
  };
}

interface ProjectCreationProgressProps {
  steps: CreationStep[];
  currentStep: number;
  overallProgress: number;
}

export function ProjectCreationProgress({
  steps,
  currentStep,
  overallProgress,
}: ProjectCreationProgressProps) {
  return (
    <div className="space-y-6">
      {/* 总体进度 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">创建进度</span>
          <span className="text-muted-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* 步骤列表 */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg transition-colors",
              step.status === "running" && "bg-primary/5 border border-primary/20",
              step.status === "completed" && "bg-muted/50",
              step.status === "error" && "bg-destructive/5 border border-destructive/20"
            )}
          >
            {/* 状态图标 */}
            <div className="mt-0.5">
              {step.status === "pending" && (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {step.status === "running" && (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              )}
              {step.status === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              )}
              {step.status === "error" && (
                <AlertCircle className="h-5 w-5 text-destructive" />
              )}
            </div>

            {/* 步骤信息 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{step.label}</span>
                {step.status === "running" && step.progress !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(step.progress)}%
                  </span>
                )}
                {step.metadata?.cacheHit && (
                  <span className="text-xs bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400 px-2 py-0.5 rounded">
                    缓存命中
                  </span>
                )}
                {step.metadata?.quality !== undefined && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded",
                    step.metadata.quality >= 80
                      ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                      : step.metadata.quality >= 60
                        ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400"
                        : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                  )}>
                    质量: {Math.round(step.metadata.quality)}
                  </span>
                )}
                {step.metadata?.tokensUsed !== undefined && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
                    {step.metadata.tokensUsed.toLocaleString()} tokens
                  </span>
                )}
                {step.metadata?.cost !== undefined && (
                  <span className="text-xs bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded">
                    ¥{(step.metadata.cost / 100).toFixed(4)}
                  </span>
                )}
              </div>
              {step.message && (
                <p className="text-xs text-muted-foreground mt-1">{step.message}</p>
              )}
              {step.metadata?.similarity && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  相似度: {(step.metadata.similarity * 100).toFixed(1)}%
                </p>
              )}
              {step.metadata?.dimensions && (
                <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                  {step.metadata.dimensions.completeness !== undefined && (
                    <div className="text-muted-foreground">
                      完整性: <span className="font-medium">{Math.round(step.metadata.dimensions.completeness)}</span>
                    </div>
                  )}
                  {step.metadata.dimensions.consistency !== undefined && (
                    <div className="text-muted-foreground">
                      一致性: <span className="font-medium">{Math.round(step.metadata.dimensions.consistency)}</span>
                    </div>
                  )}
                  {step.metadata.dimensions.coherence !== undefined && (
                    <div className="text-muted-foreground">
                      连贯性: <span className="font-medium">{Math.round(step.metadata.dimensions.coherence)}</span>
                    </div>
                  )}
                  {step.metadata.dimensions.fluency !== undefined && (
                    <div className="text-muted-foreground">
                      流畅度: <span className="font-medium">{Math.round(step.metadata.dimensions.fluency)}</span>
                    </div>
                  )}
                </div>
              )}
              {step.status === "running" && step.progress !== undefined && (
                <Progress value={step.progress} className="h-1 mt-2" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
