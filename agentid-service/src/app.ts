import { createPublicKey, randomUUID, verify } from "node:crypto";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import type { DevelopmentMailbox, MagicLinkDelivery, WebAuthnAdapter } from "./auth.js";
import { expiryIso, hashPassword, hmacSha256, nowIso, randomEmailLoginCode, randomToken, safeEqual, sha256, verifyPassword, type IssuerKey } from "./crypto.js";
import type { AppConfig } from "./config.js";
import { ALLOWED_SCOPES, type Agent, type AgentMember, type AgentProfileDraft, type AgentPublicConnection, type AgentPublicProfile, type AgentRole, type AuditEvent, type BindingRenewalChallenge, type DeviceAuthorization, type DeviceStatus, type InstanceBinding, type NewAuditEvent, type Scope, type Session, type Store, type User } from "./domain.js";
import { AppError, assertPresent } from "./errors.js";
import { logOperationalAlert } from "./alerts.js";
import { MetricsRegistry } from "./metrics.js";

const emailSchema = z.string().trim().email().max(320).transform((email) => email.toLowerCase());
const usernameSchema = z.string().trim().min(3).max(32).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Username may contain letters, numbers, dot, underscore, and hyphen.").transform((username) => username.toLowerCase());
const passwordSchema = z.string().min(8).max(128);
const identifierSchema = z.string().trim().min(3).max(320);
const nameSchema = z.string().trim().min(1).max(120);
const optionalReasonSchema = z.string().trim().min(1).max(500).optional();
const idempotencyKeySchema = z.string().trim().min(1).max(255);
const deviceFormSchema = z.object({
  client_id: z.string().trim().min(1).max(200),
  scope: z.string().trim().max(500).optional(),
  agent_hint: z.string().trim().min(1).max(200).optional(),
  agent_action: z.enum(["select", "create"]).default("select"),
  instance_id: z.string().trim().min(1).max(512),
  instance_public_key: z.string().trim().min(1).max(4096),
  instance_label: z.string().trim().min(1).max(128),
  platform: z.string().trim().min(1).max(128),
  agent_profile: z.string().trim().max(16000).optional(),
  code_challenge: z.string().trim().min(43).max(256),
  code_challenge_method: z.literal("S256"),
});
const agentProfileDraftSchema = z.object({
  summary: z.string().trim().max(500),
  role: z.string().trim().max(120),
  language: z.string().trim().max(80),
  attributes: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(120),
    kind: z.enum(["capability", "tag", "context"]),
  })).max(40),
});
const tokenFormSchema = z.object({
  grant_type: z.literal("urn:ietf:params:oauth:grant-type:device_code"),
  client_id: z.string().trim().min(1).max(200),
  device_code: z.string().trim().min(1).max(512),
  code_verifier: z.string().trim().min(43).max(256),
});
const magicLinkSchema = z.object({ email: emailSchema, returnTo: z.string().max(2048).optional() });
const accountRegistrationSchema = z.object({ username: usernameSchema, email: emailSchema, password: passwordSchema, displayName: nameSchema.optional() });
const passwordLoginSchema = z.object({ identifier: identifierSchema, password: passwordSchema });
const consumeSchema = z.object({ token: z.string().trim().min(1).max(512) });
const emailCodeConsumeSchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) });
const recoverySchema = z.object({ email: emailSchema, newPassword: passwordSchema });
const agentSchema = z.object({ name: nameSchema });
const publicAttributeSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(120),
  kind: z.enum(["capability", "tag", "context"]),
  trust: z.enum(["self_declared", "verified"]),
  visible: z.boolean(),
});
const publicProfileSchema = z.object({
  summary: z.string().trim().max(500),
  role: z.string().trim().max(120),
  language: z.string().trim().max(80),
  attributes: z.array(publicAttributeSchema).max(40),
  published: z.boolean(),
  connection: z.object({
    allowDiscovery: z.boolean(),
    allowDirectDial: z.boolean(),
    peerId: z.string().trim().min(1).max(256).nullable(),
    multiaddrs: z.array(z.string().trim().min(1).max(2048)).max(32),
    relayMultiaddrs: z.array(z.string().trim().min(1).max(2048)).max(16),
  }).optional(),
});
const connectionPublicationSchema = z.object({
  jti: z.string().trim().min(1).max(200),
  agentId: z.string().trim().min(1).max(200),
  instanceId: z.string().trim().min(1).max(512),
  instancePublicKey: z.string().trim().min(1).max(4096),
  peerId: z.string().trim().min(1).max(256),
  multiaddrs: z.array(z.string().trim().min(1).max(2048)).max(32),
  relayMultiaddrs: z.array(z.string().trim().min(1).max(2048)).max(16),
  allowDiscovery: z.boolean(),
  allowDirectDial: z.boolean(),
  timestamp: z.number().int(),
  signature: z.string().trim().min(1).max(4096),
});
const memberSchema = z.object({ email: emailSchema, role: z.enum(["admin", "viewer"]) });
const memberRoleSchema = z.object({ role: z.enum(["admin", "viewer"]) });
const approvalActionSchema = z.object({ agentId: z.string().trim().min(1).max(200).optional(), reason: optionalReasonSchema });
const revokeSchema = z.object({ reason: optionalReasonSchema });
const renewalSchema = z.object({ challengeId: z.string().uuid(), instanceId: z.string().min(1).max(512), instancePublicKey: z.string().min(1).max(4096), signature: z.string().min(1).max(4096) });
const webAuthnVerifySchema = z.object({ challengeId: z.string().uuid(), response: z.unknown() });
const webAuthnAuthenticationOptionsSchema = z.object({ identifier: identifierSchema.optional(), email: emailSchema.optional() }).refine((body) => body.identifier || body.email, "Username or email is required.");

export interface AppDependencies {
  config: AppConfig;
  store: Store;
  issuerKey: IssuerKey;
  magicLinkDelivery: MagicLinkDelivery;
  webAuthn: WebAuthnAdapter;
}

async function publicUser(user: User, dependencies: AppDependencies): Promise<Omit<User, "passwordHash" | "emailVerifiedAt"> & { passkeyEnrolled: boolean }> {
  const passkeyEnrolled = (await dependencies.store.listCredentialsForUser(user.id)).length > 0;
  return { id: user.id, username: user.username, email: user.email, displayName: user.displayName, createdAt: user.createdAt, passkeyEnrolled };
}

async function findUserByIdentifier(store: Store, identifier: string): Promise<User | null> {
  const byUsername = await store.getUserByUsername(identifier);
  if (byUsername) return byUsername;
  return identifier.includes("@") ? store.getUserByEmail(identifier.toLowerCase()) : null;
}

function publicAgent(agent: Agent): Agent {
  return { ...agent };
}

function publicDirectoryAgent(agent: Agent): Omit<Agent, "ownerId"> {
  const { ownerId: _ownerId, ...safeAgent } = agent;
  return safeAgent;
}

function defaultPublicProfile(agentId: string, published = false, scopes: Scope[] = [], draft: AgentProfileDraft | null = null, platform = "", instanceLabel = ""): AgentPublicProfile {
  const attributes: AgentPublicProfile["attributes"] = scopes.map((scope) => ({
    key: scope,
    label: "通信权限",
    value: scope,
    kind: "capability" as const,
    trust: "verified" as const,
    visible: true,
  }));
  const verifiedKeys = new Set(attributes.map((attribute) => `${attribute.key}:${attribute.value}`));
  const automaticAttributes: AgentPublicProfile["attributes"] = scopes.length ? [
    { key: "agent-discovery", label: "发现能力", value: "agent-discovery", kind: "capability", trust: "self_declared", visible: true },
    { key: "identity-verification", label: "身份能力", value: "identity-verification", kind: "capability", trust: "self_declared", visible: true },
    { key: "p2p-mesh", label: "网络能力", value: "p2p-mesh", kind: "capability", trust: "self_declared", visible: true },
    { key: "openclaw", label: "运行生态", value: "openclaw", kind: "tag", trust: "self_declared", visible: true },
    { key: "libp2p", label: "网络协议", value: "libp2p", kind: "tag", trust: "self_declared", visible: true },
    { key: "runtime", label: "运行时", value: "OpenClaw Gateway", kind: "context", trust: "self_declared", visible: true },
    { key: "transport", label: "通信传输", value: "libp2p", kind: "context", trust: "self_declared", visible: true },
    ...(platform ? [{ key: "platform", label: "运行平台", value: platform, kind: "context" as const, trust: "self_declared" as const, visible: true }] : []),
    ...(instanceLabel ? [{ key: "instance", label: "实例名称", value: instanceLabel, kind: "context" as const, trust: "self_declared" as const, visible: true }] : []),
  ] : [];
  for (const attribute of automaticAttributes) {
    if (!verifiedKeys.has(`${attribute.key}:${attribute.value}`)) attributes.push(attribute);
  }
  for (const attribute of draft?.attributes ?? []) {
    const key = `${attribute.key}:${attribute.value}`;
    if (verifiedKeys.has(key)) continue;
    attributes.push({ ...attribute, trust: "self_declared", visible: true });
  }
  return {
    agentId,
    summary: draft?.summary || (scopes.length ? `OpenClaw Agent${instanceLabel ? ` on ${instanceLabel}` : ""}，支持 P2P 发现、身份验证和安全消息通信。` : ""),
    role: draft?.role || (scopes.length ? "OpenClaw P2P Agent" : ""),
    language: draft?.language || (scopes.length ? "OpenClaw / TypeScript" : ""),
    attributes,
    published,
    connection: { allowDiscovery: false, allowDirectDial: false, peerId: null, multiaddrs: [], relayMultiaddrs: [] },
    updatedAt: nowIso(),
  };
}

function managedPublicProfile(profile: AgentPublicProfile): AgentPublicProfile {
  return { ...profile, connection: profile.connection ? { ...profile.connection, multiaddrs: [...profile.connection.multiaddrs], relayMultiaddrs: [...profile.connection.relayMultiaddrs] } : undefined, attributes: uniquePublicAttributes(profile.attributes) };
}

