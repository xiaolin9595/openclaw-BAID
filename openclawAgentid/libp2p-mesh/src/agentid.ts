import { createHash, createPublicKey, randomBytes, randomUUID, verify, type webcrypto } from "node:crypto";
import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { AgentIdConfig, InstanceIdentity, UserPublicAttribute } from "./types.js";

export const AGENTID_AUDIENCE = "openclaw-libp2p-mesh";
const DEFAULT_JWKS_TTL_MS = 5 * 60 * 1000;
const DEFAULT_REVOCATION_CACHE_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_IBC_LENGTH = 16 * 1024;

export type AgentIdIbcClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  jti: string;
  /** Issuer-keyed HMAC of the website user ID; the raw user ID is never carried in IBC. */
  user_id_hash?: string;
  instance_id: string;
  instance_public_key: string;
  scope: string[];
  iat: number;
  exp: number;
};

export type AgentIdDiscoveryTicketClaims = {
  iss: string;
  sub: string;
  aud: string | string[];
  jti: string;
  peer_id: string;
  multiaddrs: string[];
  relay_multiaddrs: string[];
  allowed_scopes: string[];
  iat: number;
  exp: number;
};

export type VerifiedAgentIdMetadata = {
  agentId: string;
  issuer: string;
  jti: string;
  expiresAt: number;
};

export type AgentIdBindingFile = {
  version: 1;
  issuer: string;
  agentId: string;
  userIdHash?: string;
  instanceId: string;
  instancePublicKey: string;
  jti: string;
  expiresAt: number;
  linkedAt: number;
  instanceBinding: string;
  status?: "active" | "revoked" | "expired";
  lastStatusCheckAt?: number;
};

export type AgentIdFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type VerifyAgentIdIbcOptions = {
  config?: AgentIdConfig;
  expected?: {
    agentId?: string;
    instanceId?: string;
    instancePublicKey?: string;
    requiredScope?: "p2p:announce" | "p2p:message";
  };
  fetch?: AgentIdFetch;
  cache?: AgentIdJwksCache;
  now?: () => number;
};

export type VerifyAgentIdIbcResult =
  | { valid: true; claims: AgentIdIbcClaims }
  | { valid: false; reason: string };

export type VerifyAgentIdDiscoveryTicketOptions = {
  config?: AgentIdConfig;
  expected?: { agentId?: string; peerId?: string };
  fetch?: AgentIdFetch;
  cache?: AgentIdJwksCache;
  now?: () => number;
};

export type VerifyAgentIdDiscoveryTicketResult =
  | { valid: true; claims: AgentIdDiscoveryTicketClaims }
  | { valid: false; reason: string };

export type AgentIdBindingStatusCacheEntry = {
  status: "active" | "revoked" | "expired";
  expiresAt: number;
  userIdHash?: string;
};

export type LinkAgentIdOptions = {
  issuer: string;
  agentId?: string;
  createAgent?: boolean;
  identity: InstanceIdentity;
  scopes?: Array<"p2p:announce" | "p2p:message">;
  profileAttributes?: UserPublicAttribute[];
  fetch?: AgentIdFetch;
  cache?: AgentIdJwksCache;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  onDeviceAuthorization?: (authorization: DeviceAuthorization) => void;
};

export type AgentProfileDraft = {
  summary: string;
  role: string;
  language: string;
  attributes: Array<{
    key: string;
    label: string;
    value: string;
    kind: "capability" | "tag" | "context";
  }>;
};

