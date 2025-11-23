import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, ThumbsUp, ThumbsDown, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeedbackCollectorProps {
  projectId?: string;
  candidateId?: string;
  onSubmit?: (feedback: FeedbackData) => Promise<void>;
}

interface FeedbackData {
  rating: number;
  sentiment: "positive" | "negative" | null;
  selectedTags: string[];
  comment: string;
}

const FEEDBACK_TAGS = {
  positive: [
    "角色生动",
    "世界观独特",
    "冲突吸引人",
    "设定完整",
    "创意新颖",
    "逻辑严密",
    "细节丰富",
    "可写性强",
  ],
  negative: [
    "角色单薄",
    "世界观俗套",
    "冲突老套",
    "设定不完整",
    "缺乏创意",
    "逻辑矛盾",
    "细节不足",
    "难以展开",
  ],
};

export function FeedbackCollector({
  projectId,
  candidateId,
  onSubmit,
}: FeedbackCollectorProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [sentiment, setSentiment] = useState<"positive" | "negative" | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleRatingClick = (value: number) => {
    setRating(value);
    // Auto-set sentiment based on rating
    if (value >= 4) {
      setSentiment("positive");
    } else if (value <= 2) {
      setSentiment("negative");
    }
  };

  const handleSentimentClick = (value: "positive" | "negative") => {
    if (sentiment === value) {
      setSentiment(null);
      setSelectedTags([]);
    } else {
      setSentiment(value);
      setSelectedTags([]);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "请先评分",
        description: "请为生成结果打分后再提交反馈",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackData: FeedbackData = {
        rating,
        sentiment,
        selectedTags,
        comment: comment.trim(),
      };

      if (onSubmit) {
        await onSubmit(feedbackData);
      } else {
        // Default submission to API
        await submitFeedbackToAPI(projectId, candidateId, feedbackData);
      }

      toast({
        title: "反馈已提交",
        description: "感谢您的反馈，这将帮助我们改进生成质量",
      });

      // Reset form
      setRating(0);
      setSentiment(null);
      setSelectedTags([]);
      setComment("");
    } catch (error: any) {
      toast({
        title: "提交失败",
        description: error.message || "无法提交反馈，请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableTags = sentiment ? FEEDBACK_TAGS[sentiment] : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>反馈评价</CardTitle>
        <CardDescription>
          您的反馈将帮助系统学习您的偏好，生成更符合您需求的内容
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Section */}
        <div className="space-y-2">
          <Label>整体评分 *</Label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => handleRatingClick(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`h-8 w-8 ${
                    value <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
            {rating > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
                {getRatingLabel(rating)}
              </span>
            )}
          </div>
        </div>

        {/* Sentiment Section */}
        <div className="space-y-2">
          <Label>总体感受</Label>
          <div className="flex gap-3">
            <Button
              type="button"
              variant={sentiment === "positive" ? "default" : "outline"}
              onClick={() => handleSentimentClick("positive")}
              className="flex-1"
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              满意
            </Button>
            <Button
              type="button"
              variant={sentiment === "negative" ? "default" : "outline"}
              onClick={() => handleSentimentClick("negative")}
              className="flex-1"
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              不满意
            </Button>
          </div>
        </div>

        {/* Tags Section */}
        {sentiment && (
          <div className="space-y-2">
            <Label>具体评价（可多选）</Label>
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Comment Section */}
        <div className="space-y-2">
          <Label htmlFor="comment">详细意见（可选）</Label>
          <Textarea
            id="comment"
            placeholder="请分享您的具体想法和建议..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || rating === 0}
          className="w-full"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSubmitting ? "提交中..." : "提交反馈"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Helper functions
function getRatingLabel(rating: number): string {
  const labels: Record<number, string> = {
    1: "很不满意",
    2: "不满意",
    3: "一般",
    4: "满意",
    5: "非常满意",
  };
  return labels[rating] || "";
}

async function submitFeedbackToAPI(
  projectId: string | undefined,
  candidateId: string | undefined,
  feedback: FeedbackData
): Promise<void> {
  const response = await fetch("/api/feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      candidateId,
      rating: feedback.rating,
      sentiment: feedback.sentiment,
      tags: feedback.selectedTags,
      comment: feedback.comment,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to submit feedback");
  }
}
