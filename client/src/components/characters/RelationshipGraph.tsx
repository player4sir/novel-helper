import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw } from "lucide-react";
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

interface RelationshipGraphProps {
  characters: Character[];
  relationships: Relationship[];
  onNodeClick?: (characterName: string) => void;
  onEdgeClick?: (relationship: Relationship) => void;
}

// Node position for force-directed layout
interface NodePosition {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Relationship type configurations
const relationshipConfig = {
  ally: { color: "#10b981", label: "盟友", strokeWidth: 2 },
  enemy: { color: "#ef4444", label: "敌对", strokeWidth: 3 },
  mentor: { color: "#8b5cf6", label: "师徒", strokeWidth: 2 },
  romantic: { color: "#ec4899", label: "爱慕", strokeWidth: 2 },
  family: { color: "#f59e0b", label: "亲属", strokeWidth: 2 },
  rival: { color: "#f97316", label: "竞争", strokeWidth: 2 },
  neutral: { color: "#6b7280", label: "中立", strokeWidth: 1 },
};

// Role configurations
const roleConfig = {
  protagonist: { color: "#3b82f6", label: "主角", size: 50 },
  supporting: { color: "#10b981", label: "配角", size: 40 },
  antagonist: { color: "#ef4444", label: "反派", size: 45 },
};

export const RelationshipGraph = memo(function RelationshipGraph({
  characters,
  relationships,
  onNodeClick,
  onEdgeClick,
}: RelationshipGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<Relationship | null>(null);

  // Initialize node positions
  useEffect(() => {
    const positions = new Map<string, NodePosition>();
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) / 3;

    characters.forEach((char, index) => {
      const angle = (index / characters.length) * 2 * Math.PI;
      positions.set(char.name, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    setNodePositions(positions);
  }, [characters, dimensions]);

  // Force-directed layout simulation
  useEffect(() => {
    if (nodePositions.size === 0) return;

    const interval = setInterval(() => {
      setNodePositions((prev) => {
        const newPositions = new Map(prev);
        const alpha = 0.3; // Cooling factor

        // Apply forces
        newPositions.forEach((pos, name) => {
          let fx = 0;
          let fy = 0;

          // Repulsion between nodes
          newPositions.forEach((otherPos, otherName) => {
            if (name === otherName) return;
            const dx = pos.x - otherPos.x;
            const dy = pos.y - otherPos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 5000 / (dist * dist);
            fx += (dx / dist) * force;
            fy += (dy / dist) * force;
          });

          // Attraction along edges
          relationships.forEach((rel) => {
            if (rel.from === name) {
              const target = newPositions.get(rel.to);
              if (target) {
                const dx = target.x - pos.x;
                const dy = target.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = dist * 0.01 * rel.strength;
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
              }
            }
            if (rel.to === name) {
              const source = newPositions.get(rel.from);
              if (source) {
                const dx = source.x - pos.x;
                const dy = source.y - pos.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = dist * 0.01 * rel.strength;
                fx += (dx / dist) * force;
                fy += (dy / dist) * force;
              }
            }
          });

          // Center gravity
          const centerX = dimensions.width / 2;
          const centerY = dimensions.height / 2;
          fx += (centerX - pos.x) * 0.01;
          fy += (centerY - pos.y) * 0.01;

          // Update velocity and position
          pos.vx = (pos.vx + fx) * alpha;
          pos.vy = (pos.vy + fy) * alpha;
          pos.x += pos.vx;
          pos.y += pos.vy;

          // Boundary constraints
          const margin = 50;
          pos.x = Math.max(margin, Math.min(dimensions.width - margin, pos.x));
          pos.y = Math.max(margin, Math.min(dimensions.height - margin, pos.y));
        });

        return newPositions;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [nodePositions.size, relationships, dimensions]);

  // Handle container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width: width || 800, height: height || 600 });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Zoom handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.2, 0.5));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Reset layout
  const handleResetLayout = () => {
    const positions = new Map<string, NodePosition>();
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.min(dimensions.width, dimensions.height) / 3;

    characters.forEach((char, index) => {
      const angle = (index / characters.length) * 2 * Math.PI;
      positions.set(char.name, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      });
    });

    setNodePositions(positions);
  };

  return (
    <Card className="w-full h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">角色关系图谱</CardTitle>
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>放大</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>缩小</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleResetView}>
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>重置视图</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={handleResetLayout}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>重置布局</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div
          ref={containerRef}
          className="relative w-full h-[600px] bg-muted/20 overflow-hidden cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            width={dimensions.width}
            height={dimensions.height}
            className="absolute inset-0"
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Draw edges */}
              {relationships.map((rel, index) => {
                const fromPos = nodePositions.get(rel.from);
                const toPos = nodePositions.get(rel.to);
                if (!fromPos || !toPos) return null;

                const config = relationshipConfig[rel.type];
                const isHovered = hoveredEdge === rel;

                return (
                  <g key={`edge-${index}`}>
                    <line
                      x1={fromPos.x}
                      y1={fromPos.y}
                      x2={toPos.x}
                      y2={toPos.y}
                      stroke={config.color}
                      strokeWidth={config.strokeWidth * (isHovered ? 1.5 : 1)}
                      strokeOpacity={isHovered ? 0.9 : 0.6}
                      markerEnd="url(#arrowhead)"
                      className="cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredEdge(rel)}
                      onMouseLeave={() => setHoveredEdge(null)}
                      onClick={() => onEdgeClick?.(rel)}
                    />
                    {/* Edge label */}
                    {isHovered && (
                      <text
                        x={(fromPos.x + toPos.x) / 2}
                        y={(fromPos.y + toPos.y) / 2}
                        fill={config.color}
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        className="pointer-events-none"
                      >
                        {config.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Draw nodes */}
              {characters.map((char) => {
                const pos = nodePositions.get(char.name);
                if (!pos) return null;

                const config = roleConfig[char.role];
                const isSelected = selectedNode === char.name;

                return (
                  <g
                    key={char.name}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={() => {
                      setSelectedNode(char.name);
                      onNodeClick?.(char.name);
                    }}
                  >
                    {/* Node circle */}
                    <circle
                      r={config.size / 2}
                      fill={config.color}
                      stroke={isSelected ? "#fff" : config.color}
                      strokeWidth={isSelected ? 4 : 2}
                      opacity={0.9}
                      className="transition-all hover:opacity-100"
                    />
                    {/* Node label */}
                    <text
                      y={config.size / 2 + 20}
                      fill="currentColor"
                      fontSize="14"
                      fontWeight="600"
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      {char.name}
                    </text>
                    {/* Role badge */}
                    <text
                      y={config.size / 2 + 35}
                      fill="currentColor"
                      fontSize="11"
                      opacity={0.7}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                    >
                      {config.label}
                    </text>
                  </g>
                );
              })}

              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="currentColor" opacity="0.6" />
                </marker>
              </defs>
            </g>
          </svg>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
            <div className="text-sm font-semibold mb-2">关系类型</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(relationshipConfig).map(([type, config]) => (
                <div key={type} className="flex items-center gap-2">
                  <div
                    className="w-4 h-0.5"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{config.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hovered edge info */}
          {hoveredEdge && (
            <div className="absolute top-4 right-4 bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg max-w-xs">
              <div className="text-sm font-semibold mb-1">
                {hoveredEdge.from} → {hoveredEdge.to}
              </div>
              <Badge variant="outline" className="mb-2">
                {relationshipConfig[hoveredEdge.type].label}
              </Badge>
              <p className="text-xs text-muted-foreground">
                {hoveredEdge.description}
              </p>
              <div className="text-xs text-muted-foreground mt-2">
                强度: {(hoveredEdge.strength * 100).toFixed(0)}%
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
