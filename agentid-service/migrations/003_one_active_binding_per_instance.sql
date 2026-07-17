CREATE UNIQUE INDEX IF NOT EXISTS instance_bindings_one_active_per_instance_idx
  ON instance_bindings (agent_id, instance_id)
  WHERE status = 'active';
