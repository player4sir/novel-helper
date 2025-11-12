-- Migration: Add scene tracking and entity tracking tables
-- Generated: 2025-01-09

-- Extend characters table with entity tracking fields
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_mentioned JSONB;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS first_appearance JSONB;

-- Create scene_frames table
CREATE TABLE IF NOT EXISTS scene_frames (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id VARCHAR NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  index INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  entry_state_summary TEXT,
  exit_state_summary TEXT,
  focal_entities TEXT[],
  tokens_estimate INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scene_frames_chapter ON scene_frames(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scene_frames_index ON scene_frames(chapter_id, index);

-- Create draft_chunks table
CREATE TABLE IF NOT EXISTS draft_chunks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id VARCHAR NOT NULL REFERENCES scene_frames(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions TEXT[],
  local_summary TEXT,
  created_from_exec_id VARCHAR,
  word_count INTEGER,
  rule_check_passed BOOLEAN,
  rule_check_errors JSONB,
  rule_check_warnings JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_draft_chunks_scene ON draft_chunks(scene_id);
CREATE INDEX IF NOT EXISTS idx_draft_chunks_created ON draft_chunks(created_at);

-- Create chapter_polish_history table
CREATE TABLE IF NOT EXISTS chapter_polish_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id VARCHAR NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  original_content TEXT NOT NULL,
  polished_content TEXT NOT NULL,
  change_log JSONB,
  model_id VARCHAR,
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_polish_history_chapter ON chapter_polish_history(chapter_id);
CREATE INDEX IF NOT EXISTS idx_polish_history_created ON chapter_polish_history(created_at);

-- Create coherence_issues table
CREATE TABLE IF NOT EXISTS coherence_issues (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  chapter_id VARCHAR REFERENCES chapters(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  affected_scenes TEXT[],
  evidence_snippets JSONB,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coherence_issues_project ON coherence_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_coherence_issues_chapter ON coherence_issues(chapter_id);
CREATE INDEX IF NOT EXISTS idx_coherence_issues_status ON coherence_issues(status);

-- Create doc_deltas table (version control)
CREATE TABLE IF NOT EXISTS doc_deltas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id VARCHAR NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  base_version_id VARCHAR,
  patch_ops JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  created_by VARCHAR
);

CREATE INDEX IF NOT EXISTS idx_doc_deltas_chapter ON doc_deltas(chapter_id);
CREATE INDEX IF NOT EXISTS idx_doc_deltas_created ON doc_deltas(created_at);

-- Add comments for documentation
COMMENT ON TABLE scene_frames IS 'Scene-level decomposition of chapters for incremental draft generation';
COMMENT ON TABLE draft_chunks IS 'Scene-level draft content with rule check results';
COMMENT ON TABLE chapter_polish_history IS 'History of chapter polish operations';
COMMENT ON TABLE coherence_issues IS 'Detected coherence and consistency issues';
COMMENT ON TABLE doc_deltas IS 'Version control for chapter content using JSON Patch';

COMMENT ON COLUMN characters.last_mentioned IS 'Last mention location: {volumeIndex, chapterIndex, sceneIndex, position}';
COMMENT ON COLUMN characters.mention_count IS 'Total number of times character is mentioned';
COMMENT ON COLUMN characters.first_appearance IS 'First appearance location: {volumeIndex, chapterIndex, sceneIndex}';
