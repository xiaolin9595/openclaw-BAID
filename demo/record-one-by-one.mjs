import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import playwright from "../agentid-ui-demo/node_modules/playwright/index.js";

const { chromium } = playwright;
const exec = promisify(execFile);
const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const OUTPUT = path.join(ROOT, "output", "playwright", "one-by-one-frames");
const BRIDGE = "http://127.0.0.1:8798";
const WEB = "http://localhost:4173";
const OPENCLAW = path.join(ROOT, "openclawAgentid", "libp2p-mesh", "node_modules", ".bin", "openclaw");

await fs.rm(OUTPUT, { recursive: true, force: true });
await fs.mkdir(OUTPUT, { recursive: true });
const json = async (url, init) => { const r = await fetch(url, init); const b = await r.json(); if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(b)}`); return b; };
const status = () => json(`${BRIDGE}/demo/status`);
const waitUntil = async (predicate, timeout = 30000) => { const end = Date.now() + timeout; while (Date.now() < end) { const value = await predicate(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 250)); } throw new Error("Timed out waiting for demo state"); };
const screenshotTerminal = async (windowId, name) => { await exec("/usr/sbin/screencapture", ["-x", "-l", String(windowId), path.join(OUTPUT, `${name}.png`)]); };
const launchLink = async (profile) => {
  const { stdout } = await exec("/usr/bin/osascript", ["-e", `tell application "Terminal" to do script "cd ${path.join(ROOT, "openclawAgentid", "libp2p-mesh")} && ${OPENCLAW} --profile ${profile} libp2p-mesh agentid link --issuer http://localhost:8787"`]);
  const windowId = stdout.match(/window id (\d+)/)?.[1];
  if (!windowId) throw new Error(`Cannot identify terminal window: ${stdout}`);
  const contents = async () => (await exec("/usr/bin/osascript", ["-e", `tell application "Terminal" to contents of selected tab of window id ${windowId}`])).stdout;
  const requestId = await waitUntil(async () => (await contents()).match(/request_id=([0-9a-f-]+)/)?.[1], 15000);
  await screenshotTerminal(windowId, `${profile}-01-command-and-request`);
  return { windowId, requestId, contents };
};

await exec(OPENCLAW, ["--profile", "agentid-demo-a", "libp2p-mesh", "agentid", "unlink"]);
await exec(OPENCLAW, ["--profile", "agentid-demo-b", "libp2p-mesh", "agentid", "unlink"]);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
let frame = 0;
const capture = async (name, holdMs = 2200) => { await page.screenshot({ path: path.join(OUTPUT, `${String(frame++).padStart(4, "0")}-${name}.png`) }); await page.waitForTimeout(holdMs); };
const mailboxCode = async (email) => waitUntil(async () => { const b = await json(`${BRIDGE}/demo/mailbox?email=${encodeURIComponent(email)}`); return /^\d{6}$/.test(b.code ?? "") ? b.code : undefined; }, 10000);
const approve = async (requestId, label) => {
  await page.goto(`${WEB}/device?request_id=${requestId}`);
  await capture(`${label}-website-authorization`);
  await page.getByRole("button", { name: /使用 Passkey 创建并授权/ }).last().click({ force: true });
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).waitFor();
  await capture(`${label}-passkey-confirmation`);
  await page.getByRole("button", { name: /使用 Passkey 确认/ }).click();
  await page.getByRole("heading", { name: "使用 Passkey 确认" }).waitFor({ state: "hidden", timeout: 15000 });
};

try {
  const email = `record-one-by-one-${Date.now()}@example.com`;
  const a = await launchLink("agentid-demo-a");
  await page.goto(`${WEB}/control-plane.html`);
  await capture("00-website-login");
  await page.getByLabel("邮箱地址").fill(email);
  await page.getByRole("button", { name: "发送验证码" }).click();
  await page.getByLabel("6 位验证码").fill(await mailboxCode(email));
  await page.getByRole("button", { name: /验证并登录/ }).click();
  await page.getByRole("heading", { name: "我的 Agent" }).waitFor();
  await capture("01-user-logged-in");
  await approve(a.requestId, "02-a");
  await waitUntil(async () => (await status()).clients.a.status === "active");
  await waitUntil(async () => (await a.contents()).includes("AgentID linked:"));
  await screenshotTerminal(a.windowId, "agentid-demo-a-02-ibc-saved");
  await page.goto(`${WEB}/control-plane.html`);
  await capture("03-a-ibc-saved");

  const b = await launchLink("agentid-demo-b");
  await approve(b.requestId, "04-b");
  await waitUntil(async () => (await status()).clients.b.status === "active");
  await waitUntil(async () => (await b.contents()).includes("AgentID linked:"));
  await screenshotTerminal(b.windowId, "agentid-demo-b-02-ibc-saved");
  await page.goto(`${WEB}/control-plane.html`);
  await capture("05-b-ibc-saved");

  await page.getByRole("button", { name: /启动双向验证/ }).click();
  await waitUntil(async () => (await status()).p2p.status === "completed");
  await capture("06-p2p-bidirectional-verified", 3500);
  const s = await status();
  const revoke = await page.evaluate(async ({ agentId, instanceId }) => { const r = await fetch(`http://localhost:8787/v1/agents/${encodeURIComponent(agentId)}/instances/${encodeURIComponent(instanceId)}/revoke`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-agentid-request": "1", "idempotency-key": crypto.randomUUID() }, body: "{}" }); return { ok: r.ok, body: await r.json() }; }, { agentId: s.clients.a.agentId, instanceId: s.clients.a.instanceId });
  if (!revoke.ok) throw new Error(`Revoke failed: ${JSON.stringify(revoke.body)}`);
  await waitUntil(async () => (await status()).clients.a.status === "revoked");
  await capture("07-a-revoked");
  await page.getByRole("button", { name: "撤销 A 后再次验证" }).click();
  await waitUntil(async () => { const p = (await status()).p2p; return p.status === "completed" && p.mode === "after-revoke"; });
  await capture("08-revoked-message-rejected", 4000);
} finally { await browser.close(); }
console.log(`Recorded ${frame} browser frames and terminal captures to ${OUTPUT}`);
