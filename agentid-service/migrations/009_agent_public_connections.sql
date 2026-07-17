-- Backfill connection discovery fields for databases that already applied 008.
ALTER TABLE agent_public_profiles
  ADD COLUMN IF NOT EXISTS allow_discovery BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE agent_public_profiles
  ADD COLUMN IF NOT EXISTS allow_direct_dial BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE agent_public_profiles
  ADD COLUMN IF NOT EXISTS peer_id TEXT;

ALTER TABLE agent_public_profiles
  ADD COLUMN IF NOT EXISTS multiaddrs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE agent_public_profiles
  ADD COLUMN IF NOT EXISTS relay_multiaddrs JSONB NOT NULL DEFAULT '[]'::jsonb;
