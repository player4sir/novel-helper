-- Migration: Enhance generation_logs table with retry tracking and error details
-- Date: 2024-01-XX
-- Description: Add columns for retry count, duration, error tracking, and raw response storage

-- Add new columns to generation_logs table
ALTER TABLE generation_logs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_duration INTEGER, -- in milliseconds
ADD COLUMN IF NOT EXISTS error_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS raw_response TEXT, -- Store raw AI response for debugging
ADD COLUMN IF NOT EXISTS parse_errors JSONB; -- Store parse error details

-- Add comments for documentation
COMMENT ON COLUMN generation_logs.retry_count IS 'Number of retry attempts before success or final failure';
COMMENT ON COLUMN generation_logs.total_duration IS 'Total duration including all retries in milliseconds';
COMMENT ON COLUMN generation_logs.error_type IS 'Type of error if failed: network, api, parse, validation, timeout, unknown';
COMMENT ON COLUMN generation_logs.raw_response IS 'Raw AI response content for debugging parse failures';
COMMENT ON COLUMN generation_logs.parse_errors IS 'Detailed parse error information: {type, message, position, suggestions}';

-- Add index for error analysis
CREATE INDEX IF NOT EXISTS idx_generation_logs_error_type 
ON generation_logs (error_type) 
WHERE error_type IS NOT NULL;

-- Add index for retry analysis
CREATE INDEX IF NOT EXISTS idx_generation_logs_retry_count 
ON generation_logs (retry_count) 
WHERE retry_count > 0;

-- Add index for performance analysis
CREATE INDEX IF NOT EXISTS idx_generation_logs_duration 
ON generation_logs (total_duration) 
WHERE total_duration IS NOT NULL;

-- Add composite index for error analysis by model and time
CREATE INDEX IF NOT EXISTS idx_generation_logs_error_analysis 
ON generation_logs (model_id, error_type, timestamp DESC) 
WHERE error_type IS NOT NULL;
