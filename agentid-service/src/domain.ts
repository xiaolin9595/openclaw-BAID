export const ALLOWED_SCOPES = ["p2p:announce", "p2p:message"] as const;
export type Scope = (typeof ALLOWED_SCOPES)[number];
export type AgentRole = "owner" | "admin" | "viewer";
export type DeviceStatus = "pending" | "approved" | "denied" | "exchanged" | "expired" | "revoked";
export type BindingStatus = "active" | "revoked" | "expired";
export type ChallengeKind = "registration" | "authentication";
export type MagicLinkPurpose = "login" | "recovery" | "binding" | "registration";

export interface User {
  id: string;
  username: string;
  email: string | null;
  passwordHash: string | null;
  displayName: string;
  createdAt: string;
  emailVerifiedAt?: string | null;
}

export interface Agent {
  id: string;
  name: string;
  ownerId: string;
  status: "active" | "disabled";
  createdAt: string;
  updatedAt: string;
}

export interface AgentSummary extends Agent {
  role: AgentRole;
  instanceCount: number;
  pendingApprovalCount: number;
}

export type PublicAttributeKind = "capability" | "tag" | "context";
export type PublicAttributeTrust = "self_declared" | "verified";

export interface AgentPublicConnection {
  allowDiscovery: boolean;
  allowDirectDial: boolean;
  peerId: string | null;
  multiaddrs: string[];
  relayMultiaddrs: string[];
}

export interface AgentPublicAttribute {
  key: string;
  label: string;
  value: string;
  kind: PublicAttributeKind;
  trust: PublicAttributeTrust;
  visible: boolean;
}

export interface AgentPublicProfile {
  agentId: string;
  summary: string;
  role: string;
  language: string;
  attributes: AgentPublicAttribute[];
  published: boolean;
  connection?: AgentPublicConnection;
  updatedAt: string;
}

export interface PublicAgentRecord {
  agent: Agent;
  profile: AgentPublicProfile;
}

export interface AgentMember {
  agentId: string;
  userId: string;
  email: string | null;
  displayName: string;
  role: AgentRole;
  status: "active" | "disabled";
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  verifiedAt: string | null;
  createdAt: string;
}

