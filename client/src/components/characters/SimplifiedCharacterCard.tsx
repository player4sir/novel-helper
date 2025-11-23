import { memo } from "react";
import { Edit, Trash2, Sparkles, Users, Zap, BookOpen, Heart, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Character } from "@shared/schema";

const roleLabels = {
  protagonist: { label: "主角", variant: "default" as const, color: "bg-blue-500", icon: Sparkles },
  supporting: { label: "配角", variant: "secondary" as const, color: "bg-green-500", icon: Users },
  antagonist: { label: "反派", variant: "destructive" as const, color: "bg-red-500", icon: Zap },
  group: { label: "群像", variant: "outline" as const, color: "bg-purple-500", icon: BookOpen },
};

interface SimplifiedCharacterCardProps {
  character: Character;
  onCardClick: (characterId: string) => void;
  onEdit: (character: Character) => void;
  onDelete: (characterId: string) => void;
}

export const SimplifiedCharacterCard = memo(function SimplifiedCharacterCard({
  character,
  onCardClick,
  onEdit,
  onDelete,
}: SimplifiedCharacterCardProps) {
  const roleConfig = roleLabels[character.role as keyof typeof roleLabels];
  const RoleIcon = roleConfig?.icon;

  return (
    <Card 
      className="group min-h-[180px] hover:shadow-lg transition-all duration-200 border-border hover:border-primary/20 flex flex-col cursor-pointer overflow-hidden"
      data-testid={`character-card-${character.id}`}
      onClick={() => onCardClick(character.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Role Icon */}
            <div className={`p-2 rounded-lg ${roleConfig?.color} bg-opacity-10 flex-shrink-0`}>
              {RoleIcon && <RoleIcon className={`h-5 w-5 ${roleConfig?.color.replace('bg-', 'text-')}`} />}
            </div>
            
            {/* Name and Role */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold truncate mb-1.5" title={character.name}>
                {character.name}
              </h3>
              <Badge variant={roleConfig?.variant || "outline"} className="text-xs">
                {roleConfig?.label}
              </Badge>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(character);
              }}
              aria-label="编辑"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(character.id);
              }}
              aria-label="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 pt-0 pb-4 flex flex-col gap-2">
        {/* Status Indicators - 最多显示3个 */}
        <div className="flex flex-wrap gap-1.5">
          {/* Priority 1: Current Goal (更重要) */}
          {character.currentGoal && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1 max-w-[140px]">
              <Target className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{character.currentGoal}</span>
            </Badge>
          )}
          
          {/* Priority 2: Current Emotion (如果没有goal才显示) */}
          {!character.currentGoal && character.currentEmotion && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1 max-w-[140px]">
              <Heart className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{character.currentEmotion}</span>
            </Badge>
          )}
          
          {/* Priority 3: Mention Count */}
          {character.mentionCount && character.mentionCount > 0 && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {character.mentionCount}
            </Badge>
          )}
          
          {/* Priority 4: Arc Points Count */}
          {(() => {
            const arcPoints = character.arcPoints as unknown as string[] | null;
            const count = arcPoints?.length || 0;
            return count > 0 ? (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                {count}
              </Badge>
            ) : null;
          })()}
        </div>

        {/* Personality */}
        {character.personality && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {character.personality}
          </p>
        )}
      </CardContent>
    </Card>
  );
});
