import assert from "node:assert/strict";
import { createPublicKey, verify } from "node:crypto";
import test from "node:test";
import { ResendMagicLinkDelivery, TestMagicLinkDelivery, TestWebAuthnAdapter } from "../src/auth.js";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import { hashPassword, hmacSha256, loadIssuerKey, sha256 } from "../src/crypto.js";
import { MemoryStore } from "../src/store.js";

const webOrigin = "http://127.0.0.1:4173";
const issuerUrl = "http://127.0.0.1:8787";

function testConfig(): AppConfig {
  return {
    nodeEnv: "test",
    host: "127.0.0.1",
    port: 0,
    databaseUrl: "postgres://unused/test",
    issuerUrl,
    webOrigin,
    webBaseUrl: `${webOrigin}/`,
    allowedWebOrigins: new Set([webOrigin]),
    rpId: "127.0.0.1",
    allowDevelopmentKeyGeneration: true,
    allowDevelopmentAuth: false,
    userIdHashSecret: "test-user-id-hash-secret",
    sessionCookieName: "agentid_session",
    emailProvider: "console",
    resendApiKey: undefined,
    resendFromEmail: undefined,
    sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
    passkeyStepUpTtlMs: 5 * 60 * 1000,
    magicLinkTtlMs: 15 * 60 * 1000,
    deviceAuthorizationTtlMs: 10 * 60 * 1000,
    bindingTtlMs: 90 * 24 * 60 * 60 * 1000,
    clientId: "openclaw-libp2p-mesh",
    version: "test",
    metricsAllowedIps: new Set(["127.0.0.1", "::1"]),
    rateLimits: {
      oauthDevice: { max: 30, timeWindowMs: 60_000 },
      oauthToken: { max: 120, timeWindowMs: 60_000 },
      auth: { max: 30, timeWindowMs: 600_000 },
      agentChanges: { max: 60, timeWindowMs: 60_000 },
      approvals: { max: 60, timeWindowMs: 60_000 },
      bindingStatus: { max: 300, timeWindowMs: 60_000 },
      bindingRenewal: { max: 60, timeWindowMs: 60_000 },
    },
  };
}

function json(response: { body: string }): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>;
}

function cookie(response: { headers: Record<string, string | string[] | undefined> }): string {
  const value = response.headers["set-cookie"];
  assert.ok(value, "expected a session cookie");
  return (Array.isArray(value) ? value[0] : value).split(";", 1)[0]!;
}

function form(values: Record<string, string>): string {
  return new URLSearchParams(values).toString();
}

function websiteHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return { origin: webOrigin, "x-agentid-request": "1", ...headers };
}

