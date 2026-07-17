import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AgentIdBindingStatusCache,
  AgentIdJwksCache,
  getAgentIdStatusRefreshIntervalSeconds,
  linkAgentId,
  loadAgentIdBinding,
  refreshAgentIdBinding,
  saveAgentIdBinding,
  unlinkAgentIdBinding,
  verifyAgentIdIbc,
  verifyAgentIdDiscoveryTicket,
  type AgentIdBindingFile,
  type AgentIdFetch,
} from "../src/agentid.js";
import { registerLibp2pMeshAgentIdCommand, type AgentIdRootCommand } from "../src/agentid-cli.js";
import { createAgentIdMaintenance } from "../src/agentid-maintenance.js";
import { generateInstanceIdentity, verifyInstanceSignature } from "../src/instance-id.js";
import {
  serializeLegacyP2PMessageForSignature,
  serializeP2PMessageForSignature,
  verifyP2PMessageAgentId,
} from "../src/message-auth.js";
import type { InstanceIdentity, P2PMessage } from "../src/types.js";

const issuer = "https://issuer.example";
const identity: InstanceIdentity = {
  id: "lin-mac@MCowBQYDK2Vw.binding",
  name: "lin-mac",
  pubkey: "MCowBQYDK2VwAyEAfixture",
  binding: "binding",
  bindingComponents: { username: "lin", hostname: "mac", platform: "darwin" },
  createdAt: 1,
};

function jsonResponse(status: number, body: unknown): Pick<Response, "ok" | "status" | "json"> {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createIbcFixture(overrides: Partial<Record<string, unknown>> = {}, fixtureIdentity: InstanceIdentity = identity, signer?: { privateKey: KeyObject; publicKey: KeyObject }) {
  const keyPair = signer ?? generateKeyPairSync("ed25519");
  const { privateKey, publicKey } = keyPair;
  const publicJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  const kid = "issuer-key-1";
  const claims = {
    iss: issuer,
    sub: "did:agentid:agt_travel",
    aud: "openclaw-libp2p-mesh",
    jti: "binding-1",
    instance_id: fixtureIdentity.id,
    instance_public_key: fixtureIdentity.pubkey,
    scope: ["p2p:announce", "p2p:message"],
    iat: 1_000,
    exp: 9_000,
    ...overrides,
  };
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", kid, typ: "agentid+ibc+jwt" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const ibc = `${signingInput}.${sign(null, Buffer.from(signingInput), privateKey).toString("base64url")}`;
  return {
    ibc,
    claims,
    jwks: { keys: [{ ...publicJwk, kid, use: "sig", alg: "EdDSA" }] },
    signer: keyPair,
  };
}

function jwksFetch(jwks: unknown, calls: string[] = []): AgentIdFetch {
  return async (input) => {
    calls.push(String(input));
    return jsonResponse(200, jwks);
  };
}

test("AgentID status refresh interval defaults to 15 minutes and stays within configured bounds", () => {
  assert.equal(getAgentIdStatusRefreshIntervalSeconds(), 900);
  assert.equal(getAgentIdStatusRefreshIntervalSeconds({ statusRefreshIntervalSeconds: 1 }), 60);
  assert.equal(getAgentIdStatusRefreshIntervalSeconds({ statusRefreshIntervalSeconds: 100_000 }), 86_400);
});

test("verifyAgentIdIbc verifies Ed25519 IBC claims through an allowlisted JWKS and caches the key set", async () => {
  const fixture = createIbcFixture();
  const calls: string[] = [];
  const cache = new AgentIdJwksCache();
  const options = {
    config: { issuer, trustedIssuers: [issuer], cache: { jwksTtlMs: 60_000 } },
    expected: {
      agentId: "did:agentid:agt_travel",
      instanceId: identity.id,
      instancePublicKey: identity.pubkey,
      requiredScope: "p2p:message" as const,
    },
    fetch: jwksFetch(fixture.jwks, calls),
    cache,
    now: () => 2_000_000,
  };

  const first = await verifyAgentIdIbc(fixture.ibc, options);
  const second = await verifyAgentIdIbc(fixture.ibc, options);

  assert.deepEqual(first, { valid: true, claims: fixture.claims });
  assert.deepEqual(second, { valid: true, claims: fixture.claims });
  assert.equal(calls.length, 1);
  assert.equal(calls[0], `${issuer}/.well-known/jwks.json`);
});

test("verifyAgentIdIbc rejects untrusted issuers and mismatched bound claims before accepting remote data", async () => {
  const fixture = createIbcFixture();
  let fetched = false;
  const fetch: AgentIdFetch = async () => {
    fetched = true;
    return jsonResponse(200, fixture.jwks);
  };

  const untrusted = await verifyAgentIdIbc(fixture.ibc, {
    config: { trustedIssuers: ["https://other.example"] },
    fetch,
    now: () => 2_000_000,
  });
  assert.equal(untrusted.valid, false);
  assert.match(untrusted.reason, /allowlist/);
  assert.equal(fetched, false);

  const mismatch = await verifyAgentIdIbc(fixture.ibc, {
    config: { trustedIssuers: [issuer] },
    expected: { instancePublicKey: "wrong-key" },
    fetch,
    now: () => 2_000_000,
  });
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.reason, /public key does not match/);
  assert.equal(fetched, false);
});

