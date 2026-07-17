CREATE TABLE IF NOT EXISTS binding_renewal_challenges (
  id UUID PRIMARY KEY,
  jti UUID NOT NULL REFERENCES instance_bindings(jti) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS binding_renewal_challenges_jti_idx ON binding_renewal_challenges(jti);
