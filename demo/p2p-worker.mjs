import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MESH_DIR = path.join(ROOT, "openclawAgentid", "libp2p-mesh");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index].replace(/^--/, ""), process.argv[index + 1]);

const nodeId = args.get("node") ?? "a";
const stateRoot = args.get("state") ?? path.join(ROOT, ".demo", `node-${nodeId}`);
const issuer = args.get("issuer");
const port = Number(args.get("port") ?? 8801);
const events = [];
process.env.OPENCLAW_STATE_DIR = stateRoot;

const { createMeshNetwork } = await import(pathToFileURL(path.join(MESH_DIR, "dist", "src", "mesh.js")).href);
const mesh = createMeshNetwork({
  config: {
    enableMDNS: false,
    enableDHT: false,
    enableNATTraversal: false,
    listenAddrs: ["/ip4/127.0.0.1/tcp/0"],
    peerIdPath: path.join(stateRoot, "libp2p", "demo-peer-id.json"),
    instanceName: `agentid-demo-${nodeId}`,
    agentId: {
      issuer,
      trustedIssuers: [issuer],
      mode: "strict",
      revocationCacheMaxAgeSeconds: 3,
      statusRefreshIntervalSeconds: 60,
    },
  },
  logger: {
    info: (message) => process.stdout.write(`[${nodeId}] ${message}\n`),
    warn: (message) => process.stderr.write(`[${nodeId}] ${message}\n`),
    error: (message) => process.stderr.write(`[${nodeId}] ${message}\n`),
  },
});

mesh.onMessage((message) => {
  const event = {
    nodeId: nodeId.toUpperCase(),
    direction: "inbound",
    fromPeerId: message.from,
    fromInstanceId: message.instanceId ?? null,
    agentId: message.agentId ?? null,
    ibcVerified: Boolean(message.instanceBinding && message.agentId && message.instanceId),
    payload: message.payload,
    at: new Date().toISOString(),
  };
  events.push(event);
  if (events.length > 50) events.splice(0, events.length - 50);
});

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

async function body(request) {
  let value = "";
  for await (const chunk of request) value += chunk;
  return value ? JSON.parse(value) : {};
}

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/status" && request.method === "GET") {
      const identity = mesh.getInstanceIdentity();
      return json(response, 200, {
        nodeId: nodeId.toUpperCase(),
        peerId: mesh.getLocalPeerId(),
        instanceId: identity?.id ?? null,
        instancePublicKeyFingerprint: identity?.pubkey?.slice(0, 16) ?? null,
        multiaddrs: mesh.getMultiaddrs(),
        connectedPeers: mesh.getConnectedPeers(),
        events: events.slice(-20),
      });
    }
    if (request.url === "/dial" && request.method === "POST") {
      const value = await body(request);
      await mesh.dial(String(value.address));
      return json(response, 200, { status: "connected", peers: mesh.getConnectedPeers() });
    }
    if (request.url === "/send" && request.method === "POST") {
      const value = await body(request);
      await mesh.sendToPeer(String(value.peerId), String(value.message));
      return json(response, 200, { status: "sent" });
    }
    if (request.url === "/stop" && request.method === "POST") {
      json(response, 202, { status: "stopping" });
      await mesh.stop();
      await new Promise((resolve) => server.close(resolve));
      process.exit(0);
    }
    return json(response, 404, { error: "not_found" });
  } catch (error) {
    return json(response, 500, { error: String(error) });
  }
});

await mesh.start();
await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
process.stdout.write(`P2P_WORKER_READY ${nodeId}\n`);

async function shutdown() {
  await mesh.stop().catch(() => undefined);
  await new Promise((resolve) => server.close(() => resolve()));
  process.exit(0);
}
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
