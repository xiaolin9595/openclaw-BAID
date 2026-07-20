-- Backfill profiles created before OpenClaw submitted an agent_profile draft.
-- Only active-bound profiles are eligible; publication preference is preserved.
WITH active_instances AS (
  SELECT DISTINCT ON (agent_id) agent_id, platform, instance_label
  FROM instance_bindings
  WHERE status = 'active'
  ORDER BY agent_id, issued_at DESC
), generated AS (
  SELECT
    p.agent_id,
    CASE WHEN NULLIF(p.summary, '') IS NULL
      THEN format('OpenClaw Agent on %s，支持 P2P 发现、身份验证和安全消息通信。', COALESCE(i.instance_label, 'OpenClaw'))
      ELSE p.summary END AS summary,
    CASE WHEN NULLIF(p.role, '') IS NULL THEN 'OpenClaw P2P Agent' ELSE p.role END AS role,
    CASE WHEN NULLIF(p.language, '') IS NULL THEN 'OpenClaw / TypeScript' ELSE p.language END AS language,
    COALESCE(p.attributes, '[]'::jsonb) || jsonb_build_array(
      jsonb_build_object('key', 'agent-discovery', 'label', '发现能力', 'value', 'agent-discovery', 'kind', 'capability', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'identity-verification', 'label', '身份能力', 'value', 'identity-verification', 'kind', 'capability', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'p2p-mesh', 'label', '网络能力', 'value', 'p2p-mesh', 'kind', 'capability', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'openclaw', 'label', '运行生态', 'value', 'openclaw', 'kind', 'tag', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'libp2p', 'label', '网络协议', 'value', 'libp2p', 'kind', 'tag', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'runtime', 'label', '运行时', 'value', 'OpenClaw Gateway', 'kind', 'context', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'transport', 'label', '通信传输', 'value', 'libp2p', 'kind', 'context', 'trust', 'self_declared', 'visible', true),
      jsonb_build_object('key', 'platform', 'label', '运行平台', 'value', i.platform, 'kind', 'context', 'trust', 'self_declared', 'visible', true)
    ) AS attributes
  FROM agent_public_profiles p
  JOIN active_instances i ON i.agent_id = p.agent_id
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(p.attributes, '[]'::jsonb)) item
    WHERE item->>'key' = 'agent-discovery'
  )
)
UPDATE agent_public_profiles p
SET summary = g.summary, role = g.role, language = g.language, attributes = g.attributes, updated_at = now()
FROM generated g
WHERE p.agent_id = g.agent_id;
