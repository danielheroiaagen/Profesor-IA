-- Add password credential storage for Go-owned authentication.
-- Login/register endpoints are intentionally delivered in later slices.

ALTER TABLE users
  ADD COLUMN password_hash text;

ALTER TABLE users
  ADD CONSTRAINT users_password_hash_min_length
  CHECK (password_hash IS NULL OR char_length(password_hash) >= 55);

CREATE UNIQUE INDEX users_email_lower_idx
  ON users (lower(email))
  WHERE email IS NOT NULL;
