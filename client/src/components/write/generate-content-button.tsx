import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateContentButtonProps {
  isGenerating: boolean;
  onGenerate: () => void;
  onStop?: () => void;
}

export function GenerateContentButton({
  isGenerating,
  onGenerate,
  onStop,
}: GenerateContentButtonProps) {
  if (isGenerating) {
    return (
      <Button
        onClick={onStop}
        variant="destructive"
        size="sm"
      >
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        停止生成
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
