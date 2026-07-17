CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_token_hash_idx ON sessions(token_hash);

CREATE TABLE magic_link_tokens (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  return_to TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX magic_link_tokens_token_hash_idx ON magic_link_tokens(token_hash);

CREATE TABLE webauthn_challenges (
  id UUID PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')),
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL,
  transports TEXT[] NOT NULL DEFAULT '{}',
  device_type TEXT NOT NULL,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_members (
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'viewer')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, user_id)
);
CREATE INDEX agent_members_user_idx ON agent_members(user_id, agent_id);

CREATE TABLE device_authorizations (
  id UUID PRIMARY KEY,
  client_id TEXT NOT NULL,
  agent_hint TEXT REFERENCES agents(id),
  agent_id TEXT REFERENCES agents(id),
  instance_id TEXT NOT NULL,
  instance_public_key TEXT NOT NULL,
  public_key_fingerprint TEXT NOT NULL,
  instance_label TEXT NOT NULL,
  platform TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  code_challenge TEXT NOT NULL,
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  poll_interval_seconds INTEGER NOT NULL DEFAULT 5,
  last_polled_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'denied', 'exchanged', 'expired', 'revoked')),
  decision_reason TEXT,
  decided_at TIMESTAMPTZ,
  decided_by_user_id TEXT REFERENCES users(id),
  binding_jti UUID,
  exchanged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX device_authorizations_agent_pending_idx ON device_authorizations(agent_id, agent_hint, status);
CREATE INDEX device_authorizations_code_hash_idx ON device_authorizations(device_code_hash);

CREATE TABLE instance_bindings (
  jti UUID PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  instance_id TEXT NOT NULL,
  instance_public_key TEXT NOT NULL,
  public_key_fingerprint TEXT NOT NULL,
  instance_label TEXT NOT NULL,
  platform TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  approved_by_user_id TEXT NOT NULL REFERENCES users(id),
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id TEXT REFERENCES users(id),
  revocation_reason TEXT,
  ibc TEXT NOT NULL
);
CREATE INDEX instance_bindings_agent_idx ON instance_bindings(agent_id, instance_id);

ALTER TABLE device_authorizations
  ADD CONSTRAINT device_authorizations_binding_fk
  FOREIGN KEY (binding_jti) REFERENCES instance_bindings(jti);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  agent_id TEXT REFERENCES agents(id),
  instance_id TEXT,
  binding_jti UUID REFERENCES instance_bindings(jti),
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_agent_created_idx ON audit_events(agent_id, created_at DESC);

CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);