test("verifyAgentIdDiscoveryTicket validates issuer, target PeerID and short-lived connection claims", async () => {
  const fixture = createIbcFixture({
    iat: 1_000,
    exp: 9_000,
  });
  const ticketClaims = {
    iss: issuer,
    sub: "did:agentid:agt_travel",
    aud: "openclaw-libp2p-mesh",
    jti: "ticket-1",
    peer_id: "12D3KooW-target",
    multiaddrs: ["/ip4/203.0.113.10/tcp/4001/p2p/12D3KooW-target"],
    relay_multiaddrs: [],
    allowed_scopes: ["p2p:announce", "p2p:message"],
    iat: 1_000,
    exp: 9_000,
  };
  const header = Buffer.from(JSON.stringify({ alg: "EdDSA", kid: "issuer-key-1", typ: "agentid+discovery+jwt" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(ticketClaims)).toString("base64url");
  const input = `${header}.${payload}`;
  const ticket = `${input}.${sign(null, Buffer.from(input), fixture.signer.privateKey).toString("base64url")}`;
  const cache = new AgentIdJwksCache();
  const verified = await verifyAgentIdDiscoveryTicket(ticket, {
    config: { issuer, trustedIssuers: [issuer] },
    expected: { agentId: ticketClaims.sub, peerId: ticketClaims.peer_id },
    fetch: jwksFetch(fixture.jwks),
    cache,
    now: () => 2_000_000,
  });
  assert.deepEqual(verified, { valid: true, claims: ticketClaims });
  const mismatch = await verifyAgentIdDiscoveryTicket(ticket, {
    config: { issuer, trustedIssuers: [issuer] },
    expected: { peerId: "12D3KooW-other" },
    fetch: jwksFetch(fixture.jwks),
    cache,
    now: () => 2_000_000,
  });
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.reason, /PeerID/);
});

test("linkAgentId omits agent_hint when no agent is selected and performs S256 PKCE polling", async () => {
  const fixture = createIbcFixture({ iat: 1_000, exp: 10_000 });
  const deviceBodies: Array<Record<string, unknown>> = [];
  const sleeps: number[] = [];
  let now = 2_000_000;
  let tokenPoll = 0;
  const fetch: AgentIdFetch = async (input, init) => {
    const url = new URL(String(input));
    const body = Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) as Record<string, unknown>;
    if (url.pathname === "/oauth/device_authorization") {
      deviceBodies.push(body);
      return jsonResponse(201, {
        request_id: "request-1",
        device_code: "device-code",
        verification_uri: `${issuer}/device`,
        verification_uri_complete: `${issuer}/device?request_id=request-1`,
        expires_in: 60,
        interval: 5,
      });
    }
    if (url.pathname === "/oauth/token") {
      tokenPoll += 1;
      if (tokenPoll === 1) return jsonResponse(400, { error: "authorization_pending", error_description: "waiting" });
      if (tokenPoll === 2) return jsonResponse(400, { error: "slow_down", error_description: "slow down", interval: 7 });
      return jsonResponse(200, { instance_binding: fixture.ibc });
    }
    if (url.pathname === "/.well-known/jwks.json") return jsonResponse(200, fixture.jwks);
    assert.fail(`unexpected request ${url}`);
  };

  const result = await linkAgentId({
    issuer,
    identity,
    fetch,
    now: () => now,
    sleep: async (milliseconds) => {
      sleeps.push(milliseconds);
      now += milliseconds;
    },
  });

  assert.equal(deviceBodies.length, 1);
  assert.equal(deviceBodies[0].agent_hint, undefined);
  assert.equal(deviceBodies[0].code_challenge_method, "S256");
  assert.match(String(deviceBodies[0].code_challenge), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(deviceBodies[0].scope, "p2p:announce p2p:message");
  assert.deepEqual(sleeps, [5000, 5000, 7000]);
  assert.equal(result.binding.agentId, "did:agentid:agt_travel");
  assert.equal(result.binding.instanceId, identity.id);
});

test("linkAgentId requests explicit AgentID creation and rejects conflicting selection", async () => {
  const fixture = createIbcFixture({ iat: 1_000, exp: 10_000 });
  const deviceBodies: Array<Record<string, unknown>> = [];
  let now = 2_000_000;
  const fetch: AgentIdFetch = async (input, init) => {
    const url = new URL(String(input));
    const body = Object.fromEntries(new URLSearchParams(String(init?.body ?? ""))) as Record<string, unknown>;
    if (url.pathname === "/oauth/device_authorization") {
      deviceBodies.push(body);
      return jsonResponse(200, {
        request_id: "request-create-1",
        device_code: "device-create-1",
        verification_uri: `${issuer}/device`,
        verification_uri_complete: `${issuer}/device?request_id=request-create-1`,
        expires_in: 60,
        interval: 5,
      });
    }
    if (url.pathname === "/oauth/token") return jsonResponse(200, { instance_binding: fixture.ibc });
    if (url.pathname === "/.well-known/jwks.json") return jsonResponse(200, fixture.jwks);
    assert.fail(`unexpected request ${url}`);
  };

  const result = await linkAgentId({ issuer, identity, createAgent: true, fetch, cache: new AgentIdJwksCache(), now: () => now, sleep: async (milliseconds) => { now += milliseconds; } });
  assert.equal(deviceBodies[0]?.agent_action, "create");
  assert.equal(deviceBodies[0]?.agent_hint, undefined);
  assert.equal(result.binding.agentId, "did:agentid:agt_travel");
  await assert.rejects(() => linkAgentId({ issuer, identity, agentId: "did:agentid:agt_existing", createAgent: true, fetch }), /cannot be used together/);
});

test("AgentID binding is atomically stored with restricted file permissions and can be removed", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "libp2p-mesh-agentid-"));
  const bindingPath = path.join(directory, "agentid-binding.json");
  const binding: AgentIdBindingFile = {
    version: 1,
    issuer,
    agentId: "did:agentid:agt_travel",
    instanceId: identity.id,
    instancePublicKey: identity.pubkey,
    jti: "binding-1",
    expiresAt: 9_000,
    linkedAt: 2_000_000,
    instanceBinding: "a.b.c",
  };
  try {
    await saveAgentIdBinding(binding, bindingPath);
    assert.deepEqual(await loadAgentIdBinding(bindingPath), binding);
    assert.equal((await stat(bindingPath)).mode & 0o777, 0o600);
    assert.deepEqual((await readdir(directory)).filter((name) => name.endsWith(".tmp")), []);
    assert.equal(await unlinkAgentIdBinding(bindingPath), true);
    assert.equal(await unlinkAgentIdBinding(bindingPath), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("P2P signatures cover AgentID credentials and strict mode rejects a missing or invalid IBC", async () => {
  const generated = generateInstanceIdentity({ name: "signed" });
  const message: P2PMessage = {
    id: "message-1",
    type: "direct",
    from: "peer-a",
    to: "peer-b",
    payload: "hello",
    timestamp: 2_000_000,
    instanceId: generated.id,
    pubkey: generated.pubkey,
    agentId: "did:agentid:agt_travel",
    instanceBinding: "binding-token",
  };
  message.signature = sign(
    null,
    Buffer.from(serializeP2PMessageForSignature(message)),
    { key: Buffer.from(generated.privkey, "base64url"), format: "der", type: "pkcs8" },
  ).toString("base64url");
  const generatedIdentity: InstanceIdentity = {
    id: generated.id,
    name: generated.name,
    pubkey: generated.pubkey,
    binding: generated.binding,
    bindingComponents: generated.bindingComponents,
    createdAt: generated.createdAt,
  };
  assert.equal(verifyInstanceSignature(generatedIdentity, serializeP2PMessageForSignature(message), message.signature), true);
  assert.equal(verifyInstanceSignature(generatedIdentity, serializeP2PMessageForSignature({ ...message, agentId: "did:agentid:tampered" }), message.signature), false);

  const legacyMessage: P2PMessage = {
    ...message,
    agentId: undefined,
    instanceBinding: undefined,
  };
  legacyMessage.signature = sign(
    null,
    Buffer.from(serializeLegacyP2PMessageForSignature(legacyMessage)),
    { key: Buffer.from(generated.privkey, "base64url"), format: "der", type: "pkcs8" },
  ).toString("base64url");
  assert.equal(
    verifyInstanceSignature(generatedIdentity, serializeLegacyP2PMessageForSignature(legacyMessage), legacyMessage.signature),
    true,
  );

  const fixture = createIbcFixture();
  const strictLegacy = await verifyP2PMessageAgentId(
    { ...message, agentId: undefined, instanceBinding: undefined },
    { mode: "strict", trustedIssuers: [issuer] },
  );
  assert.deepEqual(strictLegacy, { valid: false, reason: "AgentID strict mode rejects messages without an instanceBinding" });

  const compatLegacy = await verifyP2PMessageAgentId(
    { ...message, agentId: undefined, instanceBinding: undefined },
    { mode: "compat" },
  );
  assert.deepEqual(compatLegacy, { valid: true });

  const invalidIbc = await verifyP2PMessageAgentId(
    {
      ...message,
      instanceId: identity.id,
      pubkey: identity.pubkey,
      agentId: "did:agentid:tampered",
      instanceBinding: fixture.ibc,
    },
    { mode: "compat", trustedIssuers: [issuer] },
    { fetch: jwksFetch(fixture.jwks), cache: new AgentIdJwksCache(), now: () => 2_000_000 },
  );
  assert.equal(invalidIbc.valid, false);
  assert.match(invalidIbc.reason, /IBC agent id does not match/);
});

test("P2P AgentID verification checks and caches the issuer binding status", async () => {
  const fixture = createIbcFixture();
  const calls: string[] = [];
  let bindingStatus: "active" | "revoked" = "active";
  const fetch: AgentIdFetch = async (input) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/.well-known/jwks.json") return jsonResponse(200, fixture.jwks);
    if (url.pathname === "/v1/instance-bindings/binding-1/status") {
      return jsonResponse(200, { binding: { status: bindingStatus } });
    }
    assert.fail(`unexpected request ${url}`);
  };
  const message: P2PMessage = {
    id: "message-2",
    type: "direct",
    from: "peer-a",
    payload: "hello",
    timestamp: 2_000_000,
    instanceId: identity.id,
    pubkey: identity.pubkey,
    agentId: "did:agentid:agt_travel",
    instanceBinding: fixture.ibc,
    signature: "outer-signature-is-validated-by-mesh",
  };
  const options = {
    fetch,
    cache: new AgentIdJwksCache(),
    bindingStatusCache: new AgentIdBindingStatusCache(),
    now: () => 2_000_000,
  };
  const config = { trustedIssuers: [issuer], revocationCacheMaxAgeSeconds: 60 };

  assert.deepEqual(await verifyP2PMessageAgentId(message, config, options), { valid: true });
  assert.deepEqual(calls, ["/.well-known/jwks.json", "/v1/instance-bindings/binding-1/status"]);

  bindingStatus = "revoked";
  assert.deepEqual(await verifyP2PMessageAgentId(message, config, options), { valid: true });
  assert.equal(calls.filter((path) => path.includes("instance-bindings")).length, 1);

  const revoked = await verifyP2PMessageAgentId(message, config, {
    fetch,
    cache: new AgentIdJwksCache(),
    bindingStatusCache: new AgentIdBindingStatusCache(),
    now: () => 2_000_000,
  });
  assert.equal(revoked.valid, false);
  assert.match(revoked.reason, /IBC binding is revoked/);
});

test("two signed instances verify the same AgentID, isolate revocation, and reject tampering", async () => {
  const generatedA = generateInstanceIdentity({ name: "node-a" });
  const generatedB = generateInstanceIdentity({ name: "node-b" });
  const nodeA: InstanceIdentity = { id: generatedA.id, name: generatedA.name, pubkey: generatedA.pubkey, binding: generatedA.binding, bindingComponents: generatedA.bindingComponents, createdAt: generatedA.createdAt };
  const nodeB: InstanceIdentity = { id: generatedB.id, name: generatedB.name, pubkey: generatedB.pubkey, binding: generatedB.binding, bindingComponents: generatedB.bindingComponents, createdAt: generatedB.createdAt };
  const fixtureA = createIbcFixture({ jti: "binding-a" }, nodeA);
  const fixtureB = createIbcFixture({ jti: "binding-b" }, nodeB, fixtureA.signer);
  const expired = createIbcFixture({ jti: "binding-expired", exp: 100 }, nodeA, fixtureA.signer);
  const limitedScope = createIbcFixture({ jti: "binding-scope", scope: ["p2p:announce"] }, nodeA, fixtureA.signer);
  const statuses = new Map<string, "active" | "revoked" | "expired">([
    ["binding-a", "active"],
    ["binding-b", "active"],
    ["binding-expired", "active"],
    ["binding-scope", "active"],
  ]);
  const fetch: AgentIdFetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/.well-known/jwks.json") return jsonResponse(200, fixtureA.jwks);
    const jti = url.pathname.split("/").at(-2);
    return jsonResponse(200, { binding: { status: statuses.get(jti ?? "") ?? "revoked" } });
  };
  const signMessage = (node: InstanceIdentity, privateKey: string, message: P2PMessage): P2PMessage => ({
    ...message,
    signature: sign(null, Buffer.from(serializeP2PMessageForSignature(message)), { key: Buffer.from(privateKey, "base64url"), format: "der", type: "pkcs8" }).toString("base64url"),
  });
  const messageA = signMessage(nodeA, generatedA.privkey, { id: "node-a-message", type: "direct", from: "peer-a", payload: "hello from A", timestamp: 2_000_000, instanceId: nodeA.id, pubkey: nodeA.pubkey, agentId: fixtureA.claims.sub, instanceBinding: fixtureA.ibc });
  const messageB = signMessage(nodeB, generatedB.privkey, { id: "node-b-message", type: "direct", from: "peer-b", payload: "hello from B", timestamp: 2_000_000, instanceId: nodeB.id, pubkey: nodeB.pubkey, agentId: fixtureB.claims.sub, instanceBinding: fixtureB.ibc });
  const options = { fetch, cache: new AgentIdJwksCache(), bindingStatusCache: new AgentIdBindingStatusCache(), now: () => 2_000_000 };
  const strictConfig = { mode: "strict" as const, trustedIssuers: [issuer] };

  assert.equal(verifyInstanceSignature(nodeA, serializeP2PMessageForSignature(messageA), messageA.signature!), true);
  assert.equal(verifyInstanceSignature(nodeB, serializeP2PMessageForSignature(messageB), messageB.signature!), true);
  assert.deepEqual(await verifyP2PMessageAgentId(messageA, strictConfig, options), { valid: true });
  assert.deepEqual(await verifyP2PMessageAgentId(messageB, strictConfig, options), { valid: true });

  for (const tampered of [
    { ...messageA, agentId: "did:agentid:agt_other" },
    { ...messageA, instanceId: nodeB.id },
    { ...messageA, pubkey: nodeB.pubkey },
    { ...messageA, instanceBinding: `${fixtureA.ibc}.tampered` },
  ]) {
    const result = await verifyP2PMessageAgentId(tampered, strictConfig, { ...options, cache: new AgentIdJwksCache(), bindingStatusCache: new AgentIdBindingStatusCache() });
    assert.equal(result.valid, false);
  }

  const scopeResult = await verifyP2PMessageAgentId(signMessage(nodeA, generatedA.privkey, { ...messageA, id: "scope-message", instanceBinding: limitedScope.ibc }), strictConfig, { ...options, cache: new AgentIdJwksCache(), bindingStatusCache: new AgentIdBindingStatusCache() });
  assert.equal(scopeResult.valid, false);
  assert.match(scopeResult.reason, /scope/);
  const expiredResult = await verifyP2PMessageAgentId(signMessage(nodeA, generatedA.privkey, { ...messageA, id: "expired-message", instanceBinding: expired.ibc }), strictConfig, { ...options, cache: new AgentIdJwksCache(), bindingStatusCache: new AgentIdBindingStatusCache() });
  assert.equal(expiredResult.valid, false);
  assert.match(expiredResult.reason, /expired/);

  statuses.set("binding-a", "revoked");
  const revokedA = await verifyP2PMessageAgentId(messageA, strictConfig, { ...options, cache: new AgentIdJwksCache(), bindingStatusCache: new AgentIdBindingStatusCache() });
  assert.equal(revokedA.valid, false);
  assert.match(revokedA.reason, /revoked/);
  assert.deepEqual(await verifyP2PMessageAgentId(messageB, strictConfig, { ...options, cache: new AgentIdJwksCache(), bindingStatusCache: new AgentIdBindingStatusCache() }), { valid: true });
  assert.deepEqual(await verifyP2PMessageAgentId({ ...messageA, agentId: undefined, instanceBinding: undefined }, { mode: "compat" }), { valid: true });
  assert.equal((await verifyP2PMessageAgentId({ ...messageA, agentId: undefined, instanceBinding: undefined }, strictConfig)).valid, false);
});

