ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

UPDATE users
SET email_verified_at = created_at
WHERE email IS NOT NULL
  AND email_verified_at IS NULL;

ALTER TABLE magic_link_tokens
  DROP CONSTRAINT IF EXISTS magic_link_tokens_purpose_check;

ALTER TABLE magic_link_tokens
  ADD CONSTRAINT magic_link_tokens_purpose_check
  CHECK (purpose IN ('login', 'recovery', 'binding', 'registration'));
