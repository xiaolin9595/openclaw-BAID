ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

UPDATE users
SET username = COALESCE(NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_-]', '_', 'g'), ''), 'user') || '_' || right(replace(id, 'usr_', ''), 8)
WHERE username IS NULL;

ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (lower(username));