test("Resend delivery sends a transactional code without exposing the API key", async () => {
  const previousFetch = globalThis.fetch;
  let captured: { url: string; init: RequestInit } | undefined;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = { url: String(input), init: init ?? {} };
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    await new ResendMagicLinkDelivery("re_test_secret", "AgentID <no-reply@example.com>").send({ email: "owner@example.com", url: "https://app.example.com/device?request_id=opaque", code: "123456", expiresAt: "2026-07-15T03:00:00.000Z" });
    assert.ok(captured);
    assert.equal(captured.url, "https://api.resend.com/emails");
    assert.equal(new Headers(captured.init.headers).get("authorization"), "Bearer re_test_secret");
    const body = JSON.parse(String(captured.init.body)) as Record<string, unknown>;
    assert.deepEqual(body.to, ["owner@example.com"]);
    assert.match(String(body.text), /123456/);
    assert.doesNotMatch(JSON.stringify(body), /re_test_secret/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("development authentication is opt-in", async () => {
  const config = testConfig();
  const app = await buildApp({ config, store: new MemoryStore(), issuerKey: await loadIssuerKey({ allowDevelopmentGeneration: true }), magicLinkDelivery: new TestMagicLinkDelivery(), webAuthn: new TestWebAuthnAdapter() });
  const response = await app.inject({ method: "POST", url: "/v1/auth/dev-passkey/verify", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "owner", code: "123456" } });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test("cross-origin web sessions use a secure None cookie", async (t) => {
  const config = { ...testConfig(), webOrigin: "https://app.example.com", webBaseUrl: "https://app.example.com/", allowedWebOrigins: new Set(["https://app.example.com"]) };
  const delivery = new TestMagicLinkDelivery();
  const app = await buildApp({ config, store: new MemoryStore(), issuerKey: await loadIssuerKey({ allowDevelopmentGeneration: true }), magicLinkDelivery: delivery, webAuthn: new TestWebAuthnAdapter() });
  t.after(async () => app.close());

  const start = await app.inject({ method: "POST", url: "/v1/auth/email-code/start", headers: { origin: config.webOrigin, "content-type": "application/json", "x-agentid-request": "1" }, payload: { email: "cross-origin@example.com" } });
  assert.equal(start.statusCode, 202);
  const consume = await app.inject({ method: "POST", url: "/v1/auth/email-code/consume", headers: { origin: config.webOrigin, "content-type": "application/json", "x-agentid-request": "1" }, payload: { email: "cross-origin@example.com", code: delivery.sent[0]!.code } });
  assert.equal(consume.statusCode, 200);
  assert.match(String(consume.headers["set-cookie"]), /SameSite=None/);
  assert.match(String(consume.headers["set-cookie"]), /Secure/);
});

test("device authorization uses the configured Pages base path", async (t) => {
  const config = { ...testConfig(), webOrigin: "https://xiaolin9595.github.io", webBaseUrl: "https://xiaolin9595.github.io/openclaw-BAID/", allowedWebOrigins: new Set(["https://xiaolin9595.github.io"]) };
  const app = await buildApp({ config, store: new MemoryStore(), issuerKey: await loadIssuerKey({ allowDevelopmentGeneration: true }), magicLinkDelivery: new TestMagicLinkDelivery(), webAuthn: new TestWebAuthnAdapter() });
  t.after(async () => app.close());

  const response = await app.inject({ method: "POST", url: "/oauth/device_authorization", headers: { "content-type": "application/x-www-form-urlencoded" }, payload: form({ client_id: "openclaw-libp2p-mesh", instance_id: "pages-test@ed25519.test", instance_public_key: "MCowBQYDK2VwAyEA7a31", instance_label: "Pages test", platform: "darwin", code_challenge: sha256("pages-verifier"), code_challenge_method: "S256" }) });
  assert.equal(response.statusCode, 200);
  const body = json(response);
  assert.equal(new URL(body.verification_uri as string).pathname, "/openclaw-BAID/device");
  assert.equal(new URL(body.verification_uri_complete as string).pathname, "/openclaw-BAID/device");
});

test("email-bound account registration, login and password recovery", async (t) => {
  const delivery = new TestMagicLinkDelivery();
  const app = await buildApp({ config: testConfig(), store: new MemoryStore(), issuerKey: await loadIssuerKey({ allowDevelopmentGeneration: true }), magicLinkDelivery: delivery, webAuthn: new TestWebAuthnAdapter() });
  t.after(async () => app.close());

  const registration = await app.inject({ method: "POST", url: "/v1/auth/register", headers: websiteHeaders({ "content-type": "application/json" }), payload: { username: "account_owner", email: "owner@example.com", password: "correct horse battery staple", displayName: "Account Owner" } });
  assert.equal(registration.statusCode, 202);
  assert.equal(json(registration).status, "verification_required");
  assert.equal(delivery.sent.length, 1);
  const unverifiedLogin = await app.inject({ method: "POST", url: "/v1/auth/login", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "account_owner", password: "correct horse battery staple" } });
  assert.equal(unverifiedLogin.statusCode, 403);
  assert.equal((json(unverifiedLogin).error as Record<string, unknown>).code, "EMAIL_NOT_VERIFIED");
  const invalidRegistrationCode = await app.inject({ method: "POST", url: "/v1/auth/register/verify", headers: websiteHeaders({ "content-type": "application/json" }), payload: { email: "owner@example.com", code: "000000" } });
  assert.equal(invalidRegistrationCode.statusCode, 400);
  const registrationVerification = await app.inject({ method: "POST", url: "/v1/auth/register/verify", headers: websiteHeaders({ "content-type": "application/json" }), payload: { email: "owner@example.com", code: delivery.sent[0]!.code } });
  assert.equal(registrationVerification.statusCode, 200);
  const registeredUser = json(registrationVerification).user as Record<string, unknown>;
  assert.equal(registeredUser.username, "account_owner");
  assert.equal(registeredUser.email, "owner@example.com");
  assert.equal("passwordHash" in registeredUser, false);
  const sessionCookie = cookie(registrationVerification);

  const login = await app.inject({ method: "POST", url: "/v1/auth/login", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "ACCOUNT_OWNER", password: "correct horse battery staple" } });
  assert.equal(login.statusCode, 200);
  assert.ok(cookie(login));

  const wrongPassword = await app.inject({ method: "POST", url: "/v1/auth/login", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "account_owner", password: "wrong password" } });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal((json(wrongPassword).error as Record<string, unknown>).code, "INVALID_CREDENTIALS");

  const duplicate = await app.inject({ method: "POST", url: "/v1/auth/register", headers: websiteHeaders({ "content-type": "application/json" }), payload: { username: "account_owner", email: "another@example.com", password: "another password" } });
  assert.equal(duplicate.statusCode, 409);

  const recoveryStart = await app.inject({ method: "POST", url: "/v1/auth/recovery/start", headers: websiteHeaders({ "content-type": "application/json" }), payload: { email: "owner@example.com" } });
  assert.equal(recoveryStart.statusCode, 202);
  assert.equal(delivery.sent.length, 2);
  const recoveryCode = delivery.sent[1]!.code;
  const recovery = await app.inject({ method: "POST", url: "/v1/auth/recovery/complete", headers: websiteHeaders({ "content-type": "application/json" }), payload: { email: "owner@example.com", code: recoveryCode, newPassword: "new correct password" } });
  assert.equal(recovery.statusCode, 200);
  assert.ok(cookie(recovery));
  const oldPassword = await app.inject({ method: "POST", url: "/v1/auth/login", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "owner@example.com", password: "correct horse battery staple" } });
  assert.equal(oldPassword.statusCode, 401);
  const recoveredLogin = await app.inject({ method: "POST", url: "/v1/auth/login", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "owner@example.com", password: "new correct password" } });
  assert.equal(recoveredLogin.statusCode, 200);

  const currentUser = await app.inject({ method: "GET", url: "/v1/me", headers: { cookie: sessionCookie } });
  assert.equal(currentUser.statusCode, 200);
  assert.equal((json(currentUser).user as Record<string, unknown>).username, "account_owner");
});

