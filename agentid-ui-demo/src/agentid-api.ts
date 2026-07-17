const defaultApiOrigin = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:8787`
  : "http://127.0.0.1:8787";
const API_BASE_URL = (import.meta.env.VITE_AGENTID_API_URL ?? defaultApiOrigin).replace(/\/$/, "");
const DEMO_CONTROL_URL = (import.meta.env.VITE_DEMO_CONTROL_URL ?? "").replace(/\/$/, "");

export const demoModeEnabled = Boolean(DEMO_CONTROL_URL);

export type Agent = {
  id: string;
  name: string;
  role: "owner" | "admin" | "operator" | "viewer";
  status: string;
  instanceCount: number;
  pendingApprovalCount: number;
  createdAt?: string;
};

export type PublicAttribute = {
  key: string;
  label: string;
  value: string;
  kind: "capability" | "tag" | "context";
  trust: "self_declared" | "verified";
  visible: boolean;
};

export type AgentPublicProfile = {
  agentId: string;
  summary: string;
  role: string;
  language: string;
  attributes: PublicAttribute[];
  published: boolean;
  connection?: {
    allowDiscovery: boolean;
    allowDirectDial: boolean;
    peerId: string | null;
    multiaddrs: string[];
    relayMultiaddrs: string[];
  };
  updatedAt: string;
};

export type DiscoveryTicket = {
  ticket: string;
  agentId: string;
  peerId: string;
  multiaddrs: string[];
  relayMultiaddrs: string[];
  expiresIn: number;
  expiresAt: string;
};

export type PublicAgentRecord = {
  agent: Agent;
  profile: AgentPublicProfile;
};

export type AgentMember = {
  agentId: string;
  userId: string;
  email: string | null;
  displayName: string;
  role: "owner" | "admin" | "viewer";
  status: string;
  createdAt: string;
};

export type Instance = {
  jti: string;
  agentId: string;
  instanceId: string;
  instanceLabel: string;
  platform: string;
  publicKeyFingerprint: string;
  status: "active" | "revoked" | "expired" | string;
  scopes: string[];
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type Approval = {
  id: string;
  agentId?: string;
  agentCreationRequested?: boolean;
  proposedAgentId?: string;
  instanceId: string;
  instanceLabel: string;
  platform: string;
  publicKeyFingerprint: string;
  scopes: string[];
  agentProfile?: {
    summary: string;
    role: string;
    language: string;
    attributes: Array<Pick<PublicAttribute, "key" | "label" | "value" | "kind">>;
  } | null;
  status: "pending" | "approved" | "denied" | "expired" | "exchanged" | string;
  expiresAt: string;
  approvedAt?: string;
  allowedActions: string[];
};

export type AuditEvent = {
  id: string;
  at: string;
  type: string;
  agentId?: string;
  instanceId?: string;
  actorUserId?: string;
  result?: string;
};

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  passkeyEnrolled: boolean;
};

export type DemoClientStatus = {
  nodeId: "A" | "B" | string;
  profile: string;
  gatewayRunning: boolean;
  linkRunning: boolean;
  instanceId: string | null;
  instanceName: string | null;
  instancePublicKeyFingerprint: string | null;
  agentId: string | null;
  userIdHash: string | null;
  jti: string | null;
  scopes: string[];
  status: string;
  expiresAt: string | null;
  lastStatusCheckAt: string | null;
  error: string | null;
};

export type DemoP2PEvent = {
  nodeId: string;
  direction: string;
  fromPeerId?: string | null;
  fromInstanceId?: string | null;
  agentId?: string | null;
  ibcVerified: boolean;
  payload?: string;
  at: string;
  mode?: string;
};

export type DemoStatus = {
  service: { url: string; health: { ok: boolean; status: number; body?: unknown; error?: string } };
  web: { url: string };
  control: { url: string };
  clients: { a: DemoClientStatus; b: DemoClientStatus };
  p2p: { status: string; mode?: string; result?: { error?: string; events?: DemoP2PEvent[]; verifiedCount?: number; acceptedByNode?: Record<string, number> } | null };
  mailbox: Array<{ email: string; code: string; expiresAt: string }>;
  events: Array<{ id: string; type: string; at: string; [key: string]: unknown }>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

function idempotencyKey() {
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const entropy = Math.random().toString(16).slice(2).padEnd(12, "0");
  return `${Date.now().toString(16)}-${entropy.slice(0, 8)}-${entropy.slice(8, 12)}-${Math.random().toString(16).slice(2, 14)}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) {
    headers.set("content-type", "application/json");
    headers.set("x-agentid-request", "1");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } } & T;

  if (!response.ok) {
    throw new ApiError(body.error?.message ?? "身份服务请求失败。", response.status, body.error?.code);
  }
  return body;
}

