ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS target_email TEXT;

UPDATE magic_link_tokens token
SET target_email = users.email
FROM users
WHERE token.user_id = users.id
  AND token.target_email IS NULL;

CREATE INDEX IF NOT EXISTS magic_link_tokens_target_email_idx
  ON magic_link_tokens (target_email, purpose, verification_code_hash)
  WHERE consumed_at IS NULL;