test("local AgentID refresh can bypass the long remote revocation cache", async () => {
  const fixture = createIbcFixture();
  const calls: string[] = [];
  let status: "active" | "revoked" = "active";
  const fetch: AgentIdFetch = async (input) => {
    calls.push(String(input));
    if (String(input).includes("/.well-known/jwks.json")) return jsonResponse(200, fixture.jwks);
    return jsonResponse(200, { binding: { status } });
  };
  const cache = new AgentIdBindingStatusCache();
  const binding: AgentIdBindingFile = {
    version: 1,
    issuer,
    agentId: "did:agentid:agt_travel",
    instanceId: identity.id,
    instancePublicKey: identity.pubkey,
    jti: fixture.claims.jti,
    expiresAt: fixture.claims.exp,
    linkedAt: 1_000,
    instanceBinding: fixture.ibc,
  };

  await refreshAgentIdBinding(binding, {
    config: { trustedIssuers: [issuer] },
    fetch,
    cache,
    now: () => 2_000,
  });
  status = "revoked";
  const refreshed = await refreshAgentIdBinding(binding, {
    config: { trustedIssuers: [issuer] },
    fetch,
    cache,
    force: true,
    now: () => 2_001,
  });

  assert.equal(refreshed.status, "revoked");
  assert.equal(calls.filter((value) => value.includes("instance-bindings")).length, 2);
});

