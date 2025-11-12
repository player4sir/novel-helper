-- Migration: Add Entity State Vectors
-- 添加角色状态向量和弧光点支持
-- 遵循构建创作小说应用方案.txt的Entity数据模型

-- 1. 添加弧光点字段（角色发展的关键节点）
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS arc_points JSONB DEFAULT '[]';

COMMENT ON COLUMN characters.arc_points IS '角色弧光点：记录角色发展的关键节点，如：["初次觉醒", "师父之死", "突破瓶颈"]';

-- 2. 添加当前情感状态
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_emotion TEXT;

COMMENT ON COLUMN characters.current_emotion IS '当前情感状态：如"愤怒"、"悲伤"、"坚定"等';

-- 3. 添加当前目标
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_goal TEXT;

COMMENT ON COLUMN characters.current_goal IS '当前目标：角色当前的主要目标或动机';

-- 4. 添加角色动机描述（用于动机漂移检测）
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS short_motivation TEXT;

COMMENT ON COLUMN characters.short_motivation IS '简短动机描述：用于检测角色行为是否偏离动机';

-- 5. 添加状态更新时间
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS state_updated_at TIMESTAMP;

COMMENT ON COLUMN characters.state_updated_at IS '状态最后更新时间';

-- 6. 为常用查询创建索引
CREATE INDEX IF NOT EXISTS idx_characters_project_role 
ON characters(project_id, role);

CREATE INDEX IF NOT EXISTS idx_characters_mention_count 
ON characters(project_id, mention_count DESC);

-- 7. 创建角色状态历史表（用于追踪状态变化）
CREATE TABLE IF NOT EXISTS character_state_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id VARCHAR NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  chapter_id VARCHAR REFERENCES chapters(id) ON DELETE CASCADE,
  scene_index INTEGER,
  emotion TEXT,
  goal TEXT,
  arc_point TEXT, -- 如果在此场景达成弧光点
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE character_state_history IS '角色状态历史：追踪角色在不同场景的状态变化';

CREATE INDEX IF NOT EXISTS idx_character_state_history_character 
ON character_state_history(character_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_character_state_history_chapter 
ON character_state_history(chapter_id, scene_index);

-- 8. 创建语义签名表（用于缓存机制）
CREATE TABLE IF NOT EXISTS semantic_signatures (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  key_info TEXT NOT NULL, -- 提取的关键信息
  signature_hash TEXT NOT NULL, -- SHA256哈希
  embedding_model TEXT, -- 使用的向量模型
  draft_chunk_id VARCHAR REFERENCES draft_chunks(id) ON DELETE CASCADE,
  tokens_used INTEGER,
  quality_score REAL, -- 质量评分（0-1）
  reuse_count INTEGER DEFAULT 0, -- 复用次数
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP
);

COMMENT ON TABLE semantic_signatures IS '语义签名：用于缓存和复用相似场景的生成结果';

CREATE INDEX IF NOT EXISTS idx_semantic_signatures_template 
ON semantic_signatures(template_id, signature_hash);

CREATE INDEX IF NOT EXISTS idx_semantic_signatures_quality 
ON semantic_signatures(template_id, quality_score DESC);

-- 9. 创建提示词模板版本表
CREATE TABLE IF NOT EXISTS prompt_template_versions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  version TEXT NOT NULL,
  modules JSONB NOT NULL, -- 模块配置
  performance_metrics JSONB, -- 性能指标：{acceptance_rate, avg_tokens, avg_quality}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(template_id, version)
);

COMMENT ON TABLE prompt_template_versions IS '提示词模板版本：支持A/B测试和版本管理';

CREATE INDEX IF NOT EXISTS idx_prompt_template_versions_active 
ON prompt_template_versions(template_id, is_active);
