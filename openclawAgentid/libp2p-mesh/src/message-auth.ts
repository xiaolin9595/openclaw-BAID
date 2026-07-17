import type { P2PMessage } from "./types.js";
import {
  getAgentIdEnforcementMode,
  verifyAgentIdBindingStatus,
  verifyAgentIdIbc,
  type AgentIdBindingStatusCache,
  type AgentIdJwksCache,
  type AgentIdFetch,
} from "./agentid.js";
import type { AgentIdConfig } from "./types.js";

/**
 * Fixed-shape serialization prevents sender and receiver field-order drift.
 * Null represents an intentionally absent optional field.
 */
export function serializeP2PMessageForSignature(message: P2PMessage): string {
  return JSON.stringify({
    id: message.id,
    type: message.type,
    from: message.from,
    to: message.to ?? null,
    topic: message.topic ?? null,
    payload: message.payload,
    timestamp: message.timestamp,
    instanceId: message.instanceId ?? null,
    pubkey: message.pubkey ?? null,
    agentId: message.agentId ?? null,
    instanceBinding: message.instanceBinding ?? null,
  });
}

/**
 * libp2p-mesh releases before AgentID used this ad-hoc serialization. It is
 * retained only to verify legacy messages in compat mode.
 */
export function serializeLegacyP2PMessageForSignature(message: P2PMessage): string {
  return JSON.stringify({
    id: message.id,
    type: message.type,
    from: message.from,
    to: message.to,
    topic: message.topic,
    payload: message.payload,
    timestamp: message.timestamp,
    instanceId: message.instanceId,
  });
}

export function hasAgentIdCredential(message: P2PMessage): boolean {
  return typeof message.agentId === "string" || typeof message.instanceBinding === "string";
}

export function hasCompleteInstanceSignature(message: P2PMessage): boolean {
  return Boolean(message.instanceId && message.pubkey && message.signature);
}

export async function verifyP2PMessageAgentId(
  message: P2PMessage,
  config?: AgentIdConfig,
  options?: {
    fetch?: AgentIdFetch;
    cache?: AgentIdJwksCache;
    bindingStatusCache?: AgentIdBindingStatusCache;
    now?: () => number;
  },
): Promise<{ valid: true } | { valid: false; reason: string }> {
  const hasAgentId = typeof message.agentId === "string" && message.agentId.length > 0;
  const hasInstanceBinding = typeof message.instanceBinding === "string" && message.instanceBinding.length > 0;
  const hasIncompleteBinding = (message.agentId !== undefined && !hasAgentId) || (message.instanceBinding !== undefined && !hasInstanceBinding);
  if (hasIncompleteBinding || hasAgentId !== hasInstanceBinding) {
    return { valid: false, reason: "AgentID messages must include both agentId and instanceBinding" };
  }
  if (!hasInstanceBinding) {
    return getAgentIdEnforcementMode(config) === "strict"
      ? { valid: false, reason: "AgentID strict mode rejects messages without an instanceBinding" }
      : { valid: true };
  }
  if (!hasCompleteInstanceSignature(message)) {
    return { valid: false, reason: "instanceBinding messages must include instanceId, pubkey, and signature" };
  }

  const result = await verifyAgentIdIbc(message.instanceBinding!, {
    config,
    expected: {
      agentId: message.agentId,
      instanceId: message.instanceId,
      instancePublicKey: message.pubkey,
      requiredScope: message.type === "instance-announce" ? "p2p:announce" : "p2p:message",
    },
    ...options,
  });
  if (!result.valid) return { valid: false, reason: `invalid AgentID instanceBinding: ${result.reason}` };

  const bindingStatus = await verifyAgentIdBindingStatus(result.claims, {
    config,
    fetch: options?.fetch,
    cache: options?.bindingStatusCache,
    now: options?.now,
  });
  return bindingStatus.valid
    ? { valid: true }
    : { valid: false, reason: `invalid AgentID instanceBinding: ${bindingStatus.reason}` };
}
