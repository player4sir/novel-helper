import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Eye, RotateCcw, GitCompare, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HistoryEntry {
  id: string;
  sessionId: string;
  step: string;
  candidateData: any;
  score: number;
  timestamp: string;
  metadata: any;
}

interface HistoryViewerProps {
  sessionId?: string;
  userId?: string;
}

export function HistoryViewer({ sessionId, userId }: HistoryViewerProps) {
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [compareEntries, setCompareEntries] = useState<HistoryEntry[]>([]);
  const { toast } = useToast();

  // Load session history
  const { data: sessionHistory, isLoading: sessionLoading } = useQuery({
    queryKey: ["/api/history/session", sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const res = await fetch(`/api/history/session/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session history");
      return res.json();
    },
    enabled: !!sessionId,
  });

  // Load user history
  const { data: userHistory, isLoading: userLoading } = useQuery({
    queryKey: ["/api/history/user", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/history/user/${userId}`);
      if (!res.ok) throw new Error("Failed to load user history");
      return res.json();
    },
    enabled: !!userId,
  });

  const handleViewDetails = (entry: HistoryEntry) => {
    setSelectedEntry(entry);
    setDetailsOpen(true);
  };

  const handleRestore = async (entry: HistoryEntry) => {
    try {
      const res = await fetch(`/api/history/${entry.id}/restore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to restore");

      toast({
        title: "恢复成功",
        description: "已恢复到该历史版本",
      });
    } catch (error: any) {
      toast({
        title: "恢复失败",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCompareToggle = (entry: HistoryEntry) => {
    if (compareEntries.find((e) => e.id === entry.id)) {
      setCompareEntries(compareEntries.filter((e) => e.id !== entry.id));
    } else if (compareEntries.length < 2) {
      setCompareEntries([...compareEntries, entry]);
    } else {
      toast({
        title: "最多选择2个",
        description: "最多只能同时比较2个版本",
        variant: "destructive",
      });
    }
  };

  if (sessionLoading || userLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                创建历史
              </CardTitle>
              <CardDescription>查看和恢复历史版本</CardDescription>
            </div>
            {compareEntries.length === 2 && (
              <Button
                variant="outline"
                onClick={() => setCompareMode(true)}
              >
                <GitCompare className="mr-2 h-4 w-4" />
                比较选中版本
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="session">
        <TabsList>
          <TabsTrigger value="session">当前会话</TabsTrigger>
          <TabsTrigger value="user">我的历史</TabsTrigger>
        </TabsList>

        <TabsContent value="session" className="space-y-2">
          {sessionHistory && sessionHistory.length > 0 ? (
            sessionHistory.map((entry: HistoryEntry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                onView={handleViewDetails}
                onRestore={handleRestore}
                onCompareToggle={handleCompareToggle}
                isSelected={compareEntries.some((e) => e.id === entry.id)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">暂无历史记录</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="user" className="space-y-2">
          {userHistory && userHistory.length > 0 ? (
            userHistory.map((entry: HistoryEntry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                onView={handleViewDetails}
                onRestore={handleRestore}
                onCompareToggle={handleCompareToggle}
                isSelected={compareEntries.some((e) => e.id === entry.id)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">暂无历史记录</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Details Dialog */}
      {selectedEntry && (
        <HistoryDetailsDialog
          entry={selectedEntry}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
        />
      )}

      {/* Compare Dialog */}
      {compareMode && compareEntries.length === 2 && (
        <CompareDialog
          entries={compareEntries}
          open={compareMode}
          onOpenChange={setCompareMode}
        />
      )}
    </div>
  );
}

// History Card Component
interface HistoryCardProps {
  entry: HistoryEntry;
  onView: (entry: HistoryEntry) => void;
  onRestore: (entry: HistoryEntry) => void;
  onCompareToggle: (entry: HistoryEntry) => void;
  isSelected: boolean;
}

function HistoryCard({
  entry,
  onView,
  onRestore,
  onCompareToggle,
  isSelected,
}: HistoryCardProps) {
  return (
    <Card className={isSelected ? "border-primary" : ""}>
      <CardContent className="pt-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge>{entry.step}</Badge>
              <Badge variant="outline">评分: {entry.score.toFixed(1)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(entry.timestamp).toLocaleString("zh-CN")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(entry)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRestore(entry)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onCompareToggle(entry)}
            >
              <GitCompare className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// History Details Dialog
interface HistoryDetailsDialogProps {
  entry: HistoryEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function HistoryDetailsDialog({
  entry,
  open,
  onOpenChange,
}: HistoryDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>历史详情</DialogTitle>
          <DialogDescription>
            {entry.step} - {new Date(entry.timestamp).toLocaleString("zh-CN")}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">评分信息</h3>
              <Badge variant="outline">总分: {entry.score.toFixed(1)}</Badge>
            </div>

            <div>
              <h3 className="font-semibold mb-2">生成内容</h3>
              <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                {JSON.stringify(entry.candidateData, null, 2)}
              </pre>
            </div>

            {entry.metadata && (
              <div>
                <h3 className="font-semibold mb-2">元数据</h3>
                <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Compare Dialog
interface CompareDialogProps {
  entries: HistoryEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CompareDialog({ entries, open, onOpenChange }: CompareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>版本比较</DialogTitle>
          <DialogDescription>对比两个历史版本的差异</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[600px]">
          <div className="grid grid-cols-2 gap-4">
            {entries.map((entry, index) => (
              <div key={entry.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">版本 {index + 1}</h3>
                  <div className="flex gap-2">
                    <Badge>{entry.step}</Badge>
                    <Badge variant="outline">评分: {entry.score.toFixed(1)}</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString("zh-CN")}
                </p>
                <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                  {JSON.stringify(entry.candidateData, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