function mutation<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey() },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export const agentIdApi = {
  async getCurrentUser(): Promise<CurrentUser> {
    const response = await request<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/me");
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async registerAccount(username: string, email: string, password: string, displayName?: string): Promise<{ expiresAt: string; delivery: "console" | "email" }> {
    const response = await mutation<{ status: string; expiresAt: string; delivery?: "console" | "email" }>("/v1/auth/register", { username, email, password, displayName });
    return { expiresAt: response.expiresAt, delivery: response.delivery === "console" ? "console" : "email" };
  },
  async verifyRegistration(email: string, code: string): Promise<CurrentUser> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/register/verify", { email, code });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async resendRegistrationCode(email: string): Promise<{ expiresAt: string; delivery: "console" | "email" }> {
    const response = await mutation<{ status: string; expiresAt: string; delivery?: "console" | "email" }>("/v1/auth/register/resend", { email });
    return { expiresAt: response.expiresAt, delivery: response.delivery === "console" ? "console" : "email" };
  },
  async login(identifier: string, password: string): Promise<CurrentUser> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/login", { identifier, password });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async startEmailCode(email: string): Promise<{ message: string; expiresAt: string; delivery: "console" | "email" }> {
    const response = await mutation<{ status: string; expiresAt: string; delivery?: "console" | "email" }>("/v1/auth/email-code/start", { email, returnTo: window.location.pathname + window.location.search });
    const expiresAt = new Date(response.expiresAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    const delivery = response.delivery === "console" ? "console" : "email";
    return { message: delivery === "console" ? `本地演示邮件未外发，验证码已生成。点击“读取本地验证码”即可继续。有效期至 ${expiresAt}。` : `验证码已发送到邮箱，有效期至 ${expiresAt}。`, expiresAt, delivery };
  },
  async getConsoleMailbox(email: string): Promise<{ email: string; code: string | null; expiresAt?: string | null }> {
    const response = await request<{ email: string; code: string | null; expiresAt?: string | null }>(`/v1/auth/dev-mailbox?email=${encodeURIComponent(email)}`);
    return response;
  },
  async getDemoMailbox(email: string): Promise<{ email: string; code: string | null; expiresAt?: string }> {
    if (!DEMO_CONTROL_URL) return { email, code: null };
    const response = await fetch(`${DEMO_CONTROL_URL}/demo/mailbox?email=${encodeURIComponent(email)}`, { headers: { "x-agentid-demo": "1" } });
    if (!response.ok) throw new ApiError("本地验证码桥不可用。", response.status, "DEMO_BRIDGE_UNAVAILABLE");
    return response.json() as Promise<{ email: string; code: string | null; expiresAt?: string }>;
  },
  async consumeEmailCode(email: string, code: string): Promise<{ user: CurrentUser; returnTo: string }> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean }; returnTo: string }>("/v1/auth/email-code/consume", { email, code });
    return { user: { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false }, returnTo: response.returnTo };
  },
  async startAccountRecovery(email: string): Promise<{ expiresAt: string; delivery: "console" | "email" }> {
    const response = await mutation<{ status: string; expiresAt: string; delivery?: "console" | "email" }>("/v1/auth/recovery/start", { email });
    return { expiresAt: response.expiresAt, delivery: response.delivery === "console" ? "console" : "email" };
  },
  async completeAccountRecovery(email: string, code: string, newPassword: string): Promise<CurrentUser> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/recovery/complete", { email, code, newPassword });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async startEmailBinding(email: string): Promise<{ expiresAt: string }> {
    const response = await mutation<{ status: string; expiresAt: string }>("/v1/auth/email/bind/start", { email });
    return { expiresAt: response.expiresAt };
  },
  async verifyEmailBinding(email: string, code: string): Promise<CurrentUser> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/email/bind/verify", { email, code });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async consumeMagicLink(token: string): Promise<CurrentUser> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/magic-link/consume", { token });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async registerPasskey(): Promise<{ passkeyEnrolled: boolean }> {
    const start = await mutation<{ challengeId: string; options: JsonCreationOptions }>("/v1/auth/webauthn/registration/options", {});
    if (!window.PublicKeyCredential || !navigator.credentials) {
      throw new ApiError("此浏览器不支持 Passkey。", 400, "WEBAUTHN_UNAVAILABLE");
    }
    const credential = await navigator.credentials.create({ publicKey: toCreationOptions(start.options) });
    if (!(credential instanceof PublicKeyCredential)) {
      throw new ApiError("未能创建 Passkey。", 400, "WEBAUTHN_CANCELLED");
    }
    await mutation("/v1/auth/webauthn/registration/verify", { challengeId: start.challengeId, response: credentialToJson(credential) });
    return { passkeyEnrolled: true };
  },
  async verifyPasskey(identifier: string): Promise<CurrentUser> {
    const start = await mutation<{ challengeId: string; options: JsonRequestOptions }>("/v1/auth/webauthn/authentication/options", { identifier });
    if (!window.PublicKeyCredential || !navigator.credentials) {
      throw new ApiError("此浏览器不支持 Passkey。", 400, "WEBAUTHN_UNAVAILABLE");
    }
    const credential = await navigator.credentials.get({ publicKey: toRequestOptions(start.options) });
    if (!(credential instanceof PublicKeyCredential)) {
      throw new ApiError("未能完成 Passkey 验证。", 400, "WEBAUTHN_CANCELLED");
    }
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/webauthn/authentication/verify", {
      challengeId: start.challengeId,
      response: credentialToJson(credential),
    });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? true };
  },
  async verifyDevelopmentPasskey(identifier: string, code: string): Promise<CurrentUser> {
    const response = await mutation<{ user: Omit<CurrentUser, "passkeyEnrolled"> & { passkeyEnrolled?: boolean } }>("/v1/auth/dev-passkey/verify", { identifier, code });
    return { ...response.user, passkeyEnrolled: response.user.passkeyEnrolled ?? false };
  },
  async listAgents(): Promise<{ items: Agent[] }> {
    const response = await request<{ agents: Agent[] }>("/v1/me/agents");
    return { items: response.agents };
  },
  async createAgent(name: string): Promise<Agent> {
    const response = await mutation<{ agent: Agent }>("/v1/agents", { name });
    return response.agent;
  },
  async updateAgent(agentId: string, name: string): Promise<Agent> {
    const response = await mutation<{ agent: Agent }>(`/v1/agents/${encodeURIComponent(agentId)}`, { name });
    return response.agent;
  },
  async getPublicProfile(agentId: string): Promise<AgentPublicProfile> {
    const response = await request<{ profile: AgentPublicProfile }>(`/v1/agents/${encodeURIComponent(agentId)}/public-profile`);
    return response.profile;
  },
  async updatePublicProfile(agentId: string, profile: Omit<AgentPublicProfile, "agentId" | "updatedAt">): Promise<AgentPublicProfile> {
    const response = await request<{ profile: AgentPublicProfile }>(`/v1/agents/${encodeURIComponent(agentId)}/public-profile`, {
      method: "PATCH",
      headers: { "idempotency-key": idempotencyKey() },
      body: JSON.stringify(profile),
    });
    return response.profile;
  },
  async listPublicAgents(params: { query?: string; tag?: string; capability?: string; connection?: "available"; verified?: boolean } = {}): Promise<PublicAgentRecord[]> {
    const search = new URLSearchParams();
    if (params.query) search.set("query", params.query);
    if (params.tag) search.set("tag", params.tag);
    if (params.capability) search.set("capability", params.capability);
    if (params.connection) search.set("connection", params.connection);
    if (params.verified) search.set("verified", "true");
    const response = await request<{ agents: PublicAgentRecord[] }>(`/v1/public/agents${search.toString() ? `?${search.toString()}` : ""}`);
    return response.agents;
  },
  async getPublicAgent(agentId: string): Promise<PublicAgentRecord> {
    const response = await request<PublicAgentRecord>(`/v1/public/agents/${encodeURIComponent(agentId)}`);
    return response;
  },
  async getDiscoveryTicket(agentId: string): Promise<DiscoveryTicket> {
    return request<DiscoveryTicket>(`/v1/public/agents/${encodeURIComponent(agentId)}/connection-ticket`);
  },
  async listMembers(agentId: string): Promise<{ items: AgentMember[] }> {
    const response = await request<{ members: AgentMember[] }>(`/v1/agents/${encodeURIComponent(agentId)}/members`);
    return { items: response.members };
  },
  async addMember(agentId: string, email: string, role: "admin" | "viewer"): Promise<AgentMember> {
    const response = await mutation<{ member: AgentMember }>(`/v1/agents/${encodeURIComponent(agentId)}/members`, { email, role });
    return response.member;
  },
  async listInstances(agentId: string): Promise<{ items: Instance[] }> {
    const response = await request<{ instances: Instance[] }>(`/v1/agents/${encodeURIComponent(agentId)}/instances`);
    return { items: response.instances };
  },
  async listApprovals(): Promise<{ items: Approval[] }> {
    const response = await request<{ approvals: ServerApproval[] }>("/v1/approvals?status=pending");
    return { items: response.approvals.map(normalizeApproval) };
  },
  async getApproval(requestId: string): Promise<Approval> {
    const response = await request<{ approval: ServerApproval }>(`/v1/approvals/${encodeURIComponent(requestId)}`);
    return normalizeApproval(response.approval);
  },
  async approve(requestId: string, agentId?: string): Promise<{ request: Approval }> {
    const response = await mutation<{ approval: ServerApproval }>(`/v1/approvals/${encodeURIComponent(requestId)}/approve`, agentId ? { agentId } : {});
    return { request: normalizeApproval(response.approval) };
  },
  async deny(requestId: string): Promise<{ request: Approval }> {
    const response = await mutation<{ approval: ServerApproval }>(`/v1/approvals/${encodeURIComponent(requestId)}/deny`, {});
    return { request: normalizeApproval(response.approval) };
  },
  async revoke(agentId: string, instanceId: string): Promise<Instance> {
    const response = await mutation<{ binding: Instance }>(`/v1/agents/${encodeURIComponent(agentId)}/instances/${encodeURIComponent(instanceId)}/revoke`, {});
    return response.binding;
  },
  async listActivity(): Promise<{ items: AuditEvent[] }> {
    const response = await request<{ activity: ServerAuditEvent[] }>("/v1/activity");
    return { items: response.activity.map((event) => ({ ...event, at: event.createdAt, type: event.action })) };
  },
};

