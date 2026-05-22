-- Roll back the Profesor IA learning core schema.

DROP INDEX IF EXISTS progress_awards_anonymous_awarded_idx;
DROP INDEX IF EXISTS progress_awards_user_awarded_idx;
DROP INDEX IF EXISTS feedback_events_attempt_created_idx;
DROP INDEX IF EXISTS lesson_events_attempt_occurred_idx;
DROP INDEX IF EXISTS lesson_attempts_anonymous_started_idx;
DROP INDEX IF EXISTS lesson_attempts_user_started_idx;
DROP INDEX IF EXISTS lesson_plans_unit_active_idx;
DROP INDEX IF EXISTS curriculum_units_level_sort_idx;
DROP INDEX IF EXISTS auth_sessions_expires_at_idx;
DROP INDEX IF EXISTS auth_sessions_user_id_idx;

DROP TABLE IF EXISTS progress_awards;
DROP TABLE IF EXISTS feedback_events;
DROP TABLE IF EXISTS lesson_events;
DROP TABLE IF EXISTS lesson_attempts;
DROP TABLE IF EXISTS lesson_plans;
DROP TABLE IF EXISTS curriculum_units;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS users;
