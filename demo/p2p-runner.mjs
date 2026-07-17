import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index].replace(/^--/, ""), process.argv[index + 1]);
const mode = args.get("mode") ?? "initial";
const issuer = args.get("issuer");
const stateA = args.get("state-a");
const stateB = args.get("state-b");
const ports = { a: 8801, b: 8802 };
const workers = new Map();

function startWorker(nodeId, state) {
  const child = spawn(process.execPath, [
    path.join(ROOT, "demo", "p2p-worker.mjs"),
    "--node", nodeId,
    "--state", state,
    "--issuer", issuer,
    "--port", String(ports[nodeId]),
  ], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk) => process.stdout.write(`[worker-${nodeId}] ${chunk}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[worker-${nodeId}] ${chunk}`));
  workers.set(nodeId, child);
  return child;
}

async function get(nodeId, endpoint) {
  const response = await fetch(`http://127.0.0.1:${ports[nodeId]}${endpoint}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${nodeId} ${endpoint}: ${JSON.stringify(payload)}`);
  return payload;
}

async function post(nodeId, endpoint, value) {
  const response = await fetch(`http://127.0.0.1:${ports[nodeId]}${endpoint}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${nodeId} ${endpoint}: ${JSON.stringify(payload)}`);
  return payload;
}

async function waitForStatus(nodeId, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await get(nodeId, "/status");
      if (status.peerId && status.multiaddrs.length > 0) return status;
    } catch {
      // The worker is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`等待 P2P 节点 ${nodeId} 启动超时`);
}

async function stopWorkers() {
  await Promise.all([...workers.keys()].map(async (nodeId) => {
    await post(nodeId, "/stop", {}).catch(() => undefined);
  }));
  await Promise.all([...workers.values()].map((child) => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", resolve);
  })));
}

try {
  startWorker("a", stateA);
  startWorker("b", stateB);
  const [a, b] = await Promise.all([waitForStatus("a"), waitForStatus("b")]);
  const aAddress = a.multiaddrs.find((value) => value.includes("/ip4/127.0.0.1/tcp/"));
  if (!aAddress) throw new Error("节点 A 没有可拨号地址");
  await post("b", "/dial", { address: aAddress });

  const sent = [];
  await post("a", "/send", { peerId: b.peerId, message: mode === "after-revoke" ? "A after revoke" : "A to B: verified AgentID" }).then(() => sent.push("a-to-b")).catch((error) => sent.push(`a-to-b-error:${String(error)}`));
  await post("b", "/send", { peerId: a.peerId, message: mode === "after-revoke" ? "B after A revoke" : "B to A: verified AgentID" }).then(() => sent.push("b-to-a")).catch((error) => sent.push(`b-to-a-error:${String(error)}`));
  await new Promise((resolve) => setTimeout(resolve, 700));
  const [aAfter, bAfter] = await Promise.all([get("a", "/status"), get("b", "/status")]);
  const events = [...aAfter.events, ...bAfter.events].map((event) => ({ ...event, mode }));
  const result = {
    mode,
    nodes: {
      a: { peerId: a.peerId, instanceId: a.instanceId },
      b: { peerId: b.peerId, instanceId: b.instanceId },
    },
    sent,
    events,
    verifiedCount: events.filter((event) => event.ibcVerified).length,
    acceptedByNode: {
      a: aAfter.events.length,
      b: bAfter.events.length,
    },
  };
  process.stdout.write(`P2P_RESULT ${JSON.stringify(result)}\n`);
} catch (error) {
  process.stdout.write(`P2P_RESULT ${JSON.stringify({ mode, error: String(error), events: [] })}\n`);
  process.exitCode = 1;
} finally {
  await stopWorkers();
}