/** Build public facts this plugin can support without claiming model-specific skills. */
export function buildAgentProfileDraft(
  identity: InstanceIdentity,
  scopes: Array<"p2p:announce" | "p2p:message"> = ["p2p:announce", "p2p:message"],
  profileAttributes: UserPublicAttribute[] = [],
): AgentProfileDraft {
  const attributes: AgentProfileDraft["attributes"] = [
    ...scopes.map((scope) => ({ key: scope, label: "通信能力", value: scope, kind: "capability" as const })),
    { key: "agent-discovery", label: "发现能力", value: "agent-discovery", kind: "capability" as const },
    { key: "identity-verification", label: "身份能力", value: "identity-verification", kind: "capability" as const },
    { key: "p2p-mesh", label: "网络能力", value: "p2p-mesh", kind: "capability" as const },
    { key: "openclaw", label: "运行生态", value: "openclaw", kind: "tag" as const },
    { key: "libp2p", label: "网络协议", value: "libp2p", kind: "tag" as const },
    { key: "runtime", label: "运行时", value: "OpenClaw Gateway", kind: "context" as const },
    { key: "transport", label: "通信传输", value: "libp2p", kind: "context" as const },
    { key: "platform", label: "运行平台", value: identity.bindingComponents.platform, kind: "context" as const },
  ];
  const seen = new Set(attributes.map((attribute) => `${attribute.kind}:${attribute.key}:${attribute.value}`));
  for (const attribute of profileAttributes) {
    const kind = attribute.kind === "tag" ? "tag" : attribute.kind === "structured" && ["skill", "capability"].includes(attribute.key) ? "capability" : "context";
    const key = attribute.kind === "structured" ? attribute.key : "tag";
    const dedupeKey = `${kind}:${key}:${attribute.value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    attributes.push({ key, label: attribute.label, value: attribute.value, kind });
  }
  return {
    summary: `OpenClaw Agent on ${identity.name}，支持 P2P 发现、身份验证和安全消息通信。`,
    role: "OpenClaw P2P Agent",
    language: "OpenClaw / TypeScript",
    attributes,
  };
}

export type DeviceAuthorization = {
  requestId: string;
  deviceCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

export type AgentIdLinkResult = {
  binding: AgentIdBindingFile;
  authorization: DeviceAuthorization;
};

export type AgentIdRenewOptions = {
  binding: AgentIdBindingFile;
  identity: InstanceIdentity;
  signMessage: (message: string) => string;
  config?: AgentIdConfig;
  fetch?: AgentIdFetch;
  now?: () => number;
};

export type AgentIdConnectionPublication = {
  binding: AgentIdBindingFile;
  identity: InstanceIdentity;
  signMessage: (message: string) => string;
  peerId: string;
  multiaddrs: string[];
  relayMultiaddrs?: string[];
  allowDiscovery?: boolean;
  allowDirectDial?: boolean;
  fetch?: AgentIdFetch;
  now?: () => number;
};

type AgentIdJwk = webcrypto.JsonWebKey & {
  kid?: string;
  use?: string;
  alg?: string;
  kty?: string;
  crv?: string;
};

type CompactJws = {
  header: { alg?: unknown; kid?: unknown; typ?: unknown };
  claims: Record<string, unknown>;
  signingInput: string;
  signature: Buffer;
};

type JsonRecord = Record<string, unknown>;

export class AgentIdJwksCache {
  private readonly values = new Map<string, { expiresAt: number; keys: AgentIdJwk[] }>();

  clear(): void {
    this.values.clear();
  }

  async get(
    issuer: string,
    config: AgentIdConfig | undefined,
    fetchImpl: AgentIdFetch,
    now: () => number,
  ): Promise<AgentIdJwk[]> {
    const ttl = getJwksTtlMs(config);
    const current = this.values.get(issuer);
    if (current && current.expiresAt > now()) {
      return current.keys;
    }

    const response = await fetchImpl(getJwksUrl(issuer), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => undefined);
    if (!response.ok || !isRecord(body) || !Array.isArray(body.keys)) {
      throw new Error(`Unable to fetch JWKS from configured issuer ${issuer}`);
    }

    const keys = body.keys.filter(isRecord).map((key) => key as AgentIdJwk);
    if (keys.length === 0) {
      throw new Error(`Configured issuer ${issuer} returned an empty JWKS`);
    }
    if (ttl > 0) {
      this.values.set(issuer, { expiresAt: now() + ttl, keys });
    }
    return keys;
  }
}

export class AgentIdBindingStatusCache {
  private readonly values = new Map<string, AgentIdBindingStatusCacheEntry>();

  clear(): void {
    this.values.clear();
  }

  invalidate(issuer: string, jti: string): void {
    this.values.delete(`${issuer}\u0000${jti}`);
  }

  async get(
    issuer: string,
    jti: string,
    config: AgentIdConfig | undefined,
    fetchImpl: AgentIdFetch,
    now: () => number,
  ): Promise<AgentIdBindingStatusCacheEntry> {
    const key = `${issuer}\u0000${jti}`;
    const current = this.values.get(key);
    if (current && current.expiresAt > now()) return current;

    const response = await fetchImpl(getBindingStatusUrl(issuer, jti), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json().catch(() => undefined);
    const status = parseBindingStatus(body);
    if (!response.ok || !status) {
      throw new Error(`Unable to fetch binding status from configured issuer ${issuer}`);
    }

    const entry = { status, userIdHash: getOptionalString(body, "user_id_hash"), expiresAt: now() + getRevocationCacheMaxAgeMs(config) };
    if (entry.expiresAt > now()) this.values.set(key, entry);
    return entry;
  }
}

const defaultJwksCache = new AgentIdJwksCache();
const defaultBindingStatusCache = new AgentIdBindingStatusCache();

export function resolveAgentIdBindingPath(customPath?: string): string {
  if (customPath) return customPath;
  const stateDir = process.env.OPENCLAW_STATE_DIR;
  if (stateDir) return path.join(stateDir, "libp2p", "agentid-binding.json");
  return path.join(homedir(), ".openclaw", "libp2p", "agentid-binding.json");
}

export async function loadAgentIdBinding(customPath?: string): Promise<AgentIdBindingFile | undefined> {
  const bindingPath = resolveAgentIdBindingPath(customPath);
  try {
    const raw = JSON.parse(await readFile(bindingPath, "utf8")) as unknown;
    const binding = parseBindingFile(raw);
    // Remove the raw user ID written by pre-hash demo builds as soon as the binding is read.
    if (isRecord(raw) && Object.prototype.hasOwnProperty.call(raw, "userId")) await saveAgentIdBinding(binding, customPath);
    return binding;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(`Unable to read AgentID binding at ${bindingPath}: ${errorMessage(error)}`);
  }
}

export async function saveAgentIdBinding(binding: AgentIdBindingFile, customPath?: string): Promise<string> {
  const bindingPath = resolveAgentIdBindingPath(customPath);
  const directory = path.dirname(bindingPath);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  const temporaryPath = path.join(directory, `.${path.basename(bindingPath)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(parseBindingFile(binding), null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryPath, bindingPath);
    return bindingPath;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function unlinkAgentIdBinding(customPath?: string): Promise<boolean> {
  const bindingPath = resolveAgentIdBindingPath(customPath);
  try {
    await rm(bindingPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function refreshAgentIdBinding(
  binding: AgentIdBindingFile,
  options: { config?: AgentIdConfig; fetch?: AgentIdFetch; cache?: AgentIdBindingStatusCache; now?: () => number; force?: boolean } = {},
): Promise<AgentIdBindingFile> {
  const now = options.now ?? Date.now;
  const cache = options.cache ?? defaultBindingStatusCache;
  if (options.force) cache.invalidate(binding.issuer, binding.jti);
  const result = await cache.get(binding.issuer, binding.jti, options.config, options.fetch ?? fetch, now);
  return { ...binding, userIdHash: result.userIdHash ?? binding.userIdHash, status: result.status, lastStatusCheckAt: now() };
}

export async function renewAgentIdBinding(options: AgentIdRenewOptions): Promise<AgentIdBindingFile> {
  const fetchImpl = options.fetch ?? fetch;
  const issuer = normalizeIssuer(options.binding.issuer);
  const challengeResponse = await postJson(fetchImpl, new URL(`/v1/instance-bindings/${encodeURIComponent(options.binding.jti)}/renew/challenge`, `${issuer}/`), {});
  if (!challengeResponse.response.ok || !isRecord(challengeResponse.body)) throw serviceError("renewal challenge", challengeResponse.body);
  const challengeId = getString(challengeResponse.body, "challenge_id");
  const challenge = getString(challengeResponse.body, "challenge");
  const renewed = await postJson(fetchImpl, new URL(`/v1/instance-bindings/${encodeURIComponent(options.binding.jti)}/renew`, `${issuer}/`), {
    challengeId,
    instanceId: options.identity.id,
    instancePublicKey: options.identity.pubkey,
    signature: options.signMessage(challenge),
  });
  if (!renewed.response.ok || !isRecord(renewed.body)) throw serviceError("binding renewal", renewed.body);
  const instanceBinding = getString(renewed.body, "instance_binding");
  const verified = await verifyAgentIdIbc(instanceBinding, { config: options.config ?? { issuer, trustedIssuers: [issuer] }, expected: { agentId: options.binding.agentId, instanceId: options.identity.id, instancePublicKey: options.identity.pubkey }, fetch: fetchImpl, now: options.now });
  if (!verified.valid) throw new Error(`AgentID returned an invalid renewed IBC: ${verified.reason}`);
  return { ...options.binding, issuer, jti: verified.claims.jti, expiresAt: verified.claims.exp, linkedAt: (options.now ?? Date.now)(), instanceBinding, status: "active", lastStatusCheckAt: (options.now ?? Date.now)() };
}

export function serializeAgentIdConnectionPublication(input: {
  jti: string;
  agentId: string;
  instanceId: string;
  instancePublicKey: string;
  peerId: string;
  multiaddrs: string[];
  relayMultiaddrs: string[];
  allowDiscovery: boolean;
  allowDirectDial: boolean;
  timestamp: number;
}): string {
  return JSON.stringify({
    jti: input.jti,
    agentId: input.agentId,
    instanceId: input.instanceId,
    instancePublicKey: input.instancePublicKey,
    peerId: input.peerId,
    multiaddrs: input.multiaddrs,
    relayMultiaddrs: input.relayMultiaddrs,
    allowDiscovery: input.allowDiscovery,
    allowDirectDial: input.allowDirectDial,
    timestamp: input.timestamp,
  });
}

export async function publishAgentIdConnection(options: AgentIdConnectionPublication): Promise<void> {
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const issuer = normalizeIssuer(options.binding.issuer);
  const payload = {
    jti: options.binding.jti,
    agentId: options.binding.agentId,
    instanceId: options.identity.id,
    instancePublicKey: options.identity.pubkey,
    peerId: options.peerId,
    multiaddrs: [...options.multiaddrs],
    relayMultiaddrs: [...(options.relayMultiaddrs ?? [])],
    allowDiscovery: options.allowDiscovery !== false,
    allowDirectDial: options.allowDirectDial !== false,
    timestamp: Math.floor(now() / 1000),
  };
  const response = await postJson(fetchImpl, new URL(`/v1/instance-bindings/${encodeURIComponent(options.binding.jti)}/connection`, `${issuer}/`), {
    ...payload,
    signature: options.signMessage(serializeAgentIdConnectionPublication(payload)),
  });
  if (!response.response.ok || !isRecord(response.body)) throw serviceError("public connection publication", response.body);
}

export function getTrustedAgentIdIssuers(config?: AgentIdConfig): string[] {
  const values = [config?.issuer, ...(config?.trustedIssuers ?? [])];
  const issuers = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !value.trim()) continue;
    try {
      issuers.add(normalizeIssuer(value));
    } catch {
      // Invalid config is not a trust grant.
    }
  }
  return [...issuers];
}

export function getAgentIdEnforcementMode(config?: AgentIdConfig): "compat" | "strict" {
  return config?.mode === "strict" ? "strict" : "compat";
}

export function getAgentIdStatusRefreshIntervalSeconds(config?: AgentIdConfig): number {
  const configured = config?.statusRefreshIntervalSeconds;
  if (typeof configured === "number" && Number.isFinite(configured)) {
    return Math.min(Math.max(Math.floor(configured), 60), 86400);
  }
  return 15 * 60;
}

export function isBindingActiveForIdentity(
  binding: AgentIdBindingFile,
  identity: InstanceIdentity,
  config?: AgentIdConfig,
  now = Date.now(),
): boolean {
  if (binding.status === "revoked" || binding.status === "expired") return false;
  if (binding.expiresAt <= Math.floor(now / 1000)) return false;
  if (binding.instanceId !== identity.id || binding.instancePublicKey !== identity.pubkey) return false;
  if (!getTrustedAgentIdIssuers(config).includes(binding.issuer)) return false;
  try {
    const jws = parseCompactJws(binding.instanceBinding);
    const claims = validateClaims(jws.claims, {
      agentId: binding.agentId,
      instanceId: identity.id,
      instancePublicKey: identity.pubkey,
    }, Math.floor(now / 1000));
    return claims.iss === binding.issuer && claims.jti === binding.jti;
  } catch {
    return false;
  }
}

export async function verifyAgentIdIbc(
  ibc: string,
  options: VerifyAgentIdIbcOptions = {},
): Promise<VerifyAgentIdIbcResult> {
  try {
    const jws = parseCompactJws(ibc);
    if (jws.header.alg !== "EdDSA" || typeof jws.header.kid !== "string" || !jws.header.kid) {
      return { valid: false, reason: "IBC must use EdDSA and a key id" };
    }
    if (jws.header.typ !== "agentid+ibc+jwt") {
      return { valid: false, reason: "IBC has an unexpected type" };
    }

    const now = options.now ?? Date.now;
    const claims = validateClaims(jws.claims, options.expected, Math.floor(now() / 1000));
    const trustedIssuers = getTrustedAgentIdIssuers(options.config);
    if (!trustedIssuers.includes(claims.iss)) {
      return { valid: false, reason: `IBC issuer is not in the configured allowlist: ${claims.iss}` };
    }

    const fetchImpl = options.fetch ?? fetch;
    const keys = await (options.cache ?? defaultJwksCache).get(claims.iss, options.config, fetchImpl, now);
    const key = keys.find(
      (candidate) =>
        candidate.kid === jws.header.kid &&
        candidate.kty === "OKP" &&
        candidate.crv === "Ed25519" &&
        (candidate.use === undefined || candidate.use === "sig") &&
        (candidate.alg === undefined || candidate.alg === "EdDSA"),
    );
    if (!key) return { valid: false, reason: "IBC signing key is not present in the trusted issuer JWKS" };

    const publicKey = createPublicKey({ key, format: "jwk" });
    if (!verify(null, Buffer.from(jws.signingInput), publicKey, jws.signature)) {
      return { valid: false, reason: "IBC signature verification failed" };
    }
    return { valid: true, claims };
  } catch (error) {
    return { valid: false, reason: errorMessage(error) };
  }
}

export async function verifyAgentIdDiscoveryTicket(
  ticket: string,
  options: VerifyAgentIdDiscoveryTicketOptions = {},
): Promise<VerifyAgentIdDiscoveryTicketResult> {
  try {
    const jws = parseCompactJws(ticket);
    if (jws.header.alg !== "EdDSA" || typeof jws.header.kid !== "string" || !jws.header.kid) return { valid: false, reason: "Discovery Ticket must use EdDSA and a key id" };
    if (jws.header.typ !== "agentid+discovery+jwt") return { valid: false, reason: "Discovery Ticket has an unexpected type" };
    const raw = jws.claims;
    const claims: AgentIdDiscoveryTicketClaims = {
      iss: normalizeIssuer(getString(raw, "iss")),
      sub: getString(raw, "sub"),
      aud: getStringOrStringArray(raw, "aud"),
      jti: getString(raw, "jti"),
      peer_id: getString(raw, "peer_id"),
      multiaddrs: getStringArrayAllowEmpty(raw, "multiaddrs"),
      relay_multiaddrs: getStringArrayAllowEmpty(raw, "relay_multiaddrs"),
      allowed_scopes: getStringArray(raw, "allowed_scopes"),
      iat: getSafeInteger(raw, "iat"),
      exp: getSafeInteger(raw, "exp"),
    };
    const now = options.now ?? Date.now;
    const nowSeconds = Math.floor(now() / 1000);
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(AGENTID_AUDIENCE)) return { valid: false, reason: "Discovery Ticket audience is not libp2p-mesh" };
    if (claims.exp <= nowSeconds) return { valid: false, reason: "Discovery Ticket has expired" };
    if (claims.iat > nowSeconds + 300) return { valid: false, reason: "Discovery Ticket issued-at time is too far in the future" };
    if (options.expected?.agentId && claims.sub !== options.expected.agentId) return { valid: false, reason: "Discovery Ticket AgentID does not match the request" };
    if (options.expected?.peerId && claims.peer_id !== options.expected.peerId) return { valid: false, reason: "Discovery Ticket PeerID does not match the request" };
    const trustedIssuers = getTrustedAgentIdIssuers(options.config);
    if (!trustedIssuers.includes(claims.iss)) return { valid: false, reason: `Discovery Ticket issuer is not trusted: ${claims.iss}` };
    const keys = await (options.cache ?? defaultJwksCache).get(claims.iss, options.config, options.fetch ?? fetch, now);
    const key = keys.find((candidate) => candidate.kid === jws.header.kid && candidate.kty === "OKP" && candidate.crv === "Ed25519" && (candidate.use === undefined || candidate.use === "sig") && (candidate.alg === undefined || candidate.alg === "EdDSA"));
    if (!key) return { valid: false, reason: "Discovery Ticket signing key is not trusted" };
    if (!verify(null, Buffer.from(jws.signingInput), createPublicKey({ key, format: "jwk" }), jws.signature)) return { valid: false, reason: "Discovery Ticket signature verification failed" };
    return { valid: true, claims };
  } catch (error) {
    return { valid: false, reason: errorMessage(error) };
  }
}

export function getAgentIdIbcMetadata(ibc: string): VerifiedAgentIdMetadata {
  const jws = parseCompactJws(ibc);
  const claims = validateClaims(jws.claims, undefined, Math.floor(Date.now() / 1000));
  return { agentId: claims.sub, issuer: claims.iss, jti: claims.jti, expiresAt: claims.exp };
}

export async function verifyAgentIdBindingStatus(
  claims: Pick<AgentIdIbcClaims, "iss" | "jti">,
  options: {
    config?: AgentIdConfig;
    fetch?: AgentIdFetch;
    cache?: AgentIdBindingStatusCache;
    now?: () => number;
  } = {},
): Promise<{ valid: true } | { valid: false; reason: string }> {
  try {
    const now = options.now ?? Date.now;
    const status = await (options.cache ?? defaultBindingStatusCache).get(
      claims.iss,
      claims.jti,
      options.config,
      options.fetch ?? fetch,
      now,
    );
    if (status.status !== "active") {
      return { valid: false, reason: `IBC binding is ${status.status}` };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: errorMessage(error) };
  }
}

export async function linkAgentId(options: LinkAgentIdOptions): Promise<AgentIdLinkResult> {
  const issuer = normalizeIssuer(options.issuer);
  const agentId = options.agentId ? requireNonEmpty(options.agentId, "agent id") : undefined;
  if (agentId && options.createAgent) throw new Error("--agent and --create-agent cannot be used together.");
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const requestedScopes = options.scopes ?? ["p2p:announce", "p2p:message"];
  const agentProfile = buildAgentProfileDraft(options.identity, requestedScopes, options.profileAttributes);

  const requested = await postForm(fetchImpl, new URL("/oauth/device_authorization", `${issuer}/`), {
    client_id: AGENTID_AUDIENCE,
    ...(agentId ? { agent_hint: agentId } : {}),
    agent_action: options.createAgent ? "create" : "select",
    instance_id: options.identity.id,
    instance_public_key: options.identity.pubkey,
    instance_label: options.identity.name,
    platform: options.identity.bindingComponents.platform,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: requestedScopes.join(" "),
    agent_profile: JSON.stringify(agentProfile),
  });
  if (!requested.response.ok) throw serviceError("device authorization", requested.body);
  const authorization = parseDeviceAuthorization(requested.body);
  options.onDeviceAuthorization?.(authorization);

  const expiresAt = now() + authorization.expiresIn * 1000;
  let interval = authorization.interval;
  while (now() < expiresAt) {
    await sleep(interval * 1000);
    const token = await postForm(fetchImpl, new URL("/oauth/token", `${issuer}/`), {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: AGENTID_AUDIENCE,
      device_code: authorization.deviceCode,
      code_verifier: verifier,
    });

    if (token.response.ok) {
      if (!isRecord(token.body)) throw new Error("AgentID returned an invalid token response");
      const instanceBinding = getString(token.body, "instance_binding");
      const verified = await verifyAgentIdIbc(instanceBinding, {
        config: { issuer, trustedIssuers: [issuer] },
        expected: {
          ...(agentId ? { agentId } : {}),
          instanceId: options.identity.id,
          instancePublicKey: options.identity.pubkey,
          requiredScope: "p2p:message",
        },
        fetch: fetchImpl,
        cache: options.cache,
        now,
      });
      if (!verified.valid) throw new Error(`AgentID returned an invalid IBC: ${verified.reason}`);
      return {
        authorization,
        binding: {
          version: 1,
          issuer,
          agentId: verified.claims.sub,
          userIdHash: getOptionalString(token.body, "user_id_hash"),
          instanceId: verified.claims.instance_id,
          instancePublicKey: verified.claims.instance_public_key,
          jti: verified.claims.jti,
          expiresAt: verified.claims.exp,
          linkedAt: now(),
          instanceBinding,
        },
      };
    }

    const error = getServiceError(token.body);
    if (error.code === "authorization_pending") continue;
    if (error.code === "slow_down") {
      interval = normalizePollingInterval(error.interval, interval + 5);
      continue;
    }
    throw new Error(`AgentID authorization failed: ${error.message}`);
  }
  throw new Error("AgentID device authorization expired before approval");
}

function normalizeIssuer(value: string): string {
  const parsed = new URL(value.trim());
  if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("AgentID issuer must be an absolute http(s) URL without credentials, query, or fragment");
  }
  return parsed.toString().replace(/\/$/, "");
}

function getJwksUrl(issuer: string): URL {
  const base = new URL(`${issuer}/`);
  return new URL(".well-known/jwks.json", base);
}

function getBindingStatusUrl(issuer: string, jti: string): URL {
  const base = new URL(`${issuer}/`);
  return new URL(`v1/instance-bindings/${encodeURIComponent(jti)}/status`, base);
}

function getJwksTtlMs(config?: AgentIdConfig): number {
  const configured = config?.cache?.jwksTtlMs;
  if (typeof configured === "number" && Number.isFinite(configured) && configured >= 0) {
    return Math.min(configured, 24 * 60 * 60 * 1000);
  }
  return DEFAULT_JWKS_TTL_MS;
}

function getRevocationCacheMaxAgeMs(config?: AgentIdConfig): number {
  const configured = config?.revocationCacheMaxAgeSeconds;
  const seconds =
    typeof configured === "number" && Number.isFinite(configured) && configured >= 0
      ? Math.min(configured, DEFAULT_REVOCATION_CACHE_MAX_AGE_SECONDS)
      : DEFAULT_REVOCATION_CACHE_MAX_AGE_SECONDS;
  return Math.floor(seconds * 1000);
}

function parseBindingStatus(value: unknown): AgentIdBindingStatusCacheEntry["status"] | undefined {
  if (!isRecord(value) || !isRecord(value.binding)) return undefined;
  const status = value.binding.status;
  return status === "active" || status === "revoked" || status === "expired" ? status : undefined;
}

function parseCompactJws(ibc: string): CompactJws {
  if (typeof ibc !== "string" || ibc.length === 0 || ibc.length > MAX_IBC_LENGTH) {
    throw new Error("IBC is missing or exceeds the maximum length");
  }
  const parts = ibc.split(".");
  if (parts.length !== 3 || parts.some((part) => !part || !/^[A-Za-z0-9_-]+$/.test(part))) {
    throw new Error("IBC must be a compact JWS");
  }
  const header = parseBase64UrlJson(parts[0], "IBC header") as CompactJws["header"];
  const claims = parseBase64UrlJson(parts[1], "IBC claims");
  return {
    header,
    claims,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: Buffer.from(parts[2], "base64url"),
  };
}

function parseBase64UrlJson(value: string, description: string): JsonRecord {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!isRecord(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new Error(`${description} is not valid JSON`);
  }
}

function validateClaims(
  raw: JsonRecord,
  expected: VerifyAgentIdIbcOptions["expected"],
  nowSeconds: number,
): AgentIdIbcClaims {
  const iss = normalizeIssuer(getString(raw, "iss"));
  const claims: AgentIdIbcClaims = {
    iss,
    sub: getString(raw, "sub"),
    aud: getStringOrStringArray(raw, "aud"),
    jti: getString(raw, "jti"),
    instance_id: getString(raw, "instance_id"),
    instance_public_key: getString(raw, "instance_public_key"),
    scope: getStringArray(raw, "scope"),
    iat: getSafeInteger(raw, "iat"),
    exp: getSafeInteger(raw, "exp"),
  };
  const userIdHash = getOptionalString(raw, "user_id_hash");
  if (userIdHash !== undefined) claims.user_id_hash = userIdHash;
  if (claims.user_id_hash !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(claims.user_id_hash)) throw new Error("IBC user_id_hash is not a valid HMAC-SHA256 pseudonym");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(AGENTID_AUDIENCE)) throw new Error("IBC audience is not libp2p-mesh");
  if (claims.exp <= nowSeconds) throw new Error("IBC has expired");
  if (claims.iat > nowSeconds + 300) throw new Error("IBC issued-at time is too far in the future");
  if (expected?.agentId && claims.sub !== expected.agentId) throw new Error("IBC agent id does not match the message");
  if (expected?.instanceId && claims.instance_id !== expected.instanceId) throw new Error("IBC instance id does not match the message");
  if (expected?.instancePublicKey && claims.instance_public_key !== expected.instancePublicKey) throw new Error("IBC public key does not match the message");
  if (expected?.requiredScope && !claims.scope.includes(expected.requiredScope)) throw new Error(`IBC is missing ${expected.requiredScope} scope`);
  return claims;
}

function parseBindingFile(value: unknown): AgentIdBindingFile {
  if (!isRecord(value) || value.version !== 1) throw new Error("unsupported binding file format");
  const binding: AgentIdBindingFile = {
    version: 1,
    issuer: normalizeIssuer(getString(value, "issuer")),
    agentId: getString(value, "agentId"),
    instanceId: getString(value, "instanceId"),
    instancePublicKey: getString(value, "instancePublicKey"),
    jti: getString(value, "jti"),
    expiresAt: getSafeInteger(value, "expiresAt"),
    linkedAt: getSafeInteger(value, "linkedAt"),
    instanceBinding: getString(value, "instanceBinding"),
  };
  const userIdHash = getOptionalString(value, "userIdHash");
  if (userIdHash) binding.userIdHash = userIdHash;
  const status = value.status === "active" || value.status === "revoked" || value.status === "expired" ? value.status : undefined;
  if (status) binding.status = status;
  if (typeof value.lastStatusCheckAt === "number") binding.lastStatusCheckAt = value.lastStatusCheckAt;
  if (binding.instanceBinding.length > MAX_IBC_LENGTH) throw new Error("instanceBinding exceeds maximum length");
  return binding;
}

async function postForm(
  fetchImpl: AgentIdFetch,
  url: URL,
  body: Record<string, string | undefined>,
): Promise<{ response: Pick<Response, "ok" | "status" | "json">; body: unknown }> {
  const encoded = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) encoded.set(key, value);
  }
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: encoded.toString(),
    signal: AbortSignal.timeout(10000),
  });
  return { response, body: await response.json().catch(() => undefined) };
}

