import { Sparkles, Loader2, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateContentButtonProps {
  isGenerating: boolean;
  isThinking?: boolean;
  onGenerate: () => void;
  onStop?: () => void;
}

export function GenerateContentButton({
  isGenerating,
  isThinking,
  onGenerate,
  onStop,
}: GenerateContentButtonProps) {
  if (isGenerating) {
    return (
      <Button
        onClick={onStop}
        variant="destructive"
        size="sm"
        className="transition-all duration-300"
      >
        {isThinking ? (
          <>
            <Brain className="h-4 w-4 mr-2 animate-pulse" />
            AI思考中...
          </>
        ) : (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            正在生成...
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={onGenerate}
      variant="default"
      size="sm"
    >
      <Sparkles className="h-4 w-4 mr-2" />
      AI生成内容
    </Button>
  );
}
