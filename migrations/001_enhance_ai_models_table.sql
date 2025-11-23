-- Migration: Enhance ai_models table with capabilities, timeout, pricing, and config_version
-- Date: 2024-01-XX
-- Description: Add new columns to support data-driven model routing and dynamic configuration

-- Add new columns to ai_models table
ALTER TABLE ai_models 
ADD COLUMN IF NOT EXISTS capabilities JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS timeout INTEGER, -- in milliseconds
ADD COLUMN IF NOT EXISTS pricing JSONB, -- {inputCostPer1M, outputCostPer1M, currency, effectiveDate}
ADD COLUMN IF NOT EXISTS config_version INTEGER DEFAULT 1;

-- Add comments for documentation
COMMENT ON COLUMN ai_models.capabilities IS 'Array of capability tags for data-driven routing, e.g., ["creative_writing", "complex_reasoning"]';
COMMENT ON COLUMN ai_models.timeout IS 'Model-specific timeout in milliseconds';
COMMENT ON COLUMN ai_models.pricing IS 'Pricing information: {inputCostPer1M: number, outputCostPer1M: number, currency: string, effectiveDate: string}';
COMMENT ON COLUMN ai_models.config_version IS 'Configuration version for tracking changes';

-- Create unique index for default models per type
-- This ensures only one model can be default for each model_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_models_default_per_type 
ON ai_models (model_type, is_default_chat) 
WHERE is_default_chat = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_models_default_embedding_per_type 
ON ai_models (model_type, is_default_embedding) 
WHERE is_default_embedding = true;

-- Add index for capabilities queries
CREATE INDEX IF NOT EXISTS idx_ai_models_capabilities 
ON ai_models USING GIN (capabilities);

-- Populate default capabilities for existing models based on their names
-- This is a best-effort migration - admins should review and adjust

-- GPT-4 series: high quality, complex reasoning
UPDATE ai_models 
SET capabilities = '["creative_writing", "complex_reasoning", "high_quality"]'::jsonb
WHERE model_id LIKE '%gpt-4%' OR model_id LIKE '%gpt-5%';

-- GPT-3.5 series: fast, cost-effective
UPDATE ai_models 
SET capabilities = '["creative_writing", "fast_response", "cost_effective"]'::jsonb
WHERE model_id LIKE '%gpt-3.5%';

-- Claude 3 Opus/Sonnet: high quality, creative
UPDATE ai_models 
SET capabilities = '["creative_writing", "complex_reasoning", "high_quality"]'::jsonb
WHERE model_id LIKE '%claude-3-opus%' OR model_id LIKE '%claude-3-sonnet%';

-- Claude 3 Haiku: fast, cost-effective
UPDATE ai_models 
SET capabilities = '["creative_writing", "fast_response", "cost_effective"]'::jsonb
WHERE model_id LIKE '%claude-3-haiku%';

-- DeepSeek V3: high quality, cost-effective
UPDATE ai_models 
SET capabilities = '["creative_writing", "complex_reasoning", "cost_effective"]'::jsonb
WHERE (provider = 'deepseek' AND model_id LIKE '%v3%');

-- DeepSeek Chat (non-V3): cost-effective
UPDATE ai_models 
SET capabilities = '["creative_writing", "cost_effective"]'::jsonb
WHERE (provider = 'deepseek' AND model_id NOT LIKE '%v3%');

-- GLM-4 Plus: high quality
UPDATE ai_models 
SET capabilities = '["creative_writing", "complex_reasoning", "high_quality"]'::jsonb
WHERE model_id LIKE '%glm-4-plus%' OR model_id LIKE '%glm-4-0520%';

-- GLM-4 Flash/Air: fast, cost-effective
UPDATE ai_models 
SET capabilities = '["creative_writing", "fast_response", "cost_effective"]'::jsonb
WHERE model_id LIKE '%glm-4-flash%' OR model_id LIKE '%glm-4-air%';

-- Qwen series: cost-effective
UPDATE ai_models 
SET capabilities = '["creative_writing", "cost_effective"]'::jsonb
WHERE provider = 'qwen';

-- Embedding models
UPDATE ai_models 
SET capabilities = '["embedding", "semantic_search"]'::jsonb
WHERE model_type = 'embedding';

-- Populate default pricing for existing models (in cents per 1M tokens)
-- These are approximate values - admins should update with actual pricing

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 14,
  'outputCostPer1M', 14,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%deepseek%';

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 3000,
  'outputCostPer1M', 6000,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%gpt-4%' AND model_id NOT LIKE '%turbo%';

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 1000,
  'outputCostPer1M', 3000,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%gpt-4-turbo%';

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 50,
  'outputCostPer1M', 150,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%gpt-3.5%';

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 1500,
  'outputCostPer1M', 7500,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%claude-3-opus%';

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 300,
  'outputCostPer1M', 1500,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%claude-3-sonnet%';

UPDATE ai_models 
SET pricing = jsonb_build_object(
  'inputCostPer1M', 25,
  'outputCostPer1M', 125,
  'currency', 'USD',
  'effectiveDate', CURRENT_TIMESTAMP
)
WHERE model_id LIKE '%claude-3-haiku%';

-- Set default timeouts based on model type (in milliseconds)
UPDATE ai_models 
SET timeout = 120000 -- 2 minutes for high-quality models
WHERE capabilities @> '["high_quality"]'::jsonb;

UPDATE ai_models 
SET timeout = 60000 -- 1 minute for standard models
WHERE capabilities @> '["cost_effective"]'::jsonb AND NOT capabilities @> '["high_quality"]'::jsonb;

UPDATE ai_models 
SET timeout = 30000 -- 30 seconds for fast models
WHERE capabilities @> '["fast_response"]'::jsonb;

UPDATE ai_models 
SET timeout = 30000 -- 30 seconds for embedding models
WHERE model_type = 'embedding';
