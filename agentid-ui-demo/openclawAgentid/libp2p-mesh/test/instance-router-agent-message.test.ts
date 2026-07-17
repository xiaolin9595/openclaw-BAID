import assert from "node:assert/strict";
import test from "node:test";
import { createInstanceRouter } from "../src/instance-router.js";
import type {
  InboundDeliveryAdapter,
  InstanceIdentity,
  InstancePeerRecord,
  InstancePeerStore,
  MeshNetwork,
  P2PMessage,
} from "../src/types.js";

const identity: InstanceIdentity = {
  id: "local-instance@local",
  name: "local",
  pubkey: "local-public-key",
  binding: "local-binding",
  bindingComponents: { username: "test", hostname: "test", platform: "test" },
  createdAt: Date.now(),
};

function route(instanceId: string, agentId: string, peerId: string): InstancePeerRecord {
  return {
    instanceId,
    peerId,
    instanceName: instanceId,
    multiaddrs: [],
    lastSeenAt: Date.now(),
    lastAnnouncedAt: Date.now(),
    source: "announce",
    agentId,
    agentIssuer: "http://issuer.test",
    agentBindingJti: `${instanceId}-jti`,
    agentBindingExpiresAt: Date.now() + 60_000,
    agentLastVerifiedAt: Date.now(),
  };
}

test("sendAgentMessage fans out only to discovered instances bound to the target AgentID", async () => {
  const routes = [
    route("target-a", "did:agentid:agt_target", "peer-a"),
    route("target-b", "did:agentid:agt_target", "peer-b"),
    route("other-agent", "did:agentid:agt_other", "peer-other"),
  ];
  let router: ReturnType<typeof createInstanceRouter>;
  const sentTo: string[] = [];
  const mesh = {
    async start() {},
    async stop() {},
    async sendToPeer() {},
    async sendStructuredMessage(peerId: string, message: Omit<P2PMessage, "from" | "timestamp" | "instanceId" | "pubkey" | "signature" | "agentId" | "instanceBinding"> & { timestamp?: number }) {
      sentTo.push(peerId);
      await router.handleMessage({
        id: `ack-${message.id}`,
        type: "delivery-ack",
        from: peerId,
        payload: JSON.stringify({ ackFor: message.id, ok: true, deliveredAt: Date.now() }),
        timestamp: Date.now(),
      });
    },
    onMessage() { return () => {}; },
    onPeerConnect() { return () => {}; },
    onPeerDisconnect() { return () => {}; },
    async publishToTopic() {},
    async subscribeToTopic() {},
    getLocalPeerId() { return "local-peer"; },
    getConnectedPeers() { return []; },
    getMultiaddrs() { return []; },
    async dial() {},
    getInstanceIdentity() { return identity; },
    getNATStatus() { return { enabled: false, services: [], hasRelayedListenAddr: false }; },
  } as unknown as MeshNetwork;
  const store = {
    async load() { return { version: 1 as const, updatedAt: Date.now(), instances: {} }; },
    async list() { return routes; },
    async resolve(instanceId: string) { return routes.find((item) => item.instanceId === instanceId); },
    async upsertFromAnnounce() { throw new Error("not used"); },
  } as unknown as InstancePeerStore;
  const delivery: InboundDeliveryAdapter = {
    async deliver(request) {
      return { ok: true, channel: request.channel, target: request.target };
    },
  };
  router = createInstanceRouter({ mesh, store, delivery });

  const result = await router.sendAgentMessage("did:agentid:agt_target", "hello target");

  assert.deepEqual(sentTo, ["peer-a", "peer-b"]);
  assert.equal(result.agentId, "did:agentid:agt_target");
  assert.equal(result.matched, 2);
  assert.equal(result.sent, 2);
  assert.equal(result.delivered, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.results?.map((item) => item.instanceId), ["target-a", "target-b"]);
});
