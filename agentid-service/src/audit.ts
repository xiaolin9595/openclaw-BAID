import type { AuditEvent, NewAuditEvent } from "./domain.js";
import { sha256 } from "./crypto.js";

export const AUDIT_GENESIS_HASH = "agentid-audit-v1:genesis";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashAuditEvent(event: NewAuditEvent, previousHash: string): string {
  return sha256(stableJson({
    version: 1,
    previousHash,
    id: event.id,
    actorUserId: event.actorUserId,
    agentId: event.agentId,
    instanceId: event.instanceId,
    bindingJti: event.bindingJti,
    action: event.action,
    detail: event.detail,
    createdAt: event.createdAt,
  }));
}

export function materializeAuditEvent(event: NewAuditEvent, previousHash: string): AuditEvent {
  return { ...event, previousHash, eventHash: hashAuditEvent(event, previousHash) };
}
