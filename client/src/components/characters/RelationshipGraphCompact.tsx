import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Types
interface Character {
  name: string;
  role: "protagonist" | "supporting" | "antagonist";
}

interface Relationship {
  from: string;
  to: string;
  type: "ally" | "enemy" | "mentor" | "romantic" | "family" | "rival" | "neutral";
  description: string;
  strength: number;
}

interface RelationshipGraphCompactProps {
  focusCharacter: string;
  characters: Character[];
  relationships: Relationship[];
  onCharacterClick?: (characterName: string) => void;
}

// Relationship type configurations
const relationshipConfig = {
  ally: { color: "bg-green-500", textColor: "text-green-700", label: "盟友", icon: "🤝" },
  enemy: { color: "bg-red-500", textColor: "text-red-700", label: "敌对", icon: "⚔️" },
  mentor: { color: "bg-purple-500", textColor: "text-purple-700", label: "师徒", icon: "📚" },
  romantic: { color: "bg-pink-500", textColor: "text-pink-700", label: "爱慕", icon: "💕" },
  family: { color: "bg-amber-500", textColor: "text-amber-700", label: "亲属", icon: "👨‍👩‍👧" },
  rival: { color: "bg-orange-500", textColor: "text-orange-700", label: "竞争", icon: "🏆" },
  neutral: { color: "bg-gray-500", textColor: "text-gray-700", label: "中立", icon: "🤷" },
};

// Role configurations
const roleConfig = {
  protagonist: { color: "bg-blue-100 border-blue-300", label: "主角" },
  supporting: { color: "bg-green-100 border-green-300", label: "配角" },
  antagonist: { color: "bg-red-100 border-red-300", label: "反派" },
};

export const RelationshipGraphCompact = memo(function RelationshipGraphCompact({
  focusCharacter,
  characters,
  relationships,
  onCharacterClick,
}: RelationshipGraphCompactProps) {
  // Get relationships involving the focus character
  const relevantRelationships = relationships.filter(
    (rel) => rel.from === focusCharacter || rel.to === focusCharacter
  );

  // Get related characters
  const relatedCharacterNames = new Set<string>();
  relevantRelationships.forEach((rel) => {
    if (rel.from === focusCharacter) relatedCharacterNames.add(rel.to);
    if (rel.to === focusCharacter) relatedCharacterNames.add(rel.from);
  });

  const relatedCharacters = characters.filter((char) =>
    relatedCharacterNames.has(char.name)
  );

  if (relevantRelationships.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">角色关系</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">暂无关系信息</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">角色关系</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Focus character */}
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border-2 border-primary">
            <span className="font-semibold">{focusCharacter}</span>
          </div>
        </div>

        {/* Relationships */}
        <div className="space-y-2">
          {relatedCharacters.map((char) => {
            // Find relationship
            const outgoing = relevantRelationships.find(
              (rel) => rel.from === focusCharacter && rel.to === char.name
            );
            const incoming = relevantRelationships.find(
              (rel) => rel.from === char.name && rel.to === focusCharacter
            );

            const relationship = outgoing || incoming;
            if (!relationship) return null;

            const config = relationshipConfig[relationship.type];
            const roleConf = roleConfig[char.role];
            const isOutgoing = relationship.from === focusCharacter;

            return (
              <TooltipProvider key={char.name}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 ${roleConf.color} cursor-pointer hover:shadow-md transition-all`}
                      onClick={() => onCharacterClick?.(char.name)}
                    >
                      {/* Direction indicator */}
                      <div className="flex-shrink-0 text-lg">
                        {isOutgoing ? "→" : "←"}
                      </div>

                      {/* Character info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{char.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {roleConf.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{config.icon}</span>
                          <span className={`text-xs font-medium ${config.textColor}`}>
                            {config.label}
                          </span>
                          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full ${config.color}`}
                              style={{ width: `${relationship.strength * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="text-sm">{relationship.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      关系强度: {(relationship.strength * 100).toFixed(0)}%
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-3 border-t">
          <div className="text-xs text-muted-foreground mb-2">关系类型</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(relationshipConfig).map(([type, config]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs">
                <span>{config.icon}</span>
                <span className={config.textColor}>{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
