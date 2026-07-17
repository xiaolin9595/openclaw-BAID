ALTER TABLE device_authorizations
  ADD COLUMN IF NOT EXISTS agent_profile JSONB;