test("AgentID maintenance refreshes once, renews near expiry, and stops cleanly", async () => {
  const fixture = createIbcFixture({ iat: 1_000, exp: 2_500 });
  const renewedFixture = createIbcFixture({ jti: "binding-renewed", iat: 2_000, exp: 20_000 });
  const binding: AgentIdBindingFile = {
    version: 1,
    issuer,
    agentId: "did:agentid:agt_travel",
    instanceId: identity.id,
    instancePublicKey: identity.pubkey,
    jti: fixture.claims.jti,
    expiresAt: fixture.claims.exp,
    linkedAt: 1_000,
    instanceBinding: fixture.ibc,
  };
  let current = binding;
  let refreshCalls = 0;
  let renewCalls = 0;
  let timerHandler: (() => void | Promise<void>) | undefined;
  let cleared = 0;
  const saved: AgentIdBindingFile[] = [];
  const maintenance = createAgentIdMaintenance({
    identity,
    signMessage: () => "signature",
    config: { issuer, trustedIssuers: [issuer], statusRefreshIntervalSeconds: 1 },
    now: () => 2_000_000,
    loadBinding: async () => current,
    saveBinding: async (next) => {
      current = next;
      saved.push(next);
      return "/tmp/agentid-binding.json";
    },
    refreshBinding: async (next) => {
      refreshCalls += 1;
      return { ...next, status: "active", lastStatusCheckAt: 2_000_000 };
    },
    renewBinding: async (next) => {
      renewCalls += 1;
      return {
        ...next.binding,
        jti: "binding-renewed",
        expiresAt: 20_000,
        instanceBinding: renewedFixture.ibc,
        status: "active",
      };
    },
    setInterval: (handler) => {
      timerHandler = handler;
      return {} as ReturnType<typeof setInterval>;
    },
    clearInterval: () => {
      cleared += 1;
    },
  });

  await maintenance.refreshNow();
  maintenance.start();
  maintenance.start();
  assert.equal(refreshCalls, 1);
  assert.equal(renewCalls, 1);
  assert.equal(maintenance.getBinding()?.jti, "binding-renewed");
  assert.equal(typeof timerHandler, "function");
  const timerResult = timerHandler?.();
  assert.equal(timerResult instanceof Promise, true);
  await timerResult;
  assert.equal(refreshCalls, 2);
  await maintenance.stop();
  assert.equal(cleared, 1);
  assert.equal(saved.length, 2);
});

