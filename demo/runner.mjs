import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SERVICE_DIR = path.join(ROOT, "agentid-service");
const UI_DIR = path.join(ROOT, "agentid-ui-demo");
const MESH_DIR = path.join(ROOT, "openclawAgentid", "libp2p-mesh");
const DEMO_DIR = path.join(ROOT, ".demo");
const STATE_FILE = path.join(DEMO_DIR, "runner.json");
const SERVICE_PORT = 8787;
const UI_PORT = 4173;
const CONTROL_PORT = 8798;
const DATABASE_URL = process.env.DEMO_DATABASE_URL ?? "postgres://agentid:agentid@127.0.0.1:5432/agentid_demo";
const ISSUER_URL = `http://127.0.0.1:${SERVICE_PORT}`;
const WEB_ORIGIN = `http://127.0.0.1:${UI_PORT}`;
const ALLOWED_WEB_ORIGINS = WEB_ORIGIN;
const CONTROL_ORIGIN = `http://127.0.0.1:${CONTROL_PORT}`;
const OPENCLAW_BIN = path.join(MESH_DIR, "node_modules", ".bin", "openclaw");
const profileNames = { a: "agentid-demo-a", b: "agentid-demo-b" };
const children = new Map();
const events = [];
const mailbox = new Map();
let p2pState = { status: "idle", result: null };
let p2pProcess;
let controlServer;

function profileState(profile) {
  return path.join(homedir(), `.openclaw-${profileNames[profile]}`);
}

function logEvent(type, fields = {}) {
  events.push({ id: `${Date.now()}-${events.length}`, type, at: new Date().toISOString(), ...fields });
  if (events.length > 300) events.splice(0, events.length - 300);
}

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  // The bridge is loopback-only and exposes demo summaries without cookies,
  // private keys, device codes, or complete IBCs. Allow both local UI hosts.
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-headers", "content-type, x-agentid-demo");
  response.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  let value = "";
  for await (const chunk of request) value += chunk;
  return value ? JSON.parse(value) : {};
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return undefined;
  }
}

async function clientStatus(nodeId) {
  const stateDir = profileState(nodeId);
  const identity = await readJson(path.join(stateDir, "libp2p", "instance-id.json"));
  const binding = await readJson(path.join(stateDir, "libp2p", "agentid-binding.json"));
  const remote = binding?.jti ? await fetchJson(`${ISSUER_URL}/v1/instance-bindings/${encodeURIComponent(binding.jti)}/status`) : undefined;
  const remoteStatus = remote?.ok && typeof remote.body?.binding?.status === "string" ? remote.body.binding.status : undefined;
  const processInfo = children.get(`gateway-${nodeId}`);
  const linkInfo = children.get(`link-${nodeId}`);
  return {
    nodeId: nodeId.toUpperCase(),
    profile: profileNames[nodeId],
    gatewayRunning: Boolean(processInfo && processInfo.exitCode === undefined),
    linkRunning: Boolean(linkInfo && linkInfo.exitCode === undefined),
    instanceId: identity?.id ?? null,
    instanceName: identity?.name ?? null,
    instancePublicKeyFingerprint: identity?.pubkey ? fingerprint(identity.pubkey) : null,
    agentId: binding?.agentId ?? null,
    userIdHash: binding?.userIdHash ?? null,
    jti: binding?.jti ?? null,
    scopes: binding ? readScopes(binding.instanceBinding) : [],
    status: remoteStatus ?? binding?.status ?? (binding ? "unknown" : "not_linked"),
    expiresAt: binding?.expiresAt ? new Date(binding.expiresAt * 1000).toISOString() : null,
    lastStatusCheckAt: binding?.lastStatusCheckAt ? new Date(binding.lastStatusCheckAt).toISOString() : null,
    error: processInfo?.error ?? linkInfo?.error ?? null,
  };
}

async function status() {
  return {
    service: { url: ISSUER_URL, health: await fetchJson(`${ISSUER_URL}/health/ready`) },
    web: { url: `${WEB_ORIGIN}/control-plane.html` },
    control: { url: CONTROL_ORIGIN },
    clients: { a: await clientStatus("a"), b: await clientStatus("b") },
    p2p: p2pState,
    mailbox: [...mailbox.values()].map(({ email, code, expiresAt }) => ({ email, code, expiresAt })),
    events: events.slice(-80),
  };
}

async function fetchJson(url) {
  try {
    const response = await fetch(url);
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) };
  } catch (error) {
    return { ok: false, status: 0, error: String(error) };
  }
}

function fingerprint(value) {
  return createHash("sha256").update(value).digest("base64url").slice(0, 16);
}

