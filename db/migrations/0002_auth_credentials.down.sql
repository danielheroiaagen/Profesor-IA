DROP INDEX IF EXISTS users_email_lower_idx;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_password_hash_min_length;

ALTER TABLE users
  DROP COLUMN IF EXISTS password_hash;
