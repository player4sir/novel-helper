# AI 生成内容状态更新机制修复

## 问题分析

### 1. 查询失效不完整
**问题**：生成成功后只失效了 `chapters` 和 `projects` 查询，没有失效场景相关的查询。

**影响**：
- 场景详情面板不会自动刷新显示新生成的场景
- 用户需要手动刷新页面才能看到场景数据

### 2. 编辑器内容更新逻辑不当
**问题**：编辑器的 `useEffect` 依赖项包含 `chapter?.content`，但没有区分章节切换和内容更新。

**影响**：
- AI 生成后，如果用户有未保存的更改，内容不会自动刷新
- 可能覆盖用户正在编辑的内容

### 3. 缺少数据预取
**问题**：生成完成后没有预取场景和草稿数据。

**影响**：
- 用户切换到"场景"Tab 时需要等待数据加载
- 用户体验不够流畅

## 修复方案

### 1. 完善查询失效机制 ✅

**文件**：`client/src/components/write/generate-content-button.tsx`

**改进**：
```typescript
onSuccess: async (data) => {
  // 失效所有相关查询以确保数据同步
  await Promise.all([
    // 失效章节列表（更新字数统计）
    queryClient.invalidateQueries({ queryKey: ["/api/chapters", projectId] }),
    // 失效项目列表（更新总字数）
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] }),
    // 失效场景框架（显示新生成的场景）✨ 新增
    queryClient.invalidateQueries({ queryKey: ["/api/scene-frames", chapterId] }),
    // 失效今日统计 ✨ 新增
    queryClient.invalidateQueries({ queryKey: ["/api/statistics/today/summary"] }),
  ]);
}
```

**效果**：
- ✅ 场景详情面板自动刷新
- ✅ 今日统计自动更新
- ✅ 所有相关数据保持同步

### 2. 添加数据预取 ✅

**文件**：`client/src/components/write/generate-content-button.tsx`

**改进**：
```typescript
// 预取场景数据，提升场景面板加载速度
const scenes = await queryClient.fetchQuery({
  queryKey: ["/api/scene-frames", chapterId],
  queryFn: async () => {
    const res = await fetch(`/api/scene-frames/${chapterId}`);
    if (!res.ok) throw new Error("Failed to fetch scenes");
    return res.json();
  },
});

// 预取每个场景的草稿
if (scenes && scenes.length > 0) {
  await Promise.all(
    scenes.map((scene: any) =>
      queryClient.prefetchQuery({
        queryKey: ["/api/draft-chunks", scene.id],
        queryFn: async () => {
          const res = await fetch(`/api/draft-chunks/${scene.id}`);
          if (!res.ok) throw new Error("Failed to fetch drafts");
          return res.json();
        },
      })
    )
  );
}
```

**效果**：
- ✅ 用户切换到"场景"Tab 时数据已经加载完成
- ✅ 无需等待，即时显示
- ✅ 用户体验更流畅

### 3. 改进编辑器内容更新逻辑 ✅

**文件**：`client/src/components/write/editor-panel.tsx`

**改进**：
```typescript
// 使用 ref 追踪上一个章节 ID
const prevChapterIdRef = useRef<string | undefined>();

useEffect(() => {
  if (chapter) {
    const chapterIdChanged = prevChapterIdRef.current !== chapter.id;
    
    // 在以下情况更新内容：
    // 1. 章节 ID 变化（切换章节）- 强制更新
    // 2. 没有未保存更改 - 允许自动刷新
    if (chapterIdChanged || !hasChanges) {
      setTitle(chapter.title);
      setContent(chapter.content);
      setInitialWordCount(chapter.content?.replace(/\s/g, "").length || 0);
      
      // 如果是切换章节，重置 hasChanges
      if (chapterIdChanged) {
        setHasChanges(false);
      }
    }
    
    prevChapterIdRef.current = chapter.id;
  }
}, [chapter?.id, chapter?.content, chapter?.wordCount, hasChanges]);
```

**效果**：
- ✅ 切换章节时强制刷新内容
- ✅ AI 生成后，如果没有未保存更改，自动刷新
- ✅ 保护用户正在编辑的内容，避免意外覆盖

