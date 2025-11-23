-- Migration: Add updated_at column to cached_executions table
-- Date: 2024-01-XX
-- Description: Add missing updated_at column with automatic timestamp update trigger

-- Add updated_at column to cached_executions table
ALTER TABLE cached_executions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add comment for documentation
COMMENT ON COLUMN cached_executions.updated_at IS 'Timestamp of last update, automatically updated on row modification';

-- Create or replace trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cached_executions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row updates
DROP TRIGGER IF EXISTS trigger_update_cached_executions_timestamp ON cached_executions;
CREATE TRIGGER trigger_update_cached_executions_timestamp
BEFORE UPDATE ON cached_executions
FOR EACH ROW
EXECUTE FUNCTION update_cached_executions_timestamp();

-- Add index for updated_at queries (useful for cache cleanup)
CREATE INDEX IF NOT EXISTS idx_cached_executions_updated_at 
ON cached_executions (updated_at);

-- Update existing rows to have updated_at = created_at
UPDATE cached_executions
SET updated_at = created_at
WHERE updated_at IS NULL;
