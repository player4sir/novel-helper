import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Target,
  Zap,
} from "lucide-react";

interface QualityScore {
  completeness: number;
  consistency: number;
  richness: number;
  writability: number;
  semanticQuality: number;
  totalScore: number;
}

interface InnovationScore {
  worldUniqueness: number;
  characterComplexity: number;
  conflictOriginality: number;
  overallInnovation: number;
  cliches: Array<{
    type: string;
    description: string;
    suggestion: string;
  }>;
}

interface QualityIssue {
  dimension: string;
  severity: "high" | "medium" | "low";
  description: string;
  suggestion: string;
}

interface QualityDashboardProps {
  qualityScore?: QualityScore;
  innovationScore?: InnovationScore;
  issues?: QualityIssue[];
}

export function QualityDashboard({
  qualityScore,
  innovationScore,
  issues = [],
}: QualityDashboardProps) {
  if (!qualityScore && !innovationScore) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">暂无质量评估数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Score Card */}
      {qualityScore && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              总体质量评分
            </CardTitle>
            <CardDescription>综合评估项目质量的各个维度</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">
                  {qualityScore.totalScore.toFixed(1)}
                </span>
                <Badge variant={getScoreBadgeVariant(qualityScore.totalScore)}>
                  {getScoreLabel(qualityScore.totalScore)}
                </Badge>
              </div>
              <Progress value={qualityScore.totalScore} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quality">质量评分</TabsTrigger>
          <TabsTrigger value="innovation">创新性</TabsTrigger>
          <TabsTrigger value="suggestions">改进建议</TabsTrigger>
        </TabsList>

        {/* Quality Scores Tab */}
        <TabsContent value="quality" className="space-y-4">
          {qualityScore && (
            <>
              <ScoreDimension
                label="完整性"
                score={qualityScore.completeness}
                description="内容的完整程度和必要元素的覆盖"
              />
              <ScoreDimension
                label="一致性"
                score={qualityScore.consistency}
                description="设定之间的逻辑一致性和连贯性"
              />
              <ScoreDimension
                label="丰富度"
                score={qualityScore.richness}
                description="内容的深度和细节的丰富程度"
              />
              <ScoreDimension
                label="可写性"
                score={qualityScore.writability}
                description="设定对实际写作的支持程度"
              />
              <ScoreDimension
                label="语义质量"
                score={qualityScore.semanticQuality}
                description="角色与冲突、世界观与冲突的语义对齐"
              />
            </>
          )}
        </TabsContent>

        {/* Innovation Scores Tab */}
        <TabsContent value="innovation" className="space-y-4">
          {innovationScore && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    创新性总分
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">
                      {innovationScore.overallInnovation.toFixed(1)}
                    </span>
                    <Badge
                      variant={getScoreBadgeVariant(innovationScore.overallInnovation)}
                    >
                      {getInnovationLabel(innovationScore.overallInnovation)}
                    </Badge>
                  </div>
                  <Progress value={innovationScore.overallInnovation} className="h-2 mt-2" />
                </CardContent>
              </Card>

              <ScoreDimension
                label="世界观独特性"
                score={innovationScore.worldUniqueness}
                description="世界设定的原创性和独特性"
                icon={<Lightbulb className="h-4 w-4" />}
              />
              <ScoreDimension
                label="角色复杂度"
                score={innovationScore.characterComplexity}
                description="角色设定的深度和复杂性"
                icon={<Lightbulb className="h-4 w-4" />}
              />
              <ScoreDimension
                label="冲突原创性"
                score={innovationScore.conflictOriginality}
                description="冲突设定的新颖性和吸引力"
                icon={<Lightbulb className="h-4 w-4" />}
              />

              {innovationScore.cliches && innovationScore.cliches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-600">
                      <AlertCircle className="h-5 w-5" />
                      检测到的俗套
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {innovationScore.cliches.map((cliche, index) => (
                      <Alert key={index} variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>{cliche.type}</AlertTitle>
                        <AlertDescription>
                          <p className="mb-2">{cliche.description}</p>
                          <p className="text-sm">
                            <strong>建议：</strong>
                            {cliche.suggestion}
                          </p>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          {issues.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">质量良好</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    未发现明显的质量问题
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {issues
                .filter((issue) => issue.severity === "high")
                .map((issue, index) => (
                  <IssueCard key={`high-${index}`} issue={issue} />
                ))}
              {issues
                .filter((issue) => issue.severity === "medium")
                .map((issue, index) => (
                  <IssueCard key={`medium-${index}`} issue={issue} />
                ))}
              {issues
                .filter((issue) => issue.severity === "low")
                .map((issue, index) => (
                  <IssueCard key={`low-${index}`} issue={issue} />
                ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Score Dimension Component
function ScoreDimension({
  label,
  score,
  description,
  icon,
}: {
  label: string;
  score: number;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-medium">{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{score.toFixed(1)}</span>
              {getScoreTrendIcon(score)}
            </div>
          </div>
          <Progress value={score} className="h-2" />
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Issue Card Component
function IssueCard({ issue }: { issue: QualityIssue }) {
  const severityConfig = {
    high: {
      variant: "destructive" as const,
      icon: <AlertCircle className="h-4 w-4" />,
      label: "高优先级",
    },
    medium: {
      variant: "default" as const,
      icon: <AlertCircle className="h-4 w-4" />,
      label: "中优先级",
    },
    low: {
      variant: "default" as const,
      icon: <AlertCircle className="h-4 w-4" />,
      label: "低优先级",
    },
  };

  const config = severityConfig[issue.severity];

  return (
    <Alert variant={config.variant}>
      {config.icon}
      <AlertTitle className="flex items-center justify-between">
        <span>{issue.dimension}</span>
        <Badge variant="outline">{config.label}</Badge>
      </AlertTitle>
      <AlertDescription>
        <p className="mb-2">{issue.description}</p>
        <p className="text-sm">
          <strong>建议：</strong>
          {issue.suggestion}
        </p>
      </AlertDescription>
    </Alert>
  );
}

// Helper functions
function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 80) return "default";
  if (score >= 60) return "secondary";
  return "destructive";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "优秀";
  if (score >= 80) return "良好";
  if (score >= 70) return "中等";
  if (score >= 60) return "及格";
  return "需改进";
}

function getInnovationLabel(score: number): string {
  if (score >= 80) return "非常创新";
  if (score >= 60) return "较为创新";
  if (score >= 40) return "一般";
  return "缺乏创新";
}

function getScoreTrendIcon(score: number) {
  if (score >= 80) {
    return <TrendingUp className="h-4 w-4 text-green-500" />;
  }
  if (score >= 60) {
    return <TrendingUp className="h-4 w-4 text-yellow-500" />;
  }
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}
