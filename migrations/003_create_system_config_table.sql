-- Migration: Create system_config table for environment-specific configuration
-- Date: 2024-01-XX
-- Description: New table for storing system configuration with environment support

-- Create system_config table
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  environment VARCHAR(50) NOT NULL DEFAULT 'production',
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

-- Add comments for documentation
COMMENT ON TABLE system_config IS 'System-wide configuration with environment-specific values';
COMMENT ON COLUMN system_config.key IS 'Configuration key in dot notation, e.g., timeout.project_creation.default';
COMMENT ON COLUMN system_config.value IS 'Configuration value, can be environment-specific object or simple value';
COMMENT ON COLUMN system_config.environment IS 'Target environment: development, staging, production, or all';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of the configuration';
COMMENT ON COLUMN system_config.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN system_config.updated_by IS 'User or system that last updated this config';

-- Add index for environment queries
CREATE INDEX IF NOT EXISTS idx_system_config_environment 
ON system_config (environment);

-- Add index for key prefix queries (for hierarchical config)
CREATE INDEX IF NOT EXISTS idx_system_config_key_prefix 
ON system_config (key text_pattern_ops);

-- Insert default configurations

-- Timeout configurations
INSERT INTO system_config (key, value, environment, description) VALUES
('timeout.project_creation.default', '{"development": 30000, "production": 60000}'::jsonb, 'all', 'Default timeout for project creation in milliseconds'),
('timeout.volume_generation.default', '{"development": 60000, "production": 120000}'::jsonb, 'all', 'Default timeout for volume generation in milliseconds'),
('timeout.chapter_generation.default', '{"development": 60000, "production": 120000}'::jsonb, 'all', 'Default timeout for chapter generation in milliseconds'),
('timeout.scene_generation.default', '{"development": 30000, "production": 60000}'::jsonb, 'all', 'Default timeout for scene generation in milliseconds')
ON CONFLICT (key) DO NOTHING;

-- Retry configurations
INSERT INTO system_config (key, value, environment, description) VALUES
('retry.max_attempts', '{"development": 2, "production": 5}'::jsonb, 'all', 'Maximum number of retry attempts'),
('retry.initial_delay', '{"development": 1000, "production": 1000}'::jsonb, 'all', 'Initial retry delay in milliseconds'),
('retry.max_delay', '{"development": 10000, "production": 30000}'::jsonb, 'all', 'Maximum retry delay in milliseconds'),
('retry.backoff_multiplier', '{"development": 2, "production": 2}'::jsonb, 'all', 'Exponential backoff multiplier')
ON CONFLICT (key) DO NOTHING;

-- Quality mode configurations
INSERT INTO system_config (key, value, environment, description) VALUES
('quality_mode.enabled', '{"development": true, "production": true}'::jsonb, 'all', 'Enable quality mode selection'),
('quality_mode.fast.skip_semantic_validation', 'true'::jsonb, 'all', 'Skip semantic validation in fast mode'),
('quality_mode.fast.skip_writability_check', 'true'::jsonb, 'all', 'Skip writability check in fast mode'),
('quality_mode.quality.enable_semantic_validation', 'true'::jsonb, 'all', 'Enable semantic validation in quality mode'),
('quality_mode.quality.enable_writability_check', 'true'::jsonb, 'all', 'Enable writability check in quality mode')
ON CONFLICT (key) DO NOTHING;

-- Parser configurations
INSERT INTO system_config (key, value, environment, description) VALUES
('parser.max_recovery_attempts', '3'::jsonb, 'all', 'Maximum attempts to recover from parse errors'),
('parser.enable_comment_removal', 'true'::jsonb, 'all', 'Enable automatic comment removal from JSON'),
('parser.enable_markdown_extraction', 'true'::jsonb, 'all', 'Enable automatic markdown code block extraction'),
('parser.enable_error_fixing', 'true'::jsonb, 'all', 'Enable automatic fixing of common JSON errors')
ON CONFLICT (key) DO NOTHING;

-- Cache configurations
INSERT INTO system_config (key, value, environment, description) VALUES
('cache.ttl.config', '{"development": 60, "production": 300}'::jsonb, 'all', 'Configuration cache TTL in seconds'),
('cache.ttl.model_list', '{"development": 30, "production": 60}'::jsonb, 'all', 'Model list cache TTL in seconds')
ON CONFLICT (key) DO NOTHING;

-- Logging configurations
INSERT INTO system_config (key, value, environment, description) VALUES
('logging.level', '{"development": "debug", "production": "info"}'::jsonb, 'all', 'Logging level'),
('logging.include_raw_response', '{"development": true, "production": false}'::jsonb, 'all', 'Include raw AI responses in logs'),
('logging.max_response_length', '{"development": 10000, "production": 1000}'::jsonb, 'all', 'Maximum response length to log')
ON CONFLICT (key) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_system_config_timestamp
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION update_system_config_timestamp();
