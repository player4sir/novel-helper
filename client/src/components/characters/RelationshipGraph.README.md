# 角色关系图谱组件

## 概述

提供两个关系可视化组件，用于展示角色之间的关系网络：

1. **RelationshipGraph** - 完整的交互式关系图谱
2. **RelationshipGraphCompact** - 紧凑的列表式关系视图

## 组件

### RelationshipGraph

完整的力导向图布局关系图谱，支持缩放、平移和交互。

#### 特性

- 🎨 力导向布局自动调整节点位置
- 🔍 支持缩放和平移
- 🖱️ 交互式节点和边
- 📊 实时显示关系信息
- 🎯 7种关系类型支持
- 📱 响应式设计

#### 使用方法

```tsx
import { RelationshipGraph } from "@/components/characters/RelationshipGraph";

function MyComponent() {
  const characters = [
    { name: "李明", role: "protagonist" },
    { name: "王雪", role: "supporting" },
    { name: "赵无极", role: "antagonist" },
  ];

  const relationships = [
    {
      from: "李明",
      to: "赵无极",
      type: "enemy",
      description: "家族仇恨",
      strength: 0.95,
    },
    {
      from: "李明",
      to: "王雪",
      type: "ally",
      description: "互相帮助",
      strength: 0.7,
    },
  ];

  return (
    <RelationshipGraph
      characters={characters}
      relationships={relationships}
      onNodeClick={(name) => console.log("Clicked:", name)}
      onEdgeClick={(rel) => console.log("Relationship:", rel)}
    />
  );
}
```

#### Props

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `characters` | `Character[]` | ✅ | 角色列表 |
| `relationships` | `Relationship[]` | ✅ | 关系列表 |
| `onNodeClick` | `(name: string) => void` | ❌ | 节点点击回调 |
| `onEdgeClick` | `(rel: Relationship) => void` | ❌ | 边点击回调 |

#### 交互操作

- **拖拽** - 平移视图
- **缩放按钮** - 放大/缩小
- **重置视图** - 恢复默认视图
- **重置布局** - 重新排列节点
- **点击节点** - 选中角色
- **悬停边** - 显示关系详情

### RelationshipGraphCompact

紧凑的列表式关系视图，适合侧边栏或详情面板。

#### 特性

- 📋 列表式布局
- 🎯 以单个角色为中心
- 📊 显示关系方向和强度
- 💡 悬停提示详细信息
- 🎨 角色类型颜色区分

#### 使用方法

```tsx
import { RelationshipGraphCompact } from "@/components/characters/RelationshipGraphCompact";

function CharacterDetailPanel({ characterName }) {
  return (
    <RelationshipGraphCompact
      focusCharacter={characterName}
      characters={characters}
      relationships={relationships}
      onCharacterClick={(name) => setSelectedCharacter(name)}
    />
  );
}
```

#### Props

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `focusCharacter` | `string` | ✅ | 焦点角色名称 |
| `characters` | `Character[]` | ✅ | 角色列表 |
| `relationships` | `Relationship[]` | ✅ | 关系列表 |
| `onCharacterClick` | `(name: string) => void` | ❌ | 角色点击回调 |

## 数据类型

### Character

```typescript
interface Character {
  name: string;
  role: "protagonist" | "supporting" | "antagonist";
}
```

### Relationship

```typescript
interface Relationship {
  from: string;        // 起始角色名
  to: string;          // 目标角色名
  type: RelationType;  // 关系类型
  description: string; // 关系描述
  strength: number;    // 关系强度 (0-1)
}

type RelationType = 
  | "ally"      // 盟友
  | "enemy"     // 敌对
  | "mentor"    // 师徒
  | "romantic"  // 爱慕
  | "family"    // 亲属
  | "rival"     // 竞争
  | "neutral";  // 中立
```

## 关系类型

| 类型 | 图标 | 颜色 | 说明 |
|------|------|------|------|
| `ally` | 🤝 | 绿色 | 盟友关系，共同目标 |
| `enemy` | ⚔️ | 红色 | 敌对关系，目标对立 |
| `mentor` | 📚 | 紫色 | 师徒关系，传授学习 |
| `romantic` | 💕 | 粉色 | 爱慕关系，情感联系 |
| `family` | 👨‍👩‍👧 | 琥珀色 | 亲属关系，血缘联系 |
| `rival` | 🏆 | 橙色 | 竞争关系，良性竞争 |
| `neutral` | 🤷 | 灰色 | 中立关系，关系较弱 |

