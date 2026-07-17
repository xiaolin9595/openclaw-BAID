ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS verification_code_hash TEXT;

CREATE INDEX IF NOT EXISTS magic_link_tokens_code_hash_idx
  ON magic_link_tokens (verification_code_hash)
  WHERE consumed_at IS NULL;
