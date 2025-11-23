-- Migration: Add Project Creation Enhancement Tables
-- Description: Adds tables for session management, templates, creation history, and user feedback

-- Sessions table - stores project creation session state
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR,
  mode TEXT NOT NULL CHECK (mode IN ('quick', 'stepwise')),
  seed JSONB NOT NULL,
  current_step TEXT NOT NULL CHECK (current_step IN ('basic', 'characters', 'world', 'outline', 'finalize')),
  step_results JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'expired')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Session Steps table - stores individual step results
CREATE TABLE IF NOT EXISTS session_steps (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  step TEXT NOT NULL CHECK (step IN ('basic', 'characters', 'world', 'outline', 'finalize')),
  data JSONB NOT NULL,
  candidates JSONB,
  selected_candidate JSONB,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Templates table - stores project creation templates
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  genre TEXT NOT NULL,
  style TEXT NOT NULL,
  character_structure JSONB NOT NULL,
  world_framework JSONB NOT NULL,
  conflict_patterns TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Creation History table - stores all candidate generations
CREATE TABLE IF NOT EXISTS creation_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  candidate JSONB NOT NULL,
  quality_score JSONB NOT NULL,
  innovation_score JSONB NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL
);

-- User Feedback table - stores user feedback on generated content
CREATE TABLE IF NOT EXISTS user_feedback (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL,
  candidate_id VARCHAR NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  comments TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User Preferences table - stores analyzed user preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE,
  favorite_genres TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  favorite_styles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  character_preferences JSONB NOT NULL DEFAULT '{}',
  world_preferences JSONB NOT NULL DEFAULT '{}',
  innovation_tolerance INTEGER NOT NULL DEFAULT 50 CHECK (innovation_tolerance >= 0 AND innovation_tolerance <= 100),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_session_steps_session_id ON session_steps(session_id);
CREATE INDEX IF NOT EXISTS idx_templates_genre ON templates(genre);
CREATE INDEX IF NOT EXISTS idx_creation_history_session_id ON creation_history(session_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_candidate_id ON user_feedback(candidate_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