function readScopes(ibc) {
  try {
    const payload = JSON.parse(Buffer.from(ibc.split(".")[1] ?? "", "base64url").toString("utf8"));
    return Array.isArray(payload.scope) ? payload.scope.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function spawnLogged(key, command, args, options = {}) {
  const child = spawn(command, args, { cwd: options.cwd ?? ROOT, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] });
  const info = { child, exitCode: undefined, error: null };
  children.set(key, info);
  const consume = (chunk, stream) => {
    const text = String(chunk);
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      process.stdout.write(`[${key}/${stream}] ${line}\n`);
      if (line.includes("verification_uri_complete") || line.startsWith("Open http")) logEvent("authorization_url", { nodeId: key.replace("link-", ""), line });
      if (line.includes("AgentID linked:")) logEvent("binding_saved", { nodeId: key.replace("link-", "") });
    }
  };
  child.stdout.on("data", (chunk) => consume(chunk, "stdout"));
  child.stderr.on("data", (chunk) => consume(chunk, "stderr"));
  child.once("error", (error) => { info.error = String(error); logEvent("process_error", { key, error: String(error) }); });
  child.once("exit", (code) => { info.exitCode = code ?? 1; logEvent("process_exit", { key, code: info.exitCode }); });
  return info;
}

function gatewayArgs(nodeId) {
  return ["--profile", profileNames[nodeId], "gateway", "run", "--allow-unconfigured", "--auth", "none", "--bind", "loopback", "--port", nodeId === "a" ? "19011" : "19012"];
}

async function restartGateway(nodeId) {
  const current = children.get(`gateway-${nodeId}`);
  if (current?.child.exitCode === null) {
    await new Promise((resolve) => {
      current.child.once("exit", resolve);
      current.child.kill("SIGTERM");
      setTimeout(resolve, 4_000);
    });
  }
  spawnLogged(`gateway-${nodeId}`, OPENCLAW_BIN, gatewayArgs(nodeId), { cwd: MESH_DIR });
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  logEvent("gateway_restarted_after_binding", { nodeId: nodeId.toUpperCase() });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? ROOT, env: { ...process.env, ...options.env }, encoding: "utf8", stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${(result.stderr ?? result.stdout ?? "").trim()}`);
  return result.stdout ?? "";
}

function databaseName() {
  return new URL(DATABASE_URL).pathname.slice(1);
}

function ensureDatabase() {
  const ready = spawnSync("pg_isready", ["-d", DATABASE_URL], { encoding: "utf8" });
  if (ready.status !== 0) {
    if (spawnSync("docker", ["compose", "-f", path.join(SERVICE_DIR, "docker-compose.yml"), "up", "-d", "postgres"], { cwd: SERVICE_DIR, stdio: "inherit" }).status !== 0) {
      throw new Error("PostgreSQL 不可用。请启动本地 PostgreSQL，或安装 Docker 后重试。");
    }
  }
  const adminUrl = new URL(DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const exists = run("psql", [adminUrl.toString(), "-tAc", `SELECT 1 FROM pg_database WHERE datname = '${databaseName().replaceAll("'", "''")}'`]).trim();
  if (exists !== "1") {
    const host = adminUrl.hostname || "127.0.0.1";
    const port = adminUrl.port || "5432";
    try {
      run("createdb", ["-h", host, "-p", port, databaseName()]);
    } catch {
      throw new Error(`数据库 ${databaseName()} 不存在，且当前 PostgreSQL 用户没有创建数据库权限。请先手动创建该数据库。`);
    }
  }
  run("psql", [databaseName(), "-v", "ON_ERROR_STOP=1", "-c", "GRANT USAGE, CREATE ON SCHEMA public TO agentid; ALTER SCHEMA public OWNER TO agentid;"]);
}

async function waitFor(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await fetchJson(url);
    if (result.ok) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`等待 ${url} 超时`);
}