test("legacy account can bind an email through a verified code", async (t) => {
  const store = new MemoryStore();
  await store.createUser({ id: "usr_legacy", username: "legacy_account", email: null, passwordHash: await hashPassword("legacy-password-123"), displayName: "Legacy Account", createdAt: new Date().toISOString() });
  const delivery = new TestMagicLinkDelivery();
  const app = await buildApp({ config: testConfig(), store, issuerKey: await loadIssuerKey({ allowDevelopmentGeneration: true }), magicLinkDelivery: delivery, webAuthn: new TestWebAuthnAdapter() });
  t.after(async () => app.close());

  const login = await app.inject({ method: "POST", url: "/v1/auth/login", headers: websiteHeaders({ "content-type": "application/json" }), payload: { identifier: "legacy_account", password: "legacy-password-123" } });
  assert.equal(login.statusCode, 200);
  const sessionCookie = cookie(login);
  const start = await app.inject({ method: "POST", url: "/v1/auth/email/bind/start", headers: websiteHeaders({ cookie: sessionCookie, "content-type": "application/json" }), payload: { email: "legacy-owner@example.com" } });
  assert.equal(start.statusCode, 202);
  const verifyBinding = await app.inject({ method: "POST", url: "/v1/auth/email/bind/verify", headers: websiteHeaders({ cookie: sessionCookie, "content-type": "application/json" }), payload: { email: "legacy-owner@example.com", code: delivery.sent[0]!.code } });
  assert.equal(verifyBinding.statusCode, 200);
  assert.equal((json(verifyBinding).user as Record<string, unknown>).email, "legacy-owner@example.com");
});

