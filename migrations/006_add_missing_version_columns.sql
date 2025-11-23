-- Migration: Add missing version columns
-- Date: 2024-01-XX
-- Description: Add version columns to chapters and summaries tables

-- Add version column to chapters table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chapters' AND column_name = 'version'
  ) THEN
    ALTER TABLE chapters ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN chapters.version IS 'Chapter version number for tracking changes';
  END IF;
END $$;

-- Add version column to summaries table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'summaries' AND column_name = 'version'
  ) THEN
    ALTER TABLE summaries ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN summaries.version IS 'Summary version number for tracking changes';
  END IF;
END $$;

-- Add base_version and target_version columns to change_sets table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'change_sets' AND column_name = 'base_version'
  ) THEN
    ALTER TABLE change_sets ADD COLUMN base_version INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN change_sets.base_version IS 'Base version of the change set';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'change_sets' AND column_name = 'target_version'
  ) THEN
    ALTER TABLE change_sets ADD COLUMN target_version INTEGER NOT NULL DEFAULT 1;
    COMMENT ON COLUMN change_sets.target_version IS 'Target version of the change set';
  END IF;
END $$;

-- Create index for version queries
CREATE INDEX IF NOT EXISTS idx_chapters_version ON chapters (version);
CREATE INDEX IF NOT EXISTS idx_summaries_version ON summaries (version);
