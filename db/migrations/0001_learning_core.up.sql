-- Profesor IA learning core schema.
-- This migration creates the first durable PostgreSQL foundation for the Go API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE curriculum_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  cefr_level text NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_unit_id uuid REFERENCES curriculum_units(id) ON DELETE SET NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  objective text NOT NULL,
  cefr_level text NOT NULL CHECK (cefr_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  phonetic_focus text NOT NULL DEFAULT '',
  linking_rule text NOT NULL DEFAULT '',
  matrix_drill jsonb NOT NULL DEFAULT '[]'::jsonb,
  story_prompt text NOT NULL DEFAULT '',
  rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  correction_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_version integer NOT NULL DEFAULT 1 CHECK (prompt_version > 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lesson_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  anonymous_progress_id uuid,
  lesson_plan_id uuid REFERENCES lesson_plans(id) ON DELETE SET NULL,
  legacy_lesson_id text,
  status text NOT NULL CHECK (status IN ('started', 'completed', 'abandoned', 'failed')),
  realtime_model text NOT NULL DEFAULT 'gpt-realtime-2',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (user_id IS NOT NULL OR anonymous_progress_id IS NOT NULL)
);

CREATE TABLE lesson_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES lesson_attempts(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('learner_turn', 'tutor_feedback', 'system', 'avatar')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES lesson_attempts(id) ON DELETE CASCADE,
  correction_text text NOT NULL,
  rubric_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE progress_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  anonymous_progress_id uuid,
  attempt_id uuid NOT NULL UNIQUE REFERENCES lesson_attempts(id) ON DELETE CASCADE,
  xp integer NOT NULL CHECK (xp > 0),
  reason text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anonymous_progress_id IS NOT NULL)
);

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);
CREATE INDEX curriculum_units_level_sort_idx ON curriculum_units(cefr_level, sort_order);
CREATE INDEX lesson_plans_unit_active_idx ON lesson_plans(curriculum_unit_id, is_active);
CREATE INDEX lesson_attempts_user_started_idx ON lesson_attempts(user_id, started_at DESC);
CREATE INDEX lesson_attempts_anonymous_started_idx ON lesson_attempts(anonymous_progress_id, started_at DESC);
CREATE INDEX lesson_events_attempt_occurred_idx ON lesson_events(attempt_id, occurred_at);
CREATE INDEX feedback_events_attempt_created_idx ON feedback_events(attempt_id, created_at);
CREATE INDEX progress_awards_user_awarded_idx ON progress_awards(user_id, awarded_at DESC);
CREATE INDEX progress_awards_anonymous_awarded_idx ON progress_awards(anonymous_progress_id, awarded_at DESC);