async function postJson(fetchImpl: AgentIdFetch, url: URL, body: unknown): Promise<{ response: Pick<Response, "ok" | "status" | "json">; body: unknown }> {
  const response = await fetchImpl(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  return { response, body: await response.json().catch(() => undefined) };
}

function parseDeviceAuthorization(value: unknown): DeviceAuthorization {
  if (!isRecord(value)) throw new Error("AgentID returned an invalid device authorization response");
  return {
    requestId: getString(value, "request_id"),
    deviceCode: getString(value, "device_code"),
    verificationUri: getString(value, "verification_uri"),
    verificationUriComplete: getString(value, "verification_uri_complete"),
    expiresIn: getPositiveInteger(value, "expires_in"),
    interval: normalizePollingInterval(value.interval, 5),
  };
}

function serviceError(operation: string, body: unknown): Error {
  const error = getServiceError(body);
  return new Error(`AgentID ${operation} failed: ${error.message}`);
}

function getServiceError(value: unknown): { code: string; message: string; interval?: unknown } {
  if (isRecord(value) && typeof value.error === "string") {
    return {
      code: value.error,
      message: typeof value.error_description === "string" ? value.error_description : value.error,
      interval: value.interval,
    };
  }
  const error = isRecord(value) && isRecord(value.error) ? value.error : value;
  if (!isRecord(error)) return { code: "unknown_error", message: "service returned an invalid response" };
  return {
    code: typeof error.code === "string" ? error.code : "unknown_error",
    message: typeof error.message === "string" ? error.message : "service returned an error",
    interval: error.interval,
  };
}

function getOptionalString(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}

function normalizePollingInterval(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 60
    ? Math.floor(value)
    : fallback;
}

function getString(value: JsonRecord, key: string): string {
  const candidate = value[key];
  if (typeof candidate !== "string" || !candidate.trim() || candidate.length > 4096) {
    throw new Error(`IBC ${key} claim is invalid`);
  }
  return candidate;
}

function getStringOrStringArray(value: JsonRecord, key: string): string | string[] {
  const candidate = value[key];
  if (typeof candidate === "string" && candidate) return candidate;
  if (Array.isArray(candidate) && candidate.length > 0 && candidate.every((entry) => typeof entry === "string" && entry)) {
    return [...candidate] as string[];
  }
  throw new Error(`IBC ${key} claim is invalid`);
}

function getStringArray(value: JsonRecord, key: string): string[] {
  const candidate = value[key];
  if (!Array.isArray(candidate) || candidate.length === 0 || candidate.some((entry) => typeof entry !== "string" || !entry)) {
    throw new Error(`IBC ${key} claim is invalid`);
  }
  return [...candidate] as string[];
}

function getStringArrayAllowEmpty(value: JsonRecord, key: string): string[] {
  const candidate = value[key];
  if (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== "string" || !entry)) {
    throw new Error(`Discovery Ticket ${key} claim is invalid`);
  }
  return [...candidate] as string[];
}

function getSafeInteger(value: JsonRecord, key: string): number {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
    throw new Error(`IBC ${key} claim is invalid`);
  }
  return candidate;
}

function getPositiveInteger(value: JsonRecord, key: string): number {
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate <= 0) {
    throw new Error(`AgentID ${key} is invalid`);
  }
  return candidate;
}

function requireNonEmpty(value: string, description: string): string {
  if (!value || !value.trim()) throw new Error(`AgentID ${description} is required`);
  return value.trim();
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