test("AgentID maintenance retains a valid binding on network failure and disables it after expiry", async () => {
  const fixture = createIbcFixture({ iat: 1_000, exp: 9_000 });
  const binding: AgentIdBindingFile = {
    version: 1,
    issuer,
    agentId: "did:agentid:agt_travel",
    instanceId: identity.id,
    instancePublicKey: identity.pubkey,
    jti: fixture.claims.jti,
    expiresAt: fixture.claims.exp,
    linkedAt: 1_000,
    instanceBinding: fixture.ibc,
  };
  let now = 2_000_000;
  let current = binding;
  let published: AgentIdBindingFile | undefined;
  const maintenance = createAgentIdMaintenance({
    identity,
    signMessage: () => "signature",
    config: { issuer, trustedIssuers: [issuer] },
    now: () => now,
    loadBinding: async () => current,
    saveBinding: async (next) => {
      current = next;
      return "/tmp/agentid-binding.json";
    },
    refreshBinding: async () => {
      throw new Error("issuer unavailable");
    },
    onBindingChange: (next) => {
      published = next;
    },
  });

  await maintenance.refreshNow();
  assert.equal(published?.jti, binding.jti);
  now = 10_000_000;
  await maintenance.refreshNow();
  assert.equal(published, undefined);
});

test("agentid link accepts an optional --agent and uses the configured issuer outside development", async () => {
  class Command {
    readonly children = new Map<string, Command>();
    readonly options: string[] = [];
    actionHandler?: (options: { agent?: string; issuer?: string }) => Promise<void>;

    command(name: string): Command {
      const child = new Command();
      this.children.set(name, child);
      return child;
    }

    description(): Command {
      return this;
    }

    option(flags: string): Command {
      this.options.push(flags);
      return this;
    }

    action(handler: (options: { agent?: string; issuer?: string }) => Promise<void>): void {
      this.actionHandler = handler;
    }
  }

  const root = new Command();
  const linked: Array<{ agentId?: string; issuer: string }> = [];
  const savedConfigs: unknown[] = [];
  const output: string[] = [];
  const binding: AgentIdBindingFile = {
    version: 1,
    issuer,
    agentId: "did:agentid:agt_travel",
    instanceId: identity.id,
    instancePublicKey: identity.pubkey,
    jti: "binding-1",
    expiresAt: 9_000,
    linkedAt: 2_000_000,
    instanceBinding: "a.b.c",
  };
  const config = {
    plugins: {
      entries: {
        "libp2p-mesh": {
          config: { agentId: { issuer, trustedIssuers: [issuer] } },
        },
      },
    },
  };

  registerLibp2pMeshAgentIdCommand(
    root as unknown as AgentIdRootCommand,
    { pluginConfig: {}, runtime: {} } as never,
    { config } as never,
    {
      async loadIdentity() {
        return { identity };
      },
      async link(options) {
        linked.push({ agentId: options.agentId, issuer: options.issuer });
        return {
          binding,
          authorization: {
            requestId: "request-1",
            deviceCode: "device-code",
            verificationUri: `${issuer}/device`,
            verificationUriComplete: `${issuer}/device?request_id=request-1`,
            expiresIn: 60,
            interval: 5,
          },
        };
      },
      createWriter() {
        return { async save(next) { savedConfigs.push(next); } };
      },
      async saveBinding() {
        return "/tmp/agentid-binding.json";
      },
      print(message) {
        output.push(message);
      },
    },
  );

  const link = root.children.get("agentid")?.children.get("link");
  assert.ok(link?.options.includes("--agent <agentId>"));
  assert.ok(link?.actionHandler);
  await link.actionHandler!({});

  assert.deepEqual(linked, [{ agentId: undefined, issuer }]);
  assert.deepEqual(savedConfigs, [{ issuer, trustedIssuers: [issuer] }]);
  assert.match(output.join("\n"), /AgentID linked/);
  await assert.rejects(link.actionHandler!({ issuer: "https://production.example" }), /limited to loopback development issuers/);
});
