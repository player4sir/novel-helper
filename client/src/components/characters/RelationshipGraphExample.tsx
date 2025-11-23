import { useState } from "react";
import { RelationshipGraph } from "./RelationshipGraph";
import { RelationshipGraphCompact } from "./RelationshipGraphCompact";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Example data
const exampleCharacters = [
  { name: "李明", role: "protagonist" as const },
  { name: "王雪", role: "supporting" as const },
  { name: "赵无极", role: "antagonist" as const },
  { name: "林风", role: "supporting" as const },
];

const exampleRelationships = [
  {
    from: "李明",
    to: "赵无极",
    type: "enemy" as const,
    description: "李明为家族复仇，赵无极是灭门仇人，两人目标完全对立",
    strength: 0.95,
  },
  {
    from: "李明",
    to: "王雪",
    type: "ally" as const,
    description: "王雪帮助李明寻找真相，李明协助王雪治疗父亲",
    strength: 0.7,
  },
  {
    from: "李明",
    to: "王雪",
    type: "romantic" as const,
    description: "在共同冒险中产生感情，但受到家族恩怨的阻碍",
    strength: 0.6,
  },
  {
    from: "王雪",
    to: "赵无极",
    type: "neutral" as const,
    description: "王雪为救父亲可能暂时与赵无极合作，但内心不认同其理念",
    strength: 0.4,
  },
  {
    from: "赵无极",
    to: "李明",
    type: "rival" as const,
    description: "赵无极欣赏李明的天赋，但两人理念对立",
    strength: 0.8,
  },
  {
    from: "林风",
    to: "李明",
    type: "mentor" as const,
    description: "林风是李明的师父，传授剑术和人生智慧",
    strength: 0.85,
  },
];

export function RelationshipGraphExample() {
  const [selectedCharacter, setSelectedCharacter] = useState<string>("李明");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">角色关系图谱示例</h1>
        <p className="text-muted-foreground">
          展示角色之间的关系网络，支持交互和可视化
        </p>
      </div>

      <Tabs defaultValue="full" className="w-full">
        <TabsList>
          <TabsTrigger value="full">完整图谱</TabsTrigger>
          <TabsTrigger value="compact">紧凑视图</TabsTrigger>
        </TabsList>

        <TabsContent value="full" className="mt-6">
          <RelationshipGraph
            characters={exampleCharacters}
            relationships={exampleRelationships}
            onNodeClick={(name) => {
              console.log("Clicked node:", name);
              setSelectedCharacter(name);
            }}
            onEdgeClick={(rel) => {
              console.log("Clicked edge:", rel);
            }}
          />
        </TabsContent>

        <TabsContent value="compact" className="mt-6">
          <div className="max-w-md mx-auto">
            <RelationshipGraphCompact
              focusCharacter={selectedCharacter}
              characters={exampleCharacters}
              relationships={exampleRelationships}
              onCharacterClick={(name) => {
                console.log("Clicked character:", name);
                setSelectedCharacter(name);
              }}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Usage instructions */}
      <div className="mt-8 p-6 bg-muted/50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">使用说明</h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">完整图谱 (RelationshipGraph)</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>力导向布局，自动调整节点位置</li>
              <li>支持缩放和平移</li>
              <li>点击节点查看角色详情</li>
              <li>悬停边查看关系描述</li>
              <li>不同颜色表示不同关系类型</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">紧凑视图 (RelationshipGraphCompact)</h3>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>以单个角色为中心展示关系</li>
              <li>列表形式，适合侧边栏或详情面板</li>
              <li>显示关系方向和强度</li>
              <li>点击相关角色切换焦点</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">集成示例</h3>
            <pre className="bg-background p-4 rounded-lg overflow-x-auto">
{`import { RelationshipGraph } from "@/components/characters/RelationshipGraph";

<RelationshipGraph
  characters={characters}
  relationships={relationships}
  onNodeClick={(name) => console.log(name)}
  onEdgeClick={(rel) => console.log(rel)}
/>`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