async function startControlServer() {
  controlServer = createServer(async (request, response) => {
    if (request.method === "OPTIONS") return json(response, 204, {});
    if (request.url === "/demo/mailbox" && request.method === "POST") {
      const body = await requestBody(request);
      mailbox.set(String(body.email), { email: String(body.email), code: String(body.code), url: String(body.url), expiresAt: String(body.expiresAt) });
      logEvent("login_code_received", { email: String(body.email) });
      return json(response, 202, { status: "accepted" });
    }
    if (request.url?.startsWith("/demo/mailbox?") && request.method === "GET") {
      const email = new URL(request.url, CONTROL_ORIGIN).searchParams.get("email") ?? "";
      return json(response, 200, mailbox.get(email) ?? { email, code: null });
    }
    if (request.url === "/demo/status" && request.method === "GET") return json(response, 200, await status());
    if (request.url?.startsWith("/demo/events") && request.method === "GET") return json(response, 200, { events: events.slice(-80) });
    if (request.url === "/demo/reset" && request.method === "POST") {
      await resetDemo();
      json(response, 200, { status: "reset" });
      setTimeout(() => process.exit(0), 100);
      return;
    }
    if (request.url === "/demo/p2p/start" && request.method === "POST") {
      const body = await requestBody(request);
      const mode = body.mode === "after-revoke" ? "after-revoke" : "initial";
      if (p2pState.status === "running") return json(response, 409, { error: "p2p_already_running" });
      p2pState = { status: "running", mode, result: null };
      logEvent("p2p_requested", { mode });
      void runP2PExperiment(mode);
      return json(response, 202, { status: "queued", mode });
    }
    return json(response, 404, { error: "not_found" });
  });
  await new Promise((resolve) => controlServer.listen(CONTROL_PORT, "127.0.0.1", resolve));
}

async function configureProfile(profile) {
  const common = ["--profile", profileNames[profile], "config", "set"];
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.issuer", JSON.stringify(ISSUER_URL), "--strict-json"], { cwd: MESH_DIR });
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.trustedIssuers", JSON.stringify([ISSUER_URL]), "--strict-json"], { cwd: MESH_DIR });
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.mode", JSON.stringify("strict"), "--strict-json"], { cwd: MESH_DIR });
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.revocationCacheMaxAgeSeconds", "3", "--strict-json"], { cwd: MESH_DIR });
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.localBridge.enabled", "true", "--strict-json"], { cwd: MESH_DIR });
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.localBridge.port", String(profile === "a" ? 8799 : 8800), "--strict-json"], { cwd: MESH_DIR });
  run(OPENCLAW_BIN, [...common, "plugins.entries.libp2p-mesh.config.agentId.localBridge.allowedOrigins", JSON.stringify(["http://127.0.0.1:4173", "http://localhost:4173"]), "--strict-json"], { cwd: MESH_DIR });
}