async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!DEMO_CONTROL_URL) throw new ApiError("Demo 控制桥未启用。", 404, "DEMO_DISABLED");
  const response = await fetch(`${DEMO_CONTROL_URL}${path}`, { ...init, headers: { "content-type": "application/json", "x-agentid-demo": "1", ...init.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body?.error?.message ?? body?.error ?? "Demo 控制桥请求失败。", response.status, body?.error?.code);
  return body as T;
}

export const demoApi = {
  getStatus: () => demoRequest<DemoStatus>("/demo/status"),
  startP2P: (mode: "initial" | "after-revoke" = "initial") => demoRequest<{ status: string; mode: string }>("/demo/p2p/start", { method: "POST", body: JSON.stringify({ mode }) }),
  reset: () => demoRequest<{ status: string }>("/demo/reset", { method: "POST" }),
};

type ServerApproval = Omit<Approval, "scopes"> & {
  requestedScopes: string[];
};

type ServerAuditEvent = Omit<AuditEvent, "at" | "type"> & {
  createdAt: string;
  action: string;
};

type JsonCreationOptions = {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  attestation?: AttestationConveyancePreference;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  excludeCredentials?: Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }>;
  extensions?: AuthenticationExtensionsClientInputs;
};

type JsonRequestOptions = {
  challenge: string;
  rpId?: string;
  timeout?: number;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: Array<{ id: string; type: PublicKeyCredentialType; transports?: AuthenticatorTransport[] }>;
  extensions?: AuthenticationExtensionsClientInputs;
};

