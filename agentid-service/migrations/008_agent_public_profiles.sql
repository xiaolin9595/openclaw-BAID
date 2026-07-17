CREATE TABLE IF NOT EXISTS agent_public_profiles (
  agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  summary TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  published BOOLEAN NOT NULL DEFAULT false,
  allow_discovery BOOLEAN NOT NULL DEFAULT false,
  allow_direct_dial BOOLEAN NOT NULL DEFAULT false,
  peer_id TEXT,
  multiaddrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  relay_multiaddrs JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agent_public_profiles ADD COLUMN IF NOT EXISTS allow_discovery BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agent_public_profiles ADD COLUMN IF NOT EXISTS allow_direct_dial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE agent_public_profiles ADD COLUMN IF NOT EXISTS peer_id TEXT;
ALTER TABLE agent_public_profiles ADD COLUMN IF NOT EXISTS multiaddrs JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE agent_public_profiles ADD COLUMN IF NOT EXISTS relay_multiaddrs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS agent_public_profiles_published_idx
  ON agent_public_profiles (published, updated_at DESC);
