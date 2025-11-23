-- Migration: Add vector columns for semantic search
-- Date: 2024-01-XX
-- Description: Add content_vector columns to chapters and summaries tables for semantic search capabilities

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add content_vector column to chapters table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chapters' AND column_name = 'content_vector'
  ) THEN
    ALTER TABLE chapters ADD COLUMN content_vector vector(1536);
    COMMENT ON COLUMN chapters.content_vector IS 'Semantic embedding vector for chapter content (1536 dimensions)';
  END IF;
END $$;

-- Add content_vector column to summaries table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'summaries' AND column_name = 'content_vector'
  ) THEN
    ALTER TABLE summaries ADD COLUMN content_vector vector(1536);
    COMMENT ON COLUMN summaries.content_vector IS 'Semantic embedding vector for summary content (1536 dimensions)';
  END IF;
END $$;

-- Create indexes for vector similarity search (using HNSW algorithm for better performance)
-- Note: These indexes are optional and can be created later when needed
-- Uncomment the following lines if you want to enable vector search immediately:

-- CREATE INDEX IF NOT EXISTS idx_chapters_content_vector 
-- ON chapters USING hnsw (content_vector vector_cosine_ops);

-- CREATE INDEX IF NOT EXISTS idx_summaries_content_vector 
-- ON summaries USING hnsw (content_vector vector_cosine_ops);

-- Note: HNSW indexes can take time to build on large datasets
-- Consider creating them during off-peak hours or using IVFFlat for faster builds:
-- CREATE INDEX IF NOT EXISTS idx_chapters_content_vector 
-- ON chapters USING ivfflat (content_vector vector_cosine_ops) WITH (lists = 100);