function normalizeApproval(approval: ServerApproval): Approval {
  return {
    ...approval,
    scopes: approval.requestedScopes,
  };
}

function toCreationOptions(options: JsonCreationOptions): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64UrlBytes(options.challenge),
    user: { ...options.user, id: base64UrlBytes(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map((credential) => ({ ...credential, id: base64UrlBytes(credential.id) })),
  };
}

function toRequestOptions(options: JsonRequestOptions): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64UrlBytes(options.challenge),
    allowCredentials: options.allowCredentials?.map((credential) => ({ ...credential, id: base64UrlBytes(credential.id) })),
  };
}

function base64UrlBytes(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function credentialToJson(credential: PublicKeyCredential): unknown {
  const jsonCredential = credential as PublicKeyCredential & { toJSON?: () => unknown };
  if (jsonCredential.toJSON) return jsonCredential.toJSON();
  const response = credential.response;
  if (response instanceof AuthenticatorAssertionResponse) {
    return {
      id: credential.id,
      rawId: bufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64Url(response.clientDataJSON),
        authenticatorData: bufferToBase64Url(response.authenticatorData),
        signature: bufferToBase64Url(response.signature),
        userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : undefined,
      },
    };
  }
  const attestation = response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
      attestationObject: bufferToBase64Url(attestation.attestationObject),
    },
  };
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
