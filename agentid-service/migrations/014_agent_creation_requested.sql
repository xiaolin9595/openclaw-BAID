ALTER TABLE device_authorizations
  ADD COLUMN IF NOT EXISTS agent_creation_requested BOOLEAN NOT NULL DEFAULT FALSE;