async function startDemo() {
  if (existsSync(STATE_FILE)) {
    const existing = await readJson(STATE_FILE);
    if (existing?.runnerPid && processExists(existing.runnerPid)) {
      throw new Error(`AgentID Demo 已在运行（PID ${existing.runnerPid}）。先执行 npm run demo:stop。`);
    }
  }
  await mkdir(DEMO_DIR, { recursive: true });
  await startControlServer();
  ensureDatabase();
  run("npm", ["run", "migrate"], { cwd: SERVICE_DIR, env: { NODE_ENV: "development", DATABASE_URL, ISSUER_URL, WEB_ORIGIN, ALLOWED_WEB_ORIGINS, RP_ID: "127.0.0.1", ISSUER_PRIVATE_KEY_PATH: path.join(SERVICE_DIR, "data", "issuer-ed25519.pem") } });
  spawnLogged("service", "npm", ["start"], { cwd: SERVICE_DIR, env: { NODE_ENV: "development", HOST: "127.0.0.1", PORT: String(SERVICE_PORT), DATABASE_URL, ISSUER_URL, WEB_ORIGIN, ALLOWED_WEB_ORIGINS, RP_ID: "127.0.0.1", ISSUER_PRIVATE_KEY_PATH: path.join(SERVICE_DIR, "data", "issuer-ed25519.pem"), USER_ID_HASH_SECRET: process.env.USER_ID_HASH_SECRET ?? "agentid-demo-user-id-hash-secret", MAGIC_LINK_WEBHOOK_URL: `${CONTROL_ORIGIN}/demo/mailbox`, METRICS_ALLOWED_IPS: "127.0.0.1" } });
  await waitFor(`${ISSUER_URL}/health/ready`);
  spawnLogged("web", "npm", ["run", "dev", "--", "--config", "vite.control-plane.config.ts", "--host", "127.0.0.1", "--port", String(UI_PORT)], { cwd: UI_DIR, env: { VITE_AGENTID_API_URL: ISSUER_URL, VITE_DEMO_CONTROL_URL: CONTROL_ORIGIN } });
  await waitFor(`${WEB_ORIGIN}/control-plane.html`);
  run("npm", ["run", "build"], { cwd: MESH_DIR });
  for (const nodeId of ["a", "b"]) {
    const profile = profileNames[nodeId];
    run(OPENCLAW_BIN, ["--profile", profile, "plugins", "install", "--link", "--dangerously-force-unsafe-install", MESH_DIR], { cwd: MESH_DIR });
    await configureProfile(nodeId);
    spawnLogged(`gateway-${nodeId}`, OPENCLAW_BIN, gatewayArgs(nodeId), { cwd: MESH_DIR });
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const link = spawnLogged(`link-${nodeId}`, OPENCLAW_BIN, ["--profile", profile, "libp2p-mesh", "agentid", "link", "--issuer", ISSUER_URL], { cwd: MESH_DIR });
    link.child.once("exit", (code) => {
      if (code === 0) void restartGateway(nodeId);
    });
    logEvent("client_started", { nodeId: nodeId.toUpperCase() });
  }
  await writeFile(STATE_FILE, JSON.stringify({ runnerPid: process.pid, control: CONTROL_ORIGIN, web: WEB_ORIGIN, startedAt: new Date().toISOString() }, null, 2));
  console.log(`\nAgentID Demo: ${WEB_ORIGIN}/control-plane.html`);
  console.log(`Control Bridge: ${CONTROL_ORIGIN}/demo/status`);
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function runP2PExperiment(mode) {
  const args = [
    path.join(ROOT, "demo", "p2p-runner.mjs"),
    "--mode", mode,
    "--issuer", ISSUER_URL,
    "--state-a", profileState("a"),
    "--state-b", profileState("b"),
  ];
  p2pProcess = spawn(process.execPath, args, { cwd: ROOT, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const consume = (chunk, stream) => {
    const text = String(chunk);
    output += text;
    process.stdout.write(`[p2p/${stream}] ${text}`);
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      if (!line.startsWith("P2P_RESULT ")) continue;
      try {
        p2pState = { status: "completed", mode, result: JSON.parse(line.slice("P2P_RESULT ".length)) };
        for (const event of p2pState.result.events ?? []) logEvent("p2p_verified", event);
      } catch (error) {
        logEvent("p2p_result_error", { error: String(error) });
      }
    }
  };
  p2pProcess.stdout.on("data", (chunk) => consume(chunk, "stdout"));
  p2pProcess.stderr.on("data", (chunk) => consume(chunk, "stderr"));
  await new Promise((resolve) => p2pProcess.once("exit", resolve));
  if (p2pState.status === "running") {
    p2pState = { status: "failed", mode, result: { error: `P2P runner exited without a result. Output: ${output.slice(-1000)}` } };
    logEvent("p2p_failed", { mode });
  }
  p2pProcess = undefined;
}

async function stopChildren() {
  if (p2pProcess?.exitCode === null) p2pProcess.kill("SIGTERM");
  p2pProcess = undefined;
  for (const [key, info] of children) {
    if (info.child.exitCode === null) {
      info.child.kill("SIGTERM");
      logEvent("process_stop", { key });
    }
  }
  if (controlServer) await new Promise((resolve) => controlServer.close(resolve));
  controlServer = undefined;
}

async function resetDemo() {
  await stopChildren();
  try {
    run("psql", [DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-c", "TRUNCATE audit_events, idempotency_keys, binding_renewal_challenges, instance_bindings, device_authorizations, agent_members, agents, webauthn_credentials, webauthn_challenges, magic_link_tokens, sessions, users CASCADE;"]);
  } catch (error) {
    console.warn(`Demo 数据库重置失败：${String(error)}`);
  }
  for (const profile of Object.values(profileNames)) await rm(path.join(homedir(), `.openclaw-${profile}`), { recursive: true, force: true });
  await rm(DEMO_DIR, { recursive: true, force: true });
  console.log("AgentID Demo 已重置。运行 npm run demo:start 重新启动。");
}

async function main() {
  const command = process.argv[2] ?? "start";
  if (command === "start") {
    process.once("SIGINT", () => void stopChildren().finally(() => process.exit(0)));
    process.once("SIGTERM", () => void stopChildren().finally(() => process.exit(0)));
    await startDemo();
    await new Promise(() => {});
  } else if (command === "status") {
    const result = await fetchJson(`${CONTROL_ORIGIN}/demo/status`);
    console.log(JSON.stringify(result.body ?? result, null, 2));
  } else if (command === "stop") {
    const state = await readJson(STATE_FILE);
    if (!state?.runnerPid || !processExists(state.runnerPid)) return console.log("AgentID Demo 未运行。");
    process.kill(state.runnerPid, "SIGTERM");
    console.log(`已请求停止 AgentID Demo（PID ${state.runnerPid}）。`);
  } else if (command === "reset") {
    await resetDemo();
  } else {
    throw new Error(`Unknown demo command: ${command}`);
  }
}

main().catch(async (error) => {
  console.error(error);
  await stopChildren().catch(() => undefined);
  process.exitCode = 1;
});
