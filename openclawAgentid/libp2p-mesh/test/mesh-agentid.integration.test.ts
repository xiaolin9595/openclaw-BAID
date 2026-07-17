import assert from "node:assert/strict";
import { createServer } from "node:http";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { createMeshNetwork } from "../src/mesh.js";
import { loadOrCreateInstanceIdentity } from "../src/instance-id.js";
import { saveAgentIdBinding } from "../src/agentid.js";
import type { InstanceIdentity, P2PMessage } from "../src/types.js";

function publicIdentity(value: Awaited<ReturnType<typeof loadOrCreateInstanceIdentity>>): InstanceIdentity {
  return value.identity;
}

test("two real libp2p nodes exchange and verify AgentID-bearing messages", async (t) => {
  const originalStateDir = process.env.OPENCLAW_STATE_DIR;
  const stateA = await mkdtemp(path.join(tmpdir(), "openclaw-agentid-node-a-"));
  const stateB = await mkdtemp(path.join(tmpdir(), "openclaw-agentid-node-b-"));
  const issuerPair = generateKeyPairSync("ed25519");
  const issuerJwk = issuerPair.publicKey.export({ format: "jwk" }) as Record<string, unknown>;
  const kid = "integration-issuer-key";
  const agentId = "did:agentid:agt_integration";
  const issuedJtis = new Set<string>();
  let server: ReturnType<typeof createServer> | undefined;
  let meshA: ReturnType<typeof createMeshNetwork> | undefined;
  let meshB: ReturnType<typeof createMeshNetwork> | undefined;

  t.after(async () => {
    await meshB?.stop().catch(() => undefined);
    await meshA?.stop().catch(() => undefined);
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await rm(stateA, { recursive: true, force: true });
    await rm(stateB, { recursive: true, force: true });
  });

  server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/.well-known/jwks.json") {
      response.end(JSON.stringify({ keys: [{ ...issuerJwk, kid, use: "sig", alg: "EdDSA" }] }));
      return;
    }
    const match = request.url?.match(/^\/v1\/instance-bindings\/([^/]+)\/status$/);
    if (match) {
      response.end(JSON.stringify({ binding: { status: issuedJtis.has(decodeURIComponent(match[1]!)) ? "active" : "revoked" } }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const issuer = `http://127.0.0.1:${address.port}`;

  process.env.OPENCLAW_STATE_DIR = stateA;
  const identityA = publicIdentity(await loadOrCreateInstanceIdentity({ name: "node-a" }));
  process.env.OPENCLAW_STATE_DIR = stateB;
  const identityB = publicIdentity(await loadOrCreateInstanceIdentity({ name: "node-b" }));

  const createIbc = (identity: InstanceIdentity, jti: string): string => {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600;
    const header = Buffer.from(JSON.stringify({ alg: "EdDSA", kid, typ: "agentid+ibc+jwt" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ iss: issuer, sub: agentId, aud: "openclaw-libp2p-mesh", jti, instance_id: identity.id, instance_public_key: identity.pubkey, scope: ["p2p:announce", "p2p:message"], iat, exp })).toString("base64url");
    const input = `${header}.${payload}`;
    issuedJtis.add(jti);
    return `${input}.${sign(null, Buffer.from(input), issuerPair.privateKey).toString("base64url")}`;
  };

  const bindingPathA = path.join(stateA, "libp2p", "agentid-binding.json");
  const bindingPathB = path.join(stateB, "libp2p", "agentid-binding.json");
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  await saveAgentIdBinding({ version: 1, issuer, agentId, instanceId: identityA.id, instancePublicKey: identityA.pubkey, jti: "node-a-binding", expiresAt, linkedAt: Date.now(), instanceBinding: createIbc(identityA, "node-a-binding"), status: "active" }, bindingPathA);
  await saveAgentIdBinding({ version: 1, issuer, agentId, instanceId: identityB.id, instancePublicKey: identityB.pubkey, jti: "node-b-binding", expiresAt, linkedAt: Date.now(), instanceBinding: createIbc(identityB, "node-b-binding"), status: "active" }, bindingPathB);
  assert.equal((await stat(bindingPathA)).mode & 0o777, 0o600);
  assert.equal((await stat(bindingPathB)).mode & 0o777, 0o600);

  const meshConfig = {
    enableMDNS: false,
    enableDHT: false,
    enableNATTraversal: false,
    listenAddrs: ["/ip4/127.0.0.1/tcp/0"],
    agentId: { issuer, trustedIssuers: [issuer], mode: "strict" as const, statusRefreshIntervalSeconds: 60 },
  };
  process.env.OPENCLAW_STATE_DIR = stateA;
  meshA = createMeshNetwork({ config: meshConfig });
  await meshA.start();
  process.env.OPENCLAW_STATE_DIR = stateB;
  meshB = createMeshNetwork({ config: meshConfig });
  await meshB.start();

  const received = new Promise<P2PMessage>((resolve) => {
    meshA!.onMessage(resolve);
  });
  const addressToDial = meshA.getMultiaddrs().find((value) => value.includes("/ip4/127.0.0.1/tcp/"));
  assert.ok(addressToDial);
  await meshB.dial(addressToDial);
  await meshB.sendToPeer(meshA.getLocalPeerId(), "strict AgentID integration message");
  const message = await Promise.race([
    received,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out waiting for verified message")), 5000)),
  ]);
  assert.equal(message.payload, "strict AgentID integration message");
  assert.equal(message.agentId, agentId);
  assert.equal(message.instanceId, identityB.id);
  assert.equal(typeof message.instanceBinding, "string");
});
