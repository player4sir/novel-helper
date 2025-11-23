import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, RefreshCw, Save, X, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ErrorNotificationProps {
  error: ErrorInfo;
  onRetry?: () => void;
  onSave?: () => void;
  onDismiss?: () => void;
  onRecover?: () => void;
}

interface ErrorInfo {
  type: "network" | "validation" | "timeout" | "server" | "unknown";
  message: string;
  details?: string;
  recoverable: boolean;
  canRetry: boolean;
  canSave: boolean;
  retryCount?: number;
  maxRetries?: number;
}

export function ErrorNotification({
  error,
  onRetry,
  onSave,
  onDismiss,
  onRecover,
}: ErrorNotificationProps) {
  const [showDetails, setShowDetails] = useState(false);

  const getErrorConfig = (type: ErrorInfo["type"]) => {
    const configs = {
      network: {
        icon: <AlertCircle className="h-4 w-4" />,
        title: "网络连接错误",
        variant: "destructive" as const,
        color: "text-red-600",
      },
      validation: {
        icon: <Info className="h-4 w-4" />,
        title: "数据验证错误",
        variant: "default" as const,
        color: "text-yellow-600",
      },
      timeout: {
        icon: <AlertCircle className="h-4 w-4" />,
        title: "请求超时",
        variant: "destructive" as const,
        color: "text-orange-600",
      },
      server: {
        icon: <AlertCircle className="h-4 w-4" />,
        title: "服务器错误",
        variant: "destructive" as const,
        color: "text-red-600",
      },
      unknown: {
        icon: <AlertCircle className="h-4 w-4" />,
        title: "未知错误",
        variant: "default" as const,
        color: "text-gray-600",
      },
    };
    return configs[type];
  };

  const config = getErrorConfig(error.type);

  return (
    <>
      <Alert variant={config.variant} className="mb-4">
        {config.icon}
        <AlertTitle className="flex items-center justify-between">
          <span>{config.title}</span>
          <div className="flex items-center gap-2">
            {error.retryCount !== undefined && error.maxRetries !== undefined && (
              <Badge variant="outline">
                重试 {error.retryCount}/{error.maxRetries}
              </Badge>
            )}
            {error.recoverable && (
              <Badge variant="secondary">可恢复</Badge>
            )}
          </div>
        </AlertTitle>
        <AlertDescription>
          <p className="mb-3">{error.message}</p>

          {error.details && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(true)}
              className="p-0 h-auto"
            >
              查看详细信息
            </Button>
          )}

          <div className="flex gap-2 mt-3">
            {error.canRetry && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                disabled={
                  error.retryCount !== undefined &&
                  error.maxRetries !== undefined &&
                  error.retryCount >= error.maxRetries
                }
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                重试
              </Button>
            )}

            {error.canSave && onSave && (
              <Button variant="outline" size="sm" onClick={onSave}>
                <Save className="mr-1 h-4 w-4" />
                保存进度
              </Button>
            )}

            {error.recoverable && onRecover && (
              <Button variant="outline" size="sm" onClick={onRecover}>
                <RefreshCw className="mr-1 h-4 w-4" />
                尝试恢复
              </Button>
            )}

            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                <X className="mr-1 h-4 w-4" />
                关闭
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>错误详情</DialogTitle>
            <DialogDescription>
              以下是错误的详细信息，可能有助于问题诊断
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">错误类型</h4>
              <Badge>{error.type}</Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-2">错误消息</h4>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>

            {error.details && (
              <div>
                <h4 className="font-semibold mb-2">详细信息</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                  {error.details}
                </pre>
              </div>
            )}

            <div>
              <h4 className="font-semibold mb-2">恢复选项</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {error.canRetry && <li>• 可以重试操作</li>}
                {error.canSave && <li>• 可以保存当前进度</li>}
                {error.recoverable && <li>• 可以尝试自动恢复</li>}
                {!error.canRetry && !error.canSave && !error.recoverable && (
                  <li>• 请刷新页面或联系技术支持</li>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Error Notification Container for multiple errors
interface ErrorNotificationContainerProps {
  errors: ErrorInfo[];
  onRetry?: (index: number) => void;
  onSave?: (index: number) => void;
  onDismiss?: (index: number) => void;
  onRecover?: (index: number) => void;
  onClearAll?: () => void;
}

export function ErrorNotificationContainer({
  errors,
  onRetry,
  onSave,
  onDismiss,
  onRecover,
  onClearAll,
}: ErrorNotificationContainerProps) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-2">
      {errors.length > 1 && onClearAll && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClearAll}>
            <X className="mr-1 h-4 w-4" />
            清除所有
          </Button>
        </div>
      )}

      {errors.map((error, index) => (
        <ErrorNotification
          key={index}
          error={error}
          onRetry={onRetry ? () => onRetry(index) : undefined}
          onSave={onSave ? () => onSave(index) : undefined}
          onDismiss={onDismiss ? () => onDismiss(index) : undefined}
          onRecover={onRecover ? () => onRecover(index) : undefined}
        />
      ))}
    </div>
  );
}

// Hook for managing errors
export function useErrorNotifications() {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);

  const addError = (error: ErrorInfo) => {
    setErrors((prev) => [...prev, error]);
  };

  const removeError = (index: number) => {
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setErrors([]);
  };

  const updateError = (index: number, updates: Partial<ErrorInfo>) => {
    setErrors((prev) =>
      prev.map((error, i) => (i === index ? { ...error, ...updates } : error))
    );
  };

  return {
    errors,
    addError,
    removeError,
    clearAll,
    updateError,
  };
}
