# Requirements Document

## Introduction

本文档定义了小说项目创建功能的增强需求。当前系统虽然实现了基于AI的项目创建，但在用户体验、灵活性、质量控制和创新性方面存在明显不足。本需求旨在系统性地改进项目创建流程，使其更加智能、灵活和用户友好。

## Glossary

- **System**: 小说创作应用系统
- **User**: 使用系统创作小说的作者
- **Project**: 一个完整的小说项目，包含元数据、角色、世界观、大纲等
- **Seed**: 用户提供的初始创意输入，包括标题、简介、类型等
- **Candidate**: AI生成的项目元数据候选方案
- **Meta**: 项目元数据，包括标题、简介、角色、冲突、世界规则等
- **Entity**: 角色实体，包括主角、配角、反派
- **World Setting**: 世界观设定，包括力量体系、势力、地理等
- **Outline**: 大纲，包括总纲、卷纲、章纲
- **Template**: 项目创建模板，预设的类型化配置
- **Session**: 创建会话，记录用户的创建过程和状态

## Requirements

### Requirement 1: 渐进式项目创建流程

**User Story:** 作为作者，我希望能够分步骤创建项目，在每个阶段查看和调整AI生成的内容，以便更好地控制项目质量。

#### Acceptance Criteria

1. WHEN User启动项目创建 THEN System SHALL提供"快速创建"和"分步创建"两种模式选择
2. WHEN User选择分步创建模式 THEN System SHALL按照"基础信息→角色生成→世界观生成→大纲生成"的顺序引导User
3. WHEN System完成每个步骤的AI生成 THEN System SHALL展示生成结果并允许User编辑或重新生成
4. WHEN User在任意步骤点击"重新生成" THEN System SHALL使用不同的随机种子重新调用AI生成
5. WHEN User在分步创建过程中关闭页面 THEN System SHALL保存当前进度到Session
6. WHEN User重新打开未完成的创建会话 THEN System SHALL恢复到上次的步骤和数据

### Requirement 2: 智能角色生成与关系网络

**User Story:** 作为作者，我希望AI能生成具有深度和复杂关系的角色，并自动构建角色关系网络，以便创作出更有张力的故事。

#### Acceptance Criteria

1. WHEN System生成角色 THEN System SHALL为每个角色生成性格、外貌、背景、能力、动机、内心冲突和隐藏目标
2. WHEN System生成多个角色 THEN System SHALL基于角色设定和故事冲突自动推断角色间的关系类型
3. WHEN System推断角色关系 THEN System SHALL考虑角色定位、动机冲突、背景联系和情节需求
4. WHEN System生成主角 THEN System SHALL确保主角具有明确的成长路径和至少一个内心冲突
5. WHEN System生成反派 THEN System SHALL确保反派具有合理的动机而非单纯的邪恶
6. WHEN User查看角色关系 THEN System SHALL以可视化图谱形式展示角色关系网络

### Requirement 3: 类型化世界观生成

**User Story:** 作为作者，我希望系统能根据小说类型生成符合该类型特点的世界观设定，以便快速建立完整的世界框架。

#### Acceptance Criteria

1. WHEN System生成世界观 THEN System SHALL根据Project的类型标签选择对应的世界观模板
2. WHEN Project类型为玄幻或仙侠 THEN System SHALL生成力量体系、修炼等级、门派势力和修炼资源
3. WHEN Project类型为都市或现实 THEN System SHALL生成社会结构、职业体系、地理位置和社会规则
4. WHEN Project类型为科幻 THEN System SHALL生成科技体系、星际势力、物理规则和未来设定
5. WHEN System生成世界规则 THEN System SHALL确保规则之间的逻辑一致性和可扩展性
6. WHEN System检测到世界规则冲突 THEN System SHALL标记冲突并提供修正建议

### Requirement 4: 创新性智能评估

**User Story:** 作为作者，我希望系统能智能评估我的创意是否落入俗套，并提供创新性建议，以便创作出更有特色的作品。

#### Acceptance Criteria

1. WHEN System评估Project创新性 THEN System SHALL检测常见陈词滥调模式并计算创新性分数
2. WHEN System检测到陈词滥调 THEN System SHALL标注具体的俗套类型和出现位置
3. WHEN System发现俗套设定 THEN System SHALL提供至少3个创新性替代建议
4. WHEN System评估世界观创新性 THEN System SHALL检查规则体系是否具有独特性
5. WHEN System评估角色创新性 THEN System SHALL检查角色动机和性格是否复杂且非典型
6. WHEN System评估冲突创新性 THEN System SHALL检查冲突结构是否超越常见模式