test("website session, login-based device grant, IBC and revocation", async (t) => {
  const store = new MemoryStore();
  const delivery = new TestMagicLinkDelivery();
  const issuerKey = await loadIssuerKey({ allowDevelopmentGeneration: true });
  const app = await buildApp({ config: testConfig(), store, issuerKey, magicLinkDelivery: delivery, webAuthn: new TestWebAuthnAdapter() });
  t.after(async () => app.close());

  const start = await app.inject({
    method: "POST",
    url: "/v1/auth/email-code/start",
    headers: websiteHeaders({ "content-type": "application/json" }),
    payload: { email: "owner@example.com", returnTo: "/approvals" },
  });
  assert.equal(start.statusCode, 202);
  assert.equal(start.headers["access-control-allow-origin"], webOrigin);
  assert.equal(start.headers["access-control-allow-credentials"], "true");
  assert.equal((json(start).status), "accepted");
  assert.equal(delivery.sent.length, 1);

  const blockedCrossSiteRequest = await app.inject({
    method: "POST",
    url: "/v1/auth/email-code/start",
    headers: { origin: "https://attacker.example", "content-type": "application/json", "x-agentid-request": "1" },
    payload: { email: "owner@example.com" },
  });
  assert.equal(blockedCrossSiteRequest.statusCode, 403);
  assert.equal((json(blockedCrossSiteRequest).error as Record<string, unknown>).code, "CSRF_ORIGIN_MISMATCH");

  const magicToken = new URL(delivery.sent[0]!.url).searchParams.get("token");
  assert.ok(magicToken);
  assert.match(delivery.sent[0]!.code, /^\d{6}$/);
  const consume = await app.inject({ method: "POST", url: "/v1/auth/email-code/consume", headers: websiteHeaders({ "content-type": "application/json" }), payload: { email: "owner@example.com", code: delivery.sent[0]!.code } });
  assert.equal(consume.statusCode, 200);
  const magicCookie = cookie(consume);
  const ownerUser = (json(consume).user as Record<string, unknown>);
  const ownerUserId = ownerUser.id as string;
  assert.equal(ownerUser.passkeyEnrolled, false);

  const replayedCode = await app.inject({ method: "POST", url: "/v1/auth/email-code/consume", headers: websiteHeaders({ "content-type": "application/json" }), payload: { email: "owner@example.com", code: delivery.sent[0]!.code } });
  assert.equal(replayedCode.statusCode, 400);
  assert.equal((json(replayedCode).error as Record<string, unknown>).code, "INVALID_EMAIL_CODE");

  const createdAgent = await app.inject({ method: "POST", url: "/v1/agents", headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json" }), payload: { name: "Travel assistant" } });
  assert.equal(createdAgent.statusCode, 201);
  const agentId = ((json(createdAgent).agent as Record<string, unknown>).id) as string;

  const initialPublicProfile = await app.inject({ method: "GET", url: `/v1/agents/${encodeURIComponent(agentId)}/public-profile`, headers: { cookie: magicCookie } });
  assert.equal(initialPublicProfile.statusCode, 200);
  assert.equal((json(initialPublicProfile).profile as Record<string, unknown>).published, false);
  const publicProfileUpdate = await app.inject({
    method: "PATCH",
    url: `/v1/agents/${encodeURIComponent(agentId)}/public-profile`,
    headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "public-profile-1" }),
    payload: {
      summary: "A public research assistant.",
      role: "Research",
      language: "TypeScript",
      published: true,
      attributes: [
        { key: "research", label: "Capability", value: "research", kind: "capability", trust: "self_declared", visible: true },
        { key: "private-context", label: "Private", value: "internal-project", kind: "context", trust: "self_declared", visible: false },
      ],
      connection: {
        allowDiscovery: true,
        allowDirectDial: true,
        peerId: "12D3KooWResearch",
        multiaddrs: ["/ip4/203.0.113.10/tcp/4001/p2p/12D3KooWResearch"],
        relayMultiaddrs: [],
      },
    },
  });
  assert.equal(publicProfileUpdate.statusCode, 200);
  const publicProfileBody = json(publicProfileUpdate).profile as Record<string, unknown>;
  assert.equal(publicProfileBody.published, true);
  assert.equal((publicProfileBody.attributes as unknown[]).length, 2);
  const publicAgent = await app.inject({ method: "GET", url: `/v1/public/agents/${encodeURIComponent(agentId)}` });
  assert.equal(publicAgent.statusCode, 200);
  const publicAgentBody = json(publicAgent);
  assert.equal("ownerId" in (publicAgentBody.agent as Record<string, unknown>), false);
  assert.equal((publicAgentBody.profile as Record<string, unknown>).summary, "A public research assistant.");
  assert.deepEqual((publicAgentBody.profile as Record<string, unknown>).attributes, [{ key: "research", label: "Capability", value: "research", kind: "capability", trust: "self_declared", visible: true }]);
  const publicDirectory = await app.inject({ method: "GET", url: "/v1/public/agents?tag=missing" });
  assert.equal(publicDirectory.statusCode, 200);
  assert.deepEqual((json(publicDirectory).agents as unknown[]), []);

  const ticketResponse = await app.inject({ method: "GET", url: `/v1/public/agents/${encodeURIComponent(agentId)}/connection-ticket` });
  assert.equal(ticketResponse.statusCode, 200);
  const ticketBody = json(ticketResponse);
  assert.equal(ticketBody.agentId, agentId);
  assert.equal(ticketBody.peerId, "12D3KooWResearch");
  assert.equal(typeof ticketBody.ticket, "string");
  assert.equal((ticketBody.ticket as string).split(".").length, 3);

  const renamed = await app.inject({ method: "PATCH", url: `/v1/agents/${encodeURIComponent(agentId)}`, headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "agent-rename-1" }), payload: { name: "Travel Agent" } });
  assert.equal(renamed.statusCode, 200);
  assert.equal((json(renamed).agent as Record<string, unknown>).name, "Travel Agent");
  const addedMember = await app.inject({ method: "POST", url: `/v1/agents/${encodeURIComponent(agentId)}/members`, headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "member-add-1" }), payload: { email: "viewer@example.com", role: "viewer" } });
  assert.equal(addedMember.statusCode, 201);
  const memberId = ((json(addedMember).member as Record<string, unknown>).userId) as string;
  const listedMembers = await app.inject({ method: "GET", url: `/v1/agents/${encodeURIComponent(agentId)}/members`, headers: { cookie: magicCookie } });
  assert.equal(listedMembers.statusCode, 200);
  assert.equal((json(listedMembers).members as unknown[]).length, 2);
  const changedMember = await app.inject({ method: "PATCH", url: `/v1/agents/${encodeURIComponent(agentId)}/members/${encodeURIComponent(memberId)}`, headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "member-role-1" }), payload: { role: "admin" } });
  assert.equal(changedMember.statusCode, 200);
  const removedMember = await app.inject({ method: "DELETE", url: `/v1/agents/${encodeURIComponent(agentId)}/members/${encodeURIComponent(memberId)}`, headers: websiteHeaders({ cookie: magicCookie, "idempotency-key": "member-remove-1" }) });
  assert.equal(removedMember.statusCode, 200);

  const verifier = "FqehU2dJAGxRyNusF-6Hf8Azm69rYH02c-ffMAr0Uig";
  const device = await app.inject({
    method: "POST",
    url: "/oauth/device_authorization",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: form({
      client_id: "openclaw-libp2p-mesh",
      instance_id: "macbook@ed25519.test",
      instance_public_key: "MCowBQYDK2VwAyEA7a31",
      instance_label: "Owner MacBook",
      platform: "darwin",
      code_challenge: sha256(verifier),
      code_challenge_method: "S256",
    }),
  });
  assert.equal(device.statusCode, 200);
  const deviceBody = json(device);
  assert.equal(typeof deviceBody.request_id, "string");
  const verificationLink = new URL(deviceBody.verification_uri_complete as string);
  assert.equal(verificationLink.origin, webOrigin);
  assert.deepEqual([...verificationLink.searchParams.keys()], ["request_id"]);
  assert.ok(deviceBody.device_code);

  const pending = await app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: form({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: "openclaw-libp2p-mesh", device_code: deviceBody.device_code as string, code_verifier: verifier }),
  });
  assert.equal(pending.statusCode, 400);
  assert.equal(json(pending).error, "authorization_pending");

  const approval = await app.inject({ method: "GET", url: `/v1/approvals/${deviceBody.request_id ?? verificationLink.searchParams.get("request_id")}`, headers: { cookie: magicCookie } });
  assert.equal(approval.statusCode, 200);
  assert.equal((json(approval).approval as Record<string, unknown>).userCode, undefined);

  const approved = await app.inject({
    method: "POST",
    url: `/v1/approvals/${verificationLink.searchParams.get("request_id")}/approve`,
    headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "approve-after-login" }),
    payload: { agentId },
  });
  assert.equal(approved.statusCode, 200);
  const approvedBody = json(approved);
  const binding = approvedBody.binding as Record<string, unknown>;
  assert.equal((approvedBody.approval as Record<string, unknown>).status, "approved");

  const approvalReplay = await app.inject({
    method: "POST",
    url: `/v1/approvals/${verificationLink.searchParams.get("request_id")}/approve`,
    headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "approve-after-login" }),
    payload: { agentId },
  });
  assert.deepEqual(json(approvalReplay), approvedBody);

  const approvalConflict = await app.inject({
    method: "POST",
    url: `/v1/approvals/${verificationLink.searchParams.get("request_id")}/approve`,
    headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "approve-after-login" }),
    payload: { agentId, reason: "Different request body" },
  });
  assert.equal(approvalConflict.statusCode, 409);
  assert.equal((json(approvalConflict).error as Record<string, unknown>).code, "IDEMPOTENCY_KEY_REUSED");

  const exchanged = await app.inject({
    method: "POST",
    url: "/oauth/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: form({ grant_type: "urn:ietf:params:oauth:grant-type:device_code", client_id: "openclaw-libp2p-mesh", device_code: deviceBody.device_code as string, code_verifier: verifier }),
  });
  assert.equal(exchanged.statusCode, 200);
  const token = json(exchanged);
  assert.equal(token.instance_binding, token.ibc);
  assert.equal("user_id" in token, false);
  const [header, claims, signature] = (token.instance_binding as string).split(".");
  assert.ok(header && claims && signature);
  const decodedClaims = JSON.parse(Buffer.from(claims, "base64url").toString("utf8")) as Record<string, unknown>;
  assert.equal(decodedClaims.user_id_hash, hmacSha256(ownerUserId, testConfig().userIdHashSecret));
  const jwks = await app.inject({ method: "GET", url: "/.well-known/jwks.json" });
  const jwk = (json(jwks).keys as Array<Record<string, unknown>>).find((entry) => entry.kid === JSON.parse(Buffer.from(header, "base64url").toString("utf8")).kid);
  assert.ok(jwk);
  assert.equal(verify(null, Buffer.from(`${header}.${claims}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(signature, "base64url")), true);

  const bindingStatus = await app.inject({ method: "GET", url: `/v1/instance-bindings/${encodeURIComponent(String(binding.jti))}/status` });
  assert.equal(bindingStatus.statusCode, 200);
  const bindingStatusBody = json(bindingStatus);
  assert.equal("user_id" in bindingStatusBody, false);
  assert.equal(bindingStatusBody.user_id_hash, hmacSha256(ownerUserId, testConfig().userIdHashSecret));

  const createVerifier = "a3a7U2dJAGxRyNusF-6Hf8Azm69rYH02c-ffMAr0Uig";
  const createDevice = await app.inject({
    method: "POST",
    url: "/oauth/device_authorization",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    payload: form({
      client_id: "openclaw-libp2p-mesh",
      agent_action: "create",
      instance_id: "new-agent@ed25519.test",
      instance_public_key: "MCowBQYDK2VwAyEAnew-agent",
      instance_label: "New Agent Instance",
      platform: "darwin",
      agent_profile: JSON.stringify({
        summary: "A research assistant running on OpenClaw.",
        role: "Research assistant",
        language: "OpenClaw / libp2p-mesh",
        attributes: [{ key: "skill", label: "Skill", value: "research", kind: "capability" }],
      }),
      code_challenge: sha256(createVerifier),
      code_challenge_method: "S256",
    }),
  });
  assert.equal(createDevice.statusCode, 200);
  const createDeviceBody = json(createDevice);
  const createApproval = await app.inject({ method: "GET", url: `/v1/approvals/${createDeviceBody.request_id}`, headers: { cookie: magicCookie } });
  assert.equal(createApproval.statusCode, 200);
  assert.equal((json(createApproval).approval as Record<string, unknown>).agentCreationRequested, true);
  assert.equal((json(createApproval).approval as Record<string, unknown>).agentId, null);
  const createdApproval = await app.inject({
    method: "POST",
    url: `/v1/approvals/${createDeviceBody.request_id}/approve`,
    headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "approve-new-agent-1" }),
    payload: {},
  });
  assert.equal(createdApproval.statusCode, 200);
  const createdBinding = json(createdApproval).binding as Record<string, unknown>;
  assert.match(String(createdBinding.agentId), /^did:agentid:agt_/);
  assert.notEqual(createdBinding.agentId, agentId);
  const createdProfileResponse = await app.inject({ method: "GET", url: `/v1/agents/${encodeURIComponent(String(createdBinding.agentId))}/public-profile`, headers: { cookie: magicCookie } });
  assert.equal(createdProfileResponse.statusCode, 200);
  const createdProfile = json(createdProfileResponse).profile as Record<string, unknown>;
  assert.equal(createdProfile.published, false);
  assert.equal(createdProfile.role, "Research assistant");
  assert.equal(createdProfile.summary, "A research assistant running on OpenClaw.");
  assert.deepEqual((createdProfile.attributes as Array<Record<string, unknown>>).map((attribute) => attribute.value), ["p2p:announce", "p2p:message", "research"]);
  assert.ok((createdProfile.attributes as Array<Record<string, unknown>>).filter((attribute) => attribute.value.startsWith("p2p:")).every((attribute) => attribute.trust === "verified"));
  assert.equal((createdProfile.attributes as Array<Record<string, unknown>>).find((attribute) => attribute.value === "research")?.trust, "self_declared");
  const agentsAfterCreate = await app.inject({ method: "GET", url: "/v1/me/agents", headers: { cookie: magicCookie } });
  assert.equal((json(agentsAfterCreate).agents as unknown[]).length, 2);

  const renewalChallenge = await app.inject({
    method: "POST",
    url: `/v1/instance-bindings/${encodeURIComponent(String(binding.jti))}/renew/challenge`,
    headers: { "content-type": "application/json" },
    payload: {},
  });
  assert.equal(renewalChallenge.statusCode, 200);
  assert.equal(typeof (json(renewalChallenge).challenge_id), "string");

  const revoked = await app.inject({
    method: "POST",
    url: `/v1/approvals/${verificationLink.searchParams.get("request_id")}/revoke`,
    headers: websiteHeaders({ cookie: magicCookie, "content-type": "application/json", "idempotency-key": "revoke-after-login" }),
    payload: { reason: "Device retired" },
  });
  assert.equal(revoked.statusCode, 200);
  assert.equal(((json(revoked).binding as Record<string, unknown>).status), "revoked");
  assert.equal((binding.status), "active");

  const activity = await app.inject({ method: "GET", url: "/v1/activity", headers: { cookie: magicCookie } });
  assert.equal(activity.statusCode, 200);
  const latestEvent = (json(activity).activity as Array<Record<string, unknown>>)[0];
  assert.ok(latestEvent);
  assert.equal(typeof latestEvent.eventHash, "string");
  assert.equal(typeof latestEvent.previousHash, "string");
  assert.notEqual(latestEvent.eventHash, latestEvent.previousHash);
});

test("health, metrics and configurable rate limits expose safe operational signals", async (t) => {
  const store = new MemoryStore();
  const delivery = new TestMagicLinkDelivery();
  const issuerKey = await loadIssuerKey({ allowDevelopmentGeneration: true });
  const config = testConfig();
  config.rateLimits.auth = { max: 1, timeWindowMs: 60_000 };
  const app = await buildApp({ config, store, issuerKey, magicLinkDelivery: delivery, webAuthn: new TestWebAuthnAdapter() });
  t.after(async () => app.close());

  const live = await app.inject({ method: "GET", url: "/health/live" });
  assert.equal(live.statusCode, 200);
  assert.equal(json(live).status, "ok");

  const ready = await app.inject({ method: "GET", url: "/health/ready" });
  assert.equal(ready.statusCode, 200);
  assert.equal(json(ready).status, "ready");
  assert.deepEqual(json(ready).checks, { database: true, migrations: true, issuer: true });

  const firstLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/email-code/start",
    headers: websiteHeaders({ "content-type": "application/json" }),
    payload: { email: "metrics@example.com" },
  });
  assert.equal(firstLogin.statusCode, 202);
  const limitedLogin = await app.inject({
    method: "POST",
    url: "/v1/auth/email-code/start",
    headers: websiteHeaders({ "content-type": "application/json" }),
    payload: { email: "metrics@example.com" },
  });
  assert.equal(limitedLogin.statusCode, 429);
  assert.ok(limitedLogin.headers["retry-after"]);
  assert.equal((json(limitedLogin).error as Record<string, unknown>).code, "RATE_LIMITED");

  const metrics = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.headers["content-type"] ?? "", /text\/plain/);
  assert.match(metrics.body, /agentid_http_requests_total/);
  assert.match(metrics.body, /agentid_rate_limited_total/);
  assert.match(metrics.body, /agentid_pending_authorizations/);
  assert.doesNotMatch(metrics.body, /metrics@example\.com|device_code|privateKey|issuer-ed25519/);

  const blockedMetrics = await app.inject({ method: "GET", url: "/metrics", headers: { "x-forwarded-for": "203.0.113.10" } });
  assert.equal(blockedMetrics.statusCode, 404);
});
