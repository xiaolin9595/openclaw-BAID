import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { AUDIT_GENESIS_HASH, materializeAuditEvent } from "./audit.js";
import { CURRENT_SCHEMA_MIGRATION } from "./config.js";
import type {
  Agent,
  AgentProfileDraft,
  AgentPublicConnection,
  AgentPublicProfile,
  PublicAgentRecord,
  AgentMember,
  BindingRenewalChallenge,
  AgentRole,
  AgentSummary,
  AuditEvent,
  BindingStatus,
  ChallengeKind,
  DeviceAuthorization,
  DeviceStatus,
  IdempotencyRecord,
  InstanceBinding,
  MagicLink,
  MagicLinkPurpose,
  NewAuditEvent,
  Scope,
  Session,
  Store,
  User,
  WebAuthnChallenge,
  WebAuthnCredential,
} from "./domain.js";

type State = {
  users: Map<string, User>;
  usersByEmail: Map<string, string>;
  usersByUsername: Map<string, string>;
  sessions: Map<string, Session>;
  magicLinks: Map<string, MagicLink>;
  challenges: Map<string, WebAuthnChallenge>;
  credentials: Map<string, WebAuthnCredential>;
  agents: Map<string, Agent>;
  publicProfiles: Map<string, AgentPublicProfile>;
  memberships: Map<string, AgentRole>;
  devices: Map<string, DeviceAuthorization>;
  bindings: Map<string, InstanceBinding>;
  renewalChallenges: Map<string, BindingRenewalChallenge>;
  events: AuditEvent[];
  idempotency: Map<string, IdempotencyRecord>;
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function membershipKey(agentId: string, userId: string): string {
  return `${agentId}:${userId}`;
}

function idempotencyKey(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export class MemoryStore implements Store {
  private state: State = {
    users: new Map(),
    usersByEmail: new Map(),
    usersByUsername: new Map(),
    sessions: new Map(),
    magicLinks: new Map(),
    challenges: new Map(),
    credentials: new Map(),
    agents: new Map(),
    publicProfiles: new Map(),
    memberships: new Map(),
    devices: new Map(),
    bindings: new Map(),
    renewalChallenges: new Map(),
    events: [],
    idempotency: new Map(),
  };
  private queued: Promise<void> = Promise.resolve();

  async transaction<T>(callback: (store: Store) => Promise<T>): Promise<T> {
    const previous = this.queued;
    let release: (() => void) | undefined;
    this.queued = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const snapshot = clone(this.state);
    try {
      return await callback(this);
    } catch (error) {
      this.state = snapshot;
      throw error;
    } finally {
      release?.();
    }
  }

  async close(): Promise<void> {}

  async checkHealth(): Promise<{ database: boolean; migrations: boolean }> {
    return { database: true, migrations: true };
  }

  async countPendingAuthorizations(): Promise<number> {
    return [...this.state.devices.values()].filter((device) => device.status === "pending" && Date.parse(device.expiresAt) > Date.now()).length;
  }

  async ensureUser(email: string): Promise<User> {
    const existingId = this.state.usersByEmail.get(email);
    if (existingId) return clone(this.state.users.get(existingId)!);
    const localPart = email.split("@", 1)[0] || "AgentID user";
    const id = `usr_${randomUUID().replaceAll("-", "")}`;
    const user: User = { id, username: `${localPart.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24) || "user"}_${id.slice(-8)}`, email, passwordHash: null, displayName: localPart, createdAt: new Date().toISOString(), emailVerifiedAt: null };
    this.state.users.set(user.id, user);
    this.state.usersByEmail.set(email, user.id);
    this.state.usersByUsername.set(user.username.toLowerCase(), user.id);
    return clone(user);
  }

  async createUser(user: User): Promise<void> {
    if (this.state.usersByUsername.has(user.username.toLowerCase())) throw new Error("USERNAME_ALREADY_EXISTS");
    if (user.email && this.state.usersByEmail.has(user.email)) throw new Error("EMAIL_ALREADY_EXISTS");
    this.state.users.set(user.id, clone(user));
    this.state.usersByUsername.set(user.username.toLowerCase(), user.id);
    if (user.email) this.state.usersByEmail.set(user.email, user.id);
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.state.users.get(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.passwordHash = passwordHash;
  }

  async setUserEmail(userId: string, email: string): Promise<void> {
    const user = this.state.users.get(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    const existingId = this.state.usersByEmail.get(email);
    if (existingId && existingId !== userId) throw new Error("EMAIL_ALREADY_EXISTS");
    if (user.email) this.state.usersByEmail.delete(user.email);
    user.email = email;
    this.state.usersByEmail.set(email, userId);
  }

  async markUserEmailVerified(userId: string, verifiedAt: string): Promise<void> {
    const user = this.state.users.get(userId);
    if (!user) throw new Error("USER_NOT_FOUND");
    user.emailVerifiedAt = verifiedAt;
  }

  async getUser(id: string): Promise<User | null> {
    const value = this.state.users.get(id);
    return value ? clone(value) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const id = this.state.usersByEmail.get(email);
    return id ? this.getUser(id) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const id = this.state.usersByUsername.get(username.toLowerCase());
    return id ? this.getUser(id) : null;
  }

  async createSession(session: Session): Promise<void> {
    this.state.sessions.set(session.tokenHash, clone(session));
  }

  async getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const value = this.state.sessions.get(tokenHash);
    return value ? clone(value) : null;
  }

  async createMagicLink(link: MagicLink): Promise<void> {
    this.state.magicLinks.set(link.tokenHash, clone(link));
  }

  async consumeMagicLink(tokenHash: string, now: string, purpose: MagicLinkPurpose = "login"): Promise<MagicLink | null> {
    const link = this.state.magicLinks.get(tokenHash);
    if (!link || link.purpose !== purpose || link.consumedAt || Date.parse(link.expiresAt) <= Date.parse(now)) return null;
    link.consumedAt = now;
    return clone(link);
  }

  async consumeMagicLinkByCode(email: string, verificationCodeHash: string, now: string, purpose: MagicLinkPurpose = "login"): Promise<MagicLink | null> {
    const link = [...this.state.magicLinks.values()].find((entry) => {
      const user = this.state.users.get(entry.userId);
      return entry.targetEmail === email && entry.purpose === purpose && entry.verificationCodeHash === verificationCodeHash && !entry.consumedAt && Date.parse(entry.expiresAt) > Date.parse(now);
    });
    if (!link) return null;
    link.consumedAt = now;
    return clone(link);
  }

  async consumeMagicLinkByEmail(email: string, now: string, purpose: MagicLinkPurpose = "login"): Promise<MagicLink | null> {
    const link = [...this.state.magicLinks.values()].find((entry) => {
      const user = this.state.users.get(entry.userId);
      return entry.targetEmail === email && entry.purpose === purpose && !entry.consumedAt && Date.parse(entry.expiresAt) > Date.parse(now);
    });
    if (!link) return null;
    link.consumedAt = now;
    return clone(link);
  }

  async createWebAuthnChallenge(challenge: WebAuthnChallenge): Promise<void> {
    this.state.challenges.set(challenge.id, clone(challenge));
  }

  async consumeWebAuthnChallenge(id: string, kind: ChallengeKind, now: string): Promise<WebAuthnChallenge | null> {
    const challenge = this.state.challenges.get(id);
    if (!challenge || challenge.kind !== kind || challenge.consumedAt || Date.parse(challenge.expiresAt) <= Date.parse(now)) return null;
    challenge.consumedAt = now;
    return clone(challenge);
  }

  async createCredential(credential: WebAuthnCredential): Promise<void> {
    this.state.credentials.set(credential.id, clone(credential));
  }

  async getCredential(id: string): Promise<WebAuthnCredential | null> {
    const credential = this.state.credentials.get(id);
    return credential ? clone(credential) : null;
  }

  async listCredentialsForUser(userId: string): Promise<WebAuthnCredential[]> {
    return [...this.state.credentials.values()].filter((credential) => credential.userId === userId).map(clone);
  }

  async updateCredentialCounter(id: string, counter: number, usedAt: string): Promise<void> {
    const credential = this.state.credentials.get(id);
    if (credential) {
      credential.counter = counter;
      credential.lastUsedAt = usedAt;
    }
  }

  async createAgent(agent: Agent, ownerId: string): Promise<void> {
    this.state.agents.set(agent.id, clone(agent));
    this.state.memberships.set(membershipKey(agent.id, ownerId), "owner");
  }

  async getAgent(id: string): Promise<Agent | null> {
    const agent = this.state.agents.get(id);
    return agent ? clone(agent) : null;
  }

  async updateAgent(agent: Agent): Promise<void> {
    this.state.agents.set(agent.id, clone(agent));
  }

  async getAgentPublicProfile(agentId: string): Promise<AgentPublicProfile | null> {
    const profile = this.state.publicProfiles.get(agentId);
    return profile ? clone(profile) : null;
  }

  async saveAgentPublicProfile(profile: AgentPublicProfile): Promise<void> {
    this.state.publicProfiles.set(profile.agentId, clone(profile));
  }

  async listPublicAgents(): Promise<PublicAgentRecord[]> {
    return [...this.state.publicProfiles.values()]
      .filter((profile) => profile.published)
      .map((profile) => {
        const agent = this.state.agents.get(profile.agentId);
        return agent ? { agent: clone(agent), profile: clone(profile) } : null;
      })
      .filter((record): record is PublicAgentRecord => record !== null);
  }

  async getMemberRole(agentId: string, userId: string): Promise<AgentRole | null> {
    return this.state.memberships.get(membershipKey(agentId, userId)) ?? null;
  }

  async listMembers(agentId: string): Promise<AgentMember[]> {
    return [...this.state.memberships.entries()]
      .filter(([key]) => key.startsWith(`${agentId}:`))
      .map(([key, role]) => {
        const userId = key.slice(agentId.length + 1);
        const user = this.state.users.get(userId);
        if (!user) return null;
        return { agentId, userId, email: user.email, displayName: user.displayName, role, status: "active", createdAt: user.createdAt };
      })
      .filter((member): member is AgentMember => member !== null)
      .map(clone);
  }

  async upsertMember(agentId: string, userId: string, role: AgentRole): Promise<void> {
    this.state.memberships.set(membershipKey(agentId, userId), role);
  }

  async removeMember(agentId: string, userId: string): Promise<void> {
    this.state.memberships.delete(membershipKey(agentId, userId));
  }

  async listAgentSummaries(userId: string): Promise<AgentSummary[]> {
    return [...this.state.agents.values()]
      .filter((agent) => agent.status === "active")
      .map((agent) => {
        const role = this.state.memberships.get(membershipKey(agent.id, userId));
        if (!role) return null;
        const instanceCount = [...this.state.bindings.values()].filter((binding) => binding.agentId === agent.id && binding.status === "active").length;
        const pendingApprovalCount = [...this.state.devices.values()].filter(
          (device) => device.status === "pending" && (device.agentId === agent.id || device.agentHint === agent.id),
        ).length;
        return { ...clone(agent), role, instanceCount, pendingApprovalCount };
      })
      .filter((agent): agent is AgentSummary => agent !== null);
  }

  async createDeviceAuthorization(authorization: DeviceAuthorization): Promise<void> {
    this.state.devices.set(authorization.id, clone(authorization));
  }

  async getDeviceAuthorization(id: string): Promise<DeviceAuthorization | null> {
    const device = this.state.devices.get(id);
    return device ? clone(device) : null;
  }

  async getDeviceAuthorizationForUpdate(id: string): Promise<DeviceAuthorization | null> {
    return this.getDeviceAuthorization(id);
  }

  async getDeviceAuthorizationByCodeHashForUpdate(codeHash: string): Promise<DeviceAuthorization | null> {
    const device = [...this.state.devices.values()].find((entry) => entry.deviceCodeHash === codeHash);
    return device ? clone(device) : null;
  }

  async saveDeviceAuthorization(authorization: DeviceAuthorization): Promise<void> {
    this.state.devices.set(authorization.id, clone(authorization));
  }

  async listApprovalsForUser(userId: string, status: DeviceStatus): Promise<DeviceAuthorization[]> {
    return [...this.state.devices.values()]
      .filter((device) => {
        const agentId = device.agentId ?? device.agentHint;
        return device.status === status && agentId !== null && this.state.memberships.has(membershipKey(agentId, userId));
      })
      .map(clone);
  }

  async createBinding(binding: InstanceBinding): Promise<void> {
    this.state.bindings.set(binding.jti, clone(binding));
  }

  async getBinding(jti: string): Promise<InstanceBinding | null> {
    const binding = this.state.bindings.get(jti);
    return binding ? clone(binding) : null;
  }

  async getBindingForUpdate(jti: string): Promise<InstanceBinding | null> {
    return this.getBinding(jti);
  }

  async createBindingRenewalChallenge(challenge: BindingRenewalChallenge): Promise<void> {
    this.state.renewalChallenges.set(challenge.id, clone(challenge));
  }

  async consumeBindingRenewalChallenge(id: string, jti: string, now: string): Promise<BindingRenewalChallenge | null> {
    const challenge = this.state.renewalChallenges.get(id);
    if (!challenge || challenge.jti !== jti || challenge.consumedAt || Date.parse(challenge.expiresAt) <= Date.parse(now)) return null;
    challenge.consumedAt = now;
    return clone(challenge);
  }

  async findActiveBindingForUpdate(agentId: string, instanceId: string): Promise<InstanceBinding | null> {
    const binding = [...this.state.bindings.values()].find(
      (entry) => entry.agentId === agentId && entry.instanceId === instanceId && entry.status === "active",
    );
    return binding ? clone(binding) : null;
  }

  async listBindings(agentId: string): Promise<InstanceBinding[]> {
    return [...this.state.bindings.values()].filter((binding) => binding.agentId === agentId).map(clone);
  }

  async saveBinding(binding: InstanceBinding): Promise<void> {
    this.state.bindings.set(binding.jti, clone(binding));
  }

  async addAuditEvent(event: NewAuditEvent): Promise<void> {
    const previousHash = this.state.events[0]?.eventHash ?? AUDIT_GENESIS_HASH;
    this.state.events.unshift(clone(materializeAuditEvent(event, previousHash)));
  }

  async listActivityForUser(userId: string, agentId?: string): Promise<AuditEvent[]> {
    return this.state.events
      .filter((event) => event.agentId && this.state.memberships.has(membershipKey(event.agentId, userId)) && (!agentId || event.agentId === agentId))
      .map(clone);
  }

  async lockIdempotency(): Promise<void> {}

  async getIdempotency(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const entry = this.state.idempotency.get(idempotencyKey(scope, key));
    return entry ? clone(entry) : null;
  }

  async createIdempotency(record: IdempotencyRecord): Promise<void> {
    this.state.idempotency.set(idempotencyKey(record.scope, record.key), clone(record));
  }
}

type Queryable = Pool | PoolClient;
type Row = QueryResultRow;

function string(row: Row, field: string): string {
  const value = row[field];
  if (typeof value !== "string") throw new Error(`Database field ${field} is not a string.`);
  return value;
}

function optionalString(row: Row, field: string): string | null {
  const value = row[field];
  return value === null || value === undefined ? null : string(row, field);
}

function timestamp(row: Row, field: string): string {
  const value = row[field];
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  throw new Error(`Database field ${field} is not a timestamp.`);
}

function optionalTimestamp(row: Row, field: string): string | null {
  const value = row[field];
  return value === null || value === undefined ? null : timestamp(row, field);
}

function number(row: Row, field: string): number {
  const value = row[field];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) throw new Error(`Database field ${field} is not numeric.`);
  return parsed;
}

function textArray(row: Row, field: string): string[] {
  const value = row[field];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new Error(`Database field ${field} is not text[].`);
  return [...value] as string[];
}

function optionalAgentProfile(row: Row): AgentProfileDraft | null {
  const value = row.agent_profile;
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Database field agent_profile is not an object.");
  return value as AgentProfileDraft;
}

function userFromRow(row: Row): User {
  return { id: string(row, "id"), username: string(row, "username"), email: optionalString(row, "email"), passwordHash: optionalString(row, "password_hash"), displayName: string(row, "display_name"), createdAt: timestamp(row, "created_at"), emailVerifiedAt: optionalTimestamp(row, "email_verified_at") };
}

function agentFromRow(row: Row): Agent {
  return {
    id: string(row, "id"),
    name: string(row, "name"),
    ownerId: string(row, "created_by_user_id"),
    status: string(row, "status") as Agent["status"],
    createdAt: timestamp(row, "created_at"),
    updatedAt: timestamp(row, "updated_at"),
  };
}

function publicProfileFromRow(row: Row): AgentPublicProfile {
  const rawAttributes = row.attributes;
  if (!Array.isArray(rawAttributes)) throw new Error("Database field attributes is not an array.");
  const rawMultiaddrs = row.multiaddrs;
  const rawRelayMultiaddrs = row.relay_multiaddrs;
  const connection: AgentPublicConnection = {
    allowDiscovery: Boolean(row.allow_discovery),
    allowDirectDial: Boolean(row.allow_direct_dial),
    peerId: optionalString(row, "peer_id"),
    multiaddrs: Array.isArray(rawMultiaddrs) ? rawMultiaddrs.filter((value): value is string => typeof value === "string") : [],
    relayMultiaddrs: Array.isArray(rawRelayMultiaddrs) ? rawRelayMultiaddrs.filter((value): value is string => typeof value === "string") : [],
  };
  return {
    agentId: string(row, "agent_id"),
    summary: string(row, "summary"),
    role: string(row, "public_role"),
    language: string(row, "language"),
    attributes: rawAttributes as AgentPublicProfile["attributes"],
    published: Boolean(row.published),
    connection,
    updatedAt: timestamp(row, "profile_updated_at"),
  };
}

function deviceFromRow(row: Row): DeviceAuthorization {
  return {
    id: string(row, "id"), clientId: string(row, "client_id"), agentHint: optionalString(row, "agent_hint"), agentCreationRequested: Boolean(row.agent_creation_requested), agentId: optionalString(row, "agent_id"),
    instanceId: string(row, "instance_id"), instancePublicKey: string(row, "instance_public_key"), publicKeyFingerprint: string(row, "public_key_fingerprint"),
    instanceLabel: string(row, "instance_label"), platform: string(row, "platform"), scopes: textArray(row, "scopes") as Scope[], agentProfile: optionalAgentProfile(row),
    codeChallenge: string(row, "code_challenge"), deviceCodeHash: string(row, "device_code_hash"),
    pollIntervalSeconds: number(row, "poll_interval_seconds"), lastPolledAt: optionalTimestamp(row, "last_polled_at"), status: string(row, "status") as DeviceStatus,
    decisionReason: optionalString(row, "decision_reason"), decidedAt: optionalTimestamp(row, "decided_at"), decidedByUserId: optionalString(row, "decided_by_user_id"),
    bindingJti: optionalString(row, "binding_jti"), exchangedAt: optionalTimestamp(row, "exchanged_at"), createdAt: timestamp(row, "created_at"), expiresAt: timestamp(row, "expires_at"),
  };
}

function bindingFromRow(row: Row): InstanceBinding {
  return {
    jti: string(row, "jti"), agentId: string(row, "agent_id"), instanceId: string(row, "instance_id"), instancePublicKey: string(row, "instance_public_key"),
    publicKeyFingerprint: string(row, "public_key_fingerprint"), instanceLabel: string(row, "instance_label"), platform: string(row, "platform"),
    scopes: textArray(row, "scopes") as Scope[], status: string(row, "status") as BindingStatus, issuedAt: timestamp(row, "issued_at"), expiresAt: timestamp(row, "expires_at"),
    approvedByUserId: string(row, "approved_by_user_id"), revokedAt: optionalTimestamp(row, "revoked_at"), revokedByUserId: optionalString(row, "revoked_by_user_id"),
    revocationReason: optionalString(row, "revocation_reason"), ibc: string(row, "ibc"),
  };
}

export class PostgresStore implements Store {
  constructor(private readonly connection: Queryable, private readonly pool?: Pool) {}

  static fromDatabaseUrl(databaseUrl: string): PostgresStore {
    const pool = new Pool({ connectionString: databaseUrl, max: 20 });
    return new PostgresStore(pool, pool);
  }

  private async query<T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.connection.query<T>(text, values);
    return result.rows;
  }

  async transaction<T>(callback: (store: Store) => Promise<T>): Promise<T> {
    if (!this.pool) return callback(this);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(new PostgresStore(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool?.end();
  }

  async checkHealth(): Promise<{ database: boolean; migrations: boolean }> {
    await this.query("SELECT 1");
    const rows = await this.query<{ version: string }>("SELECT version FROM schema_migrations WHERE version = $1", [CURRENT_SCHEMA_MIGRATION]);
    return { database: true, migrations: rows.length > 0 };
  }

  async countPendingAuthorizations(): Promise<number> {
    const rows = await this.query<{ count: string }>("SELECT count(*)::text AS count FROM device_authorizations WHERE status = 'pending' AND expires_at > now()");
    return Number(rows[0]?.count ?? 0);
  }

  async ensureUser(email: string): Promise<User> {
    const id = `usr_${randomUUID().replaceAll("-", "")}`;
    const displayName = email.split("@", 1)[0] || "AgentID user";
    const username = `${displayName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24) || "user"}_${id.slice(-8)}`;
    const rows = await this.query("INSERT INTO users (id, username, email, password_hash, display_name, email_verified_at) VALUES ($1, $2, $3, NULL, $4, NULL) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING *", [id, username, email, displayName]);
    return userFromRow(rows[0]!);
  }

  async createUser(user: User): Promise<void> {
    await this.query("INSERT INTO users (id, username, email, password_hash, display_name, created_at, email_verified_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [user.id, user.username, user.email, user.passwordHash, user.displayName, user.createdAt, user.emailVerifiedAt ?? null]);
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await this.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, passwordHash]);
  }

  async setUserEmail(userId: string, email: string): Promise<void> {
    await this.query("UPDATE users SET email = $2 WHERE id = $1", [userId, email]);
  }

  async markUserEmailVerified(userId: string, verifiedAt: string): Promise<void> {
    await this.query("UPDATE users SET email_verified_at = $2 WHERE id = $1", [userId, verifiedAt]);
  }

  async getUser(id: string): Promise<User | null> {
    const rows = await this.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const rows = await this.query("SELECT * FROM users WHERE email = $1", [email]);
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const rows = await this.query("SELECT * FROM users WHERE lower(username) = lower($1)", [username]);
    return rows[0] ? userFromRow(rows[0]) : null;
  }

  async createSession(session: Session): Promise<void> {
    await this.query("INSERT INTO sessions (id, user_id, token_hash, expires_at, verified_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [session.id, session.userId, session.tokenHash, session.expiresAt, session.verifiedAt, session.createdAt]);
  }

  async getSessionByTokenHash(tokenHash: string): Promise<Session | null> {
    const rows = await this.query("SELECT * FROM sessions WHERE token_hash = $1", [tokenHash]);
    const row = rows[0];
    return row ? { id: string(row, "id"), userId: string(row, "user_id"), tokenHash: string(row, "token_hash"), expiresAt: timestamp(row, "expires_at"), verifiedAt: optionalTimestamp(row, "verified_at"), createdAt: timestamp(row, "created_at") } : null;
  }

  async createMagicLink(link: MagicLink): Promise<void> {
    await this.query("INSERT INTO magic_link_tokens (id, user_id, purpose, target_email, token_hash, verification_code_hash, return_to, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [link.id, link.userId, link.purpose, link.targetEmail, link.tokenHash, link.verificationCodeHash, link.returnTo, link.expiresAt, link.createdAt]);
  }

  async consumeMagicLink(tokenHash: string, now: string, purpose: MagicLinkPurpose = "login"): Promise<MagicLink | null> {
    const rows = await this.query("UPDATE magic_link_tokens SET consumed_at = $2 WHERE token_hash = $1 AND purpose = $3 AND consumed_at IS NULL AND expires_at > $2 RETURNING *", [tokenHash, now, purpose]);
    const row = rows[0];
    return row ? magicLinkFromRow(row) : null;
  }

  async consumeMagicLinkByCode(email: string, verificationCodeHash: string, now: string, purpose: MagicLinkPurpose = "login"): Promise<MagicLink | null> {
    const rows = await this.query(`UPDATE magic_link_tokens token SET consumed_at = $3
      FROM users user_account
      WHERE token.target_email = $1
        AND token.purpose = $4
        AND token.verification_code_hash = $2
        AND token.consumed_at IS NULL
        AND token.expires_at > $3
      RETURNING token.*`, [email, verificationCodeHash, now, purpose]);
    return rows[0] ? magicLinkFromRow(rows[0]) : null;
  }

  async consumeMagicLinkByEmail(email: string, now: string, purpose: MagicLinkPurpose = "login"): Promise<MagicLink | null> {
    const rows = await this.query(`UPDATE magic_link_tokens token SET consumed_at = $2
      FROM users user_account
      WHERE token.target_email = $1
        AND token.purpose = $3
        AND token.consumed_at IS NULL
        AND token.expires_at > $2
      RETURNING token.*`, [email, now, purpose]);
    return rows[0] ? magicLinkFromRow(rows[0]) : null;
  }

  async createWebAuthnChallenge(challenge: WebAuthnChallenge): Promise<void> {
    await this.query("INSERT INTO webauthn_challenges (id, user_id, kind, challenge, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)", [challenge.id, challenge.userId, challenge.kind, challenge.challenge, challenge.expiresAt, challenge.createdAt]);
  }

  async consumeWebAuthnChallenge(id: string, kind: ChallengeKind, now: string): Promise<WebAuthnChallenge | null> {
    const rows = await this.query("UPDATE webauthn_challenges SET consumed_at = $3 WHERE id = $1 AND kind = $2 AND consumed_at IS NULL AND expires_at > $3 RETURNING *", [id, kind, now]);
    const row = rows[0];
    return row ? { id: string(row, "id"), userId: optionalString(row, "user_id"), kind: string(row, "kind") as ChallengeKind, challenge: string(row, "challenge"), expiresAt: timestamp(row, "expires_at"), consumedAt: optionalTimestamp(row, "consumed_at"), createdAt: timestamp(row, "created_at") } : null;
  }

  async createCredential(credential: WebAuthnCredential): Promise<void> {
    await this.query("INSERT INTO webauthn_credentials (id, user_id, public_key, counter, transports, device_type, backed_up, created_at, last_used_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [credential.id, credential.userId, credential.publicKey, credential.counter, credential.transports, credential.deviceType, credential.backedUp, credential.createdAt, credential.lastUsedAt]);
  }

  async getCredential(id: string): Promise<WebAuthnCredential | null> {
    const rows = await this.query("SELECT * FROM webauthn_credentials WHERE id = $1", [id]);
    return rows[0] ? credentialFromRow(rows[0]) : null;
  }

  async listCredentialsForUser(userId: string): Promise<WebAuthnCredential[]> {
    return (await this.query("SELECT * FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at", [userId])).map(credentialFromRow);
  }

  async updateCredentialCounter(id: string, counter: number, usedAt: string): Promise<void> {
    await this.query("UPDATE webauthn_credentials SET counter = $2, last_used_at = $3 WHERE id = $1", [id, counter, usedAt]);
  }

  async createAgent(agent: Agent, ownerId: string): Promise<void> {
    await this.query("INSERT INTO agents (id, name, status, created_by_user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)", [agent.id, agent.name, agent.status, ownerId, agent.createdAt, agent.updatedAt]);
    await this.query("INSERT INTO agent_members (agent_id, user_id, role) VALUES ($1, $2, 'owner')", [agent.id, ownerId]);
  }

  async getAgent(id: string): Promise<Agent | null> {
    const rows = await this.query("SELECT * FROM agents WHERE id = $1", [id]);
    return rows[0] ? agentFromRow(rows[0]) : null;
  }

  async updateAgent(agent: Agent): Promise<void> {
    await this.query("UPDATE agents SET name = $2, status = $3, updated_at = $4 WHERE id = $1", [agent.id, agent.name, agent.status, agent.updatedAt]);
  }

  async getAgentPublicProfile(agentId: string): Promise<AgentPublicProfile | null> {
    const rows = await this.query("SELECT agent_id, summary, role AS public_role, language, attributes, published, allow_discovery, allow_direct_dial, peer_id, multiaddrs, relay_multiaddrs, updated_at AS profile_updated_at FROM agent_public_profiles WHERE agent_id = $1", [agentId]);
    return rows[0] ? publicProfileFromRow(rows[0]) : null;
  }

  async saveAgentPublicProfile(profile: AgentPublicProfile): Promise<void> {
    const connection = profile.connection ?? { allowDiscovery: false, allowDirectDial: false, peerId: null, multiaddrs: [], relayMultiaddrs: [] };
    await this.query(`INSERT INTO agent_public_profiles (agent_id, summary, role, language, attributes, published, allow_discovery, allow_direct_dial, peer_id, multiaddrs, relay_multiaddrs, updated_at)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
      ON CONFLICT (agent_id) DO UPDATE SET summary = EXCLUDED.summary, role = EXCLUDED.role, language = EXCLUDED.language,
        attributes = EXCLUDED.attributes, published = EXCLUDED.published, allow_discovery = EXCLUDED.allow_discovery,
        allow_direct_dial = EXCLUDED.allow_direct_dial, peer_id = EXCLUDED.peer_id, multiaddrs = EXCLUDED.multiaddrs,
        relay_multiaddrs = EXCLUDED.relay_multiaddrs, updated_at = EXCLUDED.updated_at`,
    [profile.agentId, profile.summary, profile.role, profile.language, JSON.stringify(profile.attributes), profile.published, connection.allowDiscovery, connection.allowDirectDial, connection.peerId, JSON.stringify(connection.multiaddrs), JSON.stringify(connection.relayMultiaddrs), profile.updatedAt]);
  }

  async listPublicAgents(): Promise<PublicAgentRecord[]> {
    const rows = await this.query(`SELECT a.*, p.agent_id, p.summary, p.role AS public_role, p.language, p.attributes, p.published, p.allow_discovery, p.allow_direct_dial, p.peer_id, p.multiaddrs, p.relay_multiaddrs, p.updated_at AS profile_updated_at
      FROM agents a JOIN agent_public_profiles p ON p.agent_id = a.id
      WHERE p.published = true AND a.status = 'active' ORDER BY p.updated_at DESC`);
    return rows.map((row) => ({ agent: agentFromRow(row), profile: publicProfileFromRow(row) }));
  }

  async getMemberRole(agentId: string, userId: string): Promise<AgentRole | null> {
    const rows = await this.query("SELECT role FROM agent_members WHERE agent_id = $1 AND user_id = $2 AND status = 'active'", [agentId, userId]);
    return rows[0] ? string(rows[0], "role") as AgentRole : null;
  }

  async listMembers(agentId: string): Promise<AgentMember[]> {
    const rows = await this.query(`SELECT m.agent_id, m.user_id, u.email, u.display_name, m.role, m.status, m.created_at
      FROM agent_members m JOIN users u ON u.id = m.user_id WHERE m.agent_id = $1 ORDER BY m.created_at`, [agentId]);
    return rows.map((row) => ({ agentId: string(row, "agent_id"), userId: string(row, "user_id"), email: string(row, "email"), displayName: string(row, "display_name"), role: string(row, "role") as AgentRole, status: string(row, "status") as "active" | "disabled", createdAt: timestamp(row, "created_at") }));
  }

  async upsertMember(agentId: string, userId: string, role: AgentRole): Promise<void> {
    await this.query(`INSERT INTO agent_members (agent_id, user_id, role, status) VALUES ($1, $2, $3, 'active')
      ON CONFLICT (agent_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'active'`, [agentId, userId, role]);
  }

  async removeMember(agentId: string, userId: string): Promise<void> {
    await this.query("DELETE FROM agent_members WHERE agent_id = $1 AND user_id = $2", [agentId, userId]);
  }

  async listAgentSummaries(userId: string): Promise<AgentSummary[]> {
    const rows = await this.query(`SELECT a.*, m.role,
      (SELECT count(*) FROM instance_bindings b WHERE b.agent_id = a.id AND b.status = 'active') AS instance_count,
      (SELECT count(*) FROM device_authorizations d WHERE d.status = 'pending' AND (d.agent_id = a.id OR d.agent_hint = a.id)) AS pending_count
      FROM agents a JOIN agent_members m ON m.agent_id = a.id
      WHERE m.user_id = $1 AND m.status = 'active' AND a.status = 'active' ORDER BY a.created_at DESC`, [userId]);
    return rows.map((row) => ({ ...agentFromRow(row), role: string(row, "role") as AgentRole, instanceCount: number(row, "instance_count"), pendingApprovalCount: number(row, "pending_count") }));
  }

  async createDeviceAuthorization(authorization: DeviceAuthorization): Promise<void> {
    await this.query(`INSERT INTO device_authorizations (id, client_id, agent_hint, agent_creation_requested, agent_id, instance_id, instance_public_key, public_key_fingerprint, instance_label, platform, scopes, agent_profile, code_challenge, device_code_hash, poll_interval_seconds, status, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18)`, [authorization.id, authorization.clientId, authorization.agentHint, authorization.agentCreationRequested, authorization.agentId, authorization.instanceId, authorization.instancePublicKey, authorization.publicKeyFingerprint, authorization.instanceLabel, authorization.platform, authorization.scopes, authorization.agentProfile ? JSON.stringify(authorization.agentProfile) : null, authorization.codeChallenge, authorization.deviceCodeHash, authorization.pollIntervalSeconds, authorization.status, authorization.createdAt, authorization.expiresAt]);
  }

  async getDeviceAuthorization(id: string): Promise<DeviceAuthorization | null> {
    const rows = await this.query("SELECT * FROM device_authorizations WHERE id = $1", [id]);
    return rows[0] ? deviceFromRow(rows[0]) : null;
  }

  async getDeviceAuthorizationForUpdate(id: string): Promise<DeviceAuthorization | null> {
    const rows = await this.query("SELECT * FROM device_authorizations WHERE id = $1 FOR UPDATE", [id]);
    return rows[0] ? deviceFromRow(rows[0]) : null;
  }

  async getDeviceAuthorizationByCodeHashForUpdate(codeHash: string): Promise<DeviceAuthorization | null> {
    const rows = await this.query("SELECT * FROM device_authorizations WHERE device_code_hash = $1 FOR UPDATE", [codeHash]);
    return rows[0] ? deviceFromRow(rows[0]) : null;
  }

  async saveDeviceAuthorization(authorization: DeviceAuthorization): Promise<void> {
    await this.query(`UPDATE device_authorizations SET agent_id = $2, poll_interval_seconds = $3, last_polled_at = $4, status = $5, decision_reason = $6, decided_at = $7, decided_by_user_id = $8, binding_jti = $9, exchanged_at = $10 WHERE id = $1`, [authorization.id, authorization.agentId, authorization.pollIntervalSeconds, authorization.lastPolledAt, authorization.status, authorization.decisionReason, authorization.decidedAt, authorization.decidedByUserId, authorization.bindingJti, authorization.exchangedAt]);
  }

  async listApprovalsForUser(userId: string, status: DeviceStatus): Promise<DeviceAuthorization[]> {
    const rows = await this.query(`SELECT d.* FROM device_authorizations d
      JOIN agent_members m ON m.agent_id = COALESCE(d.agent_id, d.agent_hint)
      WHERE m.user_id = $1 AND m.status = 'active' AND d.status = $2 ORDER BY d.created_at DESC`, [userId, status]);
    return rows.map(deviceFromRow);
  }

  async createBinding(binding: InstanceBinding): Promise<void> {
    await this.query(`INSERT INTO instance_bindings (jti, agent_id, instance_id, instance_public_key, public_key_fingerprint, instance_label, platform, scopes, status, issued_at, expires_at, approved_by_user_id, ibc)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [binding.jti, binding.agentId, binding.instanceId, binding.instancePublicKey, binding.publicKeyFingerprint, binding.instanceLabel, binding.platform, binding.scopes, binding.status, binding.issuedAt, binding.expiresAt, binding.approvedByUserId, binding.ibc]);
  }

  async getBinding(jti: string): Promise<InstanceBinding | null> {
    const rows = await this.query("SELECT * FROM instance_bindings WHERE jti = $1", [jti]);
    return rows[0] ? bindingFromRow(rows[0]) : null;
  }

  async getBindingForUpdate(jti: string): Promise<InstanceBinding | null> {
    const rows = await this.query("SELECT * FROM instance_bindings WHERE jti = $1 FOR UPDATE", [jti]);
    return rows[0] ? bindingFromRow(rows[0]) : null;
  }

  async createBindingRenewalChallenge(challenge: BindingRenewalChallenge): Promise<void> {
    await this.query("INSERT INTO binding_renewal_challenges (id, jti, challenge, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)", [challenge.id, challenge.jti, challenge.challenge, challenge.expiresAt, challenge.createdAt]);
  }

  async consumeBindingRenewalChallenge(id: string, jti: string, now: string): Promise<BindingRenewalChallenge | null> {
    const rows = await this.query(`UPDATE binding_renewal_challenges SET consumed_at = $3
      WHERE id = $1 AND jti = $2 AND consumed_at IS NULL AND expires_at > $3 RETURNING *`, [id, jti, now]);
    const row = rows[0];
    return row ? { id: string(row, "id"), jti: string(row, "jti"), challenge: string(row, "challenge"), expiresAt: timestamp(row, "expires_at"), consumedAt: optionalTimestamp(row, "consumed_at"), createdAt: timestamp(row, "created_at") } : null;
  }

  async findActiveBindingForUpdate(agentId: string, instanceId: string): Promise<InstanceBinding | null> {
    const rows = await this.query("SELECT * FROM instance_bindings WHERE agent_id = $1 AND instance_id = $2 AND status = 'active' ORDER BY issued_at DESC LIMIT 1 FOR UPDATE", [agentId, instanceId]);
    return rows[0] ? bindingFromRow(rows[0]) : null;
  }

  async listBindings(agentId: string): Promise<InstanceBinding[]> {
    return (await this.query("SELECT * FROM instance_bindings WHERE agent_id = $1 ORDER BY issued_at DESC", [agentId])).map(bindingFromRow);
  }

  async saveBinding(binding: InstanceBinding): Promise<void> {
    await this.query("UPDATE instance_bindings SET status = $2, revoked_at = $3, revoked_by_user_id = $4, revocation_reason = $5 WHERE jti = $1", [binding.jti, binding.status, binding.revokedAt, binding.revokedByUserId, binding.revocationReason]);
  }

  async addAuditEvent(event: NewAuditEvent): Promise<void> {
    if (this.pool) {
      await this.transaction(async (transaction) => transaction.addAuditEvent(event));
      return;
    }
    await this.query("SELECT pg_advisory_xact_lock(hashtext($1))", ["agentid-audit-chain-v1"]);
    const rows = await this.query("SELECT event_hash FROM audit_events ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE");
    const previousHash = rows[0] ? optionalString(rows[0], "event_hash") ?? AUDIT_GENESIS_HASH : AUDIT_GENESIS_HASH;
    const stored = materializeAuditEvent(event, previousHash);
    await this.query("INSERT INTO audit_events (id, actor_user_id, agent_id, instance_id, binding_jti, action, detail, created_at, prev_hash, event_hash) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)", [stored.id, stored.actorUserId, stored.agentId, stored.instanceId, stored.bindingJti, stored.action, stored.detail, stored.createdAt, stored.previousHash, stored.eventHash]);
  }

  async listActivityForUser(userId: string, agentId?: string): Promise<AuditEvent[]> {
    const rows = await this.query(`SELECT e.* FROM audit_events e WHERE EXISTS (
      SELECT 1 FROM agent_members m WHERE m.agent_id = e.agent_id AND m.user_id = $1 AND m.status = 'active'
    ) ${agentId ? "AND e.agent_id = $2" : ""} ORDER BY e.created_at DESC LIMIT 200`, agentId ? [userId, agentId] : [userId]);
    return rows.map((row) => ({ id: string(row, "id"), actorUserId: optionalString(row, "actor_user_id"), agentId: optionalString(row, "agent_id"), instanceId: optionalString(row, "instance_id"), bindingJti: optionalString(row, "binding_jti"), action: string(row, "action"), detail: auditDetail(row), createdAt: timestamp(row, "created_at"), previousHash: optionalString(row, "prev_hash") ?? AUDIT_GENESIS_HASH, eventHash: optionalString(row, "event_hash") ?? AUDIT_GENESIS_HASH }));
  }

  async lockIdempotency(scope: string, key: string): Promise<void> {
    await this.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${scope}:${key}`]);
  }

  async getIdempotency(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const rows = await this.query("SELECT * FROM idempotency_keys WHERE scope = $1 AND key = $2", [scope, key]);
    const row = rows[0];
    return row ? { scope: string(row, "scope"), key: string(row, "key"), requestHash: string(row, "request_hash"), responseStatus: number(row, "response_status"), responseBody: object(row, "response_body") } : null;
  }

  async createIdempotency(record: IdempotencyRecord): Promise<void> {
    await this.query("INSERT INTO idempotency_keys (scope, key, request_hash, response_status, response_body) VALUES ($1, $2, $3, $4, $5)", [record.scope, record.key, record.requestHash, record.responseStatus, record.responseBody]);
  }
}

function credentialFromRow(row: Row): WebAuthnCredential {
  const deviceType = string(row, "device_type");
  return { id: string(row, "id"), userId: string(row, "user_id"), publicKey: string(row, "public_key"), counter: number(row, "counter"), transports: textArray(row, "transports"), deviceType: deviceType === "multiDevice" ? "multiDevice" : "singleDevice", backedUp: row["backed_up"] === true, createdAt: timestamp(row, "created_at"), lastUsedAt: optionalTimestamp(row, "last_used_at") };
}

function magicLinkFromRow(row: Row): MagicLink {
  return {
    id: string(row, "id"),
    userId: string(row, "user_id"),
    purpose: (optionalString(row, "purpose") as MagicLink["purpose"] | null) ?? "login",
    targetEmail: optionalString(row, "target_email") ?? "",
    tokenHash: string(row, "token_hash"),
    verificationCodeHash: optionalString(row, "verification_code_hash") ?? "",
    returnTo: string(row, "return_to"),
    expiresAt: timestamp(row, "expires_at"),
    consumedAt: optionalTimestamp(row, "consumed_at"),
    createdAt: timestamp(row, "created_at"),
  };
}

function object(row: Row, field: string): Record<string, unknown> {
  const value = row[field];
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`Database field ${field} is not an object.`);
  return value as Record<string, unknown>;
}

function auditDetail(row: Row): AuditEvent["detail"] {
  const detail = object(row, "detail");
  const values = Object.entries(detail);
  if (values.some(([, value]) => value !== null && typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")) {
    throw new Error("Database audit detail contains a non-scalar value.");
  }
  return Object.fromEntries(values) as AuditEvent["detail"];
}