### 4. 优化场景详情面板 ✅

**文件**：`client/src/components/write/scene-details-panel.tsx`

**改进**：
```typescript
const { data: scenes, isLoading: scenesLoading, refetch } = useQuery<SceneFrame[]>({
  queryKey: ["/api/scene-frames", chapterId],
  queryFn: async () => {
    const res = await fetch(`/api/scene-frames/${chapterId}`);
    if (!res.ok) throw new Error("Failed to fetch scenes");
    return res.json();
  },
  enabled: !!chapterId,
  // 启用自动重新获取，确保数据始终最新 ✨ 新增
  refetchOnWindowFocus: true,
  // 数据保持新鲜 30 秒 ✨ 新增
  staleTime: 30000,
});
```

**效果**：
- ✅ 窗口获得焦点时自动刷新
- ✅ 数据保持新鲜，30 秒内不会重复请求
- ✅ 更好的用户体验

## 数据流图

```
AI 生成完成
    ↓
失效所有相关查询
    ├─ /api/chapters/:projectId
    ├─ /api/projects
    ├─ /api/scene-frames/:chapterId ✨
    └─ /api/statistics/today/summary ✨
    ↓
预取场景和草稿数据 ✨
    ├─ fetchQuery: /api/scene-frames/:chapterId
    └─ prefetchQuery: /api/draft-chunks/:sceneId (每个场景)
    ↓
React Query 自动重新获取数据
    ├─ 章节列表更新（字数统计）
    ├─ 编辑器内容更新（如果没有未保存更改）
    ├─ 场景详情面板更新（显示新场景）
    └─ 今日统计更新
    ↓
UI 自动刷新
```

## 测试场景

### 场景 1：生成新章节内容
1. ✅ 选择一个空章节
2. ✅ 点击"AI生成内容"
3. ✅ 等待生成完成
4. ✅ 验证：编辑器自动显示新内容
5. ✅ 验证：切换到"场景"Tab，立即显示场景列表
6. ✅ 验证：章节侧边栏显示更新的字数

### 场景 2：用户正在编辑时生成完成
1. ✅ 用户在编辑器中输入内容（未保存）
2. ✅ 另一个窗口触发 AI 生成
3. ✅ 验证：编辑器内容不会被覆盖
4. ✅ 验证：用户保存后，可以看到最新内容

### 场景 3：切换章节
1. ✅ 选择章节 A
2. ✅ 切换到章节 B
3. ✅ 验证：编辑器立即显示章节 B 的内容
4. ✅ 验证：场景面板显示章节 B 的场景

## 性能优化

### 1. 并行失效查询
使用 `Promise.all` 并行失效多个查询，减少等待时间。

### 2. 数据预取
在生成完成后立即预取场景和草稿数据，用户切换 Tab 时无需等待。

### 3. 智能缓存
- 场景数据保持新鲜 30 秒
- 窗口获得焦点时自动刷新
- 避免不必要的重复请求

## 最佳实践

### 1. 查询失效
✅ **DO**：失效所有相关查询，确保数据一致性
❌ **DON'T**：只失效部分查询，导致数据不同步

### 2. 数据预取
✅ **DO**：在用户可能需要数据之前预取
❌ **DON'T**：等到用户请求时才加载

### 3. 编辑器更新
✅ **DO**：区分章节切换和内容更新
❌ **DON'T**：无条件更新，覆盖用户输入

### 4. 用户体验
✅ **DO**：提供即时反馈和流畅的过渡
❌ **DON'T**：让用户等待或手动刷新

## 总结

通过这次修复，我们实现了：

1. ✅ **完整的数据同步**：所有相关查询都会在生成后自动失效和刷新
2. ✅ **智能的内容更新**：保护用户输入，同时确保数据最新
3. ✅ **流畅的用户体验**：数据预取，无需等待
4. ✅ **健壮的错误处理**：使用 Promise.all 和 async/await

这些改进遵循了 React Query 的最佳实践，确保了应用的数据一致性和用户体验。