function uniquePublicAttributes(attributes: AgentPublicProfile["attributes"]): AgentPublicProfile["attributes"] {
  const seen = new Set<string>();
  return attributes.filter((attribute) => {
    const key = `${attribute.kind}:${attribute.key}:${attribute.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((attribute) => ({ ...attribute }));
}

function publicProfile(profile: AgentPublicProfile): AgentPublicProfile {
  const connection = profile.connection?.allowDiscovery
    ? {
        allowDiscovery: true,
        allowDirectDial: profile.connection.allowDirectDial,
        peerId: profile.connection.peerId,
        multiaddrs: profile.connection.allowDirectDial ? [...profile.connection.multiaddrs] : [],
        relayMultiaddrs: [...profile.connection.relayMultiaddrs],
      }
    : { allowDiscovery: false, allowDirectDial: false, peerId: null, multiaddrs: [], relayMultiaddrs: [] };
  return {
    ...profile,
    connection,
    attributes: uniquePublicAttributes(profile.attributes).filter((attribute) => attribute.visible).map((attribute) => ({ ...attribute, visible: true })),
  };
}

function publicMember(member: AgentMember): AgentMember {
  return { ...member };
}

function publicBinding(binding: InstanceBinding): Record<string, unknown> {
  return {
    jti: binding.jti,
    agentId: binding.agentId,
    instanceId: binding.instanceId,
    instanceLabel: binding.instanceLabel,
    platform: binding.platform,
    publicKeyFingerprint: binding.publicKeyFingerprint,
    scopes: binding.scopes,
    status: binding.status,
    issuedAt: binding.issuedAt,
    expiresAt: binding.expiresAt,
    revokedAt: binding.revokedAt,
    revocationReason: binding.revocationReason,
  };
}

function userIdHash(userId: string, dependencies: AppDependencies): string {
  return hmacSha256(userId, dependencies.config.userIdHashSecret);
}

function serializeConnectionPublication(body: z.infer<typeof connectionPublicationSchema>): string {
  return JSON.stringify({
    jti: body.jti,
    agentId: body.agentId,
    instanceId: body.instanceId,
    instancePublicKey: body.instancePublicKey,
    peerId: body.peerId,
    multiaddrs: body.multiaddrs,
    relayMultiaddrs: body.relayMultiaddrs,
    allowDiscovery: body.allowDiscovery,
    allowDirectDial: body.allowDirectDial,
    timestamp: body.timestamp,
  });
}

function verifyConnectionPublication(body: z.infer<typeof connectionPublicationSchema>): boolean {
  try {
    const publicKey = createPublicKey({ key: Buffer.from(body.instancePublicKey, "base64url"), format: "der", type: "spki" });
    return verify(null, Buffer.from(serializeConnectionPublication(body)), publicKey, Buffer.from(body.signature, "base64url"));
  } catch {
    return false;
  }
}

function publicApproval(authorization: DeviceAuthorization, allowedActions: string[]): Record<string, unknown> {
  return {
    id: authorization.id,
    agentId: authorization.agentId,
    agentHint: authorization.agentHint,
    agentCreationRequested: authorization.agentCreationRequested,
    proposedAgentId: authorization.agentHint ?? `did:agentid:agt_${authorization.id.replaceAll("-", "").slice(0, 24)}`,
    instanceId: authorization.instanceId,
    instanceLabel: authorization.instanceLabel,
    platform: authorization.platform,
    publicKeyFingerprint: authorization.publicKeyFingerprint,
    requestedScopes: authorization.scopes,
    agentProfile: authorization.agentProfile,
    status: authorization.status,
    createdAt: authorization.createdAt,
    expiresAt: authorization.expiresAt,
    decidedAt: authorization.decidedAt,
    decisionReason: authorization.decisionReason,
    allowedActions,
  };
}

function publicActivity(event: AuditEvent): Record<string, unknown> {
  return { id: event.id, actorUserId: event.actorUserId, agentId: event.agentId, instanceId: event.instanceId, bindingJti: event.bindingJti, action: event.action, detail: event.detail, createdAt: event.createdAt, previousHash: event.previousHash, eventHash: event.eventHash };
}

function isManager(role: AgentRole | null): boolean {
  return role === "owner" || role === "admin";
}

async function authenticatedSession(request: FastifyRequest, dependencies: AppDependencies): Promise<{ user: User; session: Session }> {
  const token = request.cookies[dependencies.config.sessionCookieName];
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "A valid session is required.");
  const session = await dependencies.store.getSessionByTokenHash(sha256(token));
  if (!session || Date.parse(session.expiresAt) <= Date.now()) throw new AppError(401, "UNAUTHENTICATED", "Session has expired.");
  return { session, user: assertPresent(await dependencies.store.getUser(session.userId), 401, "UNAUTHENTICATED", "Session user no longer exists.") };
}

async function requireUser(request: FastifyRequest, dependencies: AppDependencies): Promise<User> {
  return (await authenticatedSession(request, dependencies)).user;
}

async function ensureManager(store: Store, agentId: string, userId: string): Promise<void> {
  if (!isManager(await store.getMemberRole(agentId, userId))) throw new AppError(403, "FORBIDDEN", "You cannot manage this Agent.");
}

async function ensureViewer(store: Store, agentId: string, userId: string): Promise<void> {
  if (!(await store.getMemberRole(agentId, userId))) throw new AppError(403, "FORBIDDEN", "You cannot view this Agent.");
}

function safeReturnTo(value: string | undefined, config: AppConfig): string {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const parsed = new URL(value);
    if (parsed.origin === config.webOrigin) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    // Invalid return paths are discarded rather than reflected.
  }
  throw new AppError(400, "INVALID_RETURN_TO", "returnTo must stay on the configured web origin.");
}

function setSession(reply: FastifyReply, dependencies: AppDependencies, token: string): void {
  // GitHub Pages and the demo API use different origins. Lax cookies are not
  // sent on the cross-site fetches used by the console, so the session would
  // disappear immediately after a successful email-code exchange.
  const crossSiteSession = [...dependencies.config.allowedWebOrigins].some((allowedOrigin) => allowedOrigin !== dependencies.config.issuerUrl);
  reply.setCookie(dependencies.config.sessionCookieName, token, {
    httpOnly: true,
    secure: crossSiteSession || dependencies.config.webOrigin.startsWith("https://"),
    sameSite: crossSiteSession ? "none" : "lax",
    path: "/",
    maxAge: Math.floor(dependencies.config.sessionTtlMs / 1000),
  });
}

async function createSession(reply: FastifyReply, userId: string, dependencies: AppDependencies, verifiedAt: string | null = null): Promise<void> {
  const token = randomToken();
  const createdAt = nowIso();
  await dependencies.store.createSession({ id: randomUUID(), userId, tokenHash: sha256(token), expiresAt: expiryIso(dependencies.config.sessionTtlMs), verifiedAt, createdAt });
  setSession(reply, dependencies, token);
}

function formBody(request: FastifyRequest): Record<string, unknown> {
  if (typeof request.body !== "object" || request.body === null || Array.isArray(request.body)) {
    throw new AppError(400, "INVALID_REQUEST", "Form fields are required.");
  }
  return request.body as Record<string, unknown>;
}

function parseScopes(value: string | undefined): Scope[] {
  const scopes = value ? value.split(/\s+/).filter(Boolean) : [...ALLOWED_SCOPES];
  if (!scopes.length || scopes.some((scope) => !ALLOWED_SCOPES.includes(scope as Scope)) || new Set(scopes).size !== scopes.length) {
    throw new AppError(400, "INVALID_SCOPE", "One or more requested scopes are not allowed.");
  }
  return scopes as Scope[];
}

function expireAuthorization(authorization: DeviceAuthorization): boolean {
  if (authorization.status === "pending" && Date.parse(authorization.expiresAt) <= Date.now()) {
    authorization.status = "expired";
    return true;
  }
  return false;
}

function expireBinding(binding: InstanceBinding): boolean {
  if (binding.status === "active" && Date.parse(binding.expiresAt) <= Date.now()) {
    binding.status = "expired";
    return true;
  }
  return false;
}

function event(input: Omit<NewAuditEvent, "id" | "createdAt">): NewAuditEvent {
  return { id: randomUUID(), createdAt: nowIso(), ...input };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function idempotent(
  store: Store,
  scope: string,
  key: string,
  body: unknown,
  action: (transaction: Store) => Promise<{ status: number; body: Record<string, unknown> }>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const requestHash = sha256(stableJson(body));
  return store.transaction(async (transaction) => {
    await transaction.lockIdempotency(scope, key);
    const existing = await transaction.getIdempotency(scope, key);
    if (existing) {
      if (!safeEqual(existing.requestHash, requestHash)) throw new AppError(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was already used with a different request.");
      return { status: existing.responseStatus, body: existing.responseBody };
    }
    const result = await action(transaction);
    await transaction.createIdempotency({ scope, key, requestHash, responseStatus: result.status, responseBody: result.body });
    return result;
  });
}

function idempotencyHeader(request: FastifyRequest): string {
  const header = request.headers["idempotency-key"];
  if (typeof header !== "string") throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required.");
  return idempotencyKeySchema.parse(header);
}

async function canReadApproval(store: Store, authorization: DeviceAuthorization, userId: string): Promise<boolean> {
  const selectedAgent = authorization.agentId ?? authorization.agentHint;
  if (selectedAgent && (await store.getMemberRole(selectedAgent, userId))) return true;
  // The UUID is a high-entropy, single-use deep-link capability for an unassigned request.
  if (authorization.status === "pending" && !selectedAgent) return true;
  return false;
}

async function approvalActions(store: Store, authorization: DeviceAuthorization, userId: string, directCode: boolean): Promise<string[]> {
  const selectedAgent = authorization.agentId ?? authorization.agentHint;
  if (authorization.status !== "pending") return authorization.status === "approved" || authorization.status === "exchanged" ? ["revoke"] : [];
  if (selectedAgent && isManager(await store.getMemberRole(selectedAgent, userId))) return ["approve", "deny"];
  return directCode ? ["approve", "deny"] : [];
}

function oauthError(reply: FastifyReply, code: string, description: string, interval?: number): FastifyReply {
  return reply.code(400).send({ error: code, error_description: description, ...(interval ? { interval } : {}) });
}

function deviceLink(config: AppConfig, authorization: DeviceAuthorization): string {
  const url = new URL("device", config.webBaseUrl);
  url.searchParams.set("request_id", authorization.id);
  return url.toString();
}

function responseCredentialId(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AppError(400, "INVALID_WEBAUTHN_RESPONSE", "WebAuthn response is invalid.");
  const id = Reflect.get(value, "id");
  if (typeof id !== "string" || !id) throw new AppError(400, "INVALID_WEBAUTHN_RESPONSE", "WebAuthn credential id is required.");
  return id;
}

export async function buildApp(dependencies: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 64 * 1024, trustProxy: true });
  const metrics = new MetricsRegistry();
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginEmbedderPolicy: false });
  await app.register(formbody);
  await app.register(cors, {
    credentials: true,
    origin: (origin, callback) => callback(null, origin !== undefined && dependencies.config.allowedWebOrigins.has(origin) ? origin : false),
    allowedHeaders: ["content-type", "idempotency-key", "x-agentid-request"],
  });
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => {
      const error = new Error("Too many requests. Retry later.");
      Object.assign(error, { code: "RATE_LIMITED", statusCode: context.statusCode, retryAfterSeconds: Math.ceil(context.ttl / 1000) });
      return error;
    },
  });

  app.addHook("onResponse", async (request, reply) => {
    const route = request.routeOptions.url ?? request.url.split("?", 1)[0] ?? "unknown";
    const statusClass = `${Math.floor(reply.statusCode / 100)}xx`;
    metrics.increment("agentid_http_requests_total", "Total HTTP requests handled by status class.", 1, { method: request.method, route, status_class: statusClass });
    if (reply.statusCode === 429) {
      metrics.increment("agentid_rate_limited_total", "Total requests rejected by rate limiting.", 1, { route });
      logOperationalAlert("rate_limit_exceeded", { route, method: request.method });
    }
  });

  app.addHook("onRequest", async (request) => {
    if (!request.url.startsWith("/v1/") || !["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
    // Device renewal is an instance-authenticated machine-to-machine flow. It has no browser session,
    // and the final step is protected by a one-time challenge plus the InstanceIdentity signature.
    if (/^\/v1\/instance-bindings\/[^/]+\/(?:renew(?:\/challenge)?|connection)$/.test(request.url.split("?", 1)[0] ?? "")) return;
    const origin = request.headers.origin;
    if (typeof origin !== "string" || !dependencies.config.allowedWebOrigins.has(origin)) {
      throw new AppError(403, "CSRF_ORIGIN_MISMATCH", "Website mutations require an allowed Origin.");
    }
    if (request.headers["x-agentid-request"] !== "1") {
      throw new AppError(403, "CSRF_REQUEST_HEADER_REQUIRED", "Website mutations require the AgentID request header.");
    }
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof Reflect.get(error, "statusCode") === "number" ? Reflect.get(error, "statusCode") as number : error instanceof AppError ? error.statusCode : error instanceof ZodError ? 400 : 500;
    if (request.url.startsWith("/v1/auth/") && statusCode >= 400) {
      const kind = request.url.includes("webauthn") || request.url.includes("passkey") ? "passkey" : "verification";
      metrics.increment("agentid_auth_failures_total", "Total authentication and passkey failures.", 1, { kind });
      logOperationalAlert("auth_failure", { kind });
    }
    if (request.url.includes("/renew") && statusCode >= 400) {
      metrics.increment("agentid_ibc_renewals_total", "IBC renewal outcomes.", 1, { result: "failure" });
      logOperationalAlert("ibc_renewal_failed", { resource: "instance_binding" });
    }
    if (statusCode === 429) metrics.increment("agentid_rate_limited_total", "Total requests rejected by rate limiting.", 1, { route: request.routeOptions.url ?? "unknown" });
    if (error instanceof AppError) return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    if (error instanceof ZodError) return reply.code(400).send({ error: { code: "INVALID_REQUEST", message: "Request body or parameters are invalid." } });
    const databaseCode = typeof error === "object" && error !== null && "code" in error ? Reflect.get(error, "code") : undefined;
    if (databaseCode === "23505") return reply.code(409).send({ error: { code: "CONFLICT", message: "A resource with this identifier already exists." } });
    if (databaseCode === "23505" || statusCode >= 500) {
      metrics.increment("agentid_database_errors_total", "Total database or persistence errors.");
      logOperationalAlert("database_error", { route: request.routeOptions.url ?? "unknown", method: request.method });
    }
    if (statusCode === 429) {
      const retryAfterSeconds = typeof error === "object" && error !== null && "retryAfterSeconds" in error ? Reflect.get(error, "retryAfterSeconds") : undefined;
      return reply.code(429).send({ error: { code: "RATE_LIMITED", message: "Too many requests. Retry later.", ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {}) } });
    }
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } });
  });
  app.addHook("onClose", async () => dependencies.store.close());

  metrics.setGauge("agentid_process_start_time_seconds", "Unix timestamp when the service process started.", metrics.startedAtSeconds);
  metrics.setGauge("agentid_build_info", "Service build information.", 1, { version: dependencies.config.version, node_env: dependencies.config.nodeEnv });

  app.get("/health", async () => ({ status: "ok", issuer: dependencies.config.issuerUrl, version: dependencies.config.version }));
  app.get("/health/live", async () => ({ status: "ok", version: dependencies.config.version }));
  app.get("/health/ready", async (_request, reply) => {
    const checks = { database: false, migrations: false, issuer: false };
    try {
      checks.issuer = Boolean(dependencies.issuerKey.jwk?.kid && typeof dependencies.issuerKey.signClaims === "function");
      const health = await dependencies.store.checkHealth();
      checks.database = health.database;
      checks.migrations = health.migrations;
      if (!checks.issuer || !checks.database || !checks.migrations) return reply.code(503).send({ status: "not_ready", checks });
      return { status: "ready", checks, version: dependencies.config.version };
    } catch {
      if (!checks.database || !checks.migrations) metrics.increment("agentid_database_errors_total", "Total database or persistence errors.");
      logOperationalAlert("readiness_check_failed", { database: checks.database, migrations: checks.migrations, issuer: checks.issuer });
      return reply.code(503).send({ status: "not_ready", checks });
    }
  });
  app.get("/metrics", async (request, reply) => {
    const normalizedIp = request.ip.replace(/^::ffff:/, "");
    if (!dependencies.config.metricsAllowedIps.has(request.ip) && !dependencies.config.metricsAllowedIps.has(normalizedIp)) throw new AppError(404, "NOT_FOUND", "Not found.");
    try {
      metrics.setGauge("agentid_pending_authorizations", "Current non-expired pending device authorizations.", await dependencies.store.countPendingAuthorizations());
    } catch {
      metrics.increment("agentid_database_errors_total", "Total database or persistence errors.");
      logOperationalAlert("metrics_database_read_failed", { resource: "pending_authorizations" });
    }
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(metrics.render());
  });
  app.get("/.well-known/jwks.json", async (_request, reply) => {
    reply.header("cache-control", "public, max-age=3600");
    return { keys: [dependencies.issuerKey.jwk] };
  });

  app.post("/oauth/device_authorization", { config: { rateLimit: { max: dependencies.config.rateLimits.oauthDevice.max, timeWindow: dependencies.config.rateLimits.oauthDevice.timeWindowMs } } }, async (request, reply) => {
    let body: z.infer<typeof deviceFormSchema>;
    try {
      if (!request.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) return oauthError(reply, "invalid_request", "This endpoint requires application/x-www-form-urlencoded.");
      body = deviceFormSchema.parse(formBody(request));
    } catch {
      return oauthError(reply, "invalid_request", "Device authorization form is invalid.");
    }
    if (body.client_id !== dependencies.config.clientId) return oauthError(reply, "invalid_client", "Unsupported client_id.");
    if (body.agent_action === "create" && body.agent_hint) return oauthError(reply, "invalid_request", "agent_hint cannot be combined with agent_action=create.");
    if (body.agent_hint && !(await dependencies.store.getAgent(body.agent_hint))) return oauthError(reply, "invalid_request", "agent_hint does not identify an Agent.");
    let agentProfile: AgentProfileDraft | null = null;
    if (body.agent_profile) {
      try {
        agentProfile = agentProfileDraftSchema.parse(JSON.parse(body.agent_profile));
      } catch {
        return oauthError(reply, "invalid_request", "agent_profile is invalid.");
      }
    }
    const authorization: DeviceAuthorization = {
      id: randomUUID(), clientId: body.client_id, agentHint: body.agent_hint ?? null, agentCreationRequested: body.agent_action === "create", agentId: null, instanceId: body.instance_id,
      instancePublicKey: body.instance_public_key, publicKeyFingerprint: sha256(body.instance_public_key).slice(0, 16), instanceLabel: body.instance_label,
      platform: body.platform, scopes: parseScopes(body.scope), agentProfile, codeChallenge: body.code_challenge, deviceCodeHash: sha256(randomToken()),
      pollIntervalSeconds: 5, lastPolledAt: null, status: "pending", decisionReason: null, decidedAt: null, decidedByUserId: null,
      bindingJti: null, exchangedAt: null, createdAt: nowIso(), expiresAt: expiryIso(dependencies.config.deviceAuthorizationTtlMs),
    };
    const deviceCode = randomToken();
    authorization.deviceCodeHash = sha256(deviceCode);
    await dependencies.store.transaction(async (store) => {
      await store.createDeviceAuthorization(authorization);
      await store.addAuditEvent(event({ actorUserId: null, agentId: authorization.agentHint, instanceId: authorization.instanceId, bindingJti: null, action: "device_authorization_requested", detail: { clientId: authorization.clientId } }));
    });
    metrics.increment("agentid_oauth_device_authorizations_total", "OAuth device authorization requests.", 1, { result: "created" });
    const verificationUriComplete = deviceLink(dependencies.config, authorization);
    return reply.code(200).send({ request_id: authorization.id, device_code: deviceCode, verification_uri: new URL("device", dependencies.config.webBaseUrl).toString(), verification_uri_complete: verificationUriComplete, expires_in: Math.floor(dependencies.config.deviceAuthorizationTtlMs / 1000), interval: authorization.pollIntervalSeconds });
  });

  app.post("/oauth/token", { config: { rateLimit: { max: dependencies.config.rateLimits.oauthToken.max, timeWindow: dependencies.config.rateLimits.oauthToken.timeWindowMs } } }, async (request, reply) => {
    let body: z.infer<typeof tokenFormSchema>;
    try {
      if (!request.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) return oauthError(reply, "invalid_request", "This endpoint requires application/x-www-form-urlencoded.");
      body = tokenFormSchema.parse(formBody(request));
    } catch {
      return oauthError(reply, "invalid_request", "Token form is invalid.");
    }
    if (body.client_id !== dependencies.config.clientId) return oauthError(reply, "invalid_client", "Unsupported client_id.");
    const result = await dependencies.store.transaction(async (store) => {
      const authorization = await store.getDeviceAuthorizationByCodeHashForUpdate(sha256(body.device_code));
      if (!authorization) return { error: "invalid_grant", description: "Unknown device code." } as const;
      if (!safeEqual(authorization.codeChallenge, sha256(body.code_verifier))) return { error: "invalid_grant", description: "PKCE verification failed." } as const;
      if (expireAuthorization(authorization)) await store.saveDeviceAuthorization(authorization);
      if (authorization.status === "pending") {
        const now = Date.now();
        if (authorization.lastPolledAt && now - Date.parse(authorization.lastPolledAt) < authorization.pollIntervalSeconds * 1000) {
          authorization.pollIntervalSeconds = Math.min(authorization.pollIntervalSeconds + 5, 30);
          authorization.lastPolledAt = new Date(now).toISOString();
          await store.saveDeviceAuthorization(authorization);
          return { error: "slow_down", description: "Polling too quickly.", interval: authorization.pollIntervalSeconds } as const;
        }
        authorization.lastPolledAt = new Date(now).toISOString();
        await store.saveDeviceAuthorization(authorization);
        return { error: "authorization_pending", description: "Authorization is still pending." } as const;
      }
      if (authorization.status === "denied") return { error: "access_denied", description: "Authorization was denied." } as const;
      if (authorization.status === "expired") return { error: "expired_token", description: "Authorization request has expired." } as const;
      if (authorization.status === "revoked") return { error: "invalid_grant", description: "Authorization was revoked." } as const;
      if (authorization.status === "exchanged") return { error: "invalid_grant", description: "Device code was already exchanged." } as const;
      const binding = authorization.bindingJti ? await store.getBinding(authorization.bindingJti) : null;
      if (!binding || binding.status !== "active") return { error: "invalid_grant", description: "Instance binding is not active." } as const;
      authorization.status = "exchanged";
      authorization.exchangedAt = nowIso();
      await store.saveDeviceAuthorization(authorization);
      await store.addAuditEvent(event({ actorUserId: null, agentId: binding.agentId, instanceId: binding.instanceId, bindingJti: binding.jti, action: "instance_binding_exchanged", detail: {} }));
      return { binding } as const;
    });
    if ("error" in result && result.error) {
      metrics.increment("agentid_oauth_token_exchanges_total", "OAuth device-code token exchange outcomes.", 1, { result: result.error });
      return oauthError(reply, result.error, result.description, "interval" in result ? result.interval : undefined);
    }
    metrics.increment("agentid_oauth_token_exchanges_total", "OAuth device-code token exchange outcomes.", 1, { result: "success" });
    return { token_type: "Instance-Binding", instance_binding: result.binding.ibc, ibc: result.binding.ibc, user_id_hash: userIdHash(result.binding.approvedByUserId, dependencies), expires_in: Math.max(0, Math.floor((Date.parse(result.binding.expiresAt) - Date.now()) / 1000)), binding: publicBinding(result.binding) };
  });

  app.post("/v1/auth/register", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = accountRegistrationSchema.parse(request.body);
    const registration = await dependencies.store.transaction(async (store) => {
      if (await store.getUserByUsername(body.username)) throw new AppError(409, "USERNAME_ALREADY_EXISTS", "This username is already registered.");
      if (await store.getUserByEmail(body.email)) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "This email is already bound to an account.");
      const createdAt = nowIso();
      const created: User = {
        id: `usr_${randomToken(16)}`,
        username: body.username,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        displayName: body.displayName?.trim() || body.username,
        createdAt,
        emailVerifiedAt: null,
      };
      await store.createUser(created);
      const token = randomToken();
      const code = randomEmailLoginCode();
      const link = { id: randomUUID(), userId: created.id, purpose: "registration" as const, targetEmail: body.email, tokenHash: sha256(token), verificationCodeHash: sha256(code), returnTo: "/", expiresAt: expiryIso(dependencies.config.magicLinkTtlMs), consumedAt: null, createdAt };
      await store.createMagicLink(link);
      return { link, code, token };
    });
    const url = new URL("/v1/auth/magic-link/consume", dependencies.config.issuerUrl);
    url.searchParams.set("token", registration.token);
    url.searchParams.set("purpose", "registration");
    await dependencies.magicLinkDelivery.send({ email: body.email, url: url.toString(), code: registration.code, expiresAt: registration.link.expiresAt });
    return reply.code(202).send({ status: "verification_required", expiresAt: registration.link.expiresAt, delivery: dependencies.config.emailProvider === "console" ? "console" : "email" });
  });

  app.post("/v1/auth/register/verify", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = emailCodeConsumeSchema.parse(request.body);
    const registration = await dependencies.store.transaction((store) => store.consumeMagicLinkByCode(body.email, sha256(body.code), nowIso(), "registration"));
    if (!registration) throw new AppError(400, "INVALID_REGISTRATION_CODE", "The registration code is invalid, expired, or has already been used.");
    const user = assertPresent(await dependencies.store.getUser(registration.userId), 401, "UNAUTHENTICATED", "Registration account no longer exists.");
    await dependencies.store.markUserEmailVerified(user.id, nowIso());
    await createSession(reply, user.id, dependencies);
    return { user: await publicUser({ ...user, emailVerifiedAt: nowIso() }, dependencies), verified: true };
  });

  app.post("/v1/auth/register/resend", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = magicLinkSchema.parse(request.body);
    const user = await dependencies.store.getUserByEmail(body.email);
    const expiresAt = expiryIso(dependencies.config.magicLinkTtlMs);
    if (user && user.emailVerifiedAt === null) {
      const token = randomToken();
      const code = randomEmailLoginCode();
      const link = { id: randomUUID(), userId: user.id, purpose: "registration" as const, targetEmail: body.email, tokenHash: sha256(token), verificationCodeHash: sha256(code), returnTo: "/", expiresAt, consumedAt: null, createdAt: nowIso() };
      await dependencies.store.createMagicLink(link);
      const url = new URL("/v1/auth/magic-link/consume", dependencies.config.issuerUrl);
      url.searchParams.set("token", token);
      url.searchParams.set("purpose", "registration");
      await dependencies.magicLinkDelivery.send({ email: body.email, url: url.toString(), code, expiresAt });
    }
    return reply.code(202).send({ status: "accepted", expiresAt, delivery: dependencies.config.emailProvider === "console" ? "console" : "email" });
  });

  app.post("/v1/auth/login", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = passwordLoginSchema.parse(request.body);
    const user = await findUserByIdentifier(dependencies.store, body.identifier);
    if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Username or password is incorrect.");
    }
    if (user.email && user.emailVerifiedAt === null) {
      throw new AppError(403, "EMAIL_NOT_VERIFIED", "Please verify your email before signing in.");
    }
    await createSession(reply, user.id, dependencies);
    return { user: await publicUser(user, dependencies) };
  });

  const startEmailLogin = async (request: FastifyRequest, reply: FastifyReply) => {
    const body = magicLinkSchema.parse(request.body);
    const returnTo = safeReturnTo(body.returnTo, dependencies.config);
    const createdAt = nowIso();
    const token = randomToken();
    const code = randomEmailLoginCode();
    const link = await dependencies.store.transaction(async (store) => {
      const user = await store.ensureUser(body.email);
      const magicLink = { id: randomUUID(), userId: user.id, purpose: "login" as const, targetEmail: body.email, tokenHash: sha256(token), verificationCodeHash: sha256(code), returnTo, expiresAt: expiryIso(dependencies.config.magicLinkTtlMs), consumedAt: null, createdAt };
      await store.createMagicLink(magicLink);
      return { user, magicLink };
    });
    const url = new URL("/v1/auth/magic-link/consume", dependencies.config.issuerUrl);
    url.searchParams.set("token", token);
    await dependencies.magicLinkDelivery.send({ email: body.email, url: url.toString(), code, expiresAt: link.magicLink.expiresAt });
    return reply.code(202).send({ status: "accepted", expiresAt: link.magicLink.expiresAt, delivery: dependencies.config.emailProvider === "console" ? "console" : "email" });
  };
  app.post("/v1/auth/email-code/start", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, startEmailLogin);
  // Retained for old website builds and email links during the migration.
  app.post("/v1/auth/magic-link/start", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, startEmailLogin);

  app.get("/v1/auth/dev-mailbox", async (request, reply) => {
    const remoteAddress = request.raw.socket.remoteAddress;
    const isLoopback = remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
    if (dependencies.config.nodeEnv !== "development" || dependencies.config.emailProvider !== "console" || !isLoopback) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Development mailbox is unavailable." } });
    }
    const email = emailSchema.parse((request.query as Record<string, unknown>).email);
    const mailbox = dependencies.magicLinkDelivery as Partial<DevelopmentMailbox>;
    const latest = typeof mailbox.getLatestCode === "function" ? mailbox.getLatestCode(email) : null;
    return { email, code: latest?.code ?? null, expiresAt: latest?.expiresAt ?? null };
  });

  const consumeMagic = async (token: string, reply: FastifyReply, purpose: "login" | "registration" = "login"): Promise<{ user: User; returnTo: string }> => {
    const magicLink = await dependencies.store.transaction((store) => store.consumeMagicLink(sha256(token), nowIso(), purpose));
    if (!magicLink) throw new AppError(400, "INVALID_MAGIC_LINK", "Magic link is invalid, expired, or has already been used.");
    const user = assertPresent(await dependencies.store.getUser(magicLink.userId), 401, "UNAUTHENTICATED", "Magic-link user no longer exists.");
    if (purpose === "registration" || purpose === "login") await dependencies.store.markUserEmailVerified(user.id, nowIso());
    await createSession(reply, user.id, dependencies);
    return { user, returnTo: magicLink.returnTo };
  };

  app.get("/v1/auth/magic-link/consume", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const token = z.string().trim().min(1).max(512).parse((request.query as Record<string, unknown>).token);
    const requestedPurpose = z.enum(["login", "registration"]).catch("login").parse((request.query as Record<string, unknown>).purpose);
    const consumed = await consumeMagic(token, reply, requestedPurpose);
    return reply.redirect(new URL(consumed.returnTo, dependencies.config.webOrigin).toString(), 303);
  });
  app.post("/v1/auth/magic-link/consume", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const consumed = await consumeMagic(consumeSchema.parse(request.body).token, reply);
    return { user: await publicUser(consumed.user, dependencies) };
  });
  app.post("/v1/auth/email-code/consume", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = emailCodeConsumeSchema.parse(request.body);
    const login = await dependencies.store.transaction((store) => dependencies.config.allowDevelopmentAuth ? store.consumeMagicLinkByEmail(body.email, nowIso(), "login") : store.consumeMagicLinkByCode(body.email, sha256(body.code), nowIso(), "login"));
    if (!login) throw new AppError(400, "INVALID_EMAIL_CODE", "The verification code is invalid, expired, or has already been used.");
    const user = assertPresent(await dependencies.store.getUser(login.userId), 401, "UNAUTHENTICATED", "Verification-code user no longer exists.");
    await dependencies.store.markUserEmailVerified(user.id, nowIso());
    await createSession(reply, user.id, dependencies);
    return { user: await publicUser(user, dependencies), returnTo: login.returnTo };
  });
  app.post("/v1/auth/recovery/start", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = magicLinkSchema.parse(request.body);
    const user = await dependencies.store.getUserByEmail(body.email);
    const expiresAt = expiryIso(dependencies.config.magicLinkTtlMs);
    if (user) {
      const token = randomToken();
      const code = randomEmailLoginCode();
      const link = { id: randomUUID(), userId: user.id, purpose: "recovery" as const, targetEmail: body.email, tokenHash: sha256(token), verificationCodeHash: sha256(code), returnTo: "/", expiresAt, consumedAt: null, createdAt: nowIso() };
      await dependencies.store.createMagicLink(link);
      const url = new URL("/v1/auth/magic-link/consume", dependencies.config.issuerUrl);
      url.searchParams.set("token", token);
      await dependencies.magicLinkDelivery.send({ email: body.email, url: url.toString(), code, expiresAt });
    }
    return reply.code(202).send({ status: "accepted", expiresAt, delivery: dependencies.config.emailProvider === "console" ? "console" : "email" });
  });
  app.post("/v1/auth/recovery/complete", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = recoverySchema.parse(request.body);
    const code = z.string().regex(/^\d{6}$/).parse((request.body as Record<string, unknown>).code);
    const recovery = await dependencies.store.transaction((store) => store.consumeMagicLinkByCode(body.email, sha256(code), nowIso(), "recovery"));
    if (!recovery) throw new AppError(400, "INVALID_RECOVERY_CODE", "The recovery code is invalid, expired, or has already been used.");
    const user = assertPresent(await dependencies.store.getUser(recovery.userId), 401, "UNAUTHENTICATED", "Recovery account no longer exists.");
    await dependencies.store.updateUserPassword(user.id, await hashPassword(body.newPassword));
    await createSession(reply, user.id, dependencies, nowIso());
    return { user: await publicUser({ ...user, passwordHash: "updated" }, dependencies), recovered: true };
  });
  app.post("/v1/auth/email/bind/start", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const body = z.object({ email: emailSchema }).parse(request.body);
    const existing = await dependencies.store.getUserByEmail(body.email);
    if (existing && existing.id !== user.id) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "This email is already bound to another account.");
    const token = randomToken();
    const code = randomEmailLoginCode();
    const expiresAt = expiryIso(dependencies.config.magicLinkTtlMs);
    const link = { id: randomUUID(), userId: user.id, purpose: "binding" as const, targetEmail: body.email, tokenHash: sha256(token), verificationCodeHash: sha256(code), returnTo: "/", expiresAt, consumedAt: null, createdAt: nowIso() };
    await dependencies.store.createMagicLink(link);
    const url = new URL("/v1/auth/magic-link/consume", dependencies.config.issuerUrl);
    url.searchParams.set("token", token);
    await dependencies.magicLinkDelivery.send({ email: body.email, url: url.toString(), code, expiresAt });
    return reply.code(202).send({ status: "accepted", expiresAt });
  });
  app.post("/v1/auth/email/bind/verify", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request) => {
    const user = await requireUser(request, dependencies);
    const body = emailCodeConsumeSchema.parse(request.body);
    const binding = await dependencies.store.transaction((store) => store.consumeMagicLinkByCode(body.email, sha256(body.code), nowIso(), "binding"));
    if (!binding || binding.userId !== user.id) throw new AppError(400, "INVALID_EMAIL_CODE", "The email verification code is invalid or expired.");
    const existing = await dependencies.store.getUserByEmail(body.email);
    if (existing && existing.id !== user.id) throw new AppError(409, "EMAIL_ALREADY_EXISTS", "This email is already bound to another account.");
    await dependencies.store.setUserEmail(user.id, body.email);
    await dependencies.store.markUserEmailVerified(user.id, nowIso());
    return { user: await publicUser({ ...user, email: body.email }, dependencies), verified: true };
  });
  app.post("/v1/auth/dev-passkey/verify", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    if (!dependencies.config.allowDevelopmentAuth) throw new AppError(404, "NOT_FOUND", "Development passkey is disabled.");
    const body = z.object({ identifier: identifierSchema, code: z.string().regex(/^\d{6}$/) }).parse(request.body);
    const user = assertPresent(await findUserByIdentifier(dependencies.store, body.identifier), 401, "UNAUTHENTICATED", "Development login session is not available.");
    const code = body.code;
    if (!/^\d{6}$/.test(code)) throw new AppError(400, "INVALID_DEV_PASSKEY", "Enter any 6-digit development passkey.");
    await createSession(reply, user.id, dependencies, nowIso());
    return { user: await publicUser(user, dependencies), development: true };
  });

  app.post("/v1/auth/webauthn/registration/options", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const generated = await dependencies.webAuthn.registrationOptions({ userId: user.id, email: user.email ?? user.username, displayName: user.displayName, credentials: await dependencies.store.listCredentialsForUser(user.id) });
    const challenge = { id: randomUUID(), userId: user.id, kind: "registration" as const, challenge: generated.challenge, expiresAt: expiryIso(5 * 60 * 1000), consumedAt: null, createdAt: nowIso() };
    await dependencies.store.createWebAuthnChallenge(challenge);
    return { challengeId: challenge.id, options: generated.options };
  });
  app.post("/v1/auth/webauthn/registration/verify", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const body = webAuthnVerifySchema.parse(request.body);
    const challenge = await dependencies.store.transaction((store) => store.consumeWebAuthnChallenge(body.challengeId, "registration", nowIso()));
    if (!challenge || challenge.userId !== user.id) throw new AppError(400, "INVALID_WEBAUTHN_CHALLENGE", "WebAuthn challenge is invalid or expired.");
    const verified = await dependencies.webAuthn.verifyRegistration({ response: body.response, challenge: challenge.challenge });
    if (!verified) throw new AppError(400, "WEBAUTHN_VERIFICATION_FAILED", "Passkey registration could not be verified.");
    const verifiedAt = nowIso();
    await dependencies.store.createCredential({ ...verified, userId: user.id, createdAt: verifiedAt, lastUsedAt: null });
    await createSession(reply, user.id, dependencies, verifiedAt);
    return reply.code(201).send({ credential: { id: verified.id, createdAt: nowIso() } });
  });
  app.post("/v1/auth/webauthn/authentication/options", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request) => {
    const body = webAuthnAuthenticationOptionsSchema.parse(request.body);
    const user = assertPresent(await findUserByIdentifier(dependencies.store, body.identifier ?? body.email!), 404, "NOT_FOUND", "No passkey is registered for this account.");
    const credentials = await dependencies.store.listCredentialsForUser(user.id);
    if (!credentials.length) throw new AppError(404, "NOT_FOUND", "No passkey is registered for this account.");
    const generated = await dependencies.webAuthn.authenticationOptions({ credentials });
    const challenge = { id: randomUUID(), userId: user.id, kind: "authentication" as const, challenge: generated.challenge, expiresAt: expiryIso(5 * 60 * 1000), consumedAt: null, createdAt: nowIso() };
    await dependencies.store.createWebAuthnChallenge(challenge);
    return { challengeId: challenge.id, options: generated.options };
  });
  app.post("/v1/auth/webauthn/authentication/verify", { config: { rateLimit: { max: dependencies.config.rateLimits.auth.max, timeWindow: dependencies.config.rateLimits.auth.timeWindowMs } } }, async (request, reply) => {
    const body = webAuthnVerifySchema.parse(request.body);
    const challenge = await dependencies.store.transaction((store) => store.consumeWebAuthnChallenge(body.challengeId, "authentication", nowIso()));
    if (!challenge?.userId) throw new AppError(400, "INVALID_WEBAUTHN_CHALLENGE", "WebAuthn challenge is invalid or expired.");
    const credential = assertPresent(await dependencies.store.getCredential(responseCredentialId(body.response)), 400, "WEBAUTHN_VERIFICATION_FAILED", "Passkey is unknown.");
    if (credential.userId !== challenge.userId) throw new AppError(400, "WEBAUTHN_VERIFICATION_FAILED", "Passkey does not match this login attempt.");
    const verified = await dependencies.webAuthn.verifyAuthentication({ response: body.response, challenge: challenge.challenge, credential });
    if (!verified) throw new AppError(400, "WEBAUTHN_VERIFICATION_FAILED", "Passkey authentication could not be verified.");
    await dependencies.store.updateCredentialCounter(credential.id, verified.newCounter, nowIso());
    const verifiedAt = nowIso();
    await createSession(reply, credential.userId, dependencies, verifiedAt);
    return { user: await publicUser(assertPresent(await dependencies.store.getUser(credential.userId), 401, "UNAUTHENTICATED", "Passkey user no longer exists."), dependencies) };
  });

  app.get("/v1/me", async (request) => ({ user: await publicUser(await requireUser(request, dependencies), dependencies) }));
  app.post("/v1/agents", { config: { rateLimit: { max: dependencies.config.rateLimits.agentChanges.max, timeWindow: dependencies.config.rateLimits.agentChanges.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const body = agentSchema.parse(request.body);
    const createdAt = nowIso();
    const agent: Agent = { id: `did:agentid:agt_${randomToken(16)}`, name: body.name, ownerId: user.id, status: "active", createdAt, updatedAt: createdAt };
    await dependencies.store.transaction(async (store) => {
      await store.createAgent(agent, user.id);
      await store.saveAgentPublicProfile(defaultPublicProfile(agent.id));
      await store.addAuditEvent(event({ actorUserId: user.id, agentId: agent.id, instanceId: null, bindingJti: null, action: "agent_created", detail: { name: agent.name } }));
    });
    return reply.code(201).send({ agent: publicAgent(agent) });
  });
  app.get("/v1/me/agents", async (request) => ({ agents: await dependencies.store.listAgentSummaries((await requireUser(request, dependencies)).id) }));
  app.get("/v1/agents/:agentId", async (request) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    await ensureViewer(dependencies.store, agentId, user.id);
    return { agent: publicAgent(assertPresent(await dependencies.store.getAgent(agentId), 404, "NOT_FOUND", "Agent was not found.")) };
  });
  app.get("/v1/agents/:agentId/public-profile", async (request) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    await ensureViewer(dependencies.store, agentId, user.id);
    return { profile: managedPublicProfile((await dependencies.store.getAgentPublicProfile(agentId)) ?? defaultPublicProfile(agentId)) };
  });
  app.patch("/v1/agents/:agentId/public-profile", { config: { rateLimit: { max: dependencies.config.rateLimits.agentChanges.max, timeWindow: dependencies.config.rateLimits.agentChanges.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    const body = publicProfileSchema.parse(request.body);
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `agent:${user.id}:${agentId}:public-profile`, key, body, async (store) => {
      if (!isManager(await store.getMemberRole(agentId, user.id))) throw new AppError(403, "FORBIDDEN", "Only an Agent owner or admin can update its public profile.");
      assertPresent(await store.getAgent(agentId), 404, "NOT_FOUND", "Agent was not found.");
      const profile: AgentPublicProfile = { agentId, ...body, updatedAt: nowIso() };
      await store.saveAgentPublicProfile(profile);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId: null, bindingJti: null, action: "agent_public_profile_updated", detail: { published: profile.published, attributeCount: profile.attributes.length } }));
      return { status: 200, body: { profile: managedPublicProfile(profile) } };
    });
    return reply.code(result.status).send(result.body);
  });
  app.post("/v1/instance-bindings/:jti/connection", { config: { rateLimit: { max: dependencies.config.rateLimits.bindingStatus.max, timeWindow: dependencies.config.rateLimits.bindingStatus.timeWindowMs } } }, async (request) => {
    const { jti } = request.params as { jti: string };
    const body = connectionPublicationSchema.parse(request.body);
    if (body.jti !== jti) throw new AppError(400, "JTI_MISMATCH", "Connection publication JTI does not match the URL.");
    if (Math.abs(body.timestamp - Math.floor(Date.now() / 1000)) > 300) throw new AppError(400, "STALE_CONNECTION_PROOF", "Connection publication proof is expired.");
    if (body.allowDiscovery && body.multiaddrs.length === 0 && body.relayMultiaddrs.length === 0) throw new AppError(400, "CONNECTION_ENDPOINT_REQUIRED", "A discoverable Agent must publish at least one multiaddr.");

    const binding = assertPresent(await dependencies.store.getBinding(jti), 404, "NOT_FOUND", "Instance binding was not found.");
    if (binding.status !== "active" || Date.parse(binding.expiresAt) <= Date.now()) throw new AppError(409, "BINDING_NOT_ACTIVE", "Only an active binding can publish a connection endpoint.");
    if (binding.agentId !== body.agentId || binding.instanceId !== body.instanceId || binding.instancePublicKey !== body.instancePublicKey) throw new AppError(400, "INSTANCE_MISMATCH", "Connection publication does not match the bound instance.");
    if (!verifyConnectionPublication(body)) throw new AppError(401, "INVALID_CONNECTION_PROOF", "Connection publication proof could not be verified.");

    const existing = await dependencies.store.getAgentPublicProfile(body.agentId) ?? defaultPublicProfile(body.agentId);
    const profile: AgentPublicProfile = {
      ...existing,
      connection: {
        allowDiscovery: body.allowDiscovery,
        allowDirectDial: body.allowDirectDial,
        peerId: body.peerId,
        multiaddrs: [...body.multiaddrs],
        relayMultiaddrs: [...body.relayMultiaddrs],
      },
      updatedAt: nowIso(),
    };
    await dependencies.store.saveAgentPublicProfile(profile);
    await dependencies.store.addAuditEvent(event({ actorUserId: null, agentId: body.agentId, instanceId: body.instanceId, bindingJti: binding.jti, action: "agent_public_connection_published", detail: { allowDiscovery: body.allowDiscovery, allowDirectDial: body.allowDirectDial, multiaddrCount: body.multiaddrs.length, relayMultiaddrCount: body.relayMultiaddrs.length } }));
    return { connection: publicProfile(profile).connection };
  });
  app.get("/v1/public/agents", async (request) => {
    const query = request.query as { query?: string; tag?: string; capability?: string; verified?: string; connection?: string };
    const search = (query.query ?? "").trim().toLowerCase();
    const tag = (query.tag ?? "").trim().toLowerCase();
    const capability = (query.capability ?? "").trim().toLowerCase();
    const records = (await dependencies.store.listPublicAgents()).filter(({ agent, profile }) => {
      const attributes = profile.attributes.filter((attribute) => attribute.visible);
      const searchable = [agent.id, agent.name, profile.summary, profile.role, profile.language, ...attributes.map((attribute) => `${attribute.label} ${attribute.value}`)].join(" ").toLowerCase();
      const matchesSearch = !search || searchable.includes(search);
      const matchesTag = !tag || attributes.some((attribute) => attribute.kind === "tag" && attribute.value.toLowerCase() === tag);
      const matchesCapability = !capability || attributes.some((attribute) => attribute.kind === "capability" && attribute.value.toLowerCase() === capability);
      const matchesVerified = query.verified !== "true" || agent.status === "active";
      const matchesConnection = query.connection !== "available" || Boolean(profile.connection?.allowDiscovery);
      return matchesSearch && matchesTag && matchesCapability && matchesVerified && matchesConnection;
    });
    return { agents: records.map(({ agent, profile }) => ({ agent: publicDirectoryAgent(agent), profile: publicProfile(profile) })) };
  });
  app.get("/v1/public/agents/:agentId/connection-ticket", async (request) => {
    const { agentId } = request.params as { agentId: string };
    const record = (await dependencies.store.listPublicAgents()).find(({ agent }) => agent.id === agentId);
    if (!record) throw new AppError(404, "NOT_FOUND", "Public Agent profile was not found.");
    const connection = record.profile.connection;
    if (!connection?.allowDiscovery || !connection.peerId || (connection.multiaddrs.length === 0 && connection.relayMultiaddrs.length === 0)) {
      throw new AppError(409, "DISCOVERY_UNAVAILABLE", "This Agent has not published a connection endpoint.");
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 5 * 60;
    const ticket = dependencies.issuerKey.signClaims({
      iss: dependencies.config.issuerUrl,
      sub: agentId,
      aud: dependencies.config.clientId,
      jti: randomUUID(),
      peer_id: connection.peerId,
      multiaddrs: connection.allowDirectDial ? connection.multiaddrs : [],
      relay_multiaddrs: connection.relayMultiaddrs,
      allowed_scopes: ["p2p:announce", "p2p:message"],
      iat: issuedAt,
      exp: expiresAt,
    }, "agentid+discovery+jwt");
    return {
      ticket,
      agentId,
      peerId: connection.peerId,
      multiaddrs: connection.allowDirectDial ? connection.multiaddrs : [],
      relayMultiaddrs: connection.relayMultiaddrs,
      expiresIn: expiresAt - issuedAt,
      expiresAt: new Date(expiresAt * 1000).toISOString(),
    };
  });
  app.get("/v1/public/agents/:agentId", async (request) => {
    const { agentId } = request.params as { agentId: string };
    const record = (await dependencies.store.listPublicAgents()).find(({ agent }) => agent.id === agentId);
    if (!record) throw new AppError(404, "NOT_FOUND", "Public Agent profile was not found.");
    return { agent: publicDirectoryAgent(record.agent), profile: publicProfile(record.profile) };
  });
  app.patch("/v1/agents/:agentId", { config: { rateLimit: { max: dependencies.config.rateLimits.agentChanges.max, timeWindow: dependencies.config.rateLimits.agentChanges.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    const body = agentSchema.parse(request.body);
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `agent:${user.id}:${agentId}:update`, key, body, async (store) => {
      if ((await store.getMemberRole(agentId, user.id)) !== "owner") throw new AppError(403, "FORBIDDEN", "Only the Agent owner can update this Agent.");
      const agent = assertPresent(await store.getAgent(agentId), 404, "NOT_FOUND", "Agent was not found.");
      agent.name = body.name;
      agent.updatedAt = nowIso();
      await store.updateAgent(agent);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId: null, bindingJti: null, action: "agent_updated", detail: { name: agent.name } }));
      return { status: 200, body: { agent: publicAgent(agent) } };
    });
    return reply.code(result.status).send(result.body);
  });
  app.get("/v1/agents/:agentId/members", async (request) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    await ensureViewer(dependencies.store, agentId, user.id);
    return { members: (await dependencies.store.listMembers(agentId)).map(publicMember) };
  });
  app.post("/v1/agents/:agentId/members", { config: { rateLimit: { max: dependencies.config.rateLimits.agentChanges.max, timeWindow: dependencies.config.rateLimits.agentChanges.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    const body = memberSchema.parse(request.body);
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `agent:${user.id}:${agentId}:member:add`, key, body, async (store) => {
      if ((await store.getMemberRole(agentId, user.id)) !== "owner") throw new AppError(403, "FORBIDDEN", "Only the Agent owner can manage members.");
      assertPresent(await store.getAgent(agentId), 404, "NOT_FOUND", "Agent was not found.");
      const invited = await store.ensureUser(body.email);
      await store.upsertMember(agentId, invited.id, body.role);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId: null, bindingJti: null, action: "member_invited", detail: { email: invited.email, role: body.role } }));
      const member = (await store.listMembers(agentId)).find((entry) => entry.userId === invited.id);
      return { status: 201, body: { member: publicMember(assertPresent(member, 404, "NOT_FOUND", "Member was not found.")) } };
    });
    return reply.code(result.status).send(result.body);
  });
  app.patch("/v1/agents/:agentId/members/:userId", { config: { rateLimit: { max: dependencies.config.rateLimits.agentChanges.max, timeWindow: dependencies.config.rateLimits.agentChanges.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const { agentId, userId } = request.params as { agentId: string; userId: string };
    const body = memberRoleSchema.parse(request.body);
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `agent:${user.id}:${agentId}:member:${userId}:role`, key, body, async (store) => {
      if ((await store.getMemberRole(agentId, user.id)) !== "owner") throw new AppError(403, "FORBIDDEN", "Only the Agent owner can manage members.");
      if ((await store.getMemberRole(agentId, userId)) === "owner") throw new AppError(409, "OWNER_ROLE_IMMUTABLE", "The Agent owner role cannot be changed.");
      await store.upsertMember(agentId, userId, body.role);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId: null, bindingJti: null, action: "member_role_changed", detail: { userId, role: body.role } }));
      const member = (await store.listMembers(agentId)).find((entry) => entry.userId === userId);
      return { status: 200, body: { member: publicMember(assertPresent(member, 404, "NOT_FOUND", "Member was not found.")) } };
    });
    return reply.code(result.status).send(result.body);
  });
  app.delete("/v1/agents/:agentId/members/:userId", { config: { rateLimit: { max: dependencies.config.rateLimits.agentChanges.max, timeWindow: dependencies.config.rateLimits.agentChanges.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const { agentId, userId } = request.params as { agentId: string; userId: string };
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `agent:${user.id}:${agentId}:member:${userId}:remove`, key, {}, async (store) => {
      if ((await store.getMemberRole(agentId, user.id)) !== "owner") throw new AppError(403, "FORBIDDEN", "Only the Agent owner can manage members.");
      if ((await store.getMemberRole(agentId, userId)) === "owner") throw new AppError(409, "OWNER_CANNOT_BE_REMOVED", "The Agent owner cannot be removed.");
      await store.removeMember(agentId, userId);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId: null, bindingJti: null, action: "member_removed", detail: { userId } }));
      return { status: 200, body: { removed: true } };
    });
    return reply.code(result.status).send(result.body);
  });
  app.get("/v1/agents/:agentId/instances", async (request) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    await ensureViewer(dependencies.store, agentId, user.id);
    const bindings = await dependencies.store.transaction(async (store) => {
      const values = await store.listBindings(agentId);
      for (const binding of values) if (expireBinding(binding)) await store.saveBinding(binding);
      return values;
    });
    return { instances: bindings.map(publicBinding) };
  });

  app.get("/v1/approvals", async (request) => {
    const user = await requireUser(request, dependencies);
    const status = z.enum(["pending", "approved", "denied", "exchanged", "expired", "revoked"]).default("pending").parse((request.query as Record<string, unknown>).status);
    const approvals = await dependencies.store.listApprovalsForUser(user.id, status);
    return { approvals: await Promise.all(approvals.map(async (approval) => publicApproval(approval, await approvalActions(dependencies.store, approval, user.id, false)))) };
  });
  app.get("/v1/approvals/:id", async (request) => {
    const user = await requireUser(request, dependencies);
    const { id } = request.params as { id: string };
    const authorization = await dependencies.store.transaction(async (store) => {
      const value = assertPresent(await store.getDeviceAuthorizationForUpdate(id), 404, "NOT_FOUND", "Approval was not found.");
      if (expireAuthorization(value)) await store.saveDeviceAuthorization(value);
      return value;
    });
    const directAccess = await canReadApproval(dependencies.store, authorization, user.id);
    if (!directAccess) throw new AppError(403, "FORBIDDEN", "You cannot view this approval.");
    return { approval: publicApproval(authorization, await approvalActions(dependencies.store, authorization, user.id, directAccess)) };
  });

  app.post("/v1/approvals/:id/:action", { config: { rateLimit: { max: dependencies.config.rateLimits.approvals.max, timeWindow: dependencies.config.rateLimits.approvals.timeWindowMs } } }, async (request, reply) => {
    // For the demo, a verified website login is the approval step. The
    // device identity, requested scopes, and Agent membership are still
    // checked before issuing or revoking a binding.
    const user = await requireUser(request, dependencies);
    const { id, action } = request.params as { id: string; action: string };
    if (action !== "approve" && action !== "deny" && action !== "revoke") throw new AppError(404, "NOT_FOUND", "Approval action was not found.");
    const body = action === "revoke" ? revokeSchema.parse(request.body) : approvalActionSchema.parse(request.body);
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `approval:${user.id}:${id}:${action}`, key, body, async (store) => {
      const authorization = assertPresent(await store.getDeviceAuthorizationForUpdate(id), 404, "NOT_FOUND", "Approval was not found.");
      if (expireAuthorization(authorization)) await store.saveDeviceAuthorization(authorization);
      const hasDirectCode = await canReadApproval(store, authorization, user.id);
      if (!hasDirectCode) throw new AppError(403, "FORBIDDEN", "You cannot manage this approval.");
      if (action === "deny") {
        if (authorization.status !== "pending") throw new AppError(409, "INVALID_APPROVAL_STATE", "Only pending approvals can be denied.");
        authorization.status = "denied";
        authorization.decisionReason = body.reason ?? null;
        authorization.decidedAt = nowIso();
        authorization.decidedByUserId = user.id;
        await store.saveDeviceAuthorization(authorization);
        await store.addAuditEvent(event({ actorUserId: user.id, agentId: authorization.agentId ?? authorization.agentHint, instanceId: authorization.instanceId, bindingJti: null, action: "device_authorization_denied", detail: { reason: authorization.decisionReason } }));
        return { status: 200, body: { approval: publicApproval(authorization, []) } };
      }
      if (action === "approve") {
        if (authorization.status !== "pending") throw new AppError(409, "INVALID_APPROVAL_STATE", "Only pending approvals can be approved.");
        if (authorization.agentCreationRequested && (body as z.infer<typeof approvalActionSchema>).agentId) throw new AppError(409, "AGENT_SELECTION_NOT_ALLOWED", "This request must create a new AgentID.");
        let selectedAgentId = (body as z.infer<typeof approvalActionSchema>).agentId ?? authorization.agentHint;
        if (!selectedAgentId) {
          const createdAt = nowIso();
          const name = `${authorization.instanceLabel} Agent`.slice(0, 120);
          const agent: Agent = { id: `did:agentid:agt_${authorization.id.replaceAll("-", "").slice(0, 24)}`, name, ownerId: user.id, status: "active", createdAt, updatedAt: createdAt };
          await store.createAgent(agent, user.id);
          // An Agent created explicitly by OpenClaw is discoverable by default.
          // Connection endpoints remain private until the instance publishes them.
          await store.saveAgentPublicProfile(defaultPublicProfile(agent.id, true, authorization.scopes, authorization.agentProfile, authorization.platform, authorization.instanceLabel));
          await store.addAuditEvent(event({ actorUserId: user.id, agentId: agent.id, instanceId: authorization.instanceId, bindingJti: null, action: "agent_created_for_device_authorization", detail: { name } }));
          selectedAgentId = agent.id;
        }
        await ensureManager(store, selectedAgentId, user.id);
        assertPresent(await store.getAgent(selectedAgentId), 404, "NOT_FOUND", "Agent was not found.");
        const issuedAtSeconds = Math.floor(Date.now() / 1000);
        const jti = randomUUID();
        const expiresAt = new Date((issuedAtSeconds * 1000) + dependencies.config.bindingTtlMs).toISOString();
        const binding: InstanceBinding = {
          jti, agentId: selectedAgentId, instanceId: authorization.instanceId, instancePublicKey: authorization.instancePublicKey, publicKeyFingerprint: authorization.publicKeyFingerprint,
          instanceLabel: authorization.instanceLabel, platform: authorization.platform, scopes: authorization.scopes, status: "active", issuedAt: new Date(issuedAtSeconds * 1000).toISOString(),
          expiresAt, approvedByUserId: user.id, revokedAt: null, revokedByUserId: null, revocationReason: null,
          ibc: dependencies.issuerKey.signClaims({ iss: dependencies.config.issuerUrl, sub: selectedAgentId, aud: dependencies.config.clientId, jti, user_id_hash: userIdHash(user.id, dependencies), instance_id: authorization.instanceId, instance_public_key: authorization.instancePublicKey, scope: authorization.scopes, iat: issuedAtSeconds, exp: Math.floor(Date.parse(expiresAt) / 1000) }),
        };
        await store.createBinding(binding);
        authorization.agentId = selectedAgentId;
        authorization.status = "approved";
        authorization.decisionReason = (body as z.infer<typeof approvalActionSchema>).reason ?? null;
        authorization.decidedAt = nowIso();
        authorization.decidedByUserId = user.id;
        authorization.bindingJti = jti;
        await store.saveDeviceAuthorization(authorization);
        await store.addAuditEvent(event({ actorUserId: user.id, agentId: selectedAgentId, instanceId: binding.instanceId, bindingJti: binding.jti, action: "device_authorization_approved", detail: { requestedScopes: binding.scopes.join(" ") } }));
        return { status: 200, body: { approval: publicApproval(authorization, ["revoke"]), binding: publicBinding(binding) } };
      }
      if (authorization.status !== "approved" && authorization.status !== "exchanged") throw new AppError(409, "INVALID_APPROVAL_STATE", "Only approved bindings can be revoked.");
      const agentId = assertPresent(authorization.agentId, 409, "INVALID_APPROVAL_STATE", "Approval has no selected Agent.");
      await ensureManager(store, agentId, user.id);
      const binding = assertPresent(authorization.bindingJti ? await store.getBindingForUpdate(authorization.bindingJti) : null, 409, "INVALID_APPROVAL_STATE", "Approval has no binding.");
      if (binding.status === "active") {
        binding.status = "revoked";
        binding.revokedAt = nowIso();
        binding.revokedByUserId = user.id;
        binding.revocationReason = body.reason ?? null;
        await store.saveBinding(binding);
      }
      authorization.status = "revoked";
      authorization.decisionReason = body.reason ?? null;
      authorization.decidedAt = nowIso();
      authorization.decidedByUserId = user.id;
      await store.saveDeviceAuthorization(authorization);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId: binding.instanceId, bindingJti: binding.jti, action: "instance_binding_revoked", detail: { reason: binding.revocationReason } }));
      return { status: 200, body: { approval: publicApproval(authorization, []), binding: publicBinding(binding) } };
    });
    metrics.increment("agentid_oauth_approvals_total", "OAuth device authorization approval and denial outcomes.", 1, { result: action });
    if (action === "revoke") metrics.increment("agentid_ibc_revocations_total", "IBC binding revocations.");
    return reply.code(result.status).send(result.body);
  });

  app.get("/v1/instance-bindings/:jti/status", { config: { rateLimit: { max: dependencies.config.rateLimits.bindingStatus.max, timeWindow: dependencies.config.rateLimits.bindingStatus.timeWindowMs } } }, async (request) => {
    const { jti } = request.params as { jti: string };
    const binding = await dependencies.store.transaction(async (store) => {
      const value = assertPresent(await store.getBindingForUpdate(jti), 404, "NOT_FOUND", "Instance binding was not found.");
      if (expireBinding(value)) await store.saveBinding(value);
      return value;
    });
    return { binding: publicBinding(binding), user_id_hash: userIdHash(binding.approvedByUserId, dependencies) };
  });

  app.post("/v1/instance-bindings/:jti/renew/challenge", { config: { rateLimit: { max: dependencies.config.rateLimits.bindingRenewal.max, timeWindow: dependencies.config.rateLimits.bindingRenewal.timeWindowMs } } }, async (request) => {
    const { jti } = request.params as { jti: string };
    const challenge: BindingRenewalChallenge = { id: randomUUID(), jti, challenge: randomToken(32), expiresAt: expiryIso(5 * 60 * 1000), consumedAt: null, createdAt: nowIso() };
    await dependencies.store.transaction(async (store) => {
      const binding = assertPresent(await store.getBindingForUpdate(jti), 404, "NOT_FOUND", "Instance binding was not found.");
      if (expireBinding(binding)) await store.saveBinding(binding);
      if (binding.status !== "active") throw new AppError(409, "BINDING_NOT_ACTIVE", "Only an active binding can be renewed.");
      await store.createBindingRenewalChallenge(challenge);
    });
    return { challenge_id: challenge.id, challenge: challenge.challenge, expires_in: 300 };
  });

  app.post("/v1/instance-bindings/:jti/renew", { config: { rateLimit: { max: dependencies.config.rateLimits.bindingRenewal.max, timeWindow: dependencies.config.rateLimits.bindingRenewal.timeWindowMs } } }, async (request) => {
    const { jti } = request.params as { jti: string };
    const body = renewalSchema.parse(request.body);
    const result = await dependencies.store.transaction(async (store) => {
      const challenge = assertPresent(await store.consumeBindingRenewalChallenge(body.challengeId, jti, nowIso()), 400, "INVALID_RENEWAL_CHALLENGE", "Renewal challenge is invalid or expired.");
      const binding = assertPresent(await store.getBindingForUpdate(jti), 404, "NOT_FOUND", "Instance binding was not found.");
      if (binding.status !== "active") throw new AppError(409, "BINDING_NOT_ACTIVE", "Only an active binding can be renewed.");
      if (binding.instanceId !== body.instanceId || binding.instancePublicKey !== body.instancePublicKey) throw new AppError(400, "INSTANCE_MISMATCH", "Instance identity does not match the binding.");
      let publicKey;
      try { publicKey = createPublicKey({ key: Buffer.from(body.instancePublicKey, "base64url"), format: "der", type: "spki" }); } catch { throw new AppError(400, "INVALID_INSTANCE_KEY", "Instance public key is invalid."); }
      if (!verify(null, Buffer.from(challenge.challenge), publicKey, Buffer.from(body.signature, "base64url"))) throw new AppError(400, "INVALID_INSTANCE_PROOF", "Instance signature proof is invalid.");
      const issuedAtSeconds = Math.floor(Date.now() / 1000);
      const nextJti = randomUUID();
      const expiresAt = new Date((issuedAtSeconds * 1000) + dependencies.config.bindingTtlMs).toISOString();
      const next: InstanceBinding = { ...binding, jti: nextJti, issuedAt: new Date(issuedAtSeconds * 1000).toISOString(), expiresAt, status: "active", revokedAt: null, revokedByUserId: null, revocationReason: null, ibc: dependencies.issuerKey.signClaims({ iss: dependencies.config.issuerUrl, sub: binding.agentId, aud: dependencies.config.clientId, jti: nextJti, user_id_hash: userIdHash(binding.approvedByUserId, dependencies), instance_id: binding.instanceId, instance_public_key: binding.instancePublicKey, scope: binding.scopes, iat: issuedAtSeconds, exp: Math.floor(Date.parse(expiresAt) / 1000) }) };
      binding.status = "expired";
      await store.saveBinding(binding);
      await store.createBinding(next);
      await store.addAuditEvent(event({ actorUserId: null, agentId: next.agentId, instanceId: next.instanceId, bindingJti: next.jti, action: "instance_binding_renewed", detail: { previousJti: jti } }));
      return next;
    });
    metrics.increment("agentid_ibc_renewals_total", "IBC renewal outcomes.", 1, { result: "success" });
    return { token_type: "Instance-Binding", instance_binding: result.ibc, user_id_hash: userIdHash(result.approvedByUserId, dependencies), binding: publicBinding(result), expires_in: Math.floor((Date.parse(result.expiresAt) - Date.now()) / 1000) };
  });

  app.post("/v1/agents/:agentId/instances/:instanceId/revoke", { config: { rateLimit: { max: dependencies.config.rateLimits.approvals.max, timeWindow: dependencies.config.rateLimits.approvals.timeWindowMs } } }, async (request, reply) => {
    const user = await requireUser(request, dependencies);
    const { agentId, instanceId } = request.params as { agentId: string; instanceId: string };
    const body = revokeSchema.parse(request.body);
    const key = idempotencyHeader(request);
    const result = await idempotent(dependencies.store, `instance:${user.id}:${agentId}:${instanceId}:revoke`, key, body, async (store) => {
      await ensureManager(store, agentId, user.id);
      const binding = assertPresent(await store.findActiveBindingForUpdate(agentId, instanceId), 404, "NOT_FOUND", "No active instance binding was found.");
      binding.status = "revoked";
      binding.revokedAt = nowIso();
      binding.revokedByUserId = user.id;
      binding.revocationReason = body.reason ?? null;
      await store.saveBinding(binding);
      await store.addAuditEvent(event({ actorUserId: user.id, agentId, instanceId, bindingJti: binding.jti, action: "instance_binding_revoked", detail: { reason: binding.revocationReason } }));
      return { status: 200, body: { binding: publicBinding(binding) } };
    });
    metrics.increment("agentid_ibc_revocations_total", "IBC binding revocations.");
    return reply.code(result.status).send(result.body);
  });

  app.get("/v1/activity", async (request) => ({ activity: (await dependencies.store.listActivityForUser((await requireUser(request, dependencies)).id)).map(publicActivity) }));
  app.get("/v1/agents/:agentId/activity", async (request) => {
    const user = await requireUser(request, dependencies);
    const { agentId } = request.params as { agentId: string };
    await ensureViewer(dependencies.store, agentId, user.id);
    return { activity: (await dependencies.store.listActivityForUser(user.id, agentId)).map(publicActivity) };
  });

  return app;
}
