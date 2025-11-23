import { useQuery } from "@tanstack/react-query";
import { Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Character } from "@shared/schema";
import { CharacterDetailTabs } from "./CharacterDetailTabs.js";

const roleLabels = {
  protagonist: { label: "主角", variant: "default" as const, color: "bg-blue-500" },
  supporting: { label: "配角", variant: "secondary" as const, color: "bg-green-500" },
  antagonist: { label: "反派", variant: "destructive" as const, color: "bg-red-500" },
  group: { label: "群像", variant: "outline" as const, color: "bg-purple-500" },
};

interface CharacterDetailPanelProps {
  character: Character | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (character: Character) => void;
  onDelete: (characterId: string) => void;
  onAddArcPoint: (characterId: string) => void;
}

export function CharacterDetailPanel({
  character,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onAddArcPoint,
}: CharacterDetailPanelProps) {

  // Fetch state history
  const { data: stateHistoryData, isLoading: isLoadingHistory, error: historyError } = useQuery<{
    history: any[];
    total: number;
    limit: number;
    hasMore: boolean;
  }>({
    queryKey: ["/api/characters", character?.id, "state-history"],
    queryFn: async () => {
      if (!character?.id) return { history: [], total: 0, limit: 20, hasMore: false };
      const res = await fetch(`/api/characters/${character.id}/state-history`);
      if (!res.ok) throw new Error('Failed to fetch state history');
      return res.json();
    },
    enabled: !!character?.id && isOpen,
    retry: 1,
    staleTime: 30000, // 30秒内不重新获取
    gcTime: 5 * 60 * 1000, // 缓存5分钟
  });

  const stateHistory = stateHistoryData?.history || [];

  if (!isOpen || !character) return null;

  const roleConfig = roleLabels[character.role as keyof typeof roleLabels];

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:w-[600px] sm:max-w-[600px] p-0 flex flex-col">
        <>
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg ${roleConfig?.color} bg-opacity-20 flex-shrink-0`}>
                <div className={`h-5 w-5 ${roleConfig?.color.replace('bg-', 'text-')}`}>
                  <div className="w-full h-full rounded-sm bg-current opacity-70" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl font-semibold mb-1">
                  {character.name}
                </SheetTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={roleConfig?.variant || "outline"}>
                    {roleConfig?.label}
                  </Badge>
                  {(character.gender || character.age) && (
                    <span className="text-sm text-muted-foreground">
                      {character.gender}
                      {character.gender && character.age && " • "}
                      {character.age}
                    </span>
                  )}
                </div>
              </div>
            </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(character)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(character.id)}
                  className="flex items-center gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddArcPoint(character.id)}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  添加弧光点
                </Button>
              </div>
            </SheetHeader>

            {/* Content */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-4">
              <CharacterDetailTabs 
                character={character} 
                stateHistory={stateHistory}
                isLoadingHistory={isLoadingHistory}
                historyError={historyError}
              />
            </div>
          </ScrollArea>
        </>
      </SheetContent>
    </Sheet>
  );
}
