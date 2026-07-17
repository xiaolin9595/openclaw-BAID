ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'login';

ALTER TABLE magic_link_tokens
  DROP CONSTRAINT IF EXISTS magic_link_tokens_purpose_check;

ALTER TABLE magic_link_tokens
  ADD CONSTRAINT magic_link_tokens_purpose_check
  CHECK (purpose IN ('login', 'recovery', 'binding'));

CREATE INDEX IF NOT EXISTS magic_link_tokens_email_purpose_idx
  ON magic_link_tokens (user_id, purpose, verification_code_hash)
  WHERE consumed_at IS NULL;