export interface MagicLink {
  id: string;
  userId: string;
  purpose: MagicLinkPurpose;
  targetEmail: string;
  tokenHash: string;
  verificationCodeHash: string;
  returnTo: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export interface WebAuthnChallenge {
  id: string;
  userId: string | null;
  kind: ChallengeKind;
  challenge: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export interface WebAuthnCredential {
  id: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface DeviceAuthorization {
  id: string;
  clientId: string;
  agentHint: string | null;
  agentCreationRequested: boolean;
  agentId: string | null;
  instanceId: string;
  instancePublicKey: string;
  publicKeyFingerprint: string;
  instanceLabel: string;
  platform: string;
  scopes: Scope[];
  codeChallenge: string;
  deviceCodeHash: string;
  pollIntervalSeconds: number;
  lastPolledAt: string | null;
  status: DeviceStatus;
  decisionReason: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  bindingJti: string | null;
  exchangedAt: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface InstanceBinding {
  jti: string;
  agentId: string;
  instanceId: string;
  instancePublicKey: string;
  publicKeyFingerprint: string;
  instanceLabel: string;
  platform: string;
  scopes: Scope[];
  status: BindingStatus;
  issuedAt: string;
  expiresAt: string;
  approvedByUserId: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  ibc: string;
}

export interface BindingRenewalChallenge {
  id: string;
  jti: string;
  challenge: string;
  expiresAt: string;
  consumedAt: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  agentId: string | null;
  instanceId: string | null;
  bindingJti: string | null;
  action: string;
  detail: Record<string, string | number | boolean | null>;
  createdAt: string;
  previousHash: string;
  eventHash: string;
}

export type NewAuditEvent = Omit<AuditEvent, "previousHash" | "eventHash">;

export interface IdempotencyRecord {
  scope: string;
  key: string;
  requestHash: string;
  responseStatus: number;
  responseBody: Record<string, unknown>;
}

export interface Store {
  transaction<T>(callback: (store: Store) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  checkHealth(): Promise<{ database: boolean; migrations: boolean }>;
  countPendingAuthorizations(): Promise<number>;
  ensureUser(email: string): Promise<User>;
  createUser(user: User): Promise<void>;
  updateUserPassword(userId: string, passwordHash: string): Promise<void>;
  setUserEmail(userId: string, email: string): Promise<void>;
  markUserEmailVerified(userId: string, verifiedAt: string): Promise<void>;
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByUsername(username: string): Promise<User | null>;
  createSession(session: Session): Promise<void>;
  getSessionByTokenHash(tokenHash: string): Promise<Session | null>;
  createMagicLink(link: MagicLink): Promise<void>;
  consumeMagicLink(tokenHash: string, now: string, purpose?: MagicLinkPurpose): Promise<MagicLink | null>;
  consumeMagicLinkByCode(email: string, verificationCodeHash: string, now: string, purpose?: MagicLinkPurpose): Promise<MagicLink | null>;
  consumeMagicLinkByEmail(email: string, now: string, purpose?: MagicLinkPurpose): Promise<MagicLink | null>;
  createWebAuthnChallenge(challenge: WebAuthnChallenge): Promise<void>;
  consumeWebAuthnChallenge(id: string, kind: ChallengeKind, now: string): Promise<WebAuthnChallenge | null>;
  createCredential(credential: WebAuthnCredential): Promise<void>;
  getCredential(id: string): Promise<WebAuthnCredential | null>;
  listCredentialsForUser(userId: string): Promise<WebAuthnCredential[]>;
  updateCredentialCounter(id: string, counter: number, usedAt: string): Promise<void>;
  createAgent(agent: Agent, ownerId: string): Promise<void>;
  getAgent(id: string): Promise<Agent | null>;
  updateAgent(agent: Agent): Promise<void>;
  getAgentPublicProfile(agentId: string): Promise<AgentPublicProfile | null>;
  saveAgentPublicProfile(profile: AgentPublicProfile): Promise<void>;
  listPublicAgents(): Promise<PublicAgentRecord[]>;
  getMemberRole(agentId: string, userId: string): Promise<AgentRole | null>;
  listMembers(agentId: string): Promise<AgentMember[]>;
  upsertMember(agentId: string, userId: string, role: AgentRole): Promise<void>;
  removeMember(agentId: string, userId: string): Promise<void>;
  listAgentSummaries(userId: string): Promise<AgentSummary[]>;
  createDeviceAuthorization(authorization: DeviceAuthorization): Promise<void>;
  getDeviceAuthorization(id: string): Promise<DeviceAuthorization | null>;
  getDeviceAuthorizationForUpdate(id: string): Promise<DeviceAuthorization | null>;
  getDeviceAuthorizationByCodeHashForUpdate(codeHash: string): Promise<DeviceAuthorization | null>;
  saveDeviceAuthorization(authorization: DeviceAuthorization): Promise<void>;
  listApprovalsForUser(userId: string, status: DeviceStatus): Promise<DeviceAuthorization[]>;
  createBinding(binding: InstanceBinding): Promise<void>;
  getBinding(jti: string): Promise<InstanceBinding | null>;
  getBindingForUpdate(jti: string): Promise<InstanceBinding | null>;
  createBindingRenewalChallenge(challenge: BindingRenewalChallenge): Promise<void>;
  consumeBindingRenewalChallenge(id: string, jti: string, now: string): Promise<BindingRenewalChallenge | null>;
  findActiveBindingForUpdate(agentId: string, instanceId: string): Promise<InstanceBinding | null>;
  listBindings(agentId: string): Promise<InstanceBinding[]>;
  saveBinding(binding: InstanceBinding): Promise<void>;
  addAuditEvent(event: NewAuditEvent): Promise<void>;
  listActivityForUser(userId: string, agentId?: string): Promise<AuditEvent[]>;
  lockIdempotency(scope: string, key: string): Promise<void>;
  getIdempotency(scope: string, key: string): Promise<IdempotencyRecord | null>;
  createIdempotency(record: IdempotencyRecord): Promise<void>;
}