## 角色类型

| 类型 | 标签 | 颜色 | 节点大小 |
|------|------|------|----------|
| `protagonist` | 主角 | 蓝色 | 50px |
| `supporting` | 配角 | 绿色 | 40px |
| `antagonist` | 反派 | 红色 | 45px |

## 集成示例

### 在角色详情页中使用

```tsx
import { RelationshipGraphCompact } from "@/components/characters/RelationshipGraphCompact";

function CharacterDetailPage({ characterId }) {
  const { data: character } = useCharacter(characterId);
  const { data: relationships } = useRelationships(characterId);
  const { data: allCharacters } = useCharacters();

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2">
        {/* 角色详情 */}
      </div>
      <div>
        <RelationshipGraphCompact
          focusCharacter={character.name}
          characters={allCharacters}
          relationships={relationships}
          onCharacterClick={(name) => navigate(`/characters/${name}`)}
        />
      </div>
    </div>
  );
}
```

### 在项目概览页中使用

```tsx
import { RelationshipGraph } from "@/components/characters/RelationshipGraph";

function ProjectOverview({ projectId }) {
  const { data: characters } = useCharacters(projectId);
  const { data: relationships } = useRelationships(projectId);

  return (
    <div className="space-y-6">
      <h1>项目概览</h1>
      
      <RelationshipGraph
        characters={characters}
        relationships={relationships}
        onNodeClick={(name) => {
          // 打开角色详情对话框
          openCharacterDialog(name);
        }}
        onEdgeClick={(rel) => {
          // 显示关系详情
          showRelationshipDetails(rel);
        }}
      />
    </div>
  );
}
```

### 与CreationOrchestrator集成

```tsx
import { RelationshipGraph } from "@/components/characters/RelationshipGraph";

function StepwiseCreationWizard({ sessionId }) {
  const { data: stepResult } = useStepResult(sessionId, "characters");

  if (!stepResult) return null;

  const { characters, relationships } = stepResult.data;

  return (
    <div className="space-y-6">
      <h2>角色生成结果</h2>
      
      {/* 显示关系图谱 */}
      <RelationshipGraph
        characters={characters}
        relationships={relationships}
        onNodeClick={(name) => {
          // 允许用户编辑角色
          editCharacter(name);
        }}
      />

      {/* 操作按钮 */}
      <div className="flex gap-4">
        <Button onClick={() => regenerateStep()}>
          重新生成
        </Button>
        <Button onClick={() => nextStep()}>
          下一步
        </Button>
      </div>
    </div>
  );
}
```

## 样式定制

组件使用Tailwind CSS和shadcn/ui，可以通过以下方式定制：

### 修改颜色主题

编辑组件内的配置对象：

```typescript
const relationshipConfig = {
  ally: { color: "#10b981", label: "盟友", strokeWidth: 2 },
  // ... 修改其他类型
};

const roleConfig = {
  protagonist: { color: "#3b82f6", label: "主角", size: 50 },
  // ... 修改其他角色
};
```

### 调整布局参数

在`RelationshipGraph`组件中修改力导向参数：

```typescript
// 斥力强度
const force = 5000 / (dist * dist);

// 引力强度
const force = dist * 0.01 * rel.strength;

// 中心引力
fx += (centerX - pos.x) * 0.01;
```

## 性能优化

- 使用`memo`避免不必要的重渲染
- 力导向布局使用`setInterval`而非`requestAnimationFrame`以降低CPU使用
- 大量节点时考虑使用虚拟化或分页

## 浏览器兼容性

- ✅ Chrome/Edge (推荐)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE11 (需要polyfill)

## 已知限制

1. 节点数量超过50个时性能可能下降
2. 移动端触摸操作支持有限
3. 不支持曲线边（仅直线）

## 未来改进

- [ ] 支持分组和层级
- [ ] 添加动画过渡
- [ ] 支持导出为图片
- [ ] 添加搜索和过滤
- [ ] 支持自定义节点样式
- [ ] 移动端优化

## 相关文档

- [RelationshipInferrer Service](../../../server/relationship-inferrer.README.md)
- [CharacterGenerator Service](../../../server/character-generator.ts)
- [Design Document](../../../.kiro/specs/project-creation-enhancement/design.md)