### Requirement 5: 项目创建模板系统

**User Story:** 作为作者，我希望能保存和复用成功的项目配置作为模板，以便快速创建类似风格的新项目。

#### Acceptance Criteria

1. WHEN User完成项目创建 THEN System SHALL提供"保存为模板"选项
2. WHEN User保存项目为模板 THEN System SHALL提取Project的类型、风格、角色结构、世界观框架作为模板数据
3. WHEN User创建新项目 THEN System SHALL展示可用的模板列表供User选择
4. WHEN User选择模板创建项目 THEN System SHALL使用模板的配置参数但生成新的具体内容
5. WHEN User查看模板 THEN System SHALL显示模板的预览信息和使用次数
6. WHEN User删除模板 THEN System SHALL确认删除操作且不影响已创建的Project

### Requirement 6: 质量控制与迭代优化

**User Story:** 作为作者，我希望系统能对生成的内容进行质量评估，并支持迭代优化，以便获得高质量的项目设定。

#### Acceptance Criteria

1. WHEN System生成Candidate THEN System SHALL对每个Candidate进行多维度质量评分
2. WHEN System评分Candidate THEN System SHALL评估完整性、一致性、丰富度、可写性、语义质量和创新性
3. WHEN System合并Candidate THEN System SHALL使用LLM智能合并而非简单的启发式规则
4. WHEN System生成最终Meta THEN System SHALL进行规则验证和语义一致性检查
5. WHEN 质量评分低于阈值 THEN System SHALL自动触发重新生成或提示User手动调整
6. WHEN User请求优化 THEN System SHALL基于质量评估结果提供具体的改进建议

### Requirement 7: 创建历史与版本管理

**User Story:** 作为作者，我希望系统能记录项目创建的历史版本，以便回溯和比较不同的生成结果。

#### Acceptance Criteria

1. WHEN System生成Candidate THEN System SHALL保存所有Candidate到创建历史
2. WHEN User查看创建历史 THEN System SHALL展示每个Candidate的评分、生成时间和关键信息
3. WHEN User选择历史Candidate THEN System SHALL允许User恢复或合并该Candidate的内容
4. WHEN System完成项目创建 THEN System SHALL保存完整的创建日志包括所有AI调用记录
5. WHEN User导出项目 THEN System SHALL包含创建历史和版本信息
6. WHEN System清理历史数据 THEN System SHALL保留最近30天的创建历史

### Requirement 8: 错误处理与恢复机制

**User Story:** 作为作者，我希望在创建过程中遇到错误时系统能优雅处理并提供恢复选项，以便不丢失已完成的工作。

#### Acceptance Criteria

1. WHEN AI调用失败 THEN System SHALL自动重试最多3次使用指数退避策略
2. WHEN 重试仍然失败 THEN System SHALL保存当前状态并提示User稍后继续
3. WHEN 网络连接中断 THEN System SHALL保存已生成的内容到本地缓存
4. WHEN User取消创建 THEN System SHALL询问是否保存草稿以便后续继续
5. WHEN System检测到数据不一致 THEN System SHALL回滚到最后一个一致状态
6. WHEN 创建超时 THEN System SHALL提供"继续等待"或"使用部分结果"选项

### Requirement 9: 用户反馈与学习机制

**User Story:** 作为作者，我希望系统能学习我的偏好和反馈，逐步提升生成质量，以便获得更符合我风格的内容。

#### Acceptance Criteria

1. WHEN User对生成内容进行评分 THEN System SHALL记录评分和对应的生成参数
2. WHEN User多次使用某种风格或类型 THEN System SHALL识别User的偏好模式
3. WHEN System生成新内容 THEN System SHALL参考User的历史偏好调整生成参数
4. WHEN User标记某个Candidate为"优秀" THEN System SHALL分析该Candidate的特征并在后续生成中强化
5. WHEN User标记某个Candidate为"不满意" THEN System SHALL分析问题并在后续生成中避免类似模式
6. WHEN System积累足够反馈数据 THEN System SHALL提供个性化的创作建议和模板推荐
